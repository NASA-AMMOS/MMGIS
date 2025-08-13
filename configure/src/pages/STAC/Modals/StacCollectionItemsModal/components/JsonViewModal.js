import React, { useEffect, useRef, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import InfoIcon from "@mui/icons-material/Info";
import CloseSharpIcon from "@mui/icons-material/CloseSharp";
import ReactJson from "react-json-view";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { makeStyles } from "@mui/styles";

const useStyles = makeStyles((theme) => ({
  heading: {},
  jsonDialog: {},
  jsonContent: {
    padding: "0px !important",
    height: "100%",
    overflow: "hidden",
    background: theme.palette?.swatches?.grey?.[150] || "#eee",
    display: "flex",
  },
  mapPanel: {
    width: "50%",
    height: "100%",
  },
  jsonPanel: {
    width: "50%",
    height: "100%",
  },
  jsonContainer: {
    background: theme.palette?.swatches?.grey?.[150] || "#eee",
    padding: 16,
    boxSizing: "border-box",
    height: "100%",
    overflow: "auto",
  },
  jsonDialogActions: {
    background: theme.palette?.swatches?.grey?.[200] || "#ddd",
    padding: "16px 24px !important",
  },
  jsonDialogActionsClose: {
    borderColor: `${theme.palette?.swatches?.grey?.[800]} !important`,
    color: `${theme.palette?.swatches?.grey?.[800]} !important`,
    '&:hover': {
      borderColor: `${theme.palette?.swatches?.grey?.[900]} !important`,
      color: `${theme.palette?.swatches?.grey?.[900]} !important`,
    },
  },
  backgroundIcon: {},
  flexBetween: { display: "flex", justifyContent: "space-between" },
  closeIcon: {},
  title: {},
}));

export default function JsonViewModal({ classes, open, onClose, item }) {
  const local = useStyles();
  const mapRef = useRef(null);
  const coordRef = useRef(null);
  const [map, setMap] = useState(null);
  const [mapLayers, setMapLayers] = useState({ bbox: null, raster: null });

  // Initialize map when modal opens
  useEffect(() => {
    if (!open || map) return;
    
    const initializeMap = () => {
      console.log("Attempting to initialize map, mapRef.current:", mapRef.current);
      if (!mapRef.current) {
        console.log("mapRef.current is still null, retrying...");
        setTimeout(initializeMap, 100);
        return;
      }
      
      try {
        const leaflet = window.L || L;
        if (!leaflet) {
          console.error("Leaflet not available");
          return;
        }
        
        console.log("Creating map instance");
        const newMap = leaflet.map(mapRef.current, {
          center: [0, 0],
          zoom: 2,
          zoomControl: true,
          attributionControl: true,
        });
        
        leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(newMap);
        
        newMap.on('mousemove', (e) => {
          const { lat, lng } = e.latlng;
          if (coordRef.current) {
            coordRef.current.textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
            coordRef.current.style.display = 'block';
          }
        });
        
        newMap.on('mouseout', () => {
          if (coordRef.current) coordRef.current.style.display = 'none';
        });
        
        console.log("Map created successfully");
        setMap(newMap);
      } catch (err) {
        console.error('Failed to initialize map:', err);
      }
    };

    // Small delay to ensure DOM is ready, then retry if needed
    setTimeout(initializeMap, 100);
  }, [open, map]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!open && map) {
      map.remove();
      setMap(null);
      setMapLayers({ bbox: null, raster: null });
    }
  }, [open, map]);

  useEffect(() => {
    if (map && item) addItemToMap(map, item);
  }, [map, item]);

  const addItemToMap = (mapInstance, item) => {
    try {
      const leaflet = window.L || L;
      if (!leaflet) return;
      // Clear existing layers
      if (mapLayers.bbox) mapInstance.removeLayer(mapLayers.bbox);
      if (mapLayers.raster) mapInstance.removeLayer(mapLayers.raster);
      let bounds = null;
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
      // Add raster from assets if available
      if (item.assets) {
        const cogAsset = findCogAsset(item.assets);
        if (cogAsset && cogAsset.href) addRasterLayer(mapInstance, cogAsset.href, cogAsset);
      }
      if (bounds) {
        mapInstance.fitBounds(bounds, { padding: [20, 20] });
      } else if (item.geometry && item.geometry.coordinates) {
        const coords = item.geometry.coordinates;
        if (coords.length > 0) {
          const flat = coords.flat().flat();
          const lons = flat.filter((_, i) => i % 2 === 0);
          const lats = flat.filter((_, i) => i % 2 === 1);
          const minLon = Math.min(...lons);
          const maxLon = Math.max(...lons);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          mapInstance.fitBounds([[minLat, minLon], [maxLat, maxLon]], { padding: [20, 20] });
        }
      }
    } catch {}
  };

  const findCogAsset = (assets) => {
    const assetKeys = Object.keys(assets);
    const cogKeys = ['data', 'cog', 'image', 'tif', 'tiff'];
    for (const key of cogKeys) {
      if (assets[key] && assets[key].href) return assets[key];
    }
    for (const key of assetKeys) {
      if (assets[key] && assets[key].href && (assets[key].href.includes('.tif') || assets[key].href.includes('.cog'))) {
        return assets[key];
      }
    }
    return null;
  };

  const addRasterLayer = (mapInstance, cogUrl, cogAsset) => {
    try {
      const leaflet = window.L || L;
      if (!leaflet) return;
      let domain = window.mmgisglobal.NODE_ENV === "development" ? "http://localhost:8888/" : window.mmgisglobal.ROOT_PATH || "";
      if (domain.length > 0 && !domain.endsWith("/")) domain += "/";
      let titilerUrl = `${domain}titiler/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?url=${encodeURIComponent(cogUrl)}`;
      if (cogAsset && cogAsset['raster:bands'] && cogAsset['raster:bands'][0]) {
        const firstBand = cogAsset['raster:bands'][0];
        if (firstBand.data_type === 'float32' && firstBand.statistics) {
          const stats = firstBand.statistics;
          if (stats.minimum !== undefined && stats.maximum !== undefined) {
            titilerUrl += `&rescale=${stats.minimum},${stats.maximum}&colormap_name=viridis`;
          }
        }
      }
      const rasterLayer = leaflet.tileLayer(titilerUrl, { attribution: 'COG via TiTiler', opacity: 0.8, maxZoom: 18 }).addTo(mapInstance);
      setMapLayers(prev => ({ ...prev, raster: rasterLayer }));
    } catch {}
  };

  const handleClose = () => {
    onClose && onClose();
  };

  return (
    <Dialog className={classes.jsonDialog} open={open} onClose={handleClose} aria-labelledby="json-dialog-title" maxWidth={false}>
      <DialogTitle className={classes.heading}>
        <div className={classes.flexBetween}>
          <div className={classes.flexBetween}>
            <InfoIcon className={classes.backgroundIcon} />
            <div className={classes.title}>STAC Item: {item?.id}</div>
          </div>
          <IconButton className={classes.closeIcon} title="Close" aria-label="close" onClick={onClose}>
            <CloseSharpIcon fontSize="inherit" />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent className={local.jsonContent}>
        <div className={local.mapPanel}>
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
          <div ref={coordRef} style={{ position: 'absolute', left: 0, bottom: '63px', display: 'none', padding: '6px 10px', zIndex: 1000, fontSize: 12, background: '#555', color: '#fff', fontFamily: 'monospace' }}>
            Lat: 0.000000, Lng: 0.000000
          </div>
        </div>
        <div className={local.jsonPanel}>
          <div className={local.jsonContainer}>
            {item && (
              <ReactJson
                src={item}
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
                style={{ backgroundColor: "transparent", fontSize: "14px" }}
              />
            )}
          </div>
        </div>
      </DialogContent>
      <DialogActions className={local.jsonDialogActions}>
        <Button className={local.jsonDialogActionsClose} onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

