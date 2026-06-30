/**
 * Marketing import — Legal pages (Privacy, Security, Terms)
 *
 * Faithful capture of the three hardcoded `FallbackContent` marketing pages at:
 *   - src/app/(public)/privacy/page.tsx
 *   - src/app/(public)/security/page.tsx
 *   - src/app/(public)/terms/page.tsx
 *
 * Reproduced as canonical `Page` objects (status: 'draft') so they can be
 * imported into the visual editor as editable drafts. Copy is verbatim from the
 * source JSX. Widget shapes mirror what `ResponsiveRenderer` + the
 * widget-normalizer actually render (heading/text/features/button).
 */

import type { Page } from '@/types/website';

const IMPORT_TIMESTAMP = '2026-06-30T00:00:00.000Z';
const IMPORT_AUTHOR = 'marketing-import';

const META = {
  createdAt: IMPORT_TIMESTAMP,
  updatedAt: IMPORT_TIMESTAMP,
  createdBy: IMPORT_AUTHOR,
  lastEditedBy: IMPORT_AUTHOR,
} as const;

// ---------------------------------------------------------------------------
// Privacy Policy  →  slug: privacy
// ---------------------------------------------------------------------------
const privacyPage: Page = {
  id: 'privacy',
  slug: 'privacy',
  title: 'Privacy Policy',
  status: 'draft',
  seo: {},
  ...META,
  content: [
    {
      id: 'privacy-sec-header',
      type: 'section',
      columns: [
        {
          id: 'privacy-col-header',
          width: 100,
          widgets: [
            {
              id: 'privacy-w-title',
              type: 'heading',
              data: { level: 1, text: 'Privacy Policy' },
            },
            {
              id: 'privacy-w-updated',
              type: 'text',
              data: { content: 'Last updated: May 2026' },
            },
          ],
        },
      ],
    },
    {
      id: 'privacy-sec-intro',
      type: 'section',
      columns: [
        {
          id: 'privacy-col-intro',
          width: 100,
          widgets: [
            {
              id: 'privacy-w-intro',
              type: 'text',
              data: {
                content:
                  'At SalesVelocity.ai, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'privacy-sec-1',
      type: 'section',
      columns: [
        {
          id: 'privacy-col-1',
          width: 100,
          widgets: [
            {
              id: 'privacy-w-1-h',
              type: 'heading',
              data: { level: 2, text: '1. Information We Collect' },
            },
            {
              id: 'privacy-w-1-p1',
              type: 'text',
              data: {
                content:
                  'Account Information: Name, email address, company name, and payment details when you create an account or subscribe to a plan.',
              },
            },
            {
              id: 'privacy-w-1-p2',
              type: 'text',
              data: {
                content:
                  'Business Data: CRM records, contacts, deals, products, and other business information you store on our platform.',
              },
            },
            {
              id: 'privacy-w-1-p3',
              type: 'text',
              data: {
                content:
                  'AI Training Data: Information you provide to train your AI agents, including business descriptions, FAQs, product details, and training feedback.',
              },
            },
            {
              id: 'privacy-w-1-p4',
              type: 'text',
              data: {
                content:
                  'Usage Data: We automatically collect device information, IP addresses, browser type, pages visited, and feature usage patterns to improve our service.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'privacy-sec-2',
      type: 'section',
      columns: [
        {
          id: 'privacy-col-2',
          width: 100,
          widgets: [
            {
              id: 'privacy-w-2-h',
              type: 'heading',
              data: { level: 2, text: '2. How We Use Your Information' },
            },
            {
              id: 'privacy-w-2-p1',
              type: 'text',
              data: {
                content:
                  'We use your information to provide and improve our services, personalize your experience, communicate with you, and ensure platform security. We never sell your personal data.',
              },
            },
            {
              id: 'privacy-w-2-p2',
              type: 'text',
              data: {
                content:
                  'Your business data and AI training data are used exclusively to power your own account. We do not use your data to train AI models for other customers or for any other purpose outside of delivering our services to you.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'privacy-sec-3',
      type: 'section',
      columns: [
        {
          id: 'privacy-col-3',
          width: 100,
          widgets: [
            {
              id: 'privacy-w-3-h',
              type: 'heading',
              data: { level: 2, text: '3. Data Security' },
            },
            {
              id: 'privacy-w-3-p1',
              type: 'text',
              data: {
                content:
                  'All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. API keys are stored with additional encryption layers. We conduct regular security audits and maintain infrastructure on enterprise-grade cloud providers with SOC 2 compliance.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'privacy-sec-4',
      type: 'section',
      columns: [
        {
          id: 'privacy-col-4',
          width: 100,
          widgets: [
            {
              id: 'privacy-w-4-h',
              type: 'heading',
              data: { level: 2, text: '4. Third-Party Services' },
            },
            {
              id: 'privacy-w-4-p1',
              type: 'text',
              data: {
                content:
                  'We integrate with third-party services including Stripe (payments), Firebase (authentication and database), SendGrid (email), and Twilio (SMS/voice). When you use BYOK features, your API keys are sent directly to the respective AI providers. Each third-party service operates under its own privacy policy.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'privacy-sec-5',
      type: 'section',
      columns: [
        {
          id: 'privacy-col-5',
          width: 100,
          widgets: [
            {
              id: 'privacy-w-5-h',
              type: 'heading',
              data: { level: 2, text: '5. SMS / Mobile Phone Numbers' },
            },
            {
              id: 'privacy-w-5-p1',
              type: 'text',
              data: {
                content:
                  'When you opt in to receive SMS messages from SalesVelocity.ai — either through our public opt-in form at /sms-opt-in, during account onboarding, or by texting one of our numbers — we store your mobile number and your express written consent so we can deliver only the categories of messages you agreed to receive (account notifications, customer care, and/or marketing).',
              },
            },
            {
              id: 'privacy-w-5-p2',
              type: 'text',
              data: {
                content:
                  'We do not sell, rent, lease, or share your mobile phone number or SMS opt-in data with any third party for their marketing purposes. Your mobile information is used solely by SalesVelocity.ai and the regulated telecommunications providers (e.g., Twilio) that deliver our messages to your handset. Phone numbers and opt-in data are never disclosed to third-party advertisers, data brokers, or marketing affiliates.',
              },
            },
            {
              id: 'privacy-w-5-p3',
              type: 'text',
              data: {
                content:
                  'You can withdraw SMS consent at any time by replying STOP to any message, or by emailing privacy@salesvelocity.ai. Reply HELP for help. Message frequency varies. Message and data rates may apply.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'privacy-sec-6',
      type: 'section',
      columns: [
        {
          id: 'privacy-col-6',
          width: 100,
          widgets: [
            {
              id: 'privacy-w-6-h',
              type: 'heading',
              data: { level: 2, text: '6. Data Retention & Deletion' },
            },
            {
              id: 'privacy-w-6-p1',
              type: 'text',
              data: {
                content:
                  'We retain your data for as long as your account is active. Upon account termination, your data is retained for 30 days to allow for export, after which it is permanently deleted. You may request immediate deletion by contacting privacy@salesvelocity.ai.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'privacy-sec-7',
      type: 'section',
      columns: [
        {
          id: 'privacy-col-7',
          width: 100,
          widgets: [
            {
              id: 'privacy-w-7-h',
              type: 'heading',
              data: { level: 2, text: '7. Your Rights' },
            },
            {
              id: 'privacy-w-7-p1',
              type: 'text',
              data: {
                content:
                  'You have the right to access, correct, export, and delete your personal data at any time. You may also opt out of non-essential communications. For GDPR-covered individuals, you have additional rights including data portability and the right to object to processing.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'privacy-sec-8',
      type: 'section',
      columns: [
        {
          id: 'privacy-col-8',
          width: 100,
          widgets: [
            {
              id: 'privacy-w-8-h',
              type: 'heading',
              data: { level: 2, text: '8. Cookies & Tracking' },
            },
            {
              id: 'privacy-w-8-p1',
              type: 'text',
              data: {
                content:
                  'We use essential cookies for authentication and session management. We use analytics cookies to understand platform usage and improve our service. You can manage cookie preferences through your browser settings.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'privacy-sec-contact',
      type: 'section',
      columns: [
        {
          id: 'privacy-col-contact',
          width: 100,
          widgets: [
            {
              id: 'privacy-w-contact',
              type: 'text',
              data: { content: 'Questions? Contact us at privacy@salesvelocity.ai' },
            },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Security & Compliance  →  slug: security
// ---------------------------------------------------------------------------
const securityPage: Page = {
  id: 'security',
  slug: 'security',
  title: 'Security & Compliance',
  status: 'draft',
  seo: {},
  ...META,
  content: [
    {
      id: 'security-sec-header',
      type: 'section',
      columns: [
        {
          id: 'security-col-header',
          width: 100,
          widgets: [
            {
              id: 'security-w-title',
              type: 'heading',
              data: { level: 1, text: 'Security & Compliance' },
            },
            {
              id: 'security-w-subtitle',
              type: 'text',
              data: { content: 'Enterprise-grade security to protect your data' },
            },
          ],
        },
      ],
    },
    {
      id: 'security-sec-features',
      type: 'section',
      columns: [
        {
          id: 'security-col-features',
          width: 100,
          widgets: [
            {
              id: 'security-w-features',
              type: 'features',
              data: {
                features: [
                  {
                    icon: '🔒',
                    title: 'Data Encryption',
                    description: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256).',
                  },
                  {
                    icon: '🏢',
                    title: 'SOC 2 Compliant',
                    description: 'Infrastructure meets SOC 2 Type II compliance standards.',
                  },
                  {
                    icon: '🛡️',
                    title: 'GDPR Ready',
                    description: 'Fully compliant with GDPR, CCPA, and other privacy regulations.',
                  },
                  {
                    icon: '🔐',
                    title: 'Access Controls',
                    description: 'MFA, role-based permissions, and IP whitelisting.',
                  },
                  {
                    icon: '🔍',
                    title: 'Regular Audits',
                    description: 'Quarterly security audits by certified third-party firms.',
                  },
                  {
                    icon: '💾',
                    title: 'Automated Backups',
                    description: 'Daily backups with 30-day retention.',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      id: 'security-sec-report',
      type: 'section',
      columns: [
        {
          id: 'security-col-report',
          width: 100,
          widgets: [
            {
              id: 'security-w-report-h',
              type: 'heading',
              data: { level: 2, text: 'Report a Security Issue' },
            },
            {
              id: 'security-w-report-p',
              type: 'text',
              data: { content: 'We take security seriously. Report vulnerabilities responsibly.' },
            },
            {
              id: 'security-w-report-btn',
              type: 'button',
              data: {
                text: 'Report Vulnerability →',
                url: 'mailto:security@salesvelocity.ai',
              },
            },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Terms of Service  →  slug: terms
// ---------------------------------------------------------------------------
const termsPage: Page = {
  id: 'terms',
  slug: 'terms',
  title: 'Terms of Service',
  status: 'draft',
  seo: {},
  ...META,
  content: [
    {
      id: 'terms-sec-header',
      type: 'section',
      columns: [
        {
          id: 'terms-col-header',
          width: 100,
          widgets: [
            {
              id: 'terms-w-title',
              type: 'heading',
              data: { level: 1, text: 'Terms of Service' },
            },
            {
              id: 'terms-w-updated',
              type: 'text',
              data: { content: 'Last updated: February 2026' },
            },
          ],
        },
      ],
    },
    {
      id: 'terms-sec-intro',
      type: 'section',
      columns: [
        {
          id: 'terms-col-intro',
          width: 100,
          widgets: [
            {
              id: 'terms-w-intro',
              type: 'text',
              data: {
                content:
                  'Welcome to SalesVelocity.ai. By accessing or using our platform, you agree to be bound by these Terms of Service. Please read them carefully.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'terms-sec-1',
      type: 'section',
      columns: [
        {
          id: 'terms-col-1',
          width: 100,
          widgets: [
            {
              id: 'terms-w-1-h',
              type: 'heading',
              data: { level: 2, text: '1. Account Terms' },
            },
            {
              id: 'terms-w-1-p1',
              type: 'text',
              data: {
                content:
                  'You must be 18 years or older to use this service. You are responsible for maintaining the security of your account and password. You may not use the service for any illegal purpose.',
              },
            },
            {
              id: 'terms-w-1-p2',
              type: 'text',
              data: {
                content:
                  'You are responsible for all activity that occurs under your account. You must notify us immediately of any unauthorized use of your account or any other breach of security.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'terms-sec-2',
      type: 'section',
      columns: [
        {
          id: 'terms-col-2',
          width: 100,
          widgets: [
            {
              id: 'terms-w-2-h',
              type: 'heading',
              data: { level: 2, text: '2. Acceptable Use' },
            },
            {
              id: 'terms-w-2-p1',
              type: 'text',
              data: {
                content:
                  'You agree not to misuse our services, interfere with other users, attempt unauthorized access, or use the platform to send spam or malicious content. You may not use AI-generated content from our platform in ways that violate applicable laws, including but not limited to CAN-SPAM, TCPA, and GDPR regulations.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'terms-sec-3',
      type: 'section',
      columns: [
        {
          id: 'terms-col-3',
          width: 100,
          widgets: [
            {
              id: 'terms-w-3-h',
              type: 'heading',
              data: { level: 2, text: '3. Billing & Payments' },
            },
            {
              id: 'terms-w-3-p1',
              type: 'text',
              data: {
                content:
                  "SalesVelocity.ai is billed at $299 USD per month, flat. All fees are non-refundable except as required by law. We reserve the right to change pricing with 30 days' notice. Fair-use limits apply on storage and outbound volume; see the pricing page for details.",
              },
            },
            {
              id: 'terms-w-3-p2',
              type: 'text',
              data: {
                content:
                  'Free trials provide full access for 14 days. If you do not cancel before the trial ends, your payment method will be charged the standard $299/month rate.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'terms-sec-4',
      type: 'section',
      columns: [
        {
          id: 'terms-col-4',
          width: 100,
          widgets: [
            {
              id: 'terms-w-4-h',
              type: 'heading',
              data: { level: 2, text: '4. AI Usage & BYOK' },
            },
            {
              id: 'terms-w-4-p1',
              type: 'text',
              data: {
                content:
                  'When using the Bring Your Own Key (BYOK) feature, you are solely responsible for your API key security and any charges incurred with third-party AI providers. SalesVelocity.ai does not mark up or profit from your AI provider costs. Your API keys are encrypted at rest and never shared.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'terms-sec-5',
      type: 'section',
      columns: [
        {
          id: 'terms-col-5',
          width: 100,
          widgets: [
            {
              id: 'terms-w-5-h',
              type: 'heading',
              data: { level: 2, text: '5. Data Ownership' },
            },
            {
              id: 'terms-w-5-p1',
              type: 'text',
              data: {
                content:
                  'You retain full ownership of all data you upload, create, or generate through our platform. We do not use your business data to train AI models for other customers. Upon account termination, you may request a full export of your data within 30 days.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'terms-sec-6',
      type: 'section',
      columns: [
        {
          id: 'terms-col-6',
          width: 100,
          widgets: [
            {
              id: 'terms-w-6-h',
              type: 'heading',
              data: { level: 2, text: '6. Service Availability' },
            },
            {
              id: 'terms-w-6-p1',
              type: 'text',
              data: {
                content:
                  'We strive to maintain 99.9% uptime but do not guarantee uninterrupted service. We are not liable for any downtime, data loss, or damages arising from service interruptions, whether scheduled or unscheduled.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'terms-sec-7',
      type: 'section',
      columns: [
        {
          id: 'terms-col-7',
          width: 100,
          widgets: [
            {
              id: 'terms-w-7-h',
              type: 'heading',
              data: { level: 2, text: '7. Termination' },
            },
            {
              id: 'terms-w-7-p1',
              type: 'text',
              data: {
                content:
                  'Either party may terminate this agreement at any time. Upon termination, your access to the platform will cease and your data will be retained for 30 days before permanent deletion, unless you request earlier deletion.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'terms-sec-8',
      type: 'section',
      columns: [
        {
          id: 'terms-col-8',
          width: 100,
          widgets: [
            {
              id: 'terms-w-8-h',
              type: 'heading',
              data: { level: 2, text: '8. Limitation of Liability' },
            },
            {
              id: 'terms-w-8-p1',
              type: 'text',
              data: {
                content:
                  'To the maximum extent permitted by law, SalesVelocity.ai shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'terms-sec-contact',
      type: 'section',
      columns: [
        {
          id: 'terms-col-contact',
          width: 100,
          widgets: [
            {
              id: 'terms-w-contact',
              type: 'text',
              data: { content: 'Questions? Contact us at legal@salesvelocity.ai' },
            },
          ],
        },
      ],
    },
  ],
};

export const pages: Page[] = [privacyPage, securityPage, termsPage];
