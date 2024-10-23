import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../core/calls";
import { downloadObject } from "../../core/utils";
import {
  setSnackBarText,
  setDatasets,
  setModal,
} from "../../core/ConfigureStore";

import PropTypes from "prop-types";
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
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import Badge from "@mui/material/Badge";
import { visuallyHidden } from "@mui/utils";

import InventoryIcon from "@mui/icons-material/Inventory";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AddIcon from "@mui/icons-material/Add";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";

import NewDatasetModal from "./Modals/NewDatasetModal/NewDatasetModal";
import LayersUsedByModal from "./Modals/LayersUsedByModal/LayersUsedByModal";
import UpdateDatasetModal from "./Modals/UpdateDatasetModal/UpdateDatasetModal";
import DeleteDatasetModal from "./Modals/DeleteDatasetModal/DeleteDatasetModal";

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

const useStyles = makeStyles((theme) => ({
  Datasets: { width: "100%", height: "100%" },
  DatasetsInner: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexFlow: "column",
    backgroundImage: "url(configure/build/gridlines.png)",
  },
  table: {
    flex: 1,
    overflowY: "auto",
    "& tr": {
      background: theme.palette.swatches.grey[850],
    },
    "& td": {
      borderRight: `1px solid ${theme.palette.swatches.grey[800]}`,
      borderBottom: `1px solid ${theme.palette.swatches.grey[700]} !important`,
    },
    "& td:first-child": {
      fontWeight: "bold",
      letterSpacing: "1px",
      fontSize: "16px",
      color: `${theme.palette.swatches.p[13]}`,
    },
  },
  tableInner: {
    margin: "32px",
    width: "calc(100% - 64px) !important",
    boxShadow: "0px 1px 7px 0px rgba(0, 0, 0, 0.2)",
  },
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
  appendIcon: {
    marginLeft: "4px !important",
    width: "40px !important",
    height: "40px !important",
  },
  renameIcon: {
    width: "40px !important",
    height: "40px !important",
  },
  updateIcon: {
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
      color: `${theme.palette.swatches.grey[900]} !important`,
    },
  },
  addButton: {
    whiteSpace: "nowrap",
    padding: "5px 20px !important",
    margin: "0px 10px !important",
  },
  badge: {
    "& > span": {
      backgroundColor: `${theme.palette.swatches.p[11]} !important`,
    },
  },
  topbar: {
    width: "100%",
    height: "48px",
    minHeight: "48px !important",
    display: "flex",
    justifyContent: "space-between",
    padding: `0px 20px`,
    boxSizing: `border-box !important`,
  },
  topbarTitle: {
    display: "flex",
    color: theme.palette.swatches.grey[150],
    "& > svg": {
      color: theme.palette.swatches.grey[150],
      margin: "3px 10px 0px 2px",
    },
  },
  bottomBar: {
    background: theme.palette.swatches.grey[850],
    boxShadow: "inset 10px 0px 10px -5px rgba(0,0,0,0.3)",
  },
  th: {
    fontWeight: "bold !important",
    textTransform: "uppercase",
    letterSpacing: "1px !important",
    backgroundColor: `${theme.palette.swatches.grey[1000]} !important`,
    borderRight: `1px solid ${theme.palette.swatches.grey[900]}`,
  },
}));

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
  const { order, orderBy, onRequestSort } = props;
  const createSortHandler = (property) => (event) => {
    onRequestSort(event, property);
  };

  const c = useStyles();

  return (
    <TableHead>
      <TableRow>
        {headCells.map((headCell, idx) => (
          <TableCell
            className={c.th}
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

EnhancedTableHead.propTypes = {
  onRequestSort: PropTypes.func.isRequired,
  onSelectAllClick: PropTypes.func.isRequired,
  order: PropTypes.oneOf(["asc", "desc"]).isRequired,
  orderBy: PropTypes.string.isRequired,
  rowCount: PropTypes.number.isRequired,
};

function EnhancedTableToolbar(props) {
  const c = useStyles();
  const dispatch = useDispatch();

  return (
    <Toolbar className={c.topbar}>
      <div className={c.topbarTitle}>
        <TextSnippetIcon />
        <Typography
          style={{ fontWeight: "bold", fontSize: "16px", lineHeight: "29px" }}
          variant="h6"
          component="div"
        >
          DATASETS
        </Typography>

        <Typography
          style={{
            fontWeight: "bold",
            fontSize: "14px",
            lineHeight: "29px",
            paddingLeft: "20px",
          }}
          variant="h6"
          component="div"
        >
          {`1) Create a New Dataset. 2) Connect to it through a Vector Layer's Datasets tab.`}
        </Typography>
      </div>

      <Button
        variant="contained"
        className={c.addButton}
        endIcon={<AddIcon />}
        onClick={() => {
          dispatch(setModal({ name: "newDataset" }));
        }}
      >
        New Dataset
      </Button>
    </Toolbar>
  );
}

EnhancedTableToolbar.propTypes = {
  numSelected: PropTypes.number.isRequired,
};

export default function Datasets() {
  const [order, setOrder] = React.useState("asc");
  const [orderBy, setOrderBy] = React.useState("name");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);

  const c = useStyles();

  const dispatch = useDispatch();
  const datasets = useSelector((state) => state.core.datasets);

  const queryDatasets = () => {
    calls.api(
      "datasets_entries",
      {},
      (res) => {
        if (res.status === "success")
          dispatch(
            setDatasets(
              res.body.entries.map((en, idx) => {
                en.id = idx;
                return en;
              })
            )
          );
        else
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to get datasets.",
              severity: "error",
            })
          );
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to get datasets.",
            severity: "error",
          })
        );
      }
    );
  };
  useEffect(() => {
    queryDatasets();
  }, []);

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
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - datasets.length) : 0;

  const visibleRows = React.useMemo(
    () =>
      stableSort(datasets, getComparator(order, orderBy)).slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      ),
    [order, orderBy, page, rowsPerPage, datasets]
  );

  return (
    <>
      <Box className={c.Datasets}>
        <Paper className={c.DatasetsInner}>
          <EnhancedTableToolbar />
          <TableContainer className={c.table}>
            <Table
              className={c.tableInner}
              sx={{ minWidth: 750 }}
              aria-labelledby="tableTitle"
              size="small"
              stickyHeader
            >
              <EnhancedTableHead
                order={order}
                orderBy={orderBy}
                onRequestSort={handleRequestSort}
                rowCount={datasets.length}
              />
              <TableBody>
                {visibleRows.map((row, index) => {
                  let numOccurrences = 0;
                  if (row.occurrences) {
                    Object.keys(row.occurrences).forEach((m) => {
                      numOccurrences += row.occurrences[m].length;
                    });
                  }

                  return (
                    <TableRow
                      hover
                      role="checkbox"
                      aria-checked={false}
                      tabIndex={-1}
                      key={row.id}
                      selected={false}
                    >
                      <TableCell align="left">{row.name}</TableCell>
                      <TableCell align="right">
                        {row.updated
                          ? new Date(row.updated).toLocaleString()
                          : row.updated}
                      </TableCell>
                      <TableCell align="right">
                        <div className={c.actions}>
                          <Tooltip title={"Used By"} placement="top" arrow>
                            <IconButton
                              className={c.inIcon}
                              title="Used By"
                              aria-label="used by"
                              onClick={() => {
                                console.log(row);
                                dispatch(
                                  setModal({
                                    name: "layersUsedByDataset",
                                    dataset: row,
                                  })
                                );
                              }}
                            >
                              <Badge
                                className={c.badge}
                                badgeContent={numOccurrences}
                                color="primary"
                              >
                                <InventoryIcon fontSize="small" />
                              </Badge>
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={"Download"} placement="top" arrow>
                            <IconButton
                              className={c.downloadIcon}
                              title="Download"
                              aria-label="download"
                              onClick={() => {
                                if (row.name)
                                  calls.api(
                                    "datasets_download",
                                    {
                                      layer: row.name,
                                    },
                                    (res) => {
                                      downloadObject(
                                        res,
                                        `${row.name}-dataset`,
                                        ".json"
                                      );
                                      dispatch(
                                        setSnackBarText({
                                          text:
                                            res?.message ||
                                            "Successfully downloaded Dataset.",
                                          severity: "success",
                                        })
                                      );
                                    },
                                    (res) => {
                                      dispatch(
                                        setSnackBarText({
                                          text:
                                            res?.message ||
                                            "Failed to download Dataset.",
                                          severity: "error",
                                        })
                                      );
                                    }
                                  );
                              }}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Divider orientation="vertical" flexItem />
                          {/*
                          <Tooltip title={"Rename"} placement="top" arrow>
                            <IconButton
                              className={c.renameIcon}
                              title="Rename"
                              aria-label="rename"
                              onClick={() => {}}
                            >
                              <DriveFileRenameOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                            */}
                          <Tooltip title={"Update"} placement="top" arrow>
                            <IconButton
                              className={c.updateIcon}
                              title="Update"
                              aria-label="update"
                              onClick={() => {
                                dispatch(
                                  setModal({
                                    name: "updateDataset",
                                    dataset: row,
                                  })
                                );
                              }}
                            >
                              <UploadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Divider orientation="vertical" flexItem />

                          <Tooltip title={"Delete"} placement="top" arrow>
                            <IconButton
                              className={c.deleteIcon}
                              title="Delete"
                              aria-label="delete"
                              onClick={() => {
                                dispatch(
                                  setModal({
                                    name: "deleteDataset",
                                    dataset: row,
                                  })
                                );
                              }}
                            >
                              <DeleteForeverIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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
            className={c.bottomBar}
            rowsPerPageOptions={[25, 50, 100]}
            component="div"
            count={datasets.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      </Box>
      <NewDatasetModal queryDatasets={queryDatasets} />
      <LayersUsedByModal />
      <UpdateDatasetModal queryDatasets={queryDatasets} />
      <DeleteDatasetModal queryDatasets={queryDatasets} />
    </>
  );
}
