import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";
import Popover from "@mui/material/Popover";
import Button from "@mui/material/Button";
import MapIcon from "@mui/icons-material/Map";

import { calls } from "../../core/calls";
import { setSnackBarText } from "../../core/ConfigureStore";
import { useStyles as useAccessStyles } from "../../pages/UsersAccess/styles";
import { ROLE_RANK, ROLE_HELP } from "../../pages/UsersAccess/shared";

const ROLE_LABEL = {
  superadmin: "SuperAdmin",
  data_admin: "Data Admin",
  mission_admin: "Mission Admin",
  layer_editor: "Layer Editor",
  user: "User",
};
const AUDIENCE_TEXT = { authenticated: "Everyone signed in", everyone: "Everyone" };

// Same colour per username as the main site's account button
export function avatarColor(name) {
  let h = 0;
  for (const ch of String(name || "")) h = (ch.charCodeAt(0) + ((h << 5) - h)) | 0;
  return `hsl(${Math.abs(h) % 360}, 55%, 40%)`;
}

const useStyles = makeStyles((theme) => ({
  button: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "40px",
    padding: "0 4px 0 6px",
    border: "none",
    background: "none",
    cursor: "pointer",
    borderRadius: "20px",
    "&:hover $avatar, &:focus-visible $avatar": {
      filter: "brightness(1.15)",
      boxShadow: `0 0 0 2px ${theme.palette.swatches.grey[700]}`,
    },
    "&:focus-visible": { outline: `2px solid ${theme.palette.accent.main}`, outlineOffset: "-2px" },
  },
  pill: {
    "&&": { fontSize: "12px", lineHeight: "18px", padding: "2px 9px", borderRadius: "10px", margin: 0, fontWeight: 600 },
  },
  avatar: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: 600,
    fontSize: "14px",
    position: "relative",
    boxShadow: `0 0 0 2px ${theme.palette.swatches.grey[800]}`,
    transition: "box-shadow 0.15s, filter 0.15s",
  },
  open: { boxShadow: `0 0 0 2px ${theme.palette.accent.main} !important` },
  menu: { width: "340px", fontSize: "13px", color: theme.palette.swatches.grey[150] },
  section: {
    padding: "11px 14px",
    "& + &": { borderTop: `1px solid ${theme.palette.swatches.grey[850]}` },
  },
  label: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    color: theme.palette.swatches.grey[500],
    margin: "2px 0 8px",
  },
  account: { display: "flex", alignItems: "center", gap: "10px" },
  bigAvatar: { width: "34px", height: "34px", fontSize: "15px", boxShadow: "none" },
  badge: {
    position: "absolute",
    right: "-5px",
    bottom: "-5px",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "normal",
    color: theme.palette.swatches.grey[300],
    background: theme.palette.swatches.grey[1000],
    border: `1px solid ${theme.palette.swatches.grey[700]}`,
  },
  text: { flex: 1, minWidth: 0 },
  user: { fontWeight: "bold", fontSize: "15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  detail: { fontSize: "12px", color: theme.palette.swatches.grey[400] },
  roleHelp: { fontSize: "12.5px", color: theme.palette.swatches.grey[300], margin: "8px 0 2px" },
  grant: { padding: "5px 0" },
  grantTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" },
  where: { fontWeight: 600, fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chip: {
    "&&": { fontSize: "11px", lineHeight: "16px", padding: "1px 7px", borderRadius: "9px", margin: 0, fontWeight: 600 },
  },
  more: { fontSize: "12px", color: theme.palette.swatches.grey[500], paddingTop: "4px" },
  foot: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  mapLink: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: 600,
    color: theme.palette.accent.main,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" },
    "& svg": { fontSize: "16px" },
  },
}));

const MAX_GRANTS = 6;
const rank = (role) => ROLE_RANK.indexOf(role);

function sourceText(from) {
  if (from.type === "user") return "Directly on your account";
  if (from.type === "group")
    return (
      <>
        From group <b>{from.name}</b>
        {from.provider ? ` (${from.provider})` : ""}
      </>
    );
  return AUDIENCE_TEXT[from.name] || from.name;
}

// One row per place, role and source; layer grants are counted unless the role covers the whole mission
function grantRows(grants) {
  const rows = new Map();
  (grants || [])
    .filter((g) => g.role !== "viewer")
    .forEach((g) => {
      const where = g.scope === "global" ? "Site-wide" : g.mission || "A removed mission";
      const key = [where, g.role, g.from.type, g.from.name].join("\u0000");
      const row = rows.get(key) || { ...g, where, layers: 0, wholeMission: false };
      if (g.scope === "layer") row.layers++;
      else row.wholeMission = true;
      rows.set(key, row);
    });
  return [...rows.values()].sort((a, b) => rank(b.role) - rank(a.role) || (a.where === "Site-wide" ? -1 : b.where === "Site-wide" ? 1 : a.where.localeCompare(b.where)));
}

export default function AccountMenu() {
  const c = useStyles();
  const a = useAccessStyles();
  const dispatch = useDispatch();
  const [me, setMe] = useState(null);
  const [anchor, setAnchor] = useState(null);

  useEffect(() => {
    calls.api("access_me", { grants: "true" }, (res) => setMe(res.body), () => {});
  }, []);

  const username = (me && me.username) || window.mmgisglobal?.user || "";
  const role = (me && me.role) || window.mmgisglobal?.role || "user";
  const roleLabel = ROLE_LABEL[role] || role;
  const provider = me && me.provider;
  const rows = grantRows(me && me.grants);
  const roleBadge = (r, cls, text) => (
    <span className={`${a.badge} ${a[`badge_${r}`] || a.badge_user} ${cls}`}>{text || ROLE_LABEL[r] || r}</span>
  );

  // The site root: Configure lives at <root>/configure
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments[segments.length - 1] === "configure") segments.pop();
  const siteRoot = `/${segments.map((s) => `${s}/`).join("")}`;
  const signout = () => {
    calls.api(
      "logout",
      {},
      () => (window.location.href = siteRoot),
      () => dispatch(setSnackBarText({ text: "Failed to sign-out.", severity: "error" }))
    );
  };

  const avatar = (big) => (
    <span className={`${c.avatar} ${big ? c.bigAvatar : ""} ${!big && anchor ? c.open : ""}`} style={{ background: avatarColor(username) }}>
      {username.charAt(0).toUpperCase()}
      {big && provider ? (
        <span className={c.badge} aria-hidden="true">
          <i className={`mdi mdi-${provider.icon}`}></i>
        </span>
      ) : null}
    </span>
  );

  return (
    <>
      <button
        id="configureAccountButton"
        className={c.button}
        aria-label={`Account: ${username}, ${roleLabel}`}
        aria-haspopup="true"
        aria-expanded={Boolean(anchor)}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        {roleBadge(role, c.pill)}
        {avatar(false)}
      </button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: "6px" } } }}
      >
        <div className={c.menu} id="configureAccountMenu">
          <div className={c.section}>
            <div className={c.label}>Signed in</div>
            <div className={c.account}>
              {avatar(true)}
              <div className={c.text}>
                <div className={c.user}>{username}</div>
                <div className={c.detail}>{provider ? `Signed in with ${provider.label}` : "MMGIS account"}</div>
              </div>
            </div>
          </div>
          <div className={c.section}>
            <div className={c.label}>Permission level</div>
            {roleBadge(role, "")}
            {ROLE_HELP[role] ? <div className={c.roleHelp}>{ROLE_HELP[role]}</div> : null}
            {rows.length > 0 ? (
              <div style={{ marginTop: "8px" }}>
                {rows.slice(0, MAX_GRANTS).map((g, i) => (
                  <div className={c.grant} key={i}>
                    <div className={c.grantTop}>
                      <span className={c.where}>{g.where}</span>
                      {roleBadge(g.role, c.chip, `${g.label}${g.layers && !g.wholeMission ? ` · ${g.layers} layer${g.layers > 1 ? "s" : ""}` : ""}`)}
                    </div>
                    <div className={c.detail}>{sourceText(g.from)}</div>
                  </div>
                ))}
                {rows.length > MAX_GRANTS ? (
                  <div className={c.more}>And {rows.length - MAX_GRANTS} more</div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className={`${c.section} ${c.foot}`}>
            <a className={c.mapLink} href={siteRoot}>
              <MapIcon /> Open the map
            </a>
            <Button variant="outlined" size="small" onClick={signout} id="configureSignOut">
              Sign out
            </Button>
          </div>
        </div>
      </Popover>
    </>
  );
}
