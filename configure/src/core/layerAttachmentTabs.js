// Attachment settings live on the host layer's config, but they belong to the
// attachment plugins — so the Layer modal's attachment tabs are composed from
// the `layerAttachmentConfigs.json` registry rather than pasted into each layer
// type's metaconfig. An attachment contributes rows to a named tab; several
// attachments share one (bearings, images, models and uncertainties are all
// configured on markers), which is why it declares a tab and an order in it
// rather than owning a whole tab.

/**
 * Whether an attachment applies to a layer type. An attachment that names its
 * hosts also applies to a type that `extends` one of them, matching how the
 * runtime decides which attachments a host gets.
 */
function appliesTo(manifest, layerType, parentType) {
  const applicable = manifest?.applicableLayerTypes;
  if (!applicable) return true;
  return (
    applicable.includes(layerType) ||
    (parentType != null && applicable.includes(parentType))
  );
}

/**
 * The metaconfig tabs a layer type's attachments contribute, in display order.
 *
 * @param {Object} layerAttachmentConfiguration  layerAttachmentConfigs.json
 * @param {Object} layerTypeConfiguration        layerTypeConfigs.json
 * @param {string} layerType
 * @returns {Array} tabs in metaconfig shape ({ name, rows })
 */
export function attachmentTabsFor(
  layerAttachmentConfiguration,
  layerTypeConfiguration,
  layerType,
) {
  if (layerType == null) return [];
  const parentType =
    layerTypeConfiguration?.[layerType]?.manifest?.extends ?? null;

  const contributions = [];
  Object.values(layerAttachmentConfiguration || {}).forEach((entry) => {
    const metaconfig = entry?.metaconfig;
    if (!metaconfig || !Array.isArray(metaconfig.rows)) return;
    if (!appliesTo(entry.manifest, layerType, parentType)) return;
    contributions.push(metaconfig);
  });

  const tabs = [];
  const byName = {};
  contributions
    .slice()
    .sort(
      (a, b) =>
        (a.tabOrder ?? Infinity) - (b.tabOrder ?? Infinity) ||
        String(a.tab).localeCompare(String(b.tab)) ||
        (a.order ?? Infinity) - (b.order ?? Infinity),
    )
    .forEach((metaconfig) => {
      const name = metaconfig.tab;
      if (byName[name] == null) {
        byName[name] = { name, rows: [] };
        tabs.push(byName[name]);
      }
      byName[name].rows.push(...metaconfig.rows);
    });

  return tabs;
}

/**
 * Every config path owned by a registered attachment.
 *
 * The Layer modal trims a layer's values to the fields its tabs rendered, so
 * settings belonging to an attachment that this layer type doesn't show would
 * otherwise be dropped on save.
 */
export function attachmentConfigPaths(layerAttachmentConfiguration) {
  return Object.values(layerAttachmentConfiguration || {})
    .map((entry) => entry?.manifest?.configPath)
    .filter((p) => typeof p === "string" && p.length > 0);
}
