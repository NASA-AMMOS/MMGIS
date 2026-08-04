const interactionOrder = (a, b) =>
  (a.order || 0) - (b.order || 0) ||
  (a.name || a.interactionId).localeCompare(b.name || b.interactionId);

const getApplicableInteractions = (
  interactionConfigs,
  layerType,
  event,
  phase
) =>
  Object.values(interactionConfigs || {}).filter((interaction) => {
    const layerTypes = interaction.applicableLayerTypes || [];
    const events = interaction.applicableEvents || [];
    return (
      interaction.phase === phase &&
      events.includes(event) &&
      layerTypes.includes(layerType)
    );
  });

const getKindOptions = (interactionConfigs, layerType) => {
  const aliases = new Set();
  getApplicableInteractions(
    interactionConfigs,
    layerType,
    "click",
    "main"
  ).forEach((interaction) => {
    (interaction.kindAlias || []).forEach((alias) => aliases.add(alias));
  });
  return ["none", ...Array.from(aliases).sort()];
};

const getKindPipeline = (interactionConfigs, layerType, kind) =>
  getApplicableInteractions(
    interactionConfigs,
    layerType,
    "click",
    "main"
  )
    .filter((interaction) => (interaction.kindAlias || []).includes(kind))
    .sort(interactionOrder)
    .map((interaction) => interaction.interactionId);

const getSuppressionSources = (interactionConfigs, interactionIds) => {
  const configsById = Object.values(interactionConfigs || {}).reduce(
    (byId, interaction) => {
      byId[interaction.interactionId] = interaction;
      return byId;
    },
    {}
  );
  return (interactionIds || []).reduce((suppressed, interactionId) => {
    const interaction = configsById[interactionId];
    (interaction?.suppresses || []).forEach((suppressedId) => {
      suppressed[suppressedId] = interaction.name || interactionId;
    });
    return suppressed;
  }, {});
};

// The rows an interaction is configured by, if it has any. Settings mean
// nothing without the `configPath` core reads them back out of.
const getSettingsRows = (interaction) => {
  const rows = interaction?.config?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return typeof interaction.configPath === "string" ? rows : null;
};

const withClickPipeline = (interactions, clickPipeline) => {
  const next =
    interactions != null && typeof interactions === "object"
      ? { ...interactions }
      : {};
  if (clickPipeline == null) delete next.click;
  else next.click = clickPipeline;
  return Object.keys(next).length > 0 ? next : null;
};

export {
  getApplicableInteractions,
  getKindOptions,
  getKindPipeline,
  getSettingsRows,
  getSuppressionSources,
  interactionOrder,
  withClickPipeline,
};
