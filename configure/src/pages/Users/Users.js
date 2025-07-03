/* global mmgisglobal */

import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../core/calls";
import {
  setSnackBarText,
  setUserEntries,
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
import { visuallyHidden } from "@mui/utils";

import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AddIcon from "@mui/icons-material/Add";
import AccountBoxIcon from "@mui/icons-material/AccountBox";
import LockResetIcon from "@mui/icons-material/LockReset";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

import ResetPasswordModal from "./Modals/ResetPasswordModal/ResetPasswordModal";
import DeleteUserModal from "./Modals/DeleteUserModal/DeleteUserModal";
import UpdateUserModal from "./Modals/UpdateUserModal/UpdateUserModal";
import NewUserModal from "./Modals/NewUserModal/NewUserModal";

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
  Users: { width: "100%", height: "100%" },
  UsersInner: {
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
    margin: "0px 32px 32px 32px",
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
    margin: "0px 10px 0px 10px !important",
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
  th: {
    fontWeight: "bold !important",
    textTransform: "uppercase",
    letterSpacing: "1px !important",
    backgroundColor: `${theme.palette.swatches.grey[1000]} !important`,
    borderRight: `1px solid ${theme.palette.swatches.grey[900]}`,
  },
  roleSuperAdmin: {
    background: "#db589a",
    padding: "4px 6px",
    borderRadius: "4px",
    display: "inline",
    color: "white",
  },
  roleAdmin: {
    background: theme.palette.swatches.p[0],
    padding: "4px 6px",
    borderRadius: "4px",
    display: "inline",
  },
  roleUser: {
    background: theme.palette.swatches.grey[300],
    padding: "4px 6px",
    borderRadius: "4px",
    display: "inline",
    color: "white",
  },
  authIndicator: {
    margin: "16px auto -16px 32px",
    display: "flex",
    padding: "8px 16px",
    background: theme.palette.swatches.grey[300],
    color: "white",
    letterSpacing: "1px",
    fontSize: "14px",
    borderRadius: "4px",
    height: "32px",
    boxShadow:
      "rgba(0, 0, 0, 0.2) 0px 2px 1px -1px, rgba(0, 0, 0, 0.14) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 1px 3px 0px",
    "& > div:first-child": {
      color: theme.palette.accent.main,
      fontWeight: "bold",
      paddingRight: "4px",
    },
    "& > div:nth-child(2)": {
      textTransform: "uppercase",
      paddingRight: "4px",
    },
    "& > div:last-child": {
      color: theme.palette.swatches.grey[850],
      fontSize: "13px",
      fontStyle: "italic",
      lineHeight: "17px",
    },
  },
}));

const headCells = [
  {
    id: "id",
    label: "Id",
  },
  {
    id: "username",
    label: "Username",
  },
  {
    id: "email",
    label: "Email",
  },
  {
    id: "permission",
    label: "Role",
  },
  {
    id: "createdAt",
    label: "Joined",
  },
  {
    id: "updatedAt",
    label: "Last Login/Update",
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
        <AccountBoxIcon />
        <Typography
          style={{ fontWeight: "bold", fontSize: "16px", lineHeight: "29px" }}
          variant="h6"
          component="div"
        >
          Users
        </Typography>
      </div>

      <Button
        variant="contained"
        className={c.addButton}
        endIcon={<AddIcon />}
        onClick={() => {
          dispatch(setModal({ name: "newUser" }));
        }}
      >
        New User
      </Button>
    </Toolbar>
  );
}

EnhancedTableToolbar.propTypes = {
  numSelected: PropTypes.number.isRequired,
};

export default function Users() {
  const [order, setOrder] = React.useState("desc");
  const [orderBy, setOrderBy] = React.useState("permission");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);

  const c = useStyles();

  const dispatch = useDispatch();
  const userEntries = useSelector((state) => state.core.userEntries);

  const queryUsers = () => {
    calls.api(
      "account_entries",
      {},
      (res) => {
        if (res?.body?.entries != null)
          dispatch(setUserEntries(res.body.entries));
        else
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to get User Entries.",
              severity: "error",
            })
          );
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to get Users Entries.",
            severity: "error",
          })
        );
      }
    );
  };
  useEffect(() => {
    queryUsers();
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
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - userEntries.length) : 0;

  const visibleRows = React.useMemo(
    () =>
      stableSort(userEntries, getComparator(order, orderBy)).slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      ),
    [order, orderBy, page, rowsPerPage, userEntries]
  );

  let authDescription = null;
  switch (mmgisglobal.AUTH) {
    case "off":
      authDescription =
        "- Guests are allowed access. No authentication. Users cannot sign up or log in. Tools that require log in will not work.";
      break;
    case "none":
      authDescription =
        "- Guests are allowed access. No authentication. Users can still sign up and log in from within MMGIS.";
      break;
    case "local":
      authDescription =
        "- Anyone without credentials is blocked. Either the Admin must log in, create accounts and pass out the credentials or set AUTH_LOCAL_ALLOW_SIGNUP=true so that users may sign up on their own.";
      break;
    case "csso":
      authDescription =
        "- Using an external Cloud Single Sign On (CSSO) service that's proxied in front of MMGIS for authentication.";
      break;
    default:
      break;
  }

  return (
    <>
      <Box className={c.Users}>
        <Paper className={c.UsersInner}>
          <EnhancedTableToolbar />
          {authDescription != null && (
            <div className={c.authIndicator}>
              <div>AUTH:</div>
              <div>{mmgisglobal.AUTH}</div>
              <div>{authDescription}</div>
            </div>
          )}
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
                rowCount={userEntries.length}
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
                      <TableCell align="left">{row.username}</TableCell>
                      <TableCell align="right">{row.email}</TableCell>
                      <TableCell align="right">
                        {row.permission === "111" ? (
                          row.id === 1 ? (
                            <div className={c.roleSuperAdmin}>SuperAdmin</div>
                          ) : (
                            <div className={c.roleAdmin}>Admin</div>
                          )
                        ) : (
                          <div className={c.roleUser}>User</div>
                        )}
                      </TableCell>
                      <TableCell align="right">{row.createdAt}</TableCell>
                      <TableCell align="right">{row.updatedAt}</TableCell>
                      <TableCell align="right">
                        <div className={c.actions}>
                          <Tooltip title={"Update User"} placement="top" arrow>
                            <IconButton
                              className={c.previewIcon}
                              title="Update User"
                              aria-label="update user"
                              onClick={() => {
                                dispatch(
                                  setModal({
                                    name: "updateUser",
                                    row: row,
                                  })
                                );
                              }}
                            >
                              <AdminPanelSettingsIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip
                            title={"Reset Password"}
                            placement="top"
                            arrow
                          >
                            <IconButton
                              className={c.previewIcon}
                              title="Reset Password"
                              aria-label="reset password"
                              onClick={() => {
                                dispatch(
                                  setModal({
                                    name: "resetPassword",
                                    row: row,
                                  })
                                );
                              }}
                            >
                              <LockResetIcon fontSize="small" />
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
                                    name: "deleteUser",
                                    row: row,
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
            count={userEntries.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      </Box>
      <ResetPasswordModal queryUsers={queryUsers} />
      <DeleteUserModal queryUsers={queryUsers} />
      <UpdateUserModal queryUsers={queryUsers} />
      <NewUserModal queryUsers={queryUsers} />
    </>
  );
}
