import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import "leaflet/dist/leaflet.css";

import clsx from "clsx";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";

import { MapContainer } from "react-leaflet/MapContainer";
import { TileLayer } from "react-leaflet/TileLayer";
import { useMap } from "react-leaflet/hooks";

import { calls } from "./calls";
import { setConfiguration, setSnackBarText } from "./ConfigureStore";

const useStyles = makeStyles((theme) => ({
  Maker: {
    width: "100%",
    height: "100%",
    background: theme.palette.swatches.grey[1000],
  },
  shadowed: {
    boxShadow: `inset 10px 0px 10px -5px rgba(0,0,0,0.3)`,
  },
  row: {
    margin: "20px 60px",
  },
  rowBasic: {
    margin: "20px 20px",
  },
  rowTitle: {
    borderBottom: `1px solid ${theme.palette.swatches.grey[800]}`,
    margin: "40px 60px 0px 60px",
    paddingBottom: "5px",
    fontSize: "20px",
    letterSpacing: "1px",
  },
  rowTitleBasic: {
    margin: "40px 20px 0px 20px",
  },
  text: {
    width: "100%",
  },
  dropdown: {
    width: "100%",
  },
  checkbox: {
    paddingTop: "4px",
  },
  map: {
    height: "200px",
  },
}));

function Map(props) {
  //const {} = props
  const [map, setMap] = useState(null);

  return (
    <MapContainer
      center={[51.505, -0.09]}
      zoom={13}
      scrollWheelZoom={true}
      whenCreated={(map) => setMap(map)}
      style={{ height: 200, width: "100%", padding: 0 }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    </MapContainer>
  );
}

const getComponent = (com, c) => {
  switch (com.type) {
    case "text":
      return (
        <div>
          <Tooltip title={com.description || ""} placement="top" arrow>
            <TextField
              className={c.text}
              label={com.name}
              variant="filled"
              size="small"
              value={""}
              onChange={(e) => {}}
            />
          </Tooltip>
        </div>
      );
    case "number":
      return (
        <div>
          <Tooltip title={com.description || ""} placement="top" arrow>
            <TextField
              className={c.text}
              label={com.name}
              variant="filled"
              size="small"
              value={0}
              type="number"
              min={com.min != null ? com.min : 0}
              step={com.step != null ? com.step : 1}
              max={com.max != null ? com.max : Infinity}
              onChange={(e) => {}}
            />
          </Tooltip>
        </div>
      );
    case "checkbox":
      return (
        <div>
          <Tooltip title={com.description || ""} placement="top" arrow>
            <FormGroup className={c.checkbox}>
              <FormControlLabel
                control={
                  <Checkbox checked={com.defaultChecked} onChange={(e) => {}} />
                }
                label={com.name}
              />
            </FormGroup>
          </Tooltip>
        </div>
      );
    case "dropdown":
      return (
        <div>
          <Tooltip title={com.description || ""} placement="top" arrow>
            <FormControl className={c.dropdown} variant="filled" size="small">
              <InputLabel>{com.name}</InputLabel>
              <Select value={com.options?.[0]} onChange={(e) => {}}>
                {com.options.map((o) => {
                  return <MenuItem value={o}>{o.toUpperCase()}</MenuItem>;
                })}
              </Select>
            </FormControl>
          </Tooltip>
        </div>
      );
    case "map":
      return (
        <div className={c.map}>
          <Map />
        </div>
      );
    default:
      return null;
  }
};

const makeConfig = (config, c, shadowed) => {
  const made = [];
  if (config.rows == null) return made;

  config.rows.forEach((row, idx) => {
    if (row.name) {
      made.push(
        <div
          className={clsx(c.rowTitle, { [c.rowTitleBasic]: !shadowed })}
          key={`${idx}_title`}
        >
          {row.name}
        </div>
      );
    }
    if (row.components) {
      made.push(
        <Box
          sx={{ flexGrow: 1 }}
          className={clsx(c.row, { [c.rowBasic]: !shadowed })}
          key={idx}
        >
          <Grid
            container
            spacing={4}
            direction="row"
            justifyContent="left"
            alignItems="left"
          >
            {row.components.map((com, idx2) => {
              return (
                <Grid
                  item
                  xs={com.width || 4}
                  md={com.width || 4}
                  lg={com.width || 4}
                  xl={com.width || 4}
                  key={`${idx}-${idx2}`}
                >
                  {getComponent(com, c)}
                </Grid>
              );
            })}
          </Grid>
        </Box>
      );
    }
  });

  return made;
};

export default function Maker(props) {
  const { config, shadowed } = props;
  const c = useStyles();

  const dispatch = useDispatch();

  return (
    <div className={clsx(c.Maker, { [c.shadowed]: shadowed })}>
      {makeConfig(config, c, shadowed)}
    </div>
  );
}
