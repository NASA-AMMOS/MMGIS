import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import Configure from "./core/Configure";
import store from "./core/store";
import { Provider } from "react-redux";
import reportWebVitals from "./core/reportWebVitals";

// As of React 18
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <Provider store={store}>
    <Configure />
  </Provider>
);
