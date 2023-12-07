import { configureStore } from "@reduxjs/toolkit";
import PanelReducer from "../components/Panel/PanelSlice";

export default configureStore({
  reducer: {
    panel: PanelReducer,
  },
});
