// Shared resolver for a layer type's visual identity (color + icon), sourced
// from the layertype plugin.json manifests via the generated
// `layerTypeConfigs.json` registry (state.core.layerTypeConfiguration).
//
// Add a new icon here only if a layertype manifest references it by name in
// its `defaultIcon` field.

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import StorageIcon from "@mui/icons-material/Storage";
import PolylineIcon from "@mui/icons-material/Polyline";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import LanguageIcon from "@mui/icons-material/Language";
import GridViewIcon from "@mui/icons-material/GridView";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import AirIcon from "@mui/icons-material/Air";
import ImageIcon from "@mui/icons-material/Image";
import VideoFileIcon from "@mui/icons-material/VideoFile";
import HexagonIcon from "@mui/icons-material/Hexagon";
import LayersIcon from "@mui/icons-material/Layers";

const LAYER_TYPE_ICONS = {
  KeyboardArrowDown: KeyboardArrowDownIcon,
  Storage: StorageIcon,
  Polyline: PolylineIcon,
  TravelExplore: TravelExploreIcon,
  Language: LanguageIcon,
  GridView: GridViewIcon,
  ViewInAr: ViewInArIcon,
  Air: AirIcon,
  Image: ImageIcon,
  VideoFile: VideoFileIcon,
  Hexagon: HexagonIcon,
};

export const DEFAULT_LAYER_TYPE_COLOR = "#8899a6";

// Static fallback so built-in types render their real color/icon on first
// paint (and if the registry fetch fails), before/without the async
// layerTypeConfiguration. Kept in sync with each built-in's plugin.json; the
// registry manifest still takes precedence, and external types resolve from it.
const BUILTIN_LAYER_TYPE_VISUALS = {
  data: { color: "#c43541", defaultIcon: "Storage" },
  header: { color: "#2c2f30", defaultIcon: "KeyboardArrowDown" },
  image: { color: "#b0518f", defaultIcon: "Image" },
  model: { color: "#a98732", defaultIcon: "ViewInAr" },
  query: { color: "#4c8b2d", defaultIcon: "TravelExplore" },
  "3dtiles": { color: "#7a5c9e", defaultIcon: "Hexagon" },
  tile: { color: "#67401d", defaultIcon: "Language" },
  vector: { color: "#245980", defaultIcon: "Polyline" },
  vectortile: { color: "#0792c5", defaultIcon: "GridView" },
  velocity: { color: "#24807c", defaultIcon: "Air" },
  video: { color: "#7b2323", defaultIcon: "VideoFile" },
};

// Resolve the MUI icon component for a manifest `defaultIcon` name.
export function getLayerTypeIcon(iconName) {
  return LAYER_TYPE_ICONS[iconName] || LayersIcon;
}

// Resolve { color, Icon } for a layer type id. Manifest (registry) wins;
// otherwise fall back to the built-in table, then the neutral default.
export function getLayerTypeVisual(layerTypeConfiguration, typeId) {
  const manifest =
    (layerTypeConfiguration && layerTypeConfiguration[typeId]?.manifest) || {};
  const fallback = BUILTIN_LAYER_TYPE_VISUALS[typeId] || {};
  return {
    color: manifest.color || fallback.color || DEFAULT_LAYER_TYPE_COLOR,
    Icon: getLayerTypeIcon(manifest.defaultIcon || fallback.defaultIcon),
  };
}
