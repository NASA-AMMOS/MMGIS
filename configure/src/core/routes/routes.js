import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import SnackBar from "../../components/SnackBar/SnackBar";
import Configure from "../Configure";

import { HASH_PATHS } from "../constants";

import "./routes.css";

export const Routings = () => {
  return (
    <div className="Routes">
      <Router>
        <div className="routeMain">
          <Routes>
            <Route
              path={HASH_PATHS.home}
              element={
                <div className="routeContent">
                  <Configure />
                </div>
              }
            />
          </Routes>
        </div>
      </Router>
      <SnackBar />
    </div>
  );
};
