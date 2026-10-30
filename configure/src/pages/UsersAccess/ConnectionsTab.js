import React, { useEffect, useState } from "react";
import { useConnectionsSetup, toolRequirements, findConnection } from "../../core/Connections";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import { useStyles } from "./styles";
import { api } from "./shared";

// Read-only summary of the server's SITE_ACCESS and login ENVs
// Connection plugins: setup status and which tools use each. Never per-user.
export default function ConnectionsTab() {
  const c = useStyles();
  const setup = useConnectionsSetup();
  const [toolConfigs, setToolConfigs] = useState({});
  useEffect(() => {
    api("getToolConfig").then((r) => setToolConfigs(r || {})).catch(() => {});
  }, []);
  const usedBy = (conn) =>
    Object.keys(toolConfigs).filter((t) =>
      toolRequirements(toolConfigs[t]).some((r) => findConnection(setup, r) === conn)
    );
  const docs = (setup && setup.docs) || "https://nasa-ammos.github.io/MMGIS/contributing/connections";
  return (
    <>
      <div className={c.audience}>
        <Typography className={c.audienceTitle}>Connections</Typography>
        <div className={c.audienceHint} style={{ marginBottom: 0 }}>
          Connections let tools use an outside service, such as Earthdata, with each person's own account there. They don't
          sign anyone in to MMGIS. People connect and disconnect from the account menu on the main site. Read-only: each
          connection is a plugin and is set up through the server's environment.{" "}
          <Link href={docs} target="_blank" underline="always">Connections docs</Link>
        </div>
      </div>
      {setup == null ? (
        <div className={c.audience}><div className={c.audienceHint} style={{ marginBottom: 0 }}>Loading…</div></div>
      ) : setup.connections.length === 0 ? (
        <div className={c.audience}><div className={c.audienceHint} style={{ marginBottom: 0 }}>No connection plugins are installed.</div></div>
      ) : (
        setup.connections.map((conn) => {
          const tools = usedBy(conn);
          const cols = [
            {
              label: "Status",
              value: conn.configured ? "Set up" : "Not set up",
              desc: conn.configured
                ? "People can connect from the account menu."
                : [conn.missingEnv.length ? `Missing ${conn.missingEnv.join(", ")}.` : null, ...conn.problems].filter(Boolean).join(" "),
              env: (conn.env || []).join(" · ") || "No environment variables",
            },
            {
              label: "Who can connect",
              value: conn.guests ? "Anyone who can open the site" : "Signed-in users",
              desc: conn.guests
                ? "Guests' connections last for their browser session. Signing in to MMGIS keeps them, unless the account already has that connection; then the guest's is disconnected."
                : "Guests are asked to sign in to MMGIS first.",
              env: conn.plugin,
            },
            {
              label: "Used by",
              value: tools.length ? tools.join(", ") : "No tools",
              desc: "From each tool's plugin.json.",
              env: "",
            },
          ];
          return (
            <div key={conn.id} className={c.audience}>
              <Typography className={c.audienceTitle}>{conn.label}</Typography>
              {conn.description ? <div className={c.audienceHint} style={{ marginBottom: 0 }}>{conn.description}</div> : null}
              {conn.redirectUri ? (
                <div className={c.audienceHint} style={{ marginBottom: 0 }}>
                  Callback URL to register with the service: <code>{conn.redirectUri}</code>. If it isn't what browsers use to
                  reach this site, set CONNECTIONS_CALLBACK_BASE_URL.
                </div>
              ) : null}
              <div className={c.setupCols}>
                {cols.map((col) => (
                  <div key={col.label} className={c.setupCol}>
                    <div className={c.setupLabel}>{col.label}</div>
                    <div className={c.setupValue} style={col.label === "Status" ? { color: conn.configured ? "#3fbf6f" : "#f0a830" } : null}>{col.value}</div>
                    <div className={c.setupDesc}>{col.desc}</div>
                    <div className={c.setupEnv}>{col.env}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

