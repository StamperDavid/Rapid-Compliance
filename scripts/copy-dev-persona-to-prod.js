/**
 * Copy comprehensive persona from dev to production with updated pricing
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

async function copyPersona() {
  try {
    console.log('🔍 Checking dev Golden Master configuration...\n');
    
    // Get dev Golden Master
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
    
    const devGM = devGMSnapshot.docs[0].data();
    
    console.log('✅ Found dev Golden Master');
    console.log('Name:', devGM.name);
    console.log('Model:', devGM.modelId || devGM.baseModelId);
    console.log('\nConfiguration found:');
    console.log('- systemInstructions:', devGM.systemInstructions ? `${devGM.systemInstructions.length} chars` : 'NOT SET');
    console.log('- systemPrompt:', devGM.systemPrompt ? `${devGM.systemPrompt.length} chars` : 'NOT SET');
    console.log('- businessContext:', devGM.businessContext ? 'YES' : 'NO');
    console.log('- agentPersona:', devGM.agentPersona ? 'YES' : 'NO');
    console.log('- behaviorConfig:', devGM.behaviorConfig ? 'YES' : 'NO');
    
    // Get dev Base Model too
    const devBaseDoc = await devDb.collection('organizations')
      .doc('platform-admin')
      .collection('baseModels')
      .doc(devGM.baseModelId)
      .get();
    
    let devBase = null;
    if (devBaseDoc.exists) {
      devBase = devBaseDoc.data();
      console.log('\n✅ Found dev Base Model');
      console.log('Name:', devBase.name);
    }
    
    // Pricing intentionally not in GM — read from KnowledgeBase at runtime per docs/knowledgebase-contract.md.
    // Update configuration (pricing section removed — agents read from KnowledgeBase)
    const updatedConfig = { ...devGM };

    // Strip any baked-in pricing from the system prompt — agents read from KnowledgeBase
    if (updatedConfig.systemPrompt || updatedConfig.systemInstructions) {
      let prompt = (updatedConfig.systemPrompt || updatedConfig.systemInstructions) as string;
      // Remove any legacy tiered-pricing block if present
      prompt = prompt.replace(
        /\*\*Current Pricing[^*]*?\*\*[\s\S]*?(?=\*\*[A-Z]|$)/,
        '**Pricing:** See KnowledgeBase context loaded at runtime.\n\n'
      );
      updatedConfig.systemPrompt = prompt;
      updatedConfig.systemInstructions = prompt;
    }

    // Update business context pricing
    if (updatedConfig.businessContext) {
      updatedConfig.businessContext.pricingStrategy = '$299/month flat — all features included, no tiers, no record limits';
      updatedConfig.businessContext.topProducts = 'AI Sales Agents (unlimited), Lead Scraper & Enrichment, Email Sequences (unlimited), Multi-Channel Outreach, Full CRM Suite, Workflow Automation, E-Commerce Engine, API Access, White-Label';
    }

    // Update base model pricing if it exists
    if (devBase) {
      const updatedBase = { ...devBase };

      updatedBase.products = [
        {
          name: 'SalesVelocity Pro',
          price: '$299/month flat',
          description: 'All features included. No tiers, no record limits, no upsells. BYOK for zero AI markup.'
        }
      ];

      updatedBase.pricingStrategy = '$299/month flat — all features included, no tiers';
      updatedBase.updatedAt = new Date();
      
      // Save updated base model to production
      console.log('\n📝 Updating production Base Model...');
      await prodDb.collection('organizations')
        .doc('platform')
        .collection('baseModels')
        .doc('platform-sales-agent-base')
        .set(updatedBase, { merge: true });
      console.log('✅ Base Model updated');
    }
    
    // Clean up fields for production
    delete updatedConfig.copiedFromDev;
    delete updatedConfig.copiedAt;
    updatedConfig.updatedAt = new Date();
    updatedConfig.updatedBy = 'persona-sync';
    
    // Save to production
    console.log('\n📝 Updating production Golden Master...');
    await prodDb.collection('organizations')
      .doc('platform')
      .collection('goldenMasters')
      .doc('gm-platform-1')
      .update(updatedConfig);
    
    console.log('✅ Golden Master updated with dev persona + current pricing\n');
    console.log('🎯 Configuration synced:');
    console.log('- Comprehensive persona from dev');
    console.log('- Updated pricing (tier-based)');
    console.log('- Current features list');
    console.log('- All behavior configs\n');
    console.log('🌐 Test at www.salesvelocity.ai\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

copyPersona();


