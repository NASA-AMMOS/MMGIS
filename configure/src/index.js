import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import store from "./core/store";
import { Provider } from "react-redux";

import "@fontsource/roboto";

import { ThemeProvider } from "@mui/material/styles";
import muiTheme from "./themes/light.js";

import { Routings } from "./core/routes/routes";

ReactDOM.render(
  <Provider store={store}>
    <ThemeProvider theme={muiTheme}>
      <Routings />
    </ThemeProvider>
  </Provider>,
  document.getElementById("root")
);
