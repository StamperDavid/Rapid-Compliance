/**
 * Feature Manifest - The 11 Specialists Command Menu
 *
 * Defines all available AI specialists and their capabilities
 * for the Orchestrator's command interface.
 *
 * @module feature-manifest
 */

import { getAgentCount, getDomainCount } from '@/lib/agents/agent-registry';

export type SpecialistPlatform =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'x_twitter'
  | 'truth_social'
  | 'linkedin'
  | 'pinterest'
  | 'meta_facebook'
  | 'newsletter'
  | 'web_migrator'
  | 'lead_hunter'
  | 'sales_chat_agent'
  | 'growth_strategist';

export type SpecialistCategory = 'creative' | 'social' | 'technical' | 'strategic';

export interface SpecialistCapability {
  id: string;
  name: string;
  description: string;
  action: string; // The command to invoke
}

export interface Specialist {
  id: SpecialistPlatform;
  name: string;
  role: string;
  icon: string;
  color: string;
  category: SpecialistCategory;
  description: string;
  capabilities: SpecialistCapability[];
  triggerPhrases: string[]; // Natural language triggers
  requiresConnection: boolean;
  connectionLabel?: string;
}

// ============================================================================
// THE 11 SPECIALISTS
// ============================================================================

export const SPECIALISTS: Specialist[] = [
  // CREATIVE SUB-AGENT (Visual Platforms)
  {
    id: 'youtube',
    name: 'The Broadcaster',
    role: 'YouTube Content Strategist',
    icon: '🎬',
    color: '#FF0000',
    category: 'creative',
    description: 'Creates long-form video content, manages YouTube presence, and optimizes for search and engagement.',
    capabilities: [
      { id: 'yt_script', name: 'Generate Video Script', description: 'Create SEO-optimized video scripts', action: 'generate_youtube_script' },
      { id: 'yt_thumbnail', name: 'Design Thumbnail', description: 'Generate click-worthy thumbnail concepts', action: 'design_thumbnail' },
      { id: 'yt_optimize', name: 'Optimize Metadata', description: 'Optimize titles, descriptions, and tags', action: 'optimize_youtube_metadata' },
      { id: 'yt_schedule', name: 'Schedule Content', description: 'Plan and schedule video releases', action: 'schedule_youtube_content' },
    ],
    triggerPhrases: ['youtube', 'youtube channel', 'broadcast', 'long-form content'],
    requiresConnection: true,
    connectionLabel: 'YouTube Channel',
  },
  {
    id: 'tiktok',
    name: 'The Short-Form Lead',
    role: 'TikTok Viral Content Creator',
    icon: '📱',
    color: '#000000',
    category: 'creative',
    description: 'Masters short-form viral content, trends, and rapid engagement strategies.',
    capabilities: [
      { id: 'tt_hook', name: 'Create Viral Hook', description: 'Generate attention-grabbing hooks', action: 'create_tiktok_hook' },
      { id: 'tt_trend', name: 'Analyze Trends', description: 'Identify and leverage current trends', action: 'analyze_tiktok_trends' },
      { id: 'tt_script', name: 'Write Short Script', description: 'Create 15-60 second video scripts', action: 'write_tiktok_script' },
      { id: 'tt_hashtag', name: 'Optimize Hashtags', description: 'Research and suggest viral hashtags', action: 'optimize_tiktok_hashtags' },
    ],
    triggerPhrases: ['tiktok', 'short video', 'viral', 'trend', 'reels'],
    requiresConnection: true,
    connectionLabel: 'TikTok Account',
  },
  {
    id: 'instagram',
    name: 'The Visual Storyteller',
    role: 'Instagram Content Curator',
    icon: '📸',
    color: '#E4405F',
    category: 'creative',
    description: 'Crafts visual narratives, manages aesthetic consistency, and drives engagement through Stories and Reels.',
    capabilities: [
      { id: 'ig_post', name: 'Create Post', description: 'Design feed-worthy posts with captions', action: 'create_instagram_post' },
      { id: 'ig_story', name: 'Design Stories', description: 'Create engaging story sequences', action: 'design_instagram_stories' },
      { id: 'ig_reel', name: 'Script Reels', description: 'Write scripts for Instagram Reels', action: 'script_instagram_reels' },
      { id: 'ig_carousel', name: 'Build Carousel', description: 'Create educational carousel posts', action: 'build_instagram_carousel' },
    ],
    triggerPhrases: ['instagram', 'ig', 'stories', 'aesthetic', 'visual'],
    requiresConnection: true,
    connectionLabel: 'Instagram Account',
  },

  // SOCIAL DISCOURSE SUB-AGENT (Engagement)
  {
    id: 'x_twitter',
    name: 'Real-Time Voice (Global)',
    role: 'X/Twitter Engagement Specialist',
    icon: '𝕏',
    color: '#000000',
    category: 'social',
    description: 'Manages real-time conversations, thought leadership, and viral thread creation on X.',
    capabilities: [
      { id: 'x_thread', name: 'Write Thread', description: 'Create viral thread content', action: 'write_twitter_thread' },
      { id: 'x_engage', name: 'Engage Mentions', description: 'Respond to mentions and DMs', action: 'engage_twitter_mentions' },
      { id: 'x_schedule', name: 'Schedule Posts', description: 'Plan and schedule tweets', action: 'schedule_twitter_posts' },
      { id: 'x_analyze', name: 'Analyze Performance', description: 'Track engagement metrics', action: 'analyze_twitter_performance' },
    ],
    triggerPhrases: ['twitter', 'x', 'tweet', 'thread', 'trending'],
    requiresConnection: true,
    connectionLabel: 'X/Twitter Account',
  },
  {
    id: 'truth_social',
    name: 'Real-Time Voice (Community)',
    role: 'Truth Social Engagement Manager',
    icon: '🗽',
    color: '#5448EE',
    category: 'social',
    description: 'Engages with community-focused audiences and manages alternative platform presence.',
    capabilities: [
      { id: 'ts_post', name: 'Create Post', description: 'Write platform-appropriate content', action: 'create_truth_post' },
      { id: 'ts_engage', name: 'Community Engagement', description: 'Interact with followers', action: 'engage_truth_community' },
      { id: 'ts_schedule', name: 'Schedule Content', description: 'Plan content calendar', action: 'schedule_truth_content' },
    ],
    triggerPhrases: ['truth social', 'truth', 'alternative platform'],
    requiresConnection: true,
    connectionLabel: 'Truth Social Account',
  },
  {
    id: 'linkedin',
    name: 'The Professional Networker',
    role: 'LinkedIn B2B Strategist',
    icon: '💼',
    color: '#0A66C2',
    category: 'social',
    description: 'Builds professional authority, generates B2B leads, and manages corporate thought leadership.',
    capabilities: [
      { id: 'li_post', name: 'Write Post', description: 'Create professional content', action: 'write_linkedin_post' },
      { id: 'li_article', name: 'Draft Article', description: 'Write long-form LinkedIn articles', action: 'draft_linkedin_article' },
      { id: 'li_outreach', name: 'Connection Outreach', description: 'Craft connection messages', action: 'linkedin_outreach' },
      { id: 'li_engage', name: 'Engage Network', description: 'Comment and engage strategically', action: 'engage_linkedin_network' },
    ],
    triggerPhrases: ['linkedin', 'professional', 'b2b', 'networking', 'career'],
    requiresConnection: true,
    connectionLabel: 'LinkedIn Profile',
  },

  // TECHNICAL OPERATIONS SUB-AGENT
  {
    id: 'pinterest',
    name: 'Visual Discovery Engine',
    role: 'Pinterest SEO Specialist',
    icon: '📌',
    color: '#E60023',
    category: 'technical',
    description: 'Drives discovery through visual search optimization and pin strategy.',
    capabilities: [
      { id: 'pin_create', name: 'Create Pins', description: 'Design SEO-optimized pins', action: 'create_pinterest_pins' },
      { id: 'pin_board', name: 'Organize Boards', description: 'Structure boards for discovery', action: 'organize_pinterest_boards' },
      { id: 'pin_seo', name: 'Optimize SEO', description: 'Keyword optimization for search', action: 'optimize_pinterest_seo' },
    ],
    triggerPhrases: ['pinterest', 'pins', 'visual search', 'discovery'],
    requiresConnection: true,
    connectionLabel: 'Pinterest Account',
  },
  {
    id: 'meta_facebook',
    name: 'The Community Builder',
    role: 'Facebook Community Manager',
    icon: '👥',
    color: '#1877F2',
    category: 'social',
    description: 'Builds and nurtures community engagement, manages groups, and runs targeted campaigns.',
    capabilities: [
      { id: 'fb_post', name: 'Create Post', description: 'Write engaging Facebook posts', action: 'create_facebook_post' },
      { id: 'fb_group', name: 'Manage Group', description: 'Moderate and engage group members', action: 'manage_facebook_group' },
      { id: 'fb_event', name: 'Create Event', description: 'Set up and promote events', action: 'create_facebook_event' },
      { id: 'fb_ads', name: 'Draft Ad Copy', description: 'Write ad copy for campaigns', action: 'draft_facebook_ads' },
    ],
    triggerPhrases: ['facebook', 'fb', 'community', 'groups', 'meta'],
    requiresConnection: true,
    connectionLabel: 'Facebook Page',
  },
  {
    id: 'newsletter',
    name: 'The Direct Line',
    role: 'Email Newsletter Strategist',
    icon: '📧',
    color: '#6366F1',
    category: 'technical',
    description: 'Crafts compelling newsletters, manages subscriber relationships, and drives conversions.',
    capabilities: [
      { id: 'nl_write', name: 'Write Newsletter', description: 'Compose engaging newsletters', action: 'write_newsletter' },
      { id: 'nl_subject', name: 'Optimize Subject Lines', description: 'A/B test subject line ideas', action: 'optimize_newsletter_subjects' },
      { id: 'nl_segment', name: 'Segment Audience', description: 'Create targeted segments', action: 'segment_newsletter_audience' },
      { id: 'nl_automate', name: 'Build Automation', description: 'Set up email sequences', action: 'build_newsletter_automation' },
    ],
    triggerPhrases: ['newsletter', 'email', 'subscribers', 'mailing list'],
    requiresConnection: true,
    connectionLabel: 'Email Provider',
  },
  {
    id: 'web_migrator',
    name: 'The Digital Architect',
    role: 'Website Builder & Migrator',
    icon: '🏗️',
    color: '#10B981',
    category: 'technical',
    description: 'Builds, migrates, and optimizes web presences with industry-specific styling.',
    capabilities: [
      { id: 'web_build', name: 'Build Landing Page', description: 'Create conversion-optimized pages', action: 'build_landing_page' },
      { id: 'web_migrate', name: 'Migrate Website', description: 'Import and rebuild existing sites', action: 'migrate_website' },
      { id: 'web_seo', name: 'SEO Audit', description: 'Analyze and improve site SEO', action: 'audit_website_seo' },
      { id: 'web_speed', name: 'Optimize Speed', description: 'Improve page performance', action: 'optimize_website_speed' },
    ],
    triggerPhrases: ['website', 'landing page', 'migrate', 'build site', 'web'],
    requiresConnection: false,
  },
  {
    id: 'lead_hunter',
    name: 'The Intelligence Gatherer',
    role: 'Lead Research & Enrichment',
    icon: '🎯',
    color: '#F59E0B',
    category: 'technical',
    description: 'Discovers, qualifies, and enriches leads with comprehensive intelligence.',
    capabilities: [
      { id: 'lh_scan', name: 'Start Lead Scan', description: 'Initiate lead discovery scan', action: 'start_lead_scan' },
      { id: 'lh_enrich', name: 'Enrich Leads', description: 'Add intelligence to existing leads', action: 'enrich_leads' },
      { id: 'lh_score', name: 'Score Leads', description: 'Qualify and prioritize leads', action: 'score_leads' },
      { id: 'lh_segment', name: 'Create Segment', description: 'Build targeted lead segments', action: 'create_lead_segment' },
    ],
    triggerPhrases: ['leads', 'prospects', 'research', 'find leads', 'enrich', 'hunt'],
    requiresConnection: false,
  },

  // STRATEGIC AGENTS (Standalone — no domain manager above them)
  {
    id: 'sales_chat_agent',
    name: 'The Sales Concierge',
    role: 'AI Chat Sales Agent',
    icon: '💬',
    color: '#8B5CF6',
    category: 'strategic',
    description: 'Customer-facing sales agent for website chat and Messenger — qualifies leads, answers product questions, and guides prospects to free trials.',
    capabilities: [
      { id: 'sca_qualify', name: 'Qualify Lead', description: 'Assess budget, need, timeline, and authority via chat', action: 'QUALIFY_LEAD' },
      { id: 'sca_answer', name: 'Answer Product Question', description: 'Respond to questions about features and pricing', action: 'ANSWER_PRODUCT_QUESTION' },
      { id: 'sca_trial', name: 'Guide to Trial', description: 'Walk interested prospects through starting a free trial', action: 'GUIDE_TO_TRIAL' },
      { id: 'sca_demo', name: 'Schedule Demo', description: 'Book a demo for enterprise or complex prospects', action: 'SCHEDULE_DEMO' },
      { id: 'sca_objection', name: 'Handle Objection', description: 'Address price, trust, complexity, or competitor concerns', action: 'HANDLE_OBJECTION' },
    ],
    triggerPhrases: ['sales chat', 'chat agent', 'website chat', 'messenger', 'qualify lead', 'free trial', 'demo'],
    requiresConnection: false,
  },
  {
    id: 'growth_strategist',
    name: 'The Chief Growth Officer',
    role: 'Growth Strategist & Business Analyst',
    icon: '📈',
    color: '#059669',
    category: 'strategic',
    description: 'Reviews the entire business, synthesizes cross-domain data, and produces strategic directives on SEO, ad spend, demographics, and channel attribution.',
    capabilities: [
      { id: 'gs_review', name: 'Business Review', description: 'Full cross-domain business health assessment', action: 'BUSINESS_REVIEW' },
      { id: 'gs_seo', name: 'SEO Strategy', description: 'Keyword opportunities, content gaps, competitive positioning', action: 'SEO_STRATEGY' },
      { id: 'gs_adspend', name: 'Ad Spend Analysis', description: 'Budget allocation across channels, ROI optimization', action: 'AD_SPEND_ANALYSIS' },
      { id: 'gs_demo', name: 'Demographic Targeting', description: 'Identify ideal customer profiles, narrow targeting', action: 'DEMOGRAPHIC_TARGETING' },
      { id: 'gs_attr', name: 'Channel Attribution', description: 'Map conversions to sources, identify best channels', action: 'CHANNEL_ATTRIBUTION' },
      { id: 'gs_brief', name: 'Strategic Briefing', description: 'Executive summary for Jasper to relay to the human', action: 'STRATEGIC_BRIEFING' },
    ],
    triggerPhrases: ['growth strategy', 'business review', 'seo strategy', 'ad spend', 'demographics', 'channel attribution', 'strategic briefing', 'cgo', 'growth officer'],
    requiresConnection: false,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get specialist by ID
 */
export function getSpecialist(id: SpecialistPlatform): Specialist | undefined {
  return SPECIALISTS.find((s) => s.id === id);
}

/**
 * Get specialists by category
 */
export function getSpecialistsByCategory(category: SpecialistCategory): Specialist[] {
  return SPECIALISTS.filter((s) => s.category === category);
}

/**
 * Find specialists matching a natural language query
 */
export function findMatchingSpecialists(query: string): Specialist[] {
  const lowerQuery = query.toLowerCase();
  return SPECIALISTS.filter((specialist) =>
    specialist.triggerPhrases.some((phrase) => lowerQuery.includes(phrase)) ||
    specialist.name.toLowerCase().includes(lowerQuery) ||
    specialist.role.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get all capabilities across all specialists
 */
export function getAllCapabilities(): Array<SpecialistCapability & { specialistId: SpecialistPlatform }> {
  return SPECIALISTS.flatMap((specialist) =>
    specialist.capabilities.map((cap) => ({
      ...cap,
      specialistId: specialist.id,
    }))
  );
}

/**
 * Get capability by action name
 */
export function getCapabilityByAction(action: string): (SpecialistCapability & { specialist: Specialist }) | undefined {
  for (const specialist of SPECIALISTS) {
    const capability = specialist.capabilities.find((c) => c.action === action);
    if (capability) {
      return { ...capability, specialist };
    }
  }
  return undefined;
}

// ============================================================================
// ORCHESTRATOR SYSTEM PROMPTS
// ============================================================================

export const MERCHANT_ORCHESTRATOR_PROMPT = `You are the client's internal business partner. Your name and industry focus are set in the merchant's configuration.

═══════════════════════════════════════════════════════════════════════════════
IDENTITY: INTERNAL BUSINESS PARTNER
═══════════════════════════════════════════════════════════════════════════════

You are NOT a chatbot, sales assistant, or help desk.
You ARE the specialist managing this business's sales and marketing operations.

Your role: Ensure the business runs smoothly by managing all the underlying tools and data on the owner's behalf. You speak with full authority. When the owner asks a question, you answer directly - you don't coordinate specialists or invite agents to talk.

Think of yourself as a trusted operations manager who:
- Has complete visibility into the business systems
- Makes decisions and executes without asking permission
- Reports results, not options
- Speaks as a partner, not a subordinate

═══════════════════════════════════════════════════════════════════════════════
VOICE: HOW YOU SPEAK
═══════════════════════════════════════════════════════════════════════════════

NATURAL PARTNER DIALOGUE (DO THIS):
- "I checked your pipeline - three prospects look ready for outreach."
- "I'm scanning for leads in your niche now. Should have results in a few minutes."
- "Email isn't set up yet. Want me to walk you through connecting it?"

ROBOTIC PATTERNS (NEVER DO THIS):
- "Here are your options: • Option 1 • Option 2"
- "Say '[Name], find leads' to activate the Lead Hunter"
- "I'll have the Newsletter Specialist draft that for you"
- "The Content Engine is available for content creation"

KEY VOICE RULES:
1. NEVER mention "agents," "specialists," or tool names - you ARE the capability
2. NEVER present numbered/bulleted option menus
3. NEVER say "Say X to do Y" - just offer to do it or do it
4. Speak as yourself: "I'm scanning for prospects" not "I'll have the system scan"

═══════════════════════════════════════════════════════════════════════════════
BEHAVIOR: DIRECT EXECUTION
═══════════════════════════════════════════════════════════════════════════════

When asked to "Find leads":
BAD: "I'll activate the Lead Hunter for you."
GOOD: "I'm scanning for prospects in your industry now. I'll have the first batch ready for review in a few minutes."

When asked about unconfigured features:
BAD: "The Newsletter Specialist can help with that, but it needs to be configured."
GOOD: "Email isn't set up yet. Want me to walk you through connecting it, or should I hide it from the dashboard until you're ready?"

═══════════════════════════════════════════════════════════════════════════════
RESPONSE STRUCTURE
═══════════════════════════════════════════════════════════════════════════════

Keep responses conversational:
- SHORT (1-3 sentences): Simple questions or confirmations
- MEDIUM (1 paragraph): Explanations or recommendations
- DETAILED: Only when specifically asked

REMEMBER: You are the business owner's partner, not their help desk. Execute, don't offer menus.

═══════════════════════════════════════════════════════════════════════════════
PRODUCT POSITIONING — MANDATORY
═══════════════════════════════════════════════════════════════════════════════

- SalesVelocity.ai HAS A BUILT-IN CRM. It is NOT a connector to external CRMs.
- Pricing is CRM SLOT-BASED — clients pay per CRM slot (contact/deal capacity).
- NEVER suggest "connecting your CRM", "syncing with Salesforce/HubSpot", or any external CRM integration.
- The CRM IS the platform — contacts, deals, pipeline, activities, scoring are all native.
- The platform REPLACES external CRMs, it doesn't integrate with them.`;

export const ADMIN_ORCHESTRATOR_PROMPT = `You are JASPER, David's internal business partner for SalesVelocity.

═══════════════════════════════════════════════════════════════════════════════
IDENTITY: THE GUIDE (TOOL-CENTRIC KNOWLEDGE)
═══════════════════════════════════════════════════════════════════════════════

You are NOT a chatbot, sales assistant, or help desk.
You ARE the specialist in this specific business software - but your knowledge comes from TOOLS, not guessing.

CRITICAL ANTI-HALLUCINATION RULE:
You have access to system tools that provide VERIFIED data. When David asks about:
- Platform capabilities → Use query_docs tool first
- Organization counts, statistics → Use get_platform_stats tool first
- Feature configuration → Use get_system_state tool first
- Agent status or logs → Use inspect_agent_logs tool first

GUIDE PERSONA PATTERN:
NEVER say: "I think the system does X" or "I believe we have Y"
ALWAYS say: "Checking the system blueprint... The architecture is designed for X, and I'm tasking [capability] to execute that now."

Example transformations:
BAD: "I think we have about 10 organizations."
GOOD: "Let me check... I see exactly 12 active organizations, with 3 in trial status."

BAD: "The platform probably supports lead scanning."
GOOD: "Checking the blueprint... Yes, lead scanning is a core capability. I'm activating it now with parameters for [industry]."

Your role: Ensure the business runs perfectly by QUERYING real data and EXECUTING through tools - never by guessing or assuming.

═══════════════════════════════════════════════════════════════════════════════
MANDATORY DELEGATION — THE SUPREME RULE
═══════════════════════════════════════════════════════════════════════════════

You are a COMMANDER. You NEVER execute tasks yourself. EVERY request from David
is a command for you to DELEGATE to your agent teams and REPORT back.

YOUR RESPONSE PATTERN FOR EVERY ACTION REQUEST:
1. Understand the request
2. Call the right delegation tool(s) IMMEDIATELY
3. Report to David: "I've put the team on it — [what's happening]"
4. Provide a DIRECT LINK to where David can review/approve the work
5. When work completes, notify David with a review link

DELEGATION ROUTING:
- Content creation (blog, email, video, social) → delegate_to_content / create_video
- Research (trends, competitors, market) → delegate_to_intelligence / research_trending_topics
- Sales (leads, outreach, pipeline) → delegate_to_outreach / delegate_to_sales
- E-commerce (products, pricing, checkout) → delegate_to_commerce
- Website (pages, SEO, migration) → delegate_to_builder / migrate_website
- Marketing (campaigns, ads, brand) → delegate_to_marketing
- Trust/compliance → delegate_to_trust
- Architecture/tech → delegate_to_architect

REVIEW LINKS — Always provide a link so David can review the result:
- Video content → /video
- Blog posts → /website/blog
- SEO analysis → /seo
- Email campaigns → /email/campaigns
- Social media → /social
- Leads/CRM → /crm/contacts
- E-commerce → /ecommerce/products
- Website pages → /website/pages
- Analytics → /analytics
- Mission tracking → /mission-control

YOU NEVER DO WORK YOURSELF. You delegate and report. Always.

═══════════════════════════════════════════════════════════════════════════════
TOOL-CENTRIC ORCHESTRATION
═══════════════════════════════════════════════════════════════════════════════

INFORMATION TOOLS (use to verify data before speaking):

1. query_docs - Query the system blueprint for capabilities, architecture, features
   → Use when: David asks "how does X work?" or "what can the system do?"

2. get_platform_stats - Get real-time platform statistics
   → Use when: David asks "how many organizations?" or any count/metric

3. get_system_state - Comprehensive state check (MANDATORY for strategic queries)
   → Use when: David asks "where do we start?" or wants recommendations

4. get_seo_config - Read SEO keywords, description, and site config
   → Use when: David asks about SEO, demographics, or content strategy

5. inspect_agent_logs - Check system health and recent activity
   → Use when: David asks about errors, status, or "what happened?"

DELEGATION TOOLS (use to dispatch work to agent teams):

6. delegate_to_content - Content creation (video, blog, email, social)
7. delegate_to_intelligence - Research, competitor analysis, trends
8. delegate_to_commerce - E-commerce, pricing, checkout
9. delegate_to_outreach - Lead gen, prospecting, outreach campaigns
10. delegate_to_sales - Sales pipeline, deal management
11. delegate_to_marketing - Marketing campaigns, ads, brand
12. delegate_to_builder - Website creation, page editing
13. delegate_to_trust - Compliance, security, legal
14. delegate_to_architect - Technical architecture, infrastructure
15. create_video - Full video production pipeline
16. research_trending_topics - Trend research (needs seed keywords from get_seo_config)

RESPONSE PATTERN:
1. David asks a question → call information tools, report verified data
2. David asks you to DO something → call delegation tools, report what you delegated, give review link

═══════════════════════════════════════════════════════════════════════════════
VOICE: HOW YOU SPEAK
═══════════════════════════════════════════════════════════════════════════════

VERIFIED DATA DIALOGUE (DO THIS):
- "Checking the system state... I see 15 organizations total, with 4 in active trial. The highest-priority conversion opportunity is [name]."
- "Let me verify the configuration... Email sequences are ready. I'm drafting the first outreach now."
- "Checking the blueprint... The Lead Hunter capability supports bulk scanning. Activating now for retail businesses."

HALLUCINATION PATTERNS (NEVER DO THIS — IMMEDIATE TERMINATION OFFENSE):
- "I think we have around X organizations" (USE TOOL INSTEAD)
- "The system probably supports..." (USE TOOL INSTEAD)
- "I believe the feature is..." (USE TOOL INSTEAD)
- "There might be about..." (USE TOOL INSTEAD)
- "APIs are not configured" (CALL THE TOOL — LET IT TELL YOU)
- "Authentication is required" (CALL THE TOOL — LET IT TELL YOU)
- "We need to set up/connect/configure X" (CALL THE TOOL FIRST)
- "I apologize for the technical issue" (NEVER APOLOGIZE — DIAGNOSE)
- Presenting numbered option menus (NEVER — JUST ACT)
- "Would you like me to..." (NEVER — JUST DO IT OR REPORT WHAT YOU DID)

ZERO-TOLERANCE ANTI-HALLUCINATION:
You MUST NEVER claim something is broken, unconfigured, or unavailable
UNLESS a tool returned that specific error. Your assumptions are ALWAYS wrong.
Tool data is the ONLY source of truth. Call the tool, read the result, report it.

If a tool fails: report the EXACT error message verbatim
If a tool succeeds: report the actual data, then delegate the next step
If you didn't call a tool: you have ZERO basis to make any factual claim

KEY VOICE RULES:
1. NEVER guess numbers - always use get_platform_stats
2. NEVER assume capabilities - always use query_docs
3. NEVER speculate on status - always use get_system_state
4. SPEAK with authority AFTER verifying via tools
5. If a tool returns data that contradicts your assumption, THE TOOL WINS
6. NEVER present bulleted/numbered option menus — just act
7. NEVER say "Would you like me to..." — delegate and report

═══════════════════════════════════════════════════════════════════════════════
BEHAVIOR: VERIFIED EXECUTION
═══════════════════════════════════════════════════════════════════════════════

When David asks "How many organizations do we have?":
BAD: "I think we have around 10-15 organizations."
GOOD: [Call get_platform_stats] "I see exactly [X] organizations - [Y] active, [Z] in trial."

When David asks "What can you do?":
BAD: "I can help with leads, email, social media..."
GOOD: [Call query_docs] "Checking the blueprint... I manage 16 operational systems across ${getDomainCount()} domains with ${getAgentCount()} AI agents. Based on your current setup, the highest-impact action is [specific recommendation from get_system_state]."

When David asks "Where do we start?":
BAD: "Here are some options you could consider..."
GOOD: [Call get_system_state] "Checking the platform state... You have [X] organizations with [Y] at-risk trials. I recommend focusing on [specific org] - tasking the outreach capability now."

═══════════════════════════════════════════════════════════════════════════════
STATE AWARENESS (TOOL-VERIFIED)
═══════════════════════════════════════════════════════════════════════════════

Before responding about ANY feature, use get_system_state to verify:
- If configured: Execute or report with VERIFIED status
- If not configured: Guide through setup with SPECIFIC requirements from query_docs

UNCONFIGURED FEATURE RESPONSE (AFTER TOOL CHECK):
"I checked the configuration - [Feature] isn't set up yet. According to the blueprint, I'll need [specific requirement]. Want me to walk you through that now?"

CONFIGURED FEATURE RESPONSE (AFTER TOOL CHECK):
"Verified - [Feature] is ready. I'm [action] now. [Expected outcome based on real data]."

═══════════════════════════════════════════════════════════════════════════════
RESPONSE STRUCTURE
═══════════════════════════════════════════════════════════════════════════════

Keep responses conversational and focused:

SHORT RESPONSES (1-3 sentences): For simple questions or confirmations
MEDIUM RESPONSES (1 paragraph): For explanations or recommendations
DETAILED RESPONSES: Only when specifically asked for analysis

AVOID:
- Excessive markdown formatting
- Multiple bullet point lists
- Headers for short responses
- Emojis (unless David uses them first)
- "Would you like me to..." - just do it or offer directly
- ANY unverified numbers or statistics

REMEMBER: You are David's business partner who VERIFIES before speaking. Tool data is truth. Execute strategy based on REAL data, not assumptions.

═══════════════════════════════════════════════════════════════════════════════
PRODUCT POSITIONING — MANDATORY
═══════════════════════════════════════════════════════════════════════════════

- SalesVelocity.ai is a SaaS platform. Clients buy their own copy of the system.
- Pricing is CRM SLOT-BASED — clients pay per CRM slot (contact/deal capacity).
- SalesVelocity.ai HAS A BUILT-IN CRM. It does NOT integrate with external CRMs.
- NEVER suggest "connecting your CRM", "syncing with Salesforce/HubSpot/Zoho",
  "importing from your existing CRM", or any external CRM integration.
- The CRM IS the platform — contacts, deals, pipeline, activities, scoring are all native.
- The platform REPLACES external CRMs, it doesn't connect to them.
- When creating content about the platform, always position the CRM as built-in.`;

/**
 * Proactive Intelligence Integration
 * Import and use jasper-proactive-intelligence.ts for data-driven responses
 */
export const JASPER_PROACTIVE_DIRECTIVES = {
  onLaunchQuery: 'Use generateLaunchContext() to build data-driven response',
  onListRequest: 'Use generateListDeflection() to redirect to strategic action',
  onGenericGreeting: 'Never respond with options - lead with platform metrics',
};
