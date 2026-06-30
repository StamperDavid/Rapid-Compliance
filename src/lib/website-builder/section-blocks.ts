/**
 * Section / Block Library — Premade Catalog
 *
 * A "block" is simply a reusable `PageSection` (its columns + widgets) that the
 * operator can drop into the page they are editing. This file is the curated
 * STARTER SET: most blocks are lifted from the production-proven full-page
 * templates in `page-templates.ts` (so they are guaranteed on-brand and to
 * render through `ResponsiveRenderer`), plus a handful authored here.
 *
 * This is intentionally a GROWABLE starter set (~26 blocks), NOT "hundreds".
 * The operator (or the website AI) can save any section they like as a new
 * block via the block-library service, and those org-saved blocks live
 * alongside these in the editor's Block Library panel.
 *
 * Rendering contract: every `section` below uses ONLY widget types that render
 * real UI in `ResponsiveRenderer.tsx`. The empty layout primitives
 * (`container`/`row`/`column`) and the data-only `ecommerce` widget are
 * deliberately avoided.
 *
 * IDs are stable + readable (prefixed `block-…`). The insert operation re-ids
 * everything on insert, so collisions across inserts are fine — readable ids
 * just make the catalog easy to scan.
 */

import type { PageSection } from '@/types/website';

export type BlockCategory =
  | 'hero'
  | 'features'
  | 'pricing'
  | 'testimonials'
  | 'cta'
  | 'stats'
  | 'logos'
  | 'faq'
  | 'contact'
  | 'content'
  | 'footer';

export interface SectionBlock {
  id: string;
  name: string;
  category: BlockCategory;
  section: PageSection;
}

/**
 * Human-friendly labels for each category (used by the Block Library UI).
 */
export const BLOCK_CATEGORY_LABELS: Record<BlockCategory, string> = {
  hero: 'Hero',
  features: 'Features',
  pricing: 'Pricing',
  testimonials: 'Testimonials',
  cta: 'Call To Action',
  stats: 'Stats',
  logos: 'Logos',
  faq: 'FAQ',
  contact: 'Contact',
  content: 'Content',
  footer: 'Footer',
};

/**
 * The curated starter catalog. Each entry's `section` is a complete,
 * render-ready `PageSection`.
 */
export const PREMADE_BLOCKS: SectionBlock[] = [
  // ───────────────────────────── HERO ─────────────────────────────
  {
    id: 'block-hero-image-overlay',
    name: 'Hero — Image Overlay',
    category: 'hero',
    section: {
      id: 'block-hero-image-overlay:section',
      type: 'section',
      name: 'Hero — Image Overlay',
      columns: [
        {
          id: 'block-hero-image-overlay:col',
          width: 100,
          widgets: [
            {
              id: 'block-hero-image-overlay:hero',
              type: 'hero',
              data: {
                heading: 'Grow Your Business with Confidence',
                subheading:
                  'We help companies scale their operations with proven strategies and cutting-edge solutions',
                buttonText: 'Get Started',
                buttonUrl: '#contact',
                backgroundImage:
                  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920',
              },
              style: {
                padding: { top: '6rem', right: '2rem', bottom: '6rem', left: '2rem' },
                textAlign: 'center',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: '#ffffff',
              },
            },
          ],
        },
      ],
      backgroundColor: '#1a1a1a',
      padding: { top: '0', bottom: '0' },
      fullWidth: true,
    },
  },
  {
    id: 'block-hero-centered-cta',
    name: 'Hero — Centered Headline + CTA',
    category: 'hero',
    section: {
      id: 'block-hero-centered-cta:section',
      type: 'section',
      name: 'Hero — Centered Headline + CTA',
      columns: [
        {
          id: 'block-hero-centered-cta:col',
          width: 100,
          widgets: [
            {
              id: 'block-hero-centered-cta:heading',
              type: 'heading',
              data: { text: 'The Modern Way to Manage Your Work', level: 1, tag: 'h1' },
              style: {
                fontSize: '3.5rem',
                fontWeight: '800',
                color: '#ffffff',
                textAlign: 'center',
                margin: { bottom: '1.5rem' },
              },
            },
            {
              id: 'block-hero-centered-cta:text',
              type: 'text',
              data: {
                content:
                  'Streamline your workflow, boost productivity, and collaborate seamlessly with your team. All in one powerful platform.',
              },
              style: {
                fontSize: '1.25rem',
                lineHeight: '1.6',
                color: '#e9ecef',
                textAlign: 'center',
                margin: { bottom: '2rem' },
                maxWidth: '640px',
              },
            },
            {
              id: 'block-hero-centered-cta:button',
              type: 'button',
              data: { text: 'Start Free Trial', url: '#signup', openInNewTab: false },
              style: {
                padding: { top: '1rem', right: '2.5rem', bottom: '1rem', left: '2.5rem' },
                backgroundColor: '#ffffff',
                color: '#2563eb',
                border: 'none',
                borderRadius: '50px',
                fontSize: '1.125rem',
                fontWeight: '600',
                textAlign: 'center',
              },
            },
          ],
        },
      ],
      backgroundColor: '#2563eb',
      padding: { top: '6rem', bottom: '6rem' },
      fullWidth: true,
    },
  },
  {
    id: 'block-hero-gradient-headline',
    name: 'Hero — Gradient Headline',
    category: 'hero',
    section: {
      id: 'block-hero-gradient-headline:section',
      type: 'section',
      name: 'Hero — Gradient Headline',
      columns: [
        {
          id: 'block-hero-gradient-headline:col',
          width: 100,
          widgets: [
            {
              id: 'block-hero-gradient-headline:heading',
              type: 'heading',
              data: { text: 'Build Your Sales Workforce', level: 1, tag: 'h1' },
              style: {
                fontSize: '3.75rem',
                fontWeight: '800',
                textAlign: 'center',
                margin: { bottom: '1.5rem' },
                textGradient: { from: '#a855f7', via: '#6366f1', to: '#3b82f6', angle: 90 },
              },
            },
            {
              id: 'block-hero-gradient-headline:text',
              type: 'text',
              data: {
                content:
                  'One intelligent platform that researches, writes, and closes — so your team can focus on the deals that matter.',
              },
              style: {
                fontSize: '1.25rem',
                lineHeight: '1.7',
                color: 'rgba(255,255,255,0.75)',
                textAlign: 'center',
                margin: { bottom: '2.5rem' },
                maxWidth: '680px',
              },
            },
            {
              id: 'block-hero-gradient-headline:button',
              type: 'button',
              data: { text: 'Get Started Free', url: '#signup', openInNewTab: false },
              style: {
                padding: { top: '1rem', right: '2.5rem', bottom: '1rem', left: '2.5rem' },
                backgroundColor: '#6366f1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '1.125rem',
                fontWeight: '600',
                textAlign: 'center',
              },
            },
          ],
        },
      ],
      backgroundColor: '#0b0b14',
      padding: { top: '7rem', bottom: '7rem' },
      fullWidth: true,
    },
  },

  // ──────────────────────────── FEATURES ───────────────────────────
  {
    id: 'block-features-why-choose-us',
    name: 'Features — Why Choose Us (6-Up)',
    category: 'features',
    section: {
      id: 'block-features-why-choose-us:section',
      type: 'section',
      name: 'Features — Why Choose Us (6-Up)',
      columns: [
        {
          id: 'block-features-why-choose-us:col',
          width: 100,
          widgets: [
            {
              id: 'block-features-why-choose-us:heading',
              type: 'heading',
              data: { text: 'Why Choose Us', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'block-features-why-choose-us:features',
              type: 'features',
              data: {
                features: [
                  { icon: '🚀', title: 'Fast Results', description: 'See measurable improvements within the first 30 days' },
                  { icon: '🔒', title: 'Secure & Reliable', description: 'Enterprise-grade security protecting your data 24/7' },
                  { icon: '💪', title: 'Expert Support', description: 'A dedicated team of professionals ready to help you succeed' },
                  { icon: '📊', title: 'Data-Driven', description: 'Make informed decisions with comprehensive analytics' },
                  { icon: '⚡', title: 'Easy Integration', description: 'Seamlessly connect with your existing tools and workflows' },
                  { icon: '🎯', title: 'Proven Results', description: 'Join thousands of successful businesses already growing with us' },
                ],
              },
              style: { display: 'grid' },
            },
          ],
        },
      ],
      padding: { top: '5rem', bottom: '5rem' },
    },
  },
  {
    id: 'block-features-services',
    name: 'Features — Services Grid',
    category: 'features',
    section: {
      id: 'block-features-services:section',
      type: 'section',
      name: 'Features — Services Grid',
      columns: [
        {
          id: 'block-features-services:col',
          width: 100,
          widgets: [
            {
              id: 'block-features-services:heading',
              type: 'heading',
              data: { text: 'Our Services', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'block-features-services:features',
              type: 'features',
              data: {
                features: [
                  { icon: '🎨', title: 'Web Design', description: 'User-centered designs that convert visitors into customers' },
                  { icon: '💻', title: 'Development', description: 'Custom web applications built with modern technologies' },
                  { icon: '📱', title: 'Mobile Apps', description: 'Native and cross-platform mobile solutions' },
                  { icon: '🎯', title: 'Digital Marketing', description: 'Data-driven strategies that grow your business' },
                  { icon: '✨', title: 'Branding', description: 'Memorable brand identities that stand out' },
                  { icon: '📊', title: 'Analytics', description: 'Insights and optimization to maximize your ROI' },
                ],
              },
              style: { display: 'grid' },
            },
          ],
        },
      ],
      padding: { top: '5rem', bottom: '5rem' },
    },
  },
  {
    id: 'block-features-categories',
    name: 'Features — Category Tiles',
    category: 'features',
    section: {
      id: 'block-features-categories:section',
      type: 'section',
      name: 'Features — Category Tiles',
      columns: [
        {
          id: 'block-features-categories:col',
          width: 100,
          widgets: [
            {
              id: 'block-features-categories:heading',
              type: 'heading',
              data: { text: 'Shop by Category', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'block-features-categories:features',
              type: 'features',
              data: {
                features: [
                  { icon: '👔', title: "Men's Fashion", description: 'Latest styles for modern men' },
                  { icon: '👗', title: "Women's Fashion", description: 'Trendy outfits for every occasion' },
                  { icon: '👟', title: 'Footwear', description: 'Step out in style' },
                  { icon: '💼', title: 'Accessories', description: 'Complete your look' },
                ],
              },
              style: { display: 'grid' },
            },
          ],
        },
      ],
      padding: { top: '5rem', bottom: '5rem' },
    },
  },

  // ───────────────────────────── STATS ─────────────────────────────
  {
    id: 'block-stats-metrics',
    name: 'Stats — 4 Key Metrics',
    category: 'stats',
    section: {
      id: 'block-stats-metrics:section',
      type: 'section',
      name: 'Stats — 4 Key Metrics',
      columns: [
        {
          id: 'block-stats-metrics:col',
          width: 100,
          widgets: [
            {
              id: 'block-stats-metrics:stats',
              type: 'stats',
              data: {
                stats: [
                  { number: '10,000+', label: 'Happy Customers' },
                  { number: '99.9%', label: 'Uptime' },
                  { number: '50M+', label: 'API Requests / Month' },
                  { number: '24/7', label: 'Support Available' },
                ],
              },
              style: { display: 'grid', textAlign: 'center' },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '4rem', bottom: '4rem' },
    },
  },
  {
    id: 'block-stats-accent-band',
    name: 'Stats — Accent Band',
    category: 'stats',
    section: {
      id: 'block-stats-accent-band:section',
      type: 'section',
      name: 'Stats — Accent Band',
      columns: [
        {
          id: 'block-stats-accent-band:col',
          width: 100,
          widgets: [
            {
              id: 'block-stats-accent-band:stats',
              type: 'stats',
              data: {
                stats: [
                  { number: '200+', label: 'Projects Completed' },
                  { number: '50+', label: 'Happy Clients' },
                  { number: '15+', label: 'Team Members' },
                  { number: '10', label: 'Years Experience' },
                ],
              },
              style: { display: 'grid', textAlign: 'center' },
            },
          ],
        },
      ],
      backgroundColor: '#6366f1',
      padding: { top: '4rem', bottom: '4rem' },
      fullWidth: true,
    },
  },

  // ──────────────────────────── PRICING ────────────────────────────
  {
    id: 'block-pricing-three-tier',
    name: 'Pricing — 3 Tiers',
    category: 'pricing',
    section: {
      id: 'block-pricing-three-tier:section',
      type: 'section',
      name: 'Pricing — 3 Tiers',
      columns: [
        {
          id: 'block-pricing-three-tier:col',
          width: 100,
          widgets: [
            {
              id: 'block-pricing-three-tier:heading',
              type: 'heading',
              data: { text: 'Simple, Transparent Pricing', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'block-pricing-three-tier:pricing',
              type: 'pricing',
              data: {
                plans: [
                  {
                    name: 'Starter',
                    price: '$9',
                    period: 'month',
                    features: ['5 Projects', '10 GB Storage', 'Basic Support', 'Mobile Apps'],
                    buttonText: 'Get Started',
                    buttonUrl: '#signup',
                  },
                  {
                    name: 'Professional',
                    price: '$29',
                    period: 'month',
                    features: [
                      'Unlimited Projects',
                      '100 GB Storage',
                      'Priority Support',
                      'Advanced Analytics',
                      'Custom Integrations',
                      'Team Collaboration',
                    ],
                    buttonText: 'Get Started',
                    buttonUrl: '#signup',
                    featured: true,
                  },
                  {
                    name: 'Enterprise',
                    price: '$99',
                    period: 'month',
                    features: [
                      'Everything in Pro',
                      'Unlimited Storage',
                      '24/7 Phone Support',
                      'Dedicated Account Manager',
                      'Custom SLA',
                      'On-premise Deployment',
                    ],
                    buttonText: 'Contact Sales',
                    buttonUrl: '#contact',
                  },
                ],
              },
              style: { display: 'grid' },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
  },

  // ─────────────────────────── TESTIMONIALS ────────────────────────
  {
    id: 'block-testimonial-single',
    name: 'Testimonials — Single Quote',
    category: 'testimonials',
    section: {
      id: 'block-testimonial-single:section',
      type: 'section',
      name: 'Testimonials — Single Quote',
      columns: [
        {
          id: 'block-testimonial-single:col',
          width: 100,
          widgets: [
            {
              id: 'block-testimonial-single:heading',
              type: 'heading',
              data: { text: 'What Our Customers Say', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'block-testimonial-single:testimonial',
              type: 'testimonial',
              data: {
                quote:
                  'This platform transformed how we do business. The results exceeded our expectations.',
                author: 'Sarah Johnson',
                role: 'CEO, TechCorp',
                avatar: 'https://i.pravatar.cc/150?img=1',
              },
              style: {
                maxWidth: '720px',
                margin: { left: 'auto', right: 'auto' },
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
  },
  {
    id: 'block-testimonial-card',
    name: 'Testimonials — Quote Card',
    category: 'testimonials',
    section: {
      id: 'block-testimonial-card:section',
      type: 'section',
      name: 'Testimonials — Quote Card',
      columns: [
        {
          id: 'block-testimonial-card:col',
          width: 100,
          widgets: [
            {
              id: 'block-testimonial-card:testimonial',
              type: 'testimonial',
              data: {
                quote:
                  'Onboarding took an afternoon and we closed two new deals the same week. Genuinely the easiest tool we have rolled out.',
                author: 'Marcus Lee',
                role: 'Head of Sales, Northwind',
                avatar: 'https://i.pravatar.cc/150?img=12',
              },
              style: {
                maxWidth: '720px',
                margin: { left: 'auto', right: 'auto' },
              },
            },
          ],
        },
      ],
      padding: { top: '4rem', bottom: '4rem' },
    },
  },

  // ────────────────────────────── CTA ──────────────────────────────
  {
    id: 'block-cta-centered',
    name: 'CTA — Centered Band',
    category: 'cta',
    section: {
      id: 'block-cta-centered:section',
      type: 'section',
      name: 'CTA — Centered Band',
      columns: [
        {
          id: 'block-cta-centered:col',
          width: 100,
          widgets: [
            {
              id: 'block-cta-centered:cta',
              type: 'cta',
              data: {
                heading: 'Ready to Get Started?',
                text: 'Join thousands of successful businesses today',
                buttonText: 'Start Free Trial',
                buttonUrl: '#signup',
              },
              style: {
                padding: { top: '4rem', right: '2rem', bottom: '4rem', left: '2rem' },
                backgroundColor: '#2563eb',
                color: '#ffffff',
                textAlign: 'center',
                borderRadius: '8px',
              },
            },
          ],
        },
      ],
      padding: { top: '5rem', bottom: '5rem' },
    },
  },
  {
    id: 'block-cta-free-trial',
    name: 'CTA — Free Trial',
    category: 'cta',
    section: {
      id: 'block-cta-free-trial:section',
      type: 'section',
      name: 'CTA — Free Trial',
      columns: [
        {
          id: 'block-cta-free-trial:col',
          width: 100,
          widgets: [
            {
              id: 'block-cta-free-trial:cta',
              type: 'cta',
              data: {
                heading: 'Start Your Free Trial Today',
                text: 'No credit card required. Cancel anytime.',
                buttonText: 'Get Started Free',
                buttonUrl: '#signup',
              },
              style: {
                padding: { top: '4rem', right: '2rem', bottom: '4rem', left: '2rem' },
                backgroundColor: '#16a34a',
                color: '#ffffff',
                textAlign: 'center',
                borderRadius: '8px',
              },
            },
          ],
        },
      ],
      padding: { top: '5rem', bottom: '5rem' },
    },
  },
  {
    id: 'block-cta-contact-dark',
    name: 'CTA — Contact (Dark)',
    category: 'cta',
    section: {
      id: 'block-cta-contact-dark:section',
      type: 'section',
      name: 'CTA — Contact (Dark)',
      columns: [
        {
          id: 'block-cta-contact-dark:col',
          width: 100,
          widgets: [
            {
              id: 'block-cta-contact-dark:cta',
              type: 'cta',
              data: {
                heading: "Let's Work Together",
                text: 'Have a project in mind? Get in touch.',
                buttonText: 'Contact Us',
                buttonUrl: '#contact',
              },
              style: {
                padding: { top: '4rem', right: '2rem', bottom: '4rem', left: '2rem' },
                backgroundColor: '#111827',
                color: '#ffffff',
                textAlign: 'center',
                borderRadius: '8px',
              },
            },
          ],
        },
      ],
      padding: { top: '5rem', bottom: '5rem' },
    },
  },

  // ───────────────────────────── LOGOS ─────────────────────────────
  {
    id: 'block-logos-client-grid',
    name: 'Logos — Client Grid',
    category: 'logos',
    section: {
      id: 'block-logos-client-grid:section',
      type: 'section',
      name: 'Logos — Client Grid',
      columns: [
        {
          id: 'block-logos-client-grid:col',
          width: 100,
          widgets: [
            {
              id: 'block-logos-client-grid:heading',
              type: 'heading',
              data: { text: 'Trusted by Leading Brands', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'block-logos-client-grid:logos',
              type: 'logo-grid',
              data: {
                logos: [
                  { src: 'https://via.placeholder.com/150x60?text=Brand+1', alt: 'Client 1' },
                  { src: 'https://via.placeholder.com/150x60?text=Brand+2', alt: 'Client 2' },
                  { src: 'https://via.placeholder.com/150x60?text=Brand+3', alt: 'Client 3' },
                  { src: 'https://via.placeholder.com/150x60?text=Brand+4', alt: 'Client 4' },
                  { src: 'https://via.placeholder.com/150x60?text=Brand+5', alt: 'Client 5' },
                  { src: 'https://via.placeholder.com/150x60?text=Brand+6', alt: 'Client 6' },
                ],
                grayscale: true,
              },
              style: { display: 'grid' },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
  },

  // ────────────────────────────── FAQ ──────────────────────────────
  {
    id: 'block-faq-accordion',
    name: 'FAQ — Accordion',
    category: 'faq',
    section: {
      id: 'block-faq-accordion:section',
      type: 'section',
      name: 'FAQ — Accordion',
      columns: [
        {
          id: 'block-faq-accordion:col',
          width: 100,
          widgets: [
            {
              id: 'block-faq-accordion:heading',
              type: 'heading',
              data: { text: 'Frequently Asked Questions', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'block-faq-accordion:faq',
              type: 'faq',
              data: {
                faqs: [
                  { question: 'What are your business hours?', answer: "We're available Monday through Friday, 9 AM to 6 PM EST." },
                  { question: 'How quickly do you respond to inquiries?', answer: 'We typically respond within 24 hours during business days.' },
                  { question: 'Do you offer consultations?', answer: 'Yes! We offer free 30-minute consultations for new clients.' },
                  { question: 'What services do you provide?', answer: 'Web design, development, branding, and digital marketing services.' },
                ],
              },
              style: {
                maxWidth: '800px',
                margin: { left: 'auto', right: 'auto' },
              },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
  },

  // ──────────────────────────── CONTACT ────────────────────────────
  {
    id: 'block-contact-form',
    name: 'Contact — Form',
    category: 'contact',
    section: {
      id: 'block-contact-form:section',
      type: 'section',
      name: 'Contact — Form',
      columns: [
        {
          id: 'block-contact-form:col',
          width: 100,
          widgets: [
            {
              id: 'block-contact-form:heading',
              type: 'heading',
              data: { text: 'Get in Touch', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '2rem' },
              },
            },
            {
              id: 'block-contact-form:form',
              type: 'contact-form',
              data: {
                fields: ['name', 'email', 'phone', 'message'],
                submitText: 'Send Message',
                successMessage: "Thank you! We'll get back to you within 24 hours.",
                saveToCRM: true,
              },
              style: {
                padding: { top: '2rem', right: '2rem', bottom: '2rem', left: '2rem' },
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                maxWidth: '600px',
                margin: { left: 'auto', right: 'auto' },
              },
            },
          ],
        },
      ],
      padding: { top: '5rem', bottom: '5rem' },
    },
  },
  {
    id: 'block-contact-map',
    name: 'Contact — Map',
    category: 'contact',
    section: {
      id: 'block-contact-map:section',
      type: 'section',
      name: 'Contact — Map',
      columns: [
        {
          id: 'block-contact-map:col',
          width: 100,
          widgets: [
            {
              id: 'block-contact-map:map',
              type: 'map',
              data: { address: 'New York, NY', latitude: 40.7128, longitude: -74.006, zoom: 12 },
              style: { width: '100%', height: '400px', borderRadius: '8px' },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
  },
  {
    id: 'block-contact-newsletter',
    name: 'Contact — Newsletter Capture',
    category: 'contact',
    section: {
      id: 'block-contact-newsletter:section',
      type: 'section',
      name: 'Contact — Newsletter Capture',
      columns: [
        {
          id: 'block-contact-newsletter:col',
          width: 100,
          widgets: [
            {
              id: 'block-contact-newsletter:newsletter',
              type: 'newsletter',
              data: {
                heading: 'Never Miss an Update',
                placeholder: 'Enter your email address',
                buttonText: 'Subscribe',
                successMessage: 'Thanks for subscribing! Check your inbox.',
              },
              style: {
                padding: { top: '3rem', right: '2rem', bottom: '3rem', left: '2rem' },
                backgroundColor: '#6366f1',
                color: '#ffffff',
                borderRadius: '8px',
                maxWidth: '640px',
                margin: { left: 'auto', right: 'auto' },
              },
            },
          ],
        },
      ],
      padding: { top: '5rem', bottom: '5rem' },
    },
  },

  // ──────────────────────────── CONTENT ────────────────────────────
  {
    id: 'block-content-section-header',
    name: 'Content — Section Header',
    category: 'content',
    section: {
      id: 'block-content-section-header:section',
      type: 'section',
      name: 'Content — Section Header',
      columns: [
        {
          id: 'block-content-section-header:col',
          width: 100,
          widgets: [
            {
              id: 'block-content-section-header:heading',
              type: 'heading',
              data: { text: 'A Better Way to Work', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.75rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '1rem' },
              },
            },
            {
              id: 'block-content-section-header:text',
              type: 'text',
              data: {
                content:
                  'Everything you need to launch, grow, and scale — in one connected platform your whole team will love.',
              },
              style: {
                fontSize: '1.125rem',
                lineHeight: '1.7',
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                maxWidth: '680px',
                margin: { left: 'auto', right: 'auto' },
              },
            },
          ],
        },
      ],
      padding: { top: '4rem', bottom: '2rem' },
    },
  },
  {
    id: 'block-content-gallery',
    name: 'Content — 3-Column Gallery',
    category: 'content',
    section: {
      id: 'block-content-gallery:section',
      type: 'section',
      name: 'Content — 3-Column Gallery',
      columns: [
        {
          id: 'block-content-gallery:col',
          width: 100,
          widgets: [
            {
              id: 'block-content-gallery:heading',
              type: 'heading',
              data: { text: 'Recent Work', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'block-content-gallery:gallery',
              type: 'gallery',
              data: {
                images: [
                  { src: 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800', alt: 'Project 1' },
                  { src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800', alt: 'Project 2' },
                  { src: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?w=800', alt: 'Project 3' },
                  { src: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800', alt: 'Project 4' },
                  { src: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=800', alt: 'Project 5' },
                  { src: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800', alt: 'Project 6' },
                ],
                columns: 3,
                gap: '1.5rem',
              },
              style: { display: 'grid' },
            },
          ],
        },
      ],
      backgroundColor: '#f8f9fa',
      padding: { top: '5rem', bottom: '5rem' },
    },
  },
  {
    id: 'block-content-skills',
    name: 'Content — Skill Bars',
    category: 'content',
    section: {
      id: 'block-content-skills:section',
      type: 'section',
      name: 'Content — Skill Bars',
      columns: [
        {
          id: 'block-content-skills:col',
          width: 100,
          widgets: [
            {
              id: 'block-content-skills:heading',
              type: 'heading',
              data: { text: 'Skills & Expertise', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'block-content-skills:skill-1',
              type: 'progress',
              data: { label: 'UI/UX Design', percentage: 95, color: '#6366f1' },
              style: { margin: { bottom: '1.5rem' } },
            },
            {
              id: 'block-content-skills:skill-2',
              type: 'progress',
              data: { label: 'Front-end Development', percentage: 90, color: '#16a34a' },
              style: { margin: { bottom: '1.5rem' } },
            },
            {
              id: 'block-content-skills:skill-3',
              type: 'progress',
              data: { label: 'Brand Strategy', percentage: 85, color: '#f59e0b' },
              style: { margin: { bottom: '1.5rem' } },
            },
          ],
        },
      ],
      padding: { top: '5rem', bottom: '5rem' },
    },
  },
  {
    id: 'block-content-featured-article',
    name: 'Content — Featured Article',
    category: 'content',
    section: {
      id: 'block-content-featured-article:section',
      type: 'section',
      name: 'Content — Featured Article',
      columns: [
        {
          id: 'block-content-featured-article:col',
          width: 100,
          widgets: [
            {
              id: 'block-content-featured-article:image',
              type: 'image',
              data: {
                src: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200',
                alt: 'Featured article',
                caption: '',
              },
              style: {
                width: '100%',
                height: 'auto',
                borderRadius: '8px',
                margin: { bottom: '2rem' },
              },
            },
            {
              id: 'block-content-featured-article:heading',
              type: 'heading',
              data: { text: 'How to Build a Successful Online Business', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                margin: { bottom: '1rem' },
              },
            },
            {
              id: 'block-content-featured-article:text',
              type: 'text',
              data: {
                content:
                  'Discover the essential strategies and tools you need to launch and grow a thriving online business. From marketing to operations, we cover it all.',
              },
              style: {
                fontSize: '1.125rem',
                lineHeight: '1.8',
                color: 'rgba(255,255,255,0.7)',
                margin: { bottom: '1.5rem' },
              },
            },
            {
              id: 'block-content-featured-article:button',
              type: 'button',
              data: { text: 'Read More', url: '#', openInNewTab: false },
              style: {
                padding: { top: '0.75rem', right: '1.5rem', bottom: '0.75rem', left: '1.5rem' },
                backgroundColor: '#6366f1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
              },
            },
          ],
        },
      ],
      padding: { top: '4rem', bottom: '4rem' },
    },
  },
  {
    id: 'block-content-team',
    name: 'Content — Team Grid',
    category: 'content',
    section: {
      id: 'block-content-team:section',
      type: 'section',
      name: 'Content — Team Grid',
      columns: [
        {
          id: 'block-content-team:col',
          width: 100,
          widgets: [
            {
              id: 'block-content-team:heading',
              type: 'heading',
              data: { text: 'Our Team', level: 2, tag: 'h2' },
              style: {
                fontSize: '2.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '3rem' },
              },
            },
            {
              id: 'block-content-team:features',
              type: 'features',
              data: {
                features: [
                  { icon: '👨‍💼', title: 'John Doe', description: 'CEO & Founder — leading the vision and strategy' },
                  { icon: '👩‍💻', title: 'Jane Smith', description: 'CTO — building world-class technology' },
                  { icon: '👨‍🎨', title: 'Mike Johnson', description: 'Creative Director — crafting beautiful experiences' },
                ],
              },
              style: { display: 'grid' },
            },
          ],
        },
      ],
      padding: { top: '5rem', bottom: '5rem' },
    },
  },

  // ───────────────────────────── FOOTER ────────────────────────────
  {
    id: 'block-footer-brand-social',
    name: 'Footer — Brand + Social',
    category: 'footer',
    section: {
      id: 'block-footer-brand-social:section',
      type: 'section',
      name: 'Footer — Brand + Social',
      columns: [
        {
          id: 'block-footer-brand-social:col',
          width: 100,
          widgets: [
            {
              id: 'block-footer-brand-social:divider',
              type: 'divider',
              data: { thickness: '1px', color: 'rgba(255,255,255,0.12)' },
              style: { margin: { bottom: '2rem' } },
            },
            {
              id: 'block-footer-brand-social:heading',
              type: 'heading',
              data: { text: 'Your Company', level: 3, tag: 'h3' },
              style: {
                fontSize: '1.5rem',
                fontWeight: '700',
                textAlign: 'center',
                margin: { bottom: '0.5rem' },
              },
            },
            {
              id: 'block-footer-brand-social:text',
              type: 'text',
              data: { content: '© 2026 Your Company. All rights reserved.' },
              style: {
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.55)',
                textAlign: 'center',
                margin: { bottom: '1.5rem' },
              },
            },
            {
              id: 'block-footer-brand-social:social',
              type: 'social-icons',
              data: {
                icons: [
                  { platform: 'facebook', url: '#' },
                  { platform: 'twitter', url: '#' },
                  { platform: 'instagram', url: '#' },
                  { platform: 'linkedin', url: '#' },
                ],
              },
              style: { display: 'flex', justifyContent: 'center' },
            },
          ],
        },
      ],
      backgroundColor: '#0b0b0f',
      padding: { top: '3rem', bottom: '3rem' },
      fullWidth: true,
    },
  },
];

/**
 * Lookup a premade block by id.
 */
export function getPremadeBlockById(id: string): SectionBlock | undefined {
  return PREMADE_BLOCKS.find((block) => block.id === id);
}

/**
 * All categories that currently have at least one premade block, in display
 * order. The UI uses this to avoid rendering empty category chips.
 */
export function getPremadeCategories(): BlockCategory[] {
  const order: BlockCategory[] = [
    'hero',
    'features',
    'pricing',
    'testimonials',
    'cta',
    'stats',
    'logos',
    'faq',
    'contact',
    'content',
    'footer',
  ];
  return order.filter((cat) => PREMADE_BLOCKS.some((b) => b.category === cat));
}
