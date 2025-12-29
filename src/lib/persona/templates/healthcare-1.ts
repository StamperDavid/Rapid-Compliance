import type { IndustryTemplate } from './types';

export const healthcareTemplates1: Record<string, IndustryTemplate> = {
  // HEALTHCARE & WELLNESS SECTOR (Templates 11-20)
  // ============================================
  
  'dental-practices': {
    id: 'dental-practices',
    name: 'Dental Practices',
    description: 'For dentists - anxiety reduction and patient comfort',
    category: 'Healthcare & Wellness',
    
    coreIdentity: {
      title: 'The Reassuring Patient Advocate',
      positioning: 'Clinical, gentle, and highly organized. Focuses on "Gentle Care"',
      tone: 'Warm, reassuring, professional'
    },
    
    cognitiveLogic: {
      framework: 'The Anxiety-to-Action Framework',
      reasoning: 'Logic that identifies dental fear (pain concerns, cost anxiety) and counters with sedation options, financing, and comfort amenities',
      decisionProcess: 'Fear Identification → Comfort Solution → Action'
    },
    
    knowledgeRAG: {
      static: [
        'ADA (American Dental Association) guidelines',
        'Common procedures (Crowns, Fillings, Root Canals, Cleanings)',
        'Dental terminology',
        'Preventative care protocols',
        'Sedation dentistry options'
      ],
      dynamic: [
        'Insurance providers accepted',
        'Dr. bios and specializations',
        'Specific "Comfort" amenities (TV, heated blankets, noise-canceling headphones)',
        'Appointment availability',
        'New patient specials',
        'Financing options'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects if leads drop off when "Root Canal" or "Extraction" is mentioned',
      adaptation: 'Triggers a "Technology/Pain-Free" success story showcasing modern techniques and sedation options',
      feedbackIntegration: 'Learns which comfort amenities (sedation, music, breaks) reduce appointment anxiety most effectively'
    },
    
    tacticalExecution: {
      primaryAction: 'Appointment Request',
      conversionRhythm: 'Every interaction ends with checking the calendar for a "New Patient Special" or "Emergency Slot"',
      secondaryActions: [
        'Insurance verification',
        'Virtual smile assessment',
        'Financing pre-qualification',
        'Emergency triage (pain level assessment)',
        'Office tour scheduling'
      ]
    },

    research: {
      scrapingStrategy: {primarySource: 'website', secondarySources: ['linkedin-jobs', 'google-business'], frequency: 'per-lead', timeoutMs: 30000, enableCaching: true, cacheTtlSeconds: 300},
      highValueSignals: [
        {id: 'hiring_hygienists', label: 'Hiring Dental Staff', description: 'Recruiting hygienists or assistants', keywords: ["hiring", "dental hygienist", "dental assistant", "join our team"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'new_location', label: 'New Practice/Location', description: 'Opening new office', keywords: ["new location", "opening", "second office", "expanding"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'emergency_dentistry', label: 'Emergency Services', description: 'Same-day/emergency appointments', keywords: ["emergency", "same day", "walk-in", "urgent care"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'cosmetic_dentistry', label: 'Cosmetic Services', description: 'Veneers, whitening, etc', keywords: ["cosmetic", "veneers", "whitening", "smile makeover"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'orthodontics', label: 'Orthodontics', description: 'Braces or Invisalign', keywords: ["invisalign", "braces", "orthodontics", "clear aligners"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'sedation_dentistry', label: 'Sedation Options', description: 'Offers sedation for anxiety', keywords: ["sedation", "iv sedation", "nitrous", "sleep dentistry"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'implants', label: 'Dental Implants', description: 'Implant dentistry', keywords: ["implants", "dental implants", "all-on-4"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'pediatric', label: 'Pediatric Dentistry', description: 'Treats children', keywords: ["pediatric", "kids", "children", "family dentist"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'financing', label: 'Financing Available', description: 'Payment plans offered', keywords: ["financing", "payment plans", "carecredit", "0% interest"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'new_patient_special', label: 'New Patient Offer', description: 'Special for new patients', keywords: ["new patient", "special", "discount", "first visit"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'insurance_accepted', label: 'Insurance Accepted', description: 'Accepts dental insurance', keywords: ["insurance", "in-network", "we accept", "insurance plans"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'weekend_hours', label: 'Weekend Availability', description: 'Saturday/Sunday hours', keywords: ["saturday", "sunday", "weekend", "open weekends"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'digital_technology', label: 'Modern Technology', description: 'Digital X-rays, 3D scanning', keywords: ["digital", "3d", "cerec", "laser", "cone beam"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'}
      ],
      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'privacy', pattern: 'privacy (policy|notice)', description: 'Privacy link', context: 'footer'},
        {id: 'hipaa', pattern: 'hipaa', description: 'HIPAA notice', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social links', context: 'footer'},
        {id: 'contact', pattern: '^contact( us)?$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about( us)?$', description: 'About link', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back link', context: 'footer'}
      ],
      scoringRules: [
        {id: 'growing_practice', name: 'Growing Practice', description: 'Expanding + hiring', condition: 'signals.some(s => s.signalId === "new_location") && signals.some(s => s.signalId === "hiring_hygienists")', scoreBoost: 25, priority: 1, enabled: true},
        {id: 'full_service', name: 'Full Service', description: 'General + cosmetic + implants', condition: 'signals.some(s => s.signalId === "cosmetic_dentistry") && signals.some(s => s.signalId === "implants")', scoreBoost: 20, priority: 2, enabled: true},
        {id: 'modern_tech', name: 'Technology Leader', description: 'Digital tech + sedation', condition: 'signals.some(s => s.signalId === "digital_technology") && signals.some(s => s.signalId === "sedation_dentistry")', scoreBoost: 15, priority: 3, enabled: true}
      ],
      customFields: [
        {key: 'staff_count', label: 'Number of Dentists', type: 'number', description: 'Practice size', extractionHints: ['dentists', 'providers', 'doctors'], required: false, defaultValue: 1},
        {key: 'specialties', label: 'Specialties', type: 'array', description: 'Services offered', extractionHints: ['cosmetic', 'implants', 'orthodontics'], required: false, defaultValue: []},
        {key: 'has_sedation', label: 'Offers Sedation', type: 'boolean', description: 'Sedation available', extractionHints: ['sedation', 'iv', 'nitrous'], required: false, defaultValue: false},
        {key: 'accepts_insurance', label: 'Accepts Insurance', type: 'boolean', description: 'Insurance accepted', extractionHints: ['insurance', 'in-network'], required: false, defaultValue: false},
        {key: 'has_financing', label: 'Offers Financing', type: 'boolean', description: 'Payment plans', extractionHints: ['financing', 'carecredit'], required: false, defaultValue: false}
      ],
      metadata: {lastUpdated: '2025-12-28', version: 1, updatedBy: 'system', notes: 'Dental practice intelligence - growth, specialties, technology'}
    }
  },
  
  'plastic-surgery': {
    id: 'plastic-surgery',
    name: 'Plastic Surgery',
    description: 'For surgeons - discretion and confidence building',
    category: 'Healthcare & Wellness',
    
    coreIdentity: {
      title: 'The Aesthetic Perfectionist',
      positioning: 'Discreet, elite, empathetic, and sophisticated',
      tone: 'Professional, confidential, aspirational'
    },
    
    cognitiveLogic: {
      framework: 'The "Self-Actualization" Model',
      reasoning: 'Logic that moves from "Procedure" to "Result/Confidence." Focuses on the "Why now?" to understand patient motivation',
      decisionProcess: 'Motivation Discovery → Procedure Alignment → Confidence Building'
    },
    
    knowledgeRAG: {
      static: [
        'Surgical recovery timelines',
        'BMI and health requirements',
        'Procedure types and techniques',
        'Anesthesia options',
        'Risk disclosures'
      ],
      dynamic: [
        'Before/After gallery (privacy-protected)',
        'Surgical facility accreditation',
        'Recovery protocols by procedure',
        'Surgeon credentials and specializations',
        'Financing options',
        'Consultation availability'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Monitors lead interest in specific "Combination Surgeries" (e.g., Mommy Makeover, Facelift + Neck Lift)',
      adaptation: 'Suggests personalized consultation packages that address multiple concerns simultaneously',
      feedbackIntegration: 'Tracks which result photos (subtle vs dramatic) resonate with different patient demographics'
    },
    
    tacticalExecution: {
      primaryAction: 'Private Consultation',
      conversionRhythm: 'Focuses on booking a confidential 1:1 with the surgeon or a patient coordinator',
      secondaryActions: [
        'Virtual consultation option',
        'Before/After gallery viewing',
        'Financing pre-approval',
        'Recovery timeline planning',
        'Procedure education materials'
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
        {id: 'board_certified', label: 'Board Certified Surgeon', description: 'ABPS certification', keywords: ["board certified", "abps", "american board of plastic surgery", "certified surgeon"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'before_after', label: 'Before & After Gallery', description: 'Result portfolio available', keywords: ["before and after", "before & after", "results", "gallery", "transformations"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'accredited_facility', label: 'Accredited Surgical Facility', description: 'AAAASF or AAAHC accredited', keywords: ["accredited", "aaaasf", "aaahc", "certified facility", "surgical center"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'multiple_surgeons', label: 'Multiple Surgeons', description: 'Group practice', keywords: ["surgeons", "team of doctors", "physicians"], regexPattern: '(\\d+)\\s*surgeons?', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'financing', label: 'Patient Financing', description: 'Financing options available', keywords: ["financing", "payment plans", "care credit", "alphaeon", "prosper healthcare"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'virtual_consult', label: 'Virtual Consultations', description: 'Telemedicine available', keywords: ["virtual consultation", "online consultation", "video call", "telehealth"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'procedure_variety', label: 'Wide Procedure Range', description: 'Multiple procedures offered', keywords: ["breast augmentation", "rhinoplasty", "facelift", "tummy tuck", "liposuction", "bbl"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'non_surgical', label: 'Non-Surgical Options', description: 'Injectables and non-invasive', keywords: ["botox", "filler", "non-surgical", "non-invasive", "laser"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'male_procedures', label: 'Male Plastic Surgery', description: 'Specializes in male patients', keywords: ["male plastic surgery", "men", "gynecomastia", "male patients"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'mommy_makeover', label: 'Mommy Makeover', description: 'Post-pregnancy specialization', keywords: ["mommy makeover", "post-pregnancy", "breast lift", "tummy tuck"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'revision_surgery', label: 'Revision Surgery', description: 'Corrective surgery expertise', keywords: ["revision", "corrective surgery", "secondary surgery", "revision specialist"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'awards', label: 'Professional Recognition', description: 'Awards or top doctor listings', keywords: ["top doctor", "best of", "award", "voted best", "five star"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'hiring', label: 'Hiring Staff', description: 'Growing practice', keywords: ["hiring", "join our team", "careers", "positions available"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'expansion', label: 'Practice Expansion', description: 'New locations', keywords: ["new location", "expanding", "second office", "now open"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'experience_years', label: 'Experienced Surgeon', description: 'Years of practice', keywords: ["years of experience", "practicing since"], regexPattern: '(\\d+)\\+?\\s*years?', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'hipaa', pattern: 'hipaa', description: 'HIPAA notice', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms (of|and)', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'disclaimer', pattern: 'individual results may vary', description: 'Results disclaimer', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social media', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'procedures', pattern: '^procedures$', description: 'Procedures link', context: 'header'},
        {id: 'gallery', pattern: '^gallery$', description: 'Gallery link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'consultation', pattern: '^consultation$', description: 'Consultation link', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'financing', pattern: '^financing$', description: 'Financing link', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'}
      ],

      scoringRules: [
        {id: 'certified_results', name: 'Certified with Results', description: 'Board certified with before/after', condition: 'signals.some(s => s.signalId === "board_certified") && signals.some(s => s.signalId === "before_after")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'premium_facility', name: 'Premium Facility', description: 'Accredited facility with multiple surgeons', condition: 'signals.some(s => s.signalId === "accredited_facility") && signals.some(s => s.signalId === "multiple_surgeons")', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'growing_practice', name: 'Growing Practice', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'comprehensive_services', name: 'Comprehensive Services', description: 'Surgical and non-surgical', condition: 'signals.some(s => s.signalId === "procedure_variety") && signals.some(s => s.signalId === "non_surgical")', scoreBoost: 25, priority: 4, enabled: true},
        {id: 'accessible', name: 'Accessible Practice', description: 'Financing with virtual consults', condition: 'signals.some(s => s.signalId === "financing") && signals.some(s => s.signalId === "virtual_consult")', scoreBoost: 20, priority: 5, enabled: true},
        {id: 'specialist', name: 'Specialist Surgeon', description: 'Revision or niche expertise', condition: 'signals.some(s => s.signalId === "revision_surgery") || signals.some(s => s.signalId === "male_procedures") || signals.some(s => s.signalId === "mommy_makeover")', scoreBoost: 22, priority: 6, enabled: true},
        {id: 'recognized_surgeon', name: 'Recognized Surgeon', description: 'Awards with experience', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "experience_years")', scoreBoost: 25, priority: 7, enabled: true},
        {id: 'established_practice', name: 'Established Practice', description: 'Years of experience with results portfolio', condition: 'signals.some(s => s.signalId === "experience_years") && signals.some(s => s.signalId === "before_after")', scoreBoost: 20, priority: 8, enabled: true},
        {id: 'full_spectrum', name: 'Full-Spectrum Care', description: 'Wide procedure variety', condition: 'signals.some(s => s.signalId === "procedure_variety")', scoreBoost: 18, priority: 9, enabled: true},
        {id: 'quality_facility', name: 'Quality Facility', description: 'Accredited with board certified surgeon', condition: 'signals.some(s => s.signalId === "accredited_facility") && signals.some(s => s.signalId === "board_certified")', scoreBoost: 28, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'surgeon_count', label: 'Number of Surgeons', type: 'number', description: 'Board certified surgeons', extractionHints: ['surgeons', 'doctors', 'physicians'], required: false, defaultValue: 1},
        {key: 'is_board_certified', label: 'Board Certified', type: 'boolean', description: 'ABPS certification', extractionHints: ['board certified', 'abps'], required: false, defaultValue: false},
        {key: 'has_accredited_facility', label: 'Accredited Facility', type: 'boolean', description: 'Facility accreditation', extractionHints: ['accredited', 'aaaasf'], required: false, defaultValue: false},
        {key: 'procedures_offered', label: 'Procedures Offered', type: 'array', description: 'Types of procedures', extractionHints: ['breast', 'face', 'body', 'rhinoplasty'], required: false, defaultValue: []},
        {key: 'offers_financing', label: 'Offers Financing', type: 'boolean', description: 'Payment plans available', extractionHints: ['financing', 'payment plans'], required: false, defaultValue: false},
        {key: 'years_experience', label: 'Years of Experience', type: 'number', description: 'Surgeon experience', extractionHints: ['years', 'experience', 'practicing'], required: false, defaultValue: 0},
        {key: 'specialization', label: 'Surgical Specialization', type: 'string', description: 'Primary focus area', extractionHints: ['specialize', 'focus', 'expert'], required: false, defaultValue: 'general'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Plastic surgery intelligence - focuses on credentials, facility quality, result portfolio, and service breadth'
      }
    }
  },
  
  'med-spas-aesthetics': {
    id: 'med-spas-aesthetics',
    name: 'Med-Spas & Aesthetics',
    description: 'For med-spas - maintenance and enhancement focus',
    category: 'Healthcare & Wellness',
    
    coreIdentity: {
      title: 'The Glow Expert',
      positioning: 'Upbeat, trendy, knowledgeable, and beauty-focused',
      tone: 'Friendly, enthusiastic, beauty-savvy'
    },
    
    cognitiveLogic: {
      framework: 'The Maintenance & Enhancement Logic',
      reasoning: 'Focuses on "Prevention" and "Subscription" models (e.g., monthly facials, Botox maintenance cycles)',
      decisionProcess: 'Prevention → Enhancement → Subscription'
    },
    
    knowledgeRAG: {
      static: [
        'Botox/Filler shelf life and dosing',
        'Contraindications and safety',
        'Treatment types (injectables, lasers, facials)',
        'Skin anatomy basics',
        'Post-treatment care'
      ],
      dynamic: [
        'Loyalty programs and packages',
        'Monthly specials and flash sales',
        'Aesthetician certifications',
        'Product inventory (skincare retail)',
        'Seasonal promotions',
        'Appointment availability'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks which skincare concerns (e.g., "Anti-aging" vs "Acne" vs "Hyperpigmentation") are trending in conversations',
      adaptation: 'Updates the "Featured Special" or "Recommended Treatment" based on current demand patterns',
      feedbackIntegration: 'Learns which treatment combos (e.g., Botox + Filler, Laser + Facial) have highest satisfaction and retention'
    },
    
    tacticalExecution: {
      primaryAction: 'Skin Analysis Booking',
      conversionRhythm: 'Encourages booking an initial assessment, "Flash Sale" appointment, or "First-Time Client Special"',
      secondaryActions: [
        'Virtual skin consultation',
        'Treatment package comparison',
        'Loyalty program enrollment',
        'Product recommendations',
        'Before/After examples'
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
        {id: 'med_spa_services', label: 'Comprehensive Services', description: 'Wide service menu', keywords: ["botox", "filler", "laser", "facials", "chemical peel", "microneedling", "prp"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'medical_director', label: 'Medical Director', description: 'Physician oversight', keywords: ["medical director", "physician supervised", "doctor", "md oversight"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'membership_program', label: 'Membership Program', description: 'Subscription model', keywords: ["membership", "membership program", "monthly membership", "vip program"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'website'},
        {id: 'before_after', label: 'Results Gallery', description: 'Before/after photos', keywords: ["before and after", "before & after", "results", "transformations"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'retail_products', label: 'Skincare Retail', description: 'Sells skincare products', keywords: ["skincare", "products", "medical grade", "shop", "retail"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'advanced_technology', label: 'Advanced Technology', description: 'Latest equipment', keywords: ["latest technology", "advanced", "state of the art", "newest", "cutting edge"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'certifications', label: 'Staff Certifications', description: 'Certified aestheticians', keywords: ["certified", "licensed", "trained", "certified aesthetician"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'hiring', label: 'Hiring Staff', description: 'Growing team', keywords: ["hiring", "join our team", "careers", "aesthetician positions"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'expansion', label: 'New Locations', description: 'Opening new med spas', keywords: ["new location", "expanding", "second location", "now open"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'any'},
        {id: 'specials', label: 'Special Offers', description: 'Promotions and deals', keywords: ["special", "promotion", "sale", "discount", "limited time"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'package_deals', label: 'Treatment Packages', description: 'Bundled services', keywords: ["package", "bundle", "treatment package", "combo"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'consultation_free', label: 'Free Consultations', description: 'Complimentary consults', keywords: ["free consultation", "complimentary", "no obligation"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'luxury_spa', label: 'Luxury Med Spa', description: 'High-end positioning', keywords: ["luxury", "upscale", "premium", "exclusive"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'body_contouring', label: 'Body Contouring', description: 'Body sculpting services', keywords: ["body contouring", "coolsculpting", "emsculpt", "body sculpting"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'medical_spa_chain', label: 'Multiple Locations', description: 'Multi-location operation', keywords: ["locations", "offices"], regexPattern: '(\\d+)\\s*locations?', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 30, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'hipaa', pattern: 'hipaa', description: 'HIPAA', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'disclaimer', pattern: 'results may vary', description: 'Disclaimer', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'specials', pattern: '^specials$', description: 'Specials', context: 'header'},
        {id: 'gallery', pattern: '^gallery$', description: 'Gallery', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'book', pattern: '^book( now)?$', description: 'Book link', context: 'header'},
        {id: 'shop', pattern: '^shop$', description: 'Shop', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'membership', pattern: '^membership$', description: 'Membership', context: 'header'}
      ],

      scoringRules: [
        {id: 'medical_oversight', name: 'Medical Oversight', description: 'Medical director with comprehensive services', condition: 'signals.some(s => s.signalId === "medical_director") && signals.some(s => s.signalId === "med_spa_services")', scoreBoost: 35, priority: 1, enabled: true},
        {id: 'multi_location', name: 'Multi-Location Chain', description: 'Multiple locations growing', condition: 'signals.some(s => s.signalId === "medical_spa_chain") && signals.some(s => s.signalId === "expansion")', scoreBoost: 40, priority: 2, enabled: true},
        {id: 'premium_operation', name: 'Premium Operation', description: 'Luxury with advanced technology', condition: 'signals.some(s => s.signalId === "luxury_spa") && signals.some(s => s.signalId === "advanced_technology")', scoreBoost: 28, priority: 3, enabled: true},
        {id: 'revenue_model', name: 'Subscription Model', description: 'Membership program with results', condition: 'signals.some(s => s.signalId === "membership_program") && signals.some(s => s.signalId === "before_after")', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'growing_business', name: 'Growing Business', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 30, priority: 5, enabled: true},
        {id: 'comprehensive_menu', name: 'Comprehensive Menu', description: 'Wide service offerings', condition: 'signals.some(s => s.signalId === "med_spa_services")', scoreBoost: 20, priority: 6, enabled: true},
        {id: 'retail_revenue', name: 'Retail Revenue Stream', description: 'Products with services', condition: 'signals.some(s => s.signalId === "retail_products") && signals.some(s => s.signalId === "med_spa_services")', scoreBoost: 18, priority: 7, enabled: true},
        {id: 'body_aesthetics', name: 'Full Body Aesthetics', description: 'Face and body services', condition: 'signals.some(s => s.signalId === "body_contouring") && signals.some(s => s.signalId === "med_spa_services")', scoreBoost: 22, priority: 8, enabled: true},
        {id: 'professional', name: 'Professional Operation', description: 'Certifications with medical director', condition: 'signals.some(s => s.signalId === "certifications") && signals.some(s => s.signalId === "medical_director")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'package_value', name: 'Package Value', description: 'Packages with membership', condition: 'signals.some(s => s.signalId === "package_deals") && signals.some(s => s.signalId === "membership_program")', scoreBoost: 18, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'location_count', label: 'Number of Locations', type: 'number', description: 'Med spa locations', extractionHints: ['locations', 'offices', 'spas'], required: false, defaultValue: 1},
        {key: 'has_medical_director', label: 'Has Medical Director', type: 'boolean', description: 'Physician oversight', extractionHints: ['medical director', 'physician'], required: false, defaultValue: false},
        {key: 'services_offered', label: 'Services Offered', type: 'array', description: 'Treatment types', extractionHints: ['botox', 'laser', 'facial', 'filler'], required: false, defaultValue: []},
        {key: 'has_membership', label: 'Membership Program', type: 'boolean', description: 'Subscription available', extractionHints: ['membership'], required: false, defaultValue: false},
        {key: 'sells_products', label: 'Sells Skincare Products', type: 'boolean', description: 'Retail products', extractionHints: ['products', 'shop', 'retail'], required: false, defaultValue: false},
        {key: 'specialization', label: 'Treatment Specialization', type: 'string', description: 'Primary focus', extractionHints: ['specialize', 'expert', 'focus'], required: false, defaultValue: 'general'},
        {key: 'years_in_business', label: 'Years Established', type: 'number', description: 'Years operating', extractionHints: ['years', 'since', 'established'], required: false, defaultValue: 0}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Med-spa & aesthetics intelligence - focuses on service breadth, medical oversight, membership models, and multi-location growth'
      }
    }
  },
  
  'mental-health-therapy': {
    id: 'mental-health-therapy',
    name: 'Mental Health & Therapy',
    description: 'For therapists - empathy and safe space creation',
    category: 'Healthcare & Wellness',
    
    coreIdentity: {
      title: 'The Empathetic Listener',
      positioning: 'Neutral, calm, safe, and deeply compassionate',
      tone: 'Gentle, non-judgmental, supportive'
    },
    
    cognitiveLogic: {
      framework: 'The Support-Validation Model',
      reasoning: 'Prioritizes "Active Listening" and "Non-Judgmental Response" over immediate "Sales." Focuses on creating safety first',
      decisionProcess: 'Safety → Validation → Matching → Intake'
    },
    
    knowledgeRAG: {
      static: [
        'Crisis resources (National Suicide Hotline, Crisis Text Line)',
        'Therapy modalities (CBT, DBT, EMDR, Psychodynamic)',
        'Confidentiality protocols (HIPAA)',
        'Insurance and sliding scale information',
        'Therapist specializations'
      ],
      dynamic: [
        'Counselor availability and schedules',
        'Accepted insurance providers',
        'Specialty focus areas (trauma, anxiety, couples, etc.)',
        'Virtual vs in-person options',
        'Intake questionnaire',
        'Wait times for new clients'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects "Crisis Keywords" (suicide, self-harm, immediate danger) to instantly trigger safety protocols',
      adaptation: 'Immediately provides crisis resources and human hand-off logic, bypassing standard conversation flow',
      feedbackIntegration: 'Learns which therapist matching factors (gender, specialization, approach) lead to successful therapeutic relationships'
    },
    
    tacticalExecution: {
      primaryAction: 'Intake Matching',
      conversionRhythm: 'Moves the user to a "Compatibility Questionnaire" to find the right therapist match (gentle, no pressure)',
      secondaryActions: [
        'Crisis resource provision (immediate)',
        'Insurance verification',
        'Therapist profile browsing',
        'Initial consultation scheduling',
        'Virtual therapy setup assistance'
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
        {id: 'therapist_count', label: 'Large Practice', description: 'Multiple therapists', keywords: ["therapists", "counselors", "clinicians"], regexPattern: '(\\d+)\\+?\\s*(therapists?|counselors?)', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'accepting_clients', label: 'Accepting New Clients', description: 'Available appointments', keywords: ["accepting new clients", "accepting patients", "now accepting", "availability"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'teletherapy', label: 'Teletherapy Services', description: 'Online therapy available', keywords: ["teletherapy", "online therapy", "virtual therapy", "video sessions", "telehealth"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'insurance_accepted', label: 'Insurance Accepted', description: 'Takes insurance', keywords: ["insurance accepted", "we accept", "in-network", "bcbs", "aetna", "cigna"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'sliding_scale', label: 'Sliding Scale Fees', description: 'Affordable options', keywords: ["sliding scale", "affordable", "low cost", "reduced fee"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'specializations', label: 'Multiple Specializations', description: 'Diverse expertise', keywords: ["anxiety", "depression", "trauma", "ptsd", "couples", "family therapy", "addiction"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'evening_weekend', label: 'Flexible Hours', description: 'Evening/weekend availability', keywords: ["evening", "weekend", "flexible hours", "after hours"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'licensed_therapists', label: 'Licensed Professionals', description: 'All licensed clinicians', keywords: ["licensed", "lcsw", "lmft", "lpc", "psychologist", "phd"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'hiring', label: 'Hiring Therapists', description: 'Growing practice', keywords: ["hiring", "join our team", "therapist positions", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'any'},
        {id: 'expansion', label: 'Practice Expansion', description: 'New locations', keywords: ["new office", "expanding", "new location", "now serving"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'emdr_specialist', label: 'EMDR Specialist', description: 'Trauma-focused therapy', keywords: ["emdr", "eye movement", "trauma therapy", "trauma specialist"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'couples_therapy', label: 'Couples Therapy', description: 'Relationship counseling', keywords: ["couples therapy", "marriage counseling", "relationship counseling"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'child_therapy', label: 'Child/Adolescent Therapy', description: 'Youth specialization', keywords: ["child therapy", "adolescent", "teen", "children", "play therapy"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'group_therapy', label: 'Group Therapy', description: 'Group sessions offered', keywords: ["group therapy", "support group", "group sessions"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 8, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'hipaa', pattern: 'hipaa', description: 'HIPAA', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'crisis', pattern: 'crisis hotline|suicide prevention', description: 'Crisis resources', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'therapists', pattern: '^therapists$', description: 'Therapists', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'insurance', pattern: '^insurance$', description: 'Insurance', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'portal', pattern: '^portal$', description: 'Portal', context: 'header'}
      ],

      scoringRules: [
        {id: 'large_practice', name: 'Large Practice', description: 'Multiple therapists accepting clients', condition: 'signals.some(s => s.signalId === "therapist_count") && signals.some(s => s.signalId === "accepting_clients")', scoreBoost: 35, priority: 1, enabled: true},
        {id: 'accessible_care', name: 'Accessible Care', description: 'Teletherapy with insurance', condition: 'signals.some(s => s.signalId === "teletherapy") && signals.some(s => s.signalId === "insurance_accepted")', scoreBoost: 30, priority: 2, enabled: true},
        {id: 'affordable_options', name: 'Affordable Options', description: 'Sliding scale with insurance', condition: 'signals.some(s => s.signalId === "sliding_scale") && signals.some(s => s.signalId === "insurance_accepted")', scoreBoost: 25, priority: 3, enabled: true},
        {id: 'growing_practice', name: 'Growing Practice', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'specialized_care', name: 'Specialized Care', description: 'Multiple specializations available', condition: 'signals.some(s => s.signalId === "specializations")', scoreBoost: 18, priority: 5, enabled: true},
        {id: 'trauma_specialist', name: 'Trauma Specialist', description: 'EMDR with trauma focus', condition: 'signals.some(s => s.signalId === "emdr_specialist")', scoreBoost: 20, priority: 6, enabled: true},
        {id: 'family_services', name: 'Family Services', description: 'Couples and child therapy', condition: 'signals.some(s => s.signalId === "couples_therapy") && signals.some(s => s.signalId === "child_therapy")', scoreBoost: 22, priority: 7, enabled: true},
        {id: 'convenient', name: 'Convenient Access', description: 'Teletherapy with flexible hours', condition: 'signals.some(s => s.signalId === "teletherapy") && signals.some(s => s.signalId === "evening_weekend")', scoreBoost: 18, priority: 8, enabled: true},
        {id: 'professional', name: 'Professional Practice', description: 'Licensed with specializations', condition: 'signals.some(s => s.signalId === "licensed_therapists") && signals.some(s => s.signalId === "specializations")', scoreBoost: 15, priority: 9, enabled: true},
        {id: 'comprehensive', name: 'Comprehensive Services', description: 'Individual, couples, and group therapy', condition: 'signals.filter(s => ["couples_therapy", "child_therapy", "group_therapy"].includes(s.signalId)).length >= 2', scoreBoost: 20, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'therapist_count', label: 'Number of Therapists', type: 'number', description: 'Licensed therapists', extractionHints: ['therapists', 'counselors', 'clinicians'], required: false, defaultValue: 1},
        {key: 'offers_teletherapy', label: 'Offers Teletherapy', type: 'boolean', description: 'Online sessions available', extractionHints: ['teletherapy', 'online', 'virtual'], required: false, defaultValue: false},
        {key: 'accepts_insurance', label: 'Accepts Insurance', type: 'boolean', description: 'Insurance accepted', extractionHints: ['insurance', 'in-network'], required: false, defaultValue: false},
        {key: 'specializations', label: 'Specializations', type: 'array', description: 'Treatment focus areas', extractionHints: ['anxiety', 'depression', 'trauma', 'couples'], required: false, defaultValue: []},
        {key: 'has_sliding_scale', label: 'Sliding Scale Available', type: 'boolean', description: 'Reduced fees offered', extractionHints: ['sliding scale', 'reduced fee'], required: false, defaultValue: false},
        {key: 'office_locations', label: 'Office Locations', type: 'number', description: 'Physical locations', extractionHints: ['locations', 'offices'], required: false, defaultValue: 1},
        {key: 'weekend_availability', label: 'Weekend/Evening Hours', type: 'boolean', description: 'Flexible scheduling', extractionHints: ['evening', 'weekend'], required: false, defaultValue: false}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Mental health therapy intelligence - focuses on accessibility, specializations, insurance acceptance, and practice growth'
      }
    }
  },
  
  'gyms-crossfit': {
    id: 'gyms-crossfit',
    name: 'Gyms & CrossFit',
    description: 'For gyms - motivation and community building',
    category: 'Healthcare & Wellness',
    
    coreIdentity: {
      title: 'The High-Energy Performance Coach',
      positioning: 'Motivational, disciplined, and community-driven',
      tone: 'Energetic, encouraging, confident'
    },
    
    cognitiveLogic: {
      framework: 'The Barrier-Removal Framework',
      reasoning: 'Logic that addresses "Lack of Time" or "Lack of Knowledge" by emphasizing "Community Support" and "Efficient Workouts"',
      decisionProcess: 'Barrier Identification → Solution → Community Connection'
    },
    
    knowledgeRAG: {
      static: [
        'HIIT/Strength training science',
        'Nutrition basics',
        'Workout programming principles',
        'Injury prevention',
        'Scaling options for all fitness levels'
      ],
      dynamic: [
        'Class schedules and availability',
        '"Hero" WODs (for CrossFit)',
        'Membership tiers and pricing',
        'Coach credentials',
        'Member success stories',
        'Free trial/intro offers'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Identifies "Commitment Phobia" or "Intimidation Factor" in lead responses',
      adaptation: 'Triggers a "7-Day Free Pass" or "Beginner Success Story" module to reduce entry barriers',
      feedbackIntegration: 'Tracks which motivators (weight loss, strength gains, community) drive highest retention'
    },
    
    tacticalExecution: {
      primaryAction: 'Free Trial/Intro Class',
      conversionRhythm: 'Focuses on getting the lead through the physical door for their first session (No Sweat Intro)',
      secondaryActions: [
        'Goal assessment questionnaire',
        'Facility tour scheduling',
        'Coach meet-and-greet',
        'Membership options comparison',
        'Community event invitation'
      ]
    },

    research: {
      scrapingStrategy: {primarySource: 'website', secondarySources: ['linkedin-jobs', 'google-business'], frequency: 'per-lead', timeoutMs: 30000, enableCaching: true, cacheTtlSeconds: 300},
      highValueSignals: [
        {id: 'hiring_coaches', label: 'Hiring Coaches/Trainers', description: 'Recruiting fitness professionals', keywords: ["hiring coaches", "join our team", "trainer positions", "coach wanted"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'new_location', label: 'New Location Opening', description: 'Expanding to new facility', keywords: ["new location", "opening soon", "grand opening", "second location"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'free_trial', label: 'Free Trial Offer', description: 'Offers trial membership', keywords: ["free trial", "free week", "no sweat intro", "try us free"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'personal_training', label: 'Personal Training', description: 'Offers 1-on-1 training', keywords: ["personal training", "one-on-one", "1:1", "private sessions"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'group_classes', label: 'Group Fitness Classes', description: 'Offers group classes', keywords: ["group classes", "class schedule", "group fitness", "wod"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'nutrition_coaching', label: 'Nutrition Coaching', description: 'Provides nutrition guidance', keywords: ["nutrition coaching", "meal plans", "nutrition counseling", "diet"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'competition_team', label: 'Competition Team', description: 'Has competitive athletes', keywords: ["competition team", "athletes", "compete", "games"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 8, platform: 'website'},
        {id: 'youth_programs', label: 'Youth/Kids Programs', description: 'Offers kids fitness', keywords: ["kids", "youth", "teens", "children"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'online_training', label: 'Online/Virtual Training', description: 'Virtual training options', keywords: ["online", "virtual", "remote", "app"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: '24_7_access', label: '24/7 Access', description: 'Round-the-clock access', keywords: ["24/7", "24 hour", "always open", "anytime"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'shower_facilities', label: 'Amenities', description: 'Showers, lockers, etc', keywords: ["showers", "locker rooms", "sauna", "amenities"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'certified_coaches', label: 'Certified Coaches', description: 'Staff certifications', keywords: ["certified", "credentials", "cf-l1", "cf-l2", "nasm", "issa"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'member_results', label: 'Success Stories', description: 'Transformation stories', keywords: ["transformations", "success stories", "results", "before and after"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'equipment_quality', label: 'Premium Equipment', description: 'High-quality equipment', keywords: ["rogue", "assault bike", "concept2", "equipment"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'community_events', label: 'Community Events', description: 'Hosts community activities', keywords: ["community", "events", "charity", "fundraiser"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'}
      ],
      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy link', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms link', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social links', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'schedule', pattern: '^schedule$', description: 'Schedule link', context: 'header'},
        {id: 'pricing', pattern: '^pricing$', description: 'Pricing link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back link', context: 'footer'}
      ],
      scoringRules: [
        {id: 'expansion_hiring', name: 'Rapid Growth', description: 'New location + hiring', condition: 'signals.some(s => s.signalId === "new_location") && signals.some(s => s.signalId === "hiring_coaches")', scoreBoost: 25, priority: 1, enabled: true},
        {id: 'full_service_gym', name: 'Full Service', description: 'Group classes + personal training + nutrition', condition: 'signals.some(s => s.signalId === "group_classes") && signals.some(s => s.signalId === "personal_training") && signals.some(s => s.signalId === "nutrition_coaching")', scoreBoost: 20, priority: 2, enabled: true},
        {id: 'family_friendly', name: 'Family Focus', description: 'Youth programs with community events', condition: 'signals.some(s => s.signalId === "youth_programs") && signals.some(s => s.signalId === "community_events")', scoreBoost: 15, priority: 3, enabled: true}
      ],
      customFields: [
        {key: 'coach_count', label: 'Number of Coaches', type: 'number', description: 'Size of coaching staff', extractionHints: ['coaches', 'trainers', 'staff'], required: false, defaultValue: 0},
        {key: 'membership_types', label: 'Membership Options', type: 'array', description: 'Types of memberships', extractionHints: ['unlimited', 'punch card', 'drop-in'], required: false, defaultValue: []},
        {key: 'has_nutrition', label: 'Offers Nutrition', type: 'boolean', description: 'Nutrition coaching available', extractionHints: ['nutrition', 'meal plans'], required: false, defaultValue: false},
        {key: 'has_youth_program', label: 'Youth Programs', type: 'boolean', description: 'Kids/teen programs', extractionHints: ['kids', 'youth', 'teens'], required: false, defaultValue: false},
        {key: 'location_count', label: 'Number of Locations', type: 'number', description: 'Gym locations', extractionHints: ['locations', 'facilities'], required: false, defaultValue: 1}
      ],
      metadata: {lastUpdated: '2025-12-28', version: 1, updatedBy: 'system', notes: 'Gym/CrossFit intelligence - growth, programs, amenities'}
    }
  },
  
  'yoga-pilates': {
    id: 'yoga-pilates',
    name: 'Yoga & Pilates Studios',
    description: 'For studios - mindfulness and holistic wellness',
    category: 'Healthcare & Wellness',
    
    coreIdentity: {
      title: 'The Mindful Guide',
      positioning: 'Serene, welcoming, and wellness-focused',
      tone: 'Calm, inviting, holistic'
    },
    
    cognitiveLogic: {
      framework: 'The Holistic Balance Model',
      reasoning: 'Focuses on the "Mental + Physical" benefits of the practice, not just fitness',
      decisionProcess: 'Wellness Discovery → Practice Alignment → Intro Experience'
    },
    
    knowledgeRAG: {
      static: [
        'Pose terminology (Sanskrit + English)',
        'Pilates reformer safety',
        'Breathwork fundamentals',
        'Modifications for injuries',
        'Yoga/Pilates philosophy'
      ],
      dynamic: [
        'Instructor bios and teaching styles',
        'Workshop dates and special events',
        'Retail/apparel inventory',
        'Class schedules by level',
        'Intro packages and pricing',
        'Private session availability'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks lead interest in "Beginner" vs "Advanced" classes based on questions about pace and difficulty',
      adaptation: 'Recommends the appropriate "Introductory Series" or "Foundations" workshop to match skill level',
      feedbackIntegration: 'Learns which instructor styles (gentle, challenging, spiritual) resonate with different student types'
    },
    
    tacticalExecution: {
      primaryAction: 'Intro Pack Purchase',
      conversionRhythm: 'Focuses on the "3 Classes for $X" or "2-Week Unlimited" intro offer',
      secondaryActions: [
        'Class schedule exploration',
        'Studio tour booking',
        'Instructor matching',
        'Workshop registration',
        'Retail product recommendations'
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
        {id: 'unlimited_membership', label: 'Unlimited Memberships', description: 'Monthly unlimited option', keywords: ["unlimited", "unlimited classes", "monthly membership", "all access"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'intro_special', label: 'Intro Special Offer', description: 'New student promotion', keywords: ["intro offer", "new student", "first class free", "intro pack"], regexPattern: '(\\d+)\\s*classes? for \\$\\d+', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'instructor_count', label: 'Multiple Instructors', description: 'Large teaching team', keywords: ["instructors", "teachers"], regexPattern: '(\\d+)\\+?\\s*(instructors?|teachers?)', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'class_variety', label: 'Diverse Class Offerings', description: 'Multiple styles/levels', keywords: ["vinyasa", "hatha", "yin", "power", "restorative", "beginner", "advanced"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'hot_yoga', label: 'Hot Yoga', description: 'Heated yoga classes', keywords: ["hot yoga", "bikram", "heated", "infrared"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'pilates_reformer', label: 'Reformer Pilates', description: 'Equipment-based Pilates', keywords: ["reformer", "pilates reformer", "megaformer", "equipment"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'private_sessions', label: 'Private Sessions', description: 'One-on-one instruction', keywords: ["private", "private session", "one-on-one", "personal instruction"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'workshops', label: 'Workshops & Events', description: 'Special workshops offered', keywords: ["workshop", "special event", "training", "retreat"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'teacher_training', label: 'Teacher Training', description: 'Certification programs', keywords: ["teacher training", "certification", "ryt", "200 hour", "500 hour"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'retail', label: 'Retail Products', description: 'Sells yoga/wellness products', keywords: ["shop", "retail", "mats", "props", "apparel"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'hiring', label: 'Hiring Instructors', description: 'Growing teacher team', keywords: ["hiring", "instructor positions", "join our team", "teaching jobs"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'expansion', label: 'Studio Expansion', description: 'New locations', keywords: ["new studio", "second location", "expanding", "now open"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'online_classes', label: 'Online Classes', description: 'Virtual class options', keywords: ["online classes", "virtual", "zoom", "livestream", "on-demand"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'prenatal_yoga', label: 'Prenatal Yoga', description: 'Pregnancy classes', keywords: ["prenatal", "pregnancy yoga", "prenatal pilates"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'therapeutic', label: 'Therapeutic Classes', description: 'Yoga therapy focus', keywords: ["therapeutic", "yoga therapy", "healing", "trauma-informed"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'}
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
        {id: 'schedule', pattern: '^schedule$', description: 'Schedule', context: 'header'},
        {id: 'pricing', pattern: '^pricing$', description: 'Pricing', context: 'header'},
        {id: 'instructors', pattern: '^instructors$', description: 'Instructors', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'workshops', pattern: '^workshops$', description: 'Workshops', context: 'header'},
        {id: 'shop', pattern: '^shop$', description: 'Shop', context: 'header'},
        {id: 'login', pattern: '^login$', description: 'Login', context: 'header'},
        {id: 'new', pattern: '^new to', description: 'New student', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'}
      ],

      scoringRules: [
        {id: 'full_service_studio', name: 'Full-Service Studio', description: 'Multiple class types with diverse offerings', condition: 'signals.some(s => s.signalId === "class_variety") && (signals.some(s => s.signalId === "pilates_reformer") || signals.some(s => s.signalId === "hot_yoga"))', scoreBoost: 25, priority: 1, enabled: true},
        {id: 'growing_studio', name: 'Growing Studio', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 30, priority: 2, enabled: true},
        {id: 'accessible_pricing', name: 'Accessible Pricing', description: 'Intro special with unlimited option', condition: 'signals.some(s => s.signalId === "intro_special") && signals.some(s => s.signalId === "unlimited_membership")', scoreBoost: 20, priority: 3, enabled: true},
        {id: 'teacher_training_center', name: 'Teacher Training Center', description: 'Offers certification programs', condition: 'signals.some(s => s.signalId === "teacher_training")', scoreBoost: 22, priority: 4, enabled: true},
        {id: 'hybrid_model', name: 'Hybrid Model', description: 'In-person and online classes', condition: 'signals.some(s => s.signalId === "online_classes")', scoreBoost: 18, priority: 5, enabled: true},
        {id: 'specialized_programs', name: 'Specialized Programs', description: 'Therapeutic or prenatal focus', condition: 'signals.some(s => s.signalId === "therapeutic") || signals.some(s => s.signalId === "prenatal_yoga")', scoreBoost: 15, priority: 6, enabled: true},
        {id: 'comprehensive_schedule', name: 'Comprehensive Schedule', description: 'Class variety with multiple instructors', condition: 'signals.some(s => s.signalId === "class_variety") && signals.some(s => s.signalId === "instructor_count")', scoreBoost: 18, priority: 7, enabled: true},
        {id: 'revenue_streams', name: 'Multiple Revenue Streams', description: 'Classes, retail, and workshops', condition: 'signals.some(s => s.signalId === "retail") && signals.some(s => s.signalId === "workshops")', scoreBoost: 15, priority: 8, enabled: true},
        {id: 'personalized_service', name: 'Personalized Service', description: 'Private sessions available', condition: 'signals.some(s => s.signalId === "private_sessions")', scoreBoost: 12, priority: 9, enabled: true},
        {id: 'premium_studio', name: 'Premium Studio', description: 'Reformer equipment with teacher training', condition: 'signals.some(s => s.signalId === "pilates_reformer") && signals.some(s => s.signalId === "teacher_training")', scoreBoost: 20, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'instructor_count', label: 'Number of Instructors', type: 'number', description: 'Teaching staff size', extractionHints: ['instructors', 'teachers'], required: false, defaultValue: 1},
        {key: 'class_types', label: 'Class Types Offered', type: 'array', description: 'Styles of classes', extractionHints: ['vinyasa', 'hatha', 'reformer', 'mat'], required: false, defaultValue: []},
        {key: 'has_reformer', label: 'Has Reformer Equipment', type: 'boolean', description: 'Pilates reformers available', extractionHints: ['reformer'], required: false, defaultValue: false},
        {key: 'offers_teacher_training', label: 'Teacher Training Program', type: 'boolean', description: 'Certification offered', extractionHints: ['teacher training', 'ryt'], required: false, defaultValue: false},
        {key: 'has_online_classes', label: 'Online Classes', type: 'boolean', description: 'Virtual options', extractionHints: ['online', 'virtual'], required: false, defaultValue: false},
        {key: 'membership_options', label: 'Membership Types', type: 'array', description: 'Membership levels', extractionHints: ['unlimited', 'membership', 'package'], required: false, defaultValue: []},
        {key: 'location_count', label: 'Studio Locations', type: 'number', description: 'Number of studios', extractionHints: ['locations', 'studios'], required: false, defaultValue: 1}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Yoga & Pilates intelligence - focuses on class variety, instructor quality, membership models, and service diversification'
      }
    }
  },
  
