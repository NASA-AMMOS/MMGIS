import { configureStore } from "@reduxjs/toolkit";

import ConfigureStore from "./ConfigureStore";

import PanelReducer from "../components/Panel/PanelSlice";

export default configureStore({
  reducer: {
    core: ConfigureStore,
    panel: PanelReducer,
  },
});
