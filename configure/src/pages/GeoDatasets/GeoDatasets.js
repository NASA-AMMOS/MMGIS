import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import clsx from "clsx";

import { calls } from "../../core/calls";
import { copyToClipboard } from "../../core/utils";
import { setSnackBarText, setGeodatasets } from "../../core/ConfigureStore";

import PropTypes from "prop-types";
import { alpha } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import DeleteIcon from "@mui/icons-material/Delete";
import FilterListIcon from "@mui/icons-material/FilterList";
import Divider from "@mui/material/Divider";
import { visuallyHidden } from "@mui/utils";

import InventoryIcon from "@mui/icons-material/Inventory";
import PreviewIcon from "@mui/icons-material/Preview";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AddIcon from "@mui/icons-material/Add";

function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

function getComparator(order, orderBy) {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

// Since 2020 all major browsers ensure sort stability with Array.prototype.sort().
// stableSort() brings sort stability to non-modern browsers (notably IE11). If you
// only support modern browsers you can replace stableSort(exampleArray, exampleComparator)
// with exampleArray.slice().sort(exampleComparator)
function stableSort(array, comparator) {
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) {
      return order;
    }
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

const headCells = [
  {
    id: "name",
    label: "Name",
  },
  {
    id: "updated",
    label: "Last Updated",
  },
  {
    id: "actions",
    label: "",
  },
];

function EnhancedTableHead(props) {
  const { order, orderBy, rowCount, onRequestSort } = props;
  const createSortHandler = (property) => (event) => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        {headCells.map((headCell, idx) => (
          <TableCell
            key={headCell.id}
            align={idx === 0 ? "left" : "right"}
            padding={"normal"}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : "asc"}
              onClick={createSortHandler(headCell.id)}
            >
              {headCell.label}
              {orderBy === headCell.id ? (
                <Box component="span" sx={visuallyHidden}>
                  {order === "desc" ? "sorted descending" : "sorted ascending"}
                </Box>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

const useStyles = makeStyles((theme) => ({
  actions: {
    display: "flex",
    justifyContent: "right",
  },
  inIcon: {
    width: "40px !important",
    height: "40px !important",
  },
  previewIcon: {
    width: "40px !important",
    height: "40px !important",
  },
  downloadIcon: {
    marginRight: "4px !important",
    width: "40px !important",
    height: "40px !important",
  },
  updateIcon: {
    marginLeft: "4px !important",
    width: "40px !important",
    height: "40px !important",
  },
  renameIcon: {
    marginRight: "4px !important",
    width: "40px !important",
    height: "40px !important",
  },
  deleteIcon: {
    marginLeft: "4px !important",
    width: "40px !important",
    height: "40px !important",
    "&:hover": {
      background: "#c43541 !important",
    },
  },
  addButton: {
    whiteSpace: "nowrap",
    padding: "5px 20px !important",
    margin: "0px 10px !important",
  },
}));

EnhancedTableHead.propTypes = {
  onRequestSort: PropTypes.func.isRequired,
  onSelectAllClick: PropTypes.func.isRequired,
  order: PropTypes.oneOf(["asc", "desc"]).isRequired,
  orderBy: PropTypes.string.isRequired,
  rowCount: PropTypes.number.isRequired,
};

function EnhancedTableToolbar(props) {
  const c = useStyles();

  return (
    <Toolbar
      sx={{
        pl: { sm: 2 },
        pr: { xs: 1, sm: 1 },
      }}
    >
      <Typography
        sx={{ flex: "1 1 100%" }}
        variant="h6"
        id="tableTitle"
        component="div"
      >
        GEODATASETS
      </Typography>

      <Button
        variant="contained"
        className={c.addButton}
        endIcon={<AddIcon />}
        onClick={() => {
          //dispatch(setModal({ name: "preview" }));
        }}
      >
        New GeoDataset
      </Button>
    </Toolbar>
  );
}

EnhancedTableToolbar.propTypes = {
  numSelected: PropTypes.number.isRequired,
};

export default function GeoDatasets() {
  const [order, setOrder] = React.useState("asc");
  const [orderBy, setOrderBy] = React.useState("calories");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);

  const c = useStyles();

  const dispatch = useDispatch();
  const geodatasets = useSelector((state) => state.core.geodatasets);
  useEffect(() => {
    calls.api(
      "geodatasets_entries",
      {},
      (res) => {
        if (res.status === "success")
          dispatch(
            setGeodatasets(
              res.body.entries.map((en, idx) => {
                en.id = idx;
                return en;
              })
            )
          );
        else
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to get geodatasets.",
              severity: "error",
            })
          );
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to get geodatasets.",
            severity: "error",
          })
        );
      }
    );
  }, [dispatch]);

  console.log(geodatasets);

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - geodatasets.length) : 0;

  const visibleRows = React.useMemo(
    () =>
      stableSort(geodatasets, getComparator(order, orderBy)).slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      ),
    [order, orderBy, page, rowsPerPage, geodatasets]
  );

  return (
    <Box sx={{ width: "100%" }}>
      <Paper sx={{ width: "100%", mb: 2 }}>
        <EnhancedTableToolbar />
        <TableContainer>
          <Table
            sx={{ minWidth: 750 }}
            aria-labelledby="tableTitle"
            size="small"
          >
            <EnhancedTableHead
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
              rowCount={geodatasets.length}
            />
            <TableBody>
              {visibleRows.map((row, index) => {
                return (
                  <TableRow
                    hover
                    role="checkbox"
                    aria-checked={false}
                    tabIndex={-1}
                    key={row.id}
                    selected={false}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell align="left">{row.name}</TableCell>
                    <TableCell align="right">{row.updated}</TableCell>
                    <TableCell align="right">
                      <div className={c.actions}>
                        <IconButton
                          className={c.inIcon}
                          title="In"
                          aria-label="in"
                          onClick={() => {}}
                        >
                          <InventoryIcon fontSize="inhesmallrit" />
                        </IconButton>
                        <IconButton
                          className={c.previewIcon}
                          title="Preview"
                          aria-label="preview"
                          onClick={() => {}}
                        >
                          <PreviewIcon fontSize="small" />
                        </IconButton>

                        <IconButton
                          className={c.downloadIcon}
                          title="Download"
                          aria-label="download"
                          onClick={() => {}}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                        <Divider orientation="vertical" flexItem />
                        <IconButton
                          className={c.updateIcon}
                          title="Update"
                          aria-label="update"
                          onClick={() => {}}
                        >
                          <UploadIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          className={c.renameIcon}
                          title="Rename"
                          aria-label="rename"
                          onClick={() => {}}
                        >
                          <DriveFileRenameOutlineIcon fontSize="small" />
                        </IconButton>
                        <Divider orientation="vertical" flexItem />
                        <IconButton
                          className={c.deleteIcon}
                          title="Delete"
                          aria-label="delete"
                          onClick={() => {}}
                        >
                          <DeleteForeverIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {emptyRows > 0 && (
                <TableRow
                  style={{
                    height: 33 * emptyRows,
                  }}
                >
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={geodatasets.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
}
