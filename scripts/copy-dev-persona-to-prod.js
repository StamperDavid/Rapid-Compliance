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
    
    // Update pricing in the configuration
    const updatedConfig = { ...devGM };
    
    // Update system prompt with current pricing
    if (updatedConfig.systemPrompt || updatedConfig.systemInstructions) {
      const currentPricing = `**Current Pricing (Volume-Based - All Features Included):**
- Tier 1: $400/month for 0-100 records
- Tier 2: $650/month for 101-250 records (MOST POPULAR)
- Tier 3: $1,000/month for 251-500 records
- Tier 4: $1,250/month for 501-1,000 records
- Tier 5: Custom pricing for 1,000+ records

**ALL plans include EVERY feature - no upsells, no hidden costs:**
✓ AI Sales Agents (Unlimited)
✓ Lead Scraper & Enrichment
✓ Email Sequences (Unlimited)
✓ Multi-Channel Outreach (Email, LinkedIn, SMS)
✓ Full CRM Suite with Custom Schemas
✓ Workflow Automation
✓ Built-in E-Commerce Engine
✓ Full API Access
✓ White-Label Options
✓ BYOK: Zero AI Markup`;

      // Replace pricing section in system prompt
      let prompt = updatedConfig.systemPrompt || updatedConfig.systemInstructions;
      
      // Find and replace pricing section (between **Pricing** and next section)
      prompt = prompt.replace(
        /\*\*Pricing:\*\*[\s\S]*?(?=\*\*|$)/,
        currentPricing + '\n\n'
      );
      
      // Also update standalone pricing mentions
      prompt = prompt.replace(/\$99\/mo/g, 'See tiered pricing');
      prompt = prompt.replace(/\$299\/mo/g, 'starting at $400/mo');
      prompt = prompt.replace(/Starter:.*?$/gm, 'Tier 1: $400/month for 0-100 records');
      prompt = prompt.replace(/Professional:.*?$/gm, 'Tier 2: $650/month for 101-250 records (MOST POPULAR)');
      
      updatedConfig.systemPrompt = prompt;
      updatedConfig.systemInstructions = prompt;
    }
    
    // Update business context pricing
    if (updatedConfig.businessContext) {
      updatedConfig.businessContext.pricingStrategy = 'Volume-based: Tier 1 ($400/mo, 0-100 records), Tier 2 ($650/mo, 101-250 records - POPULAR), Tier 3 ($1,000/mo, 251-500 records), Tier 4 ($1,250/mo, 501-1K records), Custom (1K+)';
      updatedConfig.businessContext.topProducts = 'AI Sales Agents (unlimited), Lead Scraper & Enrichment, Email Sequences (unlimited), Multi-Channel Outreach, Full CRM Suite, Workflow Automation, E-Commerce Engine, API Access, White-Label';
    }
    
    // Update base model pricing if it exists
    if (devBase) {
      const updatedBase = { ...devBase };
      
      updatedBase.products = [
        {
          name: 'Tier 1',
          price: '$400/month',
          description: '0-100 records. All features included: AI Agents (unlimited), Lead Scraper, Email Sequences, CRM, Workflows, API, White-Label'
        },
        {
          name: 'Tier 2',
          price: '$650/month',
          description: '101-250 records. All features included. MOST POPULAR for growing teams.'
        },
        {
          name: 'Tier 3',
          price: '$1,000/month',
          description: '251-500 records. All features included. Established sales teams.'
        },
        {
          name: 'Tier 4',
          price: '$1,250/month',
          description: '501-1,000 records. All features included. Scaled operations.'
        },
        {
          name: 'Enterprise (Tier 5)',
          price: 'Custom Pricing',
          description: '1,000+ records. All features. Dedicated support, custom development.'
        }
      ];
      
      updatedBase.pricingStrategy = 'Simple volume-based pricing. All features in every tier. No per-seat fees.';
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


