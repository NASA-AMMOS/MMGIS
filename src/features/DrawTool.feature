Feature: Draw Tool Functionality
  As a mission scientist
  I want to create and manage drawings on the map
  So that I can annotate areas of interest and collaborate with my team

  Scenario: Creating basic geometric shapes
    Given the Draw tool is enabled and active
    When I select the point drawing mode
    And I click on the map
    Then a point should be created at that location
    And the point should be visible on the map
    When I select the line drawing mode
    And I click multiple points to create a line
    Then a line should connect all the clicked points
    When I select the polygon drawing mode
    And I click multiple points to create a polygon
    Then a closed polygon should be created

  Scenario: Editing drawing properties
    Given I have created a drawing on the map
    When I select the drawing
    Then editing handles should appear
    And a properties panel should be available
    When I modify properties like color or style
    Then the drawing appearance should update immediately
    And the changes should be saved

  Scenario: Using drawing templates
    Given drawing templates are configured
    When I create a new drawing
    Then template options should be available
    When I select a template
    Then appropriate property fields should appear
    And I should be able to fill in template-specific information

  Scenario: Managing drawing files
    Given I have created multiple drawings
    When I access the file management interface
    Then I should see a list of available drawing files
    And I should be able to create new drawing files
    When I select a drawing file
    Then I should be able to open, edit, or delete it
    And file operations should provide appropriate feedback

  Scenario: Collaborative drawing features
    Given collaborative drawing is enabled
    And multiple users are working on the same mission
    When I create or modify a drawing
    Then other users should see the changes in real-time
    And user attribution should be maintained
    When another user creates a drawing
    Then I should see their drawing appear on my map

  Scenario: Drawing file sharing and permissions
    Given I have created drawings in a file
    When I configure sharing settings for the file
    Then appropriate users should gain access
    And permission levels should be enforced
    When I share a file with read-only access
    Then recipients should be able to view but not modify drawings

  Scenario: Drawing data export and import
    Given I have created drawings with properties
    When I export the drawing data
    Then the export should include all geometric and property information
    And the export format should be standards-compliant
    When I import previously exported drawing data
    Then all drawings should appear correctly with their properties intact