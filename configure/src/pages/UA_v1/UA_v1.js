// Combined Users & Access page (draft; the Users and Access pages remain for reference)
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../core/calls";
import { setSnackBarText, setModal, setPage } from "../../core/ConfigureStore";

import Toolbar from "@mui/material/Toolbar";
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
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Drawer from "@mui/material/Drawer";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Tooltip from "@mui/material/Tooltip";

import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import PersonIcon from "@mui/icons-material/Person";
import GroupsIcon from "@mui/icons-material/Groups";
import PublicIcon from "@mui/icons-material/Public";
import HowToRegIcon from "@mui/icons-material/HowToReg";

import ResetPasswordModal from "../Users/Modals/ResetPasswordModal/ResetPasswordModal";
import DeleteUserModal from "../Users/Modals/DeleteUserModal/DeleteUserModal";
import NewUserModal from "../Users/Modals/NewUserModal/NewUserModal";

const useStyles = makeStyles((theme) => ({
  page: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexFlow: "column",
    background: theme.palette.swatches.grey[1000],
    backgroundImage: "url(configure/build/gridlines.png)",
  },
  topbar: {
    width: "100%",
    height: "48px",
    minHeight: "48px !important",
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 20px",
    boxSizing: "border-box !important",
  },
  topbarTitle: { display: "flex", alignItems: "center", gap: "8px" },
  tabs: { padding: "0px 20px", borderBottom: `1px solid ${theme.palette.swatches.grey[700]}` },
  content: { flex: 1, overflowY: "auto", padding: "16px 32px 64px 32px" },
  pane: { paddingTop: "8px" },
  audience: {
    padding: "16px 0px",
    borderBottom: `1px solid ${theme.palette.swatches.grey[700]}`,
  },
  bar: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" },
  grow: { flex: 1 },
  hint: { fontSize: "13px", opacity: 0.75, marginBottom: "12px" },
  // Matches the Users page table
  table: {
    boxShadow: "0px 1px 7px 0px rgba(0, 0, 0, 0.2)",
    "& tr": { background: theme.palette.swatches.grey[850] },
    "& th": { fontWeight: "bold", fontSize: "13px", padding: "8px 12px" },
    "& td": {
      padding: "6px 12px",
      borderRight: `1px solid ${theme.palette.swatches.grey[800]}`,
      borderBottom: `1px solid ${theme.palette.swatches.grey[700]} !important`,
    },
    "& td:first-child": {
      fontWeight: "bold",
      letterSpacing: "1px",
      fontSize: "16px",
      color: `${theme.palette.swatches.p[13]}`,
    },
  },
  clickRow: { cursor: "pointer", "&:hover": { background: theme.palette.swatches.grey[800] } },
  muted: { opacity: 0.6 },
  roleText: { fontWeight: "bold" },
  badge: {
    display: "inline-block",
    padding: "4px 6px",
    borderRadius: "4px",
    marginRight: "4px",
    whiteSpace: "nowrap",
  },
  badge_superadmin: { background: "#db589a", color: "white" },
  badge_data_admin: { background: "#3a8fb7", color: "white" },
  badge_mission_admin: { background: theme.palette.swatches.p[0] },
  badge_user: { background: theme.palette.swatches.grey[300], color: "white" },
  missionLine: { display: "flex", gap: "8px", padding: "1px 0px", lineHeight: "18px" },
  missionLineLabel: { minWidth: "96px", flexShrink: 0, opacity: 0.7, fontSize: "12px" },
  drawer: { width: "640px", padding: "0px 24px 48px 24px", boxSizing: "border-box" },
  drawerHead: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "0px -24px",
    padding: "8px 16px 8px 24px",
    background: theme.palette.secondary.main,
    boxShadow: "0px 2px 6px 0px rgba(0, 0, 0, 0.35)",
    "& .MuiTypography-root, & .MuiIconButton-root, & svg": { color: "#fff" },
  },
  section: { marginTop: "20px" },
  sectionTitle: { fontSize: "14px !important", fontWeight: "bold !important", marginBottom: "6px !important" },
  input: { minWidth: "220px !important" },
  layerTree: {
    maxHeight: "260px",
    overflowY: "auto",
    border: `1px solid ${theme.palette.swatches.grey[700]}`,
    padding: "4px 8px",
  },
  layerRow: { display: "flex", alignItems: "center", cursor: "pointer", fontSize: "13px", padding: "2px 0px" },
  preview: {
    marginTop: "16px",
    padding: "10px",
    background: theme.palette.swatches.grey[800],
    fontSize: "13px",
  },
}));

const ROLE_HELP = {
  superadmin: "Everything: accounts, site options, data and every mission.",
  data_admin: "Manage geodatasets, datasets and STAC collections.",
  mission_admin: "Edit a mission's configuration and layers.",
  layer_editor: "Edit one layer or folder and everything inside it.",
  viewer: "See a mission.",
};
const SCOPE_LABEL = { global: "Site-wide", mission: "Mission", layer: "Layer & children" };
const AUDIENCE_LABEL = { everyone: "Everyone (including guests)", authenticated: "Logged-in users" };

const SUBJECT_STYLE = {
  user: { icon: PersonIcon, color: null, kind: "User" },
  group: { icon: GroupsIcon, color: "#8e5bd8", kind: "Group" },
  everyone: { icon: PublicIcon, color: "#2e9b6b", kind: "Audience" },
  authenticated: { icon: HowToRegIcon, color: "#d4881c", kind: "Audience" },
};

// Users, groups and audiences each get their own icon and color
function SubjectTag({ type, name }) {
  const s = SUBJECT_STYLE[type] || SUBJECT_STYLE.user;
  const Icon = s.icon;
  return (
    <span
      title={s.kind}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontWeight: "bold",
        letterSpacing: "normal",
        whiteSpace: "nowrap",
        ...(s.color ? { color: s.color } : {}),
      }}
    >
      <Icon style={{ fontSize: "16px" }} />
      {name}
    </span>
  );
}
// Effective access, grouped into the capabilities people ask about
const EFFECTIVE_ROWS = [
  { label: "View missions", caps: ["mission.view"] },
  { label: "Edit layers", caps: ["mission.layer.edit"] },
  { label: "Edit mission configuration", caps: ["mission.config.edit"] },
  { label: "Manage data (geodatasets, datasets, STAC)", caps: ["data.geodatasets.write", "data.datasets.write", "data.stac.write"] },
  { label: "Create missions", caps: ["mission.create"] },
  { label: "Manage accounts and access", caps: ["accounts.manage", "groups.manage"] },
  { label: "Site options, webhooks, broadcasts", caps: ["options.manage", "webhooks.manage", "broadcast.send"] },
  { label: "Manage everyone's tokens", caps: ["tokens.manage"] },
];

function api(call, data) {
  return new Promise((resolve, reject) =>
    calls.api(call, data, resolve, (res) => reject(res || {}))
  );
}

function flattenLayers(layers, depth = 0, path = [], out = []) {
  (layers || []).forEach((l) => {
    const p = [...path, l.name || l.uuid];
    out.push({ uuid: l.uuid, name: l.name || l.uuid, type: l.type, depth, path: p.join(" › ") });
    if (Array.isArray(l.sublayers)) flattenLayers(l.sublayers, depth + 1, p, out);
  });
  return out;
}

function useLayerPaths(missionNames) {
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

function whereText(b, layerPaths) {
  if (b.scope_type === "global") return "Site-wide";
  if (b.scope_type === "mission") return b.mission || "(deleted mission)";
  const path = (layerPaths[b.mission] || {})[b.layer_uuid];
  return `${b.mission || "?"} › ${path || `layer ${b.layer_uuid}`} (and everything inside)`;
}

function GrantsTable({ rows, roles, layerPaths, viaText, onRemove, emptyText }) {
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
            <TableCell className={c.roleText}>{(roles[r.b.role] && roles[r.b.role].label) || r.b.role}</TableCell>
            <TableCell>{whereText(r.b, layerPaths)}</TableCell>
            <TableCell className={r.removable || typeof r.via !== "string" ? "" : c.muted}>{r.via}</TableCell>
            <TableCell align="right">
              {r.removable && (
                <Tooltip title="Remove" placement="left" arrow>
                  <IconButton size="small" onClick={() => onRemove(r.b)}>
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

function sourceText(b) {
  if (b.source === "import") return "Direct (imported)";
  if (b.source && b.source !== "local") return `Direct (from ${b.source})`;
  return "Direct";
}

// One dialog for every grant: who, role, where, preview
function GrantDialog({ open, onClose, fixed, roles, missions, users, groups, notify, onDone }) {
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

  const roleNames = Object.keys(roles).filter((r) => subjectType !== "audience" || r === "viewer");
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
            <Select size="small" className={c.input} displayEmpty value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <MenuItem value=""><em>Choose…</em></MenuItem>
              {subjectType === "user" && users.map((u) => <MenuItem key={u.id} value={String(u.id)}>{u.username}</MenuItem>)}
              {subjectType === "group" && groups.map((g) => <MenuItem key={g.id} value={String(g.id)}>{g.name}</MenuItem>)}
              {subjectType === "audience" && Object.keys(AUDIENCE_LABEL).map((a) => <MenuItem key={a} value={a}>{AUDIENCE_LABEL[a]}</MenuItem>)}
            </Select>
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

function ConfirmDialog({ confirm, onClose }) {
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

function MissionMultiSelect({ missions, value, onChange, placeholder }) {
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

function PersonPanel({ user, ctx }) {
  const c = useStyles();
  const { roles, missions, groups, tokens, layerPathsFor, notify, refresh, askRemove, openGrant, dispatch } = ctx;
  const [effective, setEffective] = useState(null);
  const [viewMode, setViewMode] = useState("all");
  const [viewMissions, setViewMissions] = useState([]);
  const [groupPick, setGroupPick] = useState("");

  const load = useCallback(() => {
    api("access_effective", { user_id: user.id })
      .then((r) => setEffective(r.body))
      .catch((res) => notify(res.message || "Failed to get access.", "error"));
  }, [user.id, notify]);
  useEffect(load, [load, ctx.version]);
  useEffect(() => {
    setViewMode(user.missions_viewing == null ? "all" : "selected");
    setViewMissions(user.missions_viewing || []);
  }, [user]);

  const bindings = (effective && effective.bindings) || [];
  const layerPaths = layerPathsFor(bindings);
  const groupName = (id) => (groups.find((g) => String(g.id) === String(id)) || {}).name || `group ${id}`;
  const rows = bindings.map((b) => ({
    b,
    removable: b.subject_type === "user" && b.source !== "csso",
    via:
      b.subject_type === "user"
        ? sourceText(b)
        : b.subject_type === "group"
        ? <SubjectTag type="group" name={groupName(b.subject_id)} />
        : <SubjectTag type={b.subject_id} name={AUDIENCE_LABEL[b.subject_id] || b.subject_id} />,
  }));
  const memberOf = groups.filter((g) => g.members.some((m) => m.id === user.id));
  const myTokens = tokens.filter((t) => t.created_by_user_id === user.id);

  const saveViewing = (mode, list) =>
    api("account_update_user", { id: user.id, missions_viewing: mode === "all" ? null : list })
      .then(() => {
        notify("Viewing access updated.", "success");
        refresh();
      })
      .catch((res) => notify(res.message || "Failed to update viewing access.", "error"));

  const effectiveWhere = (caps) => {
    if (!effective) return null;
    const has = caps.filter((cap) => effective.capabilities.includes(cap));
    if (!has.length) return null;
    const scoped = has.map((cap) => effective.missions[cap]).filter((v) => v !== undefined);
    if (!scoped.length) return "Site-wide";
    if (scoped.some((v) => v == null)) return "All missions";
    const names = Array.from(new Set(scoped.flat()));
    return names.length ? names.join(", ") : null;
  };

  return (
    <>
      <div className={c.drawerHead}>
        <Typography variant="h6">{user.username}</Typography>
        <IconButton onClick={ctx.close}><CloseIcon /></IconButton>
      </div>

      <div className={c.section}>
        <Typography className={c.sectionTitle}>Account</Typography>
        <div className={c.bar}>
          <span className={c.grow}>{user.email || <span className={c.muted}>No email</span>}</span>
          <Button size="small" onClick={() => dispatch(setModal({ name: "resetPassword", row: user }))}>Reset password</Button>
          <Button size="small" color="error" onClick={() => dispatch(setModal({ name: "deleteUser", row: user }))}>Delete</Button>
        </div>
      </div>

      <div className={c.section}>
        <Typography className={c.sectionTitle}>Can view</Typography>
        <RadioGroup row value={viewMode} onChange={(e) => { setViewMode(e.target.value); if (e.target.value === "all") saveViewing("all"); }}>
          <FormControlLabel value="all" control={<Radio size="small" />} label="All missions" />
          <FormControlLabel value="selected" control={<Radio size="small" />} label="Selected missions" />
        </RadioGroup>
        {viewMode === "selected" && (
          <div className={c.bar}>
            <MissionMultiSelect missions={missions} value={viewMissions} onChange={setViewMissions} placeholder="No missions" />
            <Button size="small" variant="contained" disableElevation onClick={() => saveViewing("selected", viewMissions)}>Save</Button>
          </div>
        )}
        <div className={c.hint}>Groups and audiences below can still give this person access to more missions.</div>
      </div>

      <div className={c.section}>
        <div className={c.bar}>
          <Typography className={`${c.sectionTitle} ${c.grow}`}>Access</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => openGrant({ subject_type: "user", subject_id: user.id }, load)}>Add access</Button>
        </div>
        <GrantsTable rows={rows} roles={roles} layerPaths={layerPaths} onRemove={(b) => askRemove(b, load)} />
      </div>

      <div className={c.section}>
        <Typography className={c.sectionTitle}>Groups</Typography>
        {memberOf.length === 0 && <div className={c.muted}>Not in any group.</div>}
        {memberOf.length > 0 && (
          <Table size="small" className={c.table}>
            <TableBody>
              {memberOf.map((g) => (
                <TableRow key={g.id}>
                  <TableCell><SubjectTag type="group" name={g.name} /></TableCell>
                  <TableCell align="right">
                    {g.source === "local" && (
                      <Tooltip title="Remove from group" placement="left" arrow>
                        <IconButton size="small" onClick={() => api("access_members_remove", { group_id: g.id, user_id: user.id }).then(() => { refresh(); load(); }).catch((res) => notify(res.message || "Failed.", "error"))}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className={c.bar} style={{ marginTop: "8px" }}>
          <Select size="small" displayEmpty className={c.input} value={groupPick} onChange={(e) => setGroupPick(e.target.value)}>
            <MenuItem value=""><em>Add to group…</em></MenuItem>
            {groups.filter((g) => g.source === "local" && !memberOf.includes(g)).map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
          </Select>
          <Button size="small" disabled={groupPick === ""} onClick={() => api("access_members_add", { group_id: groupPick, user_id: user.id }).then(() => { setGroupPick(""); refresh(); load(); }).catch((res) => notify(res.message || "Failed.", "error"))}>Add</Button>
        </div>
      </div>

      <div className={c.section}>
        <Typography className={c.sectionTitle}>Effective access</Typography>
        <div className={c.hint}>Everything this person can do, combining their own access, their groups and the audiences.</div>
        <Table size="small" className={c.table}>
          <TableBody>
            {EFFECTIVE_ROWS.map((r) => {
              const where = effectiveWhere(r.caps);
              return (
                <TableRow key={r.label}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className={where ? "" : c.muted}>{where || "No"}</TableCell>
                </TableRow>
              );
            })}
            {effective && Object.keys(effective.layers || {}).length > 0 && (
              <TableRow>
                <TableCell>Edit specific layers</TableCell>
                <TableCell>
                  {Object.entries(effective.layers).map(([m, ls]) => (
                    <div key={m}>{ls.map((l) => `${m} › ${(layerPaths[m] || {})[l] || l}`).join(", ")}</div>
                  ))}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className={c.section}>
        <div className={c.bar}>
          <Typography className={`${c.sectionTitle} ${c.grow}`}>Long-term tokens</Typography>
          <Button size="small" onClick={() => dispatch(setPage({ page: "api_tokens" }))}>Open token page</Button>
        </div>
        {myTokens.length === 0 ? (
          <div className={c.muted}>No tokens.</div>
        ) : (
          <Table size="small" className={c.table}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Access</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {myTokens.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.name || t.token}</TableCell>
                  <TableCell>{Array.isArray(t.scopes) ? "Read-only" : "Full"}{t.missions ? ` · ${t.missions.join(", ")}` : ""}</TableCell>
                  <TableCell>{t.expires_at ? new Date(t.expires_at).toLocaleDateString() : "Never"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Revoke" placement="left" arrow>
                      <IconButton size="small" onClick={() => ctx.askConfirm({ title: "Revoke token?", text: `Revoke '${t.name || t.token}'? Anything using it stops working.`, action: "Revoke", onConfirm: () => api("longtermtoken_clear", { id: t.id }).then(refresh).catch((res) => notify(res.message || "Failed.", "error")) })}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}

function GroupPanel({ group, ctx }) {
  const c = useStyles();
  const { roles, users, bindings, layerPathsFor, notify, refresh, askRemove, openGrant } = ctx;
  const [pick, setPick] = useState("");
  const own = bindings.filter((b) => b.subject_type === "group" && String(b.subject_id) === String(group.id));
  const layerPaths = layerPathsFor(own);
  return (
    <>
      <div className={c.drawerHead}>
        <Typography variant="h6">{group.name}</Typography>
        <IconButton onClick={ctx.close}><CloseIcon /></IconButton>
      </div>
      {group.source !== "local" && (
        <div className={c.hint}>
          Members come from {group.source.toUpperCase()}: anyone whose group claims include <b>{group.external_name}</b>.
        </div>
      )}
      {group.source === "local" && (
        <div className={c.section}>
          <Typography className={c.sectionTitle}>Members</Typography>
          {group.members.length === 0 && <div className={c.muted}>No members.</div>}
          {group.members.length > 0 && (
            <Table size="small" className={c.table}>
              <TableBody>
                {group.members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.username}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Remove from group" placement="left" arrow>
                        <IconButton size="small" onClick={() => api("access_members_remove", { group_id: group.id, user_id: m.id }).then(refresh).catch((res) => notify(res.message || "Failed.", "error"))}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className={c.bar} style={{ marginTop: "8px" }}>
            <Select size="small" displayEmpty className={c.input} value={pick} onChange={(e) => setPick(e.target.value)}>
              <MenuItem value=""><em>Add member…</em></MenuItem>
              {users.filter((u) => !group.members.some((m) => m.id === u.id)).map((u) => <MenuItem key={u.id} value={u.id}>{u.username}</MenuItem>)}
            </Select>
            <Button size="small" disabled={pick === ""} onClick={() => api("access_members_add", { group_id: group.id, user_id: pick }).then(() => { setPick(""); refresh(); }).catch((res) => notify(res.message || "Failed.", "error"))}>Add</Button>
          </div>
        </div>
      )}
      <div className={c.section}>
        <div className={c.bar}>
          <Typography className={`${c.sectionTitle} ${c.grow}`}>Access</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => openGrant({ subject_type: "group", subject_id: group.id })}>Add access</Button>
        </div>
        <GrantsTable rows={own.map((b) => ({ b, removable: true, via: sourceText(b) }))} roles={roles} layerPaths={layerPaths} onRemove={(b) => askRemove(b)} />
      </div>
      <div className={c.section}>
        <Button color="error" size="small" onClick={() => ctx.askConfirm({ title: "Delete group?", text: `Delete '${group.name}'? Its members lose the access it grants.`, action: "Delete", onConfirm: () => api("access_groups_delete", { id: group.id }).then(() => { ctx.close(); refresh(); }).catch((res) => notify(res.message || "Failed.", "error")) })}>
          Delete group
        </Button>
      </div>
    </>
  );
}

const VIEW_ROLES = new Set(["superadmin", "mission_admin", "layer_editor", "viewer"]);
const SITE_ROLE_RANK = { superadmin: 0, data_admin: 1, mission_admin: 2, user: 3 };
const MAX_LISTED = 5;

function summarizeUser(u, bindings, roles, groups) {
  const isUser = (b) => b.subject_type === "user" && String(b.subject_id) === String(u.id);
  const groupIds = new Set(groups.filter((g) => g.members.some((m) => m.id === u.id)).map((g) => String(g.id)));
  const own = bindings.filter(isUser);
  // Everything that reaches this person: own grants, their groups and the audiences
  const reaching = bindings.filter(
    (b) =>
      isUser(b) ||
      (b.subject_type === "group" && groupIds.has(String(b.subject_id))) ||
      (b.subject_type === "audience" && ["everyone", "authenticated"].includes(b.subject_id))
  );
  let siteRoles = own.filter((b) => b.scope_type === "global" && b.role !== "viewer").map((b) => b.role);
  if (!siteRoles.length) siteRoles = own.some((b) => b.role === "mission_admin") ? ["mission_admin"] : ["user"];
  siteRoles = [...new Set(siteRoles)].sort((a, b) => (SITE_ROLE_RANK[a] ?? 9) - (SITE_ROLE_RANK[b] ?? 9));
  const viewAll = reaching.some((b) => b.scope_type === "global" && VIEW_ROLES.has(b.role));
  const viewList = viewAll ? [] : [...new Set(reaching.filter((b) => b.scope_type !== "global" && VIEW_ROLES.has(b.role) && b.mission).map((b) => b.mission))].sort();
  const byRole = {};
  own.filter((b) => b.role !== "viewer" && b.scope_type !== "global").forEach((b) => {
    const r = (byRole[b.role] = byRole[b.role] || { label: roles[b.role] ? roles[b.role].label : b.role, missions: {}, });
    const m = b.mission || "(deleted mission)";
    r.missions[m] = r.missions[m] || { layers: 0 };
    if (b.scope_type === "layer") r.missions[m].layers++;
    else r.missions[m].whole = true;
  });
  const lines = Object.values(byRole).map((r) => ({
    label: r.label,
    items: Object.keys(r.missions).sort().map((m) => {
      const x = r.missions[m];
      return x.whole || !x.layers ? m : `${m} (${x.layers} ${x.layers === 1 ? "layer" : "layers"})`;
    }),
  }));
  return { siteRoles, viewAll, viewList, lines };
}

function SiteRoleBadges({ siteRoles, roles }) {
  const c = useStyles();
  return siteRoles.map((r) => (
    <span key={r} className={`${c.badge} ${c[`badge_${r}`] || c.badge_user}`}>
      {r === "user" ? "User" : (roles[r] && roles[r].label) || r}
    </span>
  ));
}

function MissionList({ items }) {
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

function MissionsSummary({ s }) {
  const c = useStyles();
  return (
    <div>
      <div className={c.missionLine}>
        <span className={c.missionLineLabel}>Can view</span>
        <span>
          {s.viewAll ? <b>All</b> : s.viewList.length ? <MissionList items={s.viewList} /> : <span className={c.muted}>None</span>}
        </span>
      </div>
      {s.lines.map((l) => (
        <div key={l.label} className={c.missionLine}>
          <span className={c.missionLineLabel}>{l.label}</span>
          <span><MissionList items={l.items} /></span>
        </div>
      ))}
    </div>
  );
}

export default function UsersAccessV1() {
  const c = useStyles();
  const dispatch = useDispatch();
  const notify = useCallback((text, severity) => dispatch(setSnackBarText({ text, severity })), [dispatch]);
  const [tab, setTab] = useState(0);
  const [roles, setRoles] = useState({});
  const [missions, setMissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [defaults, setDefaults] = useState(null);
  const [search, setSearch] = useState("");
  const [peopleSort, setPeopleSort] = useState({ by: "username", dir: "asc" });
  const [panel, setPanel] = useState(null);
  const [grant, setGrant] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [version, setVersion] = useState(0);
  const [missionPick, setMissionPick] = useState("");
  const [newGroup, setNewGroup] = useState({ name: "", source: "local", external_name: "" });
  const [providers] = useState(
    String(window.mmgisglobal.AUTH_PROVIDERS || "").split(",").filter((p) => p && p !== "local")
  );

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    api("access_roles").then((r) => setRoles(r.body.roles)).catch(() => {});
    api("access_missions").then((r) => setMissions(r.body || [])).catch(() => {});
    api("account_entries").then((r) => setUsers((r.body && r.body.entries) || [])).catch(() => {});
    api("access_groups").then((r) => setGroups(r.body || [])).catch((res) => notify(res.message || "Failed to get groups.", "error"));
    api("access_bindings").then((r) => setBindings(r.body || [])).catch(() => {});
    api("longtermtoken_get").then((r) => setTokens(r.tokens || [])).catch(() => {});
    api("account_defaults").then((r) => setDefaults(r.body ? r.body.missions_viewing : null)).catch(() => {});
  }, [notify]);
  useEffect(refresh, [refresh]);

  const layerMissionNames = useMemo(
    () => Array.from(new Set(bindings.filter((b) => b.scope_type === "layer" && b.mission).map((b) => b.mission))),
    [bindings]
  );
  const allLayerPaths = useLayerPaths(layerMissionNames);
  const layerPathsFor = () => allLayerPaths;

  const askConfirm = (cfg) => setConfirm(cfg);
  const askRemove = (b, after) =>
    askConfirm({
      title: "Remove access?",
      text: `Remove ${(roles[b.role] && roles[b.role].label) || b.role} — ${whereText(b, allLayerPaths)}?`,
      onConfirm: () =>
        api("access_bindings_remove", { id: b.id })
          .then(() => {
            notify("Access removed.", "success");
            refresh();
            if (after) after();
          })
          .catch((res) => notify(res.message || "Failed to remove access.", "error")),
    });
  const openGrant = (fixed, after) => setGrant({ fixed, after });

  const ctx = {
    roles, missions, users, groups, bindings, tokens, version, notify, refresh, dispatch,
    askRemove, askConfirm, openGrant, layerPathsFor, close: () => setPanel(null),
  };

  const subjectName = (b) => {
    if (b.subject_type === "user") return <SubjectTag type="user" name={(users.find((u) => String(u.id) === String(b.subject_id)) || {}).username || `user ${b.subject_id}`} />;
    if (b.subject_type === "group") return <SubjectTag type="group" name={(groups.find((g) => String(g.id) === String(b.subject_id)) || {}).name || b.subject_id} />;
    return <SubjectTag type={b.subject_id} name={AUDIENCE_LABEL[b.subject_id] || b.subject_id} />;
  };

  const filteredUsers = users.filter((u) => !search || u.username.toLowerCase().includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase()));
  const peopleSortKey = {
    username: (r) => r.u.username.toLowerCase(),
    email: (r) => (r.u.email || "").toLowerCase(),
    site: (r) => SITE_ROLE_RANK[r.s.siteRoles[0]] ?? 9,
    missions: (r) => (r.s.viewAll ? Infinity : r.s.viewList.length),
    groups: (r) => r.gs.join(", ").toLowerCase(),
  }[peopleSort.by];
  const peopleRows = filteredUsers
    .map((u) => ({
      u,
      s: summarizeUser(u, bindings, roles, groups),
      gs: groups.filter((g) => g.members.some((m) => m.id === u.id)).map((g) => g.name).sort(),
    }))
    .sort((a, b) => {
      const ka = peopleSortKey(a);
      const kb = peopleSortKey(b);
      const cmp = ka < kb ? -1 : ka > kb ? 1 : a.u.username.localeCompare(b.u.username);
      return peopleSort.dir === "asc" ? cmp : -cmp;
    });
  const pickedMission = missions.find((m) => m.name === missionPick);
  const missionRows = pickedMission
    ? bindings
        .filter((b) => b.scope_type === "global" ? b.role !== "data_admin" : b.mission_uuid === pickedMission.uuid)
        .map((b) => ({ b, removable: true, via: b.scope_type === "global" ? "Site-wide grant" : sourceText(b) }))
    : [];

  const audienceState = (a) => {
    const own = bindings.filter((b) => b.subject_type === "audience" && b.subject_id === a && b.role === "viewer");
    if (own.some((b) => b.scope_type === "global")) return { mode: "all", list: [], own };
    if (own.length) return { mode: "selected", list: own.map((b) => b.mission).filter(Boolean), own };
    return { mode: "none", list: [], own };
  };
  const setAudience = async (a, mode, list) => {
    const { own } = audienceState(a);
    try {
      const keepGlobal = mode === "all";
      const wanted = new Set(mode === "selected" ? list : []);
      for (const b of own)
        if ((b.scope_type === "global" && !keepGlobal) || (b.scope_type === "mission" && !wanted.has(b.mission)))
          await api("access_bindings_remove", { id: b.id });
      if (keepGlobal && !own.some((b) => b.scope_type === "global"))
        await api("access_bindings_add", { subject_type: "audience", subject_id: a, role: "viewer", scope_type: "global" });
      for (const m of wanted)
        if (!own.some((b) => b.scope_type === "mission" && b.mission === m))
          await api("access_bindings_add", { subject_type: "audience", subject_id: a, role: "viewer", scope_type: "mission", mission: m });
      notify("Updated.", "success");
    } catch (res) {
      notify(res.message || "Failed to update.", "error");
    }
    refresh();
  };

  const panelUser = panel && panel.type === "user" ? users.find((u) => u.id === panel.id) : null;
  const panelGroup = panel && panel.type === "group" ? groups.find((g) => g.id === panel.id) : null;

  return (
    <div className={c.page}>
      <Toolbar className={c.topbar}>
        <div className={c.topbarTitle}>
          <ManageAccountsIcon />
          <Typography variant="h6">Users &amp; Access (UA_v1)</Typography>
        </div>
      </Toolbar>
      <Tabs className={c.tabs} value={tab} onChange={(e, v) => setTab(v)}>
        <Tab label="People" />
        <Tab label="Groups" />
        <Tab label="Missions" />
        <Tab label="Site-wide" />
      </Tabs>
      <div className={c.content}>
        {tab === 0 && (
          <div className={c.pane}>
            <div className={c.bar}>
              <TextField size="small" placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
              <span className={c.grow} />
              <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={() => dispatch(setModal({ name: "newUser" }))}>New user</Button>
            </div>
            <Table size="small" className={c.table}>
              <TableHead>
                <TableRow>
                  {[["username", "Username"], ["email", "Email"], ["site", "Site role"], ["missions", "Missions"], ["groups", "Groups"]].map(([k, label]) => (
                    <TableCell key={k} sortDirection={peopleSort.by === k ? peopleSort.dir : false}>
                      <TableSortLabel
                        active={peopleSort.by === k}
                        direction={peopleSort.by === k ? peopleSort.dir : "asc"}
                        onClick={() => setPeopleSort({ by: k, dir: peopleSort.by === k && peopleSort.dir === "asc" ? "desc" : "asc" })}
                      >
                        {label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {peopleRows.map(({ u, s, gs }) => {
                  return (
                    <TableRow key={u.id} className={c.clickRow} onClick={() => setPanel({ type: "user", id: u.id })}>
                      <TableCell className={c.roleText}>{u.username}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell><SiteRoleBadges siteRoles={s.siteRoles} roles={roles} /></TableCell>
                      <TableCell><MissionsSummary s={s} /></TableCell>
                      <TableCell>{gs.length ? gs.map((n, i) => <React.Fragment key={n}>{i > 0 && ", "}<SubjectTag type="group" name={n} /></React.Fragment>) : <span className={c.muted}>—</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className={c.hint} style={{ marginTop: "12px" }}>
              CSSO users aren't stored as accounts. Give them access through groups mapped from CSSO or the Site-wide tab.
            </div>
          </div>
        )}

        {tab === 1 && (
          <div className={c.pane}>
            <div className={c.bar}>
              <TextField size="small" placeholder="New group name" value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} />
              {providers.length > 0 && (
                <Select size="small" value={newGroup.source} onChange={(e) => setNewGroup({ ...newGroup, source: e.target.value })}>
                  <MenuItem value="local">Members managed here</MenuItem>
                  {providers.map((p) => <MenuItem key={p} value={p}>Members from {p.toUpperCase()}</MenuItem>)}
                </Select>
              )}
              {newGroup.source !== "local" && (
                <TextField size="small" placeholder={`${newGroup.source.toUpperCase()} group name`} value={newGroup.external_name} onChange={(e) => setNewGroup({ ...newGroup, external_name: e.target.value })} />
              )}
              <Button variant="contained" disableElevation disabled={!newGroup.name.trim()} onClick={() =>
                api("access_groups_create", { name: newGroup.name, source: newGroup.source, external_name: newGroup.external_name || undefined })
                  .then(() => { setNewGroup({ name: "", source: "local", external_name: "" }); refresh(); })
                  .catch((res) => notify(res.message || "Failed to create group.", "error"))
              }>Create group</Button>
            </div>
            <Table size="small" className={c.table}>
              <TableHead>
                <TableRow>
                  <TableCell>Group</TableCell>
                  <TableCell>Members</TableCell>
                  <TableCell>Access</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.length === 0 && (
                  <TableRow><TableCell colSpan={3} className={c.muted}>No groups yet.</TableCell></TableRow>
                )}
                {groups.map((g) => {
                  const own = bindings.filter((b) => b.subject_type === "group" && String(b.subject_id) === String(g.id));
                  return (
                    <TableRow key={g.id} className={c.clickRow} onClick={() => setPanel({ type: "group", id: g.id })}>
                      <TableCell><SubjectTag type="group" name={g.name} /></TableCell>
                      <TableCell>{g.source === "local" ? g.members.length : `from ${g.source.toUpperCase()} (${g.external_name})`}</TableCell>
                      <TableCell>{own.map((b) => `${(roles[b.role] || {}).label || b.role}: ${b.scope_type === "global" ? "site-wide" : b.mission}`).join(" · ") || <span className={c.muted}>—</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {tab === 2 && (
          <div className={c.pane}>
            <div className={c.bar}>
              <Select size="small" displayEmpty className={c.input} value={missionPick} onChange={(e) => setMissionPick(e.target.value)}>
                <MenuItem value=""><em>Choose a mission…</em></MenuItem>
                {missions.map((m) => <MenuItem key={m.uuid} value={m.name}>{m.name}</MenuItem>)}
              </Select>
              <span className={c.grow} />
              {pickedMission && (
                <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={() => openGrant({ mission: pickedMission.name })}>Add access</Button>
              )}
            </div>
            {pickedMission ? (
              <>
                <div className={c.hint}>Everyone with access to {pickedMission.name}, including site-wide grants that cover every mission.</div>
                <GrantsTable rows={missionRows} roles={roles} layerPaths={allLayerPaths} viaText={subjectName} onRemove={(b) => askRemove(b)} emptyText="Nobody has access to this mission yet." />
              </>
            ) : (
              <div className={c.muted}>Choose a mission to see who can access it.</div>
            )}
          </div>
        )}

        {tab === 3 && (
          <>
            {["everyone", "authenticated"].map((a) => {
              const st = audienceState(a);
              return (
                <AudienceCard key={`${a}-${st.mode}-${st.list.slice().sort().join(",")}`} title={<SubjectTag type={a} name={AUDIENCE_LABEL[a]} />} state={st} missions={missions}
                  hint={a === "everyone" ? "Every logged-in user (including CSSO users), plus guests when SITE_ACCESS is public or optional. Logged-in users always get at least this access, whatever is set below." : "Every logged-in user, including CSSO users. Adds to what Everyone gets: \"No access\" here doesn't take away access granted to Everyone."}
                  onSave={(mode, list) => setAudience(a, mode, list)} />
              );
            })}
            <AudienceCard key={`defaults-${defaults == null ? "all" : defaults.slice().sort().join(",")}`} title="Default for new accounts" missions={missions}
              hint="What a newly created account can view. Doesn't change existing accounts."
              noneLabel={null}
              state={{ mode: defaults == null ? "all" : "selected", list: defaults || [] }}
              onSave={(mode, list) =>
                api("account_update_defaults", { missions_viewing: mode === "all" ? null : list })
                  .then(() => { notify("Default updated.", "success"); refresh(); })
                  .catch((res) => notify(res.message || "Failed to update default.", "error"))
              } />
          </>
        )}
      </div>

      <Drawer anchor="right" open={!!(panelUser || panelGroup)} onClose={() => setPanel(null)}>
        <div className={c.drawer}>
          {panelUser && <PersonPanel user={panelUser} ctx={ctx} />}
          {panelGroup && <GroupPanel group={panelGroup} ctx={ctx} />}
        </div>
      </Drawer>
      <GrantDialog
        open={!!grant}
        fixed={grant && grant.fixed}
        onClose={() => setGrant(null)}
        roles={roles}
        missions={missions}
        users={users}
        groups={groups}
        notify={notify}
        onDone={() => { refresh(); if (grant && grant.after) grant.after(); }}
      />
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
      <ResetPasswordModal queryUsers={refresh} />
      <DeleteUserModal queryUsers={() => { setPanel(null); refresh(); }} />
      <NewUserModal queryUsers={refresh} />
    </div>
  );
}

function AudienceCard({ title, hint, state, missions, onSave, noneLabel = "No access" }) {
  const c = useStyles();
  const [mode, setMode] = useState(state.mode);
  const [list, setList] = useState(state.list);
  return (
    <div className={c.audience}>
      <Typography className={c.sectionTitle}>{title}</Typography>
      <div className={c.hint}>{hint}</div>
      <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value)}>
        {noneLabel && <FormControlLabel value="none" control={<Radio size="small" />} label={noneLabel} />}
        <FormControlLabel value="all" control={<Radio size="small" />} label="View all missions" />
        <FormControlLabel value="selected" control={<Radio size="small" />} label="View selected missions" />
      </RadioGroup>
      {mode === "selected" && <MissionMultiSelect missions={missions} value={list} onChange={setList} />}
      <div style={{ marginTop: "8px" }}>
        <Button size="small" variant="contained" disableElevation
          disabled={mode === state.mode && JSON.stringify(list.slice().sort()) === JSON.stringify(state.list.slice().sort())}
          onClick={() => onSave(mode, list)}>Save</Button>
      </div>
    </div>
  );
}
