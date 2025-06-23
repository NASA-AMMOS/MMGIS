Feature: Map Navigation and Display
  As a mission scientist
  I want to navigate and interact with the 2D map
  So that I can explore planetary data effectively

  Scenario: Loading a mission with default view
    Given MMGIS is configured with a valid mission
    When I load the application
    Then the 2D map should be displayed
    And the map should show the configured default extent
    And coordinate information should be visible

  Scenario: Panning and zooming the map
    Given the 2D map is loaded and displayed
    When I pan the map by dragging
    Then the map view should update smoothly
    And the coordinate display should update accordingly
    When I zoom in on the map
    Then the map should display more detail
    And the zoom controls should reflect the current level

  Scenario: Switching between 2D and 3D views
    Given both 2D map and 3D globe views are available
    And I am currently viewing the 2D map
    When I switch to the 3D globe view
    Then the globe should load with the same geographic area
    And the view should maintain contextual information
    When I switch back to 2D view
    Then I should return to the equivalent 2D map position

  Scenario: Deep linking to specific map coordinates
    Given MMGIS supports URL-based navigation
    When I access a URL with specific coordinates and zoom level
    Then the map should load at the specified location
    And the zoom level should match the URL parameter
    And the URL should be updated when I navigate to new areas

  Scenario: Custom projection coordinate display
    Given the mission uses a custom projection system
    When I navigate around the map
    Then coordinates should be displayed in the correct projection
    And coordinate precision should be appropriate for the zoom level
    And coordinate system information should be available to the user