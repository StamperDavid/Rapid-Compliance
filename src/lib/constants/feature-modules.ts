/**
 * Feature Module Definitions & API Key Mappings
 *
 * Static configuration for the feature toggle system.
 * Controls which sidebar items appear and which API keys are needed.
 */

import type {
  FeatureModuleId,
  FeatureModuleDefinition,
  FeatureConfig,
  RequiredApiKey,
} from '@/types/feature-modules';

// =============================================================================
// API KEY SETUP LINKS
// =============================================================================

export const API_KEY_SETUP_LINKS: Record<string, { url: string; docsUrl: string }> = {
  openrouter: {
    url: 'https://openrouter.ai/keys',
    docsUrl: 'https://openrouter.ai/docs',
  },
  openai: {
    url: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs',
  },
  anthropic: {
    url: 'https://console.anthropic.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com',
  },
  sendgrid: {
    url: 'https://app.sendgrid.com/settings/api_keys',
    docsUrl: 'https://docs.sendgrid.com',
  },
  resend: {
    url: 'https://resend.com/api-keys',
    docsUrl: 'https://resend.com/docs',
  },
  stripe_secret: {
    url: 'https://dashboard.stripe.com/apikeys',
    docsUrl: 'https://stripe.com/docs/keys',
  },
  stripe_publishable: {
    url: 'https://dashboard.stripe.com/apikeys',
    docsUrl: 'https://stripe.com/docs/keys',
  },
  paypal_client_id: {
    url: 'https://developer.paypal.com/dashboard/applications',
    docsUrl: 'https://developer.paypal.com/docs',
  },
  twilio_account_sid: {
    url: 'https://console.twilio.com',
    docsUrl: 'https://www.twilio.com/docs',
  },
  heygen: {
    url: 'https://app.heygen.com/settings',
    docsUrl: 'https://docs.heygen.com',
  },
  elevenlabs: {
    url: 'https://elevenlabs.io/app/settings/api-keys',
    docsUrl: 'https://elevenlabs.io/docs',
  },
  twitter_consumer_key: {
    url: 'https://developer.x.com/en/portal/dashboard',
    docsUrl: 'https://developer.x.com/en/docs',
  },
  later: {
    url: 'https://app.later.com/settings',
    docsUrl: 'https://developers.later.com',
  },
  google_client_id: {
    url: 'https://console.cloud.google.com/apis/credentials',
    docsUrl: 'https://developers.google.com/identity',
  },
  pagespeed: {
    url: 'https://console.cloud.google.com/apis/credentials',
    docsUrl: 'https://developers.google.com/speed/docs/insights',
  },
  dataforseo_login: {
    url: 'https://app.dataforseo.com/api-dashboard',
    docsUrl: 'https://docs.dataforseo.com',
  },
  serper: {
    url: 'https://serper.dev/api-key',
    docsUrl: 'https://serper.dev/docs',
  },
  clearbit_api_key: {
    url: 'https://dashboard.clearbit.com/api',
    docsUrl: 'https://clearbit.com/docs',
  },
};

// =============================================================================
// GLOBAL API KEY (Jasper / AI)
// =============================================================================

const JASPER_AI_KEY: RequiredApiKey = {
  serviceId: 'openrouter',
  label: 'OpenRouter API Key',
  description: 'Powers Jasper, your AI assistant. Required for all AI features across the platform.',
  setupUrl: API_KEY_SETUP_LINKS.openrouter.url,
  docsUrl: API_KEY_SETUP_LINKS.openrouter.docsUrl,
  priority: 'required',
};

// =============================================================================
// FEATURE MODULE DEFINITIONS
// =============================================================================

export const FEATURE_MODULES: FeatureModuleDefinition[] = [
  {
    id: 'crm_pipeline',
    label: 'CRM & Pipeline',
    icon: 'Users',
    defaultEnabled: true,
    description: 'Manage leads, deals, contacts, and your sales pipeline.',
    whyItMatters: 'The foundation of your sales operation. Track every relationship and deal in one place.',
    features: ['Lead management', 'Deal tracking', 'Contact database', 'Living Ledger', 'Lead intelligence'],
    useCases: ['Sales teams', 'Account management', 'Relationship tracking'],
    ifYouSkip: 'You won\'t have a centralized place to track your leads and deals.',
    sidebarItemIds: ['crm-hub', 'deals', 'living-ledger', 'lead-intel'],
    requiredApiKeys: [],
  },
  {
    id: 'conversations',
    label: 'Conversations',
    icon: 'MessageSquare',
    defaultEnabled: false,
    description: 'AI-powered chat for engaging with leads and customers.',
    whyItMatters: 'Let Jasper handle initial conversations and qualify leads 24/7.',
    features: ['AI chat', 'Lead qualification', 'Smart routing', 'Conversation history'],
    useCases: ['Lead qualification', 'Customer support', 'After-hours engagement'],
    ifYouSkip: 'You\'ll need to manually handle all customer conversations.',
    sidebarItemIds: ['conversations'],
    requiredApiKeys: [],
  },
  {
    id: 'sales_automation',
    label: 'Sales Automation',
    icon: 'GraduationCap',
    defaultEnabled: false,
    description: 'AI coaching, playbooks, and risk detection for your sales team.',
    whyItMatters: 'Helps your team close more deals with AI-driven insights and coaching.',
    features: ['Sales coaching', 'Playbook builder', 'Risk alerts', 'Performance tips'],
    useCases: ['Sales teams', 'Team leads', 'Sales managers'],
    ifYouSkip: 'Your team will miss AI-powered coaching and risk alerts.',
    sidebarItemIds: ['coaching', 'playbook', 'risk'],
    requiredApiKeys: [
      {
        serviceId: 'clearbit_api_key',
        label: 'Clearbit API Key',
        description: 'Enriches lead data for better coaching insights.',
        setupUrl: API_KEY_SETUP_LINKS.clearbit_api_key.url,
        docsUrl: API_KEY_SETUP_LINKS.clearbit_api_key.docsUrl,
        priority: 'recommended',
      },
    ],
  },
  {
    id: 'email_outreach',
    label: 'Email & Outreach',
    icon: 'Send',
    defaultEnabled: false,
    description: 'Send campaigns, sequences, and manage outbound sales.',
    whyItMatters: 'Automate your email outreach to reach more prospects with less effort.',
    features: ['Email campaigns', 'Drip sequences', 'Outbound tools', 'Call tracking', 'Email studio'],
    useCases: ['Outbound sales', 'Nurture campaigns', 'Cold outreach'],
    ifYouSkip: 'You\'ll need to manage email outreach manually or use a separate tool.',
    sidebarItemIds: ['outbound-hub', 'sequences', 'email-campaigns', 'calls', 'email-studio'],
    requiredApiKeys: [
      {
        serviceId: 'sendgrid',
        label: 'SendGrid API Key',
        description: 'Send transactional and marketing emails.',
        setupUrl: API_KEY_SETUP_LINKS.sendgrid.url,
        docsUrl: API_KEY_SETUP_LINKS.sendgrid.docsUrl,
        priority: 'required',
      },
      {
        serviceId: 'google_client_id',
        label: 'Google OAuth Client ID',
        description: 'Connect Gmail for email sending and receiving.',
        setupUrl: API_KEY_SETUP_LINKS.google_client_id.url,
        docsUrl: API_KEY_SETUP_LINKS.google_client_id.docsUrl,
        priority: 'recommended',
      },
    ],
  },
  {
    id: 'forms_surveys',
    label: 'Forms & Surveys',
    icon: 'ClipboardList',
    defaultEnabled: false,
    description: 'Create lead capture forms, surveys, and feedback forms.',
    whyItMatters: 'Capture leads directly from your website or share standalone form links.',
    features: ['Form builder', 'Lead capture', 'Survey creation', 'Auto-notifications'],
    useCases: ['Lead generation', 'Customer feedback', 'Event registration'],
    ifYouSkip: 'You\'ll need a separate form tool or manual lead capture.',
    sidebarItemIds: ['forms'],
    requiredApiKeys: [
      {
        serviceId: 'sendgrid',
        label: 'SendGrid API Key',
        description: 'Send form submission notifications.',
        setupUrl: API_KEY_SETUP_LINKS.sendgrid.url,
        docsUrl: API_KEY_SETUP_LINKS.sendgrid.docsUrl,
        priority: 'required',
      },
    ],
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: 'Workflow',
    defaultEnabled: false,
    description: 'Build automated workflows to connect your business processes.',
    whyItMatters: 'Automate repetitive tasks and create multi-step business processes.',
    features: ['Visual workflow builder', 'Trigger automation', 'Multi-step actions', 'Conditional logic'],
    useCases: ['Lead routing', 'Follow-up automation', 'Process automation'],
    ifYouSkip: 'You\'ll handle all process automation manually.',
    sidebarItemIds: ['workflows'],
    requiredApiKeys: [],
  },
  {
    id: 'social_media',
    label: 'Social Media',
    icon: 'Share2',
    defaultEnabled: false,
    description: 'Schedule posts, track engagement, and manage your social presence.',
    whyItMatters: 'Manage all your social channels from one dashboard.',
    features: ['Post scheduling', 'Social analytics', 'Multi-platform posting', 'Content calendar'],
    useCases: ['Brand building', 'Social selling', 'Content marketing'],
    ifYouSkip: 'You\'ll manage social media through individual platform apps.',
    sidebarItemIds: ['social-hub', 'social-analytics'],
    requiredApiKeys: [
      {
        serviceId: 'twitter_consumer_key',
        label: 'Twitter/X API Credentials',
        description: 'Post to Twitter/X and track engagement.',
        setupUrl: API_KEY_SETUP_LINKS.twitter_consumer_key.url,
        docsUrl: API_KEY_SETUP_LINKS.twitter_consumer_key.docsUrl,
        priority: 'required',
      },
      {
        serviceId: 'later',
        label: 'Later API Key',
        description: 'Schedule posts across multiple social platforms.',
        setupUrl: API_KEY_SETUP_LINKS.later.url,
        docsUrl: API_KEY_SETUP_LINKS.later.docsUrl,
        priority: 'optional',
      },
    ],
  },
  {
    id: 'video_production',
    label: 'Video Production',
    icon: 'Video',
    defaultEnabled: false,
    description: 'Create AI-generated videos and manage your video library.',
    whyItMatters: 'Produce professional videos at scale without a production team.',
    features: ['AI video creation', 'Video library', 'Template system', 'Avatar videos'],
    useCases: ['Marketing videos', 'Sales pitches', 'Training content'],
    ifYouSkip: 'You\'ll need separate video tools or a production team.',
    sidebarItemIds: ['video-library', 'video-studio'],
    requiredApiKeys: [
      {
        serviceId: 'heygen',
        label: 'HeyGen API Key',
        description: 'Generate AI avatar videos.',
        setupUrl: API_KEY_SETUP_LINKS.heygen.url,
        docsUrl: API_KEY_SETUP_LINKS.heygen.docsUrl,
        priority: 'required',
      },
      {
        serviceId: 'elevenlabs',
        label: 'ElevenLabs API Key',
        description: 'Generate natural-sounding voiceovers.',
        setupUrl: API_KEY_SETUP_LINKS.elevenlabs.url,
        docsUrl: API_KEY_SETUP_LINKS.elevenlabs.docsUrl,
        priority: 'recommended',
      },
    ],
  },
  {
    id: 'proposals_docs',
    label: 'Proposals & Docs',
    icon: 'FileText',
    defaultEnabled: false,
    description: 'Create professional proposals and documents with AI assistance.',
    whyItMatters: 'Win more deals with polished, AI-generated proposals.',
    features: ['Proposal builder', 'Template library', 'AI writing', 'E-signatures'],
    useCases: ['Sales proposals', 'Client presentations', 'Contracts'],
    ifYouSkip: 'You\'ll create proposals manually in docs or other tools.',
    sidebarItemIds: ['proposals'],
    requiredApiKeys: [],
  },
  {
    id: 'ecommerce',
    label: 'E-Commerce',
    icon: 'ShoppingCart',
    defaultEnabled: false,
    description: 'Sell products and services with a built-in storefront.',
    whyItMatters: 'Accept payments and manage orders without a separate e-commerce platform.',
    features: ['Product catalog', 'Order management', 'Online storefront', 'Payment processing'],
    useCases: ['Online stores', 'Service businesses', 'Digital products'],
    ifYouSkip: 'You\'ll need Shopify or another e-commerce platform.',
    sidebarItemIds: ['products', 'orders', 'storefront'],
    requiredApiKeys: [
      {
        serviceId: 'stripe_secret',
        label: 'Stripe Secret Key',
        description: 'Process payments securely.',
        setupUrl: API_KEY_SETUP_LINKS.stripe_secret.url,
        docsUrl: API_KEY_SETUP_LINKS.stripe_secret.docsUrl,
        priority: 'required',
      },
      {
        serviceId: 'stripe_publishable',
        label: 'Stripe Publishable Key',
        description: 'Client-side payment form.',
        setupUrl: API_KEY_SETUP_LINKS.stripe_publishable.url,
        docsUrl: API_KEY_SETUP_LINKS.stripe_publishable.docsUrl,
        priority: 'required',
      },
      {
        serviceId: 'paypal_client_id',
        label: 'PayPal Client ID',
        description: 'Accept PayPal payments.',
        setupUrl: API_KEY_SETUP_LINKS.paypal_client_id.url,
        docsUrl: API_KEY_SETUP_LINKS.paypal_client_id.docsUrl,
        priority: 'optional',
      },
    ],
  },
  {
    id: 'website_builder',
    label: 'Website & SEO',
    icon: 'Globe',
    defaultEnabled: false,
    description: 'Build your website and optimize for search engines.',
    whyItMatters: 'Get found online with a professional website and SEO tools.',
    features: ['Page builder', 'Blog', 'SEO analysis', 'Performance tracking'],
    useCases: ['Business websites', 'Landing pages', 'Content marketing'],
    ifYouSkip: 'You\'ll manage your website with WordPress or another platform.',
    sidebarItemIds: ['website', 'seo'],
    requiredApiKeys: [
      {
        serviceId: 'pagespeed',
        label: 'Google PageSpeed API Key',
        description: 'Analyze website performance.',
        setupUrl: API_KEY_SETUP_LINKS.pagespeed.url,
        docsUrl: API_KEY_SETUP_LINKS.pagespeed.docsUrl,
        priority: 'recommended',
      },
      {
        serviceId: 'dataforseo_login',
        label: 'DataForSEO Credentials',
        description: 'Advanced SEO keyword research.',
        setupUrl: API_KEY_SETUP_LINKS.dataforseo_login.url,
        docsUrl: API_KEY_SETUP_LINKS.dataforseo_login.docsUrl,
        priority: 'optional',
      },
    ],
  },
  {
    id: 'advanced_analytics',
    label: 'Advanced Analytics',
    icon: 'FlaskConical',
    defaultEnabled: false,
    description: 'A/B testing and advanced analytics for data-driven decisions.',
    whyItMatters: 'Test what works and make decisions backed by data.',
    features: ['A/B testing', 'Experiment tracking', 'Statistical analysis', 'Winner detection'],
    useCases: ['Marketing optimization', 'Conversion testing', 'Feature testing'],
    ifYouSkip: 'You\'ll make decisions without structured testing data.',
    sidebarItemIds: ['ab-testing'],
    requiredApiKeys: [
      {
        serviceId: 'serper',
        label: 'Serper API Key',
        description: 'SERP tracking for competitive analysis.',
        setupUrl: API_KEY_SETUP_LINKS.serper.url,
        docsUrl: API_KEY_SETUP_LINKS.serper.docsUrl,
        priority: 'optional',
      },
    ],
  },
];

// =============================================================================
// DEFAULT FEATURE CONFIG
// =============================================================================

const allModulesOff: Record<FeatureModuleId, boolean> = {
  crm_pipeline: false,
  sales_automation: false,
  email_outreach: false,
  social_media: false,
  ecommerce: false,
  website_builder: false,
  video_production: false,
  forms_surveys: false,
  proposals_docs: false,
  advanced_analytics: false,
  workflows: false,
  conversations: false,
};

/**
 * Default feature config for new users — only CRM is enabled
 */
export const DEFAULT_FEATURE_CONFIG: FeatureConfig = {
  modules: {
    ...allModulesOff,
    crm_pipeline: true,
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get a feature module definition by ID
 */
export function getFeatureModule(id: FeatureModuleId): FeatureModuleDefinition | undefined {
  return FEATURE_MODULES.find((m) => m.id === id);
}

/**
 * Get all required API keys for the currently enabled modules.
 * Always includes the Jasper AI key (OpenRouter).
 * Deduplicates by serviceId.
 */
export function getRequiredApiKeys(
  enabledModules: Record<FeatureModuleId, boolean>,
): RequiredApiKey[] {
  const keyMap = new Map<string, RequiredApiKey>();

  // Jasper AI key is always required
  keyMap.set(JASPER_AI_KEY.serviceId, JASPER_AI_KEY);

  for (const mod of FEATURE_MODULES) {
    if (enabledModules[mod.id]) {
      for (const key of mod.requiredApiKeys) {
        // Keep the highest priority version if duplicate
        const existing = keyMap.get(key.serviceId);
        if (!existing || priorityRank(key.priority) > priorityRank(existing.priority)) {
          keyMap.set(key.serviceId, key);
        }
      }
    }
  }

  // Sort: required first, then recommended, then optional
  return Array.from(keyMap.values()).sort(
    (a, b) => priorityRank(b.priority) - priorityRank(a.priority),
  );
}

function priorityRank(p: 'required' | 'recommended' | 'optional'): number {
  switch (p) {
    case 'required': return 3;
    case 'recommended': return 2;
    case 'optional': return 1;
  }
}

/**
 * All sidebar item IDs controlled by feature modules.
 * Items NOT in this set are always visible (Dashboard, Analytics, AI Workforce, System, Settings).
 */
export const FEATURE_CONTROLLED_SIDEBAR_IDS: Set<string> = new Set(
  FEATURE_MODULES.flatMap((m) => m.sidebarItemIds),
);

/**
 * Map from sidebar item ID → feature module ID
 */
export const SIDEBAR_ITEM_TO_MODULE: Map<string, FeatureModuleId> = new Map(
  FEATURE_MODULES.flatMap((m) =>
    m.sidebarItemIds.map((sid) => [sid, m.id] as [string, FeatureModuleId]),
  ),
);
