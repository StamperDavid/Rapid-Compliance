/**
 * Seed Test Accounts Script
 * Creates 10 fully configured test companies with complete onboarding data
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (connects to emulator automatically)
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

const TEST_ACCOUNTS = [
  {
    email: 'admin@auraflow.test',
    password: 'Testing123!',
    companyName: 'AuraFlow Analytics (testing)',
    planId: 'starter',
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
    companyName: 'GreenThumb Landscaping (testing)',
    planId: 'starter',
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
    companyName: 'The Adventure Gear Shop (testing)',
    planId: 'professional',
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
    companyName: 'Summit Wealth Management (testing)',
    planId: 'professional',
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
    companyName: 'PixelPerfect Design Co. (testing)',
    planId: 'starter',
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
    email: 'admin@balancept.test',
    password: 'Testing123!',
    companyName: 'Balance Physical Therapy (testing)',
    planId: 'starter',
    industry: 'Health & Wellness (Physical Therapy)',
    onboarding: {
      businessBasics: {
        businessName: 'Balance Physical Therapy',
        industry: 'Health & Wellness (Outpatient Physical Therapy Clinic)',
        website: 'https://www.balancept.com',
        faqPageUrl: 'https://www.balancept.com/insurance-and-billing',
        socialMediaUrls: ['https://www.facebook.com/BalancePhysicalTherapy'],
        companySize: '20 employees (PTs, PTAs, Admin)'
      },
      agentPersonality: {
        tone: 'Caring, Professional, Reassuring, Empathetic',
        formalityLevel: 'High (Medical context requires formality)',
        useOfHumor: 'Low (Never use humor in relation to pain or illness)',
        empathyLevel: 'High (Acknowledge and validate the patient\'s pain/frustration)'
      }
    }
  },
  {
    email: 'admin@codemaster.test',
    password: 'Testing123!',
    companyName: 'CodeMaster Academy (testing)',
    planId: 'professional',
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
    companyName: 'Midwest Plastics Supply (testing)',
    planId: 'professional',
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
    companyName: 'Metro Property Group (testing)',
    planId: 'starter',
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
    companyName: 'Executive Edge Coaching (testing)',
    planId: 'professional',
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
  }
];

async function createTestAccount(accountData) {
  try {
    console.log(`\n📝 Creating account: ${accountData.companyName}...`);
    
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
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
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
    
    console.log(`✅ User document created`);
    
    // Add user to organization members
    await db.collection('organizations').doc(orgId).collection('members').doc(userRecord.uid).set({
      userId: userRecord.uid,
      email: accountData.email,
      role: 'owner',
      addedAt: new Date(),
    });
    
    console.log(`✅ Member added to organization`);
    console.log(`🎉 Successfully created: ${accountData.companyName}`);
    
    return { success: true, orgId, userId: userRecord.uid };
    
  } catch (error) {
    console.error(`❌ Error creating ${accountData.companyName}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function seedAllAccounts() {
  console.log('🚀 Starting test account seeding...\n');
  console.log(`Creating ${TEST_ACCOUNTS.length} test accounts...\n`);
  
  const results = [];
  
  for (const account of TEST_ACCOUNTS) {
    const result = await createTestAccount(account);
    results.push({ ...account, ...result });
    
    // Small delay between creations
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n\n📊 SUMMARY');
  console.log('=' .repeat(60));
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}/${TEST_ACCOUNTS.length}`);
  console.log(`❌ Failed: ${failed}/${TEST_ACCOUNTS.length}`);
  
  if (successful > 0) {
    console.log('\n✅ Successfully created accounts:');
    results.filter(r => r.success).forEach(r => {
      console.log(`   - ${r.companyName}`);
      console.log(`     Email: ${r.email}`);
      console.log(`     OrgID: ${r.orgId}`);
      console.log(`     UserID: ${r.userId}\n`);
    });
  }
  
  if (failed > 0) {
    console.log('\n❌ Failed accounts:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.companyName}: ${r.error}`);
    });
  }
  
  console.log('\n🎯 Next steps:');
  console.log('   1. Login with any of the test accounts (password: Testing123!)');
  console.log('   2. Complete the onboarding wizard for each');
  console.log('   3. Test CRM features with sample data');
  console.log('   4. Test AI agent chat functionality\n');
}

// Run the seeding
seedAllAccounts()
  .then(() => {
    console.log('✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });

