/**
 * Captured marketing pages → canonical visual-editor `Page` objects.
 *
 * Faithful reproduction of the hardcoded `FallbackContent` JSX from the three
 * public pages (about / contact / docs) as importable DRAFT pages. Copy is
 * verbatim from the source JSX; widget `type`/`data` shapes match exactly what
 * the live `ResponsiveRenderer` consumes (see
 * `src/components/website-builder/ResponsiveRenderer.tsx` and
 * `src/lib/website-builder/widget-normalizer.ts`).
 *
 * Honest gaps (no exact widget existed — closest widget + real text used):
 *  - Docs category cards: each source card is an icon + title + a clickable
 *    BULLETED LIST of doc links. The `features` widget's per-card shape is
 *    icon/title/description (single string), so each card's doc list is joined
 *    into the `description`. Visually a 4-up icon+title+text grid; the bullets
 *    become one line. A person can't tell the cards apart from the original at
 *    a glance.
 *  - Docs "Need Help?" block: reproduced with the `cta` widget (boxed, centered
 *    heading + text + button — the closest match to the gradient call-out). The
 *    live `cta` renderer does not navigate on button click, so the original
 *    link target `/contact` is preserved in `data.buttonUrl` for the editor but
 *    is inert at render time.
 *  - Contact info cards (Email Us / Live Chat): reproduced with `icon-box`
 *    (emoji icon + title + description), matching the source's emoji + heading +
 *    line layout.
 *  - About "Get in Touch →": the source is a styled `<Link>` that looks like a
 *    button; reproduced as a `button` widget (carries the `/contact` url).
 */

import type { Page } from '@/types/website';

const IMPORT_TIMESTAMP = '2026-06-30T00:00:00.000Z';
const IMPORT_AUTHOR = 'marketing-import';

const aboutPage: Page = {
  id: 'about',
  slug: 'about',
  title: 'About Us',
  status: 'draft',
  seo: {},
  content: [
    {
      id: 'about-section-hero',
      type: 'section',
      columns: [
        {
          id: 'about-col-hero',
          width: 100,
          widgets: [
            {
              id: 'about-w-title',
              type: 'heading',
              data: { level: 1, text: 'About Us' },
            },
            {
              id: 'about-w-subtitle',
              type: 'text',
              data: {
                content: 'Building the future of AI-powered sales automation',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'about-section-mission',
      type: 'section',
      columns: [
        {
          id: 'about-col-mission',
          width: 100,
          widgets: [
            {
              id: 'about-w-mission-heading',
              type: 'heading',
              data: { level: 2, text: 'Our Mission' },
            },
            {
              id: 'about-w-mission-text',
              type: 'text',
              data: {
                content:
                  'We believe every business deserves access to world-class sales automation, regardless of size or budget. SalesVelocity.ai democratizes cutting-edge technology, making it accessible to startups and enterprises alike.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'about-section-story',
      type: 'section',
      columns: [
        {
          id: 'about-col-story',
          width: 100,
          widgets: [
            {
              id: 'about-w-story-heading',
              type: 'heading',
              data: { level: 2, text: 'Our Story' },
            },
            {
              id: 'about-w-story-text',
              type: 'text',
              data: {
                content:
                  'Founded in 2024, SalesVelocity.ai emerged from a simple observation: most businesses struggle with lead qualification, follow-ups, and sales process consistency.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'about-section-cta',
      type: 'section',
      columns: [
        {
          id: 'about-col-cta',
          width: 100,
          widgets: [
            {
              id: 'about-w-cta-button',
              type: 'button',
              data: { text: 'Get in Touch →', url: '/contact' },
            },
          ],
        },
      ],
    },
  ],
  createdAt: IMPORT_TIMESTAMP,
  updatedAt: IMPORT_TIMESTAMP,
  createdBy: IMPORT_AUTHOR,
  lastEditedBy: IMPORT_AUTHOR,
};

const contactPage: Page = {
  id: 'contact',
  slug: 'contact',
  title: 'Get in Touch',
  status: 'draft',
  seo: {},
  content: [
    {
      id: 'contact-section-hero',
      type: 'section',
      columns: [
        {
          id: 'contact-col-hero',
          width: 100,
          widgets: [
            {
              id: 'contact-w-title',
              type: 'heading',
              data: { level: 1, text: 'Get in Touch' },
            },
            {
              id: 'contact-w-subtitle',
              type: 'text',
              data: { content: "Have questions? We'd love to hear from you." },
            },
          ],
        },
      ],
    },
    {
      id: 'contact-section-body',
      type: 'section',
      columns: [
        {
          id: 'contact-col-form',
          width: 50,
          widgets: [
            {
              id: 'contact-w-form',
              type: 'contact-form',
              data: {
                submitText: 'Send Message',
                successMessage: "Message sent! We'll get back to you soon.",
                saveToCRM: true,
                fields: [
                  {
                    name: 'name',
                    label: 'Name',
                    type: 'text',
                    placeholder: 'John Doe',
                    required: true,
                  },
                  {
                    name: 'email',
                    label: 'Email',
                    type: 'email',
                    placeholder: 'john@company.com',
                    required: true,
                  },
                  {
                    name: 'company',
                    label: 'Company',
                    type: 'text',
                    placeholder: 'Acme Inc.',
                    required: false,
                  },
                  {
                    name: 'message',
                    label: 'Message',
                    type: 'textarea',
                    placeholder: 'Tell us how we can help...',
                    required: true,
                  },
                ],
              },
            },
          ],
        },
        {
          id: 'contact-col-info',
          width: 50,
          widgets: [
            {
              id: 'contact-w-info-email',
              type: 'icon-box',
              data: {
                icon: '📧',
                title: 'Email Us',
                description: 'support@salesvelocity.ai',
              },
            },
            {
              id: 'contact-w-info-chat',
              type: 'icon-box',
              data: {
                icon: '💬',
                title: 'Live Chat',
                description: 'Available 9am-6pm EST',
              },
            },
          ],
        },
      ],
    },
  ],
  createdAt: IMPORT_TIMESTAMP,
  updatedAt: IMPORT_TIMESTAMP,
  createdBy: IMPORT_AUTHOR,
  lastEditedBy: IMPORT_AUTHOR,
};

const docsPage: Page = {
  id: 'docs',
  slug: 'docs',
  title: 'Documentation',
  status: 'draft',
  seo: {},
  content: [
    {
      id: 'docs-section-hero',
      type: 'section',
      columns: [
        {
          id: 'docs-col-hero',
          width: 100,
          widgets: [
            {
              id: 'docs-w-title',
              type: 'heading',
              data: { level: 1, text: 'Documentation' },
            },
            {
              id: 'docs-w-subtitle',
              type: 'text',
              data: {
                content:
                  'Everything you need to know about using SalesVelocity.ai',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'docs-section-categories',
      type: 'section',
      columns: [
        {
          id: 'docs-col-categories',
          width: 100,
          widgets: [
            {
              id: 'docs-w-categories',
              type: 'features',
              data: {
                features: [
                  {
                    icon: '🚀',
                    title: 'Getting Started',
                    description:
                      'Quick Start Guide · Account Setup · Training Your Agent',
                  },
                  {
                    icon: '📊',
                    title: 'CRM & Sales',
                    description:
                      'Managing Leads · Deal Pipeline · Workflow Automation',
                  },
                  {
                    icon: '🤖',
                    title: 'AI Configuration',
                    description:
                      'Agent Personality · Knowledge Base · Advanced Prompting',
                  },
                  {
                    icon: '🔗',
                    title: 'Integrations',
                    description: 'Stripe · Google Calendar · Slack · API Reference',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      id: 'docs-section-help',
      type: 'section',
      columns: [
        {
          id: 'docs-col-help',
          width: 100,
          widgets: [
            {
              id: 'docs-w-help-cta',
              type: 'cta',
              data: {
                heading: 'Need Help?',
                text: 'Our support team responds within 24 hours.',
                buttonText: 'Contact Support →',
                buttonUrl: '/contact',
              },
            },
          ],
        },
      ],
    },
  ],
  createdAt: IMPORT_TIMESTAMP,
  updatedAt: IMPORT_TIMESTAMP,
  createdBy: IMPORT_AUTHOR,
  lastEditedBy: IMPORT_AUTHOR,
};

export const pages: Page[] = [aboutPage, contactPage, docsPage];
