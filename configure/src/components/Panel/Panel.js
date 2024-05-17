import React from "react";
import { useSelector, useDispatch } from "react-redux";
import {} from "./PanelSlice";
import { makeStyles } from "@mui/styles";
import mmgisLogo from "../../images/mmgis.png";

import clsx from "clsx";

import { setMission, setModal, setPage } from "../../core/ConfigureStore";

import NewMissionModal from "./Modals/NewMissionModal/NewMissionModal";

import Button from "@mui/material/Button";

import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import ShapeLineIcon from "@mui/icons-material/ShapeLine";
import KeyIcon from "@mui/icons-material/Key";
import PhishingIcon from "@mui/icons-material/Phishing";

const useStyles = makeStyles((theme) => ({
  Panel: {
    width: "220px",
    height: "100%",
    background: theme.palette.secondary.main,
  },
  title: {
    padding: "30px 0px",
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
  },
  newMission: {
    width: "100%",
  },
  newMissionButton: {
    width: "100%",
    background: `${theme.palette.swatches.p[0]} !important`,
    "&:hover": {
      background: `${theme.palette.swatches.p[5]} !important`,
    },
  },
  missions: {},
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
    color: `${theme.palette.swatches.grey[900]} !important`,
    textTransform: "capitalize !important",
    justifyContent: "end !important",
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
  pages: {
    position: "absolute",
    bottom: "0px",
    display: "flex",
    flexFlow: "column",
    width: "100%",
  },
  pageButton: {
    width: "100%",
    borderTop: `1px solid ${theme.palette.swatches.grey[300]} !important`,
    color: `${theme.palette.swatches.grey[700]} !important`,
    textTransform: "capitalize !important",
    justifyContent: "start !important",
    fontSize: "14px !important",
    padding: "3px 16px !important",
    background: `transparent !important`,
    transition:
      "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, width 250ms ease-out 0ms, box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, border-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
    "&:hover": {
      color: `${theme.palette.swatches.grey[900]} !important`,
      background: `${theme.palette.swatches.grey[200]} !important`,
    },
    "& svg": {
      fontSize: "16px !important",
    },
  },
}));

export default function Panel() {
  const c = useStyles();
  const dispatch = useDispatch();

  const missions = useSelector((state) => state.core.missions);
  const activeMission = useSelector((state) => state.core.mission);

  return (
    <>
      <div className={c.Panel}>
        <div className={c.title}>
          <img className={c.titleImage} src={mmgisLogo} alt="MMGIS"></img>
          <div className={c.configurationName}>Configuration</div>
        </div>
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
        <div className={c.missions}>
          <ul className={c.missionsUl}>
            {missions.map((mission, idx) => (
              <li className={c.missionsLi} key={idx}>
                {
                  <Button
                    className={clsx(
                      {
                        [c.missionActive]: mission === activeMission,
                        [c.missionNotActive]: mission !== activeMission,
                      },
                      c.missionButton
                    )}
                    disableElevation
                    onClick={() => {
                      dispatch(setMission(mission));
                    }}
                  >
                    {mission}
                  </Button>
                }
              </li>
            ))}
          </ul>
        </div>
        <div className={c.pages}>
          <Button
            className={c.pageButton}
            variant="contained"
            disableElevation
            startIcon={<ShapeLineIcon size="small" />}
            onClick={() => {
              dispatch(setModal({ name: "newMission" }));
            }}
          >
            GeoDatasets
          </Button>
          <Button
            className={c.pageButton}
            variant="contained"
            disableElevation
            startIcon={<TextSnippetIcon size="small" />}
            onClick={() => {
              dispatch(setModal({ name: "newMission" }));
            }}
          >
            Datasets
          </Button>
          <Button
            className={c.pageButton}
            variant="contained"
            disableElevation
            startIcon={<KeyIcon size="small" />}
            onClick={() => {
              dispatch(setPage({ page: "api_tokens" }));
            }}
          >
            API Tokens
          </Button>
          <Button
            className={c.pageButton}
            variant="contained"
            disableElevation
            startIcon={<PhishingIcon size="small" />}
            onClick={() => {
              dispatch(setModal({ name: "newMission" }));
            }}
          >
            WebHooks
          </Button>
        </div>
      </div>
      <NewMissionModal />
    </>
  );
}
