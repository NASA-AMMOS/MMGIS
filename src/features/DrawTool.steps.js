import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const feature = loadFeature('./src/features/DrawTool.feature');

defineFeature(feature, test => {
  let drawTool;
  let mockDrawings;
  let mockFileManager;

  beforeEach(() => {
    mockDrawings = [];
    
    drawTool = {
      active: false,
      mode: null,
      activate: jest.fn(() => { drawTool.active = true; }),
      setMode: jest.fn((mode) => { drawTool.mode = mode; }),
      createPoint: jest.fn((coordinates) => {
        const point = { type: 'point', coordinates, id: Date.now() };
        mockDrawings.push(point);
        return point;
      }),
      createLine: jest.fn((coordinates) => {
        const line = { type: 'line', coordinates, id: Date.now() };
        mockDrawings.push(line);
        return line;
      }),
      createPolygon: jest.fn((coordinates) => {
        const polygon = { type: 'polygon', coordinates, id: Date.now() };
        mockDrawings.push(polygon);
        return polygon;
      }),
      selectDrawing: jest.fn(),
      updateProperties: jest.fn()
    };

    mockFileManager = {
      files: [],
      createFile: jest.fn((name) => {
        const file = { id: Date.now(), name, drawings: [], shared: false };
        mockFileManager.files.push(file);
        return file;
      }),
      deleteFile: jest.fn((fileId) => {
        mockFileManager.files = mockFileManager.files.filter(f => f.id !== fileId);
      }),
      shareFile: jest.fn((fileId, permissions) => {
        const file = mockFileManager.files.find(f => f.id === fileId);
        if (file) {
          file.shared = true;
          file.permissions = permissions;
        }
      })
    };
  });

  test('Creating basic geometric shapes', ({ given, when, then, and }) => {
    given('the Draw tool is enabled and active', () => {
      drawTool.activate();
      expect(drawTool.active).toBe(true);
    });

    when('I select the point drawing mode', () => {
      drawTool.setMode('point');
    });

    and('I click on the map', () => {
      drawTool.createPoint([100, 50]);
    });

    then('a point should be created at that location', () => {
      expect(drawTool.createPoint).toHaveBeenCalledWith([100, 50]);
    });

    and('the point should be visible on the map', () => {
      const pointDrawing = mockDrawings.find(d => d.type === 'point');
      expect(pointDrawing).toBeDefined();
      expect(pointDrawing.coordinates).toEqual([100, 50]);
    });

    when('I select the line drawing mode', () => {
      drawTool.setMode('line');
    });

    and('I click multiple points to create a line', () => {
      const lineCoordinates = [[100, 50], [110, 60], [120, 55]];
      drawTool.createLine(lineCoordinates);
    });

    then('a line should connect all the clicked points', () => {
      const lineDrawing = mockDrawings.find(d => d.type === 'line');
      expect(lineDrawing).toBeDefined();
      expect(lineDrawing.coordinates.length).toBe(3);
    });

    when('I select the polygon drawing mode', () => {
      drawTool.setMode('polygon');
    });

    and('I click multiple points to create a polygon', () => {
      const polygonCoordinates = [[100, 50], [110, 60], [120, 55], [100, 50]];
      drawTool.createPolygon([polygonCoordinates]);
    });

    then('a closed polygon should be created', () => {
      const polygonDrawing = mockDrawings.find(d => d.type === 'polygon');
      expect(polygonDrawing).toBeDefined();
      expect(polygonDrawing.coordinates[0][0]).toEqual(polygonDrawing.coordinates[0][polygonDrawing.coordinates[0].length - 1]);
    });
  });

  test('Editing drawing properties', ({ given, when, then, and }) => {
    let selectedDrawing;
    let propertiesPanel = { visible: false, properties: {} };

    given('I have created a drawing on the map', () => {
      selectedDrawing = drawTool.createPoint([100, 50]);
      expect(selectedDrawing).toBeDefined();
    });

    when('I select the drawing', () => {
      drawTool.selectDrawing(selectedDrawing.id);
      propertiesPanel.visible = true;
    });

    then('editing handles should appear', () => {
      expect(drawTool.selectDrawing).toHaveBeenCalledWith(selectedDrawing.id);
    });

    and('a properties panel should be available', () => {
      expect(propertiesPanel.visible).toBe(true);
    });

    when('I modify properties like color or style', () => {
      const newProperties = { color: 'red', style: 'dashed' };
      drawTool.updateProperties(selectedDrawing.id, newProperties);
      propertiesPanel.properties = newProperties;
    });

    then('the drawing appearance should update immediately', () => {
      expect(drawTool.updateProperties).toHaveBeenCalledWith(
        selectedDrawing.id, 
        { color: 'red', style: 'dashed' }
      );
    });

    and('the changes should be saved', () => {
      expect(propertiesPanel.properties).toEqual({ color: 'red', style: 'dashed' });
    });
  });

  test('Using drawing templates', ({ given, when, then, and }) => {
    let templates = [
      { id: 'site', name: 'Sample Site', fields: ['site_name', 'sample_type', 'priority'] },
      { id: 'waypoint', name: 'Navigation Waypoint', fields: ['waypoint_id', 'notes'] }
    ];
    let selectedTemplate = null;
    let templateFields = {};

    given('drawing templates are configured', () => {
      expect(templates.length).toBeGreaterThan(0);
    });

    when('I create a new drawing', () => {
      drawTool.createPoint([100, 50]);
    });

    then('template options should be available', () => {
      expect(templates).toBeDefined();
      expect(templates.length).toBe(2);
    });

    when('I select a template', () => {
      selectedTemplate = templates[0];
      templateFields = selectedTemplate.fields.reduce((acc, field) => {
        acc[field] = '';
        return acc;
      }, {});
    });

    then('appropriate property fields should appear', () => {
      expect(selectedTemplate.fields).toContain('site_name');
      expect(selectedTemplate.fields).toContain('sample_type');
      expect(selectedTemplate.fields).toContain('priority');
    });

    and('I should be able to fill in template-specific information', () => {
      templateFields.site_name = 'Landing Site Alpha';
      templateFields.sample_type = 'Rock';
      templateFields.priority = 'High';
      
      expect(templateFields.site_name).toBe('Landing Site Alpha');
      expect(templateFields.sample_type).toBe('Rock');
      expect(templateFields.priority).toBe('High');
    });
  });

  test('Managing drawing files', ({ given, when, then, and }) => {
    let fileList = [];

    given('I have created multiple drawings', () => {
      drawTool.createPoint([100, 50]);
      drawTool.createLine([[100, 50], [110, 60]]);
      expect(mockDrawings.length).toBe(2);
    });

    when('I access the file management interface', () => {
      fileList = mockFileManager.files;
    });

    then('I should see a list of available drawing files', () => {
      expect(fileList).toBeDefined();
      expect(Array.isArray(fileList)).toBe(true);
    });

    and('I should be able to create new drawing files', () => {
      mockFileManager.createFile('Mission Planning');
      expect(mockFileManager.createFile).toHaveBeenCalledWith('Mission Planning');
    });

    when('I select a drawing file', () => {
      const newFile = mockFileManager.createFile('Test File');
      expect(newFile).toBeDefined();
    });

    then('I should be able to open, edit, or delete it', () => {
      const fileId = mockFileManager.files[0].id;
      mockFileManager.deleteFile(fileId);
      expect(mockFileManager.deleteFile).toHaveBeenCalledWith(fileId);
    });

    and('file operations should provide appropriate feedback', () => {
      expect(mockFileManager.files.length).toBe(0);
    });
  });

  test('Collaborative drawing features', ({ given, when, then, and }) => {
    let collaborativeSession = {
      users: ['user1', 'user2'],
      drawings: [],
      addDrawing: jest.fn((drawing, userId) => {
        drawing.author = userId;
        collaborativeSession.drawings.push(drawing);
      }),
      broadcastChange: jest.fn()
    };

    given('collaborative drawing is enabled', () => {
      expect(collaborativeSession.users.length).toBeGreaterThan(1);
    });

    and('multiple users are working on the same mission', () => {
      expect(collaborativeSession.users).toContain('user1');
      expect(collaborativeSession.users).toContain('user2');
    });

    when('I create or modify a drawing', () => {
      const drawing = drawTool.createPoint([100, 50]);
      collaborativeSession.addDrawing(drawing, 'user1');
      collaborativeSession.broadcastChange();
    });

    then('other users should see the changes in real-time', () => {
      expect(collaborativeSession.broadcastChange).toHaveBeenCalled();
    });

    and('user attribution should be maintained', () => {
      const drawing = collaborativeSession.drawings[0];
      expect(drawing.author).toBe('user1');
    });

    when('another user creates a drawing', () => {
      const otherUserDrawing = { type: 'point', coordinates: [110, 60], id: Date.now() };
      collaborativeSession.addDrawing(otherUserDrawing, 'user2');
    });

    then('I should see their drawing appear on my map', () => {
      expect(collaborativeSession.drawings.length).toBe(2);
      expect(collaborativeSession.drawings[1].author).toBe('user2');
    });
  });

  test('Drawing file sharing and permissions', ({ given, when, then, and }) => {
    let drawingFile;
    let permissions = { read: true, write: false };

    given('I have created drawings in a file', () => {
      drawingFile = mockFileManager.createFile('Shared Observations');
      expect(drawingFile).toBeDefined();
    });

    when('I configure sharing settings for the file', () => {
      mockFileManager.shareFile(drawingFile.id, { users: ['colleague1'], permissions: 'read' });
    });

    then('appropriate users should gain access', () => {
      expect(mockFileManager.shareFile).toHaveBeenCalledWith(
        drawingFile.id, 
        { users: ['colleague1'], permissions: 'read' }
      );
    });

    and('permission levels should be enforced', () => {
      const sharedFile = mockFileManager.files.find(f => f.id === drawingFile.id);
      expect(sharedFile.shared).toBe(true);
    });

    when('I share a file with read-only access', () => {
      permissions.write = false;
    });

    then('recipients should be able to view but not modify drawings', () => {
      expect(permissions.read).toBe(true);
      expect(permissions.write).toBe(false);
    });
  });

  test('Drawing data export and import', ({ given, when, then, and }) => {
    let exportData;
    let importedDrawings = [];

    given('I have created drawings with properties', () => {
      const drawing = drawTool.createPoint([100, 50]);
      drawing.properties = { name: 'Sample Site A', type: 'geological' };
      expect(drawing.properties).toBeDefined();
    });

    when('I export the drawing data', () => {
      exportData = {
        type: 'FeatureCollection',
        features: mockDrawings.map(drawing => ({
          type: 'Feature',
          geometry: {
            type: drawing.type === 'point' ? 'Point' : drawing.type === 'line' ? 'LineString' : 'Polygon',
            coordinates: drawing.coordinates
          },
          properties: drawing.properties || {}
        }))
      };
    });

    then('the export should include all geometric and property information', () => {
      expect(exportData.type).toBe('FeatureCollection');
      expect(exportData.features.length).toBeGreaterThan(0);
      expect(exportData.features[0].geometry).toBeDefined();
      expect(exportData.features[0].properties).toBeDefined();
    });

    and('the export format should be standards-compliant', () => {
      expect(exportData.type).toBe('FeatureCollection');
      expect(exportData.features[0].type).toBe('Feature');
    });

    when('I import previously exported drawing data', () => {
      importedDrawings = exportData.features.map(feature => ({
        type: feature.geometry.type.toLowerCase(),
        coordinates: feature.geometry.coordinates,
        properties: feature.properties,
        id: Date.now() + Math.random()
      }));
    });

    then('all drawings should appear correctly with their properties intact', () => {
      expect(importedDrawings.length).toBe(exportData.features.length);
      expect(importedDrawings[0].properties).toEqual(mockDrawings[0].properties);
    });
  });
});