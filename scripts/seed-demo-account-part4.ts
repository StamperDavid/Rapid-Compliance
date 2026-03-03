/**
 * (Demo) Account Seed Script — PART 4: Growth, AI Workforce, Team Coaching & More
 *
 * Fills in ~82 documents across 15+ collections not covered by Parts 1-3.
 * Run AFTER Parts 1, 2, and 3.
 *
 * DEMO DATA MANIFEST (Part 4 — ~82 docs):
 * ┌────────────────────────────────────┬──────┬────────────────────────────────────────┐
 * │ Collection                         │ Docs │ Key Fields                             │
 * ├────────────────────────────────────┼──────┼────────────────────────────────────────┤
 * │ growthCompetitorProfiles           │   3  │ domain, DA, organicTraffic, techStack  │
 * │ growthCompetitorSnapshots          │   3  │ competitorId FK, DA, traffic           │
 * │ growthKeywordRankings              │   5  │ keyword, position, volume, difficulty  │
 * │ growthStrategies                   │   1  │ status:approved, tiers{}, actions[]    │
 * │ growthAiVisibility                 │   1  │ visibilityScore, queryResults[]        │
 * │ growthActivityLog                  │  10  │ type, message, timestamp, actor        │
 * │ members (+5 new → 8 total)        │   5  │ name, role, title, metrics{}           │
 * │ teams                              │   2  │ name, memberIds[]                      │
 * │ conversationAnalyses (+24 → 32)   │  24  │ scores, sentiment, 3 per member        │
 * │ users (+5 new, top-level)         │   5  │ email, displayName, role, status       │
 * │ playbooks (replace+add → 3)       │   3  │ patterns[], talkTracks[], metrics{}    │
 * │ abTests                            │   3  │ name, status, variants[], results?     │
 * │ calls                              │   5  │ contactName, duration, status          │
 * │ video_pipeline_projects            │   2  │ brief{}, scenes[], status              │
 * │ agentRepProfiles                   │   5  │ agentType per domain, thresholds       │
 * │ agentPerformance                   │  20  │ qualityScore, reviewSeverity           │
 * │ specialistImprovementRequests      │   3  │ proposedChanges[], status              │
 * │ seoResearch (+2 battlecards)       │   2  │ type:competitor_discovery/battlecard   │
 * │ teamTasks (+8 new)                │   8  │ title, assignedTo, status, priority    │
 * └────────────────────────────────────┴──────┴────────────────────────────────────────┘
 *
 * CLEANUP: All documents have isDemo: true, demo- prefixed IDs, and (Demo) in names.
 *          The nuke-demo-data.ts script covers every collection listed above.
 *
 * Usage: npx tsx scripts/seed-demo-account-part4.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION (must match Parts 1–3)
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
const DEMO_OWNER_ID = 'demo-owner-001';
const DEMO_OWNER_NAME = '(Demo) Alex Morgan';
const DEMO_OWNER_EMAIL = 'alex.morgan@salesvelocity.ai';

const orgRoot = `organizations/${PLATFORM_ID}`;

// Existing members from Parts 1-3
const MEMBER_2 = { id: 'demo-member-002', name: '(Demo) Sarah Chen', email: 'sarah.chen@salesvelocity.ai' };
const MEMBER_3 = { id: 'demo-member-003', name: '(Demo) Marcus Rivera', email: 'marcus.rivera@salesvelocity.ai' };

// New members added by Part 4
const MEMBER_4 = { id: 'demo-member-004', name: '(Demo) Jordan Williams', email: 'jordan.williams@salesvelocity.ai' };
const MEMBER_5 = { id: 'demo-member-005', name: '(Demo) Emily Zhang', email: 'emily.zhang@salesvelocity.ai' };
const MEMBER_6 = { id: 'demo-member-006', name: '(Demo) Ryan Cooper', email: 'ryan.cooper@salesvelocity.ai' };
const MEMBER_7 = { id: 'demo-member-007', name: '(Demo) Priya Patel', email: 'priya.patel@salesvelocity.ai' };
const MEMBER_8 = { id: 'demo-member-008', name: '(Demo) Tyler Brooks', email: 'tyler.brooks@salesvelocity.ai' };

const EXISTING_TEAM = [
  { id: DEMO_OWNER_ID, name: DEMO_OWNER_NAME, email: DEMO_OWNER_EMAIL },
  MEMBER_2,
  MEMBER_3,
];

const NEW_MEMBERS = [MEMBER_4, MEMBER_5, MEMBER_6, MEMBER_7, MEMBER_8];

const FULL_TEAM = [...EXISTING_TEAM, ...NEW_MEMBERS];

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

function daysAgoISO(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function hoursAgoISO(n: number): string {
  return new Date(Date.now() - n * 3600000).toISOString();
}

const now = () => admin.firestore.Timestamp.now();
const nowISO = () => new Date().toISOString();

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
// [A] GROWTH COMMAND CENTER
// ============================================================================

// ── A1: Competitor Profiles (3 docs) ─────────────────────────────────────────

function getGrowthCompetitorProfiles(): SeedDoc[] {
  const competitors = [
    {
      id: 'demo-competitor-001',
      domain: 'hubspot.com',
      name: '(Demo) HubSpot',
      url: 'https://hubspot.com',
      tagline: 'Grow better with HubSpot',
      niche: 'CRM & Marketing Automation',
      domainAuthority: 93,
      organicTraffic: 15200000,
      organicKeywords: 1850000,
      backlinks: 42000000,
      referringDomains: 380000,
      techStack: ['React', 'Node.js', 'Java', 'AWS', 'GraphQL'],
      strengths: ['Massive brand recognition', 'Free tier drives adoption', 'Extensive integration marketplace', 'Strong content marketing'],
      weaknesses: ['Expensive at scale', 'Complex pricing tiers', 'Feature bloat for SMBs', 'Lock-in with proprietary ecosystem'],
      positioning: 'All-in-one CRM platform for scaling businesses',
    },
    {
      id: 'demo-competitor-002',
      domain: 'salesforce.com',
      name: '(Demo) Salesforce',
      url: 'https://salesforce.com',
      tagline: 'The #1 AI CRM',
      niche: 'Enterprise CRM',
      domainAuthority: 95,
      organicTraffic: 22400000,
      organicKeywords: 2100000,
      backlinks: 68000000,
      referringDomains: 520000,
      techStack: ['Lightning Web Components', 'Apex', 'Java', 'Heroku', 'AWS'],
      strengths: ['Enterprise market dominance', 'Massive ecosystem (AppExchange)', 'AI features (Einstein)', 'Global support infrastructure'],
      weaknesses: ['Extremely high cost', 'Steep learning curve', 'Implementation complexity', 'Slow innovation in core product'],
      positioning: 'Enterprise-grade CRM with AI-powered insights',
    },
    {
      id: 'demo-competitor-003',
      domain: 'pipedrive.com',
      name: '(Demo) Pipedrive',
      url: 'https://pipedrive.com',
      tagline: 'The CRM designed to get you selling',
      niche: 'Sales CRM for SMBs',
      domainAuthority: 81,
      organicTraffic: 3500000,
      organicKeywords: 420000,
      backlinks: 5200000,
      referringDomains: 48000,
      techStack: ['React', 'Node.js', 'PostgreSQL', 'AWS', 'GraphQL'],
      strengths: ['Intuitive UI for sales reps', 'Strong pipeline visualization', 'Good value pricing', 'Fast onboarding'],
      weaknesses: ['Limited marketing features', 'Weak reporting', 'No free tier', 'Limited AI capabilities'],
      positioning: 'Simple, effective sales pipeline management for small teams',
    },
  ];

  return competitors.map(c => ({
    ...c,
    addedAt: daysAgoISO(45),
    lastAnalyzedAt: daysAgoISO(2),
    addedBy: DEMO_OWNER_ID,
    isActive: true,
    isDemo: true,
  }));
}

// ── A2: Competitor Snapshots (3 docs) ────────────────────────────────────────

function getGrowthCompetitorSnapshots(): SeedDoc[] {
  const profiles = getGrowthCompetitorProfiles();
  return profiles.map((p, i) => ({
    id: `demo-snapshot-${String(i + 1).padStart(3, '0')}`,
    competitorId: p.id,
    domain: p.domain as string,
    domainAuthority: p.domainAuthority as number,
    organicTraffic: p.organicTraffic as number,
    organicKeywords: p.organicKeywords as number,
    backlinks: p.backlinks as number,
    referringDomains: p.referringDomains as number,
    capturedAt: daysAgoISO(2),
    isDemo: true,
  }));
}

// ── A3: Keyword Rankings (5 docs) ────────────────────────────────────────────

function getGrowthKeywordRankings(): SeedDoc[] {
  const keywords = [
    { kw: 'CRM software', pos: 28, prev: 32, vol: 33100, cpc: 12.50, diff: 'HIGH' as const },
    { kw: 'sales automation tools', pos: 12, prev: 15, vol: 8100, cpc: 8.75, diff: 'MEDIUM' as const },
    { kw: 'AI sales assistant', pos: 5, prev: 8, vol: 4400, cpc: 6.20, diff: 'LOW' as const },
    { kw: 'lead management software', pos: 15, prev: 14, vol: 6600, cpc: 9.30, diff: 'MEDIUM' as const },
    { kw: 'sales pipeline management', pos: 22, prev: 25, vol: 5400, cpc: 7.80, diff: 'HIGH' as const },
  ];

  return keywords.map((k, i) => ({
    id: `demo-keyword-${String(i + 1).padStart(3, '0')}`,
    keyword: k.kw,
    currentPosition: k.pos,
    previousPosition: k.prev,
    positionChange: k.prev - k.pos,
    searchVolume: k.vol,
    cpc: k.cpc,
    difficulty: k.diff,
    competitorPositions: [
      { competitorId: 'demo-competitor-001', domain: 'hubspot.com', name: '(Demo) HubSpot', position: 1 + i, url: `https://hubspot.com/${k.kw.replace(/\s/g, '-')}` },
      { competitorId: 'demo-competitor-002', domain: 'salesforce.com', name: '(Demo) Salesforce', position: 2 + i, url: `https://salesforce.com/${k.kw.replace(/\s/g, '-')}` },
    ],
    rankingHistory: [
      { position: k.prev + 5, checkedAt: daysAgoISO(28) },
      { position: k.prev + 2, checkedAt: daysAgoISO(21) },
      { position: k.prev, checkedAt: daysAgoISO(14) },
      { position: k.pos, checkedAt: daysAgoISO(7) },
    ],
    lastCheckedAt: daysAgoISO(1),
    addedAt: daysAgoISO(30),
    addedBy: DEMO_OWNER_ID,
    tags: ['core', k.diff.toLowerCase()],
    isActive: true,
    isDemo: true,
  }));
}

// ── A4: Growth Strategy (1 doc) ──────────────────────────────────────────────

function getGrowthStrategies(): SeedDoc[] {
  return [{
    id: 'demo-strategy-001',
    generatedAt: daysAgoISO(7),
    requestedBy: DEMO_OWNER_ID,
    status: 'approved',
    approvedTier: 'competitive',
    approval: {
      approvedBy: DEMO_OWNER_ID,
      approvedAt: daysAgoISO(5),
      tier: 'competitive',
      notes: 'Approved competitive tier — aligns with Q2 growth budget.',
      jasperApprovalId: null,
    },
    budgetConstraints: {
      maxMonthlyBudget: 15000,
      minMonthlyBudget: 5000,
      preferredChannels: ['seo', 'content', 'email'],
      primaryGoal: 'growth',
      industry: 'SaaS',
    },
    tiers: {
      aggressive: {
        tier: 'aggressive',
        label: 'Aggressive Growth',
        monthlyBudget: 25000,
        expectedROI: 4.2,
        timeToResults: '2-3 months',
        summary: 'Full-scale content + paid strategy targeting all high-value keywords with aggressive link building.',
        actions: [
          { id: 'a-act-1', channel: 'seo', title: 'Enterprise link building campaign', description: 'Acquire 50+ high-DA backlinks per month through digital PR and guest posting.', budgetAllocation: 10000, priority: 1, impact: 'high', effort: 'high', cheaperAlternative: { title: 'HARO + community link building', description: 'Use free HARO responses and community participation for backlinks.', estimatedCost: 500, tradeoffs: ['Slower results', 'Lower DA links', 'More time-intensive'] } },
          { id: 'a-act-2', channel: 'paid', title: 'Google Ads competitive capture', description: 'Bid on competitor brand terms and high-intent keywords.', budgetAllocation: 8000, priority: 2, impact: 'high', effort: 'medium', cheaperAlternative: null },
          { id: 'a-act-3', channel: 'content', title: 'Publish 20 pillar articles per month', description: 'Comprehensive guides targeting top keywords with 3000+ word articles.', budgetAllocation: 7000, priority: 3, impact: 'high', effort: 'high', cheaperAlternative: { title: 'AI-assisted content with human editing', description: 'Generate drafts with AI, have editors polish for quality.', estimatedCost: 2000, tradeoffs: ['Potentially lower quality', 'Requires editorial oversight'] } },
        ],
        kpis: ['Organic traffic growth 40%+', 'DA increase by 5 points', '100+ new ranking keywords'],
        risks: ['High spend may not show ROI for 2 months', 'Requires dedicated content team'],
      },
      competitive: {
        tier: 'competitive',
        label: 'Competitive Growth',
        monthlyBudget: 12000,
        expectedROI: 3.5,
        timeToResults: '3-4 months',
        summary: 'Balanced content and SEO strategy focused on high-value keyword gaps and strategic partnerships.',
        actions: [
          { id: 'c-act-1', channel: 'seo', title: 'Strategic link building', description: 'Acquire 20-30 quality backlinks per month through targeted outreach.', budgetAllocation: 4000, priority: 1, impact: 'high', effort: 'medium', cheaperAlternative: null },
          { id: 'c-act-2', channel: 'content', title: 'Publish 10 SEO-optimized articles per month', description: 'Target keyword gaps identified in competitor analysis.', budgetAllocation: 5000, priority: 2, impact: 'high', effort: 'medium', cheaperAlternative: null },
          { id: 'c-act-3', channel: 'email', title: 'Nurture campaign for organic leads', description: 'Automated email sequences for content-generated leads.', budgetAllocation: 3000, priority: 3, impact: 'medium', effort: 'low', cheaperAlternative: null },
        ],
        kpis: ['Organic traffic growth 20-30%', 'DA increase by 3 points', '50+ new ranking keywords'],
        risks: ['Moderate timeline before results', 'Requires consistent execution'],
      },
      scrappy: {
        tier: 'scrappy',
        label: 'Scrappy Growth',
        monthlyBudget: 3000,
        expectedROI: 2.8,
        timeToResults: '4-6 months',
        summary: 'Lean strategy maximizing free channels and community building.',
        actions: [
          { id: 's-act-1', channel: 'seo', title: 'Technical SEO fixes + internal linking', description: 'Fix crawl issues, improve site speed, optimize internal link structure.', budgetAllocation: 500, priority: 1, impact: 'medium', effort: 'low', cheaperAlternative: null },
          { id: 's-act-2', channel: 'content', title: 'Publish 4 high-quality articles per month', description: 'Focus on long-tail keywords with lower competition.', budgetAllocation: 2000, priority: 2, impact: 'medium', effort: 'medium', cheaperAlternative: null },
          { id: 's-act-3', channel: 'social', title: 'Community engagement + LinkedIn thought leadership', description: 'Daily posts and engagement on LinkedIn, Reddit, and industry forums.', budgetAllocation: 500, priority: 3, impact: 'low', effort: 'low', cheaperAlternative: null },
        ],
        kpis: ['Organic traffic growth 10-15%', 'DA increase by 1-2 points', '20+ new ranking keywords'],
        risks: ['Slow results', 'Limited impact against well-funded competitors'],
      },
    },
    dataContext: {
      competitorCount: 3,
      trackedKeywords: 5,
      avgDomainAuthority: 89.7,
      topCompetitors: ['HubSpot', 'Salesforce', 'Pipedrive'],
      topKeywordGaps: ['AI sales assistant', 'sales automation tools', 'lead management software'],
    },
    isDemo: true,
  }];
}

// ── A5: AI Visibility (1 doc) ────────────────────────────────────────────────

function getGrowthAiVisibility(): SeedDoc[] {
  return [{
    id: 'demo-ai-visibility-001',
    checkedAt: daysAgoISO(1),
    targetDomain: 'salesvelocity.ai',
    visibilityScore: 42,
    aiOverviewMentions: 3,
    totalQueriesChecked: 8,
    queryResults: [
      { query: 'best CRM for small business', mentioned: false, organicPosition: 35, hasAIOverview: true, mentionSnippet: null, competitorsMentioned: ['HubSpot', 'Salesforce', 'Zoho'] },
      { query: 'AI powered sales tools', mentioned: true, organicPosition: 8, hasAIOverview: true, mentionSnippet: 'SalesVelocity.ai offers AI-powered sales automation with built-in coaching...', competitorsMentioned: ['Gong', 'Outreach'] },
      { query: 'sales automation software', mentioned: false, organicPosition: 22, hasAIOverview: true, mentionSnippet: null, competitorsMentioned: ['HubSpot', 'Salesforce', 'Pipedrive'] },
      { query: 'CRM with AI assistant', mentioned: true, organicPosition: 6, hasAIOverview: true, mentionSnippet: 'SalesVelocity.ai provides an integrated AI sales assistant...', competitorsMentioned: ['Salesforce Einstein'] },
      { query: 'sales coaching platform', mentioned: true, organicPosition: 4, hasAIOverview: true, mentionSnippet: 'SalesVelocity.ai combines conversation intelligence with real-time coaching...', competitorsMentioned: ['Gong', 'Chorus'] },
      { query: 'lead management system', mentioned: false, organicPosition: 18, hasAIOverview: false, mentionSnippet: null, competitorsMentioned: [] },
      { query: 'pipeline management CRM', mentioned: false, organicPosition: 28, hasAIOverview: true, mentionSnippet: null, competitorsMentioned: ['Pipedrive', 'HubSpot'] },
      { query: 'AI sales rep software', mentioned: false, organicPosition: 12, hasAIOverview: true, mentionSnippet: null, competitorsMentioned: ['11x.ai', 'Artisan'] },
    ],
    competitorMentions: [
      { domain: 'hubspot.com', name: 'HubSpot', mentionCount: 4, mentionRate: 50 },
      { domain: 'salesforce.com', name: 'Salesforce', mentionCount: 3, mentionRate: 37.5 },
      { domain: 'gong.io', name: 'Gong', mentionCount: 2, mentionRate: 25 },
    ],
    initiatedBy: DEMO_OWNER_ID,
    isDemo: true,
  }];
}

// ── A6: Activity Log (10 docs) ───────────────────────────────────────────────

function getGrowthActivityLog(): SeedDoc[] {
  const activities: Array<{ type: string; message: string; hoursBack: number; actor: string; meta: Record<string, unknown> }> = [
    { type: 'competitor_added', message: 'Added HubSpot as a competitor', hoursBack: 336, actor: DEMO_OWNER_ID, meta: { competitorId: 'demo-competitor-001' } },
    { type: 'competitor_added', message: 'Added Salesforce as a competitor', hoursBack: 336, actor: DEMO_OWNER_ID, meta: { competitorId: 'demo-competitor-002' } },
    { type: 'competitor_added', message: 'Added Pipedrive as a competitor', hoursBack: 335, actor: DEMO_OWNER_ID, meta: { competitorId: 'demo-competitor-003' } },
    { type: 'competitor_analyzed', message: 'Full analysis completed for HubSpot — DA 93, 15.2M organic traffic', hoursBack: 280, actor: 'system', meta: { competitorId: 'demo-competitor-001' } },
    { type: 'keyword_added', message: 'Added 5 target keywords for tracking', hoursBack: 240, actor: DEMO_OWNER_ID, meta: { count: 5 } },
    { type: 'keyword_ranking_changed', message: '"AI sales assistant" moved from #8 to #5 (+3 positions)', hoursBack: 168, actor: 'system', meta: { keyword: 'AI sales assistant', oldPosition: 8, newPosition: 5 } },
    { type: 'strategy_generated', message: 'Growth strategy generated with 3 tiers (aggressive, competitive, scrappy)', hoursBack: 168, actor: 'system', meta: { strategyId: 'demo-strategy-001' } },
    { type: 'strategy_approved', message: 'Competitive tier approved — $12,000/month budget', hoursBack: 120, actor: DEMO_OWNER_ID, meta: { strategyId: 'demo-strategy-001', tier: 'competitive' } },
    { type: 'ai_visibility_checked', message: 'AI visibility check completed — score: 42/100, mentioned in 3/8 queries', hoursBack: 24, actor: 'system', meta: { score: 42 } },
    { type: 'cron_keyword_check', message: 'Automated keyword ranking check — 2 keywords improved, 1 declined', hoursBack: 12, actor: 'system', meta: { improved: 2, declined: 1, unchanged: 2 } },
  ];

  return activities.map((a, i) => ({
    id: `demo-growth-activity-${String(i + 1).padStart(3, '0')}`,
    type: a.type,
    message: a.message,
    timestamp: hoursAgoISO(a.hoursBack),
    actor: a.actor,
    metadata: a.meta,
    isDemo: true,
  }));
}

// ============================================================================
// [B] TEAM & COACHING
// ============================================================================

// ── B1: New Members (5 docs) ─────────────────────────────────────────────────

function getNewMembers(): SeedDoc[] {
  const memberData = [
    {
      member: MEMBER_4, role: 'member', title: 'Account Executive', department: 'Sales',
      metrics: { dealsClosed: 15, revenueGenerated: 280000, leadsCreated: 52, activitiesLogged: 210, winRate: 0.71, callsMade: 88, emailsSent: 275, meetingsHeld: 35, points: 1620 },
      daysJoined: 250,
    },
    {
      member: MEMBER_5, role: 'member', title: 'Business Development Rep', department: 'Sales',
      metrics: { dealsClosed: 8, revenueGenerated: 95000, leadsCreated: 78, activitiesLogged: 180, winRate: 0.58, callsMade: 145, emailsSent: 320, meetingsHeld: 22, points: 1100 },
      daysJoined: 150,
    },
    {
      member: MEMBER_6, role: 'admin', title: 'Enterprise Account Executive', department: 'Sales',
      metrics: { dealsClosed: 22, revenueGenerated: 450000, leadsCreated: 35, activitiesLogged: 260, winRate: 0.82, callsMade: 72, emailsSent: 190, meetingsHeld: 48, points: 2100 },
      daysJoined: 320,
    },
    {
      member: MEMBER_7, role: 'manager', title: 'Sales Operations Manager', department: 'Operations',
      metrics: { dealsClosed: 10, revenueGenerated: 180000, leadsCreated: 28, activitiesLogged: 195, winRate: 0.65, callsMade: 45, emailsSent: 280, meetingsHeld: 30, points: 1350 },
      daysJoined: 280,
    },
    {
      member: MEMBER_8, role: 'member', title: 'Inside Sales Rep', department: 'Sales',
      metrics: { dealsClosed: 4, revenueGenerated: 42000, leadsCreated: 65, activitiesLogged: 130, winRate: 0.45, callsMade: 165, emailsSent: 350, meetingsHeld: 12, points: 720 },
      daysJoined: 90,
    },
  ];

  return memberData.map(m => ({
    id: m.member.id,
    userId: m.member.id,
    displayName: m.member.name,
    name: m.member.name,
    email: m.member.email,
    role: m.role,
    title: m.title,
    department: m.department,
    status: 'active',
    joinedAt: daysAgo(m.daysJoined),
    lastActiveAt: hoursAgo(Math.floor(Math.random() * 12) + 1),
    metrics: m.metrics,
    isDemo: true,
  }));
}

// ── B2: Teams (2 docs) ──────────────────────────────────────────────────────

function getTeams(): SeedDoc[] {
  return [
    {
      id: 'demo-team-001',
      name: '(Demo) Sales Team',
      description: 'Full sales organization including AEs, BDRs, and management.',
      memberIds: FULL_TEAM.map(m => m.id),
      leaderId: DEMO_OWNER_ID,
      createdBy: DEMO_OWNER_ID,
      isDemo: true,
      createdAt: daysAgo(365),
      updatedAt: daysAgo(1),
    },
    {
      id: 'demo-team-002',
      name: '(Demo) BDR Team',
      description: 'Business Development Representatives focused on outbound prospecting.',
      memberIds: [MEMBER_3.id, MEMBER_5.id, MEMBER_8.id],
      leaderId: MEMBER_3.id,
      createdBy: DEMO_OWNER_ID,
      isDemo: true,
      createdAt: daysAgo(200),
      updatedAt: daysAgo(5),
    },
  ];
}

// ── B3: Conversation Analyses (24 new docs) ──────────────────────────────────

function getNewConversationAnalyses(): SeedDoc[] {
  const meetingTypes = ['discovery_call', 'demo', 'follow_up', 'negotiation', 'close_call'];
  const contactNames = [
    '(Demo) John Smith', '(Demo) Rachel Lee', '(Demo) Peter Jones', '(Demo) Tina Wilson',
    '(Demo) David Kim', '(Demo) Lisa Chen', '(Demo) Mark Taylor', '(Demo) Anna Johnson',
  ];

  // Per-member score ranges based on performance tier
  const memberScores: Record<string, { min: number; max: number; sentiment: number }> = {
    [DEMO_OWNER_ID]: { min: 78, max: 92, sentiment: 0.72 },
    [MEMBER_2.id]: { min: 82, max: 95, sentiment: 0.80 },
    [MEMBER_3.id]: { min: 55, max: 72, sentiment: 0.45 },
    [MEMBER_4.id]: { min: 72, max: 88, sentiment: 0.68 },
    [MEMBER_5.id]: { min: 58, max: 75, sentiment: 0.50 },
    [MEMBER_6.id]: { min: 85, max: 98, sentiment: 0.85 },
    [MEMBER_7.id]: { min: 68, max: 82, sentiment: 0.62 },
    [MEMBER_8.id]: { min: 48, max: 68, sentiment: 0.38 },
  };

  const docs: SeedDoc[] = [];
  let docIdx = 9; // Start after Part 3's 8 analyses

  for (const member of FULL_TEAM) {
    const scores = memberScores[member.id];
    for (let j = 0; j < 3; j++) {
      const dBack = 2 + j * 9 + Math.floor(Math.random() * 5); // Spread across ~28 days
      const overall = scores.min + Math.floor(Math.random() * (scores.max - scores.min));
      const jitter = (base: number) => Math.max(0, Math.min(100, base + Math.floor(Math.random() * 16) - 8));

      docs.push({
        id: `demo-analysis-${String(docIdx).padStart(3, '0')}`,
        conversationId: `demo-conv-${String(docIdx).padStart(3, '0')}`,
        repId: member.id,
        repName: member.name,
        contactName: cycle(contactNames, docIdx),
        contactId: `demo-contact-${String((docIdx % 8) + 1).padStart(3, '0')}`,
        meetingType: cycle(meetingTypes, docIdx + j),
        duration: 15 + Math.floor(Math.random() * 35),
        date: daysAgo(dBack),
        scores: {
          overall,
          engagement: jitter(overall),
          discovery: jitter(overall - 2),
          presentation: jitter(overall + 3),
          objection: jitter(overall - 5),
          closing: jitter(overall + 1),
          rapport: jitter(overall + 4),
          value: jitter(overall - 1),
        },
        sentiment: {
          overall: scores.sentiment + (Math.random() * 0.2 - 0.1),
          label: scores.sentiment > 0.6 ? 'positive' : scores.sentiment > 0.4 ? 'mixed' : 'negative',
          trend: j === 2 ? 'improving' : 'stable',
        },
        talkRatio: { rep: 40 + Math.floor(Math.random() * 20), prospect: 40 + Math.floor(Math.random() * 20) },
        topics: {
          discussed: ['pricing', 'product features', 'timeline', 'decision process'].slice(0, 2 + j),
          missed: overall < 70 ? ['ROI analysis', 'next steps'] : ['competitive landscape'],
        },
        redFlags: overall < 65 ? [{ flag: 'Low engagement from prospect', severity: 'medium', context: 'Prospect was distracted during key value prop section' }] : [],
        recommendations: overall < 75
          ? ['Focus on asking more discovery questions', 'Improve objection handling techniques']
          : ['Continue strong performance', 'Mentor junior reps on closing techniques'],
        summary: `${overall >= 75 ? 'Strong' : 'Developing'} ${cycle(meetingTypes, docIdx + j).replace('_', ' ')} with ${cycle(contactNames, docIdx)}. Overall score: ${overall}/100.`,
        isDemo: true,
        createdAt: daysAgo(dBack),
        updatedAt: daysAgo(dBack),
      });
      docIdx++;
    }
  }

  return docs;
}

// ── B4: New Users (5 docs, top-level) ────────────────────────────────────────

function getNewUsers(): SeedDoc[] {
  const newMemberData = getNewMembers();
  const colors = ['8B5CF6', 'EC4899', '14B8A6', 'F97316', '6366F1'];

  return newMemberData.map((m, i) => ({
    id: m.id as string,
    email: m.email as string,
    displayName: m.displayName as string,
    role: m.role as string,
    title: m.title as string,
    department: m.department as string,
    status: 'active',
    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent((m.displayName as string).replace('(Demo) ', ''))}&background=${colors[i]}&color=fff`,
    lastLoginAt: hoursAgo(Math.floor(Math.random() * 24)),
    customPermissions: {},
    isDemo: true,
    createdAt: daysAgo(365),
    updatedAt: hoursAgo(1),
  }));
}

// ============================================================================
// [C] PLAYBOOKS (3 docs — correct shape)
// ============================================================================

function getPlaybooks(): SeedDoc[] {
  const baseTimestamp = daysAgo(30);

  return [
    // ── Playbook 1: Discovery Call ─────────────────────────────────────
    {
      id: 'demo-playbook-001',
      name: '(Demo) Discovery Call Playbook',
      description: 'Proven patterns and talk tracks for effective discovery calls that uncover pain points and qualify opportunities.',
      category: 'discovery',
      tags: ['discovery', 'qualification', 'pain-points'],
      conversationType: 'discovery_call',
      industry: 'SaaS',
      dealSize: 'mid_market',
      patterns: [
        {
          id: 'pat-d-001', name: 'Pain-First Opening', description: 'Open with a pain-focused question rather than a product pitch.',
          category: 'opening', situation: 'When starting a discovery call', approach: 'Ask about their biggest challenge before introducing your solution', outcome: 'Prospects engage 40% more when they feel heard first',
          examples: [{ conversationId: 'demo-conv-001', repId: MEMBER_6.id, repName: MEMBER_6.name, timestamp: 30, situation: 'Opening of discovery call', quote: "Before I tell you about us, I'd love to understand — what's the biggest challenge your sales team faces right now?", outcome: 'Prospect opened up about pipeline visibility issues', sentimentBefore: 0.3, sentimentAfter: 0.7, effectiveness: 'excellent' as const, keyFactors: ['Shows empathy', 'Lets prospect lead'] }],
          frequency: 85, successRate: 88, avgImpact: 82,
          sourceConversationIds: ['demo-conv-001', 'demo-conv-003'], topPerformerIds: [MEMBER_6.id, MEMBER_2.id],
          applicableWhen: [{ type: 'conversation_type', condition: 'equals', value: 'discovery_call', operator: 'equals' }],
          avgSentimentChange: 0.35, avgScoreChange: 12, confidence: 90, sampleSize: 45,
        },
        {
          id: 'pat-d-002', name: 'Stakeholder Mapping', description: 'Identify all decision-makers early in the conversation.',
          category: 'discovery_question', situation: 'After initial rapport is established', approach: 'Ask who else would be involved in evaluating and deciding on a solution', outcome: 'Deals close 25% faster when stakeholders are identified early',
          examples: [{ conversationId: 'demo-conv-005', repId: MEMBER_2.id, repName: MEMBER_2.name, timestamp: 300, situation: 'Mid-discovery after pain identified', quote: "When your team evaluates new tools, who typically needs to sign off? I want to make sure we address everyone's concerns.", outcome: 'Prospect revealed CFO and IT Director involvement', sentimentBefore: 0.5, sentimentAfter: 0.65, effectiveness: 'good' as const, keyFactors: ['Non-threatening phrasing', 'Shows thoroughness'] }],
          frequency: 72, successRate: 80, avgImpact: 75,
          sourceConversationIds: ['demo-conv-005'], topPerformerIds: [MEMBER_2.id],
          applicableWhen: [{ type: 'stage', condition: 'equals', value: 'discovery', operator: 'equals' }],
          avgSentimentChange: 0.15, avgScoreChange: 8, confidence: 82, sampleSize: 38,
        },
      ],
      talkTracks: [
        {
          id: 'tt-d-001', name: 'Value Discovery Framework', description: 'Structured approach to uncovering business impact of pain points.',
          purpose: 'discovery', script: "I appreciate you sharing that. Help me understand — when [pain point] happens, what does that actually cost your team? Not just in dollars, but in time, missed opportunities, team morale?",
          keyPhrases: ['help me understand', 'what does that actually cost', 'not just in dollars'], tonality: 'consultative', pace: 'slow',
          structure: [
            { order: 1, name: 'Acknowledge', content: 'Validate the pain point they shared', purpose: 'Build trust', estimatedDuration: 10, criticalPoints: ['Show genuine empathy'] },
            { order: 2, name: 'Quantify', content: 'Help them calculate the real cost', purpose: 'Create urgency through numbers', estimatedDuration: 45, criticalPoints: ['Use their language', 'Let them do the math'] },
          ],
          variations: [{ id: 'tt-d-001-v1', name: 'Executive version', script: "What does this mean for your quarterly targets?", differencesFrom: 'More direct, focuses on exec-level metrics', useCase: 'C-suite prospects', successRate: 91, sampleSize: 12 }],
          useWhen: ['After prospect shares a pain point', 'During qualification phase'], avoidWhen: ['Prospect is time-constrained', 'Already quantified the problem'],
          successRate: 85, avgSentimentScore: 0.72, avgConversionRate: 68,
          sourceConversationIds: ['demo-conv-001', 'demo-conv-003', 'demo-conv-005'], originatingRepId: MEMBER_6.id, originatingRepName: MEMBER_6.name,
          adoptionRate: 78, usageCount: 156, avgTimeToDeliver: 55, avgSentimentChange: 0.28, confidence: 88, sampleSize: 52,
        },
      ],
      objectionResponses: [
        {
          id: 'or-d-001', objectionType: 'timing', objectionText: "We're not looking at this right now.", variations: ["It's not a priority this quarter", "We'll revisit next year", "Bad timing for us"],
          response: "I completely understand timing is everything. Can I ask — what would need to change for this to become a priority? And what's the cost of waiting another quarter with the current challenges?",
          responseType: 'question_based', strategy: 'reframe', keyTechniques: ['Cost of inaction', 'Future pacing'],
          examples: [{ conversationId: 'demo-conv-003', repId: MEMBER_6.id, repName: MEMBER_6.name, dealSize: 45000, industry: 'SaaS', stage: 'Discovery', objectionQuote: "We're focused on other initiatives right now.", objectionSeverity: 'medium' as const, responseQuote: "What's the cost of waiting another quarter?", outcome: 'resolved' as const, dealWon: true, sentimentBefore: 0.2, sentimentAfter: 0.55, successFactors: ['Reframed as cost of inaction'], lessonsLearned: ['Let prospect quantify the cost themselves'] }],
          successRate: 72, avgSentimentChange: 0.3, dealSaveRate: 55,
          sourceConversationIds: ['demo-conv-003'], topPerformerIds: [MEMBER_6.id],
          worksWellWith: ['pat-d-001'], followUpWith: ['tt-d-001'],
          avgTimeToResolve: 120, avgTurnsToResolve: 3, confidence: 78, sampleSize: 28,
        },
      ],
      bestPractices: [
        {
          id: 'bp-d-001', title: 'Listen More Than You Talk', description: 'Top performers maintain a 30/70 talk ratio during discovery.',
          category: 'listening', whatToDo: 'Ask open-ended questions and let the prospect talk for 70% of the call.', whatNotToDo: 'Avoid jumping in with solutions before fully understanding the problem.',
          rationale: 'Prospects who feel heard are 3x more likely to move to the next stage.',
          evidence: [{ metric: 'Talk Ratio', topPerformerAvg: 30, teamAvg: 52, lift: 22, significance: 'high' as const, description: 'Top performers talk significantly less during discovery' }],
          implementationSteps: ['Set a timer reminder at 5-minute intervals', 'Use silence as a tool — count to 3 before responding', 'Keep notes on prospect statements to reference later'],
          difficulty: 'medium' as const, impactOnConversions: 15, impactOnSentiment: 0.25, impactOnWinRate: 12,
          topPerformerIds: [MEMBER_6.id, MEMBER_2.id], sourceConversationIds: ['demo-conv-001', 'demo-conv-003'],
          adoptionRate: 65, timeToMaster: '2-3 weeks', repsUsingIt: 5, avgSuccessRate: 82, confidence: 85, sampleSize: 40,
        },
      ],
      successMetrics: {
        avgConversionRate: 68, vsBaselineConversion: 12,
        avgSentimentScore: 0.72, vsBaselineSentiment: 0.18,
        avgOverallScore: 82, vsBaselineScore: 10,
        objectionSuccessRate: 72, vsBaselineObjectionSuccess: 15,
        winRate: 65, vsBaselineWinRate: 8,
        conversationsAnalyzed: 52, repsUsing: 6,
        confidence: 88,
      },
      sourceConversations: ['demo-conv-001', 'demo-conv-003', 'demo-conv-005'],
      topPerformers: [MEMBER_6.id, MEMBER_2.id],
      adoptionRate: 78, effectiveness: 82, usageCount: 234,
      status: 'active', confidence: 88,
      createdBy: DEMO_OWNER_ID,
      version: 2,
      isDemo: true,
      createdAt: baseTimestamp,
      updatedAt: daysAgo(3),
    },

    // ── Playbook 2: Objection Handling ─────────────────────────────────
    {
      id: 'demo-playbook-002',
      name: '(Demo) Objection Handling Playbook',
      description: 'Battle-tested responses to the most common sales objections with proven techniques from top performers.',
      category: 'objection_handling',
      tags: ['objections', 'negotiation', 'pricing'],
      conversationType: 'negotiation',
      industry: 'SaaS',
      dealSize: 'any',
      patterns: [
        {
          id: 'pat-o-001', name: 'Acknowledge-Isolate-Address', description: 'Three-step framework for handling any objection.',
          category: 'objection_response', situation: 'When prospect raises an objection', approach: 'Acknowledge the concern, isolate it as the only barrier, then address it directly', outcome: 'Objections resolved 60% more effectively',
          examples: [{ conversationId: 'demo-conv-007', repId: MEMBER_6.id, repName: MEMBER_6.name, timestamp: 600, situation: 'Pricing objection during negotiation', quote: "That's a fair concern. If we could find a way to address the pricing, is there anything else that would prevent us from moving forward?", outcome: 'Isolated pricing as sole objection, resolved with annual discount', sentimentBefore: 0.2, sentimentAfter: 0.6, effectiveness: 'excellent' as const, keyFactors: ['Validates concern', 'Isolates objection', 'Creates commitment'] }],
          frequency: 78, successRate: 82, avgImpact: 78,
          sourceConversationIds: ['demo-conv-007'], topPerformerIds: [MEMBER_6.id, MEMBER_4.id],
          applicableWhen: [{ type: 'objection_type', condition: 'in', value: ['pricing', 'timing', 'competition'], operator: 'in' }],
          avgSentimentChange: 0.35, avgScoreChange: 15, confidence: 85, sampleSize: 42,
        },
      ],
      talkTracks: [
        {
          id: 'tt-o-001', name: 'Price-to-Value Reframe', description: 'Shift the conversation from price to ROI and value delivered.',
          purpose: 'pricing_discussion', script: "I hear you on the investment. Let me ask — based on what you've told me about losing $X per month to [pain], if we could cut that by even 50%, what would that be worth over a year?",
          keyPhrases: ['investment', 'based on what you told me', 'what would that be worth'], tonality: 'consultative', pace: 'moderate',
          structure: [
            { order: 1, name: 'Acknowledge price concern', content: 'Validate without discounting', purpose: 'Show respect for their budget constraints', estimatedDuration: 10, criticalPoints: ['Never apologize for pricing'] },
            { order: 2, name: 'Reframe to value', content: 'Use their own numbers to show ROI', purpose: 'Make the value undeniable', estimatedDuration: 30, criticalPoints: ['Use prospect data, not generic claims'] },
          ],
          variations: [],
          useWhen: ['Prospect mentions price is too high', 'During contract negotiation'], avoidWhen: ['Prospect has a hard budget cap', 'Very early in sales cycle'],
          successRate: 79, avgSentimentScore: 0.65, avgConversionRate: 62,
          sourceConversationIds: ['demo-conv-007'], originatingRepId: MEMBER_6.id, originatingRepName: MEMBER_6.name,
          adoptionRate: 70, usageCount: 89, avgTimeToDeliver: 40, avgSentimentChange: 0.32, confidence: 80, sampleSize: 35,
        },
      ],
      objectionResponses: [
        {
          id: 'or-o-001', objectionType: 'pricing', objectionText: "It's too expensive.", variations: ["We can't afford it", "It's over our budget", "The price is too high"],
          response: "I understand budget is important. Let me show you what our customers typically save — most see a 3x return within 6 months. Can we walk through the ROI based on your specific numbers?",
          responseType: 'data_driven', strategy: 'evidence', keyTechniques: ['Social proof', 'Personalized ROI', 'Assumptive next step'],
          examples: [{ conversationId: 'demo-conv-007', repId: MEMBER_6.id, repName: MEMBER_6.name, dealSize: 56000, industry: 'Technology', stage: 'Negotiation', objectionQuote: "This is way over our budget for this quarter.", objectionSeverity: 'high' as const, responseQuote: "Let me show you the ROI our similar-sized clients see...", outcome: 'resolved' as const, dealWon: true, sentimentBefore: 0.15, sentimentAfter: 0.6, successFactors: ['Used case study data', 'Personalized to their situation'], lessonsLearned: ['Always have 3 relevant case studies ready'] }],
          successRate: 75, avgSentimentChange: 0.38, dealSaveRate: 62,
          sourceConversationIds: ['demo-conv-007'], topPerformerIds: [MEMBER_6.id],
          worksWellWith: ['pat-o-001'], followUpWith: ['tt-o-001'],
          avgTimeToResolve: 180, avgTurnsToResolve: 4, confidence: 82, sampleSize: 48,
        },
        {
          id: 'or-o-002', objectionType: 'competition', objectionText: "We're already using [competitor].", variations: ["We're happy with our current solution", "We just signed with someone else"],
          response: "That makes sense — [competitor] is a solid choice for [their strength]. Where our customers find we really shine is [our differentiator]. Would it be worth a quick comparison on the areas that matter most to you?",
          responseType: 'comparison', strategy: 'reframe', keyTechniques: ['Acknowledge competitor', 'Position strength', 'Offer value-based comparison'],
          examples: [],
          successRate: 68, avgSentimentChange: 0.22, dealSaveRate: 45,
          sourceConversationIds: ['demo-conv-009'], topPerformerIds: [MEMBER_4.id],
          worksWellWith: ['pat-o-001'], followUpWith: [],
          avgTimeToResolve: 150, avgTurnsToResolve: 3, confidence: 75, sampleSize: 22,
        },
      ],
      bestPractices: [
        {
          id: 'bp-o-001', title: 'Never Argue With Objections', description: 'Top performers agree with the concern before redirecting.',
          category: 'objection_handling', whatToDo: 'Start every objection response with acknowledgment: "I understand", "That makes sense", "Fair point".', whatNotToDo: 'Never say "but" immediately after acknowledging. Use "and" instead.',
          rationale: 'Arguing triggers defensiveness. Agreement opens the prospect to hearing alternatives.',
          evidence: [{ metric: 'Objection Resolution Rate', topPerformerAvg: 78, teamAvg: 52, lift: 26, significance: 'high' as const, description: 'Reps who acknowledge first resolve objections 26% more often' }],
          implementationSteps: ['Practice the acknowledge-pause-redirect pattern', 'Role-play common objections weekly', 'Record and review objection handling in call reviews'],
          difficulty: 'easy' as const, impactOnConversions: 18, impactOnSentiment: 0.3, impactOnWinRate: 15,
          topPerformerIds: [MEMBER_6.id, MEMBER_2.id, MEMBER_4.id], sourceConversationIds: ['demo-conv-007', 'demo-conv-009'],
          adoptionRate: 72, timeToMaster: '1-2 weeks', repsUsingIt: 6, avgSuccessRate: 78, confidence: 88, sampleSize: 55,
        },
      ],
      successMetrics: {
        avgConversionRate: 62, vsBaselineConversion: 10,
        avgSentimentScore: 0.65, vsBaselineSentiment: 0.20,
        avgOverallScore: 78, vsBaselineScore: 8,
        objectionSuccessRate: 78, vsBaselineObjectionSuccess: 22,
        winRate: 58, vsBaselineWinRate: 6,
        conversationsAnalyzed: 48, repsUsing: 6,
        confidence: 85,
      },
      sourceConversations: ['demo-conv-007', 'demo-conv-009'],
      topPerformers: [MEMBER_6.id, MEMBER_4.id],
      adoptionRate: 72, effectiveness: 78, usageCount: 189,
      status: 'active', confidence: 85,
      createdBy: DEMO_OWNER_ID,
      version: 1,
      isDemo: true,
      createdAt: baseTimestamp,
      updatedAt: daysAgo(5),
    },

    // ── Playbook 3: Closing Techniques ─────────────────────────────────
    {
      id: 'demo-playbook-003',
      name: '(Demo) Closing Techniques Playbook',
      description: 'High-conversion closing techniques extracted from top performers with 80%+ win rates.',
      category: 'closing',
      tags: ['closing', 'deal-acceleration', 'commitment'],
      conversationType: 'close_call',
      industry: 'SaaS',
      dealSize: 'mid_market',
      patterns: [
        {
          id: 'pat-c-001', name: 'Assumptive Close', description: 'Transition naturally from discussion to next steps as if the decision is made.',
          category: 'closing_technique', situation: 'After all objections have been addressed', approach: 'Frame next steps in terms of implementation rather than decision', outcome: 'Reduces decision anxiety and accelerates close by 35%',
          examples: [{ conversationId: 'demo-conv-010', repId: MEMBER_6.id, repName: MEMBER_6.name, timestamp: 1800, situation: 'End of close call, all concerns addressed', quote: "Great, so for onboarding, I'd recommend starting with your sales team of 15. Should we target a Monday kick-off or would mid-week work better for your team?", outcome: 'Prospect agreed to Monday onboarding, deal closed same day', sentimentBefore: 0.6, sentimentAfter: 0.85, effectiveness: 'excellent' as const, keyFactors: ['Natural transition', 'Binary choice instead of yes/no', 'Implementation-focused'] }],
          frequency: 65, successRate: 78, avgImpact: 85,
          sourceConversationIds: ['demo-conv-010'], topPerformerIds: [MEMBER_6.id],
          applicableWhen: [{ type: 'stage', condition: 'equals', value: 'closing', operator: 'equals' }],
          avgSentimentChange: 0.25, avgScoreChange: 18, confidence: 82, sampleSize: 30,
        },
      ],
      talkTracks: [
        {
          id: 'tt-c-001', name: 'Summary Close', description: 'Summarize all agreed-upon value points before asking for commitment.',
          purpose: 'closing', script: "Let me make sure I have everything right. You mentioned [pain 1], [pain 2], and [pain 3] as your top priorities. We've shown how we address each of those, and you liked the ROI projection. The team is ready to start. What do you need from me to get the paperwork started?",
          keyPhrases: ['let me make sure', 'you mentioned', 'what do you need from me'], tonality: 'professional', pace: 'moderate',
          structure: [
            { order: 1, name: 'Recap pain points', content: 'List the problems they confirmed', purpose: 'Reinforce why they need this', estimatedDuration: 15, criticalPoints: ['Use their exact words'] },
            { order: 2, name: 'Recap solutions', content: 'Map each pain to your solution', purpose: 'Show completeness', estimatedDuration: 20, criticalPoints: ['Reference their positive reactions'] },
            { order: 3, name: 'Ask for action', content: 'Request next step', purpose: 'Close', estimatedDuration: 10, criticalPoints: ['Make it easy to say yes'] },
          ],
          variations: [],
          useWhen: ['End of sales cycle', 'After demo where prospect was engaged'], avoidWhen: ['Unresolved objections remain', 'Key stakeholder is missing'],
          successRate: 82, avgSentimentScore: 0.78, avgConversionRate: 72,
          sourceConversationIds: ['demo-conv-010'], originatingRepId: MEMBER_6.id, originatingRepName: MEMBER_6.name,
          adoptionRate: 68, usageCount: 78, avgTimeToDeliver: 45, avgSentimentChange: 0.22, confidence: 80, sampleSize: 28,
        },
      ],
      objectionResponses: [
        {
          id: 'or-c-001', objectionType: 'authority', objectionText: "I need to run this by my boss.", variations: ["I can't make this decision alone", "Let me check with my team"],
          response: "Absolutely, that makes sense. Would it help if I put together a one-page executive summary you can share? And would a 15-minute call with your boss be useful — I can address their specific concerns directly.",
          responseType: 'social_proof', strategy: 'question', keyTechniques: ['Offer to help', 'Create next meeting', 'Remove friction'],
          examples: [],
          successRate: 70, avgSentimentChange: 0.18, dealSaveRate: 58,
          sourceConversationIds: ['demo-conv-010'], topPerformerIds: [MEMBER_6.id, MEMBER_2.id],
          worksWellWith: ['pat-c-001'], followUpWith: ['tt-c-001'],
          avgTimeToResolve: 90, avgTurnsToResolve: 2, confidence: 76, sampleSize: 25,
        },
      ],
      bestPractices: [
        {
          id: 'bp-c-001', title: 'Always Set a Specific Next Step', description: 'Never end a call without a calendar invite for the next interaction.',
          category: 'closing', whatToDo: 'Book the next meeting while still on the current call. Send the invite before hanging up.', whatNotToDo: 'Never say "I\'ll follow up next week" without a specific date and time.',
          rationale: 'Deals without scheduled next steps are 4x more likely to stall.',
          evidence: [{ metric: 'Deal Velocity', topPerformerAvg: 18, teamAvg: 32, lift: 14, significance: 'high' as const, description: 'Top performers close deals 14 days faster by always booking next steps' }],
          implementationSteps: ['Always have your calendar open during calls', 'Propose 2-3 specific times', 'Send calendar invite while still on the call'],
          difficulty: 'easy' as const, impactOnConversions: 22, impactOnSentiment: 0.15, impactOnWinRate: 18,
          topPerformerIds: [MEMBER_6.id, MEMBER_2.id, MEMBER_4.id], sourceConversationIds: ['demo-conv-010'],
          adoptionRate: 80, timeToMaster: '1 week', repsUsingIt: 7, avgSuccessRate: 85, confidence: 92, sampleSize: 60,
        },
      ],
      successMetrics: {
        avgConversionRate: 72, vsBaselineConversion: 18,
        avgSentimentScore: 0.78, vsBaselineSentiment: 0.22,
        avgOverallScore: 85, vsBaselineScore: 12,
        objectionSuccessRate: 70, vsBaselineObjectionSuccess: 18,
        winRate: 72, vsBaselineWinRate: 14,
        conversationsAnalyzed: 30, repsUsing: 5,
        confidence: 82,
      },
      sourceConversations: ['demo-conv-010'],
      topPerformers: [MEMBER_6.id, MEMBER_2.id],
      adoptionRate: 68, effectiveness: 85, usageCount: 145,
      status: 'active', confidence: 82,
      createdBy: DEMO_OWNER_ID,
      version: 1,
      isDemo: true,
      createdAt: baseTimestamp,
      updatedAt: daysAgo(2),
    },
  ];
}

// ============================================================================
// [D] A/B TESTS (3 docs)
// ============================================================================

function getAbTests(): SeedDoc[] {
  return [
    {
      id: 'demo-abtest-001',
      name: '(Demo) Subject Line — Question vs Statement',
      description: 'Testing whether question-based subject lines outperform statement-based ones for cold outreach.',
      variantA: { name: 'Question Format', sequenceId: 'demo-sequence-001', description: 'Subject lines phrased as questions' },
      variantB: { name: 'Statement Format', sequenceId: 'demo-sequence-002', description: 'Subject lines phrased as direct statements' },
      hypothesis: 'Question-based subject lines will achieve higher open rates due to curiosity gap.',
      successMetric: 'reply_rate',
      trafficSplit: 50,
      minimumSampleSize: 200,
      minimumDuration: 14,
      status: 'draft',
      createdAt: daysAgo(3),
      createdBy: MEMBER_2.id,
      isDemo: true,
    },
    {
      id: 'demo-abtest-002',
      name: '(Demo) Follow-up Timing — 2-Day vs 4-Day',
      description: 'Testing optimal follow-up interval between sequence steps.',
      variantA: { name: '2-Day Interval', sequenceId: 'demo-sequence-001', description: 'Follow up every 2 days' },
      variantB: { name: '4-Day Interval', sequenceId: 'demo-sequence-001', description: 'Follow up every 4 days' },
      hypothesis: 'Shorter follow-up intervals will drive higher reply rates without increasing unsubscribes.',
      successMetric: 'meeting_rate',
      trafficSplit: 50,
      minimumSampleSize: 150,
      minimumDuration: 21,
      status: 'running',
      startedAt: daysAgo(10),
      variantAMetrics: { recipients: 78, metric: 12.8, confidence: 72 },
      variantBMetrics: { recipients: 82, metric: 9.5, confidence: 68 },
      createdAt: daysAgo(12),
      createdBy: MEMBER_4.id,
      isDemo: true,
    },
    {
      id: 'demo-abtest-003',
      name: '(Demo) Personalization vs Template',
      description: 'Testing fully personalized emails against optimized templates.',
      variantA: { name: 'Personalized', sequenceId: 'demo-sequence-002', description: 'Each email customized with prospect-specific details' },
      variantB: { name: 'Template', sequenceId: 'demo-sequence-002', description: 'Optimized template with minimal personalization' },
      hypothesis: 'Personalized emails will outperform templates on reply rate and meeting conversion.',
      successMetric: 'opportunity_rate',
      trafficSplit: 50,
      minimumSampleSize: 100,
      minimumDuration: 14,
      status: 'completed',
      startedAt: daysAgo(28),
      completedAt: daysAgo(14),
      variantAMetrics: { recipients: 125, metric: 18.4, confidence: 95 },
      variantBMetrics: { recipients: 130, metric: 11.2, confidence: 95 },
      result: 'variant_a_wins',
      statisticalSignificance: 0.98,
      pValue: 0.02,
      winningVariant: 'A',
      lift: 64.3,
      createdAt: daysAgo(30),
      createdBy: MEMBER_2.id,
      isDemo: true,
    },
  ];
}

// ============================================================================
// [E] CALLS (5 docs)
// ============================================================================

function getCalls(): SeedDoc[] {
  const calls = [
    { idx: 1, contactName: '(Demo) John Smith', contactId: 'demo-contact-001', from: '+15551001234', to: '+15559876543', direction: 'outbound' as const, status: 'completed' as const, duration: 1245, hoursBack: 4 },
    { idx: 2, contactName: '(Demo) Rachel Lee', contactId: 'demo-contact-003', from: '+15559876543', to: '+15551001234', direction: 'inbound' as const, status: 'completed' as const, duration: 840, hoursBack: 28 },
    { idx: 3, contactName: '(Demo) Peter Jones', contactId: 'demo-contact-005', from: '+15551001234', to: '+15553456789', direction: 'outbound' as const, status: 'no-answer' as const, duration: 0, hoursBack: 52 },
    { idx: 4, contactName: '(Demo) Tina Wilson', contactId: 'demo-contact-008', from: '+15553456789', to: '+15551001234', direction: 'inbound' as const, status: 'completed' as const, duration: 2100, hoursBack: 72 },
    { idx: 5, contactName: '(Demo) David Kim', contactId: 'demo-contact-002', from: '+15551001234', to: '+15557654321', direction: 'outbound' as const, status: 'busy' as const, duration: 0, hoursBack: 120 },
  ];

  return calls.map(c => ({
    id: `demo-call-${String(c.idx).padStart(3, '0')}`,
    callId: `demo-call-${String(c.idx).padStart(3, '0')}`,
    contactName: c.contactName,
    contactId: c.contactId,
    from: c.from,
    to: c.to,
    direction: c.direction,
    status: c.status,
    duration: c.duration,
    recordingUrl: c.status === 'completed' ? `https://storage.example.com/recordings/demo-call-${c.idx}.mp3` : null,
    startTime: hoursAgo(c.hoursBack),
    endTime: c.duration > 0 ? hoursAgo(c.hoursBack - (c.duration / 3600)) : null,
    answeredBy: c.status === 'completed' ? 'human' : null,
    repId: cycle([DEMO_OWNER_ID, MEMBER_2.id, MEMBER_4.id, MEMBER_6.id], c.idx),
    notes: c.status === 'completed' ? `(Demo) Follow-up call with ${c.contactName.replace('(Demo) ', '')}. Discussed next steps.` : null,
    isDemo: true,
    createdAt: hoursAgo(c.hoursBack),
    updatedAt: hoursAgo(c.hoursBack),
  }));
}

// ============================================================================
// [F] VIDEO PIPELINE PROJECTS (2 docs)
// ============================================================================

function getVideoPipelineProjects(): SeedDoc[] {
  return [
    {
      id: 'demo-video-001',
      name: '(Demo) SalesVelocity Product Overview',
      type: 'product-demo',
      currentStep: 'post-production',
      brief: {
        description: 'A comprehensive product demo showcasing SalesVelocity.ai key features for enterprise prospects.',
        videoType: 'product-demo',
        platform: 'youtube',
        duration: 120,
        aspectRatio: '16:9',
        resolution: '1080p',
      },
      scenes: [
        { id: 'scene-001', sceneNumber: 1, scriptText: 'Welcome to SalesVelocity.ai — the AI-powered sales platform that transforms how your team sells.', screenshotUrl: null, avatarId: null, voiceId: null, duration: 15, engine: 'heygen', status: 'completed' },
        { id: 'scene-002', sceneNumber: 2, scriptText: 'Let me show you how our AI coaching engine analyzes every conversation and provides real-time coaching tips.', screenshotUrl: null, avatarId: null, voiceId: null, duration: 30, engine: 'heygen', status: 'completed' },
        { id: 'scene-003', sceneNumber: 3, scriptText: 'With our Growth Command Center, you can monitor competitors, track keyword rankings, and get AI-generated strategies.', screenshotUrl: null, avatarId: null, voiceId: null, duration: 35, engine: 'heygen', status: 'completed' },
        { id: 'scene-004', sceneNumber: 4, scriptText: 'Ready to transform your sales? Start your free trial at SalesVelocity.ai today.', screenshotUrl: null, avatarId: null, voiceId: null, duration: 15, engine: 'heygen', status: 'completed' },
      ],
      avatarId: null,
      avatarName: null,
      voiceId: null,
      voiceName: null,
      generatedScenes: [
        { sceneId: 'scene-001', providerVideoId: 'hg-demo-001', provider: 'heygen', status: 'completed', videoUrl: 'https://storage.example.com/videos/demo-scene-001.mp4', thumbnailUrl: 'https://storage.example.com/thumbs/demo-scene-001.jpg', progress: 100, error: null },
        { sceneId: 'scene-002', providerVideoId: 'hg-demo-002', provider: 'heygen', status: 'completed', videoUrl: 'https://storage.example.com/videos/demo-scene-002.mp4', thumbnailUrl: 'https://storage.example.com/thumbs/demo-scene-002.jpg', progress: 100, error: null },
        { sceneId: 'scene-003', providerVideoId: 'hg-demo-003', provider: 'heygen', status: 'completed', videoUrl: 'https://storage.example.com/videos/demo-scene-003.mp4', thumbnailUrl: 'https://storage.example.com/thumbs/demo-scene-003.jpg', progress: 100, error: null },
        { sceneId: 'scene-004', providerVideoId: 'hg-demo-004', provider: 'heygen', status: 'completed', videoUrl: 'https://storage.example.com/videos/demo-scene-004.mp4', thumbnailUrl: 'https://storage.example.com/thumbs/demo-scene-004.jpg', progress: 100, error: null },
      ],
      finalVideoUrl: 'https://storage.example.com/videos/demo-final-product-overview.mp4',
      transitionType: 'dissolve',
      status: 'completed',
      createdAt: daysAgoISO(14),
      updatedAt: daysAgoISO(7),
      createdBy: DEMO_OWNER_ID,
      isDemo: true,
    },
    {
      id: 'demo-video-002',
      name: '(Demo) LinkedIn Sales Pitch Ad',
      type: 'social-ad',
      currentStep: 'generation',
      brief: {
        description: 'Short-form sales pitch ad for LinkedIn targeting sales leaders.',
        videoType: 'social-ad',
        platform: 'linkedin',
        duration: 30,
        aspectRatio: '1:1',
        resolution: '1080p',
      },
      scenes: [
        { id: 'scene-005', sceneNumber: 1, scriptText: "Your sales team is leaving money on the table. Here's why.", screenshotUrl: null, avatarId: null, voiceId: null, duration: 8, engine: 'runway', status: 'generating' },
        { id: 'scene-006', sceneNumber: 2, scriptText: 'SalesVelocity.ai uses AI to coach every rep in real-time — no more guessing.', screenshotUrl: null, avatarId: null, voiceId: null, duration: 12, engine: 'runway', status: 'draft' },
        { id: 'scene-007', sceneNumber: 3, scriptText: 'Start closing more deals today. Visit salesvelocity.ai.', screenshotUrl: null, avatarId: null, voiceId: null, duration: 8, engine: 'runway', status: 'draft' },
      ],
      avatarId: null,
      avatarName: null,
      voiceId: null,
      voiceName: null,
      generatedScenes: [
        { sceneId: 'scene-005', providerVideoId: 'rw-demo-005', provider: 'runway', status: 'generating', videoUrl: null, thumbnailUrl: null, progress: 45, error: null },
      ],
      finalVideoUrl: null,
      transitionType: 'cut',
      status: 'generating',
      createdAt: daysAgoISO(3),
      updatedAt: hoursAgoISO(6),
      createdBy: MEMBER_2.id,
      isDemo: true,
    },
  ];
}

// ============================================================================
// [G] AI WORKFORCE / AGENT SWARM
// ============================================================================

// ── G1: Agent Rep Profiles (5 docs) ──────────────────────────────────────────

function getAgentRepProfiles(): SeedDoc[] {
  const agents: Array<{
    domain: string;
    name: string;
    flagBelow: number;
    excellentAbove: number;
    goldenMasterId: string;
  }> = [
    { domain: 'chat', name: '(Demo) Sales Chat Agent', flagBelow: 65, excellentAbove: 90, goldenMasterId: 'demo-gm-chat-001' },
    { domain: 'voice', name: '(Demo) Voice Agent', flagBelow: 60, excellentAbove: 88, goldenMasterId: 'demo-gm-voice-001' },
    { domain: 'email', name: '(Demo) Email Agent', flagBelow: 60, excellentAbove: 85, goldenMasterId: 'demo-gm-email-001' },
    { domain: 'social', name: '(Demo) Social Media Agent', flagBelow: 60, excellentAbove: 85, goldenMasterId: 'demo-gm-social-001' },
    { domain: 'seo', name: '(Demo) SEO Content Agent', flagBelow: 55, excellentAbove: 85, goldenMasterId: 'demo-gm-seo-001' },
  ];

  return agents.map(a => ({
    id: `demo-agent-${a.domain}`,
    agentId: `demo-agent-${a.domain}`,
    agentType: a.domain,
    agentName: a.name,
    isAI: true,
    goldenMasterId: a.goldenMasterId,
    performanceThresholds: {
      flagForTrainingBelow: a.flagBelow,
      excellentAbove: a.excellentAbove,
    },
    createdAt: daysAgoISO(60),
    updatedAt: daysAgoISO(1),
    isDemo: true,
  }));
}

// ── G2: Agent Performance (20 docs) ──────────────────────────────────────────

function getAgentPerformance(): SeedDoc[] {
  const agentDomains = ['chat', 'voice', 'email', 'social', 'seo'];
  const docs: SeedDoc[] = [];

  // 4 performance entries per agent, spread over 14 days
  const severities = ['PASS', 'PASS', 'MINOR', 'PASS'] as const;
  const baseScores: Record<string, number> = {
    chat: 88, voice: 82, email: 78, social: 75, seo: 85,
  };

  let idx = 1;
  for (const domain of agentDomains) {
    const agentId = `demo-agent-${domain}`;
    const agentType = idx <= 3 ? domain : 'swarm_specialist';

    for (let j = 0; j < 4; j++) {
      const score = baseScores[domain] + Math.floor(Math.random() * 16) - 5;
      const severity = severities[j];

      docs.push({
        id: `demo-agent-perf-${String(idx).padStart(3, '0')}`,
        agentId,
        agentType: j % 2 === 0 ? domain : agentType,
        taskId: `demo-task-agent-${String(idx).padStart(3, '0')}`,
        timestamp: daysAgoISO(14 - j * 3 - Math.floor(Math.random() * 2)),
        qualityScore: Math.max(70, Math.min(98, score)),
        approved: severity === 'PASS' || severity === 'MINOR',
        retryCount: severity === 'MINOR' ? 1 : 0,
        responseTimeMs: 800 + Math.floor(Math.random() * 2200),
        reviewSeverity: severity,
        feedback: severity === 'PASS'
          ? ['Response met quality standards', 'Tone was appropriate']
          : ['Minor formatting issue detected', 'Consider adding more context'],
        metadata: { executionContext: 'automated', version: '1.2' },
        isDemo: true,
      });
      idx++;
    }
  }

  return docs;
}

// ── G3: Specialist Improvement Requests (3 docs) ─────────────────────────────

function getSpecialistImprovementRequests(): SeedDoc[] {
  return [
    {
      id: 'demo-improvement-001',
      specialistId: 'demo-agent-email',
      specialistName: '(Demo) Email Agent',
      sourcePerformanceEntries: ['demo-agent-perf-009', 'demo-agent-perf-010', 'demo-agent-perf-011'],
      proposedChanges: [
        { field: 'systemPrompt.tone', currentValue: 'formal', proposedValue: 'conversational-professional', reason: 'Email replies with overly formal tone have 15% lower response rates.', confidence: 0.82 },
        { field: 'behaviorConfig.followUpDelay', currentValue: 72, proposedValue: 48, reason: 'Faster follow-ups correlate with 20% higher engagement.', confidence: 0.75 },
      ],
      impactAnalysis: {
        expectedImprovement: 12,
        areasImproved: ['Response rate', 'Email engagement', 'Tone consistency'],
        risks: ['May feel too casual for enterprise prospects'],
        confidence: 0.78,
      },
      status: 'pending_review',
      createdAt: daysAgoISO(3),
      isDemo: true,
    },
    {
      id: 'demo-improvement-002',
      specialistId: 'demo-agent-social',
      specialistName: '(Demo) Social Media Agent',
      sourcePerformanceEntries: ['demo-agent-perf-013', 'demo-agent-perf-014', 'demo-agent-perf-015'],
      proposedChanges: [
        { field: 'contentRules.hashtagCount', currentValue: 5, proposedValue: 3, reason: 'Posts with 3 hashtags get 22% more engagement than posts with 5+.', confidence: 0.88 },
        { field: 'contentRules.emojiUsage', currentValue: 'liberal', proposedValue: 'moderate', reason: 'Excessive emojis reduce perceived professionalism on LinkedIn.', confidence: 0.72 },
      ],
      impactAnalysis: {
        expectedImprovement: 8,
        areasImproved: ['Post engagement', 'Professional tone', 'LinkedIn performance'],
        risks: ['May reduce Instagram engagement slightly'],
        confidence: 0.80,
      },
      status: 'pending_review',
      createdAt: daysAgoISO(5),
      isDemo: true,
    },
    {
      id: 'demo-improvement-003',
      specialistId: 'demo-agent-seo',
      specialistName: '(Demo) SEO Content Agent',
      sourcePerformanceEntries: ['demo-agent-perf-017', 'demo-agent-perf-018', 'demo-agent-perf-019'],
      proposedChanges: [
        { field: 'contentConfig.minWordCount', currentValue: 1500, proposedValue: 2200, reason: 'Articles over 2000 words rank 35% higher for competitive keywords.', confidence: 0.85 },
        { field: 'contentConfig.internalLinkDensity', currentValue: 2, proposedValue: 5, reason: 'Higher internal link density improves crawlability and page authority distribution.', confidence: 0.90 },
      ],
      impactAnalysis: {
        expectedImprovement: 15,
        areasImproved: ['Keyword rankings', 'Organic traffic', 'Content depth'],
        risks: ['Longer content takes more generation time', 'May reduce output volume'],
        confidence: 0.85,
      },
      status: 'pending_review',
      createdAt: daysAgoISO(2),
      isDemo: true,
    },
  ];
}

// ============================================================================
// [H] SEO RESEARCH — BATTLECARDS (2 docs)
// ============================================================================

function getSeoResearchBattlecards(): SeedDoc[] {
  return [
    {
      id: 'demo-seo-research-003',
      type: 'competitor_discovery',
      query: 'AI CRM platforms',
      status: 'completed',
      results: {
        competitors: [
          { domain: 'hubspot.com', name: 'HubSpot', relevance: 95, organicTraffic: 15200000, organicKeywords: 1850000 },
          { domain: 'salesforce.com', name: 'Salesforce', relevance: 90, organicTraffic: 22400000, organicKeywords: 2100000 },
          { domain: 'pipedrive.com', name: 'Pipedrive', relevance: 82, organicTraffic: 3500000, organicKeywords: 420000 },
        ],
        summary: 'Top competitors in the AI CRM space are HubSpot, Salesforce, and Pipedrive. Key differentiators include AI coaching (our strength), free tier (HubSpot), and enterprise scale (Salesforce).',
      },
      createdBy: DEMO_OWNER_ID,
      isDemo: true,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(14),
    },
    {
      id: 'demo-seo-research-004',
      type: 'battlecard',
      competitorDomain: 'hubspot.com',
      competitorName: '(Demo) HubSpot',
      status: 'completed',
      battlecard: {
        ourProduct: 'SalesVelocity.ai',
        competitorName: 'HubSpot',
        keyDifferentiators: [
          { area: 'AI Coaching', us: 'Real-time conversation coaching with playbook integration', them: 'Basic AI assistant (ChatSpot) with limited coaching', advantage: 'us' },
          { area: 'Pricing', us: 'Flat-rate, all-inclusive pricing', them: 'Complex tiered pricing that escalates quickly', advantage: 'us' },
          { area: 'Market Share', us: 'Growing challenger brand', them: 'Market leader with 200K+ customers', advantage: 'them' },
          { area: 'Integrations', us: '50+ integrations', them: '1500+ integrations via marketplace', advantage: 'them' },
        ],
        winAgainst: ['When prospect values AI coaching over breadth of features', 'When budget is a concern at scale', 'When team needs conversation intelligence built-in'],
        loseAgainst: ['When prospect needs extensive marketing automation', 'When ecosystem/integration count is critical', 'When brand recognition matters for internal buy-in'],
        talkingPoints: [
          'Our AI coaching analyzes every call in real-time — HubSpot requires a separate tool (Gong/Chorus) for this.',
          'Our pricing includes everything. HubSpot Professional starts at $800/mo and Enterprise at $3,600/mo with limited seats.',
          'We built AI-first. HubSpot bolted AI onto a 20-year-old platform.',
        ],
      },
      createdBy: DEMO_OWNER_ID,
      isDemo: true,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
    },
  ];
}

// ============================================================================
// [I] TEAM TASKS (8 new docs)
// ============================================================================

function getNewTeamTasks(): SeedDoc[] {
  const tasks = [
    { title: '(Demo) Complete Q2 pipeline review', desc: 'Review all open deals and update forecast.', assignedTo: MEMBER_4.id, assignedToName: MEMBER_4.name, priority: 'high' as const, status: 'in_progress' as const, due: 2, entity: 'deal' as const },
    { title: '(Demo) Set up lead scoring model v2', desc: 'Refine lead scoring based on last quarter engagement data.', assignedTo: MEMBER_7.id, assignedToName: MEMBER_7.name, priority: 'high' as const, status: 'todo' as const, due: 5, entity: 'lead' as const },
    { title: '(Demo) Cold outreach — Fintech vertical', desc: 'Prospect 25 fintech companies from target list.', assignedTo: MEMBER_5.id, assignedToName: MEMBER_5.name, priority: 'normal' as const, status: 'in_progress' as const, due: 7, entity: 'lead' as const },
    { title: '(Demo) Enterprise contract negotiation prep', desc: 'Prepare pricing proposal for Vertex Labs enterprise deal.', assignedTo: MEMBER_6.id, assignedToName: MEMBER_6.name, priority: 'urgent' as const, status: 'todo' as const, due: 1, entity: 'deal' as const },
    { title: '(Demo) Update CRM training documentation', desc: 'Document new features and update onboarding materials.', assignedTo: MEMBER_7.id, assignedToName: MEMBER_7.name, priority: 'low' as const, status: 'todo' as const, due: 14, entity: 'contact' as const },
    { title: '(Demo) Follow up with Summit Group decision', desc: 'Check in on contract approval status with procurement.', assignedTo: MEMBER_4.id, assignedToName: MEMBER_4.name, priority: 'high' as const, status: 'completed' as const, due: -1, entity: 'deal' as const },
    { title: '(Demo) Qualify 10 new inbound leads', desc: 'Review and qualify yesterday\'s inbound form submissions.', assignedTo: MEMBER_8.id, assignedToName: MEMBER_8.name, priority: 'normal' as const, status: 'in_progress' as const, due: 1, entity: 'lead' as const },
    { title: '(Demo) BDR team weekly coaching session', desc: 'Run 1-hour coaching session reviewing call recordings.', assignedTo: MEMBER_3.id, assignedToName: MEMBER_3.name, priority: 'normal' as const, status: 'blocked' as const, due: 3, entity: 'contact' as const },
  ];

  return tasks.map((t, i) => ({
    id: `demo-teamtask-${String(i + 9).padStart(3, '0')}`, // Start after Part 2's existing team tasks
    title: t.title,
    description: t.desc,
    assignedTo: t.assignedTo,
    assignedToName: t.assignedToName,
    assignedBy: DEMO_OWNER_ID,
    assignedByName: DEMO_OWNER_NAME,
    priority: t.priority,
    status: t.status,
    dueDate: t.due >= 0 ? daysFromNow(t.due) : daysAgo(Math.abs(t.due)),
    completedAt: t.status === 'completed' ? daysAgo(1) : null,
    relatedEntityType: t.entity,
    relatedEntityId: `demo-${t.entity}-${String(i + 1).padStart(3, '0')}`,
    tags: [t.priority, t.status],
    isDemo: true,
    createdAt: daysAgo(5 + i),
    updatedAt: daysAgo(i),
  }));
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  (Demo) Account Seed — PART 4                               ║');
  console.log('║  Growth · AI Workforce · Team Coaching · Playbooks & More   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const db = initFirebase();
  let total = 0;

  // ── [A] Growth Command Center ────────────────────────────────────────
  console.log('\n[A] Growth Command Center');
  total += await seedCollection(db, `${orgRoot}/growthCompetitorProfiles`, getGrowthCompetitorProfiles(), 'Competitor Profiles');
  total += await seedCollection(db, `${orgRoot}/growthCompetitorSnapshots`, getGrowthCompetitorSnapshots(), 'Competitor Snapshots');
  total += await seedCollection(db, `${orgRoot}/growthKeywordRankings`, getGrowthKeywordRankings(), 'Keyword Rankings');
  total += await seedCollection(db, `${orgRoot}/growthStrategies`, getGrowthStrategies(), 'Growth Strategies');
  total += await seedCollection(db, `${orgRoot}/growthAiVisibility`, getGrowthAiVisibility(), 'AI Visibility');
  total += await seedCollection(db, `${orgRoot}/growthActivityLog`, getGrowthActivityLog(), 'Activity Log');

  // ── [B] Team & Coaching ──────────────────────────────────────────────
  console.log('\n[B] Team & Coaching');
  total += await seedCollection(db, `${orgRoot}/members`, getNewMembers(), 'New Members (+5)');
  total += await seedCollection(db, `${orgRoot}/teams`, getTeams(), 'Teams');
  total += await seedCollection(db, `${orgRoot}/conversationAnalyses`, getNewConversationAnalyses(), 'Conversation Analyses (+24)');
  total += await seedCollection(db, 'users', getNewUsers(), 'New Users (TOP-LEVEL, +5)');

  // ── [C] Playbooks ────────────────────────────────────────────────────
  console.log('\n[C] Playbooks');
  total += await seedCollection(db, `${orgRoot}/playbooks`, getPlaybooks(), 'Playbooks (3, correct shape)');

  // ── [D] A/B Tests ────────────────────────────────────────────────────
  console.log('\n[D] A/B Tests');
  total += await seedCollection(db, `${orgRoot}/abTests`, getAbTests(), 'A/B Tests');

  // ── [E] Calls ────────────────────────────────────────────────────────
  console.log('\n[E] Calls');
  total += await seedCollection(db, `${orgRoot}/calls`, getCalls(), 'Calls');

  // ── [F] Video Pipeline ───────────────────────────────────────────────
  console.log('\n[F] Video Pipeline');
  total += await seedCollection(db, `${orgRoot}/video_pipeline_projects`, getVideoPipelineProjects(), 'Video Pipeline Projects');

  // ── [G] AI Workforce / Agent Swarm ───────────────────────────────────
  console.log('\n[G] AI Workforce / Agent Swarm');
  total += await seedCollection(db, `${orgRoot}/agentRepProfiles`, getAgentRepProfiles(), 'Agent Rep Profiles');
  total += await seedCollection(db, `${orgRoot}/agentPerformance`, getAgentPerformance(), 'Agent Performance');
  total += await seedCollection(db, `${orgRoot}/specialistImprovementRequests`, getSpecialistImprovementRequests(), 'Improvement Requests');

  // ── [H] Battlecards ──────────────────────────────────────────────────
  console.log('\n[H] SEO Research / Battlecards');
  total += await seedCollection(db, `${orgRoot}/seoResearch`, getSeoResearchBattlecards(), 'SEO Research Battlecards (+2)');

  // ── [I] Team Tasks ───────────────────────────────────────────────────
  console.log('\n[I] Team Tasks');
  total += await seedCollection(db, `${orgRoot}/teamTasks`, getNewTeamTasks(), 'Team Tasks (+8)');

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`✅ Part 4 complete — ${total} documents seeded across all collections.`);
  console.log('');
  console.log('All documents have:');
  console.log('  • isDemo: true');
  console.log('  • demo- prefixed IDs');
  console.log('  • (Demo) in display names');
  console.log('');
  console.log('Run nuke-demo-data.ts --execute to remove all demo data.');
  console.log('═'.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
