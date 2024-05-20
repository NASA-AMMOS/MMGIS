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
import Switch from "@mui/material/Switch";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import IconButton from "@mui/material/IconButton";

import AddIcon from "@mui/icons-material/Add";

import { calls } from "./calls";
import { setConfiguration, setSnackBarText } from "./ConfigureStore";
import {
  getIn,
  setIn,
  traverseLayers,
  getToolFromConfiguration,
  updateToolInConfiguration,
} from "./utils";

import Map from "../components/Map/Map";
import ColorButton from "../components/ColorButton/ColorButton";
import MDEditor from "@uiw/react-md-editor";

const useStyles = makeStyles((theme) => ({
  Maker: {
    width: "100%",
    background: theme.palette.swatches.grey[1000],
  },
  tabs: {
    background: theme.palette.secondary.main,
    "& button": {
      color: theme.palette.swatches.grey[700],
    },
    "& button.Mui-selected": {
      color: theme.palette.swatches.grey[1000],
      background: theme.palette.swatches.grey[200],
    },
    "& .MuiTabs-indicator": {
      backgroundColor: theme.palette.swatches.p[0],
      height: "3px",
    },
    "& .MuiTabScrollButton-root": {
      color: theme.palette.swatches.grey[1000],
    },
  },
  contentTabs: {
    height: "calc(100% - 48px)",
    overflowY: "auto",
    "& .rowTitle:first-child": {
      marginTop: "20px !important",
    },
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
    fontWeight: "bold",
  },
  rowDescription: {
    fontSize: "14px",
    fontStyle: "italic",
    width: "calc(100% - 120px)",
    color: theme.palette.swatches.grey[400],
    margin: "5px 60px 0px 60px",
  },
  rowSubTitle: {
    borderBottom: `1px solid ${theme.palette.swatches.grey[850]}`,
    margin: "40px 60px 0px 60px",
    paddingBottom: "5px",
    fontSize: "12px",
    letterSpacing: "1px",
    color: theme.palette.swatches.p[12],
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  rowTitle2: {
    lineHeight: "48px",
    paddingLeft: "10px",
    color: theme.palette.swatches.p[11],
    letterSpacing: "1px",
  },
  rowTitle3: {
    paddingLeft: "24px",
    color: theme.palette.swatches.grey[200],
    marginBottom: "16px",
    fontStyle: "italic",
    fontSize: "14px",
  },
  rowTitleBasic: {
    margin: "40px 20px 0px 20px",
  },
  subtitle2: {
    fontSize: "12px !important",
    fontStyle: "italic",
    width: "100%",
    marginBottom: "8px !important",
    color: theme.palette.swatches.grey[400],
  },
  text: {
    width: "100%",
  },
  textArrayHexes: {
    display: "flex",
  },
  textArrayHex: {
    width: "20px",
    height: "20px",
    margin: "4px",
    borderRadius: "4px",
  },
  dropdown: {
    width: "100%",
  },
  checkbox: {
    paddingTop: "4px",
  },
  switch: {
    paddingTop: "4px",
    marginRight: "8px",
    "& .MuiSwitch-switchBase": {
      color: theme.palette.swatches.grey[700],
    },
    "& .MuiSwitch-switchBase.Mui-checked": {
      color: theme.palette.accent.main,
    },
    "& .MuiSwitch-track": {
      backgroundColor: `${theme.palette.swatches.grey[700]} !important`,
    },
  },
  keyvalue: {
    display: "flex",
    justifyContent: "space-between",
    "& > div:first-child": { width: "25%", marginRight: "8px" },
    "& > div:last-child": { flex: 1 },
  },
  objectArrayBox: {
    display: "flex",
    margin: "0px 10px 10px 10px",
    background: theme.palette.swatches.grey[1000],
    padding: "10px",
    boxShadow: "0px 2px 2px 0px rgba(0, 0, 0, 0.1)",
  },
  object: {
    border: `2px solid ${theme.palette.swatches.grey[900]}`,
    borderLeft: `2px solid ${theme.palette.swatches.grey[200]}`,
    background: theme.palette.swatches.grey[850],
  },
  map: {},
  noMargin: {
    margin: 0,
  },
  objectAdd: {
    width: "40px",
    height: "40px",
    padding: "4px",
  },
}));

const getComponent = (
  com,
  configuration,
  layer,
  tool,
  updateConfiguration,
  c,
  inlineHelp,
  value,
  forceField
) => {
  const directConf = layer == null ? configuration : layer;
  let inner;
  switch (com.type) {
    case "text":
      inner = (
        <TextField
          className={c.text}
          label={com.name}
          variant="filled"
          size="small"
          value={value != null ? value : getIn(directConf, com.field, "")}
          onChange={(e) => {
            updateConfiguration(forceField || com.field, e.target.value, layer);
          }}
        />
      );
      return (
        <div>
          {inlineHelp ? (
            <>
              {inner}
              <Typography className={c.subtitle2}>
                {com.description || ""}
              </Typography>
            </>
          ) : (
            <Tooltip title={com.description || ""} placement="top" arrow>
              {inner}
            </Tooltip>
          )}
        </div>
      );
    case "textarray":
      let text_array_f = getIn(directConf, com.field, []);
      if (text_array_f != null && typeof text_array_f.join === "function")
        text_array_f = text_array_f.join(",");
      inner = (
        <TextField
          className={c.text}
          label={com.name}
          variant="filled"
          size="small"
          value={text_array_f}
          onChange={(e) => {
            updateConfiguration(com.field, e.target.value.split(","), layer);
          }}
        />
      );
      return (
        <div>
          {inlineHelp ? (
            <>
              {inner}
              <div className={c.textArrayHexes}>
                {typeof text_array_f === "string"
                  ? (text_array_f.match(/(#(?:[0-9a-f]{3}){1,2})/gi) || []).map(
                      (hex) => {
                        return (
                          <div
                            className={c.textArrayHex}
                            style={{ background: hex }}
                          ></div>
                        );
                      }
                    )
                  : null}
              </div>
              <Typography className={c.subtitle2}>
                {com.description || ""}
              </Typography>
            </>
          ) : (
            <Tooltip title={com.description || ""} placement="top" arrow>
              {inner}
            </Tooltip>
          )}
        </div>
      );
    case "markdown":
      let markdown_f = value || getIn(directConf, com.field, "");
      return (
        <div className="container">
          <MDEditor
            value={markdown_f}
            onChange={(val) => {
              updateConfiguration(forceField || com.field, val, layer);
            }}
            height={700}
          />
        </div>
      );
    case "number":
      inner = (
        <TextField
          className={c.text}
          label={com.name}
          variant="filled"
          size="small"
          value={value || getIn(directConf, com.field, "")}
          onChange={(e) => {
            updateConfiguration(forceField || com.field, e.target.value, layer);
          }}
          type="number"
          min={com.min != null ? com.min : 0}
          step={com.step != null ? com.step : 1}
          max={com.max != null ? com.max : Infinity}
        />
      );
      return (
        <div>
          {inlineHelp ? (
            <>
              {inner}
              <Typography className={c.subtitle2}>
                {com.description || ""}
              </Typography>
            </>
          ) : (
            <Tooltip title={com.description || ""} placement="top" arrow>
              {inner}
            </Tooltip>
          )}
        </div>
      );
    case "checkbox":
      inner = (
        <FormGroup className={c.checkbox}>
          <FormControlLabel
            control={
              <Checkbox
                checked={
                  value || getIn(directConf, com.field, com.defaultChecked)
                }
                onChange={(e) => {
                  updateConfiguration(
                    forceField || com.field,
                    e.target.checked,
                    layer
                  );
                }}
              />
            }
            label={com.name}
          />
        </FormGroup>
      );
      return (
        <div>
          {inlineHelp ? (
            <>
              {inner}
              <Typography className={c.subtitle2}>
                {com.description || ""}
              </Typography>
            </>
          ) : (
            <Tooltip title={com.description || ""} placement="top" arrow>
              {inner}
            </Tooltip>
          )}
        </div>
      );
    case "switch":
      inner = (
        <FormGroup className={c.switch}>
          <FormControlLabel
            control={
              <Switch
                checked={
                  value || getIn(directConf, com.field, com.defaultChecked)
                }
                onChange={(e) => {
                  updateConfiguration(
                    forceField || com.field,
                    e.target.checked,
                    layer
                  );
                }}
              />
            }
            label={com.name}
          />
        </FormGroup>
      );
      return (
        <div>
          {inlineHelp ? (
            <>
              {inner}
              <Typography className={c.subtitle2}>
                {com.description || ""}
              </Typography>
            </>
          ) : (
            <Tooltip title={com.description || ""} placement="top" arrow>
              {inner}
            </Tooltip>
          )}
        </div>
      );
    case "dropdown":
      inner = (
        <FormControl className={c.dropdown} variant="filled" size="small">
          <InputLabel>{com.name}</InputLabel>
          <Select
            value={value || getIn(directConf, com.field, com.options?.[0])}
            onChange={(e) => {
              updateConfiguration(
                forceField || com.field,
                e.target.value,
                layer
              );
            }}
          >
            {com.options.map((o) => {
              return <MenuItem value={o}>{o.toUpperCase()}</MenuItem>;
            })}
          </Select>
        </FormControl>
      );
      return (
        <div>
          {inlineHelp ? (
            <>
              {inner}
              <Typography className={c.subtitle2}>
                {com.description || ""}
              </Typography>
            </>
          ) : (
            <Tooltip title={com.description || ""} placement="top" arrow>
              {inner}
            </Tooltip>
          )}
        </div>
      );
    case "colorpicker":
      let color;
      if (tool) color = getIn(tool, com.field.split("."), { hex: "#000000" });
      else if (layer)
        color = getIn(layer, com.field.split("."), { hex: "#000000" });
      else color = getIn(directConf, com.field.split("."), { hex: "#000000" });

      inner = (
        <ColorButton
          label={com.name}
          color={value || color}
          onChange={(color) => {
            if (color) {
              let colorStr = color.hex;
              if (color.rgb?.a !== 1) {
                colorStr = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;
              }
              updateConfiguration(forceField || com.field, colorStr, layer);
            }
          }}
        />
      );
      return (
        <div>
          {inlineHelp ? (
            <>
              {inner}
              <Typography className={c.subtitle2}>
                {com.description || ""}
              </Typography>
            </>
          ) : (
            <Tooltip title={com.description || ""} placement="top" arrow>
              {inner}
            </Tooltip>
          )}
        </div>
      );
    case "objectarray":
      const section = [];
      let items;
      if (tool) items = getIn(tool, com.field.split("."), []);
      else if (layer) items = getIn(layer, com.field.split("."), []);
      else items = getIn(configuration, com.field.split("."), []);
      if (typeof items.push !== "function") items = [];

      items.forEach((item, idx) => {
        section.push(
          <Box
            sx={{ flexGrow: 1 }}
            className={clsx(c.row, c.objectArrayBox)}
            key={idx}
          >
            <Grid
              container
              spacing={4}
              direction="row"
              justifyContent="left"
              alignItems="left"
            >
              {com.object.map((icom, idx2) => {
                return (
                  <Grid
                    item
                    xs={icom.width || 4}
                    md={icom.width || 4}
                    lg={icom.width || 4}
                    xl={icom.width || 4}
                    key={`${idx}-${idx2}`}
                  >
                    {tool != null
                      ? getComponent(
                          icom,
                          configuration,
                          layer,
                          tool,
                          updateConfiguration,
                          c,
                          inlineHelp,
                          item[icom.field],
                          `${com.field}.${idx}.${icom.field}`
                        )
                      : getComponent(
                          icom,
                          configuration,
                          layer,
                          tool,
                          updateConfiguration,
                          c,
                          inlineHelp,
                          item[icom.field],
                          `${com.field}.${idx}.${icom.field}`
                        )}
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        );
      });
      return (
        <div className={clsx(c.object)}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div className={c.rowTitle2}>{com.name}</div>
              <div className={c.rowTitle3}>{com.description}</div>
            </div>
            <div className={c.objectAdd}>
              <IconButton
                aria-label="add"
                onClick={() => {
                  if (tool) {
                    const t = getToolFromConfiguration(
                      tool.name,
                      configuration
                    );
                    let next = getIn(t, com.field.split("."), []);
                    next = JSON.parse(JSON.stringify(next));
                    if (typeof next.push !== "function") next = [];
                    let nextObj = {};
                    com.object.forEach((obj) => {
                      nextObj[obj.field] = null;
                    });
                    next.push(nextObj);

                    updateConfiguration(com.field, next, configuration);
                  } else {
                    let next = getIn(configuration, com.field.split("."), []);
                    next = JSON.parse(JSON.stringify(next));
                    if (typeof next.push !== "function") next = [];
                    let nextObj = {};
                    com.object.forEach((obj) => {
                      nextObj[obj.field] = null;
                    });
                    next.push(nextObj);

                    updateConfiguration(com.field, next, layer);
                  }
                }}
              >
                <AddIcon />
              </IconButton>
            </div>
          </div>
          {section}
        </div>
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

const makeConfigTabs = (tabs, value, onChange, c) => {
  if (tabs) {
    return (
      <Tabs
        className={c.tabs}
        value={value}
        onChange={(e, v) => {
          onChange(v);
        }}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="scrollable auto tabs example"
      >
        {tabs.map((tab) => (
          <Tab label={tab.name} />
        ))}
      </Tabs>
    );
  }
};

const makeConfig = (
  updateConfiguration,
  config,
  configuration,
  layer,
  tool,
  c,
  shadowed,
  inlineHelp
) => {
  const made = [];

  if (config == null || config.rows == null) return made;

  config.rows.forEach((row, idx) => {
    if (row.name) {
      made.push(
        <div
          className={clsx(c.rowTitle, "rowTitle", {
            [c.rowTitleBasic]: !shadowed,
          })}
          key={`${idx}_title`}
        >
          {row.name}
        </div>
      );
      if (row.description) {
        made.push(
          <div className={clsx(c.rowDescription)} key={`${idx}_desc`}>
            {row.description}
          </div>
        );
      }
    }
    if (row.subname) {
      made.push(
        <div
          className={clsx(c.rowSubTitle, { [c.rowTitleBasic]: !shadowed })}
          key={`${idx}_title`}
        >
          {row.subname}
        </div>
      );
      if (row.subdescription) {
        made.push(
          <div className={clsx(c.rowDescription)} key={`${idx}_desc`}>
            {row.subdescription}
          </div>
        );
      }
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
                    tool,
                    updateConfiguration,
                    c,
                    inlineHelp
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
  const { config, layer, toolName, shadowed, inlineHelp } = props;
  const c = useStyles();

  const dispatch = useDispatch();

  const [tabValue, setTabValue] = useState(0);

  const configuration = useSelector((state) => state.core.configuration);

  let tool = null;
  if (toolName) tool = getToolFromConfiguration(toolName, configuration);

  const updateConfiguration = (keyPath, value, layer) => {
    const nextConfiguration = JSON.parse(JSON.stringify(configuration));

    if (tool != null) {
      updateToolInConfiguration(
        tool.name,
        nextConfiguration,
        keyPath.split("."),
        value
      );
    } else if (layer != null) {
      traverseLayers(nextConfiguration.layers, (l, path, index) => {
        if (layer.uuid === l.uuid) {
          setIn(l, keyPath.split("."), value);
        }
      });
    } else {
      setIn(nextConfiguration, keyPath.split("."), value);
    }
    dispatch(setConfiguration(nextConfiguration));
  };

  return (
    <div
      className={clsx(c.Maker, { [c.shadowed]: shadowed })}
      style={{ height: config.tabs ? "100%" : "unset" }}
    >
      {config.tabs
        ? makeConfigTabs(config.tabs, tabValue, setTabValue, c)
        : null}
      <div className={clsx({ [c.contentTabs]: config.tabs })}>
        {makeConfig(
          updateConfiguration,
          config.tabs ? config.tabs[tabValue] : config,
          configuration,
          layer,
          tool,
          c,
          shadowed,
          inlineHelp
        )}
      </div>
    </div>
  );
}
