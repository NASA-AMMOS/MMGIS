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

export default function DeleteItemModal({ classes, open, itemId, collectionId, confirmation, setConfirmation, onClose, onConfirm }) {
  const local = useStyles();
  return (
    <Dialog className={classes.deleteDialog} open={open} onClose={onClose} aria-labelledby="delete-item-dialog-title">
      <DialogTitle className={classes.deleteDialogTitle}>
        <div className={classes.flexBetween}>
          <div className={classes.flexBetween}>
            <DeleteForeverIcon className={classes.backgroundIcon} />
            <div className={classes.title}>Delete STAC Item</div>
          </div>
          <IconButton className={classes.closeIcon} title="Close" aria-label="close" onClick={onClose}>
            <CloseSharpIcon fontSize="inherit" />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent className={classes.deleteDialogContent}>
        <Typography className={classes.collectionTitle}>Collection: {collectionId}</Typography>
        <Typography className={classes.deleteItemName}>{`Deleting: ${itemId || ""}`}</Typography>
        <TextField
          className={classes.deleteConfirmInput}
          label="Confirm Item ID"
          variant="filled"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={`Type "${itemId}" to confirm`}
        />
        <Typography className={classes.deleteConfirmMessage}>
          {`Enter '${itemId || ""}' above and click 'Delete' to confirm the permanent deletion of this STAC item.`}
        </Typography>
      </DialogContent>
      <DialogActions className={classes.deleteDialogActions}>
        <Button className={classes.deleteButton} variant="contained" startIcon={<DeleteForeverIcon size="small" />} onClick={onConfirm}>
          Delete
        </Button>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

