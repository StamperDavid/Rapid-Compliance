/**
 * Jest Global Teardown
 * Runs AFTER all tests to clean up test data from DEV database
 * 
 * USES db-manager.js as single source of truth for cleanup logic
 */

const { config } = require('dotenv');
const { cleanupTestData, cleanupTestCollections } = require('./scripts/db-manager');

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

    // Safety net: clean top-level test collections
    // (temporary_scrapes, discoveryArchive, training_*, etc.)
    await cleanupTestCollections();
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isQuotaError = errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('Quota exceeded');

    console.error('\n❌ ========================================');
    console.error('❌ CLEANUP FAILED — TEST DATA MAY PERSIST');
    console.error('❌ ========================================');
    console.error('❌ Error:', errorMsg);
    console.error('❌ Run manually: node scripts/db-manager.js --nuke');
    console.error('❌ ========================================\n');

    // Don't fail the test run on quota errors — cleanup can be retried later
    if (isQuotaError) {
      console.warn('⚠️  Firestore quota exhausted. Cleanup skipped. Run db-manager.js --nuke when quota resets.');
      return;
    }

    // Throw on non-quota errors so CI/CD catches real failures
    throw new Error(`Test cleanup failed: ${errorMsg}`);
  }
};
