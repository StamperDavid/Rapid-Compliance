import 'server-only';
import type { IndustryTemplate } from './types';

export const realEstateTemplates: Record<string, IndustryTemplate> = {
  // REAL ESTATE SECTOR (Templates 1-5)
  // ============================================
  
  'residential-real-estate': {
    id: 'residential-real-estate',
    name: 'Residential Real Estate',
    description: 'For agents selling homes - emotional + financial approach',
    category: 'Real Estate',
    
    coreIdentity: {
      title: 'The High-Status Neighborhood Authority',
      positioning: 'Professional, protective of equity, and hyper-local',
      tone: 'Confident authority with protective advisor undertones'
    },
    
    cognitiveLogic: {
      framework: 'The Lifestyle-to-Asset Pivot',
      reasoning: 'Logic that connects emotional desires (e.g., "big yard") to financial security (e.g., "high-resale zip code")',
      decisionProcess: 'Emotion → Financial Validation → Action'
    },
    
    knowledgeRAG: {
      static: [
        'Escrow milestones',
        'Zoning basics',
        'Fair Housing laws',
        'Standard contract terms',
        'Inspection protocols'
      ],
      dynamic: [
        'MLS listings (real-time)',
        'School ratings',
        'Neighborhood trends',
        'Client\'s "Sold" history',
        'Comparable sales data',
        'Interest rate updates'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Identifies "Feature Trends" (e.g., high demand for home offices, outdoor spaces, smart home tech)',
      adaptation: 'Alerts client to update marketing copy to reflect current trends and buyer preferences',
      feedbackIntegration: 'Tracks which property features drive most viewings and adjusts emphasis accordingly'
    },
    
    tacticalExecution: {
      primaryAction: 'Tour Booking',
      conversionRhythm: 'Every 3rd message pushes for a physical viewing or custom "Market Report" for their specific zip code',
      secondaryActions: [
        'Custom zip code Market Report',
        'Comparative Market Analysis (CMA)',
        'Pre-approval referral',
        'Home valuation request'
      ]
    },

    research: {
      scrapingStrategy: {
        primarySource: 'website',
        secondarySources: ['linkedin-company', 'google-business'],
        frequency: 'per-lead',
        timeoutMs: 30000,
        enableCaching: true,
        cacheTtlSeconds: 300
      },

      highValueSignals: [
        {id: 'hiring_agents', label: 'Hiring Real Estate Agents', description: 'Recruiting new agents', keywords: ["hiring agents", "join our team", "agent positions", "real estate careers", "agent recruitment"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'top_producer', label: 'Top Producer', description: 'High sales volume or awards', keywords: ["top producer", "top agent", "million dollar", "sales leader", "award winning"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'new_listings', label: 'New Listings', description: 'Recently added properties', keywords: ["new listing", "just listed", "coming soon", "recently added"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'luxury_homes', label: 'Luxury Market', description: 'Specializes in luxury real estate', keywords: ["luxury homes", "luxury real estate", "high-end", "estates", "million dollar homes"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'first_time_buyers', label: 'First-Time Buyers', description: 'Focuses on first-time homebuyers', keywords: ["first time", "first-time buyers", "first home", "buyer assistance"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'virtual_tours', label: 'Virtual Tours', description: 'Offers 3D or virtual property tours', keywords: ["virtual tour", "3d tour", "matterport", "video walkthrough"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'buyer_representation', label: 'Buyer Representation', description: 'Represents buyers', keywords: ["buyer agent", "buyer representation", "helping buyers", "buyer services"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'seller_representation', label: 'Seller Representation', description: 'Represents sellers', keywords: ["listing agent", "seller representation", "selling your home", "list your property"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 10, platform: 'website'},
        {id: 'relocation_specialist', label: 'Relocation Services', description: 'Assists with relocations', keywords: ["relocation", "moving to", "relocating", "corporate relocation"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 8, platform: 'website'},
        {id: 'investment_properties', label: 'Investment Properties', description: 'Specializes in investment real estate', keywords: ["investment properties", "rental properties", "fix and flip", "investor friendly"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'team_size', label: 'Large Team', description: 'Multiple agents on team', keywords: ["team of", "agents", "real estate team"], regexPattern: '(\\d+)\\s*(agents?|realtors?)', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'areas_served', label: 'Multiple Service Areas', description: 'Serves multiple cities/neighborhoods', keywords: ["serving", "areas served", "neighborhoods", "communities"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'years_experience', label: 'Experience Level', description: 'Years in real estate', keywords: ["years of experience", "since", "established"], regexPattern: '(\\d+)\\+?\\s*years?', priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'certifications', label: 'Professional Designations', description: 'Has certifications (CRS, ABR, etc)', keywords: ["crs", "abr", "gri", "srs", "certified", "accredited"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'sold_count', label: 'Sales Volume', description: 'Number of homes sold', keywords: ["homes sold", "sales", "transactions"], regexPattern: '(\\d+)\\s*(homes?|properties)\\s*sold', priority: 'HIGH', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'mls_access', label: 'MLS Access', description: 'Has MLS search capability', keywords: ["mls", "multiple listing", "search homes", "property search"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'market_reports', label: 'Market Reports', description: 'Provides market analysis', keywords: ["market report", "market analysis", "market trends", "neighborhood stats"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'},
        {id: 'home_valuation', label: 'Home Valuation Tool', description: 'Offers property valuation', keywords: ["home value", "property valuation", "what\'s my home worth", "cma"], priority: 'LOW', action: 'increase-score', scoreBoost: 5, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright notices', context: 'footer'},
        {id: 'all_rights', pattern: 'all rights reserved', description: 'Rights statement', context: 'footer'},
        {id: 'equal_housing', pattern: 'equal housing opportunity', description: 'Fair housing logo', context: 'footer'},
        {id: 'realtor_logo', pattern: 'realtor®|realtors®', description: 'REALTOR trademark', context: 'all'},
        {id: 'mls_disclaimer', pattern: 'mls.*disclaimer|data.*deemed reliable', description: 'MLS disclaimers', context: 'footer'},
        {id: 'privacy_policy', pattern: 'privacy policy', description: 'Privacy link', context: 'footer'},
        {id: 'terms', pattern: 'terms (of use|and conditions)', description: 'Terms link', context: 'footer'},
        {id: 'cookie_notice', pattern: 'we use cookies', description: 'Cookie banner', context: 'all'},
        {id: 'social_media', pattern: 'follow (us|me) on', description: 'Social links', context: 'footer'},
        {id: 'contact_us', pattern: '^contact( us)?$', description: 'Contact link', context: 'header'},
        {id: 'about_us', pattern: '^about( us| me)?$', description: 'About link', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$|^reviews$', description: 'Testimonials link', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog link', context: 'header'},
        {id: 'search_homes', pattern: '^search homes$|^listings$', description: 'Search link', context: 'header'},
        {id: 'back_to_top', pattern: 'back to top', description: 'Back to top link', context: 'footer'},
        {id: 'site_map', pattern: 'site ?map', description: 'Sitemap link', context: 'footer'},
        {id: 'accessibility', pattern: 'accessibility', description: 'Accessibility link', context: 'footer'},
        {id: 'dmca', pattern: 'dmca', description: 'DMCA notice', context: 'footer'},
        {id: 'idx_disclaimer', pattern: 'idx|internet data exchange', description: 'IDX disclaimer', context: 'footer'},
        {id: 'powered_by', pattern: 'powered by|website by', description: 'Attribution', context: 'footer'}
      ],

      scoringRules: [
        {id: 'top_producer_hiring', name: 'Growing Top Team', description: 'Top producer hiring agents', condition: 'signals.some(s => s.signalId === "top_producer") && signals.some(s => s.signalId === "hiring_agents")', scoreBoost: 25, priority: 1, enabled: true},
        {id: 'luxury_investment', name: 'Luxury & Investment', description: 'Serves luxury and investment markets', condition: 'signals.some(s => s.signalId === "luxury_homes") && signals.some(s => s.signalId === "investment_properties")', scoreBoost: 20, priority: 2, enabled: true},
        {id: 'full_service_agent', name: 'Full Service', description: 'Represents both buyers and sellers', condition: 'signals.some(s => s.signalId === "buyer_representation") && signals.some(s => s.signalId === "seller_representation")', scoreBoost: 15, priority: 3, enabled: true},
        {id: 'tech_forward', name: 'Tech-Forward Agent', description: 'Uses virtual tours and modern tools', condition: 'signals.some(s => s.signalId === "virtual_tours") && signals.some(s => s.signalId === "mls_access")', scoreBoost: 10, priority: 4, enabled: true},
        {id: 'established_team', name: 'Established Team', description: 'Large team with experience', condition: 'signals.some(s => s.signalId === "team_size") && signals.some(s => s.signalId === "years_experience")', scoreBoost: 15, priority: 5, enabled: true},
        {id: 'high_volume', name: 'High Volume Producer', description: 'High sales count with multiple areas', condition: 'signals.some(s => s.signalId === "sold_count") && signals.some(s => s.signalId === "areas_served")', scoreBoost: 20, priority: 6, enabled: true},
        {id: 'certified_professional', name: 'Certified Professional', description: 'Has certifications and experience', condition: 'signals.some(s => s.signalId === "certifications") && signals.some(s => s.signalId === "years_experience")', scoreBoost: 10, priority: 7, enabled: true}
      ],

      customFields: [
        {key: 'team_size', label: 'Number of Agents', type: 'number', description: 'Size of agent team', extractionHints: ['agents', 'team of', 'realtors'], required: false, defaultValue: 1},
        {key: 'areas_served', label: 'Service Areas', type: 'array', description: 'Cities/neighborhoods served', extractionHints: ['serving', 'areas', 'neighborhoods'], required: false, defaultValue: []},
        {key: 'years_experience', label: 'Years in Business', type: 'number', description: 'Years of experience', extractionHints: ['years', 'since', 'established'], required: false, defaultValue: 0},
        {key: 'specialization', label: 'Market Specialization', type: 'string', description: 'Luxury, first-time, investment, etc', extractionHints: ['specialize', 'focus', 'expert in'], required: false, defaultValue: 'general'},
        {key: 'homes_sold_annual', label: 'Annual Sales Volume', type: 'number', description: 'Homes sold per year', extractionHints: ['homes sold', 'transactions', 'sales'], required: false, defaultValue: 0},
        {key: 'has_virtual_tours', label: 'Offers Virtual Tours', type: 'boolean', description: 'Whether 3D/virtual tours available', extractionHints: ['virtual', '3d tour', 'matterport'], required: false, defaultValue: false},
        {key: 'certifications', label: 'Professional Certifications', type: 'array', description: 'CRS, ABR, GRI, etc', extractionHints: ['certified', 'designation', 'accredited'], required: false, defaultValue: []},
        {key: 'buyer_or_seller', label: 'Buyer/Seller Focus', type: 'string', description: 'Buyer, seller, or both', extractionHints: ['buyer agent', 'listing agent', 'both'], required: false, defaultValue: 'both'}
      ],

      metadata: {
        lastUpdated: '2025-12-28',
        version: 1,
        updatedBy: 'system',
        notes: 'Residential real estate intelligence - focuses on team growth, sales volume, market specialization, and tech capabilities'
      }
    }
  },
  
  'commercial-real-estate': {
    id: 'commercial-real-estate',
    name: 'Commercial Property',
    description: 'For commercial brokers - data-driven investment focus',
    category: 'Real Estate',
    
    coreIdentity: {
      title: 'The Strategic Asset Advisor',
      positioning: 'Data-obsessed, efficient, and objective. Minimalist "no-fluff" communication',
      tone: 'Analytical, sophisticated, financial metric vocabulary'
    },
    
    cognitiveLogic: {
      framework: 'The Yield-First Model',
      reasoning: 'Logic that filters every query through Cap Rates, Cash-on-Cash Return, and NOI (Net Operating Income)',
      decisionProcess: 'Financial Metrics → Strategic Fit → Exclusivity Hook'
    },
    
    knowledgeRAG: {
      static: [
        'NNN (Triple Net) lease structures',
        '1031 Exchange rules',
        'Cap Rate calculations',
        'NOI formulas',
        'Zoning classifications',
        'Commercial lease terms'
      ],
      dynamic: [
        'Current market Cap Rates',
        'Rent rolls',
        'Vacancy rates',
        'Industrial zoning data',
        'Offering Memorandums (OMs)',
        'Market absorption rates'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks lead preference for "Value-Add" vs. "Core" assets based on risk tolerance and investment horizon',
      adaptation: 'Automatically re-weights the agent\'s property recommendations based on investor profile (income vs appreciation focus)',
      feedbackIntegration: 'Learns which financial metrics (Cap Rate, IRR, Cash-on-Cash) resonate most with each investor type'
    },
    
    tacticalExecution: {
      primaryAction: 'NDA/OM Request',
      conversionRhythm: 'Focuses on moving the lead to the "Financial Disclosure" phase as the primary conversion milestone',
      secondaryActions: [
        'Schedule site tour',
        'Request Offering Memorandum',
        'Zoning feasibility analysis',
        '1031 Exchange consultation',
        'Tenant credit analysis'
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
        {id: 'active_listings', label: 'Active Commercial Listings', description: 'Has available properties', keywords: ["for sale", "for lease", "available", "listing", "commercial property"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'portfolio_size', label: 'Large Portfolio', description: 'Manages many properties', keywords: ["portfolio", "properties managed", "square feet"], regexPattern: '([\\d,]+)\\s*(sf|square feet|properties)', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'tenant_representation', label: 'Tenant Rep Services', description: 'Represents tenants', keywords: ["tenant representation", "tenant rep", "helping tenants", "lease negotiation"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'landlord_representation', label: 'Landlord Rep', description: 'Represents property owners', keywords: ["landlord representation", "property owner", "leasing services", "asset management"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'investment_sales', label: 'Investment Sales', description: 'Specializes in sales transactions', keywords: ["investment sales", "acquisition", "disposition", "cap rate", "roi"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'property_types', label: 'Multi-Property Type', description: 'Handles multiple asset classes', keywords: ["office", "retail", "industrial", "multifamily", "mixed-use"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'market_reports', label: 'Market Analytics', description: 'Provides market research', keywords: ["market report", "market analysis", "trends", "vacancy rate", "absorption"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'site_selection', label: 'Site Selection Services', description: 'Helps with location strategy', keywords: ["site selection", "location strategy", "demographics", "traffic counts"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: '1031_exchange', label: '1031 Exchange Expertise', description: 'Facilitates tax-deferred exchanges', keywords: ["1031 exchange", "tax-deferred", "like-kind exchange"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'nnn_lease', label: 'Triple Net Lease', description: 'NNN lease specialization', keywords: ["triple net", "nnn lease", "net lease", "absolute net"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'build_to_suit', label: 'Build-to-Suit', description: 'Custom construction services', keywords: ["build to suit", "ground lease", "development"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'property_valuation', label: 'Valuation Services', description: 'Appraisal and valuation', keywords: ["valuation", "appraisal", "property value", "market value"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'hiring', label: 'Hiring Brokers', description: 'Growing team', keywords: ["hiring", "join our team", "careers", "broker positions"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'awards', label: 'Industry Recognition', description: 'Awards or top broker status', keywords: ["top broker", "award", "costar", "dealmaker"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'recent_transactions', label: 'Recent Deals', description: 'Recently closed transactions', keywords: ["just sold", "recently sold", "closed", "transaction"], priority: 'HIGH', action: 'increase-score', scoreBoost: 20, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright notices', context: 'footer'},
        {id: 'all_rights', pattern: 'all rights reserved', description: 'Rights statement', context: 'footer'},
        {id: 'equal_housing', pattern: 'equal (housing|opportunity)', description: 'Fair housing', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy link', context: 'footer'},
        {id: 'terms', pattern: 'terms (of use|and conditions)', description: 'Terms link', context: 'footer'},
        {id: 'cookie', pattern: 'we use cookies', description: 'Cookie banner', context: 'all'},
        {id: 'disclaimer', pattern: 'disclaimer|information deemed reliable', description: 'Legal disclaimer', context: 'footer'},
        {id: 'social', pattern: 'follow (us|me)', description: 'Social links', context: 'footer'},
        {id: 'contact', pattern: '^contact( us)?$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about( us)?$', description: 'About link', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services link', context: 'header'},
        {id: 'team', pattern: '^(our )?team$', description: 'Team link', context: 'header'},
        {id: 'listings', pattern: '^listings$|^properties$', description: 'Listings link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'site ?map', description: 'Sitemap', context: 'footer'},
        {id: 'accessibility', pattern: 'accessibility', description: 'Accessibility', context: 'footer'},
        {id: 'powered_by', pattern: 'powered by|website by', description: 'Attribution', context: 'footer'},
        {id: 'login', pattern: '^(client )?login$', description: 'Login link', context: 'header'},
        {id: 'search', pattern: '^search$', description: 'Search', context: 'header'},
        {id: 'news', pattern: '^news$|^blog$', description: 'News/blog link', context: 'header'}
      ],

      scoringRules: [
        {id: 'full_service', name: 'Full-Service Firm', description: 'Offers both tenant and landlord rep', condition: 'signals.some(s => s.signalId === "tenant_representation") && signals.some(s => s.signalId === "landlord_representation")', scoreBoost: 20, priority: 1, enabled: true},
        {id: 'investment_specialist', name: 'Investment Specialist', description: 'Investment sales with 1031 exchange', condition: 'signals.some(s => s.signalId === "investment_sales") && signals.some(s => s.signalId === "1031_exchange")', scoreBoost: 25, priority: 2, enabled: true},
        {id: 'growing_firm', name: 'Growing Firm', description: 'Hiring with recent transactions', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "recent_transactions")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'diversified_portfolio', name: 'Diversified', description: 'Multiple property types', condition: 'signals.some(s => s.signalId === "property_types")', scoreBoost: 15, priority: 4, enabled: true},
        {id: 'development_capable', name: 'Development Services', description: 'Build-to-suit and site selection', condition: 'signals.some(s => s.signalId === "build_to_suit") && signals.some(s => s.signalId === "site_selection")', scoreBoost: 20, priority: 5, enabled: true},
        {id: 'market_leader', name: 'Market Leader', description: 'Awards with large portfolio', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "portfolio_size")', scoreBoost: 25, priority: 6, enabled: true},
        {id: 'data_driven', name: 'Analytics-Focused', description: 'Provides market reports and valuations', condition: 'signals.some(s => s.signalId === "market_reports") && signals.some(s => s.signalId === "property_valuation")', scoreBoost: 15, priority: 7, enabled: true},
        {id: 'active_pipeline', name: 'Active Pipeline', description: 'Has listings and recent deals', condition: 'signals.some(s => s.signalId === "active_listings") && signals.some(s => s.signalId === "recent_transactions")', scoreBoost: 20, priority: 8, enabled: true},
        {id: 'specialist_knowledge', name: 'NNN Specialist', description: 'NNN lease expert with investment sales', condition: 'signals.some(s => s.signalId === "nnn_lease") && signals.some(s => s.signalId === "investment_sales")', scoreBoost: 18, priority: 9, enabled: true},
        {id: 'comprehensive_services', name: 'Comprehensive', description: 'Multiple services offered', condition: 'signals.filter(s => ["tenant_representation", "landlord_representation", "investment_sales", "site_selection"].includes(s.signalId)).length >= 3', scoreBoost: 25, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'portfolio_square_feet', label: 'Portfolio Size (SF)', type: 'number', description: 'Total square footage managed', extractionHints: ['square feet', 'sf', 'portfolio'], required: false, defaultValue: 0},
        {key: 'property_types_served', label: 'Property Types', type: 'array', description: 'Asset classes handled', extractionHints: ['office', 'retail', 'industrial', 'multifamily'], required: false, defaultValue: []},
        {key: 'service_areas', label: 'Markets Served', type: 'array', description: 'Geographic markets', extractionHints: ['serving', 'markets', 'cities'], required: false, defaultValue: []},
        {key: 'specialization', label: 'Primary Specialization', type: 'string', description: 'Main service focus', extractionHints: ['specialize', 'focus', 'expert in'], required: false, defaultValue: 'general'},
        {key: 'broker_count', label: 'Number of Brokers', type: 'number', description: 'Team size', extractionHints: ['brokers', 'team', 'professionals'], required: false, defaultValue: 1},
        {key: 'has_1031_services', label: 'Offers 1031 Exchange', type: 'boolean', description: 'Whether 1031 exchange available', extractionHints: ['1031', 'exchange', 'tax-deferred'], required: false, defaultValue: false},
        {key: 'years_in_business', label: 'Years Established', type: 'number', description: 'Years in operation', extractionHints: ['years', 'since', 'established'], required: false, defaultValue: 0},
        {key: 'avg_transaction_size', label: 'Average Deal Size', type: 'string', description: 'Typical transaction value', extractionHints: ['million', 'average', 'transaction'], required: false, defaultValue: 'unknown'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Commercial real estate intelligence - focuses on portfolio size, transaction types, property specialization, and service breadth'
      }
    }
  },
  
  'property-management': {
    id: 'property-management',
    name: 'Property Management',
    description: 'For property managers - stress relief and systems focus',
    category: 'Real Estate',
    
    coreIdentity: {
      title: 'The Shield & Maximizer',
      positioning: 'Diligent, risk-averse, and highly organized. Framed as a "fiduciary for your free time"',
      tone: 'Protective, systematic, detail-oriented'
    },
    
    cognitiveLogic: {
      framework: 'The Stress-Relief Framework',
      reasoning: 'Logic that identifies landlord "headaches" (maintenance calls, late rent, tenant turnover) and counters them with "Systems"',
      decisionProcess: 'Pain Point → System Solution → Time Liberation'
    },
    
    knowledgeRAG: {
      static: [
        'Fair Housing Act compliance',
        'Eviction protocols by state',
        'Landlord-tenant law',
        'Security deposit regulations',
        'Lease agreement standards'
      ],
      dynamic: [
        'Management fee structures',
        'Tenant vetting criteria',
        'Local vendor lists (plumbers, electricians)',
        'Rental market rates',
        'Maintenance request logs',
        'Tenant payment history'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Flags common tenant complaints (HVAC issues, plumbing) to suggest proactive maintenance schedules',
      adaptation: 'Alerts owner to preventive maintenance opportunities, reducing long-term churn and emergency costs',
      feedbackIntegration: 'Tracks seasonal maintenance patterns (e.g., AC failures in summer) and proactively schedules service'
    },
    
    tacticalExecution: {
      primaryAction: 'Rental Analysis Request',
      conversionRhythm: 'Offers a free "Profit Optimization" report to capture the landlord\'s contact info and demonstrate value',
      secondaryActions: [
        'Property inspection scheduling',
        'Tenant placement guarantee details',
        'Maintenance coordination demo',
        'Rent collection system walkthrough',
        'Financial reporting sample'
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
        {id: 'units_managed', label: 'Large Portfolio', description: 'High unit count', keywords: ["units managed", "properties managed", "doors"], regexPattern: '([\\d,]+)\\s*(units?|doors?|properties)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'hiring', label: 'Hiring Staff', description: 'Growing team', keywords: ["hiring", "join our team", "careers", "now hiring"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'maintenance_team', label: 'In-House Maintenance', description: 'Own maintenance crew', keywords: ["maintenance team", "in-house maintenance", "24/7 maintenance", "emergency maintenance"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'tenant_portal', label: 'Online Tenant Portal', description: 'Digital tenant access', keywords: ["tenant portal", "online portal", "pay rent online", "maintenance request online"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'financial_reporting', label: 'Owner Reporting', description: 'Financial reporting system', keywords: ["owner reporting", "financial reports", "monthly statements", "profit and loss"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'tenant_screening', label: 'Tenant Screening', description: 'Background checks', keywords: ["tenant screening", "background check", "credit check", "tenant vetting"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'rent_collection', label: 'Rent Collection', description: 'Collection services', keywords: ["rent collection", "guaranteed rent", "rent payment", "late fees"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'eviction_services', label: 'Eviction Assistance', description: 'Legal eviction support', keywords: ["eviction", "legal services", "tenant removal", "eviction process"], priority: 'LOW', action: 'add-to-segment', scoreBoost: 8, platform: 'website'},
        {id: 'property_types', label: 'Multiple Property Types', description: 'Diverse portfolio', keywords: ["residential", "commercial", "multifamily", "single family"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'leasing_services', label: 'Full Leasing', description: 'Complete leasing service', keywords: ["leasing", "tenant placement", "marketing", "showings"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'hoa_management', label: 'HOA Management', description: 'Homeowner association services', keywords: ["hoa", "homeowner association", "condo association", "community management"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'vacancy_guarantee', label: 'Vacancy Guarantee', description: 'Rent guarantee program', keywords: ["vacancy guarantee", "guaranteed rent", "rent insurance"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'expansion', label: 'Market Expansion', description: 'New markets or locations', keywords: ["expanding", "new office", "now serving", "new market"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'certifications', label: 'Professional Certifications', description: 'Industry credentials', keywords: ["cpm", "arm", "narpm", "certified"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'software_platform', label: 'PM Software', description: 'Uses modern PM software', keywords: ["appfolio", "buildium", "propertyware", "rent manager"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'equal_housing', pattern: 'equal housing', description: 'Fair housing', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms (of|and)', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social media', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'properties', pattern: '^properties$', description: 'Properties', context: 'header'},
        {id: 'owners', pattern: '^owners$', description: 'Owners link', context: 'header'},
        {id: 'tenants', pattern: '^tenants$', description: 'Tenants link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'login', pattern: 'login', description: 'Login', context: 'header'},
        {id: 'portal', pattern: 'portal', description: 'Portal link', context: 'header'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'}
      ],

      scoringRules: [
        {id: 'large_operator', name: 'Large Operator', description: 'High unit count', condition: 'signals.some(s => s.signalId === "units_managed")', scoreBoost: 25, priority: 1, enabled: true},
        {id: 'full_service', name: 'Full Service PM', description: 'Maintenance and tenant portal', condition: 'signals.some(s => s.signalId === "maintenance_team") && signals.some(s => s.signalId === "tenant_portal")', scoreBoost: 20, priority: 2, enabled: true},
        {id: 'growing_company', name: 'Growing', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 30, priority: 3, enabled: true},
        {id: 'tech_enabled', name: 'Technology-Forward', description: 'Portal and PM software', condition: 'signals.some(s => s.signalId === "tenant_portal") && signals.some(s => s.signalId === "software_platform")', scoreBoost: 15, priority: 4, enabled: true},
        {id: 'professional', name: 'Professional PM', description: 'Certifications and experience', condition: 'signals.some(s => s.signalId === "certifications")', scoreBoost: 10, priority: 5, enabled: true},
        {id: 'comprehensive', name: 'Comprehensive Services', description: 'Multiple core services', condition: 'signals.filter(s => ["maintenance_team", "tenant_screening", "rent_collection", "leasing_services"].includes(s.signalId)).length >= 3', scoreBoost: 20, priority: 6, enabled: true},
        {id: 'guaranteed_income', name: 'Income Guarantee', description: 'Vacancy guarantee with rent collection', condition: 'signals.some(s => s.signalId === "vacancy_guarantee") && signals.some(s => s.signalId === "rent_collection")', scoreBoost: 18, priority: 7, enabled: true},
        {id: 'diversified', name: 'Diversified Portfolio', description: 'Multiple property types', condition: 'signals.some(s => s.signalId === "property_types")', scoreBoost: 15, priority: 8, enabled: true},
        {id: 'hoa_specialist', name: 'HOA Specialist', description: 'HOA management with multiple properties', condition: 'signals.some(s => s.signalId === "hoa_management") && signals.some(s => s.signalId === "units_managed")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'transparent', name: 'Transparent Reporting', description: 'Financial reporting with portal access', condition: 'signals.some(s => s.signalId === "financial_reporting") && signals.some(s => s.signalId === "tenant_portal")', scoreBoost: 12, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'units_managed', label: 'Units/Doors Managed', type: 'number', description: 'Total units under management', extractionHints: ['units', 'doors', 'properties managed'], required: false, defaultValue: 0},
        {key: 'property_types', label: 'Property Types', type: 'array', description: 'Types managed', extractionHints: ['residential', 'commercial', 'multifamily'], required: false, defaultValue: []},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas', 'cities'], required: false, defaultValue: []},
        {key: 'has_maintenance_team', label: 'In-House Maintenance', type: 'boolean', description: 'Own maintenance crew', extractionHints: ['maintenance team', 'in-house'], required: false, defaultValue: false},
        {key: 'has_tenant_portal', label: 'Online Portal', type: 'boolean', description: 'Digital tenant access', extractionHints: ['portal', 'online'], required: false, defaultValue: false},
        {key: 'management_fee_percent', label: 'Management Fee %', type: 'string', description: 'Fee structure', extractionHints: ['fee', 'percent', '%'], required: false, defaultValue: 'unknown'},
        {key: 'specialization', label: 'Specialization', type: 'string', description: 'Primary focus area', extractionHints: ['specialize', 'focus', 'expert'], required: false, defaultValue: 'general'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Property management intelligence - focuses on portfolio size, service breadth, technology adoption, and growth indicators'
      }
    }
  },
  
  'short-term-rentals': {
    id: 'short-term-rentals',
    name: 'Short-Term Rentals (Airbnb/Vacation)',
    description: 'For STR hosts - revenue optimization and guest experience',
    category: 'Real Estate',
    
    coreIdentity: {
      title: 'The Revenue & Guest Experience Expert',
      positioning: 'Upbeat, hospitality-focused, and tech-savvy',
      tone: 'Enthusiastic, data-driven, service-oriented'
    },
    
    cognitiveLogic: {
      framework: 'The Algorithmic Edge',
      reasoning: 'Logic that emphasizes beating the "average" host through dynamic pricing, Superhost-level response times, and 5-star reviews',
      decisionProcess: 'Market Data → Optimization Strategy → Revenue Maximization'
    },
    
    knowledgeRAG: {
      static: [
        'OTA (Airbnb/VRBO) best practices',
        'Superhost requirements',
        'Short-term rental regulations',
        'Guest communication templates',
        'Cleaning protocols'
      ],
      dynamic: [
        'Seasonal occupancy data',
        'Dynamic pricing algorithms',
        'Cleaning schedules',
        'Regional tourism drivers (events, seasons)',
        'Competitor pricing',
        'Guest review analytics'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Analyzes guest inquiries to suggest "Missing Amenities" (e.g., "3 people asked if you have a hot tub this week")',
      adaptation: 'Recommends pricing adjustments based on local events, seasonality, and booking velocity',
      feedbackIntegration: 'Tracks which amenities mentioned in reviews correlate with 5-star ratings and premium pricing'
    },
    
    tacticalExecution: {
      primaryAction: 'Revenue Projection',
      conversionRhythm: 'Prompts owners to see a "Potential Earnings" calendar for their property with seasonal breakdown',
      secondaryActions: [
        'Amenity gap analysis',
        'Superhost roadmap',
        'Dynamic pricing setup',
        'Guest automation demo',
        'Cleaning service recommendations'
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
        {id: 'property_count', label: 'Multiple Properties', description: 'Manages multiple STRs', keywords: ["properties", "listings", "portfolio"], regexPattern: '(\\d+)\\s*(properties|listings|homes)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'superhost_status', label: 'Superhost', description: 'Airbnb Superhost status', keywords: ["superhost", "super host", "top rated", "premier host"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'property_management', label: 'Full-Service Management', description: 'Offers complete STR management', keywords: ["property management", "full service", "turnkey", "we handle everything"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'dynamic_pricing', label: 'Dynamic Pricing', description: 'Uses algorithmic pricing', keywords: ["dynamic pricing", "revenue management", "pricelabs", "wheelhouse", "beyond pricing"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'cleaning_service', label: 'Cleaning Services', description: 'Professional cleaning team', keywords: ["cleaning", "housekeeping", "cleaning team", "turnover service"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'guest_communication', label: 'Guest Communication', description: 'Automated guest messaging', keywords: ["guest communication", "automated messaging", "24/7 support", "instant response"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'amenities_premium', label: 'Premium Amenities', description: 'High-end amenities offered', keywords: ["hot tub", "pool", "luxury", "premium amenities", "high-end"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'revenue_guarantee', label: 'Revenue Guarantee', description: 'Guaranteed income program', keywords: ["revenue guarantee", "guaranteed income", "minimum revenue", "income protection"], priority: 'CRITICAL', action: 'add-to-segment', scoreBoost: 35, platform: 'website'},
        {id: 'expansion', label: 'Expanding Portfolio', description: 'Adding new properties', keywords: ["expanding", "new property", "adding listings", "growing portfolio"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'hiring', label: 'Hiring Staff', description: 'Growing team', keywords: ["hiring", "join our team", "now hiring", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'guest_vetting', label: 'Guest Screening', description: 'Screens guests', keywords: ["guest screening", "background check", "verified guests", "id verification"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'maintenance_team', label: 'Maintenance Services', description: 'In-house maintenance', keywords: ["maintenance", "handyman", "repairs", "maintenance team"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'occupancy_rate', label: 'High Occupancy', description: 'Strong booking rate', keywords: ["occupancy", "booked", "high demand"], regexPattern: '(\\d+)%\\s*occupancy', priority: 'HIGH', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'review_score', label: 'High Review Score', description: 'Excellent guest reviews', keywords: ["5 star", "five star", "excellent reviews", "top rated"], regexPattern: '(4\\.[89]|5\\.0)\\s*(stars?|rating)', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'insurance', label: 'STR Insurance', description: 'Specialized insurance', keywords: ["str insurance", "short term rental insurance", "vacation rental insurance", "liability coverage"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms (of|and)', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social media', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'properties', pattern: '^properties$|^listings$', description: 'Properties', context: 'header'},
        {id: 'amenities', pattern: '^amenities$', description: 'Amenities link', context: 'header'},
        {id: 'booking', pattern: '^book now$', description: 'Booking', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'login', pattern: 'login', description: 'Login', context: 'header'},
        {id: 'owners', pattern: '^owners$', description: 'Owners link', context: 'header'},
        {id: 'guests', pattern: '^guests$', description: 'Guests link', context: 'header'},
        {id: 'reviews', pattern: '^reviews$', description: 'Reviews link', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'}
      ],

      scoringRules: [
        {id: 'large_operator', name: 'Large Portfolio', description: 'Multiple properties with high occupancy', condition: 'signals.some(s => s.signalId === "property_count") && signals.some(s => s.signalId === "occupancy_rate")', scoreBoost: 30, priority: 1, enabled: true},
        {id: 'professional_host', name: 'Professional Host', description: 'Superhost with premium amenities', condition: 'signals.some(s => s.signalId === "superhost_status") && signals.some(s => s.signalId === "amenities_premium")', scoreBoost: 25, priority: 2, enabled: true},
        {id: 'full_service', name: 'Full-Service Provider', description: 'Complete management services', condition: 'signals.some(s => s.signalId === "property_management") && signals.some(s => s.signalId === "cleaning_service")', scoreBoost: 20, priority: 3, enabled: true},
        {id: 'tech_enabled', name: 'Technology-Forward', description: 'Dynamic pricing and automation', condition: 'signals.some(s => s.signalId === "dynamic_pricing") && signals.some(s => s.signalId === "guest_communication")', scoreBoost: 18, priority: 4, enabled: true},
        {id: 'growing_business', name: 'Growing Business', description: 'Expanding with hiring', condition: 'signals.some(s => s.signalId === "expansion") && signals.some(s => s.signalId === "hiring")', scoreBoost: 30, priority: 5, enabled: true},
        {id: 'premium_service', name: 'Premium Operator', description: 'Revenue guarantee with high reviews', condition: 'signals.some(s => s.signalId === "revenue_guarantee") && signals.some(s => s.signalId === "review_score")', scoreBoost: 35, priority: 6, enabled: true},
        {id: 'comprehensive', name: 'Comprehensive Services', description: 'Multiple service offerings', condition: 'signals.filter(s => ["cleaning_service", "maintenance_team", "guest_communication", "guest_vetting"].includes(s.signalId)).length >= 3', scoreBoost: 22, priority: 7, enabled: true},
        {id: 'quality_focused', name: 'Quality-Focused', description: 'High reviews with vetting', condition: 'signals.some(s => s.signalId === "review_score") && signals.some(s => s.signalId === "guest_vetting")', scoreBoost: 15, priority: 8, enabled: true},
        {id: 'insured_professional', name: 'Insured Professional', description: 'Insurance with property management', condition: 'signals.some(s => s.signalId === "insurance") && signals.some(s => s.signalId === "property_management")', scoreBoost: 12, priority: 9, enabled: true},
        {id: 'established_host', name: 'Established Host', description: 'Superhost with multiple properties', condition: 'signals.some(s => s.signalId === "superhost_status") && signals.some(s => s.signalId === "property_count")', scoreBoost: 28, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'property_count', label: 'Number of Properties', type: 'number', description: 'STR properties managed', extractionHints: ['properties', 'listings', 'portfolio'], required: false, defaultValue: 1},
        {key: 'avg_nightly_rate', label: 'Average Nightly Rate', type: 'string', description: 'Typical rate per night', extractionHints: ['per night', 'nightly', 'rate'], required: false, defaultValue: 'unknown'},
        {key: 'occupancy_rate', label: 'Occupancy Rate %', type: 'number', description: 'Booking percentage', extractionHints: ['occupancy', 'booked'], required: false, defaultValue: 0},
        {key: 'is_superhost', label: 'Superhost Status', type: 'boolean', description: 'Airbnb Superhost', extractionHints: ['superhost'], required: false, defaultValue: false},
        {key: 'has_dynamic_pricing', label: 'Uses Dynamic Pricing', type: 'boolean', description: 'Algorithmic pricing', extractionHints: ['dynamic pricing', 'revenue management'], required: false, defaultValue: false},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'locations', 'cities'], required: false, defaultValue: []},
        {key: 'specialization', label: 'Property Type Focus', type: 'string', description: 'Primary property type', extractionHints: ['specialize', 'focus', 'luxury', 'beach'], required: false, defaultValue: 'general'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Short-term rental intelligence - focuses on portfolio size, revenue optimization, guest experience, and professional management services'
      }
    }
  },
  
  'mortgage-lending': {
    id: 'mortgage-lending',
    name: 'Mortgage & Lending',
    description: 'For mortgage brokers - compliant and advisory focused',
    category: 'Real Estate',
    
    coreIdentity: {
      title: 'The Financial Architect',
      positioning: 'Precise, reassuring, and highly compliant. Avoids "salesy" pressure in favor of "advisory" clarity',
      tone: 'Professional, educational, trustworthy'
    },
    
    cognitiveLogic: {
      framework: 'Scenario-Based Comparison',
      reasoning: 'Logic that avoids quoting one rate and instead compares the total "Cost of Capital" over 5, 10, and 30 years across different loan products',
      decisionProcess: 'Financial Situation → Loan Product Comparison → Total Cost Analysis'
    },
    
    knowledgeRAG: {
      static: [
        'FHA/VA/Conventional guidelines',
        'DTI (Debt-to-Income) calculations',
        'Loan-to-Value (LTV) ratios',
        'TRID compliance',
        'Credit score requirements',
        'Private Mortgage Insurance (PMI) rules'
      ],
      dynamic: [
        'Daily rate sheets',
        'Lender overlays',
        'State-specific licensing requirements',
        'Points vs. rate trade-offs',
        'Lock period options',
        'Real-time rate updates'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Detects when leads are "Rate Shopping" and triggers the "Total Cost Analysis" logic to compete on service and certainty rather than just 0.1% rate difference',
      adaptation: 'Shifts from rate-focused to value-focused conversation (faster closing, better service, refinance strategy)',
      feedbackIntegration: 'Learns which loan features (low down payment, no PMI, rate locks) matter most to different borrower segments'
    },
    
    tacticalExecution: {
      primaryAction: 'Soft Pull/Pre-Application',
      conversionRhythm: 'Directs users to a secure portal for a "5-minute pre-qualification" to capture verified contact info and financial snapshot',
      secondaryActions: [
        'Total cost comparison calculator',
        'Pre-approval letter request',
        'Refinance analysis',
        'Debt consolidation review',
        'First-time buyer education'
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
        {id: 'loan_officers', label: 'Multiple Loan Officers', description: 'Large team of LOs', keywords: ["loan officers", "mortgage team", "lending team"], regexPattern: '(\\d+)\\s*(loan officers?|los?)', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'hiring', label: 'Hiring Loan Officers', description: 'Growing team', keywords: ["hiring", "join our team", "loan officer careers", "now hiring"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'loan_types', label: 'Multiple Loan Products', description: 'Diverse loan offerings', keywords: ["conventional", "fha", "va", "jumbo", "usda", "renovation"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'rate_guarantee', label: 'Rate Lock Guarantee', description: 'Extended rate lock', keywords: ["rate lock", "lock guarantee", "rate protection", "extended lock"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'same_day_preapproval', label: 'Fast Pre-Approval', description: 'Quick pre-approval process', keywords: ["same day", "fast approval", "quick preapproval", "instant approval"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'low_down_payment', label: 'Low Down Payment Options', description: 'Minimal down payment programs', keywords: ["low down", "3% down", "zero down", "no money down"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'refinance_specialist', label: 'Refinance Specialist', description: 'Strong refinance focus', keywords: ["refinance", "refi", "cash out", "lower your rate"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'first_time_buyer', label: 'First-Time Buyer Programs', description: 'Specializes in first-time buyers', keywords: ["first time buyer", "first time home", "fthb", "homebuyer education"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'digital_application', label: 'Online Application', description: 'Digital mortgage process', keywords: ["online application", "digital mortgage", "apply online", "paperless"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'lender_licenses', label: 'Multi-State Licensing', description: 'Licensed in multiple states', keywords: ["licensed in", "serving", "states"], regexPattern: 'licensed? in (\\d+) states?', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'awards', label: 'Industry Recognition', description: 'Awards or recognition', keywords: ["top lender", "award", "scotsman guide", "mortgage professional"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'closing_time', label: 'Fast Closing', description: 'Quick close guarantee', keywords: ["fast close", "quick close", "15 day", "21 day close"], regexPattern: '(\\d+)\\s*day close', priority: 'HIGH', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'jumbo_loans', label: 'Jumbo Loan Specialist', description: 'High-value mortgages', keywords: ["jumbo", "high balance", "luxury homes", "million dollar"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 22, platform: 'website'},
        {id: 'reverse_mortgage', label: 'Reverse Mortgage', description: 'HECM services', keywords: ["reverse mortgage", "hecm", "home equity conversion"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'construction_loans', label: 'Construction Lending', description: 'Construction-to-perm loans', keywords: ["construction loan", "build your own", "construction to permanent"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'equal_housing', pattern: 'equal housing', description: 'Equal housing', context: 'footer'},
        {id: 'nmls', pattern: 'nmls #?\\d+', description: 'NMLS number', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms (of|and)', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'disclaimer', pattern: 'licensed mortgage|rates subject to change', description: 'Disclaimers', context: 'footer'},
        {id: 'social', pattern: 'follow us', description: 'Social media', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'rates', pattern: '^rates$', description: 'Rates link', context: 'header'},
        {id: 'apply', pattern: '^apply( now)?$', description: 'Apply link', context: 'header'},
        {id: 'calculator', pattern: '^calculators?$', description: 'Calculator', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'login', pattern: 'login', description: 'Login', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'}
      ],

      scoringRules: [
        {id: 'large_team', name: 'Large Operation', description: 'Multiple loan officers', condition: 'signals.some(s => s.signalId === "loan_officers")', scoreBoost: 25, priority: 1, enabled: true},
        {id: 'growing_company', name: 'Growing Company', description: 'Hiring with multi-state licensing', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "lender_licenses")', scoreBoost: 30, priority: 2, enabled: true},
        {id: 'competitive_edge', name: 'Competitive Advantage', description: 'Fast closing with rate guarantee', condition: 'signals.some(s => s.signalId === "closing_time") && signals.some(s => s.signalId === "rate_guarantee")', scoreBoost: 25, priority: 3, enabled: true},
        {id: 'tech_forward', name: 'Technology-Forward', description: 'Digital application with fast approval', condition: 'signals.some(s => s.signalId === "digital_application") && signals.some(s => s.signalId === "same_day_preapproval")', scoreBoost: 18, priority: 4, enabled: true},
        {id: 'diverse_products', name: 'Diverse Product Mix', description: 'Multiple specialized loan types', condition: 'signals.filter(s => ["jumbo_loans", "reverse_mortgage", "construction_loans", "refinance_specialist"].includes(s.signalId)).length >= 2', scoreBoost: 20, priority: 5, enabled: true},
        {id: 'first_timer_focus', name: 'First-Time Buyer Specialist', description: 'FTHB programs with low down', condition: 'signals.some(s => s.signalId === "first_time_buyer") && signals.some(s => s.signalId === "low_down_payment")', scoreBoost: 15, priority: 6, enabled: true},
        {id: 'luxury_specialist', name: 'Luxury Market', description: 'Jumbo loans with fast closing', condition: 'signals.some(s => s.signalId === "jumbo_loans") && signals.some(s => s.signalId === "closing_time")', scoreBoost: 22, priority: 7, enabled: true},
        {id: 'recognized_leader', name: 'Industry Leader', description: 'Awards with multi-state presence', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "lender_licenses")', scoreBoost: 25, priority: 8, enabled: true},
        {id: 'comprehensive_services', name: 'Full-Service Lender', description: 'Multiple loan products with digital tools', condition: 'signals.some(s => s.signalId === "loan_types") && signals.some(s => s.signalId === "digital_application")', scoreBoost: 18, priority: 9, enabled: true},
        {id: 'speed_leader', name: 'Speed Leader', description: 'Fast approval and closing', condition: 'signals.some(s => s.signalId === "same_day_preapproval") && signals.some(s => s.signalId === "closing_time")', scoreBoost: 20, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'loan_officer_count', label: 'Number of Loan Officers', type: 'number', description: 'Team size', extractionHints: ['loan officers', 'team', 'los'], required: false, defaultValue: 1},
        {key: 'states_licensed', label: 'States Licensed', type: 'number', description: 'Multi-state reach', extractionHints: ['states', 'licensed in'], required: false, defaultValue: 1},
        {key: 'loan_products', label: 'Loan Products Offered', type: 'array', description: 'Types of loans', extractionHints: ['conventional', 'fha', 'va', 'jumbo'], required: false, defaultValue: []},
        {key: 'avg_closing_days', label: 'Average Closing Time (Days)', type: 'number', description: 'Typical closing period', extractionHints: ['day close', 'closing time'], required: false, defaultValue: 30},
        {key: 'has_digital_app', label: 'Digital Application', type: 'boolean', description: 'Online application available', extractionHints: ['online', 'digital', 'apply online'], required: false, defaultValue: false},
        {key: 'specialization', label: 'Market Specialization', type: 'string', description: 'Primary focus area', extractionHints: ['specialize', 'focus', 'expert'], required: false, defaultValue: 'general'},
        {key: 'min_credit_score', label: 'Minimum Credit Score', type: 'number', description: 'Lowest score accepted', extractionHints: ['credit score', 'minimum', 'as low as'], required: false, defaultValue: 620}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Mortgage lending intelligence - focuses on team size, loan product diversity, processing speed, and multi-state capabilities'
      }
    }
  },
  
  'home-staging': {
    id: 'home-staging',
    name: 'Home Staging',
    description: 'For stagers - visual marketing and ROI focus',
    category: 'Real Estate',
    
    coreIdentity: {
      title: 'High-End Visual Marketer & Spatial Strategist',
      positioning: 'Sophisticated, artistic, and ROI-focused',
      tone: 'Elegant, professional, results-driven'
    },
    
    cognitiveLogic: {
      framework: 'The Emotional Connection Framework',
      reasoning: 'Logic that shifts the conversation from "furniture rental" to "buyer psychology" and "equity maximization"',
      decisionProcess: 'Visual Impact → Buyer Psychology → ROI Justification'
    },
    
    knowledgeRAG: {
      static: [
        'Design styles (Modern, Transitional, Contemporary)',
        'Inventory logistics',
        'Color psychology',
        'Space optimization principles',
        'Photography best practices'
      ],
      dynamic: [
        'Client\'s property portfolio',
        '"Before & After" statistics',
        'Package pricing tiers',
        'Inventory availability',
        'ROI data by property type',
        'Market-specific styling trends'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks which room types (e.g., "Empty Living Room," "Dated Kitchen") cause the most lead hesitation',
      adaptation: 'Prompts the client to create a specific case study for problematic room types to overcome objections',
      feedbackIntegration: 'Correlates staging investments with days-on-market reduction and sale price increases'
    },
    
    tacticalExecution: {
      primaryAction: 'Photo Quote Request',
      conversionRhythm: 'Every conversation aims to get the lead to upload property photos for a "Staging Impact Estimate"',
      secondaryActions: [
        'Before & After portfolio review',
        'ROI calculator (sale price increase vs staging cost)',
        'Virtual staging preview',
        'Package comparison guide',
        'Consultation scheduling'
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
        {id: 'portfolio_size', label: 'Large Inventory', description: 'Extensive furniture inventory', keywords: ["inventory", "furniture collection", "pieces", "warehouse"], regexPattern: '(\\d{3,})\\+?\\s*pieces?', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'before_after', label: 'Before & After Portfolio', description: 'Shows transformation results', keywords: ["before and after", "before & after", "transformations", "results"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'virtual_staging', label: 'Virtual Staging', description: 'Offers digital staging', keywords: ["virtual staging", "digital staging", "3d staging", "photo staging"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 20, platform: 'website'},
        {id: 'occupied_staging', label: 'Occupied Home Staging', description: 'Stages occupied properties', keywords: ["occupied", "lived-in", "consultation", "redesign"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'vacant_staging', label: 'Vacant Staging', description: 'Full vacant home staging', keywords: ["vacant", "full staging", "empty home", "turnkey"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'luxury_staging', label: 'Luxury Staging', description: 'High-end property focus', keywords: ["luxury", "high-end", "upscale", "premium", "million dollar"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'roi_stats', label: 'ROI Statistics', description: 'Provides staging ROI data', keywords: ["roi", "return on investment", "increased sale price", "faster sale"], regexPattern: '(\\d+)%\\s*(increase|faster|higher)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'awards', label: 'Industry Awards', description: 'Recognition or certifications', keywords: ["award", "certified", "accredited", "resa", "staging association"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 18, platform: 'website'},
        {id: 'hiring', label: 'Hiring Stagers', description: 'Growing team', keywords: ["hiring", "join our team", "careers", "stager positions"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'expansion', label: 'Market Expansion', description: 'New locations or markets', keywords: ["expanding", "new office", "now serving", "new market"], priority: 'HIGH', action: 'increase-score', scoreBoost: 20, platform: 'any'},
        {id: 'property_types', label: 'Multiple Property Types', description: 'Diverse staging experience', keywords: ["residential", "commercial", "apartments", "condos", "townhomes"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'consultation_free', label: 'Free Consultation', description: 'Complimentary assessment', keywords: ["free consultation", "complimentary", "no obligation"], priority: 'LOW', action: 'increase-score', scoreBoost: 8, platform: 'website'},
        {id: 'package_deals', label: 'Staging Packages', description: 'Tiered pricing options', keywords: ["packages", "package pricing", "bronze silver gold", "tiers"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'quick_turnaround', label: 'Fast Installation', description: 'Quick staging setup', keywords: ["24 hour", "48 hour", "quick install", "fast turnaround"], regexPattern: '(\\d+)\\s*(hour|day)\\s*install', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'partnerships', label: 'Agent Partnerships', description: 'Works with real estate agents', keywords: ["agent partnership", "realtor network", "agent discount", "preferred stager"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms (of|and)', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social media', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'portfolio', pattern: '^portfolio$', description: 'Portfolio link', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'gallery', pattern: '^gallery$', description: 'Gallery link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'consultation', pattern: '^consultation$', description: 'Consult link', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'pricing', pattern: '^pricing$', description: 'Pricing link', context: 'header'},
        {id: 'process', pattern: '^(our )?process$', description: 'Process link', context: 'header'}
      ],

      scoringRules: [
        {id: 'proven_results', name: 'Proven Results', description: 'Before/after with ROI stats', condition: 'signals.some(s => s.signalId === "before_after") && signals.some(s => s.signalId === "roi_stats")', scoreBoost: 35, priority: 1, enabled: true},
        {id: 'full_service', name: 'Full-Service Provider', description: 'Virtual and physical staging', condition: 'signals.some(s => s.signalId === "virtual_staging") && (signals.some(s => s.signalId === "vacant_staging") || signals.some(s => s.signalId === "occupied_staging"))', scoreBoost: 25, priority: 2, enabled: true},
        {id: 'luxury_specialist', name: 'Luxury Specialist', description: 'High-end with large inventory', condition: 'signals.some(s => s.signalId === "luxury_staging") && signals.some(s => s.signalId === "portfolio_size")', scoreBoost: 28, priority: 3, enabled: true},
        {id: 'growing_business', name: 'Growing Business', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 25, priority: 4, enabled: true},
        {id: 'professional', name: 'Professional Operation', description: 'Awards with proven ROI', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "roi_stats")', scoreBoost: 22, priority: 5, enabled: true},
        {id: 'versatile', name: 'Versatile Provider', description: 'Multiple property types and staging methods', condition: 'signals.some(s => s.signalId === "property_types") && signals.filter(s => ["vacant_staging", "occupied_staging"].includes(s.signalId)).length >= 2', scoreBoost: 18, priority: 6, enabled: true},
        {id: 'speed_service', name: 'Fast Service', description: 'Quick turnaround with packages', condition: 'signals.some(s => s.signalId === "quick_turnaround") && signals.some(s => s.signalId === "package_deals")', scoreBoost: 15, priority: 7, enabled: true},
        {id: 'agent_friendly', name: 'Agent-Friendly', description: 'Partnerships with free consultation', condition: 'signals.some(s => s.signalId === "partnerships") && signals.some(s => s.signalId === "consultation_free")', scoreBoost: 12, priority: 8, enabled: true},
        {id: 'comprehensive', name: 'Comprehensive Portfolio', description: 'Large inventory with quick install', condition: 'signals.some(s => s.signalId === "portfolio_size") && signals.some(s => s.signalId === "quick_turnaround")', scoreBoost: 20, priority: 9, enabled: true},
        {id: 'modern_approach', name: 'Modern Approach', description: 'Virtual staging with proven results', condition: 'signals.some(s => s.signalId === "virtual_staging") && signals.some(s => s.signalId === "before_after")', scoreBoost: 18, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'inventory_count', label: 'Inventory Pieces', type: 'number', description: 'Total furniture pieces', extractionHints: ['pieces', 'inventory', 'furniture'], required: false, defaultValue: 0},
        {key: 'avg_roi_percent', label: 'Average ROI %', type: 'number', description: 'Typical return on investment', extractionHints: ['roi', 'increase', 'return'], required: false, defaultValue: 0},
        {key: 'service_types', label: 'Staging Services', type: 'array', description: 'Types of staging offered', extractionHints: ['vacant', 'occupied', 'virtual'], required: false, defaultValue: []},
        {key: 'specialization', label: 'Market Specialization', type: 'string', description: 'Primary focus area', extractionHints: ['luxury', 'residential', 'commercial'], required: false, defaultValue: 'residential'},
        {key: 'has_virtual_staging', label: 'Offers Virtual Staging', type: 'boolean', description: 'Digital staging available', extractionHints: ['virtual', 'digital'], required: false, defaultValue: false},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas', 'cities'], required: false, defaultValue: []},
        {key: 'install_time_hours', label: 'Typical Install Time (Hours)', type: 'number', description: 'Average setup time', extractionHints: ['hour', 'install', 'setup'], required: false, defaultValue: 48}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Home staging intelligence - focuses on portfolio size, ROI demonstration, service diversity, and luxury market capabilities'
      }
    }
  },
  
  'interior-design': {
    id: 'interior-design',
    name: 'Interior Design',
    description: 'For designers - aesthetic and functional consultation',
    category: 'Real Estate',
    
    coreIdentity: {
      title: 'The Visionary Consultant',
      positioning: 'Elegant, detailed, authoritative, and creative',
      tone: 'Sophisticated, collaborative, inspirational'
    },
    
    cognitiveLogic: {
      framework: 'The Lifestyle Discovery Model',
      reasoning: 'Logic that uses "Diagnostic Questions" to uncover a client\'s aesthetic and functional needs before suggesting a style',
      decisionProcess: 'Discovery → Vision Alignment → Curated Solutions'
    },
    
    knowledgeRAG: {
      static: [
        'Material durability standards',
        'Color theory principles',
        'Space planning fundamentals',
        'Lighting design basics',
        'Furniture scale and proportion'
      ],
      dynamic: [
        'Vendor lists and lead times',
        'Designer\'s specific aesthetic "signature"',
        'Material pricing and availability',
        'Trend forecasting data',
        'Portfolio images by style',
        'Project timelines'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Analyzes lead "Inspiration" keywords (e.g., "Scandi," "Moody," "Minimalist," "Maximalist")',
      adaptation: 'Automatically curates the first set of portfolio images shown to the lead based on detected aesthetic preferences',
      feedbackIntegration: 'Tracks which design styles convert best for different client demographics and project types'
    },
    
    tacticalExecution: {
      primaryAction: 'Design Discovery Call',
      conversionRhythm: 'Focuses on booking a paid or free consultation to establish project scope and vision alignment',
      secondaryActions: [
        'Style quiz/assessment',
        'Portfolio showcase (filtered by style)',
        'Mood board creation',
        'Budget range discussion',
        'Timeline planning'
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
        {id: 'portfolio_projects', label: 'Extensive Portfolio', description: 'Large project portfolio', keywords: ["projects", "portfolio", "completed", "featured work"], regexPattern: '(\\d{2,})\\+?\\s*projects?', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'awards', label: 'Design Awards', description: 'Industry recognition', keywords: ["award", "best of houzz", "asid", "designer of the year", "featured in"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'residential_design', label: 'Residential Design', description: 'Home design focus', keywords: ["residential", "home design", "whole house", "room redesign"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'commercial_design', label: 'Commercial Design', description: 'Commercial space expertise', keywords: ["commercial", "office design", "retail", "hospitality design"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'full_service', label: 'Full-Service Design', description: 'End-to-end design services', keywords: ["full service", "turnkey", "concept to completion", "from start to finish"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'virtual_design', label: 'Virtual/Online Design', description: 'Remote design services', keywords: ["virtual design", "online design", "e-design", "remote consultation"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'luxury_design', label: 'Luxury Design', description: 'High-end market focus', keywords: ["luxury", "high-end", "upscale", "custom", "bespoke"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'sustainable_design', label: 'Sustainable Design', description: 'Eco-friendly focus', keywords: ["sustainable", "eco-friendly", "green design", "leed", "environmental"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'renovation_specialist', label: 'Renovation Specialist', description: 'Remodel expertise', keywords: ["renovation", "remodel", "restoration", "historic"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'hiring', label: 'Hiring Designers', description: 'Growing team', keywords: ["hiring", "join our team", "designer positions", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'showroom', label: 'Design Showroom', description: 'Physical showroom space', keywords: ["showroom", "design studio", "visit us", "come see"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'trade_program', label: 'Trade Program', description: 'Works with trade professionals', keywords: ["trade", "to the trade", "designer discount", "trade only"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'certifications', label: 'Professional Certifications', description: 'Industry credentials', keywords: ["asid", "iida", "ncidq", "certified", "accredited"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'featured_press', label: 'Media Features', description: 'Press coverage', keywords: ["featured in", "elle decor", "architectural digest", "house beautiful", "press"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'specialty_services', label: 'Specialty Services', description: 'Niche design services', keywords: ["color consultation", "space planning", "lighting design", "custom furniture"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms (of|and)', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social media', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'portfolio', pattern: '^portfolio$', description: 'Portfolio link', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'process', pattern: '^process$', description: 'Process link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'consultation', pattern: '^consultation$', description: 'Consult link', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'gallery', pattern: '^gallery$', description: 'Gallery', context: 'header'},
        {id: 'shop', pattern: '^shop$', description: 'Shop link', context: 'header'},
        {id: 'press', pattern: '^press$', description: 'Press link', context: 'header'}
      ],

      scoringRules: [
        {id: 'recognized_designer', name: 'Recognized Designer', description: 'Awards with media features', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "featured_press")', scoreBoost: 35, priority: 1, enabled: true},
        {id: 'luxury_specialist', name: 'Luxury Specialist', description: 'Luxury focus with extensive portfolio', condition: 'signals.some(s => s.signalId === "luxury_design") && signals.some(s => s.signalId === "portfolio_projects")', scoreBoost: 30, priority: 2, enabled: true},
        {id: 'comprehensive_provider', name: 'Comprehensive Provider', description: 'Full-service with showroom', condition: 'signals.some(s => s.signalId === "full_service") && signals.some(s => s.signalId === "showroom")', scoreBoost: 25, priority: 3, enabled: true},
        {id: 'growing_firm', name: 'Growing Firm', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring")', scoreBoost: 25, priority: 4, enabled: true},
        {id: 'versatile', name: 'Versatile Designer', description: 'Both residential and commercial', condition: 'signals.some(s => s.signalId === "residential_design") && signals.some(s => s.signalId === "commercial_design")', scoreBoost: 22, priority: 5, enabled: true},
        {id: 'professional', name: 'Professional', description: 'Certifications with awards', condition: 'signals.some(s => s.signalId === "certifications") && signals.some(s => s.signalId === "awards")', scoreBoost: 20, priority: 6, enabled: true},
        {id: 'modern_approach', name: 'Modern Approach', description: 'Virtual and traditional services', condition: 'signals.some(s => s.signalId === "virtual_design") && signals.some(s => s.signalId === "full_service")', scoreBoost: 18, priority: 7, enabled: true},
        {id: 'eco_conscious', name: 'Eco-Conscious', description: 'Sustainable design with certifications', condition: 'signals.some(s => s.signalId === "sustainable_design")', scoreBoost: 15, priority: 8, enabled: true},
        {id: 'renovation_expert', name: 'Renovation Expert', description: 'Renovation specialist with portfolio', condition: 'signals.some(s => s.signalId === "renovation_specialist") && signals.some(s => s.signalId === "portfolio_projects")', scoreBoost: 18, priority: 9, enabled: true},
        {id: 'trade_professional', name: 'Trade Professional', description: 'Trade program with showroom', condition: 'signals.some(s => s.signalId === "trade_program") && signals.some(s => s.signalId === "showroom")', scoreBoost: 15, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'project_count', label: 'Number of Projects', type: 'number', description: 'Completed projects', extractionHints: ['projects', 'completed', 'portfolio'], required: false, defaultValue: 0},
        {key: 'design_styles', label: 'Design Styles', type: 'array', description: 'Aesthetic specializations', extractionHints: ['modern', 'traditional', 'transitional', 'contemporary'], required: false, defaultValue: []},
        {key: 'specialization', label: 'Market Specialization', type: 'string', description: 'Primary focus area', extractionHints: ['residential', 'commercial', 'luxury'], required: false, defaultValue: 'residential'},
        {key: 'has_showroom', label: 'Has Showroom', type: 'boolean', description: 'Physical showroom location', extractionHints: ['showroom', 'studio'], required: false, defaultValue: false},
        {key: 'offers_virtual', label: 'Offers Virtual Design', type: 'boolean', description: 'Remote services available', extractionHints: ['virtual', 'online', 'e-design'], required: false, defaultValue: false},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas', 'cities'], required: false, defaultValue: []},
        {key: 'team_size', label: 'Team Size', type: 'number', description: 'Number of designers', extractionHints: ['designers', 'team', 'staff'], required: false, defaultValue: 1}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Interior design intelligence - focuses on portfolio depth, industry recognition, service breadth, and market specialization'
      }
    }
  },
  
  'architecture': {
    id: 'architecture',
    name: 'Architecture',
    description: 'For architects - technical vision and regulatory expertise',
    category: 'Real Estate',
    
    coreIdentity: {
      title: 'The Technical Visionary',
      positioning: 'Precise, visionary, and highly regulatory-aware. Focused on the intersection of "Form and Function"',
      tone: 'Professional, technical, forward-thinking'
    },
    
    cognitiveLogic: {
      framework: 'The Feasibility-First Logic',
      reasoning: 'Logic that prioritizes "Can we build this?" (zoning/code compliance) before "What will it look like?" (aesthetic design)',
      decisionProcess: 'Regulatory Feasibility → Technical Design → Aesthetic Vision'
    },
    
    knowledgeRAG: {
      static: [
        'Building codes (IBC, IRC)',
        'ADA compliance requirements',
        'Structural engineering basics',
        'Zoning regulations',
        'Environmental design standards',
        'Permit processes'
      ],
      dynamic: [
        'Local permit timelines by jurisdiction',
        'Past project blueprints',
        'Firm-specific CAD/BIM processes',
        'Zoning variances and precedents',
        'Material innovations',
        'Code updates and changes'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Flags if users are asking for "Impossible Builds" (e.g., 5 stories in a 2-story zoning district)',
      adaptation: 'Suggests a "Zoning Consultation" or "Variance Application" strategy instead of immediate design engagement',
      feedbackIntegration: 'Learns which code/zoning questions are most common and proactively addresses them early in conversation'
    },
    
    tacticalExecution: {
      primaryAction: 'Feasibility Assessment',
      conversionRhythm: 'Directs users toward a "Site Review" or "Master Planning" phase to establish viability before design',
      secondaryActions: [
        'Zoning analysis',
        'Code compliance review',
        'Conceptual design presentation',
        'Preliminary budget estimate',
        'Project timeline development'
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
        {id: 'project_count', label: 'Large Portfolio', description: 'Many completed projects', keywords: ["projects", "portfolio", "completed"], regexPattern: '(\\d{2,})\\+?\\s*projects?', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'awards', label: 'Architecture Awards', description: 'Industry recognition', keywords: ["aia award", "design award", "architecture award", "recognition"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'leed_certified', label: 'LEED Certification', description: 'Sustainable design credentials', keywords: ["leed", "leed certified", "green building", "sustainable"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'commercial_architecture', label: 'Commercial Architecture', description: 'Commercial project focus', keywords: ["commercial", "office building", "retail", "hospitality", "mixed-use"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'residential_architecture', label: 'Residential Architecture', description: 'Custom home design', keywords: ["residential", "custom homes", "single family", "estates"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'master_planning', label: 'Master Planning', description: 'Large-scale planning services', keywords: ["master planning", "urban design", "site planning", "campus"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 28, platform: 'website'},
        {id: 'renovation_adaptive', label: 'Renovation & Adaptive Reuse', description: 'Historic renovation expertise', keywords: ["renovation", "adaptive reuse", "historic", "restoration"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'team_size', label: 'Large Firm', description: 'Multiple architects', keywords: ["architects", "principals", "team"], regexPattern: '(\\d+)\\s*architects?', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'hiring', label: 'Hiring Architects', description: 'Growing team', keywords: ["hiring", "join our team", "architect positions", "careers"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'bim_services', label: 'BIM Services', description: 'Building Information Modeling', keywords: ["bim", "revit", "3d modeling", "digital twin"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'international_projects', label: 'International Projects', description: 'Global project experience', keywords: ["international", "global", "worldwide", "countries"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 22, platform: 'website'},
        {id: 'specialization', label: 'Specialized Practice', description: 'Niche expertise', keywords: ["healthcare", "education", "hospitality", "industrial", "institutional"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'published_work', label: 'Published Work', description: 'Featured in publications', keywords: ["published", "architectural digest", "featured in", "architecture magazine"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'registered', label: 'Licensed Architects', description: 'Professional licensure', keywords: ["licensed", "registered", "aia", "ncarb"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'multi_office', label: 'Multiple Offices', description: 'Multi-location firm', keywords: ["offices", "locations", "office in"], regexPattern: '(\\d+)\\s*offices?', priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms (of|and)', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social media', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'projects', pattern: '^projects$', description: 'Projects link', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'news', pattern: '^news$', description: 'News link', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'team', pattern: '^team$', description: 'Team link', context: 'header'},
        {id: 'press', pattern: '^press$', description: 'Press link', context: 'header'},
        {id: 'awards', pattern: '^awards$', description: 'Awards link', context: 'header'},
        {id: 'sustainability', pattern: '^sustainability$', description: 'Sustainability', context: 'header'}
      ],

      scoringRules: [
        {id: 'award_winning_firm', name: 'Award-Winning Firm', description: 'AIA awards with large portfolio', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "project_count")', scoreBoost: 40, priority: 1, enabled: true},
        {id: 'large_practice', name: 'Large Practice', description: 'Multiple architects with offices', condition: 'signals.some(s => s.signalId === "team_size") && signals.some(s => s.signalId === "multi_office")', scoreBoost: 35, priority: 2, enabled: true},
        {id: 'sustainable_leader', name: 'Sustainable Leader', description: 'LEED certified with green focus', condition: 'signals.some(s => s.signalId === "leed_certified")', scoreBoost: 25, priority: 3, enabled: true},
        {id: 'tech_forward', name: 'Technology-Forward', description: 'BIM services with modern tools', condition: 'signals.some(s => s.signalId === "bim_services")', scoreBoost: 18, priority: 4, enabled: true},
        {id: 'versatile', name: 'Versatile Practice', description: 'Both commercial and residential', condition: 'signals.some(s => s.signalId === "commercial_architecture") && signals.some(s => s.signalId === "residential_architecture")', scoreBoost: 22, priority: 5, enabled: true},
        {id: 'growing_firm', name: 'Growing Firm', description: 'Hiring architects', condition: 'signals.some(s => s.signalId === "hiring")', scoreBoost: 30, priority: 6, enabled: true},
        {id: 'recognized_leader', name: 'Recognized Leader', description: 'Published with awards', condition: 'signals.some(s => s.signalId === "published_work") && signals.some(s => s.signalId === "awards")', scoreBoost: 35, priority: 7, enabled: true},
        {id: 'global_reach', name: 'Global Practice', description: 'International projects with large team', condition: 'signals.some(s => s.signalId === "international_projects") && signals.some(s => s.signalId === "team_size")', scoreBoost: 30, priority: 8, enabled: true},
        {id: 'niche_expert', name: 'Niche Expert', description: 'Specialized practice area', condition: 'signals.some(s => s.signalId === "specialization")', scoreBoost: 18, priority: 9, enabled: true},
        {id: 'adaptive_reuse', name: 'Adaptive Reuse Specialist', description: 'Historic renovation with portfolio', condition: 'signals.some(s => s.signalId === "renovation_adaptive") && signals.some(s => s.signalId === "project_count")', scoreBoost: 20, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'architect_count', label: 'Number of Architects', type: 'number', description: 'Licensed architects on staff', extractionHints: ['architects', 'principals', 'team'], required: false, defaultValue: 1},
        {key: 'project_types', label: 'Project Types', type: 'array', description: 'Types of architecture', extractionHints: ['residential', 'commercial', 'institutional'], required: false, defaultValue: []},
        {key: 'has_leed_accreditation', label: 'LEED Accredited', type: 'boolean', description: 'LEED certification', extractionHints: ['leed'], required: false, defaultValue: false},
        {key: 'has_bim', label: 'Uses BIM', type: 'boolean', description: 'BIM capabilities', extractionHints: ['bim', 'revit'], required: false, defaultValue: false},
        {key: 'office_locations', label: 'Office Count', type: 'number', description: 'Number of offices', extractionHints: ['offices', 'locations'], required: false, defaultValue: 1},
        {key: 'specialization', label: 'Practice Specialization', type: 'string', description: 'Primary focus area', extractionHints: ['specialize', 'focus', 'expert'], required: false, defaultValue: 'general'},
        {key: 'years_established', label: 'Years in Practice', type: 'number', description: 'Firm age', extractionHints: ['established', 'since', 'years'], required: false, defaultValue: 0}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Architecture intelligence - focuses on firm size, project diversity, sustainability credentials, and industry recognition'
      }
    }
  },
  
  'construction-development': {
    id: 'construction-development',
    name: 'Construction & Development',
    description: 'For builders - reliability and timeline management',
    category: 'Real Estate',
    
    coreIdentity: {
      title: 'The Master Builder',
      positioning: 'Reliable, transparent, ruggedly professional, and timeline-driven',
      tone: 'Straightforward, competent, trustworthy'
    },
    
    cognitiveLogic: {
      framework: 'The Critical Path Framework',
      reasoning: 'Logic that emphasizes the "Build Sequence," safety protocols, and budget transparency. Focuses on "De-risking" the project for the owner',
      decisionProcess: 'Risk Assessment → Sequencing → Budget Control'
    },
    
    knowledgeRAG: {
      static: [
        'Material cost baselines',
        'Trade sequences (Foundation → Framing → MEP → Finishes)',
        'Safety regulations (OSHA)',
        'Quality control standards',
        'Warranty structures'
      ],
      dynamic: [
        'Current subcontractor availability',
        'Project gallery (completed work)',
        'Safety certifications and insurance',
        'Material pricing (lumber, steel, concrete)',
        'Weather delays and seasonal factors',
        'Permit status tracking'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Tracks lead anxiety regarding "Budget Overruns" and "Timeline Delays"',
      adaptation: 'Triggers a "Fixed-Price vs. Cost-Plus" educational module to address pricing concerns proactively',
      feedbackIntegration: 'Identifies which guarantees (timeline, budget, quality) are most important to different client types'
    },
    
    tacticalExecution: {
      primaryAction: 'Bid Request',
      conversionRhythm: 'Moves the lead toward submitting plans for a "Preliminary Estimate" or "Detailed Proposal"',
      secondaryActions: [
        'Project timeline estimate',
        'Material selection consultation',
        'Subcontractor vetting process',
        'Site visit scheduling',
        'Financing options discussion'
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
        {id: 'projects_completed', label: 'High Project Volume', description: 'Many completed projects', keywords: ["projects completed", "homes built", "developments"], regexPattern: '(\\d{2,})\\+?\\s*(projects?|homes?|developments?)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'custom_homes', label: 'Custom Home Builder', description: 'Custom residential construction', keywords: ["custom homes", "custom builder", "luxury homes", "estate homes"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'commercial_construction', label: 'Commercial Construction', description: 'Commercial project experience', keywords: ["commercial construction", "office building", "retail construction", "industrial"], priority: 'HIGH', action: 'add-to-segment', scoreBoost: 25, platform: 'website'},
        {id: 'design_build', label: 'Design-Build Services', description: 'Integrated design-build', keywords: ["design build", "design-build", "single source", "one stop"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'website'},
        {id: 'hiring', label: 'Hiring Construction Workers', description: 'Growing workforce', keywords: ["hiring", "now hiring", "careers", "join our team", "construction jobs"], priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'any'},
        {id: 'expansion', label: 'Business Expansion', description: 'New markets or locations', keywords: ["expanding", "new office", "now building in", "new market"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'certifications', label: 'Industry Certifications', description: 'Professional credentials', keywords: ["licensed", "insured", "bonded", "nahb", "certified"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'warranty', label: 'Warranty Program', description: 'Construction warranty offered', keywords: ["warranty", "guarantee", "quality assurance"], regexPattern: '(\\d+)\\s*year warranty', priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'green_building', label: 'Green Building', description: 'Sustainable construction', keywords: ["green building", "leed", "energy efficient", "sustainable", "net zero"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'subdivisions', label: 'Subdivision Development', description: 'Community development', keywords: ["subdivision", "community", "development", "master planned"], priority: 'CRITICAL', action: 'add-to-segment', scoreBoost: 35, platform: 'website'},
        {id: 'remodeling', label: 'Remodeling Services', description: 'Renovation/addition expertise', keywords: ["remodeling", "renovation", "additions", "home improvement"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'awards', label: 'Industry Awards', description: 'Builder awards or recognition', keywords: ["builder of the year", "parade of homes", "award winning", "best builder"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'safety_record', label: 'Safety Record', description: 'Emphasizes safety performance', keywords: ["safety", "osha", "zero accidents", "safety first"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'fixed_price', label: 'Fixed-Price Contracts', description: 'Guaranteed pricing', keywords: ["fixed price", "guaranteed price", "no surprises", "firm quote"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: 'timeline_guarantee', label: 'Timeline Guarantee', description: 'On-time completion promise', keywords: ["on-time", "timeline guarantee", "completion date", "scheduled completion"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'licensed', pattern: 'licensed.*insured.*bonded', description: 'License boilerplate', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms (of|and)', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'social', pattern: 'follow us', description: 'Social media', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'projects', pattern: '^projects$', description: 'Projects link', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'gallery', pattern: '^gallery$', description: 'Gallery', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'testimonials', pattern: '^testimonials$', description: 'Testimonials', context: 'header'},
        {id: 'process', pattern: '^process$', description: 'Process link', context: 'header'},
        {id: 'financing', pattern: '^financing$', description: 'Financing link', context: 'header'}
      ],

      scoringRules: [
        {id: 'large_builder', name: 'Large Builder', description: 'High project volume with team growth', condition: 'signals.some(s => s.signalId === "projects_completed") && signals.some(s => s.signalId === "hiring")', scoreBoost: 40, priority: 1, enabled: true},
        {id: 'design_build_firm', name: 'Design-Build Firm', description: 'Design-build with custom homes', condition: 'signals.some(s => s.signalId === "design_build") && signals.some(s => s.signalId === "custom_homes")', scoreBoost: 30, priority: 2, enabled: true},
        {id: 'developer', name: 'Developer', description: 'Subdivision development with volume', condition: 'signals.some(s => s.signalId === "subdivisions") && signals.some(s => s.signalId === "projects_completed")', scoreBoost: 40, priority: 3, enabled: true},
        {id: 'quality_focused', name: 'Quality-Focused', description: 'Awards with warranty', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "warranty")', scoreBoost: 25, priority: 4, enabled: true},
        {id: 'versatile_builder', name: 'Versatile Builder', description: 'Custom and commercial', condition: 'signals.some(s => s.signalId === "custom_homes") && signals.some(s => s.signalId === "commercial_construction")', scoreBoost: 28, priority: 5, enabled: true},
        {id: 'remodeling_specialist', name: 'Remodeling Specialist', description: 'Renovation focus with portfolio', condition: 'signals.some(s => s.signalId === "remodeling") && signals.some(s => s.signalId === "projects_completed")', scoreBoost: 20, priority: 6, enabled: true},
        {id: 'sustainable_builder', name: 'Sustainable Builder', description: 'Green building with certifications', condition: 'signals.some(s => s.signalId === "green_building") && signals.some(s => s.signalId === "certifications")', scoreBoost: 22, priority: 7, enabled: true},
        {id: 'reliable_contractor', name: 'Reliable Contractor', description: 'Timeline and price guarantees', condition: 'signals.some(s => s.signalId === "timeline_guarantee") && signals.some(s => s.signalId === "fixed_price")', scoreBoost: 25, priority: 8, enabled: true},
        {id: 'expanding_business', name: 'Expanding Business', description: 'Hiring with market expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 30, priority: 9, enabled: true},
        {id: 'safety_conscious', name: 'Safety-Conscious', description: 'Safety record with certifications', condition: 'signals.some(s => s.signalId === "safety_record") && signals.some(s => s.signalId === "certifications")', scoreBoost: 15, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'projects_completed', label: 'Projects Completed', type: 'number', description: 'Total completed projects', extractionHints: ['projects', 'homes built', 'completed'], required: false, defaultValue: 0},
        {key: 'construction_types', label: 'Construction Types', type: 'array', description: 'Project types handled', extractionHints: ['custom', 'commercial', 'remodeling'], required: false, defaultValue: []},
        {key: 'has_design_build', label: 'Design-Build Capabilities', type: 'boolean', description: 'Integrated services', extractionHints: ['design build'], required: false, defaultValue: false},
        {key: 'service_areas', label: 'Service Areas', type: 'array', description: 'Geographic coverage', extractionHints: ['serving', 'areas', 'cities'], required: false, defaultValue: []},
        {key: 'warranty_years', label: 'Warranty (Years)', type: 'number', description: 'Warranty period', extractionHints: ['year warranty', 'warranty'], required: false, defaultValue: 1},
        {key: 'specialization', label: 'Specialization', type: 'string', description: 'Primary focus', extractionHints: ['specialize', 'custom homes', 'commercial'], required: false, defaultValue: 'general'},
        {key: 'years_in_business', label: 'Years Established', type: 'number', description: 'Years operating', extractionHints: ['years', 'since', 'established'], required: false, defaultValue: 0}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Construction & development intelligence - focuses on project volume, service diversity, certifications, and growth indicators'
      }
    }
  },
  
  'title-escrow': {
    id: 'title-escrow',
    name: 'Title & Escrow',
    description: 'For title/escrow companies - compliance and security focus',
    category: 'Real Estate',
    
    coreIdentity: {
      title: 'The Neutral Third-Party / The Deal Closer',
      positioning: 'Calm, precise, legally rigorous, and administrative',
      tone: 'Professional, reassuring, detail-oriented'
    },
    
    cognitiveLogic: {
      framework: 'The Compliance & Security Logic',
      reasoning: 'Focuses on "Clear Title," "Wire Fraud Protection," and the "Final Milestone" of the transaction',
      decisionProcess: 'Title Verification → Risk Mitigation → Secure Closing'
    },
    
    knowledgeRAG: {
      static: [
        'Closing disclosure requirements',
        'Lien search protocols',
        'ALTA (American Land Title Association) standards',
        'Title insurance types',
        'Escrow disbursement rules',
        'Recording procedures'
      ],
      dynamic: [
        'Fee calculators by state/county',
        'Current turn-around times',
        'Firm-specific wire instructions (secured)',
        'Title clearance status',
        'Closing cost breakdowns',
        'Document tracking'
      ]
    },
    
    learningLoops: {
      patternRecognition: 'Monitors common "Closing Friction" questions (wire fraud, unclear fees, timeline delays)',
      adaptation: 'Prompts the agent to proactively explain things like "Prerecorded documents" to first-time sellers/buyers',
      feedbackIntegration: 'Identifies which security measures (wire verification, fraud prevention) resonate most with different client types'
    },
    
    tacticalExecution: {
      primaryAction: 'Order Initiation',
      conversionRhythm: 'Focuses on getting the "Purchase Agreement" uploaded to open the file and begin title search',
      secondaryActions: [
        'Wire fraud protection education',
        'Closing cost estimate',
        'Timeline confirmation',
        'Document checklist provision',
        'Secure portal setup'
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
        {id: 'transaction_volume', label: 'High Transaction Volume', description: 'Many closings per year', keywords: ["transactions", "closings", "files closed"], regexPattern: '([\\d,]+)\\s*(transactions?|closings?)', priority: 'CRITICAL', action: 'increase-score', scoreBoost: 40, platform: 'website'},
        {id: 'multi_state', label: 'Multi-State Operations', description: 'Licensed in multiple states', keywords: ["licensed in", "serving", "states"], regexPattern: 'licensed? in (\\d+) states?', priority: 'HIGH', action: 'increase-score', scoreBoost: 30, platform: 'website'},
        {id: 'hiring', label: 'Hiring Escrow Officers', description: 'Growing team', keywords: ["hiring", "join our team", "careers", "escrow officer", "title examiner"], priority: 'HIGH', action: 'increase-score', scoreBoost: 28, platform: 'any'},
        {id: 'expansion', label: 'Office Expansion', description: 'New offices or markets', keywords: ["new office", "expanding", "now serving", "new location"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'any'},
        {id: 'wire_fraud_protection', label: 'Wire Fraud Protection', description: 'Advanced security measures', keywords: ["wire fraud", "fraud protection", "secure wire", "verified wiring", "wire verification"], priority: 'CRITICAL', action: 'increase-score', scoreBoost: 35, platform: 'website'},
        {id: 'online_closing', label: 'Online/Remote Closing', description: 'Digital closing capability', keywords: ["remote closing", "online closing", "e-closing", "digital closing", "notary"], priority: 'HIGH', action: 'increase-score', scoreBoost: 25, platform: 'website'},
        {id: 'commercial_title', label: 'Commercial Title', description: 'Commercial transaction expertise', keywords: ["commercial", "commercial title", "business transactions", "investment properties"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 18, platform: 'website'},
        {id: 'refinance_specialist', label: 'Refinance Services', description: 'Refinance focus', keywords: ["refinance", "refi", "refinancing"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'fast_turnaround', label: 'Fast Turnaround', description: 'Quick closing time', keywords: ["fast closing", "quick turnaround", "rush service"], regexPattern: '(\\d+)\\s*day (closing|turnaround)', priority: 'HIGH', action: 'increase-score', scoreBoost: 20, platform: 'website'},
        {id: 'underwriter_direct', label: 'Direct Underwriter', description: 'Owned by underwriter', keywords: ["underwriter", "direct", "first american", "fidelity", "old republic"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'},
        {id: '1031_exchange', label: '1031 Exchange Services', description: 'Qualified intermediary', keywords: ["1031", "qualified intermediary", "exchange", "tax-deferred"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 15, platform: 'website'},
        {id: 'builder_services', label: 'Builder Services', description: 'New construction closings', keywords: ["builder services", "new construction", "builder", "construction closings"], priority: 'MEDIUM', action: 'add-to-segment', scoreBoost: 12, platform: 'website'},
        {id: 'mobile_closing', label: 'Mobile Closing', description: 'Notary travels to client', keywords: ["mobile closing", "we come to you", "convenient closing", "travel"], priority: 'LOW', action: 'increase-score', scoreBoost: 10, platform: 'website'},
        {id: 'customer_portal', label: 'Online Portal', description: 'Client portal access', keywords: ["online portal", "client portal", "document portal", "secure access"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 12, platform: 'website'},
        {id: 'awards', label: 'Industry Recognition', description: 'Awards or top company status', keywords: ["award", "best title", "top company", "recognition"], priority: 'MEDIUM', action: 'increase-score', scoreBoost: 15, platform: 'website'}
      ],

      fluffPatterns: [
        {id: 'copyright', pattern: '©\\s*\\d{4}', description: 'Copyright', context: 'footer'},
        {id: 'rights', pattern: 'all rights reserved', description: 'Rights', context: 'footer'},
        {id: 'privacy', pattern: 'privacy policy', description: 'Privacy', context: 'footer'},
        {id: 'terms', pattern: 'terms (of|and)', description: 'Terms', context: 'footer'},
        {id: 'cookies', pattern: 'cookies', description: 'Cookie notice', context: 'all'},
        {id: 'licensed', pattern: 'licensed.*regulated', description: 'License notice', context: 'footer'},
        {id: 'social', pattern: 'follow us', description: 'Social media', context: 'footer'},
        {id: 'contact', pattern: '^contact$', description: 'Contact link', context: 'header'},
        {id: 'about', pattern: '^about$', description: 'About link', context: 'header'},
        {id: 'services', pattern: '^services$', description: 'Services', context: 'header'},
        {id: 'locations', pattern: '^locations$', description: 'Locations', context: 'header'},
        {id: 'back_top', pattern: 'back to top', description: 'Back to top', context: 'footer'},
        {id: 'sitemap', pattern: 'sitemap', description: 'Sitemap', context: 'footer'},
        {id: 'powered', pattern: 'powered by', description: 'Attribution', context: 'footer'},
        {id: 'careers', pattern: '^careers$', description: 'Careers', context: 'header'},
        {id: 'blog', pattern: '^blog$', description: 'Blog', context: 'header'},
        {id: 'calculator', pattern: '^calculator$', description: 'Calculator', context: 'header'},
        {id: 'faq', pattern: '^faq$', description: 'FAQ', context: 'header'},
        {id: 'portal', pattern: '^portal$', description: 'Portal link', context: 'header'},
        {id: 'resources', pattern: '^resources$', description: 'Resources', context: 'header'}
      ],

      scoringRules: [
        {id: 'high_volume_operator', name: 'High-Volume Operator', description: 'High transactions with multi-state presence', condition: 'signals.some(s => s.signalId === "transaction_volume") && signals.some(s => s.signalId === "multi_state")', scoreBoost: 45, priority: 1, enabled: true},
        {id: 'security_leader', name: 'Security Leader', description: 'Wire fraud protection with online portal', condition: 'signals.some(s => s.signalId === "wire_fraud_protection") && signals.some(s => s.signalId === "customer_portal")', scoreBoost: 30, priority: 2, enabled: true},
        {id: 'modern_company', name: 'Modern Company', description: 'Online closing with digital portal', condition: 'signals.some(s => s.signalId === "online_closing") && signals.some(s => s.signalId === "customer_portal")', scoreBoost: 25, priority: 3, enabled: true},
        {id: 'growing_business', name: 'Growing Business', description: 'Hiring with expansion', condition: 'signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")', scoreBoost: 30, priority: 4, enabled: true},
        {id: 'versatile_services', name: 'Versatile Services', description: 'Residential and commercial', condition: 'signals.some(s => s.signalId === "commercial_title")', scoreBoost: 18, priority: 5, enabled: true},
        {id: 'speed_service', name: 'Speed Service', description: 'Fast turnaround with high volume', condition: 'signals.some(s => s.signalId === "fast_turnaround") && signals.some(s => s.signalId === "transaction_volume")', scoreBoost: 25, priority: 6, enabled: true},
        {id: 'builder_partner', name: 'Builder Partner', description: 'Builder services with volume', condition: 'signals.some(s => s.signalId === "builder_services") && signals.some(s => s.signalId === "transaction_volume")', scoreBoost: 20, priority: 7, enabled: true},
        {id: 'exchange_specialist', name: '1031 Exchange Specialist', description: '1031 services with commercial title', condition: 'signals.some(s => s.signalId === "1031_exchange") && signals.some(s => s.signalId === "commercial_title")', scoreBoost: 22, priority: 8, enabled: true},
        {id: 'convenience_focused', name: 'Convenience-Focused', description: 'Mobile and online closing', condition: 'signals.some(s => s.signalId === "mobile_closing") && signals.some(s => s.signalId === "online_closing")', scoreBoost: 18, priority: 9, enabled: true},
        {id: 'recognized_company', name: 'Recognized Company', description: 'Awards with high volume', condition: 'signals.some(s => s.signalId === "awards") && signals.some(s => s.signalId === "transaction_volume")', scoreBoost: 25, priority: 10, enabled: true}
      ],

      customFields: [
        {key: 'annual_transactions', label: 'Annual Transactions', type: 'number', description: 'Yearly closing volume', extractionHints: ['transactions', 'closings', 'files'], required: false, defaultValue: 0},
        {key: 'states_licensed', label: 'States Licensed', type: 'number', description: 'Multi-state presence', extractionHints: ['states', 'licensed in'], required: false, defaultValue: 1},
        {key: 'office_count', label: 'Office Locations', type: 'number', description: 'Number of offices', extractionHints: ['offices', 'locations'], required: false, defaultValue: 1},
        {key: 'has_online_closing', label: 'Offers Online Closing', type: 'boolean', description: 'Remote closing available', extractionHints: ['online', 'remote', 'e-closing'], required: false, defaultValue: false},
        {key: 'has_wire_protection', label: 'Wire Fraud Protection', type: 'boolean', description: 'Advanced security', extractionHints: ['wire fraud', 'security'], required: false, defaultValue: false},
        {key: 'avg_turnaround_days', label: 'Average Turnaround (Days)', type: 'number', description: 'Typical closing time', extractionHints: ['days', 'turnaround', 'closing time'], required: false, defaultValue: 30},
        {key: 'specialization', label: 'Market Focus', type: 'string', description: 'Primary market', extractionHints: ['residential', 'commercial', 'refinance'], required: false, defaultValue: 'residential'}
      ],

      metadata: {
        lastUpdated: '2025-12-29',
        version: 1,
        updatedBy: 'system',
        notes: 'Title & escrow intelligence - focuses on transaction volume, security features, service speed, and geographic reach'
      }
    }
  },
  
  // ============================================
};
