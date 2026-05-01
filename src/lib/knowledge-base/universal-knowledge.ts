/**
 * Universal Product Knowledge — Editable Source of Truth
 *
 * This file is the ONLY place to edit platform facts for AI agents.
 * After editing, run: npx tsx scripts/seed-knowledge-base.ts
 *
 * Pricing is imported from src/lib/config/pricing.ts so a single price change
 * ripples here automatically on the next seed run.
 *
 * Sourced from:
 *   - src/lib/constants/feature-modules.ts  (feature module catalog + API keys)
 *   - src/lib/orchestrator/feature-manifest.ts  (13 specialists + capabilities)
 *   - src/lib/persona/templates/*  (real-estate, healthcare, home-services templates)
 *   - src/app/(dashboard)/settings/organization/page.tsx  (19-industry dropdown)
 *   - src/lib/config/pricing.ts  (canonical pricing config)
 *   - docs/knowledgebase-contract.md  (shape + coverage requirements)
 */

import type { KnowledgeBaseFeature, KnowledgeBaseIndustry } from '@/types/knowledge-base';
import { PRICING } from '@/lib/config/pricing';

// ============================================================================
// FEATURES
// All 12 feature modules from feature-modules.ts + additional surfaces
// (Magic Studio sub-features, Voice AI, Brand DNA, Integrations, AI Swarm)
// ============================================================================

export const KNOWLEDGE_BASE_FEATURES: KnowledgeBaseFeature[] = [
  // ── CRM & Pipeline ────────────────────────────────────────────────────────
  {
    id: 'crm',
    name: 'CRM & Pipeline',
    category: 'sales',
    summary: 'A built-in CRM that tracks every lead, contact, deal, and company — no external tool needed.',
    detail:
      'The platform replaces standalone CRMs like Salesforce or HubSpot. Leads, contacts, deals, and companies all live natively inside SalesVelocity. The Living Ledger feature auto-enriches contact records as prospects engage. AI lead scoring ranks your pipeline so your team focuses on the opportunities most likely to close.',
    examples: [
      'Track every prospect from first touch through closed-won in a visual pipeline',
      'Auto-score leads based on engagement, firmographic data, and behavior signals',
      'Enrich contact records with company size, tech stack, and LinkedIn data automatically',
      'Set up deal-stage automations that trigger follow-ups without manual effort',
    ],
  },
  {
    id: 'conversations',
    name: 'AI Conversations',
    category: 'sales',
    summary: 'Your AI chat agent qualifies leads and answers questions 24/7 through your website, social DMs, and Messenger.',
    detail:
      'Every inbound conversation routes through your customer-facing AI chat agent (you name them — default is Alex). The agent qualifies leads, answers product questions using your live KnowledgeBase, books meetings, and hands warm prospects to your team. Conversation history is stored per-contact so no context is ever lost between sessions.',
    examples: [
      'Qualify inbound website visitors automatically, even outside business hours',
      'Route high-intent prospects directly to your calendar for a demo',
      'Answer pricing, feature, and comparison questions using the live KnowledgeBase',
      'Maintain full conversation history per lead for seamless human handoff',
    ],
  },
  {
    id: 'lead_scoring',
    name: 'Lead Scoring & Intelligence',
    category: 'sales',
    summary: 'AI scores every lead from 0-100 and surfaces the signals that matter most for your industry.',
    detail:
      'The Lead Hunter specialist discovers and enriches prospects using Clearbit and custom scraping logic. Industry-specific signal scoring (e.g., "top producer" for real estate, "new patient specials" for dental) makes every score actionable, not generic.',
    examples: [
      'Score leads by engagement, firmographics, and industry-specific signals simultaneously',
      'Segment prospects automatically into high, medium, and low priority buckets',
      'Enrich every lead with company data, tech stack, and social presence in one click',
      'Surface "ready now" prospects from a cold pipeline using recency + intent signals',
    ],
  },
  {
    id: 'proposals_docs',
    name: 'Proposals & Documents',
    category: 'sales',
    summary: 'AI-generated proposals, quotes, and contracts that close deals faster.',
    detail:
      'The built-in proposal builder pulls deal data directly from the CRM to pre-fill proposals. AI writing assistance drafts the narrative sections. Templates support service pricing tables, e-signature collection, and on-brand styling.',
    examples: [
      'Generate a professional proposal from a CRM deal record in under a minute',
      'Include product pricing tables, scope-of-work sections, and terms automatically',
      'Collect e-signatures without leaving the platform',
      'Track proposal open events and follow up at exactly the right moment',
    ],
  },
  {
    id: 'sales_coaching',
    name: 'Sales Coaching & Playbooks',
    category: 'sales',
    summary: 'AI coaching, risk alerts, and playbooks that help every rep perform like your best rep.',
    detail:
      'The Sales Automation module surfaces deal risk alerts when a pipeline opportunity shows warning signs (no activity, stalled stage, approaching close date). Playbooks guide reps through the right sequence of actions for every deal type, and AI tips update in real time based on each deal\'s signals.',
    examples: [
      'Get a risk alert when a deal has been stagnant for more than 7 days',
      'Follow AI-recommended next-best-action for each open opportunity',
      'Build a playbook for your most common deal type and enforce it across the team',
      'Identify which reps need coaching before missed quotas, not after',
    ],
  },

  // ── Email & Outreach ───────────────────────────────────────────────────────
  {
    id: 'email_outreach',
    name: 'Email Campaigns & Sequences',
    category: 'marketing',
    summary: 'Outbound email campaigns and automated drip sequences built for B2B and B2C outreach.',
    detail:
      'Send one-time blast campaigns or multi-step drip sequences. Every email is sent through SendGrid with delivery tracking, open/click analytics, and unsubscribe management baked in. The Email Studio provides an AI-assisted editor for writing subject lines, body copy, and CTAs.',
    examples: [
      'Build a 5-step cold outreach sequence that pauses when a prospect replies',
      'Send a broadcast campaign to a segmented contact list with one click',
      'Use AI to A/B test subject lines and auto-promote the winner after 4 hours',
      'Track open rates, click-throughs, and reply rates per sequence step',
    ],
  },
  {
    id: 'sms_outreach',
    name: 'SMS Outreach',
    category: 'marketing',
    summary: 'Two-way SMS for outbound campaigns, follow-ups, and inbound lead response.',
    detail:
      'Powered by Twilio, SMS outreach integrates directly with the CRM so every text thread is logged against the contact record. Use SMS for appointment reminders, flash promotions, urgent follow-ups, and inbound auto-replies.',
    examples: [
      'Send an appointment reminder 24 hours and 1 hour before a booked meeting',
      'Trigger an SMS follow-up when a lead opens an email but does not click',
      'Auto-reply to inbound SMS leads with a qualifying question within 60 seconds',
      'Run a flash promotion campaign to a geographic segment of your contact list',
    ],
  },
  {
    id: 'social_media',
    name: 'Social Media Publishing',
    category: 'marketing',
    summary: 'Schedule and publish to every major platform from one content calendar.',
    detail:
      'Connect X/Twitter, LinkedIn, Instagram, Facebook, TikTok, YouTube, Pinterest, and Mastodon. The AI social specialists (13 available) write platform-native content for each channel. Posts can be scheduled individually or batched from the content calendar view.',
    examples: [
      'Draft and schedule a week of LinkedIn posts in 15 minutes with AI writing',
      'Repurpose a blog post into 5 different social formats for different platforms',
      'Monitor engagement across all connected accounts from a single dashboard',
      'Use the TikTok specialist to write hooks optimized for the For You page algorithm',
    ],
  },
  {
    id: 'forms',
    name: 'Forms & Lead Capture',
    category: 'marketing',
    summary: 'Embeddable and standalone forms that capture leads directly into the CRM.',
    detail:
      'Build forms with a drag-and-drop builder. Embed them on your website or share a standalone link. Every submission creates a lead record automatically in the CRM and triggers configurable notification emails and follow-up workflows.',
    examples: [
      'Build a contact form that creates a CRM lead and triggers a welcome email sequence',
      'Create a survey to qualify inbound prospects before a discovery call',
      'Embed a service-quote request form on your website homepage',
      'Set up event registration with automatic confirmation email on submission',
    ],
  },
  {
    id: 'workflows',
    name: 'Workflow Automation',
    category: 'ops',
    summary: 'Visual workflow builder for automating multi-step business processes without code.',
    detail:
      'Connect triggers (form submission, deal stage change, tag added, scheduled time) to sequences of actions (send email, update CRM field, create task, notify via SMS, assign to rep). Conditional logic branches handle "if/else" scenarios so the automation matches real business rules.',
    examples: [
      'Auto-assign new leads to reps based on territory or industry',
      'Move a deal to "At Risk" and alert the manager when no activity occurs for 5 days',
      'Send a re-engagement campaign 30 days after a prospect goes cold',
      'Trigger an invoice when a deal moves to Closed-Won',
    ],
  },
  {
    id: 'voice_ai',
    name: 'Voice AI (Outbound & Inbound)',
    category: 'ops',
    summary: 'AI-powered voice calling for outbound prospecting and inbound lead qualification.',
    detail:
      'Make and receive calls using AI voice agents built on ElevenLabs voices and Twilio infrastructure. Outbound call campaigns dial prospect lists, qualify leads, and log call outcomes directly to the CRM. Inbound calls are answered by a branded voice agent that books appointments and captures information.',
    examples: [
      'Run an AI-powered outbound call campaign to 200 leads while your team does other work',
      'Receive inbound calls with a custom voice agent that answers FAQs and books appointments',
      'Log every call transcript automatically to the contact record in the CRM',
      'Use ElevenLabs voice cloning to build a voice agent that sounds like your actual team',
    ],
  },
  {
    id: 'ab_testing',
    name: 'A/B Testing & Analytics',
    category: 'analytics',
    summary: 'Structured A/B experiments with statistical significance detection for campaigns, pages, and sequences.',
    detail:
      'Create split tests across email subject lines, landing page variants, and campaign messaging. The platform tracks impressions, clicks, and conversions, automatically detects a statistical winner, and shows confidence percentages. SERP tracking via Serper monitors keyword rankings over time.',
    examples: [
      'Run a subject line A/B test that auto-promotes the winner after a minimum sample size',
      'Compare two landing page variants by conversion rate across real visitor traffic',
      'Track keyword ranking changes after publishing a new blog post',
      'Attribute pipeline revenue to specific campaigns using multi-touch analytics',
    ],
  },
  {
    id: 'analytics_dashboard',
    name: 'Analytics & Performance Dashboard',
    category: 'analytics',
    summary: 'Cross-platform analytics that shows revenue, pipeline, engagement, and growth in one place.',
    detail:
      'The analytics dashboard aggregates data from CRM, email, social, website, and e-commerce into a unified view. The Growth Strategist AI specialist synthesizes cross-domain data into executive briefings and actionable recommendations on SEO, ad spend, demographics, and channel attribution.',
    examples: [
      'View pipeline revenue, close rate, and average deal size in a single dashboard',
      'See which marketing channels are driving the most qualified leads this month',
      'Get an AI-generated weekly growth briefing with specific action recommendations',
      'Track customer lifetime value trends by cohort and acquisition source',
    ],
  },

  // ── Content ────────────────────────────────────────────────────────────────
  {
    id: 'magic_studio',
    name: 'Magic Studio (Image Generation)',
    category: 'content',
    summary: 'AI image generation for ads, social posts, website graphics, and brand assets.',
    detail:
      'Generate images using fal.ai models directly inside the platform. The single-canvas Magic Studio interface supports text-to-image prompting, style references, and drag-and-drop refinement. Generated images are saved to the Media Library and can be used anywhere across the platform.',
    examples: [
      'Generate a hero image for a landing page that matches your brand color palette',
      'Create a set of social post graphics from a single product description',
      'Produce ad creative variants at different aspect ratios for different platforms',
      'Build a branded content template library your whole team can reuse',
    ],
  },
  {
    id: 'video_production',
    name: 'Video Production (AI Avatar)',
    category: 'content',
    summary: 'Produce AI avatar videos for marketing, sales pitches, and training content — no camera needed.',
    detail:
      'Powered by Hedra Character-3, the video engine turns a script into a talking-avatar video. Upload a custom avatar image or use stock characters. ElevenLabs voice cloning optionally adds a custom voice. Videos are stored in the Media Library and can be embedded on the website or shared directly.',
    examples: [
      'Create a 60-second product explainer video from a script in under 10 minutes',
      'Produce personalized video sales pitches featuring your own AI avatar clone',
      'Build an onboarding training video library without scheduling filming sessions',
      'Generate tutorial videos for every product feature using AI voice and avatar',
    ],
  },
  {
    id: 'music_generation',
    name: 'Music Generation',
    category: 'content',
    summary: 'AI-generated background music and jingles for videos, ads, and brand assets.',
    detail:
      'Generate royalty-free music tracks in any genre, mood, or duration directly inside the platform. Music is produced to match specific video lengths and can be layered under AI avatar videos in the production pipeline. All generated tracks are stored in the Media Library.',
    examples: [
      'Generate an upbeat 30-second jingle for a product demo video',
      'Produce ambient background music that matches the mood of a brand video',
      'Create a unique brand theme track that plays on your website homepage',
      'Generate music for every social video in your content calendar in one session',
    ],
  },
  {
    id: 'copywriting',
    name: 'AI Copywriting (Content Engine)',
    category: 'content',
    summary: 'AI copywriter trained on your brand voice for blog posts, ad copy, email bodies, and social content.',
    detail:
      'The Copywriter specialist produces long-form blog posts, email sequences, ad copy, social captions, and landing page copy. Brand DNA is baked into the agent at seed time so every output reflects the company\'s voice, tone, and positioning automatically — no manual style guides to paste in.',
    examples: [
      'Draft a 1,500-word SEO blog post from a keyword and a one-sentence brief',
      'Write a 5-email welcome sequence for new trial sign-ups in brand voice',
      'Generate 10 Facebook ad copy variants for a new product launch',
      'Produce a month of social media captions optimized per platform in one session',
    ],
  },
  {
    id: 'media_library',
    name: 'Media Library',
    category: 'content',
    summary: 'Centralized asset management for all images, videos, audio, and documents generated on the platform.',
    detail:
      'Every asset created in Magic Studio, the Video Editor, or the Music Generator is automatically saved to the Media Library. Assets are searchable by type, date, and tags. The library integrates with the website builder, social composer, and email editor so you can reuse assets anywhere without re-uploading.',
    examples: [
      'Find and reuse any image, video, or audio file from one searchable library',
      'Insert a previously generated avatar video directly into a landing page',
      'Organize brand assets into labeled collections for team access',
      'Download assets in the correct format for each platform from one place',
    ],
  },
  {
    id: 'brand_dna',
    name: 'Brand DNA & Brand Kit',
    category: 'content',
    summary: 'Define your brand once; every AI agent uses it automatically in every output.',
    detail:
      'Brand DNA captures the company\'s voice, tone, target audience, value propositions, and positioning. It is baked into every AI agent\'s Golden Master at seed time — no agent reads Brand DNA at runtime, so there is zero overhead and zero drift. Brand Kit extends this to visual identity: primary colors, fonts, logo, and usage guidelines.',
    examples: [
      'Set your brand voice once and have every email, post, and blog match it automatically',
      'Lock brand colors and fonts so all generated visuals stay on-brand without manual correction',
      'Update a brand value proposition and reseed all agents to propagate the change instantly',
      'Ensure a new AI specialist automatically writes in your voice with no additional prompting',
    ],
  },

  // ── Website ────────────────────────────────────────────────────────────────
  {
    id: 'website_builder',
    name: 'Website Builder',
    category: 'website',
    summary: 'Build a professional website and blog without a developer using AI-assisted page creation.',
    detail:
      'The page builder generates industry-specific layouts and populates copy using Brand DNA. Pages are hosted on the platform domain or mapped to a custom domain. Blog posts can be drafted by the AI Copywriter specialist and published directly to the blog. PageSpeed analysis surfaces performance issues for immediate fix.',
    examples: [
      'Launch a professional homepage with AI-generated copy and layout in under an hour',
      'Publish a blog post optimized for a target keyword without leaving the platform',
      'Build a dedicated landing page for each service or product offering',
      'Analyze page load speed and get specific optimization recommendations',
    ],
  },
  {
    id: 'seo_suite',
    name: 'SEO Suite',
    category: 'website',
    summary: 'Keyword research, content gap analysis, SERP tracking, and on-page optimization in one tool.',
    detail:
      'DataForSEO integration provides keyword volume, competition scores, and related term clusters. The Growth Strategist AI synthesizes these into a keyword content plan. SERP tracking via Serper monitors ranking changes after publishing. On-page SEO recommendations surface on every page and blog post before publishing.',
    examples: [
      'Find 50 low-competition keywords your target audience is actively searching',
      'Get an AI-generated content calendar built around a keyword cluster strategy',
      'Track your top 20 target keywords for ranking position changes weekly',
      'See an on-page SEO checklist for every page before you publish it',
    ],
  },

  // ── Commerce ───────────────────────────────────────────────────────────────
  {
    id: 'ecommerce_storefront',
    name: 'E-Commerce Storefront',
    category: 'commerce',
    summary: 'Add an online store to your website that accepts Stripe and PayPal payments without a separate platform.',
    detail:
      'The storefront module adds a browsable product and service catalog to the website, complete with checkout, payment processing (Stripe + PayPal), and inventory tracking. No Shopify or WooCommerce subscription needed. Integrates with the CRM so every purchase creates or updates a contact record.',
    examples: [
      'Sell physical products, digital downloads, or services directly from your website',
      'Set up discount codes and promotional pricing tied to specific campaigns',
      'Track inventory levels and get low-stock alerts without a separate system',
      'Connect purchases to CRM contacts for post-purchase follow-up sequences',
    ],
  },
  {
    id: 'invoicing',
    name: 'Invoicing & Billing',
    category: 'commerce',
    summary: 'Create and send professional invoices and collect payments directly from the CRM.',
    detail:
      'Invoices are generated from deal records with line items pulled from the product catalog. Payment links are sent via email or SMS. Stripe processes the payment and the CRM record is automatically updated to Paid. Recurring billing schedules are supported for retainer-based services.',
    examples: [
      'Generate and send an invoice when a deal moves to Closed-Won automatically',
      'Set up monthly recurring invoices for retainer clients without manual work',
      'Send a payment reminder SMS 3 days before an invoice due date',
      'Track overdue invoices and outstanding AR in the CRM dashboard',
    ],
  },

  // ── Ops / Platform ─────────────────────────────────────────────────────────
  {
    id: 'ai_agent_swarm',
    name: 'AI Agent Swarm',
    category: 'ops',
    summary: 'A coordinated team of 100+ AI specialists across 10 departments that execute complex multi-step tasks.',
    detail:
      'Jasper orchestrates 10 department managers (Content, Sales, Marketing, Commerce, Intelligence, Builder, Trust, Architect, Operations, and Master Orchestrator), each of which directs a team of specialists. Every mission is tracked in Mission Control with step-by-step visibility and human approval gates for any action before it fires.',
    examples: [
      'Ask Jasper to "launch a new product campaign" and watch 8 specialists execute in parallel',
      'Approve, edit, or scrap any individual step in a multi-agent mission before it runs',
      'Review every AI-produced output in Mission Control before it goes live',
      'Run 100 AI agents concurrently on different client tasks without additional cost',
    ],
  },
  {
    id: 'mission_control',
    name: 'Mission Control',
    category: 'ops',
    summary: 'Full visibility into every AI agent mission — plan, review, approve, and rerun any step.',
    detail:
      'Every mission Jasper assigns to the agent swarm is visible in Mission Control. The operator reviews the proposed plan, edits any step\'s arguments or scope, approves the plan, and then monitors execution in real time. Failed steps can be retried or manually edited. Downstream steps flag themselves when upstream outputs change.',
    examples: [
      'See exactly what every AI agent is working on across all active missions',
      'Edit a step\'s instructions mid-mission before it executes',
      'Scrap a mission and start over without losing other active work',
      'Grade specialist outputs to trigger the Prompt Engineer improvement loop',
    ],
  },
  {
    id: 'training_lab',
    name: 'Training Lab',
    category: 'ops',
    summary: 'Grade AI agent outputs and surgically improve any specialist\'s behavior through a human-gated feedback loop.',
    detail:
      'When a specialist produces subpar output, the operator grades it in Mission Control. That grade creates a TrainingFeedback record, the Prompt Engineer specialist produces a surgical edit proposal for the affected section of the Golden Master, and the operator approves or rewrites before the new version deploys. No agent edits itself; every change requires a human grade.',
    examples: [
      'Grade a copywriter output as "too generic" and get a before/after prompt diff for approval',
      'Roll back a specialist to a previous prompt version in one click if an edit underperforms',
      'Track the full version history for every agent prompt with timestamps and change notes',
      'Prove that a prompt edit changed actual output behavior before deploying to production',
    ],
  },
  {
    id: 'integrations',
    name: 'Integrations Catalog',
    category: 'ops',
    summary: 'Connect Stripe, PayPal, Zoom, Google Workspace, Microsoft 365, Twilio, and every major social platform.',
    detail:
      'The integrations hub connects SalesVelocity to: payment processors (Stripe, PayPal), communication tools (Zoom), productivity suites (Google Workspace, Microsoft 365), email delivery (SendGrid), SMS (Twilio), AI providers (OpenRouter, OpenAI, Anthropic, fal.ai, ElevenLabs, Hedra), social platforms (X/Twitter, LinkedIn, Instagram, Facebook, TikTok, YouTube, Pinterest, Mastodon), and SEO data (DataForSEO, Serper, Clearbit). BYOK means you own your API keys and pay raw market rates.',
    examples: [
      'Connect Zoom so Jasper can schedule and send meeting links without leaving the platform',
      'Link SendGrid to send up to 5,000 emails per day through your own account',
      'Connect your X/Twitter account and post or monitor DMs from the Social Hub',
      'Use OpenRouter to swap AI models (GPT-4o, Claude, Gemini) without rewriting prompts',
    ],
  },
];

// ============================================================================
// INDUSTRIES
// Sources:
//   - INDUSTRY_FEATURE_DEFAULTS in feature-modules.ts (which module ids are recommended)
//   - IndustryTemplate objects in persona/templates/* (tactical intelligence per vertical)
//   - INDUSTRIES dropdown in settings/organization/page.tsx (19 platform-level labels)
//   - Contract requirement: 20 US SMB verticals, equal treatment, no single showcase
// ============================================================================

export const KNOWLEDGE_BASE_INDUSTRIES: KnowledgeBaseIndustry[] = [
  {
    key: 'automotive',
    label: 'Automotive',
    leadFeatures: ['crm', 'lead_scoring', 'email_outreach', 'forms', 'social_media', 'video_production'],
    talkingPoints: [
      'Auto dealerships lose 60-80% of internet leads because response time exceeds 1 hour — your AI chat agent replies within seconds on any channel.',
      'The CRM tracks every prospect from first inquiry through test drive through closed deal, with automated follow-up sequences for shoppers who ghost.',
      'Video production lets you create walkaround videos and AI-narrated feature highlights for inventory without a production team.',
      'Social media specialists can post inventory updates, new arrivals, and seasonal promotions across Facebook, Instagram, and TikTok on a daily schedule.',
      'SMS outreach achieves 90%+ open rates — ideal for appointment reminders and same-day flash promotions on slow inventory.',
    ],
  },
  {
    key: 'agency_consulting',
    label: 'Agency / Consulting',
    leadFeatures: ['ai_agent_swarm', 'crm', 'proposals_docs', 'email_outreach', 'social_media', 'analytics_dashboard'],
    talkingPoints: [
      'Run AI agent missions for client deliverables — content calendars, competitive research, email sequences — while your team focuses on strategy.',
      'The proposal builder pulls CRM deal data into branded proposals with scope tables and e-signatures, cutting proposal creation time from hours to minutes.',
      'Training Lab lets you tune every AI specialist to match a specific client\'s brand voice without reseeding the entire system.',
      'The full analytics dashboard gives you cross-client reporting with pipeline, revenue, and campaign performance in one view.',
      'Brand DNA + Brand Kit means every piece of client content is on-brand from the first draft, eliminating revision cycles for voice corrections.',
    ],
  },
  {
    key: 'b2b_saas',
    label: 'B2B SaaS',
    leadFeatures: ['crm', 'email_outreach', 'lead_scoring', 'sales_coaching', 'ab_testing', 'analytics_dashboard'],
    talkingPoints: [
      'The built-in CRM replaces HubSpot or Salesforce — contacts, deals, sequences, and pipeline are all native with no integration overhead.',
      'Lead scoring surfaces trial-to-paid conversion signals so sales can prioritize the 10% of trials most likely to convert rather than working the full list.',
      'A/B testing with statistical significance detection runs on email subject lines, landing page variants, and onboarding sequences without a separate tool.',
      'AI sales coaching surfaces deal risk alerts when a trial is stagnant, so CSMs intervene before churn rather than after.',
      'The Growth Strategist AI synthesizes SERP, social, pipeline, and product data into a weekly strategic briefing so leadership stays focused on the right levers.',
    ],
  },
  {
    key: 'beauty_spa',
    label: 'Beauty / Spa',
    leadFeatures: ['crm', 'email_outreach', 'social_media', 'forms', 'sms_outreach', 'magic_studio'],
    talkingPoints: [
      'AI-generated Instagram and TikTok content showcases treatments, before/afters, and promotions — keeping your feed active without pulling a stylist away from a client.',
      'SMS appointment reminders cut no-show rates dramatically; 24-hour and 1-hour automated reminders go out without staff intervention.',
      'Lead capture forms on your website or social bio link feed new client inquiries directly into the CRM with an automated "book now" follow-up sequence.',
      'Magic Studio generates on-brand promotional graphics for seasonal offers, new services, and referral programs in seconds.',
      'Email sequences handle loyalty campaigns, re-engagement for clients who haven\'t booked in 60+ days, and birthday promotions automatically.',
    ],
  },
  {
    key: 'construction',
    label: 'Construction',
    leadFeatures: ['crm', 'proposals_docs', 'email_outreach', 'forms', 'website_builder', 'workflows'],
    talkingPoints: [
      'The proposal builder generates professional project proposals with scope, timeline, and payment schedule tables — eliminating hand-typed Word documents.',
      'Lead capture forms on a mobile-friendly website collect RFQ submissions even when your crew is in the field and unavailable to answer calls.',
      'Workflow automation routes inbound leads to the right estimator based on project type and geography, ensuring no bid opportunity falls through the cracks.',
      'The CRM tracks every bid from initial contact through awarded contract, with automated follow-up sequences for quotes that have not received a response.',
      'Email campaigns let you stay in front of past clients with seasonal maintenance reminders, referral incentives, and project showcases.',
    ],
  },
  {
    key: 'ecommerce_retail',
    label: 'E-Commerce / Retail',
    leadFeatures: ['ecommerce_storefront', 'email_outreach', 'social_media', 'ab_testing', 'magic_studio', 'workflows'],
    talkingPoints: [
      'The built-in storefront handles catalog, checkout, and Stripe/PayPal payments without a Shopify or WooCommerce subscription.',
      'A/B testing runs on product page layouts, promotional email subject lines, and ad creative variants — with automatic winner promotion at statistical significance.',
      'Abandoned-cart workflows trigger a timed SMS and email sequence that recovers revenue without manual follow-up.',
      'Magic Studio generates product photography edits, lifestyle ad creative, and sale announcement graphics at scale.',
      'Social media specialists post new arrivals, flash sales, and UGC reposts across Instagram, TikTok, and Pinterest on a daily automated schedule.',
    ],
  },
  {
    key: 'education',
    label: 'Education',
    leadFeatures: ['crm', 'email_outreach', 'forms', 'social_media', 'website_builder', 'workflows'],
    talkingPoints: [
      'Enrollment inquiry forms feed directly into the CRM, triggering an automated nurture sequence that guides prospective students from inquiry to application.',
      'Email campaigns manage the full student lifecycle: prospecting, enrollment reminders, orientation, and alumni re-engagement.',
      'The website builder creates program-specific landing pages with SEO optimization, so each course or degree program ranks for its own search terms.',
      'Workflow automation handles scheduling, interview invitations, and waitlist notifications without manual staff coordination.',
      'Social media publishing keeps the institution active on LinkedIn, Instagram, and YouTube for brand-building and student recruitment simultaneously.',
    ],
  },
  {
    key: 'financial_services',
    label: 'Financial Services',
    leadFeatures: ['crm', 'email_outreach', 'proposals_docs', 'lead_scoring', 'sales_coaching', 'website_builder'],
    talkingPoints: [
      'The CRM tracks prospects by AUM potential, life event triggers, and engagement history — so advisors focus on the highest-value relationships first.',
      'AI lead scoring surfaces prospects showing "high-intent" signals (opened 3+ emails, visited pricing page, asked about fees) so advisors call at exactly the right moment.',
      'Proposal templates for financial plans, investment strategies, and insurance quotes are pre-built and pull CRM data automatically.',
      'Drip email sequences nurture prospects over long sales cycles (3-12 months) without requiring advisors to manually remember every follow-up.',
      'The website builder creates compliant landing pages with SEO content targeting "fiduciary advisor," "fee-only financial planner," and similar high-intent terms.',
    ],
  },
  {
    key: 'fitness_wellness',
    label: 'Fitness / Wellness',
    leadFeatures: ['crm', 'email_outreach', 'sms_outreach', 'social_media', 'forms', 'video_production'],
    talkingPoints: [
      'AI-generated Instagram Reels, TikTok workouts, and YouTube tutorials keep your content calendar full without filming every day.',
      'SMS class reminders and rebook campaigns have open rates above 90%, making them the highest-ROI channel for reducing membership churn.',
      'Lead capture forms for free trial classes and intro offers feed the CRM and trigger automated onboarding sequences that convert trials to members.',
      'Email sequences handle the full member lifecycle: onboarding, milestone celebrations, referral asks, and win-back campaigns for cancellations.',
      'Video production lets you create transformation testimonials, class previews, and trainer spotlight content using AI avatars when real footage is unavailable.',
    ],
  },
  {
    key: 'healthcare_dental',
    label: 'Healthcare / Dental',
    leadFeatures: ['crm', 'forms', 'email_outreach', 'sms_outreach', 'website_builder', 'social_media'],
    talkingPoints: [
      'Appointment request forms on your website create CRM leads and trigger automated confirmation, reminder, and post-visit follow-up sequences.',
      'SMS reminders 24 hours and 2 hours before appointments reduce no-shows by up to 40% without front-desk phone calls.',
      'The website builder creates patient-facing service pages optimized for local search terms like "dentist near me" and "same-day dental appointment."',
      'Email campaigns handle new patient promotions, recall reminders, and post-procedure care instructions on automated schedules.',
      'The AI conversation agent answers after-hours inquiries about services, insurance, and booking — capturing leads that would otherwise call a competitor.',
    ],
  },
  {
    key: 'home_services',
    label: 'Home Services',
    leadFeatures: ['crm', 'forms', 'email_outreach', 'sms_outreach', 'workflows', 'website_builder'],
    talkingPoints: [
      'Inbound job request forms route leads to the right technician automatically based on service type and ZIP code — no dispatcher required.',
      'Automated quote follow-up sequences contact homeowners 48 hours, 1 week, and 1 month after an estimate if they have not responded.',
      'The CRM tracks every customer\'s service history, equipment age, and last contact date — making annual maintenance outreach precise and revenue-predictable.',
      'SMS is the primary channel for appointment confirmations, technician ETA alerts, and same-day scheduling fills for cancellations.',
      'The website builder creates local SEO-optimized service pages per ZIP code or neighborhood, driving organic traffic for high-value terms like "HVAC repair [city]."',
    ],
  },
  {
    key: 'insurance',
    label: 'Insurance',
    leadFeatures: ['crm', 'lead_scoring', 'email_outreach', 'forms', 'proposals_docs', 'workflows'],
    talkingPoints: [
      'Lead scoring surfaces prospects at "life event" moments (new home, new baby, business formation) when insurance intent is highest.',
      'Multi-step email sequences nurture prospects through long comparison and decision cycles without agents manually tracking each follow-up.',
      'Quote forms on your website capture prospect information and feed the CRM, triggering an immediate auto-response that positions your agency ahead of comparison competitors.',
      'Workflow automation handles policy renewal reminders, cross-sell triggers for policyholders who add a vehicle or home, and referral request sequences.',
      'The proposal builder formats policy summaries, coverage comparisons, and renewal documents professionally without manual document creation.',
    ],
  },
  {
    key: 'legal',
    label: 'Legal',
    leadFeatures: ['crm', 'forms', 'email_outreach', 'proposals_docs', 'website_builder', 'workflows'],
    talkingPoints: [
      'Intake forms route prospective clients to the correct practice area and trigger an automated response within seconds — critical in competitive practice areas like personal injury.',
      'The CRM tracks every prospect from initial inquiry through consultation to retained client, with automated follow-up sequences for unreached prospects.',
      'Retainer agreement templates are pre-built in the proposal module with e-signature collection, eliminating document back-and-forth.',
      'Email sequences manage the full client lifecycle: intake follow-up, case update notifications, referral requests from closed cases, and re-engagement for past clients.',
      'The website builder creates practice-area landing pages optimized for local search terms like "personal injury attorney [city]" and "business litigation lawyer near me."',
    ],
  },
  {
    key: 'manufacturing',
    label: 'Manufacturing',
    leadFeatures: ['crm', 'proposals_docs', 'email_outreach', 'lead_scoring', 'sales_coaching', 'workflows'],
    talkingPoints: [
      'The CRM manages complex B2B sales cycles with multiple stakeholders per account, tracking every contact, decision maker, and influencer across a deal.',
      'Custom RFQ and specifications forms on the website capture technical requirements and create qualified CRM leads with full specifications attached.',
      'Proposal templates for custom manufacturing quotes include spec tables, lead time estimates, and MOQ pricing that pull from the CRM deal record.',
      'Lead scoring identifies distributor and OEM prospects showing purchasing signals — trade show follow-ups, repeat catalog downloads, quote requests.',
      'Workflow automation handles NDA routing, sample request fulfillment notifications, and re-order reminder sequences for contract customers.',
    ],
  },
  {
    key: 'nonprofit',
    label: 'Non-Profit',
    leadFeatures: ['email_outreach', 'social_media', 'forms', 'website_builder', 'workflows', 'crm'],
    talkingPoints: [
      'Donor management in the CRM tracks giving history, communication preferences, and campaign attribution so every ask is informed and timely.',
      'Email campaigns for annual fund, major gift cultivation, and event invitations are automated and personalized based on donor segment.',
      'Donation forms on the website and social media links capture one-time and recurring gifts with automatic acknowledgment emails.',
      'Social media publishing keeps supporters engaged between campaigns with impact stories, volunteer spotlights, and program updates.',
      'Workflow automation handles volunteer coordination, event registration confirmations, and post-donation thank-you sequences without staff overhead.',
    ],
  },
  {
    key: 'professional_services',
    label: 'Professional Services',
    leadFeatures: ['crm', 'email_outreach', 'proposals_docs', 'social_media', 'lead_scoring', 'workflows'],
    talkingPoints: [
      'The CRM tracks prospects and clients across long relationship-based sales cycles, with full contact and deal history visible in one place.',
      'AI-generated proposals pulled from CRM deal data eliminate the hours spent writing custom scopes of work for every new engagement.',
      'LinkedIn content published by the AI specialist builds thought leadership consistently without consuming billable time from your professionals.',
      'Email sequences handle initial outreach, proposal follow-up, onboarding, and 90-day check-ins on autopilot.',
      'Lead scoring identifies high-fit prospects based on company size, industry, engagement behavior, and prior interaction history.',
    ],
  },
  {
    key: 'promotional_branded_merchandise',
    label: 'Promotional / Branded Merchandise',
    leadFeatures: ['crm', 'ecommerce_storefront', 'email_outreach', 'magic_studio', 'social_media', 'proposals_docs'],
    talkingPoints: [
      'The storefront module supports a branded merchandise catalog with Stripe checkout, eliminating the need for a separate Shopify or BigCommerce account.',
      'Magic Studio generates mockups, promotional graphics, and lifestyle shots of branded products at scale — no photographer or design agency required.',
      'The CRM manages corporate account relationships and tracks event-driven orders (conferences, employee programs, seasonal campaigns) per client.',
      'Email campaigns handle pre-event urgency sequences, re-order reminders for repeat clients, and new-catalog announcement campaigns.',
      'Quote and order forms with custom specification fields capture complex order requirements (sizes, colors, quantities, decoration methods) directly into the CRM.',
    ],
  },
  {
    key: 'real_estate',
    label: 'Real Estate',
    leadFeatures: ['crm', 'email_outreach', 'social_media', 'video_production', 'forms', 'website_builder'],
    talkingPoints: [
      'The AI conversation agent responds to listing inquiries within seconds, qualifies buyer or seller intent, and books tour appointments — even at 11pm.',
      'Video production creates property walkthrough videos and neighborhood highlight reels using AI avatars without a videographer on every listing.',
      'Email sequences nurture buyer and seller leads through the 90-180 day decision cycle with market reports, new listing alerts, and comparison guides.',
      'Social media specialists post new listings, price reductions, and just-sold announcements daily across Instagram, Facebook, and LinkedIn.',
      'The CRM tracks every prospect from first inquiry through closing with deal-stage automations that ensure no lead falls through the cracks during a busy season.',
    ],
  },
  {
    key: 'restaurants_hospitality',
    label: 'Restaurants / Hospitality',
    leadFeatures: ['social_media', 'email_outreach', 'sms_outreach', 'forms', 'ecommerce_storefront', 'magic_studio'],
    talkingPoints: [
      'Social media specialists post daily specials, behind-the-scenes content, and event announcements across Instagram, Facebook, and TikTok on a scheduled cadence.',
      'SMS campaigns for flash promotions, happy hour reminders, and reservation confirmations achieve 90%+ open rates — far above email for time-sensitive offers.',
      'Magic Studio generates food photography edits, seasonal menu graphics, and event promotional images without a professional photographer.',
      'Email campaigns manage loyalty program communications, birthday offers, event invitations, and off-season re-engagement for past guests.',
      'The storefront module supports gift card sales and private dining package purchases directly from the website.',
    ],
  },
  {
    key: 'trades',
    label: 'Trades (Electrical / Plumbing / HVAC)',
    leadFeatures: ['crm', 'forms', 'sms_outreach', 'workflows', 'website_builder', 'email_outreach'],
    talkingPoints: [
      'Job request forms on a mobile-friendly website route service calls automatically to the on-call technician — no call center or dispatcher overhead.',
      'SMS appointment confirmations and technician ETA updates are sent automatically, reducing "where is the tech?" calls by over 80%.',
      'The CRM stores equipment service history per address so technicians arrive with full context and can surface timely upsell opportunities on aging systems.',
      'Annual maintenance reminder sequences go out automatically based on last service date — generating predictable recurring revenue without manual prospecting.',
      'The website builder creates ZIP-code-targeted service pages that rank for high-value local searches like "emergency plumber [city]" and "AC repair near me."',
    ],
  },
];

// ============================================================================
// RE-EXPORT PRICING from config for seed script convenience
// ============================================================================

export { PRICING };
