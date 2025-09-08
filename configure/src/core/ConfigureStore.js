import { createSlice } from "@reduxjs/toolkit";

import { calls } from "./calls";
import { getAllValidationErrors } from "./validators";

window.newUUIDCount = 0;
window.configId = parseInt(Math.random() * 100000);

export const ConfigureStore = createSlice({
  name: "core",
  initialState: {
    missions: [],
    mission: null,
    configuration: {},
    toolConfiguration: {},
    geodatasets: [],
    datasets: [],
    stacCollections: [],
    userEntries: [],
    page: null,
    validationErrors: [],
    modal: {
      newMission: false,
      layer: false,
      tool: false,
      preview: false,
      newGeoDataset: false,
      deleteGeoDataset: false,
      layersUsedByGeoDataset: false,
      previewGeoDataset: false,
      appendGeoDataset: false,
      updateGeoDataset: false,
      newDataset: false,
      layersUsedByDataset: false,
      updateDataset: false,
      deleteDataset: false,
      newStacCollection: false,
      stacCollectionItems: false,
      stacCollectionJson: false,
      layersUsedByStacCollection: false,
      deleteStacCollection: false,
      uploadConfig: false,
      cloneConfig: false,
      deleteConfig: false,
      updateUser: false,
      deleteUser: false,
      newUser: false,
      resetPassword: false,
    },
    snackBarText: false,
    lockConfig: false,
    lockConfigCount: false,
    lockConfigTypes: {
      main: false,
      disconnect: false,
    },
  },
  reducers: {
    setMissions: (state, action) => {
      state.missions = action.payload;
    },
    setMission: (state, action) => {
      state.mission = action.payload;
      // Clear the bottom page (tokens, geodatasets, etc.) when a mission is clicked
      state.page = null;
    },
    setConfiguration: (state, action) => {
      state.configuration = action.payload;
      // Update validation errors whenever configuration changes
      state.validationErrors = getAllValidationErrors(action.payload);
    },
    setToolConfiguration: (state, action) => {
      state.toolConfiguration = action.payload;
    },
    setGeodatasets: (state, action) => {
      state.geodatasets = action.payload;
    },
    setDatasets: (state, action) => {
      state.datasets = action.payload;
    },
    setStacCollections: (state, action) => {
      state.stacCollections = action.payload;
    },
    setUserEntries: (state, action) => {
      state.userEntries = action.payload;
    },
    setPage: (state, action) => {
      state.page = action.payload.page;
    },
    /**
     * Controls all modal open/close states
     * @param {string} name - Name of modal to toggle
     * @param {boolean} on - Whether to turn this modal on or off. If null, toggles on
     * @returns null
     */
    setModal: (state, action) => {
      const name = action.payload.name;
      if (state.modal[name] != null) {
        let on = action.payload.on;
        if (on == null) on = state.modal[name] === false;
        if (on) state.modal[name] = action.payload;
        else state.modal[name] = false;
      }
    },
    setSnackBarText: (state, action) => {
      if (action.payload === false) state.snackBarText = false;
      else
        state.snackBarText = {
          text: String(action.payload.text),
          severity: action.payload.severity,
        };
    },
    setValidationErrors: (state, action) => {
      state.validationErrors = action.payload;
    },
    clearLockConfig: (state, action) => {
      state.lockConfigTypes[action.payload.type || "main"] = false;

      let canUnlock = true;
      Object.keys(state.lockConfigTypes).forEach((k) => {
        if (state.lockConfigTypes[k] === true) canUnlock = false;
      });
      if (canUnlock) {
        state.lockConfig = false;
      }
    },
    setLockConfig: (state, action) => {
      state.lockConfigTypes[action.payload.type || "main"] = true;
      state.lockConfig = true;
      state.lockConfigCount =
        window.mmgisglobal.ENABLE_CONFIG_OVERRIDE === "true" ? 4 : false;
    },
    saveConfiguration: (state, action) => {
      if (state.lockConfig === true) {
        if (state.lockConfigCount !== false) {
          if (state.lockConfigTypes.disconnect === true) {
            state.snackBarText = {
              text: `Websocket disconnected. You will not be able to save until it reconnects or ${
                state.lockConfigCount
              } more attempt${
                state.lockConfigCount !== 1 ? "s" : ""
              } at saving to force it.`,
              severity: "error",
            };
          } else {
            state.snackBarText = {
              text: `This configuration changed while you were working on it. Cannot save without a refresh or ${
                state.lockConfigCount
              } more attempt${
                state.lockConfigCount !== 1 ? "s" : ""
              } at saving to force it.`,
              severity: "error",
            };
          }
          state.lockConfigCount--;
          if (state.lockConfigCount <= 0) {
            // clearLockConfig
            state.lockConfigTypes["main"] = false;

            let canUnlock = true;
            Object.keys(state.lockConfigTypes).forEach((k) => {
              if (state.lockConfigTypes[k] === true) canUnlock = false;
            });
            if (canUnlock) {
              state.lockConfig = false;
            }
          }
        } else {
          if (state.lockConfigTypes.disconnect === true) {
            state.snackBarText = {
              text: `Websocket disconnected. You will not be able to save until it reconnects.`,
              severity: "error",
            };
          } else {
            state.snackBarText = {
              text: `This configuration changed while you were working on it. Cannot save without a refresh.`,
              severity: "error",
            };
          }
        }
        return;
      }

      let finalConfig = action.payload.configuration
        ? JSON.parse(JSON.stringify(action.payload.configuration))
        : JSON.parse(JSON.stringify(state.configuration));
      if (finalConfig.temp) delete finalConfig.temp;

      calls.api(
        "upsert",
        {
          mission: state.mission,
          config: JSON.stringify(finalConfig),
          id: window.configId,
        },
        (res) => {
          action.payload.cb("success", res);
        },
        (res) => {
          action.payload.cb("error", res);
        }
      );
    },
  },
});

// Action creators are generated for each case reducer function
export const {
  setMissions,
  setMission,
  setConfiguration,
  setToolConfiguration,
  setGeodatasets,
  setDatasets,
  setStacCollections,
  setUserEntries,
  setPage,
  setModal,
  setSnackBarText,
  setValidationErrors,
  saveConfiguration,
  clearLockConfig,
  setLockConfig,
} = ConfigureStore.actions;

export default ConfigureStore.reducer;
