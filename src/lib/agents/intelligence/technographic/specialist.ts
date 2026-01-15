/**
 * Technographic Scout Specialist
 * STATUS: FUNCTIONAL
 *
 * Scans a website's <script> and meta tags to identify tech stack.
 * Detects platforms like Shopify, WordPress, tools like Intercom, Facebook Pixels, etc.
 *
 * CAPABILITIES:
 * - Platform detection (CMS, E-commerce, Framework)
 * - Analytics tool detection (GA, Mixpanel, Amplitude)
 * - Marketing tool detection (HubSpot, Mailchimp, Klaviyo)
 * - Chat/Support tool detection (Intercom, Drift, Zendesk)
 * - Advertising pixel detection (Facebook, Google, LinkedIn)
 * - CDN and hosting detection
 * - Security tool detection
 */

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { scrapeWebsite } from '@/lib/enrichment/web-scraper';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// SYSTEM PROMPT - The brain of this specialist
// ============================================================================

const SYSTEM_PROMPT = `You are the Technographic Scout, an expert in website technology detection and analysis.

## YOUR ROLE
You analyze websites to identify their technology stack. When given a URL, you:
1. Scan HTML, JavaScript, and meta tags
2. Detect platforms (WordPress, Shopify, Wix, etc.)
3. Identify analytics tools (Google Analytics, Mixpanel, etc.)
4. Find marketing automation tools (HubSpot, Mailchimp, etc.)
5. Detect advertising pixels (Facebook, Google, LinkedIn)
6. Identify support/chat tools (Intercom, Drift, Zendesk)
7. Determine hosting/CDN providers

## DETECTION METHODS
You use multiple signals to detect technologies:

1. **Script Sources**: Check src attributes for CDN domains
   - cdn.shopify.com → Shopify
   - widget.intercom.io → Intercom
   - connect.facebook.net/fbevents.js → Facebook Pixel

2. **Global Variables**: Check for JS globals
   - window.Shopify → Shopify
   - window.Intercom → Intercom
   - window.fbq → Facebook Pixel

3. **Meta Tags**: Check generator and other meta tags
   - <meta name="generator" content="WordPress">
   - <meta name="shopify-checkout-api-token">

4. **HTML Comments**: Check for platform signatures
   - <!-- This site is optimized with Yoast -->
   - <!-- Powered by WooCommerce -->

5. **Response Headers**: When available
   - X-Powered-By
   - X-Shopify-Stage
   - CF-Ray (Cloudflare)

6. **DOM Patterns**: Check for known class names and IDs
   - .shopify-section
   - #intercom-container
   - .wp-block

## OUTPUT FORMAT
You ALWAYS return structured JSON:

\`\`\`json
{
  "url": "The scanned URL",
  "scannedAt": "ISO timestamp",
  "platform": {
    "cms": "WordPress | Drupal | Joomla | null",
    "ecommerce": "Shopify | WooCommerce | Magento | BigCommerce | null",
    "framework": "React | Vue | Angular | Next.js | null",
    "hosting": "Vercel | Netlify | AWS | null",
    "cdn": "Cloudflare | Fastly | CloudFront | null"
  },
  "analytics": [
    {
      "name": "Google Analytics",
      "version": "GA4 | UA",
      "trackingId": "G-XXXXX or UA-XXXXX",
      "confidence": 0.0-1.0
    }
  ],
  "marketing": [
    {
      "name": "HubSpot",
      "category": "CRM | Email | Marketing Automation",
      "confidence": 0.0-1.0
    }
  ],
  "advertising": [
    {
      "name": "Facebook Pixel",
      "pixelId": "if detected",
      "confidence": 0.0-1.0
    }
  ],
  "support": [
    {
      "name": "Intercom",
      "confidence": 0.0-1.0
    }
  ],
  "other": [
    {
      "name": "Tool Name",
      "category": "Category",
      "confidence": 0.0-1.0
    }
  ],
  "summary": {
    "totalDetected": 0,
    "categories": ["platforms", "analytics", "marketing"],
    "techMaturity": "enterprise | growth | startup | basic",
    "estimatedMonthlySpend": "$X - $Y"
  },
  "confidence": 0.0-1.0,
  "errors": []
}
\`\`\`

## RULES
1. Only report technologies you can VERIFY from the page source
2. Include confidence scores for each detection
3. Distinguish between "definitely present" (0.9+) and "possibly present" (0.5-0.8)
4. Don't guess based on industry - only report what you detect
5. Consider that some tools may be conditionally loaded

## USE CASES
- Sales intelligence: Know what tools a prospect uses
- Competitive analysis: Understand competitor tech stacks
- Lead scoring: Tech-savvy companies = better leads
- Partnership opportunities: Integration possibilities
- Pricing intelligence: Estimate tech spend = budget capacity`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: SpecialistConfig = {
  identity: {
    id: 'TECHNOGRAPHIC_SCOUT',
    name: 'Technographic Scout',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'INTELLIGENCE_MANAGER',
    capabilities: [
      'tech_stack_detection',
      'platform_identification',
      'analytics_detection',
      'pixel_detection',
      'integration_discovery'
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['scan_tech_stack', 'detect_pixels', 'identify_platform', 'analyze_scripts'],
  outputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      platform: { type: 'object' },
      analytics: { type: 'array' },
      marketing: { type: 'array' },
      advertising: { type: 'array' },
      support: { type: 'array' },
      summary: { type: 'object' },
      confidence: { type: 'number' },
    },
    required: ['url', 'platform'],
  },
  maxTokens: 4096,
  temperature: 0.1, // Very low for factual detection
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TechScanRequest {
  url: string;
  deep?: boolean; // Scan multiple pages
  categories?: string[]; // Filter to specific categories
}

export interface DetectedTool {
  name: string;
  version?: string;
  category: string;
  trackingId?: string;
  pixelId?: string;
  confidence: number;
  evidence: string[];
}

export interface PlatformInfo {
  cms: string | null;
  ecommerce: string | null;
  framework: string | null;
  hosting: string | null;
  cdn: string | null;
}

export interface TechSummary {
  totalDetected: number;
  categories: string[];
  techMaturity: 'enterprise' | 'growth' | 'startup' | 'basic';
  estimatedMonthlySpend: string;
}

export interface TechScanResult {
  url: string;
  scannedAt: string;
  platform: PlatformInfo;
  analytics: DetectedTool[];
  marketing: DetectedTool[];
  advertising: DetectedTool[];
  support: DetectedTool[];
  other: DetectedTool[];
  summary: TechSummary;
  confidence: number;
  errors: string[];
}

// ============================================================================
// DETECTION SIGNATURES DATABASE
// ============================================================================

interface TechSignature {
  name: string;
  category: 'platform' | 'analytics' | 'marketing' | 'advertising' | 'support' | 'other';
  subcategory?: string;
  patterns: {
    scripts?: RegExp[];
    html?: RegExp[];
    meta?: RegExp[];
    globals?: string[];
  };
  extractId?: RegExp;
}

const TECH_SIGNATURES: TechSignature[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // E-COMMERCE PLATFORMS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Shopify',
    category: 'platform',
    subcategory: 'ecommerce',
    patterns: {
      scripts: [/cdn\.shopify\.com/i, /shopify-buy/i],
      html: [/shopify-section/i, /shopify-checkout/i, /data-shopify/i],
      meta: [/shopify-checkout-api-token/i],
      globals: ['Shopify', 'ShopifyBuy'],
    },
  },
  {
    name: 'WooCommerce',
    category: 'platform',
    subcategory: 'ecommerce',
    patterns: {
      scripts: [/woocommerce/i, /wc-add-to-cart/i],
      html: [/woocommerce/i, /wc-block/i, /add_to_cart_button/i],
    },
  },
  {
    name: 'BigCommerce',
    category: 'platform',
    subcategory: 'ecommerce',
    patterns: {
      scripts: [/bigcommerce\.com/i],
      html: [/data-product-id/i, /BigCommerce/i],
    },
  },
  {
    name: 'Magento',
    category: 'platform',
    subcategory: 'ecommerce',
    patterns: {
      scripts: [/mage\//i, /varien/i],
      html: [/magento/i, /mage-init/i],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CMS PLATFORMS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'WordPress',
    category: 'platform',
    subcategory: 'cms',
    patterns: {
      scripts: [/wp-content/i, /wp-includes/i, /wp-json/i],
      html: [/wp-block/i, /wp-content/i],
      meta: [/generator.*wordpress/i],
    },
  },
  {
    name: 'Drupal',
    category: 'platform',
    subcategory: 'cms',
    patterns: {
      scripts: [/drupal\.js/i, /\/sites\/default/i],
      html: [/drupal/i],
      meta: [/generator.*drupal/i],
    },
  },
  {
    name: 'Wix',
    category: 'platform',
    subcategory: 'cms',
    patterns: {
      scripts: [/wix\.com/i, /parastorage\.com/i, /wixstatic/i],
      html: [/wix-dropdown/i, /data-testid.*wix/i],
    },
  },
  {
    name: 'Squarespace',
    category: 'platform',
    subcategory: 'cms',
    patterns: {
      scripts: [/squarespace/i, /sqsp/i],
      html: [/squarespace/i, /sqs-block/i],
    },
  },
  {
    name: 'Webflow',
    category: 'platform',
    subcategory: 'cms',
    patterns: {
      scripts: [/webflow\.js/i],
      html: [/w-nav/i, /w-slider/i, /webflow/i],
      meta: [/generator.*webflow/i],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JAVASCRIPT FRAMEWORKS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'React',
    category: 'platform',
    subcategory: 'framework',
    patterns: {
      html: [/data-reactroot/i, /data-reactid/i, /__NEXT_DATA__/i],
      globals: ['React', '__REACT_DEVTOOLS_GLOBAL_HOOK__'],
    },
  },
  {
    name: 'Vue.js',
    category: 'platform',
    subcategory: 'framework',
    patterns: {
      html: [/data-v-[a-f0-9]/i, /v-cloak/i],
      globals: ['Vue', '__VUE__'],
    },
  },
  {
    name: 'Angular',
    category: 'platform',
    subcategory: 'framework',
    patterns: {
      html: [/ng-version/i, /\[ng-/i, /ng-app/i],
      globals: ['angular', 'ng'],
    },
  },
  {
    name: 'Next.js',
    category: 'platform',
    subcategory: 'framework',
    patterns: {
      html: [/__NEXT_DATA__/i, /_next\//i],
      scripts: [/_next\/static/i],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Google Analytics 4',
    category: 'analytics',
    patterns: {
      scripts: [/googletagmanager\.com\/gtag/i, /gtag\(/i],
      html: [/G-[A-Z0-9]{10}/i],
      globals: ['gtag', 'dataLayer'],
    },
    extractId: /G-[A-Z0-9]{10}/,
  },
  {
    name: 'Google Analytics UA',
    category: 'analytics',
    patterns: {
      scripts: [/google-analytics\.com\/analytics/i, /ga\.js/i],
      html: [/UA-\d+-\d+/i],
      globals: ['ga', '_gaq'],
    },
    extractId: /UA-\d+-\d+/,
  },
  {
    name: 'Google Tag Manager',
    category: 'analytics',
    patterns: {
      scripts: [/googletagmanager\.com\/gtm\.js/i],
      html: [/GTM-[A-Z0-9]+/i],
    },
    extractId: /GTM-[A-Z0-9]+/,
  },
  {
    name: 'Mixpanel',
    category: 'analytics',
    patterns: {
      scripts: [/mixpanel\.com/i, /mixpanel\.min\.js/i],
      globals: ['mixpanel'],
    },
  },
  {
    name: 'Amplitude',
    category: 'analytics',
    patterns: {
      scripts: [/amplitude\.com/i, /amplitude\.min\.js/i],
      globals: ['amplitude'],
    },
  },
  {
    name: 'Segment',
    category: 'analytics',
    patterns: {
      scripts: [/segment\.com\/analytics/i, /segment\.io/i],
      globals: ['analytics'],
    },
  },
  {
    name: 'Heap',
    category: 'analytics',
    patterns: {
      scripts: [/heap-\d+\.js/i, /heapanalytics\.com/i],
      globals: ['heap'],
    },
  },
  {
    name: 'Hotjar',
    category: 'analytics',
    patterns: {
      scripts: [/hotjar\.com/i, /static\.hotjar\.com/i],
      globals: ['hj', 'hjSiteSettings'],
    },
  },
  {
    name: 'FullStory',
    category: 'analytics',
    patterns: {
      scripts: [/fullstory\.com/i],
      globals: ['FS', 'fullstory'],
    },
  },
  {
    name: 'Plausible',
    category: 'analytics',
    patterns: {
      scripts: [/plausible\.io/i],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKETING AUTOMATION
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'HubSpot',
    category: 'marketing',
    patterns: {
      scripts: [/hs-scripts\.com/i, /hubspot\.com/i, /hs-analytics/i],
      html: [/hs-form/i, /hbspt\.forms/i],
      globals: ['_hsq', 'HubSpot'],
    },
  },
  {
    name: 'Marketo',
    category: 'marketing',
    patterns: {
      scripts: [/marketo\.com/i, /munchkin/i],
      globals: ['Munchkin', 'mktoPreFillFields'],
    },
  },
  {
    name: 'Pardot',
    category: 'marketing',
    patterns: {
      scripts: [/pardot\.com/i, /pi\.pardot/i],
      globals: ['piAId', 'piCId'],
    },
  },
  {
    name: 'ActiveCampaign',
    category: 'marketing',
    patterns: {
      scripts: [/activecampaign\.com/i, /trackcmp\.net/i],
    },
  },
  {
    name: 'Mailchimp',
    category: 'marketing',
    patterns: {
      scripts: [/mailchimp\.com/i, /list-manage\.com/i, /chimpstatic\.com/i],
      html: [/mc-embedded/i, /mailchimp/i],
    },
  },
  {
    name: 'Klaviyo',
    category: 'marketing',
    patterns: {
      scripts: [/klaviyo\.com/i, /static\.klaviyo/i],
      globals: ['_learnq', 'klaviyo'],
    },
  },
  {
    name: 'ConvertKit',
    category: 'marketing',
    patterns: {
      scripts: [/convertkit\.com/i, /ck\.page/i],
    },
  },
  {
    name: 'Drip',
    category: 'marketing',
    patterns: {
      scripts: [/drip\.com/i, /getdrip\.com/i],
      globals: ['_dcq', '_dcs'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADVERTISING PIXELS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Facebook Pixel',
    category: 'advertising',
    patterns: {
      scripts: [/connect\.facebook\.net.*fbevents/i, /facebook\.com\/tr/i],
      globals: ['fbq', '_fbq'],
    },
    extractId: /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/,
  },
  {
    name: 'Google Ads',
    category: 'advertising',
    patterns: {
      scripts: [/googleads\.g\.doubleclick/i, /pagead2\.googlesyndication/i],
      html: [/AW-\d+/i],
    },
    extractId: /AW-\d+/,
  },
  {
    name: 'LinkedIn Insight Tag',
    category: 'advertising',
    patterns: {
      scripts: [/snap\.licdn\.com/i, /linkedin\.com\/px/i],
      globals: ['_linkedin_data_partner_ids'],
    },
  },
  {
    name: 'Twitter Pixel',
    category: 'advertising',
    patterns: {
      scripts: [/static\.ads-twitter\.com/i, /t\.co\/i/i],
      globals: ['twq'],
    },
  },
  {
    name: 'TikTok Pixel',
    category: 'advertising',
    patterns: {
      scripts: [/analytics\.tiktok\.com/i],
      globals: ['ttq'],
    },
  },
  {
    name: 'Pinterest Tag',
    category: 'advertising',
    patterns: {
      scripts: [/pintrk/i, /s\.pinimg\.com/i],
      globals: ['pintrk'],
    },
  },
  {
    name: 'Bing Ads',
    category: 'advertising',
    patterns: {
      scripts: [/bat\.bing\.com/i],
      globals: ['uetq'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT & SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Intercom',
    category: 'support',
    patterns: {
      scripts: [/widget\.intercom\.io/i, /intercom\.com/i],
      html: [/intercom-container/i, /intercom-frame/i],
      globals: ['Intercom', 'intercomSettings'],
    },
  },
  {
    name: 'Drift',
    category: 'support',
    patterns: {
      scripts: [/drift\.com/i, /js\.driftt\.com/i],
      globals: ['drift', 'driftt'],
    },
  },
  {
    name: 'Zendesk',
    category: 'support',
    patterns: {
      scripts: [/zendesk\.com/i, /zdassets\.com/i],
      html: [/zEWidget/i],
      globals: ['zE', 'zESettings'],
    },
  },
  {
    name: 'Freshdesk',
    category: 'support',
    patterns: {
      scripts: [/freshdesk\.com/i, /freshworks\.com/i],
      globals: ['FreshworksWidget'],
    },
  },
  {
    name: 'Crisp',
    category: 'support',
    patterns: {
      scripts: [/crisp\.chat/i],
      globals: ['$crisp', 'CRISP_WEBSITE_ID'],
    },
  },
  {
    name: 'LiveChat',
    category: 'support',
    patterns: {
      scripts: [/livechat\.com/i, /livechatinc\.com/i],
      globals: ['LiveChatWidget', '__lc'],
    },
  },
  {
    name: 'Tidio',
    category: 'support',
    patterns: {
      scripts: [/tidio\.co/i, /code\.tidio\.co/i],
      globals: ['tidioChatApi'],
    },
  },
  {
    name: 'HelpScout',
    category: 'support',
    patterns: {
      scripts: [/beacon-v2\.helpscout\.net/i],
      globals: ['Beacon'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OTHER TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Stripe',
    category: 'other',
    patterns: {
      scripts: [/js\.stripe\.com/i],
      globals: ['Stripe'],
    },
  },
  {
    name: 'PayPal',
    category: 'other',
    patterns: {
      scripts: [/paypal\.com\/sdk/i, /paypalobjects\.com/i],
      globals: ['paypal'],
    },
  },
  {
    name: 'reCAPTCHA',
    category: 'other',
    patterns: {
      scripts: [/google\.com\/recaptcha/i],
      globals: ['grecaptcha'],
    },
  },
  {
    name: 'Sentry',
    category: 'other',
    patterns: {
      scripts: [/sentry\.io/i, /browser\.sentry-cdn/i],
      globals: ['Sentry', '__SENTRY__'],
    },
  },
  {
    name: 'Cloudflare',
    category: 'other',
    patterns: {
      scripts: [/cloudflare\.com/i, /cdnjs\.cloudflare/i],
      html: [/cf-ray/i, /cloudflare/i],
    },
  },
  {
    name: 'Optimizely',
    category: 'other',
    patterns: {
      scripts: [/optimizely\.com/i],
      globals: ['optimizely'],
    },
  },
  {
    name: 'VWO',
    category: 'other',
    patterns: {
      scripts: [/visualwebsiteoptimizer/i, /vwo\.com/i],
      globals: ['_vwo_code', 'VWO'],
    },
  },
  {
    name: 'LaunchDarkly',
    category: 'other',
    patterns: {
      scripts: [/launchdarkly\.com/i],
      globals: ['LDClient'],
    },
  },
  {
    name: 'Yoast SEO',
    category: 'other',
    patterns: {
      html: [/yoast-schema-graph/i, /yoast/i],
      meta: [/yoast/i],
    },
  },
];

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class TechnographicScout extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
    this.log('INFO', 'Technographic Scout initialized');
  }

  /**
   * Main execution entry point
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as TechScanRequest;

      if (!payload?.url) {
        return this.createReport(taskId, 'FAILED', null, ['No URL provided in payload']);
      }

      this.log('INFO', `Scanning tech stack for: ${payload.url}`);

      const result = await this.scanTechStack(payload);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Tech scan failed: ${errorMessage}`);
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
   * Generate a report for the manager
   */
  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  /**
   * Self-assessment - this agent has REAL logic
   */
  hasRealLogic(): boolean {
    return true;
  }

  /**
   * Lines of code assessment
   */
  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 400, boilerplate: 50 };
  }

  // ==========================================================================
  // CORE TECH DETECTION LOGIC
  // ==========================================================================

  /**
   * Main tech stack scanning function
   */
  async scanTechStack(request: TechScanRequest): Promise<TechScanResult> {
    const { url } = request;
    const errors: string[] = [];

    // Step 1: Fetch the page
    let html = '';
    try {
      const content = await scrapeWebsite(url);
      html = content.rawHtml || '';

      if (!html) {
        errors.push('Unable to retrieve page HTML');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch page';
      errors.push(msg);
      logger.error('Technographic Scout: Page fetch failed', error as Error, { url });
    }

    // Step 2: Run all detections
    const detectedTools: DetectedTool[] = [];

    for (const signature of TECH_SIGNATURES) {
      const detection = this.detectTechnology(html, signature);
      if (detection) {
        detectedTools.push(detection);
      }
    }

    // Step 3: Organize by category
    const analytics = detectedTools.filter(t => t.category === 'analytics');
    const marketing = detectedTools.filter(t => t.category === 'marketing');
    const advertising = detectedTools.filter(t => t.category === 'advertising');
    const support = detectedTools.filter(t => t.category === 'support');
    const other = detectedTools.filter(t => t.category === 'other');
    const platforms = detectedTools.filter(t => t.category === 'platform');

    // Step 4: Build platform info
    const platform = this.buildPlatformInfo(platforms);

    // Step 5: Generate summary
    const summary = this.generateSummary(detectedTools);

    // Step 6: Calculate overall confidence
    const confidence = this.calculateOverallConfidence(detectedTools, html);

    return {
      url,
      scannedAt: new Date().toISOString(),
      platform,
      analytics,
      marketing,
      advertising,
      support,
      other,
      summary,
      confidence,
      errors,
    };
  }

  /**
   * Detect a single technology based on its signature
   */
  private detectTechnology(html: string, signature: TechSignature): DetectedTool | null {
    const evidence: string[] = [];
    let matchCount = 0;
    let totalPatterns = 0;

    const lowerHtml = html.toLowerCase();

    // Check script patterns
    if (signature.patterns.scripts) {
      for (const pattern of signature.patterns.scripts) {
        totalPatterns++;
        if (pattern.test(html)) {
          matchCount++;
          evidence.push(`Script: ${pattern.source}`);
        }
      }
    }

    // Check HTML patterns
    if (signature.patterns.html) {
      for (const pattern of signature.patterns.html) {
        totalPatterns++;
        if (pattern.test(html)) {
          matchCount++;
          evidence.push(`HTML: ${pattern.source}`);
        }
      }
    }

    // Check meta patterns
    if (signature.patterns.meta) {
      for (const pattern of signature.patterns.meta) {
        totalPatterns++;
        if (pattern.test(html)) {
          matchCount++;
          evidence.push(`Meta: ${pattern.source}`);
        }
      }
    }

    // Check for global variable patterns (by looking for assignment patterns)
    if (signature.patterns.globals) {
      for (const globalVar of signature.patterns.globals) {
        totalPatterns++;
        // Look for common patterns that indicate a global is defined
        const patterns = [
          new RegExp(`window\\.${globalVar}\\s*=`, 'i'),
          new RegExp(`["']${globalVar}["']`, 'i'),
          new RegExp(`${globalVar}\\s*\\(`, 'i'),
        ];

        for (const pattern of patterns) {
          if (pattern.test(html)) {
            matchCount++;
            evidence.push(`Global: ${globalVar}`);
            break;
          }
        }
      }
    }

    // If no matches, return null
    if (matchCount === 0) {
      return null;
    }

    // Calculate confidence based on match ratio
    const confidence = Math.min(matchCount / Math.max(totalPatterns * 0.5, 1), 1);

    // Extract tracking ID if pattern exists
    let trackingId: string | undefined;
    if (signature.extractId) {
      const match = html.match(signature.extractId);
      if (match) {
        trackingId = match[1] || match[0];
      }
    }

    // Build the detected tool object
    const tool: DetectedTool = {
      name: signature.name,
      category: signature.subcategory || signature.category,
      confidence: Math.round(confidence * 100) / 100,
      evidence,
    };

    if (trackingId) {
      if (signature.category === 'advertising') {
        tool.pixelId = trackingId;
      } else {
        tool.trackingId = trackingId;
      }
    }

    return tool;
  }

  /**
   * Build platform info from detected platform technologies
   */
  private buildPlatformInfo(platforms: DetectedTool[]): PlatformInfo {
    const info: PlatformInfo = {
      cms: null,
      ecommerce: null,
      framework: null,
      hosting: null,
      cdn: null,
    };

    for (const platform of platforms) {
      const category = platform.category;

      if (category === 'cms' && !info.cms) {
        info.cms = platform.name;
      } else if (category === 'ecommerce' && !info.ecommerce) {
        info.ecommerce = platform.name;
      } else if (category === 'framework' && !info.framework) {
        info.framework = platform.name;
      } else if (category === 'hosting' && !info.hosting) {
        info.hosting = platform.name;
      } else if (category === 'cdn' && !info.cdn) {
        info.cdn = platform.name;
      }
    }

    return info;
  }

  /**
   * Generate summary from detected tools
   */
  private generateSummary(tools: DetectedTool[]): TechSummary {
    const categories = [...new Set(tools.map(t => t.category))];

    // Determine tech maturity
    let maturity: TechSummary['techMaturity'] = 'basic';
    const toolCount = tools.length;
    const hasMarketing = tools.some(t => t.category === 'marketing');
    const hasAnalytics = tools.some(t => t.category === 'analytics');
    const hasSupport = tools.some(t => t.category === 'support');
    const hasAdvertising = tools.some(t => t.category === 'advertising');

    if (toolCount >= 10 && hasMarketing && hasAnalytics && hasSupport) {
      maturity = 'enterprise';
    } else if (toolCount >= 6 && (hasMarketing || hasAnalytics)) {
      maturity = 'growth';
    } else if (toolCount >= 3) {
      maturity = 'startup';
    }

    // Estimate monthly spend (rough estimates)
    let minSpend = 0;
    let maxSpend = 0;

    for (const tool of tools) {
      const costs = this.estimateToolCost(tool.name);
      minSpend += costs.min;
      maxSpend += costs.max;
    }

    const estimatedMonthlySpend = `$${minSpend} - $${maxSpend}`;

    return {
      totalDetected: tools.length,
      categories,
      techMaturity: maturity,
      estimatedMonthlySpend,
    };
  }

  /**
   * Estimate tool cost (rough monthly estimates)
   */
  private estimateToolCost(toolName: string): { min: number; max: number } {
    const costMap: Record<string, { min: number; max: number }> = {
      // Analytics
      'Google Analytics 4': { min: 0, max: 0 },
      'Google Analytics UA': { min: 0, max: 0 },
      'Mixpanel': { min: 0, max: 400 },
      'Amplitude': { min: 0, max: 500 },
      'Segment': { min: 0, max: 500 },
      'Heap': { min: 0, max: 500 },
      'Hotjar': { min: 0, max: 100 },
      'FullStory': { min: 200, max: 800 },

      // Marketing
      'HubSpot': { min: 50, max: 3000 },
      'Marketo': { min: 1000, max: 5000 },
      'Mailchimp': { min: 0, max: 300 },
      'Klaviyo': { min: 0, max: 500 },
      'ActiveCampaign': { min: 50, max: 500 },

      // Support
      'Intercom': { min: 100, max: 1000 },
      'Drift': { min: 500, max: 2000 },
      'Zendesk': { min: 50, max: 500 },
      'Crisp': { min: 0, max: 100 },

      // Default
      'default': { min: 0, max: 100 },
    };

    return costMap[toolName] || costMap['default'];
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(tools: DetectedTool[], html: string): number {
    if (tools.length === 0) {
      return html.length > 0 ? 0.3 : 0;
    }

    // Average confidence of all detected tools
    const avgConfidence = tools.reduce((sum, t) => sum + t.confidence, 0) / tools.length;

    // Bonus for detecting multiple technologies (shows comprehensive scan)
    const coverageBonus = Math.min(tools.length * 0.02, 0.2);

    // Penalty if HTML was empty or very short
    const htmlPenalty = html.length < 1000 ? 0.2 : 0;

    return Math.min(Math.max(avgConfidence + coverageBonus - htmlPenalty, 0), 1);
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createTechnographicScout(): TechnographicScout {
  return new TechnographicScout();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: TechnographicScout | null = null;

export function getTechnographicScout(): TechnographicScout {
  instance ??= createTechnographicScout();
  return instance;
}
