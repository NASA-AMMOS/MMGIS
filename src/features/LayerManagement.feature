Feature: Layer Management and Visualization
  As a mission scientist
  I want to control layer visibility and properties
  So that I can analyze different data types and combinations

  Background: Test Mission with Multiple Layer Types
    Given MMGIS is configured with a test mission
    And I have authenticated with long-term API token
    And the following mission configuration exists:
      """
      {
        "msv": {
          "mission": "Layer_Test",
          "view": ["-100", "40", "4"]
        },
        "tools": [
          {"name": "Layers", "icon": "layers", "js": "LayersTool"},
          {"name": "Legend", "icon": "format-list-bulleted-type", "js": "LegendTool"}
        ],
        "time": {"enabled": true},
        "layers": [
          {
            "name": "Base Imagery",
            "type": "tile",
            "url": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            "visibility": true,
            "initialOpacity": 1.0,
            "minZoom": 0,
            "maxZoom": 18
          },
          {
            "name": "Sample Sites",
            "type": "vector",
            "url": "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson",
            "visibility": false,
            "initialOpacity": 0.8,
            "style": {
              "color": "#FF0000",
              "fillColor": "#FF0000",
              "weight": 2,
              "fillOpacity": 0.3
            }
          },
          {
            "name": "Elevation (COG)",
            "type": "tile",
            "sourceType": "COG",
            "url": "https://cloud.sdsc.edu/v1/AUTH_opentopography/Raster/SRTM_GL1/SRTM_GL1_srtm.tif",
            "visibility": false,
            "throughTileServer": true,
            "cogTransform": true,
            "cogMin": 0,
            "cogMax": 4000,
            "cogColormap": "terrain"
          }
        ]
      }
      """

  Scenario: Toggling layer visibility
    Given layers are configured in the mission
    And I can see the layer panel
    When I click on a layer's visibility toggle
    Then the layer should appear or disappear on the map
    And the toggle state should reflect the visibility change
    And the map should update immediately

  Scenario: Adjusting layer opacity
    Given a raster layer is visible on the map
    When I adjust the layer's opacity slider
    Then the layer transparency should change in real-time
    And the opacity value should be displayed
    And other layers should remain unaffected

  Scenario: Managing layer groups and hierarchy
    Given layers are organized in groups
    When I expand a layer group
    Then I should see all sublayers within that group
    When I collapse a layer group
    Then the sublayers should be hidden
    And group expansion state should be maintained during session

  Scenario: Loading and displaying raster layers
    Given raster tile layers are configured
    When a raster layer becomes visible
    Then tiles should load progressively
    And loading indicators should appear for pending tiles
    And the layer should display correctly at different zoom levels

  Scenario: Displaying vector layer features
    Given vector layers with geospatial features are configured
    When I make a vector layer visible
    Then all features should render on the map
    And features should be styled according to configuration
    And features should respond to mouse interactions

  Scenario: Temporal layer control
    Given time-enabled layers are configured
    When I adjust the time control slider
    Then only features/data for the selected time should display
    And the time indicator should update accordingly
    And layers should transition smoothly between time periods

  Scenario: Layer filtering functionality
    Given a vector layer supports filtering
    When I apply a filter to the layer
    Then only features matching the filter criteria should display
    And the filter controls should show active filter state
    And I should be able to clear or modify filters

  Scenario: Cloud Optimized GeoTIFF (COG) layer performance
    Given COG layers are configured for the mission
    When I zoom into an area with COG data
    Then the appropriate resolution data should load
    And loading should be efficient without unnecessary data transfer
    And the display should be responsive during navigation