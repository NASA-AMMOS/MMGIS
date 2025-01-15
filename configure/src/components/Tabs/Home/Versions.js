import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../../core/calls";
import { downloadObject } from "../../../core/utils";
import {
  setSnackBarText,
  setModal,
  setConfiguration,
  clearLockConfig,
} from "../../../core/ConfigureStore";

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
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import { visuallyHidden } from "@mui/utils";

import PreviewIcon from "@mui/icons-material/Preview";
import DownloadIcon from "@mui/icons-material/Download";
import LowPriorityIcon from "@mui/icons-material/LowPriority";

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
  Versions: { width: "100%", height: "100%" },
  VersionsInner: {
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
    width: "100% !important",
    boxShadow: "0px 1px 7px 0px rgba(0, 0, 0, 0.2)",
  },
  flex: {
    display: "flex",
    "& > svg": {
      margin: "3px 10px 0px 2px",
    },
  },
  actions: {
    display: "flex",
    justifyContent: "right",
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
  setIcon: {
    marginLeft: "4px !important",
    width: "40px !important",
    height: "40px !important",
    transform: "rotateZ(180deg)",
  },
  th: {
    fontWeight: "bold !important",
    textTransform: "uppercase",
    letterSpacing: "1px !important",
    color: `${theme.palette.accent.main} !important`,
    backgroundColor: `${theme.palette.swatches.grey[1000]} !important`,
    borderRight: `1px solid ${theme.palette.swatches.grey[900]}`,
  },
  bottomBar: {
    background: theme.palette.swatches.grey[1000],
  },
  versionCell: {
    display: "flex",
  },
  current: {
    background: theme.palette.swatches.p[11],
    borderRadius: "3px",
    color: theme.palette.swatches.grey[1000],
    margin: "0px 6px",
    padding: "2px 6px",
    fontSize: "12px",
    textTransform: "uppercase",
    lineHeight: "18px",
  },
}));

const headCells = [
  {
    id: "version",
    label: "Version",
  },
  {
    id: "createdAt",
    label: "Date",
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

export default function Versions(props) {
  const { queryVersions } = props;
  const [order, setOrder] = React.useState("desc");
  const [orderBy, setOrderBy] = React.useState("version");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);

  const c = useStyles();

  const dispatch = useDispatch();
  const mission = useSelector((state) => state.core.mission);
  const versions = useSelector((state) => state.home.versions);

  useEffect(() => {
    queryVersions();
  }, [mission]);

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
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - versions.length) : 0;

  const visibleRows = React.useMemo(
    () =>
      stableSort(versions, getComparator(order, orderBy)).slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      ),
    [order, orderBy, page, rowsPerPage, versions]
  );

  return (
    <>
      <Box className={c.Versions}>
        <Paper className={c.VersionsInner}>
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
                rowCount={versions.length}
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
                      <TableCell align="left">
                        <div className={c.versionCell}>
                          <div>{`v${row.version}`}</div>
                          {row.current ? (
                            <div className={c.current}>current</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell align="right">
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleString()
                          : row.createdAt}
                      </TableCell>
                      <TableCell align="right">
                        <div className={c.actions}>
                          <Tooltip title={"Preview"} placement="top" arrow>
                            <IconButton
                              className={c.previewIcon}
                              title="Preview"
                              aria-label="preview"
                              onClick={() => {
                                if (row.version)
                                  calls.api(
                                    "get",
                                    {
                                      mission: row.mission,
                                      version: row.version,
                                      id: window.configId,
                                    },
                                    (res) => {
                                      dispatch(
                                        setModal({
                                          name: "preview",
                                          customConfig: res,
                                          version: row.version,
                                        })
                                      );
                                    },
                                    (res) => {
                                      dispatch(
                                        setSnackBarText({
                                          text: "Failed to download Configuration JSON.",
                                          severity: "error",
                                        })
                                      );
                                    }
                                  );
                              }}
                            >
                              <PreviewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={"Download"} placement="top" arrow>
                            <IconButton
                              className={c.downloadIcon}
                              title="Download"
                              aria-label="download"
                              onClick={() => {
                                if (row.version)
                                  calls.api(
                                    "get",
                                    {
                                      mission: row.mission,
                                      version: row.version,
                                      id: window.configId,
                                    },
                                    (res) => {
                                      downloadObject(
                                        res,
                                        `${row.mission}_v${row.version}_config`,
                                        ".json"
                                      );
                                      dispatch(
                                        setSnackBarText({
                                          text: "Successfully downloaded Configuration JSON.",
                                          severity: "success",
                                        })
                                      );
                                    },
                                    (res) => {
                                      dispatch(
                                        setSnackBarText({
                                          text: "Failed to download Configuration JSON.",
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

                          <Tooltip title={"Set"} placement="top" arrow>
                            <IconButton
                              className={c.setIcon}
                              title="Set"
                              aria-label="set"
                              onClick={() => {
                                if (row.version)
                                  calls.api(
                                    "upsert",
                                    {
                                      mission: row.mission,
                                      version: row.version,
                                      id: window.configId,
                                    },
                                    (res) => {
                                      dispatch(
                                        setSnackBarText({
                                          text: "Successfully set Configuration JSON to this version.",
                                          severity: "success",
                                        })
                                      );
                                      queryVersions();
                                      if (res.status === "success")
                                        if (mission != null)
                                          calls.api(
                                            "get",
                                            { mission: mission },
                                            (res) => {
                                              dispatch(setConfiguration(res));
                                              dispatch(clearLockConfig({}));
                                            },
                                            (res) => {
                                              dispatch(
                                                setSnackBarText({
                                                  text:
                                                    res?.message ||
                                                    "Failed to get configuration for mission.",
                                                  severity: "error",
                                                })
                                              );
                                            }
                                          );
                                    },
                                    (res) => {
                                      dispatch(
                                        setSnackBarText({
                                          text: "Failed to set Configuration JSON to this version.",
                                          severity: "error",
                                        })
                                      );
                                    }
                                  );
                              }}
                            >
                              <LowPriorityIcon fontSize="small" />
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
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={versions.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      </Box>
    </>
  );
}
