// Authorization policy: named capabilities, roles bound at a scope, and can().
// Pure functions only; no database access.

const CAPABILITIES = {
  "site.view": "View the main site",
  "mission.view": "View a mission and its files",
  "mission.layer.edit": "Edit layers (a layer or folder and its children)",
  "mission.config.edit": "Edit a mission's whole configuration",
  "mission.create": "Create or clone missions",
  "mission.manage": "Rename or delete missions",
  "accounts.manage": "Manage user accounts",
  "groups.manage": "Manage groups and role bindings",
  "options.manage": "Manage site-wide general options",
  "webhooks.manage": "Manage webhooks",
  "broadcast.send": "Broadcast messages to clients",
  "tokens.create": "Create long-term tokens (up to one's own access)",
  "tokens.manage": "View and revoke everyone's long-term tokens",
  "draw.use": "Use Draw files and features",
  "data.geodatasets.read": "Read geodatasets",
  "data.geodatasets.write": "Create, modify and delete geodatasets",
  "data.datasets.read": "Read datasets",
  "data.datasets.write": "Create, modify and delete datasets",
  "data.stac.read": "Read STAC catalogs",
  "data.stac.write": "Create, modify and delete STAC collections and items",
};
const ALL_CAPABILITIES = Object.keys(CAPABILITIES);

// Capabilities that only make sense against a specific mission
const MISSION_SCOPED = new Set([
  "mission.view",
  "mission.layer.edit",
  "mission.config.edit",
]);

const READ_CAPABILITIES = [
  "site.view",
  "mission.view",
  "data.geodatasets.read",
  "data.datasets.read",
  "data.stac.read",
];

const ROLES = {
  superadmin: {
    label: "SuperAdmin",
    scopes: ["global"],
    capabilities: ALL_CAPABILITIES,
  },
  data_admin: {
    label: "Data Admin",
    scopes: ["global"],
    capabilities: [
      "site.view",
      "data.geodatasets.read",
      "data.geodatasets.write",
      "data.datasets.read",
      "data.datasets.write",
      "data.stac.read",
      "data.stac.write",
    ],
  },
  mission_admin: {
    label: "Mission Admin",
    scopes: ["global", "mission"],
    capabilities: ["mission.view", "mission.layer.edit", "mission.config.edit"],
  },
  layer_editor: {
    label: "Layer Editor",
    scopes: ["global", "mission", "layer"],
    capabilities: ["mission.view", "mission.layer.edit"],
  },
  viewer: {
    label: "Viewer",
    scopes: ["global", "mission"],
    capabilities: ["mission.view"],
  },
};
const ROLE_CAPS = Object.fromEntries(
  Object.entries(ROLES).map(([k, r]) => [k, new Set(r.capabilities)])
);

// Granted to every principal of that kind, independent of bindings
const BASELINE = {
  anonymous: new Set([
    "site.view",
    "data.geodatasets.read",
    "data.datasets.read",
    "data.stac.read",
  ]),
  authenticated: new Set([
    "site.view",
    "draw.use",
    "tokens.create",
    "data.geodatasets.read",
    "data.datasets.read",
    "data.stac.read",
  ]),
};

const SUBJECT_TYPES = ["user", "group", "audience"];
const AUDIENCES = ["anonymous", "authenticated", "everyone"];

function scopeKey(scopeType, missionUUID, layerUUID) {
  if (scopeType === "global") return "global";
  if (scopeType === "mission") return `mission:${missionUUID}`;
  if (scopeType === "layer") return `layer:${missionUUID}:${layerUUID}`;
  return null;
}

// resource: { mission?: missionUUID, layers?: [ancestorUUID, ..., layerUUID] }
function scopeChain(resource) {
  const chain = ["global"];
  if (resource && resource.mission) {
    chain.push(`mission:${resource.mission}`);
    (resource.layers || []).forEach((l) =>
      chain.push(`layer:${resource.mission}:${l}`)
    );
  }
  return chain;
}

function bindingGrants(binding, cap, chain) {
  const caps = ROLE_CAPS[binding.role];
  return caps != null && caps.has(cap) && chain.includes(binding.scope);
}

// principal: {
//   authenticated: bool,
//   bindings: [{ role, scope }],
//   token?: { scopes: string[]|null, missions: string[]|null }
// }
function can(principal, cap, resource) {
  if (!principal || !CAPABILITIES[cap]) return false;
  // Guests get nothing at all when the site requires login
  if (!principal.authenticated && principal.guestsAllowed === false) return false;
  const token = principal.token;
  if (token) {
    if (Array.isArray(token.scopes) && !token.scopes.includes(cap))
      return false;
    if (Array.isArray(token.missions)) {
      // A mission-limited token only reaches those missions, plus read-only site access
      if (resource && resource.mission) {
        if (!token.missions.includes(resource.mission)) return false;
      } else if (!MISSION_SCOPED.has(cap) && !READ_CAPABILITIES.includes(cap))
        return false;
    }
  }
  if (MISSION_SCOPED.has(cap) && !(resource && resource.mission)) {
    // Without a mission, only a global grant satisfies a mission capability
    return (principal.bindings || []).some((b) =>
      bindingGrants(b, cap, ["global"])
    );
  }
  const baseline =
    BASELINE[principal.authenticated ? "authenticated" : "anonymous"];
  if (baseline.has(cap)) return true;
  const chain = scopeChain(resource);
  const bindings = principal.bindings || [];
  if (bindings.some((b) => bindingGrants(b, cap, chain))) return true;
  // Editing any layer in a mission implies viewing that mission
  if (cap === "mission.view" && resource && resource.mission)
    return bindings.some(
      (b) =>
        ROLE_CAPS[b.role] &&
        ROLE_CAPS[b.role].has(cap) &&
        b.scope.startsWith(`layer:${resource.mission}:`)
    );
  return false;
}

// Missions (UUIDs) where cap is granted. null = every mission.
function missionsWith(principal, cap) {
  if (!principal) return [];
  if (!principal.authenticated && principal.guestsAllowed === false) return [];
  let result = null;
  const bindings = principal.bindings || [];
  const global = bindings.some((b) => bindingGrants(b, cap, ["global"]));
  if (!global) {
    const set = new Set();
    bindings.forEach((b) => {
      const caps = ROLE_CAPS[b.role];
      if (!caps || !caps.has(cap) || b.scope === "global") return;
      set.add(b.scope.split(":")[1]);
    });
    result = Array.from(set);
  }
  const token = principal.token;
  if (token) {
    if (Array.isArray(token.scopes) && !token.scopes.includes(cap)) return [];
    if (Array.isArray(token.missions))
      result =
        result == null
          ? token.missions.slice()
          : result.filter((m) => token.missions.includes(m));
  }
  return result;
}

// Layer subtree roots (UUIDs) in a mission where cap is granted via layer scope only
function layerRootsWith(principal, cap, missionUUID) {
  return (principal.bindings || [])
    .filter(
      (b) =>
        ROLE_CAPS[b.role] &&
        ROLE_CAPS[b.role].has(cap) &&
        b.scope.startsWith(`layer:${missionUUID}:`)
    )
    .map((b) => b.scope.split(":")[2]);
}

// Every capability the principal holds anywhere (for UI gating)
function capabilitiesOf(principal) {
  const out = new Set();
  ALL_CAPABILITIES.forEach((cap) => {
    if (MISSION_SCOPED.has(cap)) {
      const m = missionsWith(principal, cap);
      if (m == null || m.length > 0 || layerRootsAny(principal, cap))
        out.add(cap);
    } else if (can(principal, cap, null)) out.add(cap);
  });
  return Array.from(out);
}
function layerRootsAny(principal, cap) {
  return (principal.bindings || []).some(
    (b) =>
      ROLE_CAPS[b.role] &&
      ROLE_CAPS[b.role].has(cap) &&
      b.scope.startsWith("layer:")
  );
}

function isSuperAdmin(principal) {
  return (principal.bindings || []).some(
    (b) => b.role === "superadmin" && b.scope === "global"
  ) && !(principal.token && Array.isArray(principal.token.scopes));
}

// Coarse account role for display: superadmin | mission_admin | user
function accountRole(bindings) {
  if (bindings.some((b) => b.role === "superadmin" && b.scope === "global"))
    return "superadmin";
  if (bindings.some((b) => b.role === "mission_admin" || b.role === "layer_editor"))
    return "mission_admin";
  return "user";
}

// Missions/shared: signed-in users, and guests who can view at least one mission
function canReadSharedFolder(principal) {
  if (!principal) return false;
  if (principal.authenticated) return true;
  const viewable = missionsWith(principal, "mission.view");
  return viewable == null || viewable.length > 0;
}

module.exports = {
  CAPABILITIES,
  ALL_CAPABILITIES,
  MISSION_SCOPED,
  READ_CAPABILITIES,
  ROLES,
  BASELINE,
  SUBJECT_TYPES,
  AUDIENCES,
  scopeKey,
  scopeChain,
  can,
  missionsWith,
  canReadSharedFolder,
  layerRootsWith,
  capabilitiesOf,
  isSuperAdmin,
  accountRole,
};
