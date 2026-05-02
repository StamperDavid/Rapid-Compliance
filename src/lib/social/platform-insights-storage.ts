/**
 * Platform Insights Storage Service
 *
 * Persists the latest AI-generated insights for each (platform, accountId)
 * pair so they survive page reloads without a new LLM call.
 *
 * Storage path (via getSubCollection — never hardcoded):
 *   organizations/rapid-compliance-root/platform_insights/{platform}_{accountId}
 *
 * IMPORTANT: Server-side only. Uses Firebase Admin SDK per CLAUDE.md rule:
 *   "Server routes MUST use Admin SDK, never client SDK."
 *
 * Standing Rule #1: this service never touches a GM.
 * Standing Rule #2: this service never mutates training feedback.
 */

import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import type { SocialPlatform } from '@/types/social';
import type { PlatformInsightsResult } from '@/lib/agents/marketing/platform-insights-service';

// Re-export so callers can stay fully typed without reaching into the
// service file directly.
export type { PlatformInsightsResult };

// ─── Collection ────────────────────────────────────────────────────────────

const INSIGHTS_COLLECTION = 'platform_insights';
const FILE = 'social/platform-insights-storage.ts';

function insightsPath(): string {
  return getSubCollection(INSIGHTS_COLLECTION);
}

function docId(platform: SocialPlatform, accountId: string): string {
  return `${platform}_${accountId}`;
}

function getDb() {
  if (!adminDb) {
    throw new Error(
      'Firebase Admin not initialized — PlatformInsightsStorage requires server-side execution',
    );
  }
  return adminDb;
}

// ─── Document shape ─────────────────────────────────────────────────────────

export interface SavedPlatformInsights {
  /** Composite doc ID: {platform}_{accountId} */
  id: string;
  platform: SocialPlatform;
  accountId: string;
  insights: PlatformInsightsResult;
  /** ISO timestamp from the moment the LLM result was persisted */
  generatedAt: string;
  specialistId: string;
  specialistName: string | null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class PlatformInsightsStorage {
  /**
   * Retrieve the most recently saved insights for a (platform, accountId).
   * Returns null when no doc exists yet — the UI should show the "generate"
   * empty state in this case.
   */
  static async getSaved(
    platform: SocialPlatform,
    accountId: string,
  ): Promise<SavedPlatformInsights | null> {
    try {
      const id = docId(platform, accountId);
      const snap = await getDb().collection(insightsPath()).doc(id).get();
      if (!snap.exists) { return null; }
      return snap.data() as SavedPlatformInsights;
    } catch (error) {
      logger.error(
        'PlatformInsightsStorage: getSaved failed',
        error instanceof Error ? error : new Error(String(error)),
        { platform, accountId, file: FILE },
      );
      return null;
    }
  }

  /**
   * Persist (or overwrite) the insights for a (platform, accountId).
   * Called by the POST route after every successful LLM generation.
   */
  static async saveInsights(
    platform: SocialPlatform,
    accountId: string,
    payload: {
      insights: PlatformInsightsResult;
      generatedAt: string;
      specialistId: string;
      specialistName: string | null;
    },
  ): Promise<SavedPlatformInsights> {
    const id = docId(platform, accountId);
    const record: SavedPlatformInsights = {
      id,
      platform,
      accountId,
      insights: payload.insights,
      generatedAt: payload.generatedAt,
      specialistId: payload.specialistId,
      specialistName: payload.specialistName,
    };

    await getDb().collection(insightsPath()).doc(id).set(record);

    logger.info('PlatformInsightsStorage: insights saved', {
      platform,
      accountId,
      specialistId: payload.specialistId,
      generatedAt: payload.generatedAt,
      file: FILE,
    });

    return record;
  }

  /**
   * Delete the saved insights for a (platform, accountId).
   * Exposed so the operator can force a clean slate before regenerating.
   */
  static async clearSaved(
    platform: SocialPlatform,
    accountId: string,
  ): Promise<void> {
    try {
      const id = docId(platform, accountId);
      await getDb().collection(insightsPath()).doc(id).delete();
      logger.info('PlatformInsightsStorage: cleared', { platform, accountId, file: FILE });
    } catch (error) {
      logger.error(
        'PlatformInsightsStorage: clearSaved failed',
        error instanceof Error ? error : new Error(String(error)),
        { platform, accountId, file: FILE },
      );
    }
  }
}
