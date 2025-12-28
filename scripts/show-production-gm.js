/**
 * Display production Golden Master configuration
 */

const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey-prod.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-sales-platform-4f5e4',
});

const db = admin.firestore();

async function showGM() {
  try {
    const gmDoc = await db.collection('organizations')
      .doc('platform')
      .collection('goldenMasters')
      .doc('gm-platform-1')
      .get();
    
    if (!gmDoc.exists) {
      console.log('❌ Golden Master not found');
      process.exit(1);
    }
    
    const data = gmDoc.data();
    
    console.log('\n' + '='.repeat(80));
    console.log('PRODUCTION GOLDEN MASTER CONFIGURATION');
    console.log('='.repeat(80) + '\n');
    
    console.log('📋 Basic Info:');
    console.log('  ID:', data.id);
    console.log('  Name:', data.name);
    console.log('  Version:', data.version);
    console.log('  Status:', data.status);
    console.log('  isActive:', data.isActive);
    console.log('  Model:', data.modelId || data.baseModelId);
    console.log('  Base Model ID:', data.baseModelId);
    
    console.log('\n' + '-'.repeat(80));
    console.log('🤖 SYSTEM PROMPT / INSTRUCTIONS:');
    console.log('-'.repeat(80));
    if (data.systemPrompt) {
      console.log(data.systemPrompt);
    } else if (data.systemInstructions) {
      console.log(data.systemInstructions);
    } else {
      console.log('❌ NOT SET');
    }
    
    console.log('\n' + '-'.repeat(80));
    console.log('💼 BUSINESS CONTEXT:');
    console.log('-'.repeat(80));
    if (data.businessContext) {
      console.log(JSON.stringify(data.businessContext, null, 2));
    } else {
      console.log('❌ NOT SET');
    }
    
    console.log('\n' + '-'.repeat(80));
    console.log('👤 AGENT PERSONA:');
    console.log('-'.repeat(80));
    if (data.agentPersona) {
      console.log(JSON.stringify(data.agentPersona, null, 2));
    } else {
      console.log('❌ NOT SET');
    }
    
    console.log('\n' + '-'.repeat(80));
    console.log('⚙️  BEHAVIOR CONFIG:');
    console.log('-'.repeat(80));
    if (data.behaviorConfig) {
      console.log(JSON.stringify(data.behaviorConfig, null, 2));
    } else {
      console.log('❌ NOT SET');
    }
    
    console.log('\n' + '-'.repeat(80));
    console.log('📚 KNOWLEDGE BASE:');
    console.log('-'.repeat(80));
    if (data.knowledgeBase) {
      if (typeof data.knowledgeBase === 'string') {
        console.log(data.knowledgeBase);
      } else {
        console.log(JSON.stringify(data.knowledgeBase, null, 2));
      }
    } else {
      console.log('❌ NOT SET');
    }
    
    console.log('\n' + '-'.repeat(80));
    console.log('📊 METADATA:');
    console.log('-'.repeat(80));
    console.log('  Temperature:', data.temperature);
    console.log('  Max Tokens:', data.maxTokens);
    console.log('  Trained Scenarios:', data.trainedScenarios || []);
    console.log('  Created:', data.createdAt?.toDate?.() || data.createdAt);
    console.log('  Updated:', data.updatedAt?.toDate?.() || data.updatedAt);
    console.log('  Updated By:', data.updatedBy);
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

showGM();


