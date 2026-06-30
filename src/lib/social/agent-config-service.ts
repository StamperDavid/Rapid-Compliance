/**
 * Agent Config Service
 * Loads/saves autonomous posting agent configuration from Firestore.
 * Replaces hardcoded constants in autonomous-posting-agent.ts with dynamic config.
 *
 * Firestore path: organizations/{PLATFORM_ID}/settings/social_agent_config
 */

import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import {
  DEFAULT_CONTENT_CATEGORIES,
  type AutonomousAgentSettings,
  type EngagementActionType,
} from '@/types/social';

const SETTINGS_COLLECTION = 'settings';
const CONFIG_DOC_ID = 'social_agent_config';

function settingsPath(): string {
  return getSubCollection(SETTINGS_COLLECTION);
}

/** Sensible defaults matching the original hardcoded values */
export const DEFAULT_AGENT_SETTINGS: AutonomousAgentSettings = {
  agentEnabled: true,
  velocityLimits: {
    POST: 10,
    REPLY: 10,
    LIKE: 30,
    FOLLOW: 5,
    REPOST: 15,
    RECYCLE: 3,
  } as Record<EngagementActionType, number>,
  sentimentBlockKeywords: [
    'scam', 'fraud', 'fake', 'terrible', 'awful', 'hate', 'worst', 'garbage',
    'lawsuit', 'legal action', 'sue', 'report', 'complaint', 'angry',
    'disappointed', 'furious', 'disgust', 'unethical', 'liar', 'lying',
  ],
  escalationTriggerKeywords: [
    'lawsuit', 'legal action', 'attorney', 'lawyer', 'sue', 'court',
    'threat', 'threaten', 'report you', 'authorities', 'fbi', 'ftc',
    'complaint', 'class action', 'violation', 'breach of contract',
    'cease and desist', 'defamation', 'liable', 'damages',
  ],
  recycleCooldownDays: 30,
  maxDailyPosts: 5,
  preferredPostingTimes: [],
  pauseOnWeekends: true,
  autoApprovalEnabled: false,
  autoQueueEnabled: false,
  contentCategories: [...DEFAULT_CONTENT_CATEGORIES],
};

export class AgentConfigService {
  /** In-memory cache for the config */
  private static cachedConfig: AutonomousAgentSettings | null = null;
  private static cacheTimestamp = 0;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get the current agent config, falling back to defaults
   */
  static async getConfig(): Promise<AutonomousAgentSettings> {
    // Return cached if still fresh
    const now = Date.now();
    if (this.cachedConfig && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.cachedConfig;
    }

    try {
      const saved = await AdminFirestoreService.get<AutonomousAgentSettings>(
        settingsPath(),
        CONFIG_DOC_ID
      );

      if (saved) {
        // Merge with defaults to fill any missing fields
        this.cachedConfig = { ...DEFAULT_AGENT_SETTINGS, ...saved };
      } else {
        this.cachedConfig = { ...DEFAULT_AGENT_SETTINGS };
      }

      this.cacheTimestamp = now;
      return this.cachedConfig;
    } catch (error) {
      logger.error('AgentConfigService: Failed to load config, using defaults', error instanceof Error ? error : new Error(String(error)));
      return { ...DEFAULT_AGENT_SETTINGS };
    }
  }

  /**
   * Save updated agent config to Firestore
   */
  static async saveConfig(
    config: Partial<AutonomousAgentSettings>,
    updatedBy: string
  ): Promise<AutonomousAgentSettings> {
    const current = await this.getConfig();
    const updated: AutonomousAgentSettings = {
      ...current,
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await AdminFirestoreService.set(settingsPath(), CONFIG_DOC_ID, updated);

    // Bust cache
    this.cachedConfig = updated;
    this.cacheTimestamp = Date.now();

    logger.info('AgentConfigService: Config saved', { updatedBy });

    return updated;
  }

  /**
   * Get the operator-managed list of content categories, falling back to the
   * defaults when none have been customized.
   */
  static async getCategories(): Promise<string[]> {
    const config = await this.getConfig();
    const list = config.contentCategories;
    return list && list.length > 0 ? [...list] : [...DEFAULT_CONTENT_CATEGORIES];
  }

  /**
   * Add a new content category. Case-insensitive de-duplication; trims
   * whitespace. Returns the updated category list.
   */
  static async addCategory(label: string, updatedBy: string): Promise<string[]> {
    const trimmed = label.trim();
    if (!trimmed) {
      throw new Error('Category name cannot be empty');
    }
    const categories = await this.getCategories();
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Category "${trimmed}" already exists`);
    }
    const next = [...categories, trimmed];
    await this.saveConfig({ contentCategories: next }, updatedBy);
    return next;
  }

  /**
   * Rename a content category. Returns the updated list. The caller is
   * responsible for re-tagging any queued posts that used the old label.
   */
  static async renameCategory(
    oldLabel: string,
    newLabel: string,
    updatedBy: string
  ): Promise<string[]> {
    const trimmedNew = newLabel.trim();
    if (!trimmedNew) {
      throw new Error('Category name cannot be empty');
    }
    const categories = await this.getCategories();
    const idx = categories.findIndex((c) => c.toLowerCase() === oldLabel.toLowerCase());
    if (idx === -1) {
      throw new Error(`Category "${oldLabel}" not found`);
    }
    if (
      categories.some(
        (c, i) => i !== idx && c.toLowerCase() === trimmedNew.toLowerCase()
      )
    ) {
      throw new Error(`Category "${trimmedNew}" already exists`);
    }
    const next = [...categories];
    next[idx] = trimmedNew;
    await this.saveConfig({ contentCategories: next }, updatedBy);
    return next;
  }

  /**
   * Remove a content category. Returns the updated list. The caller is
   * responsible for clearing the category from any queued posts that used it.
   */
  static async removeCategory(label: string, updatedBy: string): Promise<string[]> {
    const categories = await this.getCategories();
    const next = categories.filter((c) => c.toLowerCase() !== label.toLowerCase());
    if (next.length === categories.length) {
      throw new Error(`Category "${label}" not found`);
    }
    await this.saveConfig({ contentCategories: next }, updatedBy);
    return next;
  }

  /**
   * Invalidate the in-memory cache (for testing or force-refresh)
   */
  static invalidateCache(): void {
    this.cachedConfig = null;
    this.cacheTimestamp = 0;
  }
}
