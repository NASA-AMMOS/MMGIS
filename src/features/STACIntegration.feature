Feature: STAC Integration for Spatiotemporal Asset Catalogs
  As a mission scientist
  I want to discover and access data through STAC catalogs
  So that I can work with standardized geospatial metadata and assets

  Background: Test Mission with STAC Configuration
    Given MMGIS is configured with a test mission
    And STAC services are available and configured
    And TiTiler-PgSTAC is available for collection mosaics
    And I have authenticated with long-term API token
    And the following mission configuration exists:
      """
      {
        "msv": {
          "mission": "STAC_Test",
          "view": ["-100", "40", "4"]
        },
        "tools": [
          {"name": "Layers", "icon": "layers", "js": "LayersTool"},
          {"name": "Info", "icon": "information-variant", "js": "InfoTool"},
          {"name": "Time", "icon": "clock", "js": "TimeTool"}
        ],
        "time": {"enabled": true},
        "layers": []
      }
      """

  Scenario: Loading vector features from STAC Item
    Given I add a vector layer with STAC Item configuration:
      """
      {
        "name": "Landsat Scenes",
        "type": "vector",
        "sourceType": "stac-item",
        "url": "https://landsatlook.usgs.gov/stac-server/collections/landsat-c2l1/items/LC08_L1TP_139045_20170304_20170316_01_T1",
        "visibility": true,
        "style": {
          "color": "#FF6B35",
          "fillColor": "#FF6B35",
          "fillOpacity": 0.3,
          "weight": 2
        }
      }
      """
    When I load the map
    Then the STAC item geometry should display as a vector feature
    And STAC item properties should be accessible through Info tool
    And metadata should include collection, datetime, and asset information
    And asset links should be functional for data access

  Scenario: Browsing STAC Collection as vector features
    Given I add a vector layer with STAC Collection configuration:
      """
      {
        "name": "Sentinel-2 Collection",
        "type": "vector",
        "sourceType": "stac-collection",
        "url": "https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a",
        "visibility": true,
        "time": {
          "enabled": true,
          "type": "requery",
          "format": "%Y-%m-%dT%H:%M:%SZ"
        },
        "variables": {
          "dynamicExtent": true,
          "dynamicExtentMoveThreshold": "10000"
        }
      }
      """
    When I load the map
    Then available STAC items from the collection should display as features
    And each feature should represent a single STAC item
    And temporal filtering should work with the time control
    And spatial extent filtering should work with map navigation
    And asset previews should be accessible

  Scenario: STAC Catalog browsing and navigation
    Given I add a vector layer with STAC Catalog configuration:
      """
      {
        "name": "Microsoft Planetary Computer",
        "type": "vector",
        "sourceType": "stac-catalog",
        "url": "https://planetarycomputer.microsoft.com/api/stac/v1/",
        "visibility": true
      }
      """
    When I load the map
    Then the STAC catalog structure should be browsable
    And collections should be accessible as sub-catalogs
    And I should be able to navigate through the catalog hierarchy
    And collection metadata should be displayed appropriately

  Scenario: STAC Collection as tile mosaic through TiTiler-PgSTAC
    Given I add a tile layer with STAC Collection for mosaic:
      """
      {
        "name": "Landsat Collection Mosaic",
        "type": "tile",
        "sourceType": "stac-collection",
        "url": "landsat-c2l1",
        "visibility": true,
        "throughTileServer": true,
        "tileMatrixSet": "WebMercatorQuad",
        "time": {
          "enabled": true,
          "type": "requery",
          "format": "%Y-%m-%dT%H:%M:%SZ"
        },
        "cogBands": ["4", "3", "2"],
        "cogMin": 0,
        "cogMax": 3000
      }
      """
    And TiTiler-PgSTAC is configured with the STAC collection
    When I load the map
    Then a mosaicked tile layer should be generated from collection COGs
    And the mosaic should update when time controls change
    And band combinations should be applied to the mosaic
    And pixel value scaling should work across the entire mosaic

  Scenario: STAC temporal queries with time controls
    Given I add a vector layer with temporal STAC collection:
      """
      {
        "name": "Temporal Satellite Data",
        "type": "vector",
        "sourceType": "stac-collection",
        "url": "https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a",
        "visibility": true,
        "time": {
          "enabled": true,
          "type": "requery",
          "format": "%Y-%m-%dT%H:%M:%SZ"
        }
      }
      """
    When I adjust the time control to a specific date range
    Then only STAC items within the time range should be displayed
    And the STAC API query should include datetime filters
    And features should update dynamically as time changes
    And temporal metadata should be preserved in feature properties

  Scenario: STAC asset access and preview
    Given I load a STAC item with multiple assets
    When I click on a STAC feature
    Then the Info tool should display available assets
    And asset types should be clearly identified (thumbnail, data, metadata)
    And asset links should be functional for download
    And thumbnails should be displayable if available
    And asset formats should be indicated (COG, JPEG, XML, etc.)

  Scenario: STAC search with spatial and temporal filters
    Given I add a vector layer with STAC search capabilities:
      """
      {
        "name": "STAC Search Results",
        "type": "vector",
        "sourceType": "stac",
        "url": "https://earth-search.aws.element84.com/v1/search",
        "visibility": true,
        "variables": {
          "dynamicExtent": true,
          "dynamicExtentMoveThreshold": "5000"
        },
        "time": {
          "enabled": true,
          "type": "requery"
        }
      }
      """
    When I navigate to a specific area on the map
    And I set a specific time range
    Then the STAC search should be filtered by bbox and datetime
    And results should be limited to the current map extent
    And search parameters should be visible in the request
    And result pagination should be handled appropriately

  Scenario: STAC metadata standards compliance
    Given I load STAC data from a compliant catalog
    When I examine the loaded features
    Then STAC properties should follow the standard schema
    And required fields should be present (id, type, bbox, properties)
    And datetime information should be properly formatted
    And collection references should be valid
    And extensions should be properly handled if present

  Scenario: STAC error handling and fallbacks
    Given I add a vector layer with invalid STAC URL:
      """
      {
        "name": "Invalid STAC",
        "type": "vector",
        "sourceType": "stac",
        "url": "https://example.com/invalid-stac-api",
        "visibility": true
      }
      """
    When I load the map
    Then appropriate error handling should occur
    And error messages should be user-friendly
    And the layer should remain in the layer list with error indication
    And other layers should continue to function normally
    And retry mechanisms should be available if appropriate