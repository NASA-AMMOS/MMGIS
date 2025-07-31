import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { makeStyles } from "@mui/styles";

import clsx from "clsx";

import { calls } from "../../core/calls";
import { copyToClipboard } from "../../core/utils";
import { setSnackBarText } from "../../core/ConfigureStore";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Tooltip from "@mui/material/Tooltip";
import Paper from "@mui/material/Paper";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Divider from "@mui/material/Divider";

import Toolbar from "@mui/material/Toolbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";

import KeyIcon from "@mui/icons-material/Key";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

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
  top: {
    display: "flex",
    paddingBottom: "10px",
    height: "48px",
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
  title: {
    margin: "18px 0px 0px 60px",
    paddingBottom: "5px",
    fontSize: "22px",
    letterSpacing: "1px",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  row: {
    margin: "20px 60px",
  },
  subtitle: {
    margin: "30px 60px 0px 60px !important",
    fontSize: "13px !important",
    paddingBottom: "5px",
    fontStyle: "italic",
  },
  subtitle2: {
    fontSize: "12px !important",
    fontStyle: "italic",
    width: "100%",
    marginBottom: "8px !important",
    color: theme.palette.swatches.grey[400],
  },
  text: {
    width: "100%",
  },
  dropdown: {
    width: "100%",
  },
  generate: { width: "100%", height: "48px" },
  generated: {
    height: "42px",
    lineHeight: "42px",
    display: "flex",
    marginBottom: "20px",
    border: `2px solid ${theme.palette.swatches.p[0]}`,
    borderRadius: "4px",
    boxShadow: `0px 2px 2px 0px rgba(0,0,0,0.2)`,
    "& > div:nth-child(1)": {
      padding: "0px 16px",
      background: theme.palette.swatches.p[0],
      textTransform: "uppercase",
      fontSize: "13px",
    },
    "& > div:nth-child(2)": {
      padding: "0px 16px",
    },
    "& > div:nth-child(3)": {
      height: "42px",
    },
  },
  genTitle: {},
  generatedToken: { flex: 1, letterSpacing: "1px", fontWeight: "bold" },
  copy2clipboard: {},
  tokenList: {},
  tokenListHeader: {
    display: "flex",
    height: "32px",
    lineHeight: "32px",
    width: "100%",
    background: theme.palette.swatches.grey[150],
    color: "white",
    fontWeight: "bold",
    fontSize: "12px",
    textTransform: "uppercase",
    marginBottom: "2px",
    "& > div:nth-child(1)": {
      textAlign: "center",
      width: "42px",
    },
    "& > div:nth-child(2)": { 
      width: "350px",
      padding: "0px 16px",
    },
    "& > div:nth-child(3)": {
      width: "120px",
      padding: "0px 16px",
    },
    "& > div:nth-child(4)": {
      flex: 1,
      padding: "0px 16px",
    },
    "& > div:nth-child(5)": {
      width: "140px",
      padding: "0px 16px",
    },
    "& > div:nth-child(6)": {
      width: "120px",
      padding: "0px 16px",
    },
    "& > div:nth-child(7)": {
      width: "60px",
      textAlign: "center",
    },
  },
  tokenListItem: {
    display: "flex",
    height: "42px",
    lineHeight: "42px",
    width: "100%",
    background: theme.palette.swatches.grey[900],
    border: `1px solid ${theme.palette.swatches.grey[700]}`,
    boxShadow: `0px 1px 3px 0px rgba(0,0,0,0.15)`,
    marginBottom: "3px",
    "& > div:nth-child(1)": {
      background: theme.palette.swatches.grey[150],
      color: "white",
      textAlign: "center",
      width: "42px",
    },
    "& > div:nth-child(2)": { 
      width: "350px",
      padding: "0px 16px",
      fontFamily: "monospace",
      fontSize: "12px",
    },
    "& > div:nth-child(3)": {
      width: "120px",
      padding: "0px 16px",
      fontSize: "12px",
    },
    "& > div:nth-child(4)": {
      flex: 1,
      padding: "0px 16px",
      fontSize: "12px",
    },
    "& > div:nth-child(5)": {
      width: "140px",
      padding: "0px 16px",
      fontFamily: "monospace",
      fontSize: "11px",
    },
    "& > div:nth-child(6)": {
      width: "120px",
      padding: "0px 16px",
      textTransform: "uppercase",
      fontSize: "12px",
      display: "flex",
      "& > div:first-child": {
        width: "16px",
        height: "16px",
        margin: "13px 6px 13px 0px",
        borderRadius: "3px",
      },
    },
    "& > div:nth-child(7)": {
      width: "60px",
      textAlign: "center",
    },
  },
  examples: {
    margin: "20px 0px",
  },
  exampleCard: {
    marginBottom: "16px",
    background: "none !important",
    boxShadow: "none !important",  
    border: "none !important", 
    borderBottom: `1px solid ${theme.palette.swatches.grey[700]} !important`,
    borderRadius: "0px !important",
    '& .MuiCardContent-root': {
      padding: '16px !important',
    },
  },
  exampleTitle: {
    color: theme.palette.swatches.grey[150],
    fontWeight: "bold !important",
    marginBottom: "8px !important",
    fontSize: '16px !important',
    letterSpacing: "1px !important",
  },
  code: {
    fontFamily: "monospace !important",
    padding: "8px",
    fontSize: '14px',
    borderRadius: "4px",
    background: theme.palette.swatches.grey[900],
    wordBreak: "break-all",
    whiteSpace: "pre-wrap",
  },
  content: {
    width: "100%",
    overflowY: "auto",
  },
  exampleNote: {
    fontSize: "11px",
    fontStyle: "italic",
    color: theme.palette.swatches.grey[400],
    marginTop: "4px",
  },
  docsCard: {
    marginTop: "20px",
    backgroundColor: theme.palette.swatches.grey[850],
    border: `1px solid ${theme.palette.swatches.grey[700]}`,
  },
  docsBox: {
    fontSize: '16px',
  },
  codePaper: {
    background: "none !important",
  },
}));

export default function APITokens() {
  const c = useStyles();

  const dispatch = useDispatch();

  const [tokenName, setTokenName] = useState(null);
  const [expireAfter, setExpireAfter] = useState("never");
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
      code: `curl -X GET "${baseUrl}/api/configure/missions"`,
      note: {
        text: "No authentication required for this endpoint",
        color: "default",
        variant: "outlined"
      }
    },
    {
      title: "Get Mission Configuration",
      code: `curl -X GET "${baseUrl}/api/configure/get?mission=YourMission"`,
      note: {
        text: "No authentication required for this endpoint",
        color: "default",
        variant: "outlined"
      }
    },
    {
      title: "Validate Configuration",
      code: `curl -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -H "Content-Type: application/json" -d '{"config":{"msv":1,"projection":"EPSG:4326","look":{"zoom":5,"center":[0,0]},"layers":[]}}' "${baseUrl}/api/configure/validate"`
    },
    {
      title: "Update Mission Configuration",
      code: `curl -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -H "Content-Type: application/json" -d '{"mission":"YourMission","config":{"msv":1,"projection":"EPSG:4326","look":{"zoom":5,"center":[0,0]},"layers":[]}}' "${baseUrl}/api/configure/upsert"`
    },
    {
      title: "Add New Layer",
      code: `curl -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -H "Content-Type: application/json" -d '{"mission":"YourMission","layer":{"name":"NewLayer","type":"tile","url":"https://example.com/{z}/{x}/{y}.png","visibility":true},"placement":{"index":0}}' "${baseUrl}/api/configure/addLayer"`
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
      code: `curl -i -X POST -H "Authorization:Bearer ${token != null ? token : "<token>"}" -F "name=my_dataset" -F "upsert=true" -F "header=[\"latitude\",\"longitude\",\"sample_id\",\"rock_type\"]" -F "data=@data.csv;type=text/csv" "${baseUrl}/api/datasets/upload"`,
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

  const renderExampleCard = (example, index) => (
    <Card key={index} className={c.exampleCard}>
      <CardContent>
        <Typography className={c.exampleTitle} variant="h6">
          {example.title}
        </Typography>
        <Paper elevation={0} className={c.codePaper} sx={{ p: 1, backgroundColor: 'grey.900' }}>
          <Typography
            className={c.code}
            component="pre"
          >
            {example.code}
          </Typography>
        </Paper>
        {example.note && (
          <Chip 
            label={example.note.text} 
            size="small" 
            color={example.note.color || "default"}
            variant={example.note.variant || "filled"}
            sx={{ mt: 1, fontSize: '11px', height: '20px' }}
          />
        )}
      </CardContent>
    </Card>
  );

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
      { name: tokenName || null, period: expireAfter },
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
              ext: res?.message || "Failed to generate an API key.",
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
              ext: res?.message || "Failed to delete token.",
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
  }, []);

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
        <Typography className={c.subtitle}>
          {
            "Generate an authentication token for programmatic control over the configuration and data endpoints. Each token inherits the mission permissions of the admin who creates it - SuperAdmin tokens have access to all missions, while regular Admin tokens are restricted to assigned missions. The generated token may be used in requests via the header: 'Authorization:Bearer <token>' and more information can be found at https://nasa-ammos.github.io/MMGIS/apis/configure#api-tokens"
          }
        </Typography>
        <Box sx={{ flexGrow: 1 }} className={clsx(c.row)}>
          <Grid container spacing={4} direction="row" alignItems="left">
            <Grid item xs={4} md={4} lg={4} xl={4} key={0}>
              <TextField
                className={c.text}
                label={"Token Name"}
                variant="filled"
                size="small"
                value={tokenName}
                onChange={(e) => {
                  setTokenName(e.target.value);
                }}
              />
              <Typography className={c.subtitle2}>
                {
                  "An optional name to be prefixed on the generated token in order to better identify it later. Otherwise, the original hash alone is used."
                }
              </Typography>
            </Grid>

            <Grid item xs={4} md={4} lg={4} xl={4} key={1}>
              <FormControl className={c.dropdown} variant="filled" size="small">
                <InputLabel>{"Expire After"}</InputLabel>
                <Select
                  value={expireAfter}
                  onChange={(e) => {
                    setExpireAfter(e.target.value);
                  }}
                >
                  <MenuItem value={"never"}>{"NEVER"}</MenuItem>
                  <MenuItem value={"31557600000"}>{"1 YEAR"}</MenuItem>
                  <MenuItem value={"2629800000"}>{"1 MONTH"}</MenuItem>
                  <MenuItem value={"604800000"}>{"1 WEEK"}</MenuItem>
                  <MenuItem value={"86400000"}>{"1 DAY"}</MenuItem>
                  <MenuItem value={"3600000"}>{"1 HOUR"}</MenuItem>
                </Select>
              </FormControl>
              <Typography className={c.subtitle2}>
                {"When should the next generated token cease to authenticate."}
              </Typography>
            </Grid>

            <Grid item xs={4} md={4} lg={4} xl={4} key={2}>
              <Button
                className={c.generate}
                variant="contained"
                disableElevation
                endIcon={<KeyIcon size="small" />}
                onClick={() => {
                  generatedLongTermToken();
                }}
              >
                Generate New Token
              </Button>
            </Grid>
          </Grid>
          <div className={c.generated}>
            <div className={c.genTitle}>New Token</div>
            <div className={c.generatedToken}>{token}</div>
            <Tooltip title={"Copy Token to Clipboard"} placement="top" arrow>
              <IconButton
                className={c.copy2clipboard}
                onClick={() => {
                  if (token) {
                    copyToClipboard(token);
                    dispatch(
                      setSnackBarText({
                        text: "Copied to Clipboard!",
                        severity: "success",
                      })
                    );
                  }
                }}
              >
                <ContentPasteIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </div>

          <div className={c.tokenList}>
            <div className={c.tokenListHeader}>
              <div>ID</div>
              <div>Token</div>
              <div>Created By</div>
              <div>Mission Access</div>
              <div>Created At</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {tokenList.map((t) => {
              // Handle legacy tokens without creator info
              const isLegacyToken = !t.created_by_user_id;
              
              let expires = "";
              let expireType = "";
              let expireColor = "black";
              
              if (isLegacyToken) {
                expireType = "Blocked";
                expireColor = "#d22d2d";
                expires = "blocked";
              } else if (t.period === "never") {
                expires = "never expires";
                expireType = "Active";
                expireColor = "#77d22d";
              } else {
                const timeDif = Date.now() - new Date(t.createdAt).getTime();
                const timePeriod = parseInt(t.period);
                if (timeDif >= timePeriod) {
                  expires = "expired";
                  expireType = "Expired";
                  expireColor = "#d22d2d";
                } else {
                  expires = `expires in ${(
                    (timePeriod - timeDif) /
                    86400000
                  ).toFixed(2)} days`;
                  expireType = "Active";
                  expireColor = "#77d22d";
                }
              }
              
              // Handle creator information
              const creatorDisplay = isLegacyToken ? "Legacy Token" : (t.created_by_username || "Unknown");
              
              // Handle mission access display
              let missionDisplay = "Unknown";
              if (isLegacyToken) {
                missionDisplay = "BLOCKED - Legacy token";
              } else if (t.created_by_permission === "111") {
                missionDisplay = "All Missions (SuperAdmin)";
              } else if (t.created_by_permission === "110") {
                const missions = t.created_by_missions || [];
                if (missions.length === 0) {
                  missionDisplay = "No missions assigned";
                } else if (missions.length <= 3) {
                  missionDisplay = missions.join(", ");
                } else {
                  missionDisplay = `${missions.slice(0, 2).join(", ")} +${missions.length - 2} more`;
                }
              } else {
                missionDisplay = "Not an admin";
              }

              return (
                <div className={c.tokenListItem} key={t.id}>
                  <div>{t.id}</div>
                  <div title={t.token}>{t.token}</div>
                  <div title={creatorDisplay}>{creatorDisplay}</div>
                  <div title={missionDisplay}>{missionDisplay}</div>
                  <div>{new Date(t.createdAt).toLocaleDateString()}</div>
                  <div>
                    <Tooltip title={expireType} placement="top" arrow>
                      <div style={{ background: expireColor }}></div>
                    </Tooltip>
                    <div>{expires}</div>
                  </div>
                  <div>
                    <IconButton
                      className={c.tokenDelete}
                      onClick={() => {
                        clearLongTermToken(t.id);
                      }}
                    >
                      <DeleteForeverIcon fontSize="inherit" />
                    </IconButton>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={c.examples}>
            <Typography variant="h5" component="h2" sx={{ color: 'inherit', fontWeight: 'bold', mb: 2, borderBottom: 1, borderColor: 'divider', pb: 1 }}>
              API Usage Examples
            </Typography>

            {apiExamples.map(renderExampleCard)}

            <Card className={c.docsCard}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'inherit' }}>
                  Documentation
                </Typography>
                <Box className={c.docsBox} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <div>Configure API:</div>
                    <Link 
                      href="https://nasa-ammos.github.io/MMGIS/apis/configure" 
                      target="_blank"
                      color="primary"
                      underline="hover"
                    >
                      https://nasa-ammos.github.io/MMGIS/apis/configure
                    </Link>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <div>GeoDatasets API:</div>
                    <Link 
                      href="https://nasa-ammos.github.io/MMGIS/apis/geodatasets" 
                      target="_blank"
                      color="primary"
                      underline="hover"
                    >
                      https://nasa-ammos.github.io/MMGIS/apis/geodatasets
                    </Link>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <div>All APIs:</div>
                    <Link 
                      href="https://nasa-ammos.github.io/MMGIS/apis/" 
                      target="_blank"
                      color="primary"
                      underline="hover"
                    >
                      https://nasa-ammos.github.io/MMGIS/apis/
                    </Link>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </div>
        </Box>
      </div>
    </div>
  );
}
