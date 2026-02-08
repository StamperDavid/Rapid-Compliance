/**
 * Feature Toggle Service - UI Clutter Killer
 *
 * Allows clients to show/hide features from their navigation and dashboard.
 * The AI Implementation Guide can trigger this when a client says
 * "I don't need that" - immediately cleaning up visual clutter.
 *
 * Persistence: Firestore (organizations/rapid-compliance-root/settings/featureVisibility)
 *
 * @module feature-toggle-service
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
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

export function buildNavigationStructure(): NavSection[] {
  return [
    {
      id: 'command_center',
      title: 'Command Center',
      items: [
        { id: 'workforce', href: '/workforce', icon: '🎛️', label: 'Workforce HQ', featureId: 'workforce_hq' },
        { id: 'dashboard', href: '/dashboard', icon: '📊', label: 'Dashboard', featureId: 'dashboard' },
        { id: 'conversations', href: '/conversations', icon: '💬', label: 'Conversations', featureId: 'conversations' },
      ],
    },
    {
      id: 'crm',
      title: 'CRM',
      items: [
        { id: 'leads', href: '/leads', icon: '🎯', label: 'Leads', featureId: 'leads' },
        { id: 'deals', href: '/deals', icon: '💼', label: 'Deals', featureId: 'deals' },
        { id: 'contacts', href: '/contacts', icon: '👤', label: 'Contacts', featureId: 'contacts' },
        { id: 'living_ledger', href: '/living-ledger', icon: '📒', label: 'Living Ledger', featureId: 'living_ledger' },
      ],
    },
    {
      id: 'lead_gen',
      title: 'Lead Gen',
      items: [
        { id: 'forms', href: '/forms', icon: '📋', label: 'Forms', featureId: 'forms' },
        { id: 'lead_research', href: '/leads/research', icon: '🔬', label: 'Lead Research', featureId: 'lead_research' },
        { id: 'lead_scoring', href: '/lead-scoring', icon: '⭐', label: 'Lead Scoring', featureId: 'lead_scoring' },
      ],
    },
    {
      id: 'outbound',
      title: 'Outbound',
      items: [
        { id: 'sequences', href: '/outbound/sequences', icon: '📧', label: 'Sequences', featureId: 'email_sequences' },
        { id: 'campaigns', href: '/email/campaigns', icon: '📮', label: 'Campaigns', featureId: 'email_campaigns' },
        { id: 'email_writer', href: '/email-writer', icon: '✍️', label: 'Email Writer', featureId: 'email_writer' },
        { id: 'nurture', href: '/nurture', icon: '🌱', label: 'Nurture', featureId: 'nurture' },
        { id: 'calls', href: '/calls', icon: '📞', label: 'Calls', featureId: 'calls' },
      ],
    },
    {
      id: 'automation',
      title: 'Automation',
      items: [
        { id: 'workflows', href: '/workflows', icon: '⚡', label: 'Workflows', featureId: 'workflows' },
        { id: 'ab_tests', href: '/ab-tests', icon: '🧪', label: 'A/B Tests', featureId: 'ab_tests' },
      ],
    },
    {
      id: 'content_factory',
      title: 'Content Factory',
      items: [
        { id: 'video_studio', href: '/content/video', icon: '🎬', label: 'Video Studio', featureId: 'video_studio' },
        { id: 'social_media', href: '/social/campaigns', icon: '📱', label: 'Social Media', featureId: 'social_media' },
        { id: 'proposals', href: '/proposals/builder', icon: '📄', label: 'Proposals', featureId: 'proposals' },
        { id: 'battlecards', href: '/battlecards', icon: '🃏', label: 'Battlecards', featureId: 'battlecards' },
      ],
    },
    {
      id: 'ai_workforce',
      title: 'AI Workforce',
      items: [
        { id: 'agent_training', href: '/settings/ai-agents/training', icon: '🤖', label: 'Agent Training', featureId: 'agent_training' },
        { id: 'voice_ai', href: '/voice/training', icon: '🎙️', label: 'Voice AI Lab', featureId: 'voice_ai' },
        { id: 'social_ai', href: '/social/training', icon: '📢', label: 'Social AI Lab', featureId: 'social_ai' },
        { id: 'seo_ai', href: '/seo/training', icon: '🔍', label: 'SEO AI Lab', featureId: 'seo_ai' },
        { id: 'datasets', href: '/ai/datasets', icon: '📚', label: 'Datasets', featureId: 'datasets' },
        { id: 'fine_tuning', href: '/ai/fine-tuning', icon: '🎯', label: 'Fine-Tuning', featureId: 'fine_tuning' },
      ],
    },
    {
      id: 'ecommerce',
      title: 'E-Commerce',
      items: [
        { id: 'products', href: '/products', icon: '📦', label: 'Products', featureId: 'products' },
        { id: 'orders', href: '/analytics/ecommerce', icon: '💰', label: 'Orders', featureId: 'orders' },
        { id: 'storefront', href: '/settings/storefront', icon: '🏪', label: 'Storefront', featureId: 'storefront' },
      ],
    },
    {
      id: 'analytics',
      title: 'Analytics',
      items: [
        { id: 'analytics_overview', href: '/analytics', icon: '📈', label: 'Overview', featureId: 'analytics_overview' },
        { id: 'revenue', href: '/analytics/revenue', icon: '💵', label: 'Revenue', featureId: 'revenue_analytics' },
        { id: 'pipeline', href: '/analytics/pipeline', icon: '🔄', label: 'Pipeline', featureId: 'pipeline_analytics' },
        { id: 'sequence_analytics', href: '/sequences/analytics', icon: '📊', label: 'Sequences', featureId: 'sequence_analytics' },
      ],
    },
    {
      id: 'website',
      title: 'Website',
      items: [
        { id: 'pages', href: '/website/pages', icon: '🌐', label: 'Pages', featureId: 'website_pages' },
        { id: 'blog', href: '/website/blog', icon: '📝', label: 'Blog', featureId: 'website_blog' },
        { id: 'domains', href: '/website/domains', icon: '🔗', label: 'Domains', featureId: 'website_domains' },
        { id: 'seo', href: '/website/seo', icon: '🔎', label: 'SEO', featureId: 'website_seo' },
        { id: 'site_settings', href: '/website/settings', icon: '🎨', label: 'Site Settings', featureId: 'website_settings' },
      ],
    },
    {
      id: 'settings',
      title: 'Settings',
      items: [
        { id: 'settings', href: '/settings', icon: '⚙️', label: 'Settings', featureId: 'settings' },
        { id: 'integrations', href: '/integrations', icon: '🔌', label: 'Integrations', featureId: 'integrations' },
        { id: 'api_keys', href: '/settings/api-keys', icon: '🔑', label: 'API Keys', featureId: 'api_keys' },
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
  static async getVisibilitySettings(): Promise<FeatureVisibilitySettings | null> {
    try {
      const settings = await FirestoreService.get<FeatureVisibilitySettings>(
        `organizations/${PLATFORM_ID}/settings`,
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
   * @param featureId - The feature to toggle
   * @param status - 'hidden' to hide, 'unconfigured' or 'configured' to show
   * @param userId - Who made the change
   * @param reason - Optional reason (e.g., "client said not needed")
   */
  static async toggleFeature(
    featureId: string,
    status: FeatureStatus,
    userId: string,
    reason?: string
  ): Promise<void> {
    const path = `organizations/${PLATFORM_ID}/settings`;
    const docId = 'featureVisibility';

    // Get existing settings
    let settings = await this.getVisibilitySettings();

    settings ??= {
      features: {},
      hiddenCategories: [],
      updatedAt: new Date(),
      updatedBy: userId,
    };

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
    category: FeatureCategory,
    hidden: boolean,
    userId: string
  ): Promise<void> {
    const path = `organizations/${PLATFORM_ID}/settings`;
    const docId = 'featureVisibility';

    let settings = await this.getVisibilitySettings();

    settings ??= {
      features: {},
      hiddenCategories: [],
      updatedAt: new Date(),
      updatedBy: userId,
    };

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
    featureIds: string[],
    userId: string,
    reason?: string
  ): Promise<void> {
    for (const featureId of featureIds) {
      await this.toggleFeature(featureId, 'hidden', userId, reason);
    }
  }

  /**
   * Show multiple features at once (batch operation)
   */
  static async showFeatures(
    featureIds: string[],
    userId: string
  ): Promise<void> {
    for (const featureId of featureIds) {
      await this.toggleFeature(featureId, 'unconfigured', userId);
    }
  }

  /**
   * Reset all visibility settings to default (show everything)
   */
  static async resetToDefault(userId: string): Promise<void> {
    const path = `organizations/${PLATFORM_ID}/settings`;
    const docId = 'featureVisibility';

    const settings: FeatureVisibilitySettings = {
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
  static async getFilteredNavigation(): Promise<NavSection[]> {
    const settings = await this.getVisibilitySettings();
    const fullNav = buildNavigationStructure();

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
  static async getHiddenCount(): Promise<number> {
    const settings = await this.getVisibilitySettings();
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
  static async isFeatureHidden(featureId: string): Promise<boolean> {
    const settings = await this.getVisibilitySettings();
    if (!settings) {
      return false;
    }
    return settings.features[featureId]?.status === 'hidden';
  }
}

export default FeatureToggleService;
