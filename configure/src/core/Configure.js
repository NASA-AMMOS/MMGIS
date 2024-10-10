import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { makeStyles } from "@mui/styles";

import Main from "../components/Main/Main";
import Panel from "../components/Panel/Panel";

import { calls } from "../core/calls";
import { setMissions, setSnackBarText } from "./ConfigureStore";
import Websocket from "./Websocket";
import { getInjectables } from "./injectables";

const useStyles = makeStyles((theme) => ({
  Configure: {
    width: "100%",
    height: "100%",
    display: "flex",
  },
  left: {
    height: "100%",
    width: "220px",
  },
  right: {
    height: "100%",
    flex: 1,
    position: "relative",
  },
}));

export default function Configure() {
  const c = useStyles();
  const dispatch = useDispatch();
  useEffect(() => {
    calls.api(
      "missions",
      null,
      (res) => {
        dispatch(setMissions(res.missions));
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to get available missions.",
            severity: "error",
          })
        );
      }
    );

    getInjectables();
  }, [dispatch]);

  return (
    <div className={c.Configure}>
      <div className={c.left}>
        <Panel />
      </div>
      <div className={c.right}>
        <Main />
      </div>
      <Websocket />
    </div>
  );
}
