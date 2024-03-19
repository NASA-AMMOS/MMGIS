import { configureStore } from "@reduxjs/toolkit";

import ConfigureStore from "./ConfigureStore";

import PanelReducer from "../components/Panel/PanelSlice";
import HomeReducer from "../components/Tabs/Home/HomeSlice";

export default configureStore({
  reducer: {
    core: ConfigureStore,
    panel: PanelReducer,
    home: HomeReducer,
  },
});
