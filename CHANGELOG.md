# MMGIS Changelog

## Unreleased

_TBD_

## 5.0.0

_May 1, 2026_

#### Summary

This major release modernizes the MMGIS frontend by migrating core UI infrastructure from jQuery/Materialize to React 18 and Base UI. The separated tools system has been fully rewritten as React components. The Ancillary directory has been dissolved and its components reorganized. A comprehensive mobile UI overhaul improves toolbar layout, TimeUI integration, and responsive positioning. A configurable theme system with High Contrast support has been added. The internal test infrastructure (Test_ module) has been removed in favor of the Playwright-based E2E framework. The Cesium 3D globe link button has been restyled and repositioned. Various bug fixes address TimeControl, Legend, modal, tooltip, and z-index issues.

### Compatibility

- **Mission configurations: Fully backward compatible.** No changes are required to existing mission configuration JSON files. All existing config fields (`separatedTool`, `look.*`, tool definitions, layer definitions, etc.) continue to work as before. The removed `justification` field is silently ignored if still present. New optional fields (`look.theme`, `look.primarycolor`, `look.secondarycolor`, `look.tertiarycolor`, `look.accentcolor`, `look.hightlightcolor`) are additive and do not need to be set.
- **JavaScript API (`window.mmgisAPI`): Fully backward compatible.** All documented public API functions remain unchanged. No migration needed for code using `mmgisAPI`.
- **End users: No breaking changes.** The application UI has been modernized but all user-facing functionality is preserved or improved. No retraining or workflow changes are needed.

### Migration Guide (Developers Only)

The following breaking changes affect **developers who maintain custom tool plugins, component plugins, or code that imports internal MMGIS modules**. They do NOT affect mission operators, end users, or mission configurations.

- **Breaking (Developers): Ancillary directory dissolved.** Components previously under `src/essence/Ancillary/` have been reorganized into nested locations under `src/essence/Basics/UserInterface_/components/`. Any custom plugin code importing from `Ancillary/` paths will need import path updates.
- **Breaking (Developers): jQuery UI components replaced with React.** Modal, Tooltip, Toast, Help, ContextMenu, and Coordinates components are now React-based. Any custom plugin code relying on jQuery selectors (e.g., `$('.modal')`, `$('.tooltipped')`) or Materialize CSS classes for these components will need updating to use the new React component APIs or DOM IDs.
- **Breaking (Developers): Separated tools system rewritten.** The separated/floating tools system is now React-based. Custom tools that used the old jQuery-based separated tools DOM API will need migration. The tool module interface (`make()`, `destroy()`, `initialize()`, `finalize()`) is unchanged — only the DOM container rendering has changed.
- **Breaking (Developers): Test_ module removed.** The internal `Test_` module, `testModules`, and `DrawTool.test` have been removed. Use the Playwright-based E2E test framework (`tests/e2e/`) instead.

#### Added

- React 18 and Base UI as core frontend framework (PR #49)
- Proper Toast notification component replacing ~69 ad-hoc CursorInfo toast calls
- Configurable theme system with High Contrast theme via Configure page UI tab
- Custom theme mode with `enableWhenField` support in Configure
- `.knowledge/` directory with AI agent knowledge architecture (PR #52)
- Legend empty state message when no legend items are present
- Hover effect on MMGIS logo (subtle background highlight)
- Per-layer fade control: time-enabled and shade/viewshed layers never fade
- Selective tile fade: fade on pan/zoom, instant on refresh/reload

#### Changed

- Migrated Ancillary UI components (Modal, Tooltip, Toast, Help, ContextMenu, Coordinates) from jQuery/Materialize to React 18 + Base UI (PR #49)
- Rewrote separated tools system from jQuery to React components (PR #51)
- Dissolved `Ancillary/` folder and reorganized components into nested structure
- Repositioned Viewer and Globe panel buttons to top-right
- Moved Cesium link button to top-right with Leaflet zoom button styling (PR #55)
- Anchored map logo to document.body to avoid CSS filter containing block issues (PR #56)
- Reverted tooltips to tippy.js for consistency
- Redesigned About modal
- Removed dead CSS: deleted `tools.css`, cleaned ~600 lines from `mmgisUI.css` and `mmgis.css`
- Removed `separatedTool/justification` config toggles (field silently ignored if present in existing configs)
- Removed separated tools offset logic from `Globe_.js`
- Updated docs to remove references to deleted test infrastructure (PR #57)

#### Fixed

- Mobile toolbar: 40px height, active button styling matching desktop, icon alignment (PR #50)
- Mobile TimeUI: overflow, panel height, expanded rows, Invalid date, isMobile detection (PR #50)
- Mobile topBar padding and hamburger menu positioning (PR #50)
- Mobile topBarTitleName text wrapping via `white-space: nowrap` (PR #58)
- Mobile scalebar/compass positioning at correct offset (PR #50)
- Mobile hotkeys hidden on mobile devices (PR #50)
- TimeUI dropdown z-index above tool panel
- TimeUI `#toggleTimeUI` click handler, tippy tooltip, and active class restoration
- TimeControl `.fina()` assignment operator used instead of comparison
- Legend empty message scoped to content container via targetId
- Legend duplicate ID issue
- IdentifierTool deactivation icon ID reference in `separateFromMMWebGIS`
- CurtainTool `destroy()` using undefined `ReactDOM.unmountComponentAtNode`
- Modal blur persistence and race condition during fade-out
- ContextMenu WKT null guard
- Help.jsx fetch error handling and HTML sanitization with DOMPurify
- CoordinatesDiv z-index
- `topBarTitleName` padding override specificity
- `toolPanelDrag` visibility when no tool is open
- `mapToolBar` pointer events, login padding, default tool, About modal order
- Session logout regression
- `defaulttooldropdown` case handler in `Maker.js`
- Circular import in `TimeUI.js`
- `--color-a3` text contrast
- StatusIndicator spacing and title attribute conflict with tippy tooltip
- Tool headers fixed to 40px height
- Various tool UI issues: ViewshedTool subheader, AnimationTool header, InfoTool close button

#### Removed

- Internal test infrastructure: `Test_` module, `testModules`, `DrawTool.test` (PR #53)
- `tools.css` and ~600 lines of dead CSS from `mmgisUI.css` and `mmgis.css`
- `separatedTool/justification` configuration toggles
- Separated tools offset logic from `Globe_.js`
- Stale `setShowUserCard` call in `handleLogout`

## 4.2.34

_April 2, 2026_

#### Summary

This release introduces beta CesiumJS integration as an alternative 3D globe renderer, a new Plugin Components system for extensible UI behaviors, and a Playwright-based end-to-end testing framework. The DrawTool gains DynamicExtent for viewport-based feature loading and a new Point template type. AnimationTool receives multiple improvements and STAC URL fixes. TimeControl is promoted to core infrastructure under Basics. New API callbacks and events expand extensibility (newActiveFeature, layersToolHeaderStateChange, madeLegendTool, viewer_open). Mobile mode sees significant improvements including configurable initial zoom, layout fixes, and a responsive login page. Security hardening includes adjacent servers placed behind authentication, npm audit fixes, and multiple vulnerability patches. The codebase is cleaned up with D3 largely removed, legacy scripts and files pruned, and an improved Dockerfile. Two new open-source components are released: AnalysisTool and OperationsClock.

#### Added

- Beta CesiumJS integration as an alternative 3D globe renderer (#810)
- Plugin Components system for lightweight, extensible UI behaviors (#849)
- AnalysisTool and OperationsClock released as open-source components (#904)
- Playwright end-to-end testing framework (#216)
- DrawTool DynamicExtent for viewport-based feature loading (#852)
- DrawTool Template for Point type (#843)
- DrawTool endpoint support via long-term tokens (#841)
- TiTiler layer support in Cesium Globe (#898)
- External MMGIS STAC catalog linking (#863)
- viewer_open as a new layer Kind (#855)
- Configurable initial zoom for mobile mode (#866)
- Latitude/Longitude option in coordinates display (#905)
- Callback for layersToolHeaderStateChange (#846)
- Callback for madeLegendTool (#858)
- Additional newActiveFeature events (#845)
- Font types as webpack assets (#874)
- AGENTS.md and spec-kit for AI development (#828)
- .gitattributes file (#901)

#### Changed

- Moved TimeControl from Ancillary/ to Basics/TimeControl\_/ to reflect its role as core infrastructure (#835)
- Breaking change for external plugins: Import path changed from 'Ancillary/TimeControl' to 'Basics/TimeControl\_/TimeControl'
- Removed D3 dependency (mostly) (#826)
- Improved Dockerfile with multi-stage build and reduced image size (#868)
- Upgraded all adjacent servers and sample ENVs (#897)
- Updated time and timetype metaconfigurations (#891)
- Removed redundant urlencoded middleware (#888)
- AnimationTool improvements including playback and UI enhancements (#856)
- Updated GitHub workflow: docker-build.yml (#917)
- Updated README.md (#913)

#### Fixed

- LegendTool overflow (#848)
- Viewer and globe splitter icons (#850)
- Time and Refresh Interval enabled layers incorrectly set to layernotfound (#853)
- AnimationTool STAC URLs (#860, #861, #867)
- Return value for layersToolHeaderStateChange event (#862)
- Bug in viewer_open kind (#865, #882)
- titiler-pgstac performance issue (#870)
- DynamicExtent + Threshold layers not properly updating (#871)
- Multiple mobile mode layout and interaction issues (#875, #878)
- Login page layout on smaller screens (#883)
- Initial Start and End Time configuration parameters (#886)
- Time Type = Local and Refresh Interval not working together (#889)
- queryTilesetTimes not updating on layer toggles (#892)
- DrawTool bugs: template field naming, not-null advanced filters (#895)
- DrawTool Templated Point origin point getting stuck (#909)
- updateClampedRasterForLayer is not a function error (#907)
- Image loading in OpenSeadragon (#899)
- Missions middleware (#914)
- Hover Feature Label and Layer Tags wrongly assigned (#915)
- Critical security vulnerabilities (#880, #884)

#### Removed

- Legacy jQuery/Materialize configure page and /configure-legacy route (#830)
- database/ directory containing old Docker Postgres migration scripts (#830)
- src/essence/Tools/\_OLD/ directory (#830)
- Dockerfile.legacy (#830)

#### Security

- npm audit fix (unforced) (#832)
- Adjacent servers placed behind authentication (#911)

## 4.1.0

_December 22, 2025_

#### Summary

This release introduces comprehensive STAC (SpatioTemporal Asset Catalog) support, a new mobile mode, the Animation Tool, and user account management with per-mission permissions. Major enhancements include an expanded timeline UI, live follow mode, feature style animations, and preliminary video support. The DrawTool gains templating from intersected GeoDatasets and advanced filtering capabilities. Legend and LayersTool receive significant improvements including custom marker icons, horizontal layouts, and enhanced filtering. TiTiler integration expands with planetcantile support and expression capabilities.

#### Added

- Comprehensive STAC support including catalogs, collections, and items
- STAC item management: show, delete, search (including regex), and bulk operations
- STAC UI import/export and collection metadata updates
- Mobile mode with TimeUI integration
- Animation Tool
- User Account Management with per-mission permissions
- Live Follow Mode with default configuration support
- Expanded Timeline view
- Feature Style Animations
- Preliminary Video Support
- DrawTool templating from intersected GeoDatasets
- DrawTool Advanced Filter Improvements
- Minimal GeoDataset Spatial Queries
- SSL database connections support
- Multiple Private Backends/Tools support
- Configurable wrapping for 2D Map
- Legend-based property styling for vector layers
- Custom marker icons in legend (ShapeImage and ShapeIcon fields)
- Prerendered images for layer legends
- Horizontal legend layouts
- Legend display options and max-on-top positioning
- Layer header expanded state configuration
- InfoTool hotkeys
- Default/preset filters for vector layers
- LayersTool enhanced filtering capabilities and time-related improvements
- Great circle lines in Measure Tool
- TimeUI improvements: fit timewindow to current range, hours display, quick select day/month/year times
- Configure page: required field indicators, projection tab autocomplete, case insensitive mission sorting
- Mission planet radii configuration
- Branding and Dataset Attribution
- Webhook endpoint authorization
- TiTiler planetcantile integration
- TiTiler expressions support
- CITATION.cff file
- URL prefix sourceType dropdowns
- Multi-platform Docker build (arm64 architecture support)
- Callback for newActiveFeature
- Workflow to bump minor version

#### Changed

- Upgraded all adjacent servers
- TimeUI is now DST-aware
- Configure preview iframe now respects subpaths
- Separated tool interface improvements
- Scale bar position in mobile mode
- Blank CSV entries are now filtered out
- AMD64 Docker image suffix and build order

#### Fixed

- DrawTool incrementer value multi-user race conditions
- DrawTool export and reimport template issues
- DrawTool recompute template now only recomputes time and intersected fields
- LayersTool filtering on non-dynamicExtent props-on-click geodatasets
- Vector layer updates causing features to flash
- Globe controls clashing with separated tool buttons
- GeoDataset LOCAL issues
- API tokens visibility to all admin types
- Mission name and msv.mission conflicts
- TimeUI location and mobile mode integration
- Expanded timeline local versus UTC time display
- NoDataValue for single banded COGs
- Critical security vulnerabilities identified in SonarQube analysis

---

## 4.0.0

_April 17, 2025_

#### Summary

This major release adds support for TiTiler (a tiling server), STAC (a geo-spatial metadata standard), Veloserver (a wind server) and COGs. If not using Docker, a complete installation now requires a micromamba python environment. Two new Layer types have been added: Velocity and Image. GeoDatasets support more performance-based options and can behave similarly to Datasets.

### Migration Guide

[Migrating MMGIS from v3 to v4](https://nasa-ammos.github.io/MMGIS/migration/v3-to-v4)

#### Added

- TiTiler - A backend tile service
- Support for COGs (Cloud Optimized GeoTiffs)
- STAC Catalogs
- Support for mosaicked-on-the-fly COGs via titiler-pgstac
- New Layer Type: Velocity (to visualize wind and motion and uses [Veloserver](https://github.com/NASA-AMMOS/Veloserver))
- New Layer Type: Image (to support standalone COGs)
- Internal HTTPS support (no longer need to wrap MMGIS in a proxy to enable that)
- Loading indicator
- LINK_PREVIEW envs for custom description of page when shared through other apps
- Open-api documentation at `/api/docs`
- Support marker bearings with configurable icons
- Support Right-clicking to copy IdentifierTool values
- InfoTool with one-to-many Datasets
- Add Dataset behavior to Geodatasets
- Chunked uploads of GeoDatasets
- Configurable Tile Layer Brightness, Contrast and Saturation
- MeasureTool - Speed/Arrival

#### Changed

- MMGIS now requires a micromamba python environment to run
- `/configure-beta` is now `/configure` (the legacy configure page has been removed as of 4.2.0)
- Better 404 handling
- Better Screenshot Filenames

#### Fixed

- Addressed Sequelize replacements and sanitizations
- Improved FireFox support
- Improved the sample docker-compose file
- `/configure` - Defaults and cleaned layer objects
- `/configure` - Avoid aggressively trimming white space in text boxes

---

## 3.0.0

_October 14, 2024_

#### Summary

Adds the new Configure Beta page at /configure-beta. The old Configure page still exists at /configure and is meant to be backwards compatible but do note that new configuration options will likely only make there way into /configure-beta.

#### Added

- /configure-beta
- Made dynamicExtent requery timeEnabled aware.
- Viewshed Tool can configure initial target and initial observer heights.
- Viewshed Tool in-app documentation.
- Allow adding relative seconds to initial times
- Added downloadURL variable to allow users to download raster layers.
- Info queries for dynamicExtent layers.
- mmgisAPI.getActiveTools.
- Can specify any mdi icon to be the shape icon for a vector layer.
- Easily navigate to the next and previous feature of a layer
- COMPOSITE_TILE_DIR_STORE_MAX_AGE_MS ENV (for composited tile layers).
- Add per layer refreshInterval for which to requery vector or raster layer.

#### Changed

- Updated Identifier tool to be a separated floating tool.
- MeasureTool now uses a linear x-axis.
- Improvements to bulk_tiles and added quantize_colormap.
- Enabled scalefactor and improved text readout for Identifier tool.

#### Fixed

- Improper WMS layer option forwarding in some cases.
- Bad merging of values for injection into time={starttime} in a WMS URL.
- mmgisAPI.setTime checking min-date restrictions too soon.
- Chronice fix second loss.
- Vector layers with heading/bearings would not toggle on/off.
- dynamicExtent vector layer and filtering issues.
- Fix setTime currentTime timezone.
- Fix Deeplink to selected point or polygon.
- Starting in Point Mode for Time doesn't work.

---

## 2.11.0

_Mar 15, 2024_

#### Summary

The release adds a new tool called the ShadeTool, capable of showing visibility maps of various celestial object and craft with the aid of SPICE. The ShadeTool can reveal answers to questions like: "At this time and on my current map, what are all the locations I can view the ISS from?"

Also added are dynamic vector layers that query only for the features immediately within the map's viewport and within time ranges and zoom ranges. This enables much larger vector files to be loaded and rendered without sacrificing performance.

Additionally some new features have been added to the DrawTool, along with new layer export options and various bugfixes and improvements.

#### Added

ShadeTool
SPICE integration and scheduled kernel downloads
Dynamic vector layers (query only vectors in screen)
DrawTool - Folders and tags can contain symbols
DrawTool - turning a file off also deselects it now
DrawTool - template fields can be reordered
DrawTool - Advanced filter in Features tab
DrawTool - Filter state management
DrawTool - Move
Export .shp and .kml LayersTool and DrawTool
MeasureTool and IdentifierTool Layer Vars (configure them in the layer instead of in the tool)
Identifier tool vsicurl support
IdentifierTool - Query Datasets with Time
Tools can be expanded horizontally
Hotkeys
Local vector layer filtering now supports booleans
Add Database docs
Geodatasets now use spatial and temporal db indices
Geodatasets now support dedicated time fields
Add Geodatasets API docs
Add geodatasets/remove endpoints
Add file_description tagging schemes to DB docs
Deep Link shall also deep link to start and end times
urlReplacements layer raw variables to inject parameters
GENERATE_SOURCEMAP ENV

#### Changed

Image Overlay improvements
Description topbar improvements
Minor updates for API calls
Improve KML Export Styles
Remove 'Layer Group' and 'Layer' titles from LayerInfoModal
Disable Globe more thoroughly when off
Additional Body Metadata for Draw Webhooks
Remove restriction on Layer names
Check for empty time configs in TimeControl
Dropdown in the topbar for a selected feature's properties links

#### Fixed

LayersTool - fix nested header expansion
Viewer panorama map view angles works for polar projections
DrawTool - fix deleting tag also closing modal
Fix IdentifierTool tile queries
Fix: Header Layer Descriptions Don't Save
Fix Time Vector Layer first turn on
Fix click on vectortile
Fix missing Missions/mission path on tile layers
Fix Tool Drag Handle Remains on Screen
MeasureTool Fix nodata issue

---

## 2.9.0

_Sept 5, 2023_

#### Summary

This release makes Layer IDs based on UUIDs instead of their layer names, greatly improves support for the dimension of time, adds property templates and group editing to DrawTool files, adds ability to link features together, upgrades our tiling scripts, and streamlines installations among other things.

#### Added

- Examples of wrapping MMGIS in an IFrame under `/examples`
- A full features TimeUI/Timeline Scrubber
- The InfoTool scans for and makes clickable url links
- Support for Composite Time Tiles that merge tiles across a time range on-the-fly on the backend
- Configurable Context Menu actions
- Polygons can have right-click context menu actions and form links with their WKT strings
- A GitHub workflow now builds [MMGIS docker images](https://github.com/NASA-AMMOS/MMGIS/pkgs/container/mmgis)
- The ability to pair features from one layer to another and render those paired targets in the Photosphere view.
- Optional Websocket verification to the configure page to notify of concurrent users.
- Ability to export the "working" configuration JSON from the configure page
- GET `/api/configure/missions` now supports the `full` parameter to return all configuration objects as well
- DrawTool users can enforce property template on their files
- Adds a `MAIN_MISSION` ENV that skips the landing page even if there are many missions
- Grouping editing for DrawTool files
- All endpoints can use longtermtokens
- The LegendTool can optionally be exposed as a togglable popup as well as other improvements
- Various additions to the `mmgisAPI`
- Upgraded gdal2customtiles to use gdal 3.5.2 and to support tiling in any projection
- GeoJSON validation on layers.
- GeoJSON data can be an empty []
- Clicking intersects all features making impossible-to-reach features accessible through the InfoTool
- The DrawTool is integrated with time.

#### Changed

- Layers use UUIDs and identifiers instead of their layer names (backwards-compatibility still maintained)
- The ENV `PUBLIC_URL` is deprecated in favor of the new `ROOT_PATH`. Unlike `PUBLIC_URL`, `ROOT_PATH` can fully be changed at runtime
- Database and POSTGIS extension are automatically created if they don't exist
- Upgraded the configure page's jquery from `1.11.1` to `3.6.1`

#### Fixed

- `ENABLE_MMGIS_WEBSOCKETS` name in sample.env
- Websockets try to reconnect and with exponential backoff
- Various issues regarding time layers
- Various issues regarding WMS layers
- MMGIS can now work with NodeJS 18+
- Bug where initially on annotations features have no click events
- Bug where having the cursor over an annotation on the Map prevented pans and zooms
- Fixed the `angleUnit` property for image layer attachments
- Cloning a layer in the configure page
- Issue where logging in with AUTH=local would infinitely reload

---

## 2.8.0

_Nov 14, 2022_

#### Summary

#### Added

- The Viewer Panel supports gltf models
- The configuration raw variable `markerAttachment.model` now has a `mtlProp` parameter for relative obj material files and can support multiple models per layer
- The DrawTool now supports drawing Circles and Rectangles
- The entire Configuration object has an API and can be updated via curl commands. See [ConfigureAPI](https://nasa-ammos.github.io/MMGIS/apis/configure)
- The MeasureTool now supports multiple DEMs
- Many additions to the `mmgisAPI`. See [JavaScriptAPI](https://nasa-ammos.github.io/MMGIS/apis/javascript)
- Adds an extended GeoJSON format to support per coordinate properties. See [Enhanced GeoJSON](https://nasa-ammos.github.io/MMGIS/configure/formats/enhanced-geojson)
- Deep Links now stores the layer order (if users rearranged them)
- The ability to define a primary coordinate system through a reworked [Coordinates Tab](https://nasa-ammos.github.io/MMGIS/configure/tabs/coordinates)
- DrawTool Layers can be added as regular layers by using a url of the form `api:drawn:<draw_file_id>`
- The ViewshedTool supports target heights
- The MeasureTool include line-of-sight
- Users can individually hide features through the InfoTool
- Layers can now be tagged and assigned a markdown description. Users can filter layers based on these fields as well.
- Added websockets that can notify users in real-time that a configuration has updated. Enabled with the env: `ENABLE_MMGIS_SOCKETS=true`
- Automatic labels can be rendered on features by configuring a raw variables `layerAttachments.labels`
- Added a `gdal2tiles_3.5.2.py` script to tile dem tiles with multi-processing support and tiling on top of an existing tileset
- The colorize Data Shader can now exclude up to three no data values
- Tilesets served from the MMGIS Missions directory now accept an optional `{t}` path directory to search and served tiles based on time
- The TimeUI and the bottom of the screen has been significantly reworked

#### Changed

- Increase GeoJSON math and export precision from `6` to `10` decimal places
- The DrawTool's tagging system has been expanded and it UI resembles folder structures
- Photosphere has better damping and rotates with "panning" directions.

#### Fixed

- Dragging a header in the LayersTool now drags the entire group
- Various fixes to how Time works (through the mmgisAPI, in parameterizing WMS layers, ...)
- Error if Data Layers had a space in their name
- Various mmgisAPI function fixes

---

## 2.7.0

_Jun 9, 2022_

#### Summary

This release adds geologic mapping to the DrawTool, layer reordering to the LayersTool and 3D annotations to the Globe.

#### Added

- [FGDC](https://ngmdb.usgs.gov/fgdc_gds/geolsymstd/download.php) Geologic patterns, linework and symbols in the DrawTool
- Annotation in the Globe View for both standard layers and drawn layers
- Ability for users to reorder layers in the LayersTool
- The Globe has 3d controls once again
- Visibility ranges can be added per feature with `minZoom` and `maxZoom` attributes under a feature's `properties.style`
- A true documentation site at https://nasa-ammos.github.io/MMGIS/

#### Changed

- The vector layer `Visibility Cutoff` configuration has been deprecated (though it still works) in favor of `Minimum Zoom` and `Maximum Zoom`
- Improved the screenshot function
- Layer color indicators are more muted
- Default color scheme is a lighter black
- Lithosphere 1.3.0 => 1.5.1 - [See LithoSphere Releases](https://github.com/NASA-AMMOS/LithoSphere/releases)

#### Fixed

- Issue where `onLoaded` would fire multiple times
- Default MMGIS login fields are now removed from the DOM when not in use (merely hiding caused some annoyances with password extensions)
- Issue where deep link didn't position the camera in the Globe correctly
- Issue where some vector points the use DivIcons were not clickable

---

## 2.6.0

_Mar 16, 2022_

#### New Requirements

- Node.js >= v14.9.0

#### Summary

This release adds a webhook manager to the configure page and improves documentation, the mmgisAPI, projection support, as well as synchronicity between the Map and Globe.

#### Added

- Configurable webhook manager.
- Access to a settings modal in the bottom left toolbar to toggle various UI elements' visibilities as well as the radius of tiles to query for the 3D Globe
- Raster effects (brightness, contrast, saturation, blend-mode) now apply in 3D as well
- Controlled layers can now utilized sublayers/marker-attachments
- Marker attachments, such as uncertainty ellipses, properly work for any projection
- 3D uncertainty ellipses
- Documentation for using remote virtual layers via GDAL
- PUBLIC_URL can be specified at build now in the Dockerfile
- mmgisAPI functions apply to the 3D Globe too now
- mmgisAPI can trim LineString features at the coordinates level

#### Changed

- LithoSphere 1.1.0 => 1.3.0 - [See LithoSphere Releases](https://github.com/NASA-AMMOS/LithoSphere/releases)
- Users can now pan the map while in the DrawTool's draw mode without placing a point
- Time controlled layers can now default to the current time for initial queries

#### Fixed

- Some media paths in the /configure path not working when MMGIS is served under a subdomain with PUBLIC_URL

---

## 2.5.0

_Jan 10, 2022_

#### Summary

This release contains the IsochroneTool, revives the Model layer type and includes a new Query layer type. Each vector layer can now be filtered by the user through the LayersTool, leads in the DrawTool can now draw and publish arrows and annotations, and the MeasureTool finally supports continuous elevation profiles.

#### Added

- Isochrone Tool!
- Model layer type!
- Query layer type!
- User filterable layers!
- More mmgisAPI functions
- Deep linking 'centerPin' parameter
- DrawTool lead Map file
- DrawTool text rotation
- Annotation and Arrows are now supported in regular (non-DrawTool) geojson
- Configurable bearings, uncertainty ellipses, models and underlaid images for vector points
- MeasureTool now supports a continuous profile
- MeasureTool csv export includes 3D distance as well
- LayersTool support sublayer visibility toggles within a layer's settings menu
- Python3 version of gdal2customtiles.py
- More Coordinates configurations
- Option in great_circle_calculator to calculate distance between points with Vincenty's formulae
- CHANGELOG.md
- Raw Variables Link has a new 'replace' section for modifying property values before injecting into a url

#### Changed

- LithoSphere 1.0.1 => 1.1.0 - [See LithoSphere Releases](https://github.com/NASA-AMMOS/LithoSphere/releases)
- LayersTool, LegendTool and InfoTool panels are wider
- The MMGIS M logo is now an svg
- bulk_tiles.py's colormap is now optional
- DrawTool's compile includes an inward buffer to allow for smaller drawn features to pass checks
- InfoTool now lists all intersected polygons of a layer under a mouse click

#### Fixed

- Viewsheds play nicely with polar maps
- Various improvements to the top search bar
- Legend items wrap to new line instead of extending off screen
- `colors` package fix
- `globeLon` deep link not working
- Uses `asHTML` for IdentifierTool again
- `apt-get update` in Dockerfile now uses -y (yes to all) flag

#### Removed

- Excess Globe feature highlighting

## 2.4.0

_Aug 06, 2021_

#### Summary

This release adds in the Viewshed Tool, time enabled layers, [LithoSphere](https://github.com/NASA-AMMOS/LithoSphere), WMS support, data layers, a JavaScript API, and more.

#### Added

- The Viewshed Tool!
- Time enabled layers, configurations and a time UI component.
- Full support for WMS layers and projections in 2D and 3D.
- Data layer colorize shader enabling dynamic rendering of data.
- An extensive window.mmgisAPI for interacting with MMGIS through an iframe.
- Configuration for point marker shape.
- Support for serving MMGIS at a subpath with the PUBLIC_URL environment variable.
- bulk_tiles.py auxiliary script.
- Features can be dehighlighted by clicking off on the map.
- Measure Tool supports measurements in kilometers.
- Ability to type in and go to a coordinate.
- Elevation values on mouse over.
- Configurable coordinates.
- Draw Tool features behave like regular layer features when the Draw Tool is closed.

#### Changed

- The Globe has been refactored and made standalone in the npm library LithoSphere.
- The Waypoint Kind now uses a top-down image of Perseverance.
- Migrated from Python2 to Python3.

#### Fixed

- Documentation uses only relative links for resources now.
- Issue with auth=none not working.
- Draw Tool drawings now work at the meter level.
- Draw Tool drawings now properly respect 0 valued styles.
- Data layer names now support spaces.

#### Removed

- All PHP dependencies.

---

## 2.3.1

_Apr 22, 2021_

#### Summary

A point release to address bug fixes.

#### Fixed

- WMS layers now work for full polar projections
- Raster layers obey order even if they're initially off
- Draw Tool truly accepts .json files

---

## 2.3.0

_Apr 14, 2021_

#### Summary

The Draw Tool gets its own tag filtering system. The Measure Tool now uses great arcs and is way more accurate and the map now fully supports WMS layers!

#### Migration Details

- The DrawTool tagging system change ideally needs more space in the `file_description` column. To increase it and not hit a tag or file description limit in drawing files, back-up the MMGIS database and run the SQL command:

```
ALTER TABLE user_files ALTER COLUMN file_description TYPE VARCHAR(10000);
```

#### Added

- Draw Tool files can now be search for by user defined tags/keyword
- Draw Tool file options modal has been upgraded
- Admins can pin preferred tags
- Measure Tool now uses great arcs to compute measurements as well as for rendering lines
- A docker-compose.yml
- Fully functional WMS Map layers

#### Removed

#### Changed

- Draw Tool requires a user to enter a file name before creating a file. (Instead of adding one as "New File")
- Draw Tool now accepts uploads of .json geojson files. (From just .geojson and .shp)
- Tools plugins are captured at build time! (You do not need to run `npm start` before building anymore)
- Info Tool contents are condensed

#### Fixed

- Screenshot widget no longer captures the faint bottom bar in its images
- Deep links to selected feature can now activate their info in the Info Tool
- AUTH=local allows users to sign in again
- Measure Tool profile download data is now accurate

---

## 2.0.0

_Jan 14, 2021_

#### Migration Details

- The environment variable `ALLOW_EMBED` has been replaced with `FRAME_ANCESTORS`
- `npm install` is only needed in the root directory and not in the /API directory any more
- Instead of `npm start`, use `npm run build` and then afterwards `npm run start:prod` to run the application.  
  _You will still need to run `npm start` before building the first time_

#### Added

- Webpack!
- Production level builds
- Babel
- React support
- Icons as markers
- Configurable vector highlight color
- Graticules
- Configure page help buttons to docs

#### Removed

- Require.js
- Unused libraries, tools and code
- Swap widget
- FORCE_CONFIGCONFIG environment variable removed

#### Changed

- Info Tool upgraded!
- Measure Tool upgraded!
- Top bar search
- The environment variable ALLOW_EMBED has been replaced with FRAME_ANCESTORS
- MMGIS2 splash screen
- Various small UI changes
- Improved configure look tab
- Development logging is friendlier

#### Fixed

- Configure save warns of bad json
- Removed unused configure globe projection option
- Configure look tab colors work properly

---

## 1.3.5

_Oct 19, 2020_

#### Added

- ALLOW_EMBED environment variable
- DISABLE_LINK_SHORTENER environment variable

#### Fixed

- Tweaked various UI elements
- The Configure page Look tab now correctly reads in any existing `logourl` and `helpurl`
- Configure page now warns of invalid raw variable JSON
- Raw variable `info` values don't break when there's no text to replace in them
- Configuration endpoints no longer assume SQL output is ordered

---

## 1.3.4

_Oct 06, 2020_

#### Added:

- WMS tile support for the Map (does not yet work on the Globe).
- `AUTH` env can be set to "off" to disable user login entirely.
- gdal2customtiles.py for tiling datasets with custom projections.

---

## 1.3.3

_Aug 07, 2020_

#### Added:

- Example docker-compose

#### Fixed:

- 3D Globe was rendering layers in depth order instead of breadth order
- Draw Tool publishing sometimes undid the last Lead Map edits
- Draw Tool styling options sometimes hidden in FireFox

#### Changed:

- New short URLs are one character longer
- Draw Tool publish overlap tolerance increased

---

## 1.3.2

_Jul 06, 2020_

#### Fixed

- Draw Tool history sql commands assumed rows would be returned in order which could completely break the tool.
- Draw Tool layers would get stuck due to automatic toggling when copying to files or turning the file you're drawing in off.
- The waypoint image links on the Test mission have been fixed.

---

## 1.3.1

_May 13, 2020_

#### Fixed

- Additional authorization headers prevented access to the configure login page.

---

## 1.3.0

_Apr 16, 2020_

#### New Requirements

- Node.js >= v10.10

#### New Features

- Export vector layers as geojson from the Layers Tool
- Info Tool uses a JSON viewer
- Users can now split and merge features in the Draw Tool
- Rich application logging
- ENVs that end with \_HOST are pinged at start to test connections
- Ability to configure deep links to other sites based on properties of a selected feature
- Users can upload much larger files in the Draw Tool
- Missions can be configured to use any map projection
- Globe level of detail
- Globe space themed skysphere
- Tools and Backends are included by scanning a directory for setup files instead of editing code
- The Legend Tool supports color scales
- CSV files can be uploaded as datasets and can be queried on feature click
- Early API tokens that allow .csvs to be uploaded programmatically
- An optional top bar with search functionality
- Configurable page name and logo
- On screen Globe controls
- Support both TMS and WMS tilesets
- Layer Kinds for specialized interactions
- Better documentation in /docs
- Resources cache properly

#### Fixed

- All tables are properly created with just one start
- Failed layers no longer crash the application
- Infinite login bug
- Vectors disappearing with string weights
- Some endpoint calls began with home slashes that broke certain setups

---

## 1.2

_Nov 06, 2019_

#### Added

- Limit access to the entire site with .env's `AUTH=local`
- Vector Tile Layers
- Store features within Postgres by uploading them with /configure's `Manage Geodatasets`. Point to them by setting the layer URL to `geodatasets:{name}`. Can serve both geojson and vector tiles.

---

## 1.1.1

_Oct 25, 2019_

#### Fixed

- Creating a new mission on the 'configure' page failed to make the appropriate mission directories (e.g. Layers).

---

## 1.1

_Oct 02, 2019_

#### Summary

MMGIS update with the Campaign Analysis Mapping and Planning (CAMP) tool. The software now runs fully in a node environment. Various other bug fixes and minor updates have been made to the code.

---

## Open Source Release

_Jun 06, 2019_

#### Summary

This represents the initial release of the Multi-Mission Geographic Information System (MMGIS) software, developed under NASA-AMMOS.

Dr. Fred J, Calef III & Tariq K. Soliman
NASA-JPL/Caltech
