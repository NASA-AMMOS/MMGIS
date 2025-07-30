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
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import InputAdornment from "@mui/material/InputAdornment";
import Divider from "@mui/material/Divider";

import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import WidgetsIcon from "@mui/icons-material/Widgets";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SearchIcon from "@mui/icons-material/Search";
import InfoIcon from "@mui/icons-material/Info";

import { makeStyles, useTheme } from "@mui/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import ReactJson from "react-json-view";
import * as L from "leaflet";

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
    padding: "16px !important",
    height: `calc(100% - ${theme.headHeights[2]}px)`,
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
  jsonContent: {
    padding: "0px !important",
    height: "100%",
    overflow: "hidden",
    background: theme.palette.swatches.grey[150],
    display: "flex",
  },
  mapPanel: {
    width: "50%",
    height: "100%",
    background: theme.palette.swatches.grey[900],
    borderRight: `1px solid ${theme.palette.swatches.grey[700]}`,
  },
  mapContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
    "& .leaflet-container": {
      background: theme.palette.swatches.grey[900],
    },
  },
  coordinateDisplay: {
    left: "0px",
    color: "white",
    bottom: "62px",
    display: "none",
    padding: "6px 10px",
    zIndex: "1000",
    position: "absolute",
    fontSize: "12px",
    background: theme.palette.swatches.grey[300],
    fontFamily: "monospace",
    pointerEvents: "none",
  },
  jsonPanel: {
    width: "50%",
    height: "100%",
  },
  jsonContainer: {
    background: theme.palette.swatches.grey[150],
    padding: "16px",
    boxSizing: "border-box",
    height: "100%",
    overflow: "auto",
  },
  jsonDialogActions: {
    background: theme.palette.swatches.grey[200],
    padding: "16px 24px !important",
  },
  jsonDialogActionsClose: {
    color: `${theme.palette.swatches.grey[800]} !important`,
    border: `1px solid ${theme.palette.swatches.grey[800]} !important`,
    '&:hover': {
      background: `${theme.palette.swatches.grey[900]} !important`,
      color: `${theme.palette.swatches.grey[0]} !important`,
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
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
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
  
  // Map related state
  const mapRef = useRef(null);
  const coordinateDisplayRef = useRef(null);
  const [map, setMap] = useState(null);
  const [mapLayers, setMapLayers] = useState({ bbox: null, raster: null });

    const fetchAllItems = (searchQuery = "") => {
    if (!modal?.stacCollection?.id) return;
    
    const body = {
        urlReplacements: {
          collection: modal.stacCollection.id,
        },
        limit: 500,
        offset: 0
       }
     const filter = searchQuery && searchQuery.trim() ? `id LIKE '%${searchQuery.trim()}%'` : null
     if (filter !== null) {
         body.filter = filter
     }

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

  // Local pagination: get items for current page
  const getCurrentPageItems = () => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return allItems.slice(startIndex, endIndex);
  };

  const items = getCurrentPageItems();
  const totalItems = allItems.length;

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
  };

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    setPage(0);
    fetchAllItems(value);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

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
        fetchAllItems(searchTerm);
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
    
    // Initialize map when modal opens
    setTimeout(() => {
      initializeMap(item);
    }, 100);
  };

  const handleCloseJsonModal = () => {
    setJsonModalOpen(false);
    setSelectedItemJson(null);
    
    // Clean up map
    if (map) {
      map.remove();
      setMap(null);
      setMapLayers({ bbox: null, raster: null });
    }
  };

  const initializeMap = (item) => {
    if (!mapRef.current || map) return;

    try {
      // Ensure Leaflet is available
      const leaflet = window.L || L;
      if (!leaflet) {
        console.error('Leaflet not available');
        return;
      }

      // Create map with OSM base layer
      const newMap = leaflet.map(mapRef.current, {
        center: [0, 0],
        zoom: 2,
        zoomControl: true,
        attributionControl: true,
      });

      // Add OSM tile layer
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(newMap);

      // Add coordinate tracking on mouse move - direct DOM update for performance
      newMap.on('mousemove', (e) => {
        const { lat, lng } = e.latlng;
        if (coordinateDisplayRef.current) {
          coordinateDisplayRef.current.textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
          coordinateDisplayRef.current.style.display = 'block';
        }
      });

      // Hide coordinates when mouse leaves the map
      newMap.on('mouseout', () => {
        if (coordinateDisplayRef.current) {
          coordinateDisplayRef.current.style.display = 'none';
        }
      });

      setMap(newMap);
      
      // Add item data to map
      if (item) {
        addItemToMap(newMap, item);
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const addItemToMap = (mapInstance, item) => {
    try {
      const leaflet = window.L || L;
      if (!leaflet) return;

      // Clear existing layers
      if (mapLayers.bbox) {
        mapInstance.removeLayer(mapLayers.bbox);
      }
      if (mapLayers.raster) {
        mapInstance.removeLayer(mapLayers.raster);
      }

      let bounds = null;

      // Add bounding box if available
      if (item.bbox && item.bbox.length >= 4) {
        const [minLon, minLat, maxLon, maxLat] = item.bbox;
        bounds = [[minLat, minLon], [maxLat, maxLon]];
        
        const bboxLayer = leaflet.rectangle(bounds, {
          color: '#ff7800',
          weight: 2,
          opacity: 1,
          fillColor: '#ff7800',
          fillOpacity: 0.1,
        }).addTo(mapInstance);
        
        setMapLayers(prev => ({ ...prev, bbox: bboxLayer }));
      }

      // Add raster layer from assets if available
      if (item.assets) {
        const cogAsset = findCogAsset(item.assets);
        if (cogAsset && cogAsset.href) {
          addRasterLayer(mapInstance, cogAsset.href, cogAsset);
        }
      }

      // Fit map to bounds
      if (bounds) {
        mapInstance.fitBounds(bounds, { padding: [20, 20] });
      } else if (item.geometry && item.geometry.coordinates) {
        // Fallback to geometry if no bbox
        const coords = item.geometry.coordinates;
        if (coords.length > 0) {
          const flatCoords = coords.flat().flat();
          const lons = flatCoords.filter((_, i) => i % 2 === 0);
          const lats = flatCoords.filter((_, i) => i % 2 === 1);
          const minLon = Math.min(...lons);
          const maxLon = Math.max(...lons);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          bounds = [[minLat, minLon], [maxLat, maxLon]];
          mapInstance.fitBounds(bounds, { padding: [20, 20] });
        }
      }
    } catch (error) {
      console.error('Error adding item to map:', error);
    }
  };

  const findCogAsset = (assets) => {
    // Look for COG/TIF assets
    const assetKeys = Object.keys(assets);
    
    // Common COG asset names
    const cogKeys = ['data', 'cog', 'image', 'tif', 'tiff'];
    
    for (const key of cogKeys) {
      if (assets[key] && assets[key].href) {
        return assets[key];
      }
    }
    
    // Fallback to first asset with href
    for (const key of assetKeys) {
      if (assets[key] && assets[key].href && 
          (assets[key].href.includes('.tif') || assets[key].href.includes('.cog'))) {
        return assets[key];
      }
    }
    
    return null;
  };

  const addRasterLayer = (mapInstance, cogUrl, cogAsset) => {
    try {
      const leaflet = window.L || L;
      if (!leaflet) return;

      let domain =
        window.mmgisglobal.NODE_ENV === "development"
          ? "http://localhost:8888/"
          : window.mmgisglobal.ROOT_PATH || "";
      if (domain.length > 0 && !domain.endsWith("/")) domain += "/";

      // Start building the titiler URL
      let titilerUrl = `${domain}titiler/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=${encodeURIComponent(cogUrl)}`;
      
      // Check if this is 32-bit float data that needs rescaling
      console.log('COG Asset:', cogAsset);
      if (cogAsset && cogAsset['raster:bands'] && cogAsset['raster:bands'][0]) {
        const firstBand = cogAsset['raster:bands'][0];
        console.log('Raster band info:', firstBand);
        
        if (firstBand.data_type === 'float32' && firstBand.statistics) {
          const stats = firstBand.statistics;
          if (stats.minimum !== undefined && stats.maximum !== undefined) {
            // Add rescaling and colormap for 32-bit float data
            console.log(`Adding rescale for float32 data: ${stats.minimum}-${stats.maximum}`);
            titilerUrl += `&rescale=${stats.minimum},${stats.maximum}&colormap_name=viridis`;
          }
        }
      }
      
      const rasterLayer = leaflet.tileLayer(titilerUrl, {
        attribution: 'COG via TiTiler',
        opacity: 0.8,
        maxZoom: 18,
      }).addTo(mapInstance);
      
      setMapLayers(prev => ({ ...prev, raster: rasterLayer }));
    } catch (error) {
      console.error('Error adding raster layer:', error);
    }
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

  return (
    <Dialog
      className={c.Modal}
      fullScreen={isMobile}
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
        <Typography className={c.collectionTitle}>
          Collection: {modal?.stacCollection?.id}
        </Typography>
        <Typography className={c.limitMessage}>
          Showing at most 500 items. Use search to narrow results if needed.
        </Typography>

        <div className={c.searchContainer}>
          <TextField
            fullWidth
            label="Search Items"
            variant="filled"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by Item ID"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </div>

        <TableContainer className={c.tableContainer}>
          <Table className={c.table} stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item ID</TableCell>
                <TableCell>DateTime</TableCell>
                <TableCell>Assets Href</TableCell>
                <TableCell align="center"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className={c.loadingContainer}>
                      <CircularProgress />
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className={c.noItems}>
                      {searchTerm
                        ? `No items found matching "${searchTerm}"`
                        : "No items found in this collection"}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className={c.itemId}>{item.id}</TableCell>
                    <TableCell>
                      {formatDateTime(item.properties?.datetime)}
                    </TableCell>
                    <TableCell style={{ borderRight: "none" }}>
                      <div style={{ overflow: "hidden", fontSize: "14px", fontFamily: "monospace" }}>
                        {getAssetsHref(item)}
                      </div>
                    </TableCell>
                    <TableCell align="center">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "right" }}>
                        <Tooltip title="View Item" placement="top" arrow>
                          <IconButton
                            className={c.infoIcon}
                            title="View Item"
                            aria-label="view item"
                            onClick={() => handleViewJson(item)}
                          >
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Divider orientation="vertical" flexItem />

                        <Tooltip title="Delete Item" placement="top" arrow>
                          <IconButton
                            className={c.deleteIcon}
                            title="Delete"
                            aria-label="delete"
                            onClick={() => handleDeleteItem(item.id)}
                          >
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
      </DialogContent>

      {/* JSON View Modal */}
      <Dialog
        className={c.jsonDialog}
        open={jsonModalOpen}
        onClose={handleCloseJsonModal}
        aria-labelledby="json-dialog-title"
        maxWidth={false}
      >
        <DialogTitle className={c.heading}>
          <div className={c.flexBetween}>
            <div className={c.flexBetween}>
              <InfoIcon className={c.backgroundIcon} />
              <div className={c.title}>STAC Item: {selectedItemJson?.id}</div>
            </div>
            <IconButton
              className={c.closeIcon}
              title="Close"
              aria-label="close"
              onClick={handleCloseJsonModal}
            >
              <CloseSharpIcon fontSize="inherit" />
            </IconButton>
          </div>
        </DialogTitle>
        <DialogContent className={c.jsonContent}>
          {/* Map Panel */}
          <div className={c.mapPanel}>
            <div 
              ref={mapRef}
              className={c.mapContainer}
              style={{ height: "100%", width: "100%" }}
            />
            {/* Coordinate Display */}
            <div 
              ref={coordinateDisplayRef}
              className={c.coordinateDisplay}
            >
              Lat: 0.000000, Lng: 0.000000
            </div>
          </div>
          
          {/* JSON Panel */}
          <div className={c.jsonPanel}>
            <div className={c.jsonContainer}>
              {selectedItemJson && (
                <ReactJson
                  src={selectedItemJson}
                  theme="chalk"
                  iconStyle="triangle"
                  indentWidth={4}
                  collapsed={false}
                  collapseStringsAfterLength={100}
                  displayObjectSize={false}
                  displayDataTypes={false}
                  enableClipboard={true}
                  sortKeys={false}
                  quotesOnKeys={false}
                  name="item"
                  style={{
                    backgroundColor: "transparent",
                    fontSize: "14px",
                  }}
                />
              )}
            </div>
          </div>
        </DialogContent>
        <DialogActions className={c.jsonDialogActions}>
          <Button className={c.jsonDialogActionsClose} onClick={handleCloseJsonModal} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Item Confirmation Modal */}
      <Dialog
        className={c.deleteDialog}
        open={deleteModalOpen}
        onClose={handleCloseDeleteModal}
        aria-labelledby="delete-item-dialog-title"
      >
        <DialogTitle className={c.deleteDialogTitle}>
          <div className={c.flexBetween}>
            <div className={c.flexBetween}>
              <DeleteForeverIcon className={c.backgroundIcon} />
              <div className={c.title}>Delete STAC Item</div>
            </div>
            <IconButton
              className={c.closeIcon}
              title="Close"
              aria-label="close"
              onClick={handleCloseDeleteModal}
            >
              <CloseSharpIcon fontSize="inherit" />
            </IconButton>
          </div>
        </DialogTitle>
        <DialogContent className={c.deleteDialogContent}>
          <Typography className={c.collectionTitle}>
            Collection: {modal?.stacCollection?.id}
          </Typography>
          <Typography className={c.deleteItemName}>
            {`Deleting: ${itemToDelete || ""}`}
          </Typography>
          <TextField
            className={c.deleteConfirmInput}
            label="Confirm Item ID"
            variant="filled"
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder={`Type "${itemToDelete}" to confirm`}
          />
          <Typography className={c.deleteConfirmMessage}>
            {`Enter '${itemToDelete || ""}' above and click 'Delete' to confirm the permanent deletion of this STAC item.`}
          </Typography>
        </DialogContent>
        <DialogActions className={c.deleteDialogActions}>
          <Button
            className={c.deleteButton}
            variant="contained"
            startIcon={<DeleteForeverIcon size="small" />}
            onClick={handleConfirmDelete}
          >
            Delete
          </Button>
          <Button variant="outlined" onClick={handleCloseDeleteModal}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default StacCollectionItemsModal; 