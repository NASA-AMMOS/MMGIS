import React from "react";
import { useSelector, useDispatch } from "react-redux";
import {} from "./SaveBarSlice";
import { makeStyles } from "@mui/styles";

import clsx from "clsx";

import { calls } from "../../core/calls";

import {
  setModal,
  setConfiguration,
  clearLockConfig,
  saveConfiguration,
  setSnackBarText,
} from "../../core/ConfigureStore";

import Button from "@mui/material/Button";

import PreviewIcon from "@mui/icons-material/Preview";
import SaveIcon from "@mui/icons-material/Save";

import PreviewModal from "./Modals/PreviewModal/PreviewModal";

const useStyles = makeStyles((theme) => ({
  SaveBar: {
    width: "100%",
    position: "absolute",
    bottom: 0,
    right: 0,
    height: "48px",
    minHeight: "48px",
    display: "flex",
    justifyContent: "flex-end",
  },
  preview: {
    margin: "8px !important",
    height: "32px",
    border: `1px solid ${theme.palette.swatches.grey[500]} !important`,
    borderRadius: "3px !important",
    background: `${theme.palette.swatches.grey[800]} !important`,
  },
  save: {
    margin: "8px !important",
    height: "32px",
    borderRadius: "3px !important",
    background: `${theme.palette.swatches.p[11]} !important`,
    color: "white !important",
  },
  saveDisabled: {
    cursor: "not-allowed !important",
    background: `${theme.palette.swatches.red[500]} !important`,
  },
}));

export default function SaveBar() {
  const c = useStyles();

  const dispatch = useDispatch();

  const mission = useSelector((state) => state.core.mission);
  const lockConfig = useSelector((state) => state.core.lockConfig);

  return (
    <>
      <div className={c.SaveBar}>
        <Button
          className={c.preview}
          variant="outlined"
          startIcon={<PreviewIcon />}
          onClick={() => {
            dispatch(setModal({ name: "preview" }));
          }}
        >
          Preview Changes
        </Button>
        <Button
          className={clsx(c.save, { [c.saveDisabled]: lockConfig })}
          variant="contained"
          endIcon={<SaveIcon />}
          onClick={() => {
            dispatch(
              saveConfiguration({
                cb: (status, resp) => {
                  dispatch(
                    setSnackBarText({
                      text:
                        status === "success"
                          ? "Saved!"
                          : "Failed to save configuration!" +
                            (resp?.errors?.[0]?.reason
                              ? ` — ${resp?.errors?.[0]?.reason}`
                              : ""),
                      severity: status,
                    })
                  );
                  if (status === "success")
                    if (mission != null)
                      calls.api(
                        "get",
                        { mission: mission },
                        (res) => {
                          dispatch(setConfiguration(res));
                          dispatch(clearLockConfig({}));
                        },
                        (res) => {
                          dispatch(
                            setSnackBarText({
                              text:
                                res?.message ||
                                "Failed to get configuration for mission.",
                              severity: "error",
                            })
                          );
                        }
                      );
                },
              })
            );
          }}
        >
          Save Changes
        </Button>
      </div>
      <PreviewModal />
    </>
  );
}
