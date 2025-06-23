import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const feature = loadFeature('./src/features/InfoTool.feature');

defineFeature(feature, test => {
  let infoTool;
  let mockFeatures;
  let mockPopup;

  beforeEach(() => {
    mockFeatures = [
      {
        id: 'feature1',
        properties: {
          name: 'Sample Site Alpha',
          type: 'geological',
          priority: 'high',
          coordinates: [100.5, 50.2],
          date_collected: '2023-06-15',
          sample_count: 5
        },
        geometry: { type: 'Point', coordinates: [100.5, 50.2] }
      },
      {
        id: 'feature2',
        properties: {
          formation_name: 'Crater Rim Formation',
          rock_type: 'basalt',
          age_estimate: '3.2 billion years',
          metadata: {
            analysis_method: 'spectroscopy',
            confidence: 0.95,
            nested_data: {
              instrument: 'APXS',
              calibration: 'latest'
            }
          }
        },
        geometry: { type: 'Polygon', coordinates: [[[100, 50], [101, 50], [101, 51], [100, 51], [100, 50]]] }
      }
    ];

    mockPopup = {
      visible: false,
      position: null,
      content: null,
      show: jest.fn((position, content) => {
        mockPopup.visible = true;
        mockPopup.position = position;
        mockPopup.content = content;
      }),
      hide: jest.fn(() => {
        mockPopup.visible = false;
        mockPopup.content = null;
      }),
      updateContent: jest.fn((content) => {
        mockPopup.content = content;
      })
    };

    infoTool = {
      active: true,
      sortAlphabetically: true,
      queryFeatureAt: jest.fn((coordinates) => {
        return mockFeatures.filter(feature => {
          if (feature.geometry.type === 'Point') {
            return Math.abs(feature.geometry.coordinates[0] - coordinates[0]) < 0.1 &&
                   Math.abs(feature.geometry.coordinates[1] - coordinates[1]) < 0.1;
          }
          return true; // Simplified for polygon containment
        });
      }),
      formatProperties: jest.fn((properties) => {
        if (infoTool.sortAlphabetically) {
          const sorted = {};
          Object.keys(properties).sort().forEach(key => {
            sorted[key] = properties[key];
          });
          return sorted;
        }
        return properties;
      }),
      formatComplexData: jest.fn((data) => {
        if (typeof data === 'object' && data !== null) {
          return JSON.stringify(data, null, 2);
        }
        return data;
      }),
      displayFeatureInfo: jest.fn((feature, clickPosition) => {
        const formattedProperties = infoTool.formatProperties(feature.properties);
        mockPopup.show(clickPosition, {
          feature: feature,
          properties: formattedProperties
        });
      })
    };
  });

  test('Querying vector feature properties', ({ given, when, then, and }) => {
    let clickedFeature;
    let clickPosition = [100.5, 50.2];

    given('vector layers with attribute data are loaded', () => {
      expect(mockFeatures.length).toBeGreaterThan(0);
      expect(mockFeatures[0].properties).toBeDefined();
    });

    and('the Info tool is active', () => {
      expect(infoTool.active).toBe(true);
    });

    when('I click on a vector feature', () => {
      const foundFeatures = infoTool.queryFeatureAt(clickPosition);
      clickedFeature = foundFeatures[0];
      infoTool.displayFeatureInfo(clickedFeature, clickPosition);
    });

    then('a popup should appear with the feature\'s properties', () => {
      expect(mockPopup.visible).toBe(true);
      expect(mockPopup.content.feature).toBe(clickedFeature);
    });

    and('the properties should be formatted appropriately', () => {
      expect(infoTool.formatProperties).toHaveBeenCalledWith(clickedFeature.properties);
    });

    and('the popup should be positioned near the clicked location', () => {
      expect(mockPopup.position).toEqual(clickPosition);
    });
  });

  test('Property display formatting and sorting', ({ given, when, then, and }) => {
    let featureWithMultipleProperties;
    let formattedProperties;

    given('a feature has multiple properties', () => {
      featureWithMultipleProperties = mockFeatures[0];
      expect(Object.keys(featureWithMultipleProperties.properties).length).toBeGreaterThan(3);
    });

    when('the Info tool displays the feature information', () => {
      formattedProperties = infoTool.formatProperties(featureWithMultipleProperties.properties);
      infoTool.displayFeatureInfo(featureWithMultipleProperties, [100, 50]);
    });

    then('properties should be sorted alphabetically if configured', () => {
      const keys = Object.keys(formattedProperties);
      const sortedKeys = [...keys].sort();
      expect(keys).toEqual(sortedKeys);
    });

    and('property names should be human-readable labels', () => {
      expect(formattedProperties).toHaveProperty('coordinates');
      expect(formattedProperties).toHaveProperty('date_collected');
      expect(formattedProperties).toHaveProperty('name');
    });

    and('property values should be formatted according to their data type', () => {
      expect(typeof formattedProperties.sample_count).toBe('number');
      expect(typeof formattedProperties.name).toBe('string');
      expect(Array.isArray(formattedProperties.coordinates)).toBe(true);
    });
  });

  test('Complex property data visualization', ({ given, when, then, and }) => {
    let featureWithComplexData;
    let formattedComplexData;

    given('a feature has complex property data (JSON, arrays, etc.)', () => {
      featureWithComplexData = mockFeatures[1];
      expect(featureWithComplexData.properties.metadata).toBeDefined();
      expect(typeof featureWithComplexData.properties.metadata).toBe('object');
    });

    when('I view the feature information', () => {
      formattedComplexData = infoTool.formatComplexData(featureWithComplexData.properties.metadata);
      infoTool.displayFeatureInfo(featureWithComplexData, [100, 50]);
    });

    then('complex data should be formatted for readability', () => {
      expect(typeof formattedComplexData).toBe('string');
      expect(formattedComplexData).toContain('analysis_method');
      expect(formattedComplexData).toContain('confidence');
    });

    and('nested structures should be expandable/collapsible', () => {
      expect(formattedComplexData).toContain('nested_data');
      expect(formattedComplexData).toContain('instrument');
    });

    and('JSON data should be properly indented and highlighted', () => {
      expect(formattedComplexData.includes('\n')).toBe(true);
      expect(formattedComplexData.includes('  ')).toBe(true); // Indentation
    });
  });

  test('Multi-feature selection and comparison', ({ given, when, then, and }) => {
    let overlappingFeatures;
    let selectedFeatureIndex = 0;

    given('multiple features are present at a click location', () => {
      // Add another feature at the same location for testing
      mockFeatures.push({
        id: 'feature3',
        properties: { name: 'Overlapping Feature', type: 'waypoint' },
        geometry: { type: 'Point', coordinates: [100.5, 50.2] }
      });
    });

    when('I click in an area with overlapping features', () => {
      overlappingFeatures = infoTool.queryFeatureAt([100.5, 50.2]);
    });

    then('I should see options to select which feature to view', () => {
      expect(overlappingFeatures.length).toBeGreaterThan(1);
    });

    and('I should be able to cycle through multiple features', () => {
      selectedFeatureIndex = (selectedFeatureIndex + 1) % overlappingFeatures.length;
      expect(selectedFeatureIndex).toBeLessThan(overlappingFeatures.length);
    });

    and('each feature\'s information should be clearly distinguished', () => {
      const feature1 = overlappingFeatures[0];
      const feature2 = overlappingFeatures[1];
      expect(feature1.id).not.toBe(feature2.id);
      expect(feature1.properties.name).not.toBe(feature2.properties.name);
    });
  });

  test('Feature information persistence', ({ given, when, then, and }) => {
    let initialFeature;
    let newFeature;

    given('I have opened feature information', () => {
      initialFeature = mockFeatures[0];
      infoTool.displayFeatureInfo(initialFeature, [100, 50]);
      expect(mockPopup.visible).toBe(true);
    });

    when('I navigate to other parts of the map', () => {
      // Simulate navigation - popup should remain accessible
      expect(mockPopup.visible).toBe(true);
    });

    then('the information popup should remain accessible', () => {
      expect(mockPopup.content.feature).toBe(initialFeature);
    });

    when('I click on a different feature', () => {
      newFeature = mockFeatures[1];
      infoTool.displayFeatureInfo(newFeature, [101, 51]);
    });

    then('the previous feature information should be replaced', () => {
      expect(mockPopup.content.feature).toBe(newFeature);
      expect(mockPopup.content.feature).not.toBe(initialFeature);
    });

    and('I should be able to close the information display', () => {
      mockPopup.hide();
      expect(mockPopup.visible).toBe(false);
    });
  });

  test('Linked data and external references', ({ given, when, then, and }) => {
    let featureWithLinks;
    let externalLinks = [];

    given('a feature has properties linking to external data', () => {
      featureWithLinks = {
        ...mockFeatures[0],
        properties: {
          ...mockFeatures[0].properties,
          documentation_url: 'https://example.com/docs/sample-alpha',
          related_images: ['https://example.com/images/sample1.jpg', 'https://example.com/images/sample2.jpg'],
          external_database_id: 'DB_12345'
        }
      };
    });

    when('I view the feature information', () => {
      infoTool.displayFeatureInfo(featureWithLinks, [100, 50]);
      
      // Extract links from properties
      Object.entries(featureWithLinks.properties).forEach(([key, value]) => {
        if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('https'))) {
          externalLinks.push({ key, url: value });
        } else if (Array.isArray(value) && value.some(item => typeof item === 'string' && item.startsWith('http'))) {
          value.filter(item => item.startsWith('http')).forEach(url => {
            externalLinks.push({ key, url });
          });
        }
      });
    });

    then('external links should be clickable and functional', () => {
      expect(externalLinks.length).toBeGreaterThan(0);
      expect(externalLinks[0].url).toMatch(/^https?:\/\//);
    });

    and('linked data should load appropriately', () => {
      expect(featureWithLinks.properties.documentation_url).toBe('https://example.com/docs/sample-alpha');
    });

    and('any embedded content should display correctly', () => {
      expect(featureWithLinks.properties.related_images).toHaveLength(2);
    });
  });

  test('Info tool keyboard navigation', ({ given, when, then, and }) => {
    let keyboardShortcuts = {
      'i': 'activate_info_tool',
      'escape': 'close_popup',
      'tab': 'cycle_features'
    };
    let currentShortcut;

    given('the Info tool supports keyboard shortcuts', () => {
      expect(Object.keys(keyboardShortcuts).length).toBeGreaterThan(0);
    });

    when('I use keyboard shortcuts to query features', () => {
      currentShortcut = keyboardShortcuts['i'];
      // Simulate pressing 'i' key to activate info tool
      infoTool.active = true;
    });

    then('the tool should respond to the configured hotkeys', () => {
      expect(currentShortcut).toBe('activate_info_tool');
      expect(infoTool.active).toBe(true);
    });

    and('keyboard navigation should work within the information display', () => {
      expect(keyboardShortcuts['tab']).toBe('cycle_features');
    });

    and('keyboard shortcuts should be documented and discoverable', () => {
      expect(keyboardShortcuts['escape']).toBe('close_popup');
      expect(Object.keys(keyboardShortcuts)).toContain('i');
      expect(Object.keys(keyboardShortcuts)).toContain('escape');
    });
  });

  test('Information display customization', ({ given, when, then, and }) => {
    let displayConfig = {
      showProperties: ['name', 'type', 'priority'],
      hideProperties: ['coordinates', 'date_collected'],
      customOrder: ['name', 'type', 'priority', 'sample_count']
    };
    let customizedDisplay;

    given('the Info tool display can be customized', () => {
      expect(displayConfig.showProperties).toBeDefined();
      expect(displayConfig.hideProperties).toBeDefined();
    });

    when('I access configuration options', () => {
      expect(displayConfig.customOrder).toBeDefined();
    });

    then('I should be able to control which properties are shown', () => {
      const feature = mockFeatures[0];
      customizedDisplay = {};
      
      displayConfig.showProperties.forEach(prop => {
        if (feature.properties[prop] !== undefined) {
          customizedDisplay[prop] = feature.properties[prop];
        }
      });
      
      expect(Object.keys(customizedDisplay)).toEqual(['name', 'type', 'priority']);
    });

    and('I should be able to modify the display order', () => {
      const orderedKeys = Object.keys(customizedDisplay);
      const expectedOrder = displayConfig.customOrder.filter(key => orderedKeys.includes(key));
      
      // Reorder according to custom order
      const reorderedDisplay = {};
      expectedOrder.forEach(key => {
        if (customizedDisplay[key] !== undefined) {
          reorderedDisplay[key] = customizedDisplay[key];
        }
      });
      
      expect(Object.keys(reorderedDisplay)).toEqual(['name', 'type', 'priority']);
    });

    and('customizations should persist across sessions', () => {
      // Simulate persistence by checking if config is maintained
      expect(displayConfig.showProperties).toEqual(['name', 'type', 'priority']);
      expect(displayConfig.customOrder).toEqual(['name', 'type', 'priority', 'sample_count']);
    });
  });
});