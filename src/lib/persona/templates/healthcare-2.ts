import type { IndustryTemplate } from './types';

export const healthcareTemplates2: Record<string, IndustryTemplate> = {
  'chiropractic': {
    id: 'chiropractic',
    name: 'Chiropractic',
    description: 'For chiropractors - root cause and structural focus',
    category: 'Healthcare & Wellness',
    
    coreIdentity: {
      title: 'The Structural Specialist',
      positioning: 'Evidence-based, movement-focused, and restorative',
      tone: 'Professional, educational, solution-oriented'
    },
    
    cognitiveLogic: {
      framework: 'The Root-Cause Framework',
      reasoning: 'Logic that explains why the pain exists (spinal alignment, biomechanics) rather than just treating the symptom',
      decisionProcess: 'Root Cause Discovery → Structural Assessment → Treatment Plan'
    },
    
    knowledgeRAG: {
      static: [
        'Spinal anatomy',
        'Adjustment techniques and benefits',
        'Nervous system function',
        'Posture correction principles',
        'Injury rehabilitation protocols'
      ],
      dynamic: [
        'X-ray capabilities and analysis',
        'Wellness plan structures',
        '"Walk-in" availability for acute pain',
        'Insurance coverage details',
        'Maintenance schedules',
        'Supplement/equipment recommendations'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Identifies "Symptom Clusters" (e.g., Headaches + Neck Pain + Poor Posture)',
      adaptation: 'Suggests specific targeted treatment modules or care plans based on symptom patterns',
      feedbackIntegration: 'Tracks which pain relief timelines (immediate vs gradual) match different condition types'
    },
    
    tacticalExecution: {
      primaryAction: 'Initial Assessment',
      conversionRhythm: 'Moves to book the first exam + adjustment combo, often with "New Patient Special" pricing',
      secondaryActions: [
        'Pain assessment questionnaire',
        'X-ray scheduling',
        'Wellness plan consultation',
        'Insurance verification',
        'Posture analysis'
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
        {id: 'multiple_chiropractors', label: 'Multi-Doctor Practice', description: 'Multiple chiropractors on staff', keywords: ["chiropractors", "doctors"], regexPattern: '(\\d+)\\s*(chiropractors?|doctors?)', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'accepting_patients', label: 'Accepting New Patients', description: 'Open for new clients', keywords: ["accepting new patients", "new patients welcome", "now accepting"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'insurance_accepted', label: 'Insurance Accepted', description: 'Takes insurance', keywords: ["insurance accepted", "we accept", "in-network", "most insurance"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'same_day', label: 'Same-Day Appointments', description: 'Walk-in or same-day service', keywords: ["same day", "walk-in", "no appointment", "emergency"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'sports_chiropractic', label: 'Sports Chiropractic', description: 'Athletic performance focus', keywords: ["sports chiropractic", "sports injuries", "athletic performance", "sports medicine"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'auto_injury', label: 'Auto Injury Treatment', description: 'Car accident specialists', keywords: ["auto injury", "car accident", "whiplash", "personal injury"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'massage_therapy', label: 'Massage Therapy', description: 'Integrated massage services', keywords: ["massage", "massage therapy", "therapeutic massage"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'physical_therapy', label: 'Physical Therapy', description: 'PT services available', keywords: ["physical therapy", "pt", "rehabilitation", "rehab"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'xray_onsite', label: 'On-Site X-Ray', description: 'Diagnostic imaging available', keywords: ["x-ray", "xray", "digital x-ray", "imaging"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'hiring', label: 'Hiring Staff', description: 'Growing practice', keywords: ["hiring", "join our team", "chiropractor positions", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'expansion', label: 'Practice Expansion', description: 'New locations', keywords: ["new location", "expanding", "second office", "now serving"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'wellness_plans', label: 'Wellness Plans', description: 'Membership or care plans', keywords: ["wellness plan", "care plan", "membership", "maintenance plan"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'new_patient_special', label: 'New Patient Special', description: 'Intro pricing', keywords: ["new patient special", "first visit", "intro offer", "consultation"], regexPattern: '\\$\\d{1,2}\\s*(exam|consultation)', priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'pediatric', label: 'Pediatric Chiropractic', description: 'Treats children', keywords: ["pediatric", "children", "kids", "family chiropractic"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'weekend_hours', label: 'Weekend Hours', description: 'Saturday/Sunday availability', keywords: ["weekend", "saturday", "sunday", "7 days"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'hipaa', pattern: 'hipaa', description: 'HIPAA', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'conditions', pattern: '^conditions$', description: 'Conditions', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'forms', pattern: '^forms$', description: 'Forms', context: 'header'},
        {id: 'portal', pattern: '^portal$', description: 'Portal', context: 'header'},
        {id: 'new_patients', pattern: '^new patients$', description: 'New patients', context: 'header'}
      ],

      scoringRules: [
        {id: 'large_practice', name: 'Large Practice', description: 'Multiple doctors accepting patients', condition: 'signals.some(s => s.signalId === "multiple_chiropractors") && signals.some(s => s.signalId === "accepting_patients")', scoreBoost: 35, priority: 1, enabled: true},
        {id: 'comprehensive_care', name: 'Comprehensive Care', description: 'Chiro + massage + PT', condition: 'signals.some(s => s.signalId === "massage_therapy") && signals.some(s => s.signalId === "physical_therapy")', scoreBoost: 28, priority: 2, enabled: true},
        {id: 'growing_practice', name: 'Growing Practice', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'accessible', name: 'Accessible Practice', description: 'Insurance with same-day', condition: 'signals.some(s => s.signalId === "insurance_accepted") && signals.some(s => s.signalId === "same_day")', scoreBoost: 25, priority: 4, enabled: true},
        {id: 'sports_specialist', name: 'Sports Specialist', description: 'Sports focus with comprehensive care', condition: 'signals.some(s => s.signalId === "sports_chiropractic") && signals.some(s => s.signalId === "physical_therapy")', scoreBoost: 22, priority: 5, enabled: true},
        {id: 'auto_injury_specialist', name: 'Auto Injury Specialist', description: 'PI focus with imaging', condition: 'signals.some(s => s.signalId === "auto_injury") && signals.some(s => s.signalId === "xray_onsite")', scoreBoost: 20, priority: 6, enabled: true},
        {id: 'family_practice', name: 'Family Practice', description: 'Pediatric services offered', condition: 'signals.some(s => s.signalId === "pediatric")', scoreBoost: 15, priority: 7, enabled: true},
        {id: 'convenient', name: 'Convenient Care', description: 'Weekend hours with same-day', condition: 'signals.some(s => s.signalId === "weekend_hours") && signals.some(s => s.signalId === "same_day")', scoreBoost: 18, priority: 8, enabled: true},
        {id: 'wellness_focused', name: 'Wellness-Focused', description: 'Wellness plans with comprehensive services', condition: 'signals.some(s => s.signalId === "wellness_plans")', scoreBoost: 15, priority: 9, enabled: true},
        {id: 'advanced_care', name: 'Advanced Care', description: 'X-ray with multiple modalities', condition: 'signals.some(s => s.signalId === "xray_onsite") && signals.filter(s => ["massage_therapy", "physical_therapy"].includes(s.signalId)).length >= 1', scoreBoost: 20, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'chiropractor_count', label: 'Number of Chiropractors', type: 'number', description: 'Doctors on staff', extractionHints: ['chiropractors', 'doctors'], required: false, defaultValue: 1},
        {key: 'accepts_insurance', label: 'Accepts Insurance', type: 'boolean', description: 'Insurance accepted', extractionHints: ['insurance'], required: false, defaultValue: false},
        {key: 'has_xray', label: 'On-Site X-Ray', type: 'boolean', description: 'Imaging available', extractionHints: ['x-ray', 'xray'], required: false, defaultValue: false},
        {key: 'services_offered', label: 'Services Offered', type: 'array', description: 'Treatment modalities', extractionHints: ['adjustment', 'massage', 'pt', 'therapy'], required: false, defaultValue: []},
        {key: 'specialization', label: 'Practice Specialization', type: 'string', description: 'Primary focus', extractionHints: ['sports', 'auto injury', 'family'], required: false, defaultValue: 'general'},
        {key: 'location_count', label: 'Office Locations', type: 'number', description: 'Number of offices', extractionHints: ['locations', 'offices'], required: false, defaultValue: 1},
        {key: 'same_day_available', label: 'Same-Day Appointments', type: 'boolean', description: 'Walk-in capability', extractionHints: ['same day', 'walk-in'], required: false, defaultValue: false}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Chiropractic intelligence - focuses on practice size, service integration, accessibility, and specialized care offerings'
      }
    }
  },
  
  'personal-training': {
    id: 'personal-training',
    name: 'Personal Training (Independent)',
    description: 'For trainers - customization and accountability',
    category: 'Healthcare & Wellness',
    
    coreIdentity: {
      title: 'The Dedicated Partner',
      positioning: 'Direct, inspiring, and result-obsessed',
      tone: 'Motivating, straightforward, supportive'
    },
    
    cognitiveLogic: {
      framework: 'The Accountability Framework',
      reasoning: 'Logic that focuses on "Customization" and "Sustainable Results" through consistent accountability',
      decisionProcess: 'Goal Setting → Custom Programming → Accountability System'
    },
    
    knowledgeRAG: {
      static: [
        'Macro-nutrients and nutrition basics',
        'Periodization principles',
        'Exercise biomechanics',
        'Injury prevention',
        'Recovery protocols'
      ],
      dynamic: [
        'Client transformation photos (with permission)',
        'Personal training app links',
        'Pricing tiers (sessions, packages, monthly)',
        'Availability calendar',
        'Virtual training options',
        'Travel workout programs'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks "Excuses" or barriers (e.g., "traveling for work," "busy schedule," "gym access")',
      adaptation: 'Suggests "At-Home/Travel Workouts" or "Time-Efficient" programming to maintain engagement',
      feedbackIntegration: 'Learns which accountability methods (check-ins, app tracking, weekly calls) work best for different client types'
    },
    
    tacticalExecution: {
      primaryAction: 'Discovery Call',
      conversionRhythm: 'Every chat leads to a "Goal Setting Session" or "Free Assessment"',
      secondaryActions: [
        'Fitness assessment',
        'Body composition analysis',
        'Nutrition consultation',
        'Program preview',
        'Package selection'
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
        {id: 'client_transformations', label: 'Client Transformations', description: 'Before/after results', keywords: ["transformations", "before and after", "results", "success stories"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'certifications', label: 'Professional Certifications', description: 'Industry credentials', keywords: ["certified", "nasm", "ace", "issa", "cscs", "nsca"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'online_training', label: 'Online Training', description: 'Virtual coaching available', keywords: ["online training", "virtual training", "remote coaching", "app-based"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'nutrition_included', label: 'Nutrition Coaching', description: 'Nutrition included in training', keywords: ["nutrition", "meal plan", "nutrition coaching", "diet"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'specialization_weight', label: 'Weight Loss Specialist', description: 'Weight loss focus', keywords: ["weight loss", "fat loss", "body transformation", "get lean"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'specialization_strength', label: 'Strength Training', description: 'Strength and muscle building', keywords: ["strength training", "muscle building", "bodybuilding", "powerlifting"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'specialization_sports', label: 'Sports Performance', description: 'Athletic performance training', keywords: ["sports performance", "athletic training", "speed", "agility"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'small_group', label: 'Small Group Training', description: 'Semi-private sessions', keywords: ["small group", "semi-private", "partner training"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'free_assessment', label: 'Free Assessment', description: 'Complimentary consultation', keywords: ["free assessment", "free consultation", "complimentary"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'package_deals', label: 'Training Packages', description: 'Bundled session pricing', keywords: ["packages", "package pricing", "sessions"], regexPattern: '(\\d+)\\s*sessions?', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'hiring', label: 'Hiring Trainers', description: 'Growing team', keywords: ["hiring", "trainer positions", "join our team"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'expansion', label: 'Business Expansion', description: 'New locations or markets', keywords: ["expanding", "new location", "now serving"], priority: 'HIGH', action: 'increase-score', scoreBoost: 22, platform: 'any'},
        {id: 'app_coaching', label: 'App-Based Coaching', description: 'Custom training app', keywords: ["app", "mobile app", "training app", "my pt hub", "trainerize"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'flexible_location', label: 'Flexible Training Location', description: 'Home, gym, or outdoor training', keywords: ["home training", "outdoor", "your location", "mobile"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'testimonials', label: 'Client Testimonials', description: 'Multiple client reviews', keywords: ["testimonials", "reviews", "5 star", "client success"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'disclaimer', pattern: 'results may vary|consult physician', description: 'Disclaimer', context: 'footer'},
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
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'booking', pattern: '^book(ing)?$', description: 'Booking', context: 'header'},
        {id: 'results', pattern: '^results$', description: 'Results', context: 'header'},
        {id: 'programs', pattern: '^programs$', description: 'Programs', context: 'header'}
      ],

      scoringRules: [
        {id: 'proven_results', name: 'Proven Results', description: 'Transformations with testimonials', condition: 'signals.some(s => s.signalId === "client_transformations") && signals.some(s => s.signalId === "testimonials")', scoreBoost: 35, priority: 1, enabled: true},
        {id: 'certified_professional', name: 'Certified Professional', description: 'Certifications with proven results', condition: 'signals.some(s => s.signalId === "certifications") && signals.some(s => s.signalId === "client_transformations")', scoreBoost: 30, priority: 2, enabled: true},
        {id: 'comprehensive_coaching', name: 'Comprehensive Coaching', description: 'Training plus nutrition', condition: 'signals.some(s => s.signalId === "nutrition_included")', scoreBoost: 22, priority: 3, enabled: true},
        {id: 'hybrid_trainer', name: 'Hybrid Trainer', description: 'Online and in-person options', condition: 'signals.some(s => s.signalId === "online_training")', scoreBoost: 20, priority: 4, enabled: true},
        {id: 'growing_business', name: 'Growing Business', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 25, priority: 5, enabled: true},
        {id: 'niche_specialist', name: 'Niche Specialist', description: 'Specialized training focus', condition: 'signals.filter(s => ["specialization_weight", "specialization_strength", "specialization_sports"].includes(s.signalId)).length >= 1', scoreBoost: 18, priority: 6, enabled: true},
        {id: 'tech_enabled', name: 'Technology-Enabled', description: 'App-based coaching with online training', condition: 'signals.some(s => s.signalId === "app_coaching") && signals.some(s => s.signalId === "online_training")', scoreBoost: 20, priority: 7, enabled: true},
        {id: 'flexible_service', name: 'Flexible Service', description: 'Mobile or flexible location', condition: 'signals.some(s => s.signalId === "flexible_location")', scoreBoost: 12, priority: 8, enabled: true},
        {id: 'accessible', name: 'Accessible Pricing', description: 'Free assessment with packages', condition: 'signals.some(s => s.signalId === "free_assessment") && signals.some(s => s.signalId === "package_deals")', scoreBoost: 15, priority: 9, enabled: true},
        {id: 'group_options', name: 'Group Options', description: 'Small group training available', condition: 'signals.some(s => s.signalId === "small_group")', scoreBoost: 12, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'trainer_count', label: 'Number of Trainers', type: 'number', description: 'Training team size', extractionHints: ['trainers', 'coaches'], required: false, defaultValue: 1},
        {key: 'certifications', label: 'Certifications', type: 'array', description: 'Professional credentials', extractionHints: ['nasm', 'ace', 'issa', 'certified'], required: false, defaultValue: []},
        {key: 'offers_online', label: 'Offers Online Training', type: 'boolean', description: 'Virtual coaching available', extractionHints: ['online', 'virtual', 'remote'], required: false, defaultValue: false},
        {key: 'includes_nutrition', label: 'Includes Nutrition', type: 'boolean', description: 'Nutrition coaching included', extractionHints: ['nutrition'], required: false, defaultValue: false},
        {key: 'specialization', label: 'Training Specialization', type: 'string', description: 'Primary focus area', extractionHints: ['weight loss', 'strength', 'sports'], required: false, defaultValue: 'general'},
        {key: 'has_app', label: 'Has Training App', type: 'boolean', description: 'Custom app available', extractionHints: ['app'], required: false, defaultValue: false},
        {key: 'location_type', label: 'Location Type', type: 'string', description: 'Where training occurs', extractionHints: ['home', 'gym', 'studio', 'outdoor'], required: false, defaultValue: 'gym'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Personal training intelligence - focuses on results portfolio, certifications, service delivery models, and specializations'
      }
    }
  },
  
  'nutritional-coaching': {
    id: 'nutritional-coaching',
    name: 'Nutritional Coaching',
    description: 'For nutritionists - personalized and habit-focused',
    category: 'Healthcare & Wellness',
    
    coreIdentity: {
      title: 'The Scientific Strategist',
      positioning: 'Informative, practical, and habit-focused',
      tone: 'Educational, non-judgmental, empowering'
    },
    
    cognitiveLogic: {
      framework: 'The Bio-Individual Model',
      reasoning: 'Logic that rejects "Fad Diets" in favor of "Personalized Fueling" based on individual metabolic needs',
      decisionProcess: 'Individual Assessment → Custom Strategy → Habit Building'
    },
    
    knowledgeRAG: {
      static: [
        'Metabolism basics',
        'Food label reading',
        'Macronutrient functions',
        'Blood sugar regulation',
        'Supplement science'
      ],
      dynamic: [
        'Meal plan templates',
        'Supplement recommendations',
        'Client tracking software access',
        'Grocery shopping guides',
        'Recipe database',
        'Progress tracking tools'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Monitors "Craving Triggers" mentioned by the lead (sugar, late-night snacking)',
      adaptation: 'Suggests specific educational "Nudges" about blood sugar balance, protein timing, or stress eating',
      feedbackIntegration: 'Tracks which dietary approaches (macro counting, intuitive eating, meal prep) have highest adherence'
    },
    
    tacticalExecution: {
      primaryAction: 'Kitchen Audit or Custom Plan Request',
      conversionRhythm: 'Moves lead to the first assessment questionnaire or "Nutrition Kickstart" program',
      secondaryActions: [
        'Food journal review',
        'Metabolic assessment',
        'Supplement consultation',
        'Meal planning session',
        'Grocery list creation'
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
        {id: 'credentials', label: 'Registered Dietitian/Nutritionist', description: 'Professional credentials', keywords: ["rd", "rdn", "registered dietitian", "licensed nutritionist", "certified nutrition"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'client_results', label: 'Client Success Stories', description: 'Transformation results', keywords: ["success stories", "transformations", "before and after", "results", "testimonials"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'online_coaching', label: 'Online Coaching', description: 'Virtual nutrition coaching', keywords: ["online coaching", "virtual", "remote", "telehealth"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'meal_planning', label: 'Custom Meal Planning', description: 'Personalized meal plans', keywords: ["meal plan", "custom meal", "personalized nutrition", "meal prep"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'weight_loss', label: 'Weight Loss Programs', description: 'Weight management focus', keywords: ["weight loss", "fat loss", "lose weight", "weight management"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'sports_nutrition', label: 'Sports Nutrition', description: 'Athletic performance focus', keywords: ["sports nutrition", "performance nutrition", "athlete", "endurance"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'medical_nutrition', label: 'Medical Nutrition Therapy', description: 'Disease management', keywords: ["medical nutrition", "diabetes", "heart disease", "kidney disease", "mnt"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'group_programs', label: 'Group Programs', description: 'Group coaching available', keywords: ["group program", "group coaching", "challenge", "accountability group"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'app_based', label: 'App-Based Coaching', description: 'Mobile app for tracking', keywords: ["app", "mobile app", "nutrition app", "myfitnesspal", "coaching app"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'supplement_sales', label: 'Supplement Sales', description: 'Sells supplements', keywords: ["supplements", "shop", "products", "vitamins"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'insurance_accepted', label: 'Insurance Accepted', description: 'Medical nutrition therapy billing', keywords: ["insurance", "insurance accepted", "billing", "in-network"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 22, platform: 'website'},
        {id: 'free_consultation', label: 'Free Consultation', description: 'Complimentary initial meeting', keywords: ["free consultation", "complimentary", "free discovery call"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'hiring', label: 'Hiring Nutritionists', description: 'Growing team', keywords: ["hiring", "join our team", "nutritionist positions", "dietitian careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'corporate_wellness', label: 'Corporate Wellness', description: 'Business nutrition programs', keywords: ["corporate wellness", "workplace wellness", "corporate nutrition"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'package_programs', label: 'Package Programs', description: 'Structured programs', keywords: ["program", "package", "12 week", "90 day"], regexPattern: '(\\d+)\\s*(week|day|month)\\s*program', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'disclaimer', pattern: 'not intended to.*diagnose|results may vary', description: 'Disclaimer', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'programs', pattern: '^programs$', description: 'Programs', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'booking', pattern: '^book$', description: 'Booking', context: 'header'},
        {id: 'shop', pattern: '^shop$', description: 'Shop', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'}
      ],

      scoringRules: [
        {id: 'credentialed_professional', name: 'Credentialed Professional', description: 'RD with client results', condition: 'signals.some(s => s.signalId === "credentials") && signals.some(s => s.signalId === "client_results")', scoreBoost: 40, priority: 1, enabled: true},
        {id: 'comprehensive_services', name: 'Comprehensive Services', description: 'Meal planning with online coaching', condition: 'signals.some(s => s.signalId === "meal_planning") && signals.some(s => s.signalId === "online_coaching")', scoreBoost: 25, priority: 2, enabled: true},
        {id: 'medical_specialist', name: 'Medical Specialist', description: 'MNT with insurance', condition: 'signals.some(s => s.signalId === "medical_nutrition") && signals.some(s => s.signalId === "insurance_accepted")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'tech_enabled', name: 'Tech-Enabled', description: 'App-based coaching with online', condition: 'signals.some(s => s.signalId === "app_based") && signals.some(s => s.signalId === "online_coaching")', scoreBoost: 22, priority: 4, enabled: true},
        {id: 'growing_business', name: 'Growing Business', description: 'Hiring nutritionists', condition: 'signals.some(s => s.signalId === "hiring")', scoreBoost: 25, priority: 5, enabled: true},
        {id: 'niche_specialist', name: 'Niche Specialist', description: 'Sports or medical nutrition', condition: 'signals.some(s => s.signalId === "sports_nutrition") || signals.some(s => s.signalId === "medical_nutrition")', scoreBoost: 20, priority: 6, enabled: true},
        {id: 'scalable_model', name: 'Scalable Model', description: 'Group programs with packages', condition: 'signals.some(s => s.signalId === "group_programs") && signals.some(s => s.signalId === "package_programs")', scoreBoost: 18, priority: 7, enabled: true},
        {id: 'revenue_streams', name: 'Multiple Revenue Streams', description: 'Coaching plus supplements', condition: 'signals.some(s => s.signalId === "supplement_sales")', scoreBoost: 12, priority: 8, enabled: true},
        {id: 'corporate_market', name: 'Corporate Market', description: 'B2B wellness programs', condition: 'signals.some(s => s.signalId === "corporate_wellness")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'accessible', name: 'Accessible Service', description: 'Free consultation with flexible pricing', condition: 'signals.some(s => s.signalId === "free_consultation") && signals.some(s => s.signalId === "package_programs")', scoreBoost: 15, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'is_registered_dietitian', label: 'Registered Dietitian', type: 'boolean', description: 'RD/RDN credential', extractionHints: ['rd', 'rdn', 'registered dietitian'], required: false, defaultValue: false},
        {key: 'specialization', label: 'Nutrition Specialization', type: 'string', description: 'Primary focus area', extractionHints: ['weight loss', 'sports', 'medical'], required: false, defaultValue: 'general'},
        {key: 'offers_online', label: 'Offers Online Coaching', type: 'boolean', description: 'Virtual services', extractionHints: ['online', 'virtual'], required: false, defaultValue: false},
        {key: 'accepts_insurance', label: 'Accepts Insurance', type: 'boolean', description: 'Insurance billing', extractionHints: ['insurance'], required: false, defaultValue: false},
        {key: 'has_app', label: 'Has Coaching App', type: 'boolean', description: 'Mobile app platform', extractionHints: ['app'], required: false, defaultValue: false},
        {key: 'program_types', label: 'Program Types', type: 'array', description: 'Coaching formats', extractionHints: ['individual', 'group', 'corporate'], required: false, defaultValue: []},
        {key: 'team_size', label: 'Team Size', type: 'number', description: 'Number of nutritionists', extractionHints: ['nutritionists', 'dietitians', 'team'], required: false, defaultValue: 1}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Nutritional coaching intelligence - focuses on credentials, specializations, service delivery models, and B2B opportunities'
      }
    }
  },
  
  'veterinary-practices': {
    id: 'veterinary-practices',
    name: 'Veterinary Practices',
    description: 'For vets - compassionate pet care focus',
    category: 'Healthcare & Wellness',
    
    coreIdentity: {
      title: 'The Compassionate Caregiver',
      positioning: 'Patient, empathetic, and medically authoritative',
      tone: 'Warm, caring, professional'
    },
    
    cognitiveLogic: {
      framework: 'The "Pet-as-Family" Framework',
      reasoning: 'Logic that treats the pet\'s health as a primary family priority, with emotional connection to owner\'s concerns',
      decisionProcess: 'Empathy → Medical Guidance → Care Action'
    },
    
    knowledgeRAG: {
      static: [
        'Vaccination schedules by species',
        'Emergency symptoms (bloat, poisoning, trauma)',
        'Preventative care protocols',
        'Common conditions by breed',
        'Spay/neuter information'
      ],
      dynamic: [
        'Clinic hours (regular + emergency)',
        'Specific "Pet Portal" links for records',
        'In-house pharmacy medication list',
        'Vet and staff bios',
        'Appointment availability',
        'Boarding/grooming services'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects "Emergency Keywords" (bleeding, seizure, not eating, difficulty breathing)',
      adaptation: 'Bypasses AI conversation to provide immediate "Call Now" buttons and directions to nearest emergency vet',
      feedbackIntegration: 'Learns which preventative care reminders (dental, heartworm, vaccines) have highest compliance rates'
    },
    
    tacticalExecution: {
      primaryAction: 'Wellness Exam Booking',
      conversionRhythm: 'Focuses on preventative care appointments and "New Pet" exam packages',
      secondaryActions: [
        'Emergency triage (immediate)',
        'Vaccination scheduling',
        'Pet portal registration',
        'Prescription refill requests',
        'Grooming/boarding booking'
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
        {id: 'multiple_veterinarians', label: 'Multi-Vet Practice', description: 'Multiple veterinarians on staff', keywords: ["veterinarians", "vets", "doctors"], regexPattern: '(\\d+)\\s*(veterinarians?|vets?|doctors?)', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'emergency_care', label: '24/7 Emergency Care', description: 'Emergency services available', keywords: ["24/7", "emergency", "after hours", "emergency care", "urgent care"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'accepting_patients', label: 'Accepting New Clients', description: 'Welcoming new pets', keywords: ["accepting new", "new clients welcome", "new patients"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'specialty_services', label: 'Specialty Services', description: 'Advanced medical services', keywords: ["surgery", "dentistry", "ultrasound", "cardiology", "oncology", "orthopedic"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'website'},
        {id: 'boarding', label: 'Boarding Services', description: 'Pet boarding available', keywords: ["boarding", "kennel", "pet hotel", "overnight"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'grooming', label: 'Grooming Services', description: 'Grooming offered', keywords: ["grooming", "bathing", "nail trim", "groomer"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'wellness_plans', label: 'Wellness Plans', description: 'Preventative care plans', keywords: ["wellness plan", "pet plan", "care plan", "membership"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'exotic_pets', label: 'Exotic Pet Care', description: 'Treats exotic animals', keywords: ["exotic", "birds", "reptiles", "pocket pets", "avian"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'online_pharmacy', label: 'Online Pharmacy', description: 'Prescription ordering online', keywords: ["online pharmacy", "prescription", "medication", "pharmacy"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'pet_portal', label: 'Pet Portal', description: 'Online records access', keywords: ["pet portal", "online records", "client portal", "petdesk"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'hiring', label: 'Hiring Veterinarians', description: 'Growing practice', keywords: ["hiring", "veterinarian positions", "join our team", "vet careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Practice Expansion', description: 'New locations', keywords: ["new location", "expanding", "second clinic", "now open"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'any'},
        {id: 'mobile_vet', label: 'Mobile Vet Services', description: 'House call services', keywords: ["mobile", "house call", "come to you", "in-home"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'low_cost_clinic', label: 'Low-Cost Services', description: 'Affordable care options', keywords: ["low cost", "affordable", "vaccine clinic", "spay neuter clinic"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'weekend_hours', label: 'Weekend Hours', description: 'Saturday/Sunday availability', keywords: ["saturday", "sunday", "weekend", "7 days"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'aaha', pattern: 'aaha', description: 'AAHA accreditation', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'team', pattern: '^team$', description: 'Team link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'emergency', pattern: '^emergency$', description: 'Emergency', context: 'header'},
        {id: 'portal', pattern: '^portal$', description: 'Portal', context: 'header'},
        {id: 'new_clients', pattern: '^new clients$', description: 'New clients', context: 'header'}
      ],

      scoringRules: [
        {id: 'emergency_hospital', name: 'Emergency Hospital', description: '24/7 care with multiple vets', condition: 'signals.some(s => s.signalId === "emergency_care") && signals.some(s => s.signalId === "multiple_veterinarians")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'full_service', name: 'Full-Service Hospital', description: 'Specialty services with boarding', condition: 'signals.some(s => s.signalId === "specialty_services") && signals.some(s => s.signalId === "boarding")', scoreBoost: 30, priority: 2, enabled: true},
        {id: 'growing_practice', name: 'Growing Practice', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'comprehensive_care', name: 'Comprehensive Care', description: 'Medical + grooming + boarding', condition: 'signals.some(s => s.signalId === "boarding") && signals.some(s => s.signalId === "grooming")', scoreBoost: 22, priority: 4, enabled: true},
        {id: 'modern_practice', name: 'Modern Practice', description: 'Pet portal with online pharmacy', condition: 'signals.some(s => s.signalId === "pet_portal") && signals.some(s => s.signalId === "online_pharmacy")', scoreBoost: 20, priority: 5, enabled: true},
        {id: 'specialty_hospital', name: 'Specialty Hospital', description: 'Advanced services with multiple vets', condition: 'signals.some(s => s.signalId === "specialty_services") && signals.some(s => s.signalId === "multiple_veterinarians")', scoreBoost: 35, priority: 6, enabled: true},
        {id: 'wellness_focused', name: 'Wellness-Focused', description: 'Wellness plans offered', condition: 'signals.some(s => s.signalId === "wellness_plans")', scoreBoost: 15, priority: 7, enabled: true},
        {id: 'exotic_specialist', name: 'Exotic Specialist', description: 'Exotic pet expertise', condition: 'signals.some(s => s.signalId === "exotic_pets")', scoreBoost: 20, priority: 8, enabled: true},
        {id: 'convenient_care', name: 'Convenient Care', description: 'Weekend hours with mobile services', condition: 'signals.some(s => s.signalId === "weekend_hours") || signals.some(s => s.signalId === "mobile_vet")', scoreBoost: 18, priority: 9, enabled: true},
        {id: 'accessible', name: 'Accessible Practice', description: 'Accepting patients with low-cost options', condition: 'signals.some(s => s.signalId === "accepting_patients") && signals.some(s => s.signalId === "low_cost_clinic")', scoreBoost: 15, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'veterinarian_count', label: 'Number of Veterinarians', type: 'number', description: 'Vets on staff', extractionHints: ['veterinarians', 'vets', 'doctors'], required: false, defaultValue: 1},
        {key: 'has_emergency', label: 'Emergency Services', type: 'boolean', description: '24/7 emergency care', extractionHints: ['24/7', 'emergency'], required: false, defaultValue: false},
        {key: 'services_offered', label: 'Services Offered', type: 'array', description: 'Service types', extractionHints: ['surgery', 'dentistry', 'boarding', 'grooming'], required: false, defaultValue: []},
        {key: 'specializes_in', label: 'Animal Specialization', type: 'array', description: 'Types of animals treated', extractionHints: ['dogs', 'cats', 'exotic', 'birds'], required: false, defaultValue: ['dogs', 'cats']},
        {key: 'has_wellness_plan', label: 'Wellness Plan Available', type: 'boolean', description: 'Preventative care plans', extractionHints: ['wellness plan'], required: false, defaultValue: false},
        {key: 'location_count', label: 'Clinic Locations', type: 'number', description: 'Number of clinics', extractionHints: ['locations', 'clinics'], required: false, defaultValue: 1},
        {key: 'weekend_availability', label: 'Weekend Hours', type: 'boolean', description: 'Saturday/Sunday open', extractionHints: ['saturday', 'sunday'], required: false, defaultValue: false}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Veterinary practice intelligence - focuses on emergency capabilities, service breadth, practice size, and specialized care offerings'
      }
    }
  },
  
  // ============================================
  // TECHNOLOGY & BUSINESS SERVICES (Templates 21-30)
  // ============================================
  
  'saas-software': {
    id: 'saas-software',
    name: 'SaaS (Software as a Service)',
    description: 'For SaaS companies - ROI and productivity focus',
    category: 'Technology & Business Services',
    
    coreIdentity: {
      title: 'The Strategic Solutions Architect',
      positioning: 'Efficient, forward-thinking, and logic-driven',
      tone: 'Professional, consultative, data-driven'
    },
    
    cognitiveLogic: {
      framework: 'The Problem-to-Productivity Bridge',
      reasoning: 'Logic that calculates "Manual Hours Lost" and replaces them with "Automated ROI"',
      decisionProcess: 'Pain Point → Time/Cost Calculation → Automation Solution'
    },
    
    knowledgeRAG: {
      static: [
        'Subscription model best practices',
        'API integration basics',
        'SaaS metrics (MRR, Churn, LTV)',
        'Implementation methodologies',
        'Data migration processes'
      ],
      dynamic: [
        'Feature list and roadmap',
        'Current integrations catalog',
        'Case Studies by industry',
        'Pricing tiers and comparisons',
        'Trial/demo availability',
        'Implementation timelines'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Identifies "Feature Gaps"—if 5+ users ask for an integration you don\'t have',
      adaptation: 'Flags it as a "Product Roadmap Opportunity" to inform product development',
      feedbackIntegration: 'Tracks which use cases (by industry/company size) have highest conversion and retention'
    },
    
    tacticalExecution: {
      primaryAction: 'Interactive Demo',
      conversionRhythm: 'Every exchange moves toward a "Live Walkthrough" or "Free Trial" signup',
      secondaryActions: [
        'ROI calculator',
        'Case study download',
        'Integration compatibility check',
        'Pricing comparison',
        'Implementation timeline estimate'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['linkedin-company', 'linkedin-jobs', 'crunchbase', 'news'],
        frequency: 'weekly',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 600
      },

      highValueSignals: [
        {
          id: 'funding_announcement',
          label: 'Recent Funding',
          description: 'Company raised funding recently',
          keywords: ["raised", "funding round", "series a", "series b", "seed round", "investment", "venture capital"],
          priority: 'CRITICAL',
          action: 'trigger-workflow',
          scoreBoost: 50,
          platform: 'news',
          examples: ["Raised $10M Series A", "Closed seed round"]
        },
        {
          id: 'hiring_engineers',
          label: 'Hiring Engineering Team',
          description: 'Actively hiring software engineers',
          keywords: ["software engineer", "backend engineer", "frontend engineer", "full stack", "devops", "engineering positions"],
          priority: 'HIGH',
          action: 'increase-score',
          scoreBoost: 30,
          platform: 'linkedin-jobs'
        },
        {
          id: 'product_launch',
          label: 'Product Launch',
          description: 'Recently launched new product or feature',
          keywords: ["launching", "new feature", "product update", "now available", "introducing", "announcing"],
          priority: 'HIGH',
          action: 'increase-score',
          scoreBoost: 25,
          platform: 'any',
          examples: ["Launching AI-powered analytics", "New integration available"]
        },
        {
          id: 'api_available',
          label: 'API Available',
          description: 'Offers API for integrations',
          keywords: ["api", "developer docs", "rest api", "graphql", "webhooks", "api documentation"],
          priority: 'MEDIUM',
          action: 'add-to-segment',
          scoreBoost: 15,
          platform: 'website'
        },
        {
          id: 'integrations',
          label: 'Third-Party Integrations',
          description: 'Integrates with other platforms',
          keywords: ["integrations", "works with", "connects to", "zapier", "slack", "salesforce", "hubspot"],
          priority: 'MEDIUM',
          action: 'increase-score',
          scoreBoost: 12,
          platform: 'website'
        },
        {
          id: 'enterprise_tier',
          label: 'Enterprise Plan',
          description: 'Offers enterprise pricing tier',
          keywords: ["enterprise", "custom pricing", "contact sales", "dedicated support", "sla"],
          priority: 'HIGH',
          action: 'add-to-segment',
          scoreBoost: 20,
          platform: 'website'
        },
        {
          id: 'free_trial',
          label: 'Free Trial Available',
          description: 'Offers free trial period',
          keywords: ["free trial", "14-day trial", "30-day trial", "try free", "no credit card"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 5,
          platform: 'website'
        },
        {
          id: 'soc2_compliant',
          label: 'SOC 2 Compliant',
          description: 'Has SOC 2 certification',
          keywords: ["soc 2", "soc2", "security certified", "compliance", "gdpr", "hipaa"],
          priority: 'MEDIUM',
          action: 'increase-score',
          scoreBoost: 15,
          platform: 'website'
        },
        {
          id: 'customer_testimonials',
          label: 'Customer Testimonials',
          description: 'Has customer success stories',
          keywords: ["customer stories", "case studies", "testimonials", "success stories", "customer reviews"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 8,
          platform: 'website'
        },
        {
          id: 'white_label',
          label: 'White Label Option',
          description: 'Offers white-label solution',
          keywords: ["white label", "rebrand", "custom branding", "private label"],
          priority: 'MEDIUM',
          action: 'add-to-segment',
          scoreBoost: 18,
          platform: 'website'
        },
        {
          id: 'multi_language',
          label: 'Multi-Language Support',
          description: 'Supports multiple languages',
          keywords: ["multi-language", "multilingual", "international", "languages supported"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 8,
          platform: 'website'
        },
        {
          id: 'mobile_app',
          label: 'Mobile App',
          description: 'Has iOS/Android mobile apps',
          keywords: ["mobile app", "ios app", "android app", "app store", "google play"],
          priority: 'MEDIUM',
          action: 'increase-score',
          scoreBoost: 10,
          platform: 'website'
        },
        {
          id: 'team_size',
          label: 'Team Size',
          description: 'Company employee count',
          keywords: ["team of", "employees", "growing team"],
          regexPattern: '(\\d+)\\+?\\s*(employees?|team members?|people)',
          priority: 'MEDIUM',
          action: 'increase-score',
          scoreBoost: 12,
          platform: 'any'
        },
        {
          id: 'customer_count',
          label: 'Customer Count',
          description: 'Number of customers or users',
          keywords: ["customers", "users", "businesses", "companies"],
          regexPattern: '(\\d+[kKmM]?)\\+?\\s*(customers?|users?|businesses?)',
          priority: 'HIGH',
          action: 'increase-score',
          scoreBoost: 20,
          platform: 'website'
        },
        {
          id: 'uptime_sla',
          label: 'Uptime Guarantee',
          description: 'Guarantees uptime percentage',
          keywords: ["uptime", "99.9%", "availability", "sla guarantee"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 5,
          platform: 'website'
        },
        {
          id: 'data_export',
          label: 'Data Export',
          description: 'Allows data export',
          keywords: ["export data", "download data", "csv export", "data portability"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 5,
          platform: 'website'
        },
        {
          id: 'marketplace',
          label: 'App Marketplace',
          description: 'Has marketplace for extensions',
          keywords: ["marketplace", "app store", "extensions", "plugins", "add-ons"],
          priority: 'MEDIUM',
          action: 'increase-score',
          scoreBoost: 12,
          platform: 'website'
        },
        {
          id: 'analytics_dashboard',
          label: 'Analytics/Reporting',
          description: 'Offers analytics or reporting features',
          keywords: ["analytics", "reporting", "dashboard", "insights", "metrics"],
          priority: 'LOW',
          action: 'increase-score',
          scoreBoost: 8,
          platform: 'website'
        },
        {
          id: 'automation_features',
          label: 'Automation Capabilities',
          description: 'Offers workflow automation',
          keywords: ["automation", "workflow", "triggers", "automated", "auto-sync"],
          priority: 'MEDIUM',
          action: 'increase-score',
          scoreBoost: 12,
          platform: 'website'
        },
        {
          id: 'awards_recognition',
          label: 'Industry Awards',
          description: 'Won industry awards or recognition',
          keywords: ["award", "leader", "gartner", "forrester", "g2", "capterra", "best software"],
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
        { id: 'terms_of_service', pattern: 'terms of service', description: 'TOS link', context: 'footer' },
        { id: 'cookie_notice', pattern: 'we use cookies', description: 'Cookie banner', context: 'all' },
        { id: 'cookie_settings', pattern: 'cookie (settings|preferences)', description: 'Cookie controls', context: 'all' },
        { id: 'gdpr_notice', pattern: 'gdpr|data protection', description: 'GDPR notice', context: 'footer' },
        { id: 'social_links', pattern: 'follow us|connect with us', description: 'Social media links', context: 'footer' },
        { id: 'nav_home', pattern: '^home$', description: 'Home nav link', context: 'header' },
        { id: 'nav_about', pattern: '^about( us)?$', description: 'About nav link', context: 'header' },
        { id: 'nav_contact', pattern: '^contact( us)?$', description: 'Contact nav link', context: 'header' },
        { id: 'nav_pricing', pattern: '^pricing$', description: 'Pricing nav link', context: 'header' },
        { id: 'nav_login', pattern: '^(log ?in|sign in)$', description: 'Login link', context: 'header' },
        { id: 'nav_signup', pattern: '^(sign up|get started)$', description: 'Signup link', context: 'header' },
        { id: 'newsletter_signup', pattern: 'subscribe to (our )?newsletter', description: 'Newsletter CTA', context: 'all' },
        { id: 'unsubscribe', pattern: 'unsubscribe', description: 'Unsubscribe link', context: 'footer' },
        { id: 'site_search', pattern: 'search (our site|docs)', description: 'Search box', context: 'header' },
        { id: 'help_center', pattern: 'help center|support center', description: 'Help link', context: 'header' },
        { id: 'documentation', pattern: '^docs?$|^documentation$', description: 'Docs link', context: 'header' },
        { id: 'blog_link', pattern: '^blog$', description: 'Blog link', context: 'header' },
        { id: 'careers_link', pattern: '^careers$|^jobs$', description: 'Careers link', context: 'footer' },
        { id: 'status_page', pattern: 'system status|service status', description: 'Status page link', context: 'footer' },
        { id: 'security', pattern: 'security overview', description: 'Security link', context: 'footer' },
        { id: 'compliance', pattern: 'compliance', description: 'Compliance link', context: 'footer' },
        { id: 'back_to_top', pattern: 'back to top|scroll to top', description: 'Back to top link', context: 'footer' }
      ],

      scoringRules: [
        {
          id: 'recent_funding_with_hiring',
          name: 'Funding + Hiring',
          description: 'Recently funded and actively hiring',
          condition: 'signals.some(s => s.signalId === "funding_announcement") && signals.some(s => s.signalId === "hiring_engineers")',
          scoreBoost: 30,
          priority: 1,
          enabled: true
        },
        {
          id: 'product_market_fit',
          name: 'Strong Product-Market Fit',
          description: 'Large customer base with testimonials',
          condition: 'signals.some(s => s.signalId === "customer_count") && signals.some(s => s.signalId === "customer_testimonials")',
          scoreBoost: 20,
          priority: 2,
          enabled: true
        },
        {
          id: 'enterprise_ready',
          name: 'Enterprise Ready',
          description: 'SOC 2 compliant with enterprise tier',
          condition: 'signals.some(s => s.signalId === "soc2_compliant") && signals.some(s => s.signalId === "enterprise_tier")',
          scoreBoost: 25,
          priority: 3,
          enabled: true
        },
        {
          id: 'platform_play',
          name: 'Platform Strategy',
          description: 'Has API, integrations, and marketplace',
          condition: 'signals.some(s => s.signalId === "api_available") && signals.some(s => s.signalId === "integrations") && signals.some(s => s.signalId === "marketplace")',
          scoreBoost: 25,
          priority: 4,
          enabled: true
        },
        {
          id: 'product_momentum',
          name: 'Product Momentum',
          description: 'Recent product launch with growing team',
          condition: 'signals.some(s => s.signalId === "product_launch") && signals.some(s => s.signalId === "team_size")',
          scoreBoost: 15,
          priority: 5,
          enabled: true
        },
        {
          id: 'global_expansion',
          name: 'Global Expansion',
          description: 'Multi-language with mobile apps',
          condition: 'signals.some(s => s.signalId === "multi_language") && signals.some(s => s.signalId === "mobile_app")',
          scoreBoost: 15,
          priority: 6,
          enabled: true
        },
        {
          id: 'automation_leader',
          name: 'Automation Leader',
          description: 'Strong automation and analytics features',
          condition: 'signals.some(s => s.signalId === "automation_features") && signals.some(s => s.signalId === "analytics_dashboard")',
          scoreBoost: 12,
          priority: 7,
          enabled: true
        },
        {
          id: 'partner_program',
          name: 'Partner-Friendly',
          description: 'White label option with API',
          condition: 'signals.some(s => s.signalId === "white_label") && signals.some(s => s.signalId === "api_available")',
          scoreBoost: 18,
          priority: 8,
          enabled: true
        },
        {
          id: 'industry_leader',
          name: 'Industry Recognition',
          description: 'Award-winning with large customer base',
          condition: 'signals.some(s => s.signalId === "awards_recognition") && signals.some(s => s.signalId === "customer_count")',
          scoreBoost: 20,
          priority: 9,
          enabled: true
        },
        {
          id: 'reliable_infrastructure',
          name: 'Reliable Infrastructure',
          description: 'High uptime with data export',
          condition: 'signals.some(s => s.signalId === "uptime_sla") && signals.some(s => s.signalId === "data_export")',
          scoreBoost: 10,
          priority: 10,
          enabled: true
        }
      ],

      customFields: [
        {
          key: 'funding_amount',
          label: 'Funding Amount Raised',
          type: 'string',
          description: 'Amount raised in latest funding round',
          extractionHints: ['raised', 'million', 'funding', 'series'],
          required: false,
          defaultValue: ''
        },
        {
          key: 'customer_count',
          label: 'Number of Customers',
          type: 'number',
          description: 'Total customer or user count',
          extractionHints: ['customers', 'users', 'businesses'],
          required: false,
          defaultValue: 0
        },
        {
          key: 'team_size',
          label: 'Team Size',
          type: 'number',
          description: 'Number of employees',
          extractionHints: ['team of', 'employees', 'growing team'],
          required: false,
          defaultValue: 0
        },
        {
          key: 'has_api',
          label: 'Has Public API',
          type: 'boolean',
          description: 'Whether API is available',
          extractionHints: ['api', 'developer', 'rest api'],
          required: false,
          defaultValue: false
        },
        {
          key: 'integration_count',
          label: 'Number of Integrations',
          type: 'number',
          description: 'How many third-party integrations',
          extractionHints: ['integrations', 'works with', 'connects'],
          required: false,
          defaultValue: 0
        },
        {
          key: 'has_free_trial',
          label: 'Offers Free Trial',
          type: 'boolean',
          description: 'Whether free trial is available',
          extractionHints: ['free trial', 'try free', 'no credit card'],
          required: false,
          defaultValue: false
        },
        {
          key: 'compliance_certifications',
          label: 'Compliance Certifications',
          type: 'array',
          description: 'List of certifications (SOC 2, GDPR, HIPAA)',
          extractionHints: ['soc 2', 'gdpr', 'hipaa', 'certified'],
          required: false,
          defaultValue: []
        },
        {
          key: 'pricing_model',
          label: 'Pricing Model',
          type: 'string',
          description: 'Subscription, usage-based, or custom',
          extractionHints: ['pricing', 'per user', 'per month', 'custom pricing'],
          required: false,
          defaultValue: 'unknown'
        },
        {
          key: 'has_mobile_app',
          label: 'Has Mobile Apps',
          type: 'boolean',
          description: 'Whether iOS/Android apps exist',
          extractionHints: ['mobile app', 'ios', 'android'],
          required: false,
          defaultValue: false
        },
        {
          key: 'target_company_size',
          label: 'Target Company Size',
          type: 'string',
          description: 'SMB, Mid-Market, or Enterprise',
          extractionHints: ['small business', 'enterprise', 'startups'],
          required: false,
          defaultValue: 'unknown'
        }
      ],

      metadata: {
        lastUpdated: '2025-12-28',
        version: 1,
        updatedBy: 'system',
        notes: 'SaaS industry research intelligence - focuses on funding, hiring, product launches, enterprise readiness, and platform capabilities'
      }
    }
  }
};
