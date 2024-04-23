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

import { calls } from "./calls";
import { setConfiguration, setSnackBarText } from "./ConfigureStore";
import { getIn, setIn, traverseLayers } from "./utils";

import Map from "../components/Map/Map";
import ColorButton from "../components/ColorButton/ColorButton";

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
  map: {},
}));

const getComponent = (com, configuration, layer, updateConfiguration, c) => {
  const directConf = layer == null ? configuration : layer;
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
              value={getIn(directConf, com.field, "")}
              onChange={(e) => {
                updateConfiguration(com.field, e.target.value, layer);
              }}
            />
          </Tooltip>
        </div>
      );
    case "textarray":
      let text_array_f = getIn(directConf, com.field, []);
      if (text_array_f != null && typeof text_array_f.join === "function")
        text_array_f.join(",");
      return (
        <div>
          <Tooltip title={com.description || ""} placement="top" arrow>
            <TextField
              className={c.text}
              label={com.name}
              variant="filled"
              size="small"
              value={text_array_f}
              onChange={(e) => {
                updateConfiguration(
                  com.field,
                  e.target.value.split(","),
                  layer
                );
              }}
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
              value={getIn(directConf, com.field, "")}
              onChange={(e) => {
                updateConfiguration(com.field, e.target.value, layer);
              }}
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
                  <Checkbox
                    checked={getIn(directConf, com.field, com.defaultChecked)}
                    onChange={(e) => {
                      updateConfiguration(com.field, e.target.checked, layer);
                    }}
                  />
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
              <Select
                value={getIn(directConf, com.field, com.options?.[0])}
                onChange={(e) => {
                  updateConfiguration(com.field, e.target.value, layer);
                }}
              >
                {com.options.map((o) => {
                  return <MenuItem value={o}>{o.toUpperCase()}</MenuItem>;
                })}
              </Select>
            </FormControl>
          </Tooltip>
        </div>
      );
    case "colorpicker":
      return (
        <ColorButton
          label={com.name}
          color={getIn(directConf, com.field, null)}
          onChange={(color) => {
            updateConfiguration(com.field, color.hex, layer);
          }}
        />
      );
    case "map":
      return (
        <div className={c.map} style={{ height: com.height || "200px" }}>
          <Map layer={layer} configuration={configuration} />
        </div>
      );
    default:
      return null;
  }
};

const makeConfig = (
  updateConfiguration,
  config,
  configuration,
  layer,
  c,
  shadowed
) => {
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
            style={row.forceHeight ? { height: row.forceHeight } : null}
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
                  {getComponent(
                    com,
                    configuration,
                    layer,
                    updateConfiguration,
                    c
                  )}
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
  const { config, layer, shadowed } = props;
  const c = useStyles();

  const dispatch = useDispatch();

  const configuration = useSelector((state) => state.core.configuration);

  const updateConfiguration = (keyPath, value, layer) => {
    const nextConfiguration = JSON.parse(JSON.stringify(configuration));

    if (layer == null) {
      setIn(nextConfiguration, keyPath.split("."), value);
    } else {
      traverseLayers(nextConfiguration.layers, (l, path, index) => {
        if (layer.uuid === l.uuid) {
          setIn(l, keyPath.split("."), value);
        }
      });
    }
    dispatch(setConfiguration(nextConfiguration));
  };

  return (
    <div className={clsx(c.Maker, { [c.shadowed]: shadowed })}>
      {makeConfig(
        updateConfiguration,
        config,
        configuration,
        layer,
        c,
        shadowed
      )}
    </div>
  );
}
