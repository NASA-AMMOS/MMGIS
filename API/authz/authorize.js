// Route-level authorization: authorize(capability, resolver) middleware,
// declarative resource resolvers, and a registry used to check that every
// API route declares its permission.
const logger = require("../logger");
const policy = require("./policy");
const { resolvePrincipal } = require("./principal");
const missions = require("./missions");

function ensurePrincipal(req) {
  if (req.principal) return Promise.resolve(req.principal);
  return resolvePrincipal(req).then((p) => (req.principal = p));
}

function deny(req, res, message) {
  if (res.headersSent) return;
  res.status(403).send({ status: "failure", message: message || "Unauthorized" });
}

function getPath(obj, path) {
  return path
    .split(".")
    .reduce(
      (o, k) =>
        o != null && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined,
      obj
    );
}

// pick: "body.mission" | "query.mission" | "params.mission" | fn(req)
function picker(pick) {
  if (typeof pick === "function") return pick;
  return (req) => getPath(req, pick);
}

// Resolvers return: undefined (no resource), null (not found -> deny), or a resource
const resolvers = {
  // Mission by name; the UUID comes from the server-side mission table
  mission(pick) {
    const get = picker(pick);
    const fn = async (req) => {
      const name = get(req);
      if (typeof name !== "string" || name === "") return null;
      const uuid = await missions.uuidForName(name);
      return uuid ? { mission: uuid, missionName: name } : null;
    };
    fn.description = `mission(${typeof pick === "string" ? pick : "fn"})`;
    return fn;
  },
  // Layer in the mission's current config, with its ancestor folders
  layer(missionPick, layerPick) {
    const getMission = picker(missionPick);
    const getLayer = picker(layerPick);
    const fn = async (req) => {
      const name = getMission(req);
      const layer = getLayer(req);
      if (typeof name !== "string" || name === "" || layer == null) return null;
      const uuid = await missions.uuidForName(name);
      if (!uuid) return null;
      const config = await missions.latestConfig(name);
      const chain = config ? missions.layerChain(config.layers, layer) : null;
      if (!chain) return null;
      return { mission: uuid, missionName: name, layers: chain };
    };
    fn.description = `layer(${missionPick}, ${layerPick})`;
    return fn;
  },
  // Several layers (array) in one mission; each must be allowed
  layers(missionPick, layersPick) {
    const getMission = picker(missionPick);
    const getLayers = picker(layersPick);
    const fn = async (req) => {
      const name = getMission(req);
      let list = getLayers(req);
      if (!Array.isArray(list)) list = list == null ? [] : [list];
      if (typeof name !== "string" || name === "" || list.length === 0) return null;
      const uuid = await missions.uuidForName(name);
      if (!uuid) return null;
      const config = await missions.latestConfig(name);
      const out = [];
      for (const l of list) {
        const chain = config ? missions.layerChain(config.layers, l) : null;
        if (!chain) return null;
        out.push({ mission: uuid, missionName: name, layers: chain });
      }
      return out;
    };
    fn.description = `layers(${missionPick}, ${layersPick})`;
    return fn;
  },
};

function tag(fn, meta) {
  fn.__authz = meta;
  return fn;
}

// authorize("mission.layer.edit", resolvers.layer("body.mission", "body.layerUUID"))
function authorize(cap, resolver, options = {}) {
  if (!policy.CAPABILITIES[cap]) throw new Error(`Unknown capability: ${cap}`);
  const caps = [cap].concat(options.or || []);
  const mw = (req, res, next) => {
    ensurePrincipal(req)
      .then(async (principal) => {
        if (principal.kind === "invalid_token") return deny(req, res, "Unauthorized Token!");
        const resource = resolver ? await resolver(req) : undefined;
        if (resource === null) return deny(req, res);
        const list = Array.isArray(resource) ? resource : [resource];
        const granted = caps.find((c) =>
          list.every((r) => policy.can(principal, c, r || null))
        );
        if (!granted) {
          logger(
            "warn",
            `Denied '${cap}' for ${principal.username || principal.kind}.`,
            req.originalUrl,
            req
          );
          return deny(req, res);
        }
        req.authz = { capability: granted, resource };
        next();
      })
      .catch((err) => {
        logger("error", "Authorization check failed.", req.originalUrl, req, err);
        deny(req, res, "Failed to verify permissions.");
      });
  };
  return tag(mw, {
    capability: caps.join(" | "),
    resolver: resolver ? resolver.description || resolver.name || "custom" : "-",
  });
}

// Explicitly unauthenticated route (e.g. login)
authorize.public = (reason) =>
  tag((req, res, next) => next(), { capability: "public", resolver: reason });

// Route checks permissions itself in the handler (e.g. lists filtered per user)
authorize.inHandler = (cap, reason) => {
  const mw = authorize(cap);
  mw.__authz = { capability: cap, resolver: `in handler: ${reason}` };
  return mw;
};

// Per-request helper for handlers
async function can(req, cap, resource) {
  const principal = await ensurePrincipal(req);
  return policy.can(principal, cap, resource || null);
}

// Mission names the request may use with cap (null = all)
async function missionNamesWith(req, cap) {
  const principal = await ensurePrincipal(req);
  const uuids = policy.missionsWith(principal, cap);
  return uuids == null ? null : missions.namesForUUIDs(uuids);
}

////// Route registry / coverage
const registry = [];
function registerRouter(prefix, router) {
  registry.push({ prefix, router });
  return router;
}

function routeTable() {
  const rows = [];
  registry.forEach(({ prefix, router }) => {
    (router.stack || []).forEach((layer) => {
      if (!layer.route) return;
      const methods = Object.keys(layer.route.methods || {}).filter(
        (m) => layer.route.methods[m]
      );
      const meta = (layer.route.stack || [])
        .map((l) => l.handle && l.handle.__authz)
        .filter(Boolean);
      rows.push({
        path: prefix + layer.route.path,
        methods: methods.map((m) => m.toUpperCase()).join(","),
        capability: meta.map((m) => m.capability).join(" + ") || null,
        resolver: meta.map((m) => m.resolver).join(" + ") || null,
      });
    });
  });
  return rows;
}

function undeclaredRoutes() {
  return routeTable().filter((r) => r.capability == null);
}

module.exports = {
  authorize,
  resolvers,
  can,
  missionNamesWith,
  ensurePrincipal,
  deny,
  registerRouter,
  routeTable,
  undeclaredRoutes,
};
