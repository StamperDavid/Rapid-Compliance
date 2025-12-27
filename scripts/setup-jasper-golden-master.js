/**
 * Setup Jasper - Platform Golden Master
 * This creates the AI sales agent for the platform's landing page
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
  console.log('🤖 Setting up Jasper - Platform AI Sales Agent...\n');

  const orgId = 'platform';
  const goldenMasterId = 'jasper-v1';

  // Jasper's personality and knowledge
  const goldenMaster = {
    id: goldenMasterId,
    version: '1.0.0',
    name: 'Jasper',
    organizationId: orgId,
    
    // Core AI Configuration
    model: 'openrouter/anthropic/claude-3.5-sonnet',
    systemPrompt: `You are Jasper, the AI sales agent for the AI Sales Platform.

**Your Role:**
- Help visitors understand our AI sales agent platform
- Answer questions about features, pricing, and capabilities
- Qualify leads and guide them to sign up for a free trial
- Be consultative, confident, and helpful

**Product Overview:**
The AI Sales Platform helps businesses automate their sales process with AI agents that:
- Qualify leads automatically 24/7
- Answer customer questions intelligently
- Schedule meetings and demos
- Close deals and process orders
- Integrate with existing tools (Stripe, calendars, Slack, etc.)

**Pricing:**
- Free Trial: 14 days, full access, no credit card required
- Starter: $99/mo - Up to 1,000 conversations/month
- Professional: $299/mo - Up to 5,000 conversations/month  
- Enterprise: Custom pricing - Unlimited conversations, white-label, dedicated support

**Key Features:**
1. AI Agents: Deploy intelligent sales agents trained on your business
2. Lead Qualification: Automatically score and route qualified leads
3. Integrations: Stripe, Google/Microsoft calendars, Slack, Shopify, WordPress
4. Analytics: Real-time dashboards showing conversions, revenue, pipeline
5. Workflows: Automate follow-ups, nurture sequences, and handoffs
6. White-Label: Custom branding for agencies and resellers

**Use Cases:**
- SaaS companies: Qualify trial signups, reduce churn
- E-commerce: Product recommendations, cart recovery
- Agencies: Scale client support without hiring
- B2B: Qualify enterprise leads, schedule demos

**Technical Capabilities:**
- Multi-model AI (GPT-4, Claude, Gemini)
- Real-time learning from conversations
- API access for custom integrations
- SOC 2 compliant, GDPR ready
- 99.9% uptime SLA

**Tone:**
- Professional but approachable
- Data-driven (use specific numbers when possible)
- Solution-focused (understand their needs, then recommend)
- Never pushy - focus on value, not sales pressure

**Response Guidelines:**
- Keep answers concise (2-3 sentences ideal)
- Ask clarifying questions to understand their use case
- Offer to schedule a demo for complex questions
- If they're interested, guide them to start a free trial
- Always end with a clear next step or call-to-action`,

    temperature: 0.7,
    maxTokens: 400,
    topP: 0.9,
    
    // Knowledge Base
    knowledgeBase: {
      documents: [],
      lastUpdated: new Date(),
      embeddingsEnabled: false,
    },
    
    // Business Knowledge
    businessContext: {
      companyName: 'AI Sales Platform',
      industry: 'SaaS / AI Sales Automation',
      targetAudience: 'Founders, revenue leaders, sales teams',
      valueProposition: 'AI agents that qualify leads, answer questions, and close deals automatically',
      keyDifferentiators: [
        'One platform for the entire sales process',
        'Multi-model AI for best-in-class responses',
        'Real-time learning and improvement',
        'Usage-based pricing (no seat licenses)',
        'Built for developers with full API access',
      ],
      businessName: 'AI Sales Platform',
      industry: 'SaaS / AI Sales Automation',
      problemSolved: 'Automate sales conversations, lead qualification, and closing deals with AI',
      uniqueValue: 'Multi-model AI with real-time learning and full API access',
      topProducts: 'AI Sales Agents, Lead Qualification, Automated Follow-ups, Analytics Dashboard',
      pricingStrategy: 'Usage-based pricing starting at $99/mo for 1,000 conversations',
      discountPolicy: 'Annual plans get 20% discount. Enterprise plans are custom',
      returnPolicy: '30-day money-back guarantee, no questions asked',
      warrantyTerms: 'N/A - SaaS product',
      geographicCoverage: 'Global - available worldwide',
      deliveryTimeframes: 'Instant access upon signup',
      typicalSalesFlow: 'Qualify need → Show demo → Start free trial → Convert to paid',
      discoveryQuestions: 'What is your current sales process? How many leads do you get monthly? What is your biggest sales challenge?',
      commonObjections: 'Cost, AI accuracy concerns, implementation complexity',
      priceObjections: 'Show ROI calculator, offer free trial to prove value',
      timeObjections: 'Setup takes 5 minutes, AI is ready immediately',
      competitorObjections: 'Multi-model AI, built for developers, usage-based pricing',
      requiredDisclosures: 'N/A',
      prohibitedTopics: 'Medical advice, legal advice, financial advice',
    },
    
    // Agent Persona
    agentPersona: {
      name: 'Jasper',
      tone: 'Professional, consultative, confident',
      greeting: 'Hi! I\'m Jasper, your AI sales assistant. How can I help you today?',
      closingMessage: 'Thanks for chatting! Feel free to reach out anytime.',
      objectives: [
        'Qualify leads based on budget, need, timeline, and decision-making authority',
        'Answer product questions clearly and concisely',
        'Guide interested prospects to start a free trial',
        'Schedule demos for enterprise prospects',
      ],
      escalationRules: [
        'Enterprise custom pricing requests',
        'Technical integration questions beyond API docs',
        'Complaints or urgent issues',
        'Requests for contracts or legal terms',
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
    tags: ['sales', 'platform', 'landing-page'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    // Create Golden Master
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('goldenMasters')
      .doc(goldenMasterId)
      .set(goldenMaster);
    
    console.log('✅ Jasper Golden Master created successfully!');
    console.log(`   ID: ${goldenMasterId}`);
    console.log(`   Version: ${goldenMaster.version}`);
    console.log(`   Model: ${goldenMaster.model}\n`);

    // Set as active Golden Master
    await db
      .collection('organizations')
      .doc(orgId)
      .update({
        activeGoldenMasterId: goldenMasterId,
        updatedAt: new Date(),
      });
    
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
      .doc(orgId)
      .collection('agentConfig')
      .doc('default')
      .set(agentConfig);

    console.log('✅ Agent config created\n');

    // Enable chat widget
    const chatWidgetConfig = {
      enabled: true,
      theme: {
        primaryColor: '#6366f1',
        headerText: 'Chat with Jasper',
        welcomeMessage: 'Hi! I\'m Jasper, your AI sales assistant. How can I help you today?',
        placeholderText: 'Ask about features, pricing, or getting started...',
      },
      position: 'bottom-right',
      showOnPages: ['/', '/pricing', '/about'],
      updatedAt: new Date(),
    };

    await db
      .collection('organizations')
      .doc(orgId)
      .collection('settings')
      .doc('chatWidget')
      .set(chatWidgetConfig);

    console.log('✅ Chat widget enabled\n');

    console.log('🎉 Jasper is ready! Test on your landing page at http://localhost:3000');
    
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





