import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import Configure from "./core/Configure";
import store from "./core/store";
import { Provider } from "react-redux";
import reportWebVitals from "./core/reportWebVitals";

import "@fontsource/roboto";

import { ThemeProvider } from "@mui/material/styles";
import muiTheme from "./themes/light.js";

// As of React 18
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <Provider store={store}>
    <ThemeProvider theme={muiTheme}>
      <Configure />
    </ThemeProvider>
  </Provider>
);
