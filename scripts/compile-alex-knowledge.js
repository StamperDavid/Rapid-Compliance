#!/usr/bin/env node
/**
 * Alex Knowledge Compiler
 *
 * Reads from authoritative sources that are already maintained as part of
 * normal development, and compiles a sales-focused knowledge base for Alex
 * (the AI Chat Sales Agent).
 *
 * Sources:
 *   1. AGENT_REGISTRY.json  → Platform capabilities (what the 52 agents DO)
 *   2. category-template-map → Industries we serve and who benefits
 *   3. single_source_of_truth.md → Platform stats, tech stack, scale
 *
 * Output:
 *   - Writes compiled knowledge to scripts/alex-knowledge.json
 *   - Optionally uploads to Firestore Golden Master (--deploy flag)
 *
 * Usage:
 *   node scripts/compile-alex-knowledge.js           # compile only
 *   node scripts/compile-alex-knowledge.js --deploy   # compile + push to Firestore
 *
 * This script should run on every deploy so Alex always has current knowledge.
 * It is ALSO safe to run manually at any time.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Read AGENT_REGISTRY.json
// ---------------------------------------------------------------------------
function readAgentRegistry() {
  const raw = fs.readFileSync(path.join(ROOT, 'AGENT_REGISTRY.json'), 'utf-8');
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// 2. Transform agent capabilities into sales-friendly descriptions
//    Alex doesn't need file paths or LOC counts — he needs to know WHAT
//    the system does so he can sell it.
// ---------------------------------------------------------------------------

/** Map manager IDs to customer-facing domain names and benefit statements */
const DOMAIN_MAP = {
  INTELLIGENCE_MANAGER: {
    domain: 'Market Intelligence',
    headline: 'Know your market before your competitors do',
    benefit: 'AI-powered competitive research, tech stack detection, sentiment monitoring, and trend analysis — running 24/7 so you always know what\'s happening in your industry.',
  },
  MARKETING_MANAGER: {
    domain: 'Social Media & Marketing',
    headline: 'Every platform, one AI brain',
    benefit: 'AI agents for TikTok, Twitter/X, Facebook, LinkedIn, and SEO — each a specialist in that platform\'s algorithm. They create content, optimize for engagement, and grow your audience automatically.',
  },
  BUILDER_MANAGER: {
    domain: 'Website Building & Design',
    headline: 'Websites that build themselves',
    benefit: 'AI-designed websites, landing pages, and funnels with automatic analytics pixel injection (GA4, Meta Pixel, Hotjar). From blank canvas to live site — the AI handles layout, design, and deployment.',
  },
  ARCHITECT_MANAGER: {
    domain: 'Brand & Funnel Architecture',
    headline: 'Strategy that converts',
    benefit: 'AI-powered brand identity design, conversion funnel architecture, and persuasive copywriting. Uses proven frameworks (PAS, AIDA, StoryBrand) to turn visitors into customers.',
  },
  COMMERCE_MANAGER: {
    domain: 'E-Commerce & Payments',
    headline: 'Sell anything, get paid instantly',
    benefit: 'Full e-commerce with Stripe integration — product catalogs, dynamic pricing, inventory management, and checkout. AI handles the entire product-to-payment flow.',
  },
  OUTREACH_MANAGER: {
    domain: 'Email & SMS Outreach',
    headline: 'Reach every lead, every time',
    benefit: 'Multi-step email and SMS sequences with automatic channel escalation, DNC compliance, and frequency throttling. AI writes the messages and manages the follow-ups.',
  },
  CONTENT_MANAGER: {
    domain: 'Content Production',
    headline: 'Content on autopilot',
    benefit: 'AI copywriter, content calendar coordinator, and video specialist working together. Blog posts, social content, video scripts, and storyboards — produced and scheduled automatically.',
  },
  REVENUE_DIRECTOR: {
    domain: 'Sales Pipeline & Revenue',
    headline: 'Leads that close themselves',
    benefit: 'AI lead qualification (BANT scoring), personalized outreach, smart discount nudges, deal closing, and objection handling. A full sales team that never sleeps.',
  },
  REPUTATION_MANAGER: {
    domain: 'Reputation & Reviews',
    headline: 'Protect and grow your reputation',
    benefit: 'AI-powered review responses, Google Business Profile optimization, case study creation, and brand health monitoring across Google, Yelp, Facebook, Trustpilot, and G2.',
  },
};

/** Map standalone agents to sales-friendly descriptions */
const STANDALONE_MAP = {
  VOICE_AGENT_HANDLER: {
    feature: 'Voice AI',
    headline: 'AI phone calls that sound human',
    benefit: 'Two modes — Prospector (qualifies leads by phone) and Closer (negotiates deals with warm transfer to your team). Handles inbound and outbound calls 24/7.',
  },
  AUTONOMOUS_POSTING_AGENT: {
    feature: 'Autonomous Social Posting',
    headline: 'Set it and forget it',
    benefit: 'AI generates and posts content to LinkedIn and Twitter/X on a schedule you set. Queue management, optimal timing, and built-in analytics.',
  },
  JASPER: {
    feature: 'AI Business Assistant (Jasper)',
    headline: 'Your AI chief of staff',
    benefit: 'A conversational AI assistant that commands the entire 52-agent swarm. Tell Jasper what you need in plain English — it delegates to the right agents and delivers results.',
  },
  AI_CHAT_SALES_AGENT: null, // This IS Alex — skip self-reference
  CHAT_SESSION_SERVICE: null, // Infrastructure, not customer-facing
  GROWTH_STRATEGIST: {
    feature: 'AI Growth Strategist',
    headline: 'A Chief Growth Officer that never clocks out',
    benefit: 'Reviews your entire business — traffic, SEO, revenue, marketing, social, email, conversions — and produces strategic growth directives. Like having a CMO and COO in one AI.',
  },
};

function compileCapabilities(registry) {
  const capabilities = [];

  // Compile manager domains
  for (const [managerId, managerData] of Object.entries(registry.managers || {})) {
    const mapping = DOMAIN_MAP[managerId];
    if (!mapping) continue;

    // Gather specialist capabilities (user-friendly names only)
    const specialistNames = (managerData.specialists || []).map(id => {
      const spec = registry.specialists?.[id];
      if (!spec) return null;
      // Convert capabilities array to readable features
      return {
        name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        capabilities: (spec.capabilities || []).map(c =>
          c.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
        ),
      };
    }).filter(Boolean);

    capabilities.push({
      type: 'domain',
      domain: mapping.domain,
      headline: mapping.headline,
      benefit: mapping.benefit,
      agentCount: specialistNames.length + 1, // manager + specialists
      specialists: specialistNames,
    });
  }

  // Compile standalone agents
  for (const [agentId, agentData] of Object.entries(registry.standaloneAgents || {})) {
    const mapping = STANDALONE_MAP[agentId];
    if (!mapping) continue; // null = skip

    capabilities.push({
      type: 'standalone',
      feature: mapping.feature,
      headline: mapping.headline,
      benefit: mapping.benefit,
    });
  }

  return capabilities;
}

// ---------------------------------------------------------------------------
// 3. Compile industries served from onboarding categories
//    Alex needs to know WHO benefits, not template implementation details.
// ---------------------------------------------------------------------------

const INDUSTRY_BENEFITS = {
  real_estate: {
    name: 'Real Estate & Property',
    examples: 'Residential agents, commercial brokers, property managers, Airbnb hosts, mortgage lenders, title companies',
    pitch: 'Automate lead qualification, schedule viewings, nurture buyers/sellers, and manage listings — all while your AI handles follow-ups 24/7.',
  },
  design_construction: {
    name: 'Design & Construction',
    examples: 'Home stagers, interior designers, architects, construction firms',
    pitch: 'Showcase your portfolio, book consultations, and demonstrate your expertise with AI-generated content and automated outreach.',
  },
  healthcare_medical: {
    name: 'Healthcare & Medical',
    examples: 'Dental practices, plastic surgeons, med spas, therapists, chiropractors, veterinarians',
    pitch: 'Fill your appointment book, reduce no-shows, and build patient trust with HIPAA-conscious AI communication.',
  },
  fitness_wellness: {
    name: 'Fitness & Wellness',
    examples: 'Gyms, CrossFit boxes, yoga studios, personal trainers, nutrition coaches',
    pitch: 'Sign up new members, retain existing ones, and keep your community engaged with AI-driven campaigns and automated class reminders.',
  },
  home_services: {
    name: 'Home Services',
    examples: 'Solar installers, HVAC, roofers, plumbers, electricians, landscapers, pest control, house cleaners, pool companies, home security',
    pitch: 'Book more jobs, follow up on every lead, and build a reputation that dominates your local market — all on autopilot.',
  },
  technology_saas: {
    name: 'Technology & SaaS',
    examples: 'SaaS companies, cybersecurity firms, fintech, biotech, managed IT/MSPs, edtech platforms',
    pitch: 'Qualify leads with BANT scoring, automate demo booking, reduce churn with proactive engagement, and scale your pipeline.',
  },
  ecommerce_retail: {
    name: 'E-commerce & Retail',
    examples: 'Online stores, D2C brands, retail businesses',
    pitch: 'Recover abandoned carts, personalize product recommendations, and run marketing campaigns that drive repeat purchases.',
  },
  marketing_agencies: {
    name: 'Marketing & Agencies',
    examples: 'Digital marketing agencies, creative studios, PR firms',
    pitch: 'White-label the entire platform for your clients. Deliver AI-powered results at scale while multiplying your revenue per client.',
  },
  legal_services: {
    name: 'Legal Services',
    examples: 'Personal injury attorneys, family law practices',
    pitch: 'Qualify case leads, schedule consultations, and build trust — with AI that understands the sensitivity of legal matters.',
  },
  financial_services: {
    name: 'Financial Services',
    examples: 'Accountants, CPAs, financial planners, insurance agents',
    pitch: 'Generate qualified leads, automate client onboarding, and maintain trust through professional AI communication.',
  },
  business_services: {
    name: 'Business Services',
    examples: 'Business coaches, recruiters, HR consultants, logistics and freight companies',
    pitch: 'Fill your pipeline with qualified prospects, automate outreach, and demonstrate ROI to every client.',
  },
  hospitality_food: {
    name: 'Hospitality & Food',
    examples: 'Restaurants, travel agencies, event planners',
    pitch: 'Fill tables, book events, and manage reservations — with AI that upsells experiences and keeps guests coming back.',
  },
  nonprofit: {
    name: 'Nonprofit & Charity',
    examples: 'Charitable organizations, NGOs, community groups',
    pitch: 'Engage donors, share impact stories, recruit volunteers, and run fundraising campaigns — all with AI that amplifies your mission.',
  },
  automotive: {
    name: 'Automotive',
    examples: 'Car dealerships, auto repair shops, vehicle sales',
    pitch: 'Schedule test drives, qualify buyers, and automate service reminders with AI that keeps your lots moving.',
  },
  social_media: {
    name: 'Social Media & Influencers',
    examples: 'Content creators, streamers, digital personalities',
    pitch: 'Grow your audience, automate content scheduling, and convert followers into paying customers with AI-powered engagement.',
  },
};

function compileIndustries() {
  return Object.values(INDUSTRY_BENEFITS);
}

// ---------------------------------------------------------------------------
// 4. Compile platform stats from SSoT (parse key numbers)
// ---------------------------------------------------------------------------
function compilePlatformStats() {
  // These are derived from the SSoT and registry — updated each session
  const registry = readAgentRegistry();
  return {
    totalAgents: registry.totalAgents || 52,
    swarmAgents: registry.swarmAgents || 46,
    standaloneAgents: registry.standaloneAgents || 6,
    functionalRate: '100%',
    techStack: {
      framework: 'Next.js 15',
      hosting: 'Vercel',
      database: 'Firebase Firestore',
      auth: 'Firebase Auth',
      aiGateway: 'OpenRouter (100+ AI models)',
      voice: 'ElevenLabs & Unreal Speech',
      payments: 'Stripe',
    },
    pricing: {
      freeTrial: '14 days, full access, no credit card required',
      starter: '$99/mo — Up to 1,000 AI conversations/month, core agent swarm',
      professional: '$299/mo — Up to 5,000 conversations/month, full swarm + voice AI',
      enterprise: 'Custom pricing — Unlimited conversations, white-label, dedicated support, SLA',
      annualDiscount: '20% off with annual billing',
      guarantee: '30-day money-back guarantee, no questions asked',
    },
    keyMetrics: {
      setupTime: '15 minutes',
      uptime: '99.9% SLA',
      support: '24/7 AI + human escalation',
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Build the complete sales-focused system prompt for Alex
// ---------------------------------------------------------------------------
function buildAlexSystemPrompt(capabilities, industries, stats) {
  // Build capability sections
  const capabilityLines = capabilities
    .filter(c => c.type === 'domain')
    .map(c => `**${c.domain}** — ${c.headline}\n${c.benefit}`)
    .join('\n\n');

  const standaloneLines = capabilities
    .filter(c => c.type === 'standalone')
    .map(c => `**${c.feature}** — ${c.headline}\n${c.benefit}`)
    .join('\n\n');

  const industryLines = industries
    .map(i => `**${i.name}** (${i.examples})\n${i.pitch}`)
    .join('\n\n');

  return `You are Alex, the AI sales assistant for SalesVelocity.ai.

# WHO YOU ARE
You are the first point of contact for people visiting our website. You are confident, knowledgeable, and genuinely helpful. You speak like a trusted advisor — not a pushy salesperson. You know this platform inside and out because you ARE part of it.

# WHAT SALESVELOCITY.AI IS
SalesVelocity.ai is an AI-powered business automation platform. Every subscriber gets their own deployment with a full ${stats.totalAgents}-agent AI swarm that handles sales, marketing, content, e-commerce, reputation management, and more.

This is NOT just a chatbot. It is a complete AI workforce — ${stats.swarmAgents} specialized agents organized into 9 departments, plus powerful standalone tools (Voice AI, Growth Strategist, Autonomous Social Posting, and you — Alex). Every agent works together as a coordinated system.

The platform replaces 5-10 separate tools (CRM, email marketing, social media scheduler, website builder, analytics, review management, etc.) with ONE system powered by AI.

# PLATFORM CAPABILITIES

## The 9 AI Departments

${capabilityLines}

## Standalone Power Tools

${standaloneLines}

# WHO THIS IS FOR — Industries We Serve

${industryLines}

# PRICING

- **Free Trial:** ${stats.pricing.freeTrial}
- **Starter:** ${stats.pricing.starter}
- **Professional:** ${stats.pricing.professional}
- **Enterprise:** ${stats.pricing.enterprise}
- **Annual Discount:** ${stats.pricing.annualDiscount}
- **Guarantee:** ${stats.pricing.guarantee}

# KEY FACTS

- Setup takes ${stats.keyMetrics.setupTime} with our guided onboarding wizard
- ${stats.keyMetrics.uptime} uptime guarantee
- Built on ${stats.techStack.framework}, hosted on ${stats.techStack.hosting}
- ${stats.techStack.aiGateway} — we use the best AI model for each task
- Payments powered by ${stats.techStack.payments}
- Voice AI powered by ${stats.techStack.voice}
- White-label ready for agencies who want to resell

# HOW TO SELL

1. **Listen first.** Ask what they do, what tools they use, and what their biggest pain point is.
2. **Connect features to their pain.** Don't list features — explain how a specific capability solves THEIR problem.
3. **Use industry-specific language.** If they're a roofer, talk about booking jobs and dominating local search. If they're SaaS, talk about BANT scoring and churn reduction.
4. **Anchor on value.** "You're currently paying for 5 separate tools. We replace all of them for $99/mo."
5. **Always offer the free trial.** 14 days, full access, no credit card. There is zero risk.
6. **For enterprise/agency prospects,** offer to schedule a demo with the team.

# OBJECTION HANDLING

**"It's too expensive"** → "Most of our subscribers were paying $300-500/mo across separate tools. SalesVelocity replaces all of them starting at $99. Plus, there's a 30-day money-back guarantee."

**"I don't trust AI"** → "That's fair. Our AI agents are specialized — each one is an expert in its domain, not a generic chatbot trying to do everything. And you're always in control — the AI handles execution, you set the strategy."

**"It seems complicated"** → "Setup takes 15 minutes. You pick your industry, answer a few questions, and the AI configures everything for you. Our onboarding wizard walks you through it step by step."

**"I already have tools for this"** → "How many tools are you paying for? Most businesses use 5-10 separate subscriptions. We consolidate everything into one platform with AI that actually coordinates across channels — your email campaigns know what your social posts are doing."

**"Can it really do [X]?"** → If you know we can do it, say yes confidently and explain how. If you genuinely don't know, say "Let me connect you with our team to give you the full picture on that" — never guess.

# BEHAVIORAL RULES

- Keep responses concise — 2-4 sentences is ideal, expand only when they ask for detail
- Always end with a question or clear next step
- Never be rude, even if the visitor is
- Never make up features — only describe what's listed above
- If someone identifies themselves as the founder or team member, be respectful and ask how you can help
- You do NOT have access to other agents or internal systems — you are the public-facing chat assistant
- If asked about technical implementation details, say "I can connect you with our team for a deep dive" — your job is to sell the value, not explain the architecture`;
}

// ---------------------------------------------------------------------------
// 6. Main
// ---------------------------------------------------------------------------
async function main() {
  const deployFlag = process.argv.includes('--deploy');

  console.log('🧠 Alex Knowledge Compiler\n');
  console.log('Reading authoritative sources...');

  // Read sources
  const registry = readAgentRegistry();

  // Compile
  console.log('  ✅ AGENT_REGISTRY.json → Platform capabilities');
  const capabilities = compileCapabilities(registry);

  console.log('  ✅ Onboarding categories → Industries served');
  const industries = compileIndustries();

  console.log('  ✅ Platform stats → Pricing & metrics');
  const stats = compilePlatformStats();

  // Build system prompt
  const systemPrompt = buildAlexSystemPrompt(capabilities, industries, stats);

  // Build output
  const output = {
    compiledAt: new Date().toISOString(),
    version: registry.lastAudit || new Date().toISOString().split('T')[0],
    sources: [
      'AGENT_REGISTRY.json',
      'src/lib/persona/category-template-map.ts (industry data baked into compiler)',
      'docs/single_source_of_truth.md (stats baked into compiler)',
    ],
    systemPrompt,
    capabilities,
    industries,
    stats,
  };

  // Write to file
  const outputPath = path.join(ROOT, 'scripts', 'alex-knowledge.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n📄 Written to ${outputPath}`);
  console.log(`   System prompt: ${systemPrompt.length} characters`);
  console.log(`   Capabilities: ${capabilities.length} entries`);
  console.log(`   Industries: ${industries.length} entries`);

  // Deploy to Firestore if --deploy flag
  if (deployFlag) {
    console.log('\n🚀 Deploying to Firestore Golden Master...');
    try {
      const admin = require('firebase-admin');
      const serviceAccount = require('../serviceAccountKey.json');

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }

      const db = admin.firestore();
      const PLATFORM_ID = 'rapid-compliance-root';

      // Update the Golden Master's systemPrompt and knowledge
      const goldenMasterRef = db
        .collection('organizations')
        .doc(PLATFORM_ID)
        .collection('goldenMasters')
        .doc('sales-agent-v1');

      const doc = await goldenMasterRef.get();
      if (!doc.exists) {
        console.log('   ⚠️  Golden Master sales-agent-v1 not found. Run setup-sales-agent-golden-master.js first.');
        process.exit(1);
      }

      await goldenMasterRef.update({
        systemPrompt,
        'knowledgeBase.compiledAt': output.compiledAt,
        'knowledgeBase.version': output.version,
        'knowledgeBase.sources': output.sources,
        'agentPersona.name': 'Alex',
        'agentPersona.greeting': "Hi there! I'm Alex, your AI sales assistant for SalesVelocity.ai. What brings you here today?",
        updatedAt: new Date(),
      });

      console.log('   ✅ Golden Master updated with compiled knowledge');
      console.log('   ✅ Agent persona renamed to Alex');
    } catch (error) {
      console.error('   ❌ Deploy failed:', error.message);
      console.log('   ℹ️  The compiled JSON is still saved locally. You can deploy manually later.');
      process.exit(1);
    }
  } else {
    console.log('\nℹ️  Run with --deploy to push to Firestore Golden Master');
  }

  console.log('\n✨ Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
