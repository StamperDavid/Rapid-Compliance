/**
 * (Demo) Account Seed Script — PART 3: Remaining Platform Collections
 *
 * Fills in 32 collections that were not covered by Part 1 (CRM) or Part 2 (Platform).
 * Run AFTER seed-demo-account.ts (Part 1) and seed-demo-account-part2.ts (Part 2).
 *
 * DEMO DATA MANIFEST (Part 3 — 32 collections, ~103 docs):
 * ┌──────────────────────────┬──────┬───────────────────────────────────────┐
 * │ Collection               │ Docs │ Key Fields Populated                  │
 * ├──────────────────────────┼──────┼───────────────────────────────────────┤
 * │ records                  │  25  │ entityType, name, status, value       │
 * │ members                  │   3  │ userId, role, metrics, department     │
 * │ companies                │   6  │ name, industry, website, employees    │
 * │ conversationAnalyses     │   8  │ scores, sentiment, topics, summary    │
 * │ schemas                  │   8  │ name, pluralName, icon, fields[]      │
 * │ chatSessions             │   3  │ customerName, status, messages subColl│
 * │ sequences                │   2  │ name, steps[], settings, analytics    │
 * │ sequenceEnrollments      │   4  │ prospectId, sequenceId, currentStep   │
 * │ tasks                    │   5  │ title, assignee, status, priority     │
 * │ users (TOP-LEVEL)        │   3  │ email, displayName, role, status      │
 * │ workflowExecutions       │   6  │ workflowId, status, actionResults     │
 * │ proposalTemplates        │   2  │ name, sections[], variables[]         │
 * │ formSubmissions          │   3  │ formId, data, submittedAt             │
 * │ missions                 │   2  │ title, status, steps[]                │
 * │ leadRoutingRules         │   2  │ name, conditions[], actions[]         │
 * │ smsTemplates             │   2  │ name, body, variables                 │
 * │ emailTemplates           │   3  │ name, subject, htmlBody               │
 * │ storefrontConfig         │   1  │ layout, pages, seo, categories        │
 * │ notifications            │   5  │ title, channel, status, priority      │
 * │ notification_preferences │   1  │ channels{}, categories{}              │
 * │ merchant_coupons         │   2  │ code, discountType, value             │
 * │ carts                    │   2  │ items[], total, customerId            │
 * │ blogCategories           │   3  │ name, slug, description               │
 * │ bookings                 │   3  │ title, startTime, attendees           │
 * │ toolTraining             │   2  │ toolId, examples[], status            │
 * │ voiceKnowledge           │   2  │ topic, content, category              │
 * │ socialKnowledge          │   2  │ platform, content, rules              │
 * │ socialCorrections        │   3  │ original, corrected, reason           │
 * │ seoResearch              │   2  │ keyword, competitors[], metrics       │
 * │ playbooks                │   1  │ name, platformRules{}, corrections[]  │
 * │ auditLogs                │   5  │ action, userId, resource, timestamp   │
 * │ reports                  │   2  │ name, type, config, schedule          │
 * └──────────────────────────┴──────┴───────────────────────────────────────┘
 *
 * CLEANUP COVERAGE (all 3 parts):
 *   Part 1: contacts, leads, deals, activities, products, emailCampaigns,
 *           nurtureSequences, analytics
 *   Part 2: onboarding, agent, workflows, forms (+ fields + submissions),
 *           pages, blogPosts, siteConfig, themes, navigation, socialPosts,
 *           orders, globalTemplates, scoringRules, webhooks, teamTasks,
 *           conversations, integrations, customTools
 *   Part 3: records, members, companies, conversationAnalyses, schemas,
 *           chatSessions (+ messages), sequences, sequenceEnrollments,
 *           tasks, users (TOP-LEVEL), workflowExecutions, proposalTemplates,
 *           formSubmissions, missions, leadRoutingRules, smsTemplates,
 *           emailTemplates, storefrontConfig, notifications,
 *           notification_preferences, merchant_coupons, carts,
 *           blogCategories, bookings, toolTraining, voiceKnowledge,
 *           socialKnowledge, socialCorrections, seoResearch, playbooks,
 *           auditLogs, reports
 *
 * Usage: npx tsx scripts/seed-demo-account-part3.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION (must match Part 1 & Part 2)
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
const DEMO_OWNER_ID = 'demo-owner-001';
const DEMO_OWNER_NAME = '(Demo) Alex Morgan';
const DEMO_OWNER_EMAIL = 'alex.morgan@salesvelocity.ai';

const orgRoot = `organizations/${PLATFORM_ID}`;

const MEMBER_2 = { id: 'demo-member-002', name: '(Demo) Sarah Chen', email: 'sarah.chen@salesvelocity.ai' };
const MEMBER_3 = { id: 'demo-member-003', name: '(Demo) Marcus Rivera', email: 'marcus.rivera@salesvelocity.ai' };

const TEAM = [
  { id: DEMO_OWNER_ID, name: DEMO_OWNER_NAME, email: DEMO_OWNER_EMAIL },
  MEMBER_2,
  MEMBER_3,
];

// ============================================================================
// INITIALIZE FIREBASE ADMIN
// ============================================================================

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) return admin.firestore();
  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
    console.log('  Using serviceAccountKey.json');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    const parsed = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    admin.initializeApp({ credential: admin.credential.cert(parsed) });
    console.log('  Using FIREBASE_SERVICE_ACCOUNT_KEY env var');
  } else {
    throw new Error('No Firebase credentials found.');
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

const now = () => admin.firestore.Timestamp.now();

/** Cycle through an array by index */
function cycle<T>(arr: T[], idx: number): T {
  return arr[idx % arr.length];
}

// ============================================================================
// BATCH WRITE HELPER
// ============================================================================

interface SeedDoc {
  id: string;
  [k: string]: unknown;
}

async function seedCollection(
  db: admin.firestore.Firestore,
  collectionPath: string,
  docs: SeedDoc[],
  label: string,
): Promise<number> {
  const batchSize = 450;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + batchSize);
    for (const doc of chunk) {
      const { id, ...data } = doc;
      batch.set(db.doc(`${collectionPath}/${id}`), data);
    }
    await batch.commit();
  }
  console.log(`    ✓ ${label}: ${docs.length} docs → ${collectionPath}`);
  return docs.length;
}

// ============================================================================
// [1/32] RECORDS (25 docs)
// ============================================================================

function getRecords(): SeedDoc[] {
  const owners = [DEMO_OWNER_ID, MEMBER_2.id, MEMBER_3.id];

  const leadNames = [
    'Acme Corp', 'TechStart Inc', 'Global Dynamics', 'Pinnacle Solutions',
    'Vertex Labs', 'Summit Group', 'Catalyst Partners', 'Nexus Digital',
    'Horizon Media', 'Atlas Ventures', 'Quantum Systems', 'Forge Industries',
  ];
  const leadStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];

  const leads: SeedDoc[] = leadNames.map((name, i) => ({
    id: `demo-lead-${String(i + 1).padStart(3, '0')}`,
    entityType: 'leads',
    name: `(Demo) ${name}`,
    status: cycle(leadStatuses, i),
    sourceEntityId: `demo-lead-${String(i + 1).padStart(3, '0')}`,
    ownerId: cycle(owners, i),
    value: 0,
    isDemo: true,
    createdAt: daysAgo(30 - i * 2),
    updatedAt: daysAgo(Math.max(0, 15 - i)),
  }));

  const dealNames = [
    'Enterprise Plan - Acme', 'Pro Plan - TechStart', 'Custom - Global Dynamics',
    'Starter - Pinnacle', 'Enterprise - Vertex', 'Pro - Summit',
    'Custom - Catalyst', 'Starter - Nexus',
  ];
  const dealValues = [45000, 24000, 78000, 12000, 56000, 0, 34000, 18000];
  const dealStages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

  const deals: SeedDoc[] = dealNames.map((name, i) => ({
    id: `demo-deal-${String(i + 1).padStart(3, '0')}`,
    entityType: 'deals',
    name: `(Demo) ${name}`,
    status: cycle(dealStages, i),
    value: dealValues[i],
    sourceEntityId: `demo-deal-${String(i + 1).padStart(3, '0')}`,
    ownerId: cycle(owners, i),
    isDemo: true,
    createdAt: daysAgo(25 - i * 3),
    updatedAt: daysAgo(Math.max(0, 10 - i)),
  }));

  const taskNames = [
    'Follow up with Acme', 'Prepare Vertex demo', 'Send Summit proposal',
    'Review Catalyst contract', 'Schedule Nexus call',
  ];
  const taskPriorities = ['high', 'medium', 'low'];

  const tasks: SeedDoc[] = taskNames.map((name, i) => ({
    id: `demo-task-${String(i + 1).padStart(3, '0')}`,
    entityType: 'tasks',
    name: `(Demo) ${name}`,
    status: cycle(['pending', 'in_progress', 'completed'], i),
    completed: i === 2,
    priority: cycle(taskPriorities, i),
    sourceEntityId: `demo-task-${String(i + 1).padStart(3, '0')}`,
    ownerId: cycle(owners, i),
    value: 0,
    isDemo: true,
    createdAt: daysAgo(10 - i),
    updatedAt: daysAgo(Math.max(0, 5 - i)),
  }));

  return [...leads, ...deals, ...tasks];
}

// ============================================================================
// [2/32] MEMBERS (3 docs)
// ============================================================================

function getMembers(): SeedDoc[] {
  return [
    {
      id: DEMO_OWNER_ID,
      userId: DEMO_OWNER_ID,
      displayName: DEMO_OWNER_NAME,
      email: DEMO_OWNER_EMAIL,
      role: 'owner',
      title: 'CEO & Founder',
      department: 'Executive',
      status: 'active',
      joinedAt: daysAgo(365),
      lastActiveAt: hoursAgo(1),
      metrics: {
        dealsClosed: 12, revenueGenerated: 234000, leadsCreated: 45,
        activitiesLogged: 189, winRate: 0.68, callsMade: 67,
        emailsSent: 234, meetingsHeld: 28, points: 1450,
      },
      isDemo: true,
    },
    {
      id: MEMBER_2.id,
      userId: MEMBER_2.id,
      displayName: MEMBER_2.name,
      email: MEMBER_2.email,
      role: 'admin',
      title: 'VP of Sales',
      department: 'Sales',
      status: 'active',
      joinedAt: daysAgo(300),
      lastActiveAt: hoursAgo(3),
      metrics: {
        dealsClosed: 18, revenueGenerated: 312000, leadsCreated: 62,
        activitiesLogged: 245, winRate: 0.74, callsMade: 95,
        emailsSent: 310, meetingsHeld: 42, points: 1820,
      },
      isDemo: true,
    },
    {
      id: MEMBER_3.id,
      userId: MEMBER_3.id,
      displayName: MEMBER_3.name,
      email: MEMBER_3.email,
      role: 'user',
      title: 'Sales Development Rep',
      department: 'Sales',
      status: 'active',
      joinedAt: daysAgo(180),
      lastActiveAt: hoursAgo(6),
      metrics: {
        dealsClosed: 6, revenueGenerated: 87000, leadsCreated: 38,
        activitiesLogged: 156, winRate: 0.55, callsMade: 120,
        emailsSent: 198, meetingsHeld: 15, points: 980,
      },
      isDemo: true,
    },
  ];
}

// ============================================================================
// [3/32] COMPANIES (6 docs)
// ============================================================================

function getCompanies(): SeedDoc[] {
  const companies = [
    {
      name: 'Acme Corp', industry: 'Technology', website: 'https://acme-corp.com',
      phone: '+1-555-100-2000', email: 'info@acme-corp.com', employees: 250,
      annualRevenue: 45000000, city: 'San Francisco', state: 'CA', zip: '94105',
      street: '100 Market St', tags: ['enterprise', 'tech'],
      description: '(Demo) Enterprise technology solutions provider.',
    },
    {
      name: 'TechStart Inc', industry: 'SaaS', website: 'https://techstart.io',
      phone: '+1-555-200-3000', email: 'hello@techstart.io', employees: 50,
      annualRevenue: 8000000, city: 'Austin', state: 'TX', zip: '73301',
      street: '200 Congress Ave', tags: ['startup', 'saas'],
      description: '(Demo) Fast-growing SaaS startup.',
    },
    {
      name: 'Global Dynamics', industry: 'Manufacturing', website: 'https://globaldynamics.com',
      phone: '+1-555-300-4000', email: 'sales@globaldynamics.com', employees: 1200,
      annualRevenue: 320000000, city: 'Detroit', state: 'MI', zip: '48201',
      street: '300 Industrial Blvd', tags: ['manufacturing', 'enterprise'],
      description: '(Demo) Global manufacturing and engineering firm.',
    },
    {
      name: 'Pinnacle Solutions', industry: 'Consulting', website: 'https://pinnaclesolutions.com',
      phone: '+1-555-400-5000', email: 'contact@pinnaclesolutions.com', employees: 85,
      annualRevenue: 12000000, city: 'Boston', state: 'MA', zip: '02108',
      street: '400 Boylston St', tags: ['consulting', 'mid-market'],
      description: '(Demo) Business strategy and management consulting.',
    },
    {
      name: 'Vertex Labs', industry: 'Healthcare', website: 'https://vertexlabs.com',
      phone: '+1-555-500-6000', email: 'info@vertexlabs.com', employees: 320,
      annualRevenue: 95000000, city: 'San Diego', state: 'CA', zip: '92101',
      street: '500 Harbor Dr', tags: ['healthcare', 'biotech'],
      description: '(Demo) Healthcare technology and biotech research.',
    },
    {
      name: 'Summit Group', industry: 'Finance', website: 'https://summitgroup.com',
      phone: '+1-555-600-7000', email: 'inquiries@summitgroup.com', employees: 500,
      annualRevenue: 180000000, city: 'New York', state: 'NY', zip: '10005',
      street: '600 Wall St', tags: ['finance', 'enterprise'],
      description: '(Demo) Financial services and investment management.',
    },
  ];

  return companies.map((c, i) => ({
    id: `demo-company-${String(i + 1).padStart(3, '0')}`,
    name: `(Demo) ${c.name}`,
    industry: c.industry,
    website: c.website,
    phone: c.phone,
    email: c.email,
    address: { street: c.street, city: c.city, state: c.state, zip: c.zip, country: 'US' },
    employees: c.employees,
    annualRevenue: c.annualRevenue,
    status: 'active',
    ownerId: cycle([DEMO_OWNER_ID, MEMBER_2.id, MEMBER_3.id], i),
    linkedContacts: [`demo-contact-${String(i + 1).padStart(3, '0')}`],
    linkedDeals: [`demo-deal-${String(i + 1).padStart(3, '0')}`],
    tags: c.tags,
    description: c.description,
    isDemo: true,
    createdAt: daysAgo(60 - i * 5),
    updatedAt: daysAgo(i * 2),
  }));
}

// ============================================================================
// [4/32] CONVERSATION ANALYSES (8 docs)
// ============================================================================

interface AnalysisOverrides {
  overallScore: number;
  engagementScore: number;
  discoveryScore: number;
  presentationScore: number;
  objectionScore: number;
  closingScore: number;
  rapportScore: number;
  valueScore: number;
  sentimentScore: number;
  sentimentLabel: 'positive' | 'neutral' | 'mixed' | 'negative';
  sentimentTrend: 'improving' | 'stable' | 'declining';
  repPercentage: number;
  topicsMissed: string[];
  redFlags: Array<{ flag: string; severity: 'high' | 'medium' | 'low'; context: string }>;
  summaryText: string;
  daysBack: number;
}

function makeAnalysis(idx: number, conversationId: string, repId: string, ov: AnalysisOverrides): SeedDoc {
  const repName = TEAM.find(t => t.id === repId)?.name ?? '(Demo) Unknown';
  return {
    id: `demo-conv-analysis-${String(idx).padStart(3, '0')}`,
    conversationId,
    repId,
    repName,
    sentiment: {
      overall: { score: ov.sentimentScore, label: ov.sentimentLabel, confidence: 70 + idx * 3 },
      byParticipant: [{ participantId: repId, averageScore: ov.sentimentScore + 0.05, label: ov.sentimentLabel }],
      trend: ov.sentimentTrend,
    },
    talkRatio: {
      repPercentage: ov.repPercentage,
      prospectPercentage: 100 - ov.repPercentage,
      idealRange: { min: 30, max: 50 },
      feedback: ov.repPercentage > 50
        ? 'Rep talked more than recommended. Try asking more open-ended questions.'
        : 'Good balance. Rep allowed the prospect to share their needs.',
    },
    topics: {
      discussed: ['pricing', 'features', 'implementation'].slice(0, 2 + (idx % 2)),
      missed: ov.topicsMissed,
      unexpected: idx % 3 === 0 ? ['competitor mention'] : [],
    },
    objections: [
      {
        type: cycle(['price', 'timing', 'competition'] as const, idx),
        text: `(Demo) Objection raised during conversation ${idx}`,
        handling: cycle(['addressed', 'deflected', 'missed'] as const, idx),
        outcome: cycle(['resolved', 'unresolved'] as const, idx),
        recommendation: '(Demo) Follow up with a tailored ROI analysis.',
      },
    ],
    competitors: idx % 2 === 0 ? [{
      name: '(Demo) CompetitorCo',
      context: 'Prospect mentioned they are evaluating alternatives.',
      sentiment: cycle(['positive', 'negative', 'neutral'] as const, idx),
      response: 'Highlighted our AI-native advantage and faster implementation.',
    }] : [],
    keyMoments: [
      {
        timestamp: 120 + idx * 30,
        type: cycle(['objection', 'interest', 'commitment'] as const, idx),
        description: `(Demo) Key moment at ${120 + idx * 30}s in conversation.`,
        impact: cycle(['high', 'medium', 'low'] as const, idx),
      },
    ],
    coachingInsights: [
      {
        category: cycle(['discovery', 'closing', 'rapport_building'] as const, idx),
        observation: `(Demo) Rep ${idx % 2 === 0 ? 'effectively used open-ended questions' : 'could improve discovery depth'}.`,
        recommendation: '(Demo) Practice the SPIN selling framework for deeper discovery.',
        priority: cycle(['high', 'medium', 'low'] as const, idx),
        examples: ['(Demo) "What challenges are you facing with your current solution?"'],
      },
    ],
    followUpActions: [
      {
        action: `(Demo) Send follow-up email to prospect from conversation ${idx}`,
        priority: cycle(['high', 'medium'] as const, idx),
        deadline: '2026-03-15',
        assignedTo: repId,
        context: '(Demo) Prospect requested additional pricing details.',
      },
    ],
    scores: {
      overall: ov.overallScore,
      engagement: ov.engagementScore,
      discovery: ov.discoveryScore,
      presentation: ov.presentationScore,
      objectionHandling: ov.objectionScore,
      closing: ov.closingScore,
      rapport: ov.rapportScore,
      valueArticulation: ov.valueScore,
    },
    qualityIndicators: [
      { indicator: 'Active Listening', score: ov.rapportScore, weight: 0.2 },
      { indicator: 'Value Proposition Clarity', score: ov.valueScore, weight: 0.25 },
      { indicator: 'Objection Resolution', score: ov.objectionScore, weight: 0.2 },
      { indicator: 'Closing Technique', score: ov.closingScore, weight: 0.35 },
    ],
    redFlags: ov.redFlags,
    positiveSignals: ov.overallScore >= 70 ? [
      { signal: '(Demo) Prospect asked about implementation timeline', strength: 'strong' as const, context: 'Buying signal detected.' },
      { signal: '(Demo) Prospect mentioned budget availability', strength: 'moderate' as const, context: 'Budget confirmed for Q1.' },
    ] : [
      { signal: '(Demo) Prospect showed mild interest in demo', strength: 'moderate' as const, context: 'Engagement was limited.' },
    ],
    summary: ov.summaryText,
    highlights: [`(Demo) Score: ${ov.overallScore}/100`, `(Demo) Sentiment: ${ov.sentimentLabel}`],
    confidence: 0.85 + idx * 0.01,
    analyzedAt: daysAgo(ov.daysBack),
    analysisVersion: '1.0',
    aiModel: 'gpt-4',
    tokensUsed: 2000 + idx * 250,
    processingTime: 3000 + idx * 600,
    isDemo: true,
    createdAt: daysAgo(ov.daysBack),
    updatedAt: daysAgo(ov.daysBack),
  };
}

function getConversationAnalyses(): SeedDoc[] {
  const repIds = [DEMO_OWNER_ID, MEMBER_2.id, MEMBER_3.id];
  const configs: Array<{ convId: string; repIdx: number; ov: AnalysisOverrides }> = [
    // 2 excellent (85+)
    {
      convId: 'demo-conv-001', repIdx: 1,
      ov: {
        overallScore: 92, engagementScore: 95, discoveryScore: 90, presentationScore: 88,
        objectionScore: 85, closingScore: 90, rapportScore: 95, valueScore: 88,
        sentimentScore: 0.9, sentimentLabel: 'positive', sentimentTrend: 'improving',
        repPercentage: 42, topicsMissed: [], redFlags: [],
        summaryText: '(Demo) Excellent discovery call. Strong rapport and value articulation led to a commitment for next steps.',
        daysBack: 2,
      },
    },
    {
      convId: 'demo-conv-002', repIdx: 0,
      ov: {
        overallScore: 87, engagementScore: 90, discoveryScore: 85, presentationScore: 86,
        objectionScore: 82, closingScore: 88, rapportScore: 92, valueScore: 85,
        sentimentScore: 0.85, sentimentLabel: 'positive', sentimentTrend: 'stable',
        repPercentage: 45, topicsMissed: ['timeline'], redFlags: [],
        summaryText: '(Demo) Strong demo presentation. Prospect engaged well. Minor miss on timeline discussion.',
        daysBack: 5,
      },
    },
    // 3 good (70-84)
    {
      convId: 'demo-conv-analysis-003', repIdx: 2,
      ov: {
        overallScore: 78, engagementScore: 80, discoveryScore: 75, presentationScore: 76,
        objectionScore: 72, closingScore: 74, rapportScore: 82, valueScore: 77,
        sentimentScore: 0.72, sentimentLabel: 'positive', sentimentTrend: 'improving',
        repPercentage: 48, topicsMissed: ['budget'], redFlags: [],
        summaryText: '(Demo) Good call with solid discovery. Budget discussion was skipped.',
        daysBack: 8,
      },
    },
    {
      convId: 'demo-conv-analysis-004', repIdx: 0,
      ov: {
        overallScore: 74, engagementScore: 78, discoveryScore: 70, presentationScore: 72,
        objectionScore: 68, closingScore: 70, rapportScore: 80, valueScore: 73,
        sentimentScore: 0.68, sentimentLabel: 'neutral', sentimentTrend: 'stable',
        repPercentage: 52, topicsMissed: ['budget', 'timeline'], redFlags: [],
        summaryText: '(Demo) Adequate demo. Talk ratio slightly high. Missed budget and timeline topics.',
        daysBack: 12,
      },
    },
    {
      convId: 'demo-conv-analysis-005', repIdx: 1,
      ov: {
        overallScore: 82, engagementScore: 85, discoveryScore: 80, presentationScore: 82,
        objectionScore: 78, closingScore: 80, rapportScore: 88, valueScore: 80,
        sentimentScore: 0.78, sentimentLabel: 'positive', sentimentTrend: 'stable',
        repPercentage: 44, topicsMissed: [], redFlags: [],
        summaryText: '(Demo) Well-structured call. All key topics covered. Good close attempt.',
        daysBack: 15,
      },
    },
    // 2 average (55-69)
    {
      convId: 'demo-conv-analysis-006', repIdx: 2,
      ov: {
        overallScore: 62, engagementScore: 65, discoveryScore: 58, presentationScore: 60,
        objectionScore: 55, closingScore: 58, rapportScore: 68, valueScore: 60,
        sentimentScore: 0.58, sentimentLabel: 'mixed', sentimentTrend: 'declining',
        repPercentage: 60, topicsMissed: ['budget', 'timeline', 'authority'],
        redFlags: [{ flag: '(Demo) Excessive talk ratio', severity: 'medium' as const, context: 'Rep dominated 60% of conversation.' }],
        summaryText: '(Demo) Below average performance. Rep talked too much and missed key qualification topics.',
        daysBack: 18,
      },
    },
    {
      convId: 'demo-conv-analysis-007', repIdx: 0,
      ov: {
        overallScore: 58, engagementScore: 62, discoveryScore: 55, presentationScore: 56,
        objectionScore: 50, closingScore: 52, rapportScore: 65, valueScore: 55,
        sentimentScore: 0.55, sentimentLabel: 'mixed', sentimentTrend: 'declining',
        repPercentage: 58, topicsMissed: ['budget', 'competition'],
        redFlags: [{ flag: '(Demo) Weak objection handling', severity: 'medium' as const, context: 'Price objection was deflected without resolution.' }],
        summaryText: '(Demo) Mixed results. Objection handling needs improvement. Discovery was surface-level.',
        daysBack: 22,
      },
    },
    // 1 needs-improvement (40-54)
    {
      convId: 'demo-conv-analysis-008', repIdx: 2,
      ov: {
        overallScore: 45, engagementScore: 50, discoveryScore: 40, presentationScore: 48,
        objectionScore: 38, closingScore: 42, rapportScore: 55, valueScore: 44,
        sentimentScore: 0.45, sentimentLabel: 'negative', sentimentTrend: 'declining',
        repPercentage: 65, topicsMissed: ['budget', 'timeline', 'authority', 'need'],
        redFlags: [
          { flag: '(Demo) No discovery questions asked', severity: 'high' as const, context: 'Rep jumped straight to product pitch.' },
          { flag: '(Demo) Prospect disengaged early', severity: 'high' as const, context: 'Single-word responses after minute 5.' },
        ],
        summaryText: '(Demo) Poor performance. No discovery, excessive talking, prospect disengaged. Coaching required.',
        daysBack: 28,
      },
    },
  ];

  return configs.map((c, i) => makeAnalysis(i + 1, c.convId, repIds[c.repIdx], c.ov));
}

// ============================================================================
// [5/32] SCHEMAS (8 docs)
// ============================================================================

interface SchemaField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  order: number;
  config: Record<string, unknown>;
}

function makeField(
  idx: number, key: string, label: string, type: string, required: boolean,
  config: Record<string, unknown> = {},
): SchemaField {
  return { id: `field-${key}`, key, label, type, required, order: idx, config };
}

function selectConfig(options: string[]): Record<string, unknown> {
  return { options: options.map(o => ({ label: o, value: o.toLowerCase().replace(/\s+/g, '_') })) };
}

function getSchemas(): SeedDoc[] {
  const schemas: Array<{ idSuffix: string; name: string; plural: string; slug: string; icon: string; color: string; fields: SchemaField[] }> = [
    {
      idSuffix: 'contacts', name: 'Contact', plural: 'Contacts', slug: 'contacts', icon: 'Users', color: '#3B82F6',
      fields: [
        makeField(1, 'firstName', 'First Name', 'text', true),
        makeField(2, 'lastName', 'Last Name', 'text', true),
        makeField(3, 'email', 'Email', 'email', true),
        makeField(4, 'phone', 'Phone', 'phoneNumber', false),
        makeField(5, 'company', 'Company', 'text', false),
        makeField(6, 'title', 'Title', 'text', false),
        makeField(7, 'source', 'Source', 'singleSelect', false, selectConfig(['Website', 'Referral', 'LinkedIn', 'Cold Outreach'])),
        makeField(8, 'status', 'Status', 'singleSelect', false, selectConfig(['Active', 'Inactive', 'Prospect'])),
        makeField(9, 'tags', 'Tags', 'multiSelect', false, selectConfig(['VIP', 'Partner', 'Influencer', 'Churned'])),
        makeField(10, 'lastContactedAt', 'Last Contacted', 'dateTime', false),
      ],
    },
    {
      idSuffix: 'leads', name: 'Lead', plural: 'Leads', slug: 'leads', icon: 'Target', color: '#10B981',
      fields: [
        makeField(1, 'name', 'Name', 'text', true),
        makeField(2, 'email', 'Email', 'email', true),
        makeField(3, 'company', 'Company', 'text', false),
        makeField(4, 'status', 'Status', 'singleSelect', false, selectConfig(['New', 'Contacted', 'Qualified', 'Converted', 'Lost'])),
        makeField(5, 'source', 'Source', 'singleSelect', false, selectConfig(['Website', 'Referral', 'LinkedIn', 'Ads', 'Cold Outreach'])),
        makeField(6, 'score', 'Score', 'number', false),
        makeField(7, 'assignedTo', 'Assigned To', 'text', false),
        makeField(8, 'value', 'Value', 'currency', false),
      ],
    },
    {
      idSuffix: 'deals', name: 'Deal', plural: 'Deals', slug: 'deals', icon: 'DollarSign', color: '#F59E0B',
      fields: [
        makeField(1, 'name', 'Name', 'text', true),
        makeField(2, 'value', 'Value', 'currency', true),
        makeField(3, 'stage', 'Stage', 'singleSelect', false, selectConfig(['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'])),
        makeField(4, 'probability', 'Probability', 'number', false),
        makeField(5, 'company', 'Company', 'text', false),
        makeField(6, 'contact', 'Contact', 'text', false),
        makeField(7, 'closeDate', 'Close Date', 'date', false),
        makeField(8, 'ownerId', 'Owner', 'text', false),
      ],
    },
    {
      idSuffix: 'companies', name: 'Company', plural: 'Companies', slug: 'companies', icon: 'Building', color: '#8B5CF6',
      fields: [
        makeField(1, 'name', 'Name', 'text', true),
        makeField(2, 'industry', 'Industry', 'singleSelect', false, selectConfig(['Technology', 'SaaS', 'Manufacturing', 'Consulting', 'Healthcare', 'Finance'])),
        makeField(3, 'website', 'Website', 'url', false),
        makeField(4, 'phone', 'Phone', 'phoneNumber', false),
        makeField(5, 'employees', 'Employees', 'number', false),
        makeField(6, 'annualRevenue', 'Annual Revenue', 'currency', false),
        makeField(7, 'status', 'Status', 'singleSelect', false, selectConfig(['Active', 'Prospect', 'Churned'])),
      ],
    },
    {
      idSuffix: 'tasks', name: 'Task', plural: 'Tasks', slug: 'tasks', icon: 'CheckSquare', color: '#EF4444',
      fields: [
        makeField(1, 'title', 'Title', 'text', true),
        makeField(2, 'description', 'Description', 'longText', false),
        makeField(3, 'status', 'Status', 'singleSelect', false, selectConfig(['Pending', 'In Progress', 'Completed', 'Cancelled'])),
        makeField(4, 'priority', 'Priority', 'singleSelect', false, selectConfig(['Low', 'Medium', 'High', 'Urgent'])),
        makeField(5, 'assignedTo', 'Assigned To', 'text', false),
        makeField(6, 'dueDate', 'Due Date', 'date', false),
      ],
    },
    {
      idSuffix: 'products', name: 'Product', plural: 'Products', slug: 'products', icon: 'Package', color: '#06B6D4',
      fields: [
        makeField(1, 'name', 'Name', 'text', true),
        makeField(2, 'sku', 'SKU', 'text', false),
        makeField(3, 'price', 'Price', 'currency', true),
        makeField(4, 'category', 'Category', 'singleSelect', false, selectConfig(['Software', 'Hardware', 'Service', 'Subscription'])),
        makeField(5, 'stock', 'Stock', 'number', false),
        makeField(6, 'status', 'Status', 'singleSelect', false, selectConfig(['Active', 'Draft', 'Archived'])),
      ],
    },
    {
      idSuffix: 'orders', name: 'Order', plural: 'Orders', slug: 'orders', icon: 'ShoppingCart', color: '#F97316',
      fields: [
        makeField(1, 'orderNumber', 'Order Number', 'autoNumber', false),
        makeField(2, 'customer', 'Customer', 'text', true),
        makeField(3, 'total', 'Total', 'currency', false),
        makeField(4, 'status', 'Status', 'singleSelect', false, selectConfig(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'])),
        makeField(5, 'items', 'Items', 'number', false),
        makeField(6, 'shippingAddress', 'Shipping Address', 'text', false),
      ],
    },
    {
      idSuffix: 'activities', name: 'Activity', plural: 'Activities', slug: 'activities', icon: 'Activity', color: '#EC4899',
      fields: [
        makeField(1, 'type', 'Type', 'singleSelect', false, selectConfig(['Call', 'Email', 'Meeting', 'Note', 'Task'])),
        makeField(2, 'subject', 'Subject', 'text', true),
        makeField(3, 'description', 'Description', 'longText', false),
        makeField(4, 'relatedTo', 'Related To', 'text', false),
        makeField(5, 'direction', 'Direction', 'singleSelect', false, selectConfig(['Inbound', 'Outbound', 'Internal'])),
        makeField(6, 'duration', 'Duration (min)', 'number', false),
      ],
    },
  ];

  return schemas.map(s => ({
    id: `demo-schema-${s.idSuffix}`,
    name: s.name,
    pluralName: s.plural,
    slug: s.slug,
    icon: s.icon,
    color: s.color,
    fields: s.fields,
    isSystem: false,
    isStandard: true,
    version: 1,
    createdBy: DEMO_OWNER_ID,
    isDemo: true,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(5),
  }));
}

// ============================================================================
// [6/32] CHAT SESSIONS (3 docs + messages subcollection)
// ============================================================================

interface ChatSession extends SeedDoc {
  messages: Array<{ id: string; role: string; content: string; timestamp: admin.firestore.Timestamp; isDemo: boolean }>;
}

function getChatSessions(): ChatSession[] {
  return [
    {
      id: 'demo-chat-session-001',
      customerName: '(Demo) Enterprise Inquiry - Acme',
      customerEmail: 'john@acme-corp.com',
      customerId: 'demo-contact-001',
      startedAt: hoursAgo(48),
      completedAt: hoursAgo(47),
      status: 'completed',
      lastMessage: 'Thank you for the detailed overview! I will share this with my team.',
      messageCount: 4,
      sentiment: 'positive',
      flaggedForTraining: false,
      trainingIssue: null,
      agentId: 'jasper',
      isDemo: true,
      messages: [
        { id: 'demo-msg-001-01', role: 'user', content: 'Hi, we are evaluating CRM platforms for our 250-person team. Can you walk me through your enterprise offering?', timestamp: hoursAgo(48), isDemo: true },
        { id: 'demo-msg-001-02', role: 'assistant', content: 'Welcome! I\'d be happy to help. Our Enterprise plan includes unlimited users, advanced AI lead scoring, custom workflows, and dedicated support. For a team of 250, we typically recommend starting with our Enterprise Bundle at $399/mo per seat with volume discounts. What specific features are most important to your team?', timestamp: hoursAgo(48), isDemo: true },
        { id: 'demo-msg-001-03', role: 'user', content: 'AI lead scoring and workflow automation are our top priorities. We also need Salesforce migration support.', timestamp: hoursAgo(47), isDemo: true },
        { id: 'demo-msg-001-04', role: 'assistant', content: 'Great news — we offer free migration assistance from Salesforce, including full data mapping and parallel running for 30 days. Our AI scoring engine analyzes 50+ signals per lead, and our workflow builder supports complex multi-step automations with branching logic. I can schedule a personalized demo for your team. Would next Tuesday work?', timestamp: hoursAgo(47), isDemo: true },
      ],
    },
    {
      id: 'demo-chat-session-002',
      customerName: '(Demo) Pricing Question - TechStart',
      customerEmail: 'lisa@techstart.io',
      customerId: 'demo-contact-002',
      startedAt: hoursAgo(6),
      completedAt: null,
      status: 'active',
      lastMessage: 'What\'s included in the Pro plan vs the Starter?',
      messageCount: 3,
      sentiment: 'neutral',
      flaggedForTraining: false,
      trainingIssue: null,
      agentId: 'jasper',
      isDemo: true,
      messages: [
        { id: 'demo-msg-002-01', role: 'user', content: 'Hey, quick question about pricing. Do you offer monthly billing?', timestamp: hoursAgo(6), isDemo: true },
        { id: 'demo-msg-002-02', role: 'assistant', content: 'Hi! Yes, we offer both monthly and annual billing. Annual plans come with a 20% discount. Our plans start at $99/mo for Starter, $149/mo for Pro, and $249/mo for the AI Sales Agent tier. Which features are you most interested in?', timestamp: hoursAgo(6), isDemo: true },
        { id: 'demo-msg-002-03', role: 'user', content: 'What\'s included in the Pro plan vs the Starter?', timestamp: hoursAgo(5), isDemo: true },
      ],
    },
    {
      id: 'demo-chat-session-003',
      customerName: '(Demo) Support Request - Vertex',
      customerEmail: 'mike@vertexlabs.com',
      customerId: 'demo-contact-005',
      startedAt: hoursAgo(3),
      completedAt: null,
      status: 'needs_help',
      lastMessage: 'I really need this fixed today. We have a board meeting tomorrow.',
      messageCount: 5,
      sentiment: 'negative',
      flaggedForTraining: true,
      trainingIssue: 'Escalation needed — frustrated customer with urgent timeline',
      agentId: 'jasper',
      isDemo: true,
      messages: [
        { id: 'demo-msg-003-01', role: 'user', content: 'Our dashboard reports are showing incorrect pipeline numbers since yesterday. This is urgent.', timestamp: hoursAgo(3), isDemo: true },
        { id: 'demo-msg-003-02', role: 'assistant', content: 'I\'m sorry to hear about the reporting issue. Let me look into this right away. Can you tell me which specific reports are affected — is it the pipeline overview or the revenue forecasting dashboard?', timestamp: hoursAgo(3), isDemo: true },
        { id: 'demo-msg-003-03', role: 'user', content: 'Both! The pipeline total shows $0 and the forecast is completely blank. We were using it fine on Monday.', timestamp: hoursAgo(2), isDemo: true },
        { id: 'demo-msg-003-04', role: 'assistant', content: 'I can see there was a data sync issue that started Tuesday morning. Our engineering team has identified the root cause and a fix is being deployed. In the meantime, I can generate a manual pipeline export for you. Would that help for your immediate needs?', timestamp: hoursAgo(2), isDemo: true },
        { id: 'demo-msg-003-05', role: 'user', content: 'I really need this fixed today. We have a board meeting tomorrow.', timestamp: hoursAgo(1), isDemo: true },
      ],
    },
  ];
}

// ============================================================================
// [7/32] SEQUENCES (2 docs)
// ============================================================================

function getSequences(): SeedDoc[] {
  const sharedSettings = {
    sendWindow: { start: '09:00', end: '17:00', timezone: 'America/New_York' },
    excludeWeekends: true,
    dailyLimit: 50,
    stopOnReply: true,
    stopOnBounce: true,
  };

  return [
    {
      id: 'demo-sequence-001',
      name: '(Demo) Enterprise Outreach Sequence',
      description: '5-step sequence targeting enterprise decision-makers with personalized outreach.',
      status: 'active',
      steps: [
        { id: 'step-1', type: 'email', subject: '(Demo) Quick question about {{company}}', body: 'Hi {{firstName}}, I noticed {{company}} is scaling rapidly...', order: 1 },
        { id: 'step-2', type: 'wait', waitDays: 2, order: 2 },
        { id: 'step-3', type: 'email', subject: '(Demo) {{company}} + SalesVelocity — quick ROI breakdown', body: 'Hi {{firstName}}, following up on my previous note...', order: 3 },
        { id: 'step-4', type: 'wait', waitDays: 3, order: 4 },
        { id: 'step-5', type: 'call', subject: '(Demo) Discovery call with {{firstName}}', body: 'Call script: Introduce value prop, ask about current CRM...', order: 5 },
      ],
      settings: sharedSettings,
      analytics: { enrolled: 24, completed: 8, replied: 6, bounced: 1, optedOut: 2 },
      createdBy: MEMBER_2.id,
      tags: ['enterprise', 'outbound'],
      isDemo: true,
      createdAt: daysAgo(45),
      updatedAt: daysAgo(2),
    },
    {
      id: 'demo-sequence-002',
      name: '(Demo) Re-engagement Campaign',
      description: '3-step re-engagement sequence for cold leads that went dark.',
      status: 'paused',
      steps: [
        { id: 'step-1', type: 'email', subject: '(Demo) We miss you, {{firstName}}!', body: 'Hi {{firstName}}, it has been a while since we connected...', order: 1 },
        { id: 'step-2', type: 'wait', waitDays: 5, order: 2 },
        { id: 'step-3', type: 'email', subject: '(Demo) Last chance: exclusive offer for {{company}}', body: 'Hi {{firstName}}, I wanted to share a limited-time offer...', order: 3 },
      ],
      settings: sharedSettings,
      analytics: { enrolled: 15, completed: 3, replied: 2, bounced: 0, optedOut: 1 },
      createdBy: DEMO_OWNER_ID,
      tags: ['re-engagement', 'nurture'],
      isDemo: true,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(7),
    },
  ];
}

// ============================================================================
// [8/32] SEQUENCE ENROLLMENTS (4 docs)
// ============================================================================

function getSequenceEnrollments(): SeedDoc[] {
  const enrollments = [
    { idx: 1, prospectId: 'demo-lead-001', email: 'j.smith@acme-corp.com', name: '(Demo) John Smith', seqId: 'demo-sequence-001', seqName: '(Demo) Enterprise Outreach Sequence', status: 'active', currentStep: 3, totalSteps: 5, daysBack: 10 },
    { idx: 2, prospectId: 'demo-lead-003', email: 'r.lee@globaldynamics.com', name: '(Demo) Rachel Lee', seqId: 'demo-sequence-001', seqName: '(Demo) Enterprise Outreach Sequence', status: 'completed', currentStep: 5, totalSteps: 5, daysBack: 20 },
    { idx: 3, prospectId: 'demo-lead-005', email: 'p.jones@vertexlabs.com', name: '(Demo) Peter Jones', seqId: 'demo-sequence-002', seqName: '(Demo) Re-engagement Campaign', status: 'active', currentStep: 1, totalSteps: 3, daysBack: 3 },
    { idx: 4, prospectId: 'demo-lead-008', email: 't.wilson@nexusdigital.com', name: '(Demo) Tina Wilson', seqId: 'demo-sequence-002', seqName: '(Demo) Re-engagement Campaign', status: 'paused', currentStep: 2, totalSteps: 3, daysBack: 12 },
  ];

  return enrollments.map(e => ({
    id: `demo-enrollment-${String(e.idx).padStart(3, '0')}`,
    prospectId: e.prospectId,
    prospectEmail: e.email,
    prospectName: e.name,
    sequenceId: e.seqId,
    sequenceName: e.seqName,
    status: e.status,
    currentStep: e.currentStep,
    totalSteps: e.totalSteps,
    nextStepAt: e.status === 'active' ? daysFromNow(2) : null,
    startedAt: daysAgo(e.daysBack),
    completedAt: e.status === 'completed' ? daysAgo(e.daysBack - 15) : null,
    lastStepAt: daysAgo(Math.max(1, e.daysBack - e.currentStep)),
    isDemo: true,
    createdAt: daysAgo(e.daysBack),
    updatedAt: daysAgo(1),
  }));
}

// ============================================================================
// [9/32] TASKS (5 docs)
// ============================================================================

function getTasks(): SeedDoc[] {
  const taskDefs = [
    { title: '(Demo) Follow up with Acme Corp on enterprise pricing', desc: 'Send revised pricing proposal based on 250-seat volume discount.', status: 'pending', priority: 'high', assignee: DEMO_OWNER_ID, assigneeName: DEMO_OWNER_NAME, due: 2, entity: 'deal', entityId: 'demo-deal-001', tags: ['follow-up', 'enterprise'] },
    { title: '(Demo) Prepare Vertex Labs demo environment', desc: 'Set up sandbox with healthcare data and HIPAA compliance features.', status: 'in_progress', priority: 'high', assignee: MEMBER_2.id, assigneeName: MEMBER_2.name, due: 1, entity: 'lead', entityId: 'demo-lead-005', tags: ['demo', 'healthcare'] },
    { title: '(Demo) Send Summit Group proposal', desc: 'Draft and send the financial services proposal template.', status: 'pending', priority: 'medium', assignee: MEMBER_3.id, assigneeName: MEMBER_3.name, due: 3, entity: 'deal', entityId: 'demo-deal-006', tags: ['proposal', 'finance'] },
    { title: '(Demo) Review Catalyst Partners contract', desc: 'Legal review of the custom enterprise agreement terms.', status: 'completed', priority: 'medium', assignee: DEMO_OWNER_ID, assigneeName: DEMO_OWNER_NAME, due: -2, entity: 'deal', entityId: 'demo-deal-007', tags: ['contract', 'legal'] },
    { title: '(Demo) Schedule Nexus Digital discovery call', desc: 'Book 30-minute discovery call to qualify the lead.', status: 'pending', priority: 'low', assignee: MEMBER_3.id, assigneeName: MEMBER_3.name, due: 5, entity: 'lead', entityId: 'demo-lead-008', tags: ['discovery', 'call'] },
  ];

  return taskDefs.map((t, i) => ({
    id: `demo-task-${String(i + 1).padStart(3, '0')}`,
    title: t.title,
    description: t.desc,
    status: t.status,
    priority: t.priority,
    assignedTo: t.assignee,
    assignedToName: t.assigneeName,
    dueDate: t.due >= 0 ? daysFromNow(t.due) : daysAgo(Math.abs(t.due)),
    completedAt: t.status === 'completed' ? daysAgo(1) : null,
    relatedEntityType: t.entity,
    relatedEntityId: t.entityId,
    tags: t.tags,
    isDemo: true,
    createdAt: daysAgo(7 + i),
    updatedAt: daysAgo(i),
  }));
}

// ============================================================================
// [10/32] USERS (3 docs — TOP-LEVEL collection)
// ============================================================================

function getUsers(): SeedDoc[] {
  const userDefs = [
    { member: TEAM[0], role: 'owner', title: 'CEO & Founder', department: 'Executive', photo: 'https://ui-avatars.com/api/?name=Alex+Morgan&background=3B82F6&color=fff' },
    { member: TEAM[1], role: 'admin', title: 'VP of Sales', department: 'Sales', photo: 'https://ui-avatars.com/api/?name=Sarah+Chen&background=10B981&color=fff' },
    { member: TEAM[2], role: 'member', title: 'Sales Development Rep', department: 'Sales', photo: 'https://ui-avatars.com/api/?name=Marcus+Rivera&background=F59E0B&color=fff' },
  ];

  return userDefs.map(u => ({
    id: u.member.id,
    email: u.member.email,
    displayName: u.member.name,
    role: u.role,
    title: u.title,
    department: u.department,
    status: 'active',
    photoURL: u.photo,
    lastLoginAt: hoursAgo(Math.floor(Math.random() * 24)),
    customPermissions: {},
    isDemo: true,
    createdAt: daysAgo(365),
    updatedAt: hoursAgo(1),
  }));
}

// ============================================================================
// [11/32] WORKFLOW EXECUTIONS (6 docs)
// ============================================================================

function getWorkflowExecutions(): SeedDoc[] {
  const execDefs = [
    { wfId: 'demo-workflow-001', wfName: '(Demo) New Lead Assignment', status: 'completed', trigger: 'entity_created', daysBack: 3, error: null, results: [{ action: 'assign_owner', status: 'success', output: 'Assigned to Sarah Chen' }, { action: 'send_notification', status: 'success', output: 'Slack notification sent' }] },
    { wfId: 'demo-workflow-001', wfName: '(Demo) New Lead Assignment', status: 'completed', trigger: 'entity_created', daysBack: 5, error: null, results: [{ action: 'assign_owner', status: 'success', output: 'Assigned to Marcus Rivera' }, { action: 'send_notification', status: 'success', output: 'Email notification sent' }] },
    { wfId: 'demo-workflow-002', wfName: '(Demo) Daily Pipeline Report', status: 'in_progress', trigger: 'schedule', daysBack: 0, error: null, results: [{ action: 'generate_report', status: 'running', output: 'Generating pipeline summary...' }] },
    { wfId: 'demo-workflow-002', wfName: '(Demo) Daily Pipeline Report', status: 'in_progress', trigger: 'schedule', daysBack: 1, error: null, results: [{ action: 'generate_report', status: 'running', output: 'Aggregating deal data...' }] },
    { wfId: 'demo-workflow-003', wfName: '(Demo) Form Submission Handler', status: 'failed', trigger: 'form_submitted', daysBack: 2, error: '(Demo) Timeout: External API did not respond within 30s', results: [{ action: 'enrich_lead', status: 'failed', output: 'API timeout after 30000ms' }] },
    { wfId: 'demo-workflow-003', wfName: '(Demo) Form Submission Handler', status: 'pending', trigger: 'form_submitted', daysBack: 0, error: null, results: [] },
  ];

  return execDefs.map((e, i) => ({
    id: `demo-wf-exec-${String(i + 1).padStart(3, '0')}`,
    workflowId: e.wfId,
    workflowName: e.wfName,
    status: e.status,
    startedAt: daysAgo(e.daysBack),
    completedAt: e.status === 'completed' ? daysAgo(e.daysBack) : null,
    error: e.error,
    triggerType: e.trigger,
    triggerData: { source: '(Demo) Automated trigger', entityId: `demo-lead-${String(i + 1).padStart(3, '0')}` },
    actionResults: e.results,
    isDemo: true,
    createdAt: daysAgo(e.daysBack),
    updatedAt: daysAgo(Math.max(0, e.daysBack - 1)),
  }));
}

// ============================================================================
// [12/32] PROPOSAL TEMPLATES (2 docs)
// ============================================================================

function getProposalTemplates(): SeedDoc[] {
  return [
    {
      id: 'demo-proposal-tpl-001',
      name: '(Demo) SaaS Enterprise Proposal',
      description: 'Full enterprise proposal template with cover page, executive summary, detailed pricing, terms, and signature block.',
      type: 'enterprise',
      status: 'active',
      sections: [
        { id: 'sec-cover', type: 'cover', title: 'Cover Page', order: 1, content: { heading: '{{companyName}} — Enterprise Proposal', subheading: 'Prepared by {{repName}} | {{date}}', logo: true } },
        { id: 'sec-exec', type: 'executive_summary', title: 'Executive Summary', order: 2, content: { body: '(Demo) This proposal outlines how SalesVelocity.ai will accelerate {{companyName}}\'s sales pipeline through AI-powered automation, lead scoring, and unified CRM capabilities.' } },
        { id: 'sec-pricing', type: 'pricing_table', title: 'Pricing', order: 3, content: { columns: ['Item', 'Qty', 'Unit Price', 'Total'], rows: [], showDiscount: true, showTax: true } },
        { id: 'sec-terms', type: 'terms', title: 'Terms & Conditions', order: 4, content: { body: '(Demo) Standard enterprise terms. 12-month commitment. 99.9% uptime SLA. SOC 2 Type II compliant.' } },
        { id: 'sec-sig', type: 'signature', title: 'Signature', order: 5, content: { signatories: ['Client Representative', 'SalesVelocity.ai Representative'] } },
      ],
      variables: [
        { key: 'companyName', label: 'Company Name', type: 'text', required: true },
        { key: 'repName', label: 'Sales Rep Name', type: 'text', required: true },
        { key: 'date', label: 'Proposal Date', type: 'date', required: true },
        { key: 'discount', label: 'Discount %', type: 'number', required: false },
      ],
      styling: { primaryColor: '#3B82F6', fontFamily: 'Inter', headerSize: 24, bodySize: 14 },
      isDemo: true,
      createdBy: DEMO_OWNER_ID,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(5),
    },
    {
      id: 'demo-proposal-tpl-002',
      name: '(Demo) Quick Quote Template',
      description: 'Lightweight quote template for fast turnaround on smaller deals.',
      type: 'quote',
      status: 'active',
      sections: [
        { id: 'sec-header', type: 'header', title: 'Quote Header', order: 1, content: { heading: 'Quote for {{companyName}}', reference: 'QT-{{quoteNumber}}' } },
        { id: 'sec-pricing', type: 'pricing_table', title: 'Pricing', order: 2, content: { columns: ['Item', 'Qty', 'Price'], rows: [], showDiscount: false, showTax: true } },
        { id: 'sec-terms', type: 'terms', title: 'Terms', order: 3, content: { body: '(Demo) Quote valid for 30 days. Monthly billing. Cancel anytime.' } },
      ],
      variables: [
        { key: 'companyName', label: 'Company Name', type: 'text', required: true },
        { key: 'quoteNumber', label: 'Quote Number', type: 'text', required: true },
      ],
      styling: { primaryColor: '#10B981', fontFamily: 'Inter', headerSize: 20, bodySize: 13 },
      isDemo: true,
      createdBy: MEMBER_2.id,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(10),
    },
  ];
}

// ============================================================================
// [13/32] FORM SUBMISSIONS (3 docs)
// ============================================================================

function getFormSubmissions(): SeedDoc[] {
  return [
    {
      id: 'demo-form-sub-001',
      formId: 'demo-form-001',
      formName: '(Demo) Contact Us Form',
      data: {
        firstName: '(Demo) Emily',
        lastName: '(Demo) Zhang',
        email: 'emily.zhang@techstart.io',
        company: '(Demo) TechStart Inc',
        message: 'Interested in learning more about your AI lead scoring feature.',
      },
      submittedAt: daysAgo(3),
      sourceUrl: 'https://demo-acme.salesvelocity.ai/contact',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      isDemo: true,
      createdAt: daysAgo(3),
    },
    {
      id: 'demo-form-sub-002',
      formId: 'demo-form-001',
      formName: '(Demo) Contact Us Form',
      data: {
        firstName: '(Demo) David',
        lastName: '(Demo) Kim',
        email: 'david.kim@summitgroup.com',
        company: '(Demo) Summit Group',
        message: 'We need a demo for our finance team. 50 users.',
      },
      submittedAt: daysAgo(5),
      sourceUrl: 'https://demo-acme.salesvelocity.ai/contact',
      ipAddress: '10.0.0.55',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      isDemo: true,
      createdAt: daysAgo(5),
    },
    {
      id: 'demo-form-sub-003',
      formId: 'demo-form-002',
      formName: '(Demo) Customer Satisfaction Survey',
      data: {
        rating: 4,
        satisfaction: 'satisfied',
        npsScore: 8,
        feedback: '(Demo) Great platform overall. Would love better reporting customization.',
        wouldRecommend: true,
      },
      submittedAt: daysAgo(1),
      sourceUrl: 'https://demo-acme.salesvelocity.ai/survey',
      ipAddress: '172.16.0.22',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
      isDemo: true,
      createdAt: daysAgo(1),
    },
  ];
}

// ============================================================================
// [14/32] MISSIONS (2 docs)
// ============================================================================

function getMissions(): SeedDoc[] {
  return [
    {
      id: 'demo-mission-001',
      missionId: 'demo-mission-001',
      title: '(Demo) Competitive Analysis Report',
      description: 'Generate a comprehensive competitive analysis comparing SalesVelocity.ai against top CRM competitors.',
      status: 'IN_PROGRESS',
      steps: [
        { id: 'step-1', title: '(Demo) Identify top 5 competitors', status: 'COMPLETED', order: 1, output: 'HubSpot, Salesforce, Pipedrive, Close.com, Apollo.io', completedAt: daysAgo(2) },
        { id: 'step-2', title: '(Demo) Analyze feature parity', status: 'RUNNING', order: 2, output: null, completedAt: null },
        { id: 'step-3', title: '(Demo) Generate comparison report', status: 'PENDING', order: 3, output: null, completedAt: null },
      ],
      createdAt: daysAgo(3),
      updatedAt: hoursAgo(6),
      createdBy: DEMO_OWNER_ID,
      approvalId: null,
      isDemo: true,
    },
    {
      id: 'demo-mission-002',
      missionId: 'demo-mission-002',
      title: '(Demo) Q1 Pipeline Cleanup',
      description: 'Review and clean up stale deals from Q1 pipeline. Update stages, close dead deals, and reassign active ones.',
      status: 'COMPLETED',
      steps: [
        { id: 'step-1', title: '(Demo) Identify stale deals (>30 days no activity)', status: 'COMPLETED', order: 1, output: '12 stale deals identified', completedAt: daysAgo(8) },
        { id: 'step-2', title: '(Demo) Close dead deals and update reasons', status: 'COMPLETED', order: 2, output: '7 deals closed as lost', completedAt: daysAgo(7) },
        { id: 'step-3', title: '(Demo) Reassign active deals to current reps', status: 'COMPLETED', order: 3, output: '5 deals reassigned', completedAt: daysAgo(6) },
        { id: 'step-4', title: '(Demo) Generate cleanup summary report', status: 'COMPLETED', order: 4, output: 'Report saved to shared drive', completedAt: daysAgo(5) },
      ],
      createdAt: daysAgo(10),
      updatedAt: daysAgo(5),
      createdBy: MEMBER_2.id,
      approvalId: 'demo-approval-001',
      isDemo: true,
    },
  ];
}

// ============================================================================
// [15/32] LEAD ROUTING RULES (2 docs)
// ============================================================================

function getLeadRoutingRules(): SeedDoc[] {
  return [
    {
      id: 'demo-routing-rule-001',
      name: '(Demo) Enterprise Lead Routing',
      description: 'Route high-value enterprise leads (>$50k) directly to Sarah Chen for immediate follow-up.',
      isActive: true,
      priority: 1,
      conditions: [
        { field: 'value', operator: 'greater_than', value: 50000 },
        { field: 'source', operator: 'equals', value: 'enterprise_inbound' },
      ],
      actions: [
        { type: 'assign_owner', targetUserId: MEMBER_2.id, targetUserName: MEMBER_2.name },
        { type: 'send_notification', channel: 'slack', message: 'New enterprise lead assigned: {{leadName}} (${{value}})' },
        { type: 'add_tag', tag: 'enterprise-priority' },
      ],
      createdBy: DEMO_OWNER_ID,
      isDemo: true,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(5),
    },
    {
      id: 'demo-routing-rule-002',
      name: '(Demo) Inbound Lead Assignment',
      description: 'Round-robin assignment for all inbound leads across the sales team.',
      isActive: true,
      priority: 2,
      conditions: [
        { field: 'source', operator: 'in', value: ['website', 'referral', 'linkedin', 'ads'] },
      ],
      actions: [
        { type: 'round_robin', targetUserIds: [DEMO_OWNER_ID, MEMBER_2.id, MEMBER_3.id] },
        { type: 'send_notification', channel: 'email', message: 'New inbound lead assigned to you: {{leadName}}' },
      ],
      createdBy: DEMO_OWNER_ID,
      isDemo: true,
      createdAt: daysAgo(45),
      updatedAt: daysAgo(10),
    },
  ];
}

// ============================================================================
// [16/32] SMS TEMPLATES (2 docs)
// ============================================================================

function getSmsTemplates(): SeedDoc[] {
  return [
    {
      id: 'demo-sms-tpl-001',
      name: '(Demo) Appointment Reminder',
      body: 'Hi {{firstName}}, this is a reminder about your appointment with {{repName}} at {{time}} tomorrow. Reply CONFIRM to confirm or RESCHEDULE to pick a new time. - SalesVelocity.ai',
      variables: ['firstName', 'repName', 'time'],
      status: 'active',
      category: 'reminders',
      characterCount: 189,
      isDemo: true,
      createdBy: DEMO_OWNER_ID,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(5),
    },
    {
      id: 'demo-sms-tpl-002',
      name: '(Demo) Follow-up After Demo',
      body: 'Hi {{firstName}}, thanks for joining the demo today! Here is the recording: {{recordingLink}}. Any questions? Just reply here or book a call: {{bookingLink}} - {{repName}}',
      variables: ['firstName', 'recordingLink', 'bookingLink', 'repName'],
      status: 'active',
      category: 'follow-up',
      characterCount: 196,
      isDemo: true,
      createdBy: MEMBER_2.id,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(3),
    },
  ];
}

// ============================================================================
// [17/32] EMAIL TEMPLATES (3 docs)
// ============================================================================

function getEmailTemplates(): SeedDoc[] {
  const templates: Array<{ idSuffix: string; name: string; desc: string; subject: string; category: string }> = [
    { idSuffix: '001', name: '(Demo) Welcome Email', desc: 'Onboarding welcome email for new customers.', subject: 'Welcome to {{companyName}}!', category: 'onboarding' },
    { idSuffix: '002', name: '(Demo) Follow-Up After Meeting', desc: 'Post-meeting follow-up with next steps.', subject: 'Great connecting, {{firstName}}!', category: 'sales' },
    { idSuffix: '003', name: '(Demo) Monthly Newsletter', desc: 'Monthly company newsletter template.', subject: '{{companyName}} Monthly Update - {{month}}', category: 'marketing' },
  ];

  return templates.map(t => ({
    id: `demo-email-tpl-${t.idSuffix}`,
    name: t.name,
    description: t.desc,
    subject: t.subject,
    htmlBody: `<html><body><h1>${t.subject}</h1><p>(Demo) Email body content for ${t.name}.</p></body></html>`,
    textBody: `(Demo) Plain text version of ${t.name}.`,
    variables: t.subject.match(/\{\{(\w+)\}\}/g)?.map(v => v.replace(/[{}]/g, '')) ?? [],
    category: t.category,
    status: 'active',
    createdBy: DEMO_OWNER_ID,
    isDemo: true,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(5),
  }));
}

// ============================================================================
// [18/32] STOREFRONT CONFIG (1 doc)
// ============================================================================

function getStorefrontConfig(): SeedDoc[] {
  return [{
    id: 'demo-storefront-config',
    layout: {
      header: { logo: true, navigation: true, searchBar: true },
      footer: { links: true, socialIcons: true, newsletter: true },
      gridColumns: 3,
      showFilters: true,
      showSearch: true,
      showCategories: true,
    },
    pages: {
      home: { heroEnabled: true, featuredProducts: true, testimonials: true },
      products: { sortOptions: ['price', 'name', 'newest'], defaultSort: 'newest' },
      cart: { showRecommendations: true, guestCheckout: true },
      checkout: { requireAccount: false, showOrderSummary: true },
    },
    seo: {
      title: '(Demo) SalesVelocity.ai Store',
      description: '(Demo) Browse and purchase SalesVelocity.ai products and services.',
      keywords: ['sales', 'crm', 'ai', 'automation', 'saas'],
    },
    categories: ['Software', 'Services', 'Training', 'Add-ons'],
    paymentMethods: ['credit_card', 'paypal', 'bank_transfer'],
    shippingMethods: ['digital_delivery', 'standard', 'express'],
    currency: 'USD',
    isDemo: true,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(3),
  }];
}

// ============================================================================
// [19/32] NOTIFICATIONS (5 docs)
// ============================================================================

function getNotifications(): SeedDoc[] {
  const notifs: Array<{
    idSuffix: string; title: string; body: string; type: string;
    channel: string; status: string; priority: string;
    userId: string; resourceType: string; resourceId: string; actionUrl: string;
    daysBack: number; isRead: boolean;
  }> = [
    { idSuffix: '001', title: '(Demo) Deal Won: Enterprise Plan - Acme', body: 'Congratulations! The Acme Corp deal ($45,000) has been marked as Closed Won.', type: 'deal_won', channel: 'in_app', status: 'read', priority: 'high', userId: DEMO_OWNER_ID, resourceType: 'deal', resourceId: 'demo-deal-001', actionUrl: '/deals/demo-deal-001', daysBack: 1, isRead: true },
    { idSuffix: '002', title: '(Demo) New Lead Assigned: Horizon Media', body: 'A new lead has been assigned to you by round-robin routing.', type: 'lead_assigned', channel: 'email', status: 'sent', priority: 'medium', userId: MEMBER_2.id, resourceType: 'lead', resourceId: 'demo-lead-009', actionUrl: '/leads/demo-lead-009', daysBack: 2, isRead: false },
    { idSuffix: '003', title: '(Demo) Task Overdue: Follow up with Acme Corp', body: 'Your task "Follow up with Acme Corp on enterprise pricing" is past due.', type: 'task_overdue', channel: 'in_app', status: 'pending', priority: 'high', userId: DEMO_OWNER_ID, resourceType: 'task', resourceId: 'demo-task-001', actionUrl: '/tasks/demo-task-001', daysBack: 0, isRead: false },
    { idSuffix: '004', title: '(Demo) Sequence Completed: Enterprise Outreach', body: 'The Enterprise Outreach Sequence has completed for Rachel Lee.', type: 'sequence_completed', channel: 'slack', status: 'sent', priority: 'low', userId: MEMBER_2.id, resourceType: 'sequence', resourceId: 'demo-sequence-001', actionUrl: '/sequences/demo-sequence-001', daysBack: 3, isRead: true },
    { idSuffix: '005', title: '(Demo) System Update: Platform v2.4 Released', body: 'New features include enhanced AI scoring, workflow templates, and performance improvements.', type: 'system_update', channel: 'in_app', status: 'pending', priority: 'low', userId: DEMO_OWNER_ID, resourceType: 'system', resourceId: 'release-v2.4', actionUrl: '/settings/changelog', daysBack: 0, isRead: false },
  ];

  return notifs.map(n => ({
    id: `demo-notif-${n.idSuffix}`,
    title: n.title,
    body: n.body,
    type: n.type,
    channel: n.channel,
    status: n.status,
    priority: n.priority,
    userId: n.userId,
    resourceType: n.resourceType,
    resourceId: n.resourceId,
    actionUrl: n.actionUrl,
    isDemo: true,
    createdAt: daysAgo(n.daysBack),
    readAt: n.isRead ? daysAgo(Math.max(0, n.daysBack - 1)) : null,
  }));
}

// ============================================================================
// [20/32] NOTIFICATION PREFERENCES (1 doc)
// ============================================================================

function getNotificationPreferences(): SeedDoc[] {
  return [{
    id: 'demo-notif-prefs-001',
    userId: DEMO_OWNER_ID,
    channels: { email: true, slack: true, in_app: true, sms: false },
    categories: {
      deal_risk: true,
      conversation: true,
      coaching: true,
      sequence: true,
      system: true,
      task_reminder: true,
    },
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '07:00',
      timezone: 'America/New_York',
    },
    isDemo: true,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(10),
  }];
}

// ============================================================================
// [21/32] MERCHANT COUPONS (2 docs)
// ============================================================================

function getMerchantCoupons(): SeedDoc[] {
  return [
    {
      id: 'demo-coupon-001',
      code: 'DEMO20',
      name: '(Demo) 20% Off Everything',
      description: '(Demo) Public marketing coupon — 20% discount on all products.',
      discountType: 'percentage',
      discountValue: 20,
      minOrderAmount: 0,
      maxUses: 500,
      currentUses: 47,
      expiresAt: daysFromNow(60),
      isActive: true,
      category: 'public_marketing',
      aiAuthorized: true,
      maxAiDiscountPercent: 20,
      isDemo: true,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(5),
    },
    {
      id: 'demo-coupon-002',
      code: 'VIPSAVE50',
      name: '(Demo) $50 VIP Discount',
      description: '(Demo) Negotiation coupon for VIP prospects — $50 off.',
      discountType: 'fixed',
      discountValue: 50,
      minOrderAmount: 100,
      maxUses: 100,
      currentUses: 12,
      expiresAt: daysFromNow(90),
      isActive: true,
      category: 'negotiation',
      aiAuthorized: true,
      maxAiDiscountPercent: 15,
      isDemo: true,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(3),
    },
  ];
}

// ============================================================================
// [22/32] CARTS (2 docs)
// ============================================================================

function getCarts(): SeedDoc[] {
  return [
    {
      id: 'demo-cart-001',
      customerId: 'demo-contact-001',
      customerEmail: 'j.smith@acme-corp.com',
      items: [
        { productId: 'demo-product-001', name: '(Demo) Pro Plan — Annual', quantity: 1, unitPrice: 14900, total: 14900 },
        { productId: 'demo-product-003', name: '(Demo) Onboarding Package', quantity: 1, unitPrice: 2500, total: 2500 },
      ],
      subtotal: 17400,
      tax: 1392,
      total: 18792,
      status: 'active',
      isDemo: true,
      createdAt: hoursAgo(4),
      updatedAt: hoursAgo(2),
    },
    {
      id: 'demo-cart-002',
      customerId: 'demo-contact-003',
      customerEmail: 'r.lee@globaldynamics.com',
      items: [
        { productId: 'demo-product-002', name: '(Demo) Enterprise Plan — Monthly', quantity: 1, unitPrice: 24900, total: 24900 },
      ],
      subtotal: 24900,
      tax: 1992,
      total: 26892,
      status: 'abandoned',
      isDemo: true,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(3),
    },
  ];
}

// ============================================================================
// [23/32] BLOG CATEGORIES (3 docs)
// ============================================================================

function getBlogCategories(): SeedDoc[] {
  const cats: Array<{ idSuffix: string; name: string; slug: string; desc: string; postCount: number; color: string }> = [
    { idSuffix: '001', name: '(Demo) Sales Tips', slug: 'sales-tips', desc: 'Practical advice to improve your sales process and close more deals.', postCount: 12, color: '#3B82F6' },
    { idSuffix: '002', name: '(Demo) Product Updates', slug: 'product-updates', desc: 'Latest features, improvements, and releases from SalesVelocity.ai.', postCount: 8, color: '#10B981' },
    { idSuffix: '003', name: '(Demo) Industry Insights', slug: 'industry-insights', desc: 'Trends, research, and analysis from the sales and CRM industry.', postCount: 6, color: '#8B5CF6' },
  ];

  return cats.map(c => ({
    id: `demo-blog-cat-${c.idSuffix}`,
    name: c.name,
    slug: c.slug,
    description: c.desc,
    postCount: c.postCount,
    color: c.color,
    isDemo: true,
    createdAt: daysAgo(90),
  }));
}

// ============================================================================
// [24/32] BOOKINGS (3 docs)
// ============================================================================

function getBookings(): SeedDoc[] {
  return [
    {
      id: 'demo-booking-001',
      title: '(Demo) Product Demo — Acme Corp',
      description: 'Live demo of enterprise features including AI lead scoring and workflow automation.',
      startTime: daysFromNow(3),
      endTime: daysFromNow(3), // +1h handled conceptually; same day
      duration: 60,
      attendees: [
        { name: '(Demo) John Smith', email: 'j.smith@acme-corp.com' },
        { name: MEMBER_2.name, email: MEMBER_2.email },
      ],
      meetingUrl: 'https://meet.salesvelocity.ai/demo-acme-001',
      status: 'confirmed',
      organizer: MEMBER_2.id,
      location: 'Virtual — Google Meet',
      isDemo: true,
      createdAt: daysAgo(5),
    },
    {
      id: 'demo-booking-002',
      title: '(Demo) Discovery Call — Vertex Labs',
      description: 'Initial discovery call to understand healthcare CRM requirements.',
      startTime: daysAgo(2),
      endTime: daysAgo(2),
      duration: 30,
      attendees: [
        { name: '(Demo) Peter Jones', email: 'p.jones@vertexlabs.com' },
        { name: DEMO_OWNER_NAME, email: DEMO_OWNER_EMAIL },
      ],
      meetingUrl: 'https://meet.salesvelocity.ai/demo-vertex-002',
      status: 'confirmed',
      organizer: DEMO_OWNER_ID,
      location: 'Virtual — Zoom',
      isDemo: true,
      createdAt: daysAgo(10),
    },
    {
      id: 'demo-booking-003',
      title: '(Demo) Strategy Session — Summit Group',
      description: 'Quarterly strategy session to review pipeline and set targets.',
      startTime: daysFromNow(7),
      endTime: daysFromNow(7),
      duration: 90,
      attendees: [
        { name: '(Demo) Lisa Park', email: 'l.park@summitgroup.com' },
        { name: MEMBER_3.name, email: MEMBER_3.email },
        { name: DEMO_OWNER_NAME, email: DEMO_OWNER_EMAIL },
      ],
      meetingUrl: 'https://meet.salesvelocity.ai/demo-summit-003',
      status: 'pending',
      organizer: MEMBER_3.id,
      location: 'Virtual — Microsoft Teams',
      isDemo: true,
      createdAt: daysAgo(1),
    },
  ];
}

// ============================================================================
// [25/32] TOOL TRAINING (2 docs)
// ============================================================================

function getToolTraining(): SeedDoc[] {
  return [
    {
      id: 'demo-training-001',
      toolId: 'voice-ai',
      toolName: '(Demo) Voice AI Agent',
      description: 'Training data for the Voice AI agent to handle common sales inquiries.',
      examples: [
        { input: 'What is your pricing?', output: 'Our plans start at $99/mo for Starter, $149/mo for Pro, and $249/mo for the AI Sales Agent tier. Annual plans receive a 20% discount.', explanation: '(Demo) Direct pricing question — respond with all tiers and mention annual savings.' },
        { input: 'Can I integrate with Salesforce?', output: 'Yes! We offer a native Salesforce integration with bi-directional sync. Migration assistance is included free for Enterprise plans.', explanation: '(Demo) Integration question — confirm capability and mention migration help.' },
        { input: 'Do you offer a free trial?', output: 'We offer a 14-day free trial with full access to Pro features. No credit card required to start.', explanation: '(Demo) Trial question — emphasize no-risk, no-credit-card positioning.' },
      ],
      status: 'active',
      category: 'sales',
      lastTrainedAt: daysAgo(3),
      isDemo: true,
      createdAt: daysAgo(30),
    },
    {
      id: 'demo-training-002',
      toolId: 'seo-analyzer',
      toolName: '(Demo) SEO Analyzer',
      description: 'Training data for the SEO analysis tool with example keyword evaluations.',
      examples: [
        { input: 'Analyze keyword: sales automation software', output: 'Volume: 12,000/mo | Difficulty: 72/100 | CPC: $14.50 | Trend: Rising. Recommend targeting with long-form comparison content.', explanation: '(Demo) High-volume keyword — provide full metrics and content strategy recommendation.' },
        { input: 'Analyze keyword: best crm for startups', output: 'Volume: 6,200/mo | Difficulty: 58/100 | CPC: $11.20 | Trend: Stable. Good opportunity for listicle-style content with product comparisons.', explanation: '(Demo) Mid-volume keyword — suggest content format that matches search intent.' },
      ],
      status: 'active',
      category: 'marketing',
      lastTrainedAt: daysAgo(7),
      isDemo: true,
      createdAt: daysAgo(45),
    },
  ];
}

// ============================================================================
// [26/32] VOICE KNOWLEDGE (2 docs)
// ============================================================================

function getVoiceKnowledge(): SeedDoc[] {
  return [
    {
      id: 'demo-voice-knowledge-001',
      topic: '(Demo) Product Overview',
      content: '(Demo) SalesVelocity.ai is an AI-native CRM and sales acceleration platform. Key features include: AI lead scoring with 50+ signals, automated workflow engine, multi-channel sequences (email, call, SMS), voice AI sales agent, conversation intelligence with real-time coaching, and a full e-commerce storefront. Plans range from $99-$249/mo with enterprise custom pricing available.',
      category: 'product',
      tags: ['overview', 'features', 'pricing', 'positioning'],
      priority: 1,
      isDemo: true,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(5),
    },
    {
      id: 'demo-voice-knowledge-002',
      topic: '(Demo) Common Objections',
      content: '(Demo) Price objection: Emphasize ROI — average customer sees 3x pipeline growth in 90 days. Competition objection: We are the only AI-native platform with built-in voice agent and conversation intelligence. Timing objection: Offer a 14-day free trial with full onboarding support. Security objection: SOC 2 Type II compliant, GDPR ready, 99.9% uptime SLA.',
      category: 'objection',
      tags: ['objections', 'price', 'competition', 'timing', 'security'],
      priority: 1,
      isDemo: true,
      createdAt: daysAgo(45),
      updatedAt: daysAgo(3),
    },
  ];
}

// ============================================================================
// [27/32] SOCIAL KNOWLEDGE (2 docs)
// ============================================================================

function getSocialKnowledge(): SeedDoc[] {
  return [
    {
      id: 'demo-social-knowledge-001',
      platform: 'linkedin',
      content: '(Demo) LinkedIn content strategy for SalesVelocity.ai: Focus on thought leadership, customer success stories, and product updates. Maintain professional but approachable tone.',
      rules: [
        '(Demo) Always include a call-to-action',
        '(Demo) Use 3-5 relevant hashtags per post',
        '(Demo) Tag relevant people and companies when appropriate',
        '(Demo) Post during business hours (9 AM - 5 PM EST)',
      ],
      tone: 'professional',
      hashtagStrategy: '(Demo) Use industry hashtags (#SalesTech, #CRM, #AIinSales) plus branded (#SalesVelocity). Limit to 5 per post.',
      bestPractices: [
        '(Demo) Share data-driven insights with visual content',
        '(Demo) Engage with comments within 2 hours',
        '(Demo) Publish long-form articles bi-weekly',
        '(Demo) Celebrate customer wins and case studies',
      ],
      isDemo: true,
      createdAt: daysAgo(30),
    },
    {
      id: 'demo-social-knowledge-002',
      platform: 'twitter',
      content: '(Demo) Twitter/X content strategy: Short, punchy insights about sales and AI. Mix educational threads with product highlights and engagement posts.',
      rules: [
        '(Demo) Keep tweets under 240 characters for maximum engagement',
        '(Demo) Use 1-2 hashtags maximum',
        '(Demo) Create threads for complex topics',
        '(Demo) Respond to mentions within 1 hour during business hours',
      ],
      tone: 'conversational',
      hashtagStrategy: '(Demo) Minimal hashtags — 1-2 per tweet. Focus on #SalesTech and #AI.',
      bestPractices: [
        '(Demo) Post 3-5 times per day',
        '(Demo) Use polls for engagement',
        '(Demo) Share quick tips as single tweets',
        '(Demo) Retweet customer testimonials',
      ],
      isDemo: true,
      createdAt: daysAgo(28),
    },
  ];
}

// ============================================================================
// [28/32] SOCIAL CORRECTIONS (3 docs)
// ============================================================================

function getSocialCorrections(): SeedDoc[] {
  return [
    {
      id: 'demo-social-correction-001',
      originalContent: '(Demo) Our product is the BEST CRM ever!!! Buy it now or you will regret it!!!',
      correctedContent: '(Demo) Discover how SalesVelocity.ai helps sales teams close 3x more deals with AI-powered insights. See why 500+ companies trust us.',
      reason: '(Demo) Original was too aggressive and lacked credibility. Corrected to use social proof and specific metrics.',
      platform: 'linkedin',
      category: 'tone',
      approvedBy: DEMO_OWNER_ID,
      isDemo: true,
      createdAt: daysAgo(15),
    },
    {
      id: 'demo-social-correction-002',
      originalContent: '(Demo) We guarantee 100% increase in your revenue within 30 days of using our platform.',
      correctedContent: '(Demo) Our customers report an average 40% improvement in pipeline velocity within the first 90 days. Results vary by team size and implementation.',
      reason: '(Demo) Original made unsubstantiated guarantees. Corrected to use verifiable averages with appropriate disclaimers.',
      platform: 'twitter',
      category: 'compliance',
      approvedBy: MEMBER_2.id,
      isDemo: true,
      createdAt: daysAgo(10),
    },
    {
      id: 'demo-social-correction-003',
      originalContent: '(Demo) New feature dropped. Check it out.',
      correctedContent: '(Demo) Just launched: Real-time conversation coaching that helps your reps nail every call. Watch the 60-second demo (link). What feature would you like to see next? #SalesTech',
      reason: '(Demo) Original lacked engagement hooks and detail. Corrected to include a CTA, question, and hashtag for better engagement.',
      platform: 'linkedin',
      category: 'engagement',
      approvedBy: DEMO_OWNER_ID,
      isDemo: true,
      createdAt: daysAgo(5),
    },
  ];
}

// ============================================================================
// [29/32] SEO RESEARCH (2 docs)
// ============================================================================

function getSeoResearch(): SeedDoc[] {
  return [
    {
      id: 'demo-seo-001',
      keyword: 'sales automation software',
      searchVolume: 12000,
      difficulty: 72,
      currentRank: 18,
      competitors: [
        { domain: 'hubspot.com', rank: 1, title: 'Best Sales Automation Software (2026)' },
        { domain: 'salesforce.com', rank: 2, title: 'Sales Automation Tools | Salesforce' },
        { domain: 'pipedrive.com', rank: 5, title: 'Sales Automation Software | Pipedrive' },
      ],
      relatedKeywords: ['sales automation tools', 'automated sales process', 'ai sales software', 'crm automation'],
      metrics: { cpc: 14.5, trend: 'rising' },
      status: 'targeting',
      isDemo: true,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(3),
    },
    {
      id: 'demo-seo-002',
      keyword: 'crm for small business',
      searchVolume: 8500,
      difficulty: 65,
      currentRank: 32,
      competitors: [
        { domain: 'hubspot.com', rank: 1, title: 'Free CRM for Small Business | HubSpot' },
        { domain: 'zoho.com', rank: 3, title: 'CRM for Small Business | Zoho' },
        { domain: 'freshworks.com', rank: 6, title: 'Best CRM for Small Business | Freshsales' },
      ],
      relatedKeywords: ['best crm for startups', 'small business crm free', 'simple crm software', 'affordable crm'],
      metrics: { cpc: 11.2, trend: 'stable' },
      status: 'researching',
      isDemo: true,
      createdAt: daysAgo(15),
      updatedAt: daysAgo(1),
    },
  ];
}

// ============================================================================
// [30/32] PLAYBOOKS (1 doc)
// ============================================================================

function getPlaybooks(): SeedDoc[] {
  return [{
    id: 'demo-playbook-001',
    name: '(Demo) Social Media Playbook',
    description: 'Master playbook governing social media content across all platforms. Includes tone guidelines, posting rules, and performance patterns.',
    version: '1.0',
    platformRules: {
      linkedin: {
        tone: 'professional',
        hashtagCount: 5,
        postLength: 1300,
        bestTimes: ['09:00', '12:00', '17:00'],
      },
      twitter: {
        tone: 'conversational',
        hashtagCount: 2,
        characterLimit: 280,
        bestTimes: ['08:00', '12:00', '15:00', '18:00'],
      },
    },
    corrections: [
      { pattern: '(Demo) Avoid superlatives without data', example: 'Replace "best" with "top-rated by G2"' },
      { pattern: '(Demo) No unsubstantiated claims', example: 'Always cite source or use "our customers report..."' },
    ],
    performancePatterns: [
      { pattern: '(Demo) Posts with questions get 2x engagement', confidence: 0.85 },
      { pattern: '(Demo) Video content outperforms text-only by 3x on LinkedIn', confidence: 0.92 },
      { pattern: '(Demo) Threads with 5-7 tweets get highest impressions on Twitter', confidence: 0.78 },
    ],
    isDemo: true,
    createdAt: daysAgo(45),
    updatedAt: daysAgo(5),
  }];
}

// ============================================================================
// [31/32] AUDIT LOGS (5 docs)
// ============================================================================

function getAuditLogs(): SeedDoc[] {
  const logs: Array<{
    idSuffix: string; action: string; userId: string; userName: string;
    userEmail: string; resourceType: string; resourceId: string;
    details: string; ipAddress: string; daysBack: number;
  }> = [
    { idSuffix: '001', action: 'user.login', userId: DEMO_OWNER_ID, userName: DEMO_OWNER_NAME, userEmail: DEMO_OWNER_EMAIL, resourceType: 'auth', resourceId: DEMO_OWNER_ID, details: '(Demo) Successful login via Google OAuth.', ipAddress: '192.168.1.10', daysBack: 0 },
    { idSuffix: '002', action: 'deal.created', userId: MEMBER_2.id, userName: MEMBER_2.name, userEmail: MEMBER_2.email, resourceType: 'deal', resourceId: 'demo-deal-001', details: '(Demo) Created deal "Enterprise Plan - Acme" ($45,000).', ipAddress: '10.0.0.25', daysBack: 1 },
    { idSuffix: '003', action: 'lead.updated', userId: MEMBER_3.id, userName: MEMBER_3.name, userEmail: MEMBER_3.email, resourceType: 'lead', resourceId: 'demo-lead-005', details: '(Demo) Updated lead status from "new" to "qualified".', ipAddress: '172.16.0.33', daysBack: 2 },
    { idSuffix: '004', action: 'settings.changed', userId: DEMO_OWNER_ID, userName: DEMO_OWNER_NAME, userEmail: DEMO_OWNER_EMAIL, resourceType: 'settings', resourceId: 'notification-settings', details: '(Demo) Updated notification preferences: enabled Slack integration.', ipAddress: '192.168.1.10', daysBack: 5 },
    { idSuffix: '005', action: 'api_key.rotated', userId: DEMO_OWNER_ID, userName: DEMO_OWNER_NAME, userEmail: DEMO_OWNER_EMAIL, resourceType: 'api_key', resourceId: 'api-key-openai', details: '(Demo) Rotated API key for OpenAI integration. Old key invalidated.', ipAddress: '192.168.1.10', daysBack: 7 },
  ];

  return logs.map(l => ({
    id: `demo-audit-${l.idSuffix}`,
    action: l.action,
    userId: l.userId,
    userName: l.userName,
    userEmail: l.userEmail,
    resourceType: l.resourceType,
    resourceId: l.resourceId,
    details: l.details,
    ipAddress: l.ipAddress,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    isDemo: true,
    timestamp: daysAgo(l.daysBack),
  }));
}

// ============================================================================
// [32/32] REPORTS (2 docs)
// ============================================================================

function getReports(): SeedDoc[] {
  return [
    {
      id: 'demo-report-001',
      name: '(Demo) Weekly Pipeline Report',
      description: 'Automated weekly summary of pipeline health, new deals, and stage movement.',
      type: 'pipeline',
      config: {
        metrics: ['total_pipeline_value', 'deals_created', 'deals_won', 'deals_lost', 'avg_deal_size', 'conversion_rate'],
        filters: { stage: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation'] },
        dateRange: { start: daysAgo(7), end: now() },
        groupBy: 'stage',
      },
      schedule: {
        enabled: true,
        frequency: 'weekly',
        recipients: [DEMO_OWNER_EMAIL, MEMBER_2.email],
      },
      lastRunAt: daysAgo(1),
      status: 'active',
      isDemo: true,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(1),
    },
    {
      id: 'demo-report-002',
      name: '(Demo) Monthly Revenue Report',
      description: 'Monthly revenue breakdown by source, rep, and product category.',
      type: 'revenue',
      config: {
        metrics: ['total_revenue', 'recurring_revenue', 'one_time_revenue', 'avg_deal_value', 'revenue_by_rep'],
        filters: { status: ['Closed Won'] },
        dateRange: { start: daysAgo(30), end: now() },
        groupBy: 'owner',
      },
      schedule: {
        enabled: true,
        frequency: 'monthly',
        recipients: [DEMO_OWNER_EMAIL, MEMBER_2.email, MEMBER_3.email],
      },
      lastRunAt: daysAgo(5),
      status: 'active',
      isDemo: true,
      createdAt: daysAgo(90),
      updatedAt: daysAgo(5),
    },
  ];
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seedPart3(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('  (DEMO) ACCOUNT SEED — PART 3: REMAINING PLATFORM COLLECTIONS');
  console.log('  SalesVelocity.ai — 32 Collections (~103 docs)');
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

  let total = 0;

  // ── [1/32] RECORDS ──────────────────────────────────────────────────────
  console.log('  [1/32] Seeding records (25 — leads, deals, tasks)...');
  total += await seedCollection(db, `${orgRoot}/records`, getRecords(), 'Records');

  // ── [2/32] MEMBERS ──────────────────────────────────────────────────────
  console.log('  [2/32] Seeding members (3 — owner, admin, user)...');
  total += await seedCollection(db, `${orgRoot}/members`, getMembers(), 'Members');

  // ── [3/32] COMPANIES ────────────────────────────────────────────────────
  console.log('  [3/32] Seeding companies (6 — varied industries)...');
  total += await seedCollection(db, `${orgRoot}/companies`, getCompanies(), 'Companies');

  // ── [4/32] CONVERSATION ANALYSES ────────────────────────────────────────
  console.log('  [4/32] Seeding conversation analyses (8 — varied scores)...');
  total += await seedCollection(db, `${orgRoot}/conversationAnalyses`, getConversationAnalyses(), 'Conversation Analyses');

  // ── [5/32] SCHEMAS ──────────────────────────────────────────────────────
  console.log('  [5/32] Seeding schemas (8 — entity definitions)...');
  total += await seedCollection(db, `${orgRoot}/schemas`, getSchemas(), 'Schemas');

  // ── [6/32] CHAT SESSIONS + MESSAGES ─────────────────────────────────────
  console.log('  [6/32] Seeding chat sessions (3 + messages subcollections)...');
  const chatSessions = getChatSessions();
  for (const session of chatSessions) {
    const { messages, ...sessionData } = session;
    await db.doc(`${orgRoot}/chatSessions/${session.id}`).set(sessionData);
    total += 1;
    const msgBatch = db.batch();
    for (const msg of messages) {
      const { id: msgId, ...msgData } = msg;
      msgBatch.set(db.doc(`${orgRoot}/chatSessions/${session.id}/messages/${msgId}`), msgData);
    }
    await msgBatch.commit();
    total += messages.length;
  }
  console.log(`    ✓ Chat Sessions: ${chatSessions.length} sessions + ${chatSessions.reduce((a, s) => a + s.messages.length, 0)} messages`);

  // ── [7/32] SEQUENCES ────────────────────────────────────────────────────
  console.log('  [7/32] Seeding sequences (2 — outreach + re-engagement)...');
  total += await seedCollection(db, `${orgRoot}/sequences`, getSequences(), 'Sequences');

  // ── [8/32] SEQUENCE ENROLLMENTS ─────────────────────────────────────────
  console.log('  [8/32] Seeding sequence enrollments (4)...');
  total += await seedCollection(db, `${orgRoot}/sequenceEnrollments`, getSequenceEnrollments(), 'Sequence Enrollments');

  // ── [9/32] TASKS ────────────────────────────────────────────────────────
  console.log('  [9/32] Seeding tasks (5 — varied statuses and priorities)...');
  total += await seedCollection(db, `${orgRoot}/tasks`, getTasks(), 'Tasks');

  // ── [10/32] USERS (TOP-LEVEL) ───────────────────────────────────────────
  console.log('  [10/32] Seeding users (3 — TOP-LEVEL collection)...');
  total += await seedCollection(db, 'users', getUsers(), 'Users (top-level)');

  // ── [11/32] WORKFLOW EXECUTIONS ─────────────────────────────────────────
  console.log('  [11/32] Seeding workflow executions (6 — varied statuses)...');
  total += await seedCollection(db, `${orgRoot}/workflowExecutions`, getWorkflowExecutions(), 'Workflow Executions');

  // ── [12/32] PROPOSAL TEMPLATES ──────────────────────────────────────────
  console.log('  [12/32] Seeding proposal templates (2)...');
  total += await seedCollection(db, `${orgRoot}/proposalTemplates`, getProposalTemplates(), 'Proposal Templates');

  // ── [13/32] FORM SUBMISSIONS ────────────────────────────────────────────
  console.log('  [13/32] Seeding form submissions (3)...');
  total += await seedCollection(db, `${orgRoot}/formSubmissions`, getFormSubmissions(), 'Form Submissions');

  // ── [14/32] MISSIONS ────────────────────────────────────────────────────
  console.log('  [14/32] Seeding missions (2 — in_progress + completed)...');
  total += await seedCollection(db, `${orgRoot}/missions`, getMissions(), 'Missions');

  // ── [15/32] LEAD ROUTING RULES ──────────────────────────────────────────
  console.log('  [15/32] Seeding lead routing rules (2)...');
  total += await seedCollection(db, `${orgRoot}/leadRoutingRules`, getLeadRoutingRules(), 'Lead Routing Rules');

  // ── [16/32] SMS TEMPLATES ───────────────────────────────────────────────
  console.log('  [16/32] Seeding SMS templates (2)...');
  total += await seedCollection(db, `${orgRoot}/smsTemplates`, getSmsTemplates(), 'SMS Templates');

  // ── [17/32] EMAIL TEMPLATES ───────────────────────────────────────────
  console.log('  [17/32] Seeding email templates (3)...');
  total += await seedCollection(db, `${orgRoot}/emailTemplates`, getEmailTemplates(), '[17/32] Email Templates');

  // ── [18/32] STOREFRONT CONFIG ────────────────────────────────────────
  console.log('  [18/32] Seeding storefront config (1)...');
  total += await seedCollection(db, `${orgRoot}/storefrontConfig`, getStorefrontConfig(), '[18/32] Storefront Config');

  // ── [19/32] NOTIFICATIONS ────────────────────────────────────────────
  console.log('  [19/32] Seeding notifications (5)...');
  total += await seedCollection(db, `${orgRoot}/notifications`, getNotifications(), '[19/32] Notifications');

  // ── [20/32] NOTIFICATION PREFERENCES ─────────────────────────────────
  console.log('  [20/32] Seeding notification preferences (1)...');
  total += await seedCollection(db, `${orgRoot}/notification_preferences`, getNotificationPreferences(), '[20/32] Notification Preferences');

  // ── [21/32] MERCHANT COUPONS ─────────────────────────────────────────
  console.log('  [21/32] Seeding merchant coupons (2)...');
  total += await seedCollection(db, `${orgRoot}/merchant_coupons`, getMerchantCoupons(), '[21/32] Merchant Coupons');

  // ── [22/32] CARTS ────────────────────────────────────────────────────
  console.log('  [22/32] Seeding carts (2)...');
  total += await seedCollection(db, `${orgRoot}/carts`, getCarts(), '[22/32] Carts');

  // ── [23/32] BLOG CATEGORIES ──────────────────────────────────────────
  console.log('  [23/32] Seeding blog categories (3)...');
  total += await seedCollection(db, `${orgRoot}/blogCategories`, getBlogCategories(), '[23/32] Blog Categories');

  // ── [24/32] BOOKINGS ─────────────────────────────────────────────────
  console.log('  [24/32] Seeding bookings (3)...');
  total += await seedCollection(db, `${orgRoot}/bookings`, getBookings(), '[24/32] Bookings');

  // ── [25/32] TOOL TRAINING ────────────────────────────────────────────
  console.log('  [25/32] Seeding tool training (2)...');
  total += await seedCollection(db, `${orgRoot}/toolTraining`, getToolTraining(), '[25/32] Tool Training');

  // ── [26/32] VOICE KNOWLEDGE ──────────────────────────────────────────
  console.log('  [26/32] Seeding voice knowledge (2)...');
  total += await seedCollection(db, `${orgRoot}/voiceKnowledge`, getVoiceKnowledge(), '[26/32] Voice Knowledge');

  // ── [27/32] SOCIAL KNOWLEDGE ─────────────────────────────────────────
  console.log('  [27/32] Seeding social knowledge (2)...');
  total += await seedCollection(db, `${orgRoot}/socialKnowledge`, getSocialKnowledge(), '[27/32] Social Knowledge');

  // ── [28/32] SOCIAL CORRECTIONS ───────────────────────────────────────
  console.log('  [28/32] Seeding social corrections (3)...');
  total += await seedCollection(db, `${orgRoot}/socialCorrections`, getSocialCorrections(), '[28/32] Social Corrections');

  // ── [29/32] SEO RESEARCH ─────────────────────────────────────────────
  console.log('  [29/32] Seeding SEO research (2)...');
  total += await seedCollection(db, `${orgRoot}/seoResearch`, getSeoResearch(), '[29/32] SEO Research');

  // ── [30/32] PLAYBOOKS ────────────────────────────────────────────────
  console.log('  [30/32] Seeding playbooks (1)...');
  total += await seedCollection(db, `${orgRoot}/playbooks`, getPlaybooks(), '[30/32] Playbooks');

  // ── [31/32] AUDIT LOGS ───────────────────────────────────────────────
  console.log('  [31/32] Seeding audit logs (5)...');
  total += await seedCollection(db, `${orgRoot}/auditLogs`, getAuditLogs(), '[31/32] Audit Logs');

  // ── [32/32] REPORTS ──────────────────────────────────────────────────
  console.log('  [32/32] Seeding reports (2)...');
  total += await seedCollection(db, `${orgRoot}/reports`, getReports(), '[32/32] Reports');

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('  (DEMO) ACCOUNT SEED — PART 3 COMPLETE!');
  console.log('='.repeat(70));
  console.log(`  Total documents created: ${total}`);
  console.log('');
  console.log('  DATA SUMMARY (all 32 collections):');
  console.log('    [1]  Records:               25 docs (12 leads + 8 deals + 5 tasks)');
  console.log('    [2]  Members:                3 docs (owner + admin + user)');
  console.log('    [3]  Companies:              6 docs (6 industries)');
  console.log('    [4]  Conversation Analyses:  8 docs (2 excellent + 3 good + 2 avg + 1 poor)');
  console.log('    [5]  Schemas:                8 docs (entity definitions)');
  console.log('    [6]  Chat Sessions:          3 docs + messages subcollections');
  console.log('    [7]  Sequences:              2 docs (outreach + re-engagement)');
  console.log('    [8]  Sequence Enrollments:   4 docs');
  console.log('    [9]  Tasks:                  5 docs (varied statuses)');
  console.log('    [10] Users (top-level):      3 docs');
  console.log('    [11] Workflow Executions:    6 docs (2 complete + 2 running + 1 failed + 1 pending)');
  console.log('    [12] Proposal Templates:     2 docs');
  console.log('    [13] Form Submissions:       3 docs');
  console.log('    [14] Missions:               2 docs (1 in-progress + 1 completed)');
  console.log('    [15] Lead Routing Rules:     2 docs');
  console.log('    [16] SMS Templates:          2 docs');
  console.log('    [17] Email Templates:        3 docs (onboarding + sales + marketing)');
  console.log('    [18] Storefront Config:      1 doc (layout + pages + seo)');
  console.log('    [19] Notifications:          5 docs (deal_won + lead + task + sequence + system)');
  console.log('    [20] Notification Prefs:     1 doc (channels + categories + quiet hours)');
  console.log('    [21] Merchant Coupons:       2 docs (percentage + fixed)');
  console.log('    [22] Carts:                  2 docs (active + abandoned)');
  console.log('    [23] Blog Categories:        3 docs (sales + product + industry)');
  console.log('    [24] Bookings:               3 docs (upcoming + past + pending)');
  console.log('    [25] Tool Training:          2 docs (voice AI + SEO analyzer)');
  console.log('    [26] Voice Knowledge:        2 docs (product + objections)');
  console.log('    [27] Social Knowledge:       2 docs (linkedin + twitter)');
  console.log('    [28] Social Corrections:     3 docs (tone + compliance + engagement)');
  console.log('    [29] SEO Research:           2 docs (2 keyword analyses)');
  console.log('    [30] Playbooks:              1 doc (social media playbook)');
  console.log('    [31] Audit Logs:             5 docs (login + deal + lead + settings + api_key)');
  console.log('    [32] Reports:                2 docs (pipeline + revenue)');
  console.log('');
  console.log('  COMBINED TOTAL (all parts):');
  console.log('    Part 1 (CRM):       96 documents');
  console.log('    Part 2 (Platform):  ~60 documents');
  console.log(`    Part 3 (Extended): ${total} documents (~103 planned)`);
  console.log('');
  console.log('  All data tagged with "(Demo)" + isDemo:true for easy cleanup.');
  console.log('='.repeat(70) + '\n');
}

// ============================================================================
// CLEANUP — Remove ALL Demo Data (Parts 1, 2, and 3)
// ============================================================================

/**
 * Deletes every document with isDemo:true across ALL collections from all 3 seed scripts.
 * This restores the account to a virgin state.
 *
 * Collections cleaned (by part):
 *   Part 1: contacts, leads, deals, activities, products, emailCampaigns, nurtureSequences, analytics
 *   Part 2: workflows, forms, pages, blogPosts, siteConfig, themes, navigation, socialPosts,
 *           orders, globalTemplates, scoringRules, webhooks, teamTasks, conversations,
 *           integrations, customTools, onboarding, agent
 *   Part 3: records, members, companies, conversationAnalyses, schemas, chatSessions,
 *           sequences, sequenceEnrollments, tasks, workflowExecutions, proposalTemplates,
 *           formSubmissions, missions, leadRoutingRules, smsTemplates, emailTemplates,
 *           storefrontConfig, notifications, notification_preferences, merchant_coupons,
 *           carts, blogCategories, bookings, toolTraining, voiceKnowledge, socialKnowledge,
 *           socialCorrections, seoResearch, playbooks, auditLogs, reports
 *   Top-level: users
 *
 * Subcollections cleaned:
 *   - chatSessions/{id}/messages
 *   - forms/{id}/fields
 *   - forms/{id}/submissions
 */
async function cleanupAllDemoData(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('  CLEANUP — Removing ALL Demo Data (Parts 1, 2, and 3)');
  console.log('  Restoring virgin account state');
  console.log('='.repeat(70) + '\n');

  if (process.env.NODE_ENV === 'production') {
    console.error('  SAFETY: Cannot run cleanup in production.');
    process.exit(1);
  }

  const db = initFirebase();
  let totalDeleted = 0;

  // All org-level collections across all 3 parts
  const ORG_COLLECTIONS = [
    // Part 1
    'contacts', 'leads', 'deals', 'activities', 'products',
    'emailCampaigns', 'nurtureSequences', 'analytics',
    // Part 2
    'workflows', 'forms', 'pages', 'blogPosts', 'siteConfig',
    'themes', 'navigation', 'socialPosts', 'orders', 'globalTemplates',
    'scoringRules', 'webhooks', 'teamTasks', 'conversations',
    'integrations', 'customTools', 'onboarding', 'agent',
    // Part 3
    'records', 'members', 'companies', 'conversationAnalyses', 'schemas',
    'chatSessions', 'sequences', 'sequenceEnrollments', 'tasks',
    'workflowExecutions', 'proposalTemplates', 'formSubmissions',
    'missions', 'leadRoutingRules', 'smsTemplates', 'emailTemplates',
    'storefrontConfig', 'notifications', 'notification_preferences',
    'merchant_coupons', 'carts', 'blogCategories', 'bookings',
    'toolTraining', 'voiceKnowledge', 'socialKnowledge',
    'socialCorrections', 'seoResearch', 'playbooks', 'auditLogs', 'reports',
  ];

  // Helper: delete all docs with isDemo:true in a collection
  async function cleanCollection(collectionPath: string, label: string): Promise<number> {
    const snapshot = await db.collection(collectionPath)
      .where('isDemo', '==', true)
      .get();

    if (snapshot.empty) return 0;

    // Batch delete (max 500 per batch)
    let deleted = 0;
    const batchSize = 450;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + batchSize);
      for (const doc of chunk) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      deleted += chunk.length;
    }

    if (deleted > 0) {
      console.log(`  ✗ ${label}: deleted ${deleted} docs from ${collectionPath}`);
    }
    return deleted;
  }

  // Helper: delete subcollection docs under demo parent docs
  async function cleanSubcollections(
    parentPath: string,
    subCollectionName: string,
    label: string,
  ): Promise<number> {
    // Find all demo parent docs
    const parents = await db.collection(parentPath)
      .where('isDemo', '==', true)
      .get();

    let deleted = 0;
    for (const parent of parents.docs) {
      const subSnap = await db.collection(`${parentPath}/${parent.id}/${subCollectionName}`).get();
      if (subSnap.empty) continue;

      const batch = db.batch();
      for (const doc of subSnap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      deleted += subSnap.size;
    }

    if (deleted > 0) {
      console.log(`  ✗ ${label}: deleted ${deleted} subcollection docs`);
    }
    return deleted;
  }

  // 1. Clean subcollections FIRST (before deleting parents)
  console.log('  Phase 1: Cleaning subcollections...');
  totalDeleted += await cleanSubcollections(
    `${orgRoot}/chatSessions`, 'messages', 'chatSessions/messages'
  );
  totalDeleted += await cleanSubcollections(
    `${orgRoot}/forms`, 'fields', 'forms/fields'
  );
  totalDeleted += await cleanSubcollections(
    `${orgRoot}/forms`, 'submissions', 'forms/submissions'
  );

  // 2. Clean all org-level collections
  console.log('\n  Phase 2: Cleaning org-level collections...');
  for (const collection of ORG_COLLECTIONS) {
    totalDeleted += await cleanCollection(`${orgRoot}/${collection}`, collection);
  }

  // 3. Clean top-level users collection
  console.log('\n  Phase 3: Cleaning top-level collections...');
  totalDeleted += await cleanCollection('users', 'users (top-level)');

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log(`  CLEANUP COMPLETE: ${totalDeleted} documents deleted`);
  console.log('  Account restored to virgin state.');
  console.log('='.repeat(70) + '\n');
}

// ============================================================================
// RUN
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--cleanup')) {
  cleanupAllDemoData()
    .then(() => {
      console.log('  Cleanup complete. Exiting.\n');
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error('  CLEANUP FAILED:', error);
      process.exit(1);
    });
} else {
  seedPart3()
    .then(() => {
      console.log('  Seed complete. Exiting.\n');
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error('  SEED FAILED:', error);
      process.exit(1);
    });
}
