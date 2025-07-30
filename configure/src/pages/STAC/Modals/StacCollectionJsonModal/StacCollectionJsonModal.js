import React from "react";
import { useSelector, useDispatch } from "react-redux";

import { setModal } from "../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import InfoIcon from "@mui/icons-material/Info";

import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import ReactJson from "react-json-view";

const useStyles = makeStyles((theme) => ({
  Modal: {

  },
  contents: {
    maxWidth: "80vw",
    maxHeight: "80vh",
    width: "1100px",
    background: theme.palette.primary.main,
  },
  heading: {
    height: theme.headHeights[2],
    boxSizing: "border-box",
    background: theme.palette.swatches.p[0],
    borderBottom: `1px solid ${theme.palette.swatches.grey[800]}`,
    padding: `4px ${theme.spacing(2)} 4px ${theme.spacing(4)} !important`,
  },
  title: {
    padding: `8px 0px`,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: "bold",
    color: theme.palette.swatches.grey[0],
    textTransform: "uppercase",
  },
  content: {
    padding: "0px !important",
    height: "100%",
    overflow: "none",
    background: theme.palette.swatches.grey[150],
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
  jsonContainer: {
    background: theme.palette.swatches.grey[150],
    padding: "16px",
    boxSizing: "border-box",
    height: "100%",
    overflow: "auto",
  },
  dialogActions: {
    background: theme.palette.swatches.grey[200],
    padding: "16px 24px !important",
  },
  dialogActionsClose: {
    color: `${theme.palette.swatches.grey[800]} !important`,
    border: `1px solid ${theme.palette.swatches.grey[800]} !important`,
    '&:hover': {
      background: `${theme.palette.swatches.grey[900]} !important`,
      color: `${theme.palette.swatches.grey[0]} !important`,
    },
  },
}));

const MODAL_NAME = "stacCollectionJson";

const StacCollectionJsonModal = () => {
  const c = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const dispatch = useDispatch();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);

  const handleClose = () => {
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

  return (
    <Dialog
      className={c.Modal}
      fullScreen={isMobile}
      open={modal !== false}
      onClose={handleClose}
      aria-labelledby="collection-json-dialog-title"
      PaperProps={{
        className: c.contents,
      }}
      maxWidth={false}
    >
      <DialogTitle className={c.heading}>
        <div className={c.flexBetween}>
          <div className={c.flexBetween}>
            <InfoIcon className={c.backgroundIcon} />
            <div className={c.title}>Collection JSON: {modal?.collection?.id}</div>
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
        <div className={c.jsonContainer}>
          {modal?.collection && (
            <ReactJson
              src={modal.collection}
              theme="chalk"
              iconStyle="triangle"
              indentWidth={4}
              collapsed={false}
              collapseStringsAfterLength={100}
              displayObjectSize={false}
              displayDataTypes={false}
              enableClipboard={true}
              sortKeys={false}
              quotesOnKeys={false}
              name="item"
              style={{
                backgroundColor: "transparent",
                fontSize: "14px",
              }}
            />
          )}
        </div>
      </DialogContent>
      <DialogActions className={c.dialogActions}>
        <Button className={c.dialogActionsClose} onClick={handleClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StacCollectionJsonModal;