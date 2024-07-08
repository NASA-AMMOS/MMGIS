import React, { useCallback, useRef, useState } from "react";
import { ChromePicker } from "react-color";

import Button from "@mui/material/Button";

import useClickOutside from "./useClickOutside";

import { makeStyles } from "@mui/styles";

const useStyles = makeStyles((theme) => ({
  ColorButton: {
    width: "100%",
    height: "100%",
  },
  item: {
    width: "100%",
    height: "100%",
    display: "flex",
  },
  swatch: {
    width: "30px",
    height: "30px",
    margin: "10px",
    border: `1px solid black`,
    borderRadius: "3px",
    boxShadow: "0px 2px 5px 0px rgba(0,0,0,0.2)",
  },
  label: {
    flex: 1,
    lineHeight: "43px",
    margin: "5px",
  },
  popover: {
    height: 0,
    zIndex: 999,
    position: "relative",
    "& > div": {
      fontFamily: "Roboto !important",
    },
  },
  clear: {
    width: "225px",
    boxShadow:
      "rgba(0, 0, 0, 0.3) 0px 0px 2px, rgba(0, 0, 0, 0.3) 0px 4px 8px !important",
    background: "white !important",
  },
}));

const ColorButton = ({ label, color, onChange }) => {
  const popover = useRef();
  const [isOpen, toggle] = useState(false);

  const c = useStyles();

  const close = useCallback(() => {
    toggle(false);
  }, []);
  useClickOutside(popover, close);

  let timeout = null;

  return (
    <div className={c.ColorButton}>
      <div className={c.item}>
        <div
          className={c.swatch}
          style={{ backgroundColor: color }}
          onClick={() => toggle(true)}
        />
        <div className={c.label}>{label}</div>
      </div>
      {isOpen && (
        <div className={c.popover} ref={popover}>
          <ChromePicker
            color={color}
            onChangeComplete={(c) => {
              clearTimeout(timeout);
              timeout = setTimeout(() => {
                onChange(c);
              }, 50);
            }}
          />
          <Button
            className={c.clear}
            variant="contained"
            disableElevation
            onClick={() => {
              onChange(null);
            }}
          >
            Clear Selection
          </Button>
        </div>
      )}
    </div>
  );
};

export default ColorButton;
