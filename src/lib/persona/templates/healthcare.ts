import 'server-only';
import type { IndustryTemplate } from './types';

export const healthcareTemplates: Record<string, IndustryTemplate> = {
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
  },
  
  'cybersecurity': {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    description: 'For security companies - threat awareness and protection',
    category: 'Technology & Business Services',
    
    coreIdentity: {
      title: 'The Digital Guardian',
      positioning: 'Vigilant, authoritative, and risk-aware. "Calm in a crisis"',
      tone: 'Professional, serious, protective'
    },
    
    cognitiveLogic: {
      framework: 'The Vulnerability-Impact Model',
      reasoning: 'Logic that shifts from "Features" to "Threat Scenarios" (e.g., "What happens to your data if X occurs?")',
      decisionProcess: 'Risk Assessment → Impact Visualization → Protection Solution'
    },
    
    knowledgeRAG: {
      static: [
        'Compliance standards (SOC2, HIPAA, GDPR, ISO 27001)',
        'Common attack vectors',
        'Security frameworks (NIST, CIS)',
        'Incident response protocols',
        'Encryption standards'
      ],
      dynamic: [
        'Latest threat intelligence',
        'Client\'s specific security stack',
        'Industry-specific vulnerabilities',
        'Breach statistics by sector',
        'Service packages and pricing',
        'Response time SLAs'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects specific industry fears (e.g., "Ransomware" in Finance, "Patient Data" in Healthcare)',
      adaptation: 'Weights the "Protection" logic to emphasize those specific defenses and compliance requirements',
      feedbackIntegration: 'Learns which threat scenarios create urgency for different industries'
    },
    
    tacticalExecution: {
      primaryAction: 'Security Audit',
      conversionRhythm: 'Moves the lead toward a "Vulnerability Assessment," "Dark Web Scan," or "Penetration Test"',
      secondaryActions: [
        'Security posture assessment',
        'Compliance gap analysis',
        'Incident response planning',
        'Employee training program',
        'Managed security consultation'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['linkedin-company', 'news'],
        frequency: 'weekly',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 600
      },

      highValueSignals: [
        {id: 'certifications', label: 'Security Certifications', description: 'Industry credentials', keywords: ["cissp", "cism", "ceh", "oscp", "security+", "certified"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'soc2_compliant', label: 'SOC 2 Compliant', description: 'SOC 2 certification', keywords: ["soc 2", "soc2", "soc ii", "type 2"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'managed_security', label: 'Managed Security Services', description: 'MSSP offerings', keywords: ["managed security", "mssp", "24/7 monitoring", "soc", "security operations"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'penetration_testing', label: 'Penetration Testing', description: 'Pen testing services', keywords: ["penetration testing", "pen test", "ethical hacking", "security testing"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'incident_response', label: 'Incident Response', description: '24/7 breach response', keywords: ["incident response", "breach response", "cyber incident", "forensics"], priority: 'CRITICAL', action: 'add-to-segment', scoreBoost: 35, platform: 'website'},
        {id: 'compliance', label: 'Compliance Services', description: 'Regulatory compliance support', keywords: ["hipaa", "gdpr", "pci", "compliance", "iso 27001"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'security_training', label: 'Security Awareness Training', description: 'Employee training programs', keywords: ["security training", "awareness training", "phishing simulation", "employee training"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'vulnerability_scanning', label: 'Vulnerability Scanning', description: 'Continuous scanning services', keywords: ["vulnerability", "scanning", "assessment", "dark web monitoring"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'zero_trust', label: 'Zero Trust Architecture', description: 'Modern security approach', keywords: ["zero trust", "zta", "least privilege", "microsegmentation"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'cloud_security', label: 'Cloud Security', description: 'Cloud protection services', keywords: ["cloud security", "aws security", "azure security", "gcp security", "cloud protection"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 22, platform: 'website'},
        {id: 'hiring', label: 'Hiring Security Professionals', description: 'Growing team', keywords: ["hiring", "security analyst", "security engineer", "careers", "join our team"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Market Expansion', description: 'New markets or services', keywords: ["expanding", "new service", "now offering"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'threat_intelligence', label: 'Threat Intelligence', description: 'Threat intel services', keywords: ["threat intelligence", "threat hunting", "threat detection"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'vCISO', label: 'Virtual CISO Services', description: 'Fractional CISO offering', keywords: ["vciso", "virtual ciso", "fractional ciso", "ciso as a service"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'recent_breach', label: 'Breach Response Case Study', description: 'Recent incident handling', keywords: ["case study", "breach", "incident", "we helped"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'}
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
        {id: 'solutions', pattern: '^solutions$', description: 'Solutions', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'partners', pattern: '^partners$', description: 'Partners', context: 'header'},
        {id: 'industries', pattern: '^industries$', description: 'Industries', context: 'header'},
        {id: 'login', pattern: '^login$', description: 'Login', context: 'header'},
        {id: 'demo', pattern: '^demo$', description: 'Demo', context: 'header'}
      ],

      scoringRules: [
        {id: 'enterprise_ready', name: 'Enterprise Ready', description: 'SOC 2 with managed security', condition: 'signals.some(s => s.signalId === "soc2_compliant") && signals.some(s => s.signalId === "managed_security")', scoreBoost: 50, priority: 1, enabled: true},
        {id: 'full_service', name: 'Full-Service Provider', description: 'Multiple security services', condition: 'signals.filter(s => ["penetration_testing", "incident_response", "security_training"].includes(s.signalId)).length >= 2', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'certified_team', name: 'Certified Team', description: 'Certifications with managed services', condition: 'signals.some(s => s.signalId === "certifications") && signals.some(s => s.signalId === "managed_security")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'growing_firm', name: 'Growing Firm', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'compliance_expert', name: 'Compliance Expert', description: 'Compliance with certifications', condition: 'signals.some(s => s.signalId === "compliance") && signals.some(s => s.signalId === "certifications")', scoreBoost: 30, priority: 5, enabled: true},
        {id: 'incident_ready', name: 'Incident Ready', description: 'IR with threat intel', condition: 'signals.some(s => s.signalId === "incident_response") && signals.some(s => s.signalId === "threat_intelligence")', scoreBoost: 35, priority: 6, enabled: true},
        {id: 'modern_approach', name: 'Modern Approach', description: 'Zero trust and cloud security', condition: 'signals.some(s => s.signalId === "zero_trust") || signals.some(s => s.signalId === "cloud_security")', scoreBoost: 25, priority: 7, enabled: true},
        {id: 'executive_service', name: 'Executive Service', description: 'vCISO services available', condition: 'signals.some(s => s.signalId === "vCISO")', scoreBoost: 28, priority: 8, enabled: true},
        {id: 'proven_response', name: 'Proven Response', description: 'Case studies with incident response', condition: 'signals.some(s => s.signalId === "recent_breach") && signals.some(s => s.signalId === "incident_response")', scoreBoost: 30, priority: 9, enabled: true},
        {id: 'comprehensive_protection', name: 'Comprehensive Protection', description: 'Multiple security layers', condition: 'signals.filter(s => ["managed_security", "penetration_testing", "security_training", "vulnerability_scanning"].includes(s.signalId)).length >= 3', scoreBoost: 40, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'has_soc2', label: 'SOC 2 Certified', type: 'boolean', description: 'SOC 2 compliance', extractionHints: ['soc 2', 'soc2'], required: false, defaultValue: false},
        {key: 'security_services', label: 'Security Services', type: 'array', description: 'Service offerings', extractionHints: ['mssp', 'pen test', 'incident response'], required: false, defaultValue: []},
        {key: 'certifications', label: 'Team Certifications', type: 'array', description: 'Professional credentials', extractionHints: ['cissp', 'cism', 'ceh'], required: false, defaultValue: []},
        {key: 'compliance_supported', label: 'Compliance Frameworks', type: 'array', description: 'Supported standards', extractionHints: ['hipaa', 'gdpr', 'pci', 'iso'], required: false, defaultValue: []},
        {key: 'offers_vciso', label: 'Offers vCISO', type: 'boolean', description: 'Virtual CISO available', extractionHints: ['vciso', 'virtual ciso'], required: false, defaultValue: false},
        {key: 'team_size', label: 'Security Team Size', type: 'number', description: 'Number of professionals', extractionHints: ['analysts', 'engineers', 'team'], required: false, defaultValue: 1},
        {key: 'specialization', label: 'Industry Specialization', type: 'string', description: 'Primary industry focus', extractionHints: ['healthcare', 'finance', 'government'], required: false, defaultValue: 'general'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Cybersecurity intelligence - focuses on certifications, compliance capabilities, service breadth, and incident response expertise'
      }
    }
  },
  
  'digital-marketing': {
    id: 'digital-marketing',
    name: 'Digital Marketing Agencies',
    description: 'For agencies - growth and ROAS focus',
    category: 'Technology & Business Services',
    
    coreIdentity: {
      title: 'The Growth Strategist',
      positioning: 'High-energy, creative, and data-obsessed',
      tone: 'Enthusiastic, results-driven, collaborative'
    },
    
    cognitiveLogic: {
      framework: 'The ROAS (Return on Ad Spend) Framework',
      reasoning: 'Logic that ignores "Likes and Engagement" and focuses on "Leads and Revenue"',
      decisionProcess: 'Current Performance → ROI Gap → Growth Strategy'
    },
    
    knowledgeRAG: {
      static: [
        'Platform algorithms (Google/Meta)',
        'SEO fundamentals',
        'Content marketing principles',
        'Conversion optimization',
        'Attribution models'
      ],
      dynamic: [
        'Client\'s best-performing campaigns',
        'Specific niche expertise',
        'Agency case studies',
        'Service packages',
        'Current market trends',
        'Competitive benchmarks'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Identifies "Budget Hesitation" or "ROI Skepticism" in lead responses',
      adaptation: 'Triggers a "Value-Stacking" module showing the cost of not scaling (lost market share, competitor growth)',
      feedbackIntegration: 'Tracks which metrics (leads, revenue, CAC) resonate most with different business types'
    },
    
    tacticalExecution: {
      primaryAction: 'Strategy Session',
      conversionRhythm: 'Directs the user to book a "Free Marketing Audit" or "Growth Strategy Call"',
      secondaryActions: [
        'Website audit',
        'Competitor analysis',
        'Ad account review',
        'Content strategy assessment',
        'Case study showcase'
      ]
    },

    research: {
      scrapingStrategy: {primarySource: 'website', secondarySources: ['linkedin-company', 'linkedin-jobs'], frequency: 'weekly', timeoutMs: 30000, enableCaching: true, cacheTtlSeconds: 600},
      highValueSignals: [
        {id: 'hiring', label: 'Hiring Marketing Team', description: 'Growing team', keywords: ["hiring", "join our team", "careers", "we're growing"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'new_clients', label: 'Client Wins', description: 'New client announcements', keywords: ["new client", "welcome", "latest client", "proud to announce"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'awards', label: 'Industry Awards', description: 'Recognition and awards', keywords: ["award", "top agency", "best", "recognized"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'case_studies', label: 'Case Studies', description: 'Published case studies', keywords: ["case study", "success story", "results", "roi"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'certifications', label: 'Platform Certifications', description: 'Google/Meta partner status', keywords: ["google partner", "meta partner", "certified", "premier partner"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'services_seo', label: 'SEO Services', description: 'Offers SEO', keywords: ["seo", "search engine optimization", "organic search"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'services_ppc', label: 'PPC/Paid Ads', description: 'Paid advertising services', keywords: ["ppc", "google ads", "facebook ads", "paid advertising"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'services_social', label: 'Social Media Management', description: 'Social media services', keywords: ["social media", "content creation", "community management"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 8, platform: 'website'},
        {id: 'services_content', label: 'Content Marketing', description: 'Content strategy', keywords: ["content marketing", "blog", "content creation"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 8, platform: 'website'},
        {id: 'industry_niche', label: 'Industry Specialization', description: 'Niche expertise', keywords: ["specialize", "expert in", "focus on"], regexPattern: '(specialize|expert)\\s+in\\s+([A-Za-z]+)', priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'team_size', label: 'Team Size', description: 'Agency headcount', keywords: ["team of", "employees"], regexPattern: '(\\d+)\\+?\\s*(team members?|employees?)', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'}
      ],
      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy link', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms link', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social links', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'portfolio', pattern: '^portfolio$|^work$', description: 'Portfolio link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back link', context: 'footer'}
      ],
      scoringRules: [
        {id: 'growth_mode', name: 'Growth Mode', description: 'Hiring + new clients', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "new_clients")', scoreBoost: 25, priority: 1, enabled: true},
        {id: 'full_service', name: 'Full Service Agency', description: 'SEO + PPC + Social', condition: 'signals.some(s => s.signalId === "services_seo") && signals.some(s => s.signalId === "services_ppc") && signals.some(s => s.signalId === "services_social")', scoreBoost: 20, priority: 2, enabled: true},
        {id: 'credibility', name: 'High Credibility', description: 'Awards + certifications + case studies', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "certifications") && signals.some(s => s.signalId === "case_studies")', scoreBoost: 20, priority: 3, enabled: true}
      ],
      customFields: [
        {key: 'team_size', label: 'Agency Size', type: 'number', description: 'Number of employees', extractionHints: ['team of', 'employees'], required: false, defaultValue: 0},
        {key: 'services_offered', label: 'Services', type: 'array', description: 'Service offerings', extractionHints: ['seo', 'ppc', 'social', 'content'], required: false, defaultValue: []},
        {key: 'industry_specialization', label: 'Industry Focus', type: 'string', description: 'Target industries', extractionHints: ['specialize', 'expert in'], required: false, defaultValue: 'general'},
        {key: 'is_google_partner', label: 'Google Partner', type: 'boolean', description: 'Google Partner status', extractionHints: ['google partner', 'premier partner'], required: false, defaultValue: false},
        {key: 'has_case_studies', label: 'Has Case Studies', type: 'boolean', description: 'Published case studies', extractionHints: ['case study', 'success story'], required: false, defaultValue: false}
      ],
      metadata: {lastUpdated: '2025-12-28', version: 1, updatedBy: 'system', notes: 'Digital marketing agency intelligence - growth, services, credentials'}
    }
  },
  
  'recruitment-hr': {
    id: 'recruitment-hr',
    name: 'Recruitment & HR (Staffing)',
    description: 'For recruiters - talent matching and cultural fit',
    category: 'Technology & Business Services',
    
    coreIdentity: {
      title: 'The Talent Matchmaker',
      positioning: 'Network-focused, intuitive, and professional',
      tone: 'Personable, efficient, relationship-oriented'
    },
    
    cognitiveLogic: {
      framework: 'The Cultural-Competency Model',
      reasoning: 'Logic that weighs "Hard Skills" (Resume credentials) against "Soft Skills" (Company Culture fit)',
      decisionProcess: 'Requirements Gathering → Cultural Alignment → Candidate Matching'
    },
    
    knowledgeRAG: {
      static: [
        'Labor laws and compliance',
        'Standard interview questions',
        'Candidate assessment frameworks',
        'Onboarding best practices',
        'Compensation benchmarking'
      ],
      dynamic: [
        'Open roles and specifications',
        'Salary benchmarks by market',
        'Agency\'s "Candidate Quality Guarantee"',
        'Placement success rates',
        'Time-to-fill averages',
        'Candidate pool by specialty'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks "Ghosting Patterns"—if candidates drop at a certain stage (offer, interview, start date)',
      adaptation: 'Suggests a "Process Friction" fix to the client (faster response, better communication, comp adjustment)',
      feedbackIntegration: 'Learns which cultural factors (remote work, benefits, growth) drive acceptance rates'
    },
    
    tacticalExecution: {
      primaryAction: 'Candidate Submission or Client Discovery',
      conversionRhythm: 'For candidates: "Upload Resume." For companies: "Book a Talent Briefing"',
      secondaryActions: [
        'Skills assessment',
        'Culture fit questionnaire',
        'Salary expectations discussion',
        'Job description consultation',
        'Hiring process audit'
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
        {id: 'placement_count', label: 'High Placement Volume', description: 'Many successful placements', keywords: ["placements", "hires", "placed"], regexPattern: '([\\d,]+)\\+?\\s*(placements?|hires?)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'industry_specialist', label: 'Industry Specialist', description: 'Vertical specialization', keywords: ["specialize", "expert in", "focus on", "healthcare", "tech", "finance", "engineering"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'},
        {id: 'executive_search', label: 'Executive Search', description: 'C-level recruitment', keywords: ["executive search", "c-level", "executive recruitment", "leadership"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'},
        {id: 'temp_staffing', label: 'Temporary Staffing', description: 'Temp and contract placements', keywords: ["temporary", "temp", "contract", "contract-to-hire"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'direct_hire', label: 'Direct Hire', description: 'Permanent placement', keywords: ["direct hire", "permanent", "full-time placement"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'guarantee', label: 'Placement Guarantee', description: 'Candidate guarantee', keywords: ["guarantee", "replacement guarantee", "90 day", "satisfaction guaranteed"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'background_checks', label: 'Background Screening', description: 'Candidate vetting', keywords: ["background check", "screening", "background verification"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'hiring', label: 'Hiring Recruiters', description: 'Growing team', keywords: ["hiring", "recruiter jobs", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Market Expansion', description: 'New markets or specialties', keywords: ["expanding", "new office", "now serving"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'nationwide', label: 'Nationwide Reach', description: 'National coverage', keywords: ["nationwide", "national", "all states", "coast to coast"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'awards', label: 'Industry Awards', description: 'Staffing awards', keywords: ["award", "best staffing", "top recruiter", "staffing industry"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'technology_platform', label: 'Technology Platform', description: 'ATS or recruitment tech', keywords: ["ats", "applicant tracking", "platform", "technology"], priority: 'LOW', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'retained_search', label: 'Retained Search', description: 'Retained executive search', keywords: ["retained", "retained search", "exclusive"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'client_count', label: 'Large Client Base', description: 'Many client companies', keywords: ["clients", "companies"], regexPattern: '([\\d,]+)\\+?\\s*(clients?|companies?)', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'rpo', label: 'RPO Services', description: 'Recruitment process outsourcing', keywords: ["rpo", "recruitment process outsourcing", "outsourced recruiting"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'equal_opportunity', pattern: 'equal opportunity', description: 'EEO statement', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'industries', pattern: '^industries$', description: 'Industries', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'candidates', pattern: '^candidates$', description: 'Candidates', context: 'header'},
        {id: 'employers', pattern: '^employers$', description: 'Employers', context: 'header'},
        {id: 'jobs', pattern: '^jobs$', description: 'Jobs', context: 'header'}
      ],

      scoringRules: [
        {id: 'high_volume_firm', name: 'High-Volume Firm', description: 'Large placement count with guarantee', condition: 'signals.some(s => s.signalId === "placement_count") && signals.some(s => s.signalId === "guarantee")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'niche_specialist', name: 'Niche Specialist', description: 'Industry specialization with executive search', condition: 'signals.some(s => s.signalId === "industry_specialist") && signals.some(s => s.signalId === "executive_search")', scoreBoost: 40, priority: 2, enabled: true},
        {id: 'growing_firm', name: 'Growing Firm', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'full_service', name: 'Full-Service Staffing', description: 'Temp and direct hire', condition: 'signals.some(s => s.signalId === "temp_staffing") && signals.some(s => s.signalId === "direct_hire")', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'national_firm', name: 'National Firm', description: 'Nationwide with large client base', condition: 'signals.some(s => s.signalId === "nationwide") && signals.some(s => s.signalId === "client_count")', scoreBoost: 40, priority: 5, enabled: true},
        {id: 'premium_service', name: 'Premium Service', description: 'Executive search with RPO', condition: 'signals.some(s => s.signalId === "executive_search") && signals.some(s => s.signalId === "rpo")', scoreBoost: 40, priority: 6, enabled: true},
        {id: 'quality_focused', name: 'Quality-Focused', description: 'Background checks with guarantee', condition: 'signals.some(s => s.signalId === "background_checks") && signals.some(s => s.signalId === "guarantee")', scoreBoost: 25, priority: 7, enabled: true},
        {id: 'recognized_firm', name: 'Recognized Firm', description: 'Awards with high placement volume', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "placement_count")', scoreBoost: 30, priority: 8, enabled: true},
        {id: 'retained_specialist', name: 'Retained Specialist', description: 'Retained search with executive focus', condition: 'signals.some(s => s.signalId === "retained_search") && signals.some(s => s.signalId === "executive_search")', scoreBoost: 35, priority: 9, enabled: true},
        {id: 'tech_enabled', name: 'Technology-Enabled', description: 'Modern ATS platform', condition: 'signals.some(s => s.signalId === "technology_platform")', scoreBoost: 15, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'annual_placements', label: 'Annual Placements', type: 'number', description: 'Yearly placement volume', extractionHints: ['placements', 'hires'], required: false, defaultValue: 0},
        {key: 'specializations', label: 'Industry Specializations', type: 'array', description: 'Vertical expertise', extractionHints: ['healthcare', 'tech', 'finance', 'engineering'], required: false, defaultValue: []},
        {key: 'services_offered', label: 'Staffing Services', type: 'array', description: 'Service types', extractionHints: ['temp', 'direct hire', 'executive', 'rpo'], required: false, defaultValue: []},
        {key: 'recruiter_count', label: 'Number of Recruiters', type: 'number', description: 'Team size', extractionHints: ['recruiters', 'team'], required: false, defaultValue: 1},
        {key: 'has_guarantee', label: 'Placement Guarantee', type: 'boolean', description: 'Replacement guarantee', extractionHints: ['guarantee'], required: false, defaultValue: false},
        {key: 'office_locations', label: 'Office Locations', type: 'number', description: 'Number of offices', extractionHints: ['locations', 'offices'], required: false, defaultValue: 1},
        {key: 'is_nationwide', label: 'Nationwide Coverage', type: 'boolean', description: 'National reach', extractionHints: ['nationwide', 'national'], required: false, defaultValue: false}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Recruitment & HR intelligence - focuses on placement volume, specializations, service breadth, and quality guarantees'
      }
    }
  },
  
  'logistics-freight': {
    id: 'logistics-freight',
    name: 'Logistics & Freight',
    description: 'For logistics - speed and cost optimization',
    category: 'Technology & Business Services',
    
    coreIdentity: {
      title: 'The Supply Chain Optimizer',
      positioning: 'Precise, reliable, and timeline-driven',
      tone: 'Professional, efficient, solution-focused'
    },
    
    cognitiveLogic: {
      framework: 'The Cost-to-Speed Ratio',
      reasoning: 'Logic that helps the user choose between "Economy" (cost savings) and "Express" (time urgency)',
      decisionProcess: 'Requirements → Trade-off Analysis → Optimal Route'
    },
    
    knowledgeRAG: {
      static: [
        'Shipping lanes and routes',
        'Incoterms (FOB, CIF, etc.)',
        'Customs and duties basics',
        'Packaging requirements',
        'Hazmat regulations'
      ],
      dynamic: [
        'Fleet capacity and availability',
        'Current fuel surcharges',
        'Tracking portal links',
        'Transit time estimates',
        'Rate quotes by lane',
        'Real-time shipment tracking'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Identifies "Supply Chain Bottlenecks" described by the lead (port delays, last-mile issues)',
      adaptation: 'Suggests "Multi-Modal" solutions (e.g., Ocean → Rail → Last Mile) to mitigate specific pain points',
      feedbackIntegration: 'Tracks which service levels (speed vs cost) different customer types prioritize'
    },
    
    tacticalExecution: {
      primaryAction: 'Quick Quote',
      conversionRhythm: 'Every interaction aims to get "Origin/Destination" data to provide a shipping estimate',
      secondaryActions: [
        'Transit time calculator',
        'Customs documentation assistance',
        'Freight class determination',
        'Volume discount inquiry',
        'Tracking setup'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['linkedin-company'],
        frequency: 'weekly',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 600
      },

      highValueSignals: [
        {id: 'fleet_size', label: 'Large Fleet', description: 'Substantial truck/trailer count', keywords: ["fleet", "trucks", "trailers", "vehicles"], regexPattern: '([\\d,]+)\\+?\\s*(trucks?|trailers?|vehicles?)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 45, platform: 'website'},
        {id: '3pl_services', label: '3PL Services', description: 'Third-party logistics', keywords: ["3pl", "third party", "warehousing", "fulfillment"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'},
        {id: 'ltl_carrier', label: 'LTL Services', description: 'Less-than-truckload', keywords: ["ltl", "less than truckload", "less-than-truckload"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'ftl_carrier', label: 'FTL Services', description: 'Full truckload', keywords: ["ftl", "full truckload", "truckload"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'intermodal', label: 'Intermodal Services', description: 'Rail and ocean', keywords: ["intermodal", "rail", "ocean freight", "container"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'international', label: 'International Shipping', description: 'Global logistics', keywords: ["international", "global", "overseas", "import", "export"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'dedicated_fleet', label: 'Dedicated Fleet', description: 'Dedicated contract carriage', keywords: ["dedicated", "dedicated fleet", "contract carriage"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'expedited', label: 'Expedited Services', description: 'Time-critical shipping', keywords: ["expedited", "hot shot", "urgent", "same day"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'hiring', label: 'Hiring Drivers/Staff', description: 'Growing workforce', keywords: ["hiring", "driver jobs", "cdl", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 35, platform: 'any'},
        {id: 'expansion', label: 'Geographic Expansion', description: 'New terminals or markets', keywords: ["new terminal", "expanding", "new location", "now serving"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'technology', label: 'Technology Platform', description: 'TMS or tracking system', keywords: ["tms", "tracking", "technology", "real-time", "visibility"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'warehousing', label: 'Warehousing Services', description: 'Distribution centers', keywords: ["warehouse", "warehousing", "distribution", "storage"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'specialized_freight', label: 'Specialized Freight', description: 'Refrigerated, flatbed, etc', keywords: ["refrigerated", "reefer", "flatbed", "specialized", "hazmat"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'coverage_area', label: 'Nationwide Coverage', description: 'Broad geographic reach', keywords: ["nationwide", "48 states", "coast to coast", "national coverage"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'safety_rating', label: 'Safety Rating', description: 'Safety awards or rating', keywords: ["safety", "safety rating", "safe fleet", "dot"], priority: 'LOW', action: 'increase-score', scoreBoost: 12, platform: 'website'}
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
        {id: 'quote', pattern: '^quote$', description: 'Quote', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'tracking', pattern: '^tracking$', description: 'Tracking', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'login', pattern: '^login$', description: 'Login', context: 'header'},
        {id: 'locations', pattern: '^locations$', description: 'Locations', context: 'header'},
        {id: 'industries', pattern: '^industries$', description: 'Industries', context: 'header'}
      ],

      scoringRules: [
        {id: 'large_carrier', name: 'Large Carrier', description: 'Large fleet with nationwide coverage', condition: 'signals.some(s => s.signalId === "fleet_size") && signals.some(s => s.signalId === "coverage_area")', scoreBoost: 50, priority: 1, enabled: true},
        {id: 'full_service_3pl', name: 'Full-Service 3PL', description: '3PL with warehousing', condition: 'signals.some(s => s.signalId === "3pl_services") && signals.some(s => s.signalId === "warehousing")', scoreBoost: 40, priority: 2, enabled: true},
        {id: 'growing_carrier', name: 'Growing Carrier', description: 'Hiring drivers with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 40, priority: 3, enabled: true},
        {id: 'versatile_carrier', name: 'Versatile Carrier', description: 'LTL and FTL services', condition: 'signals.some(s => s.signalId === "ltl_carrier") && signals.some(s => s.signalId === "ftl_carrier")', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'global_logistics', name: 'Global Logistics', description: 'International with 3PL', condition: 'signals.some(s => s.signalId === "international") && signals.some(s => s.signalId === "3pl_services")', scoreBoost: 40, priority: 5, enabled: true},
        {id: 'specialized_carrier', name: 'Specialized Carrier', description: 'Specialized freight capabilities', condition: 'signals.some(s => s.signalId === "specialized_freight")', scoreBoost: 25, priority: 6, enabled: true},
        {id: 'tech_enabled', name: 'Technology-Enabled', description: 'TMS with real-time tracking', condition: 'signals.some(s => s.signalId === "technology")', scoreBoost: 22, priority: 7, enabled: true},
        {id: 'multi_modal', name: 'Multi-Modal Provider', description: 'Intermodal with warehousing', condition: 'signals.some(s => s.signalId === "intermodal") && signals.some(s => s.signalId === "warehousing")', scoreBoost: 30, priority: 8, enabled: true},
        {id: 'expedited_specialist', name: 'Expedited Specialist', description: 'Time-critical services', condition: 'signals.some(s => s.signalId === "expedited")', scoreBoost: 18, priority: 9, enabled: true},
        {id: 'dedicated_service', name: 'Dedicated Service', description: 'Dedicated fleet with large fleet', condition: 'signals.some(s => s.signalId === "dedicated_fleet") && signals.some(s => s.signalId === "fleet_size")', scoreBoost: 35, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'fleet_size', label: 'Fleet Size', type: 'number', description: 'Number of vehicles', extractionHints: ['trucks', 'fleet', 'trailers'], required: false, defaultValue: 0},
        {key: 'services_offered', label: 'Logistics Services', type: 'array', description: 'Service types', extractionHints: ['ltl', 'ftl', '3pl', 'intermodal'], required: false, defaultValue: []},
        {key: 'coverage_type', label: 'Coverage Type', type: 'string', description: 'Geographic reach', extractionHints: ['nationwide', 'regional', 'international'], required: false, defaultValue: 'regional'},
        {key: 'has_warehousing', label: 'Warehousing Services', type: 'boolean', description: 'Distribution centers', extractionHints: ['warehouse', 'warehousing'], required: false, defaultValue: false},
        {key: 'offers_international', label: 'International Shipping', type: 'boolean', description: 'Global logistics', extractionHints: ['international'], required: false, defaultValue: false},
        {key: 'has_technology', label: 'Technology Platform', type: 'boolean', description: 'TMS or tracking system', extractionHints: ['tms', 'tracking'], required: false, defaultValue: false},
        {key: 'terminal_count', label: 'Terminal Locations', type: 'number', description: 'Number of terminals', extractionHints: ['terminals', 'locations'], required: false, defaultValue: 1}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Logistics & freight intelligence - focuses on fleet size, service breadth, geographic coverage, and technology capabilities'
      }
    }
  },
  
  'fintech': {
    id: 'fintech',
    name: 'FinTech (Financial Technology)',
    description: 'For fintech - modern banking and friction reduction',
    category: 'Technology & Business Services',
    
    coreIdentity: {
      title: 'The Financial Disruptor',
      positioning: 'Modern, secure, and user-centric',
      tone: 'Forward-thinking, accessible, trustworthy'
    },
    
    cognitiveLogic: {
      framework: 'The Friction-Reduction Model',
      reasoning: 'Focuses on how much faster/cheaper this is than "Traditional Banking" (instant transfers, lower fees, mobile-first)',
      decisionProcess: 'Traditional Pain Point → Modern Solution → Time/Cost Savings'
    },
    
    knowledgeRAG: {
      static: [
        'Encryption protocols and security',
        'KYC (Know Your Customer) requirements',
        'Regulatory compliance (FinCEN, SEC)',
        'Fraud prevention basics',
        'Banking integration standards'
      ],
      dynamic: [
        'Transaction fees and pricing',
        'App features and updates',
        'Regulatory licenses by region',
        'Supported currencies/countries',
        'Integration capabilities',
        'Customer success metrics'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Monitors "Onboarding Drop-off" questions (identity verification, bank linking, documentation)',
      adaptation: 'Triggers "Assisted Setup" logic or live chat hand-off to increase conversion',
      feedbackIntegration: 'Learns which features (instant transfers, budgeting tools, crypto) drive adoption'
    },
    
    tacticalExecution: {
      primaryAction: 'Account Creation',
      conversionRhythm: 'Pushes for "Download App" or "Link Bank Account" as primary conversion',
      secondaryActions: [
        'Security overview',
        'Fee comparison vs traditional banks',
        'Feature walkthrough',
        'Identity verification assistance',
        'Referral program enrollment'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['linkedin-company', 'news', 'crunchbase'],
        frequency: 'weekly',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 600
      },

      highValueSignals: [
        {id: 'funding_round', label: 'Funding Announcement', description: 'Recent capital raise', keywords: ["raised", "funding", "series", "seed", "million", "billion"], regexPattern: '\\$(\\d+)\\s*(million|billion)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 50, platform: 'any'},
        {id: 'user_growth', label: 'User Growth', description: 'Large or growing user base', keywords: ["users", "customers", "members", "accounts"], regexPattern: '([\\d,]+)\\+?\\s*(users?|customers?|members?)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 45, platform: 'website'},
        {id: 'regulatory_licenses', label: 'Regulatory Licenses', description: 'Banking/money transmitter licenses', keywords: ["fdic", "banking license", "money transmitter", "state licenses"], regexPattern: 'licensed? in (\\d+) states?', priority: 'HIGH', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'bank_partnerships', label: 'Bank Partnerships', description: 'Partner bank relationships', keywords: ["partner bank", "banking partner", "fdic insured"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'api_platform', label: 'API Platform', description: 'Developer API available', keywords: ["api", "developer", "integrate", "api documentation"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'crypto_support', label: 'Crypto Support', description: 'Cryptocurrency services', keywords: ["crypto", "cryptocurrency", "bitcoin", "ethereum", "blockchain"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'instant_transfer', label: 'Instant Transfers', description: 'Real-time payments', keywords: ["instant", "instant transfer", "real-time", "immediate"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'no_fees', label: 'Zero/Low Fees', description: 'Competitive fee structure', keywords: ["no fees", "zero fees", "free", "no hidden fees"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'hiring', label: 'Hiring Engineers', description: 'Growing tech team', keywords: ["hiring", "engineer positions", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 35, platform: 'any'},
        {id: 'international', label: 'International Support', description: 'Global reach', keywords: ["international", "global", "countries", "worldwide"], regexPattern: '(\\d+)\\+?\\s*countries?', priority: 'HIGH', action: 'add-to-segment', scoreBoost: 30, platform: 'website'},
        {id: 'security_features', label: 'Advanced Security', description: 'Strong security positioning', keywords: ["encryption", "secure", "two-factor", "biometric", "fraud protection"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'business_accounts', label: 'Business Accounts', description: 'B2B services', keywords: ["business account", "business banking", "corporate", "small business"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'awards', label: 'Industry Recognition', description: 'Fintech awards', keywords: ["award", "best fintech", "innovation", "fast company"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'ipo_announcement', label: 'IPO or Acquisition', description: 'Going public', keywords: ["ipo", "going public", "nasdaq", "acquisition"], priority: 'CRITICAL', action: 'flag-for-review', scoreBoost: 50, platform: 'any'},
        {id: 'open_banking', label: 'Open Banking', description: 'Plaid/open banking integration', keywords: ["plaid", "open banking", "bank connection", "link account"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'disclaimer', pattern: 'not fdic insured|investment disclaimer', description: 'Financial disclaimer', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'features', pattern: '^features$', description: 'Features', context: 'header'},
        {id: 'pricing', pattern: '^pricing$', description: 'Pricing', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'security', pattern: '^security$', description: 'Security', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'developers', pattern: '^developers$', description: 'Developers', context: 'header'},
        {id: 'login', pattern: '^login$', description: 'Login', context: 'header'},
        {id: 'support', pattern: '^support$', description: 'Support', context: 'header'}
      ],

      scoringRules: [
        {id: 'unicorn_potential', name: 'Unicorn Potential', description: 'Massive funding with user growth', condition: 'signals.some(s => s.signalId === "funding_round") && signals.some(s => s.signalId === "user_growth")', scoreBoost: 60, priority: 1, enabled: true},
        {id: 'licensed_operator', name: 'Licensed Operator', description: 'Regulatory licenses with bank partners', condition: 'signals.some(s => s.signalId === "regulatory_licenses") && signals.some(s => s.signalId === "bank_partnerships")', scoreBoost: 45, priority: 2, enabled: true},
        {id: 'platform_play', name: 'Platform Play', description: 'API with business accounts', condition: 'signals.some(s => s.signalId === "api_platform") && signals.some(s => s.signalId === "business_accounts")', scoreBoost: 40, priority: 3, enabled: true},
        {id: 'hyper_growth', name: 'Hyper-Growth', description: 'Funding with hiring surge', condition: 'signals.some(s => s.signalId === "funding_round") && signals.some(s => s.signalId === "hiring")', scoreBoost: 50, priority: 4, enabled: true},
        {id: 'global_reach', name: 'Global Reach', description: 'International with large user base', condition: 'signals.some(s => s.signalId === "international") && signals.some(s => s.signalId === "user_growth")', scoreBoost: 40, priority: 5, enabled: true},
        {id: 'competitive_advantage', name: 'Competitive Advantage', description: 'No fees with instant transfers', condition: 'signals.some(s => s.signalId === "no_fees") && signals.some(s => s.signalId === "instant_transfer")', scoreBoost: 30, priority: 6, enabled: true},
        {id: 'crypto_leader', name: 'Crypto Leader', description: 'Crypto with regulatory licenses', condition: 'signals.some(s => s.signalId === "crypto_support") && signals.some(s => s.signalId === "regulatory_licenses")', scoreBoost: 35, priority: 7, enabled: true},
        {id: 'exit_ready', name: 'Exit Ready', description: 'IPO announcement', condition: 'signals.some(s => s.signalId === "ipo_announcement")', scoreBoost: 60, priority: 8, enabled: true},
        {id: 'secure_platform', name: 'Secure Platform', description: 'Security features with bank partners', condition: 'signals.some(s => s.signalId === "security_features") && signals.some(s => s.signalId === "bank_partnerships")', scoreBoost: 28, priority: 9, enabled: true},
        {id: 'recognized_brand', name: 'Recognized Brand', description: 'Awards with large user base', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "user_growth")', scoreBoost: 35, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'user_count', label: 'Number of Users', type: 'number', description: 'Active user base', extractionHints: ['users', 'customers', 'accounts'], required: false, defaultValue: 0},
        {key: 'funding_amount', label: 'Last Funding Amount', type: 'string', description: 'Recent raise size', extractionHints: ['million', 'raised', 'series'], required: false, defaultValue: 'unknown'},
        {key: 'services_offered', label: 'Financial Services', type: 'array', description: 'Product offerings', extractionHints: ['payments', 'lending', 'investing', 'banking'], required: false, defaultValue: []},
        {key: 'has_api', label: 'Offers API', type: 'boolean', description: 'Developer API available', extractionHints: ['api'], required: false, defaultValue: false},
        {key: 'supports_crypto', label: 'Supports Crypto', type: 'boolean', description: 'Cryptocurrency services', extractionHints: ['crypto', 'bitcoin'], required: false, defaultValue: false},
        {key: 'countries_supported', label: 'Countries Supported', type: 'number', description: 'Geographic reach', extractionHints: ['countries'], required: false, defaultValue: 1},
        {key: 'specialization', label: 'FinTech Specialization', type: 'string', description: 'Primary service type', extractionHints: ['payments', 'lending', 'investing', 'banking'], required: false, defaultValue: 'payments'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'FinTech intelligence - focuses on funding, user growth, regulatory compliance, product breadth, and platform capabilities'
      }
    }
  },
  
  'managed-it-msp': {
    id: 'managed-it-msp',
    name: 'Managed IT Services (MSP)',
    description: 'For MSPs - proactive support and modernization',
    category: 'Technology & Business Services',
    
    coreIdentity: {
      title: 'The Virtual CTO',
      positioning: 'Problem-solving, dependable, and technical',
      tone: 'Professional, reliable, proactive'
    },
    
    cognitiveLogic: {
      framework: 'The Proactive-Maintenance Logic',
      reasoning: 'Shifts the "Sale" from "fixing broken stuff" to "preventing downtime before it happens"',
      decisionProcess: 'Current State → Risk Assessment → Proactive Solution'
    },
    
    knowledgeRAG: {
      static: [
        'Cloud vs. On-premise tradeoffs',
        'Disaster recovery planning',
        'Cybersecurity fundamentals',
        'Network architecture basics',
        'Backup strategies'
      ],
      dynamic: [
        'Service Level Agreements (SLAs)',
        'Specific hardware/software supported',
        'Response time guarantees',
        'Pricing tiers by user count',
        'Technology stack assessments',
        'Migration timelines'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects "Legacy System" mentions (old servers, Windows 7, outdated software)',
      adaptation: 'Triggers an "Infrastructure Modernization" educational track showing risks and migration paths',
      feedbackIntegration: 'Tracks which pain points (downtime, security, slow performance) drive urgency'
    },
    
    tacticalExecution: {
      primaryAction: 'IT Health Check',
      conversionRhythm: 'Leads to a "Network Assessment" or "Technology Audit" booking',
      secondaryActions: [
        'Security assessment',
        'Backup verification',
        'Cloud migration consultation',
        'Disaster recovery planning',
        'SLA proposal'
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
        {id: 'client_count', label: 'Large Client Base', description: 'High client volume', keywords: ["clients", "businesses served", "companies"], regexPattern: '([\\d,]+)\\+?\\s*(clients?|businesses?|companies?)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'sla_guarantee', label: 'SLA Guarantee', description: 'Service level agreements', keywords: ["sla", "service level", "uptime guarantee", "99.9%"], regexPattern: '\\d+\\.?\\d*%\\s*uptime', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'help_desk', label: '24/7 Help Desk', description: 'Round-the-clock support', keywords: ["24/7", "24x7", "24 hour", "round the clock", "always available"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'cloud_services', label: 'Cloud Services', description: 'Cloud migration and management', keywords: ["cloud", "microsoft 365", "office 365", "azure", "aws", "google workspace"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'cybersecurity', label: 'Cybersecurity Services', description: 'Security integration', keywords: ["cybersecurity", "security", "firewall", "endpoint protection", "backup"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'website'},
        {id: 'hiring', label: 'Hiring IT Professionals', description: 'Growing team', keywords: ["hiring", "it positions", "technician jobs", "join our team"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Geographic Expansion', description: 'New markets', keywords: ["expanding", "new office", "now serving"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'disaster_recovery', label: 'Disaster Recovery', description: 'DR/BCP services', keywords: ["disaster recovery", "business continuity", "bcdr", "backup and recovery"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'vcio', label: 'vCIO Services', description: 'Virtual CIO offering', keywords: ["vcio", "virtual cio", "technology consulting", "strategic it"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'compliance', label: 'Compliance Services', description: 'Regulatory compliance support', keywords: ["compliance", "hipaa", "pci", "sox"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'remote_monitoring', label: 'Remote Monitoring', description: 'RMM services', keywords: ["remote monitoring", "rmm", "proactive monitoring", "network monitoring"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'project_services', label: 'Project Services', description: 'Implementation projects', keywords: ["projects", "implementation", "migration", "deployment"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'voip', label: 'VoIP Services', description: 'Phone system management', keywords: ["voip", "phone", "unified communications", "teams phone"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'certifications', label: 'Partner Certifications', description: 'Vendor certifications', keywords: ["microsoft partner", "dell partner", "cisco", "certified partner"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'}
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
        {id: 'solutions', pattern: '^solutions$', description: 'Solutions', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'support', pattern: '^support$', description: 'Support', context: 'header'},
        {id: 'partners', pattern: '^partners$', description: 'Partners', context: 'header'},
        {id: 'login', pattern: '^login$', description: 'Login', context: 'header'},
        {id: 'industries', pattern: '^industries$', description: 'Industries', context: 'header'}
      ],

      scoringRules: [
        {id: 'enterprise_msp', name: 'Enterprise MSP', description: 'Large client base with SLA', condition: 'signals.some(s => s.signalId === "client_count") && signals.some(s => s.signalId === "sla_guarantee")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'full_stack_provider', name: 'Full-Stack Provider', description: 'Help desk, monitoring, and security', condition: 'signals.filter(s => ["help_desk", "remote_monitoring", "cybersecurity"].includes(s.signalId)).length >= 3', scoreBoost: 40, priority: 2, enabled: true},
        {id: 'growing_msp', name: 'Growing MSP', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 35, priority: 3, enabled: true},
        {id: 'cloud_leader', name: 'Cloud Leader', description: 'Cloud services with vCIO', condition: 'signals.some(s => s.signalId === "cloud_services") && signals.some(s => s.signalId === "vcio")', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'security_focused', name: 'Security-Focused', description: 'Cybersecurity with compliance', condition: 'signals.some(s => s.signalId === "cybersecurity") && signals.some(s => s.signalId === "compliance")', scoreBoost: 30, priority: 5, enabled: true},
        {id: 'proactive_msp', name: 'Proactive MSP', description: 'Monitoring with disaster recovery', condition: 'signals.some(s => s.signalId === "remote_monitoring") && signals.some(s => s.signalId === "disaster_recovery")', scoreBoost: 28, priority: 6, enabled: true},
        {id: 'strategic_partner', name: 'Strategic Partner', description: 'vCIO with project services', condition: 'signals.some(s => s.signalId === "vcio") && signals.some(s => s.signalId === "project_services")', scoreBoost: 25, priority: 7, enabled: true},
        {id: 'certified_partner', name: 'Certified Partner', description: 'Vendor certifications', condition: 'signals.some(s => s.signalId === "certifications")', scoreBoost: 18, priority: 8, enabled: true},
        {id: 'unified_communications', name: 'Unified Communications', description: 'VoIP with cloud services', condition: 'signals.some(s => s.signalId === "voip") && signals.some(s => s.signalId === "cloud_services")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'always_available', name: 'Always Available', description: '24/7 help desk with SLA', condition: 'signals.some(s => s.signalId === "help_desk") && signals.some(s => s.signalId === "sla_guarantee")', scoreBoost: 28, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'client_count', label: 'Number of Clients', type: 'number', description: 'Active client count', extractionHints: ['clients', 'businesses served'], required: false, defaultValue: 0},
        {key: 'has_24_7_support', label: '24/7 Support', type: 'boolean', description: 'Round-the-clock help desk', extractionHints: ['24/7', '24x7'], required: false, defaultValue: false},
        {key: 'services_offered', label: 'MSP Services', type: 'array', description: 'Service portfolio', extractionHints: ['help desk', 'cloud', 'security', 'backup'], required: false, defaultValue: []},
        {key: 'offers_vcio', label: 'Offers vCIO', type: 'boolean', description: 'Virtual CIO services', extractionHints: ['vcio'], required: false, defaultValue: false},
        {key: 'uptime_sla', label: 'Uptime SLA %', type: 'number', description: 'Guaranteed uptime', extractionHints: ['uptime', 'sla'], required: false, defaultValue: 99},
        {key: 'technician_count', label: 'Technician Count', type: 'number', description: 'Support team size', extractionHints: ['technicians', 'engineers', 'team'], required: false, defaultValue: 1},
        {key: 'specialization', label: 'Industry Specialization', type: 'string', description: 'Primary industry focus', extractionHints: ['healthcare', 'legal', 'manufacturing'], required: false, defaultValue: 'general'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Managed IT (MSP) intelligence - focuses on client volume, SLA guarantees, service breadth, and strategic IT capabilities'
      }
    }
  },
  
  'edtech': {
    id: 'edtech',
    name: 'EdTech (Educational Technology)',
    description: 'For edtech - learning outcomes and engagement',
    category: 'Technology & Business Services',
    
    coreIdentity: {
      title: 'The Academic Innovator',
      positioning: 'Inspiring, pedagogical, and outcome-oriented',
      tone: 'Educational, encouraging, forward-thinking'
    },
    
    cognitiveLogic: {
      framework: 'The Learning-Outcome Model',
      reasoning: 'Focuses on "Engagement Rates" and "Knowledge Retention" rather than just "Software Usage"',
      decisionProcess: 'Learning Goals → Engagement Strategy → Measurable Outcomes'
    },
    
    knowledgeRAG: {
      static: [
        'Learning Management System (LMS) standards',
        'SCORM and xAPI protocols',
        'Pedagogical best practices',
        'Assessment methodologies',
        'Accessibility requirements (508, WCAG)'
      ],
      dynamic: [
        'Course catalog and syllabi',
        'Student success data',
        'Pricing and licensing models',
        'Integration with existing systems',
        'Completion rates by course',
        'Instructor resources'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks which "Curriculum Gaps" users complain about (missing topics, outdated content, skill needs)',
      adaptation: 'Suggests new course modules to the platform owner to address market demand',
      feedbackIntegration: 'Learns which learning formats (video, interactive, assessments) drive best retention'
    },
    
    tacticalExecution: {
      primaryAction: 'Free Lesson or Sandbox Access',
      conversionRhythm: 'Moves the lead to "Start Learning" immediately with low-friction entry',
      secondaryActions: [
        'Course preview',
        'Learning path assessment',
        'Certification information',
        'Group/enterprise pricing',
        'Implementation support'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['linkedin-company', 'news'],
        frequency: 'weekly',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 600
      },

      highValueSignals: [
        {id: 'user_count', label: 'Large User Base', description: 'High adoption numbers', keywords: ["students", "users", "learners", "enrolled"], regexPattern: '([\\d,]+)\\+?\\s*(students?|users?|learners?)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'funding_announcement', label: 'Recent Funding', description: 'Investment raised', keywords: ["raised", "funding", "series", "seed round", "million", "investment"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 45, platform: 'any'},
        {id: 'enterprise_clients', label: 'Enterprise Customers', description: 'Major institutional clients', keywords: ["enterprise", "universities", "school districts", "fortune 500"], priority: 'HIGH', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'course_catalog', label: 'Extensive Catalog', description: 'Large course library', keywords: ["courses", "catalog", "library"], regexPattern: '([\\d,]+)\\+?\\s*courses?', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'certifications', label: 'Certification Programs', description: 'Offers certifications', keywords: ["certification", "certified", "credential", "accredited"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'free_trial', label: 'Free Trial', description: 'Trial period offered', keywords: ["free trial", "try free", "free access", "no credit card"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'mobile_app', label: 'Mobile Learning App', description: 'Native mobile apps', keywords: ["mobile app", "ios", "android", "app store"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'hiring', label: 'Hiring Educators/Engineers', description: 'Growing team', keywords: ["hiring", "join our team", "careers", "instructor positions"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'partnerships', label: 'University Partnerships', description: 'Academic partnerships', keywords: ["partnership", "university", "college", "accredited program"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'student_outcomes', label: 'Student Outcomes', description: 'Success metrics published', keywords: ["student outcomes", "success rate", "job placement", "completion rate"], regexPattern: '\\d+%\\s*(completion|placement|success)', priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'website'},
        {id: 'adaptive_learning', label: 'Adaptive Learning', description: 'AI-powered personalization', keywords: ["adaptive", "personalized learning", "ai-powered", "machine learning"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'lms_integration', label: 'LMS Integration', description: 'Integrates with existing systems', keywords: ["integration", "lms", "canvas", "blackboard", "moodle", "scorm"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'gamification', label: 'Gamification', description: 'Game-based learning', keywords: ["gamification", "badges", "leaderboard", "points", "game-based"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'live_classes', label: 'Live Classes', description: 'Instructor-led sessions', keywords: ["live classes", "instructor-led", "live sessions", "cohort-based"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'awards', label: 'Industry Recognition', description: 'EdTech awards or recognition', keywords: ["award", "edtech", "innovation", "best of"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'}
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
        {id: 'courses', pattern: '^courses$', description: 'Courses', context: 'header'},
        {id: 'pricing', pattern: '^pricing$', description: 'Pricing', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'partners', pattern: '^partners$', description: 'Partners', context: 'header'},
        {id: 'login', pattern: '^login$', description: 'Login', context: 'header'},
        {id: 'demo', pattern: '^demo$', description: 'Demo', context: 'header'},
        {id: 'for_business', pattern: '^for business$', description: 'Business link', context: 'header'}
      ],

      scoringRules: [
        {id: 'high_growth', name: 'High-Growth Company', description: 'Funding with large user base', condition: 'signals.some(s => s.signalId === "funding_announcement") && signals.some(s => s.signalId === "user_count")', scoreBoost: 50, priority: 1, enabled: true},
        {id: 'enterprise_ready', name: 'Enterprise Ready', description: 'Enterprise clients with LMS integration', condition: 'signals.some(s => s.signalId === "enterprise_clients") && signals.some(s => s.signalId === "lms_integration")', scoreBoost: 40, priority: 2, enabled: true},
        {id: 'growing_company', name: 'Growing Company', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'proven_outcomes', name: 'Proven Outcomes', description: 'Student outcomes with large catalog', condition: 'signals.some(s => s.signalId === "student_outcomes") && signals.some(s => s.signalId === "course_catalog")', scoreBoost: 35, priority: 4, enabled: true},
        {id: 'academic_credibility', name: 'Academic Credibility', description: 'Partnerships with certifications', condition: 'signals.some(s => s.signalId === "partnerships") && signals.some(s => s.signalId === "certifications")', scoreBoost: 30, priority: 5, enabled: true},
        {id: 'modern_platform', name: 'Modern Platform', description: 'Mobile app with adaptive learning', condition: 'signals.some(s => s.signalId === "mobile_app") && signals.some(s => s.signalId === "adaptive_learning")', scoreBoost: 28, priority: 6, enabled: true},
        {id: 'engagement_focused', name: 'Engagement-Focused', description: 'Gamification with live classes', condition: 'signals.some(s => s.signalId === "gamification") || signals.some(s => s.signalId === "live_classes")', scoreBoost: 20, priority: 7, enabled: true},
        {id: 'accessible', name: 'Accessible Platform', description: 'Free trial available', condition: 'signals.some(s => s.signalId === "free_trial")', scoreBoost: 15, priority: 8, enabled: true},
        {id: 'recognized', name: 'Industry Recognition', description: 'Awards with large user base', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "user_count")', scoreBoost: 30, priority: 9, enabled: true},
        {id: 'comprehensive', name: 'Comprehensive Platform', description: 'Large catalog with multiple learning modes', condition: 'signals.some(s => s.signalId === "course_catalog") && signals.filter(s => ["live_classes", "mobile_app", "adaptive_learning"].includes(s.signalId)).length >= 2', scoreBoost: 35, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'student_count', label: 'Number of Students/Users', type: 'number', description: 'Active learners', extractionHints: ['students', 'users', 'learners'], required: false, defaultValue: 0},
        {key: 'course_count', label: 'Number of Courses', type: 'number', description: 'Catalog size', extractionHints: ['courses', 'catalog'], required: false, defaultValue: 0},
        {key: 'offers_certifications', label: 'Offers Certifications', type: 'boolean', description: 'Certification programs', extractionHints: ['certification'], required: false, defaultValue: false},
        {key: 'has_mobile_app', label: 'Has Mobile App', type: 'boolean', description: 'Native mobile apps', extractionHints: ['mobile app', 'ios', 'android'], required: false, defaultValue: false},
        {key: 'target_audience', label: 'Target Audience', type: 'string', description: 'Primary learner type', extractionHints: ['k-12', 'higher ed', 'corporate', 'professional'], required: false, defaultValue: 'general'},
        {key: 'learning_model', label: 'Learning Model', type: 'string', description: 'Delivery format', extractionHints: ['self-paced', 'cohort', 'live', 'hybrid'], required: false, defaultValue: 'self-paced'},
        {key: 'specialization', label: 'Subject Specialization', type: 'string', description: 'Primary subject area', extractionHints: ['coding', 'languages', 'business', 'stem'], required: false, defaultValue: 'general'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'EdTech intelligence - focuses on user adoption, learning outcomes, course breadth, and enterprise readiness'
      }
    }
  },
  
  'ecommerce-d2c': {
    id: 'ecommerce-d2c',
    name: 'E-commerce (Direct to Consumer)',
    description: 'For online stores - conversion and social proof',
    category: 'Technology & Business Services',
    
    coreIdentity: {
      title: 'The Personal Shopper',
      positioning: 'Friendly, persuasive, and trend-aware',
      tone: 'Enthusiastic, helpful, engaging'
    },
    
    cognitiveLogic: {
      framework: 'The Social-Proof & Scarcity Model',
      reasoning: 'Logic that uses "Other people bought" and "Only 5 left" to drive immediate action',
      decisionProcess: 'Product Discovery → Social Validation → Urgency → Purchase'
    },
    
    knowledgeRAG: {
      static: [
        'Return policies and guarantees',
        'Shipping tiers and timelines',
        'Product categories and attributes',
        'Size charts and fit guides',
        'Payment security'
      ],
      dynamic: [
        'Real-time inventory levels',
        'Shopify/BigCommerce product data',
        'Current promo codes',
        'Customer reviews and ratings',
        'Trending products',
        'Personalized recommendations'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Analyzes "Cart Abandonment" questions (shipping costs, sizing concerns, product comparisons)',
      adaptation: 'Offers a personalized "One-Time Discount" or "Free Shipping" in real-time to recover sale',
      feedbackIntegration: 'Tracks which objections (price, shipping, returns) can be overcome with which offers'
    },
    
    tacticalExecution: {
      primaryAction: 'Add to Cart',
      conversionRhythm: 'Every conversation ends with a "Buy Now" link or a "Bundle & Save" suggestion',
      secondaryActions: [
        'Product comparison',
        'Size/fit consultation',
        'Reviews showcase',
        'Similar items recommendation',
        'Wishlist creation'
      ]
    },

    research: {
      scrapingStrategy: {primarySource: 'website', secondarySources: ['linkedin-jobs', 'crunchbase'], frequency: 'weekly', timeoutMs: 30000, enableCaching: true, cacheTtlSeconds: 600},
      highValueSignals: [
        {id: 'hiring', label: 'Hiring E-commerce Team', description: 'Growing team', keywords: ["hiring", "join our team", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'new_product_launch', label: 'Product Launch', description: 'New product releases', keywords: ["new", "launching", "just launched", "introducing"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'subscription_model', label: 'Subscription Service', description: 'Recurring revenue model', keywords: ["subscription", "monthly", "subscribe and save", "recurring"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'wholesale', label: 'Wholesale Program', description: 'B2B wholesale', keywords: ["wholesale", "bulk orders", "business", "reseller"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'free_shipping', label: 'Free Shipping', description: 'Free shipping offers', keywords: ["free shipping", "shipping included", "free delivery"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'reviews', label: 'Customer Reviews', description: 'Customer testimonials', keywords: ["reviews", "testimonials", "rated", "stars"], regexPattern: '(\\d+)\\+?\\s*(reviews?|ratings?)', priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'international_shipping', label: 'Ships Internationally', description: 'Global shipping', keywords: ["international", "worldwide", "global shipping"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'returns_policy', label: 'Easy Returns', description: 'Customer-friendly returns', keywords: ["free returns", "easy returns", "money back", "satisfaction guaranteed"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'sustainability', label: 'Sustainable/Eco-Friendly', description: 'Eco-conscious brand', keywords: ["sustainable", "eco-friendly", "organic", "recycled"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'mobile_app', label: 'Mobile App', description: 'Shopping app available', keywords: ["app", "download", "ios", "android"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'}
      ],
      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookies', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'newsletter', pattern: 'newsletter|subscribe', description: 'Newsletter', context: 'all'},
        {id: 'back_top', pattern: 'back to top', description: 'Back', context: 'footer'}
      ],
      scoringRules: [
        {id: 'subscription_business', name: 'Subscription Model', description: 'Recurring revenue + growing', condition: 'signals.some(s => s.signalId === "subscription_model") && signals.some(s => s.signalId === "hiring")', scoreBoost: 30, priority: 1, enabled: true},
        {id: 'b2b_expansion', name: 'B2B Expansion', description: 'Wholesale + international', condition: 'signals.some(s => s.signalId === "wholesale") && signals.some(s => s.signalId === "international_shipping")', scoreBoost: 20, priority: 2, enabled: true}
      ],
      customFields: [
        {key: 'review_count', label: 'Number of Reviews', type: 'number', description: 'Customer reviews', extractionHints: ['reviews', 'ratings'], required: false, defaultValue: 0},
        {key: 'has_subscription', label: 'Subscription Model', type: 'boolean', description: 'Recurring revenue', extractionHints: ['subscription', 'subscribe'], required: false, defaultValue: false},
        {key: 'product_categories', label: 'Product Categories', type: 'array', description: 'Types of products', extractionHints: ['shop', 'products', 'collections'], required: false, defaultValue: []}
      ],
      metadata: {lastUpdated: '2025-12-28', version: 1, updatedBy: 'system', notes: 'E-commerce intelligence - growth, business model, customer satisfaction'}
    }
  },
  
  'biotech': {
    id: 'biotech',
    name: 'BioTech',
    description: 'For biotech - research rigor and commercialization',
    category: 'Technology & Business Services',
    
    coreIdentity: {
      title: 'The Scientific Pioneer',
      positioning: 'Rigorous, intellectual, and visionary',
      tone: 'Scientific, authoritative, forward-looking'
    },
    
    cognitiveLogic: {
      framework: 'The Research-to-Commercialization Path',
      reasoning: 'Focuses on "Efficacy Data" and "Clinical Milestones" rather than marketing promises',
      decisionProcess: 'Scientific Validation → Commercial Viability → Partnership/Investment'
    },
    
    knowledgeRAG: {
      static: [
        'FDA approval phases (I, II, III)',
        'IP/Patent basics',
        'Clinical trial design',
        'Regulatory pathways',
        'GMP standards'
      ],
      dynamic: [
        'Published whitepapers and research',
        'Trial results and data',
        'Investor relations materials',
        'Pipeline and milestones',
        'Partnership opportunities',
        'Technology platform details'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Identifies "Technical Skepticism" from high-level researchers/investors',
      adaptation: 'Triggers a "Deep-Dive Data" module with detailed methodology, statistical analysis, and peer review',
      feedbackIntegration: 'Learns which evidence types (preclinical data, clinical outcomes, safety profiles) build credibility'
    },
    
    tacticalExecution: {
      primaryAction: 'Partner Briefing',
      conversionRhythm: 'Moves the lead toward a "Technical Review," "Data Access Request," or "Investor Presentation"',
      secondaryActions: [
        'Whitepaper download',
        'Clinical data review',
        'Technology platform overview',
        'IP portfolio discussion',
        'Partnership inquiry form'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['linkedin-company', 'news', 'crunchbase'],
        frequency: 'weekly',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 600
      },

      highValueSignals: [
        {id: 'funding_round', label: 'Funding Announcement', description: 'Recent capital raise', keywords: ["raised", "funding", "series", "seed", "million", "billion", "investment"], regexPattern: '\\$(\\d+)\\s*(million|billion)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 50, platform: 'any'},
        {id: 'clinical_trial', label: 'Clinical Trial', description: 'Active or completed trials', keywords: ["clinical trial", "phase i", "phase ii", "phase iii", "trial results"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 45, platform: 'website'},
        {id: 'fda_approval', label: 'FDA Approval/Clearance', description: 'Regulatory approval', keywords: ["fda approved", "fda cleared", "510k", "fda clearance"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 50, platform: 'website'},
        {id: 'patent_portfolio', label: 'Patent Portfolio', description: 'Intellectual property', keywords: ["patent", "patented", "ip portfolio", "intellectual property"], regexPattern: '(\\d+)\\s*patents?', priority: 'HIGH', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'publications', label: 'Scientific Publications', description: 'Peer-reviewed research', keywords: ["published", "peer-reviewed", "nature", "science", "cell", "publication"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'hiring', label: 'Hiring Scientists/Engineers', description: 'Growing research team', keywords: ["hiring", "scientist positions", "phd", "research positions", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 35, platform: 'any'},
        {id: 'partnerships', label: 'Strategic Partnerships', description: 'Pharma or academic partners', keywords: ["partnership", "collaboration", "strategic alliance", "agreement"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'pipeline', label: 'Product Pipeline', description: 'Multiple products in development', keywords: ["pipeline", "portfolio", "candidates", "programs"], regexPattern: '(\\d+)\\s*(candidates?|programs?)', priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'website'},
        {id: 'manufacturing', label: 'Manufacturing Capability', description: 'Production facilities', keywords: ["manufacturing", "production", "gmp", "facility"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'rare_disease', label: 'Rare Disease Focus', description: 'Orphan drug designation', keywords: ["rare disease", "orphan drug", "ultra-rare", "unmet need"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'gene_therapy', label: 'Gene Therapy', description: 'Gene editing platform', keywords: ["gene therapy", "crispr", "gene editing", "car-t"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'diagnostic', label: 'Diagnostics', description: 'Diagnostic platform', keywords: ["diagnostic", "test", "assay", "detection"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'ipo_plans', label: 'IPO or Acquisition', description: 'Exit strategy signaled', keywords: ["ipo", "going public", "acquisition", "nasdaq"], priority: 'CRITICAL', action: 'flag-for-review', scoreBoost: 40, platform: 'any'},
        {id: 'regulatory_milestone', label: 'Regulatory Milestone', description: 'Recent regulatory achievement', keywords: ["breakthrough designation", "fast track", "accelerated approval", "orphan designation"], priority: 'HIGH', action: 'increase-score', scoreBoost: 35, platform: 'any'},
        {id: 'research_team', label: 'Large Research Team', description: 'Significant R&D staff', keywords: ["scientists", "researchers", "phd"], regexPattern: '(\\d+)\\+?\\s*(scientists?|researchers?|phds?)', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'forward_looking', pattern: 'forward-looking statements', description: 'Legal disclaimer', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About', context: 'header'},
        {id: 'pipeline', pattern: '^pipeline$', description: 'Pipeline', context: 'header'},
        {id: 'science', pattern: '^science$', description: 'Science link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'news', pattern: '^news$', description: 'News', context: 'header'},
        {id: 'investors', pattern: '^investors$', description: 'Investors', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'publications', pattern: '^publications$', description: 'Publications', context: 'header'},
        {id: 'partners', pattern: '^partners$', description: 'Partners', context: 'header'},
        {id: 'team', pattern: '^team$', description: 'Team', context: 'header'}
      ],

      scoringRules: [
        {id: 'clinical_stage', name: 'Clinical Stage Company', description: 'Clinical trials with funding', condition: 'signals.some(s => s.signalId === "clinical_trial") && signals.some(s => s.signalId === "funding_round")', scoreBoost: 60, priority: 1, enabled: true},
        {id: 'fda_approved_product', name: 'FDA-Approved Product', description: 'Approved therapy', condition: 'signals.some(s => s.signalId === "fda_approval")', scoreBoost: 50, priority: 2, enabled: true},
        {id: 'well_funded', name: 'Well-Funded Company', description: 'Recent funding with hiring', condition: 'signals.some(s => s.signalId === "funding_round") && signals.some(s => s.signalId === "hiring")', scoreBoost: 45, priority: 3, enabled: true},
        {id: 'strong_ip', name: 'Strong IP Position', description: 'Patent portfolio with publications', condition: 'signals.some(s => s.signalId === "patent_portfolio") && signals.some(s => s.signalId === "publications")', scoreBoost: 40, priority: 4, enabled: true},
        {id: 'strategic_partnerships', name: 'Strategic Partnerships', description: 'Partnerships with pipeline', condition: 'signals.some(s => s.signalId === "partnerships") && signals.some(s => s.signalId === "pipeline")', scoreBoost: 35, priority: 5, enabled: true},
        {id: 'exit_potential', name: 'Exit Potential', description: 'IPO plans or acquisition interest', condition: 'signals.some(s => s.signalId === "ipo_plans")', scoreBoost: 50, priority: 6, enabled: true},
        {id: 'regulatory_success', name: 'Regulatory Success', description: 'FDA milestone achieved', condition: 'signals.some(s => s.signalId === "regulatory_milestone")', scoreBoost: 40, priority: 7, enabled: true},
        {id: 'manufacturing_ready', name: 'Manufacturing Ready', description: 'Production capability with FDA approval', condition: 'signals.some(s => s.signalId === "manufacturing") && signals.some(s => s.signalId === "fda_approval")', scoreBoost: 45, priority: 8, enabled: true},
        {id: 'innovative_platform', name: 'Innovative Platform', description: 'Novel technology approach', condition: 'signals.some(s => s.signalId === "gene_therapy") || signals.some(s => s.signalId === "rare_disease")', scoreBoost: 30, priority: 9, enabled: true},
        {id: 'scale_ready', name: 'Scale Ready', description: 'Large research team with manufacturing', condition: 'signals.some(s => s.signalId === "research_team") && signals.some(s => s.signalId === "manufacturing")', scoreBoost: 35, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'development_stage', label: 'Development Stage', type: 'string', description: 'Company stage', extractionHints: ['preclinical', 'phase i', 'phase ii', 'commercial'], required: false, defaultValue: 'preclinical'},
        {key: 'patent_count', label: 'Number of Patents', type: 'number', description: 'Patent portfolio size', extractionHints: ['patents'], required: false, defaultValue: 0},
        {key: 'has_fda_approval', label: 'Has FDA Approval', type: 'boolean', description: 'Any approved products', extractionHints: ['fda approved', 'fda cleared'], required: false, defaultValue: false},
        {key: 'therapeutic_areas', label: 'Therapeutic Areas', type: 'array', description: 'Disease focus areas', extractionHints: ['oncology', 'neurology', 'rare disease'], required: false, defaultValue: []},
        {key: 'funding_amount', label: 'Last Funding Amount', type: 'string', description: 'Recent raise size', extractionHints: ['million', 'raised', 'funding'], required: false, defaultValue: 'unknown'},
        {key: 'employee_count', label: 'Employee Count', type: 'number', description: 'Company size', extractionHints: ['employees', 'team'], required: false, defaultValue: 0},
        {key: 'has_manufacturing', label: 'Has Manufacturing', type: 'boolean', description: 'Production facilities', extractionHints: ['manufacturing', 'gmp'], required: false, defaultValue: false}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'BioTech intelligence - focuses on clinical progress, funding, regulatory milestones, IP strength, and commercialization readiness'
      }
    }
  },
  
  // ============================================
};
