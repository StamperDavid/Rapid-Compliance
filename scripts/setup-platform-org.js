/**
 * Setup Platform Organization
 * Creates the 'platform' organization with API keys and golden master
 * This is used for the landing page demo chat (Jasper)
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'demo-ai-sales-platform',
  });
}

const db = admin.firestore();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupPlatformOrganization() {
  console.log('\n🚀 PLATFORM ORGANIZATION SETUP');
  console.log('='.repeat(70));
  console.log('This script will create the "platform" organization for the landing page demo.\n');

  // Get API keys from user
  console.log('📝 Please provide your API keys (these will be stored in Firestore):');
  console.log('');
  
  const openrouterKey = await question('OpenRouter API Key (or press Enter to skip): ');
  const openaiKey = await question('OpenAI API Key (optional): ');
  const anthropicKey = await question('Anthropic API Key (optional): ');
  
  if (!openrouterKey && !openaiKey && !anthropicKey) {
    console.log('\n❌ Error: You must provide at least one AI API key.');
    rl.close();
    process.exit(1);
  }

  console.log('\n🔧 Creating platform organization...');

  try {
    const orgId = 'platform';
    const now = new Date();

    // 1. Create organization document
    await db.collection('organizations').doc(orgId).set({
      id: orgId,
      name: 'SalesVelocity.ai Platform',
      industry: 'AI Sales Automation',
      plan: 'enterprise',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      settings: {
        timezone: 'America/New_York',
        currency: 'USD'
      }
    });
    
    console.log('✅ Organization created');

    // 2. Store API keys
    const apiKeys = {
      id: `keys-${orgId}`,
      organizationId: orgId,
      ai: {},
      payments: {},
      email: {},
      sms: {},
      storage: {},
      analytics: {},
      integrations: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      updatedBy: 'system',
      isEncrypted: false
    };

    if (openrouterKey) apiKeys.ai.openrouterApiKey = openrouterKey;
    if (openaiKey) apiKeys.ai.openaiApiKey = openaiKey;
    if (anthropicKey) apiKeys.ai.anthropicApiKey = anthropicKey;

    await db.collection('organizations')
      .doc(orgId)
      .collection('apiKeys')
      .doc(orgId)
      .set(apiKeys);
    
    console.log('✅ API keys stored');

    // 3. Create Golden Master for Jasper (the platform's demo agent)
    const goldenMasterId = 'jasper_golden_master';
    
    const goldenMaster = {
      id: goldenMasterId,
      version: 1,
      isActive: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deployedAt: now.toISOString(),
      deployedBy: 'system',
      
      // Business Context
      businessContext: {
        businessName: 'SalesVelocity.ai',
        industry: 'AI Sales Automation',
        problemSolved: 'We help businesses automate their sales process with AI agents that qualify leads, answer questions, and close deals 24/7.',
        uniqueValue: 'Custom-trained AI agents that learn your business in minutes and provide personalized customer experiences.',
        
        topProducts: `
1. AI Sales Agent Platform - Custom-trained chatbots for your website
2. Lead Qualification System - Automated lead scoring and routing
3. CRM Integration - Built-in CRM or integrate with existing systems
4. E-commerce Module - Take payments and process orders
5. Analytics Dashboard - Track performance and ROI
        `.trim(),
        
        pricingStrategy: `
- Starter Plan: $99/month (up to 500 conversations)
- Professional Plan: $299/month (up to 2,000 conversations)
- Enterprise Plan: Custom pricing for unlimited usage
- 14-day free trial, no credit card required
        `.trim(),
        
        discountPolicy: 'We offer 20% annual discount and custom enterprise pricing.',
        returnPolicy: 'Cancel anytime. Pro-rated refunds for annual plans.',
        warrantyTerms: '99.9% uptime SLA on Enterprise plans',
        geographicCoverage: 'Available worldwide, servers in US, EU, and Asia',
        deliveryTimeframes: 'Setup takes less than 1 hour. Live within 24 hours.',
        
        typicalSalesFlow: `
1. Understand their business and current challenges
2. Ask discovery questions about their sales process
3. Demonstrate how AI can solve their specific problem
4. Address objections about AI adoption
5. Offer free trial to test the platform
6. Follow up during trial period
        `.trim(),
        
        discoveryQuestions: `
- What does your sales process look like today?
- How many leads do you get per month?
- What's your biggest challenge with lead qualification?
- Do you have a CRM? If so, which one?
- How do you currently handle website visitors after hours?
        `.trim(),
        
        commonObjections: `
- "Is AI really smart enough?" → Show demo, mention training capabilities
- "What if it gives wrong answers?" → Explain confidence scoring and human escalation
- "Too expensive" → Break down cost per lead vs current process
- "Too complicated to set up" → Emphasize 1-hour setup, no coding required
        `.trim(),
        
        priceObjections: 'Compare cost to hiring a sales rep ($50k+ annually). We cost $1,200-$3,600/year.',
        timeObjections: 'Setup takes under an hour. See ROI within first week of trial.',
        competitorObjections: 'Unlike chatbots, we offer true AI with memory, training, and business context.',
        
        requiredDisclosures: 'AI-powered chat. Conversations may be monitored for quality.',
        prohibitedTopics: 'No medical advice, legal advice, or financial advice. Stay focused on our product.'
      },
      
      // Agent Persona (Jasper)
      agentPersona: {
        name: 'Jasper',
        tone: 'Friendly, consultative, and knowledgeable. Professional but approachable.',
        greeting: "Hi there! 👋 I'm Jasper, the AI sales agent for SalesVelocity.ai. I can answer questions about our platform, help you understand pricing, or show you how our AI agents work. What would you like to know?",
        closingMessage: "Thanks for chatting! Ready to try it free for 14 days? Just click 'Start Free Trial' above. No credit card needed!",
        objectives: [
          'Qualify leads by understanding their business needs',
          'Demonstrate the value of AI sales automation',
          'Address concerns about AI adoption',
          'Guide qualified leads to start a free trial',
          'Provide excellent customer service'
        ],
        escalationRules: [
          'Customer asks for technical support with an existing account',
          'Customer wants to discuss custom enterprise pricing',
          'Customer has a complaint or legal concern',
          'Customer requests a live demo with sales team'
        ]
      },
      
      // Behavior Configuration
      behaviorConfig: {
        closingAggressiveness: 5,
        questionFrequency: 'moderate',
        responseLength: 'medium',
        proactiveLevel: 6,
        useEmojis: true,
        formalityLevel: 'balanced'
      },
      
      // Knowledge Base
      knowledgeBase: {
        documents: [],
        totalDocuments: 0,
        lastUpdated: now.toISOString()
      },
      
      // Training Data
      trainedScenarios: [],
      trainingCompletedAt: now.toISOString(),
      performanceMetrics: {
        avgConfidenceScore: 0.85,
        totalConversations: 0,
        successRate: 0,
        avgResponseTime: 1200
      }
    };

    await db.collection('organizations')
      .doc(orgId)
      .collection('goldenMasters')
      .doc(goldenMasterId)
      .set(goldenMaster);
    
    console.log('✅ Golden Master (Jasper) deployed');

    // 4. Create agent configuration
    await db.collection('organizations')
      .doc(orgId)
      .collection('agentConfig')
      .doc('default')
      .set({
        selectedModel: 'openrouter/anthropic/claude-3.5-sonnet',
        modelConfig: {
          temperature: 0.7,
          maxTokens: 800,
          topP: 0.9
        },
        updatedAt: now.toISOString()
      });
    
    console.log('✅ Agent configuration set');

    // 5. Enable chat widget
    await db.collection('organizations')
      .doc(orgId)
      .collection('settings')
      .doc('chatWidget')
      .set({
        enabled: true,
        welcomeMessage: "Hi! I'm Jasper, your AI sales assistant. How can I help you today?",
        primaryColor: '#6366f1',
        position: 'bottom-right',
        updatedAt: now.toISOString()
      });
    
    console.log('✅ Chat widget enabled');

    console.log('\n' + '='.repeat(70));
    console.log('✅ SETUP COMPLETE!');
    console.log('='.repeat(70));
    console.log('\n📋 Summary:');
    console.log(`   Organization ID: ${orgId}`);
    console.log(`   Agent Name: Jasper`);
    console.log(`   Golden Master: ${goldenMasterId}`);
    console.log(`   Status: Active`);
    console.log('\n🎯 The landing page chat will now use this configuration.');
    console.log('   Test it at: http://localhost:3000\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    rl.close();
  }
}

// Run setup
setupPlatformOrganization()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });






