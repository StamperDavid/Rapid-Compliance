/**
 * Copy enhanced production Golden Master TO dev
 * So dev is the source of truth going forward
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

async function copyProdToDev() {
  try {
    console.log('🔄 Copying enhanced production config TO dev...\n');
    
    // Get production Golden Master (the enhanced one)
    const prodGMDoc = await prodDb.collection('organizations')
      .doc('platform')
      .collection('goldenMasters')
      .doc('gm-platform-1')
      .get();
    
    if (!prodGMDoc.exists) {
      console.log('❌ Production Golden Master not found');
      process.exit(1);
    }
    
    const prodGM = prodGMDoc.data();
    
    console.log('✅ Found production Golden Master');
    console.log('  - System Prompt:', prodGM.systemPrompt ? `${prodGM.systemPrompt.length} chars` : 'NOT SET');
    console.log('  - Business Context:', prodGM.businessContext ? 'YES' : 'NO');
    console.log('  - Agent Persona:', prodGM.agentPersona ? 'YES' : 'NO');
    console.log('  - Behavior Config:', prodGM.behaviorConfig ? 'YES' : 'NO');
    
    // Get dev Golden Master ID
    const devGMSnapshot = await devDb.collection('organizations')
      .doc('platform-admin')
      .collection('goldenMasters')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (devGMSnapshot.empty) {
      console.log('❌ No active Golden Master in dev');
      process.exit(1);
    }
    
    const devGMId = devGMSnapshot.docs[0].id;
    console.log('\n📝 Updating dev Golden Master:', devGMId);
    
    // Prepare update (copy everything from production)
    const updateData = {
      systemPrompt: prodGM.systemPrompt,
      systemInstructions: prodGM.systemInstructions || prodGM.systemPrompt,
      businessContext: prodGM.businessContext,
      agentPersona: prodGM.agentPersona,
      behaviorConfig: prodGM.behaviorConfig,
      knowledgeBase: prodGM.knowledgeBase,
      modelId: prodGM.modelId,
      baseModelId: prodGM.baseModelId,
      temperature: prodGM.temperature,
      maxTokens: prodGM.maxTokens,
      trainedScenarios: prodGM.trainedScenarios || [],
      updatedAt: new Date(),
      updatedBy: 'prod-to-dev-sync'
    };
    
    // Update dev Golden Master
    await devDb.collection('organizations')
      .doc('platform-admin')
      .collection('goldenMasters')
      .doc(devGMId)
      .update(updateData);
    
    console.log('✅ Dev Golden Master updated\n');
    
    // Also update dev Base Model
    console.log('📝 Updating dev Base Model...');
    const prodBaseDoc = await prodDb.collection('organizations')
      .doc('platform')
      .collection('baseModels')
      .doc('platform-sales-agent-base')
      .get();
    
    if (prodBaseDoc.exists) {
      const prodBase = prodBaseDoc.data();
      await devDb.collection('organizations')
        .doc('platform-admin')
        .collection('baseModels')
        .doc('platform-sales-agent-base')
        .set(prodBase, { merge: true });
      console.log('✅ Dev Base Model updated\n');
    }
    
    console.log('🎯 DONE - Dev and Production now match!\n');
    console.log('Going forward:');
    console.log('1. Make changes in DEV (platform-admin)');
    console.log('2. Test in dev preview');
    console.log('3. Push dev to main');
    console.log('4. Production gets updated from dev\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

copyProdToDev();


