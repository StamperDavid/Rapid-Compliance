/**
 * PRODUCTION PROTECTION MODULE
 * Prevents seed/test scripts from running against production database
 * 
 * ALL SEED SCRIPTS MUST REQUIRE THIS MODULE AT THE TOP
 */

const readline = require('readline');

// Production project IDs that should NEVER be seeded with test data
const PRODUCTION_PROJECT_IDS = [
  'ai-sales-platform-dev', // ACTUAL PRODUCTION DATABASE (misnamed as "dev")
  'ai-sales-platform-7a0aa',
  'ai-sales-platform-prod',
  'ai-sales-platform-production',
];

/**
 * Checks if the current Firebase project is production
 * @param {string} projectId - The Firebase project ID
 * @returns {boolean}
 */
function isProductionProject(projectId) {
  if (!projectId) {
    return false;
  }
  
  return PRODUCTION_PROJECT_IDS.some(prodId => 
    projectId.toLowerCase().includes(prodId.toLowerCase())
  ) || projectId.toLowerCase().includes('prod');
}

/**
 * Prevents script execution if running against production
 * @param {string} projectId - The Firebase project ID
 * @param {string} scriptName - Name of the script trying to run
 */
async function requireProductionProtection(projectId, scriptName) {
  console.log('\n🛡️ PRODUCTION PROTECTION CHECK');
  console.log('='.repeat(80));
  console.log(`Script: ${scriptName}`);
  console.log(`Project ID: ${projectId || 'UNKNOWN'}`);
  
  // If project ID contains 'prod' or is in the production list, BLOCK
  if (isProductionProject(projectId)) {
    console.log('\n🚨 ERROR: This script is attempting to run against PRODUCTION!');
    console.log('='.repeat(80));
    console.log('This script creates TEST DATA and should NEVER run against production.');
    console.log('\nTo run test scripts:');
    console.log('1. Use Firebase emulators (recommended)');
    console.log('2. Create a separate dev/test Firebase project');
    console.log('3. Never use your production serviceAccountKey.json');
    console.log('\n' + '='.repeat(80));
    console.error('\n❌ BLOCKED: Cannot seed test data to production database\n');
    process.exit(1);
  }
  
  // Even for non-production, require confirmation
  console.log('\n⚠️  WARNING: This script will create TEST DATA');
  console.log('Are you sure this is a development/test database?');
  
  const confirmed = await askConfirmation('\nType "YES I AM SURE" to proceed: ');
  
  if (confirmed !== 'YES I AM SURE') {
    console.log('\n❌ Script cancelled. No data was created.');
    process.exit(0);
  }
  
  console.log('\n✅ Confirmed - proceeding with test data creation...\n');
}

/**
 * Ask user for confirmation
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

module.exports = {
  requireProductionProtection,
  isProductionProject,
  PRODUCTION_PROJECT_IDS
};
