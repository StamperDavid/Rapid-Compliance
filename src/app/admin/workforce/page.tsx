'use client';

/**
 * Admin Workforce HQ
 * Displays all 51 AI agents from AGENT_REGISTRY.json in a comprehensive dashboard.
 * Shows hierarchy, status, capabilities, and reporting structure.
 */

import React, { useState, useMemo } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  Bot,
  Cpu,
  Network,
  Zap,
  Users,
  Target,
  Filter,
  Search,
} from 'lucide-react';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

type AgentLevel = 'L1' | 'L2' | 'L3' | 'Standalone';
type AgentStatus = 'FUNCTIONAL' | 'GHOST';

interface BaseAgent {
  name: string;
  displayName: string;
  level: AgentLevel;
  status: AgentStatus;
  path: string;
  note: string;
  manager?: string;
  capabilities?: string[];
}

interface OrchestratorAgent extends BaseAgent {
  level: 'L1';
  role: string;
  directReports: string[];
}

interface ManagerAgent extends BaseAgent {
  level: 'L2';
  specialists: string[];
}

interface SpecialistAgent extends BaseAgent {
  level: 'L3';
  manager: string;
}

interface StandaloneAgent extends BaseAgent {
  level: 'Standalone';
  type: string;
}

type Agent = OrchestratorAgent | ManagerAgent | SpecialistAgent | StandaloneAgent;

// -------------------------------------------------------------------
// Agent Registry Data (extracted from AGENT_REGISTRY.json)
// -------------------------------------------------------------------

const AGENTS: Agent[] = [
  // L1 - Orchestrator
  {
    name: 'MASTER_ORCHESTRATOR',
    displayName: 'Master Orchestrator',
    level: 'L1',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/orchestrator/manager.ts',
    role: 'Swarm CEO',
    directReports: ['INTELLIGENCE_MANAGER', 'MARKETING_MANAGER', 'BUILDER_MANAGER', 'ARCHITECT_MANAGER', 'COMMERCE_MANAGER', 'OUTREACH_MANAGER', 'CONTENT_MANAGER', 'REVENUE_DIRECTOR', 'REPUTATION_MANAGER'],
    note: '2000+ LOC - Command Pattern task dispatch, Saga Pattern workflows, intent-based domain routing (9 categories), cross-domain synchronization, TenantMemoryVault integration',
  },

  // L2 - Managers
  {
    name: 'INTELLIGENCE_MANAGER',
    displayName: 'Intelligence Manager',
    level: 'L2',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/intelligence/manager.ts',
    specialists: ['SCRAPER_SPECIALIST', 'COMPETITOR_RESEARCHER', 'TECHNOGRAPHIC_SCOUT', 'SENTIMENT_ANALYST', 'TREND_SCOUT'],
    note: 'Dynamic orchestration engine with parallel execution, graceful degradation. All 5 specialists functional.',
  },
  {
    name: 'MARKETING_MANAGER',
    displayName: 'Marketing Manager',
    level: 'L2',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/marketing/manager.ts',
    specialists: ['TIKTOK_EXPERT', 'TWITTER_EXPERT', 'FACEBOOK_EXPERT', 'LINKEDIN_EXPERT', 'SEO_EXPERT'],
    note: 'Industry-agnostic Cross-Channel Commander - Brand DNA integration, SEO-social feedback loop, parallel execution',
  },
  {
    name: 'BUILDER_MANAGER',
    displayName: 'Builder Manager',
    level: 'L2',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/builder/manager.ts',
    specialists: ['UX_UI_ARCHITECT', 'FUNNEL_ENGINEER', 'ASSET_GENERATOR', 'WORKFLOW_OPTIMIZER'],
    note: 'Autonomous Construction Commander - Blueprint-to-Deployment workflow, pixel injection (GA4, GTM, Meta Pixel, Hotjar), build state machine, Vercel deployment manifest',
  },
  {
    name: 'ARCHITECT_MANAGER',
    displayName: 'Architect Manager',
    level: 'L2',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/architect/manager.ts',
    specialists: ['UX_UI_SPECIALIST', 'FUNNEL_PATHOLOGIST', 'COPY_SPECIALIST'],
    note: 'Strategic Infrastructure Commander - Brand DNA integration, TenantMemoryVault Intelligence Brief consumption, SiteArchitecture + TechnicalBrief synthesis',
  },
  {
    name: 'COMMERCE_MANAGER',
    displayName: 'Commerce Manager',
    level: 'L2',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/commerce/manager.ts',
    specialists: ['PAYMENT_SPECIALIST', 'SUBSCRIPTION_SPECIALIST', 'CATALOG_MANAGER', 'PRICING_STRATEGIST', 'INVENTORY_MANAGER'],
    note: 'Transactional Commerce Commander - Product-to-Payment checkout orchestration, subscription state machine, CommerceBrief revenue synthesis, dunning triggers',
  },
  {
    name: 'OUTREACH_MANAGER',
    displayName: 'Outreach Manager',
    level: 'L2',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/outreach/manager.ts',
    specialists: ['EMAIL_SPECIALIST', 'SMS_SPECIALIST'],
    note: 'Omni-Channel Communication Commander - Multi-Step Sequence execution, channel escalation (EMAIL -> SMS -> VOICE), sentiment-aware routing, DNC compliance, frequency throttling',
  },
  {
    name: 'CONTENT_MANAGER',
    displayName: 'Content Manager',
    level: 'L2',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/content/manager.ts',
    specialists: ['COPYWRITER', 'CALENDAR_COORDINATOR', 'VIDEO_SPECIALIST'],
    note: 'Multi-Modal Production Commander - Brand DNA integration, SEO-to-Copy keyword injection, ContentPackage synthesis, quality gate validation',
  },
  {
    name: 'REVENUE_DIRECTOR',
    displayName: 'Revenue Director',
    level: 'L2',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/sales/revenue/manager.ts',
    specialists: ['LEAD_QUALIFIER', 'OUTREACH_SPECIALIST', 'MERCHANDISER', 'DEAL_CLOSER', 'OBJ_HANDLER'],
    note: 'Sales Ops Commander - Lead pipeline state machine, Golden Master persona tuning, RevenueBrief synthesis, objection library battlecards, cross-agent signal sharing',
  },
  {
    name: 'REPUTATION_MANAGER',
    displayName: 'Reputation Manager',
    level: 'L2',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/trust/reputation/manager.ts',
    specialists: ['REVIEW_SPECIALIST', 'GMB_SPECIALIST', 'REV_MGR', 'CASE_STUDY'],
    note: 'Brand Defense Commander - Review-to-Revenue feedback loop, AI-powered response engine, GMB profile optimization, ReputationBrief trust score synthesis',
  },

  // L3 - Specialists (Intelligence)
  {
    name: 'SCRAPER_SPECIALIST',
    displayName: 'Scraper Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/intelligence/scraper/specialist.ts',
    manager: 'INTELLIGENCE_MANAGER',
    capabilities: ['website_scraping', 'content_extraction', 'contact_discovery', 'business_signal_detection', 'structured_output'],
    note: 'Website scraping and content extraction with Jasper tool integration',
  },
  {
    name: 'COMPETITOR_RESEARCHER',
    displayName: 'Competitor Researcher',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/intelligence/competitor/specialist.ts',
    manager: 'INTELLIGENCE_MANAGER',
    capabilities: ['competitor_discovery', 'seo_analysis', 'market_positioning', 'feature_comparison', 'gap_analysis'],
    note: 'Competitive intelligence and market analysis specialist',
  },
  {
    name: 'TECHNOGRAPHIC_SCOUT',
    displayName: 'Technographic Scout',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/intelligence/technographic/specialist.ts',
    manager: 'INTELLIGENCE_MANAGER',
    capabilities: ['tech_stack_detection', 'platform_identification', 'analytics_detection', 'pixel_detection', 'integration_discovery'],
    note: 'Technology stack detection and platform analysis',
  },
  {
    name: 'SENTIMENT_ANALYST',
    displayName: 'Sentiment Analyst',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/intelligence/sentiment/specialist.ts',
    manager: 'INTELLIGENCE_MANAGER',
    capabilities: ['sentiment_scoring', 'trend_detection', 'social_listening', 'crisis_detection'],
    note: 'Social sentiment analysis and crisis detection',
  },
  {
    name: 'TREND_SCOUT',
    displayName: 'Trend Scout',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/intelligence/trend/specialist.ts',
    manager: 'INTELLIGENCE_MANAGER',
    capabilities: ['market_trends', 'emerging_patterns', 'signal_detection', 'opportunity_identification'],
    note: 'Market trend identification and opportunity detection',
  },

  // L3 - Specialists (Marketing)
  {
    name: 'TIKTOK_EXPERT',
    displayName: 'TikTok Expert',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/marketing/tiktok/specialist.ts',
    manager: 'MARKETING_MANAGER',
    capabilities: ['viral_hook_generation', 'video_pacing_scripts', 'trending_sound_analysis', 'retention_optimization', 'algorithm_alignment'],
    note: 'TikTok viral content strategy and optimization',
  },
  {
    name: 'TWITTER_EXPERT',
    displayName: 'Twitter Expert',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/marketing/twitter/specialist.ts',
    manager: 'MARKETING_MANAGER',
    capabilities: ['thread_architecture', 'engagement_replies', 'ratio_risk_assessment', 'viral_detection', 'blue_check_optimization'],
    note: 'Twitter/X engagement and thread strategy',
  },
  {
    name: 'FACEBOOK_EXPERT',
    displayName: 'Facebook Expert',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/marketing/facebook/specialist.ts',
    manager: 'MARKETING_MANAGER',
    capabilities: ['ad_creative_generation', 'audience_persona_matching', 'copy_framework_selection', 'ab_testing_variations'],
    note: 'Facebook ad creative and audience targeting',
  },
  {
    name: 'LINKEDIN_EXPERT',
    displayName: 'LinkedIn Expert',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/marketing/linkedin/specialist.ts',
    manager: 'MARKETING_MANAGER',
    capabilities: ['b2b_targeting', 'thought_leadership', 'connection_strategy', 'post_optimization'],
    note: 'LinkedIn B2B strategy and thought leadership',
  },
  {
    name: 'SEO_EXPERT',
    displayName: 'SEO Expert',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/marketing/seo/specialist.ts',
    manager: 'MARKETING_MANAGER',
    capabilities: ['keyword_research', 'on_page_optimization', 'link_building', 'serp_analysis'],
    note: 'Search engine optimization and SERP analysis',
  },

  // L3 - Specialists (Builder)
  {
    name: 'UX_UI_ARCHITECT',
    displayName: 'UX/UI Architect',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/builder/ux-ui/specialist.ts',
    manager: 'BUILDER_MANAGER',
    capabilities: ['interface_design', 'component_libraries', 'color_palettes', 'accessibility', 'design_system_tokens'],
    note: 'Interface design and component architecture',
  },
  {
    name: 'FUNNEL_ENGINEER',
    displayName: 'Funnel Engineer',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/builder/funnel/specialist.ts',
    manager: 'BUILDER_MANAGER',
    capabilities: ['conversion_funnels', 'landing_page_optimization', 'ab_test_setup', 'funnel_design'],
    note: 'Conversion funnel optimization and A/B testing',
  },
  {
    name: 'ASSET_GENERATOR',
    displayName: 'Asset Generator',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/builder/assets/specialist.ts',
    manager: 'BUILDER_MANAGER',
    capabilities: ['image_generation', 'logo_creation', 'banner_design', 'brand_asset_management', 'social_graphics'],
    note: 'Digital asset creation and brand management',
  },
  {
    name: 'WORKFLOW_OPTIMIZER',
    displayName: 'Workflow Optimizer',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/builder/workflow/specialist.ts',
    manager: 'BUILDER_MANAGER',
    capabilities: ['process_automation', 'workflow_optimization', 'efficiency_metrics', 'bottleneck_detection'],
    note: 'Process automation and efficiency optimization',
  },

  // L3 - Specialists (Architect)
  {
    name: 'UX_UI_SPECIALIST',
    displayName: 'UX/UI Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/architect/ux-ui/specialist.ts',
    manager: 'ARCHITECT_MANAGER',
    capabilities: ['component_selection', 'color_palette_generation', 'wireframe_generation', 'responsive_layout', 'accessibility_audit'],
    note: 'COMPONENT_SCHEMAS library (10 categories) + COLOR_PSYCHOLOGY library (10 industries with psychology-based palettes)',
  },
  {
    name: 'FUNNEL_PATHOLOGIST',
    displayName: 'Funnel Pathologist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/architect/funnel/specialist.ts',
    manager: 'ARCHITECT_MANAGER',
    capabilities: ['funnel_architecture', 'stage_optimization', 'conversion_analysis', 'price_strategy', 'urgency_tactics'],
    note: 'THE SQUEEZE: Lead Magnet (8 types) -> Tripwire ($7-47) -> Core Offer ($197-1997) -> Upsell (5 types). 8 business templates',
  },
  {
    name: 'COPY_SPECIALIST',
    displayName: 'Copy Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/architect/copy/specialist.ts',
    manager: 'ARCHITECT_MANAGER',
    capabilities: ['framework_selection', 'headline_generation', 'cta_optimization', 'copy_generation', 'ab_variations'],
    note: '6 copywriting frameworks (PAS, AIDA, BAB, FAB, 4Ps, StoryBrand), 10 headline formulas, 5 CTA categories',
  },

  // L3 - Specialists (Commerce)
  {
    name: 'PAYMENT_SPECIALIST',
    displayName: 'Payment Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/commerce/payment/specialist.ts',
    manager: 'COMMERCE_MANAGER',
    capabilities: ['checkout_sessions', 'payment_intents', 'refunds', 'stripe_integration', 'webhook_handling'],
    note: 'Stripe integration and payment processing',
  },
  {
    name: 'SUBSCRIPTION_SPECIALIST',
    displayName: 'Subscription Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/commerce/subscription/specialist.ts',
    manager: 'COMMERCE_MANAGER',
    capabilities: ['trial_management', 'billing_cycles', 'dunning_sequences', 'state_transitions'],
    note: 'Subscription lifecycle and billing management',
  },
  {
    name: 'CATALOG_MANAGER',
    displayName: 'Catalog Manager',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/commerce/catalog/specialist.ts',
    manager: 'COMMERCE_MANAGER',
    capabilities: ['product_crud', 'variant_management', 'catalog_search', 'inventory_tracking'],
    note: 'Product catalog and variant management',
  },
  {
    name: 'PRICING_STRATEGIST',
    displayName: 'Pricing Strategist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/commerce/pricing/specialist.ts',
    manager: 'COMMERCE_MANAGER',
    capabilities: ['dynamic_pricing', 'discount_strategies', 'margin_optimization', 'totals_calculation'],
    note: 'Dynamic pricing and margin optimization',
  },
  {
    name: 'INVENTORY_MANAGER',
    displayName: 'Inventory Manager',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/commerce/inventory/specialist.ts',
    manager: 'COMMERCE_MANAGER',
    capabilities: ['stock_tracking', 'reorder_automation', 'demand_forecasting', 'supplier_management'],
    note: 'Inventory tracking and demand forecasting',
  },

  // L3 - Specialists (Outreach)
  {
    name: 'EMAIL_SPECIALIST',
    displayName: 'Email Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/outreach/email/specialist.ts',
    manager: 'OUTREACH_MANAGER',
    capabilities: ['email_campaigns', 'sequence_building', 'template_rendering', 'deliverability_optimization'],
    note: 'Email campaign orchestration and deliverability',
  },
  {
    name: 'SMS_SPECIALIST',
    displayName: 'SMS Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/outreach/sms/specialist.ts',
    manager: 'OUTREACH_MANAGER',
    capabilities: ['sms_campaigns', 'two_way_messaging', 'compliance_management', 'e164_validation'],
    note: 'SMS campaigns with compliance and E.164 validation',
  },

  // L3 - Specialists (Content)
  {
    name: 'COPYWRITER',
    displayName: 'Copywriter',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/content/copywriter/specialist.ts',
    manager: 'CONTENT_MANAGER',
    capabilities: ['headline_generation', 'ad_copy', 'landing_page_copy', 'email_copy', 'brand_voice'],
    note: 'High-converting copy across all channels',
  },
  {
    name: 'CALENDAR_COORDINATOR',
    displayName: 'Calendar Coordinator',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/content/calendar/specialist.ts',
    manager: 'CONTENT_MANAGER',
    capabilities: ['content_scheduling', 'cross_platform_sync', 'deadline_management', 'publishing_automation'],
    note: 'Content scheduling and cross-platform coordination',
  },
  {
    name: 'VIDEO_SPECIALIST',
    displayName: 'Video Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/content/video/specialist.ts',
    manager: 'CONTENT_MANAGER',
    capabilities: ['video_scripts', 'storyboards', 'audio_cues', 'video_seo', 'thumbnail_strategy'],
    note: 'Video content strategy and optimization',
  },

  // L3 - Specialists (Revenue)
  {
    name: 'LEAD_QUALIFIER',
    displayName: 'Lead Qualifier',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/sales/qualifier/specialist.ts',
    manager: 'REVENUE_DIRECTOR',
    capabilities: ['bant_scoring', 'budget_analysis', 'authority_detection', 'need_assessment', 'timeline_evaluation', 'icp_alignment'],
    note: 'BANT Framework (0-100): Budget (25pts) + Authority (25pts) + Need (25pts) + Timeline (25pts). Qualification tiers: HOT/WARM/COLD/DISQUALIFIED',
  },
  {
    name: 'OUTREACH_SPECIALIST',
    displayName: 'Outreach Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/sales/outreach/specialist.ts',
    manager: 'REVENUE_DIRECTOR',
    capabilities: ['context_aware_messaging', 'competitor_displacement', 'framework_selection', 'personalization_injection', 'follow_up_sequences', 'channel_optimization'],
    note: '8 OUTREACH_FRAMEWORKS: COLD_INTRO, COMPETITOR_DISPLACEMENT, TRIGGER_EVENT, REFERRAL_WARM, PAIN_AGITATION, CASE_STUDY_PROOF, DIRECT_ASK, FOLLOW_UP_SEQUENCE',
  },
  {
    name: 'MERCHANDISER',
    displayName: 'Merchandiser',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/sales/merchandiser/specialist.ts',
    manager: 'REVENUE_DIRECTOR',
    capabilities: ['nudge_eligibility', 'coupon_strategy', 'stripe_integration', 'roi_calculation', 'interaction_scoring', 'constraint_validation'],
    note: '7 NUDGE_STRATEGIES: ENGAGEMENT_NUDGE (10%), CART_ABANDONMENT (15%), WIN_BACK (20%), TRIAL_CONVERSION (10%), REFERRAL_REWARD (25%), SEASONAL_PROMO, LOYALTY_TIER (5-20%)',
  },
  {
    name: 'DEAL_CLOSER',
    displayName: 'Deal Closer',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/sales/deal-closer/specialist.ts',
    manager: 'REVENUE_DIRECTOR',
    capabilities: ['closing_strategies', 'objection_handling', 'deal_progression', 'win_loss_analysis'],
    note: 'Deal progression and closing strategy execution',
  },
  {
    name: 'OBJ_HANDLER',
    displayName: 'Objection Handler',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/sales/objection-handler/specialist.ts',
    manager: 'REVENUE_DIRECTOR',
    capabilities: ['objection_response_strategies', 'price_timing_handling', 'pain_point_resolution', 'battlecard_generation'],
    note: 'Objection handling with battlecard strategies',
  },

  // L3 - Specialists (Reputation)
  {
    name: 'REVIEW_SPECIALIST',
    displayName: 'Review Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/trust/review/specialist.ts',
    manager: 'REPUTATION_MANAGER',
    capabilities: ['star_rating_responses', 'sentiment_analysis', 'platform_specific_templates', 'referral_requests', 'social_proof_collection'],
    note: '5-STAR RESPONSE LOGIC: 1-star (Crisis), 2-star (Damage Control), 3-star (Constructive), 4-star (Nurture), 5-star (Amplification). Platform templates for Google/Yelp/Facebook/Trustpilot/G2',
  },
  {
    name: 'GMB_SPECIALIST',
    displayName: 'GMB Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/trust/gmb/specialist.ts',
    manager: 'REPUTATION_MANAGER',
    capabilities: ['local_update_drafting', 'photo_post_optimization', 'map_pack_ranking', 'nap_consistency', 'local_keyword_optimization'],
    note: 'LOCAL SEO: GMB_POST_TYPES, PHOTO_STRATEGIES, MAP_PACK_FACTORS (proximity 30%, relevance 30%, prominence 40%), NAP_CONSISTENCY rules',
  },
  {
    name: 'REV_MGR',
    displayName: 'Review Manager',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/trust/review-manager/specialist.ts',
    manager: 'REPUTATION_MANAGER',
    capabilities: ['review_response_management', 'crisis_handling', 'amplification_tactics', 'review_solicitation'],
    note: 'Review response orchestration and crisis management',
  },
  {
    name: 'CASE_STUDY',
    displayName: 'Case Study Specialist',
    level: 'L3',
    status: 'FUNCTIONAL',
    path: 'src/lib/agents/trust/case-study/specialist.ts',
    manager: 'REPUTATION_MANAGER',
    capabilities: ['case_study_creation', 'social_proof_collection', 'testimonial_synthesis', 'success_story_formatting'],
    note: 'Success story and social proof creation',
  },

  // Standalone Agents
  {
    name: 'JASPER_GOLDEN_MASTER',
    displayName: 'Jasper Golden Master',
    level: 'Standalone',
    status: 'FUNCTIONAL',
    type: 'Platform Chat Agent',
    path: 'Firestore: organizations/platform/goldenMasters/',
    capabilities: ['public_chat', 'lead_qualification', 'product_demos', 'pricing_discussion', 'tool_delegation'],
    note: 'Public-facing AI sales agent on RapidCompliance.US landing page. Routes via OpenRouter to multiple models. Has 9 tool functions for delegation to swarm agents.',
  },
  {
    name: 'VOICE_AGENT_HANDLER',
    displayName: 'Voice Agent Handler',
    level: 'Standalone',
    status: 'FUNCTIONAL',
    type: 'Voice AI Agent',
    path: 'src/lib/voice/voice-agent-handler.ts',
    capabilities: ['ai_phone_conversations', 'lead_qualification_voice', 'deal_closing_voice', 'warm_transfer'],
    note: 'Hybrid AI/human voice agent with two modes: Prospector (lead qualification) and Closer (deal closing with warm transfer capabilities)',
  },
  {
    name: 'AUTONOMOUS_POSTING_AGENT',
    displayName: 'Autonomous Posting Agent',
    level: 'Standalone',
    status: 'FUNCTIONAL',
    type: 'Social Media Automation',
    path: 'src/lib/social/autonomous-posting-agent.ts',
    capabilities: ['linkedin_posting', 'twitter_posting', 'content_scheduling', 'queue_management', 'analytics_tracking'],
    note: 'Manages autonomous content posting across LinkedIn and Twitter/X with scheduling, queueing, and analytics',
  },
  {
    name: 'CHAT_SESSION_SERVICE',
    displayName: 'Chat Session Service',
    level: 'Standalone',
    status: 'FUNCTIONAL',
    type: 'Agent Infrastructure',
    path: 'src/lib/agent/chat-session-service.ts',
    capabilities: ['session_management', 'conversation_monitoring', 'agent_instance_lifecycle', 'golden_master_spawning'],
    note: 'Manages real-time AI chat sessions and agent instance lifecycle. AgentInstanceManager handles ephemeral agent instances spawned from Golden Masters.',
  },
];

// -------------------------------------------------------------------
// Level styling config
// -------------------------------------------------------------------

const LEVEL_CONFIG: Record<AgentLevel, { color: string; bg: string; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  L1: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', label: 'L1 Orchestrator', icon: Network },
  L2: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', label: 'L2 Manager', icon: Users },
  L3: { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', label: 'L3 Specialist', icon: Target },
  Standalone: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', label: 'Standalone', icon: Zap },
};

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export default function AdminWorkforcePage() {
  const { adminUser } = useAdminAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<AgentLevel | 'All'>('All');

  const filteredAgents = useMemo(() => {
    return AGENTS.filter((agent) => {
      const matchesSearch =
        agent.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.note.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = levelFilter === 'All' || agent.level === levelFilter;
      return matchesSearch && matchesLevel;
    });
  }, [searchTerm, levelFilter]);

  const stats = useMemo(() => {
    return {
      total: AGENTS.length,
      orchestrator: AGENTS.filter((a) => a.level === 'L1').length,
      managers: AGENTS.filter((a) => a.level === 'L2').length,
      specialists: AGENTS.filter((a) => a.level === 'L3').length,
      standalone: AGENTS.filter((a) => a.level === 'Standalone').length,
    };
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.6875rem', color: '#6366f1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin / {adminUser?.email}
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
            Workforce HQ - 51 AI Agents
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Complete registry of all orchestrators, managers, specialists, and standalone agents
          </p>
        </div>

        {/* Summary Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <StatCard label="Total Agents" value={stats.total.toString()} color="#fff" />
          <StatCard label="Orchestrator" value={stats.orchestrator.toString()} color="#f59e0b" />
          <StatCard label="Managers" value={stats.managers.toString()} color="#8b5cf6" />
          <StatCard label="Specialists" value={stats.specialists.toString()} color="#06b6d4" />
          <StatCard label="Standalone" value={stats.standalone.toString()} color="#10b981" />
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '2rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Search */}
          <div style={{ flex: '1 1 300px', minWidth: 0, position: 'relative' }}>
            <Search
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#666',
                width: '16px',
                height: '16px',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 2.75rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Level Filter */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Filter className="w-4 h-4" style={{ color: '#666' }} />
            {(['All', 'L1', 'L2', 'L3', 'Standalone'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: levelFilter === level ? '#6366f1' : '#1a1a1a',
                  color: levelFilter === level ? '#fff' : '#999',
                  border: '1px solid',
                  borderColor: levelFilter === level ? '#6366f1' : '#333',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.name} agent={agent} />
          ))}
        </div>

        {/* No Results */}
        {filteredAgents.length === 0 && (
          <div
            style={{
              padding: '3rem',
              textAlign: 'center',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '1rem',
            }}
          >
            <Bot className="w-12 h-12" style={{ color: '#666', margin: '0 auto 1rem' }} />
            <p style={{ color: '#999', fontSize: '0.875rem' }}>No agents match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        padding: '1.25rem',
        backgroundColor: '#0a0a0a',
        border: '1px solid #1a1a1a',
        borderRadius: '0.75rem',
      }}
    >
      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const levelConfig = LEVEL_CONFIG[agent.level];
  const LevelIcon = levelConfig.icon;

  return (
    <div
      style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '1rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#fff', margin: '0 0 0.25rem 0', wordBreak: 'break-word' }}>
            {agent.displayName}
          </h3>
          <p style={{ fontSize: '0.6875rem', color: '#666', fontFamily: 'monospace', margin: 0 }}>
            {agent.name}
          </p>
        </div>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '0.5rem',
            backgroundColor: levelConfig.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <LevelIcon className="w-5 h-5" style={{ color: levelConfig.color }} />
        </div>
      </div>

      {/* Level & Status Badges */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: levelConfig.bg,
            color: levelConfig.color,
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 600,
          }}
        >
          {levelConfig.label}
        </span>
        <span
          style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 600,
          }}
        >
          {agent.status}
        </span>
        {'type' in agent && agent.type && (
          <span
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              color: '#6366f1',
              borderRadius: '9999px',
              fontSize: '0.6875rem',
              fontWeight: 600,
            }}
          >
            {agent.type}
          </span>
        )}
      </div>

      {/* Manager Info (for L3 specialists) */}
      {agent.level === 'L3' && 'manager' in agent && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#0a0a0a',
            borderRadius: '0.5rem',
            border: '1px solid #222',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Cpu className="w-4 h-4" style={{ color: '#8b5cf6', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.6875rem', color: '#666' }}>Reports to</div>
            <div style={{ fontSize: '0.8125rem', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agent.manager.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')}
            </div>
          </div>
        </div>
      )}

      {/* Capabilities */}
      {agent.capabilities && agent.capabilities.length > 0 && (
        <div>
          <div style={{ fontSize: '0.6875rem', color: '#666', marginBottom: '0.5rem', fontWeight: 600 }}>
            CAPABILITIES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {agent.capabilities.slice(0, 5).map((cap) => (
              <span
                key={cap}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#0a0a0a',
                  color: '#999',
                  borderRadius: '0.25rem',
                  fontSize: '0.6875rem',
                  border: '1px solid #222',
                }}
              >
                {cap.replace(/_/g, ' ')}
              </span>
            ))}
            {agent.capabilities.length > 5 && (
              <span
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#0a0a0a',
                  color: '#666',
                  borderRadius: '0.25rem',
                  fontSize: '0.6875rem',
                  border: '1px solid #222',
                }}
              >
                +{agent.capabilities.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Note */}
      <div
        style={{
          fontSize: '0.8125rem',
          color: '#999',
          lineHeight: 1.5,
          borderTop: '1px solid #222',
          paddingTop: '1rem',
        }}
      >
        {agent.note}
      </div>

      {/* Path */}
      <div
        style={{
          fontSize: '0.6875rem',
          color: '#666',
          fontFamily: 'monospace',
          backgroundColor: '#0a0a0a',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.375rem',
          border: '1px solid #222',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {agent.path}
      </div>
    </div>
  );
}
