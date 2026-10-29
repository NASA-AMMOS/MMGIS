import React, { useState } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import AddIcon from "@mui/icons-material/Add";
import { useStyles } from "./styles";
import { SubjectTag, api } from "./shared";
import { ProviderCheckDialog } from "./GroupPanel";
import { useRemembered } from "./hooks";

// Groups, and checking what a provider user would get
export default function GroupsTab({ ctx }) {
  const { roles, groups, bindings, notify, refresh, allLayerPaths, setPanel, remember } = ctx;
  const c = useStyles();
  const [newGroup, setNewGroup] = useRemembered(remember, "newGroup", { name: "", source: "local", external_name: "" });
  const [providerCheck, setProviderCheck] = useState(false);
  const [providers] = useState(
    String(window.mmgisglobal.AUTH_PROVIDERS || "").split(",").filter((p) => p && p !== "local")
  );
  return (
    <>
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
              {providers.length > 0 && (
                <Button variant="outlined" size="small" className={c.barButton} onClick={() => setProviderCheck(true)}>Check a provider user</Button>
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
                    <TableRow key={g.id} className={c.clickRow} onClick={() => setPanel({ type: "group", id: g.id })}>
                      <TableCell><SubjectTag type="group" name={g.name} showKind={false} /></TableCell>
                      <TableCell>{g.source === "local" ? g.members.length : `from ${g.source.toUpperCase()} (${g.external_name})`}</TableCell>
                      <TableCell>{own.map((b) => `${(roles[b.role] || {}).label || b.role}: ${b.scope_type === "global" ? "site-wide" : b.scope_type === "layer" ? `${b.mission || "?"} › ${(allLayerPaths[b.mission] || {})[b.layer_uuid] || "folder"}` : b.mission}`).join(" · ") || <span className={c.muted}>—</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
      {providerCheck && <ProviderCheckDialog open providers={providers} roles={roles} onClose={() => setProviderCheck(false)} />}
    </>
  );
}
