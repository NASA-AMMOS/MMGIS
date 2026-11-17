import React, { useEffect, useState } from "react";
import { calls } from "./calls";

// Setup status of the site's connection plugins, fetched once per page load.
// null while loading or when this admin can't read it.
let setupPromise = null;
function loadSetup() {
  if (!setupPromise)
    setupPromise = new Promise((resolve) =>
      calls.api(
        "connections_setup",
        null,
        (res) => resolve(res && res.connections ? res : null),
        () => resolve(null)
      )
    );
  return setupPromise;
}

export function useConnectionsSetup() {
  const [setup, setSetup] = useState(null);
  useEffect(() => {
    let live = true;
    loadSetup().then((s) => live && setSetup(s));
    return () => {
      live = false;
    };
  }, []);
  return setup;
}

// The connections a tool's plugin.json lists
export function toolRequirements(toolConfig) {
  const list = toolConfig && toolConfig.connections;
  if (!Array.isArray(list)) return [];
  return list
    .map((r) => (typeof r === "string" ? { plugin: r } : r))
    .filter((r) => r && typeof (r.plugin || r.id) === "string");
}

export function findConnection(setup, req) {
  if (!setup) return null;
  const key = String(req.plugin || req.id).toLowerCase();
  return (
    setup.connections.find(
      (c) => c.id === key || String(c.plugin).toLowerCase() === key
    ) || null
  );
}

const STATE = {
  ready: { color: "#3fbf6f", text: "set up" },
  missing: { color: "#f0a830", text: "not set up" },
  absent: { color: "#e05252", text: "not installed" },
  unknown: { color: "#8a8d96", text: "" },
};

// "Needs Earthdata · set up" chips for a tool
export function ToolConnections({ toolConfig, setup, style }) {
  const reqs = toolRequirements(toolConfig);
  if (reqs.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", ...style }}>
      {reqs.map((r) => {
        const conn = findConnection(setup, r);
        const state = !setup
          ? STATE.unknown
          : !conn
          ? STATE.absent
          : conn.configured
          ? STATE.ready
          : STATE.missing;
        const name = conn ? conn.label : r.plugin || r.id;
        const title = conn && !conn.configured && conn.missingEnv.length
          ? `Missing ${conn.missingEnv.join(", ")}`
          : r.plugin || r.id;
        return (
          <span
            key={r.plugin || r.id}
            title={title}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "12px",
              padding: "2px 8px",
              borderRadius: "10px",
              border: `1px solid ${state.color}`,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: state.color,
              }}
            />
            {r.required === false ? "Can use" : "Needs"} {name}
            {state.text ? ` · ${state.text}` : ""}
          </span>
        );
      })}
    </div>
  );
}
