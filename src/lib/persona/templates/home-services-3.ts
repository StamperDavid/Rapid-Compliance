import type { IndustryTemplate } from './types';

export const homeServicesTemplates3: Record<string, IndustryTemplate> = {
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
