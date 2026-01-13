/**
 * Complete Test Organizations with Full Profiles
 *
 * These 5 test personas represent different industries and use cases:
 * 1. AuraFlow Analytics (SaaS/Analytics)
 * 2. GreenThumb Landscaping (Home Services)
 * 3. The Adventure Gear Shop (E-commerce/Retail)
 * 4. Summit Wealth Management (Finance)
 * 5. PixelPerfect Design Co. (Creative Agency)
 *
 * Each organization has:
 * - Complete onboarding data (all steps)
 * - Product/service catalogs
 * - Brand DNA configuration
 * - AI agent persona settings
 */

import type { Organization } from '@/types/organization';

export interface CompleteTestOrganization extends Organization {
  onboardingData: OnboardingData;
  products: Product[];
  testIndustry: string;
  workforceIdentity: WorkforceIdentity;
}

export interface WorkforceIdentity {
  workforceName: string;
  tagline: string;
  personalityArchetype: 'professional' | 'friendly' | 'consultative' | 'energetic' | 'calm';
  voiceEngine: 'native' | 'elevenlabs' | 'unreal';
  voiceId: string;
  avatarStyle: 'abstract' | 'human' | 'icon' | 'custom';
  primaryColor: string;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  proactivityLevel: number;
  empathyLevel: number;
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
  // 1. AURAFLOW ANALYTICS (SaaS/Analytics)
  {
    id: 'org_demo_auraflow',
    name: 'AuraFlow Analytics (TEST)',
    slug: 'auraflow',
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
    billingEmail: 'demo-auraflow@test.com',
    branding: {
      logo: '',
    },
    settings: {
      defaultTimezone: 'America/New_York',
      defaultCurrency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    createdAt: new Date('2024-01-15') as any,
    updatedAt: new Date() as any,
    createdBy: 'system',
    status: 'active',
    testIndustry: 'B2B SaaS - Business Analytics',
    workforceIdentity: {
      workforceName: 'Aurora',
      tagline: 'Transforming data into decisions',
      personalityArchetype: 'consultative',
      voiceEngine: 'elevenlabs',
      voiceId: 'rachel',
      avatarStyle: 'abstract',
      primaryColor: '#7c3aed',
      responseStyle: 'detailed',
      proactivityLevel: 7,
      empathyLevel: 6,
    },
    onboardingData: {
      businessName: 'AuraFlow Analytics',
      industry: 'B2B SaaS - Business Intelligence & Analytics',
      website: 'https://auraflow-analytics.example.com',
      faqPageUrl: 'https://auraflow-analytics.example.com/help',
      socialMediaUrls: ['https://linkedin.com/company/auraflow', 'https://twitter.com/auraflow'],
      companySize: '100-200 employees',

      problemSolved: 'We solve the problem of data silos and complex analytics by providing an AI-powered platform that connects to any data source and delivers actionable insights without requiring technical expertise.',
      uniqueValue: 'Unlike competitors, we offer predictive analytics with natural language queries, AI-powered anomaly detection, and industry-specific templates that get teams productive in hours.',
      whyBuy: 'Teams choose AuraFlow for ease of use, fast implementation (go-live in 1 week), lower total cost, and white-glove customer success support.',
      whyNotBuy: 'Companies with dedicated data science teams and custom infrastructure may prefer building in-house; very small businesses (<10 people) may find it overkill.',

      primaryOffering: 'AI-powered business intelligence platform with data integration, visualization, predictive analytics, and collaborative dashboards',
      priceRange: '$499/month (Growth) to $4,999/month (Enterprise), custom pricing for 500+ users',
      targetCustomer: 'Mid-market companies (50-500 employees), operations/analytics leaders frustrated with spreadsheets or expensive BI tools',
      customerDemographics: 'B2B companies in SaaS/tech/services, decision-makers are Directors/VPs of Operations, Analytics, or Finance',

      topProducts: '1. Growth Plan - $499/mo (10 users, 25 data sources, AI insights)\n2. Business - $1,499/mo (50 users, unlimited sources, advanced AI)\n3. Enterprise - $4,999/mo (unlimited users, white-label, API, dedicated CSM)\n4. Add-ons: Predictive Modeling ($799/mo), Custom Dashboards ($2,000 setup)',
      productComparison: 'vs Tableau: 60% lower cost, no IT required, natural language queries. vs PowerBI: Better AI capabilities, faster setup. vs Looker: No SQL needed, industry templates included.',
      seasonalOfferings: 'Q4: Year-end planning packages. Q1: New year growth bundles (3 months free with annual). Mid-year: ROI guarantee promotion.',
      whoShouldNotBuy: 'Companies needing real-time streaming analytics (<1 second latency), highly customized ML models, or on-premise only solutions.',

      pricingStrategy: 'Value-based tiering by user count and AI features. 50% below enterprise BI tools, positioned as "enterprise AI at mid-market prices"',
      discountPolicy: '25% off annual payment, 20% off first year for qualified startups, volume discounts at 50+ users',
      volumeDiscounts: '50-100 users: 15% off, 100-250 users: 25% off, 250+ custom pricing typically 35-40% off list',
      firstTimeBuyerIncentive: '14-day free trial + free onboarding ($2,000 value) + 30-day money-back guarantee',
      financingOptions: 'Annual payment plan (spread over 12 months), quarterly billing available for Enterprise',

      geographicCoverage: 'Global - cloud-based service, support in US, UK, EU time zones, data residency options (US, EU, APAC)',
      deliveryTimeframes: 'Instant access on signup, onboarding call within 24 hours, go-live typically 3-7 days',
      inventoryConstraints: 'No physical inventory, enterprise tier slots may have waiting list during high-demand periods',
      capacityLimitations: 'Free trials limited to 100 concurrent slots, enterprise onboarding capacity ~20 new customers/month',

      returnPolicy: '30-day money-back guarantee for annual plans, cancel monthly anytime',
      warrantyTerms: '99.9% uptime SLA (Enterprise), 24/7 support, data backup & recovery included',
      cancellationPolicy: 'Cancel anytime, no penalties. Export all data in standard formats. 30-day data retention after cancellation.',
      satisfactionGuarantee: 'If not satisfied in first 30 days, full refund + we help migrate to competitor at no charge',

      primaryObjective: 'lead-qualification',
      secondaryObjectives: ['demo-booking', 'sales', 'customer-education'],
      successMetrics: 'Demo booking rate >18%, demo-to-trial >65%, trial-to-paid >40%, qualified lead score >75',
      escalationRules: 'Escalate to sales for: 50+ users, enterprise features, custom requests, security/compliance questions, pricing negotiations',

      typicalSalesFlow: '1. Qualify company size & pain points\n2. Identify decision makers & timeline\n3. Book demo with solutions engineer\n4. Address technical/security questions\n5. Offer trial with success plan\n6. Follow up during trial\n7. Commercial terms discussion\n8. Close with annual discount',
      qualificationCriteria: 'Company size 20+ employees, budget authority or influence, active pain with current solution, timeline <90 days',
      discoveryQuestions: 'How many people need analytics access? What are your current tools? Biggest frustrations with data? Key metrics you track? Timeline for decision?',
      closingStrategy: 'ROI calculator showing time/cost savings, annual payment discount (25% off), limited onboarding slots, executive demo with leadership',

      commonObjections: 'Already using [competitor], need to see it work with our data, price concerns, change management risk',
      priceObjections: 'Show ROI calculation (saves 25+ hours/week), compare total cost vs Tableau/PowerBI, emphasize included onboarding/support, flexible payment terms',
      timeObjections: 'Highlight fast go-live (7 days), offer to start trial immediately, create urgency with limited onboarding slots',
      competitorObjections: 'Acknowledge strengths, differentiate on AI capabilities & speed to value, offer side-by-side trial, customer references in same industry',

      supportScope: 'Technical support, onboarding, training, data modeling help, integration assistance, AI model tuning',
      technicalSupport: '24/7 email/chat support, phone for Enterprise, dedicated success manager (Business+), quarterly business reviews (Enterprise)',
      orderTracking: 'Real-time account setup status, onboarding checklist, integration progress dashboard',
      complaintResolution: '<4 hour response SLA, escalation path to VP Customer Success, service credits for SLA breaches',

      tone: 'professional',
      agentName: 'Aurora',
      greeting: 'Hello! Welcome to AuraFlow Analytics. I help teams transform their data into actionable insights with AI. Are you currently struggling with disconnected data sources or spending too much time on manual reporting?',
      closingMessage: 'Thanks for your interest in AuraFlow! I\'ve sent the demo booking link and trial access to your email. Our team will reach out within 24 hours to help you get started. Looking forward to showing you what AI-powered analytics can do!',

      closingAggressiveness: 4,
      questionFrequency: 5,
      responseLength: 'detailed',
      proactiveLevel: 7,

      urls: ['https://auraflow-analytics.example.com', 'https://auraflow-analytics.example.com/case-studies'],
      faqs: 'Q: What data sources do you connect to? A: 300+ including Salesforce, HubSpot, Google Analytics, databases, spreadsheets, and custom APIs.\nQ: Do we need IT/developers? A: No, designed for business users with AI assistance.\nQ: How long is implementation? A: Most customers go-live in 3-7 days.',
      competitorUrls: ['https://tableau.com', 'https://powerbi.com'],

      requiredDisclosures: 'SOC 2 Type II certified, GDPR compliant, HIPAA available (Enterprise)',
      privacyCompliance: true,
      industryRegulations: 'SOC 2, GDPR, CCPA, HIPAA (Healthcare), PCI-DSS',
      prohibitedTopics: 'Cannot guarantee specific ROI numbers, cannot access customer data without permission',
    },
    products: [
      { name: 'Growth Plan', sku: 'PLAN-GROWTH-M', description: '10 users, 25 data sources, AI insights, email support', price: 499, cost: 120, category: 'Subscriptions', active: true, unit: 'month' },
      { name: 'Business Plan', sku: 'PLAN-BIZ-M', description: '50 users, unlimited sources, advanced AI, priority support', price: 1499, cost: 400, category: 'Subscriptions', active: true, unit: 'month' },
      { name: 'Enterprise Plan', sku: 'PLAN-ENT-M', description: 'Unlimited users, white-label, API, SSO, dedicated CSM', price: 4999, cost: 1400, category: 'Subscriptions', active: true, unit: 'month' },
      { name: 'Predictive Modeling Add-on', sku: 'ADDON-PRED-M', description: 'ML-powered forecasting, trend analysis, anomaly alerts', price: 799, cost: 200, category: 'Add-ons', active: true, unit: 'month' },
      { name: 'Custom Dashboard Setup', sku: 'SVC-DASH-SETUP', description: 'Professional services to build custom executive dashboards', price: 2000, cost: 600, category: 'Services', active: true, unit: 'each' },
      { name: 'Premium Training Package', sku: 'SVC-TRAINING', description: '8 hours of live training, certification program', price: 3500, cost: 1000, category: 'Services', active: true, unit: 'each' },
    ],
  },

  // 2. GREENTHUMB LANDSCAPING (Home Services)
  {
    id: 'org_demo_greenthumb',
    name: 'GreenThumb Landscaping (TEST)',
    slug: 'greenthumb',
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
    billingEmail: 'demo-greenthumb@test.com',
    branding: {
      logo: '',
    },
    settings: {
      defaultTimezone: 'America/Los_Angeles',
      defaultCurrency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    createdAt: new Date('2024-02-01') as any,
    updatedAt: new Date() as any,
    createdBy: 'system',
    status: 'active',
    testIndustry: 'Home Services - Landscaping',
    workforceIdentity: {
      workforceName: 'Sage',
      tagline: 'Your outdoor living expert',
      personalityArchetype: 'friendly',
      voiceEngine: 'native',
      voiceId: 'alloy',
      avatarStyle: 'icon',
      primaryColor: '#16a34a',
      responseStyle: 'balanced',
      proactivityLevel: 8,
      empathyLevel: 8,
    },
    onboardingData: {
      businessName: 'GreenThumb Landscaping',
      industry: 'Home Services - Landscaping & Outdoor Living',
      website: 'https://greenthumb-landscaping.example.com',
      faqPageUrl: 'https://greenthumb-landscaping.example.com/faqs',
      socialMediaUrls: ['https://instagram.com/greenthumb', 'https://facebook.com/greenthumblandscaping'],
      companySize: '15-30 employees',

      problemSolved: 'We transform ordinary backyards into stunning outdoor living spaces, solving the problem of homeowners who want beautiful landscapes but lack the time, expertise, or equipment to do it themselves.',
      uniqueValue: 'We offer 3D design previews, sustainable water-wise solutions, and a 2-year plant guarantee. Our crews are certified horticulturists, not just lawn guys.',
      whyBuy: 'Customers choose us for our design creativity, reliability (same crew every time), transparent pricing with no surprises, and our focus on sustainable practices.',
      whyNotBuy: 'DIY enthusiasts, those with very limited budgets, or properties requiring specialized engineering.',

      primaryOffering: 'Full-service landscaping including design, installation, maintenance, irrigation, hardscaping, and outdoor lighting',
      priceRange: '$150/visit maintenance to $75,000+ full landscape transformations. Average project: $8,000-$25,000',
      targetCustomer: 'Homeowners aged 35-65, household income $100k+, homes valued $400k+, value outdoor living',
      customerDemographics: 'Suburban homeowners, busy professionals, families who entertain outdoors, eco-conscious consumers',

      topProducts: '1. Full Landscape Design & Install ($15,000-$75,000)\n2. Weekly Maintenance Program ($150-$400/month)\n3. Irrigation Systems ($3,500-$12,000)\n4. Patio/Hardscape ($8,000-$35,000)\n5. Outdoor Lighting ($2,500-$8,000)',
      productComparison: 'vs competitors: We include 3D design (others charge extra), 2-year plant guarantee (industry standard is 90 days), certified crew (vs day laborers)',
      seasonalOfferings: 'Spring: Planting & renovation. Summer: Irrigation, lighting, outdoor kitchens. Fall: Tree planting, hardscape. Winter: Planning & design for spring',
      whoShouldNotBuy: 'Renters, homes requiring structural engineering, very small budgets (<$500), properties with severe drainage issues requiring civil engineering',

      pricingStrategy: 'Premium pricing reflecting quality - 15-25% above market average. Emphasize value, guarantee, and expertise.',
      discountPolicy: '5% off for cash payment, 10% off bundled services (design + install + maintenance), referral bonuses ($250 credit)',
      volumeDiscounts: 'HOA/property management: Custom pricing for multi-property contracts, typically 15-20% off retail',
      firstTimeBuyerIncentive: 'Free design consultation ($350 value), 10% off first maintenance month, free seasonal pruning (year 1)',
      financingOptions: 'Financing through GreenSky: 0% for 12 months on projects $5,000+, or low monthly payments for 60 months',

      geographicCoverage: 'San Francisco Bay Area: San Jose, Palo Alto, Mountain View, Los Altos, Saratoga, Cupertino, Sunnyvale',
      deliveryTimeframes: 'Design: 2-3 weeks. Small projects: 1-3 days. Large installs: 2-4 weeks. Maintenance: Next available slot within 1 week',
      inventoryConstraints: 'Some specialty plants require 2-4 week order lead time. Peak season (March-June) has limited crew availability.',
      capacityLimitations: 'Can handle 3-4 large installs simultaneously, 80+ maintenance accounts maximum, peak season books 4-6 weeks out',

      returnPolicy: 'Service satisfaction guaranteed - if not happy with any service, we return and fix at no charge',
      warrantyTerms: '2-year plant replacement guarantee (with maintenance contract), 5-year hardscape warranty, 10-year lighting warranty',
      cancellationPolicy: 'Maintenance: 30-day notice. Projects: Deposit non-refundable once materials ordered, but transferable to future work',
      satisfactionGuarantee: '100% satisfaction or we make it right - period. We\'ve been in business 15 years on our reputation.',

      primaryObjective: 'consultation-booking',
      secondaryObjectives: ['sales', 'lead-qualification', 'customer-education'],
      successMetrics: 'Consultation booking rate >30%, consultation-to-proposal >60%, proposal-to-close >45%',
      escalationRules: 'Escalate to owner for: Projects over $50k, warranty disputes, scheduling conflicts, complex technical requirements',

      typicalSalesFlow: '1. Understand the customer\'s vision and pain points\n2. Schedule free on-site consultation\n3. Present 3D design and detailed proposal\n4. Address questions and concerns\n5. Offer financing if needed\n6. Secure deposit and schedule work\n7. Project completion and walkthrough\n8. Discuss maintenance program',
      qualificationCriteria: 'Homeowner (not renter), property in service area, budget aligned with project scope, decision-maker engaged',
      discoveryQuestions: 'What\'s your vision for your outdoor space? How do you want to use it? Budget range? Timeline? Any water/drainage concerns? HOA restrictions?',
      closingStrategy: 'Seasonal urgency (book now for spring), limited crew availability, financing options, bundle discounts, referral incentives',

      commonObjections: 'Too expensive, need to talk to spouse, want multiple quotes, can wait until next season',
      priceObjections: 'Break down value (2-year guarantee, certified crew, included services), show financing options, emphasize long-term investment in home value',
      timeObjections: 'Offer to split project into phases, show calendar availability (slots fill fast), discuss off-season pricing benefits',
      competitorObjections: 'Ask about their guarantees, crew qualifications, design process - we typically win on value when apples-to-apples',

      supportScope: 'Project consultations, maintenance scheduling, plant care advice, warranty claims, payment questions',
      technicalSupport: 'Horticulturist on staff for plant selection, drainage specialist for complex jobs, lighting designer for custom installations',
      orderTracking: 'Project timeline shared at proposal, weekly updates during installation, photos at completion',
      complaintResolution: 'Owner personally handles all complaints, same-day response, on-site visit within 48 hours if needed',

      tone: 'warm',
      agentName: 'Sage',
      greeting: 'Hi there! Welcome to GreenThumb Landscaping. I\'m Sage, your outdoor living assistant. Whether you\'re dreaming of a backyard oasis or just need help keeping your lawn looking great, I\'m here to help. What brings you to us today?',
      closingMessage: 'Wonderful! I\'ve scheduled your free consultation. Our designer will call to confirm and get some initial details. We can\'t wait to help bring your outdoor vision to life! In the meantime, feel free to browse our portfolio on the website.',

      closingAggressiveness: 5,
      questionFrequency: 4,
      responseLength: 'balanced',
      proactiveLevel: 8,

      urls: ['https://greenthumb-landscaping.example.com', 'https://greenthumb-landscaping.example.com/portfolio'],
      faqs: 'Q: Do you do free estimates? A: Yes! Free on-site consultations for all landscape projects.\nQ: How long does a typical project take? A: 2-4 weeks for most installations.\nQ: Do you offer maintenance? A: Yes, weekly, bi-weekly, and monthly programs available.',
      competitorUrls: [],

      requiredDisclosures: 'Licensed contractor C-27. Pricing subject to site conditions. Some services require HOA approval.',
      privacyCompliance: true,
      industryRegulations: 'CA Contractor License C-27, EPA WaterSense partner, ISA Certified Arborists on staff',
      prohibitedTopics: 'Cannot provide advice on DIY chemical applications, structural engineering, or work outside service area',
    },
    products: [
      { name: 'Full Landscape Design & Install', sku: 'SVC-FULL-LAND', description: 'Complete backyard transformation with 3D design, plants, irrigation', price: 25000, cost: 15000, category: 'Installation', active: true, unit: 'each' },
      { name: 'Weekly Maintenance - Standard', sku: 'SVC-MAINT-WK', description: 'Weekly mowing, edging, blowing, weeding, seasonal adjustments', price: 250, cost: 140, category: 'Maintenance', active: true, unit: 'month' },
      { name: 'Weekly Maintenance - Premium', sku: 'SVC-MAINT-PREM', description: 'All standard plus fertilization, pest control, pruning, irrigation checks', price: 400, cost: 220, category: 'Maintenance', active: true, unit: 'month' },
      { name: 'Irrigation System Install', sku: 'SVC-IRRIG', description: 'Smart irrigation system with zones, rain sensor, WiFi controller', price: 6500, cost: 3800, category: 'Installation', active: true, unit: 'each' },
      { name: 'Paver Patio', sku: 'SVC-PATIO', description: 'Custom paver patio design and installation, drainage included', price: 18000, cost: 10500, category: 'Hardscape', active: true, unit: 'each' },
      { name: 'Outdoor Lighting Package', sku: 'SVC-LIGHTS', description: 'Path lights, uplighting, architectural lighting with smart controls', price: 4500, cost: 2400, category: 'Lighting', active: true, unit: 'each' },
      { name: 'Tree Planting (15 gal)', sku: 'SVC-TREE-15', description: 'Specimen tree planting with 2-year guarantee', price: 450, cost: 220, category: 'Plants', active: true, unit: 'each' },
      { name: 'Design Consultation', sku: 'SVC-DESIGN', description: '3D landscape design with plant selection and phasing plan', price: 850, cost: 350, category: 'Design', active: true, unit: 'each' },
    ],
  },

  // 3. THE ADVENTURE GEAR SHOP (E-commerce/Retail)
  {
    id: 'org_demo_adventuregear',
    name: 'The Adventure Gear Shop (TEST)',
    slug: 'adventuregear',
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
    billingEmail: 'demo-adventuregear@test.com',
    branding: {
      logo: '',
    },
    settings: {
      defaultTimezone: 'America/Denver',
      defaultCurrency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    createdAt: new Date('2024-01-20') as any,
    updatedAt: new Date() as any,
    createdBy: 'system',
    status: 'active',
    testIndustry: 'E-commerce - Outdoor Equipment',
    workforceIdentity: {
      workforceName: 'Trail Guide',
      tagline: 'Gear up for your next adventure',
      personalityArchetype: 'energetic',
      voiceEngine: 'native',
      voiceId: 'echo',
      avatarStyle: 'icon',
      primaryColor: '#ea580c',
      responseStyle: 'balanced',
      proactivityLevel: 8,
      empathyLevel: 7,
    },
    onboardingData: {
      businessName: 'The Adventure Gear Shop',
      industry: 'E-commerce - Outdoor & Adventure Equipment',
      website: 'https://adventuregear-shop.example.com',
      faqPageUrl: 'https://adventuregear-shop.example.com/faq',
      socialMediaUrls: ['https://instagram.com/adventuregearshop', 'https://youtube.com/adventuregearshop'],
      companySize: '20-35 employees',

      problemSolved: 'We provide expert-curated outdoor gear that helps adventurers explore safely and comfortably, solving the problem of finding reliable, durable equipment at fair prices without the overwhelm of mega-retailers.',
      uniqueValue: 'Every product is field-tested by our staff of actual outdoor enthusiasts. We offer lifetime repair service, gear rental program, and expert advice from people who actually use the gear.',
      whyBuy: 'Customers choose us for our 100% satisfaction guarantee, expert staff who live the outdoor lifestyle, commitment to sustainability, and curated selection (not everything, just the best).',
      whyNotBuy: 'Ultra-budget shoppers may find cheaper alternatives; those wanting fashion-first brands over performance.',

      primaryOffering: 'Premium outdoor equipment including camping gear, hiking equipment, climbing supplies, backpacking systems, and adventure clothing',
      priceRange: '$25 - $3,000 (most items $75-$500)',
      targetCustomer: 'Outdoor enthusiasts aged 25-55, income $75k+, weekend adventurers to serious mountaineers who value quality',
      customerDemographics: 'College-educated professionals, environmentally conscious, value quality over price, active lifestyle, Instagram-active',

      topProducts: '1. TrailMaster Backpack Series ($180-$380)\n2. Alpine Pro Tent Collection ($450-$1,400)\n3. SummitShield Jackets ($240-$500)\n4. PathFinder Hiking Boots ($170-$320)\n5. ClimbSafe Harness System ($130-$400)',
      productComparison: 'TrailMaster vs competitors: Lighter weight (-18%), more durable (tested to 12,000+ miles), better warranty (lifetime vs 1-3 years), and recycled materials',
      seasonalOfferings: 'Spring: Hiking & camping gear. Summer: Water sports & ultralight backpacking. Fall: Hunting & photography. Winter: Skiing, snowboarding & cold weather',
      whoShouldNotBuy: 'Casual once-a-year campers who just need basics, ultra-budget shoppers, those seeking trendy fashion items over performance',

      pricingStrategy: 'Premium positioning with fair pricing - 20-30% below luxury brands, 40-60% above budget options. Focus on value and durability.',
      discountPolicy: '10% off first purchase with email signup, seasonal sales (20-30% off select items), clearance on previous season (up to 50% off)',
      volumeDiscounts: 'Group/organization orders: 15% off $1,500+, 20% off $3,000+, custom pricing for $6,000+ (camps, outdoor programs)',
      firstTimeBuyerIncentive: '10% off first order + free shipping on orders $100+, plus free gear maintenance guide ebook',
      financingOptions: 'Affirm financing: 0% APR for purchases $500+ over 6 months, standard rates for 12+ months. PayPal Pay in 4 available.',

      geographicCoverage: 'Ship nationwide (USA), free shipping $100+, international to Canada & EU (additional fees). Store pickup: Denver, Boulder, Aspen',
      deliveryTimeframes: '2-5 business days standard (free $100+), next-day available for $25, store pickup same-day for in-stock items',
      inventoryConstraints: 'Popular sizes may sell out during peak season (spring/early summer), pre-order available for hot items',
      capacityLimitations: 'Custom gear orders take 3-4 weeks, high-demand periods may extend shipping 1-2 days',

      returnPolicy: '60-day return policy, full refund if unused with tags, used gear eligible for exchange or store credit (fair wear)',
      warrantyTerms: 'Lifetime warranty against manufacturing defects, free repairs for normal wear up to 5 years, repair service for any outdoor gear',
      cancellationPolicy: 'Cancel/modify orders within 24 hours of placing, free cancellation before shipping',
      satisfactionGuarantee: '100% satisfaction guarantee - if gear fails you on the trail, we make it right with repair, replacement or refund',

      primaryObjective: 'sales',
      secondaryObjectives: ['lead-qualification', 'product-recommendations', 'customer-education'],
      successMetrics: 'Conversion rate >8%, average order value $280+, customer satisfaction >4.7/5, repeat purchase rate >40%',
      escalationRules: 'Escalate warranty claims >$500, custom orders, wholesale inquiries, dissatisfied customers, product defect reports',

      typicalSalesFlow: '1. Welcome & identify adventure needs\n2. Ask about experience level and intended use\n3. Recommend 2-3 products matching needs\n4. Address concerns about price/quality\n5. Offer first-time discount\n6. Close with urgency (limited stock) or bundle suggestion',
      qualificationCriteria: 'Has specific outdoor activity in mind, budget >$100, timeline for purchase (trip coming up)',
      discoveryQuestions: 'What outdoor activities are you planning? Experience level? When is your trip? What gear do you already have? Budget range?',
      closingStrategy: 'Bundle suggestion (save 15% on kits), limited stock urgency, seasonal timing, first-timer discount, free shipping threshold',

      commonObjections: 'Price concerns, "I can find cheaper on Amazon", comparison to specific brands, need time to think',
      priceObjections: 'Emphasize quality & durability (costs less over time), lifetime warranty value, expert selection, rental program for expensive items',
      timeObjections: 'Offer to save cart for 24 hours, send comparison guide, highlight seasonal stock limitations, share customer reviews',
      competitorObjections: 'Acknowledge quality competitors, emphasize our testing process, warranty, and customer service, offer price match for identical items',

      supportScope: 'Product selection help, order tracking, returns/exchanges, warranty claims, gear maintenance advice, trip planning tips',
      technicalSupport: 'Expert staff for gear selection, sizing help, usage instructions, maintenance tutorials on YouTube channel',
      orderTracking: 'Automatic tracking emails, SMS notifications optional, real-time tracking on website, mobile app updates',
      complaintResolution: 'Same-day response, full refund/replacement for defective items, store credit for dissatisfaction plus 10% goodwill',

      tone: 'enthusiastic-professional',
      agentName: 'Trail Guide',
      greeting: 'Hey there, fellow adventurer! Welcome to The Adventure Gear Shop. Whether you\'re planning your first camping trip or prepping for your next alpine climb, I\'m here to help you find the perfect gear. What adventure are you gearing up for?',
      closingMessage: 'Awesome! Your gear is on its way - should arrive in 2-5 days. Need any last-minute trip advice or have questions about your gear? I\'m always here. Have an amazing adventure!',

      closingAggressiveness: 6,
      questionFrequency: 4,
      responseLength: 'balanced',
      proactiveLevel: 8,

      urls: ['https://adventuregear-shop.example.com', 'https://adventuregear-shop.example.com/gear-guides'],
      faqs: 'Q: Do you price match? A: Yes, we match legitimate competitor prices on identical items.\nQ: Can I rent gear? A: Yes, we rent tents, climbing gear, and backpacks at our store locations.\nQ: What\'s your return policy? A: 60 days, full refund if unused. Used gear can be exchanged.',
      competitorUrls: ['https://rei.com', 'https://backcountry.com'],

      requiredDisclosures: 'Some climbing/safety gear requires basic training. Financing subject to credit approval.',
      privacyCompliance: true,
      industryRegulations: 'Follow CPSIA for safety equipment, outdoor industry association standards',
      prohibitedTopics: 'Medical advice, guarantees about safety in dangerous conditions, modifications to safety equipment',
    },
    products: [
      { name: 'TrailMaster 65L Backpack', sku: 'TM-65-BLU', description: 'Professional-grade 65L backpack with ventilated back system and adjustable torso', price: 299.99, cost: 150, category: 'Backpacks', active: true, stock_quantity: 52, unit: 'each' },
      { name: 'Alpine Pro 3-Season Tent', sku: 'AP-3S-GRN', description: '2-person 3-season tent, 3.8lbs, waterproof to 3000mm, recycled materials', price: 479.99, cost: 225, category: 'Tents', active: true, stock_quantity: 34, unit: 'each' },
      { name: 'SummitShield Rain Jacket', sku: 'SS-RJ-BLK-L', description: 'Waterproof breathable shell with pit zips, adjustable hood, recycled fabric', price: 299.99, cost: 145, category: 'Jackets', active: true, stock_quantity: 78, unit: 'each' },
      { name: 'PathFinder Hiking Boots', sku: 'PF-HB-TAN-10', description: 'Full-grain leather hiking boots with Vibram soles and ankle support', price: 234.99, cost: 108, category: 'Footwear', active: true, stock_quantity: 41, unit: 'pair' },
      { name: 'ClimbSafe Pro Harness', sku: 'CS-PRO-BLK-M', description: 'UIAA certified climbing harness with 4 gear loops, adjustable legs, lightweight', price: 169.99, cost: 78, category: 'Climbing', active: true, stock_quantity: 62, unit: 'each' },
      { name: 'Summit Sleeping Bag 15F', sku: 'SUM-SB-15-BLU', description: 'Down-filled mummy bag rated to 15F, 2.4lbs, ethically sourced down', price: 349.99, cost: 168, category: 'Sleep Systems', active: true, stock_quantity: 48, unit: 'each' },
      { name: 'HydroFlow 3L Reservoir', sku: 'HF-3L-CLR', description: '3-liter hydration bladder with insulated hose, quick-disconnect, BPA-free', price: 44.99, cost: 19, category: 'Hydration', active: true, stock_quantity: 184, unit: 'each' },
      { name: 'TrekPole Carbon Fiber Set', sku: 'TP-CF-BLK', description: 'Ultra-light carbon fiber trekking poles with cork grips, pair, collapsible', price: 139.99, cost: 58, category: 'Accessories', active: true, stock_quantity: 96, unit: 'pair' },
    ],
  },

  // 4. SUMMIT WEALTH MANAGEMENT (Finance)
  {
    id: 'org_demo_summitwm',
    name: 'Summit Wealth Management (TEST)',
    slug: 'summitwm',
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
    billingEmail: 'demo-summitwm@test.com',
    branding: {
      logo: '',
    },
    settings: {
      defaultTimezone: 'America/New_York',
      defaultCurrency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    createdAt: new Date('2023-11-01') as any,
    updatedAt: new Date() as any,
    createdBy: 'system',
    status: 'active',
    testIndustry: 'Financial Services - Wealth Management',
    workforceIdentity: {
      workforceName: 'Summit Advisor',
      tagline: 'Building wealth, securing futures',
      personalityArchetype: 'professional',
      voiceEngine: 'elevenlabs',
      voiceId: 'adam',
      avatarStyle: 'human',
      primaryColor: '#0e7490',
      responseStyle: 'detailed',
      proactivityLevel: 5,
      empathyLevel: 8,
    },
    onboardingData: {
      businessName: 'Summit Wealth Management',
      industry: 'Financial Services - Wealth Management & Financial Planning',
      website: 'https://summit-wealth.example.com',
      faqPageUrl: 'https://summit-wealth.example.com/faq',
      socialMediaUrls: ['https://linkedin.com/company/summit-wealth'],
      companySize: '25-50 employees',

      problemSolved: 'We help high-net-worth individuals and families build, protect, and transfer wealth through comprehensive financial planning, investment management, and tax-efficient strategies.',
      uniqueValue: 'Fee-only fiduciary advisors, no commissions or hidden fees. Holistic planning that integrates investments, taxes, estate, insurance, and lifestyle goals. Team-based approach ensures continuity.',
      whyBuy: 'Clients choose us for transparency (fee-only), fiduciary obligation to act in their best interest, sophisticated tax planning, and multi-generational family wealth expertise.',
      whyNotBuy: 'Investors with less than $500k in investable assets, those who prefer self-directed investing, or those seeking active trading strategies.',

      primaryOffering: 'Comprehensive wealth management including financial planning, investment management, tax planning, estate planning coordination, and risk management',
      priceRange: '0.75%-1.25% of AUM annually (sliding scale), financial planning engagement starts at $5,000',
      targetCustomer: 'High-net-worth individuals/families with $500k+ investable assets, business owners, executives, retirees, inheritors',
      customerDemographics: 'Age 45-75, HHI $250k+, investable assets $500k-$10M, value professional advice, concerned about tax efficiency and wealth transfer',

      topProducts: '1. Comprehensive Wealth Management (0.75-1.25% AUM)\n2. Financial Planning Engagement ($5,000-$15,000)\n3. Retirement Income Planning ($7,500)\n4. Business Exit Planning ($10,000-$25,000)\n5. Estate Planning Coordination ($5,000)',
      productComparison: 'vs wirehouses: Lower fees, no conflicts, true fiduciary. vs robo-advisors: Human advice, tax planning, complex needs. vs DIY: Professional expertise, time savings, behavioral coaching.',
      seasonalOfferings: 'Q4: Year-end tax planning, Roth conversions, charitable giving. Q1: Tax-loss harvesting review, retirement contributions. Annual: Comprehensive reviews.',
      whoShouldNotBuy: 'Those with under $500k investable assets, day traders/speculators, those seeking guaranteed returns, those uncomfortable with market volatility.',

      pricingStrategy: 'AUM-based fees aligned with client success, transparent and all-inclusive. No commissions, no hidden fees.',
      discountPolicy: 'Fee breaks at $1M, $2.5M, $5M thresholds. Family discounts for multiple accounts. Preferred rates for client referrals.',
      volumeDiscounts: '$500k-$1M: 1.0% AUM, $1M-$2.5M: 0.90%, $2.5M-$5M: 0.85%, $5M+: 0.75%',
      firstTimeBuyerIncentive: 'Complimentary portfolio analysis ($1,500 value), first quarter waived for new wealth management clients',
      financingOptions: 'Fees can be deducted from managed accounts, quarterly or annual billing options',

      geographicCoverage: 'Serve clients nationwide via virtual meetings. Main offices: New York, Boston, Miami. In-person meetings available.',
      deliveryTimeframes: 'Initial consultation within 1 week, financial plan delivery 4-6 weeks, account transfers 1-2 weeks',
      inventoryConstraints: 'Accepting new clients - capacity for 15-20 new relationships per quarter',
      capacityLimitations: 'Each advisor manages 50-75 families maximum to ensure service quality',

      returnPolicy: 'Satisfaction guaranteed - if not satisfied in first 90 days, fees refunded',
      warrantyTerms: 'Fiduciary duty: We are legally bound to act in your best interest at all times',
      cancellationPolicy: 'No long-term contracts. Terminate at any time with no penalties. 30-day notice preferred.',
      satisfactionGuarantee: '90-day money-back guarantee. If our service doesn\'t meet your expectations, we refund our fees.',

      primaryObjective: 'consultation-booking',
      secondaryObjectives: ['lead-qualification', 'customer-education', 'trust-building'],
      successMetrics: 'Consultation booking rate >40%, consultation-to-proposal >70%, proposal-to-client >50%',
      escalationRules: 'Escalate to partner for: Assets over $5M, complex tax situations, business owners, family office needs, compliance questions',

      typicalSalesFlow: '1. Understand financial situation and goals\n2. Schedule discovery meeting\n3. Conduct comprehensive discovery (2 meetings)\n4. Present customized plan and recommendations\n5. Address questions and concerns\n6. Begin onboarding and implementation\n7. Quarterly review cadence',
      qualificationCriteria: 'Investable assets $500k+, seeking professional advice, values planning over just returns, comfortable with fee-based model',
      discoveryQuestions: 'Tell me about your current financial situation. What are your top financial concerns? When do you hope to retire? What legacy do you want to leave? Current advisor relationship?',
      closingStrategy: 'Emphasize fiduciary duty, comprehensive approach, team continuity, tax savings potential, peace of mind, referral confidence',

      commonObjections: 'Fees seem high, happy with current advisor, market timing concerns, can do it myself',
      priceObjections: 'Show total value (planning + tax savings + behavioral coaching typically > fees), compare to commission costs at wirehouses, emphasize fiduciary alignment',
      timeObjections: 'Offer phased engagement starting with planning, emphasize tax deadlines, show opportunity cost of delay, provide educational resources',
      competitorObjections: 'Ask about their fiduciary status, fee transparency, planning depth, service model - we often win on trust and comprehensiveness',

      supportScope: 'Financial planning, investment management, tax planning coordination, estate planning coordination, insurance review, retirement planning',
      technicalSupport: 'Client portal support, account access, document requests, transaction inquiries, beneficiary updates',
      orderTracking: 'Client portal shows account values, performance, planning progress. Quarterly reports delivered.',
      complaintResolution: 'Partner-level attention for any concerns, same-day acknowledgment, resolution within 1 week, CCO oversight',

      tone: 'professional',
      agentName: 'Summit Advisor',
      greeting: 'Welcome to Summit Wealth Management. I\'m here to help you take the first step toward financial clarity. Whether you\'re planning for retirement, managing a liquidity event, or simply want a second opinion on your finances, I can help connect you with the right advisor. How can I assist you today?',
      closingMessage: 'Thank you for considering Summit Wealth Management. I\'ve scheduled your complimentary consultation with one of our senior advisors. You\'ll receive a calendar invite shortly. Please don\'t hesitate to reach out if you have any questions before your meeting. We look forward to helping you on your financial journey.',

      closingAggressiveness: 3,
      questionFrequency: 5,
      responseLength: 'detailed',
      proactiveLevel: 5,

      urls: ['https://summit-wealth.example.com', 'https://summit-wealth.example.com/insights'],
      faqs: 'Q: What is your minimum? A: We typically work with clients who have $500,000 or more in investable assets.\nQ: Are you a fiduciary? A: Yes, we are fee-only fiduciary advisors.\nQ: How are you compensated? A: Solely through client fees, no commissions.',
      competitorUrls: [],

      requiredDisclosures: 'Summit Wealth Management is an SEC-registered investment advisor. Past performance does not guarantee future results. Please review our Form ADV Part 2A for important disclosures.',
      privacyCompliance: true,
      industryRegulations: 'SEC registered RIA, fiduciary standard, CFP Board standards, anti-money laundering compliance',
      prohibitedTopics: 'Cannot guarantee investment returns, cannot provide tax or legal advice (coordinate with professionals), cannot discuss specific securities as recommendations without suitability review',
    },
    products: [
      { name: 'Comprehensive Wealth Management', sku: 'SVC-WM-COMP', description: 'Full-service investment management and financial planning, AUM-based fee', price: 0, cost: 0, category: 'Wealth Management', active: true, unit: 'each' },
      { name: 'Financial Planning Engagement', sku: 'SVC-FP-STD', description: 'Comprehensive financial plan covering all areas, delivered over 4-6 weeks', price: 7500, cost: 2500, category: 'Planning', active: true, unit: 'each' },
      { name: 'Retirement Income Planning', sku: 'SVC-RET-INC', description: 'Detailed retirement income strategy with tax optimization and withdrawal planning', price: 7500, cost: 2200, category: 'Planning', active: true, unit: 'each' },
      { name: 'Business Exit Planning', sku: 'SVC-BIZ-EXIT', description: 'Comprehensive business succession and exit strategy planning', price: 15000, cost: 5000, category: 'Planning', active: true, unit: 'each' },
      { name: 'Estate Planning Coordination', sku: 'SVC-ESTATE', description: 'Estate plan review and coordination with attorneys, trust analysis', price: 5000, cost: 1500, category: 'Planning', active: true, unit: 'each' },
      { name: 'Investment Portfolio Analysis', sku: 'SVC-PORT-ANAL', description: 'One-time portfolio review with recommendations (credited if you become a client)', price: 1500, cost: 400, category: 'Analysis', active: true, unit: 'each' },
      { name: 'Tax Planning Strategy Session', sku: 'SVC-TAX-PLAN', description: 'Annual tax planning session with CPA coordination', price: 2500, cost: 800, category: 'Planning', active: true, unit: 'each' },
    ],
  },

  // 5. PIXELPERFECT DESIGN CO. (Creative Agency)
  {
    id: 'org_demo_pixelperfect',
    name: 'PixelPerfect Design Co. (TEST)',
    slug: 'pixelperfect',
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
    billingEmail: 'demo-pixelperfect@test.com',
    branding: {
      logo: '',
    },
    settings: {
      defaultTimezone: 'America/Los_Angeles',
      defaultCurrency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    createdAt: new Date('2024-03-01') as any,
    updatedAt: new Date() as any,
    createdBy: 'system',
    status: 'active',
    testIndustry: 'Creative Services - Design Agency',
    workforceIdentity: {
      workforceName: 'Pixel',
      tagline: 'Where creativity meets strategy',
      personalityArchetype: 'friendly',
      voiceEngine: 'native',
      voiceId: 'nova',
      avatarStyle: 'abstract',
      primaryColor: '#ec4899',
      responseStyle: 'balanced',
      proactivityLevel: 7,
      empathyLevel: 9,
    },
    onboardingData: {
      businessName: 'PixelPerfect Design Co.',
      industry: 'Creative Services - Branding, Web Design & Digital Marketing',
      website: 'https://pixelperfect-design.example.com',
      faqPageUrl: 'https://pixelperfect-design.example.com/faq',
      socialMediaUrls: ['https://instagram.com/pixelperfectco', 'https://dribbble.com/pixelperfect', 'https://behance.net/pixelperfect'],
      companySize: '10-20 employees',

      problemSolved: 'We help growing businesses build memorable brands and digital experiences that convert. We solve the problem of companies who know they need better design but don\'t know where to start or can\'t afford a full-time creative team.',
      uniqueValue: 'We combine strategy with creativity - every design decision is backed by research and tied to business outcomes. We\'re not just making things pretty, we\'re driving results.',
      whyBuy: 'Clients choose us for our strategic approach, collaborative process (you\'re involved but not overwhelmed), fast turnaround, and our ability to translate business goals into visual stories.',
      whyNotBuy: 'Ultra-budget projects (<$5k), companies wanting to own all source files immediately, those needing same-day delivery on complex work.',

      primaryOffering: 'Full-service brand and digital design including brand identity, website design & development, digital marketing assets, and packaging design',
      priceRange: '$5,000 - $75,000 per project. Logo: $3,500-$8,000. Website: $10,000-$50,000. Full rebrand: $25,000-$75,000',
      targetCustomer: 'Growing businesses ($1M-$50M revenue), startups with funding, established companies refreshing their brand, marketing managers needing agency support',
      customerDemographics: 'B2B and B2C, tech startups, professional services, consumer brands, marketing/brand managers, founders, CEOs of SMBs',

      topProducts: '1. Brand Identity Package ($8,000-$25,000)\n2. Website Design & Development ($15,000-$50,000)\n3. Logo Design ($3,500-$8,000)\n4. Marketing Collateral Suite ($5,000-$15,000)\n5. Packaging Design ($6,000-$20,000)',
      productComparison: 'vs freelancers: More reliable, strategic thinking, broader capabilities. vs big agencies: More agile, better value, more senior attention. vs DIY: Professional quality, time savings.',
      seasonalOfferings: 'Q4: End-of-year website launches, annual report design. Q1: New brand launches, marketing refresh. Ongoing: Campaign support, content creation.',
      whoShouldNotBuy: 'Companies with budgets under $5,000, those wanting only one-off small tasks, anyone needing work completed in less than 1 week.',

      pricingStrategy: 'Project-based pricing aligned with scope and value delivered. Transparent pricing shared upfront after discovery.',
      discountPolicy: '10% off for project bundles (brand + website), referral bonus ($500 credit), non-profit discount 15%',
      volumeDiscounts: 'Retainer clients: 10% off hourly rates. Multi-project contracts: 15% off second project, 20% off third.',
      firstTimeBuyerIncentive: 'Free brand audit ($1,500 value) with any project engagement, complimentary brand strategy session',
      financingOptions: 'Payment plans available: 50% upfront, 25% at midpoint, 25% at completion. Monthly retainers for ongoing work.',

      geographicCoverage: 'Serve clients globally via virtual collaboration. Based in Los Angeles. On-site meetings available for LA-area clients.',
      deliveryTimeframes: 'Logo: 3-4 weeks. Website: 8-12 weeks. Full brand identity: 6-8 weeks. Rush available for 25% premium.',
      inventoryConstraints: 'N/A - service-based business. Limited by team capacity.',
      capacityLimitations: 'Can manage 4-6 major projects simultaneously. Wait time of 2-4 weeks to start during busy periods.',

      returnPolicy: 'Unlimited revisions within project scope. If not satisfied after revisions, we work until you are or refund the last milestone payment.',
      warrantyTerms: 'Web development: 60-day bug fix warranty. Files delivered in standard formats with style guide. Training included.',
      cancellationPolicy: 'Cancel before work begins: Full refund minus 10% planning fee. During project: Pay for completed work.',
      satisfactionGuarantee: 'We don\'t consider a project done until you\'re thrilled. Unlimited revisions within scope. Reference portfolio shows our quality standard.',

      primaryObjective: 'consultation-booking',
      secondaryObjectives: ['lead-qualification', 'portfolio-showcase', 'customer-education'],
      successMetrics: 'Consultation booking rate >35%, consultation-to-proposal >65%, proposal-to-close >45%',
      escalationRules: 'Escalate to creative director for: Projects over $40k, scope changes, timeline concerns, design disputes, strategic questions',

      typicalSalesFlow: '1. Understand business goals and design needs\n2. Schedule discovery call\n3. Review portfolio and case studies together\n4. Present custom proposal with options\n5. Refine scope based on feedback\n6. Sign agreement and schedule kickoff\n7. Begin with brand strategy workshop',
      qualificationCriteria: 'Budget aligned with scope ($5k+ minimum), clear business objectives, decision-maker engaged, realistic timeline (4+ weeks)',
      discoveryQuestions: 'Tell me about your business and where you\'re headed. What\'s driving the need for design work now? What does success look like? Budget range? Timeline?',
      closingStrategy: 'Show relevant case studies, emphasize ROI from design investment, offer phased approach if budget is tight, highlight process and collaboration',

      commonObjections: 'Too expensive, can find cheaper designers, need it faster, not sure of ROI, need to involve more stakeholders',
      priceObjections: 'Show ROI from case studies, break down deliverables and value, offer phased approach, compare to cost of hiring full-time, emphasize quality = brand perception',
      timeObjections: 'Explain that great design takes time, offer rush pricing, suggest phased delivery, show risks of rushing brand work',
      competitorObjections: 'Ask about their experience, portfolio depth, process - we differentiate on strategy + execution combination and senior attention',

      supportScope: 'Project consultations, design inquiries, asset requests, strategy questions, implementation support',
      technicalSupport: 'Website support included for 60 days post-launch, file format assistance, print production guidance',
      orderTracking: 'Client portal shows project timeline, milestones, deliverables, and comments. Weekly update emails.',
      complaintResolution: 'Creative director personally addresses concerns, revision meetings within 48 hours, scope adjustments as needed',

      tone: 'friendly',
      agentName: 'Pixel',
      greeting: 'Hey there! Welcome to PixelPerfect Design Co. I\'m Pixel, your creative guide. Whether you\'re looking to launch a new brand, refresh your website, or create marketing that actually converts, I\'d love to learn more about what you\'re working on. What brings you here today?',
      closingMessage: 'Amazing! I\'ve scheduled your discovery call with our creative team. You\'ll receive a calendar invite shortly along with a quick questionnaire to help us prepare. In the meantime, feel free to browse our portfolio for inspiration. Can\'t wait to learn more about your project!',

      closingAggressiveness: 4,
      questionFrequency: 4,
      responseLength: 'balanced',
      proactiveLevel: 7,

      urls: ['https://pixelperfect-design.example.com', 'https://pixelperfect-design.example.com/portfolio'],
      faqs: 'Q: How long does a typical project take? A: Logo: 3-4 weeks. Website: 8-12 weeks. Full brand: 6-8 weeks.\nQ: What\'s your minimum project size? A: We typically work on projects starting at $5,000.\nQ: Do you offer ongoing support? A: Yes! We offer retainer packages for ongoing design needs.',
      competitorUrls: [],

      requiredDisclosures: 'Pricing estimates subject to scope confirmation. Timeline begins after signed agreement and deposit. Source files included with final delivery.',
      privacyCompliance: true,
      industryRegulations: 'AIGA professional standards, ADA compliance for web projects, GDPR compliance for European clients',
      prohibitedTopics: 'Cannot guarantee specific business outcomes from design, cannot commit to timelines without scope review, cannot provide legal advice on trademarks',
    },
    products: [
      { name: 'Brand Identity Package', sku: 'SVC-BRAND-PKG', description: 'Logo, color palette, typography, brand guidelines, collateral templates', price: 15000, cost: 6000, category: 'Branding', active: true, unit: 'each' },
      { name: 'Website Design & Development', sku: 'SVC-WEB-FULL', description: 'Custom website design, development, CMS integration, mobile responsive', price: 25000, cost: 10000, category: 'Web', active: true, unit: 'each' },
      { name: 'Logo Design', sku: 'SVC-LOGO', description: 'Custom logo design with concepts, revisions, and final files', price: 5000, cost: 1800, category: 'Branding', active: true, unit: 'each' },
      { name: 'Marketing Collateral Suite', sku: 'SVC-COLLATERAL', description: 'Business cards, brochure, presentation template, social templates', price: 8000, cost: 3200, category: 'Marketing', active: true, unit: 'each' },
      { name: 'Packaging Design', sku: 'SVC-PACKAGING', description: 'Product packaging design with print-ready files', price: 10000, cost: 4000, category: 'Packaging', active: true, unit: 'each' },
      { name: 'Monthly Design Retainer', sku: 'SVC-RETAINER-20', description: '20 hours of design work per month, priority support', price: 4000, cost: 1600, category: 'Retainer', active: true, unit: 'month' },
      { name: 'Brand Strategy Workshop', sku: 'SVC-BRAND-STRAT', description: 'Half-day brand strategy session with positioning and messaging', price: 3500, cost: 1200, category: 'Strategy', active: true, unit: 'each' },
      { name: 'Social Media Design Package', sku: 'SVC-SOCIAL-PKG', description: 'Profile graphics, cover images, post templates for all platforms', price: 3000, cost: 1100, category: 'Marketing', active: true, unit: 'each' },
    ],
  },
];

export default MOCK_TEST_ORGANIZATIONS;
