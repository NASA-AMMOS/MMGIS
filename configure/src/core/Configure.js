import clsx from "clsx";
import { makeStyles } from "@mui/styles";

import Main from "../components/Main/Main";
import Panel from "../components/Panel/Panel";

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
  },
}));

export default function Configure() {
  const c = useStyles();

  return (
    <div className={c.Configure}>
      <div className={c.left}>
        <Panel />
      </div>
      <div className={c.right}>
        <Main />
      </div>
    </div>
  );
}
