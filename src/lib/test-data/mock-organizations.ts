/**
 * Comprehensive Test Organizations with Complete Profiles
 * Each organization has:
 * - Complete onboarding data (all 16 steps)
 * - Product/service catalogs
 * - Different industries for AI flexibility testing
 * - Marked with (TEST) for easy identification/removal
 */

import type { Organization } from '@/types/organization';

export interface CompleteTestOrganization extends Organization {
  onboardingData: OnboardingData;
  products: Product[];
  testIndustry: string;
}

export interface OnboardingData {
  // Step 1: Business Basics
  businessName: string;
  industry: string;
  website: string;
  faqPageUrl: string;
  socialMediaUrls: string[];
  companySize: string;
  
  // Step 2: Business Understanding
  problemSolved: string;
  uniqueValue: string;
  whyBuy: string;
  whyNotBuy: string;
  
  // Step 3: Products/Services Overview
  primaryOffering: string;
  priceRange: string;
  targetCustomer: string;
  customerDemographics: string;
  
  // Step 4: Product/Service Details
  topProducts: string;
  productComparison: string;
  seasonalOfferings: string;
  whoShouldNotBuy: string;
  
  // Step 5: Pricing & Sales Strategy
  pricingStrategy: string;
  discountPolicy: string;
  volumeDiscounts: string;
  firstTimeBuyerIncentive: string;
  financingOptions: string;
  
  // Step 6: Operations & Fulfillment
  geographicCoverage: string;
  deliveryTimeframes: string;
  inventoryConstraints: string;
  capacityLimitations: string;
  
  // Step 7: Policies & Guarantees
  returnPolicy: string;
  warrantyTerms: string;
  cancellationPolicy: string;
  satisfactionGuarantee: string;
  
  // Step 8: Agent Goals & Objectives
  primaryObjective: string;
  secondaryObjectives: string[];
  successMetrics: string;
  escalationRules: string;
  
  // Step 9: Sales Process & Flow
  typicalSalesFlow: string;
  qualificationCriteria: string;
  discoveryQuestions: string;
  closingStrategy: string;
  
  // Step 10: Objection Handling
  commonObjections: string;
  priceObjections: string;
  timeObjections: string;
  competitorObjections: string;
  
  // Step 11: Customer Service
  supportScope: string;
  technicalSupport: string;
  orderTracking: string;
  complaintResolution: string;
  
  // Step 12: Agent Personality
  tone: string;
  agentName: string;
  greeting: string;
  closingMessage: string;
  
  // Step 13: Behavioral Controls
  closingAggressiveness: number;
  questionFrequency: number;
  responseLength: string;
  proactiveLevel: number;
  
  // Step 14: Knowledge Base
  urls: string[];
  faqs: string;
  competitorUrls: string[];
  
  // Step 15: Compliance & Legal
  requiredDisclosures: string;
  privacyCompliance: boolean;
  industryRegulations: string;
  prohibitedTopics: string;
}

export interface Product {
  name: string;
  sku: string;
  description: string;
  price: number;
  cost?: number;
  category: string;
  active: boolean;
  stock_quantity?: number;
  unit?: string;
}

export const MOCK_TEST_ORGANIZATIONS: CompleteTestOrganization[] = [
  // 1. E-COMMERCE - Outdoor Gear
  {
    id: 'test-org-1',
    name: 'Summit Outdoor Gear (TEST)',
    slug: 'summit-outdoor-gear-test',
    plan: 'pro',
    planLimits: {
      maxWorkspaces: 3,
      maxUsersPerWorkspace: 25,
      maxRecordsPerWorkspace: 100000,
      maxAICallsPerMonth: 10000,
      maxStorageGB: 100,
      maxSchemas: 20,
      maxWorkflows: 50,
      allowCustomDomain: false,
      allowWhiteLabel: false,
      allowAPIAccess: true,
    },
    billingEmail: 'billing@summitgear-test.com',
    branding: {},
    settings: {
      defaultTimezone: 'America/Denver',
      defaultCurrency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    createdAt: new Date('2024-01-15') as any,
    updatedAt: new Date() as any,
    createdBy: 'test-user-1',
    status: 'active',
    testIndustry: 'E-commerce - Outdoor Equipment',
    onboardingData: {
      businessName: 'Summit Outdoor Gear',
      industry: 'E-commerce - Outdoor & Adventure Equipment',
      website: 'https://summitoutdoorgear.example.com',
      faqPageUrl: 'https://summitoutdoorgear.example.com/faq',
      socialMediaUrls: ['https://instagram.com/summitgear', 'https://facebook.com/summitgear'],
      companySize: '25-50 employees',
      
      problemSolved: 'We provide high-quality outdoor gear that helps adventurers explore safely and comfortably, solving the problem of finding reliable, durable equipment at fair prices.',
      uniqueValue: 'Expert-curated selection with real field testing, lifetime repair service, and gear rental program for expensive items.',
      whyBuy: 'Customers choose us for our 100% satisfaction guarantee, expert staff who are actual outdoors enthusiasts, and our commitment to sustainability.',
      whyNotBuy: 'Budget-conscious customers might find cheaper alternatives at big-box stores; ultra-specialized climbers may prefer boutique brands.',
      
      primaryOffering: 'Premium outdoor equipment including camping gear, hiking equipment, climbing supplies, and adventure clothing',
      priceRange: '$20 - $2,500 (most items $50-$400)',
      targetCustomer: 'Outdoor enthusiasts aged 25-55, income $60k+, weekend adventurers to serious mountaineers',
      customerDemographics: 'College-educated professionals, environmentally conscious, value quality over price, active lifestyle',
      
      topProducts: '1. TrekPro Backpack Series ($180-$320)\n2. Alpine Tent Collection ($400-$1,200)\n3. SummitShell Jackets ($220-$450)\n4. TrailBlazer Hiking Boots ($160-$280)\n5. ClimbSafe Harness System ($120-$350)',
      productComparison: 'TrekPro vs competitors: Lighter weight (-15%), more durable (tested to 10,000+ miles), better warranty (lifetime vs 1-3 years)',
      seasonalOfferings: 'Spring: Hiking & camping gear. Summer: Water sports & backpacking. Fall: Hunting & photography equipment. Winter: Skiing, snowboarding & cold weather gear',
      whoShouldNotBuy: 'Casual once-a-year campers who just need basic equipment, ultra-budget shoppers, those seeking fashion-forward items over function',
      
      pricingStrategy: 'Premium positioning with fair pricing - 20-30% below luxury brands, 40-60% above budget options. Focus on value and durability.',
      discountPolicy: '10% off first purchase, seasonal sales (20-30% off select items), clearance on previous season (up to 50% off)',
      volumeDiscounts: 'Bulk orders for groups/organizations: 15% off $1,000+, 20% off $2,500+, custom pricing for $5,000+',
      firstTimeBuyerIncentive: '10% off + free shipping on orders $100+, plus free gear maintenance guide ebook',
      financingOptions: 'Affirm financing available: 0% APR for purchases $500+ over 6 months, standard rates for 12+ months',
      
      geographicCoverage: 'Ship nationwide (USA), free shipping $100+, international to Canada & EU (additional fees)',
      deliveryTimeframes: '2-5 business days standard, next-day available for $25, store pickup in Denver/Boulder/Aspen',
      inventoryConstraints: 'Popular sizes may sell out during peak season (spring/early summer), pre-order available',
      capacityLimitations: 'Custom gear orders take 3-4 weeks, high-demand periods may extend shipping 1-2 days',
      
      returnPolicy: '60-day return policy, full refund if unused with tags, used gear eligible for exchange or store credit',
      warrantyTerms: 'Lifetime warranty against manufacturing defects, free repairs for normal wear up to 5 years',
      cancellationPolicy: 'Cancel/modify orders within 24 hours, free cancellation before shipping',
      satisfactionGuarantee: '100% satisfaction guarantee - if gear fails you on the trail, we make it right with repair, replacement or refund',
      
      primaryObjective: 'sales',
      secondaryObjectives: ['lead-qualification', 'product-recommendations', 'customer-education'],
      successMetrics: 'Conversion rate >8%, average order value $250+, customer satisfaction >4.5/5',
      escalationRules: 'Escalate warranty claims >$500, custom orders, wholesale inquiries, dissatisfied customers',
      
      typicalSalesFlow: '1. Welcome & identify needs\n2. Ask about experience level and intended use\n3. Recommend 2-3 products matching needs\n4. Address concerns about price/quality\n5. Offer first-time discount\n6. Close with urgency (limited stock) or seasonal timing',
      qualificationCriteria: 'Has specific outdoor activity in mind, budget >$100, timeline for purchase (trip coming up)',
      discoveryQuestions: 'What outdoor activities are you planning? Experience level? When is your trip? What gear do you already have? Budget range?',
      closingStrategy: 'Bundle suggestion (save 15% on kits), limited stock urgency, seasonal timing, first-timer discount, free shipping threshold',
      
      commonObjections: 'Price concerns, "I can find cheaper on Amazon", comparison to specific brands, need time to think',
      priceObjections: 'Emphasize quality & durability (costs less over time), warranty value, expert selection, rental program for expensive items',
      timeObjections: 'Offer to hold cart for 24 hours, send comparison guide, highlight seasonal stock limitations',
      competitorObjections: 'Acknowledge quality competitors, emphasize our testing process, warranty, and customer service',
      
      supportScope: 'Product selection help, order tracking, returns/exchanges, warranty claims, gear maintenance advice',
      technicalSupport: 'Expert staff available for gear selection, sizing help, usage instructions, maintenance tutorials',
      orderTracking: 'Automatic tracking emails, SMS notifications optional, real-time tracking on website',
      complaintResolution: 'Same-day response, full refund/replacement for defective items, store credit for dissatisfaction',
      
      tone: 'enthusiastic-professional',
      agentName: 'Trail Guide AI',
      greeting: 'Hey there, fellow adventurer! 🏔️ Welcome to Summit Outdoor Gear. Whether you\'re planning your first camping trip or your next alpine climb, I\'m here to help you find the perfect gear. What adventure are you gearing up for?',
      closingMessage: 'Thanks for choosing Summit! Your gear will be ready for adventure in 2-5 days. Need anything else before you hit the trail? Happy exploring! 🎒',
      
      closingAggressiveness: 6,
      questionFrequency: 4,
      responseLength: 'balanced',
      proactiveLevel: 7,
      
      urls: ['https://summitoutdoorgear.example.com', 'https://summitoutdoorgear.example.com/gear-guides'],
      faqs: 'Q: Do you price match? A: Yes, we match legitimate competitor prices on identical items.\nQ: Can I rent gear? A: Yes, we rent tents, climbing gear, and backpacks.\nQ: What\'s your return policy? A: 60 days, full refund if unused.',
      competitorUrls: ['https://rei.com', 'https://backcountry.com'],
      
      requiredDisclosures: 'Some climbing/safety gear requires basic training. Financing subject to credit approval.',
      privacyCompliance: true,
      industryRegulations: 'Follow CPSIA for safety equipment, outdoor industry association standards',
      prohibitedTopics: 'Medical advice, guarantees about safety in dangerous conditions, modifications to safety equipment',
    },
    products: [
      { name: 'TrekPro 65L Backpack', sku: 'TP-65-BLU', description: 'Professional-grade 65L backpack with ventilated back system and adjustable torso', price: 289.99, cost: 145, category: 'Backpacks', active: true, stock_quantity: 45, unit: 'each' },
      { name: 'Alpine 3-Season Tent', sku: 'ALP-3S-GRN', description: '2-person 3-season tent, 4lbs, waterproof to 3000mm', price: 449.99, cost: 210, category: 'Tents', active: true, stock_quantity: 28, unit: 'each' },
      { name: 'SummitShell Rain Jacket', sku: 'SS-RJ-RED-L', description: 'Waterproof breathable shell with pit zips and adjustable hood', price: 279.99, cost: 135, category: 'Jackets', active: true, stock_quantity: 67, unit: 'each' },
      { name: 'TrailBlazer Hiking Boots', sku: 'TB-HB-BRN-10', description: 'Full-grain leather hiking boots with Vibram soles and ankle support', price: 219.99, cost: 98, category: 'Footwear', active: true, stock_quantity: 34, unit: 'pair' },
      { name: 'ClimbSafe Harness', sku: 'CS-HAR-BLK-M', description: 'UIAA certified climbing harness with 4 gear loops and adjustable legs', price: 149.99, cost: 68, category: 'Climbing', active: true, stock_quantity: 52, unit: 'each' },
      { name: 'Summit Sleeping Bag 15°F', sku: 'SUM-SB-15-BLU', description: 'Down-filled mummy bag rated to 15°F, 2.5lbs, compressible', price: 329.99, cost: 155, category: 'Sleep Systems', active: true, stock_quantity: 41, unit: 'each' },
      { name: 'HydroFlow 3L Reservoir', sku: 'HF-3L-CLR', description: '3-liter hydration bladder with insulated hose and quick-disconnect', price: 42.99, cost: 18, category: 'Hydration', active: true, stock_quantity: 156, unit: 'each' },
      { name: 'TrekPole Carbon Fiber', sku: 'TP-CF-BLK', description: 'Ultra-light carbon fiber trekking poles with cork grips (pair)', price: 129.99, cost: 54, category: 'Accessories', active: true, stock_quantity: 89, unit: 'pair' },
    ],
  },

  // 2. SAAS - B2B Software
  {
    id: 'test-org-2',
    name: 'CloudFlow Analytics (TEST)',
    slug: 'cloudflow-analytics-test',
    plan: 'enterprise',
    planLimits: {
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
    billingEmail: 'finance@cloudflow-test.com',
    branding: {},
    settings: {
      defaultTimezone: 'America/New_York',
      defaultCurrency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    createdAt: new Date('2023-06-10') as any,
    updatedAt: new Date() as any,
    createdBy: 'test-user-2',
    status: 'active',
    testIndustry: 'B2B SaaS - Business Analytics',
    onboardingData: {
      businessName: 'CloudFlow Analytics',
      industry: 'B2B SaaS - Business Intelligence & Analytics',
      website: 'https://cloudflow-analytics.example.com',
      faqPageUrl: 'https://cloudflow-analytics.example.com/help',
      socialMediaUrls: ['https://linkedin.com/company/cloudflow', 'https://twitter.com/cloudflow'],
      companySize: '150-200 employees',
      
      problemSolved: 'We solve the problem of data silos and complex analytics by providing an all-in-one platform that connects to any data source and delivers actionable insights without requiring technical expertise.',
      uniqueValue: 'Unlike competitors, we offer no-code data integration, AI-powered insights, and industry-specific templates that get teams productive in hours, not months.',
      whyBuy: 'Teams choose us for ease of use, fast implementation (go-live in 1 week vs 3-6 months), lower total cost, and white-glove customer success.',
      whyNotBuy: 'Companies with dedicated data science teams and custom infrastructure may prefer building in-house; very small businesses (<10 people) may find it overkill.',
      
      primaryOffering: 'Cloud-based business intelligence platform with data integration, visualization, AI insights, and collaborative dashboards',
      priceRange: '$299/month (Starter) to $2,999/month (Enterprise), custom pricing for 500+ users',
      targetCustomer: 'Mid-market companies (50-500 employees), operations/analytics leaders frustrated with spreadsheets or expensive BI tools',
      customerDemographics: 'B2B companies, SaaS/tech/services industries, decision-makers are Directors/VPs of Operations, Analytics, or IT',
      
      topProducts: '1. Starter Plan - $299/mo (5 users, 10 data sources)\n2. Professional - $899/mo (25 users, unlimited sources)\n3. Enterprise - $2,999/mo (unlimited users, white-label, API)\n4. Add-ons: Advanced AI ($499/mo), Custom integrations ($1,200 setup)',
      productComparison: 'vs Tableau: 70% lower cost, no IT required. vs PowerBI: Better UX, faster setup. vs Looker: No SQL needed, industry templates included.',
      seasonalOfferings: 'Q4: Year-end planning packages. Q1: New year growth bundles (3 months free with annual). Mid-year: Summer success promotion.',
      whoShouldNotBuy: 'Companies needing real-time streaming analytics (<1 second latency), highly customized ML models, or on-premise only solutions.',
      
      pricingStrategy: 'Value-based tiering by user count and features. 40-60% below enterprise BI tools, positioned as "enterprise features at mid-market prices"',
      discountPolicy: '20% off annual payment, 15% off first year for qualified startups, volume discounts at 50+ users',
      volumeDiscounts: '50-100 users: 15% off, 100-250 users: 25% off, 250+ custom pricing typically 30-40% off list',
      firstTimeBuyerIncentive: '14-day free trial + free onboarding ($1,500 value) + 30-day money-back guarantee',
      financingOptions: 'Annual payment plan (spread over 12 months), quarterly billing available for Enterprise',
      
      geographicCoverage: 'Global - cloud-based service, support in US, UK, EU time zones, data residency options (US, EU, APAC)',
      deliveryTimeframes: 'Instant access on signup, onboarding call within 24 hours, go-live typically 3-7 days',
      inventoryConstraints: 'No physical inventory, enterprise tier slots may have waiting list during high-demand periods',
      capacityLimitations: 'Free trials limited to 100 concurrent slots, enterprise onboarding capacity ~15 new customers/month',
      
      returnPolicy: '30-day money-back guarantee for annual plans, cancel monthly anytime (prorated refund for unused time)',
      warrantyTerms: '99.9% uptime SLA (Enterprise), 24/7 support, data backup & recovery included',
      cancellationPolicy: 'Cancel anytime, no penalties. Export all data in standard formats. 30-day data retention after cancellation.',
      satisfactionGuarantee: 'If not satisfied in first 30 days, full refund + we help migrate to competitor at no charge (rare but we stand behind it)',
      
      primaryObjective: 'lead-qualification',
      secondaryObjectives: ['demo-booking', 'sales', 'customer-education'],
      successMetrics: 'Demo booking rate >15%, demo-to-trial >60%, trial-to-paid >35%, qualified lead score >70',
      escalationRules: 'Escalate to sales for: 50+ users, enterprise features, custom requests, security/compliance questions, pricing negotiations',
      
      typicalSalesFlow: '1. Qualify company size & pain points\n2. Identify decision makers & timeline\n3. Book demo with solutions engineer\n4. Address technical/security questions\n5. Offer trial with success plan\n6. Follow up during trial\n7. Commercial terms discussion\n8. Close with annual discount',
      qualificationCriteria: 'Company size 20+ employees, budget authority or influence, active pain with current solution, timeline <90 days',
      discoveryQuestions: 'How many people need analytics? Current tools? Biggest frustrations? Key metrics you track? Timeline? Budget approved?',
      closingStrategy: 'ROI calculator showing time/cost savings, annual payment discount (20% off), limited onboarding slots, executive demo with CEO',
      
      commonObjections: 'Already using [competitor], need to see it work with our data, price concerns, change management risk',
      priceObjections: 'Show ROI calculation (saves 20+ hours/week), compare total cost vs Tableau/PowerBI, emphasize included onboarding/support, flexible payment terms',
      timeObjections: 'Highlight fast go-live (7 days), offer to start trial immediately, create urgency with limited onboarding slots',
      competitorObjections: 'Acknowledge strengths, differentiate on ease of use & speed to value, offer side-by-side trial, customer references in same industry',
      
      supportScope: 'Technical support, onboarding, training, data modeling help, integration assistance, best practices consulting',
      technicalSupport: '24/7 email/chat support, phone for Enterprise, dedicated success manager (Pro+), quarterly business reviews (Enterprise)',
      orderTracking: 'Real-time account setup status, onboarding checklist, integration progress dashboard',
      complaintResolution: '<4 hour response SLA, escalation path to VP Customer Success, service credits for SLA breaches',
      
      tone: 'professional',
      agentName: 'CloudFlow Assistant',
      greeting: 'Hello! Welcome to CloudFlow Analytics. I help teams transform their data into insights without the complexity. Are you currently struggling with disconnected data sources or spending too much time in spreadsheets?',
      closingMessage: 'Thanks for your interest in CloudFlow! I\'ve sent the demo booking link and trial access to your email. Our team will reach out within 24 hours to help you get started. Looking forward to showing you what\'s possible!',
      
      closingAggressiveness: 4,
      questionFrequency: 5,
      responseLength: 'detailed',
      proactiveLevel: 6,
      
      urls: ['https://cloudflow-analytics.example.com', 'https://cloudflow-analytics.example.com/blog', 'https://cloudflow-analytics.example.com/case-studies'],
      faqs: 'Q: What data sources do you connect to? A: 200+ including Salesforce, HubSpot, Google Analytics, databases, spreadsheets, and custom APIs.\nQ: Do we need IT/developers? A: No, designed for business users. No coding required.\nQ: How long is implementation? A: Most customers go-live in 3-7 days with our onboarding.',
      competitorUrls: ['https://tableau.com', 'https://powerbi.com', 'https://looker.com'],
      
      requiredDisclosures: 'SOC 2 Type II certified, GDPR compliant, HIPAA available (Enterprise), data processing agreement available',
      privacyCompliance: true,
      industryRegulations: 'SOC 2, GDPR, CCPA, HIPAA (Healthcare), PCI-DSS (Payment data)',
      prohibitedTopics: 'Cannot guarantee specific ROI numbers, cannot access customer data without permission, no medical/legal/financial advice',
    },
    products: [
      { name: 'Starter Plan', sku: 'PLAN-STARTER-M', description: '5 users, 10 data sources, core visualizations, email support', price: 299, cost: 80, category: 'Subscriptions', active: true, unit: 'month' },
      { name: 'Professional Plan', sku: 'PLAN-PRO-M', description: '25 users, unlimited sources, AI insights, priority support, phone support', price: 899, cost: 250, category: 'Subscriptions', active: true, unit: 'month' },
      { name: 'Enterprise Plan', sku: 'PLAN-ENT-M', description: 'Unlimited users, white-label, API access, SSO, dedicated CSM, 24/7 phone', price: 2999, cost: 900, category: 'Subscriptions', active: true, unit: 'month' },
      { name: 'Advanced AI Add-on', sku: 'ADDON-AI-M', description: 'Predictive analytics, anomaly detection, automated insights, ML models', price: 499, cost: 120, category: 'Add-ons', active: true, unit: 'month' },
      { name: 'Custom Integration', sku: 'SVC-CUSTOM-INT', description: 'Build custom connector to proprietary system or legacy database', price: 1200, cost: 450, category: 'Professional Services', active: true, unit: 'each' },
      { name: 'Premium Training Package', sku: 'SVC-TRAINING-PREM', description: '8 hours of live training for team, custom to your use cases', price: 2400, cost: 800, category: 'Professional Services', active: true, unit: 'each' },
    ],
  },

  // 3. PROFESSIONAL SERVICES - Legal
  {
    id: 'test-org-3',
    name: 'Vertex Law Group (TEST)',
    slug: 'vertex-law-test',
    plan: 'pro',
    planLimits: {
      maxWorkspaces: 3,
      maxUsersPerWorkspace: 25,
      maxRecordsPerWorkspace: 100000,
      maxAICallsPerMonth: 10000,
      maxStorageGB: 100,
      maxSchemas: 20,
      maxWorkflows: 50,
      allowCustomDomain: false,
      allowWhiteLabel: false,
      allowAPIAccess: true,
    },
    billingEmail: 'accounting@vertexlaw-test.com',
    branding: {},
    settings: {
      defaultTimezone: 'America/Los_Angeles',
      defaultCurrency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    createdAt: new Date('2024-03-01') as any,
    updatedAt: new Date() as any,
    createdBy: 'test-user-3',
    status: 'trial',
    trialEndsAt: new Date('2024-12-20') as any,
    testIndustry: 'Professional Services - Legal',
    onboardingData: {
      businessName: 'Vertex Law Group',
      industry: 'Legal Services - Business & Employment Law',
      website: 'https://vertexlawgroup.example.com',
      faqPageUrl: 'https://vertexlawgroup.example.com/faqs',
      socialMediaUrls: ['https://linkedin.com/company/vertexlaw'],
      companySize: '10-25 employees',
      
      problemSolved: 'We help businesses navigate complex legal matters without the cost and overhead of big law firms, providing expert counsel on employment law, contracts, compliance, and business formation.',
      uniqueValue: 'Boutique firm expertise with transparent pricing - fixed fees for most services, 24-hour response time, and practical business-first advice.',
      whyBuy: 'Clients choose us for predictable costs, responsive communication, deep employment law expertise, and understanding of startup/SMB challenges.',
      whyNotBuy: 'Large enterprises may prefer established national firms; complex litigation or specialized IP work may require specialist firms.',
      
      primaryOffering: 'Business law services including employment matters, contract review, compliance, business formation, and dispute resolution',
      priceRange: '$250-$550/hour (attorney dependent), many fixed-fee services $500-$5,000',
      targetCustomer: 'Small to mid-sized businesses (10-500 employees), startups, entrepreneurs needing ongoing legal counsel',
      customerDemographics: 'Business owners, HR directors, startup founders, tech companies, professional services firms, primarily in CA/Western US',
      
      topProducts: '1. Employment Law Audit - $2,500 (fixed)\n2. Contract Review - $500-$2,000\n3. Monthly Retainer - $1,500/mo (5 hours)\n4. Business Formation - $1,500-$3,500\n5. Litigation Services - $350/hour',
      productComparison: 'vs Big Law: 40-60% lower rates, better access to partners. vs DIY: Expert review prevents costly mistakes. vs in-house: Fraction of the cost.',
      seasonalOfferings: 'Year-end: Annual compliance audit packages. Q1: Benefits review for ACA. Throughout: Ongoing retainers and project work.',
      whoShouldNotBuy: 'Those needing criminal defense, family law, personal injury, or highly specialized areas like patent prosecution.',
      
      pricingStrategy: 'Transparent fixed fees where possible, competitive hourly rates, monthly retainers for ongoing needs',
      discountPolicy: 'Startup discount (20% off first 6 months with qualifying startup), referral discount ($500 credit)',
      volumeDiscounts: 'Monthly retainer: Discounted hours ($300/hr vs $350). Annual retainer: 15% discount. Large projects: custom pricing.',
      firstTimeBuyerIncentive: 'Free 30-minute consultation ($175 value), 10% off first project',
      financingOptions: 'Payment plans available for projects >$5,000, monthly retainer auto-pay, net-30 terms for established clients',
      
      geographicCoverage: 'Licensed in CA, OR, WA. Handle matters nationwide with local counsel partnerships.',
      deliveryTimeframes: 'Initial consultation within 48 hours, contract review 3-5 business days, urgent matters can be expedited',
      inventoryConstraints: 'Partner availability may require scheduling 1-2 weeks out for non-urgent matters',
      capacityLimitations: 'Litigation cases limited to maintain quality - may refer out if at capacity',
      
      returnPolicy: 'Satisfaction guarantee on fixed-fee services - will revise until satisfied or refund',
      warrantyTerms: 'Malpractice insurance coverage, work product guaranteed accurate and current with law as of delivery date',
      cancellationPolicy: 'Retainers: 30-day notice to cancel. Projects: May cancel before work begins, prorated refund if in progress.',
      satisfactionGuarantee: 'If not satisfied with work product, we will revise at no charge or provide refund',
      
      primaryObjective: 'lead-qualification',
      secondaryObjectives: ['consultation-booking', 'customer-education', 'retainer-sales'],
      successMetrics: 'Consultation booking rate >25%, consultation-to-client >40%, retainer conversion >15%',
      escalationRules: 'Escalate conflicts checks, urgent litigation matters, fee disputes, complex technical questions to partner',
      
      typicalSalesFlow: '1. Understand legal need/urgency\n2. Conflicts check\n3. Book consultation\n4. Assess scope and provide fee estimate\n5. Send engagement letter\n6. Collect retainer\n7. Begin work',
      qualificationCriteria: 'Business legal matter (not personal), within practice areas, no conflicts, budget authority, timeline identified',
      discoveryQuestions: 'What legal issue brings you here? Tell me about your business. Timeline/urgency? Prior legal counsel? Budget considerations?',
      closingStrategy: 'Emphasize consultation value, urgency of legal matters, risk of delay, fixed fee certainty, relationship building',
      
      commonObjections: 'Cost concerns, "just need quick answer", using another firm, doing it ourselves, not urgent',
      priceObjections: 'Explain cost of NOT having proper legal counsel, show fixed fee options, compare to big law rates, emphasize prevention vs crisis',
      timeObjections: 'Highlight risks of delay, offer expedited service, explain 24-hr response commitment, provide immediate next steps',
      competitorObjections: 'Respect their existing relationship, offer second opinion value, specialized expertise, better communication/value',
      
      supportScope: 'Legal advice, document review/drafting, compliance guidance, dispute resolution, ongoing counsel',
      technicalSupport: 'Partner available for complex matters, associates handle routine work, 24-hour response guarantee',
      orderTracking: 'Client portal for documents and case status, regular update emails, billing transparency',
      complaintResolution: 'Partner personally addresses concerns, fee adjustments for service issues, mediation/arbitration for disputes',
      
      tone: 'professional',
      agentName: 'Vertex Legal Assistant',
      greeting: 'Welcome to Vertex Law Group. I help business owners with legal questions and connecting them with our attorneys. What legal matter can we help you with today?',
      closingMessage: 'Thank you for considering Vertex Law Group. We\'ve scheduled your consultation and sent confirmation to your email. Our attorney will be well-prepared to discuss your matter. We look forward to helping protect your business.',
      
      closingAggressiveness: 3,
      questionFrequency: 4,
      responseLength: 'detailed',
      proactiveLevel: 5,
      
      urls: ['https://vertexlawgroup.example.com', 'https://vertexlawgroup.example.com/blog'],
      faqs: 'Q: How much does a consultation cost? A: First 30 minutes free for new clients.\nQ: What areas of law do you practice? A: Business, employment, contracts, compliance, and commercial disputes.\nQ: Do you offer fixed fees? A: Yes, for many services including audits, formations, and contract reviews.',
      competitorUrls: [],
      
      requiredDisclosures: 'Attorney-client privilege applies after engagement. Consultations are not legal advice until engagement letter signed. No guarantee of outcomes.',
      privacyCompliance: true,
      industryRegulations: 'State Bar rules of professional conduct, client confidentiality, conflicts of interest checks, trust accounting',
      prohibitedTopics: 'Cannot provide legal advice without engagement, no guarantees of case outcomes, no advice outside licensed jurisdictions',
    },
    products: [
      { name: 'Employment Law Audit', sku: 'SVC-EMP-AUDIT', description: 'Comprehensive review of employment practices, handbook, compliance', price: 2500, cost: 800, category: 'Fixed Fee Services', active: true, unit: 'each' },
      { name: 'Contract Review - Standard', sku: 'SVC-CONTRACT-STD', description: 'Review and markup of standard business contract (up to 10 pages)', price: 750, cost: 250, category: 'Fixed Fee Services', active: true, unit: 'each' },
      { name: 'Contract Review - Complex', sku: 'SVC-CONTRACT-CX', description: 'Complex contract review with negotiation support (10-30 pages)', price: 1850, cost: 620, category: 'Fixed Fee Services', active: true, unit: 'each' },
      { name: 'Business Formation - LLC', sku: 'SVC-BIZ-LLC', description: 'Form LLC, operating agreement, EIN, initial compliance setup', price: 1500, cost: 450, category: 'Fixed Fee Services', active: true, unit: 'each' },
      { name: 'Business Formation - Corp', sku: 'SVC-BIZ-CORP', description: 'Form Corporation, bylaws, stock, EIN, compliance setup', price: 2500, cost: 750, category: 'Fixed Fee Services', active: true, unit: 'each' },
      { name: 'Monthly Retainer - 5hrs', sku: 'SVC-RETAINER-5', description: '5 hours per month, $300/hr rate, general counsel support', price: 1500, cost: 450, category: 'Retainers', active: true, unit: 'month' },
      { name: 'Monthly Retainer - 10hrs', sku: 'SVC-RETAINER-10', description: '10 hours per month, $300/hr rate, priority support', price: 3000, cost: 900, category: 'Retainers', active: true, unit: 'month' },
      { name: 'Hourly - Associate', sku: 'SVC-HOURLY-ASSOC', description: 'Associate attorney hourly rate for projects', price: 250, cost: 75, category: 'Hourly Services', active: true, unit: 'hour' },
      { name: 'Hourly - Senior Attorney', sku: 'SVC-HOURLY-SNR', description: 'Senior attorney hourly rate', price: 350, cost: 105, category: 'Hourly Services', active: true, unit: 'hour' },
      { name: 'Hourly - Partner', sku: 'SVC-HOURLY-PRTNR', description: 'Partner hourly rate for complex matters', price: 450, cost: 135, category: 'Hourly Services', active: true, unit: 'hour' },
    ],
  },
];















