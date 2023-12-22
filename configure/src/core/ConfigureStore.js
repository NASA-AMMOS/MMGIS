import { createSlice } from "@reduxjs/toolkit";

export const ConfigureStore = createSlice({
  name: "core",
  initialState: {
    missions: [],
    mission: null,
    configuration: {},
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
  },
});

// Action creators are generated for each case reducer function
export const { setMissions, setMission, setConfiguration } =
  ConfigureStore.actions;

export default ConfigureStore.reducer;
