// Site-level pages, grouped in one menu at the bottom of the side panel
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../core/calls";
import { setMission, setPage } from "../../core/ConfigureStore";

import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";

import TuneIcon from "@mui/icons-material/Tune";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import StorageIcon from "@mui/icons-material/Storage";
import ShapeLineIcon from "@mui/icons-material/ShapeLine";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import HorizontalSplitIcon from "@mui/icons-material/HorizontalSplit";
import KeyIcon from "@mui/icons-material/Key";
import ApiIcon from "@mui/icons-material/Api";
import PhishingIcon from "@mui/icons-material/Phishing";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountBoxIcon from "@mui/icons-material/AccountBox";
import SecurityIcon from "@mui/icons-material/Security";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";

const useStyles = makeStyles((theme) => ({
  wrapper: {
    padding: "8px",
    borderTop: `2px solid ${theme.palette.swatches.grey[300]}`,
  },
  button: {
    width: "100%",
    height: "40px",
    justifyContent: "space-between !important",
    fontWeight: "bold !important",
    letterSpacing: "1px !important",
    color: `${theme.palette.swatches.grey[0]} !important`,
    background: `${theme.palette.swatches.p[0]} !important`,
    boxShadow: "0px 2px 6px 0px rgba(0, 0, 0, 0.35) !important",
    "&:hover": { background: `${theme.palette.swatches.p[4]} !important` },
  },
  label: {
    flex: 1,
    textAlign: "left",
    paddingLeft: "8px",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  header: {
    fontWeight: "bold !important",
    textTransform: "uppercase",
    letterSpacing: "1px",
    lineHeight: "32px !important",
  },
}));

const GROUPS = [
  {
    name: "Data",
    pages: [
      { page: "data_formats", label: "Data Formats", Icon: StorageIcon },
      {
        page: "geodatasets",
        label: "GeoDatasets",
        Icon: ShapeLineIcon,
        cap: "data.geodatasets.write",
      },
      {
        page: "datasets",
        label: "Datasets",
        Icon: TextSnippetIcon,
        cap: "data.datasets.write",
      },
      {
        page: "stac",
        label: "STAC",
        Icon: HorizontalSplitIcon,
        cap: "data.stac.write",
        when: () => window.mmgisglobal.WITH_STAC === "true",
      },
    ],
  },
  {
    name: "Integrations",
    pages: [
      {
        page: "api_tokens",
        label: "API Tokens",
        Icon: KeyIcon,
        cap: "tokens.create",
      },
      { page: "apis", label: "APIs", Icon: ApiIcon },
      {
        page: "webhooks",
        label: "Webhooks",
        Icon: PhishingIcon,
        cap: "webhooks.manage",
      },
    ],
  },
  {
    name: "Site",
    pages: [
      {
        page: "general_options",
        label: "General Options",
        Icon: SettingsIcon,
        cap: "options.manage",
      },
      {
        page: "users",
        label: "Users",
        Icon: AccountBoxIcon,
        cap: "accounts.manage",
      },
      {
        page: "access",
        label: "Access",
        Icon: SecurityIcon,
        cap: "groups.manage",
      },
      {
        page: "ua_v1",
        label: "UA_v1",
        Icon: ManageAccountsIcon,
        caps: ["accounts.manage", "groups.manage"],
      },
    ],
  },
];

export default function SiteMenu() {
  const c = useStyles();
  const dispatch = useDispatch();
  const page = useSelector((state) => state.core.page);
  const [anchor, setAnchor] = useState(null);
  const [capabilities, setCapabilities] = useState(null);

  useEffect(() => {
    calls.api(
      "user_permissions",
      {},
      (res) => setCapabilities(res?.capabilities || []),
      () => setCapabilities([])
    );
  }, []);

  // Until capabilities load, only SuperAdmins see everything
  const can = (cap) =>
    capabilities
      ? capabilities.includes(cap)
      : window.mmgisglobal?.role === "superadmin";
  const visible = (p) =>
    (!p.cap || can(p.cap)) &&
    (!p.caps || p.caps.every(can)) &&
    (!p.when || p.when());

  const items = [];
  GROUPS.forEach((g) => {
    const pages = g.pages.filter(visible);
    if (!pages.length) return;
    items.push(
      <ListSubheader key={g.name} className={c.header}>
        {g.name}
      </ListSubheader>
    );
    pages.forEach((p) =>
      items.push(
        <MenuItem
          key={p.page}
          onClick={() => {
            setAnchor(null);
            dispatch(setMission(null));
            dispatch(setPage({ page: p.page }));
          }}
        >
          <ListItemIcon>
            <p.Icon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{p.label}</ListItemText>
        </MenuItem>
      )
    );
  });

  const active = GROUPS.flatMap((g) => g.pages).find((p) => p.page === page);

  return (
    <div className={c.wrapper}>
      <Button
        className={c.button}
        variant="contained"
        disableElevation
        startIcon={<TuneIcon />}
        endIcon={<ArrowDropUpIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <span className={c.label}>
          {active ? `Site: ${active.label}` : "Site Pages"}
        </span>
      </Button>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {items}
      </Menu>
    </div>
  );
}
