Feature: Info Tool Behavior
  As a mission scientist
  I want to query and view feature information
  So that I can access detailed data about map elements

  Scenario: Querying vector feature properties
    Given vector layers with attribute data are loaded
    And the Info tool is active
    When I click on a vector feature
    Then a popup should appear with the feature's properties
    And the properties should be formatted appropriately
    And the popup should be positioned near the clicked location

  Scenario: Property display formatting and sorting
    Given a feature has multiple properties
    When the Info tool displays the feature information
    Then properties should be sorted alphabetically if configured
    And property names should be human-readable labels
    And property values should be formatted according to their data type

  Scenario: Complex property data visualization
    Given a feature has complex property data (JSON, arrays, etc.)
    When I view the feature information
    Then complex data should be formatted for readability
    And nested structures should be expandable/collapsible
    And JSON data should be properly indented and highlighted

  Scenario: Multi-feature selection and comparison
    Given multiple features are present at a click location
    When I click in an area with overlapping features
    Then I should see options to select which feature to view
    And I should be able to cycle through multiple features
    And each feature's information should be clearly distinguished

  Scenario: Feature information persistence
    Given I have opened feature information
    When I navigate to other parts of the map
    Then the information popup should remain accessible
    When I click on a different feature
    Then the previous feature information should be replaced
    And I should be able to close the information display

  Scenario: Linked data and external references
    Given a feature has properties linking to external data
    When I view the feature information
    Then external links should be clickable and functional
    And linked data should load appropriately
    And any embedded content should display correctly

  Scenario: Info tool keyboard navigation
    Given the Info tool supports keyboard shortcuts
    When I use keyboard shortcuts to query features
    Then the tool should respond to the configured hotkeys
    And keyboard navigation should work within the information display
    And keyboard shortcuts should be documented and discoverable

  Scenario: Information display customization
    Given the Info tool display can be customized
    When I access configuration options
    Then I should be able to control which properties are shown
    And I should be able to modify the display order
    And customizations should persist across sessions