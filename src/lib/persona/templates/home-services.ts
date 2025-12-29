import 'server-only';
import type { IndustryTemplate } from './types';

export const homeServicesTemplates: Record<string, IndustryTemplate> = {
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
  },
  
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
  
  'travel-concierge': {
    id: 'travel-concierge',
    name: 'Travel & Concierge Services',
    description: 'For travel agencies - luxury and experience curation',
    category: 'Lifestyle & Events',
    
    coreIdentity: {
      title: 'The Experience Architect',
      positioning: 'Sophisticated, adventurous, and detail-obsessed',
      tone: 'Elegant, enthusiastic, insider-knowledge'
    },
    
    cognitiveLogic: {
      framework: 'The "Frictionless Luxury" Model',
      reasoning: 'Focuses on removing all logistics stress so the client only experiences the "Joy of Discovery"',
      decisionProcess: 'Dream Discovery → Logistics Removal → Curated Experience'
    },
    
    knowledgeRAG: {
      static: [
        'Visa requirements by country',
        'Seasonal travel peaks',
        'Travel insurance basics',
        'Loyalty program strategies',
        'Sustainable travel principles'
      ],
      dynamic: [
        '"Insider" destination guides',
        'Agency\'s exclusive "Perks" (free breakfast, room upgrades)',
        'Current flight and hotel availability',
        'Destination-specific recommendations',
        'Package pricing',
        'Special promotions'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Analyzes "Dream Destination" keywords and travel style preferences',
      adaptation: 'Curates a personalized "Itinerary Teaser" in real-time matching their interests',
      feedbackIntegration: 'Tracks which travel styles (adventure, luxury, cultural, relaxation) match different client profiles'
    },
    
    tacticalExecution: {
      primaryAction: 'Custom Itinerary Request',
      conversionRhythm: 'Moves to book a "Trip Planning Session" or "Destination Consultation"',
      secondaryActions: [
        'Destination inspiration',
        'Budget planning',
        'Travel insurance quote',
        'Group travel coordination',
        'VIP experience upgrade'
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
        {id: 'luxury_travel', label: 'Luxury Travel Specialist', description: 'High-end travel focus', keywords: ["luxury", "luxury travel", "five star", "premium", "exclusive"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 35, platform: 'website'},
        {id: 'destination_specialist', label: 'Destination Specialist', description: 'Regional expertise', keywords: ["specialist", "expert in", "focus on", "italy", "caribbean", "europe", "asia"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'group_travel', label: 'Group Travel', description: 'Group trip planning', keywords: ["group travel", "groups", "family reunions", "destination weddings"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'corporate_travel', label: 'Corporate Travel', description: 'Business travel management', keywords: ["corporate", "business travel", "corporate travel", "meetings"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'cruise_specialist', label: 'Cruise Specialist', description: 'Cruise expertise', keywords: ["cruise", "cruises", "ocean", "river cruise"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'awards', label: 'Industry Recognition', description: 'Travel awards or certifications', keywords: ["award", "virtuoso", "travel + leisure", "conde nast"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'hiring', label: 'Hiring Agents', description: 'Growing team', keywords: ["hiring", "travel agent", "join our team", "careers"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'vip_perks', label: 'VIP Perks & Upgrades', description: 'Exclusive benefits', keywords: ["vip", "upgrades", "perks", "exclusive", "complimentary breakfast"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'personalized_service', label: 'Personalized Service', description: 'Custom itineraries', keywords: ["personalized", "custom", "tailored", "bespoke"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'honeymoon_specialist', label: 'Honeymoon Specialist', description: 'Romance travel focus', keywords: ["honeymoon", "romantic", "couples", "destination wedding"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'adventure_travel', label: 'Adventure Travel', description: 'Active/adventure trips', keywords: ["adventure", "safari", "hiking", "expedition"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'travel_insurance', label: 'Travel Insurance', description: 'Insurance services', keywords: ["travel insurance", "trip protection", "insurance"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'concierge_services', label: 'Concierge Services', description: 'Full concierge support', keywords: ["concierge", "24/7 support", "trip support"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'membership_program', label: 'Membership Program', description: 'Travel club or membership', keywords: ["membership", "travel club", "vip membership"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 12, platform: 'website'}
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
        {id: 'destinations', pattern: '^destinations$', description: 'Destinations', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'specials', pattern: '^specials$', description: 'Specials', context: 'header'},
        {id: 'reviews', pattern: '^reviews$', description: 'Reviews', context: 'header'},
        {id: 'request_quote', pattern: '^request quote$', description: 'Request quote', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'}
      ],

      scoringRules: [
        {id: 'luxury_specialist', name: 'Luxury Specialist', description: 'Luxury focus with VIP perks', condition: 'signals.some(s => s.signalId === "luxury_travel") && signals.some(s => s.signalId === "vip_perks")', scoreBoost: 40, priority: 1, enabled: true},
        {id: 'destination_expert', name: 'Destination Expert', description: 'Specialization with awards', condition: 'signals.some(s => s.signalId === "destination_specialist") && signals.some(s => s.signalId === "awards")', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'full_service', name: 'Full-Service Agency', description: 'Corporate and leisure travel', condition: 'signals.some(s => s.signalId === "corporate_travel") && signals.some(s => s.signalId === "group_travel")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'growing_agency', name: 'Growing Agency', description: 'Hiring travel agents', condition: 'signals.some(s => s.signalId === "hiring")', scoreBoost: 25, priority: 4, enabled: true},
        {id: 'niche_expert', name: 'Niche Expert', description: 'Specialization expertise', condition: 'signals.filter(s => ["honeymoon_specialist", "adventure_travel", "cruise_specialist"].includes(s.signalId)).length >= 1', scoreBoost: 20, priority: 5, enabled: true},
        {id: 'comprehensive_service', name: 'Comprehensive Service', description: 'Concierge with personalization', condition: 'signals.some(s => s.signalId === "concierge_services") && signals.some(s => s.signalId === "personalized_service")', scoreBoost: 25, priority: 6, enabled: true},
        {id: 'recognized_agency', name: 'Recognized Agency', description: 'Awards or prestigious affiliations', condition: 'signals.some(s => s.signalId === "awards")', scoreBoost: 28, priority: 7, enabled: true},
        {id: 'vip_experience', name: 'VIP Experience', description: 'Luxury with personalized service', condition: 'signals.some(s => s.signalId === "luxury_travel") && signals.some(s => s.signalId === "personalized_service")', scoreBoost: 30, priority: 8, enabled: true},
        {id: 'protected_travel', name: 'Protected Travel', description: 'Insurance with concierge', condition: 'signals.some(s => s.signalId === "travel_insurance") && signals.some(s => s.signalId === "concierge_services")', scoreBoost: 18, priority: 9, enabled: true},
        {id: 'membership_value', name: 'Membership Value', description: 'Travel club with perks', condition: 'signals.some(s => s.signalId === "membership_program") && signals.some(s => s.signalId === "vip_perks")', scoreBoost: 20, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'specialization', label: 'Travel Specialization', type: 'string', description: 'Primary focus area', extractionHints: ['luxury', 'cruise', 'adventure', 'honeymoon'], required: false, defaultValue: 'general'},
        {key: 'agent_count', label: 'Number of Agents', type: 'number', description: 'Team size', extractionHints: ['agents', 'advisors'], required: false, defaultValue: 1},
        {key: 'destinations_served', label: 'Primary Destinations', type: 'array', description: 'Geographic specialties', extractionHints: ['europe', 'caribbean', 'asia'], required: false, defaultValue: []},
        {key: 'offers_corporate', label: 'Corporate Travel', type: 'boolean', description: 'Business travel services', extractionHints: ['corporate', 'business'], required: false, defaultValue: false},
        {key: 'has_concierge', label: 'Concierge Services', type: 'boolean', description: 'Full concierge support', extractionHints: ['concierge'], required: false, defaultValue: false},
        {key: 'is_luxury_focused', label: 'Luxury Focused', type: 'boolean', description: 'High-end travel', extractionHints: ['luxury'], required: false, defaultValue: false},
        {key: 'years_in_business', label: 'Years in Business', type: 'number', description: 'Company age', extractionHints: ['years', 'since'], required: false, defaultValue: 0}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Travel & concierge intelligence - focuses on specialization, luxury positioning, service breadth, and industry recognition'
      }
    }
  },
  
  'event-planning': {
    id: 'event-planning',
    name: 'Event Planning',
    description: 'For planners - stress-free celebration orchestration',
    category: 'Lifestyle & Events',
    
    coreIdentity: {
      title: 'The Calm Orchestrator',
      positioning: 'Creative, organized, and unflappable',
      tone: 'Warm, confident, detail-oriented'
    },
    
    cognitiveLogic: {
      framework: 'The "Guest-Experience" Framework',
      reasoning: 'Logic that prioritizes "Flow, Feeling, and Memories" while maintaining strict "Budget Realism"',
      decisionProcess: 'Vision Capture → Budget Alignment → Flawless Execution'
    },
    
    knowledgeRAG: {
      static: [
        'Vendor contract basics',
        'Timeline templates by event type',
        'Guest count calculations',
        'Catering ratios',
        'Event insurance'
      ],
      dynamic: [
        'Local venue list with availability',
        'Preferred catering partners',
        'Portfolio of past events by type',
        'Vendor pricing',
        'Seasonal availability',
        'Decoration trends'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks "Budget Stress" signals in conversation',
      adaptation: 'Triggers a "Smart-Spend" module showing where to save (DIY elements) vs. where to splurge (photographer, venue)',
      feedbackIntegration: 'Learns which event elements (food, entertainment, decor) have highest satisfaction impact'
    },
    
    tacticalExecution: {
      primaryAction: 'Event Vision Call',
      conversionRhythm: 'Focuses on getting the "Date, Guest Count, and Mood/Theme" to begin planning',
      secondaryActions: [
        'Venue recommendation',
        'Budget breakdown',
        'Timeline creation',
        'Vendor coordination',
        'Day-of coordination package'
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
        {id: 'event_portfolio', label: 'Extensive Portfolio', description: 'Large event portfolio', keywords: ["events", "portfolio", "weddings", "celebrations"], regexPattern: '(\\d{2,})\\+?\\s*events?', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'wedding_specialist', label: 'Wedding Specialist', description: 'Wedding planning focus', keywords: ["wedding", "weddings", "bridal", "wedding planner"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'corporate_events', label: 'Corporate Events', description: 'Business event planning', keywords: ["corporate", "corporate events", "business", "conference"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'full_service', label: 'Full-Service Planning', description: 'Comprehensive event management', keywords: ["full service", "turnkey", "end-to-end", "complete planning"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'day_of_coordination', label: 'Day-Of Coordination', description: 'Coordination services', keywords: ["day of", "day-of", "coordination", "month of"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'vendor_relationships', label: 'Vendor Network', description: 'Preferred vendor partnerships', keywords: ["preferred vendors", "vendor network", "vetted vendors", "trusted partners"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'awards', label: 'Industry Awards', description: 'Event planning recognition', keywords: ["award", "best of", "the knot", "wedding wire"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'hiring', label: 'Hiring Planners', description: 'Growing team', keywords: ["hiring", "planner positions", "join our team"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'destination_events', label: 'Destination Events', description: 'Destination weddings/events', keywords: ["destination", "destination wedding", "travel"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'design_services', label: 'Design Services', description: 'Decor and design', keywords: ["design", "decor", "floral", "styling"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'virtual_planning', label: 'Virtual Planning', description: 'Remote planning services', keywords: ["virtual", "remote", "online planning"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'package_pricing', label: 'Package Pricing', description: 'Tiered service packages', keywords: ["packages", "package pricing", "bronze silver gold"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'free_consultation', label: 'Free Consultation', description: 'Complimentary initial meeting', keywords: ["free consultation", "complimentary", "no obligation"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'social_events', label: 'Social Events', description: 'Parties and celebrations', keywords: ["birthday", "anniversary", "party", "social event"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'charity_events', label: 'Charity/Fundraising Events', description: 'Nonprofit events', keywords: ["charity", "fundraiser", "gala", "nonprofit"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'}
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
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'portfolio', pattern: '^portfolio$', description: 'Portfolio', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'gallery', pattern: '^gallery$', description: 'Gallery', context: 'header'},
        {id: 'pricing', pattern: '^pricing$', description: 'Pricing', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'vendor', pattern: '^vendors$', description: 'Vendors', context: 'header'}
      ],

      scoringRules: [
        {id: 'full_service_expert', name: 'Full-Service Expert', description: 'Full service with extensive portfolio', condition: 'signals.some(s => s.signalId === "full_service") && signals.some(s => s.signalId === "event_portfolio")', scoreBoost: 40, priority: 1, enabled: true},
        {id: 'wedding_pro', name: 'Wedding Professional', description: 'Wedding specialist with awards', condition: 'signals.some(s => s.signalId === "wedding_specialist") && signals.some(s => s.signalId === "awards")', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'versatile_planner', name: 'Versatile Planner', description: 'Corporate and social events', condition: 'signals.some(s => s.signalId === "corporate_events") && signals.some(s => s.signalId === "social_events")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'growing_business', name: 'Growing Business', description: 'Hiring planners', condition: 'signals.some(s => s.signalId === "hiring")', scoreBoost: 25, priority: 4, enabled: true},
        {id: 'destination_expert', name: 'Destination Expert', description: 'Destination weddings with portfolio', condition: 'signals.some(s => s.signalId === "destination_events") && signals.some(s => s.signalId === "event_portfolio")', scoreBoost: 28, priority: 5, enabled: true},
        {id: 'design_savvy', name: 'Design-Savvy', description: 'Design services with full planning', condition: 'signals.some(s => s.signalId === "design_services") && signals.some(s => s.signalId === "full_service")', scoreBoost: 25, priority: 6, enabled: true},
        {id: 'trusted_network', name: 'Trusted Network', description: 'Vendor relationships with awards', condition: 'signals.some(s => s.signalId === "vendor_relationships") && signals.some(s => s.signalId === "awards")', scoreBoost: 28, priority: 7, enabled: true},
        {id: 'flexible_service', name: 'Flexible Service', description: 'Full and day-of options', condition: 'signals.some(s => s.signalId === "day_of_coordination")', scoreBoost: 15, priority: 8, enabled: true},
        {id: 'virtual_capable', name: 'Virtual Capable', description: 'Remote planning available', condition: 'signals.some(s => s.signalId === "virtual_planning")', scoreBoost: 12, priority: 9, enabled: true},
        {id: 'nonprofit_specialist', name: 'Nonprofit Specialist', description: 'Charity event expertise', condition: 'signals.some(s => s.signalId === "charity_events")', scoreBoost: 18, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'events_completed', label: 'Events Completed', type: 'number', description: 'Portfolio size', extractionHints: ['events', 'weddings'], required: false, defaultValue: 0},
        {key: 'event_types', label: 'Event Types', type: 'array', description: 'Specializations', extractionHints: ['wedding', 'corporate', 'social'], required: false, defaultValue: []},
        {key: 'offers_full_service', label: 'Full-Service Planning', type: 'boolean', description: 'Complete planning', extractionHints: ['full service'], required: false, defaultValue: false},
        {key: 'offers_day_of', label: 'Day-Of Coordination', type: 'boolean', description: 'Coordination only', extractionHints: ['day of', 'coordination'], required: false, defaultValue: false},
        {key: 'has_design_services', label: 'Design Services', type: 'boolean', description: 'Decor and design', extractionHints: ['design', 'decor'], required: false, defaultValue: false},
        {key: 'planner_count', label: 'Number of Planners', type: 'number', description: 'Team size', extractionHints: ['planners', 'team'], required: false, defaultValue: 1},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas'], required: false, defaultValue: []}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Event planning intelligence - focuses on portfolio depth, service breadth, event specialization, and vendor relationships'
      }
    }
  },
  
  'nonprofit-fundraising': {
    id: 'nonprofit-fundraising',
    name: 'Non-Profit & Fundraising',
    description: 'For nonprofits - mission impact and donor cultivation',
    category: 'Professional Services',
    
    coreIdentity: {
      title: 'The Visionary Activist',
      positioning: 'Passionate, transparent, and mission-driven',
      tone: 'Inspiring, authentic, grateful'
    },
    
    cognitiveLogic: {
      framework: 'The Impact-Attribution Model',
      reasoning: 'Logic that connects a specific dollar amount to a specific tangible outcome (e.g., "$50 feeds a family for a week," "$500 provides clean water for a village")',
      decisionProcess: 'Mission Connection → Impact Visualization → Contribution Action'
    },
    
    knowledgeRAG: {
      static: [
        '501(c)(3) tax deduction basics',
        'Transparency and accountability standards',
        'Donor bill of rights',
        'Planned giving options',
        'Volunteer management'
      ],
      dynamic: [
        'Current campaign goals and progress',
        'Specific "Success Stories" from the field',
        'Impact metrics by program',
        'Donation tiers and naming opportunities',
        'Volunteer opportunities',
        'Annual reports and financials'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Identifies "Donor Motivation" (legacy vs. immediate impact vs. community connection)',
      adaptation: 'Tailors the "Ask" accordingly (planned giving for legacy, specific project for immediate, volunteer for community)',
      feedbackIntegration: 'Learns which stories and impact metrics drive highest conversion and recurring donations'
    },
    
    tacticalExecution: {
      primaryAction: 'Donation Drive or Volunteer Signup',
      conversionRhythm: 'Every interaction includes a clear call to "Give," "Volunteer," or "Share" the mission',
      secondaryActions: [
        'Impact story sharing',
        'Recurring donation setup',
        'Volunteer application',
        'Event attendance',
        'Corporate partnership inquiry'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['google-business', 'news'],
        frequency: 'weekly',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 600
      },

      highValueSignals: [
        {id: 'impact_metrics', label: 'Impact Metrics', description: 'Quantified outcomes', keywords: ["served", "helped", "provided", "impact"], regexPattern: '([\\d,]+)\\s*(people|families|children|meals)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'charity_navigator', label: 'High Charity Rating', description: 'Top charity rating', keywords: ["charity navigator", "4 star", "platinum", "top rated", "guidestar"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'recurring_donations', label: 'Monthly Giving Program', description: 'Recurring donation option', keywords: ["monthly giving", "recurring", "sustainer", "monthly donor"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'major_donors', label: 'Major Donor Program', description: 'High-value donor cultivation', keywords: ["major donors", "leadership circle", "legacy", "planned giving"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'corporate_partnerships', label: 'Corporate Partnerships', description: 'Business sponsor relationships', keywords: ["corporate partners", "sponsors", "corporate giving"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'volunteer_program', label: 'Volunteer Program', description: 'Active volunteer opportunities', keywords: ["volunteer", "volunteers needed", "get involved"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'fundraising_events', label: 'Fundraising Events', description: 'Gala or fundraising activities', keywords: ["gala", "fundraiser", "event", "annual event"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'transparency', label: 'Financial Transparency', description: 'Published financials', keywords: ["annual report", "financials", "transparency", "990"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'hiring', label: 'Hiring Staff', description: 'Growing organization', keywords: ["hiring", "careers", "join our team", "positions"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Program Expansion', description: 'New programs or locations', keywords: ["new program", "expanding", "new location", "growth"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'any'},
        {id: 'matching_gift', label: 'Matching Gift Program', description: 'Corporate matching', keywords: ["matching", "match", "double your impact"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'success_stories', label: 'Success Stories', description: 'Beneficiary testimonials', keywords: ["success stories", "testimonials", "stories", "meet"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'tax_deductible', label: 'Tax-Deductible', description: '501(c)(3) status', keywords: ["tax deductible", "501c3", "501(c)(3)", "tax exempt"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'awards_grants', label: 'Awards or Grants', description: 'Funding recognition', keywords: ["grant", "awarded", "recipient", "foundation support"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'campaign_active', label: 'Active Campaign', description: 'Current fundraising campaign', keywords: ["campaign", "fundraising campaign", "goal", "raised"], regexPattern: '\\$(\\d+).*goal', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'tax_id', pattern: 'ein|tax id', description: 'Tax ID', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'donate', pattern: '^donate$', description: 'Donate', context: 'header'},
        {id: 'volunteer', pattern: '^volunteer$', description: 'Volunteer', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'news', pattern: '^news$', description: 'News', context: 'header'},
        {id: 'events', pattern: '^events$', description: 'Events', context: 'header'},
        {id: 'programs', pattern: '^programs$', description: 'Programs', context: 'header'},
        {id: 'impact', pattern: '^impact$', description: 'Impact', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'}
      ],

      scoringRules: [
        {id: 'trusted_nonprofit', name: 'Trusted Nonprofit', description: 'High rating with transparency', condition: 'signals.some(s => s.signalId === "charity_navigator") && signals.some(s => s.signalId === "transparency")', scoreBoost: 50, priority: 1, enabled: true},
        {id: 'proven_impact', name: 'Proven Impact', description: 'Impact metrics with success stories', condition: 'signals.some(s => s.signalId === "impact_metrics") && signals.some(s => s.signalId === "success_stories")', scoreBoost: 45, priority: 2, enabled: true},
        {id: 'sustainable_funding', name: 'Sustainable Funding', description: 'Recurring donations with major donors', condition: 'signals.some(s => s.signalId === "recurring_donations") && signals.some(s => s.signalId === "major_donors")', scoreBoost: 40, priority: 3, enabled: true},
        {id: 'growing_organization', name: 'Growing Organization', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 4, enabled: true},
        {id: 'corporate_support', name: 'Corporate Support', description: 'Corporate partnerships with matching', condition: 'signals.some(s => s.signalId === "corporate_partnerships") && signals.some(s => s.signalId === "matching_gift")', scoreBoost: 30, priority: 5, enabled: true},
        {id: 'comprehensive_engagement', name: 'Comprehensive Engagement', description: 'Donation and volunteer opportunities', condition: 'signals.some(s => s.signalId === "volunteer_program")', scoreBoost: 20, priority: 6, enabled: true},
        {id: 'active_fundraising', name: 'Active Fundraising', description: 'Current campaign with events', condition: 'signals.some(s => s.signalId === "campaign_active") && signals.some(s => s.signalId === "fundraising_events")', scoreBoost: 25, priority: 7, enabled: true},
        {id: 'funded_organization', name: 'Well-Funded Organization', description: 'Grant awards with partnerships', condition: 'signals.some(s => s.signalId === "awards_grants") && signals.some(s => s.signalId === "corporate_partnerships")', scoreBoost: 30, priority: 8, enabled: true},
        {id: 'legacy_program', name: 'Legacy Program', description: 'Planned giving available', condition: 'signals.some(s => s.signalId === "major_donors")', scoreBoost: 22, priority: 9, enabled: true},
        {id: 'engaged_community', name: 'Engaged Community', description: 'Events with volunteer program', condition: 'signals.some(s => s.signalId === "fundraising_events") && signals.some(s => s.signalId === "volunteer_program")', scoreBoost: 20, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'people_served', label: 'People/Families Served', type: 'number', description: 'Annual impact', extractionHints: ['served', 'helped', 'families'], required: false, defaultValue: 0},
        {key: 'charity_rating', label: 'Charity Navigator Rating', type: 'number', description: 'Star rating (1-4)', extractionHints: ['star', 'rating'], required: false, defaultValue: 0},
        {key: 'has_recurring_program', label: 'Monthly Giving Program', type: 'boolean', description: 'Recurring donations', extractionHints: ['monthly', 'recurring'], required: false, defaultValue: false},
        {key: 'program_areas', label: 'Program Areas', type: 'array', description: 'Service categories', extractionHints: ['education', 'food', 'housing', 'health'], required: false, defaultValue: []},
        {key: 'accepts_volunteers', label: 'Accepts Volunteers', type: 'boolean', description: 'Volunteer opportunities', extractionHints: ['volunteer'], required: false, defaultValue: false},
        {key: 'has_corporate_program', label: 'Corporate Partnership Program', type: 'boolean', description: 'Business partnerships', extractionHints: ['corporate'], required: false, defaultValue: false},
        {key: 'annual_budget', label: 'Annual Budget', type: 'string', description: 'Organization size', extractionHints: ['budget', 'revenue', 'million'], required: false, defaultValue: 'unknown'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Nonprofit & fundraising intelligence - focuses on impact metrics, transparency ratings, donor cultivation, and volunteer engagement'
      }
    }
  },
  
  'mexican-restaurant': {
    id: 'mexican-restaurant',
    name: 'Mexican Restaurant & Cantina',
    description: 'For Mexican restaurants - hospitality and cultural authenticity',
    category: 'Hospitality & Food Services',
    
    coreIdentity: {
      title: 'The Vibrant Host',
      positioning: 'Warm, energetic, and culturally authentic',
      tone: 'Enthusiastic, welcoming, celebratory'
    },
    
    cognitiveLogic: {
      framework: 'The "Appetite-Upsell" Model',
      reasoning: 'Logic that never allows a "flat" order; if a user mentions food, the logic triggers a drink/appetizer pairing suggestion',
      decisionProcess: 'Menu Discovery → Pairing Enhancement → Celebration Upgrade'
    },
    
    knowledgeRAG: {
      static: [
        'Menu items and descriptions',
        'Spice levels and heat scales',
        'Allergen information',
        'Traditional preparation methods',
        'Margarita and tequila varieties'
      ],
      dynamic: [
        'Today\'s specials and features',
        '"Happy Hour" clock and pricing',
        'Specific "Family Recipe" origin stories',
        'Wait times and table availability',
        'Catering menu and party packages',
        'Delivery/pickup options'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks mentions of "Group," "Birthday," "Celebration," or "Anniversary"',
      adaptation: 'Triggers the "Large Table/Fiesta Package" booking logic with party amenities (sombrero, song, dessert)',
      feedbackIntegration: 'Learns which upsells (guacamole, premium margaritas, fajitas for two) have highest acceptance rates'
    },
    
    tacticalExecution: {
      primaryAction: 'Reservation / Order Now',
      conversionRhythm: 'Focuses on "Grab a table before the rush" (Friday/Saturday evenings) or "Start your delivery order"',
      secondaryActions: [
        'Happy hour promotion',
        'Margarita pairing suggestion',
        'Appetizer bundle',
        'Catering inquiry',
        'Party package booking'
      ]
    },

    research: {
      scrapingStrategy: {primarySource: 'website', secondarySources: ['google-business'], frequency: 'per-lead', timeoutMs: 30000, enableCaching: true, cacheTtlSeconds: 300},
      highValueSignals: [
        {id: 'hiring', label: 'Hiring Staff', description: 'Recruiting servers/cooks', keywords: ["hiring", "now hiring", "join our team", "server wanted", "cook wanted"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'new_location', label: 'New Location', description: 'Opening new restaurant', keywords: ["new location", "opening soon", "second location", "coming soon"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'catering', label: 'Catering Services', description: 'Offers catering', keywords: ["catering", "events", "party packages", "group orders"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'happy_hour', label: 'Happy Hour', description: 'Daily happy hour specials', keywords: ["happy hour", "daily specials", "drink specials"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'delivery', label: 'Delivery Service', description: 'Offers delivery', keywords: ["delivery", "door dash", "uber eats", "grubhub", "we deliver"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'bar_full', label: 'Full Bar', description: 'Full bar with liquor license', keywords: ["full bar", "margaritas", "tequila", "cocktails", "cantina"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'live_entertainment', label: 'Live Entertainment', description: 'Music or events', keywords: ["live music", "mariachi", "entertainment", "events"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'patio', label: 'Outdoor Seating', description: 'Patio or outdoor dining', keywords: ["patio", "outdoor", "al fresco", "terrace"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'family_owned', label: 'Family Owned', description: 'Family-run restaurant', keywords: ["family owned", "family recipe", "authentic", "traditional"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'awards', label: 'Awards/Recognition', description: 'Best of awards', keywords: ["best", "award", "top rated", "voted"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'multiple_locations', label: 'Multiple Locations', description: 'Chain or franchise', keywords: ["locations", "visit us at"], regexPattern: '(\\d+)\\s*locations?', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'}
      ],
      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'privacy', pattern: 'privacy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookies', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'menu', pattern: '^menu$', description: 'Menu link', context: 'header'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'hours', pattern: '^hours$', description: 'Hours', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back', context: 'footer'}
      ],
      scoringRules: [
        {id: 'expanding', name: 'Growing Chain', description: 'Multiple locations + hiring', condition: 'signals.some(s => s.signalId === "multiple_locations") && signals.some(s => s.signalId === "hiring")', scoreBoost: 25, priority: 1, enabled: true},
        {id: 'full_service', name: 'Full Service', description: 'Catering + delivery + bar', condition: 'signals.some(s => s.signalId === "catering") && signals.some(s => s.signalId === "delivery") && signals.some(s => s.signalId === "bar_full")', scoreBoost: 20, priority: 2, enabled: true}
      ],
      customFields: [
        {key: 'location_count', label: 'Number of Locations', type: 'number', description: 'Restaurant locations', extractionHints: ['locations', 'visit us at'], required: false, defaultValue: 1},
        {key: 'has_catering', label: 'Offers Catering', type: 'boolean', description: 'Catering services', extractionHints: ['catering', 'events'], required: false, defaultValue: false},
        {key: 'has_delivery', label: 'Delivery Available', type: 'boolean', description: 'Delivery service', extractionHints: ['delivery', 'doordash'], required: false, defaultValue: false},
        {key: 'has_bar', label: 'Full Bar', type: 'boolean', description: 'Liquor license', extractionHints: ['bar', 'margaritas', 'cocktails'], required: false, defaultValue: false},
        {key: 'seating_capacity', label: 'Seating Capacity', type: 'number', description: 'Number of seats', extractionHints: ['seats', 'capacity'], required: false, defaultValue: 0}
      ],
      metadata: {lastUpdated: '2025-12-28', version: 1, updatedBy: 'system', notes: 'Mexican restaurant intelligence - growth, services, customer experience'}
    }
  }
};
