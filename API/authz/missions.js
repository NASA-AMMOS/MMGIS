// Stable mission identities (UUIDs) keyed by the current mission name
const logger = require("../logger");

function models() {
  const { AuthMission } = require("../../plugins/core/backend/Authz/models/authz");
  const Config = require("../../plugins/core/backend/Config/models/config");
  return { AuthMission, Config };
}

let byName = null;
let loading = null;

async function load() {
  const { AuthMission } = models();
  const rows = await AuthMission.findAll({ raw: true });
  byName = new Map(rows.map((r) => [r.name, r.uuid]));
  return byName;
}
function clear() {
  byName = null;
  loading = null;
}
async function map() {
  if (byName) return byName;
  if (!loading) loading = load().finally(() => (loading = null));
  return loading;
}

async function uuidForName(name) {
  if (typeof name !== "string" || name === "") return null;
  return (await map()).get(name) || null;
}
async function nameForUUID(uuid) {
  for (const [n, u] of await map()) if (u === uuid) return n;
  return null;
}
async function namesForUUIDs(uuids) {
  if (uuids == null) return null;
  const m = await map();
  const set = new Set(uuids);
  return Array.from(m.entries())
    .filter(([, u]) => set.has(u))
    .map(([n]) => n);
}
async function all() {
  return Array.from((await map()).entries()).map(([name, uuid]) => ({
    name,
    uuid,
  }));
}

async function ensureMission(name) {
  const existing = await uuidForName(name);
  if (existing) return existing;
  const { AuthMission } = models();
  const [row] = await AuthMission.findOrCreate({ where: { name } });
  clear();
  return row.uuid;
}

async function renameMission(oldName, newName) {
  const { AuthMission } = models();
  await AuthMission.update({ name: newName }, { where: { name: oldName } });
  clear();
  return ensureMission(newName);
}

async function removeMission(name) {
  const { AuthMission } = models();
  const { RoleBinding } = require("../../plugins/core/backend/Authz/models/authz");
  const uuid = await uuidForName(name);
  if (!uuid) return;
  await RoleBinding.destroy({ where: { mission_uuid: uuid } });
  await AuthMission.destroy({ where: { uuid } });
  clear();
  require("./principal").invalidate();
}

// Gives every mission in the configs table a UUID
async function backfill() {
  const { Config } = models();
  const rows = await Config.aggregate("mission", "DISTINCT", { plain: false });
  let created = 0;
  for (const r of rows) {
    if (!(await uuidForName(r.DISTINCT))) {
      await ensureMission(r.DISTINCT);
      created++;
    }
  }
  if (created > 0)
    logger("info", `Assigned UUIDs to ${created} mission(s).`, "authz");
  return created;
}

// Latest config for a mission name (null if none)
async function latestConfig(name) {
  const { Config } = models();
  const row = await Config.findOne({
    where: { mission: name },
    order: [["id", "DESC"]],
    attributes: ["config"],
    raw: true,
  });
  return row ? row.config : null;
}

// [rootAncestorUUID, ..., layerUUID] or null if the layer isn't in the tree
function layerChain(layers, uuid, ancestors = []) {
  if (!Array.isArray(layers)) return null;
  for (const layer of layers) {
    if (!layer || typeof layer !== "object") continue;
    const here = layer.uuid != null ? [...ancestors, String(layer.uuid)] : ancestors;
    if (layer.uuid != null && String(layer.uuid) === String(uuid)) return here;
    const found = layerChain(layer.sublayers, uuid, here);
    if (found) return found;
  }
  return null;
}

module.exports = {
  uuidForName,
  nameForUUID,
  namesForUUIDs,
  all,
  ensureMission,
  renameMission,
  removeMission,
  backfill,
  latestConfig,
  layerChain,
  clear,
};
