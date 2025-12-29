import type { IndustryTemplate } from './types';

export const healthcareTemplates3: Record<string, IndustryTemplate> = {
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
