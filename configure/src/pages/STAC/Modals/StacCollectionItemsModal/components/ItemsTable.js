import React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import InfoIcon from "@mui/icons-material/Info";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

const useStyles = makeStyles((theme) => ({
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: 200,
  },
  noItems: {
    textAlign: "center",
    padding: 40,
    color: theme.palette?.swatches?.grey?.[400] || "#aaa",
    fontStyle: "italic",
  },
  itemId: {
    fontFamily: "monospace",
    fontSize: 12,
  },
}));

export default function ItemsTable({
  classes,
  loading,
  items,
  totalCols = 5,
  isItemSelected,
  toggleSelectItem,
  allOnPageSelected,
  someOnPageSelected,
  selectAllOnPage,
  formatDateTime,
  getAssetsHref,
  onViewJson,
  onDeleteItem,
  noItemsText,
}) {
  const local = useStyles();
  const theme = useTheme();
  const hideAssets = useMediaQuery(theme.breakpoints.down('xl'));
  const columnCount = hideAssets ? 4 : 5;

  return (
    <TableContainer className={classes.tableContainer}>
      <Table className={classes.table} stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                color="primary"
                indeterminate={someOnPageSelected}
                checked={allOnPageSelected}
                onChange={(e) => selectAllOnPage(e.target.checked)}
              />
            </TableCell>
            <TableCell>Item ID</TableCell>
            <TableCell>DateTime</TableCell>
            {!hideAssets && <TableCell>Assets Href</TableCell>}
            <TableCell align="center"></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columnCount}>
                <div className={local.loadingContainer}>Loading…</div>
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount}>
                <div className={local.noItems}>{noItemsText}</div>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell padding="checkbox">
                  <Checkbox color="primary" checked={isItemSelected(item.id)} onChange={() => toggleSelectItem(item.id)} />
                </TableCell>
                <TableCell className={local.itemId}>{item.id}</TableCell>
                <TableCell>{formatDateTime(item.properties?.datetime)}</TableCell>
                {!hideAssets && (
                  <TableCell style={{ borderRight: "none" }}>
                    <div style={{ overflow: "hidden", fontSize: "14px", fontFamily: "monospace" }}>{getAssetsHref(item)}</div>
                  </TableCell>
                )}
                <TableCell align="center">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "right" }}>
                    <Tooltip title="View Item" placement="top" arrow>
                      <IconButton className={classes.infoIcon} title="View Item" aria-label="view item" onClick={() => onViewJson(item)}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Divider orientation="vertical" flexItem />
                    <Tooltip title="Delete Item" placement="top" arrow>
                      <IconButton className={classes.deleteIcon} title="Delete" aria-label="delete" onClick={() => onDeleteItem(item.id)}>
                        <DeleteForeverIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

