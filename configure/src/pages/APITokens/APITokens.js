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
    "& > div:nth-child(2)": { flex: 1, padding: "0px 16px" },
    "& > div:nth-child(3)": {
      fontFamily: "monospace",
      width: "190px",
      textAlign: "right",
      padding: "0px 16px",
      borderRight: `1px solid ${theme.palette.swatches.grey[700]}`,
    },
    "& > div:nth-child(4)": {
      width: "200px",
      padding: "0px 16px",
      textTransform: "uppercase",
      fontSize: "14px",
      display: "flex",
      "& > div:first-child": {
        width: "20px",
        height: "20px",
        margin: "13px 8px 13px 0px",
        borderRadius: "3px",
      },
    },
    "& > div:nth-child(5)": {
      borderLeft: `1px solid ${theme.palette.swatches.grey[700]}`,
      width: "42px",
      textAlign: "center",
    },
  },
  examples: {
    margin: "20px 0px",
    "& > ul": {
      listStyleType: "none",
      padding: "0px",
    },
    "& > ul > li > div:first-child": {
      fontWeight: "bold",
      padding: "10px 0px",
    },
  },
  examplesTitle: {
    fontSize: "20px",
    color: theme.palette.swatches.grey[150],
    borderBottom: `1px solid ${theme.palette.swatches.grey[150]}`,
    padding: "10px 0px",
    fontWeight: "bold",
  },
  code: {
    fontFamily: "monospace",
    padding: "8px",
    borderRadius: "4px",
    background: theme.palette.swatches.grey[900],
    wordBreak: "break-all",
  },
  content: {
    width: "100%",
    overflowY: "auto",
  },
}));

export default function APITokens() {
  const c = useStyles();

  const dispatch = useDispatch();

  const [tokenName, setTokenName] = useState(null);
  const [expireAfter, setExpireAfter] = useState("never");
  const [token, setToken] = useState(null);
  const [tokenList, setTokenList] = useState([]);

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
            "Generate an authentication token for programmatic control over the configuration and data endpoints. The generated token may be used it requests via the header: 'Authorization:Bearer <token>' and more information can be found at https://nasa-ammos.github.io/MMGIS/apis/configure#api-tokens"
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
            {tokenList.map((t) => {
              let expires = "";
              let expireType = "";
              let expireColor = "black";
              if (t.period === "never") {
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

              return (
                <div className={c.tokenListItem}>
                  <div>{t.id}</div>
                  <div>{t.token}</div>
                  <div>{t.createdAt}</div>
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
            <div className={c.examplesTitle}>Examples</div>
            <ul>
              <li>
                <div>General Usage</div>
                <div
                  className={c.code}
                >{`Make any configuration API call with the header "Authorization:Bearer ${
                  token != null ? token : "<token>"
                }" included.`}</div>
              </li>
              <li>
                <div>Uploading CSVs</div>
                <div
                  className={c.code}
                >{`curl -i -X POST -H "Authorization:Bearer ${
                  token != null ? token : "<token>"
                }" -F "name={dataset_name}" -F "upsert=true" -F "header=[\"File\",\"Target\",\"ShotNumber\",\"Distance(m)\",\"LaserPower\",\"SpectrumTotal\",\"SiO2\",\"TiO2\",\"Al2O3\",\"FeOT\",\"MgO\",\"CaO\",\"Na2O\",\"K2O\",\"Total\",\"SiO2_RMSEP\",\"TiO2_RMSEP\",\"Al2O3_RMSEP\",\"FeOT_RMSEP\",\"MgO_RMSEP\",\"CaO_RMSEP\",\"Na2O_RMSEP\",\"K2O_RMSEP\"]" -F "data=@{path/to.csv};type=text/csv" ${
                  document.location.origin
                }/api/datasets/upload`}</div>
              </li>
            </ul>
          </div>
        </Box>
      </div>
    </div>
  );
}
