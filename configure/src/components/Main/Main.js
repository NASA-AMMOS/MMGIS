import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { decrement, increment } from "./MainSlice";
import { makeStyles } from "@mui/styles";

const useStyles = makeStyles((theme) => ({
  Main: {
    width: "100%",
    height: "100%",
    background: theme.palette.swatches.grey[900],
  },
}));

export default function Main() {
  const c = useStyles();

  const count = useSelector((state) => state.panel.value);
  const dispatch = useDispatch();

  return <div className={c.Main}></div>;
}
