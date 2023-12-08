import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { decrement, increment } from "./PanelSlice";
import { makeStyles } from "@mui/styles";

const useStyles = makeStyles((theme) => ({
  Panel: {
    width: "220px",
    height: "100%",
    background: theme.palette.secondary.main,
  },
}));

export default function Panel() {
  const c = useStyles();

  const count = useSelector((state) => state.panel.value);
  const dispatch = useDispatch();

  return (
    <div className={c.Panel}>
      <div>
        <button
          aria-label="Increment value"
          onClick={() => dispatch(increment())}
        >
          Increment
        </button>
        <span>{count}</span>
        <button
          aria-label="Decrement value"
          onClick={() => dispatch(decrement())}
        >
          Decrement
        </button>
      </div>
    </div>
  );
}
