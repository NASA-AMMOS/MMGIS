import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { makeStyles } from "@mui/styles";

import { calls } from "../../core/calls";
import { copyToClipboard } from "../../core/utils";
import { setSnackBarText } from "../../core/ConfigureStore";

import Toolbar from "@mui/material/Toolbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import Button from "@mui/material/Button";
import Autocomplete from "@mui/material/Autocomplete";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Link from "@mui/material/Link";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import KeyIcon from "@mui/icons-material/Key";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const shadow = "0px 1px 7px 0px rgba(0, 0, 0, 0.2)";

const useStyles = makeStyles((theme) => ({
  APITokens: {
    width: "100%",
    display: "flex",
    flexFlow: "column",
    background: theme.palette.swatches.grey[1000],
    backgroundImage: "url(configure/build/gridlines.png)",
    overflowY: "auto",
    height: "100vh",
    boxSizing: "border-box",
  },
  topbar: {
    width: "calc(100% - 100px)",
    height: "44px",
    minHeight: "44px !important",
    display: "flex",
    justifyContent: "space-between",
    padding: `0px 20px`,
    boxSizing: `border-box !important`,
  },
  topbarTitle: {
    display: "flex",
    color: theme.palette.swatches.grey[150],
    "& > svg": {
      color: theme.palette.swatches.grey[150],
      margin: "3px 10px 0px 2px",
    },
  },
  content: { padding: "16px 32px 64px 32px" },
  card: {
    background: theme.palette.swatches.grey[1000],
    borderRadius: "4px",
    boxShadow: shadow,
    marginBottom: "20px",
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px 16px 10px 16px",
  },
  cardTitle: {
    fontSize: "18px !important",
    fontWeight: "bold !important",
    whiteSpace: "nowrap",
  },
  hint: { fontSize: "13px", opacity: 0.75, lineHeight: "18px" },
  form: {
    display: "grid",
    gridTemplateColumns: "1.2fr auto 0.8fr 1.4fr auto",
    gap: "12px",
    alignItems: "center",
    padding: "4px 16px 8px 16px",
  },
  toggle: {
    height: "40px",
    "& .MuiToggleButton-root": {
      textTransform: "none",
      fontSize: "13px",
      padding: "0px 14px",
      whiteSpace: "nowrap",
      color: theme.palette.swatches.grey[150],
    },
    "& .MuiToggleButton-root.Mui-selected": {
      background: theme.palette.swatches.grey[300],
      color: "white",
    },
    "& .MuiToggleButton-root.Mui-selected:hover": {
      background: theme.palette.swatches.grey[150],
    },
  },
  generate: {
    height: "40px",
    whiteSpace: "nowrap",
    padding: "0px 20px !important",
    background: `${theme.palette.swatches.p[0]} !important`,
    color: "black !important",
  },
  fieldHint: { fontSize: "12px", opacity: 0.7, padding: "0px 16px 14px 16px" },
  newToken: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "20px",
    padding: "12px 16px",
    background: theme.palette.swatches.grey[1000],
    borderLeft: "4px solid #5b8c32",
    borderRadius: "4px",
    boxShadow: shadow,
  },
  newTokenText: { flex: 1, minWidth: 0 },
  newTokenLabel: {
    fontSize: "12px",
    fontWeight: "bold",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    color: "#5b8c32",
    marginBottom: "2px",
  },
  newTokenValue: {
    fontFamily: "monospace",
    fontWeight: "bold",
    fontSize: "14px",
    wordBreak: "break-all",
  },
  table: {
    "& tr": { background: theme.palette.swatches.grey[850] },
    "& th": {
      fontWeight: "bold !important",
      fontSize: "13px",
      padding: "8px 12px",
      textTransform: "uppercase",
      letterSpacing: "1px !important",
      backgroundColor: `${theme.palette.swatches.grey[1000]} !important`,
      borderRight: `1px solid ${theme.palette.swatches.grey[900]}`,
    },
    "& td": {
      padding: "6px 12px",
      borderRight: `1px solid ${theme.palette.swatches.grey[800]}`,
      borderBottom: `1px solid ${theme.palette.swatches.grey[700]} !important`,
    },
    "& td:first-child": {
      fontWeight: "bold",
      letterSpacing: "1px",
      fontSize: "15px",
      color: `${theme.palette.swatches.p[13]}`,
    },
  },
  mono: { fontFamily: "monospace !important", fontSize: "13px !important" },
  muted: { opacity: 0.6 },
  chip: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "13px",
    color: "white",
    whiteSpace: "nowrap",
  },
  chipRead: { background: "#5b8c32" },
  chipFull: { background: theme.palette.swatches.grey[300] },
  chipCustom: { background: "#3a8fb7", whiteSpace: "normal" },
  dot: {
    display: "inline-block",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    marginRight: "8px",
    verticalAlign: "middle",
  },
  nowrap: { whiteSpace: "nowrap" },
  empty: { padding: "4px 16px 16px 16px", fontSize: "14px", opacity: 0.7 },
  accordion: {
    boxShadow: "none !important",
    borderTop: `1px solid ${theme.palette.swatches.grey[800]}`,
    background: "transparent !important",
    "&:before": { display: "none" },
    "& .MuiAccordionSummary-root": { padding: "0px 16px" },
    "& .MuiAccordionDetails-root": { padding: "0px 16px 16px 16px" },
  },
  exampleTitle: { fontSize: "15px !important", fontWeight: "500 !important" },
  code: {
    position: "relative",
    margin: 0,
    padding: "14px 48px 14px 16px",
    background: "#1a1a1a",
    color: "#e8e8e8",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "13px",
    lineHeight: "20px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
  codeCopy: {
    position: "absolute !important",
    top: "6px",
    right: "6px",
    color: "#bbb !important",
  },
  exampleNote: { fontSize: "13px", opacity: 0.75, marginTop: "8px" },
  docs: {
    display: "flex",
    gap: "18px",
    padding: "12px 16px 16px 16px",
    fontSize: "13px",
    borderTop: `1px solid ${theme.palette.swatches.grey[800]}`,
  },
}));

export default function APITokens() {
  const c = useStyles();

  const dispatch = useDispatch();

  const [tokenName, setTokenName] = useState(null);
  const [expireAfter, setExpireAfter] = useState("never");
  const [tokenScope, setTokenScope] = useState("read");
  const [tokenMissions, setTokenMissions] = useState([]);
  const missionNames = useSelector((state) => state.core.missions) || [];
  const [capLabels, setCapLabels] = useState({});
  useEffect(() => {
    calls.api("access_roles", {}, (res) => setCapLabels(res?.body?.capabilities || {}), () => {});
  }, []);
  const [token, setToken] = useState(null);
  const [tokenList, setTokenList] = useState([]);

  // Get base URL by removing /configure from current URL
  const getBaseUrl = () => {
    const url = window.location.href;
    return url.replace(/\/configure.*$/, '');
  };
  const baseUrl = getBaseUrl();

  // API Examples configuration
  const apiExamples = [
    {
      title: "General Usage",
      code: `All Configure API calls require the header: "Authorization:Bearer ${token != null ? token : "<token>"}"`,
      note: null
    },
    {
      title: "Get All Missions",
      code: `curl -X GET -H "Authorization:Bearer ${token != null ? token : "<token>"}" "${baseUrl}/api/configure/missions"`,
      note: {
        text: "Uses the site's sign-in rules: add the Authorization header when the site requires sign-in or the mission isn't public",
        color: "default",
        variant: "outlined"
      }
    },
    {
      title: "Get Mission Configuration",
      code: `curl -X GET -H "Authorization:Bearer ${token != null ? token : "<token>"}" "${baseUrl}/api/configure/get?mission=YourMission"`,
      note: {
        text: "Uses the site's sign-in rules: add the Authorization header when the site requires sign-in or the mission isn't public",
        color: "default",
        variant: "outlined"
      }
    },
    {
      title: "Validate Configuration",
      code: `curl -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -H "Content-Type: application/json" -d '{"config":{"msv":1,"projection":"EPSG:4326","look":{"zoom":5,"center":[0,0]},"layers":[],"tools":[]}}' "${baseUrl}/api/configure/validate"`
    },
    {
      title: "Update Mission Configuration",
      code: `curl -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -H "Content-Type: application/json" -d '{"mission":"YourMission","config":{"msv":1,"projection":"EPSG:4326","look":{"zoom":5,"center":[0,0]},"layers":[],"tools":[]}}' "${baseUrl}/api/configure/upsert"`
    },
    {
      title: "Add New Layer",
      code: `curl -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -H "Content-Type: application/json" -d '{"mission":"YourMission","layer":{"name":"NewLayer","type":"tile","url":"https://example.com/{z}/{x}/{y}.png","minZoom":0,"maxNativeZoom":18,"maxZoom":18,"visibility":true},"placement":{"index":0}}' "${baseUrl}/api/configure/addLayer"`
    },
    {
      title: "Update Existing Layer",
      code: `curl -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -H "Content-Type: application/json" -d '{"mission":"YourMission","layerUUID":"layer-uuid-here","layer":{"opacity":0.7,"visibility":false}}' "${baseUrl}/api/configure/updateLayer"`
    },
    {
      title: "Remove Layer",
      code: `curl -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -H "Content-Type: application/json" -d '{"mission":"YourMission","layerUUID":"layer-uuid-here"}' "${baseUrl}/api/configure/removeLayer"`
    },
    {
      title: "Update Initial Map View",
      code: `curl -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -H "Content-Type: application/json" -d '{"mission":"YourMission","latitude":34.052235,"longitude":-118.243683,"zoom":10}' "${baseUrl}/api/configure/updateInitialView"`
    },
    {
      title: "JavaScript/Fetch Example",
      code: `fetch('${baseUrl}/api/configure/missions', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ${token != null ? token : "<token>"}'
  }
})
.then(response => response.json())
.then(data => console.log(data));`
    },
    {
      title: "Python Example",
      code: `import requests

headers = {
    'Authorization': 'Bearer ${token != null ? token : "<token>"}',
    'Content-Type': 'application/json'
}

response = requests.get('${baseUrl}/api/configure/missions', headers=headers)
print(response.json())`
    },
    {
      title: "Upload Dataset CSV (Datasets API)",
      code: `curl -i -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -F "name=my_dataset" -F "upsert=true" -F "header=["latitude","longitude","sample_id","rock_type"]" -F "data=@data.csv;type=text/csv" "${baseUrl}/api/datasets/upload"`,
      note: {
        text: "Note: This uses the Datasets API, not the Configure API",
        color: "default",
        variant: "outlined"
      }
    },
    {
      title: "Upload GeoDataset (GeoDatasets API)",
      code: `curl -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -H "Content-Type: application/json" --data-binary "@my_geojson.json" "${baseUrl}/api/geodatasets/recreate/my_geodataset"`,
      note: {
        text: "Note: This uses the GeoDatasets API, not the Configure API",
        color: "default",
        variant: "outlined"
      }
    }
  ];

  const updateExistingTokenList = () => {
    calls.api(
      "longtermtoken_get",
      null,
      (res) => {
        if (res.status === "success") {
          setTokenList(res.tokens);
        } else {
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to get existing API keys.",
              severity: "error",
            })
          );
        }
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to get existing API keys.",
            severity: "error",
          })
        );
      }
    );
  };

  const generatedLongTermToken = () => {
    calls.api(
      "longtermtoken_generate",
      {
        name: tokenName || null,
        period: expireAfter,
        scopes: tokenScope === "read" ? "read" : null,
        missions: tokenMissions.length ? tokenMissions : null,
      },
      (res) => {
        if (res.status === "success") {
          dispatch(
            setSnackBarText({
              text: "Successfully generated an API key!",
              severity: "success",
            })
          );
          setToken(res.body.token);

          updateExistingTokenList();
        } else {
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to generate an API key.",
              severity: "error",
            })
          );
        }
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to generate an API key.",
            severity: "error",
          })
        );
      }
    );
  };

  const clearLongTermToken = (tokenId) => {
    calls.api(
      "longtermtoken_clear",
      { id: tokenId },
      (res) => {
        if (res.status === "success") {
          dispatch(
            setSnackBarText({
              text: "Successfully deleted token!",
              severity: "success",
            })
          );
          updateExistingTokenList();
        } else {
          dispatch(
            setSnackBarText({
              text: res?.message || "Failed to delete token.",
              severity: "error",
            })
          );
        }
      },
      (res) => {
        dispatch(
          setSnackBarText({
            text: res?.message || "Failed to delete token.",
            severity: "error",
          })
        );
      }
    );
  };

  useEffect(() => {
    updateExistingTokenList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = (text) => {
    if (!text) return;
    copyToClipboard(text);
    dispatch(setSnackBarText({ text: "Copied to Clipboard!", severity: "success" }));
  };

  const expiryOf = (t) => {
    if (!t.created_by_user_id) return { color: "#d22d2d", text: "Blocked (legacy)" };
    const end = t.expires_at
      ? new Date(t.expires_at).getTime()
      : t.period === "never"
      ? null
      : new Date(t.createdAt).getTime() + parseInt(t.period);
    if (end == null || isNaN(end)) return { color: "#5b8c32", text: "Never expires" };
    const left = end - Date.now();
    if (left <= 0) return { color: "#d22d2d", text: "Expired" };
    if (left < 86400000)
      return { color: "#5b8c32", text: `${Math.max(1, Math.round(left / 3600000))} hours left` };
    return { color: "#5b8c32", text: `${(left / 86400000).toFixed(1)} days left` };
  };

  const accessOf = (t) => {
    if (t.scopes == null) return { label: "All of my access", className: c.chipFull };
    if (t.scopes.every((sc) => sc.endsWith(".read") || sc.endsWith(".view")))
      return { label: "Read only", className: c.chipRead };
    return {
      label: t.scopes.map((sc) => capLabels[sc] || sc).join(", "),
      className: c.chipCustom,
    };
  };

  const missionsOf = (t) => {
    if (t.missions == null) return "All missions";
    if (t.missions.length === 0) return "No missions";
    if (t.missions.length <= 3) return t.missions.join(", ");
    return `${t.missions.slice(0, 2).join(", ")} +${t.missions.length - 2} more`;
  };

  return (
    <div className={c.APITokens}>
      <Toolbar className={c.topbar}>
        <div className={c.topbarTitle}>
          <KeyIcon />
          <Typography
            style={{ fontWeight: "bold", fontSize: "16px", lineHeight: "29px" }}
            variant="h6"
            component="div"
          >
            API Tokens
          </Typography>
        </div>
      </Toolbar>
      <div className={c.content}>
        <div className={c.card}>
          <div className={c.cardHead}>
            <Typography className={c.cardTitle}>Create a token</Typography>
            <div className={c.hint}>
              A token can only do what you can do, narrowed by its access and missions. Read-only
              tokens can view missions and data but change nothing.
            </div>
          </div>
          <div className={c.form}>
            <TextField
              label="Name (optional)"
              size="small"
              value={tokenName || ""}
              onChange={(e) => setTokenName(e.target.value)}
            />
            <ToggleButtonGroup
              className={c.toggle}
              exclusive
              size="small"
              value={tokenScope}
              onChange={(e, v) => v && setTokenScope(v)}
            >
              <ToggleButton value="read">Read only</ToggleButton>
              <ToggleButton value="full">All of my access</ToggleButton>
            </ToggleButtonGroup>
            <FormControl size="small">
              <InputLabel>Expire after</InputLabel>
              <Select
                label="Expire after"
                value={expireAfter}
                onChange={(e) => setExpireAfter(e.target.value)}
              >
                <MenuItem value={"never"}>Never</MenuItem>
                <MenuItem value={"31557600000"}>1 year</MenuItem>
                <MenuItem value={"2629800000"}>1 month</MenuItem>
                <MenuItem value={"604800000"}>1 week</MenuItem>
                <MenuItem value={"86400000"}>1 day</MenuItem>
                <MenuItem value={"3600000"}>1 hour</MenuItem>
              </Select>
            </FormControl>
            <Autocomplete
              multiple
              size="small"
              limitTags={2}
              options={missionNames}
              value={tokenMissions}
              onChange={(e, v) => setTokenMissions(v)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Limit to missions"
                  placeholder={tokenMissions.length ? "" : "All missions"}
                  InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
                />
              )}
            />
            <Button
              className={c.generate}
              variant="contained"
              disableElevation
              startIcon={<KeyIcon />}
              onClick={generatedLongTermToken}
            >
              Generate
            </Button>
          </div>
          <div className={c.fieldHint}>
            Names keep only lowercase letters and numbers (ro_b becomes rob). Without a name, the
            token is just its hash.
          </div>
        </div>

        {token && (
          <div className={c.newToken}>
            <div className={c.newTokenText}>
              <div className={c.newTokenLabel}>New token: copy it now, it's shown once</div>
              <div className={c.newTokenValue}>{token}</div>
            </div>
            <Button variant="outlined" size="small" startIcon={<ContentCopyIcon />} onClick={() => copy(token)}>
              Copy
            </Button>
          </div>
        )}

        <div className={c.card}>
          <div className={c.cardHead}>
            <Typography className={c.cardTitle}>Tokens</Typography>
            <div className={c.hint}>
              {tokenList.length} {tokenList.length === 1 ? "token" : "tokens"}
            </div>
          </div>
          {tokenList.length === 0 ? (
            <div className={c.empty}>No tokens yet.</div>
          ) : (
            <Table size="small" className={c.table}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Token</TableCell>
                  <TableCell>Created by</TableCell>
                  <TableCell>Access</TableCell>
                  <TableCell>Missions</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {tokenList.map((t) => {
                  const legacy = !t.created_by_user_id;
                  const expiry = expiryOf(t);
                  const access = accessOf(t);
                  return (
                    <TableRow key={t.id} className={legacy ? c.muted : undefined}>
                      <TableCell>{t.name || "(no name)"}</TableCell>
                      <TableCell className={c.mono}>{t.token}</TableCell>
                      <TableCell>{legacy ? "Legacy token" : t.created_by_username || "Unknown"}</TableCell>
                      <TableCell>
                        {legacy ? "—" : <span className={`${c.chip} ${access.className}`}>{access.label}</span>}
                      </TableCell>
                      <TableCell title={t.missions ? t.missions.join(", ") : undefined}>
                        {legacy ? "—" : missionsOf(t)}
                      </TableCell>
                      <TableCell className={c.nowrap}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className={c.nowrap}>
                        <span className={c.dot} style={{ background: expiry.color }} />
                        {expiry.text}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Delete token" placement="top" arrow>
                          <IconButton size="small" onClick={() => clearLongTermToken(t.id)}>
                            <DeleteForeverIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className={c.card}>
          <div className={c.cardHead}>
            <Typography className={c.cardTitle}>Using a token</Typography>
            <div className={c.hint}>Send it in the header: Authorization: Bearer &lt;token&gt;</div>
          </div>
          {apiExamples.map((example, i) => (
            <Accordion key={example.title} className={c.accordion} disableGutters defaultExpanded={i === 0}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography className={c.exampleTitle}>{example.title}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <pre className={c.code}>
                  {example.code}
                  <Tooltip title="Copy" placement="top" arrow>
                    <IconButton size="small" className={c.codeCopy} onClick={() => copy(example.code)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </pre>
                {example.note && <div className={c.exampleNote}>{example.note.text}</div>}
              </AccordionDetails>
            </Accordion>
          ))}
          <div className={c.docs}>
            <span>Docs:</span>
            <Link href="https://nasa-ammos.github.io/MMGIS/apis/configure" target="_blank" underline="hover">
              Configure API
            </Link>
            <Link href="https://nasa-ammos.github.io/MMGIS/apis/geodatasets" target="_blank" underline="hover">
              GeoDatasets API
            </Link>
            <Link href="https://nasa-ammos.github.io/MMGIS/apis/" target="_blank" underline="hover">
              All APIs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
