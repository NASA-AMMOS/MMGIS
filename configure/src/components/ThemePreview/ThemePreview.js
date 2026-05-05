import React from "react";
import { useSelector } from "react-redux";
import { makeStyles } from "@mui/styles";
import { themes } from "../../themes/themes";

const PREVIEW_WIDTH = 300;
const PREVIEW_HEIGHT = 200;

const useStyles = makeStyles(() => ({
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "6px",
    marginTop: "-12px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.55)",
  },
  preview: {
    width: `${PREVIEW_WIDTH}px`,
    height: `${PREVIEW_HEIGHT}px`,
    position: "relative",
    borderRadius: "8px",
    overflow: "hidden",
    fontFamily: "roboto, sans-serif",
    boxSizing: "border-box",
  },
  topbar: {
    height: "28px",
    width: "100%",
    display: "flex",
    alignItems: "center",
    padding: "0 10px",
    boxSizing: "border-box",
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.4px",
    position: "relative",
    zIndex: 3,
  },
  body: {
    position: "absolute",
    top: "28px",
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
  },
  toolbar: {
    width: "32px",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "8px 0",
    gap: "8px",
    boxSizing: "border-box",
    position: "relative",
    zIndex: 2,
  },
  toolIcon: {
    width: "16px",
    height: "16px",
    borderRadius: "3px",
  },
  mapArea: {
    flex: 1,
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },
  panel: {
    position: "absolute",
    top: "10px",
    left: "10px",
    width: "120px",
    bottom: "10px",
    borderRadius: "6px",
    padding: "8px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  panelTitle: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.3px",
  },
  panelText: {
    fontSize: "9px",
    lineHeight: "1.3",
  },
  accentDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
    marginRight: "6px",
    verticalAlign: "middle",
  },
  panelRow: {
    display: "flex",
    alignItems: "center",
  },
}));

export default function ThemePreview() {
  const c = useStyles();

  const themeName = useSelector(
    (state) =>
      state.core?.configuration?.look?.theme || "Dark Default"
  );

  const theme = themes[themeName] || themes["Dark Default"];

  const surface = theme["--color-a"];
  const surfaceElevated = theme["--color-a1"];
  const surfaceBackground = theme["--color-a-5"];
  const accent = theme["--color-mmgis"] || theme["--color-c"];
  const textPrimary = theme["--color-f"];
  const textSecondary = theme["--color-a4"];
  const border = theme["--color-a1"];
  const shadow = theme["--color-shadow"] || "rgba(0, 0, 0, 0.4)";

  return (
    <div className={c.wrapper}>
      <div className={c.label}>Theme Preview — {themeName}</div>
      <div
        className={c.preview}
        style={{
          background: surfaceBackground,
          border: `1px solid ${border}`,
          boxShadow: `0 4px 12px ${shadow}`,
        }}
      >
        <div
          className={c.topbar}
          style={{
            background: surface,
            color: textPrimary,
            borderBottom: `1px solid ${border}`,
            boxShadow: `0 2px 6px ${shadow}`,
          }}
        >
          <span style={{ marginRight: "auto" }}>MMGIS</span>
          <span
            className={c.accentDot}
            style={{ background: accent, marginRight: 0 }}
          />
        </div>
        <div className={c.body}>
          <div
            className={c.toolbar}
            style={{
              background: surface,
              borderRight: `1px solid ${border}`,
              boxShadow: `2px 0 6px ${shadow}`,
            }}
          >
            <div className={c.toolIcon} style={{ background: accent }} />
            <div
              className={c.toolIcon}
              style={{ background: textSecondary, opacity: 0.7 }}
            />
            <div
              className={c.toolIcon}
              style={{ background: textSecondary, opacity: 0.5 }}
            />
          </div>
          <div className={c.mapArea} style={{ background: surfaceBackground }}>
            <div
              className={c.panel}
              style={{
                background: surface,
                border: `1px solid ${border}`,
                boxShadow: `0 4px 12px ${shadow}`,
              }}
            >
              <div className={c.panelTitle} style={{ color: textPrimary }}>
                Tool Panel
              </div>
              <div className={c.panelRow} style={{ color: textPrimary }}>
                <span
                  className={c.accentDot}
                  style={{ background: accent }}
                />
                <span className={c.panelText}>Active layer</span>
              </div>
              <div className={c.panelText} style={{ color: textSecondary }}>
                Secondary text sample
              </div>
              <div
                style={{
                  marginTop: "auto",
                  height: "20px",
                  borderRadius: "4px",
                  background: surfaceElevated,
                  border: `1px solid ${border}`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
