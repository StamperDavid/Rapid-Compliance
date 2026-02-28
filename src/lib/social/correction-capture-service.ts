/**
 * Correction Capture Service
 *
 * Captures corrections when users edit AI-generated social media drafts.
 * Primary training signal for the Golden Playbook system.
 *
 * Firestore path: organizations/{PLATFORM_ID}/socialCorrections/{correctionId}
 */

import type { SocialCorrection, SocialPlatform } from '@/types/social';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

/**
 * Input data for capturing a correction
 */
export interface CaptureInput {
  approvalId: string;
  postId: string;
  original: string;
  corrected: string;
  platform: SocialPlatform;
  postType?: string;
  context?: string;
  flagReason?: string;
  capturedBy: string;
}

/**
 * Filters for querying corrections
 */
export interface CorrectionFilters {
  platform?: SocialPlatform;
  analyzed?: boolean;
  limit?: number;
}

/**
 * Pattern detected in corrections
 */
export interface CorrectionPattern {
  type: 'shortening' | 'lengthening' | 'tone_shift' | 'word_replacement' | 'structural';
  description: string;
  frequency: number;
  examples: string[];
}

function correctionsPath(): string {
  return getSubCollection('socialCorrections');
}

export class CorrectionCaptureService {
  /**
   * Capture a correction when user edits a draft
   */
  static async captureCorrection(data: CaptureInput): Promise<SocialCorrection> {
    if (data.original === data.corrected) {
      throw new Error('No meaningful edit detected — original and corrected content are identical');
    }

    const correctionId = `corr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const correction: SocialCorrection = {
      id: correctionId,
      approvalId: data.approvalId,
      postId: data.postId,
      original: data.original,
      corrected: data.corrected,
      platform: data.platform,
      postType: data.postType,
      context: data.context,
      flagReason: data.flagReason,
      capturedAt: new Date().toISOString(),
      capturedBy: data.capturedBy,
      analyzed: false,
    };

    await FirestoreService.set(correctionsPath(), correctionId, correction, false);

    logger.info('CorrectionCaptureService: Correction captured', {
      correctionId,
      approvalId: data.approvalId,
      platform: data.platform,
      originalLength: data.original.length,
      correctedLength: data.corrected.length,
    });

    return correction;
  }

  /**
   * Get corrections with optional filters
   */
  static async getCorrections(filters?: CorrectionFilters): Promise<SocialCorrection[]> {
    try {
      const { where, orderBy, limit } = await import('firebase/firestore');
      const constraints = [];

      if (filters?.platform) {
        constraints.push(where('platform', '==', filters.platform));
      }
      if (filters?.analyzed !== undefined) {
        constraints.push(where('analyzed', '==', filters.analyzed));
      }

      constraints.push(orderBy('capturedAt', 'desc'));

      if (filters?.limit) {
        constraints.push(limit(filters.limit));
      }

      return await FirestoreService.getAll<SocialCorrection>(correctionsPath(), constraints);
    } catch (error) {
      logger.error('CorrectionCaptureService: Failed to get corrections', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get correction counts for dashboard display
   */
  static async getCorrectionCount(): Promise<{ total: number; unanalyzed: number }> {
    try {
      const all = await FirestoreService.getAll<SocialCorrection>(correctionsPath());
      const unanalyzed = all.filter(c => !c.analyzed).length;
      return { total: all.length, unanalyzed };
    } catch (error) {
      logger.error('CorrectionCaptureService: Failed to get counts', error instanceof Error ? error : new Error(String(error)));
      return { total: 0, unanalyzed: 0 };
    }
  }

  /**
   * Get a single correction by ID
   */
  static async getCorrection(correctionId: string): Promise<SocialCorrection | null> {
    return FirestoreService.get<SocialCorrection>(correctionsPath(), correctionId);
  }

  /**
   * Mark corrections as analyzed after processing
   */
  static async markAsAnalyzed(correctionIds: string[], playbookVersion: string): Promise<void> {
    const analyzedAt = new Date().toISOString();

    const updatePromises = correctionIds.map(async (correctionId) => {
      await FirestoreService.update(correctionsPath(), correctionId, {
        analyzed: true,
        analyzedAt,
        playbackVersion: playbookVersion,
      });
    });

    await Promise.all(updatePromises);

    logger.info('CorrectionCaptureService: Corrections marked as analyzed', {
      count: correctionIds.length,
      playbookVersion,
    });
  }

  /**
   * Delete a single correction
   */
  static async deleteCorrection(correctionId: string): Promise<void> {
    await FirestoreService.delete(correctionsPath(), correctionId);
    logger.info('CorrectionCaptureService: Correction deleted', { correctionId });
  }

  /**
   * Analyze recent corrections for common patterns (heuristic-based, no AI)
   */
  static async getRecentPatterns(count: number): Promise<CorrectionPattern[]> {
    const corrections = await this.getCorrections({ limit: count });

    if (corrections.length === 0) {
      return [];
    }

    const patterns = new Map<string, CorrectionPattern>();

    for (const correction of corrections) {
      const originalLen = correction.original.length;
      const correctedLen = correction.corrected.length;
      const lengthDiffPct = originalLen > 0 ? ((correctedLen - originalLen) / originalLen) * 100 : 0;
      const example = `${correction.original.substring(0, 60)}... → ${correction.corrected.substring(0, 60)}...`;

      let patternKey: string | null = null;
      let patternData: Omit<CorrectionPattern, 'frequency' | 'examples'> | null = null;

      if (lengthDiffPct < -10) {
        patternKey = 'shortening';
        patternData = { type: 'shortening', description: 'User consistently shortens AI-generated content' };
      } else if (lengthDiffPct > 10) {
        patternKey = 'lengthening';
        patternData = { type: 'lengthening', description: 'User consistently adds more detail to AI-generated content' };
      } else {
        patternKey = 'word_replacement';
        patternData = { type: 'word_replacement', description: 'User replaces specific words or phrases while maintaining length' };
      }

      if (patternKey && patternData) {
        const existing = patterns.get(patternKey);
        if (existing) {
          existing.frequency += 1;
          if (existing.examples.length < 3) {
            existing.examples.push(example);
          }
        } else {
          patterns.set(patternKey, { ...patternData, frequency: 1, examples: [example] });
        }
      }
    }

    return Array.from(patterns.values()).sort((a, b) => b.frequency - a.frequency);
  }
}
