import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {} from "./PanelSlice";
import { makeStyles } from "@mui/styles";
import mmgisLogo from "../../images/mmgis.png";
import packageJson from "../../../package.json";

import clsx from "clsx";

import {
  setMission,
  setModal,
  setSnackBarText,
} from "../../core/ConfigureStore";
import { calls } from "../../core/calls";

import {
  NavRail,
  SitePageList,
  sectionForPage,
  MISSIONS_SECTION,
} from "../SiteMenu/SiteMenu";
import NewMissionModal from "./Modals/NewMissionModal/NewMissionModal";

import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";

import WarningIcon from "@mui/icons-material/Warning";

const useStyles = makeStyles((theme) => ({
  Panel: {
    width: "100%",
    height: "100%",
    background: theme.palette.secondary.main,
    backgroundImage: "url(configure/build/contours.png)",
    backgroundSize: "200%",
    display: "flex",
  },
  content: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    display: "flex",
    flexFlow: "column",
  },
  title: {
    padding: "30px 0px 10px 0px",
    textAlign: "center",
  },
  titleImage: {
    height: "30px",
  },
  configurationName: {
    color: theme.palette.swatches.grey[700],
    fontSize: "13px",
    marginTop: "-5px",
    textTransform: "uppercase",
    "& > span": {
      color: theme.palette.accent.main,
    },
  },
  version: {
    color: theme.palette.swatches.grey[600],
    fontSize: "10px",
    fontFamily: "monospace",
    marginTop: "2px",
    textAlign: "center",
  },
  versionMismatch: {
    color: "#ff9800",
    fontSize: "10px",
    fontFamily: "monospace",
    marginTop: "2px",
    textAlign: "center",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    "& svg": {
      fontSize: "12px",
    },
  },
  versionMismatchTooltip: {
    background: theme.palette.secondary.main,
    padding: "8px",
    "& > div:first-child": {
      marginBottom: "4px",
      fontSize: "12px",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      color: "#ff9800",
    },
  },
  newMission: {
    width: "100%",
  },
  newMissionButton: {
    width: "100%",
    color: `${theme.palette.swatches.grey[900]} !important`,
    background: `${theme.palette.swatches.grey[300]} !important`,
    "&:hover": {
      background: `${theme.palette.swatches.p[0]} !important`,
      color: `${theme.palette.swatches.grey[0]} !important`,
    },
  },
  missions: {
    flex: 1,
    overflowY: "auto",
  },
  missionsUl: {
    listStyleType: "none",
    padding: 0,
    margin: "10px 0px",
    borderTop: `1px solid ${theme.palette.swatches.grey[300]} !important`,
  },
  missionsLi: {
    borderBottom: `1px solid ${theme.palette.swatches.grey[300]} !important`,
  },
  missionButton: {
    width: "100%",
    background: "rgba(255,255,255,0.06) !important",
    color: `${theme.palette.swatches.grey[900]} !important`,
    textTransform: "capitalize !important",
    justifyContent: "end !important",
    textAlign: "right !important",
    fontSize: "16px !important",
    padding: "3px 16px !important",
    transition:
      "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, width 250ms ease-out 0ms, box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, border-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
  },
  missionActive: {
    background: `${theme.palette.swatches.grey[1000]} !important`,
    color: `${theme.palette.swatches.grey[100]} !important`,
    fontWeight: "bold !important",
  },
  missionNotActive: {
    "&:hover": {
      background: `${theme.palette.swatches.grey[200]} !important`,
    },
  },
  missionDisabled: {
    opacity: "0.3 !important",
    cursor: "not-allowed !important",
    pointerEvents: "all !important",
    "&:hover": {
      background: "unset !important",
    },
  },
}));

export default function Panel() {
  const c = useStyles();
  const dispatch = useDispatch();

  const missions = useSelector((state) => state.core.missions);
  const activeMission = useSelector((state) => state.core.mission);
  const page = useSelector((state) => state.core.page);
  const [section, setSection] = useState(
    () => sectionForPage(page) || MISSIONS_SECTION,
  );
  useEffect(() => {
    const s = sectionForPage(page);
    if (s) setSection(s);
  }, [page]);
  const [userPermissions, setUserPermissions] = useState(null);

  // Fetch user permissions to determine which missions can be edited
  useEffect(() => {
    calls.api(
      "user_permissions",
      {},
      (res) => {
        setUserPermissions(res);
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to get user permissions.",
            severity: "error",
          }),
        );
      },
    );
  }, [dispatch]);

  // Until capabilities load, only SuperAdmins see everything
  const can = (cap) =>
    userPermissions?.capabilities
      ? userPermissions.capabilities.includes(cap)
      : window.mmgisglobal?.role === "superadmin";

  // missions_managing / missions_layer_editing: null means every mission
  const canEditMission = (mission) => {
    if (!userPermissions) return true;
    const lists = [
      userPermissions.missions_managing,
      userPermissions.missions_layer_editing,
    ];
    if (lists.some((l) => l === null)) return true;
    return lists.some((l) => Array.isArray(l) && l.includes(mission));
  };

  // Version mismatch detection
  const buildVersion = packageJson.version;
  const serverVersion = window.mmgisglobal?.VERSION;
  const isVersionMismatch =
    buildVersion && serverVersion && buildVersion !== serverVersion;

  // Log version mismatch for debugging
  useEffect(() => {
    if (isVersionMismatch) {
      console.warn(
        `⚠️ Version Mismatch Detected!\nConfigure UI (build): v${buildVersion}\nServer: v${serverVersion}\n\nPlease refresh the page or contact your administrator.`,
      );
    }
  }, [isVersionMismatch, buildVersion, serverVersion]);

  return (
    <>
      <div className={c.Panel}>
        <NavRail section={section} onSelect={setSection} can={can} />
        <div className={c.content}>
          <div className={c.title}>
            <img className={c.titleImage} src={mmgisLogo} alt="MMGIS"></img>
            <div className={c.configurationName}>
              <span>Config</span>uration
            </div>
            {buildVersion && (
              <>
                {isVersionMismatch ? (
                  <Tooltip
                    title={
                      <div className={c.versionMismatchTooltip}>
                        <div
                          style={{ fontWeight: "bold", marginBottom: "4px" }}
                        >
                          Version Mismatch
                        </div>
                        <div>Configure UI: v{buildVersion}</div>
                        <div>Server: v{serverVersion}</div>
                        <div style={{ marginTop: "4px", fontSize: "11px" }}>
                          Please refresh or contact admin
                        </div>
                      </div>
                    }
                    placement="right"
                    arrow
                  >
                    <div className={c.versionMismatch}>
                      <WarningIcon />
                      <span>v{buildVersion}</span>
                    </div>
                  </Tooltip>
                ) : (
                  <div className={c.version}>v{buildVersion}</div>
                )}
              </>
            )}
          </div>
          {section !== MISSIONS_SECTION ? (
            <SitePageList section={section} can={can} />
          ) : (
            <>
              {can("mission.create") && (
                <div className={c.newMission}>
                  <Button
                    className={c.newMissionButton}
                    variant="contained"
                    disableElevation
                    onClick={() => {
                      dispatch(setModal({ name: "newMission" }));
                    }}
                  >
                    New Mission
                  </Button>
                </div>
              )}
              <div className={c.missions}>
                <ul className={c.missionsUl}>
                  {missions.map((mission, idx) => {
                    const canEdit = canEditMission(mission);
                    return (
                      <li className={c.missionsLi} key={idx}>
                        <Button
                          className={clsx(
                            {
                              [c.missionActive]: mission === activeMission,
                              [c.missionNotActive]: mission !== activeMission,
                              [c.missionDisabled]: !canEdit,
                            },
                            c.missionButton,
                          )}
                          disableElevation
                          onClick={() => {
                            if (canEdit) {
                              dispatch(setMission(mission));
                            } else {
                              dispatch(
                                setSnackBarText({
                                  text: `You don't have permission to edit the "${mission}" mission.`,
                                  severity: "warning",
                                }),
                              );
                            }
                          }}
                          title={
                            canEdit
                              ? mission
                              : `No permission to edit "${mission}"`
                          }
                        >
                          {mission}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
      <NewMissionModal />
    </>
  );
}
