/**
 * Default Website Configuration
 * Contains all website pages, branding, navigation, and footer config.
 * This config initializes the editor when no Firestore data exists
 * and matches the actual SalesVelocity.ai website structure.
 */

import type {
  WebsiteConfig,
  GlobalBranding,
  EditorPage,
  NavigationConfig,
  EditorFooterConfig,
} from '@/types/website-editor';

// ============================================================================
// DEFAULT BRANDING
// ============================================================================

const DEFAULT_BRANDING: GlobalBranding = {
  logoUrl: '/logo.png',
  logoHeight: 48,
  companyName: 'SalesVelocity.ai',
  tagline: 'Accelerate Your Growth',
  faviconUrl: '/favicon.ico',
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#10b981',
    background: '#000000',
    surface: '#0a0a0a',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.6)',
    border: 'rgba(255,255,255,0.1)',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  fonts: {
    heading: 'Inter',
    body: 'Inter',
  },
  borderRadius: '8px',
};

// ============================================================================
// DEFAULT PAGES
// ============================================================================

const HOME_PAGE: EditorPage = {
  id: 'home',
  name: 'Home',
  slug: '/',
  isPublished: true,
  isInNav: false,
  navOrder: 0,
  sections: [
    {
      id: 'home-hero',
      type: 'section',
      name: 'Hero',
      visible: true,
      styles: { desktop: { padding: '120px 20px 80px', backgroundColor: '#000000', textAlign: 'center' } },
      children: [
        { id: 'hero-badge', type: 'text', content: 'AI-Powered Sales Automation', styles: { desktop: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' } } },
        { id: 'hero-h1', type: 'heading', content: 'Your AI Sales Team, Working 24/7', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', color: '#ffffff', marginBottom: '1.5rem', lineHeight: '1.1' } }, settings: { tag: 'h1' } },
        { id: 'hero-p', type: 'text', content: 'Train a custom AI sales agent on your business in minutes. Deploy it on your website. Watch it qualify leads, answer questions, and close deals while you sleep.', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.8)', maxWidth: '700px', margin: '0 auto 2rem' } } },
        { id: 'hero-btn', type: 'button', content: 'Start Free Trial', styles: { desktop: { padding: '16px 32px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600', fontSize: '1.125rem' } }, settings: { href: '/signup' } },
      ],
    },
    {
      id: 'home-stats',
      type: 'section',
      name: 'Stats',
      visible: true,
      styles: { desktop: { padding: '60px 20px', backgroundColor: '#0a0a0a' } },
      children: [
        { id: 'stats-grid', type: 'stats', content: { items: [{ value: '10x', label: 'More Qualified Leads' }, { value: '24/7', label: 'Always Available' }, { value: '5min', label: 'Setup Time' }, { value: '90%', label: 'Customer Satisfaction' }] }, styles: { desktop: {} } },
      ],
    },
    {
      id: 'home-features',
      type: 'section',
      name: 'Features',
      visible: true,
      styles: { desktop: { padding: '80px 20px', backgroundColor: '#000000' } },
      children: [
        { id: 'feat-h2', type: 'heading', content: 'Everything You Need to Sell More', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '3rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'feat-grid', type: 'feature-grid', content: { items: [
          { icon: 'robot', title: 'Trainable AI Agent', desc: 'Custom-trained on YOUR business, products, and sales process' },
          { icon: 'brain', title: 'Customer Memory', desc: 'Remembers every conversation, preference, and interaction' },
          { icon: 'message-circle', title: 'Lead Qualification', desc: 'Automatically scores and qualifies leads using AI' },
          { icon: 'bar-chart', title: 'Built-in CRM', desc: 'Manage contacts, deals, and pipeline in one place' },
          { icon: 'zap', title: 'Workflow Automation', desc: 'Auto-follow-ups, email sequences, task creation' },
          { icon: 'shopping-cart', title: 'E-Commerce Ready', desc: 'Take payments, manage inventory, process orders' },
        ] }, styles: { desktop: {} } },
      ],
    },
    {
      id: 'home-cta',
      type: 'section',
      name: 'CTA',
      visible: true,
      styles: { desktop: { padding: '80px 20px', backgroundColor: '#6366f1', textAlign: 'center' } },
      children: [
        { id: 'cta-h2', type: 'heading', content: 'Ready to 10x Your Sales?', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'cta-p', type: 'text', content: 'Join hundreds of businesses using AI to close more deals', styles: { desktop: { fontSize: '1.125rem', opacity: '0.9', marginBottom: '2rem', color: '#ffffff' } } },
        { id: 'cta-btn', type: 'button', content: 'Start Your Free Trial', styles: { desktop: { padding: '16px 32px', backgroundColor: '#ffffff', color: '#000000', borderRadius: '8px', fontWeight: '600' } }, settings: { href: '/signup' } },
      ],
    },
  ],
};

const FEATURES_PAGE: EditorPage = {
  id: 'features',
  name: 'Features',
  slug: '/features',
  isPublished: true,
  isInNav: true,
  navOrder: 1,
  metaTitle: 'Features - SalesVelocity.ai',
  metaDescription: 'A complete AI-powered sales platform with CRM, automation, and e-commerce built in.',
  sections: [
    {
      id: 'features-hero',
      type: 'section',
      name: 'Hero',
      visible: true,
      styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000', textAlign: 'center' } },
      children: [
        { id: 'f-h1', type: 'heading', content: 'Everything You Need to Sell More, Faster', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
        { id: 'f-p', type: 'text', content: 'A complete AI-powered sales platform with CRM, automation, and e-commerce built in', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', maxWidth: '700px', margin: '0 auto' } } },
      ],
    },
    {
      id: 'features-ai-agent',
      type: 'section',
      name: 'AI Agent Feature',
      visible: true,
      styles: { desktop: { padding: '80px 20px', backgroundColor: '#000000' } },
      children: [
        { id: 'f1-badge', type: 'text', content: 'Flagship Feature', styles: { desktop: { fontSize: '0.875rem', color: '#6366f1', marginBottom: '1rem' } } },
        { id: 'f1-h2', type: 'heading', content: 'Train Your Own AI Sales Agent', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'f1-p', type: 'text', content: 'Not a generic chatbot. A custom AI agent trained specifically on YOUR business, products, and sales process. It learns your brand voice, handles objections your way, and gets smarter with every conversation.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', maxWidth: '600px' } } },
        { id: 'f1-list', type: 'feature-grid', content: { items: [
          { icon: 'file-text', title: 'Upload Knowledge', desc: 'Product docs, pricing sheets, FAQs' },
          { icon: 'target', title: 'Train in Sandbox', desc: 'Practice real scenarios before going live' },
          { icon: 'trending-up', title: 'Continuous Learning', desc: 'Gets smarter from real conversations' },
        ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' } } },
      ],
    },
    {
      id: 'features-crm',
      type: 'section',
      name: 'CRM Feature',
      visible: true,
      styles: { desktop: { padding: '80px 20px', backgroundColor: '#0a0a0a' } },
      children: [
        { id: 'f2-badge', type: 'text', content: 'Powerful CRM', styles: { desktop: { fontSize: '0.875rem', color: '#6366f1', marginBottom: '1rem' } } },
        { id: 'f2-h2', type: 'heading', content: 'CRM That Actually Fits Your Business', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'f2-p', type: 'text', content: 'Create custom objects for anything - not just leads and deals. Track shipments, appointments, inventory, or whatever your business needs. Fully customizable with 20+ field types.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', maxWidth: '600px' } } },
        { id: 'f2-list', type: 'feature-grid', content: { items: [
          { icon: 'palette', title: 'Custom Objects', desc: 'For your industry' },
          { icon: 'link', title: 'Relationships', desc: 'Link data together' },
          { icon: 'calculator', title: 'Formula Fields', desc: 'Like Excel, but smarter' },
          { icon: 'layout', title: 'Multiple Views', desc: 'Kanban, Calendar, Table' },
          { icon: 'zap', title: 'Workflows', desc: 'Automation built-in' },
        ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' } } },
      ],
    },
    {
      id: 'features-ecommerce',
      type: 'section',
      name: 'E-Commerce Feature',
      visible: true,
      styles: { desktop: { padding: '80px 20px', backgroundColor: '#000000' } },
      children: [
        { id: 'f3-badge', type: 'text', content: 'E-Commerce', styles: { desktop: { fontSize: '0.875rem', color: '#6366f1', marginBottom: '1rem' } } },
        { id: 'f3-h2', type: 'heading', content: 'Sell Products Directly', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'f3-p', type: 'text', content: 'Turn on e-commerce with one click. Your AI agent can show products, answer questions, and complete purchases - all in the same conversation.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', maxWidth: '600px' } } },
        { id: 'f3-list', type: 'feature-grid', content: { items: [
          { icon: 'shopping-bag', title: 'In-Chat Cart', desc: 'Shopping in conversation' },
          { icon: 'credit-card', title: 'Payments', desc: 'Stripe, PayPal built-in' },
          { icon: 'package', title: 'Inventory', desc: 'Track stock levels' },
          { icon: 'truck', title: 'Orders', desc: 'Fulfillment tracking' },
        ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' } } },
      ],
    },
    {
      id: 'features-grid',
      type: 'section',
      name: 'All Features Grid',
      visible: true,
      styles: { desktop: { padding: '80px 20px', backgroundColor: 'rgba(0,0,0,0.3)' } },
      children: [
        { id: 'fg-h2', type: 'heading', content: 'Plus Everything Else You\'d Expect', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '3rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'fg-grid', type: 'feature-grid', content: { items: [
          { icon: 'palette', title: 'White-Labeling', desc: 'Your brand, your colors, your domain' },
          { icon: 'link', title: 'Integrations', desc: 'Slack, Stripe, Gmail, Calendar, and more' },
          { icon: 'mail', title: 'Email Campaigns', desc: 'Drip campaigns and nurture sequences' },
          { icon: 'smartphone', title: 'Mobile Ready', desc: 'Works perfectly on all devices' },
          { icon: 'shield', title: 'Enterprise Security', desc: 'SOC 2, GDPR, CCPA compliant' },
          { icon: 'globe', title: 'Multi-Language', desc: 'Serve customers in any language' },
          { icon: 'phone', title: 'SMS Support', desc: 'Send SMS messages automatically' },
          { icon: 'target', title: 'Lead Scoring', desc: 'AI-powered lead qualification' },
          { icon: 'clock', title: '99.9% Uptime', desc: 'Always available when you need it' },
        ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '1000px', margin: '0 auto' } } },
      ],
    },
    {
      id: 'features-cta',
      type: 'section',
      name: 'CTA',
      visible: true,
      styles: { desktop: { padding: '80px 20px', backgroundColor: '#000000', textAlign: 'center' } },
      children: [
        { id: 'fc-h2', type: 'heading', content: 'Start Your 14-Day Free Trial', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'fc-p', type: 'text', content: 'No credit card required. Full access to all features.', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' } } },
        { id: 'fc-btn', type: 'button', content: 'Get Started Free', styles: { desktop: { padding: '16px 48px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600', fontSize: '1.125rem' } }, settings: { href: '/signup' } },
      ],
    },
  ],
};

const PRICING_PAGE: EditorPage = {
  id: 'pricing',
  name: 'Pricing',
  slug: '/pricing',
  isPublished: true,
  isInNav: true,
  navOrder: 2,
  metaTitle: 'Pricing - SalesVelocity.ai',
  metaDescription: 'Simple, transparent pricing. Start with a 14-day free trial. No credit card required.',
  sections: [
    {
      id: 'pricing-hero',
      type: 'section',
      name: 'Hero',
      visible: true,
      styles: { desktop: { padding: '140px 20px 40px', backgroundColor: '#000000', textAlign: 'center' } },
      children: [
        { id: 'pr-h1', type: 'heading', content: 'Simple, Transparent Pricing', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
        { id: 'pr-p', type: 'text', content: 'Start with a 14-day free trial. No credit card required. Cancel anytime.', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', maxWidth: '600px', margin: '0 auto' } } },
      ],
    },
    {
      id: 'pricing-table',
      type: 'section',
      name: 'Pricing Plans',
      visible: true,
      styles: { desktop: { padding: '60px 20px 80px', backgroundColor: '#000000' } },
      children: [
        { id: 'pr-plans', type: 'pricing-table', content: { plans: [
          { name: 'Agent Only', price: '$29', period: '/month', features: ['1 trainable AI sales agent', 'Unlimited conversations', 'Website widget embed', '3 free integrations', 'Lead capture & export', 'Email support'], highlighted: false },
          { name: 'Starter', price: '$49', period: '/month', features: ['Everything in Agent Only, plus:', 'Built-in CRM (1,000 records)', 'Lead management', 'Deal pipeline', 'Basic workflow automation', 'Unlimited integrations'], highlighted: false },
          { name: 'Professional', price: '$149', period: '/month', features: ['Everything in Starter, plus:', '3 AI sales agents', 'Advanced CRM (10,000 records)', 'E-commerce platform', 'Payment processing', 'Custom domain & white-label', 'API access'], highlighted: true },
          { name: 'Enterprise', price: 'Custom', period: '', features: ['Unlimited AI agents', 'Unlimited CRM records', 'Dedicated support', 'Custom training', 'White-label options', 'Custom integrations', 'SLA guarantee'], highlighted: false },
        ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' } } },
      ],
    },
    {
      id: 'pricing-faq',
      type: 'section',
      name: 'FAQ',
      visible: true,
      styles: { desktop: { padding: '80px 20px', backgroundColor: 'rgba(0,0,0,0.2)' } },
      children: [
        { id: 'faq-h2', type: 'heading', content: 'Frequently Asked Questions', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '3rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'pr-faq', type: 'faq', content: { items: [
          { q: 'How does the 14-day free trial work?', a: 'Sign up with your email, no credit card required. You\'ll get full access to all Professional plan features for 14 days.' },
          { q: 'What counts as a "conversation"?', a: 'A conversation is a complete interaction between your AI agent and a visitor. Multiple messages within one chat session = 1 conversation.' },
          { q: 'Can I change plans later?', a: 'Absolutely! Upgrade or downgrade anytime. We prorate the difference on upgrades.' },
          { q: 'What if I exceed my conversation limit?', a: 'Your agent keeps working! We\'ll notify you at 80% and bill $0.05 per additional conversation, or you can upgrade.' },
          { q: 'Do you offer discounts for nonprofits?', a: 'Yes! We offer 50% off for registered nonprofits and early-stage startups. Contact us with proof.' },
          { q: 'What payment methods do you accept?', a: 'All major credit cards via Stripe. Enterprise customers can arrange invoicing.' },
        ] }, styles: { desktop: { maxWidth: '800px', margin: '0 auto' } } },
      ],
    },
    {
      id: 'pricing-cta',
      type: 'section',
      name: 'CTA',
      visible: true,
      styles: { desktop: { padding: '80px 20px', backgroundColor: '#000000', textAlign: 'center' } },
      children: [
        { id: 'pcta-h2', type: 'heading', content: 'Ready to Get Started?', styles: { desktop: { fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'pcta-p', type: 'text', content: 'Join hundreds of businesses using AI to close more deals', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' } } },
        { id: 'pcta-btn', type: 'button', content: 'Start Your Free Trial', styles: { desktop: { padding: '16px 48px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600', fontSize: '1.125rem' } }, settings: { href: '/signup' } },
      ],
    },
  ],
};

const FAQ_PAGE: EditorPage = {
  id: 'faq',
  name: 'FAQ',
  slug: '/faq',
  isPublished: true,
  isInNav: true,
  navOrder: 3,
  metaTitle: 'FAQ - SalesVelocity.ai',
  metaDescription: 'Frequently asked questions about SalesVelocity.ai.',
  sections: [
    {
      id: 'faq-hero',
      type: 'section',
      name: 'Hero',
      visible: true,
      styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000', textAlign: 'center' } },
      children: [
        { id: 'fq-h1', type: 'heading', content: 'Frequently Asked Questions', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
        { id: 'fq-p', type: 'text', content: 'Got questions? We\'ve got answers.', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)' } } },
      ],
    },
    {
      id: 'faq-content',
      type: 'section',
      name: 'FAQ List',
      visible: true,
      styles: { desktop: { padding: '60px 20px 80px', backgroundColor: '#000000' } },
      children: [
        { id: 'fq-list', type: 'faq', content: { items: [
          { q: 'What is SalesVelocity.ai?', a: 'SalesVelocity.ai is an AI-powered sales platform that combines a trainable AI sales agent, CRM, workflow automation, and e-commerce tools in one place.' },
          { q: 'How do I train my AI agent?', a: 'Upload your product docs, pricing, FAQs, and sales scripts. The AI learns your business context and can start qualifying leads immediately.' },
          { q: 'Is there a free trial?', a: 'Yes! 14-day free trial with full Professional plan access. No credit card required.' },
          { q: 'Can I use it on my website?', a: 'Absolutely. Your AI agent deploys as a chat widget on any website with a single line of code.' },
          { q: 'What integrations are available?', a: 'We integrate with Stripe, Gmail, Google Calendar, Slack, and many more. API access is available on Professional plans and above.' },
          { q: 'Is my data secure?', a: 'Yes. We use enterprise-grade encryption, are SOC 2 compliant, and never sell your data.' },
        ] }, styles: { desktop: { maxWidth: '800px', margin: '0 auto' } } },
      ],
    },
  ],
};

const ABOUT_PAGE: EditorPage = {
  id: 'about',
  name: 'About',
  slug: '/about',
  isPublished: true,
  isInNav: true,
  navOrder: 4,
  metaTitle: 'About Us - SalesVelocity.ai',
  metaDescription: 'Building the future of AI-powered sales automation.',
  sections: [
    {
      id: 'about-hero',
      type: 'section',
      name: 'Hero',
      visible: true,
      styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000' } },
      children: [
        { id: 'ab-h1', type: 'heading', content: 'About Us', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
        { id: 'ab-p', type: 'text', content: 'Building the future of AI-powered sales automation', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)' } } },
      ],
    },
    {
      id: 'about-mission',
      type: 'section',
      name: 'Mission',
      visible: true,
      styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000' } },
      children: [
        { id: 'ab-h2', type: 'heading', content: 'Our Mission', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'ab-text1', type: 'text', content: 'We believe every business deserves access to world-class sales automation, regardless of size or budget. SalesVelocity.ai democratizes cutting-edge technology, making it accessible to startups and enterprises alike.', styles: { desktop: { fontSize: '1.125rem', lineHeight: '1.8', color: 'rgba(255,255,255,0.8)', marginBottom: '1rem' } } },
        { id: 'ab-text2', type: 'text', content: 'By combining artificial intelligence with proven sales methodologies, we\'re helping businesses close more deals, nurture better relationships, and grow faster.', styles: { desktop: { fontSize: '1.125rem', lineHeight: '1.8', color: 'rgba(255,255,255,0.8)' } } },
      ],
    },
    {
      id: 'about-story',
      type: 'section',
      name: 'Our Story',
      visible: true,
      styles: { desktop: { padding: '60px 20px', backgroundColor: '#0a0a0a' } },
      children: [
        { id: 'ab-h3', type: 'heading', content: 'Our Story', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'ab-story1', type: 'text', content: 'Founded in 2024, SalesVelocity.ai emerged from a simple observation: most businesses struggle with lead qualification, follow-ups, and sales process consistency. Traditional CRMs require too much manual work. AI chatbots are too generic.', styles: { desktop: { fontSize: '1.125rem', lineHeight: '1.8', color: 'rgba(255,255,255,0.8)', marginBottom: '1rem' } } },
        { id: 'ab-story2', type: 'text', content: 'We built something different - an AI sales agent that learns YOUR business, speaks in YOUR voice, and follows YOUR process. It\'s like hiring your best sales rep and cloning them to work 24/7.', styles: { desktop: { fontSize: '1.125rem', lineHeight: '1.8', color: 'rgba(255,255,255,0.8)' } } },
      ],
    },
    {
      id: 'about-values',
      type: 'section',
      name: 'Our Values',
      visible: true,
      styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000' } },
      children: [
        { id: 'ab-h4', type: 'heading', content: 'Our Values', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'ab-values', type: 'feature-grid', content: { items: [
          { icon: 'rocket', title: 'Innovation First', desc: 'We push boundaries with AI technology while keeping the user experience simple.' },
          { icon: 'handshake', title: 'Customer Success', desc: 'Your growth is our success. We\'re invested in helping you close more deals.' },
          { icon: 'shield', title: 'Privacy & Security', desc: 'Your data is yours. Enterprise-grade security, never sell your information.' },
          { icon: 'lightbulb', title: 'Transparency', desc: 'No hidden fees, no dark patterns. What you see is what you get.' },
        ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', maxWidth: '800px' } } },
      ],
    },
    {
      id: 'about-cta',
      type: 'section',
      name: 'CTA',
      visible: true,
      styles: { desktop: { padding: '60px 20px', backgroundColor: '#0a0a0a' } },
      children: [
        { id: 'ab-cta-h', type: 'heading', content: 'Join Us', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'ab-cta-p', type: 'text', content: 'We\'re always looking for talented people who are passionate about AI, sales, and helping businesses grow.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '1.5rem' } } },
        { id: 'ab-cta-btn', type: 'button', content: 'Get in Touch', styles: { desktop: { padding: '16px 32px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600' } }, settings: { href: '/contact' } },
      ],
    },
  ],
};

const CONTACT_PAGE: EditorPage = {
  id: 'contact',
  name: 'Contact',
  slug: '/contact',
  isPublished: true,
  isInNav: true,
  navOrder: 5,
  metaTitle: 'Contact Us - SalesVelocity.ai',
  metaDescription: 'Have questions? We\'d love to hear from you. Get in touch with our team.',
  sections: [
    {
      id: 'contact-hero',
      type: 'section',
      name: 'Hero',
      visible: true,
      styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000', textAlign: 'center' } },
      children: [
        { id: 'ct-h1', type: 'heading', content: 'Get in Touch', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
        { id: 'ct-p', type: 'text', content: 'Have questions? We\'d love to hear from you.', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)' } } },
      ],
    },
    {
      id: 'contact-info',
      type: 'section',
      name: 'Contact Methods',
      visible: true,
      styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000' } },
      children: [
        { id: 'ct-grid', type: 'feature-grid', content: { items: [
          { icon: 'mail', title: 'Email Us', desc: 'support@salesvelocity.ai - We respond within 24 hours' },
          { icon: 'message-circle', title: 'Live Chat', desc: 'Available 9am-6pm EST - Click the chat widget' },
          { icon: 'book-open', title: 'Documentation', desc: 'Check our comprehensive guides at /docs' },
          { icon: 'target', title: 'Sales Inquiries', desc: 'sales@salesvelocity.ai - For enterprise plans' },
        ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', maxWidth: '800px', margin: '0 auto' } } },
      ],
    },
    {
      id: 'contact-form-note',
      type: 'section',
      name: 'Form Note',
      visible: true,
      styles: { desktop: { padding: '40px 20px', backgroundColor: '#0a0a0a', textAlign: 'center' } },
      children: [
        { id: 'ct-form-h', type: 'heading', content: 'Send Us a Message', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'ct-form-p', type: 'text', content: 'Fill out the contact form on this page and we\'ll get back to you as soon as possible.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)' } } },
      ],
    },
  ],
};

const PRIVACY_PAGE: EditorPage = {
  id: 'privacy',
  name: 'Privacy Policy',
  slug: '/privacy',
  isPublished: true,
  isInNav: false,
  navOrder: 20,
  metaTitle: 'Privacy Policy - SalesVelocity.ai',
  metaDescription: 'How we collect, use, and protect your personal information.',
  sections: [
    {
      id: 'priv-hero',
      type: 'section',
      name: 'Hero',
      visible: true,
      styles: { desktop: { padding: '140px 20px 40px', backgroundColor: '#000000' } },
      children: [
        { id: 'pv-h1', type: 'heading', content: 'Privacy Policy', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
        { id: 'pv-date', type: 'text', content: 'Last updated: December 2024', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.5)' } } },
      ],
    },
    {
      id: 'priv-content',
      type: 'section',
      name: 'Content',
      visible: true,
      styles: { desktop: { padding: '40px 20px 80px', backgroundColor: '#000000' } },
      children: [
        { id: 'pv-intro', type: 'text', content: 'At SalesVelocity.ai, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
        { id: 'pv-h2-1', type: 'heading', content: 'Information We Collect', styles: { desktop: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'pv-p1', type: 'text', content: 'We collect information you provide directly, including account details, business information, and content you upload to train your AI agents. We also automatically collect usage data, device information, and cookies.', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
        { id: 'pv-h2-2', type: 'heading', content: 'How We Use Your Information', styles: { desktop: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'pv-p2', type: 'text', content: 'We use your information to provide and improve our services, personalize your experience, communicate with you, and ensure platform security. We never sell your personal data to third parties.', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
        { id: 'pv-contact', type: 'text', content: 'Questions? Contact us at privacy@salesvelocity.ai', styles: { desktop: { fontSize: '1rem', color: '#6366f1' } } },
      ],
    },
  ],
};

const TERMS_PAGE: EditorPage = {
  id: 'terms',
  name: 'Terms of Service',
  slug: '/terms',
  isPublished: true,
  isInNav: false,
  navOrder: 21,
  metaTitle: 'Terms of Service - SalesVelocity.ai',
  metaDescription: 'Terms and conditions for using the SalesVelocity.ai platform.',
  sections: [
    {
      id: 'terms-hero',
      type: 'section',
      name: 'Hero',
      visible: true,
      styles: { desktop: { padding: '140px 20px 40px', backgroundColor: '#000000' } },
      children: [
        { id: 'tm-h1', type: 'heading', content: 'Terms of Service', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
        { id: 'tm-date', type: 'text', content: 'Last updated: December 2024', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.5)' } } },
      ],
    },
    {
      id: 'terms-content',
      type: 'section',
      name: 'Content',
      visible: true,
      styles: { desktop: { padding: '40px 20px 80px', backgroundColor: '#000000' } },
      children: [
        { id: 'tm-intro', type: 'text', content: 'Welcome to SalesVelocity.ai. By accessing or using our platform, you agree to be bound by these Terms of Service. Please read them carefully.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.8)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
        { id: 'tm-h2-1', type: 'heading', content: 'Account Terms', styles: { desktop: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'tm-p1', type: 'text', content: 'You must be 18 years or older to use this service. You are responsible for maintaining the security of your account and password. You may not use the service for any illegal or unauthorized purpose.', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
        { id: 'tm-h2-2', type: 'heading', content: 'Acceptable Use', styles: { desktop: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'tm-p2', type: 'text', content: 'You agree not to misuse our services, interfere with other users, attempt unauthorized access, or use the platform to send spam or malicious content.', styles: { desktop: { fontSize: '1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', maxWidth: '800px', lineHeight: '1.8' } } },
        { id: 'tm-contact', type: 'text', content: 'Questions? Contact us at legal@salesvelocity.ai', styles: { desktop: { fontSize: '1rem', color: '#6366f1' } } },
      ],
    },
  ],
};

const SECURITY_PAGE: EditorPage = {
  id: 'security',
  name: 'Security',
  slug: '/security',
  isPublished: true,
  isInNav: false,
  navOrder: 22,
  pageType: 'content',
  metaTitle: 'Security & Compliance - SalesVelocity.ai',
  metaDescription: 'Enterprise-grade security to protect your data. SOC 2, GDPR, and CCPA compliant.',
  sections: [
    {
      id: 'sec-hero',
      type: 'section',
      name: 'Hero',
      visible: true,
      styles: { desktop: { padding: '140px 20px 60px', backgroundColor: '#000000', textAlign: 'center' } },
      children: [
        { id: 'sc-h1', type: 'heading', content: 'Security & Compliance', styles: { desktop: { fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#ffffff' } }, settings: { tag: 'h1' } },
        { id: 'sc-p', type: 'text', content: 'Enterprise-grade security to protect your data', styles: { desktop: { fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)' } } },
      ],
    },
    {
      id: 'sec-features',
      type: 'section',
      name: 'Security Features',
      visible: true,
      styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000' } },
      children: [
        { id: 'sc-grid', type: 'feature-grid', content: { items: [
          { icon: 'lock', title: 'Data Encryption', desc: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256)' },
          { icon: 'building', title: 'SOC 2 Compliant', desc: 'Infrastructure meets SOC 2 Type II compliance standards' },
          { icon: 'shield', title: 'GDPR Ready', desc: 'Fully compliant with GDPR, CCPA, and other privacy regulations' },
          { icon: 'key', title: 'Access Controls', desc: 'MFA, role-based permissions, and IP whitelisting' },
          { icon: 'search', title: 'Regular Audits', desc: 'Quarterly security audits by certified third-party firms' },
          { icon: 'database', title: 'Automated Backups', desc: 'Daily backups with 30-day retention and point-in-time recovery' },
        ] }, styles: { desktop: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', maxWidth: '900px', margin: '0 auto' } } },
      ],
    },
    {
      id: 'sec-report',
      type: 'section',
      name: 'Report Issue',
      visible: true,
      styles: { desktop: { padding: '60px 20px', backgroundColor: '#000000', textAlign: 'center' } },
      children: [
        { id: 'sc-rep-h', type: 'heading', content: 'Report a Security Issue', styles: { desktop: { fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#ffffff' } }, settings: { tag: 'h2' } },
        { id: 'sc-rep-p', type: 'text', content: 'We take security seriously. If you discover a vulnerability, please report it responsibly.', styles: { desktop: { fontSize: '1.125rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' } } },
        { id: 'sc-rep-btn', type: 'button', content: 'Report Vulnerability', styles: { desktop: { padding: '16px 32px', backgroundColor: '#6366f1', color: '#ffffff', borderRadius: '8px', fontWeight: '600' } }, settings: { href: 'mailto:security@salesvelocity.ai' } },
      ],
    },
  ],
};

const LOGIN_PAGE: EditorPage = {
  id: 'login',
  name: 'Login',
  slug: '/login',
  isPublished: true,
  isInNav: false,
  navOrder: 30,
  pageType: 'auth',
  metaTitle: 'Login - SalesVelocity.ai',
  metaDescription: 'Sign in to your SalesVelocity.ai account',
  sections: [],
};

// ============================================================================
// DEFAULT NAVIGATION
// ============================================================================

const DEFAULT_NAVIGATION: NavigationConfig = {
  style: 'default',
  showLogin: true,
  showSignup: true,
  ctaText: 'Start Free Trial',
  ctaLink: '/signup',
  sticky: true,
  transparent: false,
};

// ============================================================================
// DEFAULT FOOTER
// ============================================================================

const DEFAULT_FOOTER: EditorFooterConfig = {
  columns: [
    { title: 'Product', links: [{ label: 'Features', href: '/features' }, { label: 'Pricing', href: '/pricing' }, { label: 'Documentation', href: '/docs' }] },
    { title: 'Company', links: [{ label: 'About', href: '/about' }, { label: 'Blog', href: '/blog' }, { label: 'Contact', href: '/contact' }] },
    { title: 'Legal', links: [{ label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }, { label: 'Security', href: '/security' }] },
  ],
  socialLinks: [
    { platform: 'Twitter', url: 'https://twitter.com' },
    { platform: 'LinkedIn', url: 'https://linkedin.com' },
  ],
  copyrightText: '{year} {company}. All rights reserved.',
  showPoweredBy: false,
};

// ============================================================================
// EXPORT DEFAULT CONFIG
// ============================================================================

export const DEFAULT_CONFIG: WebsiteConfig = {
  branding: DEFAULT_BRANDING,
  pages: [
    HOME_PAGE,
    FEATURES_PAGE,
    PRICING_PAGE,
    FAQ_PAGE,
    ABOUT_PAGE,
    CONTACT_PAGE,
    PRIVACY_PAGE,
    TERMS_PAGE,
    SECURITY_PAGE,
    LOGIN_PAGE,
  ],
  navigation: DEFAULT_NAVIGATION,
  footer: DEFAULT_FOOTER,
};

export { DEFAULT_BRANDING };
