import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { makeStyles } from "@mui/styles";
import clsx from "clsx";

import { setMission, setPage } from "../../core/ConfigureStore";

import Button from "@mui/material/Button";

import MapIcon from "@mui/icons-material/Map";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import StorageIcon from "@mui/icons-material/Storage";
import ShapeLineIcon from "@mui/icons-material/ShapeLine";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import HorizontalSplitIcon from "@mui/icons-material/HorizontalSplit";
import KeyIcon from "@mui/icons-material/Key";
import ApiIcon from "@mui/icons-material/Api";
import PhishingIcon from "@mui/icons-material/Phishing";
import SettingsIcon from "@mui/icons-material/Settings";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";

const useStyles = makeStyles((theme) => ({
  // Matches the main MMGIS map's left toolbar (#toolbar / .toolButton)
  railSlot: {
    width: "40px",
    minWidth: "40px",
    height: "100%",
    position: "relative",
    zIndex: 1200,
  },
  rail: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: "40px",
    overflow: "hidden",
    padding: "6px 0px",
    boxSizing: "border-box",
    display: "flex",
    flexFlow: "column",
    background: "#1a1a1a",
    borderRight: "1px solid #3a3e40",
    boxShadow: "4px 8px 12px rgba(0, 0, 0, 0.4)",
    transition: "width 150ms ease-out",
    "&:hover, &:has(:focus-visible)": {
      width: "190px",
    },
    "&:hover $railLabel, &:has(:focus-visible) $railLabel": {
      opacity: 1,
    },
  },
  railButton: {
    width: "calc(100% - 6px)",
    height: "34px",
    minHeight: "34px",
    margin: "1px 3px",
    padding: 0,
    display: "flex",
    alignItems: "center",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "#e1e1e1",
    cursor: "pointer",
    transition: "all 0.15s",
    "&:hover": { background: "#2c2f30", color: "#08aeea" },
    "& svg": { fontSize: "18px" },
  },
  railIcon: {
    width: "34px",
    minWidth: "34px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  railLabel: {
    paddingLeft: "6px",
    fontSize: "14px",
    whiteSpace: "nowrap",
    opacity: 0,
    transition: "opacity 150ms",
  },
  railCollapsed: {
    width: "40px !important",
    "& $railLabel": {
      opacity: "0 !important",
    },
  },
  railActive: {
    color: "#08aeea !important",
    background: "#3a3e40 !important",
  },
  heading: {
    color: theme.palette.swatches.grey[700],
    fontSize: "12px",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "1px",
    padding: "16px 16px 8px 16px",
    borderBottom: `1px solid ${theme.palette.swatches.grey[300]}`,
  },
  pageButton: {
    width: "100%",
    justifyContent: "flex-start !important",
    gap: "12px",
    padding: "8px 16px !important",
    color: `${theme.palette.swatches.grey[900]} !important`,
    textTransform: "none !important",
    fontSize: "15px !important",
    borderRadius: "0px !important",
    borderBottom: `1px solid ${theme.palette.swatches.grey[300]} !important`,
  },
  pageNotActive: {
    "&:hover": { background: `${theme.palette.swatches.grey[200]} !important` },
  },
  pageActive: {
    background: `${theme.palette.swatches.grey[1000]} !important`,
    color: `${theme.palette.swatches.grey[100]} !important`,
    fontWeight: "bold !important",
  },
}));

export const MISSIONS_SECTION = "Missions";

export const SITE_GROUPS = [
  {
    name: "Data",
    Icon: StorageIcon,
    pages: [
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
      { page: "data_formats", label: "Help", Icon: HelpOutlineIcon },
    ],
  },
  {
    name: "Integrations",
    Icon: ApiIcon,
    pages: [
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
    name: "Settings",
    Icon: SettingsIcon,
    pages: [
      {
        page: "general_options",
        label: "General Options",
        Icon: SettingsIcon,
        cap: "options.manage",
      },
    ],
  },
  {
    name: "Access",
    Icon: AdminPanelSettingsIcon,
    pages: [
      {
        page: "users",
        label: "Users & Access",
        Icon: ManageAccountsIcon,
        caps: ["accounts.manage", "groups.manage"],
      },
      {
        page: "api_tokens",
        label: "API Tokens",
        Icon: KeyIcon,
        cap: "tokens.create",
      },
      { page: "access_help", label: "Access Help", Icon: HelpOutlineIcon },
    ],
  },
];

const visibleWith = (can) => (p) =>
  (!p.cap || can(p.cap)) &&
  (!p.caps || p.caps.every(can)) &&
  (!p.when || p.when());

export const sectionForPage = (page) =>
  (SITE_GROUPS.find((g) => g.pages.some((p) => p.page === page)) || {}).name;

export function NavRail({ section, onSelect, can }) {
  const c = useStyles();
  const visible = visibleWith(can);
  const dispatch = useDispatch();
  const [collapsed, setCollapsed] = React.useState(false);
  const sections = [
    { name: MISSIONS_SECTION, Icon: MapIcon },
    ...SITE_GROUPS.filter((g) => g.pages.some(visible)),
  ];
  return (
    <div className={c.railSlot}>
      <nav
        className={clsx(c.rail, { [c.railCollapsed]: collapsed })}
        aria-label="Configure sections"
        onMouseLeave={() => setCollapsed(false)}
      >
        {sections.map((s) => (
          <button
            key={s.name}
            type="button"
            aria-label={s.name}
            aria-current={section === s.name ? "true" : undefined}
            className={clsx(c.railButton, {
              [c.railActive]: section === s.name,
            })}
            onClick={(e) => {
              if (e.detail > 0) setCollapsed(true);
              onSelect(s.name);
              // Missions shows the mission prompt; other sections open their first page
              dispatch(setMission(null));
              const first = s.pages && s.pages.find(visible);
              if (first) dispatch(setPage({ page: first.page }));
            }}
          >
            <span className={c.railIcon}>
              <s.Icon />
            </span>
            <span className={c.railLabel}>{s.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export function SitePageList({ section, can }) {
  const c = useStyles();
  const dispatch = useDispatch();
  const page = useSelector((state) => state.core.page);
  const group = SITE_GROUPS.find((g) => g.name === section);
  if (!group) return null;
  return (
    <div>
      <div className={c.heading}>{group.name}</div>
      {group.pages.filter(visibleWith(can)).map((p) => (
        <Button
          key={p.page}
          className={clsx(c.pageButton, {
            [c.pageActive]: page === p.page,
            [c.pageNotActive]: page !== p.page,
          })}
          disableElevation
          onClick={() => {
            dispatch(setMission(null));
            dispatch(setPage({ page: p.page }));
          }}
        >
          <p.Icon fontSize="small" />
          {p.label}
        </Button>
      ))}
    </div>
  );
}
