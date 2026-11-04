import React, { useEffect, useState, useCallback } from "react";
import { setModal, setPage } from "../../core/ConfigureStore";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import { useStyles } from "./styles";
import { AUDIENCE_LABEL, SubjectTag, EFFECTIVE_ROWS, api, GrantsTable, sourceText, MissionMultiSelect, PickButton, PanelHeader, SectionHead, VIEW_ROLES, signInText, providerOn, missingText, providerName, relinkProviders as allowedRelinks } from "./shared";

export function PersonPanel({ user, ctx }) {
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
  const viewAllVia = [...new Set(bindings
    .filter((b) => b.scope_type === "global" && VIEW_ROLES.has(b.role) && !(b.subject_type === "user" && b.role === "viewer"))
    .map((b) => `${(roles[b.role] && roles[b.role].label) || b.role} (${b.subject_type === "user" ? "own grant" : b.subject_type === "group" ? "group" : "audience"})`))];
  const groupName = (id) => (groups.find((g) => String(g.id) === String(id)) || {}).name || `group ${id}`;
  const rows = bindings.map((b) => ({
    b,
    removable: b.subject_type === "user" && b.source !== "proxy",
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

  const relinkProviders = allowedRelinks();
  const linkedProviders = String(window.mmgisglobal.AUTH_PROVIDERS || "").split(",").filter((p) => p && p !== "local");
  const [relinkName, setRelinkName] = useState("");
  useEffect(() => setRelinkName(""), [user.id]);
  const providerLogin = (user.sign_ins || []).find((l) => linkedProviders.includes(l.provider));
  const relinkAs = relinkName.trim() || (providerLogin && providerLogin.username) || user.username;
  const relink = (provider, cancel = false, shownDn) =>
    api(cancel ? "account_cancel_relink" : "account_allow_relink", { id: user.id, provider, username: relinkAs, ...(shownDn ? { dn: shownDn } : {}) })
      .then((res) => {
        const dn = res && res.body && res.body.dn;
        notify(cancel ? "Relink cancelled." : `Relink allowed${dn ? ` for ${dn}` : ""}.`, "success");
        refresh();
      })
      .catch((res) => notify(res.message || "Failed.", "error"));
  // Looked up first, so the confirmation names the entry that would take the account over
  const askRelink = (p) =>
    api("account_allow_relink", { id: user.id, provider: p, username: relinkAs, preview: true })
      .then((res) => confirmRelink(p, res && res.body && res.body.dn))
      .catch((res) => notify(res.message || "Failed.", "error"));
  const confirmRelink = (p, dn) =>
    ctx.askConfirm({
      title: `Allow ${providerName(p)} relink?`,
      text: `${dn ? `'${relinkAs}' is ${dn} in ${providerName(p)}. ` : ""}For the next 24 hours, the next ${providerName(p)} login as '${relinkAs}'${dn ? " from that entry" : ""} takes over this account, keeping its roles, grants, API tokens and drawings, and signing out everyone signed in to it now. Its MMGIS password stops working. Use it when the directory gave this person a new ID, or to move a local account to ${providerName(p)}. If someone else used this account, revoke its API tokens too.${
        providerLogin && providerLogin.missing_reason === "subject"
          ? ` It was linked under a different subject setting (e.g. LDAP_SUBJECT_ATTRIBUTE), so it needs this relink to sign in again.${
              providerLogin.missing_was_gone
                ? ` Before that, its ${providerName(providerLogin.provider)} entry was deleted or disabled at ${missingText(providerLogin.missing_since)}: if '${relinkAs}' is now someone else, don't allow this.`
                : ""
            }`
          : providerLogin && providerLogin.missing_since
          ? ` Its ${providerName(providerLogin.provider)} entry was deleted or disabled at ${missingText(providerLogin.missing_since)}: if '${relinkAs}' is now someone else, don't allow this.`
          : ""
      }`,
      action: "Allow",
      onConfirm: () => relink(p, false, dn),
    });

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
    api("account_update_user", { id: user.id, viewing: mode === "all" ? null : list })
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
        {relinkProviders.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <Typography variant="body2">Signs in with {signInText(user)}.</Typography>
            {user.relink ? (
              <>
                <Typography variant="body2">
                  The next {providerName(user.relink.provider)} login as '{user.relink.username || user.username}'{user.relink.dn ? ` (${user.relink.dn})` : ""} can claim this account until {new Date(user.relink.expires_at).toLocaleString()}.
                </Typography>
                {user.relink.stale && (
                  <Typography variant="body2" style={{ color: "#a8572e" }}>
                    {user.relink.stale.setting
                      ? `On ${new Date(user.relink.stale.at).toLocaleString()}, Check linked accounts found that this relink was allowed under an old ${providerName(user.relink.provider)} subject setting, so it won't take effect.`
                      : user.relink.stale.gone
                      ? `On ${new Date(user.relink.stale.at).toLocaleString()}, Check linked accounts found that the ${providerName(user.relink.provider)} entry this relink is pinned to is gone. It still works if that entry comes back, until it expires.`
                      : `On ${new Date(user.relink.stale.at).toLocaleString()}, a sign-in from a different ${providerName(user.relink.provider)} entry was refused. This relink still works for ${user.relink.dn || "the entry it is pinned to"} until it expires.`}{" "}
                    {user.relink.stale.setting
                      ? "If the directory changed since it was allowed, cancel it and allow it again."
                      : "Cancel it if that entry shouldn't get this account; if the person's entry changed since it was allowed, cancel it and allow it again."}
                  </Typography>
                )}
                <Button size="small" onClick={() => relink(user.relink.provider, true)}>Cancel relink</Button>
              </>
            ) : (
              <>
              <TextField
                size="small"
                label="Username at the provider"
                placeholder={(providerLogin && providerLogin.username) || user.username}
                value={relinkName}
                onChange={(e) => setRelinkName(e.target.value)}
              />
              {relinkProviders.map((p) => (
                <Button key={p} variant="outlined" size="small" onClick={() => askRelink(p)}>
                  Allow {providerName(p)} relink
                </Button>
              ))}
              </>
            )}
          </div>
        )}
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
        {viewAllVia.length > 0 ? (
          <div className={c.hint}>Already sees every mission through {viewAllVia.join(", ")}. This setting only changes their own Viewer grants.</div>
        ) : (
          <div className={c.hint}>Groups and audiences below can still give this person access to more missions.</div>
        )}
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
            onPick={(id) => api("access_members_add", { group_id: id, user_id: user.id }).then(() => { notify("Added to group.", "success"); refresh(); load(); }).catch((res) => notify(res.message || "Failed.", "error"))}
          />
        </SectionHead>
        {memberOf.length === 0 && <div className={c.muted}>Not in any group.</div>}
        {memberOf.length > 0 && (
          <Table size="small" className={c.table}>
            <TableBody>
              {memberOf.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <SubjectTag type="group" name={g.name} showKind={false} />
                    {!providerOn(g.source) && <span className={c.muted}> (gives nothing while {g.source} is off)</span>}
                  </TableCell>
                  <TableCell align="right">
                    {g.source === "local" && (
                      <Tooltip title="Remove from group" placement="left" arrow>
                        <IconButton size="small" className={c.rowIcon} onClick={() => api("access_members_remove", { group_id: g.id, user_id: user.id }).then(() => { notify("Removed from group.", "success"); refresh(); load(); }).catch((res) => notify(res.message || "Failed.", "error"))}>
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
        {(user.sign_ins || []).length > 0 && user.sign_ins.every((l) => l.missing_since && providerOn(l.provider)) && (
          <div className={c.hint} style={{ color: "#b71c1c" }}>
            Can't sign in or use API tokens now: {user.sign_ins.map((l) => (l.missing_reason === "subject" ? `linked under an old ${providerName(l.provider)} subject setting` : `not found in ${providerName(l.provider)} since ${missingText(l.missing_since)}`)).join(", ")}. This access applies again only if {user.sign_ins.some((l) => l.missing_reason === "subject") ? "the subject setting is changed back" : "that entry comes back"} or the account is relinked.
          </div>
        )}
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

