import { createSlice } from "@reduxjs/toolkit";

export const HomeSlice = createSlice({
  name: "home",
  initialState: {
    versions: [],
  },
  reducers: {
    setVersions: (state, action) => {
      state.versions = action.payload;
    },
  },
});

// Action creators are generated for each case reducer function
export const { setVersions } = HomeSlice.actions;

export default HomeSlice.reducer;
