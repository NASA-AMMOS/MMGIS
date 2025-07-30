import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../core/calls";
import { downloadObject } from "../../core/utils";
import {
  setSnackBarText,
  setStacCollections,
  setModal,
} from "../../core/ConfigureStore";

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
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import Badge from "@mui/material/Badge";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import { visuallyHidden } from "@mui/utils";

import InventoryIcon from "@mui/icons-material/Inventory";
import InfoIcon from "@mui/icons-material/Info";
import WidgetsIcon from "@mui/icons-material/Widgets";
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AddIcon from "@mui/icons-material/Add";
import HorizontalSplitIcon from "@mui/icons-material/HorizontalSplit";
import SettingsIcon from "@mui/icons-material/Settings";
import SearchIcon from "@mui/icons-material/Search";

import NewStacCollectionModal from "./Modals/NewStacCollectionModal/NewStacCollectionModal";
import DeleteStacCollectionModal from "./Modals/DeleteStacCollectionModal/DeleteStacCollectionModal";
import LayersUsedByModal from "./Modals/LayersUsedByModal/LayersUsedByModal";
import StacCollectionItemsModal from "./Modals/StacCollectionItemsModal/StacCollectionItemsModal";
import StacCollectionJsonModal from "./Modals/StacCollectionJsonModal/StacCollectionJsonModal";

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
  STAC: { width: "100%", height: "100%" },
  STACInner: {
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
    margin: "8px 32px 32px 32px",
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
    width: "calc(100% - 100px)",
    height: "44px",
    minHeight: "44px !important",
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
  searchContainer: {
    padding: "16px 32px 8px 32px",
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
    id: "id",
    label: "Collection Id",
  },
  {
    id: "description",
    label: "Description",
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
        <HorizontalSplitIcon />
        <Typography
          style={{ fontWeight: "bold", fontSize: "16px", lineHeight: "29px" }}
          variant="h6"
          component="div"
        >
          STAC
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
          {`1) Create a Collection. 2) Add COG Items to the Collection. See MMGIS/auxiliary/stac for script examples. 3) Set a Tile Layer URL to 'stac-collection:{collection_name}'`}
        </Typography>
      </div>

      <Button
        variant="contained"
        className={c.addButton}
        endIcon={<AddIcon />}
        onClick={() => {
          dispatch(setModal({ name: "newStacCollection" }));
        }}
      >
        New Collection
      </Button>
    </Toolbar>
  );
}

EnhancedTableToolbar.propTypes = {
  numSelected: PropTypes.number.isRequired,
};

export default function STAC() {
  const [order, setOrder] = React.useState("asc");
  const [orderBy, setOrderBy] = React.useState("name");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);
  const [searchTerm, setSearchTerm] = React.useState("");

  const c = useStyles();

  const dispatch = useDispatch();
  const stacCollections = useSelector((state) => state.core.stacCollections);

  const querySTAC = () => {
    calls.api(
      "stac_collections",
      {
        limit: 2000,
      },
      (res) => {
        if (res?.body?.collections != null)
          dispatch(setStacCollections(res.body.collections));
        else
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to get STAC Collections.",
              severity: "error",
            })
          );
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to get STAC Collections.",
            severity: "error",
          })
        );
      }
    );
  };
  useEffect(() => {
    querySTAC();
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

  // Filter collections based on search term
  const filteredCollections = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return stacCollections;
    }
    return stacCollections.filter(collection =>
      collection.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (collection.description && collection.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [stacCollections, searchTerm]);

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - filteredCollections.length)
      : 0;

  const visibleRows = React.useMemo(
    () =>
      stableSort(filteredCollections, getComparator(order, orderBy)).slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      ),
    [order, orderBy, page, rowsPerPage, filteredCollections]
  );

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(0); // Reset to first page when searching
  };

  return (
    <>
      <Box className={c.STAC}>
        <Paper className={c.STACInner}>
          <EnhancedTableToolbar numSelected={0} />
          
          <div className={c.searchContainer}>
            <TextField
              fullWidth
              label="Search Collections"
              variant="filled"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by Collection ID or Description"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </div>
          
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
                rowCount={filteredCollections.length}
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
                      <TableCell align="left">{row.id}</TableCell>
                      <TableCell align="right">{row.description}</TableCell>
                      <TableCell align="right">
                        <div className={c.actions}>
                          <Tooltip title={"Used By"} placement="top" arrow>
                            <IconButton
                              className={c.inIcon}
                              title="Used By"
                              aria-label="used by"
                              onClick={() => {
                                dispatch(
                                  setModal({
                                    name: "layersUsedByStacCollection",
                                    stacCollection: row,
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

                          <Tooltip title={"Info"} placement="top" arrow>
                            <IconButton
                              className={c.previewIcon}
                              title="Info"
                              aria-label="info"
                              onClick={() => {
                                dispatch(
                                  setModal({
                                    name: "stacCollectionJson",
                                    collection: row,
                                  })
                                );
                              }}
                            >
                              <InfoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title={"Items"} placement="top" arrow>
                            <IconButton
                              className={c.previewIcon}
                              title="Items"
                              aria-label="items"
                              onClick={() => {
                                dispatch(
                                  setModal({
                                    name: "stacCollectionItems",
                                    stacCollection: row,
                                  })
                                );
                              }}
                            >
                              <WidgetsIcon fontSize="small" />
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
                                    name: "deleteStacCollection",
                                    stacCollection: row,
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
            count={filteredCollections.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      </Box>
      <NewStacCollectionModal querySTAC={querySTAC} />
      <DeleteStacCollectionModal querySTAC={querySTAC} />
      <LayersUsedByModal />
      <StacCollectionItemsModal />
      <StacCollectionJsonModal />
    </>
  );
}
