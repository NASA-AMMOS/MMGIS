import React, { useEffect, useState } from "react";
import * as L from "leaflet";

import clsx from "clsx";

import { makeStyles } from "@mui/styles";

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
    background: "#0f1010",
  },
}));

const Map = ({ configuration, layer }) => {
  const [map, setMap] = useState(null);

  const c = useStyles();

  const InitMap = () => {
    if (map && map.remove) {
      map.off();
      map.remove();
    }
    const m = L.map("map", { attributionControl: false }).setView(
      [
        parseFloat(configuration?.msv?.view?.[0] || 0),
        parseFloat(configuration?.msv?.view?.[1] || 0),
      ],
      parseFloat(configuration?.msv?.view?.[2] || 0)
    );
    L.tileLayer(layer.url, {
      maxZoom: 19,
      tms: true,
    }).addTo(m);
    setMap(m);
  };
  // Make viewer
  useEffect(() => {
    InitMap();
    return () => {
      if (map && map.remove) {
        map.off();
        map.remove();
      }
    };
  }, []);

  return (
    <div className={c.Map}>
      <div id="map" className={c.mapContainer}></div>
    </div>
  );
};

export default Map;
