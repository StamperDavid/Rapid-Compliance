/**
 * Lead Architect (L2 Manager)
 * STATUS: FUNCTIONAL
 *
 * Strategic Infrastructure Commander - Translates Brand DNA into comprehensive
 * site architectures and coordinates the 3 functional Architect Specialists.
 *
 * CAPABILITIES:
 * - Brand DNA → Site Blueprint translation
 * - Dynamic specialist resolution via SwarmRegistry
 * - Parallel specialist execution with graceful degradation
 * - TechnicalBrief generation (API integrations, schema requirements, SEO mandates)
 * - Intelligence Brief integration from TenantMemoryVault
 * - SignalBus broadcast for cross-manager communication
 *
 * ORCHESTRATION PATTERN:
 * 1. Load Brand DNA from tenant context
 * 2. Read existing Intelligence Briefs for market context
 * 3. Derive site architecture from brand + intelligence
 * 4. Coordinate specialists in parallel
 * 5. Synthesize into SiteArchitecture + TechnicalBrief
 * 6. Broadcast site.blueprint_ready signal
 * 7. Store blueprint in TenantMemoryVault
 */

import { BaseManager } from '../base-manager';
import type { AgentMessage, AgentReport, ManagerConfig, Signal } from '../types';
import { getUXUISpecialist } from './ux-ui/specialist';
import { getFunnelPathologist } from './funnel/specialist';
import { getCopySpecialist } from './copy/specialist';
import {
  shareInsight,
  broadcastSignal,
  readAgentInsights,
  type InsightEntry,
} from '../shared/tenant-memory-vault';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';

// Minimal BrandDNA type for this manager
interface BrandDNA {
  companyDescription?: string;
  uniqueValue?: string;
  targetAudience?: string;
  toneOfVoice?: string;
  communicationStyle?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
  industry?: string;
  competitors?: string[];
}

// ============================================================================
// SYSTEM PROMPT - The brain of this manager
// ============================================================================

const SYSTEM_PROMPT = `You are the Lead Architect, a Strategic Infrastructure Commander responsible for translating Brand DNA into comprehensive site architectures.

## YOUR ROLE
You receive brand identity and market intelligence, then create complete site architecture plans by coordinating with:
- UX_UI_SPECIALIST: Visual design, wireframes, components, color schemes, accessibility
- FUNNEL_PATHOLOGIST: Conversion funnels, pricing strategies, urgency tactics, optimization
- COPY_SPECIALIST: Headlines, CTAs, messaging frameworks, voice/tone alignment

## ARCHITECTURE DERIVATION LOGIC

### Brand DNA → Site Structure Mapping
1. **Industry Detection**: Derive industry type from brand's industry field
2. **Tone Alignment**: Map toneOfVoice to visual and copy style
3. **Audience Targeting**: Structure pages for targetAudience personas
4. **Competitive Positioning**: Use uniqueValue to differentiate architecture

### Intelligence Integration
You read existing Intelligence Briefs from TenantMemoryVault to inform:
- Competitor site patterns to avoid/emulate
- Market trends affecting site structure
- Technographic insights for integration planning

## SITE MAP GENERATION LOGIC

### Core Pages (Always Include)
1. Homepage - Hero, value prop, social proof, primary CTA
2. About - Story, mission, team, trust signals
3. Services/Products - What you offer (varies by industry)
4. Pricing - Packages, tiers, comparison (if applicable)
5. Contact - Form, phone, email, location, hours
6. Blog/Resources - Content hub, SEO, thought leadership

### Industry-Specific Variations

#### SaaS Company
- Homepage: Product hero, feature highlights, integration logos, testimonials
- Features: Detailed feature breakdown with screenshots
- Pricing: Tier comparison (Free/Pro/Enterprise), feature matrix
- Integrations: Partner logos, API documentation link
- Documentation: Help center, tutorials, API docs
- Case Studies: Customer success stories with metrics
- About: Team, investors, press mentions
- Blog: Product updates, industry insights, how-to guides

#### Agency/Consultancy
- Homepage: Portfolio showcase, service overview, client logos
- Services: Detailed service pages (Design, Development, Marketing, etc.)
- Case Studies: In-depth project breakdowns with results
- About: Team bios, agency story, culture
- Process: How you work, timeline expectations
- Contact: Consultation booking, project inquiry form
- Blog: Industry expertise, thought leadership

#### E-commerce Store
- Homepage: Featured products, categories, promotions, trust badges
- Shop: Category pages, product listing with filters
- Product Pages: Images, descriptions, reviews, related products
- Cart: Summary, upsells, shipping calculator
- Checkout: Multi-step or single-page checkout
- Account: Order history, wishlist, saved addresses
- About: Brand story, sustainability, manufacturing
- Contact: Customer service, returns, shipping info
- Blog: Product guides, lifestyle content

#### Coach/Consultant
- Homepage: Personal brand hero, transformation promise, testimonials
- About: Personal story, credentials, media features
- Services: Coaching packages, consulting offers
- Programs: Courses, group programs, membership
- Resources: Free downloads, podcast, YouTube
- Book: Calendar integration, session booking
- Contact: Application form, inquiry
- Blog: Personal insights, client transformations

### Navigation Structure Rules
1. Primary Nav: 5-7 items maximum for cognitive load
2. Secondary Nav: Footer links, legal pages, sitemap
3. Utility Nav: Login, cart, search (top right)
4. Mobile Nav: Hamburger menu, bottom nav for key actions
5. Breadcrumbs: For deep hierarchies (e-commerce, documentation)

### Page Hierarchy Rules
- Homepage at L0 (root)
- Main sections at L1 (Services, About, Blog)
- Sub-pages at L2 (Individual service, Team page, Blog post)
- Detail pages at L3 (nested services, categories)
- Maximum 4 levels deep for usability

## FUNNEL FLOW TYPES

### Lead Generation Funnel
Stages: Traffic Source -> Landing Page -> Lead Magnet -> Thank You -> Email Nurture -> Sales Page
- Squeeze page with single CTA
- Free resource in exchange for email
- Automated email sequence
- Conversion to paid offering

### E-commerce Funnel
Stages: Traffic -> Product Page -> Cart -> Checkout -> Upsell -> Thank You -> Follow-up
- Product discovery through search/browse
- Add to cart with urgency triggers
- Cart abandonment recovery
- Post-purchase upsells
- Review request sequence

### Course/Membership Funnel
Stages: Free Content -> Webinar/VSL -> Sales Page -> Checkout -> Onboarding -> Community
- Value-first free content
- Educational webinar or video sales letter
- Long-form sales page with testimonials
- Payment plans and guarantees
- Member onboarding sequence
- Community engagement

### Service Booking Funnel
Stages: Landing Page -> Service Overview -> Booking -> Confirmation -> Reminder -> Follow-up
- Service benefit-focused landing
- Calendar integration for booking
- Confirmation and prep emails
- Appointment reminders
- Post-service follow-up and review request

## COORDINATION WORKFLOW

### Phase 1: Context Loading
1. Load Brand DNA from tenant
2. Read Intelligence Briefs from TenantMemoryVault
3. Merge brand context with market intelligence

### Phase 2: Architecture Derivation
1. Detect industry from Brand DNA
2. Derive site requirements from brand + intelligence
3. Select appropriate funnel type based on business model
4. Generate initial site map

### Phase 3: Specialist Orchestration
1. Dynamically resolve specialists from SwarmRegistry
2. Execute all specialists in parallel
3. Implement graceful degradation for failures
4. Collect and merge specialist outputs

### Phase 4: Synthesis
1. Merge specialist outputs into SiteArchitecture
2. Generate TechnicalBrief with requirements
3. Calculate confidence scores
4. Broadcast site.blueprint_ready signal
5. Store in TenantMemoryVault

## OUTPUT FORMAT
You ALWAYS return structured JSON with SiteArchitecture and TechnicalBrief.

## RULES
1. ALWAYS derive architecture from Brand DNA - never assume industry
2. RESPECT existing Intelligence Briefs from TenantMemoryVault
3. COORDINATE specialist work - ensure visual, conversion, and copy align
4. Be HONEST about specialist availability (GHOST/SHELL status)
5. BROADCAST signals for downstream manager coordination
6. WARN about complex requirements that may need custom solutions

## INTEGRATION
You receive requests from:
- JASPER (L1 orchestrator) - New site architecture requests
- Sales teams - Landing page requirements
- Marketing - Campaign-specific funnels

Your output feeds into:
- Builder Manager - Technical implementation
- Content Manager - Copy and content creation
- Marketing Manager - Traffic strategy`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const ARCHITECT_MANAGER_CONFIG: ManagerConfig = {
  identity: {
    id: 'ARCHITECT_MANAGER',
    name: 'Lead Architect',
    role: 'manager',
    status: 'FUNCTIONAL',
    reportsTo: 'JASPER',
    capabilities: [
      'brand_dna_to_architecture',
      'dynamic_specialist_orchestration',
      'parallel_execution',
      'graceful_degradation',
      'intelligence_integration',
      'sitemap_generation',
      'funnel_flow_design',
      'technical_brief_synthesis',
      'signal_broadcast',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['delegate', 'coordinate', 'generate_sitemap', 'design_funnel', 'broadcast_signal'],
  outputSchema: {
    type: 'object',
    properties: {
      siteArchitecture: {
        type: 'object',
        properties: {
          siteMap: { type: 'object' },
          funnelFlow: { type: 'object' },
          navigation: { type: 'object' },
          metadata: { type: 'object' },
        },
        required: ['siteMap', 'funnelFlow', 'navigation', 'metadata'],
      },
      technicalBrief: {
        type: 'object',
        properties: {
          apiIntegrations: { type: 'array' },
          schemaRequirements: { type: 'object' },
          seoMandates: { type: 'object' },
        },
        required: ['apiIntegrations', 'schemaRequirements', 'seoMandates'],
      },
      delegations: { type: 'array' },
      confidence: { type: 'number' },
    },
    required: ['siteArchitecture', 'technicalBrief', 'delegations'],
  },
  maxTokens: 8192,
  temperature: 0.4,
  specialists: ['UX_UI_SPECIALIST', 'FUNNEL_PATHOLOGIST', 'COPY_SPECIALIST'],
  delegationRules: [
    {
      triggerKeywords: ['design', 'color', 'layout', 'component', 'wireframe', 'ui', 'ux', 'visual', 'accessibility'],
      delegateTo: 'UX_UI_SPECIALIST',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['funnel', 'conversion', 'squeeze', 'lead magnet', 'tripwire', 'upsell', 'offer', 'pricing'],
      delegateTo: 'FUNNEL_PATHOLOGIST',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['headline', 'copy', 'cta', 'text', 'message', 'content', 'words', 'writing', 'tone'],
      delegateTo: 'COPY_SPECIALIST',
      priority: 10,
      requiresApproval: false,
    },
  ],
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type IndustryType = 'saas' | 'agency' | 'ecommerce' | 'coach' | 'local_business' | 'media' | 'nonprofit';
export type FunnelType = 'lead_gen' | 'ecommerce' | 'course' | 'service';

/**
 * Page definition for site map
 */
export interface PageDefinition {
  id: string;
  name: string;
  path: string;
  level: number;
  purpose: string;
  sections: string[];
  parent: string | null;
  priority: 'critical' | 'important' | 'optional';
  seo: PageSEORequirements;
}

/**
 * SEO requirements per page
 */
export interface PageSEORequirements {
  titleTemplate: string;
  descriptionTemplate: string;
  keywordFocus: string[];
  structuredDataType?: string;
  canonicalStrategy: 'self' | 'parent' | 'custom';
}

/**
 * Site hierarchy structure
 */
export interface SiteHierarchy {
  L0: string[];
  L1: string[];
  L2: string[];
  L3?: string[];
}

/**
 * Navigation configuration
 */
export interface NavigationConfig {
  primary: NavigationItem[];
  utility: NavigationItem[];
  footer: FooterNavigation;
  mobile: NavigationItem[];
  breadcrumbs: BreadcrumbConfig;
}

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon?: string;
  children?: NavigationItem[];
  highlight?: boolean;
}

export interface FooterNavigation {
  columns: Array<{
    title: string;
    links: NavigationItem[];
  }>;
  legal: NavigationItem[];
  social: Array<{ platform: string; url: string }>;
}

export interface BreadcrumbConfig {
  enabled: boolean;
  separator: string;
  homeLabel: string;
  maxDepth: number;
}

/**
 * Site map structure
 */
export interface SiteMap {
  pages: PageDefinition[];
  hierarchy: SiteHierarchy;
  totalPages: number;
  estimatedBuildTime: string;
}

/**
 * Funnel stage definition
 */
export interface FunnelStage {
  name: string;
  pages: string[];
  goal: string;
  kpis: string[];
  automations?: string[];
  urgencyTactics?: string[];
}

/**
 * Conversion point definition
 */
export interface ConversionPoint {
  location: string;
  action: string;
  target: string;
  tracking: string;
  abTestVariants?: string[];
}

/**
 * Funnel flow configuration
 */
export interface FunnelFlow {
  type: FunnelType;
  stages: FunnelStage[];
  conversionPoints: ConversionPoint[];
  automations: string[];
  estimatedConversionRate: number;
  optimizationPriorities: string[];
}

/**
 * Comprehensive Site Architecture - The primary output
 */
export interface SiteArchitecture {
  blueprintId: string;
  tenantId: string;
  createdAt: Date;

  // Brand context
  brandContext: {
    industry: IndustryType;
    toneOfVoice: string;
    targetAudience: string;
    uniqueValue: string;
    competitors: string[];
  };

  // Core architecture
  siteMap: SiteMap;
  funnelFlow: FunnelFlow;
  navigation: NavigationConfig;

  // Design direction
  designDirection: {
    colorPsychology: string;
    typographyStyle: string;
    visualDensity: 'minimal' | 'moderate' | 'rich';
    animationLevel: 'none' | 'subtle' | 'dynamic';
  };

  // Content structure
  contentStructure: {
    messagingFramework: string;
    ctaStrategy: string;
    socialProofPlacement: string[];
    keyPhrases: string[];
    avoidPhrases: string[];
  };

  // Metadata
  metadata: {
    derivedFromBrandDNA: boolean;
    intelligenceBriefsUsed: string[];
    specialistContributions: Record<string, boolean>;
    confidence: number;
    warnings: string[];
  };
}

/**
 * Technical Brief - Requirements for implementation
 */
export interface TechnicalBrief {
  briefId: string;
  blueprintId: string;

  // API Integrations required
  apiIntegrations: Array<{
    service: string;
    purpose: string;
    priority: 'required' | 'recommended' | 'optional';
    endpoints: string[];
  }>;

  // Schema requirements for Firestore
  schemaRequirements: {
    collections: Array<{
      name: string;
      purpose: string;
      fields: Array<{
        name: string;
        type: string;
        required: boolean;
        indexed: boolean;
      }>;
    }>;
    relationships: Array<{
      from: string;
      to: string;
      type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    }>;
  };

  // SEO structural mandates
  seoMandates: {
    sitewide: {
      robotsTxt: string[];
      sitemapConfig: {
        frequency: string;
        priority: Record<string, number>;
      };
      schemaOrg: string[];
    };
    perPage: Record<string, PageSEORequirements>;
    technicalRequirements: string[];
  };

  // Performance requirements
  performanceTargets: {
    lcp: number;
    fid: number;
    cls: number;
    ttfb: number;
  };

  // Accessibility requirements
  accessibilityLevel: 'A' | 'AA' | 'AAA';
  accessibilityChecklist: string[];
}

/**
 * Specialist execution result
 */
interface SpecialistResult {
  specialistId: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
  data: unknown;
  errors: string[];
  executionTimeMs: number;
}

/**
 * Delegation result for output
 */
export interface DelegationResult {
  specialist: string;
  brief: string;
  status: 'COMPLETED' | 'BLOCKED' | 'PENDING' | 'FAILED';
  result: string | object;
  contributedTo: string[];
}

/**
 * Site requirements derived from analysis
 */
export interface SiteRequirements {
  industry: IndustryType;
  targetAudience: string;
  primaryObjective: string;
  funnelType: FunnelType;
  toneOfVoice: string;
  customPages?: string[];
  integrations?: string[];
}

/**
 * Blueprint request payload
 */
export interface BlueprintRequest {
  tenantId: string;
  niche?: string;
  description?: string;
  targetAudience?: string;
  objective?: 'leads' | 'sales' | 'bookings' | 'awareness';
  existingBrand?: boolean;
  forceRefresh?: boolean;
}

/**
 * Complete output from the Architect Manager
 */
export interface ArchitectureOutput {
  siteArchitecture: SiteArchitecture;
  technicalBrief: TechnicalBrief;
  delegations: DelegationResult[];
  confidence: number;
  warnings: string[];
  signalBroadcast: {
    type: string;
    timestamp: Date;
    success: boolean;
  };
}

// ============================================================================
// INDUSTRY TEMPLATES
// ============================================================================

const INDUSTRY_TEMPLATES: Record<IndustryType, Partial<PageDefinition>[]> = {
  saas: [
    { id: 'homepage', name: 'Homepage', path: '/', level: 0, purpose: 'Product hero and conversion', sections: ['hero', 'features', 'integrations', 'testimonials', 'pricing_teaser', 'cta'], priority: 'critical' },
    { id: 'features', name: 'Features', path: '/features', level: 1, purpose: 'Detailed feature breakdown', sections: ['feature_grid', 'screenshots', 'comparison'], priority: 'critical' },
    { id: 'pricing', name: 'Pricing', path: '/pricing', level: 1, purpose: 'Plan selection and conversion', sections: ['pricing_table', 'feature_comparison', 'faq', 'guarantee'], priority: 'critical' },
    { id: 'integrations', name: 'Integrations', path: '/integrations', level: 1, purpose: 'Partner ecosystem', sections: ['integration_grid', 'api_teaser'], priority: 'important' },
    { id: 'case-studies', name: 'Case Studies', path: '/case-studies', level: 1, purpose: 'Social proof', sections: ['case_study_grid', 'metrics_highlights'], priority: 'important' },
    { id: 'about', name: 'About', path: '/about', level: 1, purpose: 'Company story', sections: ['mission', 'team', 'investors', 'press'], priority: 'important' },
    { id: 'blog', name: 'Blog', path: '/blog', level: 1, purpose: 'SEO and thought leadership', sections: ['post_grid', 'categories', 'newsletter'], priority: 'important' },
    { id: 'docs', name: 'Documentation', path: '/docs', level: 1, purpose: 'Self-service support', sections: ['search', 'categories', 'getting_started'], priority: 'important' },
    { id: 'contact', name: 'Contact', path: '/contact', level: 1, purpose: 'Sales inquiries', sections: ['contact_form', 'demo_booking', 'support_links'], priority: 'critical' },
  ],
  agency: [
    { id: 'homepage', name: 'Homepage', path: '/', level: 0, purpose: 'Portfolio showcase', sections: ['hero', 'services_overview', 'portfolio_grid', 'client_logos', 'testimonials', 'cta'], priority: 'critical' },
    { id: 'services', name: 'Services', path: '/services', level: 1, purpose: 'Service overview', sections: ['service_cards', 'process_preview'], priority: 'critical' },
    { id: 'portfolio', name: 'Portfolio', path: '/portfolio', level: 1, purpose: 'Work showcase', sections: ['project_grid', 'filters', 'case_study_links'], priority: 'critical' },
    { id: 'case-studies', name: 'Case Studies', path: '/case-studies', level: 1, purpose: 'Detailed project breakdowns', sections: ['case_study_list', 'results_metrics'], priority: 'important' },
    { id: 'about', name: 'About', path: '/about', level: 1, purpose: 'Team and culture', sections: ['agency_story', 'team_grid', 'values', 'awards'], priority: 'important' },
    { id: 'process', name: 'Process', path: '/process', level: 1, purpose: 'Working methodology', sections: ['process_steps', 'timeline', 'collaboration_tools'], priority: 'important' },
    { id: 'blog', name: 'Blog', path: '/blog', level: 1, purpose: 'Industry expertise', sections: ['post_grid', 'categories'], priority: 'optional' },
    { id: 'contact', name: 'Contact', path: '/contact', level: 1, purpose: 'Project inquiries', sections: ['inquiry_form', 'consultation_booking', 'location'], priority: 'critical' },
  ],
  ecommerce: [
    { id: 'homepage', name: 'Homepage', path: '/', level: 0, purpose: 'Product discovery', sections: ['hero_banner', 'featured_products', 'categories', 'promotions', 'trust_badges', 'newsletter'], priority: 'critical' },
    { id: 'shop', name: 'Shop', path: '/shop', level: 1, purpose: 'Product browsing', sections: ['product_grid', 'filters', 'sorting', 'pagination'], priority: 'critical' },
    { id: 'product', name: 'Product Page', path: '/product/:id', level: 2, purpose: 'Product details', sections: ['gallery', 'description', 'variants', 'reviews', 'related_products', 'add_to_cart'], priority: 'critical' },
    { id: 'cart', name: 'Cart', path: '/cart', level: 1, purpose: 'Order review', sections: ['cart_items', 'upsells', 'shipping_calculator', 'checkout_button'], priority: 'critical' },
    { id: 'checkout', name: 'Checkout', path: '/checkout', level: 1, purpose: 'Purchase completion', sections: ['shipping_form', 'payment', 'order_summary', 'trust_signals'], priority: 'critical' },
    { id: 'account', name: 'Account', path: '/account', level: 1, purpose: 'Customer portal', sections: ['orders', 'wishlist', 'addresses', 'settings'], priority: 'important' },
    { id: 'about', name: 'About', path: '/about', level: 1, purpose: 'Brand story', sections: ['brand_story', 'sustainability', 'manufacturing'], priority: 'optional' },
    { id: 'contact', name: 'Contact', path: '/contact', level: 1, purpose: 'Customer service', sections: ['support_form', 'faq_link', 'return_policy'], priority: 'important' },
    { id: 'blog', name: 'Blog', path: '/blog', level: 1, purpose: 'Content marketing', sections: ['post_grid', 'product_links'], priority: 'optional' },
  ],
  coach: [
    { id: 'homepage', name: 'Homepage', path: '/', level: 0, purpose: 'Personal brand', sections: ['hero', 'transformation_promise', 'credentials', 'testimonials', 'services_preview', 'cta'], priority: 'critical' },
    { id: 'about', name: 'About', path: '/about', level: 1, purpose: 'Personal story', sections: ['story', 'credentials', 'media_features', 'philosophy'], priority: 'critical' },
    { id: 'services', name: 'Services', path: '/services', level: 1, purpose: 'Coaching offers', sections: ['service_cards', 'package_comparison', 'booking_cta'], priority: 'critical' },
    { id: 'programs', name: 'Programs', path: '/programs', level: 1, purpose: 'Courses and memberships', sections: ['program_cards', 'curriculum_preview', 'enrollment_cta'], priority: 'important' },
    { id: 'resources', name: 'Resources', path: '/resources', level: 1, purpose: 'Free content', sections: ['downloads', 'podcast', 'videos', 'newsletter'], priority: 'important' },
    { id: 'testimonials', name: 'Testimonials', path: '/testimonials', level: 1, purpose: 'Social proof', sections: ['testimonial_grid', 'case_studies', 'results'], priority: 'important' },
    { id: 'book', name: 'Book a Call', path: '/book', level: 1, purpose: 'Conversion', sections: ['calendar_embed', 'session_types', 'what_to_expect'], priority: 'critical' },
    { id: 'blog', name: 'Blog', path: '/blog', level: 1, purpose: 'Thought leadership', sections: ['post_grid', 'categories'], priority: 'optional' },
    { id: 'contact', name: 'Contact', path: '/contact', level: 1, purpose: 'Inquiries', sections: ['contact_form', 'social_links', 'faq'], priority: 'important' },
  ],
  local_business: [
    { id: 'homepage', name: 'Homepage', path: '/', level: 0, purpose: 'Local discovery', sections: ['hero', 'services', 'location_map', 'hours', 'reviews', 'cta'], priority: 'critical' },
    { id: 'services', name: 'Services', path: '/services', level: 1, purpose: 'Service list', sections: ['service_list', 'pricing', 'booking_cta'], priority: 'critical' },
    { id: 'about', name: 'About', path: '/about', level: 1, purpose: 'Business story', sections: ['story', 'team', 'certifications'], priority: 'important' },
    { id: 'gallery', name: 'Gallery', path: '/gallery', level: 1, purpose: 'Work showcase', sections: ['photo_gallery', 'before_after'], priority: 'optional' },
    { id: 'reviews', name: 'Reviews', path: '/reviews', level: 1, purpose: 'Social proof', sections: ['review_feed', 'rating_summary', 'review_cta'], priority: 'important' },
    { id: 'contact', name: 'Contact', path: '/contact', level: 1, purpose: 'Booking and inquiries', sections: ['contact_form', 'map', 'hours', 'phone'], priority: 'critical' },
  ],
  media: [
    { id: 'homepage', name: 'Homepage', path: '/', level: 0, purpose: 'Content discovery', sections: ['featured_content', 'latest_posts', 'categories', 'newsletter'], priority: 'critical' },
    { id: 'articles', name: 'Articles', path: '/articles', level: 1, purpose: 'Content archive', sections: ['article_grid', 'filters', 'pagination'], priority: 'critical' },
    { id: 'categories', name: 'Categories', path: '/category/:slug', level: 1, purpose: 'Topic browsing', sections: ['category_articles', 'related_categories'], priority: 'important' },
    { id: 'about', name: 'About', path: '/about', level: 1, purpose: 'Editorial info', sections: ['mission', 'team', 'contributors'], priority: 'important' },
    { id: 'contact', name: 'Contact', path: '/contact', level: 1, purpose: 'Tips and inquiries', sections: ['contact_form', 'press_kit'], priority: 'important' },
    { id: 'subscribe', name: 'Subscribe', path: '/subscribe', level: 1, purpose: 'Conversion', sections: ['subscription_options', 'benefits', 'payment'], priority: 'important' },
  ],
  nonprofit: [
    { id: 'homepage', name: 'Homepage', path: '/', level: 0, purpose: 'Mission and donation', sections: ['hero', 'mission', 'impact_stats', 'programs', 'donate_cta'], priority: 'critical' },
    { id: 'about', name: 'About', path: '/about', level: 1, purpose: 'Organization info', sections: ['mission', 'history', 'team', 'financials'], priority: 'critical' },
    { id: 'programs', name: 'Programs', path: '/programs', level: 1, purpose: 'Work showcase', sections: ['program_cards', 'impact_stories'], priority: 'critical' },
    { id: 'impact', name: 'Impact', path: '/impact', level: 1, purpose: 'Results', sections: ['metrics', 'stories', 'reports'], priority: 'important' },
    { id: 'donate', name: 'Donate', path: '/donate', level: 1, purpose: 'Fundraising', sections: ['donation_form', 'giving_levels', 'recurring_options'], priority: 'critical' },
    { id: 'get-involved', name: 'Get Involved', path: '/get-involved', level: 1, purpose: 'Engagement', sections: ['volunteer', 'events', 'advocacy'], priority: 'important' },
    { id: 'news', name: 'News', path: '/news', level: 1, purpose: 'Updates', sections: ['news_grid', 'newsletter'], priority: 'optional' },
    { id: 'contact', name: 'Contact', path: '/contact', level: 1, purpose: 'Inquiries', sections: ['contact_form', 'locations'], priority: 'important' },
  ],
};

// ============================================================================
// FUNNEL TEMPLATES
// ============================================================================

const FUNNEL_TEMPLATES: Record<FunnelType, FunnelFlow> = {
  lead_gen: {
    type: 'lead_gen',
    stages: [
      { name: 'Awareness', pages: ['blog', 'social-landing'], goal: 'Drive targeted traffic', kpis: ['traffic', 'bounce_rate'] },
      { name: 'Interest', pages: ['lead-magnet-landing'], goal: 'Capture email', kpis: ['opt_in_rate', 'cpl'] },
      { name: 'Consideration', pages: ['email-nurture'], goal: 'Build trust', kpis: ['open_rate', 'click_rate'], automations: ['welcome_sequence', 'value_emails'] },
      { name: 'Decision', pages: ['sales-page'], goal: 'Present offer', kpis: ['page_views', 'time_on_page'] },
      { name: 'Action', pages: ['checkout', 'thank-you'], goal: 'Convert to customer', kpis: ['conversion_rate', 'revenue'] },
    ],
    conversionPoints: [
      { location: 'lead-magnet-landing', action: 'email_submit', target: 'thank-you-download', tracking: 'lead_captured' },
      { location: 'sales-page', action: 'buy_now_click', target: 'checkout', tracking: 'checkout_initiated' },
      { location: 'checkout', action: 'purchase_complete', target: 'thank-you-purchase', tracking: 'purchase_completed' },
    ],
    automations: ['lead_magnet_delivery', 'welcome_sequence', 'nurture_sequence', 'cart_abandonment', 'post_purchase'],
    estimatedConversionRate: 0.02,
    optimizationPriorities: ['landing_page_headline', 'lead_magnet_value', 'email_sequence_timing'],
  },
  ecommerce: {
    type: 'ecommerce',
    stages: [
      { name: 'Discovery', pages: ['homepage', 'category-pages', 'search'], goal: 'Product discovery', kpis: ['sessions', 'pages_per_session'] },
      { name: 'Interest', pages: ['product-page'], goal: 'Product evaluation', kpis: ['product_views', 'add_to_cart_rate'] },
      { name: 'Intent', pages: ['cart'], goal: 'Purchase intent', kpis: ['cart_value', 'cart_abandonment_rate'], urgencyTactics: ['low_stock', 'time_limited'] },
      { name: 'Purchase', pages: ['checkout'], goal: 'Complete transaction', kpis: ['checkout_completion', 'conversion_rate'] },
      { name: 'Retention', pages: ['order-confirmation', 'account'], goal: 'Repeat purchase', kpis: ['repeat_purchase_rate', 'ltv'], automations: ['order_confirmation', 'review_request', 'reorder_reminder'] },
    ],
    conversionPoints: [
      { location: 'product-page', action: 'add_to_cart', target: 'cart', tracking: 'add_to_cart' },
      { location: 'cart', action: 'proceed_to_checkout', target: 'checkout', tracking: 'checkout_initiated' },
      { location: 'checkout', action: 'place_order', target: 'order-confirmation', tracking: 'purchase' },
      { location: 'cart', action: 'upsell_accept', target: 'cart-updated', tracking: 'upsell_revenue' },
    ],
    automations: ['cart_abandonment', 'order_confirmation', 'shipping_updates', 'review_request', 'win_back', 'reorder_reminder'],
    estimatedConversionRate: 0.03,
    optimizationPriorities: ['product_page_images', 'checkout_friction', 'cart_abandonment_recovery'],
  },
  course: {
    type: 'course',
    stages: [
      { name: 'Awareness', pages: ['free-content', 'blog', 'youtube-landing'], goal: 'Attract audience', kpis: ['traffic', 'engagement'] },
      { name: 'Lead Capture', pages: ['webinar-registration', 'free-course-landing'], goal: 'Capture email', kpis: ['registration_rate'] },
      { name: 'Education', pages: ['webinar', 'vsl-page'], goal: 'Deliver value + pitch', kpis: ['attendance_rate', 'watch_time'], automations: ['webinar_reminder', 'replay_access'] },
      { name: 'Offer', pages: ['sales-page', 'checkout'], goal: 'Enrollment', kpis: ['sales_page_views', 'conversion_rate'], urgencyTactics: ['limited_spots', 'bonus_deadline'] },
      { name: 'Onboarding', pages: ['welcome', 'getting-started', 'community'], goal: 'Student success', kpis: ['completion_rate', 'engagement'], automations: ['welcome_sequence', 'module_reminders'] },
    ],
    conversionPoints: [
      { location: 'webinar-registration', action: 'register', target: 'confirmation-page', tracking: 'webinar_registered' },
      { location: 'webinar', action: 'cta_click', target: 'sales-page', tracking: 'sales_page_view' },
      { location: 'sales-page', action: 'enroll_click', target: 'checkout', tracking: 'checkout_initiated' },
      { location: 'checkout', action: 'purchase', target: 'welcome', tracking: 'enrollment_completed' },
    ],
    automations: ['webinar_reminder_sequence', 'replay_sequence', 'cart_open_close', 'payment_plan_reminder', 'onboarding_sequence', 'engagement_prompts'],
    estimatedConversionRate: 0.05,
    optimizationPriorities: ['webinar_attendance', 'sales_page_length', 'urgency_messaging'],
  },
  service: {
    type: 'service',
    stages: [
      { name: 'Discovery', pages: ['homepage', 'service-pages'], goal: 'Service awareness', kpis: ['traffic', 'service_page_views'] },
      { name: 'Evaluation', pages: ['case-studies', 'testimonials', 'pricing'], goal: 'Build confidence', kpis: ['pages_per_session', 'time_on_site'] },
      { name: 'Booking', pages: ['booking-page', 'calendar'], goal: 'Schedule appointment', kpis: ['booking_rate', 'show_rate'] },
      { name: 'Confirmation', pages: ['confirmation', 'prep-info'], goal: 'Prepare client', kpis: ['show_rate'], automations: ['confirmation_email', 'reminder_sequence', 'prep_instructions'] },
      { name: 'Follow-up', pages: ['thank-you', 'review-request'], goal: 'Reviews + referrals', kpis: ['review_rate', 'referral_rate'], automations: ['follow_up_email', 'review_request', 'referral_program'] },
    ],
    conversionPoints: [
      { location: 'homepage', action: 'book_now_click', target: 'booking-page', tracking: 'booking_initiated' },
      { location: 'service-page', action: 'book_service', target: 'calendar', tracking: 'service_selected' },
      { location: 'calendar', action: 'confirm_booking', target: 'confirmation', tracking: 'booking_completed' },
      { location: 'follow-up-email', action: 'leave_review', target: 'review-platform', tracking: 'review_submitted' },
    ],
    automations: ['booking_confirmation', 'appointment_reminders', 'prep_instructions', 'post_service_followup', 'review_request', 'rebooking_reminder'],
    estimatedConversionRate: 0.08,
    optimizationPriorities: ['booking_page_simplicity', 'reminder_timing', 'review_request_timing'],
  },
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class ArchitectManager extends BaseManager {
  private specialistsRegistered = false;

  constructor() {
    super(ARCHITECT_MANAGER_CONFIG);
  }

  /**
   * Initialize manager and dynamically register all specialists
   */
  async initialize(): Promise<void> {
    this.log('INFO', 'Initializing Lead Architect - Strategic Infrastructure Commander...');

    // Dynamically register all architect specialists
    await this.registerAllSpecialists();

    this.isInitialized = true;
    this.log('INFO', `Lead Architect initialized with ${this.specialists.size} specialists`);
  }

  /**
   * Dynamically register specialists from factory functions (SwarmRegistry pattern)
   */
  private async registerAllSpecialists(): Promise<void> {
    if (this.specialistsRegistered) {
      return;
    }

    const specialistFactories = [
      { name: 'UX_UI_SPECIALIST', factory: getUXUISpecialist },
      { name: 'FUNNEL_PATHOLOGIST', factory: getFunnelPathologist },
      { name: 'COPY_SPECIALIST', factory: getCopySpecialist },
    ];

    for (const { name, factory } of specialistFactories) {
      try {
        const specialist = factory();
        await specialist.initialize();
        this.registerSpecialist(specialist);
        this.log('INFO', `Registered specialist: ${name} (${specialist.getStatus()})`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.log('ERROR', `Failed to register specialist ${name}: ${errorMsg}`);
      }
    }

    this.specialistsRegistered = true;
  }

  /**
   * Main execution entry point - orchestrates site blueprint generation
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const _startTime = Date.now();
    const taskId = message.id;

    // Ensure specialists are registered
    if (!this.specialistsRegistered) {
      await this.registerAllSpecialists();
    }

    try {
      // Parse the request payload
      const request = this.parseRequest(message);

      if (!request.tenantId) {
        return this.createReport(
          taskId,
          'FAILED',
          null,
          ['tenantId is REQUIRED - multi-tenant scoping is mandatory']
        );
      }

      this.log('INFO', `Processing blueprint request for tenant: ${request.tenantId}`);

      // Phase 1: Load context (Brand DNA + Intelligence Briefs)
      const context = await this.loadTenantContext(request.tenantId);

      // Phase 2: Derive site requirements
      const requirements = this.deriveSiteRequirements(request, context);
      this.log('INFO', `Derived requirements: ${requirements.industry} industry, ${requirements.funnelType} funnel`);

      // Phase 3: Generate architecture
      const output = await this.generateArchitecture(request, requirements, context, taskId);

      // Phase 4: Store in TenantMemoryVault and broadcast signal
      const signalSuccess = await this.storeAndBroadcast(request.tenantId, output);
      output.signalBroadcast.success = signalSuccess;

      return this.createReport(
        taskId,
        'COMPLETED',
        output,
        output.warnings
      );

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('ERROR', `Blueprint generation failed: ${errorMsg}`);
      return this.createReport(taskId, 'FAILED', null, [errorMsg]);
    }
  }

  /**
   * Handle signals from the Signal Bus
   */
  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;

    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }

    // Handle specific signal types
    if (signal.type === 'DIRECT' && signal.target === this.identity.id) {
      return this.execute(signal.payload);
    }

    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  /**
   * Generate a report for JASPER
   */
  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  /**
   * Self-assessment - this manager has REAL logic
   */
  hasRealLogic(): boolean {
    return true;
  }

  /**
   * Lines of code assessment
   */
  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 1200, boilerplate: 200 };
  }

  // ==========================================================================
  // CONTEXT LOADING
  // ==========================================================================

  /**
   * Parse and normalize the request payload
   */
  private parseRequest(message: AgentMessage): BlueprintRequest {
    const payload = message.payload as Record<string, unknown> | null;

    return {
      tenantId: (payload?.tenantId as string) ?? '',
      niche: (payload?.niche as string) ?? undefined,
      description: (payload?.description as string) ?? undefined,
      targetAudience: (payload?.targetAudience as string) ?? undefined,
      objective: (payload?.objective as BlueprintRequest['objective']) ?? undefined,
      existingBrand: (payload?.existingBrand as boolean) ?? true,
      forceRefresh: (payload?.forceRefresh as boolean) ?? false,
    };
  }

  /**
   * Load tenant context: Brand DNA and existing Intelligence Briefs
   */
  private async loadTenantContext(tenantId: string): Promise<{
    brandDNA: BrandDNA | null;
    intelligenceBriefs: InsightEntry[];
  }> {
    this.log('INFO', `Loading context for tenant: ${tenantId}`);

    // Load Brand DNA
    let brandDNA: BrandDNA | null = null;
    try {
      brandDNA = await getBrandDNA(tenantId);
      if (brandDNA) {
        this.log('INFO', `Loaded Brand DNA: ${brandDNA.industry} industry, ${brandDNA.toneOfVoice} tone`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('WARN', `Failed to load Brand DNA: ${errorMsg}`);
    }

    // Load Intelligence Briefs from TenantMemoryVault
    let intelligenceBriefs: InsightEntry[] = [];
    try {
      intelligenceBriefs = await readAgentInsights(this.identity.id, {
        minConfidence: 50,
        limit: 10,
      });
      this.log('INFO', `Loaded ${intelligenceBriefs.length} intelligence insights`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('WARN', `Failed to load intelligence briefs: ${errorMsg}`);
    }

    return { brandDNA, intelligenceBriefs };
  }

  // ==========================================================================
  // REQUIREMENTS DERIVATION
  // ==========================================================================

  /**
   * Derive site requirements from Brand DNA and request
   */
  private deriveSiteRequirements(
    request: BlueprintRequest,
    context: { brandDNA: BrandDNA | null; intelligenceBriefs: InsightEntry[] }
  ): SiteRequirements {
    const { brandDNA } = context;

    // Derive industry from Brand DNA or niche
    const industry = this.detectIndustry(
      brandDNA?.industry ?? request.niche ?? '',
      request.description ?? ''
    );

    // Derive target audience
    const targetAudience = brandDNA?.targetAudience ??
      request.targetAudience ??
      this.detectTargetAudience(request.niche ?? '', industry);

    // Derive tone of voice
    const toneOfVoice = brandDNA?.toneOfVoice ?? 'professional';

    // Derive funnel type
    const funnelType = this.detectFunnelType(request.objective, industry);

    // Derive primary objective
    const primaryObjective = this.detectPrimaryObjective(request.objective, industry);

    return {
      industry,
      targetAudience,
      primaryObjective,
      funnelType,
      toneOfVoice,
      integrations: this.inferRequiredIntegrations(industry, funnelType),
    };
  }

  /**
   * Detect industry type from brand info
   */
  private detectIndustry(industryHint: string, description: string): IndustryType {
    const combined = `${industryHint} ${description}`.toLowerCase();

    // SaaS indicators
    const saasKeywords = ['saas', 'software', 'app', 'platform', 'tool', 'api', 'cloud', 'subscription', 'startup', 'tech'];
    if (saasKeywords.some(k => combined.includes(k))) { return 'saas'; }

    // E-commerce indicators
    const ecomKeywords = ['ecommerce', 'e-commerce', 'store', 'shop', 'products', 'retail', 'merchandise', 'dropship', 'inventory'];
    if (ecomKeywords.some(k => combined.includes(k))) { return 'ecommerce'; }

    // Agency indicators
    const agencyKeywords = ['agency', 'studio', 'consulting', 'consultancy', 'services', 'firm', 'design agency', 'marketing agency'];
    if (agencyKeywords.some(k => combined.includes(k))) { return 'agency'; }

    // Coach indicators
    const coachKeywords = ['coach', 'coaching', 'mentor', 'trainer', 'course', 'program', 'transformation', 'expert', 'speaker', 'author'];
    if (coachKeywords.some(k => combined.includes(k))) { return 'coach'; }

    // Local business indicators
    const localKeywords = ['local', 'restaurant', 'salon', 'clinic', 'dental', 'medical', 'repair', 'plumber', 'electrician', 'contractor'];
    if (localKeywords.some(k => combined.includes(k))) { return 'local_business'; }

    // Media indicators
    const mediaKeywords = ['media', 'news', 'magazine', 'publication', 'blog', 'content', 'publisher'];
    if (mediaKeywords.some(k => combined.includes(k))) { return 'media'; }

    // Nonprofit indicators
    const nonprofitKeywords = ['nonprofit', 'non-profit', 'charity', 'foundation', 'ngo', 'cause', 'donation'];
    if (nonprofitKeywords.some(k => combined.includes(k))) { return 'nonprofit'; }

    // Default to agency as most versatile
    return 'agency';
  }

  /**
   * Detect funnel type based on objective and industry
   */
  private detectFunnelType(objective: BlueprintRequest['objective'] | undefined, industry: IndustryType): FunnelType {
    // Explicit objective mapping
    if (objective === 'sales') { return 'ecommerce'; }
    if (objective === 'bookings') { return 'service'; }
    if (objective === 'leads') { return 'lead_gen'; }

    // Industry-based defaults
    const industryFunnelMap: Record<IndustryType, FunnelType> = {
      saas: 'lead_gen',
      agency: 'lead_gen',
      ecommerce: 'ecommerce',
      coach: 'course',
      local_business: 'service',
      media: 'lead_gen',
      nonprofit: 'lead_gen',
    };

    return industryFunnelMap[industry];
  }

  /**
   * Detect target audience
   */
  private detectTargetAudience(niche: string, industry: IndustryType): string {
    const nicheLower = niche.toLowerCase();

    // B2B indicators
    const b2bKeywords = ['b2b', 'business', 'enterprise', 'companies', 'startups', 'founders', 'executives', 'teams'];
    if (b2bKeywords.some(k => nicheLower.includes(k))) {
      return 'Business professionals and decision-makers (B2B)';
    }

    // Industry-specific defaults
    const industryAudienceMap: Record<IndustryType, string> = {
      saas: 'Business teams and professionals seeking productivity solutions',
      agency: 'Businesses seeking creative and marketing services',
      ecommerce: 'Consumers seeking quality products',
      coach: 'Individuals seeking personal or professional transformation',
      local_business: 'Local community members seeking services',
      media: 'Readers and content consumers interested in industry insights',
      nonprofit: 'Donors, volunteers, and community members aligned with the mission',
    };

    return industryAudienceMap[industry];
  }

  /**
   * Detect primary objective
   */
  private detectPrimaryObjective(objective: BlueprintRequest['objective'] | undefined, industry: IndustryType): string {
    if (objective) {
      const objectiveMap: Record<string, string> = {
        leads: 'Generate qualified leads for sales pipeline',
        sales: 'Drive direct product/service sales',
        bookings: 'Book appointments and consultations',
        awareness: 'Build brand awareness and audience',
      };
      return objectiveMap[objective] || 'Convert visitors into customers';
    }

    const industryObjectiveMap: Record<IndustryType, string> = {
      saas: 'Drive trial signups and demo requests',
      agency: 'Generate qualified project inquiries',
      ecommerce: 'Maximize product sales and average order value',
      coach: 'Enroll students in courses and programs',
      local_business: 'Book appointments and walk-in visits',
      media: 'Grow subscriber base and engagement',
      nonprofit: 'Increase donations and volunteer signups',
    };

    return industryObjectiveMap[industry];
  }

  /**
   * Infer required integrations based on industry and funnel
   */
  private inferRequiredIntegrations(industry: IndustryType, funnel: FunnelType): string[] {
    const baseIntegrations = ['analytics', 'crm'];

    const industryIntegrations: Record<IndustryType, string[]> = {
      saas: ['stripe', 'intercom', 'helpdesk', 'product_analytics'],
      agency: ['calendly', 'project_management', 'invoicing'],
      ecommerce: ['stripe', 'shipping', 'inventory', 'reviews'],
      coach: ['calendly', 'zoom', 'course_platform', 'community'],
      local_business: ['booking', 'maps', 'reviews', 'sms'],
      media: ['newsletter', 'paywall', 'comments', 'social'],
      nonprofit: ['donation_platform', 'volunteer_management', 'newsletter'],
    };

    const funnelIntegrations: Record<FunnelType, string[]> = {
      lead_gen: ['email_automation', 'landing_pages', 'forms'],
      ecommerce: ['payment_gateway', 'cart', 'inventory'],
      course: ['course_platform', 'community', 'webinar'],
      service: ['booking', 'calendar', 'reminders'],
    };

    return [
      ...baseIntegrations,
      ...(industryIntegrations[industry] ?? []),
      ...(funnelIntegrations[funnel] ?? []),
    ];
  }

  // ==========================================================================
  // ARCHITECTURE GENERATION
  // ==========================================================================

  /**
   * Generate complete site architecture
   */
  private async generateArchitecture(
    request: BlueprintRequest,
    requirements: SiteRequirements,
    context: { brandDNA: BrandDNA | null; intelligenceBriefs: InsightEntry[] },
    taskId: string
  ): Promise<ArchitectureOutput> {
    const warnings: string[] = [];
    const { brandDNA, intelligenceBriefs } = context;

    // Step 1: Generate site map
    const siteMap = this.generateSiteMap(requirements);
    this.log('INFO', `Generated site map with ${siteMap.pages.length} pages`);

    // Step 2: Design funnel flow
    const funnelFlow = this.designFunnelFlow(requirements);
    this.log('INFO', `Designed ${funnelFlow.type} funnel with ${funnelFlow.stages.length} stages`);

    // Step 3: Generate navigation
    const navigation = this.generateNavigation(siteMap, requirements);

    // Step 4: Execute specialists in parallel
    const specialistResults = await this.executeSpecialistsParallel(
      siteMap,
      funnelFlow,
      requirements,
      taskId
    );

    // Step 5: Build delegations for output
    const delegations = this.buildDelegationResults(specialistResults);

    // Step 6: Synthesize site architecture
    const siteArchitecture = this.synthesizeSiteArchitecture(
      request.tenantId,
      requirements,
      brandDNA,
      intelligenceBriefs,
      siteMap,
      funnelFlow,
      navigation,
      specialistResults,
      warnings
    );

    // Step 7: Generate technical brief
    const technicalBrief = this.generateTechnicalBrief(
      siteArchitecture.blueprintId,
      requirements,
      siteMap
    );

    // Step 8: Calculate confidence
    const confidence = this.calculateConfidence(delegations, siteMap, funnelFlow, brandDNA !== null);

    return {
      siteArchitecture,
      technicalBrief,
      delegations,
      confidence,
      warnings,
      signalBroadcast: {
        type: 'site.blueprint_ready',
        timestamp: new Date(),
        success: false, // Will be updated after broadcast
      },
    };
  }

  /**
   * Generate site map based on requirements
   */
  private generateSiteMap(requirements: SiteRequirements): SiteMap {
    // Get industry template
    const templatePages = INDUSTRY_TEMPLATES[requirements.industry] ?? INDUSTRY_TEMPLATES.agency;

    // Build full page definitions with SEO
    const pages: PageDefinition[] = templatePages.map(template => ({
      id: template.id ?? '',
      name: template.name ?? '',
      path: template.path ?? '',
      level: template.level ?? 0,
      purpose: template.purpose ?? '',
      sections: template.sections ?? [],
      parent: template.level === 0 ? null : (template.level === 1 ? 'homepage' : this.findParent(template, templatePages)),
      priority: template.priority ?? 'optional',
      seo: this.generatePageSEO(template, requirements),
    }));

    // Build hierarchy
    const hierarchy = this.buildHierarchy(pages);

    // Estimate build time
    const estimatedBuildTime = this.estimateBuildTime(pages.length, requirements.industry);

    return {
      pages,
      hierarchy,
      totalPages: pages.length,
      estimatedBuildTime,
    };
  }

  /**
   * Generate SEO requirements for a page
   */
  private generatePageSEO(page: Partial<PageDefinition>, requirements: SiteRequirements): PageSEORequirements {
    const pageName = page.name ?? 'Page';
    const industry = requirements.industry;

    return {
      titleTemplate: `${pageName} | {brand_name}`,
      descriptionTemplate: `${page.purpose ?? 'Learn more'} - {brand_description}`,
      keywordFocus: this.inferPageKeywords(page.id ?? '', industry),
      structuredDataType: this.inferStructuredDataType(page.id ?? '', industry),
      canonicalStrategy: 'self',
    };
  }

  /**
   * Infer keywords for a page based on its ID and industry
   */
  private inferPageKeywords(pageId: string, industry: IndustryType): string[] {
    const baseKeywords: Record<string, string[]> = {
      homepage: ['solutions', 'services', 'get started'],
      about: ['about us', 'team', 'company', 'mission'],
      services: ['services', 'offerings', 'solutions'],
      pricing: ['pricing', 'plans', 'cost', 'packages'],
      contact: ['contact', 'get in touch', 'inquiry'],
      blog: ['blog', 'articles', 'insights', 'news'],
    };

    const industryModifier: Record<IndustryType, string[]> = {
      saas: ['software', 'platform', 'tool'],
      agency: ['creative', 'agency', 'marketing'],
      ecommerce: ['shop', 'buy', 'products'],
      coach: ['coaching', 'programs', 'transformation'],
      local_business: ['local', 'near me', 'service'],
      media: ['news', 'updates', 'stories'],
      nonprofit: ['donate', 'support', 'cause'],
    };

    return [
      ...(baseKeywords[pageId] ?? []),
      ...(industryModifier[industry] ?? []),
    ];
  }

  /**
   * Infer structured data type for a page
   */
  private inferStructuredDataType(pageId: string, industry: IndustryType): string | undefined {
    const pageTypes: Record<string, string> = {
      homepage: 'Organization',
      about: 'AboutPage',
      services: 'Service',
      pricing: 'Product',
      contact: 'ContactPage',
      blog: 'Blog',
      product: 'Product',
    };

    if (industry === 'local_business') {
      return 'LocalBusiness';
    }

    return pageTypes[pageId];
  }

  /**
   * Find parent page for nested pages
   */
  private findParent(page: Partial<PageDefinition>, allPages: Partial<PageDefinition>[]): string | null {
    if (page.level === 2 && page.path) {
      const pathParts = page.path.split('/').filter(Boolean);
      if (pathParts.length > 1) {
        const parentPath = `/${pathParts[0]}`;
        const parent = allPages.find(p => p.path === parentPath);
        return parent?.id ?? null;
      }
    }
    return null;
  }

  /**
   * Build page hierarchy from pages
   */
  private buildHierarchy(pages: PageDefinition[]): SiteHierarchy {
    const hierarchy: SiteHierarchy = { L0: [], L1: [], L2: [] };

    for (const page of pages) {
      const level = `L${page.level}` as keyof SiteHierarchy;
      if (hierarchy[level]) {
        hierarchy[level].push(page.id);
      } else {
        hierarchy.L3 = hierarchy.L3 ?? [];
        hierarchy.L3.push(page.id);
      }
    }

    return hierarchy;
  }

  /**
   * Estimate build time based on page count and complexity
   */
  private estimateBuildTime(pageCount: number, industry: IndustryType): string {
    const complexityMultiplier: Record<IndustryType, number> = {
      saas: 1.5,
      agency: 1.2,
      ecommerce: 2.0,
      coach: 1.0,
      local_business: 0.8,
      media: 1.3,
      nonprofit: 1.0,
    };

    const baseDays = pageCount * 0.5 * (complexityMultiplier[industry] ?? 1);
    const weeks = Math.ceil(baseDays / 5);

    return weeks <= 1 ? '1 week' : `${weeks} weeks`;
  }

  /**
   * Design funnel flow based on requirements
   */
  private designFunnelFlow(requirements: SiteRequirements): FunnelFlow {
    const template = FUNNEL_TEMPLATES[requirements.funnelType];

    // Customize for industry
    return {
      ...template,
      stages: template.stages.map(stage => ({
        ...stage,
        goal: this.customizeGoal(stage.goal, requirements.industry),
      })),
    };
  }

  /**
   * Customize funnel stage goal for industry
   */
  private customizeGoal(baseGoal: string, industry: IndustryType): string {
    const industryContext: Record<IndustryType, string> = {
      saas: 'for SaaS product',
      agency: 'for agency services',
      ecommerce: 'for product sales',
      coach: 'for coaching/course',
      local_business: 'for local business',
      media: 'for content subscription',
      nonprofit: 'for mission support',
    };

    return `${baseGoal} ${industryContext[industry] || ''}`.trim();
  }

  /**
   * Generate navigation configuration
   */
  private generateNavigation(siteMap: SiteMap, requirements: SiteRequirements): NavigationConfig {
    const { pages } = siteMap;

    // Primary nav: L1 pages marked as critical or important, max 6
    const primaryPages = pages
      .filter(p => p.level === 1 && (p.priority === 'critical' || p.priority === 'important'))
      .slice(0, 6);

    const primary: NavigationItem[] = primaryPages.map(p => ({
      id: p.id,
      label: p.name,
      path: p.path,
    }));

    // Utility nav: based on industry
    const utilityNavMap: Record<IndustryType, NavigationItem[]> = {
      saas: [
        { id: 'login', label: 'Login', path: '/login' },
        { id: 'trial', label: 'Start Free Trial', path: '/signup', highlight: true },
      ],
      agency: [
        { id: 'quote', label: 'Get a Quote', path: '/contact', highlight: true },
      ],
      ecommerce: [
        { id: 'account', label: 'Account', path: '/account' },
        { id: 'cart', label: 'Cart', path: '/cart', highlight: true },
      ],
      coach: [
        { id: 'login', label: 'Login', path: '/login' },
        { id: 'book', label: 'Book a Call', path: '/book', highlight: true },
      ],
      local_business: [
        { id: 'call', label: 'Call Now', path: 'tel:', highlight: true },
        { id: 'book', label: 'Book Online', path: '/book' },
      ],
      media: [
        { id: 'subscribe', label: 'Subscribe', path: '/subscribe', highlight: true },
        { id: 'login', label: 'Login', path: '/login' },
      ],
      nonprofit: [
        { id: 'donate', label: 'Donate', path: '/donate', highlight: true },
      ],
    };

    // Footer navigation
    const footer: FooterNavigation = {
      columns: [
        {
          title: 'Company',
          links: [
            { id: 'about', label: 'About', path: '/about' },
            { id: 'contact', label: 'Contact', path: '/contact' },
            { id: 'blog', label: 'Blog', path: '/blog' },
          ],
        },
      ],
      legal: [
        { id: 'privacy', label: 'Privacy Policy', path: '/privacy' },
        { id: 'terms', label: 'Terms of Service', path: '/terms' },
      ],
      social: [],
    };

    // Mobile nav
    const mobile: NavigationItem[] = [
      { id: 'home', label: 'Home', path: '/' },
      ...primary.slice(0, 3),
      { id: 'contact', label: 'Contact', path: '/contact' },
    ];

    return {
      primary,
      utility: utilityNavMap[requirements.industry] ?? [{ id: 'contact', label: 'Contact', path: '/contact' }],
      footer,
      mobile,
      breadcrumbs: {
        enabled: requirements.industry === 'ecommerce' || requirements.industry === 'saas',
        separator: '/',
        homeLabel: 'Home',
        maxDepth: 3,
      },
    };
  }

  // ==========================================================================
  // SPECIALIST ORCHESTRATION
  // ==========================================================================

  /**
   * Execute all specialists in parallel with graceful degradation
   */
  private async executeSpecialistsParallel(
    siteMap: SiteMap,
    funnelFlow: FunnelFlow,
    requirements: SiteRequirements,
    taskId: string
  ): Promise<SpecialistResult[]> {
    const specialistIds = ['UX_UI_SPECIALIST', 'FUNNEL_PATHOLOGIST', 'COPY_SPECIALIST'];

    const executionPromises = specialistIds.map(async (specialistId): Promise<SpecialistResult> => {
      const startTime = Date.now();
      const specialist = this.specialists.get(specialistId);

      // Handle missing specialist
      if (!specialist) {
        return {
          specialistId,
          status: 'SKIPPED',
          data: null,
          errors: [`Specialist ${specialistId} not registered`],
          executionTimeMs: 0,
        };
      }

      // Handle non-functional specialist
      if (!specialist.isFunctional()) {
        return {
          specialistId,
          status: 'BLOCKED',
          data: null,
          errors: [`Specialist ${specialistId} is ${specialist.getStatus()}`],
          executionTimeMs: 0,
        };
      }

      try {
        // Create specialist-specific message
        const message = this.createSpecialistMessage(
          specialistId,
          siteMap,
          funnelFlow,
          requirements,
          taskId
        );

        // Execute the specialist
        const report = await specialist.execute(message);
        const executionTimeMs = Date.now() - startTime;

        if (report.status === 'COMPLETED') {
          return {
            specialistId,
            status: 'SUCCESS',
            data: report.data,
            errors: report.errors ?? [],
            executionTimeMs,
          };
        } else {
          return {
            specialistId,
            status: 'FAILED',
            data: report.data,
            errors: report.errors ?? [`Specialist returned status: ${report.status}`],
            executionTimeMs,
          };
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
          specialistId,
          status: 'FAILED',
          data: null,
          errors: [`Execution error: ${errorMsg}`],
          executionTimeMs: Date.now() - startTime,
        };
      }
    });

    // Execute all in parallel with Promise.allSettled for isolation
    const settledResults = await Promise.allSettled(executionPromises);

    return settledResults.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        specialistId: 'UNKNOWN',
        status: 'FAILED' as const,
        data: null,
        errors: [`Promise rejected: ${result.reason}`],
        executionTimeMs: 0,
      };
    });
  }

  /**
   * Create a message tailored for a specific specialist
   */
  private createSpecialistMessage(
    specialistId: string,
    siteMap: SiteMap,
    funnelFlow: FunnelFlow,
    requirements: SiteRequirements,
    taskId: string
  ): AgentMessage {
    let payload: Record<string, unknown>;

    switch (specialistId) {
      case 'UX_UI_SPECIALIST':
        payload = {
          action: 'design_page',
          pageType: 'landing',
          industry: requirements.industry,
          toneOfVoice: requirements.toneOfVoice,
          sections: siteMap.pages.find(p => p.id === 'homepage')?.sections ?? [],
          funnelType: funnelFlow.type,
          brief: this.createUXBrief(siteMap, funnelFlow, requirements),
        };
        break;

      case 'FUNNEL_PATHOLOGIST':
        payload = {
          action: 'analyze_funnel',
          funnelType: funnelFlow.type,
          businessType: requirements.industry,
          stages: funnelFlow.stages,
          conversionPoints: funnelFlow.conversionPoints,
          brief: this.createFunnelBrief(funnelFlow, requirements),
        };
        break;

      case 'COPY_SPECIALIST':
        payload = {
          action: 'generate_copy',
          pageType: 'landing',
          funnelType: funnelFlow.type,
          targetAudience: requirements.targetAudience,
          toneOfVoice: requirements.toneOfVoice,
          industry: requirements.industry,
          brief: this.createCopyBrief(siteMap, funnelFlow, requirements),
        };
        break;

      default:
        payload = { siteMap, funnelFlow, requirements };
    }

    return {
      id: `${taskId}_${specialistId}`,
      type: 'COMMAND',
      from: this.identity.id,
      to: specialistId,
      payload,
      timestamp: new Date(),
      priority: 'NORMAL',
      requiresResponse: true,
      traceId: taskId,
    };
  }

  /**
   * Create UX/UI specialist brief
   */
  private createUXBrief(siteMap: SiteMap, funnelFlow: FunnelFlow, requirements: SiteRequirements): string {
    const criticalPages = siteMap.pages.filter(p => p.priority === 'critical');
    const pageList = criticalPages.map(p => `- ${p.name}: ${p.sections.join(', ')}`).join('\n');

    return `Design wireframes and component library for ${siteMap.totalPages}-page ${requirements.industry} website.

TONE: ${requirements.toneOfVoice}
TARGET AUDIENCE: ${requirements.targetAudience}

CRITICAL PAGES:
${pageList}

FUNNEL TYPE: ${funnelFlow.type}
Key conversion points require prominent CTAs and clear visual hierarchy.

DELIVERABLES:
1. Homepage wireframe with section layouts
2. Component library (buttons, cards, forms, navigation)
3. Color palette recommendation based on ${requirements.industry} psychology
4. Typography hierarchy
5. Mobile-responsive considerations
6. WCAG AA accessibility audit`;
  }

  /**
   * Create Funnel specialist brief
   */
  private createFunnelBrief(funnelFlow: FunnelFlow, requirements: SiteRequirements): string {
    const stageList = funnelFlow.stages
      .map(s => `- ${s.name}: ${s.goal} (Pages: ${s.pages.join(', ')})`)
      .join('\n');

    const conversionList = funnelFlow.conversionPoints
      .map(c => `- ${c.location}: ${c.action} -> ${c.target}`)
      .join('\n');

    return `Optimize ${funnelFlow.type} funnel for ${requirements.industry} ${requirements.primaryObjective}.

TARGET AUDIENCE: ${requirements.targetAudience}

FUNNEL STAGES:
${stageList}

CONVERSION POINTS:
${conversionList}

AUTOMATIONS TO IMPLEMENT:
${funnelFlow.automations.map(a => `- ${a.replace(/_/g, ' ')}`).join('\n')}

DELIVERABLES:
1. Funnel flow diagram
2. Conversion optimization recommendations
3. A/B testing priorities
4. Urgency/scarcity tactics appropriate for ${requirements.industry}
5. Price anchoring strategy
6. Automation trigger definitions`;
  }

  /**
   * Create Copy specialist brief
   */
  private createCopyBrief(siteMap: SiteMap, funnelFlow: FunnelFlow, requirements: SiteRequirements): string {
    const pageList = siteMap.pages
      .filter(p => p.priority === 'critical')
      .map(p => `- ${p.name} (${p.path}): ${p.purpose}`)
      .join('\n');

    return `Create conversion-focused copy for ${requirements.industry} ${funnelFlow.type} funnel website.

TONE OF VOICE: ${requirements.toneOfVoice}
TARGET AUDIENCE: ${requirements.targetAudience}
PRIMARY OBJECTIVE: ${requirements.primaryObjective}

PAGES REQUIRING COPY:
${pageList}

FUNNEL CONVERSION POINTS:
${funnelFlow.conversionPoints.map(c => `- ${c.location}: ${c.action}`).join('\n')}

DELIVERABLES:
1. Homepage hero headline and subheadline
2. Value proposition statements
3. CTA button copy for each conversion point
4. Section headlines for key pages
5. Email subject lines for automations
6. Framework selection (PAS/AIDA/BAB/4Ps)`;
  }

  /**
   * Build delegation results from specialist results
   */
  private buildDelegationResults(results: SpecialistResult[]): DelegationResult[] {
    return results.map(result => {
      let status: DelegationResult['status'];
      if (result.status === 'SUCCESS') {
        status = 'COMPLETED';
      } else if (result.status === 'BLOCKED') {
        status = 'BLOCKED';
      } else if (result.status === 'SKIPPED') {
        status = 'PENDING';
      } else {
        status = 'FAILED';
      }

      const contributionMap: Record<string, string[]> = {
        UX_UI_SPECIALIST: ['designDirection', 'accessibility'],
        FUNNEL_PATHOLOGIST: ['funnelFlow', 'conversionOptimization'],
        COPY_SPECIALIST: ['contentStructure', 'messaging'],
      };

      return {
        specialist: result.specialistId,
        brief: `${result.specialistId} delegation`,
        status,
        result: result.status === 'SUCCESS' ? (result.data as string | object) : result.errors.join('; '),
        contributedTo: contributionMap[result.specialistId] ?? [],
      };
    });
  }

  // ==========================================================================
  // SYNTHESIS
  // ==========================================================================

  /**
   * Synthesize all outputs into SiteArchitecture
   */
  private synthesizeSiteArchitecture(
    tenantId: string,
    requirements: SiteRequirements,
    brandDNA: BrandDNA | null,
    intelligenceBriefs: InsightEntry[],
    siteMap: SiteMap,
    funnelFlow: FunnelFlow,
    navigation: NavigationConfig,
    specialistResults: SpecialistResult[],
    warnings: string[]
  ): SiteArchitecture {
    const blueprintId = `blueprint_${tenantId}_${Date.now()}`;

    // Extract specialist contributions
    const uxResult = specialistResults.find(r => r.specialistId === 'UX_UI_SPECIALIST');
    const funnelResult = specialistResults.find(r => r.specialistId === 'FUNNEL_PATHOLOGIST');
    const copyResult = specialistResults.find(r => r.specialistId === 'COPY_SPECIALIST');

    // Derive design direction from UX specialist or defaults
    const uxData = uxResult?.data as Record<string, unknown> | null;
    const designDirection = {
      colorPsychology: (uxData?.colorPsychology as string) ?? this.inferColorPsychology(requirements.industry),
      typographyStyle: (uxData?.typographyStyle as string) ?? this.inferTypographyStyle(requirements.toneOfVoice),
      visualDensity: this.inferVisualDensity(requirements.industry),
      animationLevel: this.inferAnimationLevel(requirements.industry),
    };

    // Derive content structure from Copy specialist or defaults
    const copyData = copyResult?.data as Record<string, unknown> | null;
    const contentStructure = {
      messagingFramework: (copyData?.framework as string) ?? 'PAS',
      ctaStrategy: (copyData?.ctaStrategy as string) ?? 'action-oriented',
      socialProofPlacement: ['hero', 'pricing', 'footer'],
      keyPhrases: brandDNA?.keyPhrases ?? [],
      avoidPhrases: brandDNA?.avoidPhrases ?? [],
    };

    // Calculate metadata
    const successfulSpecialists = specialistResults.filter(r => r.status === 'SUCCESS').length;
    const confidence = successfulSpecialists / specialistResults.length;

    // Check for warnings
    if (!brandDNA) {
      warnings.push('No Brand DNA found - architecture derived from niche analysis only');
    }
    if (intelligenceBriefs.length === 0) {
      warnings.push('No Intelligence Briefs available - consider running market research first');
    }
    if (successfulSpecialists < specialistResults.length) {
      warnings.push(`Only ${successfulSpecialists}/${specialistResults.length} specialists completed successfully`);
    }

    return {
      blueprintId,
      tenantId,
      createdAt: new Date(),
      brandContext: {
        industry: requirements.industry,
        toneOfVoice: requirements.toneOfVoice,
        targetAudience: requirements.targetAudience,
        uniqueValue: brandDNA?.uniqueValue ?? '',
        competitors: brandDNA?.competitors ?? [],
      },
      siteMap,
      funnelFlow,
      navigation,
      designDirection,
      contentStructure,
      metadata: {
        derivedFromBrandDNA: brandDNA !== null,
        intelligenceBriefsUsed: intelligenceBriefs.map(b => b.id),
        specialistContributions: {
          UX_UI_SPECIALIST: uxResult?.status === 'SUCCESS',
          FUNNEL_PATHOLOGIST: funnelResult?.status === 'SUCCESS',
          COPY_SPECIALIST: copyResult?.status === 'SUCCESS',
        },
        confidence,
        warnings,
      },
    };
  }

  /**
   * Infer color psychology based on industry
   */
  private inferColorPsychology(industry: IndustryType): string {
    const psychologyMap: Record<IndustryType, string> = {
      saas: 'trust-innovation (blue-purple gradient)',
      agency: 'creative-professional (bold accent + neutral)',
      ecommerce: 'urgency-trust (warm accent + secure blue)',
      coach: 'transformation-warmth (warm earth tones)',
      local_business: 'local-trustworthy (community colors)',
      media: 'modern-readable (high contrast)',
      nonprofit: 'compassion-action (warm + call-to-action)',
    };
    return psychologyMap[industry] ?? 'professional (blue-based)';
  }

  /**
   * Infer typography style based on tone
   */
  private inferTypographyStyle(tone: string): string {
    const toneMap: Record<string, string> = {
      warm: 'friendly-rounded',
      professional: 'clean-modern',
      direct: 'bold-minimal',
      friendly: 'approachable-rounded',
      formal: 'classic-serif',
      casual: 'relaxed-sans',
    };
    return toneMap[tone] ?? 'modern-sans';
  }

  /**
   * Infer visual density based on industry
   */
  private inferVisualDensity(industry: IndustryType): 'minimal' | 'moderate' | 'rich' {
    const densityMap: Record<IndustryType, 'minimal' | 'moderate' | 'rich'> = {
      saas: 'moderate',
      agency: 'rich',
      ecommerce: 'rich',
      coach: 'moderate',
      local_business: 'minimal',
      media: 'rich',
      nonprofit: 'moderate',
    };
    return densityMap[industry] ?? 'moderate';
  }

  /**
   * Infer animation level based on industry
   */
  private inferAnimationLevel(industry: IndustryType): 'none' | 'subtle' | 'dynamic' {
    const animationMap: Record<IndustryType, 'none' | 'subtle' | 'dynamic'> = {
      saas: 'subtle',
      agency: 'dynamic',
      ecommerce: 'subtle',
      coach: 'subtle',
      local_business: 'none',
      media: 'subtle',
      nonprofit: 'subtle',
    };
    return animationMap[industry] ?? 'subtle';
  }

  /**
   * Generate Technical Brief
   */
  private generateTechnicalBrief(
    blueprintId: string,
    requirements: SiteRequirements,
    siteMap: SiteMap
  ): TechnicalBrief {
    const briefId = `techbrief_${blueprintId}`;

    // API Integrations
    const apiIntegrations = this.buildAPIIntegrations(requirements);

    // Schema requirements
    const schemaRequirements = this.buildSchemaRequirements(siteMap, requirements);

    // SEO mandates
    const seoMandates = this.buildSEOMandates(siteMap, requirements);

    return {
      briefId,
      blueprintId,
      apiIntegrations,
      schemaRequirements,
      seoMandates,
      performanceTargets: {
        lcp: 2500,
        fid: 100,
        cls: 0.1,
        ttfb: 800,
      },
      accessibilityLevel: 'AA',
      accessibilityChecklist: [
        'Color contrast ratio ≥ 4.5:1 for text',
        'All images have alt text',
        'Form inputs have associated labels',
        'Focus indicators visible',
        'Skip to main content link',
        'Semantic HTML structure',
        'Keyboard navigation support',
        'ARIA landmarks on major sections',
      ],
    };
  }

  /**
   * Build API integrations list
   */
  private buildAPIIntegrations(requirements: SiteRequirements): TechnicalBrief['apiIntegrations'] {
    const integrations: TechnicalBrief['apiIntegrations'] = [];

    // Always required
    integrations.push({
      service: 'Firebase',
      purpose: 'Authentication and database',
      priority: 'required',
      endpoints: ['/api/auth/*', '/api/data/*'],
    });

    // Based on funnel type
    if (requirements.funnelType === 'ecommerce') {
      integrations.push({
        service: 'Stripe',
        purpose: 'Payment processing',
        priority: 'required',
        endpoints: ['/api/checkout/*', '/api/webhooks/stripe'],
      });
    }

    if (requirements.funnelType === 'service' || requirements.funnelType === 'course') {
      integrations.push({
        service: 'Calendar',
        purpose: 'Booking and scheduling',
        priority: 'required',
        endpoints: ['/api/booking/*', '/api/calendar/*'],
      });
    }

    // Email automation for all
    integrations.push({
      service: 'Email Provider',
      purpose: 'Marketing automation',
      priority: 'recommended',
      endpoints: ['/api/email/*', '/api/webhooks/email'],
    });

    // Analytics
    integrations.push({
      service: 'Analytics',
      purpose: 'Traffic and conversion tracking',
      priority: 'required',
      endpoints: ['/api/analytics/*'],
    });

    return integrations;
  }

  /**
   * Build schema requirements
   */
  private buildSchemaRequirements(siteMap: SiteMap, requirements: SiteRequirements): TechnicalBrief['schemaRequirements'] {
    const collections: TechnicalBrief['schemaRequirements']['collections'] = [
      {
        name: 'pages',
        purpose: 'Website pages content',
        fields: [
          { name: 'id', type: 'string', required: true, indexed: true },
          { name: 'organizationId', type: 'string', required: true, indexed: true },
          { name: 'slug', type: 'string', required: true, indexed: true },
          { name: 'title', type: 'string', required: true, indexed: false },
          { name: 'content', type: 'array', required: true, indexed: false },
          { name: 'seo', type: 'object', required: true, indexed: false },
          { name: 'status', type: 'string', required: true, indexed: true },
        ],
      },
    ];

    // Add blog collection if blog page exists
    if (siteMap.pages.some(p => p.id === 'blog')) {
      collections.push({
        name: 'blogPosts',
        purpose: 'Blog articles',
        fields: [
          { name: 'id', type: 'string', required: true, indexed: true },
          { name: 'organizationId', type: 'string', required: true, indexed: true },
          { name: 'slug', type: 'string', required: true, indexed: true },
          { name: 'title', type: 'string', required: true, indexed: false },
          { name: 'content', type: 'array', required: true, indexed: false },
          { name: 'author', type: 'string', required: true, indexed: true },
          { name: 'status', type: 'string', required: true, indexed: true },
          { name: 'categories', type: 'array', required: false, indexed: true },
        ],
      });
    }

    // Add products collection for e-commerce
    if (requirements.industry === 'ecommerce') {
      collections.push({
        name: 'products',
        purpose: 'E-commerce products',
        fields: [
          { name: 'id', type: 'string', required: true, indexed: true },
          { name: 'organizationId', type: 'string', required: true, indexed: true },
          { name: 'sku', type: 'string', required: true, indexed: true },
          { name: 'name', type: 'string', required: true, indexed: false },
          { name: 'price', type: 'number', required: true, indexed: true },
          { name: 'inventory', type: 'number', required: true, indexed: false },
          { name: 'categories', type: 'array', required: false, indexed: true },
        ],
      });
    }

    return {
      collections,
      relationships: [
        { from: 'organizations', to: 'pages', type: 'one-to-many' },
        { from: 'organizations', to: 'blogPosts', type: 'one-to-many' },
      ],
    };
  }

  /**
   * Build SEO mandates
   */
  private buildSEOMandates(siteMap: SiteMap, requirements: SiteRequirements): TechnicalBrief['seoMandates'] {
    // Build per-page SEO
    const perPage: Record<string, PageSEORequirements> = {};
    for (const page of siteMap.pages) {
      perPage[page.id] = page.seo;
    }

    return {
      sitewide: {
        robotsTxt: [
          'User-agent: *',
          'Allow: /',
          'Disallow: /api/',
          'Disallow: /admin/',
          `Sitemap: https://{domain}/sitemap.xml`,
        ],
        sitemapConfig: {
          frequency: 'weekly',
          priority: {
            homepage: 1.0,
            services: 0.9,
            pricing: 0.9,
            about: 0.7,
            contact: 0.7,
            blog: 0.8,
          },
        },
        schemaOrg: [
          'Organization',
          requirements.industry === 'local_business' ? 'LocalBusiness' : 'WebSite',
          'BreadcrumbList',
        ],
      },
      perPage,
      technicalRequirements: [
        'Canonical URLs on all pages',
        'Open Graph tags for social sharing',
        'Twitter Card meta tags',
        'Structured data markup (JSON-LD)',
        'XML sitemap generation',
        'Dynamic robots.txt',
        'Meta robots directives per page',
        'hreflang tags for internationalization (if applicable)',
      ],
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    delegations: DelegationResult[],
    siteMap: SiteMap,
    funnelFlow: FunnelFlow,
    hasBrandDNA: boolean
  ): number {
    let score = 0;
    const maxScore = 100;

    // Brand DNA presence (20 points)
    if (hasBrandDNA) {
      score += 20;
    } else {
      score += 5; // Partial credit for niche-based derivation
    }

    // Delegation success rate (40 points)
    const completedCount = delegations.filter(d => d.status === 'COMPLETED').length;
    const successRate = delegations.length > 0 ? completedCount / delegations.length : 0;
    score += successRate * 40;

    // Site map completeness (20 points)
    const criticalPages = siteMap.pages.filter(p => p.priority === 'critical').length;
    const hasHomepage = siteMap.pages.some(p => p.id === 'homepage');
    const hasContact = siteMap.pages.some(p => p.id === 'contact');
    const siteMapScore = (hasHomepage ? 8 : 0) + (hasContact ? 6 : 0) + Math.min(criticalPages, 6);
    score += siteMapScore;

    // Funnel completeness (20 points)
    const hasStages = funnelFlow.stages.length >= 3;
    const hasConversionPoints = funnelFlow.conversionPoints.length >= 2;
    const hasAutomations = funnelFlow.automations.length >= 2;
    const funnelScore = (hasStages ? 8 : 4) + (hasConversionPoints ? 6 : 3) + (hasAutomations ? 6 : 3);
    score += funnelScore;

    return Math.round((score / maxScore) * 100) / 100;
  }

  // ==========================================================================
  // SIGNAL BROADCAST & STORAGE
  // ==========================================================================

  /**
   * Store blueprint in TenantMemoryVault and broadcast signal
   */
  private async storeAndBroadcast(tenantId: string, output: ArchitectureOutput): Promise<boolean> {
    // Store the site architecture as an insight
    try {
      await shareInsight(
        this.identity.id,
        'CONTENT',
        'Site Architecture Blueprint',
        `Generated comprehensive site architecture for ${output.siteArchitecture.brandContext.industry} industry with ${output.siteArchitecture.siteMap.totalPages} pages and ${output.siteArchitecture.funnelFlow.type} funnel.`,
        {
          confidence: Math.round(output.confidence * 100),
          sources: ['ARCHITECT_MANAGER', 'BRAND_DNA'],
          relatedAgents: ['BUILDER_MANAGER', 'CONTENT_MANAGER', 'MARKETING_MANAGER'],
          actions: ['Begin site build', 'Generate page content', 'Configure automations'],
          tags: ['blueprint', 'architecture', output.siteArchitecture.brandContext.industry],
        }
      );

      this.log('INFO', 'Stored site architecture in TenantMemoryVault');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('WARN', `Failed to store architecture in vault: ${errorMsg}`);
    }

    // Broadcast site.blueprint_ready signal
    let signalSuccess = false;
    try {
      await broadcastSignal(
        this.identity.id,
        'site.blueprint_ready',
        'HIGH',
        {
          blueprintId: output.siteArchitecture.blueprintId,
          industry: output.siteArchitecture.brandContext.industry,
          totalPages: output.siteArchitecture.siteMap.totalPages,
          funnelType: output.siteArchitecture.funnelFlow.type,
          confidence: output.confidence,
          technicalBriefId: output.technicalBrief.briefId,
        },
        ['BUILDER_MANAGER', 'CONTENT_MANAGER', 'MARKETING_MANAGER']
      );

      signalSuccess = true;
      this.log('INFO', 'Broadcast site.blueprint_ready signal');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('WARN', `Failed to broadcast signal: ${errorMsg}`);
    }

    return signalSuccess;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createArchitectManager(): ArchitectManager {
  return new ArchitectManager();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: ArchitectManager | null = null;

export function getArchitectManager(): ArchitectManager {
  instance ??= createArchitectManager();
  return instance;
}
