/**
 * Seeded Email Template Library
 * -----------------------------
 * Eight polished starter templates surfaced in the email-builder gallery.
 * Each template has a deliberately different layout signature so the user
 * sees real variety in the gallery — not the same skeleton with swapped
 * colors.
 *
 * The text/header `content` is rendered as a plain string in the live
 * canvas (the page reads `block.content` directly with
 * `whiteSpace: pre-line`), so visual rhythm is built from `\n` line breaks
 * and unicode glyphs (• ▸ ✓ →) rather than inline HTML. The sent-email
 * pipeline (`buildEmailHTML` in `./email-builder.ts`) is what turns blocks
 * into the marketing HTML.
 *
 * Image URLs use only `placehold.co` (with `/png` so Next/Image accepts
 * them), `images.unsplash.com` (curated photo IDs), and `picsum.photos`
 * (seeded) — all three are allowlisted in `next.config.js`.
 */

import type { EmailTemplate, EmailBlock, EmailVariable } from '@/lib/email/email-builder';

export type TemplateCategory =
  | 'welcome'
  | 'product'
  | 'promotional'
  | 'newsletter'
  | 'transactional'
  | 'reengagement'
  | 'event'
  | 'sales';

export interface TemplateCategoryMeta {
  id: TemplateCategory;
  label: string;
  description: string;
}

export interface SeededEmailTemplate {
  /** Stable id used by the gallery + `getSeededTemplate(id)`. */
  id: string;
  /** Display name shown on the gallery card. */
  name: string;
  /** One-sentence description for the gallery card. */
  description: string;
  /** Single emoji used as the gallery thumbnail. */
  iconEmoji: string;
  /** High-level grouping for filter chips. */
  category: TemplateCategory;
  /** The template payload, ready to clone into the builder. */
  template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>;
}

// ---------------------------------------------------------------------------
// Filter-chip metadata for the gallery UI.
// ---------------------------------------------------------------------------

export const TEMPLATE_CATEGORIES: TemplateCategoryMeta[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    description: 'First touch with a new signup',
  },
  {
    id: 'product',
    label: 'Product',
    description: 'Launches, feature spotlights, release notes',
  },
  {
    id: 'promotional',
    label: 'Promotional',
    description: 'Sales, discounts, limited-time offers',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Recurring digests and roundups',
  },
  {
    id: 'transactional',
    label: 'Transactional',
    description: 'Receipts, confirmations, alerts',
  },
  {
    id: 'reengagement',
    label: 'Re-engagement',
    description: 'Win back inactive users',
  },
  {
    id: 'event',
    label: 'Event',
    description: 'Webinars, invites, reminders',
  },
  {
    id: 'sales',
    label: 'Sales Outreach',
    description: 'Cold intros, demo follow-ups',
  },
];

// ---------------------------------------------------------------------------
// Block builder helper — keeps the per-template specs readable.
// ---------------------------------------------------------------------------

type BlockSpec = {
  type: EmailBlock['type'];
  content: string;
  styling?: EmailBlock['styling'];
};

function buildBlocks(templateId: string, specs: BlockSpec[]): EmailBlock[] {
  return specs.map((spec, index) => ({
    id: `${templateId}-${index}`,
    type: spec.type,
    content: spec.content,
    styling: spec.styling ?? {},
    order: index + 1,
  }));
}

// ---------------------------------------------------------------------------
// 1. Welcome / Onboarding  (category: welcome)
//    Layout: full-bleed hero photo → big greeting → 4-step numbered onboarding
//    → primary CTA → soft secondary CTA in text → footer.
// ---------------------------------------------------------------------------

const WELCOME_ID = 'welcome-onboarding';

const WELCOME_VARIABLES: EmailVariable[] = [
  {
    key: 'first_name',
    label: 'First Name',
    defaultValue: 'there',
    source: 'contact',
    sourceField: 'firstName',
  },
  {
    key: 'company_name',
    label: 'Your Company',
    defaultValue: 'SalesVelocity.ai',
    source: 'custom',
  },
  {
    key: 'dashboard_url',
    label: 'Dashboard URL',
    defaultValue: 'https://salesvelocity.ai/dashboard',
    source: 'custom',
  },
];

const WELCOME_BLOCKS: BlockSpec[] = [
  {
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop&auto=format',
    styling: { alignment: 'center', padding: '0 0 24px 0' },
  },
  {
    type: 'header',
    content: 'Welcome aboard, {{first_name}}.',
    styling: {
      alignment: 'left',
      padding: '8px 0 4px 0',
      textColor: '#111827',
      fontSize: '32px',
    },
  },
  {
    type: 'text',
    content:
      "You just unlocked an AI-powered growth engine — CRM, outreach, content, and analytics in one place. We've laid out four short steps below to take you from sign-up to your first AI-assisted win in under ten minutes. Pour a coffee. Let's go.",
    styling: {
      alignment: 'left',
      padding: '4px 0 20px 0',
      textColor: '#374151',
      fontSize: '17px',
    },
  },
  {
    type: 'text',
    content:
      'STEP 1   Connect your inbox\nLet Jasper, your AI sales chief, see replies so he can rank leads by intent and surface the conversations that matter.',
    styling: {
      alignment: 'left',
      padding: '8px 0',
      textColor: '#374151',
      fontSize: '16px',
    },
  },
  {
    type: 'text',
    content:
      'STEP 2   Import your contacts\nDrop a CSV, paste a list, or wire up HubSpot, Pipedrive, or Google Workspace in one click. Jasper enriches every record automatically.',
    styling: {
      alignment: 'left',
      padding: '8px 0',
      textColor: '#374151',
      fontSize: '16px',
    },
  },
  {
    type: 'text',
    content:
      "STEP 3   Pick a campaign template\nChoose from cold outreach, re-engagement, or product launch playbooks. The AI drafts every email in your voice — you approve every send.",
    styling: {
      alignment: 'left',
      padding: '8px 0',
      textColor: '#374151',
      fontSize: '16px',
    },
  },
  {
    type: 'text',
    content:
      'STEP 4   Watch the pipeline move\nOpen Mission Control to see Jasper book meetings, qualify leads, and close gaps — all with you in the loop on every decision.',
    styling: {
      alignment: 'left',
      padding: '8px 0 24px 0',
      textColor: '#374151',
      fontSize: '16px',
    },
  },
  {
    type: 'button',
    content: 'Open your dashboard  →',
    styling: {
      alignment: 'center',
      padding: '8px 0 16px 0',
      buttonColor: '#4F46E5',
      buttonTextColor: '#FFFFFF',
      buttonUrl: '{{dashboard_url}}',
    },
  },
  {
    type: 'text',
    content:
      "Prefer a guided tour? Reply to this email or book 15 minutes with our onboarding team — we're real humans and we answer fast.",
    styling: {
      alignment: 'center',
      padding: '4px 0 24px 0',
      textColor: '#6B7280',
      fontSize: '14px',
    },
  },
  {
    type: 'footer',
    content:
      "SalesVelocity.ai  •  You're receiving this because {{company_name}} signed up at salesvelocity.ai.\nManage preferences  •  Unsubscribe",
    styling: { alignment: 'center', padding: '24px 0 0 0' },
  },
];

const WELCOME_TEMPLATE: SeededEmailTemplate = {
  id: WELCOME_ID,
  name: 'Welcome / Onboarding',
  description:
    'Warm first-touch email for new signups — hero photo, four onboarding steps, and a clear CTA to the dashboard.',
  iconEmoji: '🎉',
  category: 'welcome',
  template: {
    name: 'Welcome / Onboarding',
    subject: 'Welcome to SalesVelocity.ai, {{first_name}} — let’s get you set up',
    preheader: "Four quick steps to your first AI-powered win. Less than ten minutes start to finish.",
    blocks: buildBlocks(WELCOME_ID, WELCOME_BLOCKS),
    variables: WELCOME_VARIABLES,
    styling: {
      backgroundColor: '#FAFAFB',
      primaryColor: '#4F46E5',
      fontFamily: 'Helvetica, Arial, sans-serif',
    },
    category: 'welcome',
    isDefault: false,
  },
};

// ---------------------------------------------------------------------------
// 2. Product Launch — Big  (category: product)
//    Layout: badge → punchy headline → intro → feature 1 (image + headline +
//    copy + CTA) → divider → feature 2 (image + headline + copy + CTA) →
//    final big CTA → footer.
// ---------------------------------------------------------------------------

const PRODUCT_LAUNCH_ID = 'product-launch-big';

const PRODUCT_LAUNCH_VARIABLES: EmailVariable[] = [
  {
    key: 'first_name',
    label: 'First Name',
    defaultValue: 'there',
    source: 'contact',
    sourceField: 'firstName',
  },
  {
    key: 'launch_url',
    label: 'Launch URL',
    defaultValue: 'https://salesvelocity.ai/launch',
    source: 'custom',
  },
];

const PRODUCT_LAUNCH_BLOCKS: BlockSpec[] = [
  {
    type: 'text',
    content: 'NEW  •  LIMITED BETA',
    styling: {
      alignment: 'center',
      padding: '0 0 12px 0',
      textColor: '#10B981',
      fontSize: '12px',
    },
  },
  {
    type: 'header',
    content: 'Your pipeline just got an AI co-pilot.',
    styling: {
      alignment: 'center',
      padding: '4px 0',
      textColor: '#111827',
      fontSize: '34px',
    },
  },
  {
    type: 'text',
    content:
      "Hey {{first_name}} — today we're flipping the switch on two features we've been quietly building for six months. Both are live in your account right now. Both are free during the beta. We'd love your reaction.",
    styling: {
      alignment: 'center',
      padding: '8px 0 28px 0',
      textColor: '#374151',
      fontSize: '17px',
    },
  },
  {
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1454789548928-9efd52dc4031?w=600&h=300&fit=crop&auto=format',
    styling: { alignment: 'center', padding: '0' },
  },
  {
    type: 'header',
    content: '01   Smart Reply',
    styling: {
      alignment: 'left',
      padding: '20px 0 4px 0',
      textColor: '#10B981',
      fontSize: '22px',
    },
  },
  {
    type: 'text',
    content:
      "Jasper now reads every inbound reply, scores intent in real time, and drafts a response in your voice. You approve in one click — or edit, then send. The average response time on your team just dropped to under two minutes.",
    styling: {
      alignment: 'left',
      padding: '4px 0 12px 0',
      textColor: '#374151',
      fontSize: '16px',
    },
  },
  {
    type: 'button',
    content: 'See Smart Reply in action',
    styling: {
      alignment: 'left',
      padding: '4px 0 28px 0',
      buttonColor: '#10B981',
      buttonTextColor: '#FFFFFF',
      buttonUrl: '{{launch_url}}/smart-reply',
    },
  },
  {
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&h=300&fit=crop&auto=format',
    styling: { alignment: 'center', padding: '12px 0 0 0' },
  },
  {
    type: 'header',
    content: '02   Pipeline Pulse',
    styling: {
      alignment: 'left',
      padding: '20px 0 4px 0',
      textColor: '#10B981',
      fontSize: '22px',
    },
  },
  {
    type: 'text',
    content:
      "Every Monday at 8am, Jasper sends a one-paragraph pulse on your top three deals — who's hot, who's stalled, and exactly what to do next. It's the deal review your VP of Sales wishes they had time to write.",
    styling: {
      alignment: 'left',
      padding: '4px 0 12px 0',
      textColor: '#374151',
      fontSize: '16px',
    },
  },
  {
    type: 'button',
    content: 'Turn on Pipeline Pulse  →',
    styling: {
      alignment: 'center',
      padding: '24px 0',
      buttonColor: '#10B981',
      buttonTextColor: '#FFFFFF',
      buttonUrl: '{{launch_url}}',
    },
  },
  {
    type: 'footer',
    content:
      'SalesVelocity.ai  •  Sent because you opted in to product announcements.\nUpdate email preferences  •  Unsubscribe from launches',
    styling: { alignment: 'center', padding: '24px 0 0 0' },
  },
];

const PRODUCT_LAUNCH_TEMPLATE: SeededEmailTemplate = {
  id: PRODUCT_LAUNCH_ID,
  name: 'Product Launch — Big',
  description:
    "Two-feature launch announcement with sharp benefit copy, urgency framing, and a final 'try it now' CTA.",
  iconEmoji: '🚀',
  category: 'product',
  template: {
    name: 'Product Launch — Big',
    subject: '[New] Two features that just landed in your account',
    preheader: 'Smart Reply + Pipeline Pulse — both free during the beta. Try them in one click.',
    blocks: buildBlocks(PRODUCT_LAUNCH_ID, PRODUCT_LAUNCH_BLOCKS),
    variables: PRODUCT_LAUNCH_VARIABLES,
    styling: {
      backgroundColor: '#FFFFFF',
      primaryColor: '#10B981',
      fontFamily: 'Helvetica, Arial, sans-serif',
    },
    category: 'product',
    isDefault: false,
  },
};

// ---------------------------------------------------------------------------
// 3. Newsletter / Monthly Digest  (category: newsletter)
//    Layout: branded banner → editorial title + intro → divider →
//    article card x3 (image → headline → 2-line dek → 'Read more' button →
//    divider) → P.S. note → footer.
// ---------------------------------------------------------------------------

const NEWSLETTER_ID = 'newsletter-monthly-digest';

const NEWSLETTER_VARIABLES: EmailVariable[] = [
  {
    key: 'first_name',
    label: 'First Name',
    defaultValue: 'there',
    source: 'contact',
    sourceField: 'firstName',
  },
  {
    key: 'month_name',
    label: 'Month',
    defaultValue: 'this month',
    source: 'custom',
  },
  {
    key: 'blog_url',
    label: 'Blog URL',
    defaultValue: 'https://salesvelocity.ai/blog',
    source: 'custom',
  },
];

const NEWSLETTER_BLOCKS: BlockSpec[] = [
  {
    type: 'image',
    content: 'https://placehold.co/600x120/475569/FFFFFF/png?text=Monthly+Digest',
    styling: { alignment: 'center', padding: '0 0 24px 0' },
  },
  {
    type: 'header',
    content: 'The {{month_name}} Digest',
    styling: {
      alignment: 'left',
      padding: '4px 0',
      textColor: '#1F2937',
      fontSize: '30px',
    },
  },
  {
    type: 'text',
    content:
      "Hi {{first_name}} — three reads worth your time this month, hand-picked by our editorial team. We aim for under five minutes per piece, with the numbers you'd actually want to remember in a meeting.",
    styling: {
      alignment: 'left',
      padding: '4px 0 24px 0',
      textColor: '#475569',
      fontSize: '16px',
    },
  },
  // Article 1 — books + coffee
  {
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=240&fit=crop&auto=format',
    styling: { alignment: 'center', padding: '8px 0 12px 0' },
  },
  {
    type: 'header',
    content: 'Five AI sales plays that actually closed deals last quarter',
    styling: {
      alignment: 'left',
      padding: '4px 0',
      textColor: '#1F2937',
      fontSize: '22px',
    },
  },
  {
    type: 'text',
    content:
      "We pulled anonymized data from 200+ SalesVelocity teams and found the five outbound sequences that converted at 3x the industry average.\nSpoiler: it isn't about volume — it's about timing and channel-mix.",
    styling: {
      alignment: 'left',
      padding: '4px 0 12px 0',
      textColor: '#374151',
      fontSize: '15px',
    },
  },
  {
    type: 'button',
    content: 'Read the breakdown  →',
    styling: {
      alignment: 'left',
      padding: '4px 0 24px 0',
      buttonColor: '#475569',
      buttonTextColor: '#FFFFFF',
      buttonUrl: '{{blog_url}}/five-ai-sales-plays',
    },
  },
  {
    type: 'divider',
    content: '',
    styling: { padding: '4px 0' },
  },
  // Article 2 — laptop work
  {
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&h=240&fit=crop&auto=format',
    styling: { alignment: 'center', padding: '20px 0 12px 0' },
  },
  {
    type: 'header',
    content: 'How to triage 200 inbox replies in 10 minutes',
    styling: {
      alignment: 'left',
      padding: '4px 0',
      textColor: '#1F2937',
      fontSize: '22px',
    },
  },
  {
    type: 'text',
    content:
      "Our customers asked for a faster reply workflow, so we built one — and put the AI scoring model behind it.\nHere's the new inbox view, the model's confidence math, and a 90-second toggle to turn it on.",
    styling: {
      alignment: 'left',
      padding: '4px 0 12px 0',
      textColor: '#374151',
      fontSize: '15px',
    },
  },
  {
    type: 'button',
    content: 'See the new workflow  →',
    styling: {
      alignment: 'left',
      padding: '4px 0 24px 0',
      buttonColor: '#475569',
      buttonTextColor: '#FFFFFF',
      buttonUrl: '{{blog_url}}/inbox-triage',
    },
  },
  {
    type: 'divider',
    content: '',
    styling: { padding: '4px 0' },
  },
  // Article 3 — clean desk
  {
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=240&fit=crop&auto=format',
    styling: { alignment: 'center', padding: '20px 0 12px 0' },
  },
  {
    type: 'header',
    content: 'Case study: how Acme cut their sales cycle by 40%',
    styling: {
      alignment: 'left',
      padding: '4px 0',
      textColor: '#1F2937',
      fontSize: '22px',
    },
  },
  {
    type: 'text',
    content:
      "A 12-person revenue team replaced four tools with SalesVelocity and watched their average deal close in 18 days instead of 30.\nThe full playbook — including their qualification rubric — is in the link below.",
    styling: {
      alignment: 'left',
      padding: '4px 0 12px 0',
      textColor: '#374151',
      fontSize: '15px',
    },
  },
  {
    type: 'button',
    content: 'Read the case study  →',
    styling: {
      alignment: 'left',
      padding: '4px 0 24px 0',
      buttonColor: '#475569',
      buttonTextColor: '#FFFFFF',
      buttonUrl: '{{blog_url}}/acme-case-study',
    },
  },
  {
    type: 'divider',
    content: '',
    styling: { padding: '4px 0' },
  },
  {
    type: 'text',
    content:
      "P.S. — We're always hunting for the next great story. If your team has a metric you're proud of, hit reply and tell us. Our editor reads everything.",
    styling: {
      alignment: 'left',
      padding: '20px 0 24px 0',
      textColor: '#6B7280',
      fontSize: '14px',
    },
  },
  {
    type: 'footer',
    content:
      'The SalesVelocity Digest  •  Sent on the first Tuesday of every month.\nManage preferences  •  Unsubscribe from the Digest',
    styling: { alignment: 'center', padding: '24px 0 0 0' },
  },
];

const NEWSLETTER_TEMPLATE: SeededEmailTemplate = {
  id: NEWSLETTER_ID,
  name: 'Newsletter / Monthly Digest',
  description:
    'Editorial-feel monthly roundup with three article cards, hero photos, and per-section CTAs. Drop-in ready.',
  iconEmoji: '📰',
  category: 'newsletter',
  template: {
    name: 'Newsletter / Monthly Digest',
    subject: 'The {{month_name}} Digest — 3 reads on AI-powered revenue',
    preheader: 'Five sales plays, a faster inbox, and a 40% shorter sales cycle. Under fifteen minutes total.',
    blocks: buildBlocks(NEWSLETTER_ID, NEWSLETTER_BLOCKS),
    variables: NEWSLETTER_VARIABLES,
    styling: {
      backgroundColor: '#FAFAF9',
      primaryColor: '#475569',
      fontFamily: 'Georgia, "Times New Roman", serif',
    },
    category: 'newsletter',
    isDefault: false,
  },
};

// ---------------------------------------------------------------------------
// 4. Transactional / Receipt  (category: transactional)
//    Layout: PAID badge → "Payment received" header → thank you →
//    order details → divider → bold total → primary CTA to full receipt →
//    support text → can-spam-exempt footer.
// ---------------------------------------------------------------------------

const RECEIPT_ID = 'transactional-receipt';

const RECEIPT_VARIABLES: EmailVariable[] = [
  {
    key: 'first_name',
    label: 'First Name',
    defaultValue: 'there',
    source: 'contact',
    sourceField: 'firstName',
  },
  {
    key: 'order_number',
    label: 'Order Number',
    defaultValue: 'SV-000000',
    source: 'custom',
  },
  {
    key: 'order_date',
    label: 'Order Date',
    defaultValue: 'today',
    source: 'custom',
  },
  {
    key: 'plan_name',
    label: 'Plan Name',
    defaultValue: 'Growth (Monthly)',
    source: 'custom',
  },
  {
    key: 'plan_amount',
    label: 'Plan Amount',
    defaultValue: '$0.00',
    source: 'custom',
  },
  {
    key: 'tax_amount',
    label: 'Tax',
    defaultValue: '$0.00',
    source: 'custom',
  },
  {
    key: 'total_amount',
    label: 'Total',
    defaultValue: '$0.00',
    source: 'custom',
  },
  {
    key: 'receipt_url',
    label: 'Receipt URL',
    defaultValue: 'https://salesvelocity.ai/billing',
    source: 'custom',
  },
];

const RECEIPT_BLOCKS: BlockSpec[] = [
  {
    type: 'image',
    content: 'https://placehold.co/120x120/0EA5E9/FFFFFF/png?text=PAID',
    styling: { alignment: 'center', padding: '8px 0 16px 0' },
  },
  {
    type: 'header',
    content: 'Payment received',
    styling: {
      alignment: 'center',
      padding: '0 0 4px 0',
      textColor: '#0F172A',
      fontSize: '26px',
    },
  },
  {
    type: 'text',
    content:
      "Thanks, {{first_name}}. We've charged your card and your subscription is active. A copy of this receipt is saved to your billing dashboard.",
    styling: {
      alignment: 'center',
      padding: '4px 0 24px 0',
      textColor: '#475569',
      fontSize: '15px',
    },
  },
  {
    type: 'divider',
    content: '',
    styling: { padding: '4px 0' },
  },
  {
    type: 'text',
    content:
      'ORDER {{order_number}}\nDate   {{order_date}}\nMethod   Card on file',
    styling: {
      alignment: 'left',
      padding: '16px 0 8px 0',
      textColor: '#0F172A',
      fontSize: '14px',
    },
  },
  {
    type: 'text',
    content: '{{plan_name}}                          {{plan_amount}}',
    styling: {
      alignment: 'left',
      padding: '12px 0 4px 0',
      textColor: '#0F172A',
      fontSize: '15px',
    },
  },
  {
    type: 'text',
    content: 'Tax                                          {{tax_amount}}',
    styling: {
      alignment: 'left',
      padding: '0 0 12px 0',
      textColor: '#475569',
      fontSize: '15px',
    },
  },
  {
    type: 'divider',
    content: '',
    styling: { padding: '4px 0' },
  },
  {
    type: 'text',
    content: 'TOTAL  CHARGED                   {{total_amount}}',
    styling: {
      alignment: 'right',
      padding: '12px 0 24px 0',
      textColor: '#0F172A',
      fontSize: '20px',
    },
  },
  {
    type: 'button',
    content: 'View full receipt online',
    styling: {
      alignment: 'center',
      padding: '8px 0 24px 0',
      buttonColor: '#0EA5E9',
      buttonTextColor: '#FFFFFF',
      buttonUrl: '{{receipt_url}}',
    },
  },
  {
    type: 'text',
    content:
      'Questions about your bill? Reply to this email or write to billing@salesvelocity.ai. We respond within one business day.',
    styling: {
      alignment: 'center',
      padding: '4px 0 8px 0',
      textColor: '#6B7280',
      fontSize: '13px',
    },
  },
  {
    type: 'footer',
    content:
      'SalesVelocity.ai  •  This is a transactional email about your account and cannot be unsubscribed from per CAN-SPAM §316.2.\nFor marketing email preferences, visit your billing settings.',
    styling: { alignment: 'center', padding: '24px 0 0 0' },
  },
];

const RECEIPT_TEMPLATE: SeededEmailTemplate = {
  id: RECEIPT_ID,
  name: 'Transactional / Receipt',
  description:
    'Stripe-clean payment confirmation with order summary, total, and a link to the billing dashboard.',
  iconEmoji: '🧾',
  category: 'transactional',
  template: {
    name: 'Transactional / Receipt',
    subject: 'Receipt for order {{order_number}}',
    preheader: 'Your payment was successful. Receipt and invoice details inside.',
    blocks: buildBlocks(RECEIPT_ID, RECEIPT_BLOCKS),
    variables: RECEIPT_VARIABLES,
    styling: {
      backgroundColor: '#F0F9FF',
      primaryColor: '#0EA5E9',
      fontFamily: 'Helvetica, Arial, sans-serif',
    },
    category: 'transactional',
    isDefault: false,
  },
};

// ---------------------------------------------------------------------------
// 5. Product Feature Spotlight  (category: product)
//    Layout: small badge → large headline → hero image → 3 benefit bullets →
//    CTA → footer. Single-feature deep dive, indigo palette.
// ---------------------------------------------------------------------------

const FEATURE_SPOTLIGHT_ID = 'product-feature-spotlight';

const FEATURE_SPOTLIGHT_VARIABLES: EmailVariable[] = [
  {
    key: 'first_name',
    label: 'First Name',
    defaultValue: 'there',
    source: 'contact',
    sourceField: 'firstName',
  },
  {
    key: 'feature_url',
    label: 'Feature URL',
    defaultValue: 'https://salesvelocity.ai/insights',
    source: 'custom',
  },
];

const FEATURE_SPOTLIGHT_BLOCKS: BlockSpec[] = [
  {
    type: 'text',
    content: 'FEATURE SPOTLIGHT',
    styling: {
      alignment: 'center',
      padding: '0 0 12px 0',
      textColor: '#6366F1',
      fontSize: '12px',
    },
  },
  {
    type: 'header',
    content: 'Meet Insights — the metric layer that finally answers "why did revenue move?"',
    styling: {
      alignment: 'center',
      padding: '4px 0 20px 0',
      textColor: '#0F172A',
      fontSize: '30px',
    },
  },
  {
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop&auto=format',
    styling: { alignment: 'center', padding: '0 0 24px 0' },
  },
  {
    type: 'text',
    content:
      "Hi {{first_name}} — Insights connects every pipeline event to the revenue outcome it caused. No more guessing whether the new outbound sequence is working. No more dragging six tabs into a spreadsheet. Just one question, asked in plain English, answered in seconds.",
    styling: {
      alignment: 'left',
      padding: '4px 0 20px 0',
      textColor: '#374151',
      fontSize: '16px',
    },
  },
  {
    type: 'text',
    content:
      '✓  Ask in plain English\nType "which campaign drove the most demos last week" and Insights returns the answer plus a one-paragraph why.',
    styling: {
      alignment: 'left',
      padding: '8px 0',
      textColor: '#374151',
      fontSize: '16px',
    },
  },
  {
    type: 'text',
    content:
      '✓  Auto-attributed across channels\nEmail, calls, SMS, social — every touchpoint rolls up to the deal it influenced. No tag soup, no manual mapping.',
    styling: {
      alignment: 'left',
      padding: '8px 0',
      textColor: '#374151',
      fontSize: '16px',
    },
  },
  {
    type: 'text',
    content:
      "✓  Anomaly alerts on by default\nJasper pings you the moment a metric moves more than 2σ off trend — before it becomes a Monday-morning fire.",
    styling: {
      alignment: 'left',
      padding: '8px 0 24px 0',
      textColor: '#374151',
      fontSize: '16px',
    },
  },
  {
    type: 'button',
    content: 'Open Insights  →',
    styling: {
      alignment: 'center',
      padding: '8px 0 24px 0',
      buttonColor: '#6366F1',
      buttonTextColor: '#FFFFFF',
      buttonUrl: '{{feature_url}}',
    },
  },
  {
    type: 'footer',
    content:
      'SalesVelocity.ai  •  Sent because you opted in to product spotlights.\nManage preferences  •  Unsubscribe from feature updates',
    styling: { alignment: 'center', padding: '24px 0 0 0' },
  },
];

const FEATURE_SPOTLIGHT_TEMPLATE: SeededEmailTemplate = {
  id: FEATURE_SPOTLIGHT_ID,
  name: 'Product Feature Spotlight',
  description:
    'Single-feature deep dive with hero shot, three benefit bullets, and a clean CTA. Use for one big idea at a time.',
  iconEmoji: '💡',
  category: 'product',
  template: {
    name: 'Product Feature Spotlight',
    subject: 'New in your account: Insights answers "why did revenue move?"',
    preheader: 'Ask in plain English, get auto-attribution across every channel. Open in your dashboard.',
    blocks: buildBlocks(FEATURE_SPOTLIGHT_ID, FEATURE_SPOTLIGHT_BLOCKS),
    variables: FEATURE_SPOTLIGHT_VARIABLES,
    styling: {
      backgroundColor: '#F5F5FF',
      primaryColor: '#6366F1',
      fontFamily: 'Helvetica, Arial, sans-serif',
    },
    category: 'product',
    isDefault: false,
  },
};

// ---------------------------------------------------------------------------
// 6. Re-engagement / We Miss You  (category: reengagement)
//    Layout: moody sunrise hero → big "We miss you" header → empathetic body →
//    "Here's what you missed" 3-item recap → come-back CTA → soft footer.
// ---------------------------------------------------------------------------

const REENGAGEMENT_ID = 'reengagement-we-miss-you';

const REENGAGEMENT_VARIABLES: EmailVariable[] = [
  {
    key: 'first_name',
    label: 'First Name',
    defaultValue: 'there',
    source: 'contact',
    sourceField: 'firstName',
  },
  {
    key: 'return_url',
    label: 'Return URL',
    defaultValue: 'https://salesvelocity.ai/dashboard',
    source: 'custom',
  },
];

const REENGAGEMENT_BLOCKS: BlockSpec[] = [
  {
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&auto=format',
    styling: { alignment: 'center', padding: '0 0 24px 0' },
  },
  {
    type: 'header',
    content: 'We miss you, {{first_name}}.',
    styling: {
      alignment: 'left',
      padding: '8px 0 4px 0',
      textColor: '#1F2937',
      fontSize: '34px',
    },
  },
  {
    type: 'text',
    content:
      "It's been a minute since we last saw you in SalesVelocity, and we wanted to check in — no sales pitch, no guilt trip. Just a quick note to say the door is still open, your data is still here, and a lot has changed in a good way since you stepped away.",
    styling: {
      alignment: 'left',
      padding: '4px 0 20px 0',
      textColor: '#374151',
      fontSize: '17px',
    },
  },
  {
    type: 'header',
    content: "Here's what you missed",
    styling: {
      alignment: 'left',
      padding: '12px 0 8px 0',
      textColor: '#1F2937',
      fontSize: '20px',
    },
  },
  {
    type: 'text',
    content:
      '▸  Jasper, your AI sales chief\nHe drafts emails in your voice, scores intent on every reply, and books meetings while you sleep. Most users tell us he saved them their first hour by day two.',
    styling: {
      alignment: 'left',
      padding: '8px 0',
      textColor: '#374151',
      fontSize: '15px',
    },
  },
  {
    type: 'text',
    content:
      '▸  Mission Control\nA single screen for every campaign, every reply, every deal. You stay in the loop on every send without juggling six tabs.',
    styling: {
      alignment: 'left',
      padding: '8px 0',
      textColor: '#374151',
      fontSize: '15px',
    },
  },
  {
    type: 'text',
    content:
      "▸  Insights you can actually use\nPlain-English questions, real revenue answers, anomaly alerts on by default. No spreadsheet wrangling needed.",
    styling: {
      alignment: 'left',
      padding: '8px 0 24px 0',
      textColor: '#374151',
      fontSize: '15px',
    },
  },
  {
    type: 'button',
    content: 'Come back and take a look',
    styling: {
      alignment: 'center',
      padding: '8px 0 24px 0',
      buttonColor: '#F59E0B',
      buttonTextColor: '#1F2937',
      buttonUrl: '{{return_url}}',
    },
  },
  {
    type: 'text',
    content:
      "Not the right time? Totally fair. One click on the unsubscribe link below and we'll quietly bow out — no follow-ups, no last-chance emails. We'll be here whenever you're ready.",
    styling: {
      alignment: 'center',
      padding: '4px 0 16px 0',
      textColor: '#6B7280',
      fontSize: '14px',
    },
  },
  {
    type: 'footer',
    content:
      "SalesVelocity.ai  •  We send these only when an account has been quiet for 60+ days.\nManage preferences  •  Unsubscribe in one click",
    styling: { alignment: 'center', padding: '24px 0 0 0' },
  },
];

const REENGAGEMENT_TEMPLATE: SeededEmailTemplate = {
  id: REENGAGEMENT_ID,
  name: 'Re-engagement / We Miss You',
  description:
    'Empathetic win-back email with a moody hero, what-you-missed recap, and a soft come-back CTA. No guilt trip.',
  iconEmoji: '👋',
  category: 'reengagement',
  template: {
    name: 'Re-engagement / We Miss You',
    subject: 'We miss you, {{first_name}} — no pitch, just a quick check-in',
    preheader: "A lot has changed since you stepped away. Here's what's new — and how to come back.",
    blocks: buildBlocks(REENGAGEMENT_ID, REENGAGEMENT_BLOCKS),
    variables: REENGAGEMENT_VARIABLES,
    styling: {
      backgroundColor: '#FFFBEB',
      primaryColor: '#F59E0B',
      fontFamily: 'Helvetica, Arial, sans-serif',
    },
    category: 'reengagement',
    isDefault: false,
  },
};

// ---------------------------------------------------------------------------
// 7. Event / Webinar Invite  (category: event)
//    Layout: event banner → "You're invited" badge → event title → date/time/
//    host block → 3-line description → "Save my seat" CTA → calendar link →
//    footer.
// ---------------------------------------------------------------------------

const EVENT_ID = 'event-webinar-invite';

const EVENT_VARIABLES: EmailVariable[] = [
  {
    key: 'first_name',
    label: 'First Name',
    defaultValue: 'there',
    source: 'contact',
    sourceField: 'firstName',
  },
  {
    key: 'event_date',
    label: 'Event Date',
    defaultValue: 'Thursday, June 12',
    source: 'custom',
  },
  {
    key: 'event_time',
    label: 'Event Time',
    defaultValue: '11:00 AM PT / 2:00 PM ET',
    source: 'custom',
  },
  {
    key: 'event_host',
    label: 'Event Host',
    defaultValue: 'David Stamper, Founder',
    source: 'custom',
  },
  {
    key: 'register_url',
    label: 'Register URL',
    defaultValue: 'https://salesvelocity.ai/webinar',
    source: 'custom',
  },
  {
    key: 'calendar_url',
    label: 'Add to Calendar URL',
    defaultValue: 'https://salesvelocity.ai/webinar/calendar.ics',
    source: 'custom',
  },
];

const EVENT_BLOCKS: BlockSpec[] = [
  {
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600&h=300&fit=crop&auto=format',
    styling: { alignment: 'center', padding: '0 0 24px 0' },
  },
  {
    type: 'text',
    content: "YOU'RE INVITED  •  LIVE WEBINAR",
    styling: {
      alignment: 'center',
      padding: '4px 0 8px 0',
      textColor: '#8B5CF6',
      fontSize: '12px',
    },
  },
  {
    type: 'header',
    content: 'The AI-Powered Pipeline: 5 plays we ran on 200 SMB teams',
    styling: {
      alignment: 'center',
      padding: '4px 0 20px 0',
      textColor: '#1F2937',
      fontSize: '30px',
    },
  },
  {
    type: 'text',
    content:
      'WHEN   {{event_date}}\nTIME   {{event_time}}\nHOST   {{event_host}}\nWHERE   Live on Zoom (recording sent to registrants)',
    styling: {
      alignment: 'left',
      padding: '12px 0 20px 0',
      textColor: '#1F2937',
      fontSize: '15px',
    },
  },
  {
    type: 'text',
    content:
      "Hi {{first_name}} — we pulled anonymized data from 200 SMB teams running SalesVelocity and found five outbound plays that consistently hit 3x the industry conversion rate.\nIn 45 minutes, we'll walk through every one — the sequence, the AI prompts, the timing math, and the metrics we tracked.\nBring questions. We'll save the last 15 minutes for live Q&A.",
    styling: {
      alignment: 'left',
      padding: '4px 0 24px 0',
      textColor: '#374151',
      fontSize: '16px',
    },
  },
  {
    type: 'button',
    content: 'Save my seat',
    styling: {
      alignment: 'center',
      padding: '8px 0 16px 0',
      buttonColor: '#8B5CF6',
      buttonTextColor: '#FFFFFF',
      buttonUrl: '{{register_url}}',
    },
  },
  {
    type: 'text',
    content: 'Or add it straight to your calendar: {{calendar_url}}',
    styling: {
      alignment: 'center',
      padding: '4px 0 16px 0',
      textColor: '#8B5CF6',
      fontSize: '14px',
    },
  },
  {
    type: 'text',
    content:
      "Can't make it live? Register anyway and we'll send you the full recording plus the 5-play playbook PDF the next morning.",
    styling: {
      alignment: 'center',
      padding: '4px 0 24px 0',
      textColor: '#6B7280',
      fontSize: '14px',
    },
  },
  {
    type: 'footer',
    content:
      'SalesVelocity.ai  •  Sent because you opted in to event invites.\nManage event preferences  •  Unsubscribe from webinars',
    styling: { alignment: 'center', padding: '24px 0 0 0' },
  },
];

const EVENT_TEMPLATE: SeededEmailTemplate = {
  id: EVENT_ID,
  name: 'Event / Webinar Invite',
  description:
    'Live-webinar invite with banner image, date/time/host block, "save my seat" CTA, and calendar link. Q&A-ready.',
  iconEmoji: '🎤',
  category: 'event',
  template: {
    name: 'Event / Webinar Invite',
    subject: "You're invited: {{event_date}} — 5 AI plays that closed deals last quarter",
    preheader: 'Live webinar, 45 minutes, real numbers from 200 SMB teams. Recording sent to registrants.',
    blocks: buildBlocks(EVENT_ID, EVENT_BLOCKS),
    variables: EVENT_VARIABLES,
    styling: {
      backgroundColor: '#FAF5FF',
      primaryColor: '#8B5CF6',
      fontFamily: 'Helvetica, Arial, sans-serif',
    },
    category: 'event',
    isDefault: false,
  },
};

// ---------------------------------------------------------------------------
// 8. Sales Cold Intro  (category: sales)
//    Layout: plain "Hi {{first_name}}" → opener paragraph → value prop →
//    soft CTA button → P.S. social proof → plain text signature → footer.
//    Intentionally PLAIN — looks like a 1:1 hand-written note, not a blast.
// ---------------------------------------------------------------------------

const SALES_ID = 'sales-cold-intro';

const SALES_VARIABLES: EmailVariable[] = [
  {
    key: 'first_name',
    label: 'First Name',
    defaultValue: 'there',
    source: 'contact',
    sourceField: 'firstName',
  },
  {
    key: 'company_name',
    label: 'Recipient Company',
    defaultValue: 'your team',
    source: 'contact',
    sourceField: 'company',
  },
  {
    key: 'sender_name',
    label: 'Sender Name',
    defaultValue: 'David Stamper',
    source: 'custom',
  },
  {
    key: 'meeting_url',
    label: 'Meeting URL',
    defaultValue: 'https://salesvelocity.ai/book/david',
    source: 'custom',
  },
];

const SALES_BLOCKS: BlockSpec[] = [
  {
    type: 'header',
    content: 'Hi {{first_name}},',
    styling: {
      alignment: 'left',
      padding: '0 0 16px 0',
      textColor: '#1E3A8A',
      fontSize: '20px',
    },
  },
  {
    type: 'text',
    content:
      "I'll keep this short. I noticed {{company_name}} is growing the revenue team, and I wanted to reach out because the founders we work with usually hit a familiar wall around this size — too many leads to manually triage, not enough hours to keep up, and CRM hygiene that quietly slips every week.",
    styling: {
      alignment: 'left',
      padding: '8px 0',
      textColor: '#1F2937',
      fontSize: '16px',
    },
  },
  {
    type: 'text',
    content:
      "We built SalesVelocity for that exact moment. It's an AI sales chief that drafts every email in your voice, scores intent on every reply, and books meetings while your team focuses on the deals that are actually live. Teams running it tell us they get their first hour back by day two.",
    styling: {
      alignment: 'left',
      padding: '8px 0 16px 0',
      textColor: '#1F2937',
      fontSize: '16px',
    },
  },
  {
    type: 'button',
    content: 'Worth a 15-min chat?',
    styling: {
      alignment: 'left',
      padding: '8px 0 20px 0',
      buttonColor: '#1E3A8A',
      buttonTextColor: '#FFFFFF',
      buttonUrl: '{{meeting_url}}',
    },
  },
  {
    type: 'text',
    content:
      "P.S. — A few of the SMB revenue teams we've helped: a 12-person team that cut their sales cycle from 30 days to 18, an agency that grew outbound reply rates from 4% to 11%, and a SaaS founder who finally stopped writing every cold email by hand. Happy to share the playbooks on the call.",
    styling: {
      alignment: 'left',
      padding: '12px 0',
      textColor: '#374151',
      fontSize: '15px',
    },
  },
  {
    type: 'text',
    content:
      'Thanks for the read,\n{{sender_name}}\nSalesVelocity.ai',
    styling: {
      alignment: 'left',
      padding: '16px 0 24px 0',
      textColor: '#1F2937',
      fontSize: '15px',
    },
  },
  {
    type: 'footer',
    content:
      "SalesVelocity.ai  •  This is a 1:1 outreach email. If it isn't a fit, hit reply with 'no thanks' and I won't follow up.\nUnsubscribe",
    styling: { alignment: 'center', padding: '16px 0 0 0' },
  },
];

const SALES_TEMPLATE: SeededEmailTemplate = {
  id: SALES_ID,
  name: 'Sales Cold Intro',
  description:
    'Plain-text-feeling cold outreach — opener, value prop, soft CTA, P.S. with social proof. Looks 1:1, converts like it.',
  iconEmoji: '🤝',
  category: 'sales',
  template: {
    name: 'Sales Cold Intro',
    subject: 'Quick question about {{company_name}}',
    preheader: '15 minutes, no slide deck. Just the three plays the SMB teams we work with hit first.',
    blocks: buildBlocks(SALES_ID, SALES_BLOCKS),
    variables: SALES_VARIABLES,
    styling: {
      backgroundColor: '#FFFFFF',
      primaryColor: '#1E3A8A',
      fontFamily: 'Helvetica, Arial, sans-serif',
    },
    category: 'sales',
    isDefault: false,
  },
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const SEEDED_EMAIL_TEMPLATES: SeededEmailTemplate[] = [
  WELCOME_TEMPLATE,
  PRODUCT_LAUNCH_TEMPLATE,
  FEATURE_SPOTLIGHT_TEMPLATE,
  NEWSLETTER_TEMPLATE,
  RECEIPT_TEMPLATE,
  REENGAGEMENT_TEMPLATE,
  EVENT_TEMPLATE,
  SALES_TEMPLATE,
];

/**
 * Look up a seeded template by its stable id.
 * Returns `undefined` if no template matches.
 */
export function getSeededTemplate(id: string): SeededEmailTemplate | undefined {
  return SEEDED_EMAIL_TEMPLATES.find(t => t.id === id);
}
