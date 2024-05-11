import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {} from "./SaveBarSlice";
import { makeStyles } from "@mui/styles";

import { calls } from "../../core/calls";
import { setModal } from "../../core/ConfigureStore";

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
    margin: "8px 24px 8px 8px !important",
    height: "32px",
    borderRadius: "3px !important",
    background: `${theme.palette.swatches.p[11]} !important`,
    color: "white !important",
  },
}));

export default function SaveBar() {
  const c = useStyles();

  const dispatch = useDispatch();

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
        <Button className={c.save} variant="contained" endIcon={<SaveIcon />}>
          Save Changes
        </Button>
      </div>
      <PreviewModal />
    </>
  );
}
