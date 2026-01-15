/**
 * Feature Toggle Service - UI Clutter Killer
 *
 * Allows clients to show/hide features from their navigation and dashboard.
 * The AI Implementation Guide can trigger this when a client says
 * "I don't need that" - immediately cleaning up visual clutter.
 *
 * Persistence: Firestore (organizations/{orgId}/settings/featureVisibility)
 *
 * @module feature-toggle-service
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import type { FeatureStatus } from './system-health-service';

// Re-export FeatureStatus for consumers
export type { FeatureStatus } from './system-health-service';

// ============================================================================
// TYPES
// ============================================================================

export type FeatureCategory =
  | 'command_center'
  | 'crm'
  | 'lead_gen'
  | 'outbound'
  | 'automation'
  | 'content_factory'
  | 'ai_workforce'
  | 'ecommerce'
  | 'analytics'
  | 'website'
  | 'settings';

export interface FeatureVisibility {
  featureId: string;
  status: FeatureStatus;
  hiddenAt?: Date;
  hiddenBy?: string;
  reason?: string; // Why it was hidden (e.g., "client said not needed")
}

export interface FeatureVisibilitySettings {
  organizationId: string;
  features: Record<string, FeatureVisibility>;
  hiddenCategories: FeatureCategory[];
  updatedAt: Date;
  updatedBy: string;
}

export interface NavSection {
  id: FeatureCategory;
  title: string;
  items: NavItem[];
}

export interface NavItem {
  id: string;
  href: string;
  icon: string;
  label: string;
  featureId?: string; // For visibility toggling
}

// ============================================================================
// NAVIGATION STRUCTURE (Full Definition)
// ============================================================================

export function buildNavigationStructure(orgId: string): NavSection[] {
  return [
    {
      id: 'command_center',
      title: 'Command Center',
      items: [
        { id: 'workforce', href: `/workspace/${orgId}/workforce`, icon: '🎛️', label: 'Workforce HQ', featureId: 'workforce_hq' },
        { id: 'dashboard', href: `/workspace/${orgId}/dashboard`, icon: '📊', label: 'Dashboard', featureId: 'dashboard' },
        { id: 'conversations', href: `/workspace/${orgId}/conversations`, icon: '💬', label: 'Conversations', featureId: 'conversations' },
      ],
    },
    {
      id: 'crm',
      title: 'CRM',
      items: [
        { id: 'leads', href: `/workspace/${orgId}/leads`, icon: '🎯', label: 'Leads', featureId: 'leads' },
        { id: 'deals', href: `/workspace/${orgId}/deals`, icon: '💼', label: 'Deals', featureId: 'deals' },
        { id: 'contacts', href: `/workspace/${orgId}/contacts`, icon: '👤', label: 'Contacts', featureId: 'contacts' },
        { id: 'living_ledger', href: `/workspace/${orgId}/living-ledger`, icon: '📒', label: 'Living Ledger', featureId: 'living_ledger' },
      ],
    },
    {
      id: 'lead_gen',
      title: 'Lead Gen',
      items: [
        { id: 'forms', href: `/workspace/${orgId}/forms`, icon: '📋', label: 'Forms', featureId: 'forms' },
        { id: 'lead_research', href: `/workspace/${orgId}/leads/research`, icon: '🔬', label: 'Lead Research', featureId: 'lead_research' },
        { id: 'lead_scoring', href: `/workspace/${orgId}/lead-scoring`, icon: '⭐', label: 'Lead Scoring', featureId: 'lead_scoring' },
      ],
    },
    {
      id: 'outbound',
      title: 'Outbound',
      items: [
        { id: 'sequences', href: `/workspace/${orgId}/outbound/sequences`, icon: '📧', label: 'Sequences', featureId: 'email_sequences' },
        { id: 'campaigns', href: `/workspace/${orgId}/email/campaigns`, icon: '📮', label: 'Campaigns', featureId: 'email_campaigns' },
        { id: 'email_writer', href: `/workspace/${orgId}/email-writer`, icon: '✍️', label: 'Email Writer', featureId: 'email_writer' },
        { id: 'nurture', href: `/workspace/${orgId}/nurture`, icon: '🌱', label: 'Nurture', featureId: 'nurture' },
        { id: 'calls', href: `/workspace/${orgId}/calls`, icon: '📞', label: 'Calls', featureId: 'calls' },
      ],
    },
    {
      id: 'automation',
      title: 'Automation',
      items: [
        { id: 'workflows', href: `/workspace/${orgId}/workflows`, icon: '⚡', label: 'Workflows', featureId: 'workflows' },
        { id: 'ab_tests', href: `/workspace/${orgId}/ab-tests`, icon: '🧪', label: 'A/B Tests', featureId: 'ab_tests' },
      ],
    },
    {
      id: 'content_factory',
      title: 'Content Factory',
      items: [
        { id: 'video_studio', href: `/workspace/${orgId}/content/video`, icon: '🎬', label: 'Video Studio', featureId: 'video_studio' },
        { id: 'social_media', href: `/workspace/${orgId}/social/campaigns`, icon: '📱', label: 'Social Media', featureId: 'social_media' },
        { id: 'proposals', href: `/workspace/${orgId}/proposals/builder`, icon: '📄', label: 'Proposals', featureId: 'proposals' },
        { id: 'battlecards', href: `/workspace/${orgId}/battlecards`, icon: '🃏', label: 'Battlecards', featureId: 'battlecards' },
      ],
    },
    {
      id: 'ai_workforce',
      title: 'AI Workforce',
      items: [
        { id: 'agent_training', href: `/workspace/${orgId}/settings/ai-agents/training`, icon: '🤖', label: 'Agent Training', featureId: 'agent_training' },
        { id: 'voice_ai', href: `/workspace/${orgId}/voice/training`, icon: '🎙️', label: 'Voice AI Lab', featureId: 'voice_ai' },
        { id: 'social_ai', href: `/workspace/${orgId}/social/training`, icon: '📢', label: 'Social AI Lab', featureId: 'social_ai' },
        { id: 'seo_ai', href: `/workspace/${orgId}/seo/training`, icon: '🔍', label: 'SEO AI Lab', featureId: 'seo_ai' },
        { id: 'datasets', href: `/workspace/${orgId}/ai/datasets`, icon: '📚', label: 'Datasets', featureId: 'datasets' },
        { id: 'fine_tuning', href: `/workspace/${orgId}/ai/fine-tuning`, icon: '🎯', label: 'Fine-Tuning', featureId: 'fine_tuning' },
      ],
    },
    {
      id: 'ecommerce',
      title: 'E-Commerce',
      items: [
        { id: 'products', href: `/workspace/${orgId}/products`, icon: '📦', label: 'Products', featureId: 'products' },
        { id: 'orders', href: `/workspace/${orgId}/analytics/ecommerce`, icon: '💰', label: 'Orders', featureId: 'orders' },
        { id: 'storefront', href: `/workspace/${orgId}/settings/storefront`, icon: '🏪', label: 'Storefront', featureId: 'storefront' },
      ],
    },
    {
      id: 'analytics',
      title: 'Analytics',
      items: [
        { id: 'analytics_overview', href: `/workspace/${orgId}/analytics`, icon: '📈', label: 'Overview', featureId: 'analytics_overview' },
        { id: 'revenue', href: `/workspace/${orgId}/analytics/revenue`, icon: '💵', label: 'Revenue', featureId: 'revenue_analytics' },
        { id: 'pipeline', href: `/workspace/${orgId}/analytics/pipeline`, icon: '🔄', label: 'Pipeline', featureId: 'pipeline_analytics' },
        { id: 'sequence_analytics', href: `/workspace/${orgId}/sequences/analytics`, icon: '📊', label: 'Sequences', featureId: 'sequence_analytics' },
      ],
    },
    {
      id: 'website',
      title: 'Website',
      items: [
        { id: 'pages', href: `/workspace/${orgId}/website/pages`, icon: '🌐', label: 'Pages', featureId: 'website_pages' },
        { id: 'blog', href: `/workspace/${orgId}/website/blog`, icon: '📝', label: 'Blog', featureId: 'website_blog' },
        { id: 'domains', href: `/workspace/${orgId}/website/domains`, icon: '🔗', label: 'Domains', featureId: 'website_domains' },
        { id: 'seo', href: `/workspace/${orgId}/website/seo`, icon: '🔎', label: 'SEO', featureId: 'website_seo' },
        { id: 'site_settings', href: `/workspace/${orgId}/website/settings`, icon: '🎨', label: 'Site Settings', featureId: 'website_settings' },
      ],
    },
    {
      id: 'settings',
      title: 'Settings',
      items: [
        { id: 'settings', href: `/workspace/${orgId}/settings`, icon: '⚙️', label: 'Settings', featureId: 'settings' },
        { id: 'integrations', href: `/workspace/${orgId}/integrations`, icon: '🔌', label: 'Integrations', featureId: 'integrations' },
        { id: 'api_keys', href: `/workspace/${orgId}/settings/api-keys`, icon: '🔑', label: 'API Keys', featureId: 'api_keys' },
      ],
    },
  ];
}

// ============================================================================
// FEATURE TOGGLE SERVICE
// ============================================================================

export class FeatureToggleService {

  /**
   * Get feature visibility settings for an organization
   */
  static async getVisibilitySettings(organizationId: string): Promise<FeatureVisibilitySettings | null> {
    try {
      const settings = await FirestoreService.get<FeatureVisibilitySettings>(
        `organizations/${organizationId}/settings`,
        'featureVisibility'
      );
      return settings;
    } catch {
      return null;
    }
  }

  /**
   * Toggle a single feature's visibility
   *
   * @param organizationId - The org ID
   * @param featureId - The feature to toggle
   * @param status - 'hidden' to hide, 'unconfigured' or 'configured' to show
   * @param userId - Who made the change
   * @param reason - Optional reason (e.g., "client said not needed")
   */
  static async toggleFeature(
    organizationId: string,
    featureId: string,
    status: FeatureStatus,
    userId: string,
    reason?: string
  ): Promise<void> {
    const path = `organizations/${organizationId}/settings`;
    const docId = 'featureVisibility';

    // Get existing settings
    let settings = await this.getVisibilitySettings(organizationId);

    if (!settings) {
      settings = {
        organizationId,
        features: {},
        hiddenCategories: [],
        updatedAt: new Date(),
        updatedBy: userId,
      };
    }

    // Update the feature
    settings.features[featureId] = {
      featureId,
      status,
      hiddenAt: status === 'hidden' ? new Date() : undefined,
      hiddenBy: status === 'hidden' ? userId : undefined,
      reason: status === 'hidden' ? reason : undefined,
    };

    settings.updatedAt = new Date();
    settings.updatedBy = userId;

    // Save to Firestore
    await FirestoreService.set(path, docId, settings, true);
  }

  /**
   * Toggle an entire category's visibility
   */
  static async toggleCategory(
    organizationId: string,
    category: FeatureCategory,
    hidden: boolean,
    userId: string
  ): Promise<void> {
    const path = `organizations/${organizationId}/settings`;
    const docId = 'featureVisibility';

    let settings = await this.getVisibilitySettings(organizationId);

    if (!settings) {
      settings = {
        organizationId,
        features: {},
        hiddenCategories: [],
        updatedAt: new Date(),
        updatedBy: userId,
      };
    }

    if (hidden) {
      if (!settings.hiddenCategories.includes(category)) {
        settings.hiddenCategories.push(category);
      }
    } else {
      settings.hiddenCategories = settings.hiddenCategories.filter(c => c !== category);
    }

    settings.updatedAt = new Date();
    settings.updatedBy = userId;

    await FirestoreService.set(path, docId, settings, true);
  }

  /**
   * Hide multiple features at once (batch operation)
   */
  static async hideFeatures(
    organizationId: string,
    featureIds: string[],
    userId: string,
    reason?: string
  ): Promise<void> {
    for (const featureId of featureIds) {
      await this.toggleFeature(organizationId, featureId, 'hidden', userId, reason);
    }
  }

  /**
   * Show multiple features at once (batch operation)
   */
  static async showFeatures(
    organizationId: string,
    featureIds: string[],
    userId: string
  ): Promise<void> {
    for (const featureId of featureIds) {
      await this.toggleFeature(organizationId, featureId, 'unconfigured', userId);
    }
  }

  /**
   * Reset all visibility settings to default (show everything)
   */
  static async resetToDefault(organizationId: string, userId: string): Promise<void> {
    const path = `organizations/${organizationId}/settings`;
    const docId = 'featureVisibility';

    const settings: FeatureVisibilitySettings = {
      organizationId,
      features: {},
      hiddenCategories: [],
      updatedAt: new Date(),
      updatedBy: userId,
    };

    await FirestoreService.set(path, docId, settings, false);
  }

  /**
   * Get filtered navigation based on visibility settings
   */
  static async getFilteredNavigation(organizationId: string): Promise<NavSection[]> {
    const settings = await this.getVisibilitySettings(organizationId);
    const fullNav = buildNavigationStructure(organizationId);

    if (!settings) {
      return fullNav; // No settings = show everything
    }

    return fullNav
      // Filter out hidden categories
      .filter(section => !settings.hiddenCategories.includes(section.id))
      // Filter out hidden items within each section
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          if (!item.featureId) {
            return true; // No feature ID = always show
          }
          const featureSettings = settings.features[item.featureId];
          return featureSettings?.status !== 'hidden';
        }),
      }))
      // Remove empty sections
      .filter(section => section.items.length > 0);
  }

  /**
   * Get hidden features count (for UI display)
   */
  static async getHiddenCount(organizationId: string): Promise<number> {
    const settings = await this.getVisibilitySettings(organizationId);
    if (!settings) {
      return 0;
    }

    const hiddenFeatures = Object.values(settings.features).filter(f => f.status === 'hidden').length;
    const hiddenCategories = settings.hiddenCategories.length;

    return hiddenFeatures + hiddenCategories;
  }

  /**
   * Check if a specific feature is hidden
   */
  static async isFeatureHidden(organizationId: string, featureId: string): Promise<boolean> {
    const settings = await this.getVisibilitySettings(organizationId);
    if (!settings) {
      return false;
    }
    return settings.features[featureId]?.status === 'hidden';
  }
}

export default FeatureToggleService;
