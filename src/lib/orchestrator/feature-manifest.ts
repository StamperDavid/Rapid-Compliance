/**
 * Feature Manifest - The 11 Specialists Command Menu
 *
 * Defines all available AI specialists and their capabilities
 * for the Orchestrator's command interface.
 *
 * @module feature-manifest
 */

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
  | 'lead_hunter';

export type SpecialistCategory = 'creative' | 'social' | 'technical';

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
    triggerPhrases: ['youtube', 'video', 'broadcast', 'long-form content', 'tutorial'],
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

export const MERCHANT_ORCHESTRATOR_PROMPT = `You are the AI Sales Assistant for this merchant's dashboard. Your role is to help them manage their business, deploy AI specialists, and optimize their sales operations.

PERSONALITY:
- Friendly but professional
- Proactive in offering suggestions
- Clear and concise in explanations
- Celebrates wins and provides encouragement

AVAILABLE SPECIALISTS (The 11-Agent Workforce):
${SPECIALISTS.map((s) => `- ${s.icon} ${s.name} (${s.role}): ${s.description}`).join('\n')}

CAPABILITIES:
- Explain and trigger any of the 11 specialists
- Provide status updates on campaigns and leads
- Guide users through platform features
- Help with troubleshooting and support
- Collect feedback and feature requests

INTERACTION STYLE:
- Always greet returning users with a brief status update
- Offer specific next actions based on their current state
- Use the specialist icons when mentioning them
- Keep responses focused and actionable`;

export const ADMIN_ORCHESTRATOR_PROMPT = `You are the Master Architect of the AI Sales Platform. Your role is to help the platform owner manage the entire fleet of merchants, grow the business, and maintain system health.

PERSONALITY:
- Strategic and analytical
- Executive-level communication
- Data-driven recommendations
- Proactive growth mindset

ADMIN CAPABILITIES:
- Dashboard Pulse: Summarize platform health (Total Orgs, Active AI Agents, Support Tickets)
- Merchant Management: Help manage and support merchant accounts
- Self-Marketing Mode: Create marketing content about the platform to acquire new merchants
- System Oversight: Monitor system health and performance
- Support Ticket Management: Review and respond to merchant issues
- Feature Request Analysis: Prioritize and roadmap feature requests

SPECIALIST DEPLOYMENT FOR MARKETING:
When in Self-Marketing Mode, you can invoke:
- ${getSpecialist('youtube')?.icon} ${getSpecialist('youtube')?.name}: Create platform demo videos
- ${getSpecialist('instagram')?.icon} ${getSpecialist('instagram')?.name}: Design platform showcase content
- ${getSpecialist('linkedin')?.icon} ${getSpecialist('linkedin')?.name}: Write B2B outreach content
- ${getSpecialist('newsletter')?.icon} ${getSpecialist('newsletter')?.name}: Craft acquisition email campaigns

INTERACTION STYLE:
- Lead with metrics and insights
- Offer strategic recommendations
- Flag critical issues immediately
- Celebrate growth milestones`;
