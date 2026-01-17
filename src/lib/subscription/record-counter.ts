/**
 * Record Counter Service
 * Tracks total record count across all workspaces for volume-based pricing
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import {
  getTierForRecordCount,
  VOLUME_TIERS,
  type SubscriptionTier,
} from '@/types/subscription';
import { logger } from '@/lib/logger/logger';

export class RecordCounter {
  /**
   * Get total record count for an organization across all workspaces
   * Records = Contacts + Leads + Companies + Deals + Products
   */
  static async getRecordCount(organizationId: string): Promise<number> {
    try {
      let totalCount = 0;

      // Get all workspaces for this organization
      const workspaces = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces`,
        []
      );

      // For each workspace, count all record types
      for (const workspace of workspaces) {
        const workspaceId = (workspace as { id: string }).id;

        // Count contacts
        const contacts = await FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/contacts`,
          []
        );
        totalCount += contacts.length;

        // Count leads
        const leads = await FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/leads`,
          []
        );
        totalCount += leads.length;

        // Count companies
        const companies = await FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/companies`,
          []
        );
        totalCount += companies.length;

        // Count deals
        const deals = await FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/deals`,
          []
        );
        totalCount += deals.length;

        // Count products
        const products = await FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/products`,
          []
        );
        totalCount += products.length;
      }

      // Update the cached count in organization subscription
      await this.updateCachedCount(organizationId, totalCount);

      logger.info(`[RecordCounter] Counted ${totalCount} records for org ${organizationId}`);
      return totalCount;
    } catch (error) {
      logger.error('[RecordCounter] Error counting records:', error);
      return 0;
    }
  }

  /**
   * Get cached record count (faster, but may be slightly out of date)
   */
  static async getCachedRecordCount(organizationId: string): Promise<number> {
    try {
      const subscription = await FirestoreService.get<{ recordCount?: number }>(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/subscriptions`,
        'current'
      );

      return subscription?.recordCount ?? 0;
    } catch (error) {
      logger.error('[RecordCounter] Error getting cached count:', error);
      return 0;
    }
  }

  /**
   * Update cached record count in subscription document
   */
  static async updateCachedCount(
    organizationId: string,
    count: number
  ): Promise<void> {
    try {
      await FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/subscriptions`,
        'current',
        {
          recordCount: count,
          recordCountLastUpdated: new Date().toISOString(),
        }
      );
    } catch (error) {
      logger.error('[RecordCounter] Error updating cached count:', error);
    }
  }

  /**
   * Determine appropriate tier based on record count
   */
  static getTierForRecordCount(recordCount: number): SubscriptionTier {
    return getTierForRecordCount(recordCount);
  }

  /**
   * Check if adding records would exceed current tier capacity
   */
  static async canAddRecords(
    organizationId: string,
    additionalRecords: number
  ): Promise<{
    allowed: boolean;
    currentCount: number;
    newTotal: number;
    currentTier: SubscriptionTier;
    currentCapacity: number;
    requiredTier?: SubscriptionTier;
    requiredPrice?: number;
    message: string;
  }> {
    try {
      // Get current count
      const currentCount = await this.getCachedRecordCount(organizationId);
      const newTotal = currentCount + additionalRecords;

      // Get current tier
      const subscription = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/subscriptions`,
        'current'
      );
      const currentTier = (subscription?.tier as SubscriptionTier) || 'tier1';
      const currentCapacity = VOLUME_TIERS[currentTier].recordMax;

      // Check if within capacity
      const withinCapacity = newTotal <= currentCapacity;

      if (withinCapacity) {
        return {
          allowed: true,
          currentCount,
          newTotal,
          currentTier,
          currentCapacity,
          message: `✅ Within capacity. Using ${newTotal} of ${currentCapacity} records.`,
        };
      }

      // Calculate required tier
      const requiredTier = getTierForRecordCount(newTotal);
      const requiredPrice = VOLUME_TIERS[requiredTier].price;

      return {
        allowed: false,
        currentCount,
        newTotal,
        currentTier,
        currentCapacity,
        requiredTier,
        requiredPrice,
        message: `⚠️ Would exceed capacity (${newTotal} > ${currentCapacity}). Upgrade to ${VOLUME_TIERS[requiredTier].name} ($${requiredPrice}/mo) required.`,
      };
    } catch (error) {
      logger.error('[RecordCounter] Error checking capacity:', error);
      return {
        allowed: false,
        currentCount: 0,
        newTotal: additionalRecords,
        currentTier: 'tier1',
        currentCapacity: 100,
        message: '❌ Error checking capacity',
      };
    }
  }

  /**
   * Increment record count (call after successful record creation)
   */
  static async incrementCount(
    organizationId: string,
    amount: number = 1
  ): Promise<void> {
    try {
      const currentCount = await this.getCachedRecordCount(organizationId);
      await this.updateCachedCount(organizationId, currentCount + amount);

      // Check if tier upgrade needed
      await this.checkAndNotifyTierChange(organizationId, currentCount + amount);
    } catch (error) {
      logger.error('[RecordCounter] Error incrementing count:', error);
    }
  }

  /**
   * Decrement record count (call after successful record deletion)
   */
  static async decrementCount(
    organizationId: string,
    amount: number = 1
  ): Promise<void> {
    try {
      const currentCount = await this.getCachedRecordCount(organizationId);
      const newCount = Math.max(0, currentCount - amount);
      await this.updateCachedCount(organizationId, newCount);

      // Check if tier downgrade possible
      await this.checkAndNotifyTierChange(organizationId, newCount);
    } catch (error) {
      logger.error('[RecordCounter] Error decrementing count:', error);
    }
  }

  /**
   * Check if record count requires tier change and notify if needed
   */
  static async checkAndNotifyTierChange(
    organizationId: string,
    recordCount: number
  ): Promise<void> {
    try {
      const subscription = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/subscriptions`,
        'current'
      );
      
      const currentTier = (subscription?.tier as SubscriptionTier) || 'tier1';
      const requiredTier = getTierForRecordCount(recordCount);

      if (currentTier !== requiredTier) {
        // Log tier change need
        logger.warn(`[RecordCounter] Tier change needed for org ${organizationId}`, {
          currentTier,
          requiredTier,
          recordCount,
        });

        // TODO: Send email notification to customer
        // TODO: Trigger Stripe subscription update
        // For now, just log it
      }
    } catch (error) {
      logger.error('[RecordCounter] Error checking tier change:', error);
    }
  }

  /**
   * Recalculate and update record count (use for batch operations or migrations)
   */
  static async recalculateCount(organizationId: string): Promise<number> {
    const count = await this.getRecordCount(organizationId);
    logger.info(`[RecordCounter] Recalculated count for org ${organizationId}: ${count}`);
    return count;
  }
}

