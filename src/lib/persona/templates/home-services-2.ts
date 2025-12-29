import type { IndustryTemplate } from './types';

export const homeServicesTemplates2: Record<string, IndustryTemplate> = {
  'electrical-services': {
    id: 'electrical-services',
    name: 'Electrical Services',
    description: 'For electricians - safety and compliance',
    category: 'Home Services',
    
    coreIdentity: {
      title: 'The Safety Authority',
      positioning: 'Precise, cautious, and highly technical',
      tone: 'Professional, safety-focused, authoritative'
    },
    
    cognitiveLogic: {
      framework: 'The Hazard-to-Safety Logic',
      reasoning: 'Frames old panels, flickering lights, or outdated wiring as "Fire Risks" to drive immediate corrective action',
      decisionProcess: 'Safety Assessment → Risk Mitigation → Code Compliance'
    },
    
    knowledgeRAG: {
      static: [
        'Electrical codes (NEC)',
        'Panel upgrade requirements',
        'EV charger requirements (Level 2)',
        'GFCI/AFCI protection',
        'Grounding standards'
      ],
      dynamic: [
        'Service call fees',
        '"Panel Upgrade" specials',
        'Master electrician credentials',
        'Emergency availability (24/7)',
        'EV charger installation pricing',
        'Permit requirements'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Identifies "EV Purchase" or "Tesla" keywords in conversation',
      adaptation: 'Triggers a "Home Charging Station" installation module with rebate information',
      feedbackIntegration: 'Learns which safety concerns (panel age, aluminum wiring, knob-and-tube) create urgency'
    },
    
    tacticalExecution: {
      primaryAction: 'Safety Inspection/Quote',
      conversionRhythm: 'Pushes for a physical diagnostic visit to assess electrical safety and provide accurate quote',
      secondaryActions: [
        'Panel upgrade consultation',
        'EV charger installation',
        'Whole-home surge protection',
        'Smart home wiring',
        'Generator installation'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['google-business'],
        frequency: 'per-lead',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 300
      },

      highValueSignals: [
        {id: 'master_electrician', label: 'Master Electrician', description: 'Master licensed', keywords: ["master electrician", "master licensed", "licensed master"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'emergency_24_7', label: '24/7 Emergency Service', description: 'Round-the-clock availability', keywords: ["24/7", "24 hour", "emergency", "emergency electrical"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'panel_upgrades', label: 'Panel Upgrades', description: 'Electrical panel replacement', keywords: ["panel upgrade", "electrical panel", "service upgrade", "200 amp"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'ev_charger', label: 'EV Charger Installation', description: 'Electric vehicle charging', keywords: ["ev charger", "electric vehicle", "tesla", "car charger", "level 2"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'},
        {id: 'generator', label: 'Generator Installation', description: 'Standby generator services', keywords: ["generator", "standby generator", "generac", "backup power"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'smart_home', label: 'Smart Home Wiring', description: 'Home automation', keywords: ["smart home", "home automation", "smart lighting", "control4"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'commercial_electrical', label: 'Commercial Electrical', description: 'Business services', keywords: ["commercial", "commercial electrical", "business", "industrial"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'rewiring', label: 'Whole-House Rewiring', description: 'Complete rewiring services', keywords: ["rewire", "rewiring", "whole house", "aluminum wiring"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'surge_protection', label: 'Surge Protection', description: 'Whole-home surge protector', keywords: ["surge protection", "surge protector", "lightning protection"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'hiring', label: 'Hiring Electricians', description: 'Growing team', keywords: ["hiring", "electrician jobs", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Service Expansion', description: 'New service areas', keywords: ["expanding", "now serving", "new location"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'upfront_pricing', label: 'Upfront Pricing', description: 'Transparent pricing', keywords: ["upfront pricing", "flat rate", "no surprise"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'financing', label: 'Financing Available', description: 'Payment options', keywords: ["financing", "payment plans"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'same_day', label: 'Same-Day Service', description: 'Quick response', keywords: ["same day", "today"], priority: 'HIGH', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'warranty', label: 'Work Warranty', description: 'Guarantee on work', keywords: ["warranty", "guarantee", "lifetime warranty"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'licensed', pattern: 'licensed.*insured.*bonded', description: 'License boilerplate', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'emergency', pattern: '^emergency$', description: 'Emergency', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'coupons', pattern: '^coupons$', description: 'Coupons', context: 'header'},
        {id: 'reviews', pattern: '^reviews$', description: 'Reviews', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'areas', pattern: '^areas$', description: 'Areas', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'}
      ],

      scoringRules: [
        {id: 'emergency_capable', name: 'Emergency Capable', description: '24/7 service with master electrician', condition: 'signals.some(s => s.signalId === "emergency_24_7") && signals.some(s => s.signalId === "master_electrician")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'modern_services', name: 'Modern Services', description: 'EV charger and smart home', condition: 'signals.some(s => s.signalId === "ev_charger") && signals.some(s => s.signalId === "smart_home")', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'growing_company', name: 'Growing Company', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'full_service', name: 'Full-Service Electrical', description: 'Multiple service types', condition: 'signals.filter(s => ["panel_upgrades", "rewiring", "generator"].includes(s.signalId)).length >= 2', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'commercial_residential', name: 'Commercial & Residential', description: 'Diversified services', condition: 'signals.some(s => s.signalId === "commercial_electrical")', scoreBoost: 25, priority: 5, enabled: true},
        {id: 'premium_services', name: 'Premium Services', description: 'Generator and EV charging', condition: 'signals.some(s => s.signalId === "generator") && signals.some(s => s.signalId === "ev_charger")', scoreBoost: 30, priority: 6, enabled: true},
        {id: 'trusted_provider', name: 'Trusted Provider', description: 'Licensed with warranty', condition: 'signals.some(s => s.signalId === "master_electrician") && signals.some(s => s.signalId === "warranty")', scoreBoost: 22, priority: 7, enabled: true},
        {id: 'transparent', name: 'Transparent Pricing', description: 'Upfront pricing with financing', condition: 'signals.some(s => s.signalId === "upfront_pricing") && signals.some(s => s.signalId === "financing")', scoreBoost: 18, priority: 8, enabled: true},
        {id: 'safety_focused', name: 'Safety-Focused', description: 'Panel upgrades with surge protection', condition: 'signals.some(s => s.signalId === "panel_upgrades") && signals.some(s => s.signalId === "surge_protection")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'responsive', name: 'Responsive Service', description: 'Same-day with emergency capability', condition: 'signals.some(s => s.signalId === "same_day") && signals.some(s => s.signalId === "emergency_24_7")', scoreBoost: 28, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'has_master_license', label: 'Master Electrician', type: 'boolean', description: 'Master licensed', extractionHints: ['master electrician'], required: false, defaultValue: false},
        {key: 'has_24_7_emergency', label: '24/7 Emergency', type: 'boolean', description: 'Emergency service', extractionHints: ['24/7', 'emergency'], required: false, defaultValue: false},
        {key: 'services_offered', label: 'Services Offered', type: 'array', description: 'Service types', extractionHints: ['panel', 'rewire', 'ev charger', 'generator'], required: false, defaultValue: []},
        {key: 'offers_commercial', label: 'Commercial Services', type: 'boolean', description: 'Business clients', extractionHints: ['commercial'], required: false, defaultValue: false},
        {key: 'electrician_count', label: 'Number of Electricians', type: 'number', description: 'Team size', extractionHints: ['electricians', 'technicians'], required: false, defaultValue: 1},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas'], required: false, defaultValue: []},
        {key: 'years_in_business', label: 'Years in Business', type: 'number', description: 'Company age', extractionHints: ['years', 'since'], required: false, defaultValue: 0}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Electrical services intelligence - focuses on licensing, emergency capabilities, modern service offerings (EV, smart home), and safety expertise'
      }
    }
  },
  
  'home-security': {
    id: 'home-security',
    name: 'Home Security Systems',
    description: 'For security companies - peace of mind and protection',
    category: 'Home Services',
    
    coreIdentity: {
      title: 'The Peace-of-Mind Specialist',
      positioning: 'Vigilant, tech-integrated, and protective',
      tone: 'Reassuring, knowledgeable, customer-focused'
    },
    
    cognitiveLogic: {
      framework: 'The "Ring of Protection" Model',
      reasoning: 'Logic that focuses on "Deterrence" first (visible cameras/signs), then "Detection" (sensors), and finally "Response" (monitoring/alerts)',
      decisionProcess: 'Threat Assessment → Layered Protection → Monitoring Response'
    },
    
    knowledgeRAG: {
      static: [
        'Smart home protocols (Zigbee, Z-Wave, WiFi)',
        'Monitoring response times',
        'Camera resolution standards',
        'Sensor types and placement',
        'False alarm prevention'
      ],
      dynamic: [
        'Hardware packages (Cameras vs. Sensors vs. Full System)',
        'Monthly monitoring rates',
        'Local crime data awareness',
        'Installation availability',
        'Contract terms',
        'Smart home integration options'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks "Privacy Concerns" regarding cameras (indoor recording, cloud storage)',
      adaptation: 'Suggests "Physical Sensor" heavy packages (door/window sensors, motion detectors) as privacy-friendly alternatives',
      feedbackIntegration: 'Learns which security motivators (break-ins, package theft, vacation monitoring) drive system purchases'
    },
    
    tacticalExecution: {
      primaryAction: 'System Design',
      conversionRhythm: 'Moves to a "Custom Security Package" builder or an in-home tech assessment',
      secondaryActions: [
        'Free security assessment',
        'Video doorbell demo',
        'Smart lock consultation',
        'Monitoring plan comparison',
        'Installation scheduling'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['google-business'],
        frequency: 'per-lead',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 300
      },

      highValueSignals: [
        {id: 'professional_monitoring', label: '24/7 Professional Monitoring', description: 'Monitored security service', keywords: ["24/7 monitoring", "professional monitoring", "central station", "monitored"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'smart_home_integration', label: 'Smart Home Integration', description: 'Works with smart home systems', keywords: ["alexa", "google home", "smart home", "voice control", "home automation"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'website'},
        {id: 'camera_systems', label: 'Security Cameras', description: 'Video surveillance', keywords: ["cameras", "video", "surveillance", "cctv", "video doorbell"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'mobile_app', label: 'Mobile App Control', description: 'Smartphone app', keywords: ["mobile app", "app control", "smartphone", "ios", "android"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'no_contract', label: 'No Contract', description: 'No long-term commitment', keywords: ["no contract", "cancel anytime", "month-to-month", "no commitment"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'diy_option', label: 'DIY Installation', description: 'Self-install option', keywords: ["diy", "self install", "easy install", "do it yourself"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'professional_install', label: 'Professional Installation', description: 'Expert installation', keywords: ["professional installation", "expert install", "installed by", "free installation"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'smart_locks', label: 'Smart Lock Integration', description: 'Electronic door locks', keywords: ["smart lock", "electronic lock", "keyless entry", "door lock"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'environmental_sensors', label: 'Environmental Monitoring', description: 'Smoke, CO, flood sensors', keywords: ["smoke detector", "carbon monoxide", "flood sensor", "environmental"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'hiring', label: 'Hiring Installers', description: 'Growing team', keywords: ["hiring", "installer jobs", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'expansion', label: 'Service Expansion', description: 'New markets', keywords: ["expanding", "now serving", "new market"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'local_company', label: 'Local Company', description: 'Locally owned/operated', keywords: ["local", "locally owned", "family owned"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 8, platform: 'website'},
        {id: 'national_brand', label: 'National Brand', description: 'Major security brand', keywords: ["adt", "vivint", "simplisafe", "ring", "frontpoint"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'warranty', label: 'Equipment Warranty', description: 'Warranty on equipment', keywords: ["warranty", "guarantee", "lifetime warranty"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'free_equipment', label: 'Free Equipment', description: 'Equipment included', keywords: ["free equipment", "free installation", "free camera"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'licensed', pattern: 'licensed.*insured', description: 'License notice', context: 'footer'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'products', pattern: '^products$', description: 'Products', context: 'header'},
        {id: 'monitoring', pattern: '^monitoring$', description: 'Monitoring', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'support', pattern: '^support$', description: 'Support', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'pricing', pattern: '^pricing$', description: 'Pricing', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'quote', pattern: '^quote$', description: 'Quote', context: 'header'}
      ],

      scoringRules: [
        {id: 'premium_monitoring', name: 'Premium Monitoring', description: 'Professional monitoring with smart integration', condition: 'signals.some(s => s.signalId === "professional_monitoring") && signals.some(s => s.signalId === "smart_home_integration")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'comprehensive_system', name: 'Comprehensive System', description: 'Cameras, sensors, and smart locks', condition: 'signals.filter(s => ["camera_systems", "smart_locks", "environmental_sensors"].includes(s.signalId)).length >= 2', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'growing_company', name: 'Growing Company', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'modern_platform', name: 'Modern Platform', description: 'Mobile app with smart home', condition: 'signals.some(s => s.signalId === "mobile_app") && signals.some(s => s.signalId === "smart_home_integration")', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'flexible_service', name: 'Flexible Service', description: 'No contract with DIY option', condition: 'signals.some(s => s.signalId === "no_contract") || signals.some(s => s.signalId === "diy_option")', scoreBoost: 20, priority: 5, enabled: true},
        {id: 'premium_install', name: 'Premium Installation', description: 'Professional install with monitoring', condition: 'signals.some(s => s.signalId === "professional_install") && signals.some(s => s.signalId === "professional_monitoring")', scoreBoost: 28, priority: 6, enabled: true},
        {id: 'smart_security', name: 'Smart Security', description: 'Smart locks and cameras', condition: 'signals.some(s => s.signalId === "smart_locks") && signals.some(s => s.signalId === "camera_systems")', scoreBoost: 25, priority: 7, enabled: true},
        {id: 'value_offering', name: 'Value Offering', description: 'Free equipment with monitoring', condition: 'signals.some(s => s.signalId === "free_equipment") && signals.some(s => s.signalId === "professional_monitoring")', scoreBoost: 22, priority: 8, enabled: true},
        {id: 'trusted_brand', name: 'Trusted Brand', description: 'National brand with warranty', condition: 'signals.some(s => s.signalId === "national_brand") && signals.some(s => s.signalId === "warranty")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'local_trusted', name: 'Local & Trusted', description: 'Local company with professional monitoring', condition: 'signals.some(s => s.signalId === "local_company") && signals.some(s => s.signalId === "professional_monitoring")', scoreBoost: 18, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'has_professional_monitoring', label: 'Professional Monitoring', type: 'boolean', description: '24/7 monitoring service', extractionHints: ['monitoring', '24/7'], required: false, defaultValue: false},
        {key: 'equipment_types', label: 'Equipment Types', type: 'array', description: 'System components', extractionHints: ['cameras', 'sensors', 'smart locks'], required: false, defaultValue: []},
        {key: 'has_mobile_app', label: 'Mobile App', type: 'boolean', description: 'Smartphone control', extractionHints: ['mobile app', 'app'], required: false, defaultValue: false},
        {key: 'contract_type', label: 'Contract Type', type: 'string', description: 'Contract terms', extractionHints: ['no contract', 'month-to-month', 'annual'], required: false, defaultValue: 'unknown'},
        {key: 'installation_type', label: 'Installation Type', type: 'string', description: 'DIY or professional', extractionHints: ['diy', 'professional install'], required: false, defaultValue: 'professional'},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'available in'], required: false, defaultValue: []},
        {key: 'monthly_monitoring_cost', label: 'Monthly Monitoring Cost', type: 'string', description: 'Monitoring fee', extractionHints: ['per month', 'monthly'], required: false, defaultValue: 'unknown'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Home security intelligence - focuses on monitoring services, smart home integration, equipment variety, and business growth indicators'
      }
    }
  },
  
  // ============================================
  // PROFESSIONAL SERVICES & SPECIALTY (Templates 41-50)
  // ============================================
  
  'law-personal-injury': {
    id: 'law-personal-injury',
    name: 'Law Firms (Personal Injury)',
    description: 'For PI attorneys - advocacy and contingency focus',
    category: 'Professional Services',
    
    coreIdentity: {
      title: 'The Tenacious Advocate',
      positioning: 'Bold, compassionate, and results-driven',
      tone: 'Confident, empowering, protective'
    },
    
    cognitiveLogic: {
      framework: 'The "Contingency-Confidence" Model',
      reasoning: 'Logic that eliminates the fear of cost by emphasizing "We only get paid if you do" and the high cost of settling without legal representation',
      decisionProcess: 'Injury Assessment → Value Determination → Advocacy Commitment'
    },
    
    knowledgeRAG: {
      static: [
        'Statute of limitations by state',
        'Common settlement tiers by injury type',
        'Comparative negligence rules',
        'Medical lien basics',
        'Contingency fee structures'
      ],
      dynamic: [
        'Firm\'s win rate and track record',
        'Total recovered for clients',
        'Specific attorney accolades and credentials',
        'Case examples by injury type',
        'Settlement timelines',
        'Medical provider network'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects "Insurance Adjuster" mentions or "Settlement Offer" discussions',
      adaptation: 'Triggers an "Evidence Preservation" protocol to stop the lead from saying something that could hurt their case',
      feedbackIntegration: 'Learns which case types (car accident, slip-and-fall, medical malpractice) require urgent intake'
    },
    
    tacticalExecution: {
      primaryAction: 'Free Case Review',
      conversionRhythm: 'Every exchange drives toward an immediate "Initial Intake" or attorney consultation',
      secondaryActions: [
        'Evidence checklist provision',
        'Medical provider referral',
        'Settlement value estimation',
        'Case timeline explanation',
        'Zero-fee guarantee emphasis'
      ]
    },

    research: {
      scrapingStrategy: {primarySource: 'website', secondarySources: ['linkedin-company'], frequency: 'per-lead', timeoutMs: 30000, enableCaching: true, cacheTtlSeconds: 300},
      highValueSignals: [
        {id: 'hiring_attorneys', label: 'Hiring Attorneys', description: 'Recruiting lawyers', keywords: ["hiring", "attorney positions", "join our firm", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'new_office', label: 'New Office Location', description: 'Expanding locations', keywords: ["new office", "opening", "expanding", "second location"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'results_millions', label: 'Million Dollar Results', description: 'High-value verdicts/settlements', keywords: ["million", "recovered", "verdict", "settlement"], regexPattern: '\\$(\\d+)\\s*(million|M)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 45, platform: 'website'},
        {id: 'no_fee_guarantee', label: 'No Win No Fee', description: 'Contingency basis', keywords: ["no fee", "free consultation", "contingency", "no upfront cost"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'case_types', label: 'Multiple Case Types', description: 'Handles various injuries', keywords: ["car accident", "truck accident", "slip and fall", "medical malpractice", "wrongful death"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'trial_experience', label: 'Trial Attorneys', description: 'Courtroom experience', keywords: ["trial", "courtroom", "litigation", "jury"], priority: 'HIGH', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'awards', label: 'Legal Awards', description: 'Recognition and awards', keywords: ["super lawyers", "best lawyers", "martindale", "avvo"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'years_experience', label: 'Years of Experience', description: 'Firm longevity', keywords: ["years", "since", "experience"], regexPattern: '(\\d+)\\+?\\s*years?', priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: '24_7_availability', label: '24/7 Availability', description: 'Always available', keywords: ["24/7", "24 hours", "always available"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'bilingual', label: 'Bilingual Services', description: 'Spanish or other languages', keywords: ["spanish", "bilingual", "hablamos español"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'}
      ],
      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'disclaimer', pattern: 'attorney advertising|disclaimer', description: 'Legal disclaimer', context: 'all'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookies', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'back_top', pattern: 'back to top', description: 'Back', context: 'footer'}
      ],
      scoringRules: [
        {id: 'big_results_growing', name: 'High-Value Growing Firm', description: 'Million dollar results + hiring', condition: 'signals.some(s => s.signalId === "results_millions") && signals.some(s => s.signalId === "hiring_attorneys")', scoreBoost: 35, priority: 1, enabled: true},
        {id: 'trial_ready', name: 'Trial-Ready Firm', description: 'Trial experience + awards', condition: 'signals.some(s => s.signalId === "trial_experience") && signals.some(s => s.signalId === "awards")', scoreBoost: 25, priority: 2, enabled: true}
      ],
      customFields: [
        {key: 'attorney_count', label: 'Number of Attorneys', type: 'number', description: 'Firm size', extractionHints: ['attorneys', 'lawyers'], required: false, defaultValue: 1},
        {key: 'total_recovered', label: 'Total Recovered', type: 'string', description: 'Amount recovered for clients', extractionHints: ['recovered', 'million', 'billion'], required: false, defaultValue: ''},
        {key: 'case_types', label: 'Practice Areas', type: 'array', description: 'Types of cases', extractionHints: ['car accident', 'truck', 'malpractice'], required: false, defaultValue: []},
        {key: 'has_trial_experience', label: 'Trial Experience', type: 'boolean', description: 'Goes to trial', extractionHints: ['trial', 'courtroom'], required: false, defaultValue: false}
      ],
      metadata: {lastUpdated: '2025-12-28', version: 1, updatedBy: 'system', notes: 'Personal injury law intelligence - results, growth, trial capability'}
    }
  },
  
  'family-law': {
    id: 'family-law',
    name: 'Family Law (Divorce/Custody)',
    description: 'For family attorneys - empathy and future stability',
    category: 'Professional Services',
    
    coreIdentity: {
      title: 'The Calm Navigator',
      positioning: 'Empathetic, objective, and protective of family interests',
      tone: 'Compassionate, professional, stabilizing'
    },
    
    cognitiveLogic: {
      framework: 'The "Future-Stabilization" Framework',
      reasoning: 'Logic that moves from the current conflict to a "Post-Decree" life of stability, clarity, and new beginnings',
      decisionProcess: 'Current Conflict → Legal Protection → Future Stability'
    },
    
    knowledgeRAG: {
      static: [
        'Custody guidelines and best interests standards',
        'Asset division principles',
        'Spousal support calculations',
        'Mediation vs. litigation',
        'Protective orders'
      ],
      dynamic: [
        'Consultation fees and payment plans',
        'Mediator availability',
        'Local court procedures and timelines',
        'Attorney specializations',
        'Collaborative divorce options',
        'Emergency hearing availability'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Monitors "Emotional Volatility" in text (anger, fear, desperation)',
      adaptation: 'Triggers "De-escalation Logic" to keep the consultation productive and professional, avoiding inflammatory language',
      feedbackIntegration: 'Learns which concerns (custody, finances, timeline) need addressing first for different client types'
    },
    
    tacticalExecution: {
      primaryAction: 'Private Strategy Session',
      conversionRhythm: 'Moves to book a confidential meeting with emphasis on privacy and understanding',
      secondaryActions: [
        'Initial consultation scheduling',
        'Document preparation checklist',
        'Mediation assessment',
        'Financial affidavit guidance',
        'Emergency protective order assistance'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['google-business'],
        frequency: 'per-lead',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 300
      },

      highValueSignals: [
        {id: 'years_experience', label: 'Experienced Attorney', description: 'Years practicing family law', keywords: ["years of experience", "practicing since"], regexPattern: '(\\d+)\\+?\\s*years?', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'free_consultation', label: 'Free Consultation', description: 'Complimentary initial meeting', keywords: ["free consultation", "complimentary consultation", "no charge"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'website'},
        {id: 'mediation_services', label: 'Mediation Services', description: 'Offers mediation', keywords: ["mediation", "mediator", "collaborative divorce", "uncontested"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'custody_specialist', label: 'Custody Specialist', description: 'Child custody focus', keywords: ["child custody", "custody", "parenting plan", "visitation"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'high_asset', label: 'High-Asset Divorce', description: 'Complex property division', keywords: ["high asset", "complex property", "business valuation", "high net worth"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'},
        {id: 'protective_orders', label: 'Protective Orders', description: 'Domestic violence expertise', keywords: ["protective order", "restraining order", "domestic violence", "emergency protection"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'multiple_attorneys', label: 'Multiple Attorneys', description: 'Law firm with several attorneys', keywords: ["attorneys", "lawyers"], regexPattern: '(\\d+)\\s*attorneys?', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'hiring', label: 'Hiring Attorneys', description: 'Growing firm', keywords: ["hiring", "attorney positions", "join our firm", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'expansion', label: 'Office Expansion', description: 'New locations', keywords: ["new office", "expanding", "second location"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'any'},
        {id: 'awards', label: 'Attorney Recognition', description: 'Super lawyers, best of', keywords: ["super lawyers", "best lawyers", "award", "rated"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'payment_plans', label: 'Payment Plans', description: 'Flexible payment options', keywords: ["payment plan", "payment arrangements", "financing"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'evening_weekend', label: 'Evening/Weekend Hours', description: 'Flexible scheduling', keywords: ["evening", "weekend", "after hours"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'bilingual', label: 'Bilingual Services', description: 'Spanish or other languages', keywords: ["spanish", "bilingual", "hablamos español"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'modification_services', label: 'Modification Services', description: 'Post-decree modifications', keywords: ["modification", "post-divorce", "change custody", "modify support"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'virtual_consultations', label: 'Virtual Consultations', description: 'Remote meetings available', keywords: ["virtual", "zoom", "online consultation", "video call"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'disclaimer', pattern: 'attorney advertising|prior results', description: 'Legal disclaimer', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'practice_areas', pattern: '^practice areas$', description: 'Practice areas', context: 'header'},
        {id: 'attorneys', pattern: '^attorneys$', description: 'Attorneys', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'consultation', pattern: '^consultation$', description: 'Consultation', context: 'header'}
      ],

      scoringRules: [
        {id: 'experienced_firm', name: 'Experienced Firm', description: 'Years of experience with free consultation', condition: 'signals.some(s => s.signalId === "years_experience") && signals.some(s => s.signalId === "free_consultation")', scoreBoost: 35, priority: 1, enabled: true},
        {id: 'full_service_family', name: 'Full-Service Family Law', description: 'Divorce, custody, and mediation', condition: 'signals.filter(s => ["mediation_services", "custody_specialist", "modification_services"].includes(s.signalId)).length >= 2', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'growing_firm', name: 'Growing Firm', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'high_asset_specialist', name: 'High-Asset Specialist', description: 'Complex divorce expertise', condition: 'signals.some(s => s.signalId === "high_asset")', scoreBoost: 35, priority: 4, enabled: true},
        {id: 'accessible_firm', name: 'Accessible Firm', description: 'Free consultation with payment plans', condition: 'signals.some(s => s.signalId === "free_consultation") && signals.some(s => s.signalId === "payment_plans")', scoreBoost: 25, priority: 5, enabled: true},
        {id: 'recognized_attorney', name: 'Recognized Attorney', description: 'Awards with experience', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "years_experience")', scoreBoost: 30, priority: 6, enabled: true},
        {id: 'comprehensive', name: 'Comprehensive Services', description: 'Litigation and mediation', condition: 'signals.some(s => s.signalId === "mediation_services")', scoreBoost: 20, priority: 7, enabled: true},
        {id: 'convenient', name: 'Convenient Access', description: 'Virtual consultations with flexible hours', condition: 'signals.some(s => s.signalId === "virtual_consultations") || signals.some(s => s.signalId === "evening_weekend")', scoreBoost: 15, priority: 8, enabled: true},
        {id: 'protective', name: 'Protective Services', description: 'Protective order expertise', condition: 'signals.some(s => s.signalId === "protective_orders")', scoreBoost: 18, priority: 9, enabled: true},
        {id: 'bilingual_service', name: 'Bilingual Service', description: 'Spanish-speaking attorneys', condition: 'signals.some(s => s.signalId === "bilingual")', scoreBoost: 12, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'attorney_count', label: 'Number of Attorneys', type: 'number', description: 'Firm size', extractionHints: ['attorneys', 'lawyers'], required: false, defaultValue: 1},
        {key: 'years_practice', label: 'Years in Practice', type: 'number', description: 'Attorney experience', extractionHints: ['years', 'experience'], required: false, defaultValue: 0},
        {key: 'offers_mediation', label: 'Offers Mediation', type: 'boolean', description: 'Mediation services', extractionHints: ['mediation'], required: false, defaultValue: false},
        {key: 'free_consult', label: 'Free Consultation', type: 'boolean', description: 'Complimentary initial meeting', extractionHints: ['free consultation'], required: false, defaultValue: false},
        {key: 'practice_areas', label: 'Practice Areas', type: 'array', description: 'Family law specializations', extractionHints: ['divorce', 'custody', 'adoption'], required: false, defaultValue: []},
        {key: 'has_payment_plans', label: 'Payment Plans Available', type: 'boolean', description: 'Flexible payment', extractionHints: ['payment plan'], required: false, defaultValue: false},
        {key: 'office_locations', label: 'Office Locations', type: 'number', description: 'Number of offices', extractionHints: ['locations', 'offices'], required: false, defaultValue: 1}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Family law intelligence - focuses on experience, accessibility, mediation capabilities, and compassionate service delivery'
      }
    }
  },
  
  'accounting-tax': {
    id: 'accounting-tax',
    name: 'Accounting & Tax Services',
    description: 'For accountants - deduction maximization and compliance',
    category: 'Professional Services',
    
    coreIdentity: {
      title: 'The Wealth Guardian',
      positioning: 'Meticulous, analytical, and "IRS-Proof"',
      tone: 'Professional, detail-oriented, trustworthy'
    },
    
    cognitiveLogic: {
      framework: 'The Deduction-Maximization Model',
      reasoning: 'Logic that shifts the view of "Accounting" from an expense to an "Investment that saves more than it costs"',
      decisionProcess: 'Tax Liability Assessment → Deduction Discovery → Savings Maximization'
    },
    
    knowledgeRAG: {
      static: [
        'Current tax brackets and rates',
        '1099 vs. W2 classifications',
        'Standard vs. itemized deductions',
        'Quarterly estimated tax requirements',
        'Audit triggers and prevention'
      ],
      dynamic: [
        'Client\'s specific tax-prep software',
        'Current filing deadlines',
        'State-specific tax rules',
        'Industry-specific deductions',
        'Service pricing tiers',
        'CPA credentials'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Identifies "Small Business" vs "Individual" needs based on jargon used (e.g., "depreciation" vs "deduction")',
      adaptation: 'Adjusts the service pitch (bookkeeping + payroll vs simple tax prep)',
      feedbackIntegration: 'Tracks which tax savings examples resonate with different client segments'
    },
    
    tacticalExecution: {
      primaryAction: 'Document Review',
      conversionRhythm: 'Pushes for the lead to upload their previous year\'s return for a "Second Look" or "Tax Savings Analysis"',
      secondaryActions: [
        'Tax planning consultation',
        'Quarterly tax estimate setup',
        'Bookkeeping service inquiry',
        'Audit defense coverage',
        'Business entity consultation'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['google-business', 'linkedin-company'],
        frequency: 'per-lead',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 300
      },

      highValueSignals: [
        {id: 'cpa_firm', label: 'CPA Firm', description: 'Certified public accountants', keywords: ["cpa", "certified public accountant", "licensed cpa"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'bookkeeping', label: 'Bookkeeping Services', description: 'Ongoing bookkeeping', keywords: ["bookkeeping", "quickbooks", "accounting services", "monthly bookkeeping"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'payroll_services', label: 'Payroll Services', description: 'Payroll processing', keywords: ["payroll", "payroll services", "payroll processing"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'business_tax', label: 'Business Tax Services', description: 'Corporate tax filing', keywords: ["business tax", "corporate tax", "s-corp", "llc", "partnership"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'},
        {id: 'tax_planning', label: 'Tax Planning', description: 'Strategic tax planning', keywords: ["tax planning", "tax strategy", "year-round", "proactive"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'website'},
        {id: 'audit_defense', label: 'Audit Defense', description: 'Audit representation', keywords: ["audit", "audit defense", "audit protection", "irs representation"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'quickbooks', label: 'QuickBooks Services', description: 'QuickBooks expertise', keywords: ["quickbooks", "qbo", "quickbooks online", "quickbooks certified"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'industry_specialist', label: 'Industry Specialist', description: 'Specific industry focus', keywords: ["construction", "medical", "real estate", "restaurant", "industry expertise"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'hiring', label: 'Hiring Accountants', description: 'Growing firm', keywords: ["hiring", "accountant positions", "cpa jobs", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'any'},
        {id: 'expansion', label: 'Firm Expansion', description: 'New offices', keywords: ["new office", "expanding", "now serving"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'cfo_services', label: 'Virtual CFO Services', description: 'Fractional CFO', keywords: ["cfo", "virtual cfo", "fractional cfo", "outsourced cfo"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'},
        {id: 'year_round', label: 'Year-Round Service', description: 'Not just tax season', keywords: ["year-round", "year round", "all year", "ongoing support"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'free_consultation', label: 'Free Consultation', description: 'Complimentary initial meeting', keywords: ["free consultation", "complimentary", "no charge"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'cloud_accounting', label: 'Cloud Accounting', description: 'Modern cloud-based services', keywords: ["cloud", "online", "virtual", "remote"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'client_count', label: 'Large Client Base', description: 'Many clients served', keywords: ["clients", "businesses served"], regexPattern: '([\\d,]+)\\+?\\s*clients?', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'circular', pattern: 'circular 230', description: 'IRS disclosure', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'team', pattern: '^team$', description: 'Team', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'portal', pattern: '^portal$', description: 'Portal', context: 'header'},
        {id: 'industries', pattern: '^industries$', description: 'Industries', context: 'header'},
        {id: 'calculator', pattern: '^calculator$', description: 'Calculator', context: 'header'}
      ],

      scoringRules: [
        {id: 'certified_firm', name: 'Certified Firm', description: 'CPA with large client base', condition: 'signals.some(s => s.signalId === "cpa_firm") && signals.some(s => s.signalId === "client_count")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'full_service_accounting', name: 'Full-Service Accounting', description: 'Tax, bookkeeping, and payroll', condition: 'signals.filter(s => ["bookkeeping", "payroll_services", "business_tax"].includes(s.signalId)).length >= 3', scoreBoost: 40, priority: 2, enabled: true},
        {id: 'growing_firm', name: 'Growing Firm', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'strategic_advisor', name: 'Strategic Advisor', description: 'Tax planning with CFO services', condition: 'signals.some(s => s.signalId === "tax_planning") && signals.some(s => s.signalId === "cfo_services")', scoreBoost: 40, priority: 4, enabled: true},
        {id: 'industry_expert', name: 'Industry Expert', description: 'Specialization with year-round service', condition: 'signals.some(s => s.signalId === "industry_specialist") && signals.some(s => s.signalId === "year_round")', scoreBoost: 30, priority: 5, enabled: true},
        {id: 'modern_firm', name: 'Modern Firm', description: 'Cloud accounting with QuickBooks', condition: 'signals.some(s => s.signalId === "cloud_accounting") && signals.some(s => s.signalId === "quickbooks")', scoreBoost: 25, priority: 6, enabled: true},
        {id: 'comprehensive_protection', name: 'Comprehensive Protection', description: 'Audit defense with planning', condition: 'signals.some(s => s.signalId === "audit_defense") && signals.some(s => s.signalId === "tax_planning")', scoreBoost: 28, priority: 7, enabled: true},
        {id: 'business_focused', name: 'Business-Focused', description: 'Business tax with bookkeeping', condition: 'signals.some(s => s.signalId === "business_tax") && signals.some(s => s.signalId === "bookkeeping")', scoreBoost: 30, priority: 8, enabled: true},
        {id: 'accessible', name: 'Accessible Service', description: 'Free consultation with cloud access', condition: 'signals.some(s => s.signalId === "free_consultation") && signals.some(s => s.signalId === "cloud_accounting")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'year_round_partner', name: 'Year-Round Partner', description: 'Ongoing support not just tax season', condition: 'signals.some(s => s.signalId === "year_round")', scoreBoost: 20, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'is_cpa_firm', label: 'CPA Firm', type: 'boolean', description: 'Has CPAs on staff', extractionHints: ['cpa'], required: false, defaultValue: false},
        {key: 'accountant_count', label: 'Number of Accountants', type: 'number', description: 'Team size', extractionHints: ['cpas', 'accountants', 'team'], required: false, defaultValue: 1},
        {key: 'services_offered', label: 'Services Offered', type: 'array', description: 'Service types', extractionHints: ['tax', 'bookkeeping', 'payroll', 'cfo'], required: false, defaultValue: []},
        {key: 'industry_specialization', label: 'Industry Specialization', type: 'string', description: 'Primary industry focus', extractionHints: ['construction', 'medical', 'real estate'], required: false, defaultValue: 'general'},
        {key: 'offers_year_round', label: 'Year-Round Service', type: 'boolean', description: 'Not seasonal', extractionHints: ['year-round'], required: false, defaultValue: false},
        {key: 'offers_cfo_services', label: 'CFO Services', type: 'boolean', description: 'Virtual CFO available', extractionHints: ['cfo'], required: false, defaultValue: false},
        {key: 'client_count', label: 'Client Count', type: 'number', description: 'Number of clients', extractionHints: ['clients'], required: false, defaultValue: 0}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Accounting & tax intelligence - focuses on CPA credentials, service breadth, industry specialization, and strategic advisory capabilities'
      }
    }
  },
  
  'financial-planning': {
    id: 'financial-planning',
    name: 'Financial Planning',
    description: 'For advisors - long-term wealth and retirement',
    category: 'Professional Services',
    
    coreIdentity: {
      title: 'The Generational Strategist',
      positioning: 'Visionary, disciplined, and fiduciary-minded',
      tone: 'Professional, forward-looking, trustworthy'
    },
    
    cognitiveLogic: {
      framework: 'The Compound-Impact Model',
      reasoning: 'Logic that uses "The Cost of Inaction" to show how much wealth is lost by waiting to invest or plan properly',
      decisionProcess: 'Current State → Future Goals → Wealth Strategy'
    },
    
    knowledgeRAG: {
      static: [
        '401k/IRA contribution rules',
        'Diversification theory',
        'Tax-advantaged accounts',
        'Estate planning basics',
        'Fiduciary duty standards'
      ],
      dynamic: [
        'Current market commentary',
        'Firm-specific "Success Portfolios"',
        'Retirement calculator tools',
        'Fee structures (AUM, flat fee)',
        'Advisor credentials (CFP, CFA)',
        'Client success stories'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects "Risk Aversion" levels through user questions (concerns about volatility, loss)',
      adaptation: 'Automatically shifts recommendations between "Aggressive Growth" and "Capital Preservation" strategies',
      feedbackIntegration: 'Learns which life goals (retirement, college, legacy) motivate different demographics'
    },
    
    tacticalExecution: {
      primaryAction: 'Financial Roadmap',
      conversionRhythm: 'Moves lead to a "Retirement Readiness" assessment or "Net Worth Analysis"',
      secondaryActions: [
        'Portfolio review',
        'Retirement gap analysis',
        'Tax optimization consultation',
        'Estate planning referral',
        '401k rollover assistance'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['linkedin-company'],
        frequency: 'per-lead',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 300
      },

      highValueSignals: [
        {id: 'cfp_certified', label: 'CFP Certified', description: 'Certified Financial Planner', keywords: ["cfp", "certified financial planner", "cfp®"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'fiduciary', label: 'Fiduciary Standard', description: 'Acts as fiduciary', keywords: ["fiduciary", "fee-only", "no commissions", "fiduciary standard"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'aum_size', label: 'Assets Under Management', description: 'Large AUM', keywords: ["assets under management", "aum", "million", "billion"], regexPattern: '\\$(\\d+)\\+?\\s*(million|billion)', priority: 'HIGH', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'retirement_planning', label: 'Retirement Planning', description: 'Retirement specialization', keywords: ["retirement", "retirement planning", "401k", "ira", "pension"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'estate_planning', label: 'Estate Planning', description: 'Estate planning services', keywords: ["estate planning", "estate", "legacy", "trust", "will"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'tax_planning', label: 'Tax Planning', description: 'Tax strategy integration', keywords: ["tax planning", "tax strategy", "tax efficient"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'wealth_management', label: 'Wealth Management', description: 'Comprehensive wealth services', keywords: ["wealth management", "private wealth", "wealth advisory"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'hiring', label: 'Hiring Advisors', description: 'Growing team', keywords: ["hiring", "advisor positions", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Firm Expansion', description: 'New offices', keywords: ["new office", "expanding", "now serving"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'client_count', label: 'Large Client Base', description: 'Many clients served', keywords: ["clients", "families served"], regexPattern: '([\\d,]+)\\+?\\s*(clients?|families)', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'awards', label: 'Industry Recognition', description: 'Financial advisor awards', keywords: ["award", "barron's", "forbes", "five star", "top advisor"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'free_consultation', label: 'Free Consultation', description: 'Complimentary planning session', keywords: ["free consultation", "complimentary", "no obligation"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'cfa_charter', label: 'CFA Charterholder', description: 'CFA credential', keywords: ["cfa", "chartered financial analyst"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'holistic_planning', label: 'Holistic Planning', description: 'Comprehensive life planning', keywords: ["holistic", "comprehensive", "life planning", "financial wellness"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'specialization', label: 'Client Specialization', description: 'Niche client focus', keywords: ["doctors", "executives", "small business", "retirees", "women"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'disclaimer', pattern: 'investment advisory|securities disclaimer', description: 'Regulatory disclaimer', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'team', pattern: '^team$', description: 'Team', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'insights', pattern: '^insights$', description: 'Insights', context: 'header'},
        {id: 'portal', pattern: '^portal$', description: 'Portal', context: 'header'},
        {id: 'calculators', pattern: '^calculators$', description: 'Calculators', context: 'header'}
      ],

      scoringRules: [
        {id: 'certified_fiduciary', name: 'Certified Fiduciary', description: 'CFP with fiduciary standard', condition: 'signals.some(s => s.signalId === "cfp_certified") && signals.some(s => s.signalId === "fiduciary")', scoreBoost: 50, priority: 1, enabled: true},
        {id: 'large_practice', name: 'Large Practice', description: 'High AUM with multiple advisors', condition: 'signals.some(s => s.signalId === "aum_size") && signals.some(s => s.signalId === "client_count")', scoreBoost: 45, priority: 2, enabled: true},
        {id: 'comprehensive_services', name: 'Comprehensive Services', description: 'Retirement, estate, and tax planning', condition: 'signals.filter(s => ["retirement_planning", "estate_planning", "tax_planning"].includes(s.signalId)).length >= 3', scoreBoost: 40, priority: 3, enabled: true},
        {id: 'growing_firm', name: 'Growing Firm', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 4, enabled: true},
        {id: 'wealth_manager', name: 'Wealth Manager', description: 'Wealth management with high AUM', condition: 'signals.some(s => s.signalId === "wealth_management") && signals.some(s => s.signalId === "aum_size")', scoreBoost: 40, priority: 5, enabled: true},
        {id: 'recognized_advisor', name: 'Recognized Advisor', description: 'Awards with CFP', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "cfp_certified")', scoreBoost: 35, priority: 6, enabled: true},
        {id: 'chartered_professional', name: 'Chartered Professional', description: 'CFA charterholder', condition: 'signals.some(s => s.signalId === "cfa_charter")', scoreBoost: 30, priority: 7, enabled: true},
        {id: 'holistic_approach', name: 'Holistic Approach', description: 'Comprehensive planning focus', condition: 'signals.some(s => s.signalId === "holistic_planning")', scoreBoost: 22, priority: 8, enabled: true},
        {id: 'niche_expert', name: 'Niche Expert', description: 'Client specialization', condition: 'signals.some(s => s.signalId === "specialization")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'accessible', name: 'Accessible Service', description: 'Free consultation available', condition: 'signals.some(s => s.signalId === "free_consultation")', scoreBoost: 15, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'is_cfp', label: 'CFP Certified', type: 'boolean', description: 'Certified Financial Planner', extractionHints: ['cfp'], required: false, defaultValue: false},
        {key: 'is_fiduciary', label: 'Fiduciary Advisor', type: 'boolean', description: 'Fee-only fiduciary', extractionHints: ['fiduciary', 'fee-only'], required: false, defaultValue: false},
        {key: 'aum_amount', label: 'Assets Under Management', type: 'string', description: 'AUM size', extractionHints: ['aum', 'million', 'billion'], required: false, defaultValue: 'unknown'},
        {key: 'advisor_count', label: 'Number of Advisors', type: 'number', description: 'Team size', extractionHints: ['advisors', 'planners'], required: false, defaultValue: 1},
        {key: 'services_offered', label: 'Services Offered', type: 'array', description: 'Planning services', extractionHints: ['retirement', 'estate', 'tax', 'investment'], required: false, defaultValue: []},
        {key: 'client_specialization', label: 'Client Specialization', type: 'string', description: 'Target clientele', extractionHints: ['doctors', 'executives', 'retirees'], required: false, defaultValue: 'general'},
        {key: 'fee_structure', label: 'Fee Structure', type: 'string', description: 'Pricing model', extractionHints: ['aum', 'flat fee', 'fee-only'], required: false, defaultValue: 'unknown'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Financial planning intelligence - focuses on credentials, fiduciary status, AUM size, service comprehensiveness, and client specialization'
      }
    }
  },
  
  'insurance-agency': {
    id: 'insurance-agency',
    name: 'Insurance (Auto/Life/Health)',
    description: 'For insurance agents - risk protection and bundling',
    category: 'Professional Services',
    
    coreIdentity: {
      title: 'The Risk Shield',
      positioning: 'Practical, prepared, and protective',
      tone: 'Helpful, educational, security-focused'
    },
    
    cognitiveLogic: {
      framework: 'The "Gap-Analysis" Framework',
      reasoning: 'Logic that identifies "Exposure" in the lead\'s current life/business situation and provides the specific "Safety Net" solution',
      decisionProcess: 'Coverage Assessment → Gap Identification → Protection Solution'
    },
    
    knowledgeRAG: {
      static: [
        'Policy types (Term vs. Whole Life, Liability vs. Comprehensive)',
        'Coverage limits and deductibles',
        'State minimum requirements',
        'Life insurance underwriting basics',
        'Health insurance networks'
      ],
      dynamic: [
        'Current carrier rates',
        'Agency\'s specific "Bundle & Save" logic',
        'Available discounts (multi-policy, safe driver)',
        'Quote comparison tools',
        'Claims process',
        'Customer reviews'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks "Life Events" mentioned (e.g., "just had a baby," "bought a car," "got married")',
      adaptation: 'Triggers appropriate cross-sell modules (life insurance for baby, auto for car, umbrella for assets)',
      feedbackIntegration: 'Learns which bundling combinations provide best value perception and highest retention'
    },
    
    tacticalExecution: {
      primaryAction: 'Multi-Quote',
      conversionRhythm: 'Aims to gather data for a "3-Option Coverage Comparison" showing good/better/best',
      secondaryActions: [
        'Coverage gap analysis',
        'Bundle discount calculator',
        'Policy review',
        'Claims assistance',
        'Life event consultation'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['google-business'],
        frequency: 'per-lead',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 300
      },

      highValueSignals: [
        {id: 'multi_line_agency', label: 'Multi-Line Agency', description: 'Multiple insurance types', keywords: ["auto", "home", "life", "health", "business", "commercial"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'independent_agent', label: 'Independent Agency', description: 'Multiple carrier options', keywords: ["independent", "independent agent", "multiple carriers", "carriers"], regexPattern: '(\\d+)\\+?\\s*carriers?', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'instant_quote', label: 'Instant Online Quote', description: 'Quick quote system', keywords: ["instant quote", "online quote", "quick quote", "get a quote"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'bundle_discounts', label: 'Bundle Discounts', description: 'Multi-policy savings', keywords: ["bundle", "bundle and save", "multi-policy", "package discount"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'commercial_insurance', label: 'Commercial Insurance', description: 'Business insurance', keywords: ["commercial", "business insurance", "liability", "workers comp"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'free_review', label: 'Free Policy Review', description: 'Complimentary coverage review', keywords: ["free review", "free quote", "no obligation"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'claims_support', label: 'Claims Assistance', description: 'Claims help', keywords: ["claims", "claims assistance", "file a claim", "claims support"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'hiring', label: 'Hiring Agents', description: 'Growing team', keywords: ["hiring", "agent careers", "join our team", "insurance agent jobs"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'any'},
        {id: 'expansion', label: 'Office Expansion', description: 'New locations', keywords: ["new office", "expanding", "new location"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'awards', label: 'Agency Recognition', description: 'Industry awards', keywords: ["award", "top agency", "best of", "five star"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'agent_count', label: 'Multiple Agents', description: 'Large agency', keywords: ["agents", "insurance professionals"], regexPattern: '(\\d+)\\+?\\s*agents?', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'life_insurance', label: 'Life Insurance Specialist', description: 'Life insurance focus', keywords: ["life insurance", "term life", "whole life", "universal life"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'health_insurance', label: 'Health Insurance', description: 'Health/Medicare specialist', keywords: ["health insurance", "medicare", "aca", "marketplace"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'online_portal', label: 'Online Portal', description: 'Customer portal access', keywords: ["online portal", "customer portal", "manage online"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'bilingual', label: 'Bilingual Services', description: 'Spanish or other languages', keywords: ["spanish", "bilingual", "hablamos"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 8, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'disclaimer', pattern: 'insurance disclaimer|rates subject', description: 'Insurance disclaimer', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'insurance_types', pattern: '^insurance types$', description: 'Insurance types', context: 'header'},
        {id: 'quote', pattern: '^quote$', description: 'Quote', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'claims', pattern: '^claims$', description: 'Claims', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'login', pattern: '^login$', description: 'Login', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'}
      ],

      scoringRules: [
        {id: 'independent_multi_line', name: 'Independent Multi-Line', description: 'Multiple carriers and insurance types', condition: 'signals.some(s => s.signalId === "independent_agent") && signals.some(s => s.signalId === "multi_line_agency")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'full_service', name: 'Full-Service Agency', description: 'Personal and commercial lines', condition: 'signals.some(s => s.signalId === "multi_line_agency") && signals.some(s => s.signalId === "commercial_insurance")', scoreBoost: 40, priority: 2, enabled: true},
        {id: 'growing_agency', name: 'Growing Agency', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'value_focused', name: 'Value-Focused', description: 'Bundle discounts with multiple carriers', condition: 'signals.some(s => s.signalId === "bundle_discounts") && signals.some(s => s.signalId === "independent_agent")', scoreBoost: 28, priority: 4, enabled: true},
        {id: 'large_agency', name: 'Large Agency', description: 'Multiple agents', condition: 'signals.some(s => s.signalId === "agent_count")', scoreBoost: 25, priority: 5, enabled: true},
        {id: 'tech_enabled', name: 'Tech-Enabled Agency', description: 'Online quotes with portal', condition: 'signals.some(s => s.signalId === "instant_quote") && signals.some(s => s.signalId === "online_portal")', scoreBoost: 20, priority: 6, enabled: true},
        {id: 'comprehensive', name: 'Comprehensive Services', description: 'Life and health insurance', condition: 'signals.some(s => s.signalId === "life_insurance") && signals.some(s => s.signalId === "health_insurance")', scoreBoost: 22, priority: 7, enabled: true},
        {id: 'recognized_agency', name: 'Recognized Agency', description: 'Awards with reviews', condition: 'signals.some(s => s.signalId === "awards")', scoreBoost: 18, priority: 8, enabled: true},
        {id: 'accessible', name: 'Accessible Service', description: 'Free review with instant quotes', condition: 'signals.some(s => s.signalId === "free_review") && signals.some(s => s.signalId === "instant_quote")', scoreBoost: 15, priority: 9, enabled: true},
        {id: 'service_oriented', name: 'Service-Oriented', description: 'Claims assistance available', condition: 'signals.some(s => s.signalId === "claims_support")', scoreBoost: 12, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'insurance_types', label: 'Insurance Types Offered', type: 'array', description: 'Product lines', extractionHints: ['auto', 'home', 'life', 'health', 'business'], required: false, defaultValue: []},
        {key: 'is_independent', label: 'Independent Agency', type: 'boolean', description: 'Multiple carriers', extractionHints: ['independent'], required: false, defaultValue: false},
        {key: 'carrier_count', label: 'Number of Carriers', type: 'number', description: 'Carrier partnerships', extractionHints: ['carriers'], required: false, defaultValue: 1},
        {key: 'agent_count', label: 'Number of Agents', type: 'number', description: 'Team size', extractionHints: ['agents'], required: false, defaultValue: 1},
        {key: 'offers_commercial', label: 'Commercial Insurance', type: 'boolean', description: 'Business lines', extractionHints: ['commercial', 'business'], required: false, defaultValue: false},
        {key: 'has_online_quote', label: 'Online Quote System', type: 'boolean', description: 'Instant quotes', extractionHints: ['online quote', 'instant'], required: false, defaultValue: false},
        {key: 'office_locations', label: 'Office Locations', type: 'number', description: 'Number of offices', extractionHints: ['locations', 'offices'], required: false, defaultValue: 1}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Insurance agency intelligence - focuses on product breadth, carrier relationships, quoting capabilities, and agency size'
      }
    }
  },
  
  'business-coaching': {
    id: 'business-coaching',
    name: 'Business & Executive Coaching',
    description: 'For coaches - performance breakthrough and growth',
    category: 'Professional Services',
    
    coreIdentity: {
      title: 'The Growth Catalyst',
      positioning: 'High-performance, challenging, and insightful',
      tone: 'Direct, empowering, transformational'
    },
    
    cognitiveLogic: {
      framework: 'The Bottleneck-Identification Model',
      reasoning: 'Logic that asks high-level questions to find the ONE thing holding the leader back from 10x growth',
      decisionProcess: 'Current Plateau → Bottleneck Discovery → Breakthrough Strategy'
    },
    
    knowledgeRAG: {
      static: [
        'Leadership frameworks (EOS, Agile, OKRs)',
        'Scaling methodologies',
        'Team building principles',
        'Performance metrics',
        'Executive presence'
      ],
      dynamic: [
        'Coach\'s specific "Signature Methodology"',
        'Client testimonials and case studies',
        'Available coaching packages',
        'Group program schedules',
        'Assessment tools',
        'Book/resource recommendations'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects "Burnout Symptoms" in user dialogue (overwhelmed, stuck, exhausted)',
      adaptation: 'Triggers a "Systems & Delegation" logic branch to address operational vs strategic focus',
      feedbackIntegration: 'Learns which coaching approaches (accountability, strategy, mindset) resonate with different leader types'
    },
    
    tacticalExecution: {
      primaryAction: 'Exploratory Call',
      conversionRhythm: 'Moves to a "15-minute Performance Audit" or "Leadership Assessment"',
      secondaryActions: [
        'Growth assessment',
        'Leadership style evaluation',
        'Team dynamics review',
        'Strategic planning session',
        'Group program enrollment'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['linkedin-company'],
        frequency: 'per-lead',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 300
      },

      highValueSignals: [
        {id: 'certifications', label: 'Professional Certifications', description: 'Coaching credentials', keywords: ["certified", "icc", "icf", "certified coach", "accredited"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'client_results', label: 'Client Success Stories', description: 'Transformation results', keywords: ["success stories", "case studies", "results", "testimonials", "client wins"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'group_programs', label: 'Group Coaching Programs', description: 'Mastermind or group coaching', keywords: ["group coaching", "mastermind", "group program", "cohort"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'one_on_one', label: 'One-on-One Coaching', description: 'Individual coaching', keywords: ["one-on-one", "private coaching", "1:1", "executive coaching"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'specialization', label: 'Industry Specialization', description: 'Niche expertise', keywords: ["specialize", "expert in", "focus on"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'published_author', label: 'Published Author', description: 'Book or media presence', keywords: ["author", "book", "published", "bestseller"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'speaking', label: 'Professional Speaker', description: 'Keynote speaker', keywords: ["speaker", "keynote", "speaking"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'online_program', label: 'Online Programs', description: 'Digital courses or programs', keywords: ["online program", "online course", "digital", "virtual"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'hiring', label: 'Hiring Coaches', description: 'Growing team', keywords: ["hiring", "coach positions", "join our team"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'any'},
        {id: 'expansion', label: 'Business Expansion', description: 'New markets or programs', keywords: ["expanding", "new program", "launching"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'any'},
        {id: 'framework', label: 'Proprietary Framework', description: 'Signature methodology', keywords: ["framework", "methodology", "system", "method"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'free_consultation', label: 'Free Discovery Call', description: 'Complimentary session', keywords: ["free", "complimentary", "discovery call", "breakthrough session"], priority: 'LOW', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'corporate_training', label: 'Corporate Training', description: 'Team/leadership training', keywords: ["corporate", "leadership training", "team training", "workshops"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'assessment_tools', label: 'Assessment Tools', description: 'Diagnostic assessments', keywords: ["assessment", "disc", "personality", "leadership assessment"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'revenue_milestone', label: 'Client Revenue Milestones', description: 'Proven business growth', keywords: ["7 figure", "8 figure", "million", "revenue growth"], regexPattern: '(\\d+)x growth', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'programs', pattern: '^programs$', description: 'Programs', context: 'header'},
        {id: 'work_with_me', pattern: '^work with me$', description: 'Work with me', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'speaking', pattern: '^speaking$', description: 'Speaking', context: 'header'},
        {id: 'podcast', pattern: '^podcast$', description: 'Podcast', context: 'header'},
        {id: 'book', pattern: '^book$', description: 'Book', context: 'header'},
        {id: 'apply', pattern: '^apply$', description: 'Apply', context: 'header'}
      ],

      scoringRules: [
        {id: 'proven_authority', name: 'Proven Authority', description: 'Published author with results', condition: 'signals.some(s => s.signalId === "published_author") && signals.some(s => s.signalId === "client_results")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'certified_results', name: 'Certified with Results', description: 'Certifications with success stories', condition: 'signals.some(s => s.signalId === "certifications") && signals.some(s => s.signalId === "client_results")', scoreBoost: 40, priority: 2, enabled: true},
        {id: 'scalable_model', name: 'Scalable Model', description: 'Group and 1:1 programs', condition: 'signals.some(s => s.signalId === "group_programs") && signals.some(s => s.signalId === "one_on_one")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'thought_leader', name: 'Thought Leader', description: 'Speaker and author', condition: 'signals.some(s => s.signalId === "speaking") && signals.some(s => s.signalId === "published_author")', scoreBoost: 35, priority: 4, enabled: true},
        {id: 'growing_business', name: 'Growing Business', description: 'Hiring coaches', condition: 'signals.some(s => s.signalId === "hiring")', scoreBoost: 28, priority: 5, enabled: true},
        {id: 'corporate_services', name: 'Corporate Services', description: 'Corporate training with group programs', condition: 'signals.some(s => s.signalId === "corporate_training") && signals.some(s => s.signalId === "group_programs")', scoreBoost: 30, priority: 6, enabled: true},
        {id: 'proven_methodology', name: 'Proven Methodology', description: 'Framework with results', condition: 'signals.some(s => s.signalId === "framework") && signals.some(s => s.signalId === "client_results")', scoreBoost: 28, priority: 7, enabled: true},
        {id: 'digital_leverage', name: 'Digital Leverage', description: 'Online programs with group coaching', condition: 'signals.some(s => s.signalId === "online_program") && signals.some(s => s.signalId === "group_programs")', scoreBoost: 25, priority: 8, enabled: true},
        {id: 'data_driven', name: 'Data-Driven Approach', description: 'Assessment tools with framework', condition: 'signals.some(s => s.signalId === "assessment_tools") && signals.some(s => s.signalId === "framework")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'revenue_focused', name: 'Revenue-Focused', description: 'Revenue milestones proven', condition: 'signals.some(s => s.signalId === "revenue_milestone")', scoreBoost: 30, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'is_certified', label: 'Certified Coach', type: 'boolean', description: 'Professional certification', extractionHints: ['certified', 'icf'], required: false, defaultValue: false},
        {key: 'is_author', label: 'Published Author', type: 'boolean', description: 'Book published', extractionHints: ['author', 'book'], required: false, defaultValue: false},
        {key: 'coaching_types', label: 'Coaching Types', type: 'array', description: 'Service formats', extractionHints: ['one-on-one', 'group', 'corporate'], required: false, defaultValue: []},
        {key: 'specialization', label: 'Coaching Specialization', type: 'string', description: 'Primary focus area', extractionHints: ['executive', 'business', 'leadership', 'sales'], required: false, defaultValue: 'business'},
        {key: 'has_online_programs', label: 'Online Programs', type: 'boolean', description: 'Digital offerings', extractionHints: ['online program', 'course'], required: false, defaultValue: false},
        {key: 'offers_group', label: 'Group Coaching', type: 'boolean', description: 'Mastermind or group', extractionHints: ['group', 'mastermind'], required: false, defaultValue: false},
        {key: 'team_size', label: 'Team Size', type: 'number', description: 'Number of coaches', extractionHints: ['coaches', 'team'], required: false, defaultValue: 1}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Business coaching intelligence - focuses on credentials, proven results, thought leadership, and scalable delivery models'
      }
    }
  },
  
