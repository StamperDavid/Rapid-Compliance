/**
 * Agent-Type Training Configuration Registry
 *
 * Static configuration for each agent domain's training evaluation.
 * Defines scoring criteria, scenario types, and performance thresholds
 * used by the training lab, auto-flag service, and coaching-training bridge.
 *
 * Each agent type has domain-specific scoring criteria that reflect
 * what "good performance" means for that type of agent.
 *
 * @module training/agent-type-configs
 */

import type { AgentDomain, AgentTypeTrainingConfig } from '@/types/training';

// ============================================================================
// CHAT AGENT — Customer-facing sales chat
// ============================================================================

const CHAT_CONFIG: AgentTypeTrainingConfig = {
  agentType: 'chat',
  scoringCriteria: [
    { id: 'chat_objection_handling', label: 'Objection Handling', description: 'Ability to identify and overcome customer objections with empathy and evidence', weight: 0.2 },
    { id: 'chat_closing', label: 'Closing Technique', description: 'Effectiveness at guiding conversations toward purchase decisions', weight: 0.18 },
    { id: 'chat_discovery', label: 'Discovery Quality', description: 'Depth and relevance of qualification questions asked', weight: 0.18 },
    { id: 'chat_empathy', label: 'Empathy & Rapport', description: 'Ability to connect emotionally and build trust with the customer', weight: 0.15 },
    { id: 'chat_product_knowledge', label: 'Product Knowledge', description: 'Accuracy and depth of product information provided', weight: 0.15 },
    { id: 'chat_tone', label: 'Tone & Professionalism', description: 'Consistency with configured brand voice and professionalism', weight: 0.14 },
  ],
  scenarioTypes: [
    { id: 'chat_cold_inquiry', label: 'Cold Inquiry', description: 'First-time visitor with no prior context', examples: ['I saw your product online, what does it do?', 'How much does this cost?'] },
    { id: 'chat_price_objection', label: 'Price Objection', description: 'Customer pushes back on pricing', examples: ['That seems expensive compared to competitors', 'Can I get a discount?'] },
    { id: 'chat_competitor_comparison', label: 'Competitor Comparison', description: 'Customer compares with competing products', examples: ['Why should I pick you over CompetitorX?', 'CompetitorX has more features'] },
    { id: 'chat_ready_to_buy', label: 'Ready to Buy', description: 'Customer shows strong purchase intent', examples: ['How do I get started?', 'Can I sign up now?'] },
    { id: 'chat_frustrated_customer', label: 'Frustrated Customer', description: 'Customer is upset about prior experience or product issue', examples: ['I have been waiting for support for days', 'This product did not work as described'] },
    { id: 'chat_complex_needs', label: 'Complex Needs', description: 'Customer has multiple requirements that need careful discovery', examples: ['I need a solution for my team of 50', 'We need API integration with our CRM'] },
  ],
  performanceThresholds: {
    flagForTrainingBelow: 65,
    excellentAbove: 90,
    minSamplesForTrend: 5,
  },
};

// ============================================================================
// VOICE AGENT — Phone-based interactions
// ============================================================================

const VOICE_CONFIG: AgentTypeTrainingConfig = {
  agentType: 'voice',
  scoringCriteria: [
    { id: 'voice_call_handling', label: 'Call Handling', description: 'Smooth call flow management including opening, holding, and transfers', weight: 0.2 },
    { id: 'voice_script_adherence', label: 'Script Adherence', description: 'Following configured call scripts while maintaining natural conversation', weight: 0.18 },
    { id: 'voice_qualification', label: 'Qualification Accuracy', description: 'Correctly identifying qualified leads through voice interaction', weight: 0.18 },
    { id: 'voice_handoff_timing', label: 'Handoff Timing', description: 'Appropriately timing handoffs to human agents or next steps', weight: 0.16 },
    { id: 'voice_tone_clarity', label: 'Tone & Clarity', description: 'Clear, confident vocal delivery with appropriate pacing and energy', weight: 0.14 },
    { id: 'voice_objection_handling', label: 'Objection Handling', description: 'Verbal objection handling with appropriate tone and confidence', weight: 0.14 },
  ],
  scenarioTypes: [
    { id: 'voice_outbound_cold', label: 'Outbound Cold Call', description: 'Initial outreach to a cold prospect', examples: ['Hi, is this the right person for purchasing decisions?', 'I am calling about your recent inquiry'] },
    { id: 'voice_inbound_inquiry', label: 'Inbound Inquiry', description: 'Customer calling in with questions', examples: ['I wanted to learn more about your service', 'I saw your ad and have questions'] },
    { id: 'voice_follow_up', label: 'Follow-Up Call', description: 'Scheduled follow-up with a warm lead', examples: ['We spoke last week about your needs', 'You requested a callback'] },
    { id: 'voice_appointment_setting', label: 'Appointment Setting', description: 'Scheduling a demo or meeting', examples: ['Let me find a time that works for both of us', 'When would you be available for a demo?'] },
    { id: 'voice_escalation', label: 'Escalation Handling', description: 'Customer requesting to speak with a manager or specialist', examples: ['I need to speak with someone senior', 'This issue is not being resolved'] },
  ],
  performanceThresholds: {
    flagForTrainingBelow: 60,
    excellentAbove: 88,
    minSamplesForTrend: 5,
  },
};

// ============================================================================
// EMAIL AGENT — Email composition and sequences
// ============================================================================

const EMAIL_CONFIG: AgentTypeTrainingConfig = {
  agentType: 'email',
  scoringCriteria: [
    { id: 'email_subject_line', label: 'Subject Line Quality', description: 'Compelling, relevant subject lines that drive open rates', weight: 0.2 },
    { id: 'email_personalization', label: 'Personalization', description: 'Use of prospect data and context for personalized messaging', weight: 0.2 },
    { id: 'email_follow_up', label: 'Follow-Up Timing', description: 'Appropriate timing and cadence for follow-up sequences', weight: 0.16 },
    { id: 'email_cta', label: 'CTA Effectiveness', description: 'Clear, compelling calls to action that drive desired responses', weight: 0.16 },
    { id: 'email_response_quality', label: 'Response Quality', description: 'Thoughtful, relevant responses to incoming emails', weight: 0.14 },
    { id: 'email_tone', label: 'Tone & Brand Voice', description: 'Consistency with brand voice and appropriate formality level', weight: 0.14 },
  ],
  scenarioTypes: [
    { id: 'email_cold_outreach', label: 'Cold Outreach', description: 'First contact email to a new prospect', examples: ['Initial personalized introduction', 'Value proposition pitch'] },
    { id: 'email_follow_up_no_response', label: 'Follow-Up (No Response)', description: 'Second/third touch when no reply received', examples: ['Gentle nudge after 3 days', 'New angle after silence'] },
    { id: 'email_proposal_follow_up', label: 'Proposal Follow-Up', description: 'Following up after sending a proposal', examples: ['Checking in on the proposal', 'Addressing potential concerns'] },
    { id: 'email_reengagement', label: 'Re-engagement', description: 'Reaching out to a dormant or churned contact', examples: ['We have not heard from you in a while', 'New features that address your past concerns'] },
    { id: 'email_meeting_request', label: 'Meeting Request', description: 'Requesting a call or demo', examples: ['Would you be open to a 15-minute call?', 'I would love to show you our latest updates'] },
  ],
  performanceThresholds: {
    flagForTrainingBelow: 60,
    excellentAbove: 85,
    minSamplesForTrend: 8,
  },
};

// ============================================================================
// SOCIAL AGENT — Social media content generation
// ============================================================================

const SOCIAL_CONFIG: AgentTypeTrainingConfig = {
  agentType: 'social',
  scoringCriteria: [
    { id: 'social_brand_voice', label: 'Brand Voice Consistency', description: 'Adherence to configured brand voice DNA across all platforms', weight: 0.22 },
    { id: 'social_platform_fit', label: 'Platform Appropriateness', description: 'Content tailored to each platform format, audience, and conventions', weight: 0.2 },
    { id: 'social_engagement', label: 'Engagement Quality', description: 'Content likely to drive meaningful engagement (comments, shares, saves)', weight: 0.18 },
    { id: 'social_cta', label: 'CTA Usage', description: 'Effective calls to action without being overly promotional', weight: 0.14 },
    { id: 'social_content_variety', label: 'Content Variety', description: 'Mix of content types (educational, entertaining, promotional, community)', weight: 0.14 },
    { id: 'social_compliance', label: 'Compliance & Rules', description: 'Adherence to explicit rules, topic restrictions, and platform policies', weight: 0.12 },
  ],
  scenarioTypes: [
    { id: 'social_thought_leadership', label: 'Thought Leadership', description: 'Industry insights and expert positioning', examples: ['Hot take on industry trend', 'Data-driven insight post'] },
    { id: 'social_product_launch', label: 'Product Launch', description: 'Announcing or promoting a product/feature', examples: ['New feature announcement', 'Launch day countdown'] },
    { id: 'social_community_engagement', label: 'Community Engagement', description: 'Building community through questions, polls, and conversations', examples: ['Question to followers', 'User spotlight or testimonial'] },
    { id: 'social_educational', label: 'Educational Content', description: 'Teaching the audience something valuable', examples: ['How-to thread', 'Tips and tricks carousel'] },
    { id: 'social_trend_response', label: 'Trend Response', description: 'Responding to trending topics or current events', examples: ['Industry news reaction', 'Trending topic participation'] },
  ],
  performanceThresholds: {
    flagForTrainingBelow: 60,
    excellentAbove: 85,
    minSamplesForTrend: 10,
  },
};

// ============================================================================
// SEO AGENT — Content optimization for search engines
// ============================================================================

const SEO_CONFIG: AgentTypeTrainingConfig = {
  agentType: 'seo',
  scoringCriteria: [
    { id: 'seo_keyword_optimization', label: 'Keyword Optimization', description: 'Natural incorporation of target keywords with appropriate density', weight: 0.22 },
    { id: 'seo_readability', label: 'Readability', description: 'Content clarity, sentence structure, and reading level appropriateness', weight: 0.18 },
    { id: 'seo_search_intent', label: 'Search Intent Match', description: 'Content correctly addresses the search intent behind target queries', weight: 0.2 },
    { id: 'seo_content_depth', label: 'Content Depth', description: 'Comprehensive coverage of the topic with supporting details', weight: 0.18 },
    { id: 'seo_structure', label: 'Structure Quality', description: 'Proper heading hierarchy, meta descriptions, and semantic HTML structure', weight: 0.12 },
    { id: 'seo_internal_linking', label: 'Internal Linking', description: 'Appropriate use of internal links and contextual cross-references', weight: 0.1 },
  ],
  scenarioTypes: [
    { id: 'seo_blog_post', label: 'Blog Post', description: 'Long-form blog content targeting specific keywords', examples: ['Comprehensive guide on topic X', 'List post targeting comparison keywords'] },
    { id: 'seo_landing_page', label: 'Landing Page', description: 'Conversion-focused page copy optimized for search', examples: ['Product landing page', 'Service description page'] },
    { id: 'seo_meta_content', label: 'Meta Content', description: 'Title tags, meta descriptions, and structured data', examples: ['Compelling meta description', 'Schema markup for product page'] },
    { id: 'seo_content_refresh', label: 'Content Refresh', description: 'Updating existing content for improved performance', examples: ['Refreshing outdated statistics', 'Expanding thin content sections'] },
    { id: 'seo_competitive_content', label: 'Competitive Content', description: 'Creating content to compete with specific ranking pages', examples: ['Better version of top-ranking article', 'Unique angle on saturated topic'] },
  ],
  performanceThresholds: {
    flagForTrainingBelow: 55,
    excellentAbove: 85,
    minSamplesForTrend: 5,
  },
};

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * Static registry of all agent type training configurations.
 * Keyed by AgentDomain for O(1) lookup.
 */
export const AGENT_TYPE_CONFIGS: Record<AgentDomain, AgentTypeTrainingConfig> = {
  chat: CHAT_CONFIG,
  voice: VOICE_CONFIG,
  email: EMAIL_CONFIG,
  social: SOCIAL_CONFIG,
  seo: SEO_CONFIG,
};

/**
 * Get the training config for a specific agent domain.
 * Returns undefined if the domain is not recognized.
 */
export function getAgentTypeConfig(agentType: AgentDomain): AgentTypeTrainingConfig | undefined {
  return AGENT_TYPE_CONFIGS[agentType];
}

/**
 * Get all available agent domains.
 */
export function getAvailableAgentDomains(): AgentDomain[] {
  return Object.keys(AGENT_TYPE_CONFIGS) as AgentDomain[];
}

/**
 * Get the auto-flag threshold for a given agent type.
 * Falls back to 65 if the agent type is not found.
 */
export function getFlagThreshold(agentType: AgentDomain): number {
  return AGENT_TYPE_CONFIGS[agentType]?.performanceThresholds.flagForTrainingBelow ?? 65;
}

/**
 * Get scoring criteria labels for a given agent type.
 * Useful for rendering training session evaluation forms.
 */
export function getScoringCriteriaLabels(agentType: AgentDomain): string[] {
  return AGENT_TYPE_CONFIGS[agentType]?.scoringCriteria.map(c => c.label) ?? [];
}
