Feature: Velocity Layer Visualization
  As a mission scientist
  I want to visualize velocity and flow data
  So that I can analyze atmospheric and fluid dynamics

  Background: Test Mission with Velocity Layer Configuration
    Given MMGIS is configured with a test mission
    And I have authenticated with long-term API token
    And the following mission configuration exists:
      """
      {
        "msv": {
          "mission": "Velocity_Test",
          "view": ["-100", "40", "4"]
        },
        "tools": [
          {"name": "Layers", "icon": "layers", "js": "LayersTool"},
          {"name": "Info", "icon": "information-variant", "js": "InfoTool"}
        ],
        "layers": []
      }
      """

  Scenario: Streamlines visualization with wind data
    Given I add a velocity layer with streamlines configuration:
      """
      {
        "name": "Wind Streamlines",
        "type": "velocity",
        "kind": "streamlines",
        "url": "https://nomads.ncep.noaa.gov/dods/gfs_0p25/gfs20231201/gfs_0p25_00z",
        "visibility": true,
        "initialOpacity": 0.8,
        "minZoom": 0,
        "maxZoom": 10,
        "variables": {
          "streamlines": {
            "minVelocity": 0,
            "maxVelocity": 15,
            "velocityScale": 0.005,
            "particleAge": 90,
            "lineWidth": 1,
            "particleMultiplier": 0.003333,
            "frameRate": 15,
            "displayValues": true,
            "colorScale": "RDYLBU_R",
            "units": "m/s",
            "displayPosition": "bottomleft"
          }
        }
      }
      """
    When I load the map
    Then streamlines should be animated based on wind velocity data
    And particle animation should flow according to wind direction
    And velocity magnitude should be color-coded using RDYLBU_R colormap
    And velocity values should be displayed in m/s units
    And particles should regenerate every 90 frames
    And frame rate should be approximately 15 fps

  Scenario: Particle visualization with atmospheric data
    Given I add a velocity layer with particles configuration:
      """
      {
        "name": "Atmospheric Particles",
        "type": "velocity",
        "kind": "particles",
        "url": "Data/atmospheric_flow.geojson",
        "visibility": true,
        "style": {
          "color": "#00FF00"
        },
        "variables": {
          "particles": {
            "angle": 80,
            "width": 1,
            "spacing": 10,
            "length": 4,
            "interval": 10,
            "speed": 0.1,
            "units": "km/h"
          }
        }
      }
      """
    When I load the map
    Then particles should be displayed in green color
    And particles should be angled at 80 degrees
    And particle spacing should be 10 pixels apart
    And particle movement speed should be scaled by 0.1 factor
    And units should display as km/h when hovering

  Scenario: Wind barb visualization for meteorological data
    Given I add a velocity layer with wind barbs configuration:
      """
      {
        "name": "Weather Stations",
        "type": "velocity",
        "kind": "windbarbs",
        "url": "Data/weather_stations.geojson",
        "visibility": true,
        "variables": {
          "windbarbs": {
            "units": "knots",
            "displayValues": true,
            "colorScale": "VIRIDIS"
          }
        }
      }
      """
    When I load the map
    Then wind barbs should be displayed at station locations
    And barb orientation should indicate wind direction
    And barb features should indicate wind speed
    And values should be displayed in knots
    And VIRIDIS colormap should be applied based on wind speed

  Scenario: Arrow visualization for flow direction
    Given I add a velocity layer with arrows configuration:
      """
      {
        "name": "Flow Arrows",
        "type": "velocity",
        "kind": "arrows",
        "url": "Data/flow_vectors.geotiff",
        "visibility": true,
        "variables": {
          "arrows": {
            "units": "m/s",
            "arrowSize": 1.5,
            "arrowSpacing": 20,
            "colorScale": "PLASMA"
          }
        }
      }
      """
    When I load the map
    Then arrows should be displayed showing flow direction
    And arrow size should be proportional to velocity magnitude
    And arrows should be spaced 20 pixels apart
    And PLASMA colormap should be applied to arrows
    And units should display as m/s

  Scenario: Velocity layer with temporal animation
    Given I add a velocity layer with time-enabled configuration:
      """
      {
        "name": "Temporal Wind Data",
        "type": "velocity",
        "kind": "streamlines",
        "url": "Data/wind_data_{time}.gribjson",
        "visibility": true,
        "time": {
          "enabled": true,
          "type": "requery",
          "format": "%Y%m%d_%H%M",
          "refreshIntervalEnabled": true,
          "refreshIntervalAmount": 300
        },
        "variables": {
          "streamlines": {
            "minVelocity": 0,
            "maxVelocity": 25,
            "displayValues": true,
            "units": "m/s"
          }
        }
      }
      """
    When I adjust the time control
    Then the velocity layer should update with new temporal data
    And streamlines should animate according to the selected time
    And the layer should auto-refresh every 5 minutes
    And temporal metadata should be preserved

  Scenario: Multi-level velocity data visualization
    Given I add a velocity layer with altitude levels:
      """
      {
        "name": "Multi-Level Winds",
        "type": "velocity",
        "kind": "streamlines",
        "url": "Data/winds_850mb.gribjson",
        "visibility": true,
        "variables": {
          "streamlines": {
            "minVelocity": 0,
            "maxVelocity": 50,
            "displayValues": true,
            "units": "m/s",
            "level": "850mb"
          }
        }
      }
      """
    When I load the map
    Then streamlines should represent 850mb level wind data
    And level information should be displayed in metadata
    And velocity values should be appropriate for the altitude level
    And I should be able to switch between different pressure levels

  Scenario: Velocity layer performance with large datasets
    Given I add a velocity layer with high-resolution data:
      """
      {
        "name": "High-Res Velocity",
        "type": "velocity",
        "kind": "streamlines",
        "url": "Data/high_resolution_flow.nc",
        "visibility": true,
        "minZoom": 2,
        "maxZoom": 12,
        "variables": {
          "streamlines": {
            "particleMultiplier": 0.001,
            "frameRate": 10,
            "particleAge": 60
          }
        }
      }
      """
    When I navigate at different zoom levels
    Then particle density should be appropriate for the zoom level
    And performance should remain smooth during navigation
    And memory usage should be optimized for large datasets
    And frame rate should be maintained at approximately 10 fps

  Scenario: Velocity layer data format support
    Given I test different velocity data formats
    When I load a layer with GribJSON format:
      """
      {
        "name": "GribJSON Wind",
        "type": "velocity",
        "kind": "streamlines",
        "url": "Data/wind.gribjson"
      }
      """
    Then the GribJSON format should be properly parsed
    When I load a layer with GeoTIFF format:
      """
      {
        "name": "GeoTIFF Flow",
        "type": "velocity",
        "kind": "arrows",
        "url": "Data/flow.tif"
      }
      """
    Then the GeoTIFF format should be properly parsed
    When I load a layer with NetCDF format:
      """
      {
        "name": "NetCDF Data",
        "type": "velocity",
        "kind": "particles",
        "url": "Data/atmospheric.nc"
      }
      """
    Then the NetCDF format should be properly parsed

  Scenario: Velocity layer customization and styling
    Given I add a velocity layer with custom styling:
      """
      {
        "name": "Styled Velocity",
        "type": "velocity",
        "kind": "streamlines",
        "url": "Data/custom_flow.json",
        "visibility": true,
        "variables": {
          "streamlines": {
            "colorScale": "TURBO",
            "lineWidth": 2,
            "displayValues": true,
            "displayPosition": "topright"
          }
        }
      }
      """
    When I load the map
    Then the TURBO colormap should be applied
    And streamline width should be 2 pixels
    And velocity values should be displayed in the top-right corner
    And styling should be customizable through layer settings