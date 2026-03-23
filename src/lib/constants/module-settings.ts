/**
 * Module Settings Definitions
 *
 * Per-module setting fields and slug ↔ moduleId mappings
 * for the dynamic feature module settings pages.
 */

import type { FeatureModuleId } from '@/types/feature-modules';

// =============================================================================
// SETTING FIELD TYPES
// =============================================================================

export interface ModuleSettingField {
  key: string;
  label: string;
  description: string;
  type: 'toggle' | 'text' | 'number' | 'select';
  defaultValue: string | number | boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

// =============================================================================
// SLUG ↔ MODULE ID MAPPING
// =============================================================================

export const SLUG_TO_MODULE_ID: Record<string, FeatureModuleId> = {
  'crm-pipeline': 'crm_pipeline',
  'conversations': 'conversations',
  'sales-automation': 'sales_automation',
  'email-outreach': 'email_outreach',
  'social-media': 'social_media',
  'video-production': 'video_production',
  'forms-surveys': 'forms_surveys',
  'workflows': 'workflows',
  'proposals-docs': 'proposals_docs',
  'advanced-analytics': 'advanced_analytics',
  'website-builder': 'website_builder',
};

/** Maps every module (including ecommerce) to its settings page slug */
export const MODULE_ID_TO_SLUG: Record<FeatureModuleId, string> = {
  crm_pipeline: 'crm-pipeline',
  conversations: 'conversations',
  sales_automation: 'sales-automation',
  email_outreach: 'email-outreach',
  social_media: 'social-media',
  video_production: 'video-production',
  forms_surveys: 'forms-surveys',
  workflows: 'workflows',
  proposals_docs: 'proposals-docs',
  advanced_analytics: 'advanced-analytics',
  website_builder: 'website-builder',
  ecommerce: 'storefront', // special — links to existing /settings/storefront
};

/** Emoji icon per module, used on the settings hub cards */
export const MODULE_EMOJI: Record<FeatureModuleId, string> = {
  crm_pipeline: '📊',
  conversations: '💬',
  sales_automation: '🤖',
  email_outreach: '📧',
  social_media: '📱',
  video_production: '🎬',
  forms_surveys: '📋',
  workflows: '⚡',
  proposals_docs: '📄',
  advanced_analytics: '📈',
  website_builder: '🌐',
  ecommerce: '🛒',
};

// =============================================================================
// PER-MODULE SETTINGS
// =============================================================================

export const MODULE_SETTINGS: Record<string, ModuleSettingField[]> = {
  crm_pipeline: [
    {
      key: 'autoAssignLeads',
      label: 'Auto-assign new leads',
      description: 'Automatically assign incoming leads to team members using round-robin.',
      type: 'toggle',
      defaultValue: false,
    },
    {
      key: 'enableLeadScoring',
      label: 'Enable lead scoring',
      description: 'Automatically score leads based on engagement and profile data.',
      type: 'toggle',
      defaultValue: true,
    },
    {
      key: 'defaultPipelineView',
      label: 'Default pipeline view',
      description: 'How the pipeline is displayed by default.',
      type: 'select',
      defaultValue: 'board',
      options: [
        { value: 'board', label: 'Kanban Board' },
        { value: 'list', label: 'List View' },
        { value: 'table', label: 'Table View' },
      ],
    },
    {
      key: 'staleDealDays',
      label: 'Stale deal alert (days)',
      description: 'Flag deals with no activity after this many days.',
      type: 'number',
      defaultValue: 14,
      min: 1,
      max: 90,
    },
  ],

  conversations: [
    {
      key: 'autoGreeting',
      label: 'Auto-greeting message',
      description: 'Message sent automatically when a new conversation starts.',
      type: 'text',
      defaultValue: 'Hi! How can I help you today?',
    },
    {
      key: 'enableBusinessHours',
      label: 'Business hours routing',
      description: 'Route conversations differently during and after business hours.',
      type: 'toggle',
      defaultValue: false,
    },
    {
      key: 'maxConcurrent',
      label: 'Max concurrent conversations',
      description: 'Maximum number of AI conversations running simultaneously.',
      type: 'number',
      defaultValue: 10,
      min: 1,
      max: 100,
    },
  ],

  sales_automation: [
    {
      key: 'enableCoaching',
      label: 'AI coaching tips',
      description: 'Show AI-generated coaching tips to sales reps during deals.',
      type: 'toggle',
      defaultValue: true,
    },
    {
      key: 'riskSensitivity',
      label: 'Risk alert sensitivity',
      description: 'How aggressively to flag at-risk deals.',
      type: 'select',
      defaultValue: 'medium',
      options: [
        { value: 'low', label: 'Low — Only critical risks' },
        { value: 'medium', label: 'Medium — Balanced alerts' },
        { value: 'high', label: 'High — Flag early warnings' },
      ],
    },
    {
      key: 'weeklyReports',
      label: 'Weekly performance reports',
      description: 'Send weekly sales performance summaries to team leads.',
      type: 'toggle',
      defaultValue: true,
    },
  ],

  email_outreach: [
    {
      key: 'defaultSenderName',
      label: 'Default sender name',
      description: 'Name shown in the "From" field of outgoing emails.',
      type: 'text',
      defaultValue: '',
    },
    {
      key: 'dailySendLimit',
      label: 'Daily sending limit',
      description: 'Maximum emails sent per day across all campaigns.',
      type: 'number',
      defaultValue: 500,
      min: 10,
      max: 10000,
    },
    {
      key: 'trackOpens',
      label: 'Track email opens',
      description: 'Insert tracking pixel to monitor email open rates.',
      type: 'toggle',
      defaultValue: true,
    },
    {
      key: 'trackClicks',
      label: 'Track link clicks',
      description: 'Wrap links to track click-through rates.',
      type: 'toggle',
      defaultValue: true,
    },
  ],

  social_media: [
    {
      key: 'defaultPostTime',
      label: 'Default posting time',
      description: 'Default time for scheduled posts (24h format, e.g. 09:00).',
      type: 'text',
      defaultValue: '09:00',
    },
    {
      key: 'autoHashtags',
      label: 'Auto-suggest hashtags',
      description: 'AI suggests relevant hashtags when composing posts.',
      type: 'toggle',
      defaultValue: true,
    },
    {
      key: 'requireApproval',
      label: 'Content approval required',
      description: 'Require manager approval before posts go live.',
      type: 'toggle',
      defaultValue: false,
    },
  ],

  video_production: [
    {
      key: 'defaultQuality',
      label: 'Default video quality',
      description: 'Resolution for new video projects.',
      type: 'select',
      defaultValue: '1080p',
      options: [
        { value: '720p', label: '720p — Fast rendering' },
        { value: '1080p', label: '1080p — Standard HD' },
        { value: '4k', label: '4K — Maximum quality' },
      ],
    },
    {
      key: 'defaultAspectRatio',
      label: 'Default aspect ratio',
      description: 'Aspect ratio for new video projects.',
      type: 'select',
      defaultValue: '16:9',
      options: [
        { value: '16:9', label: '16:9 — Landscape' },
        { value: '9:16', label: '9:16 — Portrait / Reels' },
        { value: '1:1', label: '1:1 — Square' },
      ],
    },
    {
      key: 'addWatermark',
      label: 'Add watermark',
      description: 'Add your brand watermark to generated videos.',
      type: 'toggle',
      defaultValue: false,
    },
  ],

  forms_surveys: [
    {
      key: 'enableCaptcha',
      label: 'Enable CAPTCHA',
      description: 'Add CAPTCHA verification to prevent spam submissions.',
      type: 'toggle',
      defaultValue: true,
    },
    {
      key: 'notificationEmail',
      label: 'Notification email',
      description: 'Email address to receive form submission notifications.',
      type: 'text',
      defaultValue: '',
    },
    {
      key: 'defaultThankYou',
      label: 'Default thank-you message',
      description: 'Message shown after successful form submission.',
      type: 'text',
      defaultValue: 'Thank you for your submission!',
    },
  ],

  workflows: [
    {
      key: 'maxConcurrent',
      label: 'Max concurrent executions',
      description: 'Maximum workflow executions running at the same time.',
      type: 'number',
      defaultValue: 5,
      min: 1,
      max: 50,
    },
    {
      key: 'retryOnFailure',
      label: 'Retry failed actions',
      description: 'Automatically retry failed workflow actions once.',
      type: 'toggle',
      defaultValue: true,
    },
    {
      key: 'emailOnError',
      label: 'Email on workflow error',
      description: 'Send email notification when a workflow encounters an error.',
      type: 'toggle',
      defaultValue: true,
    },
  ],

  proposals_docs: [
    {
      key: 'defaultExpiryDays',
      label: 'Default expiry (days)',
      description: 'Proposals automatically expire after this many days.',
      type: 'number',
      defaultValue: 30,
      min: 7,
      max: 365,
    },
    {
      key: 'requireSignature',
      label: 'Require e-signature',
      description: 'Require electronic signature for proposal acceptance.',
      type: 'toggle',
      defaultValue: false,
    },
    {
      key: 'includeCompanyLogo',
      label: 'Include company logo',
      description: 'Automatically add your company logo to proposals.',
      type: 'toggle',
      defaultValue: true,
    },
  ],

  advanced_analytics: [
    {
      key: 'reportFrequency',
      label: 'Report frequency',
      description: 'How often automated reports are generated.',
      type: 'select',
      defaultValue: 'weekly',
      options: [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ],
    },
    {
      key: 'autoDetectWinners',
      label: 'Auto-detect A/B test winners',
      description: 'Automatically declare a winner when statistical significance is reached.',
      type: 'toggle',
      defaultValue: true,
    },
    {
      key: 'minSampleSize',
      label: 'Minimum sample size',
      description: 'Minimum participants before a test result is considered significant.',
      type: 'number',
      defaultValue: 100,
      min: 10,
      max: 10000,
    },
  ],

  website_builder: [
    {
      key: 'defaultMetaDescription',
      label: 'Default meta description',
      description: 'Default SEO description for new pages.',
      type: 'text',
      defaultValue: '',
    },
    {
      key: 'enableSeoSuggestions',
      label: 'Enable SEO suggestions',
      description: 'Show AI-powered SEO improvement suggestions.',
      type: 'toggle',
      defaultValue: true,
    },
    {
      key: 'googleAnalyticsId',
      label: 'Google Analytics tracking ID',
      description: 'GA4 measurement ID (e.g. G-XXXXXXX).',
      type: 'text',
      defaultValue: '',
    },
  ],
};

// =============================================================================
// HELPERS
// =============================================================================

/** Build default config values for a module (enabled + all setting defaults) */
export function getModuleDefaultConfig(moduleId: string): Record<string, unknown> {
  const fields = MODULE_SETTINGS[moduleId] ?? [];
  const defaults: Record<string, unknown> = { enabled: true };
  for (const field of fields) {
    defaults[field.key] = field.defaultValue;
  }
  return defaults;
}
