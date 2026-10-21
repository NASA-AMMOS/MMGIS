import React, { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../core/calls";
import { setSnackBarText } from "../../core/ConfigureStore";

import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";

import SecurityIcon from "@mui/icons-material/Security";

const useStyles = makeStyles((theme) => ({
  Access: {
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
    padding: `4px 20px`,
    boxSizing: `border-box !important`,
  },
  topbarTitle: { display: "flex", alignItems: "center", gap: "8px" },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 32px 64px 32px",
    display: "flex",
    flexFlow: "column",
    gap: "24px",
  },
  section: {
    background: theme.palette.swatches.grey[900],
    border: `1px solid ${theme.palette.swatches.grey[700]}`,
    padding: "16px",
  },
  sectionTitle: {
    fontSize: "16px !important",
    fontWeight: "bold !important",
    marginBottom: "8px !important",
  },
  description: { fontSize: "13px", opacity: 0.8, marginBottom: "12px" },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
  },
  group: {
    borderTop: `1px solid ${theme.palette.swatches.grey[700]}`,
    padding: "12px 0px",
  },
  groupName: { fontWeight: "bold", minWidth: "160px" },
  label: { fontSize: "12px", opacity: 0.7, minWidth: "90px" },
  input: { minWidth: "160px !important" },
  caps: { display: "flex", flexWrap: "wrap", gap: "4px" },
}));

const SCOPE_LABEL = { global: "Site-wide", mission: "Mission", layer: "Layer & children" };

function api(call, data) {
  return new Promise((resolve, reject) =>
    calls.api(call, data, resolve, (res) => reject(res || {}))
  );
}

function scopeText(b) {
  if (b.scope_type === "global") return "site-wide";
  if (b.scope_type === "mission") return b.mission || "(deleted mission)";
  return `${b.mission || "?"} › layer ${b.layer_uuid}`;
}

// Adds one role binding for a subject
function BindingForm({ subject_type, subject_id, roles, missions, onAdded, notify }) {
  const c = useStyles();
  const roleNames = Object.keys(roles || {});
  const [role, setRole] = useState("viewer");
  const [scope, setScope] = useState("mission");
  const [mission, setMission] = useState("");
  const [layer, setLayer] = useState("");
  const scopes = (roles && roles[role] && roles[role].scopes) || [];
  useEffect(() => {
    if (!scopes.includes(scope) && scopes.length) setScope(scopes[0]);
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps
  const allowedRoles = subject_type === "audience" ? ["viewer"] : roleNames;
  return (
    <div className={c.row}>
      <Select size="small" className={c.input} value={role} onChange={(e) => setRole(e.target.value)}>
        {allowedRoles.map((r) => (
          <MenuItem key={r} value={r}>
            {r}
          </MenuItem>
        ))}
      </Select>
      <Select size="small" className={c.input} value={scope} onChange={(e) => setScope(e.target.value)}>
        {scopes.map((s) => (
          <MenuItem key={s} value={s}>
            {SCOPE_LABEL[s] || s}
          </MenuItem>
        ))}
      </Select>
      {scope !== "global" && (
        <Select
          size="small"
          className={c.input}
          displayEmpty
          value={mission}
          onChange={(e) => setMission(e.target.value)}
        >
          <MenuItem value="">
            <em>Mission…</em>
          </MenuItem>
          {missions.map((m) => (
            <MenuItem key={m.uuid} value={m.name}>
              {m.name}
            </MenuItem>
          ))}
        </Select>
      )}
      {scope === "layer" && (
        <TextField
          size="small"
          className={c.input}
          placeholder="Layer or folder UUID"
          value={layer}
          onChange={(e) => setLayer(e.target.value)}
        />
      )}
      <Button
        variant="contained"
        size="small"
        disableElevation
        onClick={() =>
          api("access_bindings_add", {
            subject_type,
            subject_id,
            role,
            scope_type: scope,
            mission: scope === "global" ? undefined : mission,
            layer_uuid: scope === "layer" ? layer.trim() : undefined,
          })
            .then(() => {
              notify("Role added.", "success");
              onAdded();
            })
            .catch((res) => notify(res.message || "Failed to add role.", "error"))
        }
      >
        Grant
      </Button>
    </div>
  );
}

function BindingChips({ list, onRemove }) {
  if (!list || list.length === 0) return <span style={{ opacity: 0.6 }}>No roles</span>;
  return list.map((b) => (
    <Tooltip key={b.id} title={`source: ${b.source || "local"}`}>
      <Chip
        size="small"
        label={`${b.role} · ${scopeText(b)}`}
        onDelete={b.source === "local" || b.source === "import" ? () => onRemove(b) : undefined}
      />
    </Tooltip>
  ));
}

export default function Access() {
  const c = useStyles();
  const dispatch = useDispatch();
  const notify = useCallback(
    (text, severity) => dispatch(setSnackBarText({ text, severity })),
    [dispatch]
  );
  const [roles, setRoles] = useState({});
  const [missions, setMissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [allBindings, setAllBindings] = useState([]);
  const [newGroup, setNewGroup] = useState("");
  const [memberPick, setMemberPick] = useState({});
  const [userId, setUserId] = useState("");
  const [effective, setEffective] = useState(null);

  const refresh = useCallback(() => {
    api("access_roles").then((r) => setRoles(r.body.roles)).catch(() => {});
    api("access_missions").then((r) => setMissions(r.body || [])).catch(() => {});
    api("account_entries")
      .then((r) => setUsers((r.body && r.body.entries) || []))
      .catch(() => {});
    api("access_groups")
      .then((r) => setGroups(r.body || []))
      .catch((res) => notify(res.message || "Failed to get groups.", "error"));
    api("access_bindings")
      .then((r) => setAllBindings(r.body || []))
      .catch(() => {});
  }, [notify]);
  useEffect(refresh, [refresh]);

  const loadEffective = useCallback(
    (id) => {
      if (id === "" || id == null) return setEffective(null);
      api("access_effective", { user_id: id })
        .then((r) => setEffective(r.body))
        .catch((res) => notify(res.message || "Failed to get access.", "error"));
    },
    [notify]
  );
  useEffect(() => loadEffective(userId), [userId, loadEffective]);

  const changed = () => {
    refresh();
    loadEffective(userId);
  };
  const removeBinding = (b) =>
    api("access_bindings_remove", { id: b.id })
      .then(() => {
        notify("Role removed.", "success");
        changed();
      })
      .catch((res) => notify(res.message || "Failed to remove role.", "error"));
  const bindingsOf = (type, id) =>
    allBindings.filter((b) => b.subject_type === type && String(b.subject_id) === String(id));

  return (
    <div className={c.Access}>
      <Toolbar className={c.topbar}>
        <div className={c.topbarTitle}>
          <SecurityIcon />
          <Typography variant="h6">Access</Typography>
        </div>
      </Toolbar>
      <div className={c.content}>
        <div className={c.section}>
          <Typography className={c.sectionTitle}>User access</Typography>
          <div className={c.description}>
            Pick a user to see every permission they hold and where it comes from. Access is the
            union of the user's own roles, their groups' roles and the audience roles.
          </div>
          <div className={c.row}>
            <Select
              size="small"
              className={c.input}
              displayEmpty
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <MenuItem value="">
                <em>User…</em>
              </MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.username}
                </MenuItem>
              ))}
            </Select>
          </div>
          {effective && (
            <>
              <div className={c.row}>
                <span className={c.label}>Roles</span>
                <BindingChips
                  list={effective.bindings.filter((b) => b.subject_type === "user")}
                  onRemove={removeBinding}
                />
              </div>
              <div className={c.row}>
                <span className={c.label}>Inherited</span>
                <BindingChips
                  list={effective.bindings.filter((b) => b.subject_type !== "user")}
                  onRemove={removeBinding}
                />
              </div>
              <div className={c.row}>
                <span className={c.label}>Groups</span>
                {effective.groups.length
                  ? effective.groups.map((g) => <Chip key={g.id} size="small" label={g.name} />)
                  : "None"}
              </div>
              <div className={c.row}>
                <span className={c.label}>Can</span>
                <div className={c.caps}>
                  {effective.capabilities.map((cap) => {
                    const where = effective.missions[cap];
                    const label =
                      where === undefined
                        ? cap
                        : `${cap}: ${where == null ? "all missions" : where.join(", ") || "none"}`;
                    return <Chip key={cap} size="small" variant="outlined" label={label} />;
                  })}
                </div>
              </div>
              {Object.keys(effective.layers || {}).length > 0 && (
                <div className={c.row}>
                  <span className={c.label}>Layers</span>
                  {Object.entries(effective.layers).map(([m, ls]) => (
                    <Chip key={m} size="small" variant="outlined" label={`${m}: ${ls.join(", ")}`} />
                  ))}
                </div>
              )}
              <BindingForm
                subject_type="user"
                subject_id={userId}
                roles={roles}
                missions={missions}
                onAdded={changed}
                notify={notify}
              />
            </>
          )}
        </div>

        <div className={c.section}>
          <Typography className={c.sectionTitle}>Groups</Typography>
          <div className={c.description}>
            Grant roles to a group once and add users to it. Groups mapped from an external
            provider (e.g. CSSO) get their members from that provider.
          </div>
          <div className={c.row}>
            <TextField
              size="small"
              className={c.input}
              placeholder="New group name"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
            />
            <Button
              variant="contained"
              size="small"
              disableElevation
              onClick={() =>
                api("access_groups_create", { name: newGroup })
                  .then(() => {
                    setNewGroup("");
                    refresh();
                  })
                  .catch((res) => notify(res.message || "Failed to create group.", "error"))
              }
            >
              Create group
            </Button>
          </div>
          {groups.map((g) => (
            <div className={c.group} key={g.id}>
              <div className={c.row}>
                <span className={c.groupName}>{g.name}</span>
                {g.source !== "local" && <Chip size="small" label={`from ${g.source}`} />}
                <Button
                  size="small"
                  color="error"
                  onClick={() =>
                    api("access_groups_delete", { id: g.id })
                      .then(changed)
                      .catch((res) => notify(res.message || "Failed to delete group.", "error"))
                  }
                >
                  Delete
                </Button>
              </div>
              <div className={c.row}>
                <span className={c.label}>Members</span>
                {g.members.map((m) => (
                  <Chip
                    key={m.id}
                    size="small"
                    label={m.username}
                    onDelete={
                      g.source === "local"
                        ? () =>
                            api("access_members_remove", { group_id: g.id, user_id: m.id })
                              .then(changed)
                              .catch((res) => notify(res.message || "Failed.", "error"))
                        : undefined
                    }
                  />
                ))}
                {g.source === "local" && (
                  <Select
                    size="small"
                    className={c.input}
                    displayEmpty
                    value={memberPick[g.id] || ""}
                    onChange={(e) => {
                      setMemberPick({ ...memberPick, [g.id]: "" });
                      api("access_members_add", { group_id: g.id, user_id: e.target.value })
                        .then(changed)
                        .catch((res) => notify(res.message || "Failed.", "error"));
                    }}
                  >
                    <MenuItem value="">
                      <em>Add member…</em>
                    </MenuItem>
                    {users
                      .filter((u) => !g.members.some((m) => m.id === u.id))
                      .map((u) => (
                        <MenuItem key={u.id} value={u.id}>
                          {u.username}
                        </MenuItem>
                      ))}
                  </Select>
                )}
              </div>
              <div className={c.row}>
                <span className={c.label}>Roles</span>
                <BindingChips list={bindingsOf("group", g.id)} onRemove={removeBinding} />
              </div>
              <BindingForm
                subject_type="group"
                subject_id={g.id}
                roles={roles}
                missions={missions}
                onAdded={changed}
                notify={notify}
              />
            </div>
          ))}
        </div>

        <div className={c.section}>
          <Typography className={c.sectionTitle}>Audiences</Typography>
          <div className={c.description}>
            "everyone" includes guests (when SITE_ACCESS allows them); "authenticated" is every
            logged-in user. Audiences can only be given the viewer role.
          </div>
          {["everyone", "authenticated"].map((a) => (
            <div className={c.group} key={a}>
              <div className={c.row}>
                <span className={c.groupName}>{a}</span>
                <BindingChips list={bindingsOf("audience", a)} onRemove={removeBinding} />
              </div>
              <BindingForm
                subject_type="audience"
                subject_id={a}
                roles={roles}
                missions={missions}
                onAdded={changed}
                notify={notify}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
