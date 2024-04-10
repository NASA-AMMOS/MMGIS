import React, { useEffect, useState } from "react";
import * as L from "leaflet";

import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  Map: {
    width: "100%",
    height: "100%",
    background: theme.palette.swatches.grey.grey800,
    position: "relative",
  },
  mapContainer: {
    width: "100%",
    height: "100%",
  },
}));

const Map = ({ image, settings, features, onLayers }) => {
  const [map, setMap] = useState(null);
  const [openFailed, setOpenFailed] = useState(false);
  const [svgOverlay, setSvgOverlay] = useState(null);

  const c = useStyles();

  settings = settings || {};

  const InitMap = () => {
    map && map.destroy();
    const map = L.map("map");
  };
  // Make viewer
  useEffect(() => {
    InitMap();
    return () => {
      map && map.destroy();
    };
  }, []);

  // Update image when changed
  useEffect(() => {
    if (image && image.src && viewer) {
      setOpenFailed(false);
      viewer.removeHandler("open");
      viewer.addHandler("open", function (e) {
        const so = viewer.svgOverlay();
        setSvgOverlay(so);
        drawFeatures(so, features);
      });
      viewer.open({
        type: "image",
        url: image.src,
        buildPyramid: false,
      });
    }
  }, [image.src, viewer]);

  useEffect(() => {
    if (viewer && svgOverlay) {
      drawFeatures(viewer.svgOverlay(), features);
    }
  }, [features]);

  useEffect(() => {
    // Make all the canvases pixelated
    if (viewer && viewer.canvas && viewer.canvas.childNodes) {
      viewer.canvas.childNodes.forEach((canvas) => {
        if (typeof canvas.getContext === "function") {
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = false;
        }
      });
    }
    // Set open failed event
    if (viewer) {
      viewer.addHandler("open-failed", () => {
        setOpenFailed(true);
      });
    }
  }, [viewer]);

  return (
    <div className={c.Map}>
      <div id="map" className={c.mapContainer}></div>
    </div>
  );
};

Map.propTypes = {};

export default Map;
