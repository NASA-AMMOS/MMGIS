import React, { useEffect } from "react";
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
              exact
              path={HASH_PATHS.home}
              element={
                <div className="routeContent">
                  <Configure />
                </div>
              }
            />
            {/*
                        <Route
                            exact
                            path={HASH_PATHS.search}
                            component={() => {
                                return (
                                    <div className="routeContent">
                                        <Search />
                                    </div>
                                )
                            }}
                        />
                        <Route
                            exact
                            path={HASH_PATHS.record}
                            component={() => {
                                return (
                                    <div className="routeContent">
                                        <Record />
                                    </div>
                                )
                            }}
                        />
                        <Route
                            exact
                            path={HASH_PATHS.cart}
                            component={() => {
                                return (
                                    <div className="routeContent">
                                        <Cart />
                                    </div>
                                )
                            }}
                        />
                        <Route
                            path={HASH_PATHS.fileExplorer}
                            component={() => {
                                return (
                                    <div className="routeContent">
                                        <FileExplorer />
                                    </div>
                                )
                            }}
                        />
                        */}
          </Routes>
        </div>
      </Router>
      <SnackBar />
    </div>
  );
};
