/**
 * Jest Global Teardown
 * Runs AFTER all tests to clean up test data from DEV database
 * 
 * USES db-manager.js as single source of truth for cleanup logic
 */

const { config } = require('dotenv');
const { cleanupTestData } = require('./scripts/db-manager');

// Load environment variables
config({ path: '.env.local' });

module.exports = async () => {
  console.log('\n🧹 ========================================');
  console.log('🧹 JEST TEARDOWN: Cleaning test data...');
  console.log('🧹 Using db-manager.js for cleanup');
  console.log('🧹 ========================================\n');

  try {
    // Use the official cleanup logic from db-manager.js
    // Run in LIVE mode (not dry run) to actually clean up
    await cleanupTestData(false);
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    // Don't fail the tests if cleanup fails
  }
};
