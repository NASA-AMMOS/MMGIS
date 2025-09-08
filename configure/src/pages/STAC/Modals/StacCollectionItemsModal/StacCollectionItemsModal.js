import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

import { calls } from "../../../../core/calls";

import { setModal, setSnackBarText } from "../../../../core/ConfigureStore";

import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import TablePagination from "@mui/material/TablePagination";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import Tooltip from "@mui/material/Tooltip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import WidgetsIcon from "@mui/icons-material/Widgets";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SearchIcon from "@mui/icons-material/Search";
import InfoIcon from "@mui/icons-material/Info";

import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import * as L from "leaflet";

// components
import SpatialFilterMap from "./components/SpatialFilterMap";
import JsonViewModal from "./components/JsonViewModal";
import DeleteItemModal from "./components/DeleteItemModal";
import BulkDeleteModal from "./components/BulkDeleteModal";
import ItemsTable from "./components/ItemsTable";

import "leaflet/dist/leaflet.css";

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
    height: "80vh",
    width: "90vw",
    maxWidth: "1600px",
    minWidth: "1000px",
  },
  heading: {
    height: theme.headHeights[2],
    boxSizing: "border-box",
    background: theme.palette.swatches.p[0],
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
    height: `calc(100% - ${theme.headHeights[2]}px)`,
    display: "flex",
    flexDirection: "column",
  },
  mainRow: {
    gap: "12px",
    height: "100%",
    overflow: "hidden",
    '& > div:first-child': {
      padding: "16px 16px 0px 16px"
    }
  },
  leftPanel: {
    flex: "0 0 30%",
    minWidth: "370px",
    display: "flex",
    flexDirection: "column",
  },
  rightPanel: {
    flex: "1 1 0",
    minWidth: "520px",
    display: "flex",
    flexDirection: "column",
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
  searchContainer: {
    marginBottom: "16px",
  },
  // removed searchRow/searchField (unused)
  searchInput: {flex:1, marginLeft: "40px !important"},
  // removed filtersRow/dateField (unused)
  bulkActionsRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginTop: "8px",
    paddingLeft: "8px",
    paddingRight: "8px",
    flexWrap: "wrap",
    justifyContent: "space-between",
    '& div:first-child > button': {
      marginRight: "8px",
    }
  },
  selectionSummary: {
    color: theme.palette.swatches.grey[200],
    fontSize: "14px",
  },
  datePicker: {
    width: 225,
  },
  regexTooltip: {
    backgroundColor: `${theme.palette.swatches.grey[100]} !important`,
    color: `${theme.palette.swatches.grey[800]} !important`,
    fontSize: "14px !important",
    lineHeight: 1.5,
    maxWidth: 480,
    border: `1px solid ${theme.palette.swatches.grey[800]}`,
    padding: "8px 10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
  },
  regexTooltipContent: {
    whiteSpace: "pre-line",
    fontSize: "14px",
    '& code': {
      background: theme.palette.swatches.grey[200],
      color: theme.palette.swatches.grey[800],
      padding: '1px 4px',
      borderRadius: 3,
    },
  },
  regexTooltip: {
    background: `${theme.palette.swatches.grey[200]} !important`,
    color: `${theme.palette.swatches.grey[800]} !important`,
    fontSize: "14px !important",
    lineHeight: 1.5,
    maxWidth: 480,
    border: `1px solid ${theme.palette.swatches.grey[100]}`,
    padding: "8px 10px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
  },
  regexTooltipContent: {
    whiteSpace: "pre-line",
    fontSize: "14px",
    '& code': {
      background: `${theme.palette.swatches.grey[300]} !important`,
      color: `${theme.palette.swatches.grey[900]} !important`,
      padding: '1px 4px',
      borderRadius: 3,
    },
  },
  tableContainer: {
    flex: 1,
    overflowY: "auto",
    boxShadow: "0px 1px 7px 0px rgba(0, 0, 0, 0.2)",
  },
  table: {
    "& .MuiTableHead-root": {
      "& .MuiTableCell-root": {
        backgroundColor: `${theme.palette.swatches.grey[1000]} !important`,
        color: `${theme.palette.swatches.grey[0]} !important`,
        fontWeight: "bold !important",
        textTransform: "uppercase",
        letterSpacing: "1px !important",
        borderRight: `1px solid ${theme.palette.swatches.grey[900]}`,
      },
    },
    "& .MuiTableBody-root": {
      "& .MuiTableRow-root": {
        background: theme.palette.swatches.grey[850],
        "&:hover": {
          background: theme.palette.swatches.grey[900],
        },
      },
      "& .MuiTableCell-root": {
        borderRight: `1px solid ${theme.palette.swatches.grey[800]}`,
        borderBottom: `1px solid ${theme.palette.swatches.grey[700]} !important`,
        color: theme.palette.swatches.grey[100],
      },
    },
    "& td:first-child": {
        fontWeight: "bold",
        letterSpacing: "1px",
        fontSize: "16px",
        color: `${theme.palette.swatches.p[13]}`,
    },
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "200px",
  },
  noItems: {
    textAlign: "center",
    padding: "40px",
    color: theme.palette.swatches.grey[400],
    fontStyle: "italic",
  },
  deleteIcon: {
    width: "40px !important",
    height: "40px !important",
    marginLeft: "4px !important",
    "&:hover": {
      background: "#c43541 !important",
      color: `${theme.palette.swatches.grey[900]} !important`,
    },
  },
  infoIcon: {
    width: "40px !important",
    height: "40px !important",
    marginRight: "4px !important",
  },
  collectionTitle: {
    fontSize: "18px !important",
    color: theme.palette.swatches.grey[100],
    fontWeight: "bold !important",
    marginBottom: "8px !important",
  },
  limitMessage: {
    fontSize: "14px !important",
    color: theme.palette.swatches.grey[400],
    fontStyle: "italic",
    marginBottom: "16px !important",
  },
  itemId: {
    fontFamily: "monospace",
    fontSize: "12px",
  },
  pagination: {
    borderTop: `1px solid ${theme.palette.swatches.grey[700]}`,
    background: theme.palette.swatches.grey[850],
  },
  jsonDialog: {
    "& .MuiDialog-paper": {
      maxWidth: "90vw",
      maxHeight: "85vh",
      width: "1800px",
      height: "1000px",
      background: theme.palette.primary.main,
    },
  },
  deleteDialog: {
    "& .MuiDialog-paper": {
      background: theme.palette.swatches.grey[900],
      width: "500px",
    },
  },
  deleteDialogTitle: {
    background: theme.palette.swatches.p[4],
    padding: `4px ${theme.spacing(2)} 4px ${theme.spacing(4)} !important`,
  },
  deleteDialogContent: {
    padding: "16px !important",
  },
  deleteItemName: {
    textAlign: "center",
    fontSize: "20px !important",
    letterSpacing: "1px !important",
    color: theme.palette.swatches.p[4],
    fontWeight: "bold !important",
    borderBottom: `1px solid ${theme.palette.swatches.grey[100]}`,
    paddingBottom: "10px",
    fontFamily: "monospace",
  },
  deleteConfirmInput: {
    width: "100%",
    margin: "16px 0px 8px 0px !important",
    borderTop: `1px solid ${theme.palette.swatches.grey[500]}`,
  },
  deleteConfirmMessage: {
    fontStyle: "italic",
    fontSize: "15px !important",
    color: theme.palette.swatches.grey[300],
  },
  deleteDialogActions: {
    display: "flex !important",
    justifyContent: "space-between !important",
    padding: "16px 24px !important",
  },
    deleteButton: {
      background: `${theme.palette.swatches.p[4]} !important`,
      color: `${theme.palette.swatches.grey[1000]} !important`,
      "&:hover": {
        background: `${theme.palette.swatches.grey[0]} !important`,
      },
    },
}));

const MODAL_NAME = "stacCollectionItems";

const StacCollectionItemsModal = () => {
  const c = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("xl"));
  const dispatch = useDispatch();

  const modal = useSelector((state) => state.core.modal[MODAL_NAME]);

  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [selectedItemJson, setSelectedItemJson] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  // JSON view handled in JsonViewModal
  const [bboxBounds, setBboxBounds] = useState(null); // {minLat, minLng, maxLat, maxLng}
  

    const fetchAllItems = (searchQuery = "") => {
    if (!modal?.stacCollection?.id) return;
    
    const body = {
        urlReplacements: {
          collection: modal.stacCollection.id,
        },
        limit: 10000,
        offset: 0
       }
     // Only use server-side filter for simple substring searches without regex/date/bbox filters
     const hasClientOnlyFiltering =
       useRegex ||
       (dateFrom && dateFrom.length > 0) ||
       (dateTo && dateTo.length > 0) ||
       (bboxBounds != null);
     const filter = !hasClientOnlyFiltering && searchQuery && searchQuery.trim()
       ? `id LIKE '%${searchQuery.trim()}%'`
       : null;
     if (filter !== null) body.filter = filter;

    setLoading(true);
    calls.api(
      "stac_collection_items",
      body,
      (res) => {
        if (res?.features) {
          setAllItems(res.features);
        } else {
          setAllItems([]);
        }
        setLoading(false);
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to fetch STAC items.",
            severity: "error",
          })
        );
        setAllItems([]);
        setLoading(false);
      }
    );
  };

  // Apply client-side filters (regex and date range)
  const applyClientFilters = (items) => {
    let out = items;
    // Client-side regex or case-insensitive id filter when needed
    if (searchTerm && searchTerm.trim().length > 0) {
      if (useRegex) {
        try {
          const re = new RegExp(searchTerm.trim());
          out = out.filter((it) => re.test(it.id));
        } catch (e) {
          dispatch(
            setSnackBarText({
              text: `Invalid regex: ${e?.message || "Error"}`,
              severity: "error",
            })
          );
        }
      } else if (!useRegex && (dateFrom || dateTo)) {
        // If server-side filter not used due to date filters, do substring here (case-insensitive)
        const needle = searchTerm.trim().toLowerCase();
        out = out.filter((it) => (it.id || "").toLowerCase().includes(needle));
      }
    }

    // Date range filter (inclusive)
    if (dateFrom || dateTo) {
      const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
      const toTs = dateTo ? new Date(dateTo).getTime() : null;
      out = out.filter((it) => {
        const d = it?.properties?.datetime ? new Date(it.properties.datetime).getTime() : null;
        if (d == null || Number.isNaN(d)) return false; // exclude items without valid datetime when filtering
        if (fromTs != null && d < fromTs) return false;
        if (toTs != null && d > toTs) return false;
        return true;
      });
    }

    // Spatial bbox filter
    out = out.filter((it) => intersectsBbox(it));

    return out;
  };

  // Keep filteredItems in sync
  useEffect(() => {
    if (!useRegex && !dateFrom && !dateTo && !bboxBounds) {
      // When no client-only filters, server already applied substring filter; pass through
      setFilteredItems(allItems);
    } else {
      setFilteredItems(applyClientFilters(allItems));
    }
    // Reset pagination when filters change materially
    setPage(0);
  }, [allItems, useRegex, dateFrom, dateTo, bboxBounds]);

  // Local pagination: get items for current page
  const getCurrentPageItems = () => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredItems.slice(startIndex, endIndex);
  };

  const items = getCurrentPageItems();
  const totalItems = filteredItems.length;

  useEffect(() => {
    if (modal && modal.stacCollection) {
      setSearchTerm("");
      setPage(0);
      fetchAllItems("");
    }
  }, [modal]);

  const handleClose = () => {
    dispatch(setModal({ name: MODAL_NAME, on: false }));
    setAllItems([]);
    setSearchTerm("");
    setPage(0);
    // Also close JSON modal if it's open
    setJsonModalOpen(false);
    setSelectedItemJson(null);
    // Also close delete modal if it's open
    setDeleteModalOpen(false);
    setItemToDelete(null);
    setDeleteConfirmation("");
    // Reset filters and selection
    setUseRegex(false);
    setDateFrom("");
    setDateTo("");
    setFilteredItems([]);
    setSelectedItemIds(new Set());
    setBulkDeleteModalOpen(false);
    setBulkDeleteConfirmation("");
    setBulkDeleting(false);
  };

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    setPage(0);
    // Re-query when not using regex/date; otherwise fetch without filter (to 10000) and filter client-side
    if (!useRegex && !dateFrom && !dateTo) fetchAllItems(value);
    else fetchAllItems("");
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

  // Spatial filter helpers
  const computeItemBounds = (item) => {
    // Prefer STAC bbox if present
    if (item?.bbox && item.bbox.length >= 4) {
      const [minLon, minLat, maxLon, maxLat] = item.bbox;
      return { minX: minLon, minY: minLat, maxX: maxLon, maxY: maxLat };
    }
    // Fallback: compute from geometry if possible
    try {
      const geom = item?.geometry;
      if (!geom) return null;
      const coords = Array.isArray(geom.coordinates) ? geom.coordinates.flat(Infinity) : [];
      if (!coords || coords.length < 2) return null;
      const lons = coords.filter((_, i) => i % 2 === 0);
      const lats = coords.filter((_, i) => i % 2 === 1);
      if (lons.length === 0 || lats.length === 0) return null;
      return {
        minX: Math.min(...lons),
        minY: Math.min(...lats),
        maxX: Math.max(...lons),
        maxY: Math.max(...lats),
      };
    } catch {
      return null;
    }
  };

  const intersectsBbox = (item) => {
    if (!bboxBounds) return true;
    const a = computeItemBounds(item);
    if (!a) return true; // if we cannot determine, do not filter it out
    const bMinX = bboxBounds.minLng, bMinY = bboxBounds.minLat, bMaxX = bboxBounds.maxLng, bMaxY = bboxBounds.maxLat;
    const noOverlap = a.maxX < bMinX || a.minX > bMaxX || a.maxY < bMinY || a.minY > bMaxY;
    return !noOverlap;
  };

  // Spatial map actions are encapsulated within SpatialFilterMap component

  // Selection helpers
  const isItemSelected = (id) => selectedItemIds.has(id);
  const toggleSelectItem = (id) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllOnPage = (checked) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      items.forEach((it) => {
        if (checked) next.add(it.id);
        else next.delete(it.id);
      });
      return next;
    });
  };
  const selectAllInResults = () => {
    setSelectedItemIds(new Set(filteredItems.map((it) => it.id)));
  };
  const clearSelection = () => setSelectedItemIds(new Set());

  const allOnPageSelected = items.length > 0 && items.every((it) => selectedItemIds.has(it.id));
  const someOnPageSelected = items.some((it) => selectedItemIds.has(it.id)) && !allOnPageSelected;

  const handleDeleteItem = (itemId) => {
    if (!modal?.stacCollection?.id || !itemId) return;
    
    setItemToDelete(itemId);
    setDeleteModalOpen(true);
    setDeleteConfirmation("");
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false);
    setItemToDelete(null);
    setDeleteConfirmation("");
  };

  const handleConfirmDelete = () => {
    if (!modal?.stacCollection?.id || !itemToDelete) {
      dispatch(
        setSnackBarText({
          text: "Cannot delete undefined STAC Item.",
          severity: "error",
        })
      );
      return;
    }

    if (deleteConfirmation !== itemToDelete) {
      dispatch(
        setSnackBarText({
          text: "Confirmation item ID does not match.",
          severity: "error",
        })
      );
      return;
    }

    calls.api(
      "stac_delete_item",
      {
        urlReplacements: {
          collection: modal.stacCollection.id,
          item: itemToDelete,
        },
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: `Successfully deleted item '${itemToDelete}'.`,
            severity: "success",
          })
        );
        handleCloseDeleteModal();
        // Refresh all items after deletion
        if (!useRegex && !dateFrom && !dateTo) fetchAllItems(searchTerm);
        else fetchAllItems("");
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || `Failed to delete item '${itemToDelete}'.`,
            severity: "error",
          })
        );
      }
    );
  };

  const handleViewJson = (item) => {
    setSelectedItemJson(item);
    setJsonModalOpen(true);
  };

  // Bulk delete
  const openBulkDeleteModal = () => {
    if (selectedItemIds.size === 0) return;
    setBulkDeleteConfirmation("");
    setBulkDeleteModalOpen(true);
  };
  const closeBulkDeleteModal = () => {
    if (bulkDeleting) return;
    setBulkDeleteModalOpen(false);
    setBulkDeleteConfirmation("");
  };
  const deleteItemPromise = (itemId) =>
    new Promise((resolve) => {
      calls.api(
        "stac_delete_item",
        {
          urlReplacements: {
            collection: modal.stacCollection.id,
            item: itemId,
          },
        },
        () => resolve({ id: itemId, ok: true }),
        (err) => resolve({ id: itemId, ok: false, message: err?.message })
      );
    });
  const handleConfirmBulkDelete = async () => {
    if (!modal?.stacCollection?.id) {
      dispatch(
        setSnackBarText({ text: "No collection selected.", severity: "error" })
      );
      return;
    }
    if (bulkDeleteConfirmation !== modal.stacCollection.id) {
      dispatch(
        setSnackBarText({
          text: "Confirmation collection ID does not match.",
          severity: "error",
        })
      );
      return;
    }
    const ids = Array.from(selectedItemIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.all(ids.map((id) => deleteItemPromise(id)));
      const success = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      if (success > 0) {
        dispatch(
          setSnackBarText({
            text: `Deleted ${success} item(s).` ,
            severity: "success",
          })
        );
      }
      if (failed.length > 0) {
        const failedIds = failed.map((f) => f.id).slice(0, 5).join(", ");
        dispatch(
          setSnackBarText({
            text: `Failed to delete ${failed.length} item(s). ${failedIds ? "Examples: " + failedIds : ""}`,
            severity: "error",
          })
        );
      }
    } finally {
      setBulkDeleting(false);
      setSelectedItemIds(new Set());
      setBulkDeleteModalOpen(false);
      // Refresh items
      if (!useRegex && !dateFrom && !dateTo) fetchAllItems(searchTerm);
      else fetchAllItems("");
    }
  };

  const handleCloseJsonModal = () => {
    setJsonModalOpen(false);
    setSelectedItemJson(null);
  };


  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return "N/A";
    try {
      return new Date(dateTimeStr).toLocaleString();
    } catch {
      return dateTimeStr;
    }
  };

  const getAssetsHref = (item) => {
    if (!item?.assets) return "N/A";
    
    // Look for the first asset with an href
    const assetKeys = Object.keys(item.assets);
    for (const key of assetKeys) {
      if (item.assets[key]?.href) {
        return item.assets[key].href;
      }
    }
    
    return "N/A";
  };

  // Clear bbox handler (spatial map is self-contained; clearing via state)
  const handleClearBbox = () => {
    setBboxBounds(null);
  };

  return (
    <Dialog
      className={c.Modal}
      open={modal !== false}
      onClose={handleClose}
      aria-labelledby="stac-items-dialog-title"
      PaperProps={{
        className: c.contents,
      }}
      maxWidth={false}
    >
      <DialogTitle className={c.heading}>
        <div className={c.flexBetween}>
          <div className={c.flexBetween}>
            <WidgetsIcon className={c.backgroundIcon} />
            <div className={c.title}>STAC Collection Items</div>
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
        <div className={c.mainRow}>
          
        <div className={c.flexBetween}>
          <div>
            <Typography className={c.collectionTitle}>
              Collection: {modal?.stacCollection?.id}
            </Typography>
            <Typography className={c.limitMessage}>
              {isMobile ? 'Showing at most 10000 items.' : 'Showing at most 10000 items. Use search to narrow results if needed.'}
            </Typography>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
            <TextField
              size="small"
              label="Search Items"
              variant="filled"
              value={searchTerm}
              className={c.searchInput}
              onChange={handleSearchChange}
              placeholder={useRegex ? "Regex over Item ID" : "Search by Item ID"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Tooltip
              arrow
              placement="bottom"
              classes={{ tooltip: c.regexTooltip }}
              title={
                <div className={c.regexTooltipContent}>
                  <div>Use JavaScript regular expressions:</div>
                  <div>- Wildcard: <code>.*</code> (not <code>*</code>)</div>
                  <div>- Any single char: <code>.</code></div>
                  <div>- Anchors: <code>^</code> start, <code>$</code> end</div>
                  <div>- Digits/word: <code>\\d+</code>, <code>\\w+</code></div>
                  <div>- Character set: <code>[A-Za-z_]+</code></div>
                  <div>- Either/or: <code>(cat|dog)</code></div>
                  <div>- Escape dot: <code>\\.</code></div>
                  <div style={{ marginTop: 6 }}>Example: <code>^IMG_.*_2024\\.tif$</code></div>
                </div>
              }
            >
              <FormControlLabel
                control={
                  <Checkbox
                    color="primary"
                    checked={useRegex}
                    onChange={(e) => {
                      setUseRegex(e.target.checked);
                      if (e.target.checked || dateFrom || dateTo) fetchAllItems("");
                      else fetchAllItems(searchTerm);
                    }}
                  />
                }
                label="Regex"
              />
            </Tooltip>
            <TextField
              size="small"
              label="From"
              type="datetime-local"
              value={dateFrom}
              className={c.datePicker}
              onChange={(e) => {
                setDateFrom(e.target.value);
                fetchAllItems("");
              }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              label="To"
              type="datetime-local"
              value={dateTo}
              className={c.datePicker}
              onChange={(e) => {
                setDateTo(e.target.value);
                fetchAllItems("");
              }}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="outlined" size="small" onClick={() => {
              setUseRegex(false);
              setDateFrom("");
              setDateTo("");
              setSearchTerm("");
              handleClearBbox();
              setPage(0);
              fetchAllItems("");
            }}>Clear Filters</Button>
        </div>
        </div>
        <div className={c.flexBetween} style={{ height: "calc(100% - 88px)" }}>
          {/* Left map panel */}
          <div className={c.leftPanel}>
            <SpatialFilterMap
              classes={c}
              collectionId={modal?.stacCollection?.id}
              collection={modal?.stacCollection}
              items={allItems}
              dateFrom={dateFrom}
              dateTo={dateTo}
              bboxBounds={bboxBounds}
              onBboxChange={(b) => setBboxBounds(b)}
              onBboxClear={handleClearBbox}
            />
          </div>

          {/* Right controls and table */}
          <div className={c.rightPanel}>
            <div className={c.searchContainer}>
              <div className={c.bulkActionsRow}>
                <div>
                  <Button
                    variant="outlined"
                    onClick={selectAllInResults}
                    disabled={filteredItems.length === 0}
                  >{`Select All Results (${filteredItems.length})`}</Button>
                  <Button variant="outlined" onClick={clearSelection} disabled={selectedItemIds.size === 0}>Clear Selection</Button>
                
                  <span className={c.selectionSummary}>
                    {selectedItemIds.size > 0 ? `${selectedItemIds.size} selected` : ""}
                  </span>
                </div>
                <div>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<DeleteForeverIcon size="small" />}
                    onClick={openBulkDeleteModal}
                    disabled={selectedItemIds.size === 0}
                  >{`Bulk Delete (${selectedItemIds.size})`}</Button>
                </div>
              </div>
            </div>

            <ItemsTable
              classes={c}
              loading={loading}
              items={items}
              isItemSelected={isItemSelected}
              toggleSelectItem={toggleSelectItem}
              allOnPageSelected={allOnPageSelected}
              someOnPageSelected={someOnPageSelected}
              selectAllOnPage={selectAllOnPage}
              formatDateTime={formatDateTime}
              getAssetsHref={getAssetsHref}
              onViewJson={handleViewJson}
              onDeleteItem={handleDeleteItem}
              noItemsText={searchTerm ? `No items found matching "${searchTerm}"` : "No items found in this collection"}
            />

            <TablePagination
              className={c.pagination}
              component="div"
              count={totalItems}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </div>
        </div>
      </div>
    </DialogContent>

      {/* JSON View Modal */}
      <JsonViewModal
        classes={c}
        open={jsonModalOpen}
        onClose={handleCloseJsonModal}
        item={selectedItemJson}
      />

      {/* Delete Item Confirmation Modal */}
      <DeleteItemModal
        classes={c}
        open={deleteModalOpen}
        itemId={itemToDelete}
        collectionId={modal?.stacCollection?.id}
        confirmation={deleteConfirmation}
        setConfirmation={setDeleteConfirmation}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
      />

      {/* Bulk Delete Confirmation Modal */}
      <BulkDeleteModal
        classes={c}
        open={bulkDeleteModalOpen}
        collectionId={modal?.stacCollection?.id}
        selectedCount={selectedItemIds.size}
        confirmation={bulkDeleteConfirmation}
        setConfirmation={setBulkDeleteConfirmation}
        onClose={closeBulkDeleteModal}
        onConfirm={handleConfirmBulkDelete}
        disabled={bulkDeleting}
      />
    </Dialog>
  );
};

export default StacCollectionItemsModal; 