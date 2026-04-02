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
// CONTENT AGENT — Blog posts, website packages, landing pages, product copy
// ============================================================================

const CONTENT_CONFIG: AgentTypeTrainingConfig = {
  agentType: 'content',
  scoringCriteria: [
    { id: 'content_brand_voice', label: 'Brand Voice Consistency', description: 'Adherence to configured brand voice across all content types — tone, style, and personality', weight: 0.22 },
    { id: 'content_clarity', label: 'Clarity & Readability', description: 'Content is clear, scannable, and easy to read at the appropriate level for the target audience', weight: 0.2 },
    { id: 'content_value_delivery', label: 'Value Delivery', description: 'Content genuinely solves the reader\'s problem or answers their question — no filler or padding', weight: 0.18 },
    { id: 'content_cta', label: 'CTA Effectiveness', description: 'Calls to action are appropriate, well-placed, and drive the desired next action', weight: 0.14 },
    { id: 'content_structure', label: 'Structure Quality', description: 'Logical flow with proper headings, sections, and visual hierarchy appropriate to the content type', weight: 0.14 },
    { id: 'content_accuracy', label: 'Factual Accuracy', description: 'All claims, statistics, and product details are accurate and verifiable', weight: 0.12 },
  ],
  scenarioTypes: [
    { id: 'content_blog_post', label: 'Blog Post', description: 'Long-form editorial content for a company blog or publication', examples: ['Thought leadership article on industry trend', 'How-to guide for target audience', 'Listicle of best practices'] },
    { id: 'content_landing_page', label: 'Landing Page Copy', description: 'Conversion-focused copy for a product or campaign landing page', examples: ['Hero section + feature benefits + CTA', 'Campaign-specific squeeze page', 'Free trial sign-up page'] },
    { id: 'content_website_package', label: 'Website Content Package', description: 'Full set of copy for core website pages (Home, About, Services, Contact)', examples: ['SaaS product website', 'Professional services firm site', 'E-commerce brand pages'] },
    { id: 'content_product_description', label: 'Product Description', description: 'Compelling product or service descriptions for listings, catalogs, or feature pages', examples: ['SaaS feature description', 'Physical product listing copy', 'Service tier description'] },
    { id: 'content_case_study', label: 'Case Study', description: 'Customer success story structured as problem, solution, and measurable results', examples: ['B2B enterprise case study', 'Before/after ROI story', 'Customer journey narrative'] },
  ],
  performanceThresholds: {
    flagForTrainingBelow: 60,
    excellentAbove: 85,
    minSamplesForTrend: 5,
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
// VIDEO AGENT — AI screenwriter & video generation
// ============================================================================

const VIDEO_CONFIG: AgentTypeTrainingConfig = {
  agentType: 'video',
  scoringCriteria: [
    { id: 'video_user_intent', label: 'User Intent Adherence', description: 'How accurately the screenwriter followed the user prompt — correct character, tone, topic, and scene count', weight: 0.22 },
    { id: 'video_character_consistency', label: 'Character Consistency', description: 'Same character descriptions used across scenes, explicit same-character references, no unexplained character changes', weight: 0.20 },
    { id: 'video_visual_description', label: 'Visual Description Quality', description: 'Rich, specific visual directions that translate well to video generation — setting, lighting, action, camera', weight: 0.18 },
    { id: 'video_narration_handling', label: 'Narration Handling', description: 'Narration written as voiceover, NOT as character speech. On-screen characters perform actions, not talk.', weight: 0.16 },
    { id: 'video_scene_structure', label: 'Scene Structure', description: 'Logical scene progression, appropriate scene count, good pacing and duration distribution', weight: 0.12 },
    { id: 'video_prompt_quality', label: 'Hedra Prompt Quality', description: 'Final prompts optimized for Hedra — correct structure, no forbidden elements, cinematic language', weight: 0.12 },
  ],
  scenarioTypes: [
    { id: 'video_product_demo', label: 'Product Demo', description: 'Showcasing a product or service with a presenter character', examples: ['Show our SaaS dashboard in action', 'Demonstrate the mobile app onboarding'] },
    { id: 'video_brand_story', label: 'Brand Story', description: 'Narrative-driven brand storytelling with emotional arc', examples: ['Tell our founding story in 4 scenes', 'Show a day in the life of our customer'] },
    { id: 'video_explainer', label: 'Explainer Video', description: 'Educational content explaining a concept or process', examples: ['Explain how our AI works', 'Break down the 3-step process'] },
    { id: 'video_testimonial', label: 'Testimonial Style', description: 'Customer success story or case study format', examples: ['Before/after transformation story', 'Customer journey from problem to solution'] },
    { id: 'video_social_ad', label: 'Social Media Ad', description: 'Short, punchy content for social platforms', examples: ['30-second Instagram reel', 'TikTok-style attention grabber'] },
  ],
  performanceThresholds: {
    flagForTrainingBelow: 60,
    excellentAbove: 85,
    minSamplesForTrend: 3,
  },
};

// ============================================================================
// ORCHESTRATOR AGENT — Jasper (strategic delegation & mission orchestration)
// ============================================================================

const ORCHESTRATOR_CONFIG: AgentTypeTrainingConfig = {
  agentType: 'orchestrator',
  scoringCriteria: [
    { id: 'orch_delegation_accuracy', label: 'Delegation Accuracy', description: 'Routed to the correct agent team for the task — no misrouted delegations', weight: 0.22 },
    { id: 'orch_prompt_adherence', label: 'Prompt Adherence', description: 'Followed the user prompt faithfully — correct scope, no missed items, no extras', weight: 0.20 },
    { id: 'orch_tool_efficiency', label: 'Tool Efficiency', description: 'Called the right tools without redundancy or unnecessary steps', weight: 0.18 },
    { id: 'orch_context_awareness', label: 'Context Awareness', description: 'Used prior conversation context and system state appropriately', weight: 0.16 },
    { id: 'orch_response_quality', label: 'Response Quality', description: 'Natural, direct communication — no hedging, no menus, no robotic patterns', weight: 0.12 },
    { id: 'orch_error_transparency', label: 'Error Transparency', description: 'Reported errors accurately without masking failures or inventing results', weight: 0.12 },
  ],
  scenarioTypes: [
    { id: 'orch_multi_tool', label: 'Complex Multi-Tool', description: 'User requests multiple distinct tasks in one prompt', examples: ['Research competitors, scan leads, and create a blog post', 'Scrape 3 websites and launch a full campaign'] },
    { id: 'orch_brainstorm', label: 'Conversational Brainstorm', description: 'User wants to think through strategy, not execute tools', examples: ['What should our Q3 marketing focus be?', 'Help me think through our pricing'] },
    { id: 'orch_error_recovery', label: 'Error Recovery', description: 'Tool fails or returns unexpected results — how does Jasper handle it', examples: ['API key missing', 'Lead scan returns zero results'] },
    { id: 'orch_status_query', label: 'Status Query', description: 'User asks about system state or recent activity', examples: ['Show me my recent leads', 'What campaigns are running?'] },
    { id: 'orch_delegation_routing', label: 'Delegation Routing', description: 'Ambiguous request that could go to multiple agent teams', examples: ['Help me with content', 'I need to reach out to prospects'] },
    { id: 'orch_follow_up', label: 'Follow-Up Request', description: 'User references prior conversation context', examples: ['Now do the same for LinkedIn', 'Enrich the top 3 from that scan'] },
  ],
  performanceThresholds: {
    flagForTrainingBelow: 60,
    excellentAbove: 90,
    minSamplesForTrend: 5,
  },
};

// ============================================================================
// SALES CHAT AGENT — Alex (platform sales & onboarding)
// ============================================================================

const SALES_CHAT_CONFIG: AgentTypeTrainingConfig = {
  agentType: 'sales_chat',
  scoringCriteria: [
    { id: 'sales_product_accuracy', label: 'Product Accuracy', description: 'Correctness of platform feature, pricing, and capability information', weight: 0.22 },
    { id: 'sales_qualification', label: 'Lead Qualification', description: 'Effectiveness at identifying prospect needs and fit (BANT)', weight: 0.18 },
    { id: 'sales_objection_handling', label: 'Objection Handling', description: 'Handling price, trust, complexity, and competitor objections', weight: 0.18 },
    { id: 'sales_trial_guidance', label: 'Trial Guidance', description: 'Effectiveness at guiding prospects toward free trial signup', weight: 0.16 },
    { id: 'sales_tone', label: 'Tone & Approachability', description: 'Approachable, non-pushy, solution-focused voice', weight: 0.14 },
    { id: 'sales_onboarding_support', label: 'Onboarding Support', description: 'Helping new users through post-signup setup and questions', weight: 0.12 },
  ],
  scenarioTypes: [
    { id: 'sales_cold_inquiry', label: 'Cold Inquiry', description: 'First-time visitor asking what the platform is', examples: ['What is SalesVelocity?', 'How does this work?'] },
    { id: 'sales_pricing_question', label: 'Pricing Question', description: 'Prospect asking about pricing tiers and plans', examples: ['How much does it cost?', 'What plan do I need for a team of 5?'] },
    { id: 'sales_competitor_compare', label: 'Competitor Comparison', description: 'Prospect comparing against GoHighLevel, Vendasta, HubSpot, etc.', examples: ['Why should I pick you over GoHighLevel?', 'How are you different from HubSpot?'] },
    { id: 'sales_trial_ready', label: 'Trial Ready', description: 'Prospect ready to start a free trial', examples: ['How do I get started?', 'Can I try it for free?'] },
    { id: 'sales_onboarding_help', label: 'Onboarding Help', description: 'New user questions during initial setup', examples: ['How do I connect my email?', 'Where do I set up my AI agents?'] },
    { id: 'sales_feature_deep_dive', label: 'Feature Deep Dive', description: 'Prospect wants detailed info on a specific capability', examples: ['Tell me about the AI video feature', 'How does the lead scoring work?'] },
  ],
  performanceThresholds: {
    flagForTrainingBelow: 60,
    excellentAbove: 88,
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
  content: CONTENT_CONFIG,
  voice: VOICE_CONFIG,
  email: EMAIL_CONFIG,
  social: SOCIAL_CONFIG,
  seo: SEO_CONFIG,
  video: VIDEO_CONFIG,
  orchestrator: ORCHESTRATOR_CONFIG,
  sales_chat: SALES_CHAT_CONFIG,
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
