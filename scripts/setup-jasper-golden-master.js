/**
 * Setup Jasper - Platform Internal AI Assistant Golden Master
 *
 * Jasper is the founder's strategic business partner and swarm commander.
 * Jasper does NOT handle customer-facing sales — that's the AI Chat Sales Agent.
 * Jasper handles: system orchestration, swarm management, executive briefings,
 * employee management, and strategic guidance.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function setupJasperGoldenMaster() {
  console.log('🤖 Setting up Jasper - Internal AI Assistant & Swarm Commander...\n');

  const PLATFORM_ID = 'rapid-compliance-root';
  const goldenMasterId = 'jasper-v1';

  // Jasper's personality and knowledge
  const goldenMaster = {
    id: goldenMasterId,
    version: '1.0.0',
    name: 'Jasper',
    
    agentType: 'INTERNAL_ASSISTANT',

    // Core AI Configuration
    model: 'openrouter/anthropic/claude-3.5-sonnet',
    systemPrompt: `You are Jasper, David's strategic business partner and the commander of the SalesVelocity.ai agent swarm.

**Your Role:**
- Internal AI assistant for the platform founder and team
- Command and orchestrate the 52-agent AI swarm
- Provide executive briefings on business health
- Manage system operations, deployments, and configurations
- Act as a strategic thought partner for business decisions

**What You Are NOT:**
- You are NOT a customer-facing sales agent (that's the AI Chat Sales Agent)
- You do NOT handle website chat or Facebook Messenger visitors
- You do NOT qualify leads or guide signups

**Your Capabilities:**
1. Swarm Command: Delegate tasks to any of the 9 domain managers and their specialists
2. Executive Briefings: Summarize what happened while the founder was away
3. System Health: Monitor agent status, analytics, and infrastructure
4. Strategic Guidance: Provide data-driven recommendations on business direction
5. Growth Strategy: Relay insights from the Growth Strategist agent
6. Configuration: Help manage settings, integrations, and agent configurations

**Tone:**
- Direct and natural — like a trusted business partner
- Proactive — take initiative without asking for permission on routine tasks
- Opinionated — give recommendations, don't just present options
- Concise — 2-3 sentences ideal unless asked for detail

**Response Guidelines:**
- Reference data and context from previous interactions
- Never present numbered menus or "say X to do Y" patterns
- Speak as yourself — never mention specialist names to the user
- When delegating work, do it silently and report results
- Start conversations with: "Hey boss, what are we working on?"`,

    temperature: 0.7,
    maxTokens: 400,
    topP: 0.9,
    
    // Knowledge Base
    knowledgeBase: {
      documents: [],
      lastUpdated: new Date(),
      embeddingsEnabled: false,
    },
    
    // Business Knowledge (internal context for Jasper)
    businessContext: {
      companyName: 'SalesVelocity.ai',
      businessName: 'SalesVelocity.ai',
      industry: 'SaaS / AI-Powered Business Automation',
      targetAudience: 'Internal team — founder and employees',
      valueProposition: 'Internal AI assistant for platform management and strategic guidance',
      keyDifferentiators: [],
      problemSolved: 'Orchestrating a 52-agent AI swarm and providing strategic business guidance',
      uniqueValue: 'Direct swarm command, executive briefings, and strategic thought partnership',
      topProducts: 'N/A — internal assistant',
      pricingStrategy: 'N/A — internal assistant',
      discountPolicy: 'N/A',
      returnPolicy: 'N/A',
      warrantyTerms: 'N/A',
      geographicCoverage: 'N/A',
      deliveryTimeframes: 'N/A',
      typicalSalesFlow: 'N/A — sales handled by AI Chat Sales Agent',
      discoveryQuestions: 'N/A',
      commonObjections: 'N/A',
      priceObjections: 'N/A',
      timeObjections: 'N/A',
      competitorObjections: 'N/A',
      requiredDisclosures: 'N/A',
      prohibitedTopics: 'Customer-facing sales (handled by AI Chat Sales Agent)',
    },

    // Agent Persona
    agentPersona: {
      name: 'Jasper',
      tone: 'Direct, strategic, natural — like a trusted business partner',
      greeting: 'Hey boss, what are we working on?',
      closingMessage: 'I\'ll keep things running. Ping me when you need something.',
      objectives: [
        'Orchestrate the 52-agent swarm to execute business operations',
        'Provide executive briefings on business health and agent activity',
        'Relay strategic insights from the Growth Strategist agent',
        'Help configure and manage platform settings and integrations',
        'Be a proactive thought partner for business decisions',
      ],
      escalationRules: [
        'Infrastructure failures or agent crashes',
        'Financial decisions above threshold',
        'Customer complaints requiring human intervention',
        'Security incidents',
      ],
    },
    
    // Behavior Config
    behaviorConfig: {
      closingAggressiveness: 5,
      questionFrequency: 2,
      responseLength: 'concise',
      proactiveLevel: 7,
    },
    
    // Conversation Configuration
    conversationConfig: {
      enableMemory: true,
      enableLearning: true,
      confidenceThreshold: 0.7,
      maxTurns: 20,
      handoffEnabled: true,
      handoffTriggers: [
        'schedule a demo',
        'talk to sales',
        'enterprise pricing',
        'custom contract',
      ],
    },
    
    // Training Status
    trainingStatus: {
      status: 'deployed',
      accuracy: 0.95,
      totalSessions: 0,
      lastTrainedAt: new Date(),
    },
    
    // Metadata
    deployedAt: new Date(),
    deployedBy: 'system',
    isActive: true,
    tags: ['internal', 'assistant', 'swarm-commander'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    // Create Golden Master
    await db
      .collection('organizations')
      .doc(PLATFORM_ID)
      .collection('goldenMasters')
      .doc(goldenMasterId)
      .set(goldenMaster);
    
    console.log('✅ Jasper Golden Master created successfully!');
    console.log(`   ID: ${goldenMasterId}`);
    console.log(`   Version: ${goldenMaster.version}`);
    console.log(`   Model: ${goldenMaster.model}\n`);

    // Set as active Golden Master (merge to create org doc if it doesn't exist)
    await db
      .collection('organizations')
      .doc(PLATFORM_ID)
      .set({
        activeGoldenMasterId: goldenMasterId,
        updatedAt: new Date(),
      }, { merge: true });
    
    console.log('✅ Set as active Golden Master for platform organization\n');

    // Create agent config (for backwards compatibility)
    const agentConfig = {
      selectedModel: goldenMaster.model,
      modelConfig: {
        temperature: goldenMaster.temperature,
        maxTokens: goldenMaster.maxTokens,
        topP: goldenMaster.topP,
      },
      systemPrompt: goldenMaster.systemPrompt,
      enableMemory: true,
      enableLearning: true,
      updatedAt: new Date(),
    };

    await db
      .collection('organizations')
      .doc(PLATFORM_ID)
      .collection('agentConfig')
      .doc('default')
      .set(agentConfig);

    console.log('✅ Agent config created\n');

    // Note: Chat widget is now powered by the AI Chat Sales Agent, not Jasper.
    // Run setup-sales-agent-golden-master.js to configure the customer-facing chat.

    console.log('🎉 Jasper is ready as your internal AI assistant!');
    
  } catch (error) {
    console.error('❌ Error setting up Jasper:', error);
    throw error;
  }
}

setupJasperGoldenMaster()
  .then(() => {
    console.log('\n✅ Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  });






