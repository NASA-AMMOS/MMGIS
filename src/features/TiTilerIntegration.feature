Feature: TiTiler Integration for Cloud-Optimized GeoTIFFs
  As a mission scientist
  I want to use TiTiler to serve dynamic tiles from COG data
  So that I can visualize large raster datasets efficiently

  Background: Test Mission with TiTiler Configuration
    Given MMGIS is configured with a test mission
    And TiTiler service is available and configured
    And I have authenticated with long-term API token
    And the following mission configuration exists:
      """
      {
        "msv": {
          "mission": "TiTiler_Test",
          "view": ["0", "0", "3"]
        },
        "tools": [
          {"name": "Layers", "icon": "layers", "js": "LayersTool"},
          {"name": "Info", "icon": "information-variant", "js": "InfoTool"}
        ],
        "layers": []
      }
      """

  Scenario: Serving basic COG through TiTiler
    Given I add a tile layer with COG configuration:
      """
      {
        "name": "USGS Elevation (COG)",
        "type": "tile",
        "sourceType": "COG",
        "url": "https://cloud.sdsc.edu/v1/AUTH_opentopography/Raster/SRTM_GL1/SRTM_GL1_srtm.tif",
        "visibility": true,
        "throughTileServer": true,
        "tileMatrixSet": "WebMercatorQuad",
        "cogResampling": "bilinear",
        "minZoom": 0,
        "maxZoom": 14,
        "initialOpacity": 0.8
      }
      """
    When I load the map
    Then the COG layer should be served through TiTiler
    And tiles should be generated dynamically from the COG
    And the layer should display with bilinear resampling
    And performance should be acceptable for navigation

  Scenario: Transforming 32-bit COG with color scaling
    Given I add a tile layer with 32-bit COG transformation:
      """
      {
        "name": "Elevation with Colormap",
        "type": "tile",
        "sourceType": "COG",
        "url": "https://cloud.sdsc.edu/v1/AUTH_opentopography/Raster/SRTM_GL1/SRTM_GL1_srtm.tif",
        "visibility": true,
        "throughTileServer": true,
        "cogTransform": true,
        "cogMin": 0,
        "cogMax": 4000,
        "cogColormap": "terrain",
        "cogUnits": "m",
        "cogBands": ["1"]
      }
      """
    When I load the map
    Then the 32-bit data should be transformed with color scaling
    And pixel values should be rescaled from 0 to 4000 meters
    And the terrain colormap should be applied
    And units should display as meters in queries

  Scenario: Multi-band COG with custom band selection
    Given I add a tile layer with multi-band COG:
      """
      {
        "name": "Landsat RGB",
        "type": "tile",
        "sourceType": "COG",
        "url": "https://landsat-pds.s3.amazonaws.com/c1/L8/139/045/LC08_L1TP_139045_20170304_20170316_01_T1/LC08_L1TP_139045_20170304_20170316_01_T1_B[1-7].TIF",
        "visibility": true,
        "throughTileServer": true,
        "cogBands": ["4", "3", "2"],
        "cogBandsQuery": ["1", "2", "3", "4", "5", "6", "7"],
        "cogResampling": "cubic"
      }
      """
    When I load the map
    Then tiles should be generated using bands 4, 3, 2 for RGB display
    And queries should return data from all 7 bands
    And cubic resampling should be applied for smooth appearance
    And band information should be accessible through Info tool

  Scenario: COG with custom tile matrix set for non-Web Mercator projection
    Given I add a tile layer with custom projection COG:
      """
      {
        "name": "Polar Stereographic Data",
        "type": "tile",
        "sourceType": "COG",
        "url": "https://example.com/polar_data.tif",
        "visibility": true,
        "throughTileServer": true,
        "tileMatrixSet": "UPSArcticWGS84Quad",
        "cogResampling": "nearest"
      }
      """
    And the mission projection is configured for polar regions
    When I load the map
    Then the COG should be served using UPS Arctic projection
    And tiles should align correctly with the map projection
    And nearest neighbor resampling should preserve original pixel values
    And coordinate display should show polar coordinates

  Scenario: TiTiler performance with large COG datasets
    Given I add a tile layer with large COG:
      """
      {
        "name": "High Resolution Imagery",
        "type": "tile",
        "sourceType": "COG",
        "url": "https://example.com/large_dataset.tif",
        "visibility": true,
        "throughTileServer": true,
        "cogResampling": "lanczos",
        "minZoom": 0,
        "maxZoom": 18
      }
      """
    When I navigate to different zoom levels
    Then appropriate resolution overviews should be used
    And tile generation should complete within acceptable time limits
    And memory usage should remain stable during navigation
    And tiles should be cached appropriately by the browser

  Scenario: TiTiler error handling for invalid COG
    Given I add a tile layer with invalid COG URL:
      """
      {
        "name": "Invalid COG",
        "type": "tile",
        "sourceType": "COG",
        "url": "https://example.com/nonexistent.tif",
        "visibility": true,
        "throughTileServer": true
      }
      """
    When I load the map
    Then appropriate error handling should occur
    And error tiles should be displayed for failed requests
    And the layer should remain in the layer list with error indication
    And other layers should continue to function normally

  Scenario: COG metadata access through TiTiler
    Given I add a tile layer with COG for metadata testing:
      """
      {
        "name": "Metadata COG",
        "type": "tile",
        "sourceType": "COG",
        "url": "https://cloud.sdsc.edu/v1/AUTH_opentopography/Raster/SRTM_GL1/SRTM_GL1_srtm.tif",
        "visibility": true,
        "throughTileServer": true
      }
      """
    When I access the layer's metadata
    Then COG information should be available through TiTiler info endpoint
    And band information should be accessible
    And spatial extents should be correctly reported
    And NoData values should be properly handled