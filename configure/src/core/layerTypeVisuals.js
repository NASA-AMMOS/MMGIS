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

// Resolve the MUI icon component for a manifest `defaultIcon` name.
export function getLayerTypeIcon(iconName) {
  return LAYER_TYPE_ICONS[iconName] || LayersIcon;
}

// Resolve { color, Icon } for a layer type id from the registry.
export function getLayerTypeVisual(layerTypeConfiguration, typeId) {
  const manifest =
    (layerTypeConfiguration && layerTypeConfiguration[typeId]?.manifest) || {};
  return {
    color: manifest.color || DEFAULT_LAYER_TYPE_COLOR,
    Icon: getLayerTypeIcon(manifest.defaultIcon),
  };
}
