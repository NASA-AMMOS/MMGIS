import React from "react";
import { useSelector, useDispatch } from "react-redux";

import { setModal } from "../../../../core/ConfigureStore";
import { publicUrlMainSite } from "../../../../core/constants";

import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import PreviewIcon from "@mui/icons-material/Preview";

import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

const useStyles = makeStyles((theme) => ({
  Modal: {
    [theme.breakpoints.down("xs")]: {
      margin: "6px",
    },
    "& .MuiDialog-container": {
      width: "100%",
      transform: "translateX(-50%) translateY(-50%)",
      left: "50%",
      top: "50%",
      position: "absolute",
    },
    "& .MuiPaper-root": {
      margin: "0px",
    },
  },
  contents: {
    height: "100%",
    width: "100%",
    maxWidth: "calc(100vw - 32px) !important",
    maxHeight: "calc(100vh - 32px) !important",
  },
  heading: {
    height: theme.headHeights[2],
    boxSizing: "border-box",
    background: theme.palette.swatches.p[0],
    padding: `4px ${theme.spacing(2)} 4px ${theme.spacing(4)} !important`,
  },
  title: {
    padding: `8px 0px`,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  content: {
    padding: "0px !important",
    height: `calc(100vh - 32px)`,
    background: theme.palette.swatches.grey[100],
  },
  closeIcon: {
    padding: theme.spacing(1.5),
    height: "100%",
    margin: "4px 0px",
  },
  flexBetween: {
    display: "flex",
    justifyContent: "space-between",
  },
  backgroundIcon: {
    margin: "7px 8px 0px 0px",
  },
}));

function MMGIS(props) {
  const { configuration } = props;

  React.useEffect(() => {
    const MMGISIframe = document.getElementById("MMGISIframe");
    MMGISIframe.addEventListener("load", (e) => {
      window.mmgisAPI = e.target.contentWindow.mmgisAPI;

      window.mmgisAPI.onLoaded(() => {
        window.mmgisAPI.setConfiguration(
          JSON.parse(JSON.stringify(configuration))
        );
      });
    });
    MMGISIframe.src = `${
      window.mmgisglobal.NODE_ENV === "development"
        ? "http://localhost:8889"
        : publicUrlMainSite
    }/?_preview=true`;
  }, [configuration]);

  return (
    <div
      className="MMGIS"
      style={{
        width: "100%",
        height: "calc(100vh - 78px)",
        overflow: "hidden",
      }}
    >
      <iframe
        title="MMGIS - Preview"
        id="MMGISIframe"
        allow="fullscreen"
        style={{ width: "100%", height: "100%", border: "none" }}
      ></iframe>
    </div>
  );
}

const MODAL_NAME = "preview";
const PreviewModal = (props) => {
  const {} = props;
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);
  const configuration = useSelector((state) => state.core.configuration);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const handleClose = () => {
    // close modal
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

  return (
    <Dialog
      className={c.Modal}
      fullScreen={isMobile}
      open={modal !== false}
      onClose={handleClose}
      aria-labelledby="responsive-dialog-title"
      PaperProps={{
        className: c.contents,
      }}
    >
      <DialogTitle className={c.heading}>
        <div className={c.flexBetween}>
          <div className={c.flexBetween}>
            <PreviewIcon className={c.backgroundIcon} />
            <div className={c.title}>
              {modal?.customConfig != null
                ? `Previewing Configuration v${modal.version}`
                : "Previewing Changes"}
            </div>
          </div>
          <IconButton
            className={c.closeIcon}
            title="Close"
            aria-label="close"
            onClick={handleClose}
          >
            <CloseSharpIcon fontSize="inherit" />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent className={c.content}>
        <MMGIS configuration={modal?.customConfig || configuration} />
      </DialogContent>
    </Dialog>
  );
};

export default PreviewModal;
