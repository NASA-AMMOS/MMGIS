/**
 * Playwright Global Teardown for MMGIS BDD Testing
 * 
 * This module runs after all tests to clean up test infrastructure.
 */

async function globalTeardown(config) {
  console.log('🧹 Starting Playwright global teardown for MMGIS...');
  
  try {
    // Cleanup test infrastructure if available
    if (global.testInfrastructure && global.testInfrastructure.setup) {
      await global.testInfrastructure.setup.cleanup();
    }
    
    console.log('✅ Playwright global teardown completed');
  } catch (error) {
    console.error('⚠ Error during Playwright teardown:', error.message);
    // Don't throw - teardown errors shouldn't fail the test run
  }
}

module.exports = globalTeardown;