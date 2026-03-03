/**
 * Keyword Tracker Service
 *
 * Wraps Serper SEO + DataForSEO with Firestore persistence for keyword
 * ranking history. Tracks our domain's SERP positions over time and
 * compares against competitor positions.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getGrowthKeywordsCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { getSerperSEOService } from '@/lib/integrations/seo/serper-seo-service';
import { getDataForSEOService } from '@/lib/integrations/seo/dataforseo-service';
import { getGrowthActivityLogger } from './growth-activity-logger';
import { getCompetitorMonitorService } from './competitor-monitor';
import type {
  KeywordTrackingEntry,
  KeywordRanking,
  CompetitorKeywordPosition,
} from '@/types/growth';

// Our domain — loaded from environment or default
const OUR_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN ?? 'salesvelocity.ai';

// ============================================================================
// SERVICE
// ============================================================================

class KeywordTrackerService {
  /**
   * Add a keyword for tracking. Immediately checks current position.
   */
  async addKeyword(
    keyword: string,
    tags: string[],
    addedBy: string
  ): Promise<KeywordTrackingEntry> {
    if (!adminDb) {throw new Error('Database not available');}

    // Check for duplicates
    const existing = await this.getByKeyword(keyword);
    if (existing) {
      throw new Error(`Keyword "${keyword}" is already being tracked`);
    }

    // Get keyword data from DataForSEO
    const dataForSEO = getDataForSEOService();
    const keywordDataResult = await dataForSEO.getKeywordData([keyword]);
    const kd = keywordDataResult.data?.[0];

    // Check current SERP position
    const serper = getSerperSEOService();
    const posResult = await serper.checkKeywordPosition(keyword, OUR_DOMAIN);
    const currentPosition = posResult.data ?? null;

    // Get competitor positions
    const competitorPositions = await this.getCompetitorPositions(keyword);

    const now = new Date().toISOString();
    const initialRanking: KeywordRanking = { position: currentPosition, checkedAt: now };

    const entry: Omit<KeywordTrackingEntry, 'id'> = {
      keyword: keyword.toLowerCase().trim(),
      currentPosition,
      previousPosition: null,
      positionChange: null,
      searchVolume: kd?.searchVolume ?? 0,
      cpc: kd?.cpc ?? 0,
      difficulty: kd?.competitionLevel ?? 'MEDIUM',
      competitorPositions,
      rankingHistory: [initialRanking],
      lastCheckedAt: now,
      addedAt: now,
      addedBy,
      tags,
      isActive: true,
    };

    const collectionPath = getGrowthKeywordsCollection();
    const docRef = await adminDb.collection(collectionPath).add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });

    const result: KeywordTrackingEntry = { id: docRef.id, ...entry };

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'keyword_added',
      `Started tracking keyword: "${keyword}" (position: ${currentPosition ?? 'not ranking'})`,
      addedBy,
      { keywordId: docRef.id, keyword, position: currentPosition }
    );

    return result;
  }

  /**
   * Bulk add keywords.
   */
  async bulkAddKeywords(
    keywords: Array<{ keyword: string; tags: string[] }>,
    addedBy: string
  ): Promise<{ added: KeywordTrackingEntry[]; errors: string[] }> {
    const added: KeywordTrackingEntry[] = [];
    const errs: string[] = [];

    for (const kw of keywords) {
      try {
        const entry = await this.addKeyword(kw.keyword, kw.tags, addedBy);
        added.push(entry);
      } catch (err) {
        errs.push(`"${kw.keyword}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { added, errors: errs };
  }

  /**
   * Get a keyword entry by Firestore ID.
   */
  async getById(keywordId: string): Promise<KeywordTrackingEntry | null> {
    if (!adminDb) {return null;}

    const collectionPath = getGrowthKeywordsCollection();
    const doc = await adminDb.collection(collectionPath).doc(keywordId).get();
    if (!doc.exists) {return null;}

    return { id: doc.id, ...doc.data() } as KeywordTrackingEntry;
  }

  /**
   * Get a keyword entry by keyword string.
   */
  async getByKeyword(keyword: string): Promise<KeywordTrackingEntry | null> {
    if (!adminDb) {return null;}

    const collectionPath = getGrowthKeywordsCollection();
    const snap = await adminDb
      .collection(collectionPath)
      .where('keyword', '==', keyword.toLowerCase().trim())
      .limit(1)
      .get();

    if (snap.empty) {return null;}
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as KeywordTrackingEntry;
  }

  /**
   * List all tracked keywords.
   */
  async listKeywords(options: {
    activeOnly?: boolean;
    tag?: string;
    limit?: number;
  } = {}): Promise<KeywordTrackingEntry[]> {
    if (!adminDb) {return [];}

    const collectionPath = getGrowthKeywordsCollection();
    let query: FirebaseFirestore.Query = adminDb
      .collection(collectionPath)
      .orderBy('searchVolume', 'desc');

    if (options.activeOnly !== undefined) {
      query = query.where('isActive', '==', options.activeOnly);
    }

    if (options.tag) {
      query = query.where('tags', 'array-contains', options.tag);
    }

    query = query.limit(options.limit ?? 100);

    const snap = await query.get();
    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as KeywordTrackingEntry[];
  }

  /**
   * Check current ranking for a specific keyword and update history.
   */
  async checkRanking(keywordId: string): Promise<KeywordTrackingEntry> {
    if (!adminDb) {throw new Error('Database not available');}

    const entry = await this.getById(keywordId);
    if (!entry) {throw new Error('Keyword not found');}

    const serper = getSerperSEOService();
    const posResult = await serper.checkKeywordPosition(entry.keyword, OUR_DOMAIN);
    const newPosition = posResult.data ?? null;

    const previousPosition = entry.currentPosition;
    let positionChange: number | null = null;
    if (newPosition !== null && previousPosition !== null) {
      // Positive change means we moved UP (lower position number = better)
      positionChange = previousPosition - newPosition;
    }

    const now = new Date().toISOString();
    const newRanking: KeywordRanking = { position: newPosition, checkedAt: now };

    // Keep last 90 entries in history
    const history = [...(entry.rankingHistory ?? []), newRanking].slice(-90);

    // Also refresh competitor positions
    const competitorPositions = await this.getCompetitorPositions(entry.keyword);

    const updates = {
      currentPosition: newPosition,
      previousPosition,
      positionChange,
      rankingHistory: history,
      competitorPositions,
      lastCheckedAt: now,
    };

    const collectionPath = getGrowthKeywordsCollection();
    await adminDb.collection(collectionPath).doc(keywordId).update(updates);

    // Log significant changes
    if (positionChange !== null && Math.abs(positionChange) >= 3) {
      const direction = positionChange > 0 ? 'improved' : 'dropped';
      const activityLogger = getGrowthActivityLogger();
      await activityLogger.log(
        'keyword_ranking_changed',
        `"${entry.keyword}" ${direction} by ${Math.abs(positionChange)} positions (now #${newPosition})`,
        'system',
        { keywordId, keyword: entry.keyword, from: previousPosition, to: newPosition, change: positionChange }
      );
    }

    return { ...entry, ...updates };
  }

  /**
   * Remove a keyword (soft-delete).
   */
  async removeKeyword(keywordId: string, removedBy: string): Promise<void> {
    if (!adminDb) {throw new Error('Database not available');}

    const entry = await this.getById(keywordId);
    if (!entry) {throw new Error('Keyword not found');}

    const collectionPath = getGrowthKeywordsCollection();
    await adminDb.collection(collectionPath).doc(keywordId).update({
      isActive: false,
    });

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'keyword_removed',
      `Stopped tracking keyword: "${entry.keyword}"`,
      removedBy,
      { keywordId, keyword: entry.keyword }
    );
  }

  /**
   * Check rankings for ALL active keywords. Used by daily cron.
   */
  async checkAllRankings(): Promise<{
    checked: number;
    improved: number;
    declined: number;
    errors: string[];
  }> {
    const keywords = await this.listKeywords({ activeOnly: true });
    let checked = 0;
    let improved = 0;
    let declined = 0;
    const errs: string[] = [];

    for (const kw of keywords) {
      try {
        const updated = await this.checkRanking(kw.id);
        checked++;
        if (updated.positionChange !== null) {
          if (updated.positionChange > 0) {improved++;}
          if (updated.positionChange < 0) {declined++;}
        }
      } catch (err) {
        errs.push(`"${kw.keyword}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'cron_keyword_check',
      `Daily keyword check: ${checked} checked, ${improved} improved, ${declined} declined`,
      'cron:keyword-tracker',
      { checked, improved, declined, errors: errs.length }
    );

    return { checked, improved, declined, errors: errs };
  }

  /**
   * Get competitor SERP positions for a keyword.
   */
  private async getCompetitorPositions(
    keyword: string
  ): Promise<CompetitorKeywordPosition[]> {
    try {
      const competitorService = getCompetitorMonitorService();
      const competitors = await competitorService.listCompetitors({ activeOnly: true, limit: 10 });

      if (competitors.length === 0) {return [];}

      const serper = getSerperSEOService();
      const serpResult = await serper.searchSERP(keyword, { num: 30 });

      if (!serpResult.success || !serpResult.data) {return [];}

      const positions: CompetitorKeywordPosition[] = [];
      for (const competitor of competitors) {
        const match = serpResult.data.organic.find(
          (r) =>
            r.domain === competitor.domain ||
            r.domain === `www.${competitor.domain}` ||
            competitor.domain === `www.${r.domain}`
        );

        positions.push({
          competitorId: competitor.id,
          domain: competitor.domain,
          name: competitor.name,
          position: match?.position ?? null,
          url: match?.link ?? '',
        });
      }

      return positions;
    } catch (err) {
      logger.error(
        'KeywordTracker: Failed to get competitor positions',
        err instanceof Error ? err : new Error(String(err))
      );
      return [];
    }
  }
}

// Singleton
let instance: KeywordTrackerService | null = null;

export function getKeywordTrackerService(): KeywordTrackerService {
  instance ??= new KeywordTrackerService();
  return instance;
}
