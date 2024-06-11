import React, { useEffect, useState } from "react";
import * as L from "leaflet";

import ReactJson from "react-json-view";

import { makeStyles } from "@mui/styles";

const useStyles = makeStyles((theme) => ({
  Map: {
    width: "100%",
    height: "100%",
    background: theme.palette.swatches.grey[100],
    position: "relative",
    display: "flex",
  },
  mapContainer: {
    width: "100%",
    height: "100%",
    background: "#0f1010",
  },
  left: {
    flex: 1,
    height: "100%",
  },
  right: {
    height: "100%",
    overflowY: "auto",
    background: theme.palette.swatches.grey[900],
    padding: "20px",
    boxSizing: "border-box",
  },
}));

// vector is { geojson: {}, style: {}}
const Map = ({ configuration, layer, vector, clickableFeatures }) => {
  const [map, setMap] = useState(null);
  const [feature, setFeature] = useState(null);

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
      parseFloat(configuration?.msv?.view?.[2] || 4)
    );
    try {
      L.tileLayer(
        layer?.url ? layer.url : "https://c.tile.osm.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          tms: layer?.url ? true : false,
        }
      ).addTo(m);
    } catch (err) {}

    if (vector) {
      try {
        const l = L.geoJSON(vector.geojson, {
          style: function () {
            return vector.style;
          },
          pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng);
          },
          onEachFeature(feature, layer) {
            if (clickableFeatures) {
              layer.on("click", () => {
                l.setStyle({ color: vector?.style?.color || "#08aeea" });
                layer.setStyle({ color: "red" });
                setFeature(feature);
              });
            }
          },
        }).addTo(m);
        m.fitBounds(l.getBounds());
      } catch (err) {}
    }

    setMap(m);
  };
  // Make viewer
  useEffect(() => {
    InitMap();
  }, [vector]);

  return (
    <div className={c.Map}>
      <div className={c.left}>
        <div id="map" className={c.mapContainer}></div>
      </div>
      <div
        className={c.right}
        style={{
          width: feature != null ? "500px" : "0px",
          padding: feature != null ? "20px" : "0px",
        }}
      >
        <ReactJson
          src={feature}
          theme="rjv-default"
          displayObjectSize={false}
          displayDataTypes={false}
          enableClipboard={false}
          displayArrayKey={false}
          iconStyle="triangle"
        />
      </div>
    </div>
  );
};

export default Map;
