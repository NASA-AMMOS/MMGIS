import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { setVersions } from "./HomeSlice";
import { makeStyles } from "@mui/styles";

import { calls } from "../../../core/calls";
import { downloadObject } from "../../../core/utils";
import Maker from "../../../core/Maker";
import { setSnackBarText, setModal } from "../../../core/ConfigureStore";

import Versions from "./Versions";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import BrowserUpdatedIcon from "@mui/icons-material/BrowserUpdated";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import UploadIcon from "@mui/icons-material/Upload";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

import config from "../../../metaconfigs/tab-home-config.json";
import UploadConfigModal from "./Modals/UploadConfigModal/UploadConfigModal";
import CloneConfigModal from "./Modals/CloneConfigModal/CloneConfigModal";
import DeleteConfigModal from "./Modals/DeleteConfigModal/DeleteConfigModal";

const useStyles = makeStyles((theme) => ({
  Home: {
    width: "100%",
    display: "flex",
    flexFlow: "column",
    background: theme.palette.swatches.grey[1000],
    padding: "0px 32px 64px 32px",
    boxSizing: "border-box",
    backgroundImage: "url(configure/build/gridlines.png)",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    margin: "20px 0px 8px 0px",
  },
  title: {
    letterSpacing: "2px",
    color: theme.palette.swatches.p[0],
    textShadow: `0px 2px 1px ${theme.palette.swatches.grey[300]}`,
    fontSize: "48px",
    margin: 0,
  },
  right: {
    display: "flex",
  },
  exportIcon: {
    color: `${theme.palette.swatches.p[11]} !important`,
    width: "40px",
    height: "40px",
    margin: "9px !important",
  },
  uploadIcon: {
    width: "40px",
    height: "40px",
    margin: "9px !important",
  },
  cloneIcon: {
    color: `${theme.palette.accent.main} !important`,
    width: "40px",
    height: "40px",
    margin: "9px !important",
  },
  deleteIcon: {
    color: `${theme.palette.swatches.red[500]} !important`,
    width: "40px",
    height: "40px",
    margin: "9px !important",
  },
}));

export default function Home() {
  const c = useStyles();

  const dispatch = useDispatch();
  const mission = useSelector((state) => state.core.mission);
  const configuration = useSelector((state) => state.core.configuration);

  const queryVersions = () => {
    if (mission != null)
      calls.api(
        "versions",
        { mission: mission },
        (res) => {
          const v = res?.versions || [];
          if (v.length > 0) v[v.length - 1].current = true;
          dispatch(setVersions(res?.versions || []));
        },
        (res) => {
          dispatch(
            setSnackBarText({
              text:
                res?.message || "Failed to get the history for the mission.",
              severity: "error",
            })
          );
        }
      );
  };

  const handleExport = () => {
    downloadObject(configuration, `${mission}_WORKING_config`, ".json");
    dispatch(
      setSnackBarText({
        text: "Successfully exported working Configuration JSON.",
        severity: "success",
      })
    );
  };
  const handleUpload = () => {
    dispatch(
      setModal({
        name: "uploadConfig",
      })
    );
  };
  const handleClone = () => {
    dispatch(
      setModal({
        name: "cloneConfig",
      })
    );
  };
  const handleDelete = () => {
    dispatch(
      setModal({
        name: "deleteConfig",
      })
    );
  };

  return (
    <>
      <div className={c.Home}>
        <div className={c.top}>
          <h2 className={c.title}>{mission}</h2>
          <div className={c.right}>
            <Tooltip
              title={"Export Unsaved Config.JSON"}
              placement="bottom"
              arrow
            >
              <IconButton
                className={c.exportIcon}
                title="Export Unsaved"
                aria-label="export unsaved"
                onClick={handleExport}
              >
                <BrowserUpdatedIcon fontSize="medium" />
              </IconButton>
            </Tooltip>
            <Tooltip title={"Upload Config.JSON"} placement="bottom" arrow>
              <IconButton
                className={c.uploadIcon}
                title="Upload"
                aria-label="upload"
                onClick={handleUpload}
              >
                <UploadIcon fontSize="medium" />
              </IconButton>
            </Tooltip>
            <Tooltip title={"Clone Mission"} placement="bottom" arrow>
              <IconButton
                className={c.cloneIcon}
                title="Clone"
                aria-label="clone"
                onClick={handleClone}
              >
                <ContentCopyIcon fontSize="medium" />
              </IconButton>
            </Tooltip>
            <Tooltip title={"Delete Mission"} placement="bottom" arrow>
              <IconButton
                className={c.deleteIcon}
                title="Delete"
                aria-label="delete"
                onClick={handleDelete}
              >
                <DeleteForeverIcon fontSize="medium" />
              </IconButton>
            </Tooltip>
          </div>
        </div>
        <Versions queryVersions={queryVersions} />
        <Maker config={config} />
      </div>
      <UploadConfigModal queryVersions={queryVersions} />
      <CloneConfigModal />
      <DeleteConfigModal />
    </>
  );
}
