import React, { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { makeStyles } from "@mui/styles";

import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Chip from "@mui/material/Chip";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Tooltip from "@mui/material/Tooltip";

import StorageIcon from "@mui/icons-material/Storage";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { getLayerTypeVisual } from "../../core/layerTypeVisuals";

const useStyles = makeStyles((theme) => ({
  DataFormats: {
    width: "100%",
    height: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexFlow: "column",
    background: theme.palette.swatches.grey[1000],
    boxSizing: "border-box",
    backgroundImage: "url(configure/build/gridlines.png)",
  },
  Inner: {
    width: "100%",
    height: "100%",
    overflowY: "auto",
    display: "flex",
    padding: "24px 32px 64px 32px",
    flexFlow: "column",
    boxSizing: "border-box",
  },
  article: {
    width: "100%",
    maxWidth: "760px",
    margin: "0 auto",
    display: "flex",
    flexFlow: "column",
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
  controls: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    margin: "8px 0px 16px 0px",
    flexWrap: "wrap",
  },
  search: {
    flex: "1 1 auto",
  },
  pageDescription: {
    color: theme.palette.swatches.grey[300],
    fontSize: "13px",
    lineHeight: "18px",
    marginBottom: "16px",
  },
  hint: {
    color: theme.palette.swatches.grey[300],
    fontSize: "13px",
    marginBottom: "12px",
  },
  formatRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    padding: "14px 16px",
    marginBottom: "10px",
    background: theme.palette.swatches.grey[900],
    border: `1px solid ${theme.palette.swatches.grey[850]}`,
    borderRadius: "8px",
    boxShadow: "0px 1px 3px rgba(0,0,0,0.35)",
  },
  card: {
    marginBottom: "10px !important",
    background: `${theme.palette.swatches.grey[900]} !important`,
    border: `1px solid ${theme.palette.swatches.grey[850]}`,
    borderRadius: "8px !important",
    boxShadow: "0px 1px 3px rgba(0,0,0,0.35) !important",
    overflow: "hidden",
    "&:before": { display: "none" },
  },
  formatToken: {
    flex: "0 0 200px",
    display: "flex",
    flexFlow: "column",
    color: theme.palette.swatches.grey[150],
  },
  formatTypeChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    alignItems: "center",
    justifyContent: "flex-end",
    marginLeft: "auto",
  },
  tokenName: {
    fontWeight: "bold",
    fontSize: "15px",
    wordBreak: "break-word",
  },
  tokenCategory: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: theme.palette.swatches.grey[400],
  },
  extLine: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    alignItems: "center",
    marginTop: "6px",
  },
  extLabel: {
    fontSize: "11px",
    color: theme.palette.swatches.grey[400],
    marginRight: "2px",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    alignItems: "center",
  },
  typeChip: {
    background: `${theme.palette.swatches.p[11]} !important`,
    color: "white !important",
    fontWeight: "bold !important",
  },
  accordionSummaryInner: {
    display: "flex",
    flexFlow: "column",
    width: "100%",
    gap: "6px",
  },
  typeTitle: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: theme.palette.swatches.grey[150],
    fontWeight: "bold",
    fontSize: "16px",
  },
  typeKey: {
    fontSize: "12px",
    color: theme.palette.swatches.grey[400],
  },
  entry: {
    padding: "8px 0px",
    borderTop: `1px solid ${theme.palette.swatches.grey[850]}`,
    color: theme.palette.swatches.grey[200],
  },
  entryLabel: {
    fontWeight: "bold",
    fontSize: "14px",
    marginBottom: "4px",
    color: theme.palette.swatches.grey[150],
  },
  entryDesc: {
    fontSize: "13px",
    marginBottom: "6px",
  },
  entryMeta: {
    fontSize: "12px",
    color: theme.palette.swatches.grey[300],
    marginTop: "4px",
    "& b": { color: theme.palette.swatches.grey[200] },
  },
  serviceBadge: {
    background: `${theme.palette.swatches.p[3]} !important`,
    color: "white !important",
    marginLeft: "6px !important",
  },
  empty: {
    color: theme.palette.swatches.grey[300],
    padding: "24px 12px",
    fontStyle: "italic",
  },
}));

// Collect the searchable format tokens for a single supportedData entry.
function entryTokens(entry) {
  return []
    .concat(entry.standards || [])
    .concat(entry.formats || [])
    .concat(entry.extensions || []);
}

// Prefer the dotted ".ext" form: drop a bare token ("dae") whenever its dotted
// equivalent (".dae") is also present, and sort what remains alphabetically.
function dedupeExts(exts) {
  const dotted = new Set(
    exts.filter((e) => e.startsWith(".")).map((e) => e.toLowerCase())
  );
  return exts
    .filter((e) => e.startsWith(".") || !dotted.has("." + e.toLowerCase()))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Display chips for an entry: keep standards (STAC, COG, …), then the
// deduped/sorted file extensions.
function entryDisplayChips(entry) {
  const standards = Array.isArray(entry.standards) ? entry.standards : [];
  const exts = dedupeExts(
    [].concat(entry.formats || []).concat(entry.extensions || [])
  );
  return [].concat(standards).concat(exts);
}

export default function DataFormats() {
  const c = useStyles();

  const layerTypeConfiguration = useSelector(
    (state) => state.core.layerTypeConfiguration
  );

  const [view, setView] = useState("format");
  const [search, setSearch] = useState("");

  const types = useMemo(() => {
    return Object.keys(layerTypeConfiguration || {})
      .map((typeId) => {
        const manifest = layerTypeConfiguration[typeId]?.manifest || {};
        return {
          typeId,
          name: manifest.name || typeId,
          supportedData: Array.isArray(manifest.supportedData)
            ? manifest.supportedData
            : [],
        };
      })
      .sort((a, b) => a.typeId.localeCompare(b.typeId));
  }, [layerTypeConfiguration]);

  // Group By Format around the format's *standard* (its heading), nesting its
  // file extensions/aliases beneath it rather than listing them as peer rows
  // (so "COLLADA" and ".dae" don't appear as two separate entries). Entries
  // with no declared standard fall back to their label as the heading.
  // name (lowercased) -> { name, category, exts:Set, typeIds:Set }
  const formatIndex = useMemo(() => {
    const index = {};
    types.forEach(({ typeId, supportedData }) => {
      supportedData.forEach((entry) => {
        const standards = Array.isArray(entry.standards)
          ? entry.standards
          : [];
        const exts = []
          .concat(entry.formats || [])
          .concat(entry.extensions || []);
        const names = standards.length
          ? standards
          : [entry.label || "(unnamed)"];
        names.forEach((raw) => {
          const key = String(raw).toLowerCase();
          if (!index[key]) {
            index[key] = {
              name: String(raw),
              category: entry.category || "",
              exts: new Set(),
              typeIds: new Set(),
            };
          }
          exts.forEach((e) => index[key].exts.add(String(e)));
          index[key].typeIds.add(typeId);
        });
      });
    });
    return Object.values(index)
      .map((f) => ({ ...f, exts: dedupeExts(Array.from(f.exts)) }))
      .sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
  }, [types]);

  const q = search.trim().toLowerCase();

  // A layer-type chip colored by that type's manifest color, with its icon.
  const renderTypeChip = (typeId) => {
    const { color, Icon } = getLayerTypeVisual(layerTypeConfiguration, typeId);
    return (
      <Chip
        key={typeId}
        size="small"
        icon={<Icon style={{ color: "white", fontSize: "15px" }} />}
        label={typeId}
        sx={{
          backgroundColor: color,
          color: "white",
          fontWeight: "bold",
          "& .MuiChip-icon": { color: "white" },
        }}
      />
    );
  };

  const filteredFormats = useMemo(() => {
    if (!q) return formatIndex;
    return formatIndex.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.exts.some((e) => e.toLowerCase().includes(q)) ||
        Array.from(f.typeIds).some((t) => t.toLowerCase().includes(q))
    );
  }, [formatIndex, q]);

  const filteredTypes = useMemo(() => {
    if (!q) return types;
    return types
      .map((t) => {
        if (
          t.typeId.toLowerCase().includes(q) ||
          String(t.name).toLowerCase().includes(q)
        )
          return t;
        const supportedData = t.supportedData.filter((entry) => {
          const haystack = [entry.label, entry.category, entry.description]
            .concat(entryTokens(entry))
            .filter((v) => typeof v === "string")
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        });
        return { ...t, supportedData };
      })
      .filter((t) => t.supportedData.length > 0);
  }, [types, q]);

  const renderByFormat = () =>
    filteredFormats.length === 0 ? (
      <div className={c.empty}>
        {q
          ? `No formats match “${search}”.`
          : "No layer type data formats are available yet."}
      </div>
    ) : (
      filteredFormats.map((f) => (
        <div className={c.formatRow} key={f.name}>
          <div className={c.formatToken}>
            <span className={c.tokenName}>{f.name}</span>
            {f.category ? (
              <span className={c.tokenCategory}>{f.category}</span>
            ) : null}
            {f.exts.length > 0 ? (
              <div className={c.extLine}>
                <span className={c.extLabel}>extensions:</span>
                {f.exts.map((e) => (
                  <Chip
                    key={e}
                    size="small"
                    variant="outlined"
                    label={e}
                  />
                ))}
              </div>
            ) : null}
          </div>
          <div className={c.formatTypeChips}>
            {Array.from(f.typeIds)
              .sort()
              .map((typeId) => renderTypeChip(typeId))}
          </div>
        </div>
      ))
    );

  const renderByType = () =>
    filteredTypes.length === 0 ? (
      <div className={c.empty}>
        {q
          ? `No layer types match “${search}”.`
          : "No layer types are available yet."}
      </div>
    ) : (
      filteredTypes.map((t) => {
        const standards = Array.from(
          new Set(
            t.supportedData.reduce(
              (acc, entry) => acc.concat(entry.standards || []),
              []
            )
          )
        );
        const exts = dedupeExts(
          Array.from(
            new Set(
              t.supportedData.reduce(
                (acc, entry) =>
                  acc
                    .concat(entry.formats || [])
                    .concat(entry.extensions || []),
                []
              )
            )
          )
        );
        const summaryChips = standards.concat(exts);
        const { color: typeColor, Icon: TypeIcon } = getLayerTypeVisual(
          layerTypeConfiguration,
          t.typeId
        );
        return (
          <Accordion
            key={`${t.typeId}:${q ? "search" : ""}`}
            className={c.card}
            defaultExpanded={Boolean(q)}
            disableGutters
            style={{ borderLeft: `4px solid ${typeColor}` }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <div className={c.accordionSummaryInner}>
                <div className={c.typeTitle}>
                  <TypeIcon style={{ color: typeColor, fontSize: "20px" }} />
                  <span>{t.name}</span>
                </div>
                <div className={c.chips}>
                  {summaryChips.length === 0 ? (
                    <span className={c.tokenCategory}>
                      No declared data formats
                    </span>
                  ) : (
                    summaryChips.map((token) => (
                      <Chip
                        key={token}
                        size="small"
                        variant="outlined"
                        label={token}
                      />
                    ))
                  )}
                </div>
              </div>
            </AccordionSummary>
            <AccordionDetails>
              {t.supportedData.map((entry, i) => (
                <div className={c.entry} key={`${t.typeId}-${i}`}>
                  <div className={c.entryLabel}>
                    {entry.label || "(unlabeled)"}
                    {Array.isArray(entry.requiresServices)
                      ? entry.requiresServices.map((svc) => (
                          <Tooltip
                            key={svc}
                            title={`Requires the ${svc} adjacent service`}
                          >
                            <Chip
                              className={c.serviceBadge}
                              size="small"
                              label={`requires: ${svc}`}
                            />
                          </Tooltip>
                        ))
                      : null}
                  </div>
                  {entry.description ? (
                    <div className={c.entryDesc}>{entry.description}</div>
                  ) : null}
                  <div className={c.chips}>
                    {entryDisplayChips(entry).map((token) => (
                      <Chip
                        key={token}
                        size="small"
                        variant="outlined"
                        label={token}
                      />
                    ))}
                  </div>
                  {Array.isArray(entry.urlSchemes) &&
                  entry.urlSchemes.length > 0 ? (
                    <div className={c.entryMeta}>
                      <b>URL: </b>
                      {entry.urlSchemes.join("  •  ")}
                    </div>
                  ) : null}
                  {entry.procurement ? (
                    <div className={c.entryMeta}>
                      <b>Procurement: </b>
                      {entry.procurement}
                    </div>
                  ) : null}
                </div>
              ))}
            </AccordionDetails>
          </Accordion>
        );
      })
    );

  return (
    <div className={c.DataFormats}>
      <Toolbar className={c.topbar}>
        <div className={c.topbarTitle}>
          <StorageIcon />
          <Typography
            sx={{ flex: "1 1 100%" }}
            style={{ fontWeight: "bold", fontSize: "16px", lineHeight: "29px" }}
            variant="h6"
            component="div"
          >
            Data Formats
          </Typography>
        </div>
      </Toolbar>
      <div className={c.Inner}>
        <div className={c.article}>
        <div className={c.pageDescription}>
          A reference of the data formats and standards each layer type can
          render — look up a format to find which layer types support it, or
          browse a layer type to see everything it accepts and how to procure
          it.
        </div>
        <div className={c.controls}>
          <ToggleButtonGroup
            value={view}
            exclusive
            size="small"
            onChange={(e, next) => {
              if (next) setView(next);
            }}
          >
            <ToggleButton value="format">By Format</ToggleButton>
            <ToggleButton value="type">By Layer Type</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            className={c.search}
            size="small"
            variant="outlined"
            placeholder={
              view === "format"
                ? "Search a format (e.g. COG, GeoJSON, mp4)…"
                : "Search a layer type or format…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </div>
        {view === "format" ? renderByFormat() : renderByType()}
        </div>
      </div>
    </div>
  );
}
