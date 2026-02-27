/**
 * (Demo) Account Seed Script — PART 2: Full Platform Coverage
 *
 * Expands the demo account beyond CRM to cover the ENTIRE platform.
 * Run AFTER seed-demo-account.ts (Part 1) which creates CRM data.
 *
 * Data created by this script:
 * - Onboarding Data (complete 25-step business setup)
 * - AI Agent Persona (full configuration)
 * - 3 Workflows (entity trigger, schedule, form — with executions)
 * - 2 Forms (contact form + survey — with fields, submissions, analytics)
 * - 3 Website Pages (home, about, services — with sections/widgets)
 * - 3 Blog Posts (published + draft + scheduled)
 * - Site Config + Theme + Navigation
 * - 8 Social Media Posts (twitter + linkedin, various statuses)
 * - 4 Orders (pending, processing, shipped, delivered)
 * - 3 Email Templates + 2 SMS Templates
 * - Lead Scoring Rules (full configuration)
 * - 2 Webhooks
 * - 5 Team Tasks
 * - 2 AI Conversations (with message history)
 * - 3 Integrations (Google Calendar, Slack, Stripe)
 * - 2 Custom Tools
 *
 * ⚠️ MANUAL DELETE NOT AVAILABLE from dashboard for:
 *   - Onboarding Data (settings doc, overwrite only)
 *   - AI Agent Persona (config doc, overwrite only)
 *   - Analytics aggregations (read-only dashboards)
 *   - Lead Scoring Rules (config, no list-delete UI)
 *   - Site Config / Theme / Navigation (settings docs)
 *   - Workflow Executions (log data)
 *   - Form Analytics summaries (aggregated data)
 *   → Use the cleanup function at bottom or delete via Firebase Console
 *
 * Usage: npx tsx scripts/seed-demo-account-part2.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION (must match Part 1)
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
const DEMO_OWNER_ID = 'demo-owner-001';
const DEMO_OWNER_NAME = '(Demo) Alex Morgan';
const DEMO_OWNER_EMAIL = 'alex.morgan@salesvelocity.ai';

// Flat org-level paths — no workspace layer
const orgRoot = `organizations/${PLATFORM_ID}`;

// Part 2 collection paths
const workflowsPath = `${orgRoot}/workflows`;
const formsPath = `${orgRoot}/forms`;
const pagesPath = `${orgRoot}/pages`;
const blogPostsPath = `${orgRoot}/blogPosts`;
const siteConfigPath = `${orgRoot}/siteConfig`;
const themesPath = `${orgRoot}/themes`;
const navigationPath = `${orgRoot}/navigation`;
const socialPostsPath = `${orgRoot}/socialPosts`;
const ordersPath = `${orgRoot}/orders`;
const globalTemplatesPath = `${orgRoot}/globalTemplates`;
const scoringRulesPath = `${orgRoot}/scoringRules`;
const webhooksPath = `${orgRoot}/webhooks`;
const teamTasksPath = `${orgRoot}/teamTasks`;
const conversationsPath = `${orgRoot}/conversations`;
const integrationsPath = `${orgRoot}/integrations`;
const customToolsPath = `${orgRoot}/customTools`;
const onboardingPath = `${orgRoot}/onboarding`;
const personaPath = `${orgRoot}/agent`;

// ============================================================================
// INITIALIZE FIREBASE ADMIN
// ============================================================================

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('  Using serviceAccountKey.json');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    const parsed = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    admin.initializeApp({ credential: admin.credential.cert(parsed) });
    console.log('  Using FIREBASE_SERVICE_ACCOUNT_KEY env var');
  } else {
    throw new Error('No Firebase credentials found');
  }

  return admin.firestore();
}

// ============================================================================
// HELPERS
// ============================================================================

function daysAgo(n: number): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(new Date(Date.now() - n * 86400000));
}

function hoursAgo(n: number): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(new Date(Date.now() - n * 3600000));
}

function daysFromNow(n: number): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(new Date(Date.now() + n * 86400000));
}

const now = admin.firestore.Timestamp.now();

// ============================================================================
// 1. ONBOARDING DATA
// ============================================================================

function getOnboardingData(): Record<string, unknown> {
  return {
    // BUSINESS BASICS (Steps 1-3)
    businessName: '(Demo) Acme Digital Solutions',
    industry: 'saas',
    website: 'https://demo-acme.salesvelocity.ai',

    // VALUE PROPOSITION (Steps 4-5)
    problemSolved: 'Small businesses struggle with managing customer relationships, tracking sales pipelines, and automating marketing — leading to missed opportunities and revenue leakage.',
    uniqueValue: 'All-in-one AI-powered CRM that automates lead scoring, email sequences, and deal tracking — so sales teams close 3x faster without switching between tools.',
    targetCustomer: 'B2B SaaS companies and digital agencies with 10-200 employees who need a unified sales and marketing platform.',

    // PRODUCTS & SERVICES (Step 6)
    topProducts: 'CRM Platform ($99/mo), Marketing Automation Suite ($149/mo), AI Sales Agent ($249/mo), Enterprise Bundle ($399/mo)',

    // PRICING (Step 7)
    priceRange: '$99 - $399 per month',
    discountPolicy: 'Annual billing gets 20% off. Non-profits get 30% off. First 100 customers get lifetime 15% discount.',

    // SALES PROCESS (Step 8)
    typicalSalesFlow: '1) Inbound lead via website/form → 2) AI scores and qualifies → 3) Discovery call (15 min) → 4) Product demo (30 min) → 5) Proposal sent → 6) Negotiation → 7) Close. Average cycle: 14-21 days.',

    // DISCOVERY (Step 9)
    discoveryQuestions: 'What CRM are you currently using? How many leads per month? What is your biggest bottleneck in the sales process? How many salespeople on your team? What is your average deal size?',

    // OBJECTIONS (Step 10)
    commonObjections: 'We already use HubSpot/Salesforce. It seems too expensive. We need more features. Is the AI actually useful? Can we migrate our data?',
    priceObjections: 'Compare the total cost of ownership — our all-in-one eliminates 3-5 separate tools. Most customers save $500+/month within 90 days.',

    // POLICIES (Steps 11-12)
    returnPolicy: '30-day money-back guarantee, no questions asked. Cancel anytime on monthly plans.',
    warrantyTerms: '99.9% uptime SLA. Free migration assistance. 24/7 priority support on Enterprise.',
    satisfactionGuarantee: 'If you do not see measurable pipeline improvement within 60 days, we refund your first 2 months.',

    // COMPLIANCE (Step 13)
    requiredDisclosures: 'SOC 2 Type II certified. GDPR compliant. Data stored in US-East-1 (AWS). All AI interactions logged for audit.',
    prohibitedTopics: 'Do not discuss competitor pricing specifics. Do not make guarantees about specific revenue outcomes. Do not discuss internal company financials.',

    // COMPETITORS (Step 14)
    competitors: ['HubSpot', 'Salesforce', 'Pipedrive', 'Close.com', 'Apollo.io'],
    competitiveAdvantages: 'Native AI agent (not bolt-on). 10x faster setup than Salesforce. 40% cheaper than HubSpot Enterprise. Built-in enrichment engine. Real-time lead scoring without third-party APIs.',

    // KNOWLEDGE BASE (Step 15)
    websiteUrls: ['https://demo-acme.salesvelocity.ai', 'https://demo-acme.salesvelocity.ai/docs', 'https://demo-acme.salesvelocity.ai/blog'],
    faqUrl: 'https://demo-acme.salesvelocity.ai/faq',
    socialMediaUrls: ['https://facebook.com/demoacme', 'https://linkedin.com/company/demoacme', 'https://instagram.com/demoacme', 'https://twitter.com/demoacme', 'https://youtube.com/@demoacme'],
    faqPageUrl: 'https://demo-acme.salesvelocity.ai/faq',

    // INDUSTRY TEMPLATE (Step 15.5)
    industryTemplateId: 'saas-crm-template',

    // AGENT IDENTITY (Step 16)
    agentName: '(Demo) Jasper',
    communicationStyle: 'consultative',
    greetingMessage: 'Hi there! I am Jasper, your AI sales assistant at Acme Digital Solutions. I can help you find the right plan, answer questions about our platform, or schedule a demo with our team. How can I help you today?',
    closingMessage: 'Thanks for chatting with me! If you need anything else, I am always here. You can also reach our team at hello@demo-acme.com or book a call at demo-acme.com/book.',
    personalityTraits: ['consultative', 'knowledgeable', 'patient', 'data-driven', 'solution-oriented'],

    // BEHAVIOR (Step 17)
    closingStyle: 6,
    discoveryDepth: 4,
    responseLength: 'balanced',
    proactivityLevel: 7,
    maxDiscount: 15,
    idleTimeoutMinutes: 10,

    // ESCALATION (Step 18)
    escalationRules: [
      'Escalate to human if customer asks for custom enterprise pricing above $500/mo',
      'Escalate if customer mentions legal/compliance concerns about data handling',
      'Escalate if customer has been in conversation for 20+ minutes without resolution',
      'Escalate if customer explicitly asks to speak with a human',
    ],

    // OBJECTION HANDLING (Step 19)
    objectionHandling: {
      priceObjectionStrategy: 'Acknowledge the concern, then reframe as investment. Show ROI calculator and compare total cost of ownership vs separate tools.',
      competitorObjectionStrategy: 'Acknowledge the competitor, highlight our unique AI-native approach, and offer a side-by-side comparison demo.',
      timingObjectionStrategy: 'Create urgency with limited-time annual discount. Share case study of customer who delayed 3 months and lost $50K in pipeline.',
      authorityObjectionStrategy: 'Offer to include the decision-maker in a brief 15-minute overview call. Provide a one-page executive summary they can share.',
      needObjectionStrategy: 'Ask discovery questions to uncover hidden pain. Share relevant case study showing 3x improvement for similar companies.',
    },

    // CUSTOMER SENTIMENT (Step 20)
    customerSentimentHandling: {
      angryCustomerApproach: 'Acknowledge frustration immediately. Apologize for any inconvenience. Ask what specific outcome they need. Escalate to human if anger persists after 2 exchanges.',
      confusedCustomerApproach: 'Simplify language. Use bullet points. Offer to walk through step-by-step. Share screen recording links for visual guidance.',
      readyToBuySignals: ['Asks about payment options', 'Requests contract/invoice', 'Asks about onboarding timeline', 'Compares specific plans', 'Mentions budget approval'],
      disengagementSignals: ['Single-word responses', 'Long response delays', 'Changing subject repeatedly', 'Asking unrelated questions'],
      frustratedCustomerApproach: 'Validate their experience. Provide immediate actionable steps. Offer callback from senior team member within 1 hour.',
    },

    // DISCOVERY FRAMEWORKS (Step 21)
    discoveryFrameworks: {
      budgetQualificationQuestions: ['What is your current monthly spend on sales and marketing tools?', 'Do you have a budget allocated for a CRM platform this quarter?', 'Would consolidating tools into one platform help justify the investment?'],
      timelineQuestions: ['When are you looking to have a new system in place?', 'Is there a specific event or deadline driving this evaluation?', 'How quickly does your team need to be onboarded?'],
      authorityQuestions: ['Who else is involved in evaluating tools like this?', 'What does the decision-making process look like at your company?', 'Would it be helpful to loop in your VP of Sales for the demo?'],
      needIdentificationQuestions: ['What is the single biggest challenge in your sales process right now?', 'How are you currently tracking deals and pipeline?', 'What would success look like 6 months from now?'],
      painPointQuestions: ['How much time does your team spend on manual data entry?', 'How many leads fall through the cracks each month?', 'What happens when a rep leaves — do you lose their pipeline data?'],
    },

    // CLOSING TECHNIQUES (Step 22)
    closingTechniques: {
      assumptiveCloseConditions: ['Customer has asked about onboarding', 'Customer has compared plans 2+ times', 'Customer has mentioned a timeline'],
      urgencyCreationTactics: ['Annual discount expires end of month', 'Onboarding slots filling up for this quarter', 'Current promotional pricing for early adopters'],
      trialCloseTriggers: ['Would you like to start the 14-day free trial today?', 'Shall I set up your account so you can explore the platform?'],
      softCloseApproaches: ['Based on everything you have told me, the Growth plan seems like the best fit. Want me to walk you through getting started?', 'Most companies in your situation start with our Pro plan. Would you like to see a quick setup walkthrough?'],
    },

    // RULES & RESTRICTIONS (Step 23)
    agentRules: {
      prohibitedBehaviors: ['Never fabricate features that do not exist', 'Never share competitor internal pricing', 'Never make revenue guarantees', 'Never discuss internal company matters'],
      behavioralBoundaries: ['Always identify as an AI assistant', 'Redirect political/social discussions to business topics', 'Do not engage in personal conversations beyond small talk'],
      mustAlwaysMention: ['30-day money-back guarantee', 'SOC 2 compliance', 'Free migration assistance'],
      neverMention: ['Internal roadmap details', 'Unreleased features', 'Customer names without permission'],
    },

    // TRAINING METRICS (Step 24)
    selectedTrainingMetrics: ['objection_handling', 'product_knowledge', 'closing_rate', 'discovery_depth', 'empathy_score', 'response_accuracy', 'tone_consistency'],

    // METADATA
    completedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    completedBy: DEMO_OWNER_ID,
    version: '2.0',
    isDemo: true,
  };
}

// ============================================================================
// 2. AI AGENT PERSONA
// ============================================================================

function getAgentPersona(): Record<string, unknown> {
  return {
    agentName: '(Demo) Jasper',
    professionalTitle: 'AI Sales Consultant',
    coreMission: 'Help prospective customers understand how Acme Digital Solutions can streamline their sales and marketing operations, qualify leads efficiently, and guide them to the right plan.',
    targetKnowledgeDomain: 'B2B SaaS, CRM, Sales Automation, Marketing Automation, Lead Scoring, Pipeline Management',
    userExpertiseLevel: 'Mixed - ranging from tech-savvy founders to non-technical small business owners',

    reasoningFramework: 'Consultative Selling with SPIN elements',
    responseComplexityIndex: 6,
    uncertaintyHandlingProtocol: 'Acknowledge uncertainty transparently. Say "I want to make sure I give you accurate information — let me connect you with our team for specifics on that." Never guess.',
    internalThoughtVerification: 'Before responding, verify: (1) Is this factually correct about our product? (2) Am I staying within my authorized scope? (3) Would a human sales rep approve this response?',

    federatedRAGTags: ['DOMAIN:SAAS', 'SUB_DOMAIN:CRM', 'VERTICAL:B2B', 'PRODUCT:ACME_DIGITAL'],
    knowledgeSourceHierarchy: ['Product Documentation', 'FAQ Database', 'Pricing Pages', 'Case Studies', 'Blog Articles', 'Onboarding Data'],
    sourceAuthorityWeighting: 'Product Documentation > FAQ > Pricing > Case Studies > Blog',
    contextRetrievalDepth: 5,

    feedbackIntegrationStrategy: 'After each conversation, analyze customer satisfaction signals. If positive outcome, reinforce the approach. If negative, flag for human review and adjust tone/strategy.',
    dynamicToneRegister: 'Professional but approachable. Match the customer energy level — more formal with enterprise buyers, more casual with startup founders.',
    successfulStrategyMemory: 'Track which objection responses lead to continued engagement. Prioritize approaches that resulted in demo bookings or trial signups.',
    knowledgeObsolescenceTimer: '7 days — re-check product documentation weekly for updates.',

    toolAuthorization: [
      { tool: 'CRM Lookup', permissions: 'Read Only', canExecuteAutonomously: true, description: 'Look up contact and deal information' },
      { tool: 'Calendar Booking', permissions: 'Execute', canExecuteAutonomously: true, description: 'Book demo calls on team calendar' },
      { tool: 'Email Send', permissions: 'Execute with Review', canExecuteAutonomously: false, description: 'Send follow-up emails (requires human approval)' },
      { tool: 'Discount Application', permissions: 'Execute with Review', canExecuteAutonomously: false, description: 'Apply discounts up to 15% (requires approval above 15%)' },
      { tool: 'Lead Scoring', permissions: 'Read/Write', canExecuteAutonomously: true, description: 'Score and update lead priority' },
    ],
    mandatoryOutputFormatting: 'Keep responses under 150 words unless the customer asks for detailed explanation. Use bullet points for feature lists. Always end with a question or call to action.',
    securityDataFilter: 'Never expose: customer PII from other accounts, internal pricing margins, employee information, source code details, or API keys.',

    verbosityControl: {
      maxResponseLength: 200,
      preferBulletPoints: true,
      avoidRepetition: true,
      conversationalPacing: 'balanced',
    },
    accuracyRules: [
      'Only reference features that currently exist in the product',
      'Use exact pricing from the pricing page — never round or approximate',
      'When unsure, say so rather than guessing',
    ],
    brandAlignmentNotes: 'Tone: confident but not arrogant. Helpful but not pushy. Data-driven but still warm. Never use aggressive sales tactics.',
    trainingInsights: [
      { date: new Date(Date.now() - 20 * 86400000).toISOString(), issue: 'Agent was too verbose in initial greeting', adjustment: 'Shortened greeting to 2 sentences max', category: 'verbosity' },
      { date: new Date(Date.now() - 14 * 86400000).toISOString(), issue: 'Mentioned a feature still in beta', adjustment: 'Added beta features to restricted topics list', category: 'accuracy' },
      { date: new Date(Date.now() - 7 * 86400000).toISOString(), issue: 'Tone too casual with enterprise buyers', adjustment: 'Added tone matching based on company size signals', category: 'tone' },
    ],

    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    createdBy: DEMO_OWNER_ID,
    updatedBy: DEMO_OWNER_ID,
    version: 3,
    isDemo: true,
  };
}

// ============================================================================
// 3. WORKFLOWS
// ============================================================================

function getWorkflows(): Array<Record<string, unknown>> {
  return [
    {
      id: 'demo-workflow-001',
      isDemo: true,
      name: '(Demo) New Lead Auto-Enrichment & Assignment',
      description: 'When a new lead is created, automatically enrich with company data, score the lead, and assign to the appropriate sales rep.',
      icon: '🔄',
      folder: 'Lead Management',
      trigger: {
        type: 'entity.created',
        id: 'trigger-lead-created',
        name: 'Lead Created',
        schemaId: 'leads',
        specificFields: [],
        filters: [],
      },
      conditions: [
        { id: 'cond-1', source: 'trigger_data', field: 'email', operator: 'is_not_empty', value: true, logicOperator: 'and' },
        { id: 'cond-2', source: 'trigger_data', field: 'company', operator: 'is_not_empty', value: true },
      ],
      conditionOperator: 'and',
      actions: [
        { id: 'action-1', type: 'ai_agent', name: 'Enrich Lead Data', agentId: 'enrichment-agent', prompt: 'Enrich this lead with company data: {{trigger.company}}', context: {}, saveResponseAs: 'enrichmentResult', awaitResponse: true, continueOnError: true, retry: { enabled: true, maxAttempts: 2, backoffMultiplier: 2 } },
        { id: 'action-2', type: 'update_entity', name: 'Update Lead Score', schemaId: 'leads', targetRecord: 'trigger', fieldMappings: [{ targetField: 'score', source: 'variable', sourceField: 'enrichmentResult.score' }], continueOnError: true },
        { id: 'action-3', type: 'send_email', name: 'Notify Sales Rep', to: [DEMO_OWNER_EMAIL], subject: 'New Lead Assigned: {{trigger.firstName}} {{trigger.lastName}}', body: '<p>A new lead has been assigned to you:</p><ul><li>Name: {{trigger.firstName}} {{trigger.lastName}}</li><li>Company: {{trigger.company}}</li><li>Score: {{enrichmentResult.score}}</li></ul>', bodyType: 'html', continueOnError: true },
      ],
      settings: {
        enabled: true,
        timeout: 120,
        maxConcurrentRuns: 5,
        queueStrategy: 'parallel',
        onError: 'continue',
        stopOnError: false,
        errorNotificationEmail: DEMO_OWNER_EMAIL,
        logLevel: 'all',
        retentionDays: 30,
        rateLimit: { enabled: true, maxRunsPerHour: 100, maxRunsPerDay: 500 },
      },
      permissions: { canView: ['owner', 'admin', 'manager'], canEdit: ['owner', 'admin'], canExecute: ['owner', 'admin', 'manager'] },
      stats: { totalRuns: 47, successfulRuns: 44, failedRuns: 3, lastRunAt: hoursAgo(2), lastRunStatus: 'success' },
      createdAt: daysAgo(28),
      updatedAt: daysAgo(2),
      createdBy: DEMO_OWNER_ID,
      status: 'active',
      version: 3,
    },
    {
      id: 'demo-workflow-002',
      isDemo: true,
      name: '(Demo) Weekly Pipeline Review Report',
      description: 'Every Monday at 9am, compile pipeline metrics and email a summary to the sales team.',
      icon: '📊',
      folder: 'Reporting',
      trigger: {
        type: 'schedule',
        id: 'trigger-weekly-schedule',
        name: 'Weekly Monday 9am',
        schedule: { type: 'cron', cron: '0 9 * * 1', timezone: 'America/New_York' },
      },
      conditions: [],
      conditionOperator: 'and',
      actions: [
        { id: 'action-1', type: 'ai_agent', name: 'Generate Pipeline Report', agentId: 'reporting-agent', prompt: 'Generate a weekly pipeline summary report for workspace {{workspaceId}}', context: {}, saveResponseAs: 'report', awaitResponse: true, continueOnError: false },
        { id: 'action-2', type: 'send_email', name: 'Email Report to Team', to: [DEMO_OWNER_EMAIL, 'team@demo-acme.com'], subject: 'Weekly Pipeline Review — {{report.weekOf}}', body: '{{report.htmlContent}}', bodyType: 'html', continueOnError: true },
      ],
      settings: { enabled: true, timeout: 300, maxConcurrentRuns: 1, queueStrategy: 'sequential', onError: 'notify', stopOnError: false, errorNotificationEmail: DEMO_OWNER_EMAIL, logLevel: 'all', retentionDays: 90 },
      permissions: { canView: ['owner', 'admin', 'manager', 'member'], canEdit: ['owner', 'admin'], canExecute: ['owner', 'admin'] },
      stats: { totalRuns: 4, successfulRuns: 4, failedRuns: 0, lastRunAt: daysAgo(1), lastRunStatus: 'success' },
      createdAt: daysAgo(30),
      updatedAt: daysAgo(7),
      createdBy: DEMO_OWNER_ID,
      status: 'active',
      version: 1,
    },
    {
      id: 'demo-workflow-003',
      isDemo: true,
      name: '(Demo) Contact Form → Lead + Slack Notification',
      description: 'When the website contact form is submitted, create a lead and notify the #sales channel in Slack.',
      icon: '📝',
      folder: 'Lead Management',
      trigger: {
        type: 'form.submitted',
        id: 'trigger-form-submit',
        name: 'Contact Form Submitted',
        formId: 'demo-form-001',
        schemaId: 'leads',
      },
      conditions: [
        { id: 'cond-1', source: 'trigger_data', field: 'responses.email', operator: 'is_not_empty', value: true },
      ],
      conditionOperator: 'and',
      actions: [
        { id: 'action-1', type: 'create_entity', name: 'Create Lead from Form', schemaId: 'leads', fieldMappings: [
          { targetField: 'firstName', source: 'trigger', sourceField: 'responses.firstName' },
          { targetField: 'lastName', source: 'trigger', sourceField: 'responses.lastName' },
          { targetField: 'email', source: 'trigger', sourceField: 'responses.email' },
          { targetField: 'company', source: 'trigger', sourceField: 'responses.company' },
          { targetField: 'source', source: 'static', staticValue: 'website_form' },
          { targetField: 'status', source: 'static', staticValue: 'new' },
        ], continueOnError: false },
        { id: 'action-2', type: 'send_slack', name: 'Notify Sales Channel', channel: '#sales', message: '🔔 New form submission from {{trigger.responses.firstName}} {{trigger.responses.lastName}} ({{trigger.responses.company}})', mentions: [DEMO_OWNER_ID], continueOnError: true },
      ],
      settings: { enabled: true, timeout: 60, maxConcurrentRuns: 10, queueStrategy: 'parallel', onError: 'continue', logLevel: 'all', retentionDays: 30 },
      permissions: { canView: ['owner', 'admin', 'manager'], canEdit: ['owner', 'admin'], canExecute: ['owner', 'admin', 'manager'] },
      stats: { totalRuns: 12, successfulRuns: 11, failedRuns: 1, lastRunAt: daysAgo(1), lastRunStatus: 'success' },
      createdAt: daysAgo(21),
      updatedAt: daysAgo(3),
      createdBy: DEMO_OWNER_ID,
      status: 'active',
      version: 2,
    },
  ];
}

// ============================================================================
// 4. FORMS + FIELDS + SUBMISSIONS
// ============================================================================

function getForms(): Array<{ form: Record<string, unknown>; fields: Array<Record<string, unknown>>; submissions: Array<Record<string, unknown>> }> {
  return [
    {
      form: {
        id: 'demo-form-001',
        isDemo: true,
        name: '(Demo) Website Contact Form',
        description: 'Main contact form embedded on the website. Captures leads and maps to CRM.',
        status: 'published',
        version: 2,
        category: 'lead-capture',
        pages: [{ id: 'page-1', title: 'Contact Us', description: 'Get in touch with our team', order: 0 }],
        settings: {
          submitButtonText: 'Send Message',
          showProgressBar: false,
          showPageNumbers: false,
          allowSaveDraft: false,
          confirmationType: 'message',
          confirmationMessage: 'Thank you! We will get back to you within 24 hours.',
          sendEmailNotification: true,
          notificationEmails: [DEMO_OWNER_EMAIL],
          sendAutoReply: true,
          autoReplySubject: 'Thanks for reaching out to Acme Digital Solutions!',
          autoReplyMessage: 'Hi {{firstName}},\n\nThanks for contacting us! A member of our team will reach out within 24 hours.\n\nBest,\nThe Acme Team',
          autoReplyFromName: 'Acme Digital Solutions',
          showBranding: false,
          enableCaptcha: true,
          captchaType: 'turnstile',
          requireLogin: false,
          metaTitle: 'Contact Us — Acme Digital Solutions',
          metaDescription: 'Get in touch with our sales team to learn how Acme can transform your sales pipeline.',
        },
        behavior: { maxSubmissions: 0, allowMultipleSubmissions: true, showThankYouPage: true, thankYouMessage: 'Your message has been sent successfully!', enableSaveAndContinue: false },
        crmMapping: { enabled: true, entityType: 'lead', fieldMappings: [{ formFieldId: 'field-email', crmFieldName: 'email', transformation: 'lowercase' }, { formFieldId: 'field-fname', crmFieldName: 'firstName', transformation: 'capitalize' }], createNew: true, updateExisting: false, matchingField: 'email' },
        workflowTriggers: ['demo-workflow-003'],
        trackingEnabled: true,
        publicAccess: true,
        embedAllowedDomains: ['demo-acme.salesvelocity.ai', 'localhost'],
        shareableLink: 'https://demo-acme.salesvelocity.ai/f/demo-form-001',
        createdBy: DEMO_OWNER_ID,
        lastModifiedBy: DEMO_OWNER_ID,
        createdAt: daysAgo(25),
        updatedAt: daysAgo(3),
        publishedAt: daysAgo(24),
        fieldCount: 6,
        submissionCount: 23,
        viewCount: 187,
      },
      fields: [
        { id: 'field-fname', formId: 'demo-form-001', isDemo: true, type: 'text', label: 'First Name', name: 'firstName', placeholder: 'John', order: 0, pageIndex: 0, width: 'half', validation: { required: true, minLength: 1, maxLength: 50 }, createdAt: daysAgo(25), updatedAt: daysAgo(25) },
        { id: 'field-lname', formId: 'demo-form-001', isDemo: true, type: 'text', label: 'Last Name', name: 'lastName', placeholder: 'Doe', order: 1, pageIndex: 0, width: 'half', validation: { required: true, minLength: 1, maxLength: 50 }, createdAt: daysAgo(25), updatedAt: daysAgo(25) },
        { id: 'field-email', formId: 'demo-form-001', isDemo: true, type: 'email', label: 'Email Address', name: 'email', placeholder: 'john@company.com', order: 2, pageIndex: 0, width: 'full', validation: { required: true }, createdAt: daysAgo(25), updatedAt: daysAgo(25) },
        { id: 'field-company', formId: 'demo-form-001', isDemo: true, type: 'text', label: 'Company', name: 'company', placeholder: 'Acme Inc.', order: 3, pageIndex: 0, width: 'half', validation: { required: false }, createdAt: daysAgo(25), updatedAt: daysAgo(25) },
        { id: 'field-phone', formId: 'demo-form-001', isDemo: true, type: 'phone', label: 'Phone', name: 'phone', placeholder: '(555) 123-4567', order: 4, pageIndex: 0, width: 'half', validation: { required: false }, createdAt: daysAgo(25), updatedAt: daysAgo(25) },
        { id: 'field-message', formId: 'demo-form-001', isDemo: true, type: 'textarea', label: 'Message', name: 'message', placeholder: 'Tell us about your needs...', order: 5, pageIndex: 0, width: 'full', validation: { required: true, minLength: 10, maxLength: 2000 }, createdAt: daysAgo(25), updatedAt: daysAgo(25) },
      ],
      submissions: [
        {
          id: 'demo-submission-001',
          formId: 'demo-form-001',
          formVersion: 2,
          isDemo: true,
          status: 'completed',
          responses: [
            { fieldId: 'field-fname', fieldName: 'firstName', fieldType: 'text', value: 'Sarah', displayValue: 'Sarah' },
            { fieldId: 'field-lname', fieldName: 'lastName', fieldType: 'text', value: 'Mitchell', displayValue: 'Mitchell' },
            { fieldId: 'field-email', fieldName: 'email', fieldType: 'email', value: 'sarah.mitchell@techforward.io', displayValue: 'sarah.mitchell@techforward.io' },
            { fieldId: 'field-company', fieldName: 'company', fieldType: 'text', value: 'TechForward Inc.', displayValue: 'TechForward Inc.' },
            { fieldId: 'field-phone', fieldName: 'phone', fieldType: 'phone', value: '(555) 234-5678', displayValue: '(555) 234-5678' },
            { fieldId: 'field-message', fieldName: 'message', fieldType: 'textarea', value: 'We are evaluating CRM platforms for our 50-person sales team. Currently using spreadsheets and it is becoming unmanageable. Would love to learn more about your AI features.', displayValue: 'We are evaluating CRM platforms...' },
          ],
          indexedEmail: 'sarah.mitchell@techforward.io',
          indexedPhone: '(555) 234-5678',
          indexedName: 'Sarah Mitchell',
          indexedCompany: 'TechForward Inc.',
          confirmationNumber: 'DEMO-2024-001',
          isPartial: false,
          linkedLeadId: 'demo-lead-001',
          crmSyncStatus: 'synced',
          crmSyncedAt: daysAgo(5),
          workflowsTriggered: ['demo-workflow-003'],
          workflowStatus: { 'demo-workflow-003': 'completed' },
          metadata: { sessionId: 'sess_demo_001', ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0', deviceType: 'desktop', browser: 'Chrome 120', os: 'Windows 11', country: 'US', region: 'California', city: 'San Francisco', source: 'direct', referrer: 'https://demo-acme.salesvelocity.ai', utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'brand_search' },
          startedAt: daysAgo(5),
          submittedAt: daysAgo(5),
          completionTimeSeconds: 145,
        },
        {
          id: 'demo-submission-002',
          formId: 'demo-form-001',
          formVersion: 2,
          isDemo: true,
          status: 'completed',
          responses: [
            { fieldId: 'field-fname', fieldName: 'firstName', fieldType: 'text', value: 'Michael', displayValue: 'Michael' },
            { fieldId: 'field-lname', fieldName: 'lastName', fieldType: 'text', value: 'Brooks', displayValue: 'Brooks' },
            { fieldId: 'field-email', fieldName: 'email', fieldType: 'email', value: 'mbrooks@brookslegal.com', displayValue: 'mbrooks@brookslegal.com' },
            { fieldId: 'field-company', fieldName: 'company', fieldType: 'text', value: 'Brooks Legal Group', displayValue: 'Brooks Legal Group' },
            { fieldId: 'field-phone', fieldName: 'phone', fieldType: 'phone', value: '(555) 678-9012', displayValue: '(555) 678-9012' },
            { fieldId: 'field-message', fieldName: 'message', fieldType: 'textarea', value: 'Need a CRM solution for our law firm. Main priority is contact management and automated follow-ups. Can we schedule a demo?', displayValue: 'Need a CRM solution for our law firm...' },
          ],
          indexedEmail: 'mbrooks@brookslegal.com',
          indexedPhone: '(555) 678-9012',
          indexedName: 'Michael Brooks',
          indexedCompany: 'Brooks Legal Group',
          confirmationNumber: 'DEMO-2024-002',
          isPartial: false,
          linkedLeadId: 'demo-lead-003',
          crmSyncStatus: 'synced',
          crmSyncedAt: daysAgo(3),
          metadata: { sessionId: 'sess_demo_002', ipAddress: '10.0.0.55', userAgent: 'Mozilla/5.0 (Macintosh)', deviceType: 'desktop', browser: 'Safari 17', os: 'macOS Sonoma', country: 'US', region: 'New York', city: 'New York', source: 'organic', referrer: 'https://www.google.com' },
          startedAt: daysAgo(3),
          submittedAt: daysAgo(3),
          completionTimeSeconds: 98,
        },
      ],
    },
    {
      form: {
        id: 'demo-form-002',
        isDemo: true,
        name: '(Demo) Customer Satisfaction Survey',
        description: 'Post-onboarding survey to gauge customer satisfaction and gather product feedback.',
        status: 'published',
        version: 1,
        category: 'survey',
        pages: [
          { id: 'page-1', title: 'Overall Experience', description: 'Rate your experience so far', order: 0 },
          { id: 'page-2', title: 'Feature Feedback', description: 'Tell us about the features you use', order: 1 },
        ],
        settings: {
          submitButtonText: 'Submit Feedback',
          showProgressBar: true,
          showPageNumbers: true,
          allowSaveDraft: true,
          confirmationType: 'message',
          confirmationMessage: 'Thank you for your feedback! It helps us improve.',
          sendEmailNotification: true,
          notificationEmails: [DEMO_OWNER_EMAIL],
          sendAutoReply: false,
          showBranding: false,
          enableCaptcha: false,
          requireLogin: true,
          metaTitle: 'Customer Satisfaction Survey — Acme',
          metaDescription: 'Share your experience with Acme Digital Solutions.',
        },
        behavior: { maxSubmissions: 0, maxSubmissionsPerUser: 1, allowMultipleSubmissions: false, showThankYouPage: true, thankYouMessage: 'Your feedback has been recorded!', enableSaveAndContinue: true, saveAndContinueExpiry: 7 },
        crmMapping: { enabled: false, entityType: 'contact', fieldMappings: [], createNew: false, updateExisting: false },
        trackingEnabled: true,
        publicAccess: false,
        createdBy: DEMO_OWNER_ID,
        lastModifiedBy: DEMO_OWNER_ID,
        createdAt: daysAgo(14),
        updatedAt: daysAgo(5),
        publishedAt: daysAgo(13),
        fieldCount: 5,
        submissionCount: 8,
        viewCount: 24,
      },
      fields: [
        { id: 'field-rating', formId: 'demo-form-002', isDemo: true, type: 'rating', label: 'Overall satisfaction', name: 'satisfaction', order: 0, pageIndex: 0, width: 'full', validation: { required: true }, createdAt: daysAgo(14), updatedAt: daysAgo(14) },
        { id: 'field-recommend', formId: 'demo-form-002', isDemo: true, type: 'scale', label: 'How likely are you to recommend us? (1-10)', name: 'npsScore', order: 1, pageIndex: 0, width: 'full', validation: { required: true, min: 1, max: 10 }, createdAt: daysAgo(14), updatedAt: daysAgo(14) },
        { id: 'field-fav-feature', formId: 'demo-form-002', isDemo: true, type: 'dropdown', label: 'Favorite feature', name: 'favoriteFeature', order: 0, pageIndex: 1, width: 'full', options: [{ label: 'AI Lead Scoring', value: 'lead_scoring' }, { label: 'Email Campaigns', value: 'email_campaigns' }, { label: 'Pipeline Management', value: 'pipeline' }, { label: 'Workflow Automation', value: 'workflows' }, { label: 'Forms', value: 'forms' }], validation: { required: true }, createdAt: daysAgo(14), updatedAt: daysAgo(14) },
        { id: 'field-improvement', formId: 'demo-form-002', isDemo: true, type: 'textarea', label: 'What could we improve?', name: 'improvement', placeholder: 'Your suggestions...', order: 1, pageIndex: 1, width: 'full', validation: { required: false, maxLength: 1000 }, createdAt: daysAgo(14), updatedAt: daysAgo(14) },
        { id: 'field-followup', formId: 'demo-form-002', isDemo: true, type: 'checkbox', label: 'I am open to a follow-up call', name: 'openToFollowUp', order: 2, pageIndex: 1, width: 'full', validation: { required: false }, createdAt: daysAgo(14), updatedAt: daysAgo(14) },
      ],
      submissions: [
        {
          id: 'demo-submission-003',
          formId: 'demo-form-002',
          formVersion: 1,
          isDemo: true,
          status: 'completed',
          responses: [
            { fieldId: 'field-rating', fieldName: 'satisfaction', fieldType: 'rating', value: 5, displayValue: '5/5' },
            { fieldId: 'field-recommend', fieldName: 'npsScore', fieldType: 'scale', value: 9, displayValue: '9/10' },
            { fieldId: 'field-fav-feature', fieldName: 'favoriteFeature', fieldType: 'dropdown', value: 'lead_scoring', displayValue: 'AI Lead Scoring' },
            { fieldId: 'field-improvement', fieldName: 'improvement', fieldType: 'textarea', value: 'Would love to see more integrations with Zapier and native Slack notifications for deal updates.', displayValue: 'Would love to see more integrations...' },
            { fieldId: 'field-followup', fieldName: 'openToFollowUp', fieldType: 'checkbox', value: true, displayValue: 'Yes' },
          ],
          indexedEmail: 'jchen@luminarydesigns.co',
          indexedName: 'Jessica Chen',
          confirmationNumber: 'DEMO-SURVEY-001',
          isPartial: false,
          pageProgress: [
            { pageId: 'page-1', pageIndex: 0, completed: true, timeSpentSeconds: 45 },
            { pageId: 'page-2', pageIndex: 1, completed: true, timeSpentSeconds: 120 },
          ],
          completionPercent: 100,
          metadata: { sessionId: 'sess_survey_001', deviceType: 'desktop', browser: 'Chrome', os: 'Windows 11', country: 'US', userId: 'demo-contact-002' },
          startedAt: daysAgo(7),
          submittedAt: daysAgo(7),
          completionTimeSeconds: 165,
        },
      ],
    },
  ];
}

// ============================================================================
// 5. WEBSITE PAGES
// ============================================================================

function getWebsitePages(): Array<Record<string, unknown>> {
  return [
    {
      id: 'demo-page-home',
      isDemo: true,
      slug: '/',
      title: '(Demo) Home — Acme Digital Solutions',
      content: [
        { id: 'hero-section', type: 'section', columns: [{ id: 'col-1', width: 100, widgets: [{ id: 'hero-widget', type: 'hero', data: { heading: 'Close Deals 3x Faster with AI', subheading: 'The all-in-one CRM that scores leads, automates outreach, and manages your pipeline — so you can focus on selling.', ctaText: 'Start Free Trial', ctaUrl: '/signup', backgroundImage: '/images/hero-bg.jpg' }, style: { padding: { top: '80px', bottom: '80px' }, textAlign: 'center', color: '#ffffff' } }] }], padding: { top: '0', bottom: '0' }, fullWidth: true, name: 'Hero' },
        { id: 'features-section', type: 'section', columns: [{ id: 'col-1', width: 100, widgets: [{ id: 'features-widget', type: 'features', data: { heading: 'Everything You Need to Sell', features: [{ title: 'AI Lead Scoring', description: 'Automatically score and prioritize leads based on 20+ signals', icon: '🎯' }, { title: 'Pipeline Management', description: 'Visual drag-and-drop pipeline with real-time analytics', icon: '📊' }, { title: 'Email Automation', description: 'Multi-step sequences that nurture leads while you sleep', icon: '📧' }, { title: 'Forms & Landing Pages', description: 'Capture leads with beautiful, high-converting forms', icon: '📝' }] }, style: { padding: { top: '60px', bottom: '60px' } } }] }], name: 'Features' },
        { id: 'cta-section', type: 'section', columns: [{ id: 'col-1', width: 100, widgets: [{ id: 'cta-widget', type: 'cta', data: { heading: 'Ready to Transform Your Sales?', subheading: 'Join 500+ companies already using Acme', ctaText: 'Get Started Free', ctaUrl: '/signup' }, style: { backgroundColor: '#2563eb', color: '#ffffff', padding: { top: '60px', bottom: '60px' }, textAlign: 'center', borderRadius: '12px' } }] }], name: 'CTA' },
      ],
      seo: { metaTitle: 'Acme Digital Solutions — AI-Powered CRM', metaDescription: 'Close deals 3x faster with AI lead scoring, pipeline management, and marketing automation. Start your free trial today.', metaKeywords: ['CRM', 'AI sales', 'lead scoring', 'pipeline management'], ogTitle: 'Acme Digital Solutions', ogDescription: 'The all-in-one AI CRM for modern sales teams', noIndex: false, noFollow: false },
      status: 'published',
      publishedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      isPublished: true,
      version: 3,
      lastPublishedVersion: 3,
      createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      createdBy: DEMO_OWNER_ID,
      lastEditedBy: DEMO_OWNER_ID,
    },
    {
      id: 'demo-page-about',
      isDemo: true,
      slug: '/about',
      title: '(Demo) About Us — Acme Digital Solutions',
      content: [
        { id: 'about-hero', type: 'section', columns: [{ id: 'col-1', width: 100, widgets: [{ id: 'heading', type: 'heading', data: { text: 'About Acme Digital Solutions', level: 1 }, style: { textAlign: 'center', padding: { top: '60px', bottom: '20px' } } }, { id: 'text', type: 'text', data: { text: 'We believe every sales team deserves access to AI-powered tools that were previously only available to Fortune 500 companies. Founded in 2023, Acme Digital Solutions helps B2B companies close more deals with less effort.' }, style: { textAlign: 'center', maxWidth: '700px', margin: { left: 'auto', right: 'auto' }, padding: { bottom: '40px' } } }] }], name: 'About Hero' },
        { id: 'stats-section', type: 'section', columns: [{ id: 'col-1', width: 100, widgets: [{ id: 'stats', type: 'stats', data: { stats: [{ label: 'Companies', value: '500+' }, { label: 'Deals Closed', value: '$2.4B' }, { label: 'Leads Scored', value: '1.2M' }, { label: 'Uptime', value: '99.9%' }] }, style: { padding: { top: '40px', bottom: '40px' }, backgroundColor: '#f8fafc' } }] }], name: 'Stats' },
      ],
      seo: { metaTitle: 'About Us — Acme Digital Solutions', metaDescription: 'Learn about Acme Digital Solutions and our mission to democratize AI-powered sales tools for every business.', noIndex: false, noFollow: false },
      status: 'published',
      publishedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      isPublished: true,
      version: 2,
      createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      createdBy: DEMO_OWNER_ID,
      lastEditedBy: DEMO_OWNER_ID,
    },
    {
      id: 'demo-page-pricing',
      isDemo: true,
      slug: '/pricing',
      title: '(Demo) Pricing — Acme Digital Solutions',
      content: [
        { id: 'pricing-hero', type: 'section', columns: [{ id: 'col-1', width: 100, widgets: [{ id: 'pricing', type: 'pricing', data: { heading: 'Simple, Transparent Pricing', subheading: 'No hidden fees. Cancel anytime.', plans: [{ name: 'Starter', price: '$99/mo', features: ['Up to 1,000 contacts', 'Basic pipeline', 'Email campaigns', 'Forms'], ctaText: 'Start Free Trial', ctaUrl: '/signup?plan=starter', highlighted: false }, { name: 'Growth', price: '$149/mo', features: ['Up to 10,000 contacts', 'Advanced pipeline', 'AI lead scoring', 'Workflow automation', 'Priority support'], ctaText: 'Start Free Trial', ctaUrl: '/signup?plan=growth', highlighted: true }, { name: 'Enterprise', price: '$399/mo', features: ['Unlimited contacts', 'AI Sales Agent', 'Custom integrations', 'Dedicated CSM', '99.9% SLA'], ctaText: 'Contact Sales', ctaUrl: '/contact', highlighted: false }] }, style: { padding: { top: '60px', bottom: '60px' } } }] }], name: 'Pricing' },
      ],
      seo: { metaTitle: 'Pricing — Acme Digital Solutions', metaDescription: 'Simple, transparent pricing starting at $99/month. AI-powered CRM with no hidden fees.', noIndex: false, noFollow: false },
      status: 'published',
      publishedAt: new Date(Date.now() - 24 * 86400000).toISOString(),
      isPublished: true,
      version: 4,
      createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      createdBy: DEMO_OWNER_ID,
      lastEditedBy: DEMO_OWNER_ID,
    },
  ];
}

// ============================================================================
// 6. BLOG POSTS
// ============================================================================

function getBlogPosts(): Array<Record<string, unknown>> {
  return [
    {
      id: 'demo-blog-001',
      isDemo: true,
      slug: 'ai-lead-scoring-guide',
      title: '(Demo) The Complete Guide to AI Lead Scoring in 2026',
      excerpt: 'Learn how AI lead scoring can help your sales team prioritize the right prospects and close deals 3x faster.',
      content: [{ id: 'section-1', type: 'section', columns: [{ id: 'col-1', width: 100, widgets: [{ id: 'text-1', type: 'text', data: { text: 'AI lead scoring has transformed how modern sales teams prioritize their pipeline...' } }] }] }],
      featuredImage: '/images/blog/ai-lead-scoring.jpg',
      author: DEMO_OWNER_ID,
      authorName: DEMO_OWNER_NAME,
      authorAvatar: '/images/avatars/alex-morgan.jpg',
      publishedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      categories: ['Sales', 'AI', 'Lead Management'],
      tags: ['lead scoring', 'artificial intelligence', 'sales automation', 'CRM'],
      featured: true,
      seo: { metaTitle: 'The Complete Guide to AI Lead Scoring in 2026', metaDescription: 'Discover how AI lead scoring transforms sales pipelines. Step-by-step guide with real examples.', metaKeywords: ['AI lead scoring', 'sales automation', 'CRM guide'], noIndex: false, noFollow: false },
      status: 'published',
      views: 342,
      readTime: 8,
      createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      createdBy: DEMO_OWNER_ID,
      lastEditedBy: DEMO_OWNER_ID,
    },
    {
      id: 'demo-blog-002',
      isDemo: true,
      slug: '5-email-sequence-templates',
      title: '(Demo) 5 Email Sequence Templates That Convert',
      excerpt: 'Proven email sequences for onboarding, nurture, re-engagement, and more — ready to copy and customize.',
      content: [{ id: 'section-1', type: 'section', columns: [{ id: 'col-1', width: 100, widgets: [{ id: 'text-1', type: 'text', data: { text: 'Great email sequences are the backbone of any outbound sales strategy...' } }] }] }],
      featuredImage: '/images/blog/email-templates.jpg',
      author: DEMO_OWNER_ID,
      authorName: DEMO_OWNER_NAME,
      authorAvatar: '/images/avatars/alex-morgan.jpg',
      publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      categories: ['Marketing', 'Email'],
      tags: ['email sequences', 'templates', 'outbound sales', 'automation'],
      featured: false,
      seo: { metaTitle: '5 Email Sequence Templates That Convert | Acme Blog', metaDescription: 'Ready-to-use email sequences for onboarding, nurture, and re-engagement campaigns.', noIndex: false, noFollow: false },
      status: 'published',
      views: 156,
      readTime: 6,
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      createdBy: DEMO_OWNER_ID,
      lastEditedBy: DEMO_OWNER_ID,
    },
    {
      id: 'demo-blog-003',
      isDemo: true,
      slug: 'crm-migration-checklist',
      title: '(Demo) CRM Migration Checklist: Moving from Spreadsheets to a Real CRM',
      excerpt: 'Step-by-step guide to migrating your sales data from spreadsheets to a modern CRM without losing anything.',
      content: [{ id: 'section-1', type: 'section', columns: [{ id: 'col-1', width: 100, widgets: [{ id: 'text-1', type: 'text', data: { text: 'Draft content — Coming soon...' } }] }] }],
      featuredImage: '/images/blog/crm-migration.jpg',
      author: DEMO_OWNER_ID,
      authorName: DEMO_OWNER_NAME,
      authorAvatar: '/images/avatars/alex-morgan.jpg',
      categories: ['CRM', 'Getting Started'],
      tags: ['migration', 'onboarding', 'data import', 'CRM setup'],
      featured: false,
      seo: { metaTitle: 'CRM Migration Checklist | Acme Blog', metaDescription: 'Complete checklist for migrating from spreadsheets to a real CRM.', noIndex: true, noFollow: false },
      status: 'draft',
      views: 0,
      readTime: 10,
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      createdBy: DEMO_OWNER_ID,
      lastEditedBy: DEMO_OWNER_ID,
    },
  ];
}

// ============================================================================
// 7. SITE CONFIG + THEME + NAVIGATION
// ============================================================================

function getSiteConfig(): Record<string, unknown> {
  return {
    id: 'demo-site-config',
    isDemo: true,
    subdomain: 'demo-acme',
    customDomain: 'demo-acme.salesvelocity.ai',
    customDomainVerified: true,
    sslEnabled: true,
    seo: {
      title: '(Demo) Acme Digital Solutions — AI-Powered CRM',
      description: 'Close deals 3x faster with AI lead scoring, pipeline management, and marketing automation.',
      keywords: ['CRM', 'AI sales', 'lead scoring', 'sales automation'],
      ogImage: '/images/og-default.jpg',
      twitterCard: 'summary_large_image',
      favicon: '/favicon.ico',
      robotsIndex: true,
      robotsFollow: true,
    },
    analytics: { googleAnalyticsId: 'G-DEMO123456', facebookPixelId: 'DEMO_FB_PIXEL_123' },
    status: 'published',
    publishedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    createdBy: DEMO_OWNER_ID,
  };
}

function getSiteTheme(): Record<string, unknown> {
  return {
    id: 'demo-theme',
    isDemo: true,
    branding: { logo: '/images/logo.svg', logoLight: '/images/logo-white.svg', logoDark: '/images/logo-dark.svg', favicon: '/favicon.ico', brandName: '(Demo) Acme Digital Solutions', tagline: 'Close Deals 3x Faster with AI' },
    colors: { primary: '#2563eb', secondary: '#7c3aed', accent: '#f59e0b', background: '#ffffff', surface: '#f8fafc', text: '#0f172a', textSecondary: '#64748b', border: '#e2e8f0', success: '#22c55e', warning: '#f59e0b', error: '#ef4444', info: '#3b82f6' },
    typography: { headingFont: 'Inter', bodyFont: 'Inter', h1Size: '3rem', h2Size: '2.25rem', h3Size: '1.875rem', h4Size: '1.5rem', h5Size: '1.25rem', h6Size: '1rem', bodySize: '1rem', headingWeight: 700, bodyWeight: 400, headingLineHeight: '1.2', bodyLineHeight: '1.6' },
    layout: { maxWidth: 1280, containerPadding: '1.5rem', sectionPadding: '4rem 0', gridGap: '2rem', borderRadius: '0.75rem' },
    createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  };
}

function getNavigation(): Record<string, unknown> {
  return {
    id: 'demo-navigation',
    isDemo: true,
    header: [
      { id: 'nav-home', label: 'Home', url: '/', type: 'page', newTab: false },
      { id: 'nav-features', label: 'Features', url: '/features', type: 'page', newTab: false },
      { id: 'nav-pricing', label: 'Pricing', url: '/pricing', type: 'page', newTab: false },
      { id: 'nav-blog', label: 'Blog', url: '/blog', type: 'page', newTab: false },
      { id: 'nav-about', label: 'About', url: '/about', type: 'page', newTab: false },
      { id: 'nav-contact', label: 'Contact', url: '/contact', type: 'page', newTab: false },
    ],
    footer: {
      columns: [
        { id: 'footer-product', title: 'Product', links: [{ id: 'f-features', label: 'Features', url: '/features', type: 'page' }, { id: 'f-pricing', label: 'Pricing', url: '/pricing', type: 'page' }, { id: 'f-integrations', label: 'Integrations', url: '/integrations', type: 'page' }] },
        { id: 'footer-company', title: 'Company', links: [{ id: 'f-about', label: 'About', url: '/about', type: 'page' }, { id: 'f-blog', label: 'Blog', url: '/blog', type: 'page' }, { id: 'f-careers', label: 'Careers', url: '/careers', type: 'page' }] },
        { id: 'footer-support', title: 'Support', links: [{ id: 'f-docs', label: 'Documentation', url: '/docs', type: 'page' }, { id: 'f-faq', label: 'FAQ', url: '/faq', type: 'page' }, { id: 'f-contact', label: 'Contact', url: '/contact', type: 'page' }] },
      ],
      copyright: '© 2026 (Demo) Acme Digital Solutions. All rights reserved.',
      socialLinks: [
        { platform: 'twitter', url: 'https://twitter.com/demoacme' },
        { platform: 'linkedin', url: 'https://linkedin.com/company/demoacme' },
        { platform: 'youtube', url: 'https://youtube.com/@demoacme' },
        { platform: 'github', url: 'https://github.com/demoacme' },
      ],
      showLogo: true,
    },
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedBy: DEMO_OWNER_ID,
  };
}

// ============================================================================
// 8. SOCIAL MEDIA POSTS
// ============================================================================

function getSocialPosts(): Array<Record<string, unknown>> {
  return [
    { id: 'demo-social-001', isDemo: true, platform: 'twitter', content: '🚀 Just launched our AI Lead Scoring feature! Your sales team can now auto-prioritize leads based on 20+ signals. No more guessing — let AI do the heavy lifting. #SalesAI #CRM #B2B', status: 'published', publishedAt: daysAgo(7), platformPostId: 'tw_demo_001', metrics: { impressions: 4200, engagements: 312, likes: 89, comments: 14, shares: 28, clicks: 67, reach: 3800 }, createdBy: DEMO_OWNER_ID, createdAt: daysAgo(7), updatedAt: daysAgo(7) },
    { id: 'demo-social-002', isDemo: true, platform: 'linkedin', content: 'Exciting news from Acme Digital Solutions! 🎉\n\nWe just hit 500+ companies using our AI-powered CRM. In the past quarter alone, our customers:\n\n✅ Closed 3x more deals\n✅ Reduced lead response time by 80%\n✅ Saved 15+ hours/week on manual data entry\n\nThe future of sales is AI-native. Are you ready?\n\n#SalesAutomation #AI #CRM #SaaS #B2BSales', status: 'published', publishedAt: daysAgo(5), platformPostId: 'li_demo_001', metrics: { impressions: 8900, engagements: 567, likes: 234, comments: 42, shares: 89, clicks: 156, reach: 7200 }, createdBy: DEMO_OWNER_ID, createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    { id: 'demo-social-003', isDemo: true, platform: 'twitter', content: '💡 Pro tip: The best time to follow up with a lead is within 5 minutes of their first interaction. Our AI agent does this automatically — 24/7, no coffee breaks needed. ☕ #SalesTips #AIAgent', status: 'published', publishedAt: daysAgo(3), platformPostId: 'tw_demo_002', metrics: { impressions: 2800, engagements: 198, likes: 67, comments: 8, shares: 19, clicks: 34, reach: 2400 }, createdBy: DEMO_OWNER_ID, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
    { id: 'demo-social-004', isDemo: true, platform: 'linkedin', content: 'New blog post: "The Complete Guide to AI Lead Scoring in 2026"\n\nWe break down exactly how AI scoring works, why it matters, and how to set it up in under 10 minutes.\n\n🔗 Read the full guide: https://demo-acme.salesvelocity.ai/blog/ai-lead-scoring-guide\n\n#LeadScoring #SalesAutomation #AIinSales', status: 'scheduled', scheduledAt: daysFromNow(1), createdBy: DEMO_OWNER_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: 'demo-social-005', isDemo: true, platform: 'twitter', content: '📊 Did you know? Companies that use AI for lead scoring see a 30% increase in sales productivity. We built ours from the ground up — no third-party APIs, no data leaving your account. Privacy-first AI. 🔒', status: 'scheduled', scheduledAt: daysFromNow(2), createdBy: DEMO_OWNER_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: 'demo-social-006', isDemo: true, platform: 'twitter', content: 'Thinking about migrating your CRM? Here is a quick checklist:\n\n1️⃣ Export all contacts + deals\n2️⃣ Map your custom fields\n3️⃣ Set up automations\n4️⃣ Train your team\n5️⃣ Go live with confidence\n\nWe handle steps 1-4 for free. Seriously. 🤝', status: 'draft', createdBy: DEMO_OWNER_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: 'demo-social-007', isDemo: true, platform: 'linkedin', content: 'Case Study: How TechForward Inc. Closed $1.2M in Pipeline Using Acme AI\n\n(Full case study coming next week — stay tuned!)', status: 'draft', createdBy: DEMO_OWNER_ID, createdAt: now, updatedAt: now },
    { id: 'demo-social-008', isDemo: true, platform: 'twitter', content: 'Our latest customer went from spreadsheets to closing their first deal in Acme CRM in under 48 hours. Setup wizard + AI import = magic. ✨ Try it free → https://demo-acme.salesvelocity.ai/signup', status: 'queued', createdBy: DEMO_OWNER_ID, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  ];
}

// ============================================================================
// 9. ORDERS
// ============================================================================

function getOrders(): Array<Record<string, unknown>> {
  return [
    {
      id: 'demo-order-001', isDemo: true, orderNumber: 'DEMO-ORD-1001', status: 'delivered',
      customer: { id: 'demo-contact-002', firstName: '(Demo) Jessica', lastName: 'Chen', email: 'jchen@luminarydesigns.co', phone: '(555) 345-6789', company: '(Demo) Luminary Designs' },
      items: [{ productId: 'demo-product-001', name: '(Demo) Growth Plan — Monthly', quantity: 1, price: 14900, currency: 'USD', sku: 'PLAN-GROWTH-MO' }, { productId: 'demo-product-004', name: '(Demo) Data Migration Service', quantity: 1, price: 49900, currency: 'USD', sku: 'SVC-MIGRATE' }],
      subtotal: 64800, tax: 5184, taxRate: 8, shipping: 0, discount: 9720, discountCode: 'EARLY15', total: 60264, currency: 'USD',
      payment: { method: 'card', status: 'paid', transactionId: 'pi_demo_001', paidAt: daysAgo(20), cardLast4: '4242', cardBrand: 'visa' },
      shippingAddress: null, billingAddress: { street: '456 Design Ave', city: 'Portland', state: 'OR', zip: '97201', country: 'US' },
      notes: 'Annual billing applied. Migration completed within 3 business days.',
      tags: ['enterprise', 'annual', 'migration'],
      createdAt: daysAgo(22), updatedAt: daysAgo(18),
    },
    {
      id: 'demo-order-002', isDemo: true, orderNumber: 'DEMO-ORD-1002', status: 'shipped',
      customer: { id: 'demo-contact-005', firstName: '(Demo) David', lastName: 'Park', email: 'dpark@cloudnine.dev', phone: '(555) 567-8901', company: '(Demo) CloudNine Solutions' },
      items: [{ productId: 'demo-product-002', name: '(Demo) Enterprise Plan — Monthly', quantity: 1, price: 39900, currency: 'USD', sku: 'PLAN-ENT-MO' }],
      subtotal: 39900, tax: 3192, taxRate: 8, shipping: 0, discount: 0, total: 43092, currency: 'USD',
      payment: { method: 'card', status: 'paid', transactionId: 'pi_demo_002', paidAt: daysAgo(5), cardLast4: '5555', cardBrand: 'mastercard' },
      shippingAddress: null, billingAddress: { street: '789 Cloud St', city: 'Austin', state: 'TX', zip: '73301', country: 'US' },
      notes: 'Enterprise onboarding in progress.',
      tags: ['enterprise'],
      createdAt: daysAgo(5), updatedAt: daysAgo(3),
    },
    {
      id: 'demo-order-003', isDemo: true, orderNumber: 'DEMO-ORD-1003', status: 'processing',
      customer: { id: 'demo-contact-008', firstName: '(Demo) Tom', lastName: 'Bradley', email: 'tbradley@fitlife.com', phone: '(555) 890-1234', company: '(Demo) FitLife Wellness' },
      items: [{ productId: 'demo-product-003', name: '(Demo) Starter Plan — Monthly', quantity: 1, price: 9900, currency: 'USD', sku: 'PLAN-START-MO' }, { productId: 'demo-product-005', name: '(Demo) Custom AI Training Session', quantity: 2, price: 29900, currency: 'USD', sku: 'SVC-AI-TRAIN' }],
      subtotal: 69700, tax: 5576, taxRate: 8, shipping: 0, discount: 0, total: 75276, currency: 'USD',
      payment: { method: 'card', status: 'paid', transactionId: 'pi_demo_003', paidAt: daysAgo(1), cardLast4: '1234', cardBrand: 'amex' },
      billingAddress: { street: '321 Wellness Blvd', city: 'Denver', state: 'CO', zip: '80201', country: 'US' },
      notes: 'Training sessions scheduled for next week.',
      tags: ['starter', 'training'],
      createdAt: daysAgo(1), updatedAt: now,
    },
    {
      id: 'demo-order-004', isDemo: true, orderNumber: 'DEMO-ORD-1004', status: 'pending',
      customer: { id: 'demo-contact-004', firstName: '(Demo) Rachel', lastName: 'Kim', email: 'rkim@suncoastrealty.com', phone: '(555) 456-7890', company: '(Demo) Suncoast Realty' },
      items: [{ productId: 'demo-product-001', name: '(Demo) Growth Plan — Monthly', quantity: 1, price: 14900, currency: 'USD', sku: 'PLAN-GROWTH-MO' }],
      subtotal: 14900, tax: 1192, taxRate: 8, shipping: 0, discount: 2980, discountCode: 'REALESTATE20', total: 13112, currency: 'USD',
      payment: { method: 'card', status: 'pending', transactionId: null },
      billingAddress: { street: '555 Beach Dr', city: 'Tampa', state: 'FL', zip: '33601', country: 'US' },
      notes: 'Awaiting payment confirmation.',
      tags: ['real-estate', 'discount'],
      createdAt: now, updatedAt: now,
    },
  ];
}

// ============================================================================
// 10. TEMPLATES (Email + SMS)
// ============================================================================

function getTemplates(): Array<Record<string, unknown>> {
  return [
    { id: 'demo-template-email-001', isDemo: true, type: 'email', name: '(Demo) Welcome Email', description: 'Sent immediately after signup to welcome new customers', category: 'onboarding', subject: 'Welcome to Acme Digital Solutions, {{firstName}}! 🎉', body: '<h1>Welcome, {{firstName}}!</h1><p>Thanks for joining Acme Digital Solutions. Here is what to do next:</p><ol><li>Complete your business setup</li><li>Import your contacts</li><li>Set up your first workflow</li></ol><p>Questions? Reply to this email or book a call with our team.</p><p>— The Acme Team</p>', bodyType: 'html', variables: ['firstName', 'companyName', 'planName'], tags: ['onboarding', 'welcome'], isActive: true, usageCount: 47, lastUsedAt: daysAgo(1), createdBy: DEMO_OWNER_ID, createdAt: daysAgo(28), updatedAt: daysAgo(5) },
    { id: 'demo-template-email-002', isDemo: true, type: 'email', name: '(Demo) Follow-Up After Demo', description: 'Sent 24 hours after a product demo', category: 'sales', subject: 'Great connecting today, {{firstName}}!', body: '<p>Hi {{firstName}},</p><p>It was great chatting about how Acme can help {{companyName}}. As discussed:</p><ul><li>{{painPoint1}} → Our AI lead scoring solves this</li><li>{{painPoint2}} → Workflow automation handles this</li></ul><p>Here is your personalized trial link: <a href="{{trialLink}}">Start Free Trial</a></p><p>Want to hop on a quick call to answer any remaining questions? <a href="{{bookingLink}}">Book 15 minutes here</a>.</p><p>Best,<br>{{senderName}}</p>', bodyType: 'html', variables: ['firstName', 'companyName', 'painPoint1', 'painPoint2', 'trialLink', 'bookingLink', 'senderName'], tags: ['sales', 'follow-up'], isActive: true, usageCount: 23, lastUsedAt: daysAgo(2), createdBy: DEMO_OWNER_ID, createdAt: daysAgo(20), updatedAt: daysAgo(7) },
    { id: 'demo-template-email-003', isDemo: true, type: 'email', name: '(Demo) Deal Won — Thank You', description: 'Sent when a deal is marked as Closed Won', category: 'post-sale', subject: 'You are officially an Acme customer! 🎉', body: '<h1>Congratulations, {{firstName}}!</h1><p>Your {{planName}} subscription is now active. Here is your onboarding timeline:</p><p><strong>Day 1-2:</strong> Account setup + data migration<br><strong>Day 3-5:</strong> Team training sessions<br><strong>Day 6-7:</strong> Go live with full support</p><p>Your dedicated success manager is {{csmName}} ({{csmEmail}}).</p>', bodyType: 'html', variables: ['firstName', 'planName', 'csmName', 'csmEmail'], tags: ['post-sale', 'onboarding'], isActive: true, usageCount: 8, lastUsedAt: daysAgo(5), createdBy: DEMO_OWNER_ID, createdAt: daysAgo(15), updatedAt: daysAgo(10) },
    { id: 'demo-template-sms-001', isDemo: true, type: 'sms', name: '(Demo) Appointment Reminder', description: 'Sent 1 hour before scheduled demo call', category: 'reminders', body: 'Hi {{firstName}}! Just a reminder — your demo with Acme is in 1 hour at {{time}}. Join here: {{meetingLink}} — Reply HELP for support or STOP to opt out.', variables: ['firstName', 'time', 'meetingLink'], tags: ['reminder', 'demo'], isActive: true, usageCount: 31, lastUsedAt: daysAgo(1), createdBy: DEMO_OWNER_ID, createdAt: daysAgo(20), updatedAt: daysAgo(10) },
    { id: 'demo-template-sms-002', isDemo: true, type: 'sms', name: '(Demo) Quick Follow-Up', description: 'Short text follow-up after no response to email', category: 'sales', body: 'Hey {{firstName}}, Alex from Acme here. Sent you an email about {{topic}} — did you get a chance to look? Happy to jump on a quick call if easier. 📞', variables: ['firstName', 'topic'], tags: ['sales', 'follow-up'], isActive: true, usageCount: 15, lastUsedAt: daysAgo(3), createdBy: DEMO_OWNER_ID, createdAt: daysAgo(18), updatedAt: daysAgo(12) },
  ];
}

// ============================================================================
// 11. LEAD SCORING RULES
// ============================================================================

function getScoringRules(): Record<string, unknown> {
  return {
    id: 'demo-scoring-rules-001',
    isDemo: true,
    name: '(Demo) SaaS B2B Scoring Rules',
    description: 'Optimized for B2B SaaS companies with 10-500 employees. Weights company fit, person seniority, and intent signals.',
    isActive: true,
    companyRules: {
      industries: { preferred: ['saas', 'technology', 'software', 'fintech'], acceptable: ['ecommerce', 'professional-services', 'education'], excluded: ['government', 'nonprofit'], preferredPoints: 15, acceptablePoints: 7 },
      size: { preferred: ['50-200', '200-1000'], preferredPoints: 10, notPreferredPoints: 3 },
      techStack: { required: [], preferred: ['react', 'node', 'python', 'aws', 'stripe', 'hubspot', 'salesforce'], requiredPoints: 10, preferredPoints: 5 },
      growth: { fundingStages: ['Series A', 'Series B', 'Series C', 'Growth'], points: 5 },
    },
    personRules: {
      titles: { preferred: ['VP Sales', 'Director of Sales', 'Head of Revenue', 'CRO', 'VP Marketing', 'CMO'], acceptable: ['Sales Manager', 'Marketing Manager', 'Revenue Operations', 'Sales Lead'], excluded: ['Intern', 'Student', 'Analyst'], preferredPoints: 15, acceptablePoints: 7 },
      seniority: { levels: ['C-Level', 'VP', 'Director', 'Manager', 'Individual'], points: { 'C-Level': 10, 'VP': 8, 'Director': 6, 'Manager': 4, 'Individual': 2 } },
      department: { preferred: ['Sales', 'Marketing', 'Product', 'Operations'], points: 5 },
    },
    intentWeights: { hiring: 5, funding: 8, job_change: 6, tech_stack_match: 4, expansion: 6, press_mention: 3, website_update: 2, high_growth: 7, exec_new: 5, product_launch: 4 },
    engagementRules: { email: { openedPoints: 1, clickedPoints: 2, repliedPoints: 5 }, linkedin: { viewedPoints: 1, connectedPoints: 3, repliedPoints: 5 }, phone: { answeredPoints: 5, voicemailPoints: 2 } },
    createdAt: daysAgo(28),
    updatedAt: daysAgo(7),
    createdBy: DEMO_OWNER_ID,
  };
}

// ============================================================================
// 12. WEBHOOKS
// ============================================================================

function getWebhooks(): Array<Record<string, unknown>> {
  return [
    { id: 'demo-webhook-001', isDemo: true, name: '(Demo) Slack New Deal Notification', url: 'https://hooks.slack.com/services/DEMO/WEBHOOK/URL', events: ['deal.created', 'deal.won', 'deal.lost'], method: 'POST', headers: { 'Content-Type': 'application/json' }, secret: 'whsec_demo_secret_001', isActive: true, retryPolicy: { maxRetries: 3, backoffMultiplier: 2 }, stats: { totalSent: 34, successCount: 32, failureCount: 2, lastSentAt: daysAgo(1), lastStatus: 200 }, createdBy: DEMO_OWNER_ID, createdAt: daysAgo(21), updatedAt: daysAgo(1) },
    { id: 'demo-webhook-002', isDemo: true, name: '(Demo) Zapier Lead Sync', url: 'https://hooks.zapier.com/hooks/catch/DEMO/WEBHOOK/', events: ['lead.created', 'lead.statusChanged', 'lead.scored'], method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': 'demo_zapier_key_001' }, secret: 'whsec_demo_secret_002', isActive: true, retryPolicy: { maxRetries: 5, backoffMultiplier: 3 }, stats: { totalSent: 89, successCount: 87, failureCount: 2, lastSentAt: hoursAgo(3), lastStatus: 200 }, createdBy: DEMO_OWNER_ID, createdAt: daysAgo(18), updatedAt: hoursAgo(3) },
  ];
}

// ============================================================================
// 13. TEAM TASKS
// ============================================================================

function getTeamTasks(): Array<Record<string, unknown>> {
  return [
    { id: 'demo-task-001', isDemo: true, title: '(Demo) Follow up with TechForward Inc. on Enterprise proposal', description: 'Sarah Mitchell requested custom pricing for 50 seats. Prepare and send Enterprise proposal by EOD Friday.', assignedTo: DEMO_OWNER_ID, assignedToName: DEMO_OWNER_NAME, status: 'in_progress', priority: 'high', dueDate: daysFromNow(2), linkedEntityType: 'deal', linkedEntityId: 'demo-deal-004', linkedEntityName: '(Demo) TechForward Enterprise Deal', tags: ['sales', 'enterprise', 'proposal'], createdBy: DEMO_OWNER_ID, createdAt: daysAgo(2), updatedAt: daysAgo(1) },
    { id: 'demo-task-002', isDemo: true, title: '(Demo) Prepare weekly pipeline report for team meeting', description: 'Compile Q1 pipeline metrics, highlight top 5 deals, and note any at-risk opportunities.', assignedTo: DEMO_OWNER_ID, assignedToName: DEMO_OWNER_NAME, status: 'pending', priority: 'medium', dueDate: daysFromNow(4), tags: ['reporting', 'weekly'], createdBy: DEMO_OWNER_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: 'demo-task-003', isDemo: true, title: '(Demo) Onboard Brooks Legal Group — data migration', description: 'Brooks Legal closed their deal. Begin data migration from their spreadsheets. Contact: Michael Brooks, mbrooks@brookslegal.com', assignedTo: DEMO_OWNER_ID, assignedToName: DEMO_OWNER_NAME, status: 'pending', priority: 'high', dueDate: daysFromNow(5), linkedEntityType: 'deal', linkedEntityId: 'demo-deal-006', linkedEntityName: '(Demo) Brooks Legal CRM Migration', tags: ['onboarding', 'migration'], createdBy: DEMO_OWNER_ID, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
    { id: 'demo-task-004', isDemo: true, title: '(Demo) Review and update email sequence templates', description: 'Audit all 3 email templates for accuracy. Update pricing references and add new case study link.', assignedTo: DEMO_OWNER_ID, assignedToName: DEMO_OWNER_NAME, status: 'completed', priority: 'low', dueDate: daysAgo(1), completedAt: daysAgo(1), tags: ['marketing', 'templates'], createdBy: DEMO_OWNER_ID, createdAt: daysAgo(5), updatedAt: daysAgo(1) },
    { id: 'demo-task-005', isDemo: true, title: '(Demo) Schedule demo call with FitLife Wellness', description: 'Tom Bradley from FitLife Wellness wants a 30-minute product demo. Coordinate with calendar and send invite.', assignedTo: DEMO_OWNER_ID, assignedToName: DEMO_OWNER_NAME, status: 'pending', priority: 'medium', dueDate: daysFromNow(3), linkedEntityType: 'contact', linkedEntityId: 'demo-contact-008', linkedEntityName: '(Demo) Tom Bradley', tags: ['sales', 'demo'], createdBy: DEMO_OWNER_ID, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  ];
}

// ============================================================================
// 14. AI CONVERSATIONS
// ============================================================================

function getConversations(): Array<Record<string, unknown>> {
  return [
    {
      id: 'demo-conversation-001', isDemo: true, type: 'public_chat',
      customerName: '(Demo) Sarah Mitchell', customerEmail: 'sarah.mitchell@techforward.io', customerCompany: 'TechForward Inc.',
      agentName: '(Demo) Jasper', agentId: 'demo-agent-001',
      status: 'completed', outcome: 'demo_booked',
      messages: [
        { id: 'msg-001', role: 'assistant', content: 'Hi there! I am Jasper, your AI sales assistant at Acme Digital Solutions. How can I help you today?', timestamp: daysAgo(6) },
        { id: 'msg-002', role: 'user', content: 'Hi! We are looking for a CRM for our sales team of about 50 people. Currently using spreadsheets.', timestamp: daysAgo(6) },
        { id: 'msg-003', role: 'assistant', content: 'Welcome, Sarah! Managing a 50-person sales team with spreadsheets must be challenging. Here is how Acme can help:\n\n• **AI Lead Scoring** — automatically prioritize your best leads\n• **Pipeline Management** — visual Kanban board for all deals\n• **Email Automation** — nurture sequences that run on autopilot\n• **Forms & Landing Pages** — capture leads directly into your CRM\n\nWhat is your biggest pain point right now — lead tracking, follow-ups, or reporting?', timestamp: daysAgo(6) },
        { id: 'msg-004', role: 'user', content: 'Mainly follow-ups. Leads fall through the cracks because nobody knows who is responsible for what.', timestamp: daysAgo(6) },
        { id: 'msg-005', role: 'assistant', content: 'That is a very common problem — and exactly what our workflow automation solves. With Acme:\n\n1. **Auto-assignment** — new leads get routed to the right rep based on rules you set\n2. **Follow-up sequences** — automated email/SMS reminders so nothing slips\n3. **Activity timeline** — everyone sees the full history of every contact\n\nWould you like to see this in action? I can book a 30-minute demo with our team this week.', timestamp: daysAgo(6) },
        { id: 'msg-006', role: 'user', content: 'Yes, that would be great! How about Thursday at 2pm?', timestamp: daysAgo(6) },
        { id: 'msg-007', role: 'assistant', content: 'Perfect! I have booked your demo for Thursday at 2:00 PM ET. You will receive a calendar invite at sarah.mitchell@techforward.io shortly.\n\nIn the meantime, you can explore our free trial: https://demo-acme.salesvelocity.ai/signup\n\nAnything else I can help with?', timestamp: daysAgo(6) },
        { id: 'msg-008', role: 'user', content: 'No that is perfect, thank you Jasper!', timestamp: daysAgo(6) },
        { id: 'msg-009', role: 'assistant', content: 'You are welcome, Sarah! Looking forward to showing you how Acme can transform your sales process. Have a great day! 😊', timestamp: daysAgo(6) },
      ],
      messageCount: 9, duration: 480, satisfaction: 5,
      metadata: { source: 'website_chat', page: '/pricing', device: 'desktop', browser: 'Chrome', country: 'US' },
      linkedLeadId: 'demo-lead-001', linkedContactId: 'demo-contact-001',
      createdAt: daysAgo(6), updatedAt: daysAgo(6),
    },
    {
      id: 'demo-conversation-002', isDemo: true, type: 'public_chat',
      customerName: '(Demo) Anonymous Visitor', customerEmail: null, customerCompany: null,
      agentName: '(Demo) Jasper', agentId: 'demo-agent-001',
      status: 'completed', outcome: 'information_provided',
      messages: [
        { id: 'msg-101', role: 'assistant', content: 'Hi there! I am Jasper, your AI sales assistant at Acme Digital Solutions. How can I help you today?', timestamp: daysAgo(2) },
        { id: 'msg-102', role: 'user', content: 'How much does this cost?', timestamp: daysAgo(2) },
        { id: 'msg-103', role: 'assistant', content: 'Great question! Here are our plans:\n\n• **Starter** — $99/month (up to 1,000 contacts)\n• **Growth** — $149/month (up to 10,000 contacts + AI scoring)\n• **Enterprise** — $399/month (unlimited + AI Sales Agent + dedicated CSM)\n\nAll plans include a **14-day free trial** and a **30-day money-back guarantee**.\n\nAnnual billing saves 20%. Which plan sounds closest to what you need?', timestamp: daysAgo(2) },
        { id: 'msg-104', role: 'user', content: 'ok thanks', timestamp: daysAgo(2) },
        { id: 'msg-105', role: 'assistant', content: 'You are welcome! If you have any more questions, feel free to come back anytime. You can also start a free trial at https://demo-acme.salesvelocity.ai/signup — no credit card required. Have a great day!', timestamp: daysAgo(2) },
      ],
      messageCount: 5, duration: 120, satisfaction: null,
      metadata: { source: 'website_chat', page: '/pricing', device: 'mobile', browser: 'Safari', country: 'US' },
      createdAt: daysAgo(2), updatedAt: daysAgo(2),
    },
  ];
}

// ============================================================================
// 15. INTEGRATIONS
// ============================================================================

function getIntegrations(): Array<Record<string, unknown>> {
  return [
    { id: 'demo-integration-001', isDemo: true, type: 'google-calendar', name: '(Demo) Google Calendar', status: 'active', connectedAt: daysAgo(25), lastSyncAt: hoursAgo(1), settings: { autoCreateEvents: true, defaultReminder: 15, syncCalendars: ['primary', 'sales-demos'], twoWaySync: true, reminderSettings: { defaultReminderMinutes: 15 } }, accountEmail: 'alex.morgan@demo-acme.com', capabilities: ['create_events', 'read_events', 'sync'], createdBy: DEMO_OWNER_ID, createdAt: daysAgo(25), updatedAt: hoursAgo(1) },
    { id: 'demo-integration-002', isDemo: true, type: 'slack', name: '(Demo) Slack — #sales channel', status: 'active', connectedAt: daysAgo(21), lastSyncAt: hoursAgo(3), settings: { channelId: '#sales', notifyOnNewLead: true, notifyOnDealWon: true, notifyOnDealLost: true, dailyDigest: true, digestTime: '09:00' }, teamName: 'Acme Digital', capabilities: ['send_messages', 'create_channels', 'read_messages'], createdBy: DEMO_OWNER_ID, createdAt: daysAgo(21), updatedAt: hoursAgo(3) },
    { id: 'demo-integration-003', isDemo: true, type: 'stripe', name: '(Demo) Stripe Payments', status: 'active', connectedAt: daysAgo(20), lastSyncAt: daysAgo(1), settings: { testMode: true, webhookEndpoint: 'https://demo-acme.salesvelocity.ai/api/webhooks/stripe', autoCreateInvoice: true, autoRecordPayment: true, currency: 'USD' }, accountId: 'acct_demo_stripe_001', capabilities: ['charge', 'refund', 'subscription', 'invoice'], createdBy: DEMO_OWNER_ID, createdAt: daysAgo(20), updatedAt: daysAgo(1) },
  ];
}

// ============================================================================
// 16. CUSTOM TOOLS
// ============================================================================

function getCustomTools(): Array<Record<string, unknown>> {
  return [
    { id: 'demo-tool-001', isDemo: true, name: '(Demo) Company Research Tool', description: 'Look up company information from Crunchbase and LinkedIn using our discovery engine.', url: 'https://demo-acme.salesvelocity.ai/api/tools/company-research', icon: '🔍', method: 'POST', headers: { 'Content-Type': 'application/json' }, inputSchema: { type: 'object', properties: { companyName: { type: 'string' }, domain: { type: 'string' } }, required: ['companyName'] }, roles: ['owner', 'admin', 'manager'], enabled: true, displayOrder: 1, usageCount: 67, lastUsedAt: daysAgo(1), createdBy: DEMO_OWNER_ID, createdAt: daysAgo(20), updatedAt: daysAgo(5) },
    { id: 'demo-tool-002', isDemo: true, name: '(Demo) ROI Calculator', description: 'Calculate potential ROI for prospects based on their current tool stack and team size.', url: 'https://demo-acme.salesvelocity.ai/api/tools/roi-calculator', icon: '💰', method: 'POST', headers: { 'Content-Type': 'application/json' }, inputSchema: { type: 'object', properties: { teamSize: { type: 'number' }, currentTools: { type: 'array', items: { type: 'string' } }, avgDealSize: { type: 'number' } }, required: ['teamSize'] }, roles: ['owner', 'admin', 'manager', 'member'], enabled: true, displayOrder: 2, usageCount: 34, lastUsedAt: daysAgo(2), createdBy: DEMO_OWNER_ID, createdAt: daysAgo(15), updatedAt: daysAgo(8) },
  ];
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seedDemoAccountPart2(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('  (DEMO) ACCOUNT SEED — PART 2: FULL PLATFORM COVERAGE');
  console.log('  SalesVelocity.ai - Beyond CRM');
  console.log('='.repeat(70));
  console.log(`  Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`  Org root: "${orgRoot}"`);
  console.log('');

  if (process.env.NODE_ENV === 'production') {
    console.error('  SAFETY: Cannot run demo seed in production environment.');
    process.exit(1);
  }

  console.log('  Initializing Firebase Admin...');
  const db = initFirebase();
  console.log('  Firebase Admin initialized.\n');

  let totalDocs = 0;

  // 1. Onboarding Data
  console.log('  [1/16] Seeding onboarding data (complete 25-step business setup)...');
  await db.doc(`${onboardingPath}/current`).set(getOnboardingData());
  totalDocs += 1;
  console.log('    Onboarding data created.');

  // 2. AI Agent Persona
  console.log('  [2/16] Seeding AI agent persona...');
  await db.doc(`${personaPath}/persona`).set(getAgentPersona());
  totalDocs += 1;
  console.log('    Agent persona created.');

  // 3. Workflows
  console.log('  [3/16] Seeding 3 workflows (with triggers, actions, stats)...');
  const workflows = getWorkflows();
  for (const wf of workflows) {
    await db.doc(`${workflowsPath}/${wf.id}`).set(wf);
  }
  totalDocs += workflows.length;
  console.log(`    ${workflows.length} workflows created.`);

  // 4. Forms + Fields + Submissions
  console.log('  [4/16] Seeding 2 forms (with fields + submissions)...');
  const forms = getForms();
  for (const { form, fields, submissions } of forms) {
    await db.doc(`${formsPath}/${form.id}`).set(form);
    totalDocs += 1;
    for (const field of fields) {
      await db.doc(`${formsPath}/${form.id}/fields/${field.id}`).set(field);
      totalDocs += 1;
    }
    for (const sub of submissions) {
      await db.doc(`${formsPath}/${form.id}/submissions/${sub.id}`).set(sub);
      totalDocs += 1;
    }
  }
  console.log(`    2 forms + ${forms.reduce((a, f) => a + f.fields.length, 0)} fields + ${forms.reduce((a, f) => a + f.submissions.length, 0)} submissions created.`);

  // 5. Website Pages
  console.log('  [5/16] Seeding 3 website pages (home, about, pricing)...');
  const pages = getWebsitePages();
  for (const page of pages) {
    await db.doc(`${pagesPath}/${page.id}`).set(page);
  }
  totalDocs += pages.length;
  console.log(`    ${pages.length} pages created.`);

  // 6. Blog Posts
  console.log('  [6/16] Seeding 3 blog posts (published + draft)...');
  const posts = getBlogPosts();
  for (const post of posts) {
    await db.doc(`${blogPostsPath}/${post.id}`).set(post);
  }
  totalDocs += posts.length;
  console.log(`    ${posts.length} blog posts created.`);

  // 7. Site Config + Theme + Navigation
  console.log('  [7/16] Seeding site config, theme, and navigation...');
  await db.doc(`${siteConfigPath}/demo-site-config`).set(getSiteConfig());
  await db.doc(`${themesPath}/demo-theme`).set(getSiteTheme());
  await db.doc(`${navigationPath}/demo-navigation`).set(getNavigation());
  totalDocs += 3;
  console.log('    Site config + theme + navigation created.');

  // 8. Social Media Posts
  console.log('  [8/16] Seeding 8 social media posts (twitter + linkedin)...');
  const socialPosts = getSocialPosts();
  for (const post of socialPosts) {
    await db.doc(`${socialPostsPath}/${post.id}`).set(post);
  }
  totalDocs += socialPosts.length;
  console.log(`    ${socialPosts.length} social posts created.`);

  // 9. Orders
  console.log('  [9/16] Seeding 4 orders (various statuses)...');
  const orders = getOrders();
  for (const order of orders) {
    await db.doc(`${ordersPath}/${order.id}`).set(order);
  }
  totalDocs += orders.length;
  console.log(`    ${orders.length} orders created.`);

  // 10. Templates
  console.log('  [10/16] Seeding 3 email + 2 SMS templates...');
  const templates = getTemplates();
  for (const tpl of templates) {
    await db.doc(`${globalTemplatesPath}/${tpl.id}`).set(tpl);
  }
  totalDocs += templates.length;
  console.log(`    ${templates.length} templates created.`);

  // 11. Lead Scoring Rules
  console.log('  [11/16] Seeding lead scoring rules...');
  const rules = getScoringRules();
  await db.doc(`${scoringRulesPath}/${rules.id}`).set(rules);
  totalDocs += 1;
  console.log('    Scoring rules created.');

  // 12. Webhooks
  console.log('  [12/16] Seeding 2 webhooks...');
  const webhooks = getWebhooks();
  for (const wh of webhooks) {
    await db.doc(`${webhooksPath}/${wh.id}`).set(wh);
  }
  totalDocs += webhooks.length;
  console.log(`    ${webhooks.length} webhooks created.`);

  // 13. Team Tasks
  console.log('  [13/16] Seeding 5 team tasks...');
  const tasks = getTeamTasks();
  for (const task of tasks) {
    await db.doc(`${teamTasksPath}/${task.id}`).set(task);
  }
  totalDocs += tasks.length;
  console.log(`    ${tasks.length} tasks created.`);

  // 14. AI Conversations
  console.log('  [14/16] Seeding 2 AI conversations (with message history)...');
  const conversations = getConversations();
  for (const conv of conversations) {
    await db.doc(`${conversationsPath}/${conv.id}`).set(conv);
  }
  totalDocs += conversations.length;
  console.log(`    ${conversations.length} conversations created.`);

  // 15. Integrations
  console.log('  [15/16] Seeding 3 integrations (Google Calendar, Slack, Stripe)...');
  const integrations = getIntegrations();
  for (const int of integrations) {
    await db.doc(`${integrationsPath}/${int.id}`).set(int);
  }
  totalDocs += integrations.length;
  console.log(`    ${integrations.length} integrations created.`);

  // 16. Custom Tools
  console.log('  [16/16] Seeding 2 custom tools...');
  const tools = getCustomTools();
  for (const tool of tools) {
    await db.doc(`${customToolsPath}/${tool.id}`).set(tool);
  }
  totalDocs += tools.length;
  console.log(`    ${tools.length} custom tools created.`);

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('  (DEMO) ACCOUNT SEED — PART 2 COMPLETE!');
  console.log('='.repeat(70));
  console.log(`  Total documents created: ${totalDocs}`);
  console.log('');
  console.log('  DATA SUMMARY:');
  console.log('    Onboarding:     1  doc  (complete 25-step business setup)');
  console.log('    AI Persona:     1  doc  (full agent configuration)');
  console.log('    Workflows:      3  docs (entity + schedule + form triggers)');
  console.log('    Forms:          2  + 11 fields + 3 submissions');
  console.log('    Website Pages:  3  docs (home, about, pricing)');
  console.log('    Blog Posts:     3  docs (2 published + 1 draft)');
  console.log('    Site Config:    3  docs (config + theme + navigation)');
  console.log('    Social Posts:   8  docs (3 published + 2 scheduled + 2 draft + 1 queued)');
  console.log('    Orders:         4  docs (delivered + shipped + processing + pending)');
  console.log('    Templates:      5  docs (3 email + 2 SMS)');
  console.log('    Scoring Rules:  1  doc  (full B2B SaaS configuration)');
  console.log('    Webhooks:       2  docs (Slack + Zapier)');
  console.log('    Team Tasks:     5  docs (1 in progress + 3 pending + 1 completed)');
  console.log('    Conversations:  2  docs (with full message history)');
  console.log('    Integrations:   3  docs (Google Calendar + Slack + Stripe)');
  console.log('    Custom Tools:   2  docs (Company Research + ROI Calculator)');
  console.log('');
  console.log('  ⚠️  FEATURES WITHOUT DASHBOARD DELETE UI:');
  console.log('    - Onboarding Data (settings doc — overwrite or delete via Firebase Console)');
  console.log('    - AI Agent Persona (config doc — overwrite or delete via Firebase Console)');
  console.log('    - Lead Scoring Rules (config — no list-delete UI)');
  console.log('    - Site Config / Theme / Navigation (settings docs — overwrite only)');
  console.log('    - Analytics aggregations (read-only)');
  console.log('    → To remove ALL demo data: delete docs with IDs starting with "demo-"');
  console.log('    → Config docs: manually delete from Firebase Console or re-run onboarding');
  console.log('');
  console.log('  COMBINED TOTAL (Part 1 + Part 2):');
  console.log('    Part 1 (CRM):      96 documents');
  console.log(`    Part 2 (Platform): ${totalDocs} documents`);
  console.log(`    GRAND TOTAL:       ${96 + totalDocs} documents`);
  console.log('');
  console.log('  All data tagged with "(Demo)" for easy identification.');
  console.log('='.repeat(70) + '\n');
}

// ============================================================================
// RUN
// ============================================================================

seedDemoAccountPart2()
  .then(() => {
    console.log('  Seed complete. Exiting.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('  SEED FAILED:', error);
    process.exit(1);
  });
