/**
 * legendToDynamicStyle — migrate legend-entry styling to `variables.dynamicStyle`.
 *
 * Legend entries used to double as a styling engine: an entry with
 * `styleMatching` coloured every feature whose `propertyName` held its
 * `propertyValue`, and a run of `continuous` entries interpolated between them.
 * Styling now lives in the layer's Style tab, is compiled once instead of
 * re-derived per feature, reaches the globe as well as the map, and can drive
 * weight and opacity too — so the entries describe the legend and nothing else.
 *
 * This converts the old declaration into the new one so an admin doesn't have
 * to retype it. The entries themselves are left alone: they still draw the
 * legend, they just no longer style anything.
 *
 * @module legendToDynamicStyle
 */

/** Legend entries that were styling features. */
export function stylingEntries(legend) {
  if (!Array.isArray(legend)) return [];
  return legend.filter(
    (entry) =>
      entry != null &&
      entry.styleMatching === true &&
      typeof entry.propertyName === "string" &&
      entry.propertyName !== "" &&
      entry.propertyValue !== undefined &&
      entry.propertyValue !== null &&
      entry.propertyValue !== "",
  );
}

const asNumber = (value) => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : null;
};

/**
 * One property's entries as up to two rules: the fill it coloured, and the
 * border it coloured (which the old engine took from `strokecolor`, falling
 * back to `color`).
 */
function rulesForProperty(property, entries) {
  const rules = [];
  const continuous = entries
    .filter(
      (e) => e.shape === "continuous" && asNumber(e.propertyValue) != null,
    )
    .map((e) => ({ ...e, at: asNumber(e.propertyValue) }))
    .sort((a, b) => a.at - b.at);

  if (continuous.length >= 2) {
    // The old engine put each colour at its own value's fraction of the scale,
    // so the stops carry where they sit: entries at 0, 10 and 100 are not three
    // evenly spaced colours. The domain comes from the entries that actually
    // contributed a colour, since a colourless one shifts neither end.
    const placed = (colored) => {
      const stops = continuous.filter((e) => colored(e));
      if (stops.length < 2) return null;
      const min = stops[0].at;
      const max = stops[stops.length - 1].at;
      if (min === max) return null;
      return {
        domain: { source: "literal", min, max },
        ramp: stops.map((e) => ({
          position: (e.at - min) / (max - min),
          color: colored(e),
        })),
      };
    };

    const fill = placed((e) => e.color || null);
    const stroke = placed((e) => e.strokecolor || e.color || null);
    if (fill != null)
      rules.push({
        property,
        attribute: "fillColor",
        type: "numeric",
        ramp: fill.ramp,
        domain: fill.domain,
      });
    if (stroke != null)
      rules.push({
        property,
        attribute: "color",
        type: "numeric",
        ramp: stroke.ramp,
        domain: stroke.domain,
      });
  }

  const discrete = entries.filter((e) => e.shape !== "continuous");
  if (discrete.length > 0) {
    const fill = discrete
      .filter((e) => e.color)
      .map((e) => ({
        value: String(e.propertyValue),
        color: e.color,
        label: e.value,
      }));
    const stroke = discrete
      .filter((e) => e.strokecolor || e.color)
      .map((e) => ({
        value: String(e.propertyValue),
        color: e.strokecolor || e.color,
        label: e.value,
      }));
    if (fill.length > 0)
      rules.push({
        property,
        attribute: "fillColor",
        type: "categorical",
        mappings: fill,
      });
    if (stroke.length > 0)
      rules.push({
        property,
        attribute: "color",
        type: "categorical",
        mappings: stroke,
      });
  }

  return rules;
}

/**
 * A layer's legend entries as a dynamic style, or null if none of them styled
 * anything.
 *
 * @param {Array<object>} legend  `variables.legend`
 * @returns {{enabled: boolean, rules: Array<object>}|null}
 */
export function legendToDynamicStyle(legend) {
  const styling = stylingEntries(legend);
  if (styling.length === 0) return null;

  const byProperty = new Map();
  for (const entry of styling) {
    if (!byProperty.has(entry.propertyName))
      byProperty.set(entry.propertyName, []);
    byProperty.get(entry.propertyName).push(entry);
  }

  const rules = [];
  for (const [property, entries] of byProperty)
    rules.push(...rulesForProperty(property, entries));

  return rules.length === 0 ? null : { enabled: true, rules };
}

const LegendToDynamicStyle = {
  legendToDynamicStyle,
  stylingEntries,
};

export default LegendToDynamicStyle;
