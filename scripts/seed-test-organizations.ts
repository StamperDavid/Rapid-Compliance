/**
 * Seed Complete Test Organizations
 * Creates fully-configured test organizations with:
 * - Auth users
 * - Complete onboarding data
 * - Configured AI agents (Base Model + Golden Master)
 * - Product/service catalogs
 * - Ready to login and test
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, Timestamp, connectFirestoreEmulator } from 'firebase/firestore';
import { MOCK_TEST_ORGANIZATIONS } from '../src/lib/test-data/mock-organizations';
import type { CompleteTestOrganization } from '../src/lib/test-data/mock-organizations';

// Firebase config for emulators
const firebaseConfig = {
  apiKey: 'demo-key',
  authDomain: 'demo-project.firebaseapp.com',
  projectId: 'demo-ai-sales-platform',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Connect to emulators (Firebase v9+ modular SDK)
try {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
} catch (error) {
  // Emulators already connected or not available
  console.log('Emulators not connected:', error);
}

interface SeedResult {
  orgId: string;
  orgName: string;
  email: string;
  password: string;
  success: boolean;
  error?: string;
}

async function createTestOrganization(testOrg: CompleteTestOrganization, index: number): Promise<SeedResult> {
  const email = `test${index + 1}@example.com`;
  const password = 'TestPass123!';
  
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Creating: ${testOrg.name}`);
    console.log(`${'='.repeat(80)}`);
    
    // Step 1: Create Auth User
    console.log('📧 Creating auth user...');
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log('   User already exists, signing in...');
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        throw error;
      }
    }
    const userId = userCredential.user.uid;
    console.log(`   ✅ User created: ${userId}`);
    
    // Step 2: Create Organization Document
    console.log('🏢 Creating organization...');
    const orgRef = doc(db, 'organizations', testOrg.id);
    await setDoc(orgRef, {
      id: testOrg.id,
      name: testOrg.name,
      slug: testOrg.slug,
      plan: testOrg.plan,
      planLimits: testOrg.planLimits,
      billingEmail: testOrg.billingEmail,
      branding: testOrg.branding,
      settings: testOrg.settings,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
      status: testOrg.status,
      trialEndsAt: testOrg.trialEndsAt ? Timestamp.fromDate(new Date(testOrg.trialEndsAt)) : null,
      testOrg: true, // Mark as test
      testIndustry: testOrg.testIndustry,
    });
    console.log(`   ✅ Organization created: ${testOrg.id}`);
    
    // Step 3: Create User Profile
    console.log('👤 Creating user profile...');
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      id: userId,
      email: email,
      displayName: 'Test Admin',
      organizationId: testOrg.id,
      role: 'owner',
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      isTestUser: true,
    });
    console.log(`   ✅ User profile created`);
    
    // Step 4: Add Organization Member
    console.log('👥 Adding to organization members...');
    const memberRef = doc(db, 'organizations', testOrg.id, 'members', userId);
    await setDoc(memberRef, {
      userId: userId,
      email: email,
      role: 'owner',
      permissions: ['*'], // All permissions
      addedAt: Timestamp.now(),
      addedBy: userId,
      status: 'active',
    });
    console.log(`   ✅ Member added`);
    
    // Step 5: Save Complete Onboarding Data
    console.log('📋 Saving onboarding data...');
    const onboardingRef = doc(db, 'organizations', testOrg.id, 'onboarding', 'current');
    await setDoc(onboardingRef, {
      ...testOrg.onboardingData,
      organizationId: testOrg.id,
      completedAt: Timestamp.now(),
      completedBy: userId,
    });
    console.log(`   ✅ Onboarding data saved`);
    
    // Step 6: Build Agent Persona
    console.log('🤖 Building AI agent persona...');
    const personaRef = doc(db, 'organizations', testOrg.id, 'agentPersona', 'current');
    await setDoc(personaRef, {
      name: testOrg.onboardingData.agentName || `${testOrg.name} AI`,
      tone: testOrg.onboardingData.tone,
      greeting: testOrg.onboardingData.greeting,
      closingMessage: testOrg.onboardingData.closingMessage,
      objectives: [
        testOrg.onboardingData.primaryObjective,
        ...testOrg.onboardingData.secondaryObjectives,
      ],
      escalationRules: testOrg.onboardingData.escalationRules.split('\n'),
      organizationId: testOrg.id,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log(`   ✅ Persona created`);
    
    // Step 7: Build Knowledge Base
    console.log('📚 Building knowledge base...');
    const knowledgeRef = doc(db, 'organizations', testOrg.id, 'knowledgeBase', 'current');
    await setDoc(knowledgeRef, {
      documents: [], // Could upload docs here
      urls: testOrg.onboardingData.urls.map(url => ({
        url,
        addedAt: Timestamp.now(),
        status: 'pending',
      })),
      faqs: testOrg.onboardingData.faqs.split('\n').filter(q => q.includes('Q:')).map((qa, idx) => ({
        id: `faq-${idx}`,
        question: qa.split('A:')[0].replace('Q:', '').trim(),
        answer: qa.split('A:')[1]?.trim() || '',
        category: 'General',
      })),
      organizationId: testOrg.id,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log(`   ✅ Knowledge base created`);
    
    // Step 8: Create Base Model (pre-training state)
    console.log('🧪 Creating Base Model...');
    const baseModelId = `base_${Date.now()}`;
    const baseModelRef = doc(db, 'organizations', testOrg.id, 'baseModels', baseModelId);
    await setDoc(baseModelRef, {
      id: baseModelId,
      organizationId: testOrg.id,
      createdBy: userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'ready_for_golden_master', // Skip training for test data
      businessContext: {
        businessName: testOrg.onboardingData.businessName,
        industry: testOrg.onboardingData.industry,
        problemSolved: testOrg.onboardingData.problemSolved,
        uniqueValue: testOrg.onboardingData.uniqueValue,
        topProducts: testOrg.onboardingData.topProducts,
        pricingStrategy: testOrg.onboardingData.pricingStrategy,
        discountPolicy: testOrg.onboardingData.discountPolicy,
        returnPolicy: testOrg.onboardingData.returnPolicy,
        warrantyTerms: testOrg.onboardingData.warrantyTerms,
        geographicCoverage: testOrg.onboardingData.geographicCoverage,
        deliveryTimeframes: testOrg.onboardingData.deliveryTimeframes,
        typicalSalesFlow: testOrg.onboardingData.typicalSalesFlow,
        discoveryQuestions: testOrg.onboardingData.discoveryQuestions,
        commonObjections: testOrg.onboardingData.commonObjections,
        priceObjections: testOrg.onboardingData.priceObjections,
        timeObjections: testOrg.onboardingData.timeObjections,
        competitorObjections: testOrg.onboardingData.competitorObjections,
      },
      agentPersona: {
        name: testOrg.onboardingData.agentName || `${testOrg.name} AI`,
        tone: testOrg.onboardingData.tone,
        greeting: testOrg.onboardingData.greeting,
        closingMessage: testOrg.onboardingData.closingMessage,
        objectives: [
          testOrg.onboardingData.primaryObjective,
          ...testOrg.onboardingData.secondaryObjectives,
        ],
        escalationRules: testOrg.onboardingData.escalationRules.split('\n'),
      },
      behaviorConfig: {
        closingAggressiveness: testOrg.onboardingData.closingAggressiveness,
        questionFrequency: testOrg.onboardingData.questionFrequency,
        responseLength: testOrg.onboardingData.responseLength,
        proactiveLevel: testOrg.onboardingData.proactiveLevel,
      },
    });
    console.log(`   ✅ Base Model created: ${baseModelId}`);
    
    // Step 9: Create Golden Master (deployed agent)
    console.log('⭐ Creating Golden Master (deployed agent)...');
    const goldenMasterId = `gm_${Date.now()}`;
    const goldenMasterRef = doc(db, 'organizations', testOrg.id, 'goldenMasters', goldenMasterId);
    await setDoc(goldenMasterRef, {
      id: goldenMasterId,
      version: '1.0.0',
      organizationId: testOrg.id,
      createdBy: userId,
      createdAt: Timestamp.now(),
      deployedAt: Timestamp.now(),
      isActive: true,
      status: 'deployed',
      baseModelId: baseModelId,
      businessContext: {
        businessName: testOrg.onboardingData.businessName,
        industry: testOrg.onboardingData.industry,
        problemSolved: testOrg.onboardingData.problemSolved,
        uniqueValue: testOrg.onboardingData.uniqueValue,
        topProducts: testOrg.onboardingData.topProducts,
        pricingStrategy: testOrg.onboardingData.pricingStrategy,
        discountPolicy: testOrg.onboardingData.discountPolicy,
        returnPolicy: testOrg.onboardingData.returnPolicy,
        warrantyTerms: testOrg.onboardingData.warrantyTerms,
        geographicCoverage: testOrg.onboardingData.geographicCoverage,
        deliveryTimeframes: testOrg.onboardingData.deliveryTimeframes,
        typicalSalesFlow: testOrg.onboardingData.typicalSalesFlow,
        discoveryQuestions: testOrg.onboardingData.discoveryQuestions,
        commonObjections: testOrg.onboardingData.commonObjections,
        priceObjections: testOrg.onboardingData.priceObjections,
        timeObjections: testOrg.onboardingData.timeObjections,
        competitorObjections: testOrg.onboardingData.competitorObjections,
      },
      agentPersona: {
        name: testOrg.onboardingData.agentName || `${testOrg.name} AI`,
        tone: testOrg.onboardingData.tone,
        greeting: testOrg.onboardingData.greeting,
        closingMessage: testOrg.onboardingData.closingMessage,
        objectives: [
          testOrg.onboardingData.primaryObjective,
          ...testOrg.onboardingData.secondaryObjectives,
        ],
        escalationRules: testOrg.onboardingData.escalationRules.split('\n'),
      },
      behaviorConfig: {
        closingAggressiveness: testOrg.onboardingData.closingAggressiveness,
        questionFrequency: testOrg.onboardingData.questionFrequency,
        responseLength: testOrg.onboardingData.responseLength,
        proactiveLevel: testOrg.onboardingData.proactiveLevel,
      },
      knowledgeBase: {
        documents: [],
        urls: testOrg.onboardingData.urls.map(url => ({
          url,
          addedAt: Timestamp.now(),
          status: 'pending',
        })),
        faqs: testOrg.onboardingData.faqs.split('\n').filter(q => q.includes('Q:')).map((qa, idx) => ({
          id: `faq-${idx}`,
          question: qa.split('A:')[0].replace('Q:', '').trim(),
          answer: qa.split('A:')[1]?.trim() || '',
          category: 'General',
        })),
      },
      systemPrompt: buildSystemPrompt(testOrg),
      trainedScenarios: [],
      trainingCompletedAt: Timestamp.now(),
    });
    console.log(`   ✅ Golden Master deployed: ${goldenMasterId}`);
    
    // Step 10: Create Product/Service Schema
    console.log('📦 Creating product schema...');
    const schemaId = 'products';
    const schemaRef = doc(db, 'organizations', testOrg.id, 'schemas', schemaId);
    await setDoc(schemaRef, {
      id: schemaId,
      name: 'Product',
      pluralName: 'Products',
      singularName: 'Product',
      icon: '📦',
      organizationId: testOrg.id,
      createdBy: userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      fields: [
        { id: 'f1', key: 'name', label: 'Product Name', type: 'text', required: true },
        { id: 'f2', key: 'sku', label: 'SKU', type: 'text', required: true },
        { id: 'f3', key: 'description', label: 'Description', type: 'longText', required: false },
        { id: 'f4', key: 'price', label: 'Price', type: 'currency', required: true },
        { id: 'f5', key: 'cost', label: 'Cost', type: 'currency', required: false },
        { id: 'f6', key: 'category', label: 'Category', type: 'text', required: false },
        { id: 'f7', key: 'active', label: 'Active', type: 'checkbox', required: true },
        { id: 'f8', key: 'stock_quantity', label: 'Stock Quantity', type: 'number', required: false },
        { id: 'f9', key: 'unit', label: 'Unit', type: 'text', required: false },
      ],
    });
    console.log(`   ✅ Product schema created`);
    
    // Step 11: Seed Products
    console.log(`📦 Seeding ${testOrg.products.length} products...`);
    for (const product of testOrg.products) {
      const productId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const productRef = doc(db, 'organizations', testOrg.id, 'entities_products', productId);
      await setDoc(productRef, {
        id: productId,
        ...product,
        organizationId: testOrg.id,
        createdBy: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
    console.log(`   ✅ ${testOrg.products.length} products seeded`);
    
    // Step 12: Create default workspace
    console.log('🏗️ Creating default workspace...');
    const workspaceId = `ws_${testOrg.id}`;
    const workspaceRef = doc(db, 'organizations', testOrg.id, 'workspaces', workspaceId);
    await setDoc(workspaceRef, {
      id: workspaceId,
      organizationId: testOrg.id,
      name: `${testOrg.name} Workspace`,
      slug: testOrg.slug,
      industry: testOrg.testIndustry,
      createdBy: userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'active',
      settings: {
        allowGuestAccess: false,
        enableAI: true,
        enableWorkflows: true,
        dataRetentionDays: 365,
      },
    });
    console.log(`   ✅ Workspace created: ${workspaceId}`);
    
    console.log(`\n✨ SUCCESS: ${testOrg.name}`);
    console.log(`   📧 Login: ${email}`);
    console.log(`   🔑 Password: ${password}`);
    console.log(`   🏢 Org ID: ${testOrg.id}`);
    console.log(`   👤 User ID: ${userId}`);
    console.log(`   📦 Products: ${testOrg.products.length}`);
    console.log(`   🤖 AI Agent: DEPLOYED (${goldenMasterId})`);
    
    return {
      orgId: testOrg.id,
      orgName: testOrg.name,
      email,
      password,
      success: true,
    };
    
  } catch (error: any) {
    console.error(`\n❌ ERROR creating ${testOrg.name}:`, error.message);
    return {
      orgId: testOrg.id,
      orgName: testOrg.name,
      email,
      password,
      success: false,
      error: error.message,
    };
  }
}

function buildSystemPrompt(testOrg: CompleteTestOrganization): string {
  const d = testOrg.onboardingData;
  return `You are an AI sales and customer service agent for ${d.businessName}.

# Your Role & Objectives
- Primary: ${d.primaryObjective}
- Secondary: ${d.secondaryObjectives.join(', ')}

# Business Context
Industry: ${d.industry}
What we do: ${d.problemSolved}
What makes us unique: ${d.uniqueValue}

# Products/Services
${d.topProducts}

# Pricing Strategy
${d.pricingStrategy}
${d.discountPolicy}

# Policies
Return Policy: ${d.returnPolicy}
Warranty: ${d.warrantyTerms}
Shipping: ${d.geographicCoverage}
Delivery Time: ${d.deliveryTimeframes}

# Your Sales Process
${d.typicalSalesFlow}

Discovery Questions to Ask:
${d.discoveryQuestions}

# Objection Handling
${d.commonObjections}

Price Objections: ${d.priceObjections}
Time Objections: ${d.timeObjections}
Competitor Objections: ${d.competitorObjections}

# Your Personality
Name: ${d.agentName || `${d.businessName} AI`}
Tone: ${d.tone}
Greeting: "${d.greeting}"
Closing: "${d.closingMessage}"

# Behavioral Guidelines
- Closing Aggressiveness: ${d.closingAggressiveness}/10
- Ask ${d.questionFrequency} discovery questions before recommending
- Response Length: ${d.responseLength}
- Proactive Level: ${d.proactiveLevel}/10

# Compliance
${d.requiredDisclosures}
Prohibited Topics: ${d.prohibitedTopics}

Remember: ${d.escalationRules}`;
}

async function seedAllTestOrganizations() {
  console.log('\n🚀 SEEDING COMPLETE TEST ORGANIZATIONS');
  console.log('='.repeat(80));
  console.log(`Creating ${MOCK_TEST_ORGANIZATIONS.length} fully configured test organizations...`);
  console.log('Each includes:');
  console.log('  ✅ Auth user & organization');
  console.log('  ✅ Complete 16-step onboarding data');
  console.log('  ✅ AI agent persona & knowledge base');
  console.log('  ✅ Base Model + Deployed Golden Master');
  console.log('  ✅ Product/service catalogs');
  console.log('  ✅ Default workspace\n');
  
  const results: SeedResult[] = [];
  
  for (let i = 0; i < MOCK_TEST_ORGANIZATIONS.length; i++) {
    const testOrg = MOCK_TEST_ORGANIZATIONS[i];
    const result = await createTestOrganization(testOrg, i);
    results.push(result);
    
    // Small delay between creations
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('📊 SEEDING SUMMARY');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ TEST ACCOUNTS READY TO LOGIN:\n');
    successful.forEach((r, idx) => {
      console.log(`${idx + 1}. ${r.orgName}`);
      console.log(`   📧 Email: ${r.email}`);
      console.log(`   🔑 Password: ${r.password}`);
      console.log(`   🏢 Org ID: ${r.orgId}`);
      console.log('');
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED:\n');
    failed.forEach(r => {
      console.log(`   ${r.orgName}: ${r.error}`);
    });
  }
  
  console.log('\n🎯 WHAT YOU CAN TEST NOW:');
  console.log('   ✅ Login with any test account');
  console.log('   ✅ AI agent is FULLY CONFIGURED and knows the business');
  console.log('   ✅ Products are loaded in the catalog');
  console.log('   ✅ Agent personality matches industry');
  console.log('   ✅ Test across multiple industries');
  console.log('   ✅ No onboarding needed - everything is ready!');
  
  console.log('\n🧪 NEXT STEPS:');
  console.log('   1. Go to http://localhost:3000');
  console.log('   2. Login with test1@example.com / TestPass123!');
  console.log('   3. Chat with the AI agent - it knows the business!');
  console.log('   4. View products in the catalog');
  console.log('   5. Test other industries with test2@, test3@, etc.\n');
}

// Run the seeding
seedAllTestOrganizations()
  .then(() => {
    console.log('✅ SEEDING COMPLETE!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ SEEDING FAILED:', error);
    process.exit(1);
  });

