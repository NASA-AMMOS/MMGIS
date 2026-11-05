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
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useStyles } from "./styles";
import { SubjectTag, api, rowActivate, providerName, providerGroups } from "./shared";
import { ProviderCheckDialog } from "./GroupPanel";
import { useRemembered } from "./hooks";

const EMPTY_GROUP = { name: "", source: "local", external_name: "" };

// New group: where its members come from, and for a provider group, which of the provider's groups it follows
function NewGroupDialog({ providers, groups, draft, setDraft, onClose, onCreated, notify, refresh }) {
  const c = useStyles();
  const [lookupUser, setLookupUser] = useState("");
  const [lookup, setLookup] = useState(null);
  // Set once the group is made with something the admin should read before leaving
  const [created, setCreated] = useState(null);
  const fromProvider = draft.source !== "local";
  const info = providerGroups(draft.source);
  const name = providerName(draft.source);
  const setSource = (source) => {
    setDraft({ ...draft, source, external_name: "" });
    setLookup(null);
  };
  // Exact, as sign-in matches; a spelling the provider would rewrite (e.g. a DN's case) is caught by the server's note after creating
  const wanted = draft.external_name.trim();
  const alreadyFollowing = fromProvider && wanted ? groups.filter((g) => g.source === draft.source && String(g.external_name || "") === wanted) : [];
  const findGroups = () =>
    api("access_effective", { provider: draft.source, username: lookupUser.trim(), groups: "" })
      // No report at all (unlike an empty list) means the provider can't look people up with its current settings
      .then((r) => setLookup(r.body && Array.isArray(r.body.reported) ? { groups: r.body.reported } : { unavailable: true }))
      .catch((res) => setLookup({ error: res.message || "Couldn't look that person up." }));
  const create = () =>
    api("access_groups_create", { name: draft.name, source: draft.source, external_name: fromProvider ? draft.external_name : undefined })
      .then((res) => {
        const made = draft.name.trim();
        setDraft(EMPTY_GROUP);
        refresh();
        // The server fills a provider group from the people already signed in, in the background
        if (fromProvider) setTimeout(refresh, 4000);
        const id = res.body && res.body.id;
        if (res.note) setCreated({ name: made, note: res.note, id });
        else {
          notify(`Created group '${made}'.`, "success");
          onCreated(id);
        }
      })
      .catch((res) => notify(res.message || "Failed to create group.", "error"));
  const ready = draft.name.trim() && (!fromProvider || draft.external_name.trim());
  if (created)
    return (
      <Dialog open onClose={() => onCreated(created.id)} maxWidth="sm" fullWidth>
        <DialogTitle>Created group '{created.name}'</DialogTitle>
        <DialogContent>
          <Alert severity="info">{created.note}</Alert>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" disableElevation onClick={() => onCreated(created.id)}>Done</Button>
        </DialogActions>
      </Dialog>
    );
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New group</DialogTitle>
      <DialogContent>
        <div className={c.dialogStack}>
          <div>
            <div className={c.fieldLabel}>Name in MMGIS</div>
            <TextField size="small" fullWidth autoFocus placeholder="Science team" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <div className={c.help}>What you'll see in Configure.</div>
          </div>
          {providers.length > 0 && (
            <div>
              <div className={c.fieldLabel}>Members</div>
              <div className={c.choiceRow}>
                <button type="button" className={`${c.choice} ${!fromProvider ? c.choiceOn : ""}`} aria-pressed={!fromProvider} onClick={() => setSource("local")}>
                  {!fromProvider && <CheckCircleIcon className={c.choiceCheck} />}
                  <b>Added by hand</b>You pick MMGIS accounts.
                </button>
                {providers.map((p) => (
                  <button key={p} type="button" className={`${c.choice} ${draft.source === p ? c.choiceOn : ""}`} aria-pressed={draft.source === p} onClick={() => setSource(p)}>
                    {draft.source === p && <CheckCircleIcon className={c.choiceCheck} />}
                    <b>From a {providerName(p)} group</b>Anyone {providerName(p)} lists in that group, kept up to date at sign-in and rechecks.
                  </button>
                ))}
              </div>
            </div>
          )}
          {fromProvider && (
            <div>
              <div className={c.fieldLabel}>{`${name} ${info.group_label || "group"}`}</div>
              <TextField size="small" fullWidth placeholder={info.group_example || ""} inputProps={{ style: { fontFamily: "monospace", fontSize: 13 } }} value={draft.external_name} onChange={(e) => setDraft({ ...draft, external_name: e.target.value })} />
              <div className={c.help}>
                {info.group_hint || `The group's name exactly as ${name} reports it at sign-in.`}
                {info.group_example && <span className={c.example}>e.g. <code>{info.group_example}</code></span>}
              </div>
              {alreadyFollowing.length > 0 && (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  {alreadyFollowing.map((g) => `'${g.name}'`).join(", ")} already {alreadyFollowing.length === 1 ? "follows" : "follow"} this {name} group, so its members would get the roles of {alreadyFollowing.length === 1 ? "both" : "all of them"}.
                </Alert>
              )}
            </div>
          )}
          {fromProvider && info.group_lookup && (
            <div className={c.lookupBox}>
              <div className={c.hint} style={{ marginBottom: 8 }}>Not sure what to enter? Look up someone in the group and pick it from their groups:</div>
              <div style={{ display: "flex", gap: 8 }}>
                <TextField size="small" sx={{ width: 240 }} placeholder="Username" value={lookupUser} onChange={(e) => setLookupUser(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && lookupUser.trim()) findGroups(); }} />
                <Button variant="outlined" disabled={!lookupUser.trim()} onClick={findGroups}>Look up</Button>
              </div>
              {lookup && lookup.unavailable && <div className={c.help}>{name} can't look people up with its current settings, so enter the group yourself.</div>}
              {lookup && lookup.error && <Alert severity="error" sx={{ mt: 1 }}>{lookup.error}</Alert>}
              {lookup && lookup.groups && (
                lookup.groups.length ? (
                  <div className={c.chips}>
                    {lookup.groups.map((g) => (
                      <button key={g} type="button" className={`${c.chip} ${draft.external_name === g ? c.choiceOn : ""}`} onClick={() => setDraft({ ...draft, external_name: g })}>{g}</button>
                    ))}
                  </div>
                ) : <div className={c.help}>{name} reports no groups for them.</div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
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
  // A new group needs access next, so open it
  const opened = (id) => {
    setCreating(false);
    if (id != null) setPanel({ type: "group", id });
  };
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
                  <TableCell>Source</TableCell>
                  <TableCell>Members</TableCell>
                  <TableCell>Access</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.length === 0 && (
                  <TableRow><TableCell colSpan={4} className={c.muted}>No groups yet. Click New group to make one.</TableCell></TableRow>
                )}
                {groups.map((g) => {
                  const own = bindings.filter((b) => b.subject_type === "group" && String(b.subject_id) === String(g.id));
                  return (
                    <TableRow key={g.id} className={c.clickRow} {...rowActivate(() => setPanel({ type: "group", id: g.id }))}>
                      <TableCell><SubjectTag type="group" name={g.name} showKind={false} /></TableCell>
                      <TableCell>{g.source === "local" ? "Added by hand" : <>{providerName(g.source)} · <code className={c.groupCode}>{g.external_name}</code></>}</TableCell>
                      <TableCell>{g.members.length}</TableCell>
                      <TableCell>{own.map((b) => `${(roles[b.role] || {}).label || b.role}: ${b.scope_type === "global" ? "site-wide" : b.scope_type === "layer" ? `${b.mission || "?"} › ${(allLayerPaths[b.mission] || {})[b.layer_uuid] || "folder"}` : b.mission}`).join(" · ") || <span className={c.muted}>None yet</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
      {creating && <NewGroupDialog providers={providers} groups={groups} draft={newGroup} setDraft={setNewGroup} onClose={() => setCreating(false)} onCreated={opened} notify={notify} refresh={refresh} />}
      {providerCheck && <ProviderCheckDialog open providers={providers} roles={roles} onClose={() => setProviderCheck(false)} />}
    </>
  );
}
