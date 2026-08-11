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
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import QueryStatsIcon from "@mui/icons-material/QueryStats";

import { copyToClipboard } from "../../../../core/utils";
import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

const useStyles = makeStyles((theme) => ({
  Modal: {
    margin: theme.headHeights[1],
    [theme.breakpoints.down("xs")]: {
      margin: "6px",
    },
    "& .MuiDialog-container": {
      height: "unset !important",
      transform: "translateX(-50%) translateY(-50%)",
      left: "50%",
      top: "50%",
      position: "absolute",
    },
  },
  contents: {
    background: theme.palette.primary.main,
    height: "100%",
    width: "760px",
    maxWidth: "unset",
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
    padding: "8px 16px 16px 16px !important",
    height: `calc(100% - ${theme.headHeights[2]}px)`,
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
  layerName: {
    textAlign: "center",
    fontSize: "24px !important",
    letterSpacing: "1px !important",
    color: theme.palette.swatches.grey[100],
    fontWeight: "bold !important",
    margin: "10px !important",
    borderBottom: `1px solid ${theme.palette.swatches.grey[100]}`,
    paddingBottom: "10px",
  },
  none: {
    fontStyle: "italic",
    margin: "10px",
  },
  field: {
    fontWeight: "bold",
  },
  number: {
    fontFamily: "monospace",
    whiteSpace: "nowrap",
  },
}));

const MODAL_NAME = "geoDatasetFieldStats";

/** A statistic as a number a person can read, keeping small values exact. */
function format(value) {
  if (value == null || value === "") return "-";
  const number = parseFloat(value);
  if (!Number.isFinite(number)) return String(value);
  if (Number.isInteger(number) && Math.abs(number) < 1e15)
    return String(number);
  const magnitude = Math.abs(number);
  if (magnitude >= 1e9 || (magnitude < 1e-3 && magnitude > 0))
    return number.toExponential(4);
  return String(parseFloat(number.toPrecision(8)));
}

const COLUMNS = [
  ["min", "Min"],
  ["max", "Max"],
  ["avg", "Average"],
  ["stddev", "Std Dev"],
  ["sum", "Sum"],
  ["count", "Count"],
  ["nullCount", "Nulls"],
];

const FieldStatsModal = () => {
  const c = useStyles();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const dispatch = useDispatch();

  const handleClose = () => {
    dispatch(setModal({ name: MODAL_NAME, on: false }));
  };

  const stats = modal?.geoDataset?.field_stats || {};
  const fields = Object.keys(stats).sort();

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
            <QueryStatsIcon className={c.backgroundIcon} />
            <div className={c.title}>GeoDataset Field Statistics</div>
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
        <Typography
          className={c.layerName}
        >{`${modal?.geoDataset?.name}`}</Typography>
        {fields.length > 0 ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Field</TableCell>
                {COLUMNS.map(([key, label]) => (
                  <TableCell key={key} align="right">
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field} hover>
                  <TableCell className={c.field}>{field}</TableCell>
                  {COLUMNS.map(([key]) => (
                    <TableCell key={key} align="right" className={c.number}>
                      {format(stats[field][key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography className={c.none}>
            {`This GeoDataset has no stored statistics. It was ingested before they were kept - Recompute Statistics measures it.`}
          </Typography>
        )}
      </DialogContent>
      <DialogActions className={c.dialogActions}>
        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon fontSize="small" />}
          disabled={fields.length === 0}
          onClick={() => copyToClipboard(JSON.stringify(stats, null, 2))}
        >
          Copy
        </Button>
        <Button className={c.close} variant="outlined" onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FieldStatsModal;
