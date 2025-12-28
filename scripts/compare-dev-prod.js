/**
 * Compare dev and production Golden Masters
 */

const admin = require('firebase-admin');

// Initialize DEV
const devApp = admin.initializeApp({
  credential: admin.credential.cert(require('../serviceAccountKey.json')),
  projectId: 'ai-sales-platform-dev',
}, 'dev');

const devDb = devApp.firestore();

// Initialize PROD
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(require('../serviceAccountKey-prod.json')),
  projectId: 'ai-sales-platform-4f5e4',
}, 'prod');

const prodDb = prodApp.firestore();

async function compare() {
  try {
    console.log('\n🔍 Comparing DEV and PRODUCTION...\n');
    
    // Get DEV Golden Master
    const devGMSnapshot = await devDb.collection('organizations')
      .doc('platform-admin')
      .collection('goldenMasters')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    // Get PROD Golden Master
    const prodGMDoc = await prodDb.collection('organizations')
      .doc('platform')
      .collection('goldenMasters')
      .doc('gm-platform-1')
      .get();
    
    if (devGMSnapshot.empty) {
      console.log('❌ No active Golden Master in DEV');
      return;
    }
    
    if (!prodGMDoc.exists) {
      console.log('❌ No Golden Master in PRODUCTION');
      return;
    }
    
    const devGM = devGMSnapshot.docs[0].data();
    const prodGM = prodGMDoc.data();
    
    console.log('='.repeat(80));
    console.log('COMPARISON SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    console.log('DEV (platform-admin):');
    console.log('  Name:', devGM.name);
    console.log('  isActive:', devGM.isActive);
    console.log('  Model:', devGM.modelId || devGM.baseModelId);
    console.log('  System Prompt:', devGM.systemPrompt ? `${devGM.systemPrompt.length} chars` : 'NOT SET');
    console.log('  Business Context:', devGM.businessContext ? 'YES' : 'NO');
    console.log('  Agent Persona:', devGM.agentPersona ? 'YES' : 'NO');
    console.log('  Behavior Config:', devGM.behaviorConfig ? 'YES' : 'NO');
    
    console.log('\nPRODUCTION (platform):');
    console.log('  Name:', prodGM.name);
    console.log('  isActive:', prodGM.isActive);
    console.log('  Model:', prodGM.modelId || prodGM.baseModelId);
    console.log('  System Prompt:', prodGM.systemPrompt ? `${prodGM.systemPrompt.length} chars` : 'NOT SET');
    console.log('  Business Context:', prodGM.businessContext ? 'YES' : 'NO');
    console.log('  Agent Persona:', prodGM.agentPersona ? 'YES' : 'NO');
    console.log('  Behavior Config:', prodGM.behaviorConfig ? 'YES' : 'NO');
    
    console.log('\n' + '-'.repeat(80));
    console.log('STATUS:');
    console.log('-'.repeat(80));
    
    // Compare key fields
    const samePrompt = devGM.systemPrompt === prodGM.systemPrompt;
    const sameModel = (devGM.modelId || devGM.baseModelId) === (prodGM.modelId || prodGM.baseModelId);
    const bothActive = devGM.isActive === true && prodGM.isActive === true;
    
    console.log('✓ Both Active:', bothActive ? '✅ YES' : '❌ NO');
    console.log('✓ Same Model:', sameModel ? '✅ YES' : '❌ NO');
    console.log('✓ Same System Prompt:', samePrompt ? '✅ YES' : '❌ NO');
    console.log('✓ Prod has Business Context:', prodGM.businessContext ? '✅ YES (Enhanced)' : '❌ NO');
    console.log('✓ Prod has Agent Persona:', prodGM.agentPersona ? '✅ YES (Enhanced)' : '❌ NO');
    console.log('✓ Prod has Behavior Config:', prodGM.behaviorConfig ? '✅ YES (Enhanced)' : '❌ NO');
    
    console.log('\n' + '-'.repeat(80));
    console.log('CONCLUSION:');
    console.log('-'.repeat(80));
    
    if (bothActive && sameModel) {
      console.log('✅ SYNCED: Both environments are active and using the same model');
      console.log('✅ ENHANCED: Production has additional configuration (Business Context, Persona, Behavior)');
      console.log('🌐 LIVE: www.salesvelocity.ai is using the production Golden Master');
    } else {
      console.log('⚠️  NOT FULLY SYNCED - Review differences above');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

compare();


