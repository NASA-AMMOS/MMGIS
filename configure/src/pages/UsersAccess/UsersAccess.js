import React, { useRef, useMemo, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { setSnackBarText } from "../../core/ConfigureStore";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Drawer from "@mui/material/Drawer";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import ResetPasswordModal from "./Modals/ResetPasswordModal/ResetPasswordModal";
import DeleteUserModal from "./Modals/DeleteUserModal/DeleteUserModal";
import NewUserModal from "./Modals/NewUserModal/NewUserModal";
import { useStyles } from "./styles";
import { ConfirmDialog, GrantDialog, RoleBadge, SubjectTag, api, useLayerPaths, whereText } from "./shared";
import { PersonPanel } from "./PersonPanel";
import { GroupPanel } from "./GroupPanel";
import ConnectionsTab from "./ConnectionsTab";
import { useAccessData } from "./hooks";
import PeopleTab from "./PeopleTab";
import GroupsTab from "./GroupsTab";
import MissionsTab from "./MissionsTab";
import AllGrantsTab from "./AllGrantsTab";
import SiteWideTab from "./SiteWideTab";

// Users & Access page. Each tab is its own component (PeopleTab.js, GroupsTab.js, MissionsTab.js,
// SiteWideTab.js, AllGrantsTab.js, ConnectionsTab.js); hooks.js loads the data they share.
export default function UsersAccess() {
  const c = useStyles();
  const dispatch = useDispatch();
  const notify = useCallback((text, severity) => dispatch(setSnackBarText({ text, severity })), [dispatch]);
  const [tab, setTab] = useState(3);
  const [panel, setPanel] = useState(null);
  const [grant, setGrant] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const { roles, missions, users, groups, bindings, tokens, defaults, version, refresh } = useAccessData(notify);
  const remember = useRef({}).current;

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
      text:
        `Remove ${(roles[b.role] && roles[b.role].label) || b.role} — ${whereText(b, allLayerPaths)}?` +
        (b.scope_type === "global" ? " This is a site-wide grant, so this access is removed from every mission, not just this one." : ""),
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
    defaults, allLayerPaths, setPanel, remember,
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
        <Tab value={3} label="Site-wide" />
        <Tab value={0} label="People" />
        <Tab value={1} label="Groups" />
        <Tab value={2} label="Missions" />
        <Tab value={4} label="All grants" />
        <Tab value={5} label="Connections" />
      </Tabs>
      <div className={c.content}>
        {tab === 0 && <PeopleTab ctx={ctx} />}

        {tab === 1 && <GroupsTab ctx={ctx} />}

        {tab === 2 && <MissionsTab ctx={ctx} />}

        {tab === 3 && <SiteWideTab ctx={ctx} />}
        {tab === 5 && <ConnectionsTab />}
        {tab === 4 && <AllGrantsTab ctx={ctx} />}
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


export { SubjectTag, RoleBadge };
