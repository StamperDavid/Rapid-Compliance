/**
 * Industry-Specific Injection Questions (Step 1.5)
 * 
 * After selecting industry, show ONE dynamic question that extracts
 * the highest-leverage data point to make the template truly specialist.
 * 
 * These map to template variables and complete the 100% expert agent.
 */

export interface IndustryInjectionQuestion {
  industryId: string;
  question: string;
  variable: string;
  placeholder: string;
  helpText?: string;
  fieldType: 'text' | 'textarea' | 'select' | 'multiselect';
  options?: string[];
}

/**
 * THE 50 INDUSTRY INJECTION QUESTIONS
 */
export const INDUSTRY_INJECTION_QUESTIONS: Record<string, IndustryInjectionQuestion> = {
  
  // ============================================
  // REAL ESTATE SECTOR (1-10)
  // ============================================
  
  'residential-real-estate': {
    industryId: 'residential-real-estate',
    question: 'What neighborhoods or zip codes do you specialize in?',
    variable: 'service_area',
    placeholder: 'e.g., "Downtown Historic District, Waterfront properties, School District 5"',
    helpText: 'This helps the agent establish hyper-local authority',
    fieldType: 'textarea'
  },
  
  'commercial-real-estate': {
    industryId: 'commercial-real-estate',
    question: 'What asset class do you specialize in?',
    variable: 'asset_class',
    placeholder: 'e.g., "Industrial Warehouses", "Medical Office Buildings", "Multi-family"',
    helpText: 'Focuses the agent on your specific property type expertise',
    fieldType: 'select',
    options: ['Industrial', 'Multi-family', 'Retail', 'Office', 'Medical Office', 'Mixed-Use', 'Land Development']
  },
  
  'property-management': {
    industryId: 'property-management',
    question: 'What is your typical management fee structure?',
    variable: 'fee_structure',
    placeholder: 'e.g., "8% of monthly rent" or "Flat $150/month per unit"',
    helpText: 'Allows agent to provide accurate pricing discussions',
    fieldType: 'text'
  },
  
  'short-term-rentals': {
    industryId: 'short-term-rentals',
    question: 'What is your average nightly rate and occupancy rate?',
    variable: 'revenue_metrics',
    placeholder: 'e.g., "$250/night, 70% occupancy"',
    helpText: 'Enables revenue projection conversations',
    fieldType: 'text'
  },
  
  'mortgage-lending': {
    industryId: 'mortgage-lending',
    question: 'What loan products do you specialize in?',
    variable: 'loan_products',
    placeholder: 'e.g., "FHA, VA, Jumbo, Refinance"',
    fieldType: 'multiselect',
    options: ['Conventional', 'FHA', 'VA', 'USDA', 'Jumbo', 'Refinance', 'Home Equity', 'Reverse Mortgage']
  },
  
  'home-staging': {
    industryId: 'home-staging',
    question: 'What is your average "Days on Market" reduction after staging?',
    variable: 'staging_impact',
    placeholder: 'e.g., "Properties sell 45% faster with our staging"',
    helpText: 'ROI metric for convincing sellers',
    fieldType: 'text'
  },
  
  'interior-design': {
    industryId: 'interior-design',
    question: 'What is your design aesthetic or signature style?',
    variable: 'design_signature',
    placeholder: 'e.g., "Modern Coastal", "Industrial Chic", "Warm Minimalist"',
    fieldType: 'text'
  },
  
  'architecture': {
    industryId: 'architecture',
    question: 'What types of projects do you specialize in?',
    variable: 'project_specialty',
    placeholder: 'e.g., "Custom Residential", "Commercial Adaptive Reuse", "Sustainable Design"',
    fieldType: 'text'
  },
  
  'construction-development': {
    industryId: 'construction-development',
    question: 'Do you offer fixed-price contracts or cost-plus pricing?',
    variable: 'pricing_model',
    placeholder: 'Select your primary pricing approach',
    fieldType: 'select',
    options: ['Fixed-Price', 'Cost-Plus', 'Both (Project-Dependent)', 'Time & Materials']
  },
  
  'title-escrow': {
    industryId: 'title-escrow',
    question: 'What is your average closing turnaround time?',
    variable: 'turnaround_time',
    placeholder: 'e.g., "7-10 business days for cash, 30 days for financed"',
    fieldType: 'text'
  },
  
  // ============================================
  // HEALTHCARE & WELLNESS SECTOR (11-20)
  // ============================================
  
  'dental-practices': {
    industryId: 'dental-practices',
    question: 'Do you offer "Gentle-Touch" or sedation options for nervous patients?',
    variable: 'comfort_features',
    placeholder: 'e.g., "Nitrous oxide, oral sedation, TV, heated blankets"',
    helpText: 'Critical for reducing dental anxiety',
    fieldType: 'textarea'
  },
  
  'plastic-surgery': {
    industryId: 'plastic-surgery',
    question: 'What is your most requested procedure?',
    variable: 'specialty',
    placeholder: 'e.g., "Rhinoplasty", "Breast Augmentation", "Mommy Makeover"',
    fieldType: 'text'
  },
  
  'med-spas-aesthetics': {
    industryId: 'med-spas-aesthetics',
    question: 'Do you have a monthly membership or "Bank Your Botox" loyalty program?',
    variable: 'loyalty_program',
    placeholder: 'e.g., "Yes - monthly membership with rollover credits"',
    fieldType: 'text'
  },
  
  'mental-health-therapy': {
    industryId: 'mental-health-therapy',
    question: 'What therapeutic modalities do you use?',
    variable: 'modality',
    placeholder: 'e.g., "CBT, EMDR, Gottman Method, IFS"',
    fieldType: 'multiselect',
    options: ['CBT', 'DBT', 'EMDR', 'Psychodynamic', 'Gottman Method', 'IFS', 'ACT', 'Somatic', 'Art Therapy']
  },
  
  'gyms-crossfit': {
    industryId: 'gyms-crossfit',
    question: 'Describe your "Intro Offer"',
    variable: 'intro_offer',
    placeholder: 'e.g., "Free Week Trial", "$19 First Month", "3 Free Classes"',
    fieldType: 'text'
  },
  
  'yoga-pilates': {
    industryId: 'yoga-pilates',
    question: 'Is your studio focused on athletic intensity or restorative mindfulness?',
    variable: 'studio_vibe',
    placeholder: 'Select your primary focus',
    fieldType: 'select',
    options: ['Athletic/Intense (Power Yoga, Advanced)', 'Balanced (Mix of styles)', 'Restorative/Mindful (Gentle, Yin)', 'Therapeutic/Injury Recovery']
  },
  
  'chiropractic': {
    industryId: 'chiropractic',
    question: 'Do you specialize in sports injury, prenatal care, or general wellness?',
    variable: 'clinical_focus',
    placeholder: 'Select your primary specialization',
    fieldType: 'select',
    options: ['Sports Injury', 'Prenatal/Pediatric', 'General Wellness', 'Auto Accident Injury', 'Corporate Wellness']
  },
  
  'personal-training': {
    industryId: 'personal-training',
    question: 'Do you provide 1:1 in-person, small group, or hybrid online coaching?',
    variable: 'delivery_model',
    placeholder: 'Select your primary delivery method',
    fieldType: 'select',
    options: ['1:1 In-Person', 'Small Group (2-5)', 'Online/Virtual Only', 'Hybrid (In-Person + Online)']
  },
  
  'nutritional-coaching': {
    industryId: 'nutritional-coaching',
    question: 'Do you focus on weight loss, athletic performance, or gut health?',
    variable: 'core_pain_point',
    placeholder: 'Select your primary focus area',
    fieldType: 'select',
    options: ['Weight Loss', 'Athletic Performance', 'Gut Health', 'Medical Nutrition (Diabetes, etc.)', 'General Wellness']
  },
  
  'veterinary-practices': {
    industryId: 'veterinary-practices',
    question: 'Do you handle emergency walk-ins or are you appointment-only?',
    variable: 'access_level',
    placeholder: 'Select your service model',
    fieldType: 'select',
    options: ['Emergency Walk-Ins Accepted', 'Appointment Only', 'Emergency After-Hours Available', '24/7 Emergency Hospital']
  },
  
  // ============================================
  // TECHNOLOGY & BUSINESS SERVICES (21-30)
  // ============================================
  
  'saas-software': {
    industryId: 'saas-software',
    question: 'What is the #1 software integration your users ask for?',
    variable: 'key_integration',
    placeholder: 'e.g., "Zapier", "Salesforce", "Slack", "Google Workspace"',
    helpText: 'Helps agent proactively address integration questions',
    fieldType: 'text'
  },
  
  'cybersecurity': {
    industryId: 'cybersecurity',
    question: 'Which compliance standard is your specialty?',
    variable: 'compliance_spec',
    placeholder: 'Select your primary compliance focus',
    fieldType: 'select',
    options: ['SOC 2', 'HIPAA', 'GDPR', 'ISO 27001', 'PCI-DSS', 'FedRAMP', 'NIST']
  },
  
  'digital-marketing': {
    industryId: 'digital-marketing',
    question: 'What is your primary "Growth Lever"?',
    variable: 'growth_lever',
    placeholder: 'Select your core service',
    fieldType: 'select',
    options: ['SEO', 'Paid Ads (Google/Meta)', 'Social Media Marketing', 'Content Marketing', 'Email Marketing', 'Full-Funnel Strategy']
  },
  
  'recruitment-hr': {
    industryId: 'recruitment-hr',
    question: 'Do you specialize in C-Suite/Executive or High-Volume Staffing?',
    variable: 'candidate_tier',
    placeholder: 'Select your placement specialty',
    fieldType: 'select',
    options: ['C-Suite/Executive', 'Director/Manager Level', 'High-Volume/Hourly', 'Technical/Engineering', 'Healthcare Staffing']
  },
  
  'logistics-freight': {
    industryId: 'logistics-freight',
    question: 'What is your primary lane or specialty?',
    variable: 'shipping_specialty',
    placeholder: 'e.g., "LTL", "Full Truckload", "Reefer", "Ocean Freight"',
    fieldType: 'select',
    options: ['LTL (Less Than Truckload)', 'Full Truckload', 'Reefer (Refrigerated)', 'Flatbed', 'Ocean Freight', 'Air Freight', 'Last-Mile Delivery']
  },
  
  'fintech': {
    industryId: 'fintech',
    question: 'How much faster/cheaper is your process vs. traditional banks?',
    variable: 'disruption_metric',
    placeholder: 'e.g., "Transfers in 30 seconds vs 3 days, 75% lower fees"',
    helpText: 'Key differentiator for fintech positioning',
    fieldType: 'text'
  },
  
  'managed-it-msp': {
    industryId: 'managed-it-msp',
    question: 'What is your guaranteed "Response Time" in your SLA?',
    variable: 'sla_guarantee',
    placeholder: 'e.g., "Critical issues: 15 minutes, Standard: 2 hours"',
    fieldType: 'text'
  },
  
  'edtech': {
    industryId: 'edtech',
    question: 'Is your platform for K-12, Higher Ed, or Corporate Training?',
    variable: 'academic_tier',
    placeholder: 'Select your primary market',
    fieldType: 'select',
    options: ['K-12 Education', 'Higher Education', 'Corporate Training', 'Professional Development', 'Skills Training/Bootcamps']
  },
  
  'ecommerce-d2c': {
    industryId: 'ecommerce-d2c',
    question: 'What is your current bestseller and its main benefit?',
    variable: 'hero_product',
    placeholder: 'e.g., "Organic Face Serum - reduces wrinkles in 30 days"',
    helpText: 'Agent will prioritize recommending this product',
    fieldType: 'text'
  },
  
  'biotech': {
    industryId: 'biotech',
    question: 'What phase of clinical trials or R&D are you currently in?',
    variable: 'development_phase',
    placeholder: 'e.g., "Phase II Clinical Trials", "Pre-clinical R&D", "Commercialization"',
    fieldType: 'select',
    options: ['Discovery/Research', 'Pre-clinical', 'Phase I Clinical', 'Phase II Clinical', 'Phase III Clinical', 'FDA Review', 'Commercialization']
  },
  
  // ============================================
  // HOME SERVICES SECTOR (31-40)
  // ============================================
  
  'solar-energy': {
    industryId: 'solar-energy',
    question: 'What is the average "Payback Period" (years) for your customers?',
    variable: 'payback_period',
    placeholder: 'e.g., "6-8 years with federal tax credit"',
    helpText: 'Key ROI metric for solar sales',
    fieldType: 'text'
  },
  
  'hvac': {
    industryId: 'hvac',
    question: 'Do you offer 24/7 emergency repair or just standard installations?',
    variable: 'service_speed',
    placeholder: 'Select your service model',
    fieldType: 'select',
    options: ['24/7 Emergency Repair', 'Same-Day Emergency (Business Hours)', 'Scheduled Service Only', 'Installation Only']
  },
  
  'roofing': {
    industryId: 'roofing',
    question: 'Do you help homeowners manage the insurance claim process?',
    variable: 'claim_support',
    placeholder: 'Select your level of insurance assistance',
    fieldType: 'select',
    options: ['Yes - Full Claims Management', 'Yes - Documentation Assistance', 'Referral to Public Adjuster', 'No Insurance Services']
  },
  
  'landscaping-hardscaping': {
    industryId: 'landscaping-hardscaping',
    question: 'Do you specialize in maintenance or high-end "Hardscape" design?',
    variable: 'design_focus',
    placeholder: 'Select your primary service focus',
    fieldType: 'select',
    options: ['High-End Hardscape Design', 'Landscape Design & Installation', 'Maintenance & Care', 'Full-Service (Design + Maintenance)']
  },
  
  'plumbing': {
    industryId: 'plumbing',
    question: 'What is your flat-rate "Trip Fee" for a diagnostic visit?',
    variable: 'diagnostic_fee',
    placeholder: 'e.g., "$89 diagnostic fee (waived if you hire us)"',
    helpText: 'Transparent pricing builds trust',
    fieldType: 'text'
  },
  
  'pest-control': {
    industryId: 'pest-control',
    question: 'Are your treatments pet-safe and eco-friendly?',
    variable: 'safety_standard',
    placeholder: 'Select your treatment approach',
    fieldType: 'select',
    options: ['Eco-Friendly & Pet-Safe (Primary)', 'Traditional Chemicals (Most Effective)', 'Both Available (Client Choice)', 'Organic Certified']
  },
  
  'house-cleaning': {
    industryId: 'house-cleaning',
    question: 'Do you provide your own supplies or use the client\'s?',
    variable: 'supply_policy',
    placeholder: 'Select your policy',
    fieldType: 'select',
    options: ['We Provide All Supplies', 'Client Provides Supplies', 'Flexible (Client Choice)', 'We Provide, Client Supplements']
  },
  
  'pool-maintenance': {
    industryId: 'pool-maintenance',
    question: 'Do you offer "Green-to-Clean" pool recovery or just weekly maintenance?',
    variable: 'service_depth',
    placeholder: 'Select services offered',
    fieldType: 'select',
    options: ['Weekly Maintenance Only', 'Maintenance + Green Recovery', 'Full Service (Maintenance, Repair, Recovery)', 'One-Time Services']
  },
  
  'electrical-services': {
    industryId: 'electrical-services',
    question: 'Are you certified for EV Charger or Solar Panel installations?',
    variable: 'special_certs',
    placeholder: 'Select your specialized certifications',
    fieldType: 'multiselect',
    options: ['EV Charger Installation', 'Solar Panel Installation', 'Generator Installation', 'Smart Home Wiring', 'Commercial Electrical', 'Standard Residential Only']
  },
  
  'home-security': {
    industryId: 'home-security',
    question: 'Is your monitoring local/human-led or purely automated app-based?',
    variable: 'monitoring_type',
    placeholder: 'Select your monitoring model',
    fieldType: 'select',
    options: ['24/7 Human Monitoring (Local)', '24/7 Professional Monitoring', 'Self-Monitored (App-Based)', 'Hybrid (Professional + Self)']
  },
  
  // ============================================
  // PROFESSIONAL SERVICES & SPECIALTY (41-50)
  // ============================================
  
  'law-personal-injury': {
    industryId: 'law-personal-injury',
    question: 'What is the largest settlement you\'ve won for a client?',
    variable: 'authority_stat',
    placeholder: 'e.g., "$2.3M for car accident victim" (use if comfortable sharing)',
    helpText: 'Establishes credibility and track record',
    fieldType: 'text'
  },
  
  'family-law': {
    industryId: 'family-law',
    question: 'Do you prioritize mediation/collaboration or litigation?',
    variable: 'legal_approach',
    placeholder: 'Select your primary approach',
    fieldType: 'select',
    options: ['Mediation-First (Collaborative)', 'Litigation-Ready (Aggressive)', 'Balanced (Case-Dependent)', 'Collaborative Law Specialist']
  },
  
  'accounting-tax': {
    industryId: 'accounting-tax',
    question: 'Do you focus on monthly bookkeeping or year-end high-level tax strategy?',
    variable: 'service_cadence',
    placeholder: 'Select your primary service model',
    fieldType: 'select',
    options: ['Monthly Bookkeeping', 'Year-End Tax Prep Only', 'Full-Service (Bookkeeping + Tax)', 'CFO-Level Strategy', 'Audit & Compliance']
  },
  
  'financial-planning': {
    industryId: 'financial-planning',
    question: 'What is your "Minimum Investable Assets" for new clients?',
    variable: 'client_tier',
    placeholder: 'e.g., "$250,000", "No minimum", "$1M+"',
    helpText: 'Helps qualify leads appropriately',
    fieldType: 'text'
  },
  
  'insurance-agency': {
    industryId: 'insurance-agency',
    question: 'Which carriers do you write for - are you Direct or Broker/Multi-carrier?',
    variable: 'carrier_access',
    placeholder: 'Select your agency type',
    fieldType: 'select',
    options: ['Single Carrier (Captive Agent)', 'Multi-Carrier Broker (Independent)', 'MGA (Managing General Agent)', 'Direct-to-Consumer']
  },
  
  'business-coaching': {
    industryId: 'business-coaching',
    question: 'What is the #1 framework you teach?',
    variable: 'methodology',
    placeholder: 'e.g., "EOS (Entrepreneurial Operating System)", "Scaling Up", "StoryBrand"',
    fieldType: 'text'
  },
  
  'travel-concierge': {
    industryId: 'travel-concierge',
    question: 'Do you have "Hidden" perks like Virtuoso or Four Seasons Preferred Partner?',
    variable: 'exclusive_perks',
    placeholder: 'e.g., "Virtuoso member - free breakfast, room upgrades, resort credits"',
    helpText: 'Luxury differentiator',
    fieldType: 'text'
  },
  
  'event-planning': {
    industryId: 'event-planning',
    question: 'What is the largest guest count you have successfully managed?',
    variable: 'scale_capacity',
    placeholder: 'e.g., "500+ guests for corporate gala"',
    helpText: 'Establishes scale capability',
    fieldType: 'text'
  },
  
  'nonprofit-fundraising': {
    industryId: 'nonprofit-fundraising',
    question: 'Exactly how much of every $1 donated goes directly to the mission?',
    variable: 'efficiency_ratio',
    placeholder: 'e.g., "$0.87 of every dollar" or "87% to mission"',
    helpText: 'Critical transparency metric',
    fieldType: 'text'
  },
  
  'mexican-restaurant': {
    industryId: 'mexican-restaurant',
    question: 'What is your "Signature Dish" and its unique origin story?',
    variable: 'signature_dish',
    placeholder: 'e.g., "Birria Tacos - 4th generation family recipe from Jalisco"',
    helpText: 'Cultural authenticity and menu highlight',
    fieldType: 'textarea'
  }
};

/**
 * Get the industry-specific question for a given industry
 */
export function getIndustryInjectionQuestion(industryId: string): IndustryInjectionQuestion | null {
  return INDUSTRY_INJECTION_QUESTIONS[industryId] || null;
}

/**
 * Check if an industry has a specific injection question
 */
export function hasInjectionQuestion(industryId: string): boolean {
  return industryId in INDUSTRY_INJECTION_QUESTIONS;
}

/**
 * Get all injection questions (for reference/testing)
 */
export function getAllInjectionQuestions(): IndustryInjectionQuestion[] {
  return Object.values(INDUSTRY_INJECTION_QUESTIONS);
}

