/**
 * Production Seed Script - 9 Test Organizations
 * Seeds to ACTUAL Firebase (not emulators)
 * Run: node scripts/seed-production-test-orgs.js
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

console.log('🚀 Starting seed script...');
console.log('📝 Loading Firebase Admin...');

const admin = require('firebase-admin');

console.log('🔧 Configuring Firebase...');

// This script is for PRODUCTION Firebase only (no emulators)
const useEmulators = process.env.USE_FIREBASE_EMULATOR === 'true';

if (useEmulators) {
  console.log('🔥 Using Firebase Emulators (Local Development Mode)');
  console.log('   Make sure emulators are running: firebase emulators:start');
  
  // Initialize for emulators
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'demo-ai-sales-platform',
    });
  }
  
  // Connect to emulators
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  
} else {
  console.log('☁️ Using Production Firebase');
  console.log('Project ID:', process.env.FIREBASE_ADMIN_PROJECT_ID || 'NOT SET');

  // Initialize Firebase Admin with environment variables
  if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_ADMIN_PRIVATE_KEY 
      ? {
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }
      : null;

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      });
    } else {
      admin.initializeApp({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      });
    }
  }
}

const db = admin.firestore();
const auth = admin.auth();

const TEST_ORGANIZATIONS = [
  {
    email: 'admin@auraflow.test',
    password: 'Testing123!',
    companyName: 'AuraFlow Analytics (TEST)',
    slug: 'auraflow-analytics-test',
    plan: 'starter',
    industry: 'B2B Software as a Service (SaaS)',
    onboarding: {
      businessBasics: {
        businessName: 'AuraFlow Analytics',
        industry: 'B2B Software as a Service (SaaS)',
        website: 'https://www.auraflow-analytics.com',
        faqPageUrl: 'https://www.auraflow-analytics.com/support/faq',
        socialMediaUrls: ['https://www.linkedin.com/company/auraflow-analytics'],
        companySize: '15 employees'
      },
      businessUnderstanding: {
        problemSolved: 'Automates complex data-driven capacity planning and demand forecasting for mid-sized manufacturers.',
        uniqueValue: 'Uses proprietary machine learning algorithms trained on industry-specific production data, offering 99.5% forecast accuracy.',
        whyBuy: 'Saves Operations Managers 10+ hours/week in manual planning, reduces inventory holding costs by up to 20%, and prevents expensive production bottlenecks.',
        whyNotBuy: 'High initial setup cost; requires complex integration with existing legacy ERP/data systems; they are comfortable with outdated manual processes.'
      },
      productsServices: {
        primaryOffering: 'AuraFlow Pro (Annual Subscription Software)',
        priceRange: '$9,600 - $30,000/year (tiered subscription)',
        targetCustomer: 'Manufacturing Operations Managers and Supply Chain Directors',
        customerDemographics: 'Primarily North American/European B2B clients, ages 35-55, holding managerial or director-level titles.'
      },
      productDetails: {
        topProducts: '1. Real-Time Capacity Module (Visualizes plant load) 2. Predictive Inventory Engine (Min/max level recommendations) 3. Supplier Risk Dashboard (Forecasts component lead-time volatility)',
        whoShouldNotBuy: 'Small businesses (< $5M annual revenue), companies with highly manual/non-digital operations, or non-manufacturing firms.'
      },
      pricingSales: {
        pricingStrategy: 'Value-based pricing, tiered by data volume processed and number of API integrations allowed.',
        discountPolicy: 'No general discounts. Discounts only available for multi-year contracts (3+ years).',
        firstTimeBuyerIncentive: 'Free 30-day data audit and Proof of Concept integration test.'
      },
      agentGoals: {
        primaryObjective: 'Qualified Lead Generation (Schedule a technical product demo with a Sales Engineer).',
        successMetrics: '% of conversations resulting in a booked demo; Average time to qualification.',
        escalationRules: 'Any question regarding proprietary algorithm function or legal contracts escalates to a human Sales Engineer immediately.'
      },
      agentPersonality: {
        tone: 'Technical, Professional, Data-Driven, Confidence-Inspiring',
        formalityLevel: 'High (Use formal language, precise terminology)',
        useOfHumor: 'Low (Never use jokes; maintain a serious, expert demeanor)',
        empathyLevel: 'Moderate (Acknowledge pain points like inventory loss, but immediately pivot to solution)'
      }
    }
  },
  {
    email: 'admin@greenthumb.test',
    password: 'Testing123!',
    companyName: 'GreenThumb Landscaping (TEST)',
    slug: 'greenthumb-landscaping-test',
    plan: 'starter',
    industry: 'Home Services (Landscaping & Lawn Care)',
    onboarding: {
      businessBasics: {
        businessName: 'GreenThumb Landscaping',
        industry: 'Home Services (Landscaping & Lawn Care)',
        website: 'https://www.greenthumb-local.com',
        faqPageUrl: 'https://www.greenthumb-local.com/faq-support',
        socialMediaUrls: ['https://www.facebook.com/GreenThumbLocal'],
        companySize: '35 employees'
      },
      businessUnderstanding: {
        problemSolved: 'Provides reliable, expert, and seasonal lawn care and yard maintenance services to busy, local homeowners.',
        uniqueValue: 'Exclusive use of eco-friendly, non-toxic treatments (safe for kids/pets) and a guaranteed 24-hour response time.',
        whyBuy: 'Guaranteed satisfaction (free re-service if not happy); local, vetted, and trustworthy team; commitment to safety and the environment.',
        whyNotBuy: 'Higher price point than budget competitors; limited service area (only three specific counties).'
      },
      productsServices: {
        primaryOffering: 'Weekly \'Lush Lawn\' Maintenance Package (Subscription)',
        priceRange: '$80 - $350 per month (depending on lot size and package tier)',
        targetCustomer: 'Affluent homeowners ($100k+ income) in specific suburban areas who value convenience and eco-friendliness.',
        customerDemographics: 'Ages 35-65, single-family home owners, suburban locale.'
      },
      agentGoals: {
        primaryObjective: 'Schedule a FREE service quote/estimate at the customer\'s property.',
        successMetrics: 'Number of quote requests successfully booked and confirmed on the calendar.',
        escalationRules: 'Any request for a custom hardscaping project (not a core service) must escalate to the owner.'
      },
      agentPersonality: {
        tone: 'Friendly, Helpful, Knowledgeable, Local',
        formalityLevel: 'Moderate (Casual but respectful, using terms like "folks" and "neighbors")',
        useOfHumor: 'Moderate (Relatable, lighthearted humor about yard work struggles)',
        empathyLevel: 'Moderate (Express understanding of busy schedules and desire for a beautiful yard)'
      }
    }
  },
  {
    email: 'admin@adventuregear.test',
    password: 'Testing123!',
    companyName: 'The Adventure Gear Shop (TEST)',
    slug: 'adventure-gear-shop-test',
    plan: 'professional',
    industry: 'E-commerce (Outdoor Apparel and Gear)',
    onboarding: {
      businessBasics: {
        businessName: 'The Adventure Gear Shop',
        industry: 'E-commerce (Outdoor Apparel and Gear)',
        website: 'https://www.adventuregearshop.com',
        faqPageUrl: 'https://www.adventuregearshop.com/customer-service/faq',
        socialMediaUrls: ['https://www.instagram.com/AdventureGearShop'],
        companySize: '50 employees'
      },
      businessUnderstanding: {
        problemSolved: 'Provides durable, high-quality outdoor clothing and equipment that performs reliably in extreme conditions.',
        uniqueValue: 'Every product is field-tested by professional guides for 100+ days; lifetime warranty on materials and stitching.',
        whyBuy: 'Premium quality guarantees safety and longevity; trusted by professionals; hassle-free returns.',
        whyNotBuy: 'Premium pricing is significantly higher than general retailers; limited selection of non-technical/fashion-focused items.'
      },
      agentGoals: {
        primaryObjective: 'Customer Support (Product Q&A, initiating Returns/Exchanges, Order Status).',
        successMetrics: 'First contact resolution rate; average time to handle return request.',
        escalationRules: 'Any complex warranty claim or item damage report escalates immediately to a human Customer Service Specialist.'
      },
      agentPersonality: {
        tone: 'Casual, Enthusiastic, Expert, Action-Oriented',
        formalityLevel: 'Low (Use contractions and informal language)',
        useOfHumor: 'Moderate (Outdoorsy puns are acceptable)',
        empathyLevel: 'High (Acknowledge frustration with product failure, show excitement for the customer\'s trip)'
      }
    }
  },
  {
    email: 'admin@summitwm.test',
    password: 'Testing123!',
    companyName: 'Summit Wealth Management (TEST)',
    slug: 'summit-wealth-management-test',
    plan: 'professional',
    industry: 'Financial Services (Investment Advisory)',
    onboarding: {
      businessBasics: {
        businessName: 'Summit Wealth Management',
        industry: 'Financial Services (Investment Advisory and Planning)',
        website: 'https://www.summitwealthmgt.com',
        faqPageUrl: 'https://www.summitwealthmgt.com/compliance-faq',
        socialMediaUrls: ['https://www.linkedin.com/company/summit-wealth-mgt'],
        companySize: '5 employees'
      },
      businessUnderstanding: {
        problemSolved: 'Provides customized, low-risk investment strategies and comprehensive retirement planning for high-net-worth individuals.',
        uniqueValue: 'Fee-only fiduciary model; legally required to act in the client\'s best interest 100% of the time.',
        whyBuy: 'Unbiased, expert advice leading to secure retirement; peace of mind through regulated and transparent service.',
        whyNotBuy: 'High investment minimums (>$500k); not suitable for active day-traders or those seeking high-risk growth portfolios.'
      },
      agentPersonality: {
        tone: 'Authoritative, Trustworthy, Measured, Security-Focused',
        formalityLevel: 'High (Use formal, professional language; avoid contractions)',
        useOfHumor: 'Low (Maintain a serious, respectful demeanor)',
        empathyLevel: 'Low (Focus on facts, security, and process, not emotional support)'
      }
    }
  },
  {
    email: 'admin@pixelperfect.test',
    password: 'Testing123!',
    companyName: 'PixelPerfect Design Co. (TEST)',
    slug: 'pixelperfect-design-test',
    plan: 'starter',
    industry: 'Creative Services (Web Design & Branding)',
    onboarding: {
      businessBasics: {
        businessName: 'PixelPerfect Design Co.',
        industry: 'Creative Services (Web Design, Branding, & Marketing)',
        website: 'https://www.pixelperfectdesignco.com',
        faqPageUrl: 'https://www.pixelperfectdesignco.com/process',
        socialMediaUrls: ['https://www.behance.net/PixelPerfectDesignCo'],
        companySize: '7 employees (Core Team)'
      },
      agentPersonality: {
        tone: 'Creative, Consultative, Professional, Enthusiastic',
        formalityLevel: 'Moderate (Professional but energetic and friendly)',
        useOfHumor: 'Moderate (Light design jokes or clever metaphors are fine)',
        empathyLevel: 'Moderate (Acknowledge client anxiety about rebranding or redesigning)'
      }
    }
  },
  {
    email: 'admin@codemaster.test',
    password: 'Testing123!',
    companyName: 'CodeMaster Academy (TEST)',
    slug: 'codemaster-academy-test',
    plan: 'professional',
    industry: 'E-Learning/EdTech (Coding Bootcamp)',
    onboarding: {
      businessBasics: {
        businessName: 'CodeMaster Academy',
        industry: 'E-Learning/EdTech (Intensive Coding Bootcamps)',
        website: 'https://www.codemasteracademy.io',
        faqPageUrl: 'https://www.codemasteracademy.io/enrollment-faq',
        socialMediaUrls: ['https://www.youtube.com/@CodeMasterAcademy'],
        companySize: '100+ employees (Instructors, Mentors, Staff)'
      },
      agentPersonality: {
        tone: 'Motivational, Informative, Driven, Encouraging',
        formalityLevel: 'Moderate (Professional but energetic and future-focused)',
        useOfHumor: 'Low (Keep it professional)',
        empathyLevel: 'High (Acknowledge the difficulty of a career change)'
      }
    }
  },
  {
    email: 'admin@midwestplastics.test',
    password: 'Testing123!',
    companyName: 'Midwest Plastics Supply (TEST)',
    slug: 'midwest-plastics-test',
    plan: 'professional',
    industry: 'B2B Manufacturing/Wholesale',
    onboarding: {
      businessBasics: {
        businessName: 'Midwest Plastics Supply',
        industry: 'B2B Manufacturing/Wholesale (Custom Injection Molding)',
        website: 'https://www.midwestplastics.com',
        faqPageUrl: 'https://www.midwestplastics.com/technical-faqs',
        socialMediaUrls: ['https://www.linkedin.com/company/midwest-plastics-supply'],
        companySize: '200 employees'
      },
      agentPersonality: {
        tone: 'Technical, Precise, Direct, Reliable',
        formalityLevel: 'High (B2B context)',
        useOfHumor: 'Low (Focus on facts and specs)',
        empathyLevel: 'Low (Focus is on solving technical problems, not emotions)'
      }
    }
  },
  {
    email: 'admin@metroproperty.test',
    password: 'Testing123!',
    companyName: 'Metro Property Group (TEST)',
    slug: 'metro-property-group-test',
    plan: 'starter',
    industry: 'Residential Real Estate Brokerage',
    onboarding: {
      businessBasics: {
        businessName: 'Metro Property Group',
        industry: 'Residential Real Estate Brokerage',
        website: 'https://www.metropropertygroup.com',
        faqPageUrl: 'https://www.metropropertygroup.com/first-time-buyers',
        socialMediaUrls: ['https://www.facebook.com/MetroPropertyGroup'],
        companySize: '10 agents and 2 administrators'
      },
      agentPersonality: {
        tone: 'Knowledgeable, Local, Encouraging, Trustworthy',
        formalityLevel: 'Moderate (Professional but friendly)',
        useOfHumor: 'Moderate (Light humor about the stress of moving is acceptable)',
        empathyLevel: 'High (Acknowledge the stress and emotional investment of buying/selling a home)'
      }
    }
  },
  {
    email: 'admin@executiveedge.test',
    password: 'Testing123!',
    companyName: 'Executive Edge Coaching (TEST)',
    slug: 'executive-edge-coaching-test',
    plan: 'professional',
    industry: 'B2B Executive Coaching',
    onboarding: {
      businessBasics: {
        businessName: 'Executive Edge Coaching',
        industry: 'B2B Executive Coaching and Consulting',
        website: 'https://www.executiveedgecoaching.com',
        faqPageUrl: 'https://www.executiveedgecoaching.com/methodology',
        socialMediaUrls: ['https://www.linkedin.com/in/executive-edge-coach'],
        companySize: '1 employee (Solopreneur/Principal Coach with virtual admin staff)'
      },
      agentPersonality: {
        tone: 'Authoritative, Exclusive, Concise, Results-Oriented',
        formalityLevel: 'High (Very formal, respectful of executive titles)',
        useOfHumor: 'Very Low (Serious, focused on performance and results)',
        empathyLevel: 'Low (Acknowledge strategic challenges, but immediately pivot to solution/action)'
      }
    }
  },
];

// Plan limits configuration
const PLAN_LIMITS = {
  starter: {
    maxWorkspaces: 1,
    maxUsersPerWorkspace: 5,
    maxRecordsPerWorkspace: 10000,
    maxAICallsPerMonth: 1000,
    maxStorageGB: 10,
    maxSchemas: 5,
    maxWorkflows: 10,
    allowCustomDomain: false,
    allowWhiteLabel: false,
    allowAPIAccess: false,
  },
  professional: {
    maxWorkspaces: 3,
    maxUsersPerWorkspace: 25,
    maxRecordsPerWorkspace: 100000,
    maxAICallsPerMonth: 10000,
    maxStorageGB: 100,
    maxSchemas: 20,
    maxWorkflows: 50,
    allowCustomDomain: true,
    allowWhiteLabel: false,
    allowAPIAccess: true,
  },
  enterprise: {
    maxWorkspaces: 10,
    maxUsersPerWorkspace: 100,
    maxRecordsPerWorkspace: 1000000,
    maxAICallsPerMonth: 100000,
    maxStorageGB: 1000,
    maxSchemas: 50,
    maxWorkflows: 100,
    allowCustomDomain: true,
    allowWhiteLabel: true,
    allowAPIAccess: true,
  },
};

async function createTestOrganization(orgData) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📝 Creating: ${orgData.companyName}`);
    console.log(`${'='.repeat(70)}`);

    // Step 1: Create Auth User
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: orgData.email,
        password: orgData.password,
        displayName: orgData.companyName,
      });
      console.log(`✅ Auth user created: ${userRecord.uid}`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        // User exists, get the existing user
        userRecord = await auth.getUserByEmail(orgData.email);
        console.log(`ℹ️  Auth user already exists: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }

    // Step 2: Create Organization
    const orgId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = admin.firestore.Timestamp.now();
    const trialEnd = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
    );

    await db.collection('organizations').doc(orgId).set({
      id: orgId,
      name: orgData.companyName,
      slug: orgData.slug,
      plan: orgData.plan,
      planLimits: PLAN_LIMITS[orgData.plan],
      billingEmail: orgData.email,
      branding: {
        primaryColor: '#6366f1',
        logo: null,
      },
      settings: {
        defaultTimezone: 'America/New_York',
        defaultCurrency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: userRecord.uid,
      status: 'trial',
      trialEndsAt: trialEnd,
      industry: orgData.industry,
      onboardingData: orgData.onboarding || {},
      onboardingCompleted: true, // Mark onboarding as completed
      testOrg: true, // Mark as test org for easy cleanup
    });

    console.log(`✅ Organization created: ${orgId}`);

    // Step 3: Create User Profile
    await db.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email: orgData.email,
      displayName: 'Admin User',
      organizationId: orgId,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      isTestUser: true,
    });

    console.log(`✅ User profile created`);

    // Step 4: Add to Organization Members
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('members')
      .doc(userRecord.uid)
      .set({
        userId: userRecord.uid,
        email: orgData.email,
        role: 'owner',
        permissions: ['*'], // All permissions
        addedAt: now,
        addedBy: userRecord.uid,
        status: 'active',
      });

    console.log(`✅ Member added to organization`);

    console.log(`🎉 Successfully created: ${orgData.companyName}`);
    console.log(`   📧 Email: ${orgData.email}`);
    console.log(`   🔑 Password: ${orgData.password}`);
    console.log(`   🏢 Org ID: ${orgId}`);

    return {
      success: true,
      orgId,
      userId: userRecord.uid,
      email: orgData.email,
      companyName: orgData.companyName,
    };
  } catch (error) {
    console.error(`❌ Error creating ${orgData.companyName}:`, error.message);
    return {
      success: false,
      error: error.message,
      email: orgData.email,
      companyName: orgData.companyName,
    };
  }
}

async function seedAllOrganizations() {
  console.log('\n🚀 PRODUCTION TEST ORGANIZATION SEEDING');
  console.log('='.repeat(70));
  console.log(`Creating ${TEST_ORGANIZATIONS.length} test organizations in PRODUCTION Firebase...`);
  console.log('⚠️  This will create REAL data in your Firebase project!\n');

  const results = [];

  for (const org of TEST_ORGANIZATIONS) {
    const result = await createTestOrganization(org);
    results.push(result);

    // Small delay between creations
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n\n');
  console.log('='.repeat(70));
  console.log('📊 SEEDING SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Successful: ${successful.length}/${TEST_ORGANIZATIONS.length}`);
  console.log(`❌ Failed: ${failed.length}/${TEST_ORGANIZATIONS.length}`);

  if (successful.length > 0) {
    console.log('\n✅ SUCCESSFULLY CREATED ORGANIZATIONS:\n');
    successful.forEach((r, idx) => {
      console.log(`${idx + 1}. ${r.companyName}`);
      console.log(`   📧 Email: ${r.email}`);
      console.log(`   🔑 Password: Testing123!`);
      console.log(`   🏢 Org ID: ${r.orgId}`);
      console.log('');
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ FAILED ORGANIZATIONS:\n');
    failed.forEach((r) => {
      console.log(`   - ${r.companyName}: ${r.error}`);
    });
  }

  console.log('\n🎯 NEXT STEPS:');
  console.log('   1. Go to your application');
  console.log('   2. Navigate to /admin/organizations');
  console.log('   3. You should see all 9 test organizations');
  console.log('   4. Login with any test account (password: Testing123!)');
  console.log('   5. Dashboard should now show real metrics\n');

  console.log('🗑️  TO REMOVE TEST DATA LATER:');
  console.log('   - All test orgs are marked with testOrg: true');
  console.log('   - All company names have "(TEST)" suffix');
  console.log('   - Run cleanup script when ready for production\n');
}

// Run the seeding
seedAllOrganizations()
  .then(() => {
    console.log('✅ SEEDING COMPLETE!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ SEEDING FAILED:', error);
    process.exit(1);
  });













