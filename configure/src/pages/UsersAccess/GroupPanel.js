import React, { useEffect, useState } from "react";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Tooltip from "@mui/material/Tooltip";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { useStyles } from "./styles";
import { api, GrantsTable, RoleBadge, sourceText, PickButton, PanelHeader, SectionHead } from "./shared";

// Provider users have no account row, so check what one would get from a username and group claims
export function ProviderCheckDialog({ open, providers, roles, onClose }) {
  const c = useStyles();
  const [provider, setProvider] = useState(providers[0] || "");
  const [username, setUsername] = useState("");
  const [groupClaims, setGroupClaims] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const check = () =>
    api("access_effective", { provider, username: username.trim(), groups: groupClaims })
      .then((r) => { setResult(r.body); setError(null); })
      .catch((res) => { setResult(null); setError(res.message || "Failed to check access."); });
  const viewing = result && result.missions ? result.missions["mission.view"] : undefined;
  const roleLabel = (r) => (roles[r] && roles[r].label) || r;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Check a provider user</DialogTitle>
      <DialogContent>
        <div className={c.hint} style={{ marginBottom: 12 }}>
          Enter a username and the group names their login provider sends, separated by commas, to see the access they would get.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Select size="small" value={provider} onChange={(e) => setProvider(e.target.value)}>
            {providers.map((p) => <MenuItem key={p} value={p}>{p.toUpperCase()}</MenuItem>)}
          </Select>
          <TextField size="small" sx={{ flex: 1 }} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <TextField size="small" fullWidth placeholder="Groups, e.g. science-team, ops" value={groupClaims} onChange={(e) => setGroupClaims(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && username.trim()) check(); }} />
        {error && <div className={c.hint} style={{ color: "#a8572e", marginTop: 12 }}>{error}</div>}
        {result && (
          <div style={{ marginTop: 16, fontSize: 14, lineHeight: "22px" }}>
            <div><b>Site role:</b> <RoleBadge role={result.role || "user"} roles={roles} /></div>
            <div><b>Can view:</b> {viewing === null ? "All missions" : viewing && viewing.length ? viewing.join(", ") : "No missions"}</div>
            {["mission.config.edit", "mission.layer.edit"].map((cap) => {
              const ms = result.missions && result.missions[cap];
              if (ms !== null && !(ms && ms.length)) return null;
              return <div key={cap}><b>{cap === "mission.config.edit" ? roleLabel("mission_admin") : roleLabel("layer_editor")}:</b> {ms === null ? "All missions" : ms.join(", ")}</div>;
            })}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" disableElevation disabled={!username.trim() || !provider} onClick={check}>Check</Button>
      </DialogActions>
    </Dialog>
  );
}

export function GroupPanel({ group, ctx }) {
  const c = useStyles();
  const { roles, users, bindings, layerPathsFor, notify, refresh, askRemove, openGrant } = ctx;
  const own = bindings.filter((b) => b.subject_type === "group" && String(b.subject_id) === String(group.id));
  const layerPaths = layerPathsFor(own);
  const [name, setName] = useState(group.name);
  const [externalName, setExternalName] = useState(group.external_name || "");
  useEffect(() => {
    setName(group.name);
    setExternalName(group.external_name || "");
  }, [group.name, group.external_name]);
  const changed = name.trim() !== group.name || (group.source !== "local" && externalName.trim() !== (group.external_name || ""));
  const saveGroup = () =>
    api("access_groups_update", { id: group.id, name: name.trim(), ...(group.source !== "local" ? { external_name: externalName.trim() } : {}) })
      .then(() => { notify("Group updated.", "success"); refresh(); })
      .catch((res) => notify(res.message || "Failed to update group.", "error"));
  const providerOn = group.source === "local" || (window.mmgisglobal?.authProviders || []).includes(group.source);
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
            onClick: () => ctx.askConfirm({ title: "Delete group?", text: `Delete '${group.name}'? Its members lose the access it grants.`, action: "Delete", onConfirm: () => api("access_groups_delete", { id: group.id }).then(() => { notify(`Deleted group '${group.name}'.`, "success"); ctx.close(); refresh(); }).catch((res) => notify(res.message || "Failed.", "error")) }),
          },
        ]}
      />
      {!providerOn && (
        <div className={`${c.section} ${c.hint}`} style={{ color: "#a8572e" }}>
          {group.source.toUpperCase()} isn't in AUTH_PROVIDERS on this site, so nobody can be a member of this group right now.
        </div>
      )}
      <div className={c.section}>
        <Typography className={c.sectionTitle}>Group</Typography>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <TextField size="small" label="Name" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && changed && name.trim()) saveGroup(); }} />
          {group.source !== "local" && (
            <TextField size="small" label={`${group.source.toUpperCase()} group name`} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} value={externalName} onChange={(e) => setExternalName(e.target.value)} />
          )}
          <Button variant="outlined" size="small" disabled={!changed || !name.trim() || (group.source !== "local" && !externalName.trim())} onClick={saveGroup}>
            Save
          </Button>
        </div>
      </div>
      {group.source !== "local" && (
        <div className={`${c.section} ${c.hint}`}>
          Members come from {group.source.toUpperCase()}: anyone whose group claims include <b>{group.external_name}</b>.
          {group.source === "csso" && " If CSSO_GROUPS is set, members must also be in one of those groups to open the map or Configure."}
        </div>
      )}
      {group.source === "local" && (
        <div className={c.section}>
          <SectionHead title="Members">
            <PickButton
              label="Add member"
              icon={<PersonAddIcon />}
              items={users.filter((u) => !group.members.some((m) => m.id === u.id)).map((u) => ({ value: u.id, label: u.username }))}
              onPick={(id) => api("access_members_add", { group_id: group.id, user_id: id }).then(() => { notify("Member added.", "success"); refresh(); }).catch((res) => notify(res.message || "Failed.", "error"))}
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
                        <IconButton size="small" className={c.rowIcon} onClick={() => api("access_members_remove", { group_id: group.id, user_id: m.id }).then(() => { notify("Member removed.", "success"); refresh(); }).catch((res) => notify(res.message || "Failed.", "error"))}>
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

