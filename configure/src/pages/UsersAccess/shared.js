import React, { useEffect, useState } from "react";
import { makeStyles } from "@mui/styles";
import { calls } from "../../core/calls";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Tooltip from "@mui/material/Tooltip";
import Popover from "@mui/material/Popover";
import Autocomplete from "@mui/material/Autocomplete";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import GroupsIcon from "@mui/icons-material/Groups";
import PublicIcon from "@mui/icons-material/Public";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useStyles } from "./styles";

// Pieces shared by the Users & Access tabs and panels
export const ROLE_HELP = {
  superadmin: "Everything: accounts, site options, data and every mission.",
  data_admin: "Manage geodatasets, datasets and STAC collections.",
  mission_admin: "Edit a mission's configuration and layers.",
  layer_editor: "Edit one layer or folder and everything inside it.",
  viewer: "See a mission.",
};
// Least to most access; matches the badge colour ramp
export const ROLE_RANK = ["viewer", "layer_editor", "mission_admin", "data_admin", "superadmin"];
export const SCOPE_LABEL = { global: "Site-wide", mission: "Mission", layer: "Layer & children" };
export const AUDIENCE_LABEL = { everyone: "Everyone (including guests)", authenticated: "Logged-in users" };
export const AUDIENCE_ORDER = ["everyone", "authenticated", "anonymous"];

export const SUBJECT_STYLE = {
  user: { icon: PersonIcon, swatch: 13, kind: "User" },
  group: { icon: GroupsIcon, swatch: 11, kind: "Group" },
  everyone: { icon: PublicIcon, swatch: 12, kind: "Audience" },
  authenticated: { icon: HowToRegIcon, swatch: 12, kind: "Audience" },
};

export const useSubjectStyles = makeStyles((theme) => ({
  tag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontWeight: "bold",
    letterSpacing: "normal",
    whiteSpace: "nowrap",
    color: ({ swatch }) => theme.palette.swatches.p[swatch],
  },
  kind: {
    marginLeft: "4px",
    padding: "0px 6px",
    borderRadius: "3px",
    fontSize: "10px",
    lineHeight: "16px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    border: "1px solid currentColor",
    background: ({ swatch }) => `${theme.palette.swatches.p[swatch]}14`,
  },
}));

// Users, groups and audiences each get their own icon, colour and kind label.
// Pass showKind={false} where the column already says what kind it is.
export function SubjectTag({ type, name, showKind = true }) {
  const s = SUBJECT_STYLE[type] || SUBJECT_STYLE.user;
  const c = useSubjectStyles({ swatch: s.swatch });
  const Icon = s.icon;
  return (
    <span title={s.kind} className={c.tag}>
      <Icon style={{ fontSize: "16px" }} />
      {name}
      {showKind && <span className={c.kind}>{s.kind}</span>}
    </span>
  );
}
// Effective access, grouped into the capabilities people ask about
export const EFFECTIVE_ROWS = [
  { label: "View missions", caps: ["mission.view"] },
  { label: "Edit layers", caps: ["mission.layer.edit"] },
  { label: "Edit mission configuration", caps: ["mission.config.edit"] },
  { label: "Manage data (geodatasets, datasets, STAC)", caps: ["data.geodatasets.write", "data.datasets.write", "data.stac.write"] },
  { label: "Create missions", caps: ["mission.create"] },
  { label: "Manage accounts and access", caps: ["accounts.manage", "groups.manage"] },
  { label: "Site options, webhooks, broadcasts", caps: ["options.manage", "webhooks.manage", "broadcast.send"] },
  { label: "Manage everyone's tokens", caps: ["tokens.manage"] },
];

export function api(call, data) {
  return new Promise((resolve, reject) =>
    calls.api(call, data, resolve, (res) => reject(res || {}))
  );
}

export function flattenLayers(layers, depth = 0, path = [], out = []) {
  (layers || []).forEach((l) => {
    const p = [...path, l.name || l.uuid];
    out.push({ uuid: l.uuid, name: l.name || l.uuid, type: l.type, depth, path: p.join(" › ") });
    if (Array.isArray(l.sublayers)) flattenLayers(l.sublayers, depth + 1, p, out);
  });
  return out;
}

export function useLayerPaths(missionNames) {
  const [paths, setPaths] = useState({});
  const key = missionNames.slice().sort().join("|");
  useEffect(() => {
    missionNames.forEach((m) => {
      if (paths[m]) return;
      api("get", { mission: m })
        .then((cfg) => {
          const map = {};
          flattenLayers(cfg && cfg.layers).forEach((l) => (map[l.uuid] = l.path));
          setPaths((p) => ({ ...p, [m]: map }));
        })
        .catch(() => {});
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return paths;
}

export function whereText(b, layerPaths) {
  if (b.scope_type === "global") return "Site-wide";
  if (b.scope_type === "mission") return b.mission || "(deleted mission)";
  const path = (layerPaths[b.mission] || {})[b.layer_uuid];
  return `${b.mission || "?"} › ${path || `layer ${b.layer_uuid}`} (and everything inside)`;
}

export function GrantsTable({ rows, roles, layerPaths, viaText, onRemove, emptyText }) {
  const c = useStyles();
  if (!rows.length) return <div className={c.muted}>{emptyText || "No access granted."}</div>;
  return (
    <Table size="small" className={c.table}>
      <TableHead>
        <TableRow>
          {viaText && <TableCell>Who</TableCell>}
          <TableCell>Role</TableCell>
          <TableCell>Where</TableCell>
          <TableCell>Granted via</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={`${r.b.subject_type}-${r.b.id}`}>
            {viaText && <TableCell>{viaText(r.b)}</TableCell>}
            <TableCell><RoleBadge role={r.b.role} roles={roles} /></TableCell>
            <TableCell>{whereText(r.b, layerPaths)}</TableCell>
            <TableCell className={r.removable || typeof r.via !== "string" ? "" : c.muted}>{r.via}</TableCell>
            <TableCell align="right">
              {r.removable && (
                <Tooltip title="Remove" placement="left" arrow>
                  <IconButton size="small" className={c.rowIcon} onClick={() => onRemove(r.b)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RoleBadge({ role, roles }) {
  const c = useStyles();
  return (
    <span className={`${c.badge} ${c[`badge_${role}`] || c.badge_user}`}>
      {(roles[role] && roles[role].label) || role}
    </span>
  );
}

// One collapsible section per user, group or audience
export function GroupedGrantsTable({ sections, expanded, onToggle, roles, layerPaths, onRemove, emptyText }) {
  const c = useStyles();
  if (!sections.length) return <div className={c.muted}>{emptyText}</div>;
  return (
    <Table size="small" className={c.table}>
      <TableHead>
        <TableRow>
          <TableCell>Who</TableCell>
          <TableCell>Role</TableCell>
          <TableCell>Where</TableCell>
          <TableCell>Granted via</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {sections.map((sec) => {
          const open = expanded(sec.key);
          const Arrow = open ? KeyboardArrowDownIcon : KeyboardArrowRightIcon;
          return (
            <React.Fragment key={sec.key}>
              <TableRow className={c.subjectRow} onClick={() => onToggle(sec.key)} aria-expanded={open}>
                <TableCell>
                  <span className={c.subjectCell}>
                    <Arrow fontSize="small" />
                    <SubjectTag type={sec.tagType} name={sec.who} />
                  </span>
                </TableCell>
                <TableCell>
                  {[...new Set(sec.rows.map((r) => r.b.role))].sort((x, y) => ROLE_RANK.indexOf(x) - ROLE_RANK.indexOf(y)).map((role) => <RoleBadge key={role} role={role} roles={roles} />)}
                </TableCell>
                <TableCell colSpan={3} className={c.muted}>
                  {sec.rows.length} {sec.rows.length === 1 ? "grant" : "grants"}
                </TableCell>
              </TableRow>
              {open && sec.rows.map((r) => (
                <TableRow key={`${r.b.subject_type}-${r.b.id}`} className={c.childRow}>
                  <TableCell />
                  <TableCell><RoleBadge role={r.b.role} roles={roles} /></TableCell>
                  <TableCell>{whereText(r.b, layerPaths)}</TableCell>
                  <TableCell>{r.via}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Remove" placement="left" arrow>
                      <IconButton size="small" className={c.rowIcon} onClick={() => onRemove(r.b)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function sourceText(b) {
  if (b.source === "import") return "Direct (imported)";
  if (b.source && b.source !== "local") return `Direct (from ${b.source})`;
  return "Direct";
}

// One dialog for every grant: who, role, where, preview
export function GrantDialog({ open, onClose, fixed, roles, missions, users, groups, notify, onDone }) {
  const c = useStyles();
  const [subjectType, setSubjectType] = useState("user");
  const [subjectId, setSubjectId] = useState("");
  const [role, setRole] = useState("viewer");
  const [scope, setScope] = useState("mission");
  const [picked, setPicked] = useState([]);
  const [layerMission, setLayerMission] = useState("");
  const [layers, setLayers] = useState([]);
  const [layer, setLayer] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSubjectType((fixed && fixed.subject_type) || "user");
    setSubjectId(fixed && fixed.subject_id != null ? String(fixed.subject_id) : "");
    setRole("viewer");
    setScope("mission");
    setPicked(fixed && fixed.mission ? [fixed.mission] : []);
    setLayerMission((fixed && fixed.mission) || "");
    setLayer(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const roleNames = Object.keys(roles).filter(
    (r) => (subjectType !== "audience" || r === "viewer") && (subjectType === "user" || r !== "superadmin")
  );
  const scopes = (roles[role] && roles[role].scopes) || [];
  useEffect(() => {
    if (scopes.length && !scopes.includes(scope)) setScope(scopes[0]);
  }, [role, subjectType]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!roleNames.includes(role) && roleNames.length) setRole(roleNames[0]);
  }, [subjectType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLayer(null);
    if (scope !== "layer" || !layerMission) return setLayers([]);
    api("get", { mission: layerMission })
      .then((cfg) => setLayers(flattenLayers(cfg && cfg.layers)))
      .catch(() => setLayers([]));
  }, [scope, layerMission]);

  const whoName = () => {
    if (subjectType === "audience") return AUDIENCE_LABEL[subjectId] || subjectId;
    if (subjectType === "group") return `members of ${(groups.find((g) => String(g.id) === subjectId) || {}).name || "the group"}`;
    return (users.find((u) => String(u.id) === subjectId) || {}).username || "this user";
  };
  const roleLabel = (roles[role] && roles[role].label) || role;
  let where = "";
  if (scope === "global") where = "on every mission and site-wide";
  else if (scope === "mission") where = picked.length ? `on ${picked.join(", ")}` : "";
  else if (layer) where = `on ${layerMission} › ${layer.path} and everything inside it`;
  const ready = subjectId !== "" && where !== "";

  const grant = async () => {
    const base = { subject_type: subjectType, subject_id: subjectId, role, scope_type: scope };
    const list =
      scope === "global"
        ? [base]
        : scope === "mission"
        ? picked.map((m) => ({ ...base, mission: m }))
        : [{ ...base, mission: layerMission, layer_uuid: layer.uuid }];
    try {
      for (const b of list) await api("access_bindings_add", b);
      notify("Access granted.", "success");
      onDone();
      onClose();
    } catch (res) {
      notify(res.message || "Failed to grant access.", "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add access</DialogTitle>
      <DialogContent>
        <Typography className={c.sectionTitle}>Who</Typography>
        {fixed && fixed.subject_type ? (
          <div>{whoName()}</div>
        ) : (
          <div className={c.bar}>
            <Select size="small" value={subjectType} onChange={(e) => { setSubjectType(e.target.value); setSubjectId(""); }}>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="group">Group</MenuItem>
              <MenuItem value="audience">Audience</MenuItem>
            </Select>
            {subjectType === "audience" ? (
              <Select size="small" className={c.input} displayEmpty value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <MenuItem value=""><em>Choose…</em></MenuItem>
                {Object.keys(AUDIENCE_LABEL).map((a) => <MenuItem key={a} value={a}>{AUDIENCE_LABEL[a]}</MenuItem>)}
              </Select>
            ) : (
              <SubjectSearch
                key={subjectType}
                options={subjectType === "user" ? users.map((u) => ({ id: String(u.id), label: u.username })) : groups.map((g) => ({ id: String(g.id), label: g.name }))}
                value={subjectId}
                onChange={setSubjectId}
                placeholder={subjectType === "user" ? "Search users…" : "Search groups…"}
              />
            )}
          </div>
        )}

        <Typography className={c.sectionTitle} style={{ marginTop: "16px" }}>Role</Typography>
        <RadioGroup value={role} onChange={(e) => setRole(e.target.value)}>
          {roleNames.map((r) => (
            <FormControlLabel
              key={r}
              value={r}
              control={<Radio size="small" />}
              label={<span><b>{roles[r].label}</b> — {ROLE_HELP[r] || ""}</span>}
            />
          ))}
        </RadioGroup>

        <Typography className={c.sectionTitle} style={{ marginTop: "16px" }}>Where</Typography>
        <RadioGroup row value={scope} onChange={(e) => setScope(e.target.value)}>
          {scopes.map((s) => (
            <FormControlLabel key={s} value={s} control={<Radio size="small" />} label={SCOPE_LABEL[s]} />
          ))}
        </RadioGroup>
        {scope === "mission" && (
          <Select
            size="small"
            multiple
            displayEmpty
            className={c.input}
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            renderValue={(v) => (v.length ? v.join(", ") : <em>Choose missions…</em>)}
          >
            {missions.map((m) => (
              <MenuItem key={m.uuid} value={m.name}>
                <Checkbox size="small" checked={picked.includes(m.name)} />
                <ListItemText primary={m.name} />
              </MenuItem>
            ))}
          </Select>
        )}
        {scope === "layer" && (
          <>
            <Select size="small" displayEmpty className={c.input} value={layerMission} onChange={(e) => setLayerMission(e.target.value)}>
              <MenuItem value=""><em>Choose a mission…</em></MenuItem>
              {missions.map((m) => <MenuItem key={m.uuid} value={m.name}>{m.name}</MenuItem>)}
            </Select>
            {layerMission && (
              <div className={c.layerTree} style={{ marginTop: "8px" }}>
                {layers.length === 0 && <div className={c.muted}>This mission has no layers.</div>}
                {layers.map((l) => (
                  <div key={l.uuid} className={c.layerRow} style={{ paddingLeft: `${l.depth * 18}px` }} onClick={() => setLayer(l)}>
                    <Radio size="small" checked={!!layer && layer.uuid === l.uuid} />
                    <span>{l.name}</span>
                    {l.type === "header" && <span className={c.muted}>&nbsp;(folder)</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div className={c.preview}>
          {ready ? `${whoName()} will be able to: ${roleLabel} ${where}.` : "Choose who and where to see a preview."}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={!ready} onClick={grant}>Grant</Button>
      </DialogActions>
    </Dialog>
  );
}

export function ConfirmDialog({ confirm, onClose }) {
  return (
    <Dialog open={!!confirm} onClose={onClose}>
      <DialogTitle>{confirm && confirm.title}</DialogTitle>
      <DialogContent>{confirm && confirm.text}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" disableElevation onClick={() => { confirm.onConfirm(); onClose(); }}>
          {(confirm && confirm.action) || "Remove"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function MissionMultiSelect({ missions, value, onChange, placeholder }) {
  const c = useStyles();
  return (
    <Select
      size="small"
      multiple
      displayEmpty
      className={c.input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      renderValue={(v) => (v.length ? v.join(", ") : <em>{placeholder || "Choose missions…"}</em>)}
    >
      {missions.map((m) => (
        <MenuItem key={m.uuid} value={m.name}>
          <Checkbox size="small" checked={value.includes(m.name)} />
          <ListItemText primary={m.name} />
        </MenuItem>
      ))}
    </Select>
  );
}

export const PICK_LIMIT = 50;

// Searchable picker that renders at most PICK_LIMIT matches, so sites with thousands of accounts stay responsive
export function SubjectSearch({ options, value, onChange, placeholder }) {
  const c = useStyles();
  const selected = options.find((o) => o.id === value) || null;
  return (
    <Autocomplete
      size="small"
      className={c.input}
      options={options}
      value={selected}
      onChange={(e, o) => onChange(o ? o.id : "")}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      getOptionLabel={(o) => o.label}
      filterOptions={(opts, { inputValue }) => {
        const q = inputValue.trim().toLowerCase();
        return (q ? opts.filter((o) => o.label.toLowerCase().includes(q)) : opts).slice(0, PICK_LIMIT);
      }}
      noOptionsText="No matches"
      renderInput={(params) => <TextField {...params} placeholder={placeholder} />}
    />
  );
}

// Button that opens a searchable list, e.g. "Add to group" or "Add member"
export function PickButton({ label, icon, items, onPick, emptyText }) {
  const c = useStyles();
  const [anchor, setAnchor] = useState(null);
  const [q, setQ] = useState("");
  const shown = items.filter((it) => it.label.toLowerCase().includes(q.toLowerCase()));
  const close = () => {
    setAnchor(null);
    setQ("");
  };
  return (
    <>
      <Button variant="outlined" size="small" className={c.sectionButton} startIcon={icon} disabled={!items.length} onClick={(e) => setAnchor(e.currentTarget)}>
        {label}
      </Button>
      <Popover open={!!anchor} anchorEl={anchor} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
        <div className={c.pickBox}>
          {items.length > 8 && (
            <div style={{ padding: "0px 12px 8px 12px" }}>
              <TextField autoFocus fullWidth size="small" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          <div className={c.pickList}>
            {shown.slice(0, PICK_LIMIT).map((it) => (
              <MenuItem key={it.value} onClick={() => { close(); onPick(it.value); }}>{it.label}</MenuItem>
            ))}
            {shown.length === 0 && <div className={c.muted} style={{ padding: "6px 16px" }}>{emptyText || "No matches."}</div>}
            {shown.length > PICK_LIMIT && <div className={c.hint} style={{ padding: "6px 16px", margin: 0 }}>{shown.length - PICK_LIMIT} more; type to narrow.</div>}
          </div>
        </div>
      </Popover>
    </>
  );
}

// Dark title bar with icon buttons for account-level actions
export function PanelHeader({ title, onClose, icons }) {
  const c = useStyles();
  return (
    <div className={c.drawerTop}>
      <div className={c.drawerHead}>
        <Typography variant="h6" className={c.grow}>{title}</Typography>
        {(icons || []).map((m) => (
          <Tooltip key={m.label} title={m.label} arrow>
            <IconButton aria-label={m.label} className={m.danger ? c.headDanger : ""} onClick={m.onClick}>{m.icon}</IconButton>
          </Tooltip>
        ))}
        <span className={c.headDivider} />
        <Tooltip title="Close" arrow>
          <IconButton aria-label="Close" onClick={onClose}><CloseIcon /></IconButton>
        </Tooltip>
      </div>
    </div>
  );
}

// Section title with an optional action button on the right
export function SectionHead({ title, children }) {
  const c = useStyles();
  return (
    <div className={c.sectionHead}>
      <Typography className={c.sectionTitle}>{title}</Typography>
      {children}
    </div>
  );
}

export const VIEW_ROLES = new Set(["superadmin", "mission_admin", "layer_editor", "viewer"]);
export const SITE_ROLE_RANK = { superadmin: 0, data_admin: 1, mission_admin: 2, user: 3 };
export const MAX_LISTED = 5;

export const pushTo = (map, k, v) => {
  if (!map.has(k)) map.set(k, []);
  map.get(k).push(v);
};

// One pass over bindings/groups so People stays fast with thousands of accounts
export function indexBindings(bindings, groups) {
  const byUser = new Map();
  const byGroup = new Map();
  const audience = [];
  bindings.forEach((b) => {
    if (b.subject_type === "user") pushTo(byUser, String(b.subject_id), b);
    else if (b.subject_type === "group") pushTo(byGroup, String(b.subject_id), b);
    else if (b.subject_type === "audience" && ["everyone", "authenticated"].includes(b.subject_id)) audience.push(b);
  });
  const groupsOf = new Map();
  groups.forEach((g) => g.members.forEach((m) => pushTo(groupsOf, String(m.id), g)));
  return { byUser, byGroup, audience, groupsOf };
}

export function summarizeUser(u, idx) {
  const own = idx.byUser.get(String(u.id)) || [];
  const myGroups = idx.groupsOf.get(String(u.id)) || [];
  // Everything that reaches this person: own grants, their groups and the audiences
  const reaching = own.concat(...myGroups.map((g) => idx.byGroup.get(String(g.id)) || []), idx.audience);
  let siteRoles = own.filter((b) => b.scope_type === "global" && b.role !== "viewer").map((b) => b.role);
  if (!siteRoles.length) siteRoles = own.some((b) => b.role === "mission_admin") ? ["mission_admin"] : ["user"];
  siteRoles = [...new Set(siteRoles)].sort((a, b) => (SITE_ROLE_RANK[a] ?? 9) - (SITE_ROLE_RANK[b] ?? 9));
  const viewAll = reaching.some((b) => b.scope_type === "global" && VIEW_ROLES.has(b.role));
  const viewList = viewAll ? [] : [...new Set(reaching.filter((b) => b.scope_type !== "global" && VIEW_ROLES.has(b.role) && b.mission).map((b) => b.mission))].sort();
  const scoped = (role) => {
    const ms = {};
    reaching.filter((b) => b.role === role && b.scope_type !== "global").forEach((b) => {
      const m = b.mission || "(deleted mission)";
      ms[m] = ms[m] || { layers: 0 };
      if (b.scope_type === "layer") ms[m].layers++;
      else ms[m].whole = true;
    });
    return Object.keys(ms).sort().map((m) => (ms[m].whole || !ms[m].layers ? m : `${m} (${ms[m].layers} ${ms[m].layers === 1 ? "layer" : "layers"})`));
  };
  return {
    siteRoles,
    viewAll,
    viewList,
    missionAdmin: scoped("mission_admin"),
    layerEditor: scoped("layer_editor"),
    groupNames: myGroups.map((g) => g.name).sort(),
  };
}

export const PEOPLE_COLUMNS = [
  ["username", "Username", (r) => r.u.username.toLowerCase()],
  ["email", "Email", (r) => (r.u.email || "").toLowerCase()],
  ["site", "Site role", (r) => SITE_ROLE_RANK[r.s.siteRoles[0]] ?? 9],
  ["view", "Can view", (r) => (r.s.viewAll ? Infinity : r.s.viewList.length)],
  ["admin", "Mission Admin", (r) => r.s.missionAdmin.length],
  ["layer", "Layer Editor", (r) => r.s.layerEditor.length],
  ["groups", "Groups", (r) => r.s.groupNames.join(", ").toLowerCase()],
  ["created", "Created", (r) => r.u.createdAt || ""],
  ["updated", "Updated", (r) => r.u.updatedAt || ""],
];

export const dateText = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export function SiteRoleBadges({ siteRoles, roles }) {
  const c = useStyles();
  return siteRoles.map((r) => (
    <span key={r} className={`${c.badge} ${c[`badge_${r}`] || c.badge_user}`}>
      {r === "user" ? "User" : (roles[r] && roles[r].label) || r}
    </span>
  ));
}

export function MissionList({ items }) {
  if (items.length <= MAX_LISTED) return items.join(", ");
  return (
    <span>
      {items.slice(0, MAX_LISTED).join(", ")}
      {", "}
      <Tooltip title={items.join(", ")} arrow>
        <u style={{ cursor: "help" }}>+{items.length - MAX_LISTED} more</u>
      </Tooltip>
    </span>
  );
}

