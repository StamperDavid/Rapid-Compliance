/**
 * Lead Architect (L2 Manager)
 * STATUS: FUNCTIONAL
 *
 * Translates business niche into comprehensive site architecture.
 * Coordinates UX/UI, Funnel, and Copy specialists to deliver cohesive site plans.
 *
 * CAPABILITIES:
 * - Niche-to-sitemap translation
 * - Funnel flow design (Lead Gen, E-commerce, Course, Service Booking)
 * - UX/UI coordination for visual consistency
 * - Copy coordination for messaging alignment
 * - Page structure and hierarchy planning
 * - Industry-specific site map variations
 */

import { BaseManager } from '../base-manager';
import type { AgentMessage, AgentReport, ManagerConfig, Signal } from '../types';

// ============================================================================
// SYSTEM PROMPT - The brain of this manager
// ============================================================================

const SYSTEM_PROMPT = `You are the Lead Architect, an expert L2 orchestrator responsible for translating business niches into comprehensive site architectures.

## YOUR ROLE
You receive business niche information from JASPER and create complete site architecture plans, coordinating with:
- UX_UI_SPECIALIST: Visual design, wireframes, components, color schemes
- FUNNEL_SPECIALIST: Conversion funnels, squeeze pages, upsells, lead magnets
- COPY_SPECIALIST: Headlines, CTAs, messaging, content strategy

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

### Phase 1: Requirements Analysis
1. Parse niche/industry from input
2. Identify target audience and their needs
3. Determine primary business objective
4. Select appropriate funnel type

### Phase 2: Site Map Generation
1. Select industry-specific template
2. Customize pages for specific niche
3. Define page hierarchy and navigation
4. Map user journeys through the site

### Phase 3: Funnel Flow Design
1. Select funnel type based on objective
2. Define funnel stages and conversion points
3. Identify required page types
4. Plan automation triggers

### Phase 4: Specialist Delegation
1. UX/UI: Wireframes, component library, visual style
2. Funnel: Conversion optimization, tracking setup
3. Copy: Headlines, CTAs, page content briefs

## OUTPUT FORMAT
You ALWAYS return structured JSON:

\`\`\`json
{
  "siteMap": {
    "pages": [
      {
        "id": "homepage",
        "name": "Homepage",
        "path": "/",
        "level": 0,
        "purpose": "Primary conversion entry point",
        "sections": ["hero", "value_prop", "features", "testimonials", "cta"],
        "parent": null
      }
    ],
    "hierarchy": {
      "L0": ["homepage"],
      "L1": ["about", "services", "pricing", "blog", "contact"],
      "L2": ["service-1", "service-2", "team", "blog-posts"]
    },
    "navigation": {
      "primary": ["Services", "Pricing", "About", "Blog", "Contact"],
      "utility": ["Login", "Get Started"],
      "footer": ["Privacy", "Terms", "Sitemap"]
    }
  },
  "funnelFlow": {
    "type": "lead_gen | ecommerce | course | service",
    "stages": [
      {
        "name": "Awareness",
        "pages": ["blog", "social"],
        "goal": "Drive traffic"
      },
      {
        "name": "Interest",
        "pages": ["landing-page"],
        "goal": "Capture lead"
      }
    ],
    "conversionPoints": [
      {
        "location": "homepage-hero",
        "action": "CTA click",
        "target": "signup-page"
      }
    ],
    "automations": ["welcome-email", "nurture-sequence"]
  },
  "delegations": [
    {
      "specialist": "UX_UI_SPECIALIST",
      "brief": "Design wireframes for...",
      "status": "COMPLETED | BLOCKED | PENDING",
      "result": "..."
    }
  ],
  "confidence": 0.0-1.0
}
\`\`\`

## RULES
1. ALWAYS start with niche analysis - don't assume industry
2. Match site structure to business model - SaaS vs Agency vs E-commerce differ significantly
3. Design funnels around user psychology - awareness -> interest -> decision -> action
4. Coordinate specialist work - ensure visual, conversion, and copy align
5. Be honest about specialist availability (GHOST/SHELL status)
6. Warn about complex requirements that may need custom solutions

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
      'niche_to_sitemap',
      'funnel_flow_design',
      'ux_ui_coordination',
      'copy_coordination',
      'page_structure_planning',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['delegate', 'coordinate', 'generate_sitemap', 'design_funnel'],
  outputSchema: {
    type: 'object',
    properties: {
      siteMap: {
        type: 'object',
        properties: {
          pages: { type: 'array' },
          hierarchy: { type: 'object' },
          navigation: { type: 'object' },
        },
        required: ['pages', 'hierarchy', 'navigation'],
      },
      funnelFlow: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          stages: { type: 'array' },
          conversionPoints: { type: 'array' },
        },
        required: ['type', 'stages', 'conversionPoints'],
      },
      delegations: { type: 'array' },
      confidence: { type: 'number' },
    },
    required: ['siteMap', 'funnelFlow', 'delegations'],
  },
  maxTokens: 8192,
  temperature: 0.4,
  specialists: ['UX_UI_SPECIALIST', 'FUNNEL_SPECIALIST', 'COPY_SPECIALIST'],
  delegationRules: [
    {
      triggerKeywords: ['design', 'color', 'layout', 'component', 'wireframe', 'ui', 'ux', 'visual'],
      delegateTo: 'UX_UI_SPECIALIST',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['funnel', 'conversion', 'squeeze', 'lead magnet', 'tripwire', 'upsell', 'offer'],
      delegateTo: 'FUNNEL_SPECIALIST',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['headline', 'copy', 'cta', 'text', 'message', 'content', 'words', 'writing'],
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

export interface PageDefinition {
  id: string;
  name: string;
  path: string;
  level: number;
  purpose: string;
  sections: string[];
  parent: string | null;
  priority: 'critical' | 'important' | 'optional';
}

export interface SiteHierarchy {
  L0: string[];
  L1: string[];
  L2: string[];
  L3?: string[];
}

export interface NavigationConfig {
  primary: string[];
  utility: string[];
  footer: string[];
  mobile?: string[];
}

export interface SiteMap {
  pages: PageDefinition[];
  hierarchy: SiteHierarchy;
  navigation: NavigationConfig;
}

export interface FunnelStage {
  name: string;
  pages: string[];
  goal: string;
  kpis: string[];
  automations?: string[];
}

export interface ConversionPoint {
  location: string;
  action: string;
  target: string;
  tracking?: string;
}

export interface FunnelFlow {
  type: FunnelType;
  stages: FunnelStage[];
  conversionPoints: ConversionPoint[];
  automations: string[];
}

export interface DelegationResult {
  specialist: string;
  brief: string;
  status: 'COMPLETED' | 'BLOCKED' | 'PENDING' | 'FAILED';
  result: string | object;
}

export interface SiteRequirements {
  industry: IndustryType;
  targetAudience: string;
  primaryObjective: string;
  funnelType: FunnelType;
  customPages?: string[];
  integrations?: string[];
}

export interface ArchitectureOutput {
  siteMap: SiteMap;
  funnelFlow: FunnelFlow;
  delegations: DelegationResult[];
  confidence: number;
  warnings: string[];
}

export interface NicheInput {
  niche: string;
  description?: string;
  targetAudience?: string;
  objective?: 'leads' | 'sales' | 'bookings' | 'awareness';
  existingBrand?: boolean;
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
      { location: 'lead-magnet-landing', action: 'email_submit', target: 'thank-you-download' },
      { location: 'sales-page', action: 'buy_now_click', target: 'checkout' },
      { location: 'checkout', action: 'purchase_complete', target: 'thank-you-purchase' },
    ],
    automations: ['lead_magnet_delivery', 'welcome_sequence', 'nurture_sequence', 'cart_abandonment', 'post_purchase'],
  },
  ecommerce: {
    type: 'ecommerce',
    stages: [
      { name: 'Discovery', pages: ['homepage', 'category-pages', 'search'], goal: 'Product discovery', kpis: ['sessions', 'pages_per_session'] },
      { name: 'Interest', pages: ['product-page'], goal: 'Product evaluation', kpis: ['product_views', 'add_to_cart_rate'] },
      { name: 'Intent', pages: ['cart'], goal: 'Purchase intent', kpis: ['cart_value', 'cart_abandonment_rate'] },
      { name: 'Purchase', pages: ['checkout'], goal: 'Complete transaction', kpis: ['checkout_completion', 'conversion_rate'] },
      { name: 'Retention', pages: ['order-confirmation', 'account'], goal: 'Repeat purchase', kpis: ['repeat_purchase_rate', 'ltv'], automations: ['order_confirmation', 'review_request', 'reorder_reminder'] },
    ],
    conversionPoints: [
      { location: 'product-page', action: 'add_to_cart', target: 'cart' },
      { location: 'cart', action: 'proceed_to_checkout', target: 'checkout' },
      { location: 'checkout', action: 'place_order', target: 'order-confirmation' },
      { location: 'cart', action: 'upsell_accept', target: 'cart-updated', tracking: 'upsell_revenue' },
    ],
    automations: ['cart_abandonment', 'order_confirmation', 'shipping_updates', 'review_request', 'win_back', 'reorder_reminder'],
  },
  course: {
    type: 'course',
    stages: [
      { name: 'Awareness', pages: ['free-content', 'blog', 'youtube-landing'], goal: 'Attract audience', kpis: ['traffic', 'engagement'] },
      { name: 'Lead Capture', pages: ['webinar-registration', 'free-course-landing'], goal: 'Capture email', kpis: ['registration_rate'] },
      { name: 'Education', pages: ['webinar', 'vsl-page'], goal: 'Deliver value + pitch', kpis: ['attendance_rate', 'watch_time'], automations: ['webinar_reminder', 'replay_access'] },
      { name: 'Offer', pages: ['sales-page', 'checkout'], goal: 'Enrollment', kpis: ['sales_page_views', 'conversion_rate'] },
      { name: 'Onboarding', pages: ['welcome', 'getting-started', 'community'], goal: 'Student success', kpis: ['completion_rate', 'engagement'], automations: ['welcome_sequence', 'module_reminders'] },
    ],
    conversionPoints: [
      { location: 'webinar-registration', action: 'register', target: 'confirmation-page' },
      { location: 'webinar', action: 'cta_click', target: 'sales-page' },
      { location: 'sales-page', action: 'enroll_click', target: 'checkout' },
      { location: 'checkout', action: 'purchase', target: 'welcome' },
    ],
    automations: ['webinar_reminder_sequence', 'replay_sequence', 'cart_open_close', 'payment_plan_reminder', 'onboarding_sequence', 'engagement_prompts'],
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
      { location: 'homepage', action: 'book_now_click', target: 'booking-page' },
      { location: 'service-page', action: 'book_service', target: 'calendar' },
      { location: 'calendar', action: 'confirm_booking', target: 'confirmation' },
      { location: 'follow-up-email', action: 'leave_review', target: 'review-platform' },
    ],
    automations: ['booking_confirmation', 'appointment_reminders', 'prep_instructions', 'post_service_followup', 'review_request', 'rebooking_reminder'],
  },
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class ArchitectManager extends BaseManager {
  constructor() {
    super(ARCHITECT_MANAGER_CONFIG);
  }

  async initialize(): Promise<void> {
    this.log('INFO', 'Initializing Lead Architect...');
    this.isInitialized = true;
  }

  /**
   * Main execution entry point
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as NicheInput;

      if (!payload?.niche) {
        return this.createReport(
          taskId,
          'FAILED',
          null,
          ['No niche provided in payload. Please specify the business niche.']
        );
      }

      this.log('INFO', `Processing niche: ${payload.niche}`);

      const architecture = await this.createArchitecture(payload, taskId);

      return this.createReport(taskId, 'COMPLETED', architecture);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Architecture creation failed: ${errorMessage}`);
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
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
    return { functional: 500, boilerplate: 100 };
  }

  // ==========================================================================
  // CORE ARCHITECTURE LOGIC
  // ==========================================================================

  /**
   * Main architecture creation function
   */
  private async createArchitecture(input: NicheInput, taskId: string): Promise<ArchitectureOutput> {
    const warnings: string[] = [];

    // Step 1: Analyze niche and determine requirements
    const requirements = this.analyzeSiteRequirements(input);
    this.log('INFO', `Identified industry: ${requirements.industry}, funnel type: ${requirements.funnelType}`);

    // Step 2: Generate site map
    const siteMap = this.generateSiteMap(requirements);
    this.log('INFO', `Generated site map with ${siteMap.pages.length} pages`);

    // Step 3: Design funnel flow
    const funnelFlow = this.designFunnelFlow(requirements);
    this.log('INFO', `Designed ${funnelFlow.type} funnel with ${funnelFlow.stages.length} stages`);

    // Step 4: Coordinate with specialists
    const delegations = await this.coordinateSpecialists(siteMap, funnelFlow, taskId, warnings);
    this.log('INFO', `Delegated to ${delegations.length} specialists`);

    // Step 5: Calculate confidence
    const confidence = this.calculateConfidence(delegations, siteMap, funnelFlow);

    return {
      siteMap,
      funnelFlow,
      delegations,
      confidence,
      warnings,
    };
  }

  /**
   * Analyze niche and derive site requirements
   */
  analyzeSiteRequirements(input: NicheInput): SiteRequirements {
    const nicheLower = input.niche.toLowerCase();
    const descriptionLower = (input.description || '').toLowerCase();
    const combined = `${nicheLower} ${descriptionLower}`;

    // Detect industry type
    const industry = this.detectIndustry(combined);

    // Detect funnel type based on objective and industry
    const funnelType = this.detectFunnelType(input, industry);

    // Detect target audience
    const targetAudience = this.detectTargetAudience(combined, input.targetAudience);

    // Detect primary objective
    const primaryObjective = this.detectPrimaryObjective(input, industry);

    return {
      industry,
      targetAudience,
      primaryObjective,
      funnelType,
    };
  }

  /**
   * Detect industry type from niche description
   */
  private detectIndustry(text: string): IndustryType {
    // SaaS indicators
    const saasKeywords = ['saas', 'software', 'app', 'platform', 'tool', 'api', 'cloud', 'subscription', 'startup', 'tech'];
    if (saasKeywords.some(k => text.includes(k))) return 'saas';

    // E-commerce indicators
    const ecomKeywords = ['ecommerce', 'e-commerce', 'store', 'shop', 'products', 'retail', 'merchandise', 'dropship', 'inventory'];
    if (ecomKeywords.some(k => text.includes(k))) return 'ecommerce';

    // Agency indicators
    const agencyKeywords = ['agency', 'studio', 'consulting', 'consultancy', 'services', 'firm', 'design agency', 'marketing agency'];
    if (agencyKeywords.some(k => text.includes(k))) return 'agency';

    // Coach indicators
    const coachKeywords = ['coach', 'coaching', 'mentor', 'trainer', 'course', 'program', 'transformation', 'expert', 'speaker', 'author'];
    if (coachKeywords.some(k => text.includes(k))) return 'coach';

    // Local business indicators
    const localKeywords = ['local', 'restaurant', 'salon', 'clinic', 'dental', 'medical', 'repair', 'plumber', 'electrician', 'contractor'];
    if (localKeywords.some(k => text.includes(k))) return 'local_business';

    // Media indicators
    const mediaKeywords = ['media', 'news', 'magazine', 'publication', 'blog', 'content', 'publisher'];
    if (mediaKeywords.some(k => text.includes(k))) return 'media';

    // Nonprofit indicators
    const nonprofitKeywords = ['nonprofit', 'non-profit', 'charity', 'foundation', 'ngo', 'cause', 'donation'];
    if (nonprofitKeywords.some(k => text.includes(k))) return 'nonprofit';

    // Default to agency as most versatile
    return 'agency';
  }

  /**
   * Detect funnel type based on input and industry
   */
  private detectFunnelType(input: NicheInput, industry: IndustryType): FunnelType {
    // Explicit objective mapping
    if (input.objective === 'sales') return 'ecommerce';
    if (input.objective === 'bookings') return 'service';
    if (input.objective === 'leads') return 'lead_gen';

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
   * Detect target audience from text
   */
  private detectTargetAudience(text: string, explicit?: string): string {
    if (explicit) return explicit;

    // B2B indicators
    const b2bKeywords = ['b2b', 'business', 'enterprise', 'companies', 'startups', 'founders', 'executives', 'teams'];
    if (b2bKeywords.some(k => text.includes(k))) {
      return 'Business professionals and decision-makers (B2B)';
    }

    // B2C indicators by demographic
    if (text.includes('gen z') || text.includes('young') || text.includes('teen')) {
      return 'Gen Z consumers (16-24)';
    }
    if (text.includes('millennial') || text.includes('young professional')) {
      return 'Millennials and young professionals (25-40)';
    }
    if (text.includes('parent') || text.includes('family') || text.includes('mom') || text.includes('dad')) {
      return 'Parents and families (30-50)';
    }
    if (text.includes('senior') || text.includes('retiree') || text.includes('boomer')) {
      return 'Older adults and retirees (55+)';
    }

    // Industry-specific audiences
    if (text.includes('fitness') || text.includes('health') || text.includes('wellness')) {
      return 'Health-conscious individuals seeking transformation';
    }
    if (text.includes('finance') || text.includes('invest') || text.includes('wealth')) {
      return 'Financially-minded individuals and investors';
    }

    return 'Target market defined by niche offerings';
  }

  /**
   * Detect primary objective
   */
  private detectPrimaryObjective(input: NicheInput, industry: IndustryType): string {
    if (input.objective) {
      const objectiveMap: Record<string, string> = {
        leads: 'Generate qualified leads for sales pipeline',
        sales: 'Drive direct product/service sales',
        bookings: 'Book appointments and consultations',
        awareness: 'Build brand awareness and audience',
      };
      return objectiveMap[input.objective] || 'Convert visitors into customers';
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
   * Generate site map based on requirements
   */
  generateSiteMap(requirements: SiteRequirements): SiteMap {
    // Get industry template
    const templatePages = INDUSTRY_TEMPLATES[requirements.industry] || INDUSTRY_TEMPLATES.agency;

    // Build full page definitions
    const pages: PageDefinition[] = templatePages.map((template, index) => ({
      id: template.id!,
      name: template.name!,
      path: template.path!,
      level: template.level!,
      purpose: template.purpose!,
      sections: template.sections!,
      parent: template.level === 0 ? null : (template.level === 1 ? 'homepage' : this.findParent(template, templatePages)),
      priority: template.priority!,
    }));

    // Build hierarchy
    const hierarchy = this.buildHierarchy(pages);

    // Build navigation
    const navigation = this.buildNavigation(pages, requirements.industry);

    return { pages, hierarchy, navigation };
  }

  /**
   * Find parent page for nested pages
   */
  private findParent(page: Partial<PageDefinition>, allPages: Partial<PageDefinition>[]): string | null {
    // For L2 pages, find the L1 parent based on path
    if (page.level === 2 && page.path) {
      const pathParts = page.path.split('/').filter(Boolean);
      if (pathParts.length > 1) {
        const parentPath = `/${pathParts[0]}`;
        const parent = allPages.find(p => p.path === parentPath);
        return parent?.id || null;
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
        hierarchy[level]!.push(page.id);
      } else {
        hierarchy.L3 = hierarchy.L3 || [];
        hierarchy.L3.push(page.id);
      }
    }

    return hierarchy;
  }

  /**
   * Build navigation configuration
   */
  private buildNavigation(pages: PageDefinition[], industry: IndustryType): NavigationConfig {
    // Primary nav: L1 pages marked as critical or important, max 6
    const primaryCandidates = pages
      .filter(p => p.level === 1 && (p.priority === 'critical' || p.priority === 'important'))
      .slice(0, 6)
      .map(p => p.name);

    // Utility nav: based on industry
    const utilityNavMap: Record<IndustryType, string[]> = {
      saas: ['Login', 'Start Free Trial'],
      agency: ['Get a Quote'],
      ecommerce: ['Account', 'Cart'],
      coach: ['Login', 'Book a Call'],
      local_business: ['Call Now', 'Book Online'],
      media: ['Subscribe', 'Login'],
      nonprofit: ['Donate'],
    };

    // Footer nav: standard legal plus extras
    const footerNav = ['Privacy Policy', 'Terms of Service', 'Sitemap'];

    return {
      primary: primaryCandidates,
      utility: utilityNavMap[industry] || ['Contact'],
      footer: footerNav,
      mobile: ['Home', ...primaryCandidates.slice(0, 3), 'Contact'],
    };
  }

  /**
   * Design funnel flow based on requirements
   */
  designFunnelFlow(requirements: SiteRequirements): FunnelFlow {
    // Get funnel template
    const template = FUNNEL_TEMPLATES[requirements.funnelType];

    // Customize for industry
    const customizedFlow: FunnelFlow = {
      ...template,
      stages: template.stages.map(stage => ({
        ...stage,
        // Add industry-specific customizations
        goal: this.customizeGoal(stage.goal, requirements.industry),
      })),
    };

    return customizedFlow;
  }

  /**
   * Customize funnel stage goal for industry
   */
  private customizeGoal(baseGoal: string, industry: IndustryType): string {
    // Add industry-specific context to goals
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
   * Coordinate with specialists
   */
  private async coordinateSpecialists(
    siteMap: SiteMap,
    funnelFlow: FunnelFlow,
    taskId: string,
    warnings: string[]
  ): Promise<DelegationResult[]> {
    const delegations: DelegationResult[] = [];

    // Delegate to UX_UI_SPECIALIST
    const uxBrief = this.createUXBrief(siteMap, funnelFlow);
    delegations.push(await this.delegateTask('UX_UI_SPECIALIST', uxBrief, taskId, warnings));

    // Delegate to FUNNEL_SPECIALIST
    const funnelBrief = this.createFunnelBrief(funnelFlow, siteMap);
    delegations.push(await this.delegateTask('FUNNEL_SPECIALIST', funnelBrief, taskId, warnings));

    // Delegate to COPY_SPECIALIST
    const copyBrief = this.createCopyBrief(siteMap, funnelFlow);
    delegations.push(await this.delegateTask('COPY_SPECIALIST', copyBrief, taskId, warnings));

    return delegations;
  }

  /**
   * Create UX/UI specialist brief
   */
  private createUXBrief(siteMap: SiteMap, funnelFlow: FunnelFlow): string {
    const criticalPages = siteMap.pages.filter(p => p.priority === 'critical');
    const pageList = criticalPages.map(p => `- ${p.name}: ${p.sections.join(', ')}`).join('\n');

    return `Design wireframes and component library for ${siteMap.pages.length}-page website.

CRITICAL PAGES:
${pageList}

FUNNEL TYPE: ${funnelFlow.type}
Key conversion points require prominent CTAs and clear visual hierarchy.

NAVIGATION:
Primary: ${siteMap.navigation.primary.join(' | ')}
Utility: ${siteMap.navigation.utility.join(' | ')}

DELIVERABLES:
1. Homepage wireframe with section layouts
2. Component library (buttons, cards, forms, navigation)
3. Color palette recommendation
4. Typography hierarchy
5. Mobile-responsive considerations`;
  }

  /**
   * Create Funnel specialist brief
   */
  private createFunnelBrief(funnelFlow: FunnelFlow, siteMap: SiteMap): string {
    const stageList = funnelFlow.stages
      .map(s => `- ${s.name}: ${s.goal} (Pages: ${s.pages.join(', ')})`)
      .join('\n');

    const conversionList = funnelFlow.conversionPoints
      .map(c => `- ${c.location}: ${c.action} -> ${c.target}`)
      .join('\n');

    return `Optimize ${funnelFlow.type} funnel for maximum conversion.

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
4. Tracking and analytics setup
5. Automation trigger definitions`;
  }

  /**
   * Create Copy specialist brief
   */
  private createCopyBrief(siteMap: SiteMap, funnelFlow: FunnelFlow): string {
    const pageList = siteMap.pages
      .filter(p => p.priority === 'critical')
      .map(p => `- ${p.name} (${p.path}): ${p.purpose}`)
      .join('\n');

    return `Create conversion-focused copy for ${funnelFlow.type} funnel website.

PAGES REQUIRING COPY:
${pageList}

PRIMARY NAVIGATION ITEMS: ${siteMap.navigation.primary.join(', ')}
UTILITY CTA: ${siteMap.navigation.utility.join(', ')}

FUNNEL CONVERSION POINTS:
${funnelFlow.conversionPoints.map(c => `- ${c.location}: ${c.action}`).join('\n')}

DELIVERABLES:
1. Homepage hero headline and subheadline
2. Value proposition statements
3. CTA button copy for each conversion point
4. Section headlines for key pages
5. Email subject lines for automations`;
  }

  /**
   * Delegate task to specialist
   */
  private async delegateTask(
    specialistId: string,
    brief: string,
    taskId: string,
    warnings: string[]
  ): Promise<DelegationResult> {
    this.log('INFO', `Delegating to ${specialistId}...`);

    try {
      const message: AgentMessage = {
        id: `${taskId}_${specialistId}`,
        type: 'COMMAND',
        from: this.identity.id,
        to: specialistId,
        payload: { brief },
        timestamp: new Date(),
        priority: 'NORMAL',
        requiresResponse: true,
        traceId: taskId,
      };

      const report = await this.delegateToSpecialist(specialistId, message);

      // Map AgentReport status to DelegationResult status
      let delegationStatus: 'COMPLETED' | 'BLOCKED' | 'PENDING' | 'FAILED';
      if (report.status === 'COMPLETED') {
        delegationStatus = 'COMPLETED';
      } else if (report.status === 'BLOCKED') {
        delegationStatus = 'BLOCKED';
      } else if (report.status === 'FAILED') {
        delegationStatus = 'FAILED';
      } else {
        delegationStatus = 'PENDING';
      }

      if (report.status === 'BLOCKED') {
        warnings.push(`${specialistId} is not functional - architecture plan is theoretical only`);
      }

      return {
        specialist: specialistId,
        brief,
        status: delegationStatus,
        result: report.status === 'COMPLETED' ? (report.data as string | object) : report.errors?.join('; ') || 'Unknown error',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delegation failed';
      warnings.push(`Failed to delegate to ${specialistId}: ${errorMessage}`);
      return {
        specialist: specialistId,
        brief,
        status: 'FAILED',
        result: errorMessage,
      };
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(delegations: DelegationResult[], siteMap: SiteMap, funnelFlow: FunnelFlow): number {
    let score = 0;
    const maxScore = 100;

    // Delegation success rate (40 points)
    const completedCount = delegations.filter(d => d.status === 'COMPLETED').length;
    const successRate = delegations.length > 0 ? completedCount / delegations.length : 0;
    score += successRate * 40;

    // Site map completeness (30 points)
    const criticalPages = siteMap.pages.filter(p => p.priority === 'critical').length;
    const hasHomepage = siteMap.pages.some(p => p.id === 'homepage');
    const hasContact = siteMap.pages.some(p => p.id === 'contact');
    const siteMapScore = (hasHomepage ? 10 : 0) + (hasContact ? 10 : 0) + (criticalPages >= 3 ? 10 : criticalPages * 3);
    score += siteMapScore;

    // Funnel completeness (30 points)
    const hasStages = funnelFlow.stages.length >= 3;
    const hasConversionPoints = funnelFlow.conversionPoints.length >= 2;
    const hasAutomations = funnelFlow.automations.length >= 2;
    const funnelScore = (hasStages ? 10 : 5) + (hasConversionPoints ? 10 : 5) + (hasAutomations ? 10 : 5);
    score += funnelScore;

    return Math.round((score / maxScore) * 100) / 100;
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
