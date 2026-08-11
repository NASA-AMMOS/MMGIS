import React, { useCallback, useEffect, useRef, useState } from "react";

import ColorRampPicker from "@design/components/ColorRampPicker/ColorRampPicker";
import { normalizeStops, rampStops } from "@basics/Layers_/render/dynamicStyle";
import { formatValue } from "@basics/Layers_/render/dynamicStyleLegend";
import {
  hexToRgb,
  interpolateMultipleColors,
  parseRgb,
} from "@basics/Layers_/render/gradientUtils";
import {
  data as colormapData,
  evaluate_cmap,
} from "@external/js-colormaps/js-colormaps.js";

import "./DynamicStyleRamp.css";

/**
 * The colour ramps offered at runtime: the perceptual, sequential and diverging
 * matplotlib maps that are actually legible for data, rather than all ~170 of
 * them. A layer configured with something else keeps it - the list is what's
 * easy to reach for, not what's allowed.
 */
export const RUNTIME_RAMPS = [
  "viridis",
  "plasma",
  "inferno",
  "magma",
  "cividis",
  "turbo",
  "Blues",
  "Greens",
  "Oranges",
  "Reds",
  "Purples",
  "YlGnBu",
  "YlOrRd",
  "RdYlGn",
  "RdYlBu",
  "RdBu",
  "BrBG",
  "PiYG",
  "coolwarm",
  "Spectral",
  "Greys",
];

/** Beyond this the bins are narrower than the boundaries drawn between them. */
const MAX_BINS = 20;

/** Beyond this many bins the values would be labelling each other over. */
const MAX_LABELLED_BINS = 8;

/** How many points a named colormap is sampled at to draw its swatch. */
const SWATCH_SAMPLES = 16;

function rampColors(name) {
  if (!(name in colormapData)) return null;
  const colors = [];
  for (let i = 0; i < SWATCH_SAMPLES; i++) {
    const [r, g, b] = evaluate_cmap(i / (SWATCH_SAMPLES - 1), name, false);
    colors.push([r / 255, g / 255, b / 255]);
  }
  return colors;
}

/** The name given to a ramp that carries its own colours rather than a name. */
export const CUSTOM_RAMP = "custom";

/** A converted legend's own colours, sampled the way a colormap's are. */
function customRampColors(ramp) {
  const stops = rampStops(ramp, false);
  if (stops.length === 0) return null;
  const colors = [];
  for (let i = 0; i < SWATCH_SAMPLES; i++) {
    const color = interpolateMultipleColors(
      stops,
      i / (SWATCH_SAMPLES - 1),
      0,
      1,
    );
    const rgb = hexToRgb(color) || parseRgb(color);
    if (rgb == null) return null;
    colors.push([rgb.r / 255, rgb.g / 255, rgb.b / 255]);
  }
  return colors;
}

/**
 * The ramps to show, with the layer's current one included even when it isn't
 * one we suggest - including a converted legend's own list of colours, which
 * has no name to look up.
 */
function rampsFor(current) {
  const custom = Array.isArray(current) ? customRampColors(current) : null;
  const names = RUNTIME_RAMPS.includes(current)
    ? RUNTIME_RAMPS
    : [current, ...RUNTIME_RAMPS];
  const ramps = names
    .map((name) => ({ name, label: name, colors: rampColors(name) }))
    .filter((ramp) => ramp.colors != null);
  if (custom == null) return ramps;
  return [{ name: CUSTOM_RAMP, label: "Custom", colors: custom }, ...ramps];
}

/** The even split - what bin boundaries are before anyone moves them. */
function evenStops(bins) {
  const stops = [];
  for (let i = 1; i < bins; i++) stops.push(i / bins);
  return stops;
}

function isEven(stops, bins) {
  const even = evenStops(bins);
  return (
    stops == null ||
    stops.length !== even.length ||
    stops.every((s, i) => Math.abs(s - even[i]) < 1e-6)
  );
}

/**
 * A layer's ramp and its bins, as they are being looked at right now.
 *
 * The ramp is chosen from its own colours rather than from a list of names, and
 * where one bin ends and the next begins can be dragged - a scale whose data is
 * bunched at one end is the normal case, and an even split renders most of it
 * as one colour. Nothing here is written to the layer's configuration; the
 * caller applies it as a session override.
 *
 * @param {object} props
 * @param {string} props.ramp
 * @param {number} props.bins       0 for a smooth gradient.
 * @param {number[]} [props.stops]  Bin boundaries as fractions of the domain.
 * @param {object} [props.domain]   {min, max} the fractions are read against.
 * @param {function} props.onChange Called with an override, e.g. `{ramp}`.
 */
export default function DynamicStyleRamp({
  ramp,
  bins,
  stops,
  domain,
  onChange,
}) {
  const barRef = useRef(null);
  const draggedRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [live, setLive] = useState(null);

  const ramps = rampsFor(ramp);
  const selected = Array.isArray(ramp) ? CUSTOM_RAMP : ramp;
  const colors = (ramps.find((r) => r.name === selected) || ramps[0])?.colors;
  // Boundaries that don't describe this many bins are the ones the renderer
  // refuses, so the editor shows the even split it falls back to.
  const applied =
    bins > 1 ? normalizeStops(stops, bins) || evenStops(bins) : [];
  const current = live || applied;

  const gradient = buildGradient(colors, bins, current);
  // A fraction of the scale means little on its own, so each boundary is
  // labelled with the value it falls at.
  const at = valueAt(domain);

  const onGrab = useCallback(
    (e, index) => {
      e.preventDefault();
      draggedRef.current = [...current];
      setLive(draggedRef.current);
      setDragging(index);
    },
    [current],
  );

  useEffect(() => {
    if (dragging == null) return;
    const onMove = (e) => {
      const bar = barRef.current;
      if (bar == null) return;
      const rect = bar.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      setLive((previous) => {
        if (previous == null) return previous;
        const next = [...previous];
        const gap = 0.02;
        const low = dragging === 0 ? gap : next[dragging - 1] + gap;
        const high =
          dragging === next.length - 1 ? 1 - gap : next[dragging + 1] - gap;
        next[dragging] = Math.max(low, Math.min(high, x));
        draggedRef.current = next;
        return next;
      });
    };
    const onRelease = () => {
      const settled = draggedRef.current;
      setDragging(null);
      draggedRef.current = null;
      if (settled) onChange({ stops: settled });
      setLive(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onRelease);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onRelease);
    };
  }, [dragging, onChange]);

  return (
    <div className="dynamicStyleRampControls">
      <div className="dynamicStyleRampRow">
        <div title="The colour ramp the property is mapped through.">Ramp</div>
        <div className="dynamicStyleRampPicker">
          <ColorRampPicker
            value={selected}
            ramps={ramps}
            // The layer's settings pane clips what overflows it.
            portal
            onValueChange={(name) =>
              onChange({ ramp: name === CUSTOM_RAMP ? ramp : name })
            }
          />
        </div>
      </div>
      <div className="dynamicStyleRampRow">
        <div
          title={`Divides the scale into flat bins instead of a smooth gradient. 0 for a gradient, ${MAX_BINS} at most.`}
        >
          Bins
        </div>
        <input
          className="dynamicStyleBins"
          type="number"
          min="0"
          max={MAX_BINS}
          step="1"
          value={bins}
          onChange={(e) => {
            const next = parseInt(e.target.value, 10);
            const count =
              Number.isFinite(next) && next > 0 ? Math.min(next, MAX_BINS) : 0;
            onChange({
              discrete: count > 0,
              bins: count > 0 ? count : null,
              // Boundaries describe a bin count, so they don't
              // survive one changing.
              stops: null,
            });
          }}
        />
      </div>
      {bins > 1 && (
        <div className="dynamicStyleStopBar" ref={barRef}>
          <div
            className="dynamicStyleStopGradient"
            style={{ background: gradient }}
          />
          {current.map((stop, index) => (
            <div
              key={index}
              className={`dynamicStyleStop${
                dragging === index ? " dragging" : ""
              }`}
              style={{ left: `${stop * 100}%` }}
              onMouseDown={(e) => onGrab(e, index)}
              title="Drag to move where this bin ends."
            >
              {at != null &&
                (bins <= MAX_LABELLED_BINS || dragging === index) && (
                  <div className="dynamicStyleStopValue">{at(stop)}</div>
                )}
            </div>
          ))}
          {at != null && (
            <>
              <div className="dynamicStyleStopValue end low">{at(0)}</div>
              <div className="dynamicStyleStopValue end high">{at(1)}</div>
            </>
          )}
          <div
            className={`dynamicStyleStopReset${
              isEven(current, bins) ? " even" : ""
            }`}
            title="Even bins"
            onClick={() => onChange({ stops: null })}
          >
            <i className="mdi mdi-backup-restore mdi-14px" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Reads a fraction of the scale as the value it sits at, or null when the rule
 * has no numeric domain to read against (a categorical one, or one whose
 * domain hasn't resolved yet).
 */
function valueAt(domain) {
  const min = Number(domain?.min);
  const max = Number(domain?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return (fraction) => formatValue(min + (max - min) * fraction);
}

/**
 * The ramp as a CSS gradient: smooth, or one flat block per bin between the
 * boundaries as they currently sit.
 */
function buildGradient(colors, bins, stops) {
  if (colors == null || colors.length === 0) return "transparent";
  const n = colors.length - 1;
  const rgb = (t) => {
    const scaled = Math.max(0, Math.min(1, t)) * n;
    const lo = Math.min(Math.floor(scaled), n);
    const hi = Math.min(lo + 1, n);
    const f = scaled - lo;
    const c = [0, 1, 2].map((i) =>
      Math.round((colors[lo][i] + (colors[hi][i] - colors[lo][i]) * f) * 255),
    );
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };

  const parts = [];
  if (bins > 1) {
    for (let i = 0; i < bins; i++) {
      const from = i === 0 ? 0 : stops[i - 1];
      const to = i === bins - 1 ? 1 : stops[i];
      const color = rgb((i + 0.5) / bins);
      parts.push(`${color} ${(from * 100).toFixed(1)}%`);
      parts.push(`${color} ${(to * 100).toFixed(1)}%`);
    }
  } else {
    const steps = 32;
    for (let i = 0; i <= steps; i++)
      parts.push(`${rgb(i / steps)} ${((i / steps) * 100).toFixed(1)}%`);
  }
  return `linear-gradient(to right, ${parts.join(", ")})`;
}
