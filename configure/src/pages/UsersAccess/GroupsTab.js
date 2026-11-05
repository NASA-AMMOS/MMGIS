import React, { useState } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import AddIcon from "@mui/icons-material/Add";
import { useStyles } from "./styles";
import { SubjectTag, api, rowActivate, providerName, providerGroups } from "./shared";
import { ProviderCheckDialog } from "./GroupPanel";
import { useRemembered } from "./hooks";

const EMPTY_GROUP = { name: "", source: "local", external_name: "" };

// New group: where its members come from, and for a provider group, which of the provider's groups it follows
function NewGroupDialog({ providers, draft, setDraft, onClose, notify, refresh }) {
  const c = useStyles();
  const [lookupUser, setLookupUser] = useState("");
  const [lookup, setLookup] = useState(null);
  const fromProvider = draft.source !== "local";
  const info = providerGroups(draft.source);
  const name = providerName(draft.source);
  const setSource = (source) => {
    setDraft({ ...draft, source, external_name: "" });
    setLookup(null);
  };
  const findGroups = () =>
    api("access_effective", { provider: draft.source, username: lookupUser.trim(), groups: "" })
      .then((r) => setLookup({ groups: (r.body && r.body.reported) || [] }))
      .catch((res) => setLookup({ error: res.message || "Couldn't look that person up." }));
  const create = () =>
    api("access_groups_create", { name: draft.name, source: draft.source, external_name: fromProvider ? draft.external_name : undefined })
      .then((res) => {
        if (res.note) notify(res.note, "warning");
        else notify(`Created group '${draft.name.trim()}'.`, "success");
        setDraft(EMPTY_GROUP);
        onClose();
        refresh();
        // The server fills a provider group from the people already signed in, in the background
        if (fromProvider) setTimeout(refresh, 4000);
      })
      .catch((res) => notify(res.message || "Failed to create group.", "error"));
  const ready = draft.name.trim() && (!fromProvider || draft.external_name.trim());
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New group</DialogTitle>
      <DialogContent>
        <TextField size="small" fullWidth label="Name in MMGIS" InputLabelProps={{ shrink: true }} sx={{ mt: 1 }} autoFocus value={draft.name} helperText="What you'll see in Configure." onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        {providers.length > 0 && (
          <>
            <div className={c.fieldLabel}>Members</div>
            <div className={c.choiceRow}>
              <button type="button" className={`${c.choice} ${!fromProvider ? c.choiceOn : ""}`} aria-pressed={!fromProvider} onClick={() => setSource("local")}>
                <b>Added by hand</b>You pick MMGIS accounts.
              </button>
              {providers.map((p) => (
                <button key={p} type="button" className={`${c.choice} ${draft.source === p ? c.choiceOn : ""}`} aria-pressed={draft.source === p} onClick={() => setSource(p)}>
                  <b>From a {providerName(p)} group</b>Anyone {providerName(p)} lists in that group, kept up to date at sign-in and rechecks.
                </button>
              ))}
            </div>
          </>
        )}
        {fromProvider && (
          <>
            <TextField size="small" fullWidth label={`${name} ${info.group_label || "group"}`} InputLabelProps={{ shrink: true }} sx={{ mt: 2.5 }} placeholder={info.group_example || ""} value={draft.external_name} helperText={
                <>
                  {info.group_hint || `The group's name exactly as ${name} reports it at sign-in.`}
                  {info.group_example && <span className={c.example}>e.g. <code>{info.group_example}</code></span>}
                </>
              } onChange={(e) => setDraft({ ...draft, external_name: e.target.value })} />
            {info.group_lookup && (
              <div className={c.lookupBox}>
                <div className={c.hint} style={{ marginBottom: 8 }}>Not sure what to enter? Look up someone in the group and pick it from their groups:</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <TextField size="small" className={c.field} placeholder="Username" value={lookupUser} onChange={(e) => setLookupUser(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && lookupUser.trim()) findGroups(); }} />
                  <Button variant="outlined" size="small" className={c.barButton} disabled={!lookupUser.trim()} onClick={findGroups}>Look up</Button>
                </div>
                {lookup && lookup.error && <div className={c.hint} style={{ color: "#a8572e", margin: "8px 0 0" }}>{lookup.error}</div>}
                {lookup && lookup.groups && (
                  lookup.groups.length ? (
                    <div className={c.chips}>
                      {lookup.groups.map((g) => (
                        <button key={g} type="button" className={`${c.chip} ${draft.external_name === g ? c.choiceOn : ""}`} onClick={() => setDraft({ ...draft, external_name: g })}>{g}</button>
                      ))}
                    </div>
                  ) : <div className={c.hint} style={{ margin: "8px 0 0" }}>{name} reports no groups for them.</div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disableElevation startIcon={<AddIcon />} disabled={!ready} onClick={create}>Create group</Button>
      </DialogActions>
    </Dialog>
  );
}

// Groups, and checking what a provider user would get
export default function GroupsTab({ ctx }) {
  const { roles, groups, bindings, notify, refresh, allLayerPaths, setPanel, remember } = ctx;
  const c = useStyles();
  const [newGroup, setNewGroup] = useRemembered(remember, "newGroup", EMPTY_GROUP);
  const [creating, setCreating] = useState(false);
  const [providerCheck, setProviderCheck] = useState(false);
  const [providers] = useState(
    String(window.mmgisglobal.AUTH_PROVIDERS || "").split(",").filter((p) => p && p !== "local")
  );
  return (
    <>
          <div className={c.pane}>
            <div className={c.bar}>
              <Button variant="contained" disableElevation className={c.barButton} startIcon={<AddIcon />} onClick={() => setCreating(true)}>New group</Button>
              {providers.length > 0 && (
                <Button variant="outlined" size="small" className={c.barButton} onClick={() => setProviderCheck(true)}>Check a person's access</Button>
              )}
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
                    <TableRow key={g.id} className={c.clickRow} {...rowActivate(() => setPanel({ type: "group", id: g.id }))}>
                      <TableCell><SubjectTag type="group" name={g.name} showKind={false} /></TableCell>
                      <TableCell>{g.source === "local" ? g.members.length : `${g.members.length} from ${providerName(g.source)} (${g.external_name})`}</TableCell>
                      <TableCell>{own.map((b) => `${(roles[b.role] || {}).label || b.role}: ${b.scope_type === "global" ? "site-wide" : b.scope_type === "layer" ? `${b.mission || "?"} › ${(allLayerPaths[b.mission] || {})[b.layer_uuid] || "folder"}` : b.mission}`).join(" · ") || <span className={c.muted}>—</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
      {creating && <NewGroupDialog providers={providers} draft={newGroup} setDraft={setNewGroup} onClose={() => setCreating(false)} notify={notify} refresh={refresh} />}
      {providerCheck && <ProviderCheckDialog open providers={providers} roles={roles} onClose={() => setProviderCheck(false)} />}
    </>
  );
}
