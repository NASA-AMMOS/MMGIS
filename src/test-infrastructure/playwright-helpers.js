/**
 * Playwright Helper Functions for MMGIS BDD Testing
 * 
 * This module provides reusable functions for common MMGIS interactions
 * that can be shared across different BDD test scenarios.
 */

class MMGISPlaywrightHelpers {
  constructor(page) {
    this.page = page;
  }

  /**
   * Navigate to MMGIS and wait for it to load completely
   */
  async navigateToMMGIS(baseUrl, missionName = '') {
    const url = missionName ? `${baseUrl}?mission=${missionName}` : baseUrl;
    
    await this.page.goto(url);
    
    // Wait for main map container
    await this.page.waitForSelector('#map', { timeout: 30000 });
    
    // Wait for loading to complete
    await this.page.waitForFunction(() => {
      // Check for common loading indicators
      const loadingElements = document.querySelectorAll(
        '.loading, .spinner, [data-loading], .mmgis-loading'
      );
      const stillLoading = Array.from(loadingElements).some(el => 
        el.offsetParent !== null && el.style.display !== 'none'
      );
      
      // Also check if map libraries are loaded
      const mapLoaded = window.L || window.ol || window.mmgisAPI;
      
      return !stillLoading && mapLoaded;
    }, { timeout: 30000 });
    
    // Additional wait for map initialization
    await this.page.waitForTimeout(2000);
  }

  /**
   * Authenticate with MMGIS configure interface
   */
  async authenticateWithConfigure(baseUrl, username = 'test_admin', password = 'test_password') {
    await this.page.goto(`${baseUrl}/configure`);
    
    // Check if we need to create admin account
    try {
      const signupForm = await this.page.waitForSelector('form[action="/configure/signup"]', { timeout: 3000 });
      if (signupForm) {
        console.log('Creating admin account...');
        await this.page.fill('input[name="username"]', username);
        await this.page.fill('input[name="password"]', password);
        await this.page.fill('input[name="confirmpassword"]', password);
        await this.page.click('button[type="submit"]');
        await this.page.waitForURL(/\/configure$/);
        return { created: true };
      }
    } catch (e) {
      // Admin might exist, try login
    }
    
    // Try to login
    try {
      await this.page.fill('input[name="username"]', username);
      await this.page.fill('input[name="password"]', password);
      await this.page.click('button[type="submit"]');
      await this.page.waitForURL(/\/configure$/);
      return { loggedIn: true };
    } catch (loginError) {
      throw new Error(`Authentication failed: ${loginError.message}`);
    }
  }

  /**
   * Create a mission through the configure interface
   */
  async createMission(missionName, configData = null) {
    try {
      // Click NEW MISSION
      await this.page.click('text=NEW MISSION');
      await this.page.waitForSelector('input[name="missionName"]');
      
      // Enter mission name
      await this.page.fill('input[name="missionName"]', missionName);
      
      // Create mission
      await this.page.click('text=MAKE MISSION');
      await this.page.waitForURL(new RegExp(`/configure\\?mission=${missionName}`));
      
      // If config data provided, apply it
      if (configData) {
        await this.applyMissionConfiguration(configData);
      }
      
      return { success: true, mission: missionName };
    } catch (error) {
      console.log(`Mission ${missionName} might already exist: ${error.message}`);
      return { success: false, exists: true, mission: missionName };
    }
  }

  /**
   * Apply configuration to a mission
   */
  async applyMissionConfiguration(configData) {
    // This would interact with the configure interface to set up layers, tools, etc.
    // Implementation depends on the specific configure UI structure
    console.log('Applying mission configuration...');
    
    // For now, we'll just verify the config interface is available
    const configExists = await this.page.locator('.configure-interface, #configure, [data-configure]').first().isVisible();
    if (!configExists) {
      console.warn('Configure interface not found, using default configuration');
    }
  }

  /**
   * Wait for map to be fully loaded and interactive
   */
  async waitForMapReady() {
    return await this.page.waitForFunction(() => {
      // Check for map instance
      const mapInstance = window.L?.mmgisMap || window.mmgisAPI?.map;
      if (!mapInstance) return false;
      
      // Check that map has loaded tiles
      const mapContainer = document.getElementById('map');
      if (!mapContainer) return false;
      
      const tileImages = mapContainer.querySelectorAll('img[src*="tile"], canvas');
      const hasContent = tileImages.length > 0;
      
      return hasContent;
    }, { timeout: 30000 });
  }

  /**
   * Get current map state (center, zoom, bounds)
   */
  async getMapState() {
    return await this.page.evaluate(() => {
      if (window.L && window.L.mmgisMap) {
        const center = window.L.mmgisMap.getCenter();
        const bounds = window.L.mmgisMap.getBounds();
        return {
          center: [center.lat, center.lng],
          zoom: window.L.mmgisMap.getZoom(),
          bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
          }
        };
      } else if (window.ol && window.ol.mmgisMap) {
        // OpenLayers implementation
        const view = window.ol.mmgisMap.getView();
        const center = view.getCenter();
        const extent = view.calculateExtent();
        return {
          center: center,
          zoom: view.getZoom(),
          extent: extent
        };
      }
      
      return null;
    });
  }

  /**
   * Pan the map by dragging
   */
  async panMap(deltaX = 100, deltaY = 50) {
    const mapElement = this.page.locator('#map');
    const mapBox = await mapElement.boundingBox();
    
    const startX = mapBox.x + mapBox.width * 0.5;
    const startY = mapBox.y + mapBox.height * 0.5;
    const endX = startX + deltaX;
    const endY = startY + deltaY;
    
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, endY, { steps: 5 });
    await this.page.mouse.up();
    
    // Wait for map to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Zoom the map in or out
   */
  async zoomMap(direction = 'in') {
    try {
      // Try using zoom controls
      const zoomSelector = direction === 'in' 
        ? '.leaflet-control-zoom-in, .ol-zoom-in, [data-zoom-in]'
        : '.leaflet-control-zoom-out, .ol-zoom-out, [data-zoom-out]';
      
      const zoomButton = this.page.locator(zoomSelector);
      await zoomButton.click({ timeout: 3000 });
    } catch (e) {
      // Fallback: use mouse wheel
      const wheelDelta = direction === 'in' ? -120 : 120;
      await this.page.mouse.move(640, 360);
      await this.page.mouse.wheel(0, wheelDelta);
    }
    
    await this.page.waitForTimeout(500);
  }

  /**
   * Toggle a layer on/off
   */
  async toggleLayer(layerName) {
    // Look for layer in layer control
    const layerToggle = this.page.locator(`text=${layerName}`).or(
      this.page.locator(`[data-layer="${layerName}"]`)
    );
    
    await layerToggle.click();
    await this.page.waitForTimeout(1000); // Wait for layer to load/unload
  }

  /**
   * Open a tool by name
   */
  async openTool(toolName) {
    // Look for tool button
    const toolButton = this.page.locator(`[title="${toolName}"], text=${toolName}, [data-tool="${toolName}"]`);
    await toolButton.click();
    
    // Wait for tool interface to appear
    await this.page.waitForSelector(`[data-tool-panel="${toolName}"], .${toolName.toLowerCase()}-tool`, { 
      timeout: 5000 
    });
  }

  /**
   * Perform an Info Tool query at specific coordinates
   */
  async queryAtCoordinates(x, y) {
    // First ensure Info Tool is active
    await this.openTool('Info');
    
    // Click on the map at specified coordinates
    const mapElement = this.page.locator('#map');
    const mapBox = await mapElement.boundingBox();
    
    const clickX = mapBox.x + x;
    const clickY = mapBox.y + y;
    
    await this.page.mouse.click(clickX, clickY);
    
    // Wait for query results
    await this.page.waitForSelector('.info-results, [data-info-results]', { timeout: 10000 });
  }

  /**
   * Switch between 2D and 3D views
   */
  async switchView(targetView = '3D') {
    const viewButton = this.page.locator(`text=${targetView}, [data-view="${targetView}"]`);
    await viewButton.click();
    
    // Wait for view transition
    await this.page.waitForTimeout(3000);
    
    // Verify view has switched
    const currentView = await this.page.evaluate(() => {
      return document.body.getAttribute('data-current-view') || 
             (document.querySelector('.view-3d') ? '3D' : '2D');
    });
    
    return currentView === targetView;
  }

  /**
   * Wait for specific layer to load
   */
  async waitForLayerLoad(layerName, timeout = 30000) {
    return await this.page.waitForFunction((name) => {
      // Check if layer appears in layer list as loaded
      const layerElements = document.querySelectorAll(`[data-layer="${name}"], .layer-item`);
      
      for (const element of layerElements) {
        if (element.textContent.includes(name) && 
            !element.classList.contains('loading') &&
            !element.classList.contains('error')) {
          return true;
        }
      }
      
      return false;
    }, layerName, { timeout });
  }

  /**
   * Take a screenshot with annotation
   */
  async takeAnnotatedScreenshot(filename, annotation = '') {
    if (annotation) {
      // Add text overlay for debugging
      await this.page.evaluate((text) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed; top: 10px; left: 10px; z-index: 10000;
          background: rgba(0,0,0,0.8); color: white; padding: 5px;
          font-family: monospace; font-size: 12px;
        `;
        overlay.textContent = text;
        overlay.id = 'test-annotation';
        document.body.appendChild(overlay);
      }, annotation);
    }
    
    await this.page.screenshot({ path: filename, fullPage: true });
    
    // Remove annotation
    if (annotation) {
      await this.page.evaluate(() => {
        const overlay = document.getElementById('test-annotation');
        if (overlay) overlay.remove();
      });
    }
  }
}

module.exports = { MMGISPlaywrightHelpers };