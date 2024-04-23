import { createSlice } from "@reduxjs/toolkit";

export const ConfigureStore = createSlice({
  name: "core",
  initialState: {
    missions: [],
    mission: null,
    configuration: {},
    modal: {
      newMission: false,
      layer: false,
      tool: false,
    },
    snackBarText: false,
  },
  reducers: {
    setMissions: (state, action) => {
      state.missions = action.payload;
    },
    setMission: (state, action) => {
      state.mission = action.payload;
    },
    setConfiguration: (state, action) => {
      state.configuration = action.payload;
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
  },
});

// Action creators are generated for each case reducer function
export const {
  setMissions,
  setMission,
  setConfiguration,
  setModal,
  setSnackBarText,
} = ConfigureStore.actions;

export default ConfigureStore.reducer;
