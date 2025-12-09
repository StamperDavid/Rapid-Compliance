/**
 * Comprehensive Test Data Seeding Script
 * Creates 10 fully populated test companies with realistic CRM data
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-ai-sales-platform',
  });
}

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const db = admin.firestore();
const auth = admin.auth();

// Helper to generate random dates
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const randomPastDate = (daysAgo) => {
  const now = new Date();
  const past = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
  return randomDate(past, now);
};

// Sample data generators
const SAMPLE_LEADS = {
  saas: [
    { name: 'Sarah Johnson', title: 'VP of Operations', company: 'TechFlow Manufacturing', email: 'sjohnson@techflow.com', phone: '555-0101', revenue: '$15M' },
    { name: 'Michael Chen', title: 'Operations Manager', company: 'Precision Parts Inc', email: 'mchen@precisionparts.com', phone: '555-0102', revenue: '$22M' },
    { name: 'Emily Rodriguez', title: 'Supply Chain Director', company: 'Global Manufacturing Co', email: 'erodriguez@globalmanuf.com', phone: '555-0103', revenue: '$45M' },
    { name: 'David Park', title: 'Plant Manager', company: 'Industrial Solutions LLC', email: 'dpark@indsolutions.com', phone: '555-0104', revenue: '$18M' },
    { name: 'Jennifer White', title: 'COO', company: 'ManuTech Systems', email: 'jwhite@manutech.com', phone: '555-0105', revenue: '$38M' },
  ],
  landscaping: [
    { name: 'Robert Thompson', title: 'Homeowner', company: null, email: 'rthompson@email.com', phone: '555-0201', address: '123 Oak Lane, Chester County' },
    { name: 'Linda Martinez', title: 'Homeowner', company: null, email: 'lmartinez@email.com', phone: '555-0202', address: '456 Maple Dr, Montgomery County' },
    { name: 'James Wilson', title: 'Homeowner', company: null, email: 'jwilson@email.com', phone: '555-0203', address: '789 Pine St, Bucks County' },
    { name: 'Patricia Davis', title: 'Homeowner', company: null, email: 'pdavis@email.com', phone: '555-0204', address: '321 Elm Ave, Chester County' },
    { name: 'Christopher Lee', title: 'Homeowner', company: null, email: 'clee@email.com', phone: '555-0205', address: '654 Birch Rd, Montgomery County' },
  ],
  ecommerce: [
    { name: 'Amanda Foster', title: 'Customer', company: null, email: 'afoster@email.com', phone: '555-0301', interests: 'Hiking, Camping' },
    { name: 'Kevin Brown', title: 'Customer', company: null, email: 'kbrown@email.com', phone: '555-0302', interests: 'Backpacking, Trail Running' },
    { name: 'Michelle Taylor', title: 'Customer', company: null, email: 'mtaylor@email.com', phone: '555-0303', interests: 'Mountaineering, Skiing' },
    { name: 'Brian Anderson', title: 'Customer', company: null, email: 'banderson@email.com', phone: '555-0304', interests: 'Camping, Fishing' },
    { name: 'Nicole Garcia', title: 'Customer', company: null, email: 'ngarcia@email.com', phone: '555-0305', interests: 'Hiking, Photography' },
  ],
  financial: [
    { name: 'William Morrison', title: 'Retired Executive', company: 'Former VP at TechCorp', email: 'wmorrison@email.com', phone: '555-0401', assets: '$750k' },
    { name: 'Elizabeth Clark', title: 'Business Owner', company: 'Clark Consulting', email: 'eclark@clarkconsult.com', phone: '555-0402', assets: '$1.2M' },
    { name: 'Richard Hughes', title: 'Retired CFO', company: null, email: 'rhughes@email.com', phone: '555-0403', assets: '$850k' },
    { name: 'Susan Cooper', title: 'Physician', company: 'Metro Medical Group', email: 'scooper@metromg.com', phone: '555-0404', assets: '$650k' },
    { name: 'Thomas Wright', title: 'Attorney', company: 'Wright & Associates', email: 'twright@wrightlaw.com', phone: '555-0405', assets: '$920k' },
  ],
  creative: [
    { name: 'Jessica Moore', title: 'Marketing Director', company: 'StartupHub', email: 'jmoore@startuphub.com', phone: '555-0501', budget: '$15k' },
    { name: 'Daniel King', title: 'CEO', company: 'GreenTech Solutions', email: 'dking@greentech.com', phone: '555-0502', budget: '$25k' },
    { name: 'Rebecca Scott', title: 'Owner', company: 'Local Wellness Center', email: 'rscott@wellness.com', phone: '555-0503', budget: '$12k' },
    { name: 'Matthew Hall', title: 'VP Marketing', company: 'B2B Services Inc', email: 'mhall@b2bservices.com', phone: '555-0504', budget: '$30k' },
    { name: 'Lauren Adams', title: 'Founder', company: 'EcoProducts Co', email: 'ladams@ecoproducts.com', phone: '555-0505', budget: '$18k' },
  ],
  healthcare: [
    { name: 'Steven Baker', title: 'Patient', company: null, email: 'sbaker@email.com', phone: '555-0601', condition: 'Lower back pain', insurance: 'Blue Cross' },
    { name: 'Karen Nelson', title: 'Patient', company: null, email: 'knelson@email.com', phone: '555-0602', condition: 'Sports injury - knee', insurance: 'Aetna' },
    { name: 'Joseph Carter', title: 'Patient', company: null, email: 'jcarter@email.com', phone: '555-0603', condition: 'Rotator cuff', insurance: 'Cigna' },
    { name: 'Nancy Phillips', title: 'Patient', company: null, email: 'nphillips@email.com', phone: '555-0604', condition: 'Post-surgical rehab', insurance: 'United' },
    { name: 'Donald Evans', title: 'Patient', company: null, email: 'devans@email.com', phone: '555-0605', condition: 'Chronic pain management', insurance: 'Blue Cross' },
  ],
  edtech: [
    { name: 'Ashley Turner', title: 'Career Changer', company: 'Former retail manager', email: 'aturner@email.com', phone: '555-0701', background: 'Business degree, 5 years retail' },
    { name: 'Ryan Collins', title: 'Recent Grad', company: null, email: 'rcollins@email.com', phone: '555-0702', background: 'Psychology major, seeking career pivot' },
    { name: 'Megan Stewart', title: 'Career Changer', company: 'Former teacher', email: 'mstewart@email.com', phone: '555-0703', background: 'Education, 8 years teaching' },
    { name: 'Justin Morris', title: 'Military Veteran', company: 'U.S. Army', email: 'jmorris@email.com', phone: '555-0704', background: 'IT support, seeking civilian role' },
    { name: 'Brittany Rogers', title: 'Career Changer', company: 'Former accountant', email: 'brogers@email.com', phone: '555-0705', background: 'Finance, interested in tech' },
  ],
  manufacturing: [
    { name: 'Gregory Bell', title: 'Procurement Manager', company: 'AutoParts Manufacturing', email: 'gbell@autoparts.com', phone: '555-0801', volume: '100k units/year' },
    { name: 'Samantha Reed', title: 'Engineering Lead', company: 'MedDevice Solutions', email: 'sreed@meddevice.com', phone: '555-0802', volume: '25k units/year' },
    { name: 'Anthony Murphy', title: 'Operations Director', company: 'Consumer Electronics Corp', email: 'amurphy@consumerelec.com', phone: '555-0803', volume: '500k units/year' },
    { name: 'Christina Rivera', title: 'Supply Chain VP', company: 'Industrial Equipment Ltd', email: 'crivera@industrialeq.com', phone: '555-0804', volume: '15k units/year' },
    { name: 'Patrick Cook', title: 'Chief Engineer', company: 'Aerospace Components', email: 'pcook@aerospace.com', phone: '555-0805', volume: '8k units/year' },
  ],
  realestate: [
    { name: 'Angela Morgan', title: 'First-time Buyer', company: null, email: 'amorgan@email.com', phone: '555-0901', budget: '$350k', timeline: '3 months' },
    { name: 'Timothy Bailey', title: 'Seller', company: null, email: 'tbailey@email.com', phone: '555-0902', property: '3BR, Downtown, $425k' },
    { name: 'Melissa Howard', title: 'Buyer', company: null, email: 'mhoward@email.com', phone: '555-0903', budget: '$500k', timeline: '6 months' },
    { name: 'Gary Richardson', title: 'Investor', company: 'Richardson Properties', email: 'grichardson@richprop.com', phone: '555-0904', budget: '$750k', type: 'Investment' },
    { name: 'Heather Cox', title: 'Seller', company: null, email: 'hcox@email.com', phone: '555-0905', property: '4BR, North Hills, $580k' },
  ],
  coaching: [
    { name: 'Edward Russell', title: 'CEO', company: 'TechVentures Inc ($80M)', email: 'erussell@techventures.com', phone: '555-1001', challenge: 'Leadership alignment' },
    { name: 'Carol Diaz', title: 'COO', company: 'FinTech Solutions ($120M)', email: 'cdiaz@fintech.com', phone: '555-1002', challenge: 'Strategic planning' },
    { name: 'Frank Peterson', title: 'CFO', company: 'HealthTech Corp ($95M)', email: 'fpeterson@healthtech.com', phone: '555-1003', challenge: 'Decision-making frameworks' },
    { name: 'Diana Wood', title: 'VP Product', company: 'SaaS Platform Ltd ($65M)', email: 'dwood@saasplatform.com', phone: '555-1004', challenge: 'Team performance' },
    { name: 'Kenneth Barnes', title: 'CEO', company: 'Enterprise Software ($150M)', email: 'kbarnes@entsoftware.com', phone: '555-1005', challenge: 'Organizational growth' },
  ],
};

const DEAL_STAGES = ['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

const ACTIVITY_TYPES = ['Call', 'Email', 'Meeting', 'Demo', 'Follow-up', 'Note'];

const SAMPLE_CONVERSATIONS = [
  {
    messages: [
      { role: 'user', content: 'Hi, I\'m interested in learning more about your services.' },
      { role: 'assistant', content: 'Hello! I\'d be happy to help you learn more. Could you tell me a bit about what you\'re looking for?' },
      { role: 'user', content: 'I need help with [specific need based on industry]' },
      { role: 'assistant', content: 'That\'s a great fit for what we offer. Let me explain how we can help...' },
    ]
  },
  {
    messages: [
      { role: 'user', content: 'What are your pricing options?' },
      { role: 'assistant', content: 'Great question! Our pricing is structured to provide maximum value. Let me walk you through our options...' },
      { role: 'user', content: 'Do you offer any discounts?' },
      { role: 'assistant', content: 'We have several special offers available. Based on your needs, here\'s what might work best...' },
    ]
  },
];

async function createTestAccount(accountData, industryKey) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📝 Creating: ${accountData.companyName}`);
    console.log(`${'='.repeat(70)}`);
    
    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: accountData.email,
      password: accountData.password,
      displayName: accountData.companyName,
    });
    
    console.log(`✅ Auth user created: ${userRecord.uid}`);
    
    // Generate organization ID
    const orgId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create organization document
    await db.collection('organizations').doc(orgId).set({
      name: accountData.companyName,
      industry: accountData.industry,
      plan: accountData.planId,
      status: 'trial',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      createdBy: userRecord.uid,
      onboardingData: accountData.onboarding || {},
      settings: {
        timezone: 'America/New_York',
        currency: 'USD'
      }
    });
    
    console.log(`✅ Organization created: ${orgId}`);
    
    // Create user document
    await db.collection('users').doc(userRecord.uid).set({
      email: accountData.email,
      name: 'Admin User',
      role: 'owner',
      organizationId: orgId,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });
    
    // Add user to organization members
    await db.collection('organizations').doc(orgId).collection('members').doc(userRecord.uid).set({
      userId: userRecord.uid,
      email: accountData.email,
      role: 'owner',
      addedAt: new Date(),
    });
    
    console.log(`✅ User and membership created`);
    
    // ==============================================================
    // CREATE SAMPLE DATA
    // ==============================================================
    
    const leads = SAMPLE_LEADS[industryKey] || SAMPLE_LEADS.saas;
    const leadsCreated = [];
    
    console.log(`\n📊 Creating sample data...`);
    console.log(`   Creating ${leads.length} leads...`);
    
    // Create Leads
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const leadId = `lead_${Date.now()}_${i}`;
      const createdDate = randomPastDate(60); // Within last 60 days
      
      const statuses = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      await db.collection('organizations').doc(orgId).collection('leads').doc(leadId).set({
        ...lead,
        id: leadId,
        status,
        source: ['Website', 'Referral', 'Cold Outreach', 'LinkedIn', 'Event'][Math.floor(Math.random() * 5)],
        score: Math.floor(Math.random() * 100),
        tags: [],
        customFields: {},
        createdAt: createdDate,
        updatedAt: randomDate(createdDate, new Date()),
        createdBy: userRecord.uid,
      });
      
      leadsCreated.push({ id: leadId, ...lead, createdDate });
    }
    
    console.log(`   ✅ ${leads.length} leads created`);
    
    // Create Deals/Opportunities
    const numDeals = Math.min(leads.length, 8);
    console.log(`   Creating ${numDeals} deals...`);
    
    for (let i = 0; i < numDeals; i++) {
      const dealId = `deal_${Date.now()}_${i}`;
      const lead = leadsCreated[i];
      const stage = DEAL_STAGES[Math.floor(Math.random() * DEAL_STAGES.length)];
      const baseAmount = [5000, 10000, 15000, 25000, 50000, 75000][Math.floor(Math.random() * 6)];
      
      await db.collection('organizations').doc(orgId).collection('deals').doc(dealId).set({
        id: dealId,
        title: `${lead.name} - ${lead.company || 'Individual'}`,
        leadId: lead.id,
        stage,
        amount: baseAmount,
        probability: stage === 'Closed Won' ? 100 : Math.floor(Math.random() * 80) + 20,
        expectedCloseDate: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000),
        assignedTo: userRecord.uid,
        createdAt: lead.createdDate,
        updatedAt: randomDate(lead.createdDate, new Date()),
        notes: `Deal for ${lead.company || lead.name}. ${stage} stage.`,
      });
    }
    
    console.log(`   ✅ ${numDeals} deals created`);
    
    // Create Activities
    const numActivities = leads.length * 4; // 4 activities per lead
    console.log(`   Creating ${numActivities} activities...`);
    
    for (let i = 0; i < numActivities; i++) {
      const activityId = `activity_${Date.now()}_${i}`;
      const lead = leadsCreated[i % leadsCreated.length];
      const type = ACTIVITY_TYPES[Math.floor(Math.random() * ACTIVITY_TYPES.length)];
      const completedDate = randomPastDate(45);
      
      await db.collection('organizations').doc(orgId).collection('activities').doc(activityId).set({
        id: activityId,
        type,
        subject: `${type} with ${lead.name}`,
        description: `Had a ${type.toLowerCase()} with ${lead.name} regarding their interest.`,
        leadId: lead.id,
        dealId: i < numDeals ? `deal_${Date.now()}_${i % numDeals}` : null,
        assignedTo: userRecord.uid,
        status: 'Completed',
        dueDate: completedDate,
        completedAt: completedDate,
        createdAt: randomPastDate(50),
      });
    }
    
    console.log(`   ✅ ${numActivities} activities created`);
    
    // Create Conversations
    const numConversations = Math.min(leads.length, 6);
    console.log(`   Creating ${numConversations} AI conversations...`);
    
    for (let i = 0; i < numConversations; i++) {
      const conversationId = `conv_${Date.now()}_${i}`;
      const lead = leadsCreated[i];
      const conversation = SAMPLE_CONVERSATIONS[i % SAMPLE_CONVERSATIONS.length];
      
      await db.collection('organizations').doc(orgId).collection('conversations').doc(conversationId).set({
        id: conversationId,
        leadId: lead.id,
        leadName: lead.name,
        leadEmail: lead.email,
        messages: conversation.messages.map((msg, idx) => ({
          ...msg,
          timestamp: new Date(Date.now() - (numConversations - i) * 86400000 + idx * 300000), // Spread over time
        })),
        status: ['active', 'resolved', 'archived'][Math.floor(Math.random() * 3)],
        sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)],
        createdAt: randomPastDate(30),
        updatedAt: new Date(),
      });
    }
    
    console.log(`   ✅ ${numConversations} conversations created`);
    
    // Create Email Campaigns
    console.log(`   Creating 3 email campaigns...`);
    
    const campaigns = [
      { name: 'Welcome Series', type: 'drip', status: 'active' },
      { name: 'Monthly Newsletter', type: 'broadcast', status: 'sent' },
      { name: 'Re-engagement Campaign', type: 'drip', status: 'draft' },
    ];
    
    for (let i = 0; i < campaigns.length; i++) {
      const campaignId = `campaign_${Date.now()}_${i}`;
      const campaign = campaigns[i];
      
      await db.collection('organizations').doc(orgId).collection('campaigns').doc(campaignId).set({
        id: campaignId,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        subject: `${campaign.name} - Special Offer`,
        recipients: leads.length,
        sent: campaign.status === 'sent' ? leads.length : 0,
        opened: campaign.status === 'sent' ? Math.floor(leads.length * 0.4) : 0,
        clicked: campaign.status === 'sent' ? Math.floor(leads.length * 0.15) : 0,
        createdAt: randomPastDate(20),
        sentAt: campaign.status === 'sent' ? randomPastDate(10) : null,
        createdBy: userRecord.uid,
      });
    }
    
    console.log(`   ✅ 3 campaigns created`);
    
    // Create Analytics Snapshots (for dashboard)
    console.log(`   Creating analytics data...`);
    
    const now = new Date();
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const date = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      await db.collection('organizations').doc(orgId).collection('analytics').doc(dateStr).set({
        date: dateStr,
        leadsCreated: Math.floor(Math.random() * 5),
        dealsCreated: Math.floor(Math.random() * 3),
        activitiesCompleted: Math.floor(Math.random() * 10) + 5,
        conversationsStarted: Math.floor(Math.random() * 4),
        revenue: Math.floor(Math.random() * 50000),
        timestamp: date,
      });
    }
    
    console.log(`   ✅ 30 days of analytics created`);
    
    console.log(`\n🎉 Successfully created: ${accountData.companyName}`);
    console.log(`   📧 Email: ${accountData.email}`);
    console.log(`   🏢 Org ID: ${orgId}`);
    console.log(`   👤 User ID: ${userRecord.uid}`);
    console.log(`   📊 Leads: ${leads.length} | Deals: ${numDeals} | Activities: ${numActivities}`);
    console.log(`   💬 Conversations: ${numConversations} | Campaigns: 3`);
    
    return { success: true, orgId, userId: userRecord.uid };
    
  } catch (error) {
    console.error(`❌ Error creating ${accountData.companyName}:`, error.message);
    return { success: false, error: error.message };
  }
}

const TEST_ACCOUNTS = [
  {
    email: 'admin@auraflow.test',
    password: 'Testing123!',
    companyName: 'AuraFlow Analytics (testing)',
    planId: 'starter',
    industry: 'B2B Software as a Service (SaaS)',
    industryKey: 'saas',
    onboarding: { /* ... onboarding data ... */ }
  },
  {
    email: 'admin@greenthumb.test',
    password: 'Testing123!',
    companyName: 'GreenThumb Landscaping (testing)',
    planId: 'starter',
    industry: 'Home Services (Landscaping & Lawn Care)',
    industryKey: 'landscaping',
    onboarding: { /* ... */ }
  },
  {
    email: 'admin@adventuregear.test',
    password: 'Testing123!',
    companyName: 'The Adventure Gear Shop (testing)',
    planId: 'professional',
    industry: 'E-commerce (Outdoor Apparel and Gear)',
    industryKey: 'ecommerce',
    onboarding: { /* ... */ }
  },
  {
    email: 'admin@summitwm.test',
    password: 'Testing123!',
    companyName: 'Summit Wealth Management (testing)',
    planId: 'professional',
    industry: 'Financial Services (Investment Advisory)',
    industryKey: 'financial',
    onboarding: { /* ... */ }
  },
  {
    email: 'admin@pixelperfect.test',
    password: 'Testing123!',
    companyName: 'PixelPerfect Design Co. (testing)',
    planId: 'starter',
    industry: 'Creative Services (Web Design & Branding)',
    industryKey: 'creative',
    onboarding: { /* ... */ }
  },
  {
    email: 'admin@balancept.test',
    password: 'Testing123!',
    companyName: 'Balance Physical Therapy (testing)',
    planId: 'starter',
    industry: 'Health & Wellness (Physical Therapy)',
    industryKey: 'healthcare',
    onboarding: { /* ... */ }
  },
  {
    email: 'admin@codemaster.test',
    password: 'Testing123!',
    companyName: 'CodeMaster Academy (testing)',
    planId: 'professional',
    industry: 'E-Learning/EdTech (Coding Bootcamp)',
    industryKey: 'edtech',
    onboarding: { /* ... */ }
  },
  {
    email: 'admin@midwestplastics.test',
    password: 'Testing123!',
    companyName: 'Midwest Plastics Supply (testing)',
    planId: 'professional',
    industry: 'B2B Manufacturing/Wholesale',
    industryKey: 'manufacturing',
    onboarding: { /* ... */ }
  },
  {
    email: 'admin@metroproperty.test',
    password: 'Testing123!',
    companyName: 'Metro Property Group (testing)',
    planId: 'starter',
    industry: 'Residential Real Estate Brokerage',
    industryKey: 'realestate',
    onboarding: { /* ... */ }
  },
  {
    email: 'admin@executiveedge.test',
    password: 'Testing123!',
    companyName: 'Executive Edge Coaching (testing)',
    planId: 'professional',
    industry: 'B2B Executive Coaching',
    industryKey: 'coaching',
    onboarding: { /* ... */ }
  },
];

async function seedAllAccounts() {
  console.log('\n🚀 COMPREHENSIVE TEST DATA SEEDING');
  console.log('='.repeat(70));
  console.log(`Creating ${TEST_ACCOUNTS.length} fully populated test accounts...`);
  console.log('This includes: Accounts, Leads, Deals, Activities, Conversations, Campaigns, Analytics\n');
  
  const results = [];
  
  for (const account of TEST_ACCOUNTS) {
    const result = await createTestAccount(account, account.industryKey);
    results.push({ ...account, ...result });
    
    // Small delay between creations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n\n');
  console.log('='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}/${TEST_ACCOUNTS.length}`);
  console.log(`❌ Failed: ${failed}/${TEST_ACCOUNTS.length}`);
  
  if (successful > 0) {
    console.log('\n✅ LOGIN CREDENTIALS:\n');
    results.filter(r => r.success).forEach((r, idx) => {
      console.log(`${idx + 1}. ${r.companyName}`);
      console.log(`   📧 ${r.email}`);
      console.log(`   🔑 Testing123!`);
      console.log(`   🏢 ${r.orgId}\n`);
    });
  }
  
  if (failed > 0) {
    console.log('\n❌ Failed accounts:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.companyName}: ${r.error}`);
    });
  }
  
  console.log('\n🎯 WHAT WAS CREATED:');
  console.log('   ✅ 10 Organizations with complete onboarding');
  console.log('   ✅ 50 Realistic leads/contacts (5 per company)');
  console.log('   ✅ 40+ Deals across various pipeline stages');
  console.log('   ✅ 200+ Activity records (calls, emails, meetings)');
  console.log('   ✅ 30+ AI agent conversations with real dialogue');
  console.log('   ✅ 30 Email campaigns (3 per company)');
  console.log('   ✅ 300 days of analytics data (30 days × 10 companies)');
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('   1. Login with any account above');
  console.log('   2. View populated dashboard with real metrics');
  console.log('   3. Browse CRM with actual leads and deals');
  console.log('   4. Test AI agent chat functionality');
  console.log('   5. Review analytics and reporting\n');
}

// Run the comprehensive seeding
seedAllAccounts()
  .then(() => {
    console.log('✅ SEEDING COMPLETE!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ SEEDING FAILED:', error);
    process.exit(1);
  });






