/**
 * Industry-Specific Persona Templates
 * 
 * 50 specialized templates using 5-section format:
 * 🧠 Core Identity
 * 🧠 Cognitive Logic
 * 📚 Knowledge & RAG
 * 🔄 Learning Loops
 * ⚡ Tactical Execution
 * 
 * Progress: 50/50 (100%) ✅ COMPLETE
 */

import type { ResearchIntelligence } from '@/types/scraper-intelligence';
import { ResearchIntelligenceSchema } from '@/types/scraper-intelligence';

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  category: string; // For grouping (e.g., 'Real Estate', 'SaaS', 'Healthcare')
  
  coreIdentity: {
    title: string;
    positioning: string;
    tone: string;
  };
  
  cognitiveLogic: {
    framework: string;
    reasoning: string;
    decisionProcess: string;
  };
  
  knowledgeRAG: {
    static: string[];  // Fixed industry knowledge
    dynamic: string[]; // Real-time data sources
  };
  
  learningLoops: {
    patternRecognition: string;
    adaptation: string;
    feedbackIntegration: string;
  };
  
  tacticalExecution: {
    primaryAction: string;
    conversionRhythm: string;
    secondaryActions: string[];
  };

  /**
   * Research Intelligence (NEW)
   * 
   * Guides the web scraper on what data to extract, where to look,
   * and how to score leads for this industry.
   * 
   * Optional for backward compatibility with existing templates.
   * 
   * @see ResearchIntelligence for full type definition
   */
  research?: ResearchIntelligence;
}

/**
 * INDUSTRY TEMPLATES REGISTRY
 * Add new templates as they are created
 */
export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  
  // ============================================
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
        lastUpdated: new Date('2025-12-28'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
        version: 1,
        updatedBy: 'system',
        notes: 'Title & escrow intelligence - focuses on transaction volume, security features, service speed, and geographic reach'
      }
    }
  },
  
  // ============================================
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
      metadata: {lastUpdated: new Date('2025-12-28'), version: 1, updatedBy: 'system', notes: 'Dental practice intelligence - growth, specialties, technology'}
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
      metadata: {lastUpdated: new Date('2025-12-28'), version: 1, updatedBy: 'system', notes: 'Gym/CrossFit intelligence - growth, programs, amenities'}
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-28'),
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
        lastUpdated: new Date('2025-12-29'),
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
      metadata: {lastUpdated: new Date('2025-12-28'), version: 1, updatedBy: 'system', notes: 'Digital marketing agency intelligence - growth, services, credentials'}
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
      metadata: {lastUpdated: new Date('2025-12-28'), version: 1, updatedBy: 'system', notes: 'E-commerce intelligence - growth, business model, customer satisfaction'}
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
        lastUpdated: new Date('2025-12-29'),
        version: 1,
        updatedBy: 'system',
        notes: 'BioTech intelligence - focuses on clinical progress, funding, regulatory milestones, IP strength, and commercialization readiness'
      }
    }
  },
  
  // ============================================
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-28'),
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
      metadata: {lastUpdated: new Date('2025-12-28'), version: 1, updatedBy: 'system', notes: 'Roofing intelligence - insurance claims, storm damage, growth indicators'}
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
      metadata: {lastUpdated: new Date('2025-12-28'), version: 1, updatedBy: 'system', notes: 'Personal injury law intelligence - results, growth, trial capability'}
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
        lastUpdated: new Date('2025-12-29'),
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
      metadata: {lastUpdated: new Date('2025-12-28'), version: 1, updatedBy: 'system', notes: 'Mexican restaurant intelligence - growth, services, customer experience'}
    }
  }
  
  // ============================================
  // ALL 50 TEMPLATES COMPLETE! ✅
  // Progress: 50/50 (100%)
  // 
  // Sectors:
  // - Real Estate (10)
  // - Healthcare & Wellness (10)
  // - Technology & Business Services (10)
  // - Home Services (10)
  // - Professional Services & Specialty (10)
  // ============================================
};

/**
 * Get list of available industries for dropdown
 */
export function getIndustryOptions(): Array<{ 
  value: string; 
  label: string; 
  description: string;
  category: string;
}> {
  return Object.entries(INDUSTRY_TEMPLATES).map(([id, template]) => ({
    value: id,
    label: template.name,
    description: template.description,
    category: template.category
  }));
}

/**
 * Get template by industry ID
 */
export function getIndustryTemplate(industryId: string): IndustryTemplate | null {
  return INDUSTRY_TEMPLATES[industryId] || null;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): IndustryTemplate[] {
  return Object.values(INDUSTRY_TEMPLATES).filter(t => t.category === category);
}

/**
 * Get all categories
 */
export function getCategories(): string[] {
  const categories = new Set(Object.values(INDUSTRY_TEMPLATES).map(t => t.category));
  return Array.from(categories).sort();
}

/**
 * Check if an industry has a specialized template
 */
export function hasTemplate(industryId: string): boolean {
  return industryId in INDUSTRY_TEMPLATES;
}

/**
 * Get template count
 */
export function getTemplateCount(): { total: number; byCategory: Record<string, number> } {
  const byCategory: Record<string, number> = {};
  
  Object.values(INDUSTRY_TEMPLATES).forEach(template => {
    byCategory[template.category] = (byCategory[template.category] || 0) + 1;
  });
  
  return {
    total: Object.keys(INDUSTRY_TEMPLATES).length,
    byCategory
  };
}

// ============================================================================
// RESEARCH INTELLIGENCE HELPERS
// ============================================================================

/**
 * Check if a template has research intelligence configured
 */
export function hasResearchIntelligence(template: IndustryTemplate): boolean {
  return template.research !== undefined && template.research !== null;
}

/**
 * Get research intelligence from template, or return null
 */
export function getResearchIntelligence(
  template: IndustryTemplate
): ResearchIntelligence | null {
  return template.research ?? null;
}

/**
 * Get industry template by ID
 */
export function getTemplateById(templateId: string): IndustryTemplate | null {
  return INDUSTRY_TEMPLATES[templateId] ?? null;
}

/**
 * Get research intelligence by industry ID
 */
export function getResearchIntelligenceById(
  industryId: string
): ResearchIntelligence | null {
  const template = getTemplateById(industryId);
  return template ? getResearchIntelligence(template) : null;
}

/**
 * Get all templates that have research intelligence configured
 */
export function getTemplatesWithResearch(): IndustryTemplate[] {
  return Object.values(INDUSTRY_TEMPLATES).filter(hasResearchIntelligence);
}

/**
 * Validate research intelligence configuration
 */
export function validateResearchIntelligence(
  research: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    ResearchIntelligenceSchema.parse(research);
    return { valid: true, errors: [] };
  } catch (error: any) {
    if (error.errors) {
      error.errors.forEach((err: any) => {
        errors.push(`${err.path.join('.')}: ${err.message}`);
      });
    } else {
      errors.push(error.message || 'Unknown validation error');
    }
    return { valid: false, errors };
  }
}
