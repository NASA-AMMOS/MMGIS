import React, { useEffect, useRef, useState } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { makeStyles, useTheme } from "@mui/styles";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import clsx from "clsx";

const useStyles = makeStyles((theme) => ({
  container: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  },
  headerOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 9999,
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  mapPanel: {
    width: "100%",
    height: "100%",
    background: theme.palette.swatches?.grey?.[900] || "#111",
    borderRight: `1px solid ${theme.palette.swatches?.grey?.[700] || "#444"}`,
    position: "relative",
    flex: 1,
    zIndex: 9,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
  },
  mapContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    "& .leaflet-container": {
      background: theme.palette.swatches?.grey?.[900] || "#111",
    },
  },
  mapContainerDrawing: {
    cursor: 'crosshair',
    "& .leaflet-container": {
      cursor: 'crosshair !important',
    },
    "& .leaflet-control-zoom": {
      cursor: 'pointer !important',
    },
  },
  coordinateDisplay: {
    left: 0,
    color: "white",
    bottom: 0,
    display: "none",
    padding: "6px 10px",
    zIndex: 1000,
    position: "absolute",
    fontSize: 12,
    background: theme.palette.swatches?.grey?.[300] || "#333",
    fontFamily: "monospace",
    pointerEvents: "none",
  },
  infoBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 12,
  },
  disabledBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 12,
  },
  drawingInstructions: {
    position: "absolute",
    bottom: 8,
    right: 8,
    background: "rgba(33, 150, 243, 0.95)",
    color: "white",
    padding: "6px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    border: "1px solid rgba(33, 150, 243, 1)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    zIndex: 1001,
    pointerEvents: "none",
    whiteSpace: "nowrap",
  },
}));

export default function SpatialFilterMap({
  collectionId,
  collection,
  items,
  dateFrom,
  dateTo,
  bboxBounds,
  onBboxChange,
  onBboxClear,
}) {
  const classes = useStyles();
  const mapRef = useRef(null);
  const coordRef = useRef(null);
  const mapInstRef = useRef(null);
  const mosaicLayerRef = useRef(null);
  const bboxLayerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const drawStateRef = useRef({ isDown: false, startLatLng: null, tempRect: null });
  const [is32BitCollection, setIs32BitCollection] = useState(false);
  const [collectionStats, setCollectionStats] = useState(null);

  // Check first item in collection to determine if it contains 32-bit rasters
  useEffect(() => {
    const checkFirst32BitItem = () => {
      if (!items || items.length === 0) {
        setIs32BitCollection(false);
        setCollectionStats(null);
        return;
      }

      const firstItem = items[0];
      
      if (!firstItem?.assets) {
        setIs32BitCollection(false);
        setCollectionStats(null);
        return;
      }

      // Use same logic as JsonViewModal to find COG asset
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

      const cogAsset = findCogAsset(firstItem.assets);
      
      if (cogAsset && cogAsset['raster:bands'] && cogAsset['raster:bands'][0]) {
        const firstBand = cogAsset['raster:bands'][0];
        if (firstBand.data_type === 'float32') {
          setIs32BitCollection(true);
          // Store statistics if available
          if (firstBand.statistics) {
            setCollectionStats(firstBand.statistics);
          }
          return;
        }
      }
      
      setIs32BitCollection(false);
      setCollectionStats(null);
    };

    checkFirst32BitItem();
  }, [items]);

  useEffect(() => {
    isDrawingRef.current = isDrawing;
    if (!isDrawing && mapInstRef.current) {
      drawStateRef.current.isDown = false;
      drawStateRef.current.startLatLng = null;
      if (drawStateRef.current.tempRect) {
        mapInstRef.current.removeLayer(drawStateRef.current.tempRect);
        drawStateRef.current.tempRect = null;
      }
      mapInstRef.current.dragging.enable();
      if (mapInstRef.current.scrollWheelZoom) mapInstRef.current.scrollWheelZoom.enable();
    }
    if (isDrawing && mapInstRef.current) {
      // While drawing, prevent accidental zooming
      if (mapInstRef.current.scrollWheelZoom) mapInstRef.current.scrollWheelZoom.disable();
    }
  }, [isDrawing]);

  useEffect(() => {
    if (!mapRef.current || mapInstRef.current) return;
    const leaflet = window.L || L;
    const map = leaflet.map(mapRef.current, {
      center: [0, 0],
      zoom: 2,
      zoomControl: true,
      attributionControl: false,
      boxZoom: false,
      dragging: true,
    });
    const osm = leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(map);

    map.on("mousemove", (e) => {
      const { lat, lng } = e.latlng;
      if (coordRef.current) {
        coordRef.current.textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
        coordRef.current.style.display = "block";
      }
    });
    map.on("mouseout", () => {
      if (coordRef.current) coordRef.current.style.display = "none";
    });

    map.on("mousedown", (e) => {
      if (!isDrawingRef.current) return;
      drawStateRef.current.isDown = true;
      drawStateRef.current.startLatLng = e.latlng;
      if (drawStateRef.current.tempRect) {
        map.removeLayer(drawStateRef.current.tempRect);
        drawStateRef.current.tempRect = null;
      }
    });
    map.on("mousemove", (e) => {
      if (!isDrawingRef.current || !drawStateRef.current.isDown || !drawStateRef.current.startLatLng) return;
      const { startLatLng } = drawStateRef.current;
      const bounds = [
        [Math.min(startLatLng.lat, e.latlng.lat), Math.min(startLatLng.lng, e.latlng.lng)],
        [Math.max(startLatLng.lat, e.latlng.lat), Math.max(startLatLng.lng, e.latlng.lng)],
      ];
      if (drawStateRef.current.tempRect) map.removeLayer(drawStateRef.current.tempRect);
      drawStateRef.current.tempRect = leaflet.rectangle(bounds, {
        color: '#ff7800',
        weight: 2,
        opacity: 1,
        fillColor: '#ff7800',
        fillOpacity: 0.1,
      }).addTo(map);
    });
    const finalize = (e) => {
      if (!isDrawingRef.current || !drawStateRef.current.isDown || !drawStateRef.current.startLatLng) return;
      const start = drawStateRef.current.startLatLng;
      const end = e?.latlng || start;
      const boundsObj = {
        minLat: Math.min(start.lat, end.lat),
        minLng: Math.min(start.lng, end.lng),
        maxLat: Math.max(start.lat, end.lat),
        maxLng: Math.max(start.lng, end.lng),
      };
      if (drawStateRef.current.tempRect) {
        map.removeLayer(drawStateRef.current.tempRect);
        drawStateRef.current.tempRect = null;
      }
      drawStateRef.current.isDown = false;
      drawStateRef.current.startLatLng = null;
      onBboxChange && onBboxChange(boundsObj);
      
      // Turn off drawing mode and re-enable map interactions after drawing is complete
      setIsDrawing(false);
      isDrawingRef.current = false;
      map.dragging.enable();
      if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
    };
    map.on("mouseup", finalize);
    map.on("mouseleave", finalize);
    map.on("dblclick", () => onBboxClear && onBboxClear());

    mapInstRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect bbox from props on the map (no auto-zoom here)
  useEffect(() => {
    const leaflet = window.L || L;
    const map = mapInstRef.current;
    if (!map || !leaflet) return;
    if (bboxLayerRef.current) {
      map.removeLayer(bboxLayerRef.current);
      bboxLayerRef.current = null;
    }
    if (bboxBounds) {
      const bounds = [
        [bboxBounds.minLat, bboxBounds.minLng],
        [bboxBounds.maxLat, bboxBounds.maxLng],
      ];
      bboxLayerRef.current = leaflet.rectangle(bounds, {
        color: '#ff7800',
        weight: 2,
        opacity: 1,
        fillColor: '#ff7800',
        fillOpacity: 0.1,
      }).addTo(map);
    }
  }, [bboxBounds]);


  // Update mosaic on relevant changes
  useEffect(() => {
    const leaflet = window.L || L;
    const map = mapInstRef.current;
    if (!map || !leaflet) return;
    if (mosaicLayerRef.current) {
      map.removeLayer(mosaicLayerRef.current);
      mosaicLayerRef.current = null;
    }
    const enabled = window?.mmgisglobal?.WITH_TITILER_PGSTAC === "true";
    if (!enabled) return;
    let domain = window.mmgisglobal.NODE_ENV === "development" ? "http://localhost:8888/" : window.mmgisglobal.ROOT_PATH || "";
    if (domain.length > 0 && !domain.endsWith("/")) domain += "/";
    const zxy = "WebMercatorQuad/{z}/{x}/{y}";
    const urlParams = new URLSearchParams();
    urlParams.set("assets", "asset");
    urlParams.set("resampling", "nearest");
    urlParams.set("exitwhenfull", "false");
    urlParams.set("skipcovered", "false");
    urlParams.set("items_limit", "1000");
    urlParams.set("scan_limit", "10000");
    urlParams.set("time_limit", "10");
    if (dateFrom || dateTo) {
      const dtFrom = dateFrom ? new Date(dateFrom).toISOString() : "";
      const dtTo = dateTo ? new Date(dateTo).toISOString() : "";
      urlParams.set("datetime", `${dtFrom}/${dtTo}`);
    }
    if (bboxBounds) {
      const { minLng, minLat, maxLng, maxLat } = bboxBounds;
      urlParams.set("bbox", `${minLng},${minLat},${maxLng},${maxLat}`);
    }
    
    // Add 32-bit raster parameters if detected
    if (is32BitCollection) {
      // Use statistics from the first item if available
      if (collectionStats && collectionStats.minimum !== undefined && collectionStats.maximum !== undefined) {
        urlParams.set("rescale", `${collectionStats.minimum},${collectionStats.maximum}`);
      } else {
        // Use default rescaling for common 32-bit data types
        urlParams.set("rescale", "-1000,8000"); // Common for elevation data
      }
      urlParams.set("colormap_name", "viridis");
    }
    
    const collectionName = collectionId || "";
    const mosaicUrl = `${domain}titilerpgstac/collections/${encodeURIComponent(collectionName)}/tiles/${zxy}?${urlParams.toString()}`;
    mosaicLayerRef.current = leaflet.tileLayer(mosaicUrl, {
      opacity: 0.8,
      maxZoom: 18,
    }).addTo(map);
  }, [collectionId, dateFrom, dateTo, bboxBounds, is32BitCollection, collectionStats]);

  return (
    <div className={classes.container}>
      <div className={clsx(classes.mapPanel, { [classes.mapContainerDrawing]: isDrawing })}>
        <div ref={mapRef} className={clsx(classes.mapContainer)} />
        <div ref={coordRef} className={classes.coordinateDisplay}>
          Lat: 0.000000, Lng: 0.000000
        </div>
        {window?.mmgisglobal?.WITH_TITILER_PGSTAC !== "true" && (
          <div className={classes.disabledBadge}>
            Mosaic overlay unavailable (WITH_TITILER_PGSTAC=false)
          </div>
        )}
        {isDrawing && (
          <div className={classes.drawingInstructions}>
            Click and drag to draw bounding box
          </div>
        )}
        <div className={classes.headerOverlay}>
          <Button
            size="small"
            variant={isDrawing ? "contained" : "outlined"}
            sx={{
              backgroundColor: isDrawing ? '#2196f3 !important' : '#f3f3f3 !important',
              color: isDrawing ? '#ffffff !important' : '#000000 !important',
              borderColor: isDrawing ? '#2196f3 !important' : '#000000 !important',
              '&:hover': {
                backgroundColor: isDrawing ? '#1976d2 !important' : '#ffffff !important',
                color: isDrawing ? '#ffffff !important' : '#000000 !important',
                borderColor: isDrawing ? '#1976d2 !important' : '#000000 !important',
              },
              '&.Mui-disabled': {
                backgroundColor: '#f3f3f3 !important',
                color: '#999999 !important',
                borderColor: '#cccccc !important',
              },
            }}
            onClick={() => {
              const next = !isDrawing;
              setIsDrawing(next);
              if (mapInstRef.current) mapInstRef.current.dragging[next ? "disable" : "enable"]();
            }}
          >
            {isDrawing ? "Drawing…" : "Draw BBox"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              // Clear bbox and exit drawing mode
              onBboxClear && onBboxClear();
              setIsDrawing(false);
              if (mapInstRef.current) {
                mapInstRef.current.dragging.enable();
                if (mapInstRef.current.scrollWheelZoom) mapInstRef.current.scrollWheelZoom.enable();
              }
            }}
            disabled={!bboxBounds}
            sx={{
              backgroundColor: '#f3f3f3 !important',
              color: '#000000 !important',
              borderColor: '#000000 !important',
              '&:hover': {
                backgroundColor: '#ffffff !important',
                color: '#000000 !important',
                borderColor: '#000000 !important',
              },
              '&.Mui-disabled': {
                backgroundColor: '#f3f3f3 !important',
                color: '#999999 !important',
                borderColor: '#cccccc !important',
              },
            }}
          >
            Clear BBox
          </Button>
        </div>
      </div>
    </div>
  );
}

