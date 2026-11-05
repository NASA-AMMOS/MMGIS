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
import Alert from "@mui/material/Alert";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { useStyles } from "./styles";
import { api, GrantsTable, RoleBadge, sourceText, PickButton, PanelHeader, SectionHead, providerOn, providerName, providerGroups } from "./shared";

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
      <DialogTitle>Check a person's access</DialogTitle>
      <DialogContent>
        <div className={c.hint} style={{ marginBottom: 12 }}>
          Enter a username and the groups their login provider reports, one per line, to see the access they would get, even before their first sign-in.{" "}
          {providerGroups(provider).group_lookup
            ? "Leave the groups empty to ask the provider which groups it reports for that person now, e.g. to find a group's new name after it was renamed or moved."
            : `${providerName(provider)} can't look people up, so enter their groups.`}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {providers.length > 1 && (
            <Select size="small" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {providers.map((p) => <MenuItem key={p} value={p}>{providerName(p)}</MenuItem>)}
            </Select>
          )}
          <TextField size="small" sx={{ flex: 1 }} autoFocus inputProps={{ maxLength: 255 }} placeholder={providers.length > 1 ? "Username" : `${providerName(provider)} username`} value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && username.trim() && provider) void check(); }} />
        </div>
        <TextField size="small" fullWidth multiline minRows={2} placeholder={providerGroups(provider).group_example ? `Groups, one per line, e.g.\n${providerGroups(provider).group_example}` : "Groups, one per line"} value={groupClaims} onChange={(e) => setGroupClaims(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && username.trim()) void check(); }} />
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
        {result && (
          <div style={{ marginTop: 16, fontSize: 14, lineHeight: "22px" }}>
            {result.reported !== undefined && (
              <div style={{ marginBottom: 8 }}>
                <b>Groups {providerName(provider)} reports now:</b>
                {result.reported.length ? result.reported.map((g) => <div key={g} style={{ fontFamily: "monospace", fontSize: 13, wordBreak: "break-all" }}>{g}</div>) : " none"}
              </div>
            )}
            {result.note && <div className={c.hint}>{result.note}</div>}
            {result.reported === undefined && !groupClaims.trim() && (
              <div className={c.hint}>{providerName(provider)} can't look people up here, so this checked no groups. Enter their groups to check those.</div>
            )}
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
  // What the server says about the last save (e.g. another group follows the same provider group), kept until the next one
  const [saveNote, setSaveNote] = useState(null);
  useEffect(() => {
    setName(group.name);
    setExternalName(group.external_name || "");
  }, [group.name, group.external_name]);
  const changed = name.trim() !== group.name || (group.source !== "local" && externalName.trim() !== (group.external_name || ""));
  const movedTo = group.source !== "local" && externalName.trim() && externalName.trim() !== (group.external_name || "") ? externalName.trim() : null;
  const ready = changed && name.trim() && (group.source === "local" || externalName.trim());
  const saveGroup = () =>
    api("access_groups_update", { id: group.id, name: name.trim(), ...(group.source !== "local" ? { external_name: externalName.trim() } : {}) })
      .then((res) => { notify("Group updated.", "success"); setSaveNote(res.note || null); refresh(); })
      .catch((res) => notify(res.message || "Failed to update group.", "error"));
  const on = providerOn(group.source);
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
      {!on && (
        <div className={c.section}>
          <Alert severity="warning">{providerName(group.source)} isn't in AUTH_PROVIDERS on this site, so this group gives its members nothing right now; the members listed are from before it was removed.</Alert>
        </div>
      )}
      <div className={c.section}>
        <Typography className={c.sectionTitle}>Group</Typography>
        <div className={c.dialogStack}>
          <div>
            <div className={c.fieldLabel}>Name in MMGIS</div>
            <TextField size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && ready) void saveGroup(); }} />
          </div>
          {group.source !== "local" && (
            <div>
              <div className={c.fieldLabel}>{`${providerName(group.source)} ${providerGroups(group.source).group_label || "group"}`}</div>
              <TextField size="small" fullWidth inputProps={{ style: { fontFamily: "monospace", fontSize: 13 } }} placeholder={providerGroups(group.source).group_example || ""} value={externalName} onChange={(e) => setExternalName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && ready) void saveGroup(); }} />
              <div className={c.help}>{providerGroups(group.source).group_hint || `The group's name exactly as ${providerName(group.source)} reports it at sign-in.`}</div>
              {movedTo && (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  Saving changes who's in this group: its members become whoever {providerName(group.source)} lists in <b>{movedTo}</b>, as they sign in or are rechecked.
                </Alert>
              )}
            </div>
          )}
          <div>
            <Button variant="outlined" size="small" disabled={!ready} onClick={saveGroup}>
              Save
            </Button>
          </div>
        </div>
        {saveNote && <Alert severity="info" sx={{ mt: 1.5 }} onClose={() => setSaveNote(null)}>{saveNote}</Alert>}
      </div>
      {group.source !== "local" && (
        <div className={`${c.section} ${c.hint}`}>
          Members come from {providerName(group.source)}: anyone whose group claims include <b>{group.external_name}</b>.
          {group.source === "proxy" && " If PROXY_GROUPS is set, members must also be in one of those groups to open the map or Configure."}
        </div>
      )}
      {group.source !== "local" && (
        <div className={c.section}>
          <Typography className={c.sectionTitle}>Members ({group.members.length})</Typography>
          <div className={c.muted}>
            {group.members.length === 0
              ? "None right now: people show up here as they sign in or are rechecked (with AUTH_RECHECK_MINUTES=0, click Check linked accounts in People). If it had members before, the group may have been renamed or moved at the provider; Check a person's access, with a former member's username and no groups, lists the groups reported for them now."
              : group.members.map((m) => m.username).sort((a, b) => a.localeCompare(b)).join(", ")}
          </div>
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

