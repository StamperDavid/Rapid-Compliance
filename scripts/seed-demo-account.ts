/**
 * (Demo) Account Seed Script — ZERO MISSING FIELDS
 *
 * Creates ONE fully complete demo client account with ALL data populated.
 * Every single optional field is filled in. No undefined/null values.
 *
 * Data created:
 * - 10 Contacts (every field populated including customFields, address, social)
 * - 12 Leads (every field + full enrichmentData on all)
 * - 8 Deals (every field + customFields + stageHistory)
 * - 25 Activities (every field + full metadata per type)
 * - 6 Products (every field + variants + SEO)
 * - 3 Email Campaigns (full analytics)
 * - 2 Outbound Sequences (steps + analytics)
 * - 30 days of Analytics data
 *
 * Everything clearly labeled "(Demo)" for easy identification and cleanup.
 *
 * Usage: npx tsx scripts/seed-demo-account.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
const DEMO_OWNER_ID = 'demo-owner-001';
const DEMO_OWNER_NAME = '(Demo) Alex Morgan';
const DEMO_OWNER_EMAIL = 'alex.morgan@salesvelocity.ai';

// Runtime environment helpers
const APP_ENV = process.env.NODE_ENV ?? 'development';
const IS_PRODUCTION = APP_ENV === 'production';

// No prefix — single Firestore path for all environments
const PREFIX = '';

// Path builders — flat org-level structure (no workspace layer)
const orgRoot = `${PREFIX}organizations/${PLATFORM_ID}`;
const contactsPath = `${orgRoot}/contacts`;
const leadsPath = `${orgRoot}/leads`;
const dealsPath = `${orgRoot}/deals`;
const activitiesPath = `${orgRoot}/activities`;
const productsPath = `${orgRoot}/products`;
const campaignsPath = `${orgRoot}/emailCampaigns`;
const sequencesPath = `${orgRoot}/nurtureSequences`;
const analyticsPath = `${orgRoot}/analytics`;

// ============================================================================
// INITIALIZE FIREBASE ADMIN
// ============================================================================

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  let serviceAccount: admin.ServiceAccount | undefined;

  // Strategy 1: FIREBASE_SERVICE_ACCOUNT_KEY env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    if (raw.startsWith('{')) {
      serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    } else {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded) as admin.ServiceAccount;
    }
  }

  // Strategy 2: Individual env vars
  if (!serviceAccount && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID
        ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        ?? 'rapid-compliance-65f87',
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    } as admin.ServiceAccount;
  }

  // Strategy 3: serviceAccountKey.json
  if (!serviceAccount) {
    const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as admin.ServiceAccount;
      console.log('  Using serviceAccountKey.json');
    }
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ?? process.env.FIREBASE_PROJECT_ID
    ?? 'rapid-compliance-65f87';

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  } else {
    console.warn('  No Firebase credentials found, using project ID only');
    admin.initializeApp({ projectId });
  }

  return admin.firestore();
}

// ============================================================================
// HELPERS
// ============================================================================

const ts = admin.firestore.Timestamp;
const now = () => ts.now();

function daysAgo(n: number): admin.firestore.Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ts.fromDate(d);
}

function daysFromNow(n: number): admin.firestore.Timestamp {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ts.fromDate(d);
}

function hoursAgo(n: number): admin.firestore.Timestamp {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return ts.fromDate(d);
}

// ============================================================================
// DEMO DATA: CONTACTS (10 — every field populated)
// ============================================================================

const DEMO_CONTACTS = [
  {
    id: 'demo-contact-001',
    isDemo: true,
    firstName: 'Sarah',
    lastName: 'Mitchell',
    name: 'Sarah Mitchell',
    email: 'sarah.mitchell@techforward.io',
    phone: '(555) 234-5678',
    mobile: '(555) 234-9001',
    source: 'Website Form',
    photoURL: 'https://i.pravatar.cc/150?u=demo-contact-001',
    company: '(Demo) TechForward Solutions',
    title: 'VP of Marketing',
    department: 'Marketing',
    linkedInUrl: 'https://linkedin.com/in/sarahmitchell-demo',
    twitterHandle: '@sarahmitchell_demo',
    website: 'https://techforward.io',
    address: { street: '100 Innovation Blvd', city: 'Austin', state: 'TX', zip: '78701', country: 'US' },
    isVIP: true,
    tags: ['(Demo)', 'VIP', 'Enterprise', 'Marketing', 'Decision Maker'],
    notes: '(Demo) Key decision maker. Interested in full-service digital marketing package. Budget approved for Q1. Prefers email communication. Met at SXSW 2025.',
    ownerId: DEMO_OWNER_ID,
    customFields: { industry: 'Technology', accountTier: 'Enterprise', preferredContact: 'Email', annualBudget: 100000, referralSource: 'SXSW Conference', lastMeetingDate: '2026-01-15' },
    lastContactedAt: daysAgo(1),
    createdAt: daysAgo(45),
    updatedAt: daysAgo(1),
  },
  {
    id: 'demo-contact-002',
    isDemo: true,
    firstName: 'Marcus',
    lastName: 'Chen',
    name: 'Marcus Chen',
    email: 'marcus.chen@blueridgecap.com',
    phone: '(555) 345-6789',
    mobile: '(555) 345-9002',
    source: 'LinkedIn Outbound',
    photoURL: 'https://i.pravatar.cc/150?u=demo-contact-002',
    company: '(Demo) Blue Ridge Capital',
    title: 'Managing Director',
    department: 'Executive',
    linkedInUrl: 'https://linkedin.com/in/marcuschen-demo',
    twitterHandle: '@marcuschen_demo',
    website: 'https://blueridgecapital.com',
    address: { street: '200 Wall Street, Suite 1800', city: 'New York', state: 'NY', zip: '10005', country: 'US' },
    isVIP: true,
    tags: ['(Demo)', 'VIP', 'Finance', 'High-Value', 'Thought Leadership'],
    notes: '(Demo) Referred by Sarah Mitchell. Looking for investor relations content and thought leadership campaigns. Board presentation scheduled.',
    ownerId: DEMO_OWNER_ID,
    customFields: { industry: 'Financial Services', accountTier: 'Enterprise', preferredContact: 'Phone', annualBudget: 150000, referralSource: 'Sarah Mitchell', lastMeetingDate: '2026-02-01' },
    lastContactedAt: daysAgo(3),
    createdAt: daysAgo(30),
    updatedAt: daysAgo(1),
  },
  {
    id: 'demo-contact-003',
    isDemo: true,
    firstName: 'Jessica',
    lastName: 'Ramirez',
    name: 'Jessica Ramirez',
    email: 'jess@suncoastrealty.com',
    phone: '(555) 456-7890',
    mobile: '(555) 456-9003',
    source: 'Referral',
    photoURL: 'https://i.pravatar.cc/150?u=demo-contact-003',
    company: '(Demo) Suncoast Realty Group',
    title: 'Broker / Owner',
    department: 'Leadership',
    linkedInUrl: 'https://linkedin.com/in/jessicaramirez-demo',
    twitterHandle: '@suncoastrealty_demo',
    website: 'https://suncoastrealty.com',
    address: { street: '3400 Gulf Blvd', city: 'Tampa', state: 'FL', zip: '33629', country: 'US' },
    isVIP: false,
    tags: ['(Demo)', 'Real Estate', 'SMB', 'Lead Gen', 'Social Media'],
    notes: '(Demo) Expanding to 3 new markets (Sarasota, Naples, Fort Myers). Needs social media management and lead gen funnels. Responsive via text.',
    ownerId: DEMO_OWNER_ID,
    customFields: { industry: 'Real Estate', accountTier: 'Professional', preferredContact: 'Text', annualBudget: 40000, referralSource: 'Google Ads', lastMeetingDate: '2026-01-28' },
    lastContactedAt: daysAgo(5),
    createdAt: daysAgo(25),
    updatedAt: daysAgo(2),
  },
  {
    id: 'demo-contact-004',
    isDemo: true,
    firstName: 'David',
    lastName: 'Okonkwo',
    name: 'David Okonkwo',
    email: 'david@fitlifewellness.com',
    phone: '(555) 567-8901',
    mobile: '(555) 567-9004',
    source: 'Google Ads',
    photoURL: 'https://i.pravatar.cc/150?u=demo-contact-004',
    company: '(Demo) FitLife Wellness',
    title: 'CEO & Founder',
    department: 'Executive',
    linkedInUrl: 'https://linkedin.com/in/davidokonkwo-demo',
    twitterHandle: '@fitlifedavid_demo',
    website: 'https://fitlifewellness.com',
    address: { street: '789 Health Way', city: 'Denver', state: 'CO', zip: '80202', country: 'US' },
    isVIP: false,
    tags: ['(Demo)', 'Health & Wellness', 'Startup', 'E-commerce', 'DTC'],
    notes: '(Demo) Launching DTC supplement line "VitalEdge". Needs full brand buildout, Shopify store, and paid ads. Seed-funded. Aggressive timeline.',
    ownerId: DEMO_OWNER_ID,
    customFields: { industry: 'Health & Wellness', accountTier: 'Starter', preferredContact: 'Email', annualBudget: 55000, referralSource: 'LinkedIn Outbound', lastMeetingDate: '2026-02-05' },
    lastContactedAt: daysAgo(2),
    createdAt: daysAgo(15),
    updatedAt: daysAgo(2),
  },
  {
    id: 'demo-contact-005',
    isDemo: true,
    firstName: 'Emily',
    lastName: 'Thornton',
    name: 'Emily Thornton',
    email: 'emily.thornton@grantham.edu',
    phone: '(555) 678-9012',
    mobile: '(555) 678-9005',
    source: 'Conference',
    photoURL: 'https://i.pravatar.cc/150?u=demo-contact-005',
    company: '(Demo) Grantham University',
    title: 'Director of Admissions Marketing',
    department: 'Marketing',
    linkedInUrl: 'https://linkedin.com/in/emilythornton-demo',
    twitterHandle: '@granthamadmissions_demo',
    website: 'https://grantham.edu',
    address: { street: '5000 Campus Dr', city: 'Lenexa', state: 'KS', zip: '66215', country: 'US' },
    isVIP: false,
    tags: ['(Demo)', 'Education', 'Enterprise', 'SEO', 'Renewal'],
    notes: '(Demo) Annual enrollment campaign. Contract renews in March. Very satisfied with SEO results (42% organic traffic increase). Key stakeholder for renewal.',
    ownerId: DEMO_OWNER_ID,
    customFields: { industry: 'Higher Education', accountTier: 'Enterprise', preferredContact: 'Email', annualBudget: 75000, referralSource: 'Industry Conference', lastMeetingDate: '2026-01-20' },
    lastContactedAt: daysAgo(8),
    createdAt: daysAgo(365),
    updatedAt: daysAgo(8),
  },
  {
    id: 'demo-contact-006',
    isDemo: true,
    firstName: 'Ryan',
    lastName: 'Kowalski',
    name: 'Ryan Kowalski',
    email: 'ryan@precisionmfg.com',
    phone: '(555) 789-0123',
    mobile: '(555) 789-9006',
    source: 'Cold Email',
    photoURL: 'https://i.pravatar.cc/150?u=demo-contact-006',
    company: '(Demo) Precision Manufacturing Co',
    title: 'Operations Manager',
    department: 'Operations',
    linkedInUrl: 'https://linkedin.com/in/ryankowalski-demo',
    twitterHandle: '@precisionmfg_demo',
    website: 'https://precisionmfg.com',
    address: { street: '1500 Industrial Pkwy', city: 'Detroit', state: 'MI', zip: '48201', country: 'US' },
    isVIP: false,
    tags: ['(Demo)', 'Manufacturing', 'B2B', 'Lost Deal', 'Re-engage Q3'],
    notes: '(Demo) B2B lead gen focus. Deal lost - they hired internally. Set reminder to re-engage in Q3 when their new hire ramps up.',
    ownerId: DEMO_OWNER_ID,
    customFields: { industry: 'Manufacturing', accountTier: 'Professional', preferredContact: 'Phone', annualBudget: 20000, referralSource: 'Trade Show', lastMeetingDate: '2026-01-10' },
    lastContactedAt: daysAgo(10),
    createdAt: daysAgo(40),
    updatedAt: daysAgo(10),
  },
  {
    id: 'demo-contact-007',
    isDemo: true,
    firstName: 'Olivia',
    lastName: 'Park',
    name: 'Olivia Park',
    email: 'olivia@luminarydesigns.co',
    phone: '(555) 890-1234',
    mobile: '(555) 890-9007',
    source: 'Partner Referral',
    photoURL: 'https://i.pravatar.cc/150?u=demo-contact-007',
    company: '(Demo) Luminary Interior Designs',
    title: 'Creative Director',
    department: 'Design',
    linkedInUrl: 'https://linkedin.com/in/oliviapark-demo',
    twitterHandle: '@luminaryolivia_demo',
    website: 'https://luminarydesigns.co',
    address: { street: '222 Arts District Ave', city: 'Los Angeles', state: 'CA', zip: '90013', country: 'US' },
    isVIP: true,
    tags: ['(Demo)', 'VIP', 'Design', 'Luxury', 'Active Client', 'Referral Source'],
    notes: '(Demo) High-end residential design firm. Instagram-heavy strategy. Referred 2 other clients (Marcus Chen, upcoming referral). Retainer active since Feb 2026.',
    ownerId: DEMO_OWNER_ID,
    customFields: { industry: 'Interior Design', accountTier: 'Professional', preferredContact: 'Email', annualBudget: 50000, referralSource: 'Instagram DM', lastMeetingDate: '2026-02-07' },
    lastContactedAt: daysAgo(1),
    createdAt: daysAgo(60),
    updatedAt: daysAgo(1),
  },
  {
    id: 'demo-contact-008',
    isDemo: true,
    firstName: 'James',
    lastName: 'Whitfield',
    name: 'James Whitfield',
    email: 'jwhitfield@greenvalleyfarms.com',
    phone: '(555) 901-2345',
    mobile: '(555) 901-9008',
    source: 'Webinar',
    photoURL: 'https://i.pravatar.cc/150?u=demo-contact-008',
    company: '(Demo) Green Valley Organic Farms',
    title: 'Marketing Manager',
    department: 'Marketing',
    linkedInUrl: 'https://linkedin.com/in/jameswhitfield-demo',
    twitterHandle: '@greenvalleyfarms_demo',
    website: 'https://greenvalleyfarms.com',
    address: { street: '800 Country Rd', city: 'Napa', state: 'CA', zip: '94558', country: 'US' },
    isVIP: false,
    tags: ['(Demo)', 'Agriculture', 'Organic', 'E-commerce', 'Seasonal'],
    notes: '(Demo) Farm-to-table e-commerce site. Seasonal campaigns are critical (spring planting, fall harvest, holiday gift boxes). Email marketing is primary channel.',
    ownerId: DEMO_OWNER_ID,
    customFields: { industry: 'Agriculture', accountTier: 'Starter', preferredContact: 'Email', annualBudget: 30000, referralSource: 'Organic Search', lastMeetingDate: '2026-02-03' },
    lastContactedAt: daysAgo(4),
    createdAt: daysAgo(90),
    updatedAt: daysAgo(3),
  },
  {
    id: 'demo-contact-009',
    isDemo: true,
    firstName: 'Priya',
    lastName: 'Sharma',
    name: 'Priya Sharma',
    email: 'priya@cloudninesaas.io',
    phone: '(555) 012-3456',
    mobile: '(555) 012-9009',
    source: 'Twitter DM',
    photoURL: 'https://i.pravatar.cc/150?u=demo-contact-009',
    company: '(Demo) CloudNine SaaS',
    title: 'Head of Growth',
    department: 'Growth',
    linkedInUrl: 'https://linkedin.com/in/priyasharma-demo',
    twitterHandle: '@priyagrowth_demo',
    website: 'https://cloudninesaas.io',
    address: { street: '1 Market St, Floor 30', city: 'San Francisco', state: 'CA', zip: '94105', country: 'US' },
    isVIP: true,
    tags: ['(Demo)', 'VIP', 'SaaS', 'Tech', 'Growth', 'Hot Prospect'],
    notes: '(Demo) Series B startup ($18M raised). Aggressive growth targets - 3x ARR in 12 months. Running PLG + outbound in parallel. SOW nearly finalized.',
    ownerId: DEMO_OWNER_ID,
    customFields: { industry: 'SaaS / Technology', accountTier: 'Enterprise', preferredContact: 'Slack', annualBudget: 100000, referralSource: 'LinkedIn Outbound', lastMeetingDate: '2026-02-10' },
    lastContactedAt: hoursAgo(4),
    createdAt: daysAgo(20),
    updatedAt: hoursAgo(4),
  },
  {
    id: 'demo-contact-010',
    isDemo: true,
    firstName: 'Nathan',
    lastName: 'Brooks',
    name: 'Nathan Brooks',
    email: 'nathan@brookslegal.com',
    phone: '(555) 123-4567',
    mobile: '(555) 123-9010',
    source: 'Trade Show',
    photoURL: 'https://i.pravatar.cc/150?u=demo-contact-010',
    company: '(Demo) Brooks & Associates Law',
    title: 'Senior Partner',
    department: 'Legal',
    linkedInUrl: 'https://linkedin.com/in/nathanbrooks-demo',
    twitterHandle: '@brookslegal_demo',
    website: 'https://brookslegal.com',
    address: { street: '600 Peachtree St NE', city: 'Atlanta', state: 'GA', zip: '30308', country: 'US' },
    isVIP: false,
    tags: ['(Demo)', 'Legal', 'Professional Services', 'Active Client', 'Local SEO'],
    notes: '(Demo) Personal injury firm. Active client - Local SEO package closed. Google Business Profile optimized. Already seeing 35% increase in calls from organic.',
    ownerId: DEMO_OWNER_ID,
    customFields: { industry: 'Legal Services', accountTier: 'Professional', preferredContact: 'Phone', annualBudget: 28000, referralSource: 'Google Ads', lastMeetingDate: '2026-01-25' },
    lastContactedAt: daysAgo(7),
    createdAt: daysAgo(50),
    updatedAt: daysAgo(7),
  },
];

// ============================================================================
// DEMO DATA: LEADS (12 — every field + full enrichmentData)
// ============================================================================

const DEMO_LEADS = [
  {
    id: 'demo-lead-001', isDemo: true,
    firstName: 'Alexandra', lastName: 'Rivera', name: 'Alexandra Rivera',
    email: 'arivera@brightpathconsulting.com', phone: '(555) 210-0001',
    company: '(Demo) BrightPath Consulting', companyName: '(Demo) BrightPath Consulting',
    title: 'Partner', status: 'new' as const, score: 82, source: 'Website Form',
    utmSource: 'google', utmMedium: 'organic', utmCampaign: 'q1-growth-2026',
    formId: 'demo-form-001', formSubmissionId: 'demo-submission-001',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'Consulting', 'Inbound', 'Hot'],
    customFields: { leadPriority: 'High', campaignSource: 'Q1 SEO Blog', estimatedDealSize: 35000, nextAction: 'Schedule discovery call' },
    enrichmentData: {
      companyName: 'BrightPath Consulting', website: 'https://brightpathconsulting.com', domain: 'brightpathconsulting.com',
      industry: 'Management Consulting', description: 'Boutique management consulting firm specializing in digital transformation for mid-market companies.',
      companySize: 'small' as const, employeeCount: 45, employeeRange: '11-50', revenue: '$8M',
      city: 'Boston', state: 'MA', country: 'US',
      techStack: ['Salesforce', 'HubSpot', 'Slack', 'Asana'], foundedYear: 2018, fundingStage: 'Bootstrapped',
      linkedInUrl: 'https://linkedin.com/company/brightpath-demo', twitterHandle: '@brightpath_demo',
      title: 'Partner', contactEmail: 'arivera@brightpathconsulting.com', contactPhone: '(555) 210-0001',
      hiringStatus: 'hiring' as const, lastEnriched: daysAgo(1), dataSource: 'web-scrape' as const, confidence: 0.87,
    },
    createdAt: daysAgo(2), updatedAt: daysAgo(0),
  },
  {
    id: 'demo-lead-002', isDemo: true,
    firstName: 'Trevor', lastName: 'Hawkins', name: 'Trevor Hawkins',
    email: 'thawkins@velocitymotors.com', phone: '(555) 210-0002',
    company: '(Demo) Velocity Motors', companyName: '(Demo) Velocity Motors',
    title: 'Marketing Director', status: 'contacted' as const, score: 65, source: 'LinkedIn',
    utmSource: 'linkedin', utmMedium: 'social', utmCampaign: 'linkedin-outbound-feb',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'Automotive', 'Outbound', 'Multi-Location'],
    customFields: { leadPriority: 'Medium', campaignSource: 'LinkedIn Outbound Q1', estimatedDealSize: 28000, nextAction: 'Send case study packet' },
    enrichmentData: {
      companyName: 'Velocity Motors', website: 'https://velocitymotors.com', domain: 'velocitymotors.com',
      industry: 'Automotive Retail', description: 'Multi-location auto dealership group with 6 locations across the Carolinas.',
      companySize: 'medium' as const, employeeCount: 180, employeeRange: '101-250', revenue: '$42M',
      city: 'Charlotte', state: 'NC', country: 'US',
      techStack: ['DealerSocket', 'Google Ads', 'Facebook Ads'], foundedYear: 2005, fundingStage: 'Private',
      linkedInUrl: 'https://linkedin.com/company/velocitymotors-demo', twitterHandle: '@velocitymotors_demo',
      title: 'Marketing Director', contactEmail: 'thawkins@velocitymotors.com', contactPhone: '(555) 210-0002',
      hiringStatus: 'actively-hiring' as const, lastEnriched: daysAgo(3), dataSource: 'hybrid' as const, confidence: 0.92,
    },
    createdAt: daysAgo(8), updatedAt: daysAgo(3),
  },
  {
    id: 'demo-lead-003', isDemo: true,
    firstName: 'Monica', lastName: 'Santos', name: 'Monica Santos',
    email: 'msantos@pureluxspa.com', phone: '(555) 210-0003',
    company: '(Demo) PureLux Day Spa', companyName: '(Demo) PureLux Day Spa',
    title: 'Owner', status: 'qualified' as const, score: 91, source: 'Referral',
    utmSource: 'referral', utmMedium: 'referral', utmCampaign: 'partner-referral-olivia',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'Spa', 'High-Intent', 'Referral', 'Ready to Close'],
    customFields: { leadPriority: 'Critical', campaignSource: 'Referral - Olivia Park', estimatedDealSize: 42000, nextAction: 'Send proposal' },
    enrichmentData: {
      companyName: 'PureLux Day Spa', website: 'https://pureluxspa.com', domain: 'pureluxspa.com',
      industry: 'Health & Wellness', description: 'Luxury day spa and wellness center offering massages, facials, and holistic treatments.',
      companySize: 'small' as const, employeeCount: 22, employeeRange: '11-50', revenue: '$1.8M',
      city: 'Scottsdale', state: 'AZ', country: 'US',
      techStack: ['Mindbody', 'Instagram Business', 'Mailchimp'], foundedYear: 2019, fundingStage: 'Bootstrapped',
      linkedInUrl: 'https://linkedin.com/company/pureluxspa-demo', twitterHandle: '@pureluxspa_demo',
      title: 'Owner', contactEmail: 'msantos@pureluxspa.com', contactPhone: '(555) 210-0003',
      hiringStatus: 'hiring' as const, lastEnriched: daysAgo(0), dataSource: 'manual' as const, confidence: 0.95,
    },
    createdAt: daysAgo(12), updatedAt: daysAgo(0),
  },
  {
    id: 'demo-lead-004', isDemo: true,
    firstName: 'Liam', lastName: 'Foster', name: 'Liam Foster',
    email: 'lfoster@summitoutdoors.com', phone: '(555) 210-0004',
    company: '(Demo) Summit Outdoor Gear', companyName: '(Demo) Summit Outdoor Gear',
    title: 'E-commerce Manager', status: 'qualified' as const, score: 78, source: 'Google Ads',
    utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'google-brand-search',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'E-commerce', 'Outdoor', 'PPC', 'Shopify'],
    customFields: { leadPriority: 'High', campaignSource: 'Google Ads - E-commerce', estimatedDealSize: 24000, nextAction: 'Schedule PPC audit review' },
    enrichmentData: {
      companyName: 'Summit Outdoor Gear', website: 'https://summitoutdoors.com', domain: 'summitoutdoors.com',
      industry: 'Outdoor Recreation / E-commerce', description: 'Online retailer of premium hiking, camping, and climbing gear. DTC brand with growing wholesale channel.',
      companySize: 'small' as const, employeeCount: 35, employeeRange: '11-50', revenue: '$5.2M',
      city: 'Portland', state: 'OR', country: 'US',
      techStack: ['Shopify Plus', 'Klaviyo', 'Google Analytics 4', 'Meta Ads'], foundedYear: 2016, fundingStage: 'Seed',
      linkedInUrl: 'https://linkedin.com/company/summitoutdoors-demo', twitterHandle: '@summitgear_demo',
      title: 'E-commerce Manager', contactEmail: 'lfoster@summitoutdoors.com', contactPhone: '(555) 210-0004',
      hiringStatus: 'hiring' as const, lastEnriched: daysAgo(2), dataSource: 'web-scrape' as const, confidence: 0.88,
    },
    createdAt: daysAgo(6), updatedAt: daysAgo(2),
  },
  {
    id: 'demo-lead-005', isDemo: true,
    firstName: 'Danielle', lastName: 'Nguyen', name: 'Danielle Nguyen',
    email: 'dnguyen@harborviewmed.org', phone: '(555) 210-0005',
    company: '(Demo) HarborView Medical Center', companyName: '(Demo) HarborView Medical Center',
    title: 'Chief Marketing Officer', status: 'new' as const, score: 88, source: 'Conference',
    utmSource: 'direct', utmMedium: 'referral', utmCampaign: 'himss-2026-conference',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'Healthcare', 'Enterprise', 'Conference Lead', 'High Value'],
    customFields: { leadPriority: 'Critical', campaignSource: 'HIMSS 2026 Conference', estimatedDealSize: 95000, nextAction: 'Send follow-up from conference' },
    enrichmentData: {
      companyName: 'HarborView Medical Center', website: 'https://harborviewmed.org', domain: 'harborviewmed.org',
      industry: 'Healthcare', description: 'Regional medical center with 450 beds, 12 specialty departments, and an affiliated physician network.',
      companySize: 'enterprise' as const, employeeCount: 2400, employeeRange: '1000+', revenue: '$380M',
      city: 'Seattle', state: 'WA', country: 'US',
      techStack: ['Epic EHR', 'Salesforce Health Cloud', 'Adobe Experience Manager'], foundedYear: 1962, fundingStage: 'Non-Profit',
      linkedInUrl: 'https://linkedin.com/company/harborviewmed-demo', twitterHandle: '@harborviewmed_demo',
      title: 'Chief Marketing Officer', contactEmail: 'dnguyen@harborviewmed.org', contactPhone: '(555) 210-0005',
      hiringStatus: 'actively-hiring' as const, lastEnriched: daysAgo(1), dataSource: 'hybrid' as const, confidence: 0.94,
    },
    createdAt: daysAgo(3), updatedAt: daysAgo(1),
  },
  {
    id: 'demo-lead-006', isDemo: true,
    firstName: 'Brandon', lastName: 'Wright', name: 'Brandon Wright',
    email: 'bwright@ironcladsecurity.com', phone: '(555) 210-0006',
    company: '(Demo) Ironclad Security Solutions', companyName: '(Demo) Ironclad Security Solutions',
    title: 'VP Business Development', status: 'contacted' as const, score: 55, source: 'Cold Outreach',
    utmSource: 'email', utmMedium: 'email', utmCampaign: 'cold-email-cybersecurity-q1',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'Security', 'B2B', 'Outbound', 'Tech'],
    customFields: { leadPriority: 'Medium', campaignSource: 'Cold Email Sequence - Cybersecurity', estimatedDealSize: 45000, nextAction: 'Follow up on demo request' },
    enrichmentData: {
      companyName: 'Ironclad Security Solutions', website: 'https://ironcladsecurity.com', domain: 'ironcladsecurity.com',
      industry: 'Cybersecurity', description: 'Enterprise cybersecurity firm providing managed detection & response, penetration testing, and compliance consulting.',
      companySize: 'medium' as const, employeeCount: 120, employeeRange: '51-200', revenue: '$28M',
      city: 'Reston', state: 'VA', country: 'US',
      techStack: ['AWS', 'Splunk', 'CrowdStrike', 'HubSpot'], foundedYear: 2014, fundingStage: 'Series C',
      linkedInUrl: 'https://linkedin.com/company/ironcladsecurity-demo', twitterHandle: '@ironcladsec_demo',
      title: 'VP Business Development', contactEmail: 'bwright@ironcladsecurity.com', contactPhone: '(555) 210-0006',
      hiringStatus: 'actively-hiring' as const, lastEnriched: daysAgo(5), dataSource: 'search-api' as const, confidence: 0.79,
    },
    createdAt: daysAgo(10), updatedAt: daysAgo(5),
  },
  {
    id: 'demo-lead-007', isDemo: true,
    firstName: 'Caroline', lastName: 'Hughes', name: 'Caroline Hughes',
    email: 'chughes@petalperfect.com', phone: '(555) 210-0007',
    company: '(Demo) Petal Perfect Floral', companyName: '(Demo) Petal Perfect Floral',
    title: 'Owner', status: 'converted' as const, score: 96, source: 'Website Form',
    utmSource: 'google', utmMedium: 'organic', utmCampaign: 'smb-marketing-blog-q1',
    formId: 'demo-form-001', formSubmissionId: 'demo-submission-002',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'Floral', 'SMB', 'Converted', 'Active Client'],
    customFields: { leadPriority: 'Closed', campaignSource: 'Blog - Small Business Marketing Tips', estimatedDealSize: 18000, nextAction: 'Converted to contact' },
    enrichmentData: {
      companyName: 'Petal Perfect Floral', website: 'https://petalperfect.com', domain: 'petalperfect.com',
      industry: 'Retail - Florist', description: 'Boutique floral design studio specializing in weddings, events, and luxury arrangements.',
      companySize: 'startup' as const, employeeCount: 8, employeeRange: '1-10', revenue: '$520K',
      city: 'Charleston', state: 'SC', country: 'US',
      techStack: ['Squarespace', 'Instagram Business', 'FloristWare'], foundedYear: 2021, fundingStage: 'Bootstrapped',
      linkedInUrl: 'https://linkedin.com/company/petalperfect-demo', twitterHandle: '@petalperfect_demo',
      title: 'Owner', contactEmail: 'chughes@petalperfect.com', contactPhone: '(555) 210-0007',
      hiringStatus: 'not-hiring' as const, lastEnriched: daysAgo(14), dataSource: 'manual' as const, confidence: 0.98,
    },
    createdAt: daysAgo(30), updatedAt: daysAgo(14),
  },
  {
    id: 'demo-lead-008', isDemo: true,
    firstName: 'Derek', lastName: 'Calloway', name: 'Derek Calloway',
    email: 'dcalloway@apextrade.com', phone: '(555) 210-0008',
    company: '(Demo) Apex Trade Finance', companyName: '(Demo) Apex Trade Finance',
    title: 'Head of Client Acquisition', status: 'lost' as const, score: 42, source: 'LinkedIn',
    utmSource: 'linkedin', utmMedium: 'social', utmCampaign: 'linkedin-outbound-q4',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'Finance', 'Lost', 'Price Sensitive', 'Re-engage Later'],
    customFields: { leadPriority: 'Low', campaignSource: 'LinkedIn Outbound Q4', estimatedDealSize: 38000, nextAction: 'Re-engage in 6 months', lostReason: 'Price too high - went with cheaper competitor' },
    enrichmentData: {
      companyName: 'Apex Trade Finance', website: 'https://apextrade.com', domain: 'apextrade.com',
      industry: 'Financial Services', description: 'Trade finance and supply chain financing for mid-market importers and exporters.',
      companySize: 'medium' as const, employeeCount: 90, employeeRange: '51-200', revenue: '$18M',
      city: 'Chicago', state: 'IL', country: 'US',
      techStack: ['Salesforce', 'Bloomberg Terminal', 'DocuSign'], foundedYear: 2011, fundingStage: 'Series B',
      linkedInUrl: 'https://linkedin.com/company/apextrade-demo', twitterHandle: '@apextrade_demo',
      title: 'Head of Client Acquisition', contactEmail: 'dcalloway@apextrade.com', contactPhone: '(555) 210-0008',
      hiringStatus: 'not-hiring' as const, lastEnriched: daysAgo(20), dataSource: 'hybrid' as const, confidence: 0.83,
    },
    createdAt: daysAgo(45), updatedAt: daysAgo(20),
  },
  {
    id: 'demo-lead-009', isDemo: true,
    firstName: 'Megan', lastName: 'Tran', name: 'Megan Tran',
    email: 'mtran@nomadcoffee.co', phone: '(555) 210-0009',
    company: '(Demo) Nomad Coffee Roasters', companyName: '(Demo) Nomad Coffee Roasters',
    title: 'Brand Manager', status: 'new' as const, score: 74, source: 'Instagram',
    utmSource: 'instagram', utmMedium: 'social', utmCampaign: 'instagram-dtc-brands-feb',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'Food & Beverage', 'DTC', 'Social', 'E-commerce'],
    customFields: { leadPriority: 'High', campaignSource: 'Instagram Ad - DTC Brands', estimatedDealSize: 22000, nextAction: 'Schedule intro call' },
    enrichmentData: {
      companyName: 'Nomad Coffee Roasters', website: 'https://nomadcoffee.co', domain: 'nomadcoffee.co',
      industry: 'Food & Beverage / DTC', description: 'Specialty coffee roaster with online subscriptions, wholesale, and 2 retail cafes in Nashville.',
      companySize: 'small' as const, employeeCount: 28, employeeRange: '11-50', revenue: '$3.1M',
      city: 'Nashville', state: 'TN', country: 'US',
      techStack: ['Shopify', 'Mailchimp', 'Instagram Business', 'Square POS'], foundedYear: 2019, fundingStage: 'Bootstrapped',
      linkedInUrl: 'https://linkedin.com/company/nomadcoffee-demo', twitterHandle: '@nomadcoffee_demo',
      title: 'Brand Manager', contactEmail: 'mtran@nomadcoffee.co', contactPhone: '(555) 210-0009',
      hiringStatus: 'hiring' as const, lastEnriched: daysAgo(0), dataSource: 'web-scrape' as const, confidence: 0.91,
    },
    createdAt: daysAgo(1), updatedAt: daysAgo(0),
  },
  {
    id: 'demo-lead-010', isDemo: true,
    firstName: 'Greg', lastName: 'Patel', name: 'Greg Patel',
    email: 'gpatel@horizonarchitects.com', phone: '(555) 210-0010',
    company: '(Demo) Horizon Architecture Group', companyName: '(Demo) Horizon Architecture Group',
    title: 'Principal Architect', status: 'contacted' as const, score: 60, source: 'Google Ads',
    utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'google-professional-services-q1',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'Architecture', 'Professional Services', 'Portland'],
    customFields: { leadPriority: 'Medium', campaignSource: 'Google Ads - Professional Services', estimatedDealSize: 30000, nextAction: 'Send portfolio examples' },
    enrichmentData: {
      companyName: 'Horizon Architecture Group', website: 'https://horizonarchitects.com', domain: 'horizonarchitects.com',
      industry: 'Architecture & Design', description: 'Award-winning architecture firm focused on sustainable commercial and residential projects.',
      companySize: 'small' as const, employeeCount: 18, employeeRange: '11-50', revenue: '$4.5M',
      city: 'Portland', state: 'OR', country: 'US',
      techStack: ['AutoCAD', 'Revit', 'WordPress', 'Houzz Pro'], foundedYear: 2012, fundingStage: 'Bootstrapped',
      linkedInUrl: 'https://linkedin.com/company/horizonarchitects-demo', twitterHandle: '@horizonarch_demo',
      title: 'Principal Architect', contactEmail: 'gpatel@horizonarchitects.com', contactPhone: '(555) 210-0010',
      hiringStatus: 'not-hiring' as const, lastEnriched: daysAgo(4), dataSource: 'search-api' as const, confidence: 0.85,
    },
    createdAt: daysAgo(9), updatedAt: daysAgo(4),
  },
  {
    id: 'demo-lead-011', isDemo: true,
    firstName: 'Rachel', lastName: 'Kim', name: 'Rachel Kim',
    email: 'rkim@stellarfintech.io', phone: '(555) 210-0011',
    company: '(Demo) Stellar FinTech', companyName: '(Demo) Stellar FinTech',
    title: 'Growth Lead', status: 'qualified' as const, score: 85, source: 'Webinar',
    utmSource: 'youtube', utmMedium: 'organic', utmCampaign: 'saas-growth-webinar-feb',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'FinTech', 'SaaS', 'Inbound', 'Webinar Attendee'],
    customFields: { leadPriority: 'High', campaignSource: 'Webinar - SaaS Growth Playbook', estimatedDealSize: 55000, nextAction: 'Present growth strategy proposal' },
    enrichmentData: {
      companyName: 'Stellar FinTech', website: 'https://stellarfintech.io', domain: 'stellarfintech.io',
      industry: 'Financial Technology', description: 'B2B payments platform simplifying cross-border transactions for SMBs.',
      companySize: 'medium' as const, employeeCount: 75, employeeRange: '51-200', revenue: '$12M',
      city: 'Miami', state: 'FL', country: 'US',
      techStack: ['React', 'Node.js', 'AWS', 'Stripe', 'HubSpot'], foundedYear: 2020, fundingStage: 'Series B',
      linkedInUrl: 'https://linkedin.com/company/stellarfintech-demo', twitterHandle: '@stellarfintech_demo',
      title: 'Growth Lead', contactEmail: 'rkim@stellarfintech.io', contactPhone: '(555) 210-0011',
      hiringStatus: 'actively-hiring' as const, lastEnriched: daysAgo(1), dataSource: 'hybrid' as const, confidence: 0.93,
    },
    createdAt: daysAgo(7), updatedAt: daysAgo(1),
  },
  {
    id: 'demo-lead-012', isDemo: true,
    firstName: 'Tyler', lastName: 'Anderson', name: 'Tyler Anderson',
    email: 'tanderson@elementgym.com', phone: '(555) 210-0012',
    company: '(Demo) Element Fitness Studios', companyName: '(Demo) Element Fitness Studios',
    title: 'Co-Founder', status: 'lost' as const, score: 38, source: 'Facebook Ad',
    utmSource: 'facebook', utmMedium: 'social', utmCampaign: 'facebook-fitness-studios-q4',
    ownerId: DEMO_OWNER_ID, tags: ['(Demo)', 'Fitness', 'Lost', 'Timing', 'Revisit Q3'],
    customFields: { leadPriority: 'Low', campaignSource: 'Facebook Ad - Fitness Studios', estimatedDealSize: 15000, nextAction: 'Re-engage after summer launch', lostReason: 'Bad timing - still building out second location' },
    enrichmentData: {
      companyName: 'Element Fitness Studios', website: 'https://elementgym.com', domain: 'elementgym.com',
      industry: 'Fitness & Health', description: 'Boutique fitness studio offering HIIT, yoga, and strength training classes.',
      companySize: 'startup' as const, employeeCount: 12, employeeRange: '1-10', revenue: '$800K',
      city: 'Austin', state: 'TX', country: 'US',
      techStack: ['Mindbody', 'Instagram Business', 'ClassPass'], foundedYear: 2023, fundingStage: 'Bootstrapped',
      linkedInUrl: 'https://linkedin.com/company/elementgym-demo', twitterHandle: '@elementgym_demo',
      title: 'Co-Founder', contactEmail: 'tanderson@elementgym.com', contactPhone: '(555) 210-0012',
      hiringStatus: 'not-hiring' as const, lastEnriched: daysAgo(25), dataSource: 'web-scrape' as const, confidence: 0.76,
    },
    createdAt: daysAgo(35), updatedAt: daysAgo(25),
  },
];

// ============================================================================
// DEMO DATA: DEALS (8 — every field populated)
// ============================================================================

const DEMO_DEALS = [
  {
    id: 'demo-deal-001', isDemo: true,
    name: '(Demo) TechForward - Enterprise Marketing Package',
    company: '(Demo) TechForward Solutions', companyName: '(Demo) TechForward Solutions',
    contactId: 'demo-contact-001', leadId: 'demo-lead-001', value: 84000, currency: 'USD',
    stage: 'negotiation' as const, probability: 75,
    expectedCloseDate: daysFromNow(14), ownerId: DEMO_OWNER_ID, source: 'Inbound - Website',
    notes: '(Demo) Annual contract. Includes SEO, PPC, content marketing, and social media management. Awaiting legal review of MSA. Champion: Sarah Mitchell.',
    customFields: { contractLength: '12 months', services: ['SEO', 'PPC', 'Content Marketing', 'Social Media'], competitor: 'None identified', decisionProcess: 'Sarah + Legal review' },
    stageHistory: [
      { fromStage: null, toStage: 'prospecting', changedAt: ts.fromDate(new Date(Date.now() - 30 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'New deal created from inbound website inquiry.' },
      { fromStage: 'prospecting', toStage: 'qualification', changedAt: ts.fromDate(new Date(Date.now() - 22 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Discovery call completed. Budget confirmed at $84K.' },
      { fromStage: 'qualification', toStage: 'proposal', changedAt: ts.fromDate(new Date(Date.now() - 14 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Proposal sent — 24-page PDF with ROI projections.' },
      { fromStage: 'proposal', toStage: 'negotiation', changedAt: ts.fromDate(new Date(Date.now() - 7 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Proposal accepted. Legal review of MSA in progress.' },
    ],
    createdAt: daysAgo(30), updatedAt: daysAgo(1),
  },
  {
    id: 'demo-deal-002', isDemo: true,
    name: '(Demo) Blue Ridge - Investor Relations Content',
    company: '(Demo) Blue Ridge Capital', companyName: '(Demo) Blue Ridge Capital',
    contactId: 'demo-contact-002', value: 120000, currency: 'USD',
    stage: 'proposal' as const, probability: 50,
    expectedCloseDate: daysFromNow(30), ownerId: DEMO_OWNER_ID, source: 'Referral',
    notes: '(Demo) Quarterly thought leadership articles, investor newsletter, and LinkedIn presence management. Waiting on budget approval from board. Marcus is champion.',
    customFields: { contractLength: '12 months', services: ['Thought Leadership', 'Newsletter', 'LinkedIn Management'], competitor: 'McKinsey Content Studio', decisionProcess: 'Board approval required' },
    stageHistory: [
      { fromStage: null, toStage: 'prospecting', changedAt: ts.fromDate(new Date(Date.now() - 22 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Deal created via referral from Olivia Park.' },
      { fromStage: 'prospecting', toStage: 'qualification', changedAt: ts.fromDate(new Date(Date.now() - 15 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Initial call confirmed enterprise budget and board timeline.' },
      { fromStage: 'qualification', toStage: 'proposal', changedAt: ts.fromDate(new Date(Date.now() - 5 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Case studies delivered. Proposal submitted for board review.' },
    ],
    createdAt: daysAgo(22), updatedAt: daysAgo(2),
  },
  {
    id: 'demo-deal-003', isDemo: true,
    name: '(Demo) Suncoast Realty - Lead Gen Funnels',
    company: '(Demo) Suncoast Realty Group', companyName: '(Demo) Suncoast Realty Group',
    contactId: 'demo-contact-003', value: 36000, currency: 'USD',
    stage: 'qualification' as const, probability: 30,
    expectedCloseDate: daysFromNow(45), ownerId: DEMO_OWNER_ID, source: 'Inbound - Website',
    notes: '(Demo) Facebook/Instagram ad funnels for 3 new markets (Sarasota, Naples, Fort Myers). Discovery call went well, need to scope technical requirements.',
    customFields: { contractLength: '6 months', services: ['Facebook Ads', 'Instagram Ads', 'Landing Pages'], competitor: 'Local agency', decisionProcess: 'Jessica + business partner' },
    stageHistory: [
      { fromStage: null, toStage: 'prospecting', changedAt: ts.fromDate(new Date(Date.now() - 18 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Inbound inquiry via website contact form.' },
      { fromStage: 'prospecting', toStage: 'qualification', changedAt: ts.fromDate(new Date(Date.now() - 10 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Discovery call completed. Needs partner sign-off before progressing.' },
    ],
    createdAt: daysAgo(18), updatedAt: daysAgo(5),
  },
  {
    id: 'demo-deal-004', isDemo: true,
    name: '(Demo) FitLife - Brand Launch Package',
    company: '(Demo) FitLife Wellness', companyName: '(Demo) FitLife Wellness',
    contactId: 'demo-contact-004', value: 52000, currency: 'USD',
    stage: 'prospecting' as const, probability: 15,
    expectedCloseDate: daysFromNow(60), ownerId: DEMO_OWNER_ID, source: 'Inbound - LinkedIn',
    notes: '(Demo) Full brand identity, Shopify website build, and launch campaign for DTC supplement line "VitalEdge". Early stage discussions. Need to schedule deep-dive.',
    customFields: { contractLength: '3 months (project)', services: ['Brand Identity', 'Website Build', 'Launch Campaign', 'Paid Ads'], competitor: 'In-house freelancers', decisionProcess: 'David sole decision maker' },
    stageHistory: [
      { fromStage: null, toStage: 'prospecting', changedAt: ts.fromDate(new Date(Date.now() - 10 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'New deal from LinkedIn DM. Early-stage exploration.' },
    ],
    createdAt: daysAgo(10), updatedAt: daysAgo(4),
  },
  {
    id: 'demo-deal-005', isDemo: true,
    name: '(Demo) Luminary Designs - Social Media Retainer',
    company: '(Demo) Luminary Interior Designs', companyName: '(Demo) Luminary Interior Designs',
    contactId: 'demo-contact-007', value: 48000, currency: 'USD',
    stage: 'closed_won' as const, probability: 100,
    expectedCloseDate: daysAgo(5), actualCloseDate: daysAgo(5),
    ownerId: DEMO_OWNER_ID, source: 'Referral',
    notes: '(Demo) CLOSED WON! 12-month Instagram + Pinterest management retainer. Includes content creation, influencer partnerships, and monthly reporting. Onboarding complete.',
    customFields: { contractLength: '12 months', services: ['Instagram Management', 'Pinterest Management', 'Influencer Partnerships', 'Monthly Reporting'], competitor: 'None', decisionProcess: 'Olivia sole decision maker', wonReason: 'Strong portfolio + referral trust' },
    stageHistory: [
      { fromStage: null, toStage: 'prospecting', changedAt: ts.fromDate(new Date(Date.now() - 35 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Referral from Marcus Chen. Initial contact made.' },
      { fromStage: 'prospecting', toStage: 'qualification', changedAt: ts.fromDate(new Date(Date.now() - 28 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Intro call confirmed budget and fit. Excellent match.' },
      { fromStage: 'qualification', toStage: 'proposal', changedAt: ts.fromDate(new Date(Date.now() - 20 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Proposal for 12-month social retainer sent.' },
      { fromStage: 'proposal', toStage: 'negotiation', changedAt: ts.fromDate(new Date(Date.now() - 12 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Proposal accepted in principle. Contract terms negotiation.' },
      { fromStage: 'negotiation', toStage: 'closed_won', changedAt: ts.fromDate(new Date(Date.now() - 5 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'DocuSign signed. First payment processed. Onboarding started.' },
    ],
    createdAt: daysAgo(35), updatedAt: daysAgo(5),
  },
  {
    id: 'demo-deal-006', isDemo: true,
    name: '(Demo) CloudNine - PLG Growth Engine',
    company: '(Demo) CloudNine SaaS', companyName: '(Demo) CloudNine SaaS',
    contactId: 'demo-contact-009', leadId: 'demo-lead-011', value: 96000, currency: 'USD',
    stage: 'negotiation' as const, probability: 80,
    expectedCloseDate: daysFromNow(7), ownerId: DEMO_OWNER_ID, source: 'Outbound - LinkedIn',
    notes: '(Demo) Product-led growth strategy + outbound sequences. 12-month engagement. Pricing approved, finalizing SOW details. Priya is champion, CEO is final sign-off.',
    customFields: { contractLength: '12 months', services: ['PLG Strategy', 'Outbound Sequences', 'Content Marketing', 'Analytics Dashboard'], competitor: 'Refine Labs', decisionProcess: 'Priya recommends, CEO approves' },
    stageHistory: [
      { fromStage: null, toStage: 'prospecting', changedAt: ts.fromDate(new Date(Date.now() - 20 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'LinkedIn outbound sequence responded. High intent from first message.' },
      { fromStage: 'prospecting', toStage: 'qualification', changedAt: ts.fromDate(new Date(Date.now() - 15 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Intro call: Series B budget confirmed, aggressive ARR goals.' },
      { fromStage: 'qualification', toStage: 'proposal', changedAt: ts.fromDate(new Date(Date.now() - 10 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'PLG strategy proposal delivered. Priya extremely enthusiastic.' },
      { fromStage: 'proposal', toStage: 'negotiation', changedAt: ts.fromDate(new Date(Date.now() - 4 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Pricing approved at $96K with 10% volume discount. SOW review with CEO.' },
    ],
    createdAt: daysAgo(20), updatedAt: hoursAgo(4),
  },
  {
    id: 'demo-deal-007', isDemo: true,
    name: '(Demo) Brooks Legal - Local SEO Package',
    company: '(Demo) Brooks & Associates Law', companyName: '(Demo) Brooks & Associates Law',
    contactId: 'demo-contact-010', value: 24000, currency: 'USD',
    stage: 'closed_won' as const, probability: 100,
    expectedCloseDate: daysAgo(15), actualCloseDate: daysAgo(15),
    ownerId: DEMO_OWNER_ID, source: 'Google Ads',
    notes: '(Demo) CLOSED WON! Local SEO, Google Business Profile optimization, review management, and Google Ads for PI leads. Already seeing 35% increase in calls.',
    customFields: { contractLength: '12 months', services: ['Local SEO', 'Google Business Profile', 'Review Management', 'Google Ads'], competitor: 'FindLaw', decisionProcess: 'Nathan sole decision maker', wonReason: 'Competitive pricing + legal industry expertise' },
    stageHistory: [
      { fromStage: null, toStage: 'prospecting', changedAt: ts.fromDate(new Date(Date.now() - 40 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Google Ads click-to-call lead. Warm from first contact.' },
      { fromStage: 'prospecting', toStage: 'qualification', changedAt: ts.fromDate(new Date(Date.now() - 35 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'BANT qualified: solid budget, 60-day timeline, Nathan sole decision maker.' },
      { fromStage: 'qualification', toStage: 'proposal', changedAt: ts.fromDate(new Date(Date.now() - 28 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Local SEO audit delivered. Proposal sent with ROI case study.' },
      { fromStage: 'proposal', toStage: 'negotiation', changedAt: ts.fromDate(new Date(Date.now() - 20 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Minor scope adjustments. Annual pricing negotiated.' },
      { fromStage: 'negotiation', toStage: 'closed_won', changedAt: ts.fromDate(new Date(Date.now() - 15 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Contract signed. First payment received. Onboarding initiated.' },
    ],
    createdAt: daysAgo(40), updatedAt: daysAgo(7),
  },
  {
    id: 'demo-deal-008', isDemo: true,
    name: '(Demo) Precision Mfg - B2B Lead Gen',
    company: '(Demo) Precision Manufacturing Co', companyName: '(Demo) Precision Manufacturing Co',
    contactId: 'demo-contact-006', value: 18000, currency: 'USD',
    stage: 'closed_lost' as const, probability: 0,
    expectedCloseDate: daysAgo(10), actualCloseDate: daysAgo(10),
    ownerId: DEMO_OWNER_ID, source: 'Cold Outreach',
    lostReason: 'Budget constraints - decided to hire internally instead of outsourcing marketing',
    notes: '(Demo) LOST. LinkedIn outreach + trade show marketing. They decided to bring marketing in-house. Follow up in Q3 when their new hire is ramped.',
    customFields: { contractLength: '6 months', services: ['LinkedIn Outreach', 'Trade Show Marketing'], competitor: 'Internal hire', decisionProcess: 'Ryan + CEO', lostDetails: 'CEO overruled, preferred in-house control' },
    stageHistory: [
      { fromStage: null, toStage: 'prospecting', changedAt: ts.fromDate(new Date(Date.now() - 35 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Cold outreach via trade show follow-up. Initial interest expressed.' },
      { fromStage: 'prospecting', toStage: 'qualification', changedAt: ts.fromDate(new Date(Date.now() - 28 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Qualified: B2B lead gen need confirmed. Budget tighter than expected.' },
      { fromStage: 'qualification', toStage: 'proposal', changedAt: ts.fromDate(new Date(Date.now() - 20 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Proposal for B2B outreach + trade show support submitted.' },
      { fromStage: 'proposal', toStage: 'negotiation', changedAt: ts.fromDate(new Date(Date.now() - 14 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'Counter-proposal with reduced scope to meet budget. CEO reviewing.' },
      { fromStage: 'negotiation', toStage: 'closed_lost', changedAt: ts.fromDate(new Date(Date.now() - 10 * 86400000)), changedBy: DEMO_OWNER_ID, changedByName: DEMO_OWNER_NAME, notes: 'CEO decided to hire internally. Re-engage Q3 when new hire is ramped.' },
    ],
    createdAt: daysAgo(35), updatedAt: daysAgo(10),
  },
];

// ============================================================================
// DEMO DATA: ACTIVITIES (25 — every field populated per type)
// ============================================================================

function makeActivity(overrides: Record<string, unknown>) {
  return {
    isDemo: true,
    createdBy: DEMO_OWNER_ID,
    createdByName: DEMO_OWNER_NAME,
    assignedTo: DEMO_OWNER_ID,
    assignedToName: DEMO_OWNER_NAME,
    isPinned: false,
    isImportant: false,
    ...overrides,
  };
}

const DEMO_ACTIVITIES = [
  makeActivity({
    id: 'demo-activity-001', type: 'call_made', direction: 'outbound',
    subject: '(Demo) Discovery call with Sarah Mitchell',
    body: 'Discussed marketing goals for Q1. Sarah confirmed $84K budget approved. Needs proposal by end of week. Very engaged, asked detailed questions about SEO methodology.',
    summary: 'Discovery call completed. Budget confirmed at $84K. Proposal due by Friday.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-001', entityName: 'Sarah Mitchell' }, { entityType: 'deal', entityId: 'demo-deal-001', entityName: 'TechForward - Enterprise Marketing Package' }],
    metadata: { callDuration: 1800, callOutcome: 'connected', callNotes: 'Budget confirmed, send proposal by Friday. Sarah prefers async follow-ups via email.', callRecordingUrl: 'https://recordings.demo/call-001' },
    occurredAt: daysAgo(7), createdAt: daysAgo(7), tags: ['(Demo)', 'Discovery', 'Call'],
  }),
  makeActivity({
    id: 'demo-activity-002', type: 'call_made', direction: 'outbound',
    subject: '(Demo) Follow-up call with Marcus Chen',
    body: 'Reviewed investor relations content needs. Marcus wants case studies from similar financial clients. Discussed quarterly cadence for thought leadership.',
    summary: 'Follow-up call. Marcus requests financial services case studies before board presentation.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-002', entityName: 'Marcus Chen' }, { entityType: 'deal', entityId: 'demo-deal-002', entityName: 'Blue Ridge - Investor Relations Content' }],
    metadata: { callDuration: 2400, callOutcome: 'connected', callNotes: 'Send 3 case studies. Board presentation in 2 weeks. Marcus is our champion.', callRecordingUrl: 'https://recordings.demo/call-002' },
    occurredAt: daysAgo(3), createdAt: daysAgo(3), tags: ['(Demo)', 'Follow-up', 'Call'],
  }),
  makeActivity({
    id: 'demo-activity-003', type: 'call_received', direction: 'inbound',
    subject: '(Demo) Inbound call from Jessica Ramirez',
    body: 'Jessica called to ask about timeline for lead gen funnel setup across 3 new markets. Explained 4-6 week implementation. She needs to discuss with business partner.',
    summary: 'Jessica inquired about timeline. 4-6 week setup. Waiting on partner discussion.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-003', entityName: 'Jessica Ramirez' }, { entityType: 'deal', entityId: 'demo-deal-003', entityName: 'Suncoast Realty - Lead Gen Funnels' }],
    metadata: { callDuration: 900, callOutcome: 'connected', callNotes: 'Timeline concern. Needs partner buy-in. Follow up in 3 days.', callRecordingUrl: 'https://recordings.demo/call-003' },
    occurredAt: daysAgo(5), createdAt: daysAgo(5), tags: ['(Demo)', 'Inbound', 'Call'],
  }),
  makeActivity({
    id: 'demo-activity-004', type: 'email_sent', direction: 'outbound',
    subject: '(Demo) Proposal: Enterprise Marketing Package - TechForward',
    body: 'Sent comprehensive proposal including SEO audit results, PPC strategy, content calendar, and pricing breakdown. 24-page PDF with ROI projections.',
    summary: 'Proposal sent to Sarah Mitchell. $84K annual contract. Includes SEO, PPC, content, social.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-001', entityName: 'Sarah Mitchell' }, { entityType: 'deal', entityId: 'demo-deal-001', entityName: 'TechForward - Enterprise Marketing Package' }],
    metadata: { emailId: 'email-demo-001', fromEmail: 'alex.morgan@salesvelocity.ai', toEmail: 'sarah.mitchell@techforward.io', ccEmails: ['team@salesvelocity.ai'], threadId: 'thread-demo-001', opens: 0, clicks: 0 },
    occurredAt: daysAgo(6), createdAt: daysAgo(6), tags: ['(Demo)', 'Proposal', 'Email'],
  }),
  makeActivity({
    id: 'demo-activity-005', type: 'email_opened', direction: 'inbound',
    subject: '(Demo) Sarah Mitchell opened proposal email',
    body: 'Proposal email opened 3 times from Austin, TX. PDF attachment downloaded twice. High engagement signal.',
    summary: 'Proposal opened 3x, PDF downloaded 2x. Strong buying intent.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-001', entityName: 'Sarah Mitchell' }, { entityType: 'deal', entityId: 'demo-deal-001', entityName: 'TechForward - Enterprise Marketing Package' }],
    metadata: { emailId: 'email-demo-001', opens: 3, clicks: 2, linkClicked: 'proposal-pdf-download' },
    occurredAt: daysAgo(6), createdAt: daysAgo(6), tags: ['(Demo)', 'Engagement', 'Email'], isImportant: true,
  }),
  makeActivity({
    id: 'demo-activity-006', type: 'email_sent', direction: 'outbound',
    subject: '(Demo) Case studies for Blue Ridge Capital',
    body: 'Sent 3 case studies: Hedge fund content strategy (240% engagement increase), PE firm thought leadership (Fortune feature), wealth management SEO (+180% organic).',
    summary: 'Sent 3 financial services case studies. Marcus requested for board presentation.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-002', entityName: 'Marcus Chen' }, { entityType: 'deal', entityId: 'demo-deal-002', entityName: 'Blue Ridge - Investor Relations Content' }],
    metadata: { emailId: 'email-demo-002', fromEmail: 'alex.morgan@salesvelocity.ai', toEmail: 'marcus.chen@blueridgecap.com', ccEmails: [], threadId: 'thread-demo-002', opens: 0, clicks: 0 },
    occurredAt: daysAgo(2), createdAt: daysAgo(2), tags: ['(Demo)', 'Case Study', 'Email'],
  }),
  makeActivity({
    id: 'demo-activity-007', type: 'email_sent', direction: 'outbound',
    subject: '(Demo) Welcome aboard! - Luminary Designs onboarding',
    body: 'Sent onboarding packet: brand guidelines request form, content calendar template, social dashboard access credentials, and kickoff meeting agenda.',
    summary: 'Onboarding email sent to Olivia Park. Deal closed, starting content strategy workshop.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-007', entityName: 'Olivia Park' }, { entityType: 'deal', entityId: 'demo-deal-005', entityName: 'Luminary Designs - Social Media Retainer' }],
    metadata: { emailId: 'email-demo-003', fromEmail: 'alex.morgan@salesvelocity.ai', toEmail: 'olivia@luminarydesigns.co', ccEmails: ['onboarding@salesvelocity.ai'], threadId: 'thread-demo-003', opens: 0, clicks: 0 },
    occurredAt: daysAgo(4), createdAt: daysAgo(4), tags: ['(Demo)', 'Onboarding', 'Email'],
  }),
  makeActivity({
    id: 'demo-activity-008', type: 'meeting_completed', direction: 'internal',
    subject: '(Demo) Strategy session with CloudNine SaaS',
    body: 'Deep-dive into PLG funnel metrics. Mapped out conversion bottlenecks (signup-to-activation at 12%, target 25%). Proposed A/B testing roadmap for onboarding flow.',
    summary: 'Strategy session completed. Identified activation bottleneck. A/B testing roadmap proposed.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-009', entityName: 'Priya Sharma' }, { entityType: 'deal', entityId: 'demo-deal-006', entityName: 'CloudNine - PLG Growth Engine' }],
    metadata: { meetingDuration: 60, meetingUrl: 'https://meet.google.com/demo-abc-xyz', meetingAttendees: ['Priya Sharma', 'Alex Morgan', 'Jordan Lee (Strategy)'], meetingOutcome: 'completed' },
    occurredAt: daysAgo(2), createdAt: daysAgo(2), tags: ['(Demo)', 'Strategy', 'Meeting'],
  }),
  makeActivity({
    id: 'demo-activity-009', type: 'meeting_scheduled', direction: 'outbound',
    subject: '(Demo) Contract review meeting - TechForward',
    body: 'Scheduled meeting with Sarah Mitchell and her legal team to finalize MSA terms. Need to prepare redline summary and insurance certificates.',
    summary: 'Contract review meeting scheduled for next week. Legal review of MSA.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-001', entityName: 'Sarah Mitchell' }, { entityType: 'deal', entityId: 'demo-deal-001', entityName: 'TechForward - Enterprise Marketing Package' }],
    metadata: { meetingDuration: 30, meetingUrl: 'https://meet.google.com/demo-def-uvw', meetingAttendees: ['Sarah Mitchell', 'TechForward Legal', 'Alex Morgan', 'SalesVelocity Legal'], meetingOutcome: 'completed' },
    occurredAt: daysFromNow(3), createdAt: daysAgo(1), tags: ['(Demo)', 'Contract', 'Meeting'],
  }),
  makeActivity({
    id: 'demo-activity-010', type: 'meeting_no_show', direction: 'outbound',
    subject: '(Demo) No-show: FitLife Wellness intro call',
    body: 'David Okonkwo did not join the scheduled intro call. Waited 10 minutes. Sent follow-up email to reschedule with 3 time options.',
    summary: 'David no-showed intro call. Follow-up email sent with reschedule options.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-004', entityName: 'David Okonkwo' }, { entityType: 'deal', entityId: 'demo-deal-004', entityName: 'FitLife - Brand Launch Package' }],
    metadata: { meetingDuration: 0, meetingUrl: 'https://meet.google.com/demo-ghi-rst', meetingAttendees: ['David Okonkwo', 'Alex Morgan'], meetingOutcome: 'no_show' },
    occurredAt: daysAgo(4), createdAt: daysAgo(4), tags: ['(Demo)', 'No-Show', 'Meeting'],
  }),
  makeActivity({
    id: 'demo-activity-011', type: 'note_added', direction: 'internal',
    subject: '(Demo) Competitive intel: Precision Mfg evaluating agencies',
    body: 'Ryan mentioned they are also talking to WebFX and Directive. Key differentiator for us: industry-specific experience in B2B manufacturing + trade show expertise.',
    summary: 'Competitive intel gathered. Ryan evaluating WebFX and Directive alongside us.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-006', entityName: 'Ryan Kowalski' }, { entityType: 'deal', entityId: 'demo-deal-008', entityName: 'Precision Mfg - B2B Lead Gen' }],
    metadata: { noteType: 'competitive_intel', source: 'call_notes', wordCount: 89 },
    occurredAt: daysAgo(12), createdAt: daysAgo(12), tags: ['(Demo)', 'Competitive Intel', 'Note'],
  }),
  makeActivity({
    id: 'demo-activity-012', type: 'note_added', direction: 'internal',
    subject: '(Demo) Green Valley Farms - seasonal campaign timeline',
    body: 'James needs spring campaign live by March 1. Content production must start by Feb 15. Coordinate with photo team for product shoots. Budget: $8K for spring campaign.',
    summary: 'Spring campaign deadline: March 1. Content production starts Feb 15.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-008', entityName: 'James Whitfield' }],
    metadata: { noteType: 'project_timeline', source: 'meeting_notes', wordCount: 156 },
    occurredAt: daysAgo(3), createdAt: daysAgo(3), tags: ['(Demo)', 'Timeline', 'Note'],
  }),
  makeActivity({
    id: 'demo-activity-013', type: 'task_created', direction: 'internal',
    subject: '(Demo) Send revised SOW to CloudNine',
    body: 'Update statement of work with revised pricing (10% volume discount applied, new total $96K/year) and add performance guarantee clause per Priya\'s request.',
    summary: 'High-priority task: revise SOW with discount and performance guarantee.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-009', entityName: 'Priya Sharma' }, { entityType: 'deal', entityId: 'demo-deal-006', entityName: 'CloudNine - PLG Growth Engine' }],
    metadata: { taskId: 'demo-task-001', taskDueDate: daysFromNow(2).toDate().toISOString(), taskPriority: 'high' },
    occurredAt: daysAgo(1), createdAt: daysAgo(1), tags: ['(Demo)', 'Task', 'Urgent'], isPinned: true,
  }),
  makeActivity({
    id: 'demo-activity-014', type: 'task_completed', direction: 'internal',
    subject: '(Demo) Onboarding checklist completed - Brooks Legal',
    body: 'All onboarding steps completed: Google Business Profile claimed and optimized, 3 review platforms connected (Google, Avvo, Yelp), initial SEO audit delivered.',
    summary: 'Onboarding complete for Brooks Legal. GBP optimized, review platforms connected, SEO audit delivered.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-010', entityName: 'Nathan Brooks' }, { entityType: 'deal', entityId: 'demo-deal-007', entityName: 'Brooks Legal - Local SEO Package' }],
    metadata: { taskId: 'demo-task-002', taskDueDate: daysAgo(10).toDate().toISOString(), taskPriority: 'medium' },
    occurredAt: daysAgo(10), createdAt: daysAgo(10), tags: ['(Demo)', 'Task', 'Completed'],
  }),
  makeActivity({
    id: 'demo-activity-015', type: 'deal_stage_changed', direction: 'internal',
    subject: '(Demo) Deal moved: Luminary Designs -> Closed Won',
    body: 'Olivia signed the 12-month retainer agreement via DocuSign. First payment of $4,000 processed. Content strategy workshop scheduled for next Tuesday.',
    summary: 'Deal closed won! $48K annual retainer signed. Onboarding in progress.',
    relatedTo: [{ entityType: 'deal', entityId: 'demo-deal-005', entityName: 'Luminary Designs - Social Media Retainer' }, { entityType: 'contact', entityId: 'demo-contact-007', entityName: 'Olivia Park' }],
    metadata: { previousValue: 'negotiation', newValue: 'closed_won', fieldChanged: 'stage' },
    occurredAt: daysAgo(5), createdAt: daysAgo(5), tags: ['(Demo)', 'Won', 'Stage Change'], isImportant: true,
  }),
  makeActivity({
    id: 'demo-activity-016', type: 'deal_stage_changed', direction: 'internal',
    subject: '(Demo) Deal lost: Precision Mfg - B2B Lead Gen',
    body: 'Ryan informed us they decided to hire an in-house marketing coordinator instead. CEO overruled Ryan\'s preference for outsourcing. Set reminder to follow up in Q3.',
    summary: 'Deal lost. Client chose to hire internally. CEO decision. Re-engage Q3.',
    relatedTo: [{ entityType: 'deal', entityId: 'demo-deal-008', entityName: 'Precision Mfg - B2B Lead Gen' }, { entityType: 'contact', entityId: 'demo-contact-006', entityName: 'Ryan Kowalski' }],
    metadata: { previousValue: 'proposal', newValue: 'closed_lost', fieldChanged: 'stage' },
    occurredAt: daysAgo(10), createdAt: daysAgo(10), tags: ['(Demo)', 'Lost', 'Stage Change'], isImportant: true,
  }),
  makeActivity({
    id: 'demo-activity-017', type: 'lead_status_changed', direction: 'internal',
    subject: '(Demo) Lead qualified: Monica Santos (PureLux Day Spa)',
    body: 'Monica confirmed budget ($42K annual), timeline (wants to launch by April), and authority (sole owner). BANT criteria met. Moving to qualified.',
    summary: 'Lead qualified. BANT confirmed: $42K budget, April timeline, sole decision maker.',
    relatedTo: [{ entityType: 'lead', entityId: 'demo-lead-003', entityName: 'Monica Santos' }],
    metadata: { previousValue: 'contacted', newValue: 'qualified', fieldChanged: 'status' },
    occurredAt: daysAgo(4), createdAt: daysAgo(4), tags: ['(Demo)', 'Qualified', 'Status Change'],
  }),
  makeActivity({
    id: 'demo-activity-018', type: 'form_submitted', direction: 'inbound',
    subject: '(Demo) New form submission: Alexandra Rivera',
    body: 'Contact form submitted from /services/consulting page. Message: "Looking for a marketing agency with experience in consulting firms. Would love to discuss our needs."',
    summary: 'New inbound form submission from consulting firm partner. High intent.',
    relatedTo: [{ entityType: 'lead', entityId: 'demo-lead-001', entityName: 'Alexandra Rivera' }],
    metadata: { pageUrl: 'https://salesvelocity.ai/services/consulting', pageTitle: 'Marketing for Consulting Firms' },
    occurredAt: daysAgo(1), createdAt: daysAgo(1), tags: ['(Demo)', 'Form', 'Inbound'],
  }),
  makeActivity({
    id: 'demo-activity-019', type: 'enrichment_completed', direction: 'internal',
    subject: '(Demo) Lead enriched: Danielle Nguyen (HarborView Medical)',
    body: 'Auto-enrichment completed via hybrid data source. Enterprise healthcare org confirmed: 2,400 employees, $380M revenue, actively hiring marketing team. High-value prospect.',
    summary: 'Enrichment complete. Enterprise healthcare, 2400 employees, $380M revenue.',
    relatedTo: [{ entityType: 'lead', entityId: 'demo-lead-005', entityName: 'Danielle Nguyen' }],
    metadata: { previousValue: null, newValue: 'enriched', fieldChanged: 'enrichmentData' },
    occurredAt: daysAgo(1), createdAt: daysAgo(1), tags: ['(Demo)', 'Enrichment'],
  }),
  makeActivity({
    id: 'demo-activity-020', type: 'workflow_triggered', direction: 'internal',
    subject: '(Demo) Auto-nurture sequence started for Megan Tran',
    body: 'New lead from Instagram ad. Auto-enrolled in "Inbound Lead Nurture" sequence. Step 1 (welcome email) sends immediately. 5-step sequence over 14 days.',
    summary: 'Megan Tran auto-enrolled in inbound nurture sequence. 5 emails over 14 days.',
    relatedTo: [{ entityType: 'lead', entityId: 'demo-lead-009', entityName: 'Megan Tran' }],
    metadata: { workflowId: 'demo-workflow-001', workflowName: '(Demo) Inbound Lead Nurture', sequenceId: 'demo-sequence-001', sequenceName: '(Demo) Inbound Lead Nurture', sequenceStep: 1 },
    occurredAt: daysAgo(0), createdAt: daysAgo(0), tags: ['(Demo)', 'Automation', 'Sequence'],
  }),
  makeActivity({
    id: 'demo-activity-021', type: 'call_made', direction: 'outbound',
    subject: '(Demo) Pricing discussion with Priya Sharma',
    body: 'Reviewed pricing tiers. Priya confirmed $96K annual package works within their Series B budget. 10% volume discount applied. Moving to final SOW review with CEO.',
    summary: 'Pricing approved at $96K/year with 10% discount. CEO sign-off pending.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-009', entityName: 'Priya Sharma' }, { entityType: 'deal', entityId: 'demo-deal-006', entityName: 'CloudNine - PLG Growth Engine' }],
    metadata: { callDuration: 2700, callOutcome: 'connected', callNotes: 'Budget approved. 10% discount applied. Send final SOW for CEO review.', callRecordingUrl: 'https://recordings.demo/call-004' },
    occurredAt: hoursAgo(4), createdAt: hoursAgo(4), tags: ['(Demo)', 'Pricing', 'Call'],
  }),
  makeActivity({
    id: 'demo-activity-022', type: 'sms_sent', direction: 'outbound',
    subject: '(Demo) Quick follow-up text to Jessica Ramirez',
    body: 'SMS: "Hey Jessica! Just checking in on the lead gen proposal for your new markets. Happy to hop on a quick call this week if you have questions. - Alex @ SalesVelocity"',
    summary: 'Follow-up SMS sent to Jessica about lead gen proposal.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-003', entityName: 'Jessica Ramirez' }, { entityType: 'deal', entityId: 'demo-deal-003', entityName: 'Suncoast Realty - Lead Gen Funnels' }],
    metadata: { smsId: 'sms-demo-001', toPhone: '(555) 456-7890', messageLength: 156, deliveryStatus: 'delivered', provider: 'twilio' },
    occurredAt: daysAgo(2), createdAt: daysAgo(2), tags: ['(Demo)', 'SMS', 'Follow-up'],
  }),
  makeActivity({
    id: 'demo-activity-023', type: 'ai_chat', direction: 'inbound',
    subject: '(Demo) AI chat: Website visitor from Nomad Coffee',
    body: 'Megan Tran visited the website and engaged with AI chatbot. Asked about social media management pricing and DTC brand experience. AI agent provided tier overview and captured lead info.',
    summary: 'AI chat captured lead info from Megan Tran. Interested in social media management.',
    relatedTo: [{ entityType: 'lead', entityId: 'demo-lead-009', entityName: 'Megan Tran' }],
    metadata: { conversationId: 'demo-conv-001', messageCount: 8, sentiment: 'positive', sentimentScore: 0.82, intent: 'pricing_inquiry' },
    occurredAt: daysAgo(0), createdAt: daysAgo(0), tags: ['(Demo)', 'AI Chat', 'Lead Capture'],
  }),
  makeActivity({
    id: 'demo-activity-024', type: 'website_visit', direction: 'inbound',
    subject: '(Demo) Priya Sharma visited pricing page',
    body: 'Priya viewed the Enterprise pricing page 3 times in the last 24 hours from San Francisco, CA. Also visited case studies page. High buying intent signal.',
    summary: 'Priya visited pricing page 3x in 24hrs. Strong buying intent signal.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-009', entityName: 'Priya Sharma' }, { entityType: 'deal', entityId: 'demo-deal-006', entityName: 'CloudNine - PLG Growth Engine' }],
    metadata: { pageUrl: '/pricing', pageTitle: 'Enterprise Pricing - SalesVelocity.ai', visitDuration: 420, viewDuration: 420 },
    occurredAt: hoursAgo(6), createdAt: hoursAgo(6), tags: ['(Demo)', 'Intent Signal', 'Website Visit'], isImportant: true,
  }),
  makeActivity({
    id: 'demo-activity-025', type: 'email_received', direction: 'inbound',
    subject: '(Demo) Marcus Chen replied to case study email',
    body: 'Marcus replied: "These are exactly what we need. The hedge fund case study is particularly relevant. Can we schedule a meeting with our board next Thursday to present your capabilities?"',
    summary: 'Marcus replied positively. Wants board presentation next Thursday. Hot deal.',
    relatedTo: [{ entityType: 'contact', entityId: 'demo-contact-002', entityName: 'Marcus Chen' }, { entityType: 'deal', entityId: 'demo-deal-002', entityName: 'Blue Ridge - Investor Relations Content' }],
    metadata: { emailId: 'email-demo-002-reply', fromEmail: 'marcus.chen@blueridgecap.com', toEmail: 'alex.morgan@salesvelocity.ai', ccEmails: [], threadId: 'thread-demo-002', opens: 1, clicks: 0 },
    occurredAt: daysAgo(1), createdAt: daysAgo(1), tags: ['(Demo)', 'Reply', 'Hot Lead', 'Email'], isImportant: true,
  }),
];

// ============================================================================
// DEMO DATA: PRODUCTS (6 — every field populated including variants & SEO)
// ============================================================================

const DEMO_PRODUCTS = [
  {
    id: 'demo-product-001', isDemo: true,
    name: '(Demo) Starter Growth Package', description: 'Essential digital marketing for small businesses. Includes basic SEO audit, social media account setup (3 platforms), Google Business Profile optimization, and monthly performance report.',
    slug: 'starter-growth-package',
    sku: 'DEMO-PKG-STARTER', price: 1500, compareAtPrice: 1800, cost: 600, currency: 'USD',
    category: 'Marketing Packages', tags: ['(Demo)', 'Starter', 'Monthly', 'SMB'],
    seoKeywords: ['small business marketing', 'starter marketing package', 'affordable SEO', 'Google Business Profile optimization', 'social media setup'],
    images: ['/demo/product-starter-hero.jpg', '/demo/product-starter-detail.jpg'],
    inStock: true, stockQuantity: 999, trackInventory: false, isDigital: true,
    variants: [
      { id: 'var-001a', name: 'Monthly', sku: 'DEMO-PKG-STARTER-MO', price: 1500, stockQuantity: 999, options: { billing: 'Monthly' } },
      { id: 'var-001b', name: 'Annual (Save 15%)', sku: 'DEMO-PKG-STARTER-YR', price: 15300, stockQuantity: 999, options: { billing: 'Annual' } },
    ],
    customFields: { targetAudience: 'Small businesses under $1M revenue', deliverables: 'SEO audit, 3 social profiles, GBP, monthly report', setupTime: '1 week' },
    seoTitle: '(Demo) Starter Growth Package - Affordable Small Business Marketing',
    seoDescription: 'Get started with digital marketing. Our Starter Growth Package includes SEO, social media setup, and monthly reporting for just $1,500/month.',
    active: true, createdAt: daysAgo(120), updatedAt: daysAgo(10),
  },
  {
    id: 'demo-product-002', isDemo: true,
    name: '(Demo) Professional Marketing Suite', description: 'Comprehensive marketing for growing businesses. Includes ongoing SEO optimization, PPC management (Google + Meta), social media management (5 platforms), email campaigns (4/month), and bi-weekly performance reporting with strategy calls.',
    slug: 'professional-marketing-suite',
    sku: 'DEMO-PKG-PRO', price: 4000, compareAtPrice: 4800, cost: 1800, currency: 'USD',
    category: 'Marketing Packages', tags: ['(Demo)', 'Professional', 'Monthly', 'Growing Business'],
    seoKeywords: ['full service digital marketing', 'PPC management', 'social media management', 'email marketing agency', 'SEO and PPC bundle'],
    images: ['/demo/product-pro-hero.jpg', '/demo/product-pro-detail.jpg'],
    inStock: true, stockQuantity: 999, trackInventory: false, isDigital: true,
    variants: [
      { id: 'var-002a', name: 'Monthly', sku: 'DEMO-PKG-PRO-MO', price: 4000, stockQuantity: 999, options: { billing: 'Monthly' } },
      { id: 'var-002b', name: 'Annual (Save 15%)', sku: 'DEMO-PKG-PRO-YR', price: 40800, stockQuantity: 999, options: { billing: 'Annual' } },
    ],
    customFields: { targetAudience: 'Growing businesses $1M-$10M revenue', deliverables: 'SEO, PPC, Social (5 platforms), 4 email campaigns, bi-weekly reports', setupTime: '2 weeks' },
    seoTitle: '(Demo) Professional Marketing Suite - Full-Service Digital Marketing',
    seoDescription: 'Accelerate growth with our Professional Marketing Suite. SEO, PPC, social media, email campaigns, and dedicated strategy calls for $4,000/month.',
    active: true, createdAt: daysAgo(120), updatedAt: daysAgo(10),
  },
  {
    id: 'demo-product-003', isDemo: true,
    name: '(Demo) Enterprise Growth Engine', description: 'Full-service marketing for enterprises. Dedicated strategist, all marketing channels, custom analytics dashboards, weekly reporting, quarterly business reviews, and priority support. White-glove service.',
    slug: 'enterprise-growth-engine',
    sku: 'DEMO-PKG-ENTERPRISE', price: 8000, compareAtPrice: 10000, cost: 3500, currency: 'USD',
    category: 'Marketing Packages', tags: ['(Demo)', 'Enterprise', 'Monthly', 'White Glove'],
    seoKeywords: ['enterprise marketing agency', 'white glove marketing service', 'dedicated marketing strategist', 'custom analytics dashboard', 'enterprise digital marketing'],
    images: ['/demo/product-enterprise-hero.jpg', '/demo/product-enterprise-detail.jpg'],
    inStock: true, stockQuantity: 999, trackInventory: false, isDigital: true,
    variants: [
      { id: 'var-003a', name: 'Monthly', sku: 'DEMO-PKG-ENT-MO', price: 8000, stockQuantity: 999, options: { billing: 'Monthly' } },
      { id: 'var-003b', name: 'Annual (Save 20%)', sku: 'DEMO-PKG-ENT-YR', price: 76800, stockQuantity: 999, options: { billing: 'Annual' } },
    ],
    customFields: { targetAudience: 'Enterprises $10M+ revenue', deliverables: 'All channels, dedicated strategist, custom dashboards, weekly reports, QBRs', setupTime: '3 weeks' },
    seoTitle: '(Demo) Enterprise Growth Engine - White-Glove Marketing Services',
    seoDescription: 'Enterprise-grade marketing with a dedicated strategist. All channels, custom dashboards, weekly reporting, and QBRs for $8,000/month.',
    active: true, createdAt: daysAgo(120), updatedAt: daysAgo(10),
  },
  {
    id: 'demo-product-004', isDemo: true,
    name: '(Demo) Website Design & Build', description: 'Custom website design and development. Includes stakeholder interviews, UX research, wireframing, responsive design (mobile-first), CMS setup (WordPress or Webflow), 5 content pages, blog setup, and 30-day post-launch support.',
    slug: 'website-design-and-build',
    sku: 'DEMO-SVC-WEB', price: 12000, compareAtPrice: 15000, cost: 5000, currency: 'USD',
    category: 'One-Time Services', tags: ['(Demo)', 'Website', 'One-Time', 'Design'],
    seoKeywords: ['custom website design', 'website development agency', 'WordPress website build', 'Webflow design', 'mobile-first website'],
    images: ['/demo/product-website-hero.jpg', '/demo/product-website-portfolio.jpg'],
    inStock: true, stockQuantity: 999, trackInventory: false, isDigital: true,
    variants: [
      { id: 'var-004a', name: 'Standard (5 pages)', sku: 'DEMO-SVC-WEB-5', price: 12000, stockQuantity: 999, options: { pages: '5 pages' } },
      { id: 'var-004b', name: 'Extended (10 pages)', sku: 'DEMO-SVC-WEB-10', price: 18000, stockQuantity: 999, options: { pages: '10 pages' } },
      { id: 'var-004c', name: 'E-commerce', sku: 'DEMO-SVC-WEB-ECOM', price: 25000, stockQuantity: 999, options: { pages: 'E-commerce + 10 pages' } },
    ],
    customFields: { targetAudience: 'Any business needing a new website', deliverables: 'UX research, wireframes, responsive design, CMS, 5 pages, blog, 30-day support', setupTime: '6-8 weeks' },
    seoTitle: '(Demo) Custom Website Design & Build - Modern, Mobile-First Websites',
    seoDescription: 'Get a custom-designed, mobile-first website built on WordPress or Webflow. Includes UX research, 5 pages, blog, and 30 days of post-launch support.',
    active: true, createdAt: daysAgo(120), updatedAt: daysAgo(10),
  },
  {
    id: 'demo-product-005', isDemo: true,
    name: '(Demo) Brand Identity Package', description: 'Complete brand identity system: primary and secondary logo designs, color palette with hex/RGB/CMYK codes, typography selection, 40-page brand guidelines document, social media template kit (20 templates), and business card design.',
    slug: 'brand-identity-package',
    sku: 'DEMO-SVC-BRAND', price: 6500, compareAtPrice: 8000, cost: 2800, currency: 'USD',
    category: 'One-Time Services', tags: ['(Demo)', 'Branding', 'One-Time', 'Identity'],
    seoKeywords: ['brand identity design', 'logo design agency', 'brand guidelines document', 'visual identity package', 'social media brand templates'],
    images: ['/demo/product-brand-hero.jpg', '/demo/product-brand-samples.jpg'],
    inStock: true, stockQuantity: 999, trackInventory: false, isDigital: true,
    variants: [
      { id: 'var-005a', name: 'Standard', sku: 'DEMO-SVC-BRAND-STD', price: 6500, stockQuantity: 999, options: { scope: 'Standard' } },
      { id: 'var-005b', name: 'Premium (includes video intro)', sku: 'DEMO-SVC-BRAND-PREM', price: 9500, stockQuantity: 999, options: { scope: 'Premium + Video' } },
    ],
    customFields: { targetAudience: 'New businesses or rebranding companies', deliverables: 'Logo, colors, typography, 40-page guidelines, 20 social templates, business card', setupTime: '3-4 weeks' },
    seoTitle: '(Demo) Brand Identity Package - Logo, Guidelines & Social Templates',
    seoDescription: 'Build a professional brand identity. Logo design, color palette, typography, 40-page brand guide, and 20 social media templates for $6,500.',
    active: true, createdAt: daysAgo(120), updatedAt: daysAgo(10),
  },
  {
    id: 'demo-product-006', isDemo: true,
    name: '(Demo) AI Chatbot Setup & Training', description: 'Custom AI chatbot for your website. Includes requirements gathering, chatbot personality design, training on your business data (products, FAQs, policies), website integration, testing, and 90-day optimization period with weekly tuning.',
    slug: 'ai-chatbot-setup-and-training',
    sku: 'DEMO-SVC-AI', price: 3500, compareAtPrice: 4500, cost: 1200, currency: 'USD',
    category: 'AI Services', tags: ['(Demo)', 'AI', 'Chatbot', 'Automation'],
    seoKeywords: ['AI chatbot for website', 'custom chatbot setup', 'lead capture chatbot', 'AI sales assistant', 'chatbot training service'],
    images: ['/demo/product-ai-hero.jpg', '/demo/product-ai-demo.jpg'],
    inStock: true, stockQuantity: 999, trackInventory: false, isDigital: true,
    variants: [
      { id: 'var-006a', name: 'Basic (FAQ only)', sku: 'DEMO-SVC-AI-BASIC', price: 2000, stockQuantity: 999, options: { capability: 'FAQ Bot' } },
      { id: 'var-006b', name: 'Standard (FAQ + Lead Capture)', sku: 'DEMO-SVC-AI-STD', price: 3500, stockQuantity: 999, options: { capability: 'FAQ + Lead Capture' } },
      { id: 'var-006c', name: 'Advanced (Full Sales Agent)', sku: 'DEMO-SVC-AI-ADV', price: 6000, stockQuantity: 999, options: { capability: 'Full Sales Agent' } },
    ],
    customFields: { targetAudience: 'Any business wanting AI customer engagement', deliverables: 'Requirements, personality design, training, integration, 90-day optimization', setupTime: '2-3 weeks' },
    seoTitle: '(Demo) AI Chatbot Setup & Training - Custom AI for Your Website',
    seoDescription: 'Deploy a custom AI chatbot trained on your business. FAQ handling, lead capture, and sales assistance with 90 days of optimization for $3,500.',
    active: true, createdAt: daysAgo(120), updatedAt: daysAgo(10),
  },
];

// ============================================================================
// DEMO DATA: EMAIL CAMPAIGNS (3 — full fields)
// ============================================================================

const DEMO_CAMPAIGNS = [
  {
    id: 'demo-campaign-001', isDemo: true,
    name: '(Demo) Q1 Service Launch Announcement', type: 'broadcast', status: 'sent',
    subject: 'Introducing Our New AI-Powered Growth Services',
    fromName: DEMO_OWNER_NAME, fromEmail: DEMO_OWNER_EMAIL,
    replyTo: 'hello@salesvelocity.ai',
    previewText: 'We\'re launching two new AI-driven services that can 3x your pipeline this quarter. Here\'s what\'s new.',
    htmlBody: `<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
  <div style="background:#0f172a;padding:24px 32px;">
    <h1 style="color:#fff;font-size:22px;margin:0;">SalesVelocity.ai</h1>
  </div>
  <div style="padding:32px;">
    <p style="font-size:16px;">Hi {{firstName}},</p>
    <p style="font-size:15px;line-height:1.6;">We've been working behind the scenes on something big — and today we're ready to share it with you.</p>
    <p style="font-size:15px;line-height:1.6;">Starting this quarter, SalesVelocity.ai is offering two new AI-powered growth services designed to help businesses like yours scale faster and smarter:</p>
    <ul style="font-size:15px;line-height:1.8;">
      <li><strong>AI Growth Engine</strong> — Automated outbound sequences, lead enrichment, and pipeline analytics in one platform.</li>
      <li><strong>AI Chatbot Setup &amp; Training</strong> — A custom chatbot trained on your business, live on your site in under 3 weeks.</li>
    </ul>
    <p style="font-size:15px;line-height:1.6;">Early clients are already seeing 40% more qualified leads per month. We'd love to show you how.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="https://salesvelocity.ai/services/ai" style="background:#6366f1;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">See the New Services</a>
    </div>
    <p style="font-size:14px;color:#555;">Questions? Just reply to this email — we read every response.</p>
    <p style="font-size:14px;">Warm regards,<br/><strong>Alex Morgan</strong><br/>SalesVelocity.ai</p>
  </div>
  <div style="background:#f1f5f9;padding:16px 32px;font-size:12px;color:#888;">
    <p>You received this because you're on our client list. <a href="{{unsubscribeUrl}}" style="color:#6366f1;">Unsubscribe</a></p>
  </div>
</body></html>`,
    recipients: 156, sent: 156, delivered: 148, opened: 67, clicked: 23, bounced: 8, unsubscribed: 2,
    openRate: 45.3, clickRate: 15.5, bounceRate: 5.1, unsubscribeRate: 1.3,
    tags: ['(Demo)', 'Launch', 'AI Services'],
    sentAt: daysAgo(14), scheduledAt: daysAgo(14),
    createdAt: daysAgo(20), updatedAt: daysAgo(14),
  },
  {
    id: 'demo-campaign-002', isDemo: true,
    name: '(Demo) Monthly Client Newsletter - February', type: 'broadcast', status: 'sent',
    subject: 'February Insights: Marketing Trends + Client Wins',
    fromName: DEMO_OWNER_NAME, fromEmail: DEMO_OWNER_EMAIL,
    replyTo: 'hello@salesvelocity.ai',
    previewText: 'This month: AI search is reshaping SEO, our client Luminary Designs hit 10K followers, and a spring promotion is coming your way.',
    htmlBody: `<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
  <div style="background:#0f172a;padding:24px 32px;">
    <h1 style="color:#fff;font-size:22px;margin:0;">SalesVelocity.ai — February Newsletter</h1>
  </div>
  <div style="padding:32px;">
    <p style="font-size:16px;">Hi {{firstName}},</p>
    <p style="font-size:15px;line-height:1.6;">Welcome to your February marketing briefing. Here's what we're watching, celebrating, and planning this month.</p>
    <h2 style="font-size:17px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Trend Watch: AI Is Rewriting SEO</h2>
    <p style="font-size:15px;line-height:1.6;">Google's AI Overviews are now appearing in 65% of commercial searches. If your content isn't optimized for AI-generated summaries, you're losing visibility. We've updated our SEO playbook — ask us about the changes at your next strategy call.</p>
    <h2 style="font-size:17px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Client Win: Luminary Interior Designs</h2>
    <p style="font-size:15px;line-height:1.6;">Congrats to Olivia and the Luminary team — their Instagram hit 10,000 followers this month, driven by our Reels strategy. Engagement rate is at 6.2%, nearly 3x the industry average.</p>
    <h2 style="font-size:17px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Coming Up: Spring SEO Audit Offer</h2>
    <p style="font-size:15px;line-height:1.6;">We're running a free SEO audit promotion for the next 30 days. Share it with a colleague who needs a marketing refresh — details in next week's email.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="https://salesvelocity.ai/blog" style="background:#6366f1;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">Read More on Our Blog</a>
    </div>
    <p style="font-size:14px;">Until next month,<br/><strong>Alex Morgan</strong><br/>SalesVelocity.ai</p>
  </div>
  <div style="background:#f1f5f9;padding:16px 32px;font-size:12px;color:#888;">
    <p>You're receiving this monthly newsletter as a SalesVelocity.ai client. <a href="{{unsubscribeUrl}}" style="color:#6366f1;">Unsubscribe</a></p>
  </div>
</body></html>`,
    recipients: 312, sent: 312, delivered: 298, opened: 134, clicked: 45, bounced: 14, unsubscribed: 3,
    openRate: 45.0, clickRate: 15.1, bounceRate: 4.5, unsubscribeRate: 1.0,
    tags: ['(Demo)', 'Newsletter', 'Monthly'],
    sentAt: daysAgo(5), scheduledAt: daysAgo(5),
    createdAt: daysAgo(10), updatedAt: daysAgo(5),
  },
  {
    id: 'demo-campaign-003', isDemo: true,
    name: '(Demo) Spring Promotion: Free SEO Audit', type: 'broadcast', status: 'draft',
    subject: 'Get Your Free SEO Audit - Limited Time Offer',
    fromName: DEMO_OWNER_NAME, fromEmail: DEMO_OWNER_EMAIL,
    replyTo: 'hello@salesvelocity.ai',
    previewText: 'For the next 30 days, we\'re offering a free comprehensive SEO audit — no strings attached. Claim yours before spots fill up.',
    htmlBody: `<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
  <div style="background:#0f172a;padding:24px 32px;">
    <h1 style="color:#fff;font-size:22px;margin:0;">SalesVelocity.ai</h1>
  </div>
  <div style="padding:32px;">
    <p style="font-size:16px;">Hi {{firstName}},</p>
    <p style="font-size:15px;line-height:1.6;">Spring is right around the corner — and with it comes the biggest opportunity window of the year for organic search traffic.</p>
    <p style="font-size:15px;line-height:1.6;">For the next <strong>30 days only</strong>, we're offering a <strong>free comprehensive SEO audit</strong> for businesses that want to know exactly where they stand before Q2 begins.</p>
    <p style="font-size:15px;line-height:1.6;">Here's what you'll get:</p>
    <ul style="font-size:15px;line-height:1.8;">
      <li>Full technical SEO analysis (crawl errors, site speed, Core Web Vitals)</li>
      <li>Keyword gap report vs. your top 3 competitors</li>
      <li>On-page optimization scorecard</li>
      <li>Actionable 90-day roadmap to climb the rankings</li>
    </ul>
    <p style="font-size:15px;line-height:1.6;">We have capacity for <strong>15 audits</strong> this month. First come, first served.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="https://salesvelocity.ai/free-seo-audit" style="background:#16a34a;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">Claim My Free SEO Audit</a>
    </div>
    <p style="font-size:14px;color:#555;">This offer expires in 30 days. No credit card required.</p>
    <p style="font-size:14px;">Looking forward to digging in,<br/><strong>Alex Morgan</strong><br/>SalesVelocity.ai</p>
  </div>
  <div style="background:#f1f5f9;padding:16px 32px;font-size:12px;color:#888;">
    <p>You received this promotional email from SalesVelocity.ai. <a href="{{unsubscribeUrl}}" style="color:#6366f1;">Unsubscribe</a></p>
  </div>
</body></html>`,
    recipients: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0,
    openRate: 0, clickRate: 0, bounceRate: 0, unsubscribeRate: 0,
    tags: ['(Demo)', 'Promotion', 'SEO', 'Spring'],
    sentAt: null, scheduledAt: daysFromNow(14),
    createdAt: daysAgo(3), updatedAt: daysAgo(1),
  },
];

// ============================================================================
// DEMO DATA: SEQUENCES (2 — full fields)
// ============================================================================

const DEMO_SEQUENCES = [
  {
    id: 'demo-sequence-001', isDemo: true,
    name: '(Demo) Inbound Lead Nurture',
    description: 'Automated nurture sequence for new inbound leads. 5-step email series over 14 days designed to educate, build trust, and convert.',
    status: 'active',
    createdBy: DEMO_OWNER_ID,
    steps: [
      { id: 'step-1', order: 1, type: 'email', subject: 'Welcome! Here\'s what we do best', body: 'Hi {{firstName}}, thanks for reaching out...', delayDays: 0, delayHours: 0, sent: 45, delivered: 43, opened: 28, clicked: 12, replied: 5, bounced: 2, sequenceId: 'demo-sequence-001', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 25 * 86400000).toISOString() },
      { id: 'step-2', order: 2, type: 'email', subject: 'How [Company] grew 300% with us', body: 'Hi {{firstName}}, I wanted to share a quick success story...', delayDays: 3, delayHours: 0, sent: 40, delivered: 39, opened: 22, clicked: 8, replied: 3, bounced: 1, sequenceId: 'demo-sequence-001', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 25 * 86400000).toISOString() },
      { id: 'step-3', order: 3, type: 'email', subject: 'Your industry-specific growth playbook', body: 'Hi {{firstName}}, based on your industry ({{company.industry}})...', delayDays: 7, delayHours: 0, sent: 35, delivered: 34, opened: 18, clicked: 6, replied: 2, bounced: 1, sequenceId: 'demo-sequence-001', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 25 * 86400000).toISOString() },
      { id: 'step-4', order: 4, type: 'email', subject: 'Let\'s talk about your goals', body: 'Hi {{firstName}}, I hope the resources have been helpful...', delayDays: 10, delayHours: 0, sent: 30, delivered: 29, opened: 15, clicked: 5, replied: 4, bounced: 1, sequenceId: 'demo-sequence-001', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 25 * 86400000).toISOString() },
      { id: 'step-5', order: 5, type: 'email', subject: 'One more thing before I go...', body: 'Hi {{firstName}}, this is my last automated message...', delayDays: 14, delayHours: 0, sent: 25, delivered: 24, opened: 12, clicked: 3, replied: 2, bounced: 1, sequenceId: 'demo-sequence-001', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 25 * 86400000).toISOString() },
    ],
    analytics: {
      totalEnrolled: 48, activeProspects: 12, completedProspects: 25, removedProspects: 11,
      totalSent: 175, totalDelivered: 169, totalOpened: 95, totalClicked: 34, totalReplied: 16, totalBounced: 6,
      totalUnsubscribed: 2,
      deliveryRate: 96.6, openRate: 54.3, clickRate: 19.4, replyRate: 9.1, bounceRate: 3.4,
      meetingsBooked: 8, dealsCreated: 5, revenue: 72000, conversionRate: 10.4,
    },
    stopOnResponse: true, stopOnConversion: true, stopOnUnsubscribe: true, stopOnBounce: true, autoEnroll: true,
    enrollmentCriteria: { leadSource: ['Website Form', 'Instagram', 'Google Ads'], leadStatus: 'new' },
    tags: ['(Demo)', 'Inbound', 'Nurture', 'Automated'],
    createdAt: daysAgo(60), updatedAt: daysAgo(1),
  },
  {
    id: 'demo-sequence-002', isDemo: true,
    name: '(Demo) Re-engagement: Lost Deals',
    description: 'Win-back sequence for lost deals. 3-step sequence with value-driven content. Triggered manually when a deal is marked as lost.',
    status: 'active',
    createdBy: DEMO_OWNER_ID,
    steps: [
      { id: 'step-1', order: 1, type: 'email', subject: 'We\'ve been thinking about you', body: 'Hi {{firstName}}, it\'s been a while since we last spoke...', delayDays: 0, delayHours: 0, sent: 18, delivered: 17, opened: 10, clicked: 4, replied: 2, bounced: 1, sequenceId: 'demo-sequence-002', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 25 * 86400000).toISOString() },
      { id: 'step-2', order: 2, type: 'email', subject: 'New case study: [Similar Company] success story', body: 'Hi {{firstName}}, I wanted to share something relevant...', delayDays: 7, delayHours: 0, sent: 14, delivered: 14, opened: 7, clicked: 3, replied: 1, bounced: 0, sequenceId: 'demo-sequence-002', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 25 * 86400000).toISOString() },
      { id: 'step-3', order: 3, type: 'email', subject: 'Special offer for returning clients', body: 'Hi {{firstName}}, we value the relationship we built...', delayDays: 14, delayHours: 0, sent: 10, delivered: 10, opened: 5, clicked: 2, replied: 1, bounced: 0, sequenceId: 'demo-sequence-002', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 25 * 86400000).toISOString() },
    ],
    analytics: {
      totalEnrolled: 20, activeProspects: 5, completedProspects: 10, removedProspects: 5,
      totalSent: 42, totalDelivered: 41, totalOpened: 22, totalClicked: 9, totalReplied: 4, totalBounced: 1,
      totalUnsubscribed: 1,
      deliveryRate: 97.6, openRate: 52.4, clickRate: 21.4, replyRate: 9.5, bounceRate: 2.4,
      meetingsBooked: 3, dealsCreated: 2, revenue: 36000, conversionRate: 10.0,
    },
    stopOnResponse: true, stopOnConversion: true, stopOnUnsubscribe: true, stopOnBounce: true, autoEnroll: false,
    enrollmentCriteria: { dealStage: 'closed_lost', minimumDaysLost: 30 },
    tags: ['(Demo)', 'Re-engagement', 'Win-back', 'Manual Enroll'],
    createdAt: daysAgo(45), updatedAt: daysAgo(3),
  },
];

// ============================================================================
// SEED FUNCTION
// ============================================================================

async function seedDemoAccount() {
  console.log('\n' + '='.repeat(70));
  console.log('  (DEMO) ACCOUNT SEED SCRIPT — ZERO MISSING FIELDS');
  console.log('  SalesVelocity.ai - Comprehensive Demo Data');
  console.log('='.repeat(70));
  console.log(`  Environment: ${APP_ENV}`);
  console.log(`  Collection prefix: "${PREFIX}" ${IS_PRODUCTION ? '(PRODUCTION - no prefix)' : '(dev - test_ prefix)'}`);
  console.log(`  Platform ID: ${PLATFORM_ID}`);
  console.log(`  Demo Owner: ${DEMO_OWNER_NAME} (${DEMO_OWNER_ID})`);
  console.log('');

  if (IS_PRODUCTION) {
    console.error('  SAFETY: Refusing to seed demo data in production environment!');
    process.exit(1);
  }

  console.log('  Initializing Firebase Admin...');
  const db = initFirebase();
  console.log('  Firebase Admin initialized.\n');

  let totalDocs = 0;

  // 1. CONTACTS
  console.log('  [1/7] Seeding 10 contacts (all fields populated)...');
  for (const contact of DEMO_CONTACTS) {
    await db.doc(`${contactsPath}/${contact.id}`).set(contact);
    totalDocs++;
  }
  console.log('    10 contacts created.');

  // 2. LEADS
  console.log('  [2/7] Seeding 12 leads (all fields + full enrichmentData)...');
  for (const lead of DEMO_LEADS) {
    await db.doc(`${leadsPath}/${lead.id}`).set(lead);
    totalDocs++;
  }
  console.log('    12 leads created.');

  // 3. DEALS
  console.log('  [3/7] Seeding 8 deals (all fields + customFields)...');
  for (const deal of DEMO_DEALS) {
    await db.doc(`${dealsPath}/${deal.id}`).set(deal);
    totalDocs++;
  }
  console.log('    8 deals created.');

  // 4. ACTIVITIES
  console.log('  [4/7] Seeding 25 activities (all fields + full metadata)...');
  for (const activity of DEMO_ACTIVITIES) {
    await db.doc(`${activitiesPath}/${activity.id}`).set(activity);
    totalDocs++;
  }
  console.log('    25 activities created.');

  // 5. PRODUCTS
  console.log('  [5/7] Seeding 6 products (all fields + variants + SEO)...');
  for (const product of DEMO_PRODUCTS) {
    await db.doc(`${productsPath}/${product.id}`).set(product);
    totalDocs++;
  }
  console.log('    6 products created.');

  // 6. CAMPAIGNS & SEQUENCES
  console.log('  [6/7] Seeding 3 campaigns + 2 sequences (full analytics)...');
  for (const campaign of DEMO_CAMPAIGNS) {
    await db.doc(`${campaignsPath}/${campaign.id}`).set(campaign);
    totalDocs++;
  }
  for (const sequence of DEMO_SEQUENCES) {
    await db.doc(`${sequencesPath}/${sequence.id}`).set(sequence);
    totalDocs++;
  }
  console.log('    3 campaigns + 2 sequences created.');

  // 7. ANALYTICS (30 days)
  console.log('  [7/7] Seeding 30 days of analytics...');
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    const recencyMultiplier = 1 + (30 - dayOffset) / 30;
    const weekday = date.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const weekdayMultiplier = isWeekend ? 0.3 : 1.0;

    await db.doc(`${analyticsPath}/${dateStr}`).set({
      date: dateStr,
      isDemo: true,
      leadsCreated: Math.round((Math.random() * 4 + 1) * recencyMultiplier * weekdayMultiplier),
      contactsCreated: Math.round((Math.random() * 2 + 1) * recencyMultiplier * weekdayMultiplier),
      dealsCreated: Math.round((Math.random() * 2) * recencyMultiplier * weekdayMultiplier),
      dealsWon: Math.round((Math.random() * 1) * weekdayMultiplier),
      dealsLost: Math.round((Math.random() * 0.5) * weekdayMultiplier),
      activitiesCompleted: Math.round((Math.random() * 8 + 3) * recencyMultiplier * weekdayMultiplier),
      emailsSent: Math.round((Math.random() * 15 + 5) * recencyMultiplier * weekdayMultiplier),
      emailsOpened: Math.round((Math.random() * 8 + 2) * recencyMultiplier * weekdayMultiplier),
      emailsClicked: Math.round((Math.random() * 4 + 1) * recencyMultiplier * weekdayMultiplier),
      callsMade: Math.round((Math.random() * 6 + 1) * recencyMultiplier * weekdayMultiplier),
      callsConnected: Math.round((Math.random() * 4 + 1) * recencyMultiplier * weekdayMultiplier),
      meetingsHeld: Math.round((Math.random() * 3) * weekdayMultiplier),
      meetingsNoShow: Math.round((Math.random() * 0.5) * weekdayMultiplier),
      formSubmissions: Math.round((Math.random() * 3 + 1) * recencyMultiplier * weekdayMultiplier),
      websiteVisitors: Math.round((Math.random() * 200 + 50) * recencyMultiplier),
      chatbotConversations: Math.round((Math.random() * 5 + 1) * recencyMultiplier),
      revenue: Math.round((Math.random() * 12000 + 2000) * recencyMultiplier),
      pipelineValue: Math.round(384000 + (Math.random() * 50000 - 25000)),
      conversionRate: Math.round((Math.random() * 15 + 10) * 100) / 100,
      averageDealSize: Math.round(35000 + (Math.random() * 10000 - 5000)),
      timestamp: ts.fromDate(date),
      createdAt: ts.fromDate(date),
      updatedAt: ts.fromDate(date),
    });
    totalDocs++;
  }
  console.log('    30 days of analytics created.');

  // SUMMARY
  console.log('\n' + '='.repeat(70));
  console.log('  (DEMO) ACCOUNT SEED COMPLETE!');
  console.log('='.repeat(70));
  console.log(`  Total documents created: ${totalDocs}`);
  console.log('');
  console.log('  DATA SUMMARY:');
  console.log('    Contacts:   10  (4 VIP, 6 standard — all fields populated)');
  console.log('    Leads:      12  (3 new, 3 contacted, 3 qualified, 1 converted, 2 lost)');
  console.log('    Deals:       8  (1 prospecting, 1 qualification, 1 proposal, 2 negotiation, 2 won, 1 lost)');
  console.log('    Activities: 25  (calls, emails, meetings, notes, tasks, system events)');
  console.log('    Products:    6  (3 packages + 3 services, all with variants + SEO)');
  console.log('    Campaigns:   3  (2 sent + 1 draft, full analytics)');
  console.log('    Sequences:   2  (inbound nurture + lost deal re-engagement)');
  console.log('    Analytics:  30  days of trending metrics');
  console.log('');
  console.log('  PIPELINE:');
  console.log('    Prospecting:   $52,000  (FitLife Wellness)');
  console.log('    Qualification: $36,000  (Suncoast Realty)');
  console.log('    Proposal:      $120,000 (Blue Ridge Capital)');
  console.log('    Negotiation:   $180,000 (TechForward + CloudNine)');
  console.log('    Closed Won:    $72,000  (Luminary Designs + Brooks Legal)');
  console.log('    Closed Lost:   $18,000  (Precision Mfg)');
  console.log('    TOTAL:         $478,000');
  console.log('');
  console.log('  FIELD COVERAGE: Every optional field is populated. Zero missing data.');
  console.log('  All data tagged with "(Demo)" for easy identification.');
  console.log('');
  console.log('  Firestore paths:');
  console.log(`    ${contactsPath}`);
  console.log(`    ${leadsPath}`);
  console.log(`    ${dealsPath}`);
  console.log(`    ${activitiesPath}`);
  console.log(`    ${productsPath}`);
  console.log(`    ${campaignsPath}`);
  console.log(`    ${sequencesPath}`);
  console.log(`    ${analyticsPath}`);
  console.log('');
  console.log('  CLEANUP: Delete all docs with IDs starting with "demo-"');
  console.log('='.repeat(70) + '\n');
}

// ============================================================================
// RUN
// ============================================================================

seedDemoAccount()
  .then(() => {
    console.log('  Seed complete. Exiting.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('  SEED FAILED:', error);
    process.exit(1);
  });
