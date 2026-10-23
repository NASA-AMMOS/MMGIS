// Users & Access page: accounts, groups and access grants
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
import InputAdornment from "@mui/material/InputAdornment";
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
import TablePagination from "@mui/material/TablePagination";
import Drawer from "@mui/material/Drawer";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Tooltip from "@mui/material/Tooltip";
import Popover from "@mui/material/Popover";

import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import PersonIcon from "@mui/icons-material/Person";
import GroupsIcon from "@mui/icons-material/Groups";
import PublicIcon from "@mui/icons-material/Public";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";

import ResetPasswordModal from "./Modals/ResetPasswordModal/ResetPasswordModal";
import DeleteUserModal from "./Modals/DeleteUserModal/DeleteUserModal";
import NewUserModal from "./Modals/NewUserModal/NewUserModal";

const useStyles = makeStyles((theme) => ({
  page: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexFlow: "column",
    background: theme.palette.swatches.grey[1000],
    backgroundImage: "url(configure/build/gridlines.png)",
  },
  // Toolbar: title and add button
  topbar: {
    width: "calc(100% - 100px)",
    height: "44px",
    minHeight: "44px !important",
    display: "flex",
    justifyContent: "space-between",
    padding: "0px 20px",
    boxSizing: "border-box !important",
  },
  topbarTitle: {
    display: "flex",
    color: theme.palette.swatches.grey[150],
    "& > svg": { color: theme.palette.swatches.grey[150], margin: "3px 10px 0px 2px" },
  },
  // Panel used for the "Default for new accounts" box
  toolbarBox: {
    padding: "12px 16px",
    background: theme.palette.swatches.grey[850],
    borderRadius: "4px",
    marginBottom: "0px !important",
    boxShadow: "0px 1px 7px 0px rgba(0, 0, 0, 0.2)",
  },
  field: {
    "&.MuiInputBase-root, & .MuiInputBase-root": {
      height: "34px",
      fontSize: "14px",
      background: theme.palette.swatches.grey[1000],
    },
  },
  search: { width: "320px" },
  barHint: { fontSize: "13px", opacity: 0.75, minWidth: 0 },
  barButton: { height: "34px", whiteSpace: "nowrap", padding: "0px 16px !important" },
  tabs: {
    padding: "0px 20px",
    background: theme.palette.swatches.grey[1000],
    borderBottom: `1px solid ${theme.palette.swatches.grey[700]}`,
  },
  content: { flex: 1, overflowY: "auto", padding: "16px 32px 64px 32px" },
  pane: { paddingTop: "8px" },
  audience: {
    padding: "16px 0px",
    borderBottom: `1px solid ${theme.palette.swatches.grey[700]}`,
  },
  bar: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" },
  grow: { flex: 1 },
  hint: { fontSize: "13px", opacity: 0.75, marginBottom: "12px" },
  // People table
  table: {
    boxShadow: "0px 1px 7px 0px rgba(0, 0, 0, 0.2)",
    "& tr": { background: theme.palette.swatches.grey[850] },
    // Sticky headers pin to the top of the scrolling area, above its 16px top padding
    "& th.MuiTableCell-stickyHeader": { top: "-16px" },
    // Header cells
    "& th": {
      fontWeight: "bold !important",
      fontSize: "13px",
      padding: "8px 12px",
      textTransform: "uppercase",
      letterSpacing: "1px !important",
      backgroundColor: `${theme.palette.swatches.grey[1000]} !important`,
      borderRight: `1px solid ${theme.palette.swatches.grey[900]}`,
    },
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
  subjectRow: { cursor: "pointer", "&& td": { background: theme.palette.swatches.grey[900] }, "&:hover td": { background: theme.palette.swatches.grey[800] } },
  subjectCell: { display: "flex", alignItems: "center", gap: "4px" },
  childRow: { "& td:first-child": { borderRight: "none" } },
  badge: {
    display: "inline-block",
    padding: "4px 6px",
    borderRadius: "4px",
    marginRight: "4px",
    whiteSpace: "nowrap",
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: "normal",
    letterSpacing: "normal",
  },
  // Green (least access), then blue, through to red (most access)
  badge_viewer: { background: "#5b8c32", color: "white" },
  badge_layer_editor: { background: "#3a8fb7", color: "white" },
  badge_mission_admin: { background: theme.palette.swatches.p[0], color: "black" },
  badge_data_admin: { background: theme.palette.accent.tertiary, color: "white" },
  badge_superadmin: { background: "#db589a", color: "white" },
  badge_user: { background: theme.palette.swatches.grey[300], color: "white" },
  // Pagination footer: continues the table's shadow on the sides and bottom only,
  // and sits above the table so it covers the table's bottom shadow
  bottomBar: {
    position: "relative",
    zIndex: 1,
    background: theme.palette.swatches.grey[1000],
    borderTop: `1px solid ${theme.palette.swatches.grey[700]}`,
    boxShadow: "0px 1px 7px 0px rgba(0, 0, 0, 0.2)",
    clipPath: "inset(0px -12px -12px -12px)",
  },
  drawer: { width: "640px", padding: "0px 24px 48px 24px", boxSizing: "border-box" },
  // Title bar + action toolbar stay pinned while the panel scrolls
  drawerTop: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    margin: "0px -24px",
    boxShadow: "0px 2px 6px 0px rgba(0, 0, 0, 0.35)",
  },
  drawerHead: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "8px 16px 8px 24px",
    background: theme.palette.secondary.main,
    "& .MuiTypography-root, & .MuiIconButton-root, & svg": { color: "#fff" },
  },
  headDanger: { "&&, && svg": { color: "#ff9aa2" } },
  headDivider: { width: "1px", height: "24px", margin: "0px 4px", background: "rgba(255,255,255,0.25)" },
  rowIcon: {
    border: `1px solid ${theme.palette.swatches.grey[600]} !important`,
    borderRadius: "4px !important",
    padding: "3px !important",
    background: `${theme.palette.swatches.grey[1000]} !important`,
  },
  pickBox: { width: "280px", padding: "8px 0px" },
  pickList: { maxHeight: "300px", overflowY: "auto" },
  // Faint rule between panel sections
  section: {
    padding: "16px 0px",
    borderTop: `1px solid ${theme.palette.swatches.grey[800]}`,
    "$drawerTop + &": { borderTop: "none" },
  },
  sectionHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: "32px",
    marginBottom: "6px",
    "& $sectionTitle": { marginBottom: "0px !important" },
  },
  sectionButton: { height: "30px", whiteSpace: "nowrap", background: `${theme.palette.swatches.grey[1000]} !important` },
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
// Least to most access; matches the badge colour ramp
const ROLE_RANK = ["viewer", "layer_editor", "mission_admin", "data_admin", "superadmin"];
const SCOPE_LABEL = { global: "Site-wide", mission: "Mission", layer: "Layer & children" };
const AUDIENCE_LABEL = { everyone: "Everyone (including guests)", authenticated: "Logged-in users" };

const SUBJECT_STYLE = {
  user: { icon: PersonIcon, swatch: 13, kind: "User" },
  group: { icon: GroupsIcon, swatch: 11, kind: "Group" },
  everyone: { icon: PublicIcon, swatch: 12, kind: "Audience" },
  authenticated: { icon: HowToRegIcon, swatch: 12, kind: "Audience" },
};

const useSubjectStyles = makeStyles((theme) => ({
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
function GroupedGrantsTable({ sections, expanded, onToggle, roles, layerPaths, onRemove, emptyText }) {
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

const PICK_LIMIT = 50;

// Button that opens a searchable list, e.g. "Add to group" or "Add member"
function PickButton({ label, icon, items, onPick, emptyText }) {
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
function PanelHeader({ title, onClose, icons }) {
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
function SectionHead({ title, children }) {
  const c = useStyles();
  return (
    <div className={c.sectionHead}>
      <Typography className={c.sectionTitle}>{title}</Typography>
      {children}
    </div>
  );
}

function PersonPanel({ user, ctx }) {
  const c = useStyles();
  const { roles, missions, groups, tokens, layerPathsFor, notify, refresh, askRemove, openGrant, dispatch } = ctx;
  const [effective, setEffective] = useState(null);
  const [viewMode, setViewMode] = useState("");
  const [viewMissions, setViewMissions] = useState([]);

  const load = useCallback(() => {
    api("access_effective", { user_id: user.id })
      .then((r) => setEffective(r.body))
      .catch((res) => notify(res.message || "Failed to get access.", "error"));
  }, [user.id, notify]);
  useEffect(load, [load, ctx.version]);
  // Reflect this person's own viewer grants, not the legacy missions_viewing column
  useEffect(() => {
    if (!effective) return;
    const own = (effective.bindings || []).filter((b) => b.subject_type === "user" && b.role === "viewer");
    const list = [...new Set(own.filter((b) => b.scope_type !== "global" && b.mission).map((b) => b.mission))].sort();
    setViewMode(own.some((b) => b.scope_type === "global") ? "all" : list.length ? "selected" : "none");
    setViewMissions(list);
  }, [effective]);

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
  const [email, setEmail] = useState(user.email || "");
  useEffect(() => setEmail(user.email || ""), [user.id, user.email]);
  const memberOf = groups.filter((g) => g.members.some((m) => m.id === user.id));
  const myTokens = tokens.filter((t) => t.created_by_user_id === user.id);

  const trimmedEmail = email.trim();
  // A blank field removes the email
  const canSaveEmail = trimmedEmail !== (user.email || "");
  const saveEmail = () =>
    api("account_update_user", { id: user.id, email: trimmedEmail })
      .then(() => {
        notify("Email updated.", "success");
        refresh();
      })
      .catch((res) => notify(res.message || "Failed to update email.", "error"));

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
      <PanelHeader
        title={`User: ${user.username}`}
        onClose={ctx.close}
        icons={[
          { label: "Reset password", icon: <VpnKeyIcon />, onClick: () => dispatch(setModal({ name: "resetPassword", row: user })) },
          { label: "Open token page", icon: <OpenInNewIcon />, onClick: () => dispatch(setPage({ page: "api_tokens" })) },
          { label: "Delete user", icon: <DeleteOutlineIcon />, danger: true, onClick: () => dispatch(setModal({ name: "deleteUser", row: user })) },
        ]}
      />

      <div className={c.section}>
        <Typography className={c.sectionTitle}>Account</Typography>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <TextField
            size="small"
            type="email"
            label="Email"
            placeholder="No email set"
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1, "& input::placeholder": { fontStyle: "italic", opacity: 0.8 } }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSaveEmail) saveEmail();
            }}
          />
          <Button variant="outlined" size="small" disabled={!canSaveEmail} onClick={saveEmail}>
            Save
          </Button>
        </div>
      </div>

      <div className={c.section}>
        <Typography className={c.sectionTitle}>Can view</Typography>
        <RadioGroup row value={viewMode} onChange={(e) => {
          const v = e.target.value;
          setViewMode(v);
          if (v === "all") saveViewing("all");
          else if (v === "none") saveViewing("selected", []);
        }}>
          <FormControlLabel value="none" control={<Radio size="small" />} label="None" />
          <FormControlLabel value="selected" control={<Radio size="small" />} label="Selected missions" />
          <FormControlLabel value="all" control={<Radio size="small" />} label="All missions" />
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
        <SectionHead title="Access">
          <Button variant="outlined" size="small" className={c.sectionButton} startIcon={<AddIcon />} onClick={() => openGrant({ subject_type: "user", subject_id: user.id }, load)}>Add access</Button>
        </SectionHead>
        <GrantsTable rows={rows} roles={roles} layerPaths={layerPaths} onRemove={(b) => askRemove(b, load)} />
      </div>

      <div className={c.section}>
        <SectionHead title="Groups">
          <PickButton
            label="Add to group"
            icon={<GroupAddIcon />}
            items={groups.filter((g) => g.source === "local" && !memberOf.includes(g)).map((g) => ({ value: g.id, label: g.name }))}
            onPick={(id) => api("access_members_add", { group_id: id, user_id: user.id }).then(() => { refresh(); load(); }).catch((res) => notify(res.message || "Failed.", "error"))}
          />
        </SectionHead>
        {memberOf.length === 0 && <div className={c.muted}>Not in any group.</div>}
        {memberOf.length > 0 && (
          <Table size="small" className={c.table}>
            <TableBody>
              {memberOf.map((g) => (
                <TableRow key={g.id}>
                  <TableCell><SubjectTag type="group" name={g.name} showKind={false} /></TableCell>
                  <TableCell align="right">
                    {g.source === "local" && (
                      <Tooltip title="Remove from group" placement="left" arrow>
                        <IconButton size="small" className={c.rowIcon} onClick={() => api("access_members_remove", { group_id: g.id, user_id: user.id }).then(() => { refresh(); load(); }).catch((res) => notify(res.message || "Failed.", "error"))}>
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
        <Typography className={c.sectionTitle}>Long-term tokens</Typography>
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
                      <IconButton size="small" className={c.rowIcon} onClick={() => ctx.askConfirm({ title: "Revoke token?", text: `Revoke '${t.name || t.token}'? Anything using it stops working.`, action: "Revoke", onConfirm: () => api("longtermtoken_clear", { id: t.id }).then(refresh).catch((res) => notify(res.message || "Failed.", "error")) })}>
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
  const own = bindings.filter((b) => b.subject_type === "group" && String(b.subject_id) === String(group.id));
  const layerPaths = layerPathsFor(own);
  return (
    <>
      <PanelHeader
        title={`Group: ${group.name}`}
        onClose={ctx.close}
        icons={[
          {
            label: "Delete group",
            icon: <DeleteOutlineIcon />,
            danger: true,
            onClick: () => ctx.askConfirm({ title: "Delete group?", text: `Delete '${group.name}'? Its members lose the access it grants.`, action: "Delete", onConfirm: () => api("access_groups_delete", { id: group.id }).then(() => { ctx.close(); refresh(); }).catch((res) => notify(res.message || "Failed.", "error")) }),
          },
        ]}
      />
      {group.source !== "local" && (
        <div className={`${c.section} ${c.hint}`}>
          Members come from {group.source.toUpperCase()}: anyone whose group claims include <b>{group.external_name}</b>.
        </div>
      )}
      {group.source === "local" && (
        <div className={c.section}>
          <SectionHead title="Members">
            <PickButton
              label="Add member"
              icon={<PersonAddIcon />}
              items={users.filter((u) => !group.members.some((m) => m.id === u.id)).map((u) => ({ value: u.id, label: u.username }))}
              onPick={(id) => api("access_members_add", { group_id: group.id, user_id: id }).then(refresh).catch((res) => notify(res.message || "Failed.", "error"))}
            />
          </SectionHead>
          {group.members.length === 0 && <div className={c.muted}>No members.</div>}
          {group.members.length > 0 && (
            <Table size="small" className={c.table}>
              <TableBody>
                {group.members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.username}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Remove from group" placement="left" arrow>
                        <IconButton size="small" className={c.rowIcon} onClick={() => api("access_members_remove", { group_id: group.id, user_id: m.id }).then(refresh).catch((res) => notify(res.message || "Failed.", "error"))}>
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
      )}
      <div className={c.section}>
        <SectionHead title="Access">
          <Button variant="outlined" size="small" className={c.sectionButton} startIcon={<AddIcon />} onClick={() => openGrant({ subject_type: "group", subject_id: group.id })}>Add access</Button>
        </SectionHead>
        <GrantsTable rows={own.map((b) => ({ b, removable: true, via: sourceText(b) }))} roles={roles} layerPaths={layerPaths} onRemove={(b) => askRemove(b)} />
      </div>
    </>
  );
}

const VIEW_ROLES = new Set(["superadmin", "mission_admin", "layer_editor", "viewer"]);
const SITE_ROLE_RANK = { superadmin: 0, data_admin: 1, mission_admin: 2, user: 3 };
const MAX_LISTED = 5;

const pushTo = (map, k, v) => {
  if (!map.has(k)) map.set(k, []);
  map.get(k).push(v);
};

// One pass over bindings/groups so People stays fast with thousands of accounts
function indexBindings(bindings, groups) {
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

function summarizeUser(u, idx) {
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
    own.filter((b) => b.role === role && b.scope_type !== "global").forEach((b) => {
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

const PEOPLE_COLUMNS = [
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

const dateText = (d) => (d ? new Date(d).toLocaleDateString() : "—");

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

export default function UsersAccess() {
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
  const [peoplePage, setPeoplePage] = useState(0);
  const [peoplePerPage, setPeoplePerPage] = useState(25);
  const [panel, setPanel] = useState(null);
  const [grant, setGrant] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [version, setVersion] = useState(0);
  const [missionPick, setMissionPick] = useState("");
  const [grantSearch, setGrantSearch] = useState("");
  const [grantPage, setGrantPage] = useState(0);
  const [grantsPerPage, setGrantsPerPage] = useState(50);
  const [openGrantSections, setOpenGrantSections] = useState({});
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

  const bindingIndex = useMemo(() => indexBindings(bindings, groups), [bindings, groups]);
  const summaries = useMemo(() => users.map((u) => ({ u, s: summarizeUser(u, bindingIndex) })), [users, bindingIndex]);
  const peopleRows = useMemo(() => {
    const q = search.toLowerCase();
    const key = (PEOPLE_COLUMNS.find((col) => col[0] === peopleSort.by) || PEOPLE_COLUMNS[0])[2];
    return summaries
      .filter(({ u }) => !q || u.username.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q))
      .sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        const cmp = ka < kb ? -1 : ka > kb ? 1 : a.u.username.localeCompare(b.u.username);
        return peopleSort.dir === "asc" ? cmp : -cmp;
      });
  }, [summaries, search, peopleSort]);
  useEffect(() => setPeoplePage(0), [search, peopleSort, peoplePerPage]);
  const pageIndex = Math.min(peoplePage, Math.max(0, Math.ceil(peopleRows.length / peoplePerPage) - 1));
  const pageRows = peopleRows.slice(pageIndex * peoplePerPage, (pageIndex + 1) * peoplePerPage);
  const pickedMission = missions.find((m) => m.name === missionPick);
  const missionRows = pickedMission
    ? bindings
        .filter((b) => b.scope_type === "global" ? b.role !== "data_admin" : b.mission_uuid === pickedMission.uuid)
        .map((b) => ({ b, removable: true, via: b.scope_type === "global" ? "Site-wide grant" : sourceText(b) }))
    : [];

  // Sorted once per change and only while the All grants tab is open
  const allGrantRows = useMemo(() => {
    if (tab !== 4) return [];
    const userNames = new Map(users.map((u) => [String(u.id), u.username]));
    const groupNames = new Map(groups.map((g) => [String(g.id), g.name]));
    const subjectText = (b) => {
      const id = String(b.subject_id);
      if (b.subject_type === "user") return userNames.get(id) || `user ${id}`;
      if (b.subject_type === "group") return groupNames.get(id) || id;
      return AUDIENCE_LABEL[b.subject_id] || id;
    };
    const q = grantSearch.trim().toLowerCase();
    return bindings
      .map((b) => ({ b, removable: true, via: sourceText(b), who: subjectText(b) }))
      .filter(({ b, who }) =>
        !q ||
        [who, (roles[b.role] && roles[b.role].label) || b.role, whereText(b, allLayerPaths)].some((t) => String(t).toLowerCase().includes(q))
      )
      .sort((x, y) => x.who.localeCompare(y.who));
  }, [tab, bindings, users, groups, roles, allLayerPaths, grantSearch]);
  const grantSections = useMemo(() => {
    const byKey = new Map();
    for (const r of allGrantRows) {
      const key = `${r.b.subject_type}:${r.b.subject_id}`;
      if (!byKey.has(key))
        byKey.set(key, { key, type: r.b.subject_type, tagType: r.b.subject_type === "audience" ? r.b.subject_id : r.b.subject_type, who: r.who, rows: [] });
      byKey.get(key).rows.push(r);
    }
    const order = { audience: 0, group: 1, user: 2 };
    return [...byKey.values()].sort((x, y) => (order[x.type] ?? 9) - (order[y.type] ?? 9) || x.who.localeCompare(y.who));
  }, [allGrantRows]);
  // While filtering every matching section is open, so matches aren't hidden
  const grantExpanded = (key) => !!grantSearch.trim() || !!openGrantSections[key];
  const allGrantSectionsOpen = grantSections.length > 0 && grantSections.every((sec) => grantExpanded(sec.key));
  const grantPageIndex = Math.min(grantPage, Math.max(0, Math.ceil(grantSections.length / grantsPerPage) - 1));

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
          <Typography style={{ fontWeight: "bold", fontSize: "16px", lineHeight: "29px" }} variant="h6" component="div">
            Users &amp; Access
          </Typography>
        </div>
      </Toolbar>
      <Tabs className={c.tabs} value={tab} onChange={(e, v) => setTab(v)}>
        <Tab label="People" />
        <Tab label="Groups" />
        <Tab label="Missions" />
        <Tab label="Site-wide" />
        <Tab label="All grants" />
      </Tabs>
      <div className={c.content}>
        {tab === 0 && (
          <div className={c.pane}>
            <div className={`${c.bar} ${c.toolbarBox}`}>
              <TextField
                size="small"
                className={`${c.field} ${c.search}`}
                placeholder="Search by username or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <span className={c.barHint}>Every account, its site role and what it can view and edit. Click a row for details.</span>
              <span className={c.grow} />
              <Button variant="contained" disableElevation className={c.barButton} startIcon={<AddIcon />} onClick={() => dispatch(setModal({ name: "newUser" }))}>New user</Button>
            </div>
            <Table size="small" className={c.table} stickyHeader>
              <TableHead>
                <TableRow>
                  {PEOPLE_COLUMNS.map(([k, label]) => (
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
                {pageRows.map(({ u, s }) => {
                  return (
                    <TableRow key={u.id} className={c.clickRow} onClick={() => setPanel({ type: "user", id: u.id })}>
                      <TableCell className={c.roleText}>{u.username}</TableCell>
                      <TableCell className={u.email ? "" : c.muted}>{u.email || "No email"}</TableCell>
                      <TableCell><SiteRoleBadges siteRoles={s.siteRoles} roles={roles} /></TableCell>
                      <TableCell>{s.viewAll ? <b>All</b> : s.viewList.length ? <MissionList items={s.viewList} /> : <span className={c.muted}>None</span>}</TableCell>
                      <TableCell>{s.missionAdmin.length ? <MissionList items={s.missionAdmin} /> : <span className={c.muted}>—</span>}</TableCell>
                      <TableCell>{s.layerEditor.length ? <MissionList items={s.layerEditor} /> : <span className={c.muted}>—</span>}</TableCell>
                      <TableCell>{s.groupNames.length ? s.groupNames.map((n, i) => <React.Fragment key={n}>{i > 0 && ", "}<SubjectTag type="group" name={n} showKind={false} /></React.Fragment>) : <span className={c.muted}>—</span>}</TableCell>
                      <TableCell className={c.muted}>{dateText(u.createdAt)}</TableCell>
                      <TableCell className={c.muted}>{dateText(u.updatedAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              className={c.bottomBar}
              rowsPerPageOptions={[25, 50, 100]}
              component="div"
              count={peopleRows.length}
              rowsPerPage={peoplePerPage}
              page={pageIndex}
              onPageChange={(e, p) => setPeoplePage(p)}
              onRowsPerPageChange={(e) => setPeoplePerPage(parseInt(e.target.value, 10))}
            />
          </div>
        )}

        {tab === 1 && (
          <div className={c.pane}>
            <div className={`${c.bar} ${c.toolbarBox}`}>
              <TextField size="small" className={c.field} placeholder="New group name" value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} />
              {providers.length > 0 && (
                <Select size="small" className={c.field} value={newGroup.source} onChange={(e) => setNewGroup({ ...newGroup, source: e.target.value })}>
                  <MenuItem value="local">Members managed here</MenuItem>
                  {providers.map((p) => <MenuItem key={p} value={p}>Members from {p.toUpperCase()}</MenuItem>)}
                </Select>
              )}
              {newGroup.source !== "local" && (
                <TextField size="small" className={c.field} placeholder={`${newGroup.source.toUpperCase()} group name`} value={newGroup.external_name} onChange={(e) => setNewGroup({ ...newGroup, external_name: e.target.value })} />
              )}
              <Button variant="contained" disableElevation className={c.barButton} startIcon={<AddIcon />} disabled={!newGroup.name.trim()} onClick={() =>
                api("access_groups_create", { name: newGroup.name, source: newGroup.source, external_name: newGroup.external_name || undefined })
                  .then(() => { setNewGroup({ name: "", source: "local", external_name: "" }); refresh(); })
                  .catch((res) => notify(res.message || "Failed to create group.", "error"))
              }>Create group</Button>
              <span className={c.barHint}>Give roles to several people at once. Click a group to manage its members and access.</span>
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
                      <TableCell><SubjectTag type="group" name={g.name} showKind={false} /></TableCell>
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
            <div className={`${c.bar} ${c.toolbarBox}`}>
              <Select size="small" displayEmpty className={`${c.input} ${c.field}`} value={missionPick} onChange={(e) => setMissionPick(e.target.value)}>
                <MenuItem value=""><em>Choose a mission…</em></MenuItem>
                {missions.map((m) => <MenuItem key={m.uuid} value={m.name}>{m.name}</MenuItem>)}
              </Select>
              <span className={c.barHint}>Everyone with access to the chosen mission, including site-wide grants that cover every mission.</span>
              <span className={c.grow} />
              {pickedMission && (
                <Button variant="contained" disableElevation className={c.barButton} startIcon={<AddIcon />} onClick={() => openGrant({ mission: pickedMission.name })}>Add access</Button>
              )}
            </div>
            {pickedMission ? (
              <>
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
                <AudienceCard key={`${a}-${st.mode}-${st.list.slice().sort().join(",")}`} title={<SubjectTag type={a} name={AUDIENCE_LABEL[a]} showKind={false} />} state={st} missions={missions}
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
        {tab === 4 && (
          <div className={c.pane}>
            <div className={`${c.bar} ${c.toolbarBox}`}>
              <TextField
                size="small"
                className={`${c.field} ${c.search}`}
                placeholder="Filter by who, role or where"
                value={grantSearch}
                onChange={(e) => { setGrantSearch(e.target.value); setGrantPage(0); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <span className={c.barHint}>Everyone who has access, one row each. Click a row to see its grants.</span>
              <span className={c.grow} />
              {!grantSearch.trim() && grantSections.length > 0 && (
                <Button className={c.barButton} startIcon={allGrantSectionsOpen ? <UnfoldLessIcon /> : <UnfoldMoreIcon />} onClick={() =>
                  setOpenGrantSections(allGrantSectionsOpen ? {} : Object.fromEntries(grantSections.map((sec) => [sec.key, true])))
                }>{allGrantSectionsOpen ? "Collapse all" : "Expand all"}</Button>
              )}
              <Button variant="contained" disableElevation className={c.barButton} startIcon={<AddIcon />} onClick={() => openGrant({})}>Add access</Button>
            </div>
            <GroupedGrantsTable
              sections={grantSections.slice(grantPageIndex * grantsPerPage, (grantPageIndex + 1) * grantsPerPage)}
              expanded={grantExpanded}
              onToggle={(key) => setOpenGrantSections((o) => ({ ...o, [key]: !grantExpanded(key) }))}
              roles={roles}
              layerPaths={allLayerPaths}
              onRemove={(b) => askRemove(b)}
              emptyText={grantSearch ? "No grants match." : "No access granted yet."}
            />
            {grantSections.length > 0 && (
              <TablePagination
                className={c.bottomBar}
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={grantSections.length}
                rowsPerPage={grantsPerPage}
                page={grantPageIndex}
                onPageChange={(e, p) => setGrantPage(p)}
                onRowsPerPageChange={(e) => { setGrantsPerPage(parseInt(e.target.value, 10)); setGrantPage(0); }}
              />
            )}
          </div>
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
