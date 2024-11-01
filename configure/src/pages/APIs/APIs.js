import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";

import ApiIcon from "@mui/icons-material/Api";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const apiCards = {
  "MMGIS Backend API": {
    title: "MMGIS Backend API",
    subtitle: "An incomplete list of supported backend endpoints.",
    description: "",
    link: `https://nasa-ammos.github.io/MMGIS/apis/backend`,
    active: true,
  },
  "MMGIS JavaScript API": {
    title: "MMGIS JavaScript API",
    subtitle:
      "Client-side functions that can be called using the global window.mmgisAPI object.",
    description: "",
    link: `https://nasa-ammos.github.io/MMGIS/apis/javascript`,
    active: true,
  },
  "MMGIS Configure API": {
    title: "MMGIS Configure API",
    subtitle: "Enables programmatic control over configuration endpoints.",
    description: "",
    link: `https://nasa-ammos.github.io/MMGIS/apis/configure`,
    active: true,
  },
  "MMGIS GeoDatasets API": {
    title: "MMGIS GeoDatasets API",
    subtitle:
      "Enables programmatic control over GeoDataset layers. GeoDatasets are GeoJSON files uploaded and managed by MMGIS and stored in MMGIS’ Postgres/PostGIS database.",
    description: "",
    link: `https://nasa-ammos.github.io/MMGIS/apis/geodatasets`,
    active: true,
  },
  STAC: {
    title: "STAC",
    subtitle: "FastAPI implementation of the STAC API spec.",
    description: "",
    link: `${window.location.pathname
      .replace(`${window.mmgisglobal.ROOT_PATH || ""}/configure-beta`, "")
      .replace(/^\//g, "")}/stac/api.html`,
    active: window.mmgisglobal.WITH_STAC === "true",
  },
  TiTiler: {
    title: "TiTiler",
    subtitle:
      "A modern dynamic tile server built on top of FastAPI and Rasterio/GDAL.",
    description: "",
    link: `${window.location.pathname
      .replace(`${window.mmgisglobal.ROOT_PATH || ""}/configure-beta`, "")
      .replace(/^\//g, "")}/titiler/api.html`,
    active: window.mmgisglobal.WITH_TITILER === "true",
  },
  "TiTiler-PgSTAC": {
    title: "TiTIler-PgSTAC",
    subtitle:
      "TiTiler-PgSTAC is a TiTiler extension that connects to a PgSTAC database to create dynamic mosaics based on search queries.",
    description: "",
    link: `${window.location.pathname
      .replace(`${window.mmgisglobal.ROOT_PATH || ""}/configure-beta`, "")
      .replace(/^\//g, "")}/titilerpgstac/api.html`,
    active: window.mmgisglobal.WITH_TITILER_PGSTAC === "true",
  },
  TiPg: {
    title: "TiPg",
    subtitle:
      "Simple and Fast Geospatial OGC Features and Tiles API for PostGIS.",
    description: "",
    link: `${window.location.pathname
      .replace(`${window.mmgisglobal.ROOT_PATH || ""}/configure-beta`, "")
      .replace(/^\//g, "")}/tipg/api.html`,
    active: window.mmgisglobal.WITH_TIPG === "true",
  },
};

const useStyles = makeStyles((theme) => ({
  APIs: { width: "100%", height: "100%" },
  APIsInner: {
    width: "100%",
    height: "100%",
    overflowY: "auto",
    display: "flex",
    flexFlow: "column",
    backgroundImage: "url(configure/build/gridlines.png)",
  },
  topbar: {
    width: "100%",
    height: "48px",
    minHeight: "48px !important",
    display: "flex",
    justifyContent: "space-between",
    padding: `0px 20px`,
    boxSizing: `border-box !important`,
  },
  topbarTitle: {
    display: "flex",
    color: theme.palette.swatches.grey[150],
    "& > svg": {
      color: theme.palette.swatches.grey[150],
      margin: "3px 10px 0px 2px",
    },
  },
  card: {
    height: "240px",
    background: theme.palette.swatches.grey[900],
    border: `1px solid ${theme.palette.swatches.grey[800]}`,
    borderRadius: "3px",
    boxShadow:
      "rgba(0, 0, 0, 0.2) 0px 2px 1px -1px, rgba(0, 0, 0, 0.14) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 1px 3px 0px",
    transition: "background 0.2s ease-in-out",
    "&:hover": {
      background: theme.palette.swatches.grey[850],
      cursor: "pointer",
    },
  },
  cardInactive: {
    height: "240px",
    background: theme.palette.swatches.grey[700],
    border: `1px solid ${theme.palette.swatches.red[500]}`,
    borderRadius: "3px",
    boxShadow:
      "rgba(0, 0, 0, 0.2) 0px 2px 1px -1px, rgba(0, 0, 0, 0.14) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 1px 3px 0px",
    transition: "background 0.2s ease-in-out",
    "&:hover": {
      cursor: "not-allowed",
    },
  },
  cardHeader: {
    height: "58px",
    lineHeight: "58px",
    display: "flex",
    justifyContent: "space-between",
  },
  cardIcon: {
    width: "58px",
    height: "58px",
    paddingLeft: "13px",
    paddingTop: "10px",
    color: theme.palette.accent.main,
  },
  cardIconRight: { height: "50px", width: "34px", paddingLeft: "13px" },
  cardName: {
    fontWeight: "bold",
    letterSpacing: "2px",
    fontSize: "18px",
    paddingLeft: "16px",
    color: theme.palette.swatches.grey[200],
    textTransform: "uppercase",
  },
  cardOn: {
    width: "20px",
    height: "20px",
    margin: "19px",
    borderRadius: "3px",
    background: theme.palette.accent.main,
  },
  cardOff: {
    width: "20px",
    height: "20px",
    margin: "19px",
    borderRadius: "3px",
    background: theme.palette.swatches.grey[800],
  },
  cardContent: {
    padding: "8px 16px 16px 16px",
  },
  cardContentTitle: {
    color: theme.palette.swatches.grey[500],
    marginBottom: "8px",
    fontStyle: "italic",
  },
  cardContentBody: {
    color: theme.palette.swatches.grey[200],
  },
}));

export default function APIs() {
  const c = useStyles();

  const getAPICards = () => {
    const cards = [];
    Object.keys(apiCards)
      .sort((a, b) => a.localeCompare(b))
      .forEach((key, idx) => {
        const apiCard = apiCards[key];
        cards.push(
          <Grid
            item
            xs={12}
            sm={6}
            md={6}
            lg={4}
            xl={3}
            onClick={() => {
              window.open(apiCard.link, "_blank").focus();
            }}
          >
            <div key={idx} className={apiCard.active ? c.card : c.cardInactive}>
              <div className={c.cardHeader}>
                <div className={c.cardIcon}>
                  <ApiIcon fontSize="large" />
                </div>
                <div className={c.cardIconRight}>
                  <OpenInNewIcon />
                </div>
              </div>
              <div className={c.cardName}>{key}</div>
              <div className={c.cardContent}>
                <div className={c.cardContentTitle}>{apiCard.subtitle}</div>
                <div className={c.cardContentBody}>{apiCard.description}</div>
              </div>
            </div>
          </Grid>
        );
      });
    return cards;
  };

  return (
    <div className={c.APIs}>
      <div className={c.APIsInner}>
        <Toolbar className={c.topbar}>
          <div className={c.topbarTitle}>
            <ApiIcon />
            <Typography
              sx={{ flex: "1 1 100%" }}
              style={{
                fontWeight: "bold",
                fontSize: "16px",
                lineHeight: "29px",
              }}
              variant="h6"
              component="div"
            >
              APIs
            </Typography>
          </div>
        </Toolbar>
        <div>
          <Box
            sx={{
              width: "100%",
              padding: "20px 50px",
              boxSizing: "border-box",
            }}
          >
            <Grid
              container
              rowSpacing={4}
              columnSpacing={4}
              columns={{ xs: 12, sm: 12, md: 12, lg: 12, xl: 12 }}
            >
              {getAPICards()}
            </Grid>
          </Box>
        </div>
      </div>
    </div>
  );
}
