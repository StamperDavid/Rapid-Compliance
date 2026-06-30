/**
 * Marketing site capture — CORE pages (home, features, pricing).
 *
 * Faithful reproduction of the three hardcoded marketing pages as canonical
 * `Page` objects so they can be imported into the visual editor as editable
 * DRAFT pages. Source pages:
 *   - Homepage  → src/app/(public)/page.tsx
 *   - Features  → src/app/(public)/features/page.tsx  (FallbackContent)
 *   - Pricing   → src/app/(public)/pricing/page.tsx   (FallbackContent)
 *
 * Copy is reproduced verbatim from the JSX. Widget `type` strings + `data`
 * shapes mirror what `ResponsiveRenderer` + `widget-normalizer` consume, AND
 * each section/widget now carries the real STYLING translated from the source
 * Tailwind classes into the canonical `Page` style fields:
 *   - `PageSection.backgroundColor` (+ `fullWidth` so the band reaches the
 *     canvas edges) reproduces the dark alternating section bands.
 *   - `Widget.style` reproduces text colors (white headings, gray sub-text,
 *     indigo accents), alignment, and font size/weight. `hero`/`cta` widgets
 *     also carry the indigo→purple gradient backgrounds.
 *
 * The renderer (`ResponsiveRenderer`) spreads `widget.style` onto heading /
 * text / button / hero / cta / testimonial widgets, and reads
 * `section.backgroundColor` / `fullWidth` on the section element — so these
 * fields take real visual effect. (The `features` / `pricing` widgets render
 * their own fixed card look and ignore widget style; see "honest gaps".)
 *
 * Every page is status: 'draft' — these must NOT affect the live site.
 */

import type { Page, PageSection, PageColumn, Widget, WidgetStyle, Spacing } from '@/types/website';
import type { FeatureItem, PricingPlan } from '@/types/widget-content';

// Stable timestamp for these seeded capture records.
const CAPTURED_AT = '2026-06-30T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Palette translated from the source Tailwind classes.
// ---------------------------------------------------------------------------
const COLOR = {
  white: '#ffffff',
  gray200: '#e5e7eb', // text-gray-200
  gray300: '#d1d5db', // text-gray-300 (primary body copy)
  gray400: '#9ca3af', // text-gray-400 (muted)
  gray500: '#6b7280', // text-gray-500 (faint)
  indigo300: '#a5b4fc', // text-indigo-300 (accent / new-way values)
  indigo400: '#818cf8', // text-indigo-400 (accent / gradient text approx)
  sectionGray900: '#111827', // bg-gray-900
  sectionBlack: '#000000', // bg-black
  sectionSlate: '#0f172a', // approximates the to-gray-900/50 fade
} as const;

// Reusable widget-style presets.
const STYLE = {
  // Section heading (h2) — white, centered, bold.
  h2Center: {
    color: COLOR.white,
    textAlign: 'center',
    fontSize: '36px',
    fontWeight: 'bold',
  } as WidgetStyle,
  // Large section heading (the bigger md:text-5xl headings).
  h2CenterLarge: {
    color: COLOR.white,
    textAlign: 'center',
    fontSize: '44px',
    fontWeight: 'bold',
  } as WidgetStyle,
  // Page hero h1 fallback (features/pricing use heading level 1).
  h1Center: {
    color: COLOR.white,
    textAlign: 'center',
    fontSize: '56px',
    fontWeight: 'bold',
  } as WidgetStyle,
  // Section sub-heading paragraph (gray-300, centered, larger).
  subCenter: {
    color: COLOR.gray300,
    textAlign: 'center',
    fontSize: '20px',
  } as WidgetStyle,
  // Faint centered helper line (gray-400).
  subCenterMuted: {
    color: COLOR.gray400,
    textAlign: 'center',
    fontSize: '16px',
  } as WidgetStyle,
  // Smallest centered trust line (gray-500).
  trustCenter: {
    color: COLOR.gray500,
    textAlign: 'center',
    fontSize: '14px',
  } as WidgetStyle,
  // Pill / badge line — indigo, centered, uppercase-ish semibold.
  badge: {
    color: COLOR.indigo300,
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.04em',
  } as WidgetStyle,
  // Comparison card column heading (h3, left, white, bold).
  cardH3: {
    color: COLOR.white,
    fontSize: '24px',
    fontWeight: 'bold',
  } as WidgetStyle,
  // Comparison card sub-label (gray-400).
  cardSub: {
    color: COLOR.gray400,
    fontSize: '14px',
  } as WidgetStyle,
  // Comparison card sub-label, "new way" accent (indigo-300).
  cardSubAccent: {
    color: COLOR.indigo300,
    fontSize: '14px',
  } as WidgetStyle,
  // Comparison row — old way (gray-300 line item).
  rowOld: {
    color: COLOR.gray300,
    fontSize: '14px',
  } as WidgetStyle,
  // Comparison row — new way (indigo-300 / included).
  rowNew: {
    color: COLOR.indigo300,
    fontSize: '14px',
  } as WidgetStyle,
  // Comparison total line (white, bold, bigger).
  rowTotal: {
    color: COLOR.white,
    fontSize: '18px',
    fontWeight: 'bold',
  } as WidgetStyle,
  // Footnote under a comparison card (faint).
  rowNote: {
    color: COLOR.gray400,
    fontSize: '12px',
  } as WidgetStyle,
  // Savings callout heading (indigo, centered, bold).
  savingsHead: {
    color: COLOR.indigo300,
    textAlign: 'center',
    fontSize: '26px',
    fontWeight: 'bold',
  } as WidgetStyle,
  // Savings callout sub (white, centered).
  savingsSub: {
    color: COLOR.white,
    textAlign: 'center',
    fontSize: '14px',
  } as WidgetStyle,
  // Fair-use list heading (h4, gray-300, centered-left uppercase tracking).
  fairUseH4: {
    color: COLOR.gray300,
    fontSize: '16px',
    fontWeight: '600',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  } as WidgetStyle,
  // Fair-use list item (gray-400).
  fairUseItem: {
    color: COLOR.gray400,
    fontSize: '14px',
  } as WidgetStyle,
  // BYOK callout body (white/90).
  byokBody: {
    color: COLOR.gray200,
    textAlign: 'center',
    fontSize: '18px',
  } as WidgetStyle,
  // BYOK recommend line (indigo, centered).
  byokRec: {
    color: COLOR.indigo300,
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: '600',
  } as WidgetStyle,
  // Secondary hero button ("Ask Alex") — translucent white look.
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    color: COLOR.white,
    border: '1px solid rgba(255,255,255,0.20)',
    borderRadius: '8px',
    fontWeight: '600',
  } as WidgetStyle,
  // Hero block — subtle indigo→purple gradient glow + white text.
  hero: {
    backgroundImage:
      'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(168,85,247,0.14) 100%)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: '20px',
    color: COLOR.white,
    padding: '72px 40px',
  } as WidgetStyle,
  // CTA band — bold indigo→purple gradient (the "purple CTA band").
  cta: {
    backgroundImage: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)',
    backgroundColor: '#4f46e5',
    color: COLOR.white,
    borderRadius: '20px',
  } as WidgetStyle,
} as const;

// ---------------------------------------------------------------------------
// Typed widget + section builders (keep the literals narrow, zero `any`).
// ---------------------------------------------------------------------------

function heading(id: string, text: string, level: number, style?: WidgetStyle): Widget {
  return style ? { id, type: 'heading', data: { text, level }, style } : { id, type: 'heading', data: { text, level } };
}

function paragraph(id: string, content: string, style?: WidgetStyle): Widget {
  return style ? { id, type: 'text', data: { content }, style } : { id, type: 'text', data: { content } };
}

function button(id: string, text: string, url: string, style?: WidgetStyle): Widget {
  return style ? { id, type: 'button', data: { text, url }, style } : { id, type: 'button', data: { text, url } };
}

function featuresWidget(id: string, items: FeatureItem[]): Widget {
  return { id, type: 'features', data: { features: items } };
}

function testimonialWidget(
  id: string,
  data: { quote: string; author: string; role: string },
  style?: WidgetStyle,
): Widget {
  return style ? { id, type: 'testimonial', data, style } : { id, type: 'testimonial', data };
}

function pricingWidget(id: string, plans: PricingPlan[]): Widget {
  return { id, type: 'pricing', data: { plans } };
}

function ctaWidget(
  id: string,
  data: { heading: string; text: string; buttonText: string; buttonUrl: string },
  style?: WidgetStyle,
): Widget {
  return style ? { id, type: 'cta', data, style } : { id, type: 'cta', data };
}

interface SectionOpts {
  backgroundColor?: string;
  fullWidth?: boolean;
  padding?: Spacing;
}

function applyOpts(base: PageSection, opts: SectionOpts): PageSection {
  const next: PageSection = { ...base };
  if (opts.backgroundColor !== undefined) {
    next.backgroundColor = opts.backgroundColor;
  }
  if (opts.fullWidth) {
    next.fullWidth = true;
  }
  if (opts.padding) {
    next.padding = opts.padding;
  }
  return next;
}

/** Single full-width column section. */
function section(id: string, widgets: Widget[], opts: SectionOpts = {}): PageSection {
  return applyOpts(
    {
      id,
      type: 'section',
      columns: [{ id: `${id}-col`, width: 1, widgets }],
    },
    opts,
  );
}

/** Two-column section (equal flex width). */
function twoColSection(
  id: string,
  left: Widget[],
  right: Widget[],
  opts: SectionOpts = {},
): PageSection {
  const columns: PageColumn[] = [
    { id: `${id}-col-1`, width: 1, widgets: left },
    { id: `${id}-col-2`, width: 1, widgets: right },
  ];
  return applyOpts({ id, type: 'section', columns }, opts);
}

// Shorthands for the recurring dark bands.
const GRAY900: SectionOpts = { backgroundColor: COLOR.sectionGray900, fullWidth: true };
const BLACK: SectionOpts = { backgroundColor: COLOR.sectionBlack, fullWidth: true };
const SLATE: SectionOpts = { backgroundColor: COLOR.sectionSlate, fullWidth: true };

// ===========================================================================
// HOME
// ===========================================================================

const homeWhatsIncluded: FeatureItem[] = [
  { icon: '📊', title: 'Full CRM Suite', description: 'Custom schemas, pipelines, automation' },
  { icon: '🎙️', title: 'Voice AI Closers', description: 'AI prospectors + human power dialer' },
  { icon: '📱', title: 'Social Media AI', description: 'Direct LinkedIn & X integrations' },
  { icon: '🔍', title: 'SEO & Lead Research', description: 'Scraping, enrichment, keyword intel' },
  { icon: '🖊️', title: 'Content Factory', description: 'AI blogs, posts, and social content' },
  { icon: '🎬', title: 'Video Generation', description: 'AI-powered video creation studio' },
  { icon: '⚡', title: 'Workflow Automation', description: 'Visual builder, n8n-grade logic' },
  { icon: '🎨', title: 'White-Label Branding', description: 'Your domain, your brand' },
  { icon: '🔑', title: 'Raw Market Rates', description: 'BYOK: Zero AI markup, direct APIs' },
];

const homeHowItWorks: FeatureItem[] = [
  {
    icon: '🎓',
    title: 'Step 1 — Train Your Agent',
    description:
      'Answer a few questions about your business, upload your product docs, and our AI learns everything about your offerings. Takes 15-30 minutes.',
  },
  {
    icon: '🎯',
    title: 'Step 2 — Practice & Perfect',
    description:
      'Role-play as a customer in our training sandbox. Give feedback. The AI improves with every session. Improve accuracy to 95%+.',
  },
  {
    icon: '🚀',
    title: 'Step 3 — Deploy Everywhere',
    description:
      'Embed your AI agent on your website with one line of code. It works on WordPress, Shopify, or any site. Works on any website.',
  },
];

const homeWorkforce: FeatureItem[] = [
  {
    icon: '📊',
    title: 'Full CRM Suite',
    description:
      'Foundation — Custom Schemas & Pipelines · Contact & Deal Management · Activity & Communication Logs',
  },
  {
    icon: '📞',
    title: 'Voice AI Closers',
    description:
      'AI + Human — AI Prospector (Qualify & Transfer) · AI Closer (Objections & Payments) · Human Power Dialer (Multi-Line)',
  },
  {
    icon: '📱',
    title: 'Social Media AI',
    description:
      'Direct APIs — LinkedIn Direct Integration · X (Twitter) Direct Integration · AI Content Generation',
  },
  {
    icon: '🔍',
    title: 'SEO & Lead Intel',
    description:
      'Research — Keyword Research & Tracking · Competitor Analysis · Lead Scraping & Enrichment',
  },
  {
    icon: '✍️',
    title: 'Content Factory',
    description: 'AI-Generated — AI Blog Posts & Articles · Social Media Content · Email & Ad Copy',
  },
  {
    icon: '🎬',
    title: 'Video Studio',
    description:
      'AI-Powered — AI Storyboard Generation · Script & Scene Builder · Multi-Provider Render Pipeline',
  },
];

const homePage: Page = {
  id: 'home',
  slug: 'home',
  title: 'Home',
  status: 'draft',
  seo: {},
  createdAt: CAPTURED_AT,
  updatedAt: CAPTURED_AT,
  createdBy: 'system',
  lastEditedBy: 'system',
  content: [
    // Hero (page base gradient → hero block carries an indigo→purple glow)
    section('home-hero', [
      paragraph('home-hero-badge', 'AI-Native Workforce Platform', STYLE.badge),
      heading('home-hero-h1a', 'Your AI-Native', 1, { ...STYLE.h1Center, fontSize: '64px' }),
      heading('home-hero-h1b', 'Sales Workforce', 1, {
        ...STYLE.h1Center,
        fontSize: '64px',
        textGradient: { from: '#818cf8', to: '#c084fc', angle: 90 },
      }),
      paragraph(
        'home-hero-subhead',
        'CRM + Voice AI Closers + Social Media AI + SEO + Content Factory. Humans and AI working together.',
        STYLE.subCenter,
      ),
      paragraph(
        'home-hero-sub',
        'One platform. Raw market rates. No wrapper markup. Your AI workforce scales infinitely.',
        STYLE.subCenterMuted,
      ),
      featuresWidget('home-hero-diff', [
        {
          title: '$299/month',
          description: 'Flat — every customer, every feature. All features included.',
        },
        { icon: '💡', title: 'Zero AI Markup', description: 'BYOK — Pay raw market rates.' },
        {
          title: 'One Price for All',
          description: 'Flat Pricing — No tiers, no record limits.',
        },
      ]),
      button('home-hero-cta1', 'Reserve my spot →', '/early-access', {
        backgroundColor: '#6366f1',
        color: COLOR.white,
        borderRadius: '8px',
        fontWeight: '600',
      } as WidgetStyle),
      button('home-hero-cta2', 'Ask Alex', '/demo', STYLE.secondaryButton),
      paragraph(
        'home-hero-trust',
        'No charge until trial ends • 14-day free trial • Cancel anytime',
        STYLE.subCenterMuted,
      ),
    ]),

    // What's Included (bg-gray-900)
    section(
      'home-included',
      [
        heading('home-included-h2', "What's Included in Every Plan", 2, STYLE.h2Center),
        paragraph(
          'home-included-sub',
          'Every customer gets every feature. No tiers, no upsells, no record limits.',
          STYLE.subCenter,
        ),
        featuresWidget('home-included-grid', homeWhatsIncluded),
      ],
      GRAY900,
    ),

    // The AI-Native Advantage (Old Way vs New Way) — bg-black
    section(
      'home-advantage-head',
      [
        heading('home-advantage-h2', 'The AI-Native Advantage', 2, STYLE.h2CenterLarge),
        paragraph(
          'home-advantage-sub',
          'Your workforce that never sleeps. Raw APIs. Zero markup. Infinite scale.',
          STYLE.subCenter,
        ),
      ],
      BLACK,
    ),
    twoColSection(
      'home-advantage-compare',
      [
        heading('home-adv-old-h3', 'The Old Way', 3, STYLE.cardH3),
        paragraph('home-adv-old-sub', 'Fragmented & Expensive', STYLE.cardSub),
        paragraph('home-adv-old-1', 'Apollo/ZoomInfo — $99-399/mo', STYLE.rowOld),
        paragraph('home-adv-old-2', 'Air AI/11x — $500-2,000/mo', STYLE.rowOld),
        paragraph('home-adv-old-3', 'Outreach Tool (Email/LinkedIn) — $49-199/mo', STYLE.rowOld),
        paragraph('home-adv-old-4', 'Zapier — $29-599/mo', STYLE.rowOld),
        paragraph('home-adv-old-5', 'HubSpot CRM — $45-1,200/mo', STYLE.rowOld),
        paragraph('home-adv-old-total', 'TOTAL — $722-4,397/mo', STYLE.rowTotal),
        paragraph(
          'home-adv-old-note',
          'Plus: Integration hell, 5 support teams, data syncing nightmares',
          STYLE.rowNote,
        ),
      ],
      [
        heading('home-adv-new-h3', 'The New Way', 3, STYLE.cardH3),
        paragraph('home-adv-new-sub', 'All-In-One & Affordable', STYLE.cardSubAccent),
        paragraph('home-adv-new-1', '✓ Lead Scraper & Enrichment — Included', STYLE.rowNew),
        paragraph('home-adv-new-2', '✓ AI Sales Agents (Unlimited) — Included', STYLE.rowNew),
        paragraph('home-adv-new-3', '✓ Multi-Channel Outreach — Included', STYLE.rowNew),
        paragraph('home-adv-new-4', '✓ Workflow Automation — Included', STYLE.rowNew),
        paragraph('home-adv-new-5', '✓ Full CRM + E-commerce — Included', STYLE.rowNew),
        paragraph('home-adv-new-total', 'TOTAL — $299/mo flat', STYLE.rowTotal),
        paragraph(
          'home-adv-new-note',
          'Plus: Everything synced, one dashboard, one support team, BYOK on AI',
          STYLE.rowNote,
        ),
      ],
      BLACK,
    ),
    section(
      'home-advantage-savings',
      [
        heading('home-adv-savings-h3', 'Save $423-4,098 per month', 3, STYLE.savingsHead),
        paragraph('home-adv-savings-sub', "That's $5,076-49,176 saved per year", STYLE.savingsSub),
      ],
      BLACK,
    ),

    // BYOK: Zero AI Markup (bg-gray-900)
    section(
      'home-byok-head',
      [
        heading('home-byok-h2', "BYOK: We Don't Markup Your AI Costs", 2, STYLE.h2CenterLarge),
        paragraph(
          'home-byok-sub',
          "Most AI platforms mark up tokens by 300-500%. We don't. You connect your own API key and pay the AI provider directly at cost.",
          STYLE.subCenter,
        ),
        paragraph(
          'home-byok-rec',
          'We recommend OpenRouter - one key gives you access to GPT-4, Claude, Gemini, and 200+ models',
          STYLE.byokRec,
        ),
      ],
      GRAY900,
    ),
    twoColSection(
      'home-byok-compare',
      [
        heading('home-byok-typ-h3', 'Typical AI Platform', 3, STYLE.cardH3),
        paragraph('home-byok-typ-sub', 'Hidden Token Markup', STYLE.cardSub),
        paragraph('home-byok-typ-1', 'Platform Fee — $1,500/mo', STYLE.rowOld),
        paragraph('home-byok-typ-2', 'AI Usage (400% markup) — $400/mo', STYLE.rowOld),
        paragraph('home-byok-typ-3', '(Real cost: $100, but you pay $400)', STYLE.rowNote),
        paragraph('home-byok-typ-total', 'TOTAL YOU PAY — $1,900/mo', STYLE.rowTotal),
      ],
      [
        heading('home-byok-our-h3', 'Our Platform (BYOK)', 3, STYLE.cardH3),
        paragraph('home-byok-our-sub', '100% Transparent', STYLE.cardSubAccent),
        paragraph('home-byok-our-1', 'Platform Fee (flat, from us) — $299/mo', STYLE.rowNew),
        paragraph('home-byok-our-2', 'AI Usage (0% markup) — $100/mo', STYLE.rowNew),
        paragraph('home-byok-our-3', '(You pay OpenRouter/OpenAI directly at cost)', STYLE.rowNote),
        paragraph('home-byok-our-total', 'TOTAL YOU PAY — $399/mo', STYLE.rowTotal),
      ],
      GRAY900,
    ),
    section(
      'home-byok-savings',
      [
        heading('home-byok-savings-h3', 'You Save: $1,501/month', 3, STYLE.savingsHead),
        paragraph(
          'home-byok-savings-sub',
          "That's $18,012 saved per year with complete transparency",
          STYLE.savingsSub,
        ),
      ],
      GRAY900,
    ),

    // How It Works (bg-black)
    section(
      'home-how',
      [
        heading('home-how-h2', 'Three Steps to Your AI Sales Team', 2, STYLE.h2CenterLarge),
        paragraph('home-how-sub', 'Get up and running in less than an hour', STYLE.subCenter),
        featuresWidget('home-how-grid', homeHowItWorks),
      ],
      BLACK,
    ),

    // AI-Native Workforce Capabilities (bg-black)
    section(
      'home-workforce',
      [
        heading('home-workforce-h2', 'Your Complete AI-Native Workforce', 2, STYLE.h2CenterLarge),
        paragraph('home-workforce-sub', 'Humans + AI. One platform. Raw market rates.', STYLE.subCenter),
        featuresWidget('home-workforce-grid', homeWorkforce),
      ],
      BLACK,
    ),

    // Social Proof (bg-gray-900)
    section(
      'home-proof-head',
      [heading('home-proof-h2', 'Trusted by Growing Businesses', 2, STYLE.h2CenterLarge)],
      GRAY900,
    ),
    applyOpts(
      {
        id: 'home-proof-grid',
        type: 'section',
        columns: [
          {
            id: 'home-proof-col-1',
            width: 1,
            widgets: [
              testimonialWidget('home-proof-1', {
                quote:
                  "This AI agent increased our lead conversion by 300%. It's like having a top sales rep working 24/7.",
                author: 'Sarah Johnson',
                role: 'CEO, TechStart Inc',
              }),
            ],
          },
          {
            id: 'home-proof-col-2',
            width: 1,
            widgets: [
              testimonialWidget('home-proof-2', {
                quote:
                  'We went from manually qualifying every lead to having AI do it for us. Saved us 20 hours a week.',
                author: 'Michael Chen',
                role: 'Founder, GrowthLabs',
              }),
            ],
          },
          {
            id: 'home-proof-col-3',
            width: 1,
            widgets: [
              testimonialWidget('home-proof-3', {
                quote:
                  'The training is so easy. We had our AI agent up and running in under an hour.',
                author: 'Emily Rodriguez',
                role: 'Sales Director, CloudCorp',
              }),
            ],
          },
        ],
      },
      GRAY900,
    ),

    // Final CTA (bg-black + indigo→purple CTA band)
    section(
      'home-cta',
      [
        ctaWidget(
          'home-cta-main',
          {
            heading: 'Ready to 10x Your Sales?',
            text: 'Join hundreds of businesses using AI to close more deals',
            buttonText: 'Reserve my spot →',
            buttonUrl: '/early-access',
          },
          STYLE.cta,
        ),
        paragraph(
          'home-cta-trust',
          '14-day free trial • No credit card required • $299/month flat after trial',
          STYLE.trustCenter,
        ),
      ],
      BLACK,
    ),
  ],
};

// ===========================================================================
// FEATURES
// ===========================================================================

const featuresAiWorkforce: FeatureItem[] = [
  {
    icon: '🧠',
    title: 'Master Orchestrator (Jasper)',
    description: 'Your AI strategy partner — interprets goals and delegates to the swarm.',
  },
  {
    icon: '🎬',
    title: 'Mission Control',
    description:
      'Every agent action lands here for your approval. You become the director, not the doer.',
  },
  {
    icon: '🏋️',
    title: 'Training Lab',
    description:
      'Grade an agent’s output and the Golden Master updates. Agents learn your brand over time.',
  },
  {
    icon: '🧬',
    title: 'Brand DNA',
    description: 'Train every agent on your tone, voice, key phrases, and topics to avoid — once.',
  },
];

const featuresSales: FeatureItem[] = [
  {
    icon: '📊',
    title: 'Full CRM Suite',
    description: 'Leads, contacts, deals, companies, custom schemas, kanban + table views.',
  },
  {
    icon: '💬',
    title: 'AI Conversations',
    description:
      'Your customer-facing chat agent qualifies leads 24/7 across web, social DMs, and Messenger.',
  },
  {
    icon: '🎯',
    title: 'AI Lead Scoring',
    description: '0–100 score with grade tiers. Hot/warm/cold prioritization without spreadsheets.',
  },
  {
    icon: '🔮',
    title: 'AI Deal Scoring & Forecasting',
    description: 'Per-deal close probability and revenue forecast keyed to your pipeline.',
  },
  {
    icon: '🎓',
    title: 'AI Sales Coaching',
    description:
      'Per-rep performance insights, strengths, weaknesses, and personalized recommendations.',
  },
  {
    icon: '📄',
    title: 'Proposal & Document Builder',
    description: 'Generate proposals, contracts, and e-signatures with your brand templates.',
  },
];

const featuresMarketing: FeatureItem[] = [
  {
    icon: '✉️',
    title: 'Email Sequences & Campaigns',
    description:
      'Unlimited multi-step campaigns with open/click tracking and AI-generated copy.',
  },
  {
    icon: '💬',
    title: 'SMS Outreach',
    description: 'Twilio-powered SMS campaigns with 90%+ open rates for time-sensitive sends.',
  },
  {
    icon: '📱',
    title: 'Social Media',
    description:
      'Post and schedule across Twitter/X, LinkedIn, Facebook, Instagram, TikTok, YouTube, Bluesky, Mastodon, Threads, Pinterest.',
  },
  {
    icon: '📋',
    title: 'Forms',
    description: 'Drag-drop builder with AI-suggested questions; submissions land directly in CRM.',
  },
  {
    icon: '🎯',
    title: 'Lead Scraper & Enrichment',
    description: 'Built-in lead-hunter pulls prospects from Apollo, Clearbit, and custom logic.',
  },
  {
    icon: '🤝',
    title: 'A/B Testing',
    description:
      'Run experiments across funnels, landing pages, and campaigns with auto-winner detection.',
  },
];

const featuresVoice: FeatureItem[] = [
  {
    icon: '📞',
    title: 'Voice AI Closers (Outbound)',
    description:
      'AI prospectors call and qualify leads, then hand warm conversations to a human power-dialer.',
  },
  {
    icon: '☎️',
    title: 'AI Receptionist (Inbound)',
    description:
      'Answers your business line 24/7, qualifies callers, books appointments, escalates the urgent stuff.',
  },
];

const featuresContent: FeatureItem[] = [
  {
    icon: '✨',
    title: 'Magic Studio',
    description: 'Single canvas for image + video + music + copy generation. Drag, refine, reuse.',
  },
  {
    icon: '🎥',
    title: 'Video Production',
    description: 'AI-powered avatars, AI-narrated voice-overs, scene assembly, post-production.',
  },
  {
    icon: '🎵',
    title: 'Music Generation',
    description: 'Brand-tuned, royalty-free tracks for video, ads, and podcasts.',
  },
  {
    icon: '✍️',
    title: 'AI Copywriting',
    description: 'Blog posts, ad copy, emails, scripts — every piece runs through your brand voice.',
  },
  {
    icon: '🖼️',
    title: 'Media Library',
    description: 'Centralized assets, brand kit, intro/outro reels, character profiles.',
  },
  {
    icon: '📅',
    title: 'Content Calendar',
    description: 'Plan and schedule every piece of content across every channel from one place.',
  },
];

const featuresWebsite: FeatureItem[] = [
  {
    icon: '🌐',
    title: 'Website Builder',
    description: 'Drag-drop sections + AI page generation. Clone any competitor’s site in minutes.',
  },
  {
    icon: '📝',
    title: 'Blog & Content Publishing',
    description: 'Built-in blog with SEO scoring, category management, and RSS auto-publish.',
  },
  {
    icon: '🔍',
    title: 'SEO Suite',
    description: 'Keyword research, competitor tracking, content briefs, and rank tracking.',
  },
  {
    icon: '🏷️',
    title: 'White-Label & Custom Domain',
    description: 'Your brand on every page. Custom domain support and theme customization.',
  },
  {
    icon: '⚡',
    title: 'AI Search Visibility',
    description: 'Track how your brand surfaces in ChatGPT, Perplexity, and Claude searches.',
  },
  {
    icon: '📑',
    title: 'Forms & Landing Pages',
    description:
      'Pair forms with landing pages and pipe submissions straight into your sales pipeline.',
  },
];

const featuresCommerce: FeatureItem[] = [
  {
    icon: '🛒',
    title: 'E-Commerce Storefront',
    description: 'Built-in Stripe + multi-provider checkout (PayPal, Adyen, Square, Chargebee, more).',
  },
  {
    icon: '🧾',
    title: 'Invoicing & Recurring Billing',
    description: 'Automated invoices, payment recording, and subscription management.',
  },
  {
    icon: '⚡',
    title: 'Workflow Automation',
    description:
      'Visual builder with triggers, conditions, and multi-step actions across email/SMS/social/CRM.',
  },
  {
    icon: '📈',
    title: 'Real-Time Analytics',
    description: 'Pipeline, ecommerce, and workflow analytics dashboards across every channel.',
  },
  {
    icon: '⚠️',
    title: 'Risk Prediction',
    description: 'AI-powered deal slippage prediction with intervention recommendations.',
  },
  {
    icon: '🔌',
    title: '69+ Integrations',
    description:
      'Stripe, Zoom, Google Workspace, Microsoft 365, Twilio, social platforms, accounting tools, and more.',
  },
];

const featuresPage: Page = {
  id: 'features',
  slug: 'features',
  title: 'Features',
  status: 'draft',
  seo: {},
  createdAt: CAPTURED_AT,
  updatedAt: CAPTURED_AT,
  createdBy: 'system',
  lastEditedBy: 'system',
  content: [
    // Hero (transparent over dark base)
    section('features-hero', [
      heading('features-hero-h1', 'Everything You Need to Sell More, Faster', 1, STYLE.h1Center),
      paragraph(
        'features-hero-sub',
        'A complete AI-powered sales platform with CRM, automation, and e-commerce built in',
        STYLE.subCenter,
      ),
    ]),

    // AI Workforce
    section('features-workforce', [
      heading('features-workforce-h2', 'A 69-Agent AI Workforce, Not a Chatbot', 2, STYLE.h2Center),
      paragraph(
        'features-workforce-sub',
        '57 specialists, 11 department managers, and one Master Orchestrator — all trained on your brand voice and reviewed in your Mission Control dashboard.',
        STYLE.subCenterMuted,
      ),
      featuresWidget('features-workforce-grid', featuresAiWorkforce),
    ]),

    // Sales (bg-gray-900 band to alternate)
    section(
      'features-sales',
      [
        heading('features-sales-h2', 'Sales', 2, STYLE.h2Center),
        featuresWidget('features-sales-grid', featuresSales),
      ],
      GRAY900,
    ),

    // Marketing & Outreach
    section('features-marketing', [
      heading('features-marketing-h2', 'Marketing & Outreach', 2, STYLE.h2Center),
      featuresWidget('features-marketing-grid', featuresMarketing),
    ]),

    // Voice AI (bg-gray-900 band)
    section(
      'features-voice',
      [
        heading('features-voice-h2', 'Voice AI', 2, STYLE.h2Center),
        featuresWidget('features-voice-grid', featuresVoice),
      ],
      GRAY900,
    ),

    // Content Engine
    section('features-content', [
      heading('features-content-h2', 'Content Engine', 2, STYLE.h2Center),
      paragraph(
        'features-content-sub',
        'The Magic Studio gives you a unified canvas for image, video, music, and copy — every output trained on your Brand DNA.',
        STYLE.subCenterMuted,
      ),
      featuresWidget('features-content-grid', featuresContent),
    ]),

    // Website & SEO (bg-gray-900 band)
    section(
      'features-website',
      [
        heading('features-website-h2', 'Website & SEO', 2, STYLE.h2Center),
        featuresWidget('features-website-grid', featuresWebsite),
      ],
      GRAY900,
    ),

    // Commerce & Operations
    section('features-commerce', [
      heading('features-commerce-h2', 'Commerce & Operations', 2, STYLE.h2Center),
      featuresWidget('features-commerce-grid', featuresCommerce),
    ]),

    // CTA (indigo→purple band)
    section('features-cta', [
      ctaWidget(
        'features-cta-main',
        {
          heading: 'Start Your 14-Day Free Trial',
          text: 'No credit card required. Full access to all features.',
          buttonText: 'Get early access →',
          buttonUrl: '/early-access',
        },
        STYLE.cta,
      ),
    ]),
  ],
};

// ===========================================================================
// PRICING
// ===========================================================================

const pricingAllFeatures: string[] = [
  '69-Agent AI Workforce (specialists + managers + Master Orchestrator)',
  'Mission Control — review & approve every agent action',
  'Training Lab — agents learn your brand voice via Delta-Snapshots',
  'Brand DNA — train every agent on your tone, voice, and rules',
  'Full CRM Suite (Leads, Contacts, Deals, Companies)',
  'AI Lead Scoring (0-100 with grade tiers)',
  'AI Deal Scoring & Forecasting',
  'AI Sales Coaching (per-rep insights)',
  'Proposal & Document Builder',
  'Custom Schemas & Objects',
  'Email Sequences & Campaigns (Unlimited)',
  'SMS Outreach (Twilio-powered)',
  'Social Media — post + schedule across all major platforms',
  'Forms — drag-drop builder + lead capture',
  'Lead Scraper & Enrichment',
  'AI Conversations — 24/7 chat agent across web + Messenger',
  'Voice AI Closers (outbound) + AI Receptionist (inbound)',
  'Magic Studio — Image + Video + Music + Copy generation',
  'Video Production Pipeline (AI avatar + AI-narrated)',
  'Music Generation (royalty-free, brand-tuned)',
  'AI Copywriting (blog, ads, emails, scripts)',
  'Media Library + Brand Kit',
  'Website Builder (drag-drop + AI page generation)',
  'SEO Suite — keyword research, content briefs, rank tracking',
  'Custom Domain + White-Label Options',
  'Built-in E-Commerce Storefront (Stripe + multi-provider)',
  'Invoicing & Recurring Billing',
  'Workflow Automation (visual builder)',
  'A/B Testing across funnels',
  'Real-Time Analytics Dashboard',
  'Full API Access',
  'Risk Prediction (deal slippage)',
  '69 Integrations including Stripe, Zoom, Google, Microsoft, Twilio',
  'Email & Chat Support',
];

const pricingPlan: PricingPlan = {
  name: 'All-In-One Plan',
  price: 299,
  period: 'month',
  features: pricingAllFeatures,
  featured: true,
  buttonText: 'Get early access →',
  buttonUrl: '/early-access',
};

const pricingPage: Page = {
  id: 'pricing',
  slug: 'pricing',
  title: 'Pricing',
  status: 'draft',
  seo: {},
  createdAt: CAPTURED_AT,
  updatedAt: CAPTURED_AT,
  createdBy: 'system',
  lastEditedBy: 'system',
  content: [
    // Hero (transparent over dark base)
    section('pricing-hero', [
      paragraph('pricing-hero-badge', 'Flat Pricing — One Price', STYLE.badge),
      heading('pricing-hero-h1', 'One price. All features. Forever.', 1, STYLE.h1Center),
      paragraph(
        'pricing-hero-sub',
        '$299 per month, flat. BYOK on AI so you pay raw market rates direct to your provider. No tiers, no upsells, no surprises.',
        STYLE.subCenter,
      ),
      paragraph(
        'pricing-hero-sub2',
        'No feature gating. No record limits. No tier juggling. Just one price that works.',
        STYLE.subCenterMuted,
      ),
    ]),

    // BYOK callout (indigo→purple gradient band)
    section(
      'pricing-byok',
      [
        heading('pricing-byok-h3', 'Bring Your Own Keys (BYOK)', 3, {
          ...STYLE.cardH3,
          textAlign: 'center',
        }),
        paragraph('pricing-byok-tagline', 'Zero AI Token Markup. 100% Transparent.', STYLE.byokRec),
        paragraph(
          'pricing-byok-body',
          "Connect your own API key and pay the AI provider directly at raw market rates. We don't touch your AI costs—that's your direct relationship with the provider. No hidden fees. No markup. Just honest pricing.",
          STYLE.byokBody,
        ),
        paragraph(
          'pricing-byok-rec',
          'We recommend OpenRouter - One key gives you access to GPT-4, Claude, Gemini, Llama, and 200+ models. Simpler than managing multiple provider keys.',
          STYLE.subCenterMuted,
        ),
        featuresWidget('pricing-byok-providers', [
          { icon: '⭐', title: 'OpenRouter (Recommended)', description: '' },
          { icon: '✓', title: 'OpenAI Direct (Optional)', description: '' },
          { icon: '✓', title: 'Anthropic Direct (Optional)', description: '' },
        ]),
      ],
      {
        backgroundColor: '#1e1b4b', // indigo-950 — evokes the gradient callout band
        fullWidth: true,
      },
    ),

    // Key benefits
    section('pricing-benefits', [
      featuresWidget('pricing-benefits-grid', [
        {
          icon: '⚡',
          title: 'All Features Unlocked',
          description: 'From day one, every feature is available to you',
        },
        {
          icon: '📊',
          title: 'Flat Pricing',
          description: '$299/mo for everyone. No tiers, no record-based scaling.',
        },
        {
          icon: '🔓',
          title: 'BYOK on AI',
          description: 'Pay raw rates direct to OpenAI / Anthropic / OpenRouter',
        },
      ]),
    ]),

    // Single pricing card (bg-gray-950 frame in source)
    section(
      'pricing-card',
      [
        pricingWidget('pricing-card-plan', [pricingPlan]),
        heading('pricing-card-fairuse-h4', 'Fair Use Limits', 4, STYLE.fairUseH4),
        paragraph('pricing-card-fairuse-1', '50,000 CRM records', STYLE.fairUseItem),
        paragraph('pricing-card-fairuse-2', '100 AI agents per account', STYLE.fairUseItem),
        paragraph('pricing-card-fairuse-3', '10,000 scheduled social posts / month', STYLE.fairUseItem),
        paragraph('pricing-card-fairuse-4', '5,000 outbound emails / day', STYLE.fairUseItem),
        paragraph(
          'pricing-card-fairuse-note',
          'Reasonable use applies for everything else — contact us if you have an enterprise-scale need.',
          STYLE.trustCenter,
        ),
        paragraph(
          'pricing-card-trust',
          '14-day free trial • No credit card required • Cancel anytime',
          STYLE.trustCenter,
        ),
      ],
      { backgroundColor: '#030712', fullWidth: true },
    ),

    // AI-Native Workforce Value (fade to gray-900/50)
    section(
      'pricing-value-head',
      [
        heading('pricing-value-h2', 'One Workforce. Raw Market Rates.', 2, STYLE.h2CenterLarge),
        paragraph(
          'pricing-value-sub',
          'Your AI-Native workforce runs on direct APIs with zero wrapper markup.',
          STYLE.subCenter,
        ),
      ],
      SLATE,
    ),
    twoColSection(
      'pricing-value-compare',
      [
        heading('pricing-val-old-h3', 'The Old Way', 3, STYLE.cardH3),
        paragraph('pricing-val-old-sub', 'Fragmented & Expensive', STYLE.cardSub),
        paragraph('pricing-val-old-1', 'Apollo/ZoomInfo (Lead Data) — $99-399/mo', STYLE.rowOld),
        paragraph('pricing-val-old-2', 'Air AI/11x (AI Sales Agents) — $500-2000/mo', STYLE.rowOld),
        paragraph('pricing-val-old-3', 'Outreach Tool (Email/LinkedIn) — $49-199/mo', STYLE.rowOld),
        paragraph('pricing-val-old-4', 'Zapier (Automation) — $29-599/mo', STYLE.rowOld),
        paragraph('pricing-val-old-total', 'TOTAL PER MONTH: $677-3,197', STYLE.rowTotal),
        paragraph(
          'pricing-val-old-note',
          'Plus: Integration hell, 5 support teams, data syncing nightmares',
          STYLE.rowNote,
        ),
      ],
      [
        heading('pricing-val-new-h3', 'The New Way', 3, STYLE.cardH3),
        paragraph('pricing-val-new-sub', 'All-In-One & Affordable', STYLE.cardSubAccent),
        paragraph('pricing-val-new-1', '✓ Lead Scraper & Enrichment — Included', STYLE.rowNew),
        paragraph('pricing-val-new-2', '✓ AI Sales Agents (Unlimited) — Included', STYLE.rowNew),
        paragraph('pricing-val-new-3', '✓ Multi-Channel Outreach — Included', STYLE.rowNew),
        paragraph('pricing-val-new-4', '✓ Workflow Automation — Included', STYLE.rowNew),
        paragraph('pricing-val-new-total', 'TOTAL PER MONTH: $299 flat', STYLE.rowTotal),
        paragraph(
          'pricing-val-new-note',
          'Plus: Everything synced, one dashboard, one support team, BYOK on AI',
          STYLE.rowNote,
        ),
      ],
      SLATE,
    ),
    section(
      'pricing-value-savings',
      [
        heading('pricing-val-savings-h3', 'Save $378 - $2,898 per month', 3, STYLE.savingsHead),
        paragraph('pricing-val-savings-sub', "That's $4,536 - $34,776 saved per year", STYLE.savingsSub),
        paragraph(
          'pricing-val-savings-note',
          'While spending less, you get more: a unified platform built for small businesses, not enterprise giants. Your success is our success.',
          STYLE.subCenterMuted,
        ),
      ],
      SLATE,
    ),

    // CTA (indigo→purple band)
    section('pricing-cta', [
      ctaWidget(
        'pricing-cta-main',
        {
          heading: 'Ready to Get Started?',
          text: "One price. Every feature. Sign up once and you're done.",
          buttonText: 'Get early access →',
          buttonUrl: '/early-access',
        },
        STYLE.cta,
      ),
      paragraph(
        'pricing-cta-trust',
        '14-day free trial • No credit card required • Cancel anytime',
        STYLE.subCenterMuted,
      ),
      paragraph(
        'pricing-cta-note',
        '$299/month flat. BYOK on AI. Fair-use caps apply.',
        STYLE.trustCenter,
      ),
    ]),
  ],
};

// ===========================================================================
// EXPORT
// ===========================================================================

export const pages: Page[] = [homePage, featuresPage, pricingPage];
