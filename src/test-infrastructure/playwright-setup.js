/**
 * Playwright Global Setup for MMGIS BDD Testing
 * 
 * This module runs before all tests to ensure the test infrastructure
 * is properly configured and available.
 */

const { TestInfrastructureSetup } = require('./setup');

async function globalSetup(config) {
  console.log('🏗️  Starting Playwright global setup for MMGIS...');
  
  // Initialize infrastructure setup
  const infraSetup = new TestInfrastructureSetup({
    dbTimeout: 45000,
    titilerTimeout: 15000,
    stacTimeout: 15000,
    mmgisTimeout: 30000
  });
  
  try {
    // Setup test infrastructure
    const results = await infraSetup.setupTestInfrastructure();
    
    // Store service status in global config for tests
    global.testInfrastructure = {
      setup: infraSetup,
      services: results,
      config: infraSetup.config
    };
    
    console.log('✅ Playwright global setup completed successfully');
    return results;
  } catch (error) {
    console.error('❌ Playwright global setup failed:', error.message);
    throw error;
  }
}

module.exports = globalSetup;