/**
 * Agent Config Service
 * Loads/saves autonomous posting agent configuration from Firestore.
 * Replaces hardcoded constants in autonomous-posting-agent.ts with dynamic config.
 *
 * Firestore path: organizations/{orgId}/settings/social_agent_config
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { AutonomousAgentSettings, EngagementActionType } from '@/types/social';

const SETTINGS_COLLECTION = 'settings';
const CONFIG_DOC_ID = 'social_agent_config';

function settingsPath(): string {
  return `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${SETTINGS_COLLECTION}`;
}

/** Sensible defaults matching the original hardcoded values */
export const DEFAULT_AGENT_SETTINGS: AutonomousAgentSettings = {
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
      const saved = await FirestoreService.get<AutonomousAgentSettings>(
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

    await FirestoreService.set(settingsPath(), CONFIG_DOC_ID, updated);

    // Bust cache
    this.cachedConfig = updated;
    this.cacheTimestamp = Date.now();

    logger.info('AgentConfigService: Config saved', { updatedBy });

    return updated;
  }

  /**
   * Invalidate the in-memory cache (for testing or force-refresh)
   */
  static invalidateCache(): void {
    this.cachedConfig = null;
    this.cacheTimestamp = 0;
  }
}
