Feature: Measure Tool Operations
  As a mission scientist
  I want to measure distances and elevations on planetary surfaces
  So that I can analyze terrain and plan operations

  Scenario: Basic distance measurement
    Given the Measure tool is enabled and active
    When I click two points on the map
    Then a line should connect the two points
    And the distance between the points should be displayed
    And the measurement should use appropriate units for the mission

  Scenario: Multi-segment distance measurement
    Given the Measure tool is in distance mode
    When I click multiple points to create a multi-segment line
    Then each segment should display its individual distance
    And the total cumulative distance should be shown
    And I should be able to add or remove measurement points

  Scenario: Elevation profile generation
    Given DEM (Digital Elevation Model) data is available
    And the Measure tool is active
    When I draw a measurement line across terrain
    Then an elevation profile chart should be generated
    And the profile should show elevation changes along the line
    And the chart should be interactive with hover information

  Scenario: Using different DEM datasets
    Given multiple DEM datasets are available for the area
    When I create a measurement with elevation profile
    Then I should be able to select which DEM to use
    When I switch between different DEM datasets
    Then the elevation profile should update accordingly
    And measurement accuracy should reflect the DEM resolution

  Scenario: Measurement unit conversion
    Given I have created distance measurements
    When I change the measurement unit settings
    Then all displayed measurements should convert to the new units
    And the conversion should be accurate and appropriate
    And unit labels should update throughout the interface

  Scenario: Measurement persistence and management
    Given I have created multiple measurements
    When I navigate away from the measured area
    Then the measurements should remain visible when I return
    And I should be able to clear individual measurements
    When I clear all measurements
    Then the map should return to its unmeasured state

  Scenario: Area measurement functionality
    Given the Measure tool supports area calculation
    When I draw a polygon on the map
    Then the enclosed area should be calculated and displayed
    And the area should use appropriate units (square meters, hectares, etc.)
    And the calculation should account for map projection distortions

  Scenario: Measurement accuracy with map projections
    Given the mission uses a specific map projection
    When I measure distances across different parts of the map
    Then measurements should be accurate for the projection used
    And large-scale measurements should account for planetary curvature
    And measurement accuracy should be appropriate for the zoom level