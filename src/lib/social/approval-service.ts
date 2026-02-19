/**
 * Approval Service
 * Manages the approval workflow for flagged social media content.
 * Posts flagged by the autonomous agent or manually are stored as ApprovalItems
 * and surfaced in the Approval Queue UI.
 *
 * Firestore path: organizations/{orgId}/social_approvals/{approvalId}
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import type {
  ApprovalItem,
  ApprovalComment,
  ApprovalStatus,
  SocialPlatform,
  SocialMediaAsset,
} from '@/types/social';

const APPROVALS_COLLECTION = 'social_approvals';

function approvalsPath(): string {
  return getSubCollection(APPROVALS_COLLECTION);
}

export class ApprovalService {
  /**
   * Create a new approval item (called when content is flagged)
   */
  static async createApproval(data: {
    postId: string;
    content: string;
    platform: SocialPlatform;
    accountId?: string;
    mediaAssets?: SocialMediaAsset[];
    flagReason: string;
    flaggedBy: 'autonomous-agent' | 'manual';
    scheduledFor?: string;
  }): Promise<ApprovalItem> {
    const approvalId = `approval-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const item: ApprovalItem = {
      id: approvalId,
      postId: data.postId,
      content: data.content,
      platform: data.platform,
      accountId: data.accountId,
      mediaAssets: data.mediaAssets,
      status: 'pending_review',
      flagReason: data.flagReason,
      flaggedAt: new Date().toISOString(),
      flaggedBy: data.flaggedBy,
      comments: [],
      scheduledFor: data.scheduledFor,
    };

    await FirestoreService.set(approvalsPath(), approvalId, item, false);

    logger.info('ApprovalService: Approval created', {
      approvalId,
      postId: data.postId,
      flagReason: data.flagReason,
    });

    return item;
  }

  /**
   * List approval items with optional filters
   */
  static async listApprovals(filters?: {
    status?: ApprovalStatus;
    platform?: SocialPlatform;
  }): Promise<ApprovalItem[]> {
    try {
      const { where, orderBy } = await import('firebase/firestore');
      const constraints = [];

      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      if (filters?.platform) {
        constraints.push(where('platform', '==', filters.platform));
      }

      constraints.push(orderBy('flaggedAt', 'desc'));

      return await FirestoreService.getAll<ApprovalItem>(approvalsPath(), constraints);
    } catch (error) {
      logger.error('ApprovalService: Failed to list approvals', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get a single approval item
   */
  static async getApproval(approvalId: string): Promise<ApprovalItem | null> {
    return FirestoreService.get<ApprovalItem>(approvalsPath(), approvalId);
  }

  /**
   * Update approval status (approve, reject, request revision)
   */
  static async updateStatus(
    approvalId: string,
    status: ApprovalStatus,
    reviewedBy: string,
    comment?: string
  ): Promise<ApprovalItem | null> {
    const existing = await this.getApproval(approvalId);
    if (!existing) {return null;}

    const updates: Partial<ApprovalItem> = {
      status,
      reviewedBy,
      reviewedAt: new Date().toISOString(),
    };

    // Add comment if provided
    if (comment) {
      const newComment: ApprovalComment = {
        id: `comment-${Date.now()}`,
        authorId: reviewedBy,
        authorName: reviewedBy, // In production, resolve display name
        text: comment,
        createdAt: new Date().toISOString(),
      };
      updates.comments = [...existing.comments, newComment];
    }

    await FirestoreService.update(approvalsPath(), approvalId, updates);

    logger.info('ApprovalService: Status updated', { approvalId, status, reviewedBy });

    return { ...existing, ...updates };
  }

  /**
   * Add a comment to an approval item
   */
  static async addComment(
    approvalId: string,
    authorId: string,
    authorName: string,
    text: string
  ): Promise<ApprovalItem | null> {
    const existing = await this.getApproval(approvalId);
    if (!existing) {return null;}

    const newComment: ApprovalComment = {
      id: `comment-${Date.now()}`,
      authorId,
      authorName,
      text,
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...existing.comments, newComment];
    await FirestoreService.update(approvalsPath(), approvalId, {
      comments: updatedComments,
    });

    return { ...existing, comments: updatedComments };
  }

  /**
   * Get counts by status for the stats bar
   */
  static async getCounts(): Promise<Record<ApprovalStatus | 'total', number>> {
    try {
      const all = await FirestoreService.getAll<ApprovalItem>(approvalsPath());

      const counts: Record<string, number> = {
        total: all.length,
        pending_review: 0,
        approved: 0,
        rejected: 0,
        revision_requested: 0,
      };

      for (const item of all) {
        counts[item.status] = (counts[item.status] ?? 0) + 1;
      }

      return counts as Record<ApprovalStatus | 'total', number>;
    } catch (error) {
      logger.error('ApprovalService: Failed to get counts', error instanceof Error ? error : new Error(String(error)));
      return { total: 0, pending_review: 0, approved: 0, rejected: 0, revision_requested: 0 };
    }
  }
}
