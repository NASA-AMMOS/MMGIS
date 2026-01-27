import React from "react";
import { useSelector, useDispatch } from "react-redux";
import {} from "./ComponentsSlice";
import { makeStyles } from "@mui/styles";

import clsx from "clsx";

import { setModal } from "../../../core/ConfigureStore";

import ComponentModal from "./Modals/ComponentModal/ComponentModal";

import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";

const useStyles = makeStyles((theme) => ({
  Components: {
    width: "100%",
    display: "flex",
    background: theme.palette.swatches.grey[1000],
    paddingBottom: "64px",
    backgroundImage: "url(configure/build/gridlines.png)",
  },
  card: {
    height: "300px",
    background: theme.palette.swatches.grey[900],
    border: `1px solid ${theme.palette.swatches.grey[800]}`,
    borderRadius: "3px",
    overflow: "auto",
    boxShadow:
      "rgba(0, 0, 0, 0.2) 0px 2px 1px -1px, rgba(0, 0, 0, 0.14) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 1px 3px 0px",
    transition: "background 0.2s ease-in-out",
    "&:hover": {
      background: theme.palette.swatches.grey[850],
      cursor: "pointer",
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
  },
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

export default function Components() {
  const c = useStyles();

  const dispatch = useDispatch();
  const configuration = useSelector((state) => state.core.configuration);
  const componentConfiguration = useSelector(
    (state) => state.core.componentConfiguration
  );

  // Component configuration is fetched in Main.js on mount
  // No need to fetch again here

  const handleClick = (componentName, componentConfig) => {
    dispatch(
      setModal({
        name: "component",
        on: true,
        componentName,
        componentConfig,
        onClose: () => {},
      })
    );
  };

  const getComponentCards = () => {
    const cards = [];

    if (componentConfiguration) {
      Object.keys(componentConfiguration)
        .sort((a, b) => a.localeCompare(b))
        .forEach((key, idx) => {
          const cConfig = componentConfiguration[key];
          let comp = configuration.components?.filter((f) => f.name === key)[0];
          let componentActive = true;
          if (comp == null) {
            comp = {};
            componentActive = false;
          }
          if (comp?.on != null) componentActive = comp.on;
          cards.push(
            <Grid
              item
              xs={12}
              sm={6}
              md={6}
              lg={4}
              xl={3}
              onClick={() => {
                handleClick(key, cConfig);
              }}
              key={key}
            >
              <div className={c.card}>
                <div className={c.cardHeader}>
                  <div className={c.cardIcon}>
                    <i
                      className={`mdi mdi-${
                        comp.icon || cConfig.defaultIcon || "puzzle"
                      } mdi-36px`}
                    ></i>
                  </div>
                  <div
                    className={clsx({
                      [c.cardOn]: componentActive,
                      [c.cardOff]: !componentActive,
                    })}
                  ></div>
                </div>
                <div className={c.cardName}>{key}</div>
                <div className={c.cardContent}>
                  <div className={c.cardContentTitle}>
                    {cConfig.description}
                  </div>
                  <div className={c.cardContentBody}>
                    {cConfig.descriptionFull?.title}
                  </div>
                </div>
              </div>
            </Grid>
          );
        });
    }

    // Add the plugin info card
    cards.push(
      <Grid item xs={12} sm={6} md={6} lg={4} xl={3} key="plugin-info">
        <div className={c.card}>
          <div className={c.cardHeader}>
            <div className={c.cardIcon}>
              <i className="mdi mdi-puzzle-outline mdi-36px"></i>
            </div>
            <div className={c.cardOff}></div>
          </div>
          <div className={c.cardName}>Custom Components</div>
          <div className={c.cardContent}>
            <div className={c.cardContentTitle}>
              Develop and add your own components via the plugin system.
            </div>
            <div className={c.cardContentBody}>
              Create directories matching *Private-Components* or *Plugin-Components* in
              /src/essence/. Run npm run build again to include new custom
              components. Components initialize after the UI is finalized.
            </div>
          </div>
        </div>
      </Grid>
    );

    return cards;
  };

  // Show the tab as long as there are components available to configure
  // (componentConfiguration has entries), even if none are enabled yet
  if (!componentConfiguration || Object.keys(componentConfiguration).length === 0) {
    return <div className={c.Components}>No components available</div>;
  }

  return (
    <>
      <div className={c.Components}>
        <Box sx={{ width: "100%", padding: "60px 120px" }}>
          <Grid
            container
            rowSpacing={4}
            columnSpacing={4}
            columns={{ xs: 12, sm: 12, md: 12, lg: 12, xl: 12 }}
          >
            {getComponentCards()}
          </Grid>
        </Box>
      </div>

      <ComponentModal />
    </>
  );
}
