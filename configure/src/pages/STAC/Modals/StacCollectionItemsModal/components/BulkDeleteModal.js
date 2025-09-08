import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import { makeStyles } from "@mui/styles";

const useStyles = makeStyles(() => ({
  flexBetween: { display: "flex", justifyContent: "space-between" },
}));

export default function BulkDeleteModal({ classes, open, collectionId, selectedCount, confirmation, setConfirmation, onClose, onConfirm, disabled }) {
  const local = useStyles();
  return (
    <Dialog className={classes.deleteDialog} open={open} onClose={onClose} aria-labelledby="bulk-delete-items-dialog-title">
      <DialogTitle className={classes.deleteDialogTitle}>
        <div className={classes.flexBetween}>
          <div className={classes.flexBetween}>
            <DeleteForeverIcon className={classes.backgroundIcon} />
            <div className={classes.title}>Delete STAC Items</div>
          </div>
          <IconButton className={classes.closeIcon} title="Close" aria-label="close" onClick={onClose} disabled={disabled}>
            <CloseSharpIcon fontSize="inherit" />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent className={classes.deleteDialogContent}>
        <Typography className={classes.collectionTitle}>Collection: {collectionId}</Typography>
        <Typography className={classes.deleteConfirmMessage}>{`You are about to permanently delete ${selectedCount} item(s).`}</Typography>
        <TextField
          className={classes.deleteConfirmInput}
          label="Confirm Collection ID"
          variant="filled"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={`Type "${collectionId || ""}" to confirm`}
          disabled={disabled}
        />
        <Typography className={classes.deleteConfirmMessage}>
          {`Enter '${collectionId || ""}' above and click 'Delete' to confirm the permanent deletion of the selected STAC items.`}
        </Typography>
      </DialogContent>
      <DialogActions className={classes.deleteDialogActions}>
        <Button className={classes.deleteButton} variant="contained" startIcon={<DeleteForeverIcon size="small" />} onClick={onConfirm} disabled={disabled}>
          {disabled ? "Deleting…" : "Delete"}
        </Button>
        <Button variant="outlined" onClick={onClose} disabled={disabled}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

