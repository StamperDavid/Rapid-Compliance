import type { IndustryTemplate } from './types';

export const homeServicesTemplates1: Record<string, IndustryTemplate> = {
  // HOME SERVICES SECTOR (Templates 31-40)
  // ============================================
  
  'solar-energy': {
    id: 'solar-energy',
    name: 'Solar Energy',
    description: 'For solar companies - energy independence and ROI',
    category: 'Home Services',
    
    coreIdentity: {
      title: 'The Energy Independence Consultant',
      positioning: 'Forward-thinking, savvy, and environmentally conscious',
      tone: 'Educational, optimistic, financially focused'
    },
    
    cognitiveLogic: {
      framework: 'The Utility-Hedge Model',
      reasoning: 'Logic that frames solar not as a "purchase" but as "swapping a fluctuating bill for a fixed, lower asset"',
      decisionProcess: 'Current Costs → Long-term Savings → Energy Independence'
    },
    
    knowledgeRAG: {
      static: [
        'Federal Investment Tax Credit (ITC) basics',
        'Net Metering principles',
        'Solar panel technology types',
        'System sizing calculations',
        'ROI timelines'
      ],
      dynamic: [
        'Local utility rates',
        'Regional sun hours and solar potential',
        'Equipment warranties (panel, inverter)',
        'State/local incentives',
        'Installation timelines',
        'Financing options'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects skepticism regarding "Battery Storage" costs or necessity',
      adaptation: 'Triggers a "Blackout Protection" scenario analysis showing grid reliability issues in their area',
      feedbackIntegration: 'Tracks which motivators (environmental, financial, independence) drive decisions'
    },
    
    tacticalExecution: {
      primaryAction: 'Design Quote',
      conversionRhythm: 'Moves the lead to provide a "Monthly Bill Average" to generate a custom savings report',
      secondaryActions: [
        'Satellite roof analysis',
        'Incentive calculator',
        'Battery backup consultation',
        'Financing pre-qualification',
        'System design visualization'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['google-business', 'news'],
        frequency: 'per-lead',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 300
      },

      highValueSignals: [
        {id: 'installation_count', label: 'High Installation Volume', description: 'Many systems installed', keywords: ["installations", "systems installed", "homes powered"], regexPattern: '([\\d,]+)\\+?\\s*(installations?|systems?)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'battery_storage', label: 'Battery Storage', description: 'Energy storage systems', keywords: ["battery", "energy storage", "powerwall", "battery backup"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'},
        {id: 'financing_options', label: 'Solar Financing', description: 'Financing programs', keywords: ["financing", "solar loan", "lease", "ppa", "power purchase"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'website'},
        {id: 'zero_down', label: 'Zero Down Payment', description: 'No upfront cost', keywords: ["zero down", "no money down", "no upfront cost", "$0 down"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'warranty', label: 'Long Warranty', description: 'Extended warranty period', keywords: ["warranty", "guarantee"], regexPattern: '(\\d+)\\s*year warranty', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'certifications', label: 'Industry Certifications', description: 'Professional credentials', keywords: ["nabcep", "certified", "accredited"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'monitoring', label: 'System Monitoring', description: 'Production monitoring', keywords: ["monitoring", "app", "track production", "performance monitoring"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'commercial_solar', label: 'Commercial Solar', description: 'Business/industrial systems', keywords: ["commercial", "business", "industrial", "commercial solar"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'hiring', label: 'Hiring Installers', description: 'Growing workforce', keywords: ["hiring", "solar installer", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 35, platform: 'any'},
        {id: 'expansion', label: 'Geographic Expansion', description: 'New markets', keywords: ["expanding", "now serving", "new location", "new market"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'ev_charging', label: 'EV Charger Installation', description: 'Electric vehicle charging', keywords: ["ev charger", "electric vehicle", "car charger"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'free_quote', label: 'Free Consultation', description: 'No obligation quote', keywords: ["free quote", "free consultation", "no obligation"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'production_guarantee', label: 'Production Guarantee', description: 'Energy production promise', keywords: ["production guarantee", "energy guarantee", "guaranteed savings"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'awards', label: 'Industry Recognition', description: 'Solar awards', keywords: ["award", "top solar", "best solar", "recognition"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'turnkey', label: 'Turnkey Service', description: 'Complete installation service', keywords: ["turnkey", "full service", "design to install", "permits included"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'licensed', pattern: 'licensed.*insured', description: 'License notice', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'financing', pattern: '^financing$', description: 'Financing', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'reviews', pattern: '^reviews$', description: 'Reviews', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'quote', pattern: '^quote$', description: 'Quote', context: 'header'},
        {id: 'calculator', pattern: '^calculator$', description: 'Calculator', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'}
      ],

      scoringRules: [
        {id: 'large_installer', name: 'Large Installer', description: 'High installation volume with hiring', condition: 'signals.some(s => s.signalId === "installation_count") && signals.some(s => s.signalId === "hiring")', scoreBoost: 50, priority: 1, enabled: true},
        {id: 'full_energy_solution', name: 'Full Energy Solution', description: 'Solar with battery storage', condition: 'signals.some(s => s.signalId === "battery_storage")', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'accessible_solar', name: 'Accessible Solar', description: 'Zero down with financing', condition: 'signals.some(s => s.signalId === "zero_down") && signals.some(s => s.signalId === "financing_options")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'growing_company', name: 'Growing Company', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 40, priority: 4, enabled: true},
        {id: 'commercial_residential', name: 'Commercial & Residential', description: 'Diversified services', condition: 'signals.some(s => s.signalId === "commercial_solar")', scoreBoost: 30, priority: 5, enabled: true},
        {id: 'ev_integration', name: 'EV Integration', description: 'Solar with EV charging', condition: 'signals.some(s => s.signalId === "ev_charging") && signals.some(s => s.signalId === "battery_storage")', scoreBoost: 28, priority: 6, enabled: true},
        {id: 'professional', name: 'Professional Installer', description: 'Certifications with warranty', condition: 'signals.some(s => s.signalId === "certifications") && signals.some(s => s.signalId === "warranty")', scoreBoost: 25, priority: 7, enabled: true},
        {id: 'tech_enabled', name: 'Technology-Enabled', description: 'Monitoring with modern systems', condition: 'signals.some(s => s.signalId === "monitoring")', scoreBoost: 18, priority: 8, enabled: true},
        {id: 'guaranteed_performance', name: 'Guaranteed Performance', description: 'Production guarantee available', condition: 'signals.some(s => s.signalId === "production_guarantee")', scoreBoost: 22, priority: 9, enabled: true},
        {id: 'recognized_installer', name: 'Recognized Installer', description: 'Awards with high volume', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "installation_count")', scoreBoost: 30, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'installations_completed', label: 'Installations Completed', type: 'number', description: 'Total systems installed', extractionHints: ['installations', 'systems'], required: false, defaultValue: 0},
        {key: 'offers_battery', label: 'Offers Battery Storage', type: 'boolean', description: 'Energy storage available', extractionHints: ['battery', 'storage'], required: false, defaultValue: false},
        {key: 'financing_types', label: 'Financing Types', type: 'array', description: 'Payment options', extractionHints: ['loan', 'lease', 'ppa'], required: false, defaultValue: []},
        {key: 'offers_commercial', label: 'Commercial Solar', type: 'boolean', description: 'Business installations', extractionHints: ['commercial'], required: false, defaultValue: false},
        {key: 'warranty_years', label: 'Warranty (Years)', type: 'number', description: 'System warranty', extractionHints: ['year warranty'], required: false, defaultValue: 25},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas', 'states'], required: false, defaultValue: []},
        {key: 'years_in_business', label: 'Years in Business', type: 'number', description: 'Company age', extractionHints: ['years', 'since'], required: false, defaultValue: 0}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Solar energy intelligence - focuses on installation volume, battery storage, financing accessibility, and business growth'
      }
    }
  },
  
  'hvac': {
    id: 'hvac',
    name: 'HVAC (Heating, Ventilation, Air Conditioning)',
    description: 'For HVAC companies - comfort and efficiency',
    category: 'Home Services',
    
    coreIdentity: {
      title: 'The Climate Comfort Expert',
      positioning: 'Reliable, technical, and urgency-aware',
      tone: 'Professional, responsive, solution-focused'
    },
    
    cognitiveLogic: {
      framework: 'The Efficiency-Loss Framework',
      reasoning: 'Logic that calculates how much money is being "leaked" through an old, inefficient SEER-rated unit',
      decisionProcess: 'Efficiency Audit → Cost Analysis → Upgrade ROI'
    },
    
    knowledgeRAG: {
      static: [
        'SEER ratings and efficiency standards',
        'MERV filter levels',
        'System sizing calculations',
        'Maintenance schedules',
        'Energy Star requirements'
      ],
      dynamic: [
        'Seasonal tune-up specials',
        'Available rebate programs (Energy Star, utility company)',
        'Emergency dispatch times',
        'Equipment pricing and options',
        'Financing programs',
        'Service area coverage'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Identifies "Recurring Repair" mentions (e.g., "it broke 3 times this year")',
      adaptation: 'Triggers a "Repair vs. Replace" cost-benefit logic showing total cost of continued repairs vs new system',
      feedbackIntegration: 'Learns which urgency triggers (no AC in summer, no heat in winter) require immediate emergency response'
    },
    
    tacticalExecution: {
      primaryAction: 'Dispatch/Estimate',
      conversionRhythm: 'Prioritizes immediate booking for "No-AC" or "No-Heat" emergencies, scheduled estimate for replacements',
      secondaryActions: [
        'Maintenance plan enrollment',
        'Energy audit',
        'Rebate assistance',
        'Financing application',
        'System upgrade consultation'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['linkedin-jobs', 'google-business'],
        frequency: 'per-lead',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 300
      },

      highValueSignals: [
        {
          id: 'hiring',
          label: 'Actively Hiring',
          description: 'Company is hiring technicians or service staff',
          keywords: ["we're hiring", "now hiring", "join our team", "careers", "technician wanted", "hvac jobs", "apply now"],
          priority: 'HIGH',
          action: 'increase-score',
          scoreBoost: 25,
          platform: 'any',
          examples: ["We're hiring HVAC technicians!", "Join our growing team"]
        },
        {
          id: 'expansion',
          label: 'Business Expansion',
          description: 'Opening new locations or expanding service area',
          keywords: ["new location", "expanding", "growth", "opening soon", "now serving", "service area expansion"],
          priority: 'CRITICAL',
          action: 'increase-score',
          scoreBoost: 40,
          platform: 'website',
          examples: ["Now serving Phoenix metro area", "Opening our 5th location"]
        },
        {
          id: 'emergency_service',
          label: '24/7 Emergency Service',
          description: 'Offers emergency HVAC services',
          keywords: ["24/7", "emergency service", "same day", "emergency repair", "after hours"],
          priority: 'MEDIUM',
          action: 'add-to-segment',
          scoreBoost: 15,
          platform: 'website'
        },
        {
          id: 'commercial_focus',
          label: 'Commercial HVAC',
          description: 'Serves commercial/industrial clients',
          keywords: ["commercial hvac", "industrial", "retail", "office buildings", "commercial clients"],
          priority: 'HIGH',
          action: 'add-to-segment',
          scoreBoost: 20,
          platform: 'website'
        },
        {
          id: 'residential_focus',
          label: 'Residential HVAC',
          description: 'Primarily residential services',
          keywords: ["residential", "homeowners", "home comfort", "family owned"],
          priority: 'MEDIUM',
          action: 'add-to-segment',
          scoreBoost: 10,
          platform: 'website'
        },
        {
          id: 'financing_available',
          label: 'Financing Options',
          description: 'Offers financing for equipment',
          keywords: ["financing available", "payment plans", "0% apr", "low monthly payments", "credit options"],
          priority: 'MEDIUM',
          action: 'increase-score',
          scoreBoost: 10,
          platform: 'website'
        },
        {
          id: 'maintenance_plans',
          label: 'Maintenance Plans',
          description: 'Offers recurring maintenance programs',
          keywords: ["maintenance plan", "service agreement", "tune-up plan", "preventive maintenance", "annual service"],
          priority: 'MEDIUM',
          action: 'increase-score',
          scoreBoost: 15,
          platform: 'website'
        },
        {
          id: 'certifications',
          label: 'Industry Certifications',
          description: 'Has NATE, EPA, or other certifications',
          keywords: ["nate certified", "epa certified", "licensed", "bonded", "insured", "carrier certified", "trane certified"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 5,
          platform: 'website'
        },
        {
          id: 'energy_efficiency',
          label: 'Energy Efficiency Focus',
          description: 'Emphasizes energy-efficient solutions',
          keywords: ["energy star", "high efficiency", "seer rating", "energy savings", "rebates", "utility savings"],
          priority: 'MEDIUM',
          action: 'increase-score',
          scoreBoost: 10,
          platform: 'website'
        },
        {
          id: 'smart_home',
          label: 'Smart Home Integration',
          description: 'Offers smart thermostat installation',
          keywords: ["smart thermostat", "nest", "ecobee", "wifi thermostat", "smart home", "iot"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 8,
          platform: 'website'
        },
        {
          id: 'fleet_size',
          label: 'Large Fleet',
          description: 'Has multiple service vehicles',
          keywords: ["fleet of", "trucks", "service vehicles", "team of technicians"],
          regexPattern: '(\\d+)\\s*(trucks?|vehicles?|vans?)',
          priority: 'HIGH',
          action: 'increase-score',
          scoreBoost: 20,
          platform: 'website'
        },
        {
          id: 'years_experience',
          label: 'Established Business',
          description: 'Long-standing company',
          keywords: ["years of experience", "established", "since", "family owned"],
          regexPattern: '(\\d+)\\+?\\s*years?\\s*(of\\s*)?(experience|in business)',
          priority: 'MEDIUM',
          action: 'increase-score',
          scoreBoost: 10,
          platform: 'website'
        },
        {
          id: 'awards',
          label: 'Industry Awards',
          description: 'Has won industry awards or recognition',
          keywords: ["award winning", "best of", "top rated", "angie's list", "homeadvisor", "bbb a+"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 5,
          platform: 'website'
        },
        {
          id: 'new_equipment',
          label: 'New Equipment Sales',
          description: 'Sells and installs new HVAC systems',
          keywords: ["new installation", "system replacement", "new hvac", "equipment sales"],
          priority: 'MEDIUM',
          action: 'add-to-segment',
          scoreBoost: 12,
          platform: 'website'
        },
        {
          id: 'repair_service',
          label: 'Repair Services',
          description: 'Offers HVAC repair services',
          keywords: ["repair", "service call", "fix", "troubleshoot", "diagnostic"],
          priority: 'MEDIUM',
          action: 'add-to-segment',
          scoreBoost: 10,
          platform: 'website'
        },
        {
          id: 'indoor_air_quality',
          label: 'Indoor Air Quality',
          description: 'Specializes in air quality solutions',
          keywords: ["indoor air quality", "air purification", "humidifier", "dehumidifier", "air filtration", "uv light"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 8,
          platform: 'website'
        },
        {
          id: 'ductwork',
          label: 'Ductwork Services',
          description: 'Offers duct cleaning or replacement',
          keywords: ["duct cleaning", "ductwork", "air duct", "duct repair", "duct sealing"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 5,
          platform: 'website'
        },
        {
          id: 'online_booking',
          label: 'Online Scheduling',
          description: 'Has online booking capability',
          keywords: ["schedule online", "book now", "online appointment", "instant booking"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 5,
          platform: 'website'
        },
        {
          id: 'job_postings',
          label: 'Active Job Postings',
          description: 'Has job listings on LinkedIn',
          keywords: ["hvac technician", "service technician", "installer", "comfort advisor"],
          priority: 'HIGH',
          action: 'increase-score',
          scoreBoost: 30,
          platform: 'linkedin-jobs'
        },
        {
          id: 'service_area_multiple',
          label: 'Multi-City Service Area',
          description: 'Services multiple cities or regions',
          keywords: ["serving", "service area", "we serve", "covering"],
          regexPattern: 'serv(e|ing)\\s+([A-Z][a-z]+\\s*,\\s*){2,}',
          priority: 'MEDIUM',
          action: 'increase-score',
          scoreBoost: 15,
          platform: 'website'
        }
      ],

      fluffPatterns: [
        { id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright notices', context: 'footer' },
        { id: 'all_rights', pattern: 'all rights reserved', description: 'Rights statement', context: 'footer' },
        { id: 'privacy_policy', pattern: 'privacy policy', description: 'Privacy policy link', context: 'footer' },
        { id: 'terms_conditions', pattern: 'terms (and|&) conditions', description: 'Terms link', context: 'footer' },
        { id: 'cookie_notice', pattern: 'we use cookies', description: 'Cookie banner', context: 'all' },
        { id: 'cookie_accept', pattern: '(accept|decline)\\s+(all\\s+)?cookies', description: 'Cookie buttons', context: 'all' },
        { id: 'cookie_policy', pattern: 'cookie policy', description: 'Cookie policy link', context: 'footer' },
        { id: 'social_media', pattern: 'follow us on (facebook|twitter|instagram|linkedin)', description: 'Social media links', context: 'footer' },
        { id: 'back_to_top', pattern: 'back to top', description: 'Back to top link', context: 'footer' },
        { id: 'site_map', pattern: 'site ?map', description: 'Sitemap link', context: 'footer' },
        { id: 'contact_us_footer', pattern: 'contact us', description: 'Contact link in footer', context: 'footer' },
        { id: 'about_us_footer', pattern: 'about us', description: 'About link in footer', context: 'footer' },
        { id: 'nav_menu', pattern: '(home|services|about|contact|gallery)\\s*\\|', description: 'Navigation menu', context: 'header' },
        { id: 'skip_to_content', pattern: 'skip to (main )?content', description: 'Accessibility link', context: 'header' },
        { id: 'search_box', pattern: 'search\\s*(our site)?', description: 'Search box placeholder', context: 'header' },
        { id: 'phone_call', pattern: 'click to call', description: 'Click to call button', context: 'all' },
        { id: 'get_quote', pattern: 'get (a |your )?free quote', description: 'Generic quote CTA', context: 'all' },
        { id: 'testimonial_star', pattern: '★{3,5}', description: 'Star ratings', context: 'all' },
        { id: 'read_more', pattern: 'read more|learn more', description: 'Read more links', context: 'all' },
        { id: 'accessibility', pattern: 'accessibility statement', description: 'Accessibility link', context: 'footer' },
        { id: 'california_privacy', pattern: 'california privacy rights', description: 'CCPA notice', context: 'footer' },
        { id: 'gdpr', pattern: 'gdpr|general data protection', description: 'GDPR notice', context: 'footer' },
        { id: 'powered_by', pattern: 'powered by|built by|designed by', description: 'Attribution', context: 'footer' },
        { id: 'login', pattern: 'customer (login|portal)', description: 'Login link', context: 'header' },
        { id: 'spam_protection', pattern: 'this site is protected by recaptcha', description: 'reCAPTCHA notice', context: 'footer' }
      ],

      scoringRules: [
        {
          id: 'hiring_with_careers_page',
          name: 'Hiring + Careers Page',
          description: 'Boost if actively hiring and has dedicated careers page',
          condition: 'signals.some(s => s.signalId === "hiring") && url.includes("/careers")',
          scoreBoost: 15,
          priority: 1,
          enabled: true
        },
        {
          id: 'expansion_with_multiple_locations',
          name: 'Expansion + Multi-Location',
          description: 'High growth indicator if expanding and already multi-location',
          condition: 'signals.some(s => s.signalId === "expansion") && signals.some(s => s.signalId === "service_area_multiple")',
          scoreBoost: 25,
          priority: 2,
          enabled: true
        },
        {
          id: 'commercial_with_fleet',
          name: 'Commercial + Large Fleet',
          description: 'Strong B2B prospect if commercial focus with large fleet',
          condition: 'signals.some(s => s.signalId === "commercial_focus") && signals.some(s => s.signalId === "fleet_size")',
          scoreBoost: 20,
          priority: 3,
          enabled: true
        },
        {
          id: 'established_with_awards',
          name: 'Established + Award-Winning',
          description: 'Premium prospect if long-standing and award-winning',
          condition: 'signals.some(s => s.signalId === "years_experience") && signals.some(s => s.signalId === "awards")',
          scoreBoost: 15,
          priority: 4,
          enabled: true
        },
        {
          id: 'full_service_provider',
          name: 'Full Service Provider',
          description: 'Offers new equipment, repair, and maintenance',
          condition: 'signals.some(s => s.signalId === "new_equipment") && signals.some(s => s.signalId === "repair_service") && signals.some(s => s.signalId === "maintenance_plans")',
          scoreBoost: 20,
          priority: 5,
          enabled: true
        },
        {
          id: 'modern_tech_stack',
          name: 'Modern Technology',
          description: 'Offers smart home and online booking',
          condition: 'signals.some(s => s.signalId === "smart_home") && signals.some(s => s.signalId === "online_booking")',
          scoreBoost: 10,
          priority: 6,
          enabled: true
        },
        {
          id: 'premium_services',
          name: 'Premium Service Offerings',
          description: 'Offers IAQ, ductwork, and energy efficiency',
          condition: 'signals.some(s => s.signalId === "indoor_air_quality") && signals.some(s => s.signalId === "energy_efficiency")',
          scoreBoost: 12,
          priority: 7,
          enabled: true
        },
        {
          id: 'emergency_certified',
          name: 'Emergency + Certified',
          description: '24/7 service with industry certifications',
          condition: 'signals.some(s => s.signalId === "emergency_service") && signals.some(s => s.signalId === "certifications")',
          scoreBoost: 10,
          priority: 8,
          enabled: true
        },
        {
          id: 'financing_and_maintenance',
          name: 'Financing + Maintenance Plans',
          description: 'Customer-friendly payment and service options',
          condition: 'signals.some(s => s.signalId === "financing_available") && signals.some(s => s.signalId === "maintenance_plans")',
          scoreBoost: 10,
          priority: 9,
          enabled: true
        },
        {
          id: 'linkedin_activity',
          name: 'Active on LinkedIn',
          description: 'Has recent job postings on LinkedIn',
          condition: 'signals.some(s => s.signalId === "job_postings" && s.platform === "linkedin-jobs")',
          scoreBoost: 20,
          priority: 10,
          enabled: true
        }
      ],

      customFields: [
        {
          key: 'hiring_count',
          label: 'Number of Open Positions',
          type: 'number',
          description: 'Count of active job openings',
          extractionHints: ['hiring', 'positions', 'openings', 'join our team'],
          required: false,
          defaultValue: 0
        },
        {
          key: 'service_area_cities',
          label: 'Service Area Cities',
          type: 'array',
          description: 'List of cities in service area',
          extractionHints: ['serving', 'service area', 'we serve', 'covering'],
          required: false,
          defaultValue: []
        },
        {
          key: 'years_in_business',
          label: 'Years in Business',
          type: 'number',
          description: 'How long company has been operating',
          extractionHints: ['years of experience', 'since', 'established'],
          required: false,
          defaultValue: 0
        },
        {
          key: 'fleet_size',
          label: 'Number of Service Vehicles',
          type: 'number',
          description: 'Size of service vehicle fleet',
          extractionHints: ['trucks', 'vehicles', 'fleet', 'service vans'],
          required: false,
          defaultValue: 0
        },
        {
          key: 'has_emergency_service',
          label: 'Offers 24/7 Emergency',
          type: 'boolean',
          description: 'Whether company offers emergency service',
          extractionHints: ['24/7', 'emergency', 'after hours'],
          required: false,
          defaultValue: false
        },
        {
          key: 'has_financing',
          label: 'Offers Financing',
          type: 'boolean',
          description: 'Whether financing is available',
          extractionHints: ['financing', 'payment plans', '0% apr'],
          required: false,
          defaultValue: false
        },
        {
          key: 'certifications',
          label: 'Industry Certifications',
          type: 'array',
          description: 'List of certifications (NATE, EPA, etc)',
          extractionHints: ['certified', 'licensed', 'bonded', 'insured'],
          required: false,
          defaultValue: []
        },
        {
          key: 'primary_focus',
          label: 'Primary Business Focus',
          type: 'string',
          description: 'Residential, Commercial, or Both',
          extractionHints: ['residential', 'commercial', 'homeowners', 'business'],
          required: false,
          defaultValue: 'unknown'
        },
        {
          key: 'has_maintenance_plans',
          label: 'Offers Maintenance Plans',
          type: 'boolean',
          description: 'Whether recurring maintenance programs offered',
          extractionHints: ['maintenance plan', 'service agreement', 'tune-up'],
          required: false,
          defaultValue: false
        },
        {
          key: 'location_count',
          label: 'Number of Locations',
          type: 'number',
          description: 'How many physical locations',
          extractionHints: ['locations', 'offices', 'branches'],
          required: false,
          defaultValue: 1
        }
      ],

      metadata: {
        lastUpdated: '2025-12-28',
        version: 1,
        updatedBy: 'system',
        notes: 'HVAC industry research intelligence - focuses on growth indicators (hiring, expansion), service offerings (emergency, commercial, residential), and modern capabilities (smart home, online booking)'
      }
    }
  },
  
  'roofing': {
    id: 'roofing',
    name: 'Roofing',
    description: 'For roofers - protection and insurance navigation',
    category: 'Home Services',
    
    coreIdentity: {
      title: 'The Property Protector',
      positioning: 'Honest, rugged, and insurance-literate',
      tone: 'Straightforward, protective, knowledgeable'
    },
    
    cognitiveLogic: {
      framework: 'The "Hidden Damage" Logic',
      reasoning: 'Focuses on the risks of waiting (mold, structural rot, interior damage) to drive urgency before a major leak occurs',
      decisionProcess: 'Risk Assessment → Damage Prevention → Protective Action'
    },
    
    knowledgeRAG: {
      static: [
        'Shingle types (Asphalt, Metal, Tile)',
        'Wind-speed ratings',
        'Roof ventilation principles',
        'Flashing and waterproofing',
        'Warranty structures'
      ],
      dynamic: [
        'Storm history data for {service_area}',
        'Insurance claim assistance protocols',
        'Material availability and pricing',
        'Current promotions',
        'Emergency repair availability',
        'Financing options'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects "Insurance Claim" keywords (storm damage, hail, wind)',
      adaptation: 'Shifts the logic to "Documentation and Claims Support" mode, emphasizing free inspection and claim assistance',
      feedbackIntegration: 'Tracks which value propositions (warranty length, insurance help, financing) close deals'
    },
    
    tacticalExecution: {
      primaryAction: 'Drone/Physical Inspection',
      conversionRhythm: 'Focuses on booking a free roof health assessment with photo documentation',
      secondaryActions: [
        'Insurance claim assistance',
        'Storm damage documentation',
        'Repair vs. replacement analysis',
        'Material selection consultation',
        'Financing pre-approval'
      ]
    },

    research: {
      scrapingStrategy: {primarySource: 'website', secondarySources: ['linkedin-jobs', 'google-business'], frequency: 'per-lead', timeoutMs: 30000, enableCaching: true, cacheTtlSeconds: 300},
      highValueSignals: [
        {id: 'hiring', label: 'Hiring Roofers', description: 'Recruiting roofing crews', keywords: ["hiring", "join our team", "roofer wanted", "crew positions"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'storm_chasing', label: 'Storm Damage Services', description: 'Storm damage specialist', keywords: ["storm damage", "hail damage", "wind damage", "emergency repair"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'insurance_claims', label: 'Insurance Claims Help', description: 'Assists with insurance', keywords: ["insurance", "claims assistance", "work with insurance", "free inspection"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'financing', label: 'Financing Available', description: 'Offers payment plans', keywords: ["financing", "payment plans", "0% apr", "no money down"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'warranty', label: 'Warranty Offered', description: 'Warranty on workmanship', keywords: ["lifetime warranty", "year warranty", "guaranteed"], regexPattern: '(\\d+)[-\\s]year warranty', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'free_inspection', label: 'Free Inspections', description: 'No-cost roof inspection', keywords: ["free inspection", "free estimate", "no obligation"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'certifications', label: 'Manufacturer Certified', description: 'Factory certified installer', keywords: ["certified", "owens corning", "gaf", "certainteed", "manufacturer"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'emergency_service', label: 'Emergency Services', description: '24/7 emergency repairs', keywords: ["emergency", "24/7", "emergency repair", "immediate response"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'commercial_roofing', label: 'Commercial Roofing', description: 'Commercial projects', keywords: ["commercial", "flat roof", "tpo", "epdm"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'metal_roofing', label: 'Metal Roofing', description: 'Metal roof specialist', keywords: ["metal roof", "standing seam", "metal roofing"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'years_experience', label: 'Years in Business', description: 'Established company', keywords: ["years", "since", "established"], regexPattern: '(\\d+)\\+?\\s*years?', priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'}
      ],
      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy link', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms link', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social links', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back link', context: 'footer'}
      ],
      scoringRules: [
        {id: 'insurance_specialist', name: 'Insurance Specialist', description: 'Storm damage + insurance claims', condition: 'signals.some(s => s.signalId === "storm_chasing") && signals.some(s => s.signalId === "insurance_claims")', scoreBoost: 30, priority: 1, enabled: true},
        {id: 'growing_company', name: 'Growing Company', description: 'Hiring + certifications', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "certifications")', scoreBoost: 25, priority: 2, enabled: true},
        {id: 'full_service', name: 'Full Service', description: 'Residential + commercial + emergency', condition: 'signals.some(s => s.signalId === "commercial_roofing") && signals.some(s => s.signalId === "emergency_service")', scoreBoost: 20, priority: 3, enabled: true}
      ],
      customFields: [
        {key: 'crew_count', label: 'Number of Crews', type: 'number', description: 'Size of roofing crews', extractionHints: ['crews', 'teams'], required: false, defaultValue: 0},
        {key: 'warranty_years', label: 'Warranty Length', type: 'number', description: 'Years of warranty', extractionHints: ['warranty', 'guaranteed'], required: false, defaultValue: 0},
        {key: 'handles_insurance', label: 'Works with Insurance', type: 'boolean', description: 'Insurance claims help', extractionHints: ['insurance', 'claims'], required: false, defaultValue: false},
        {key: 'has_financing', label: 'Offers Financing', type: 'boolean', description: 'Payment plans', extractionHints: ['financing', 'payment plans'], required: false, defaultValue: false},
        {key: 'roofing_types', label: 'Roof Types', type: 'array', description: 'Types of roofing', extractionHints: ['shingle', 'metal', 'tile', 'flat'], required: false, defaultValue: []}
      ],
      metadata: {lastUpdated: '2025-12-28', version: 1, updatedBy: 'system', notes: 'Roofing intelligence - insurance claims, storm damage, growth indicators'}
    }
  },
  
  'landscaping-hardscaping': {
    id: 'landscaping-hardscaping',
    name: 'Landscaping & Hardscaping',
    description: 'For landscapers - outdoor living and curb appeal',
    category: 'Home Services',
    
    coreIdentity: {
      title: 'The Outdoor Living Designer',
      positioning: 'Creative, earthy, and "Curb Appeal" focused',
      tone: 'Enthusiastic, collaborative, design-oriented'
    },
    
    cognitiveLogic: {
      framework: 'The Asset Enhancement Model',
      reasoning: 'Logic that treats the yard as an "Additional Room" of the house, increasing usable square footage and home value',
      decisionProcess: 'Vision Discovery → Functional Enhancement → Value Creation'
    },
    
    knowledgeRAG: {
      static: [
        'Regional plant hardiness zones',
        'Drainage and grading principles',
        'Hardscape materials (pavers, stone, concrete)',
        'Irrigation system types',
        'Sustainable landscaping'
      ],
      dynamic: [
        'Portfolio of "Before/After" projects',
        'Material costs (Pavers vs. Decking vs. Natural Stone)',
        'Seasonal planting schedules',
        'Design trends',
        'Project timelines',
        'Maintenance packages'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Analyzes lead "Maintenance Fears" (time commitment, water usage, upkeep)',
      adaptation: 'Suggests "Xeriscaping" (low-water/low-care) or "Native Plants" alternatives to close the deal',
      feedbackIntegration: 'Tracks which project types (patios, outdoor kitchens, fire pits) have highest satisfaction'
    },
    
    tacticalExecution: {
      primaryAction: 'On-Site Design Consultation',
      conversionRhythm: 'Every chat pushes for a physical walk-through to provide a custom design and quote',
      secondaryActions: [
        '3D design rendering',
        'Material samples provision',
        'Phased project planning',
        'Maintenance plan options',
        'Financing consultation'
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
        {id: 'design_build', label: 'Design-Build Services', description: 'Full-service design and install', keywords: ["design build", "design and install", "full service", "concept to completion"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'portfolio', label: 'Project Portfolio', description: 'Extensive before/after gallery', keywords: ["portfolio", "before and after", "projects", "gallery"], regexPattern: '(\\d{2,})\\+?\\s*projects?', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'hardscaping', label: 'Hardscaping Services', description: 'Pavers, patios, walls', keywords: ["hardscape", "hardscaping", "pavers", "patio", "retaining wall", "stone work"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'outdoor_living', label: 'Outdoor Living Spaces', description: 'Complete outdoor rooms', keywords: ["outdoor living", "outdoor kitchen", "fire pit", "pergola", "outdoor room"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'irrigation', label: 'Irrigation Services', description: 'Sprinkler system installation', keywords: ["irrigation", "sprinkler", "drip system", "automated watering"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'maintenance', label: 'Maintenance Services', description: 'Ongoing care programs', keywords: ["maintenance", "lawn care", "mowing", "seasonal"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'lighting', label: 'Landscape Lighting', description: 'Outdoor lighting design', keywords: ["lighting", "landscape lighting", "outdoor lighting", "led"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'commercial', label: 'Commercial Landscaping', description: 'Business property services', keywords: ["commercial", "commercial landscaping", "hoa", "property management"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'hiring', label: 'Hiring Crew', description: 'Growing team', keywords: ["hiring", "join our team", "careers", "landscaper positions"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Service Area Expansion', description: 'New markets', keywords: ["expanding", "now serving", "new service area"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'awards', label: 'Industry Awards', description: 'Recognition or certifications', keywords: ["award", "best of", "certified landscape", "landscape excellence"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'sustainable', label: 'Sustainable Landscaping', description: 'Eco-friendly practices', keywords: ["sustainable", "native plants", "xeriscape", "water-wise", "eco-friendly"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'financing', label: 'Financing Options', description: 'Project financing available', keywords: ["financing", "payment plans", "greensky", "financeit"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: '3d_design', label: '3D Design Services', description: 'Virtual design renderings', keywords: ["3d design", "rendering", "visualization", "virtual design"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'crew_size', label: 'Large Crew', description: 'Substantial workforce', keywords: ["crew", "team"], regexPattern: '(\\d+)\\+?\\s*(crew|employees?|team members?)', priority: 'HIGH', action: 'increase-score', scoreBoost: 20, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'licensed', pattern: 'licensed.*insured', description: 'License notice', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'gallery', pattern: '^gallery$', description: 'Gallery', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'quote', pattern: '^(free )?quote$', description: 'Quote', context: 'header'},
        {id: 'estimate', pattern: '^estimate$', description: 'Estimate', context: 'header'},
        {id: 'areas', pattern: '^areas served$', description: 'Areas', context: 'header'}
      ],

      scoringRules: [
        {id: 'full_service', name: 'Full-Service Provider', description: 'Design-build with hardscaping', condition: 'signals.some(s => s.signalId === "design_build") && signals.some(s => s.signalId === "hardscaping")', scoreBoost: 40, priority: 1, enabled: true},
        {id: 'outdoor_living_specialist', name: 'Outdoor Living Specialist', description: 'Outdoor living with 3D design', condition: 'signals.some(s => s.signalId === "outdoor_living") && signals.some(s => s.signalId === "3d_design")', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'growing_company', name: 'Growing Company', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'comprehensive_services', name: 'Comprehensive Services', description: 'Design, hardscaping, and maintenance', condition: 'signals.filter(s => ["design_build", "hardscaping", "maintenance"].includes(s.signalId)).length >= 3', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'commercial_residential', name: 'Commercial & Residential', description: 'Diversified client base', condition: 'signals.some(s => s.signalId === "commercial")', scoreBoost: 25, priority: 5, enabled: true},
        {id: 'premium_services', name: 'Premium Services', description: 'Outdoor living with lighting', condition: 'signals.some(s => s.signalId === "outdoor_living") && signals.some(s => s.signalId === "lighting")', scoreBoost: 28, priority: 6, enabled: true},
        {id: 'large_operator', name: 'Large Operator', description: 'Large crew with portfolio', condition: 'signals.some(s => s.signalId === "crew_size") && signals.some(s => s.signalId === "portfolio")', scoreBoost: 30, priority: 7, enabled: true},
        {id: 'recognized_business', name: 'Recognized Business', description: 'Awards with proven results', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "portfolio")', scoreBoost: 25, priority: 8, enabled: true},
        {id: 'sustainable_focus', name: 'Sustainable Focus', description: 'Eco-friendly with irrigation', condition: 'signals.some(s => s.signalId === "sustainable") && signals.some(s => s.signalId === "irrigation")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'accessible', name: 'Accessible Services', description: 'Financing with design services', condition: 'signals.some(s => s.signalId === "financing") && signals.some(s => s.signalId === "3d_design")', scoreBoost: 18, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'crew_size', label: 'Crew Size', type: 'number', description: 'Number of workers', extractionHints: ['crew', 'employees', 'team'], required: false, defaultValue: 1},
        {key: 'services_offered', label: 'Services Offered', type: 'array', description: 'Service types', extractionHints: ['hardscape', 'irrigation', 'lighting', 'maintenance'], required: false, defaultValue: []},
        {key: 'specialization', label: 'Service Specialization', type: 'string', description: 'Primary focus', extractionHints: ['hardscape', 'softscape', 'maintenance'], required: false, defaultValue: 'general'},
        {key: 'offers_design', label: 'Offers Design Services', type: 'boolean', description: '3D design available', extractionHints: ['design', '3d'], required: false, defaultValue: false},
        {key: 'commercial_work', label: 'Does Commercial Work', type: 'boolean', description: 'Commercial clients', extractionHints: ['commercial'], required: false, defaultValue: false},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas'], required: false, defaultValue: []},
        {key: 'years_in_business', label: 'Years in Business', type: 'number', description: 'Company age', extractionHints: ['years', 'since', 'established'], required: false, defaultValue: 0}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Landscaping & hardscaping intelligence - focuses on service breadth, design capabilities, portfolio quality, and business growth'
      }
    }
  },
  
  'plumbing': {
    id: 'plumbing',
    name: 'Plumbing',
    description: 'For plumbers - emergency response and problem solving',
    category: 'Home Services',
    
    coreIdentity: {
      title: 'The Emergency Problem-Solver',
      positioning: 'Direct, clean, and dependable',
      tone: 'Straightforward, calm under pressure, trustworthy'
    },
    
    cognitiveLogic: {
      framework: 'The Damage-Mitigation Model',
      reasoning: 'Logic that prioritizes stopping the "Flow of Loss" (water damage, flooding) above all else',
      decisionProcess: 'Emergency Triage → Damage Control → Permanent Fix'
    },
    
    knowledgeRAG: {
      static: [
        'Pipe materials (PEX, Copper, PVC)',
        'Water heater types (Tankless vs. Traditional)',
        'Drain cleaning methods',
        'Fixture installation standards',
        'Code requirements'
      ],
      dynamic: [
        'Licensed plumber IDs and certifications',
        '"Clear-Price" service menus',
        'Emergency service availability (24/7)',
        'Parts availability',
        'Service area response times',
        'Warranty details'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks if leads are asking about "Repiping" or "Multiple Repairs" frequently',
      adaptation: 'Suggests a "Home Health Membership" or "Preventative Maintenance Plan" to prevent future bursts',
      feedbackIntegration: 'Learns which emergency indicators (burst pipe, no hot water, backed up drain) require immediate dispatch'
    },
    
    tacticalExecution: {
      primaryAction: 'Technician Dispatch',
      conversionRhythm: 'Focuses on getting an address and a "Window of Arrival" for service call',
      secondaryActions: [
        'Emergency shutoff instructions',
        'Service pricing estimate',
        'Maintenance plan enrollment',
        'Water heater replacement quote',
        'Repiping consultation'
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
        {id: 'emergency_24_7', label: '24/7 Emergency Service', description: 'Round-the-clock availability', keywords: ["24/7", "24 hour", "emergency", "emergency plumbing", "after hours"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'licensed_plumbers', label: 'Licensed Plumbers', description: 'State licensed technicians', keywords: ["licensed", "certified", "insured", "bonded"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'drain_cleaning', label: 'Drain Cleaning', description: 'Drain/sewer services', keywords: ["drain cleaning", "sewer", "hydro jetting", "camera inspection"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'water_heater', label: 'Water Heater Services', description: 'Installation and repair', keywords: ["water heater", "tankless", "hot water", "water heater repair"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'repiping', label: 'Repiping Services', description: 'Whole-house repiping', keywords: ["repipe", "repiping", "whole house", "pipe replacement"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'leak_detection', label: 'Leak Detection', description: 'Advanced leak detection', keywords: ["leak detection", "find leaks", "electronic leak", "slab leak"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'maintenance_plan', label: 'Maintenance Plans', description: 'Preventative service programs', keywords: ["maintenance plan", "membership", "service plan", "protection plan"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'commercial_plumbing', label: 'Commercial Plumbing', description: 'Business services', keywords: ["commercial", "commercial plumbing", "business", "industrial"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'hiring', label: 'Hiring Plumbers', description: 'Growing team', keywords: ["hiring", "plumber jobs", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Service Expansion', description: 'New service areas', keywords: ["expanding", "now serving", "new location"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'fleet_size', label: 'Large Fleet', description: 'Multiple service vehicles', keywords: ["trucks", "vehicles", "fleet"], regexPattern: '(\\d+)\\+?\\s*(trucks?|vehicles?)', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'upfront_pricing', label: 'Upfront Pricing', description: 'Transparent pricing', keywords: ["upfront pricing", "flat rate", "no surprise", "straight forward pricing"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'warranty', label: 'Warranty/Guarantee', description: 'Work guarantee', keywords: ["warranty", "guarantee", "satisfaction guaranteed"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'financing', label: 'Financing Available', description: 'Payment options', keywords: ["financing", "payment plans", "credit"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'same_day', label: 'Same-Day Service', description: 'Quick response time', keywords: ["same day", "today", "immediate"], priority: 'HIGH', action: 'increase-score', scoreBoost: 20, platform: 'website'}
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
        {id: 'emergency', pattern: '^emergency$', description: 'Emergency link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'coupons', pattern: '^coupons$', description: 'Coupons', context: 'header'},
        {id: 'reviews', pattern: '^reviews$', description: 'Reviews', context: 'header'},
        {id: 'financing', pattern: '^financing$', description: 'Financing', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'areas', pattern: '^areas served$', description: 'Areas', context: 'header'}
      ],

      scoringRules: [
        {id: 'emergency_ready', name: 'Emergency Ready', description: '24/7 service with same-day', condition: 'signals.some(s => s.signalId === "emergency_24_7") && signals.some(s => s.signalId === "same_day")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'large_operation', name: 'Large Operation', description: 'Large fleet with licensed plumbers', condition: 'signals.some(s => s.signalId === "fleet_size") && signals.some(s => s.signalId === "licensed_plumbers")', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'growing_company', name: 'Growing Company', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'full_service', name: 'Full-Service Plumber', description: 'Multiple service types', condition: 'signals.filter(s => ["drain_cleaning", "water_heater", "repiping", "leak_detection"].includes(s.signalId)).length >= 3', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'commercial_residential', name: 'Commercial & Residential', description: 'Diversified services', condition: 'signals.some(s => s.signalId === "commercial_plumbing")', scoreBoost: 25, priority: 5, enabled: true},
        {id: 'premium_service', name: 'Premium Service', description: 'Maintenance plans with upfront pricing', condition: 'signals.some(s => s.signalId === "maintenance_plan") && signals.some(s => s.signalId === "upfront_pricing")', scoreBoost: 22, priority: 6, enabled: true},
        {id: 'trusted_provider', name: 'Trusted Provider', description: 'Licensed with warranty', condition: 'signals.some(s => s.signalId === "licensed_plumbers") && signals.some(s => s.signalId === "warranty")', scoreBoost: 20, priority: 7, enabled: true},
        {id: 'accessible', name: 'Accessible Service', description: 'Financing with upfront pricing', condition: 'signals.some(s => s.signalId === "financing") && signals.some(s => s.signalId === "upfront_pricing")', scoreBoost: 18, priority: 8, enabled: true},
        {id: 'specialized', name: 'Specialized Services', description: 'Advanced capabilities', condition: 'signals.some(s => s.signalId === "leak_detection") || signals.some(s => s.signalId === "repiping")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'recurring_revenue', name: 'Recurring Revenue Model', description: 'Maintenance plans available', condition: 'signals.some(s => s.signalId === "maintenance_plan")', scoreBoost: 18, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'has_24_7_emergency', label: '24/7 Emergency', type: 'boolean', description: 'Emergency service available', extractionHints: ['24/7', 'emergency'], required: false, defaultValue: false},
        {key: 'technician_count', label: 'Number of Plumbers', type: 'number', description: 'Licensed plumbers', extractionHints: ['plumbers', 'technicians'], required: false, defaultValue: 1},
        {key: 'services_offered', label: 'Services Offered', type: 'array', description: 'Service types', extractionHints: ['drain', 'water heater', 'repipe', 'leak'], required: false, defaultValue: []},
        {key: 'offers_commercial', label: 'Commercial Services', type: 'boolean', description: 'Business clients', extractionHints: ['commercial'], required: false, defaultValue: false},
        {key: 'has_maintenance_plan', label: 'Maintenance Plan', type: 'boolean', description: 'Membership program', extractionHints: ['maintenance plan', 'membership'], required: false, defaultValue: false},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas'], required: false, defaultValue: []},
        {key: 'years_in_business', label: 'Years in Business', type: 'number', description: 'Company age', extractionHints: ['years', 'since'], required: false, defaultValue: 0}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Plumbing intelligence - focuses on emergency capabilities, fleet size, service breadth, and recurring revenue models'
      }
    }
  },
  
  'pest-control': {
    id: 'pest-control',
    name: 'Pest Control',
    description: 'For exterminators - prevention and safety',
    category: 'Home Services',
    
    coreIdentity: {
      title: 'The Household Defender',
      positioning: 'Clinical, thorough, and reassuring',
      tone: 'Professional, methodical, safety-conscious'
    },
    
    cognitiveLogic: {
      framework: 'The Prevention-Cycle Model',
      reasoning: 'Logic that shifts the sale from a "One-time Spray" to a "Quarterly Barrier" for long-term safety and prevention',
      decisionProcess: 'Infestation Assessment → Treatment → Prevention Plan'
    },
    
    knowledgeRAG: {
      static: [
        'Pest lifecycles (Termites, Ants, Rodents, Roaches)',
        'Pet-safe and eco-friendly chemical data',
        'IPM (Integrated Pest Management)',
        'Termite inspection standards',
        'Safety protocols'
      ],
      dynamic: [
        'Seasonal pest surges in {service_area}',
        '"Re-treatment" guarantees',
        'Service packages (one-time vs quarterly)',
        'Eco-friendly treatment options',
        'Emergency availability',
        'Inspection scheduling'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Monitors "Safety Concerns" regarding children, pets, or organic preferences',
      adaptation: 'Prioritizes "Eco-Friendly/Non-Toxic" messaging in the pitch and treatment recommendations',
      feedbackIntegration: 'Tracks which pest types (termites, rodents, ants) drive quarterly plan signup vs one-time treatments'
    },
    
    tacticalExecution: {
      primaryAction: 'Service Initial',
      conversionRhythm: 'Focuses on booking the first "Flush-out" treatment and transitioning to quarterly prevention plan',
      secondaryActions: [
        'Free inspection scheduling',
        'Termite inspection',
        'Quarterly plan enrollment',
        'Eco-friendly treatment consultation',
        'Service guarantee explanation'
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
        {id: 'quarterly_plans', label: 'Quarterly/Annual Plans', description: 'Recurring service programs', keywords: ["quarterly", "annual plan", "year-round", "recurring", "subscription"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'termite_specialist', label: 'Termite Services', description: 'Termite inspection/treatment', keywords: ["termite", "termite inspection", "termite treatment", "termite bond"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'},
        {id: 'eco_friendly', label: 'Eco-Friendly/Green', description: 'Organic or green pest control', keywords: ["eco-friendly", "organic", "green", "natural", "pet safe"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'commercial_pest', label: 'Commercial Pest Control', description: 'Business services', keywords: ["commercial", "business", "restaurant", "warehouse", "commercial pest"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'same_day', label: 'Same-Day Service', description: 'Rapid response', keywords: ["same day", "today", "emergency", "immediate"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'guarantee', label: 'Service Guarantee', description: 'Re-treatment guarantee', keywords: ["guarantee", "free re-treatment", "satisfaction guarantee", "warranty"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'rodent_control', label: 'Rodent Control', description: 'Mouse/rat services', keywords: ["rodent", "mice", "rats", "rodent control"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'bed_bugs', label: 'Bed Bug Treatment', description: 'Bed bug specialists', keywords: ["bed bugs", "bed bug", "heat treatment"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'wildlife_removal', label: 'Wildlife Removal', description: 'Animal removal services', keywords: ["wildlife", "animal removal", "raccoon", "squirrel", "bat"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'hiring', label: 'Hiring Technicians', description: 'Growing team', keywords: ["hiring", "technician jobs", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Service Expansion', description: 'New service areas', keywords: ["expanding", "now serving", "new location"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'free_inspection', label: 'Free Inspection', description: 'Complimentary inspection', keywords: ["free inspection", "free estimate", "no charge inspection"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'licensed_certified', label: 'Licensed & Certified', description: 'Professional credentials', keywords: ["licensed", "certified", "insured", "bonded"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'family_owned', label: 'Family Owned', description: 'Local family business', keywords: ["family owned", "locally owned", "family business"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 8, platform: 'website'},
        {id: 'years_experience', label: 'Established Company', description: 'Long operating history', keywords: ["years", "since", "established"], regexPattern: '(\\d+)\\+?\\s*years?', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'licensed', pattern: 'licensed.*insured', description: 'License notice', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'pests', pattern: '^pests$', description: 'Pests link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'coupons', pattern: '^coupons$', description: 'Coupons', context: 'header'},
        {id: 'reviews', pattern: '^reviews$', description: 'Reviews', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'areas', pattern: '^areas served$', description: 'Areas', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'}
      ],

      scoringRules: [
        {id: 'recurring_revenue_model', name: 'Recurring Revenue Model', description: 'Quarterly plans with guarantee', condition: 'signals.some(s => s.signalId === "quarterly_plans") && signals.some(s => s.signalId === "guarantee")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'full_service', name: 'Full-Service Provider', description: 'Multiple pest types covered', condition: 'signals.filter(s => ["termite_specialist", "rodent_control", "bed_bugs"].includes(s.signalId)).length >= 2', scoreBoost: 30, priority: 2, enabled: true},
        {id: 'growing_company', name: 'Growing Company', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'emergency_ready', name: 'Emergency Ready', description: 'Same-day with guarantee', condition: 'signals.some(s => s.signalId === "same_day") && signals.some(s => s.signalId === "guarantee")', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'eco_conscious', name: 'Eco-Conscious Provider', description: 'Green pest control', condition: 'signals.some(s => s.signalId === "eco_friendly")', scoreBoost: 20, priority: 5, enabled: true},
        {id: 'commercial_residential', name: 'Commercial & Residential', description: 'Diversified client base', condition: 'signals.some(s => s.signalId === "commercial_pest")', scoreBoost: 25, priority: 6, enabled: true},
        {id: 'termite_expert', name: 'Termite Expert', description: 'Termite specialist with guarantee', condition: 'signals.some(s => s.signalId === "termite_specialist") && signals.some(s => s.signalId === "guarantee")', scoreBoost: 28, priority: 7, enabled: true},
        {id: 'accessible', name: 'Accessible Service', description: 'Free inspection available', condition: 'signals.some(s => s.signalId === "free_inspection")', scoreBoost: 15, priority: 8, enabled: true},
        {id: 'established', name: 'Established Business', description: 'Years of experience with licensing', condition: 'signals.some(s => s.signalId === "years_experience") && signals.some(s => s.signalId === "licensed_certified")', scoreBoost: 18, priority: 9, enabled: true},
        {id: 'wildlife_specialist', name: 'Wildlife Specialist', description: 'Wildlife removal with pest control', condition: 'signals.some(s => s.signalId === "wildlife_removal")', scoreBoost: 15, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'has_quarterly_plans', label: 'Quarterly Plans', type: 'boolean', description: 'Recurring service available', extractionHints: ['quarterly', 'annual'], required: false, defaultValue: false},
        {key: 'services_offered', label: 'Services Offered', type: 'array', description: 'Pest types treated', extractionHints: ['termite', 'rodent', 'bed bug', 'ant'], required: false, defaultValue: []},
        {key: 'is_eco_friendly', label: 'Eco-Friendly Options', type: 'boolean', description: 'Green pest control', extractionHints: ['eco-friendly', 'organic'], required: false, defaultValue: false},
        {key: 'offers_commercial', label: 'Commercial Services', type: 'boolean', description: 'Business clients', extractionHints: ['commercial'], required: false, defaultValue: false},
        {key: 'has_guarantee', label: 'Service Guarantee', type: 'boolean', description: 'Re-treatment guarantee', extractionHints: ['guarantee'], required: false, defaultValue: false},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas'], required: false, defaultValue: []},
        {key: 'years_in_business', label: 'Years in Business', type: 'number', description: 'Company age', extractionHints: ['years', 'since'], required: false, defaultValue: 0}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Pest control intelligence - focuses on recurring revenue models, service breadth, eco-friendly options, and response capabilities'
      }
    }
  },
  
  'house-cleaning': {
    id: 'house-cleaning',
    name: 'House Cleaning',
    description: 'For cleaning services - time savings and trust',
    category: 'Home Services',
    
    coreIdentity: {
      title: 'The "Gift of Time" Provider',
      positioning: 'Meticulous, trustworthy, and detail-oriented',
      tone: 'Friendly, reliable, attentive'
    },
    
    cognitiveLogic: {
      framework: 'The Mental-Bandwidth Model',
      reasoning: 'Logic that sells the feeling of a clean home and the time saved for the owner (freedom from chores)',
      decisionProcess: 'Time Value → Clean Home Benefits → Recurring Commitment'
    },
    
    knowledgeRAG: {
      static: [
        'Sanitization standards',
        'Common allergen removal',
        'Cleaning product safety',
        'Deep clean vs. standard checklists',
        'Eco-friendly cleaning options'
      ],
      dynamic: [
        'Checklist of "Deep Clean" vs. "Standard" services',
        'Available time slots',
        '"Background Checked" staff badges',
        'Pricing by home size',
        'Recurring discount structures',
        'Special requests accommodation'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks "Frequency Hesitation" (weekly vs bi-weekly vs monthly)',
      adaptation: 'Triggers a "Recurring Discount" logic showing cost savings of weekly vs monthly to secure long-term revenue',
      feedbackIntegration: 'Learns which service add-ons (laundry, dishes, organization) increase customer lifetime value'
    },
    
    tacticalExecution: {
      primaryAction: 'Instant Quote',
      conversionRhythm: 'Uses "Number of Bedrooms/Bathrooms" to provide an immediate price and "First Clean" discount',
      secondaryActions: [
        'Service customization',
        'Background check verification',
        'Recurring schedule setup',
        'Special instructions collection',
        'Referral program enrollment'
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
        {id: 'recurring_plans', label: 'Recurring Cleaning Plans', description: 'Weekly/bi-weekly service', keywords: ["weekly", "bi-weekly", "recurring", "regular cleaning", "subscription"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'background_checked', label: 'Background Checked Staff', description: 'Screened employees', keywords: ["background check", "vetted", "screened", "insured", "bonded"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'eco_friendly', label: 'Eco-Friendly Cleaning', description: 'Green cleaning products', keywords: ["eco-friendly", "green cleaning", "organic", "non-toxic", "chemical-free"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'deep_cleaning', label: 'Deep Cleaning', description: 'Comprehensive deep cleans', keywords: ["deep clean", "deep cleaning", "move in", "move out", "spring cleaning"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'same_day', label: 'Same-Day Service', description: 'Quick scheduling', keywords: ["same day", "today", "last minute", "immediate"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'instant_quote', label: 'Instant Online Quote', description: 'Automated pricing', keywords: ["instant quote", "online quote", "pricing calculator", "book online"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'commercial_cleaning', label: 'Commercial Cleaning', description: 'Office/business cleaning', keywords: ["commercial", "office cleaning", "janitorial", "business"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'satisfaction_guarantee', label: 'Satisfaction Guarantee', description: 'Service guarantee', keywords: ["guarantee", "satisfaction guaranteed", "100% satisfaction", "free re-clean"], priority: 'HIGH', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'hiring', label: 'Hiring Cleaners', description: 'Growing team', keywords: ["hiring", "cleaner jobs", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Service Expansion', description: 'New service areas', keywords: ["expanding", "now serving", "new location"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'team_cleaning', label: 'Team Cleaning', description: 'Multiple-person crews', keywords: ["team", "crew", "cleaning team"], regexPattern: '(\\d+)\\s*person team', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'add_on_services', label: 'Add-On Services', description: 'Additional services available', keywords: ["laundry", "dishes", "organization", "windows", "carpet"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'flexible_scheduling', label: 'Flexible Scheduling', description: 'Easy rescheduling', keywords: ["flexible", "easy to reschedule", "change schedule", "skip a clean"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'online_booking', label: 'Online Booking', description: 'Self-service booking', keywords: ["book online", "online booking", "schedule online"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'franchise', label: 'Franchise Operation', description: 'Nationally-backed franchise', keywords: ["franchise", "molly maid", "merry maids", "the cleaning authority"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 10, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'insured', pattern: 'insured.*bonded', description: 'Insurance notice', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'pricing', pattern: '^pricing$', description: 'Pricing', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'reviews', pattern: '^reviews$', description: 'Reviews', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'booking', pattern: '^book(ing)?$', description: 'Booking', context: 'header'},
        {id: 'quote', pattern: '^quote$', description: 'Quote', context: 'header'}
      ],

      scoringRules: [
        {id: 'subscription_model', name: 'Subscription Model', description: 'Recurring plans with guarantee', condition: 'signals.some(s => s.signalId === "recurring_plans") && signals.some(s => s.signalId === "satisfaction_guarantee")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'trusted_service', name: 'Trusted Service', description: 'Background checked with guarantee', condition: 'signals.some(s => s.signalId === "background_checked") && signals.some(s => s.signalId === "satisfaction_guarantee")', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'growing_company', name: 'Growing Company', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'modern_service', name: 'Modern Service', description: 'Online booking with instant quotes', condition: 'signals.some(s => s.signalId === "online_booking") && signals.some(s => s.signalId === "instant_quote")', scoreBoost: 25, priority: 4, enabled: true},
        {id: 'eco_conscious', name: 'Eco-Conscious Provider', description: 'Green cleaning options', condition: 'signals.some(s => s.signalId === "eco_friendly")', scoreBoost: 20, priority: 5, enabled: true},
        {id: 'versatile', name: 'Versatile Provider', description: 'Residential and commercial', condition: 'signals.some(s => s.signalId === "commercial_cleaning")', scoreBoost: 22, priority: 6, enabled: true},
        {id: 'premium_service', name: 'Premium Service', description: 'Deep cleaning with add-ons', condition: 'signals.some(s => s.signalId === "deep_cleaning") && signals.some(s => s.signalId === "add_on_services")', scoreBoost: 18, priority: 7, enabled: true},
        {id: 'responsive', name: 'Responsive Service', description: 'Same-day with flexible scheduling', condition: 'signals.some(s => s.signalId === "same_day") || signals.some(s => s.signalId === "flexible_scheduling")', scoreBoost: 20, priority: 8, enabled: true},
        {id: 'franchise_quality', name: 'Franchise Quality', description: 'Franchise operation', condition: 'signals.some(s => s.signalId === "franchise")', scoreBoost: 15, priority: 9, enabled: true},
        {id: 'comprehensive', name: 'Comprehensive Service', description: 'Team cleaning with multiple services', condition: 'signals.some(s => s.signalId === "team_cleaning") && signals.some(s => s.signalId === "add_on_services")', scoreBoost: 18, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'offers_recurring', label: 'Offers Recurring Service', type: 'boolean', description: 'Weekly/bi-weekly plans', extractionHints: ['weekly', 'recurring'], required: false, defaultValue: false},
        {key: 'background_checks', label: 'Background Checks Staff', type: 'boolean', description: 'Screened employees', extractionHints: ['background check'], required: false, defaultValue: false},
        {key: 'is_eco_friendly', label: 'Eco-Friendly Options', type: 'boolean', description: 'Green cleaning', extractionHints: ['eco-friendly', 'green'], required: false, defaultValue: false},
        {key: 'offers_commercial', label: 'Commercial Services', type: 'boolean', description: 'Office cleaning', extractionHints: ['commercial', 'office'], required: false, defaultValue: false},
        {key: 'has_online_booking', label: 'Online Booking', type: 'boolean', description: 'Self-service booking', extractionHints: ['book online'], required: false, defaultValue: false},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas'], required: false, defaultValue: []},
        {key: 'cleaner_count', label: 'Number of Cleaners', type: 'number', description: 'Staff size', extractionHints: ['cleaners', 'employees', 'team'], required: false, defaultValue: 1}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'House cleaning intelligence - focuses on recurring revenue models, trust indicators, service flexibility, and technology adoption'
      }
    }
  },
  
  'pool-maintenance': {
    id: 'pool-maintenance',
    name: 'Pool Maintenance & Repair',
    description: 'For pool services - chemistry and prevention',
    category: 'Home Services',
    
    coreIdentity: {
      title: 'The Crystal-Clear Expert',
      positioning: 'Scientific (chemistry-focused), reliable, and summer-focused',
      tone: 'Professional, knowledgeable, seasonal'
    },
    
    cognitiveLogic: {
      framework: 'The Chemistry-Stability Model',
      reasoning: 'Logic that explains how regular maintenance prevents the "Green Pool" scenario (expensive algae treatment and equipment damage)',
      decisionProcess: 'Preventative Maintenance → Chemistry Balance → Equipment Longevity'
    },
    
    knowledgeRAG: {
      static: [
        'pH balance chemistry',
        'Pump/filter mechanics',
        'Algae prevention methods',
        'Pool equipment types',
        'Winterization procedures'
      ],
      dynamic: [
        'Weekly route availability',
        '"Algae-Free" service guarantees',
        'Equipment upgrade options (variable speed pumps)',
        'Chemical supply pricing',
        'Seasonal opening/closing schedules',
        'Emergency repair availability'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects "Old Equipment" mentions (inefficient pump, broken heater)',
      adaptation: 'Triggers an "Energy-Efficient Pump" ROI calculation showing energy savings over time',
      feedbackIntegration: 'Tracks seasonal demand patterns and proactively contacts for opening/closing services'
    },
    
    tacticalExecution: {
      primaryAction: 'Service Signup',
      conversionRhythm: 'Moves to add the lead to the weekly maintenance route with "First Month Discount"',
      secondaryActions: [
        'Chemistry test scheduling',
        'Equipment inspection',
        'Energy efficiency audit',
        'Seasonal service booking',
        'Equipment upgrade quote'
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
        {id: 'weekly_service', label: 'Weekly Maintenance', description: 'Regular route service', keywords: ["weekly", "weekly service", "route", "regular maintenance"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'repair_services', label: 'Pool Repair', description: 'Equipment repair services', keywords: ["repair", "pool repair", "equipment repair", "pump repair", "leak repair"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'pool_remodeling', label: 'Pool Remodeling', description: 'Renovation services', keywords: ["remodel", "renovation", "resurface", "replaster", "tile"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'},
        {id: 'equipment_upgrades', label: 'Equipment Upgrades', description: 'New equipment installation', keywords: ["equipment upgrade", "variable speed", "heater", "automation", "salt system"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'green_pool_rescue', label: 'Green Pool Rescue', description: 'Algae treatment specialist', keywords: ["green pool", "algae treatment", "pool rescue", "emergency"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'seasonal_services', label: 'Seasonal Open/Close', description: 'Winterization services', keywords: ["opening", "closing", "winterization", "seasonal"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'commercial_pools', label: 'Commercial Pool Service', description: 'HOA/apartment pools', keywords: ["commercial", "hoa", "apartment", "community pool"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'service_guarantee', label: 'Service Guarantee', description: 'Crystal clear guarantee', keywords: ["guarantee", "crystal clear", "guaranteed", "satisfaction"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'hiring', label: 'Hiring Pool Techs', description: 'Growing team', keywords: ["hiring", "pool technician", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Route Expansion', description: 'New service areas', keywords: ["expanding", "now serving", "new route", "new areas"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'route_count', label: 'Large Route', description: 'Many pools serviced', keywords: ["pools", "clients", "route"], regexPattern: '(\\d+)\\+?\\s*(pools?|clients?)', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'licensed', label: 'Licensed Contractor', description: 'Professional licensing', keywords: ["licensed", "certified pool", "cpo"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'automation', label: 'Pool Automation', description: 'Smart pool systems', keywords: ["automation", "smart pool", "app control", "remote"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'leak_detection', label: 'Leak Detection', description: 'Electronic leak detection', keywords: ["leak detection", "find leaks", "leak repair"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'financing', label: 'Financing Available', description: 'Equipment financing', keywords: ["financing", "payment plans"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'licensed', pattern: 'licensed.*insured', description: 'License notice', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'maintenance', pattern: '^maintenance$', description: 'Maintenance', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'reviews', pattern: '^reviews$', description: 'Reviews', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'quote', pattern: '^quote$', description: 'Quote', context: 'header'},
        {id: 'areas', pattern: '^areas$', description: 'Areas', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'}
      ],

      scoringRules: [
        {id: 'large_route', name: 'Large Route Operation', description: 'High pool count with hiring', condition: 'signals.some(s => s.signalId === "route_count") && signals.some(s => s.signalId === "hiring")', scoreBoost: 40, priority: 1, enabled: true},
        {id: 'full_service', name: 'Full-Service Provider', description: 'Maintenance, repair, and remodeling', condition: 'signals.filter(s => ["weekly_service", "repair_services", "pool_remodeling"].includes(s.signalId)).length >= 3', scoreBoost: 40, priority: 2, enabled: true},
        {id: 'growing_company', name: 'Growing Company', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'premium_services', name: 'Premium Services', description: 'Equipment upgrades and automation', condition: 'signals.some(s => s.signalId === "equipment_upgrades") && signals.some(s => s.signalId === "automation")', scoreBoost: 28, priority: 4, enabled: true},
        {id: 'commercial_operator', name: 'Commercial Operator', description: 'HOA/commercial pools', condition: 'signals.some(s => s.signalId === "commercial_pools")', scoreBoost: 25, priority: 5, enabled: true},
        {id: 'trusted_service', name: 'Trusted Service', description: 'Licensed with guarantee', condition: 'signals.some(s => s.signalId === "licensed") && signals.some(s => s.signalId === "service_guarantee")', scoreBoost: 20, priority: 6, enabled: true},
        {id: 'renovation_specialist', name: 'Renovation Specialist', description: 'Remodeling with equipment upgrades', condition: 'signals.some(s => s.signalId === "pool_remodeling") && signals.some(s => s.signalId === "equipment_upgrades")', scoreBoost: 30, priority: 7, enabled: true},
        {id: 'emergency_ready', name: 'Emergency Ready', description: 'Green pool rescue with repair', condition: 'signals.some(s => s.signalId === "green_pool_rescue") && signals.some(s => s.signalId === "repair_services")', scoreBoost: 22, priority: 8, enabled: true},
        {id: 'seasonal_expert', name: 'Seasonal Expert', description: 'Offers seasonal services', condition: 'signals.some(s => s.signalId === "seasonal_services")', scoreBoost: 12, priority: 9, enabled: true},
        {id: 'tech_forward', name: 'Tech-Forward Provider', description: 'Automation and leak detection', condition: 'signals.some(s => s.signalId === "automation") || signals.some(s => s.signalId === "leak_detection")', scoreBoost: 18, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'pools_serviced', label: 'Pools Serviced', type: 'number', description: 'Route size', extractionHints: ['pools', 'clients'], required: false, defaultValue: 0},
        {key: 'services_offered', label: 'Services Offered', type: 'array', description: 'Service types', extractionHints: ['maintenance', 'repair', 'remodel'], required: false, defaultValue: []},
        {key: 'offers_commercial', label: 'Commercial Services', type: 'boolean', description: 'HOA/commercial pools', extractionHints: ['commercial', 'hoa'], required: false, defaultValue: false},
        {key: 'has_guarantee', label: 'Service Guarantee', type: 'boolean', description: 'Quality guarantee', extractionHints: ['guarantee'], required: false, defaultValue: false},
        {key: 'offers_remodeling', label: 'Pool Remodeling', type: 'boolean', description: 'Renovation services', extractionHints: ['remodel', 'renovation'], required: false, defaultValue: false},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas'], required: false, defaultValue: []},
        {key: 'years_in_business', label: 'Years in Business', type: 'number', description: 'Company age', extractionHints: ['years', 'since'], required: false, defaultValue: 0}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Pool maintenance intelligence - focuses on route size, service breadth, equipment expertise, and recurring revenue models'
      }
    }
  }
};
