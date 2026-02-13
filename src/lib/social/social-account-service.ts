/**
 * Social Account Service
 * CRUD operations for managing multiple social media accounts per platform.
 * Credentials stored in Firestore under organizations/{orgId}/social_accounts/{accountId}
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { SocialAccount, SocialPlatform } from '@/types/social';

const SOCIAL_ACCOUNTS_COLLECTION = 'social_accounts';

function accountsPath(): string {
  return `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${SOCIAL_ACCOUNTS_COLLECTION}`;
}

export class SocialAccountService {
  /**
   * List all social accounts, optionally filtered by platform
   */
  static async listAccounts(platform?: SocialPlatform): Promise<SocialAccount[]> {
    try {
      const { where, orderBy } = await import('firebase/firestore');
      const constraints = [];
      if (platform) {
        constraints.push(where('platform', '==', platform));
      }
      constraints.push(orderBy('addedAt', 'desc'));

      return await FirestoreService.getAll<SocialAccount>(accountsPath(), constraints);
    } catch (error) {
      logger.error('SocialAccountService: Failed to list accounts', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get a single social account by ID
   */
  static async getAccount(accountId: string): Promise<SocialAccount | null> {
    try {
      return await FirestoreService.get<SocialAccount>(accountsPath(), accountId);
    } catch (error) {
      logger.error('SocialAccountService: Failed to get account', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Get the default account for a platform
   */
  static async getDefaultAccount(platform: SocialPlatform): Promise<SocialAccount | null> {
    try {
      const { where, limit } = await import('firebase/firestore');
      const accounts = await FirestoreService.getAll<SocialAccount>(accountsPath(), [
        where('platform', '==', platform),
        where('isDefault', '==', true),
        limit(1),
      ]);
      return accounts[0] ?? null;
    } catch (error) {
      logger.error('SocialAccountService: Failed to get default account', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Add a new social account
   */
  static async addAccount(
    data: Omit<SocialAccount, 'id' | 'addedAt'>
  ): Promise<SocialAccount> {
    const accountId = `social-acct-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // If this is set as default, unset other defaults for same platform
    if (data.isDefault) {
      await this.clearDefaultForPlatform(data.platform);
    }

    const account: SocialAccount = {
      ...data,
      id: accountId,
      addedAt: new Date().toISOString(),
    };

    await FirestoreService.set(accountsPath(), accountId, account, false);

    logger.info('SocialAccountService: Account added', {
      accountId,
      platform: data.platform,
      handle: data.handle,
    });

    return account;
  }

  /**
   * Update an existing social account
   */
  static async updateAccount(
    accountId: string,
    updates: Partial<Omit<SocialAccount, 'id' | 'addedAt'>>
  ): Promise<SocialAccount | null> {
    const existing = await this.getAccount(accountId);
    if (!existing) {
      return null;
    }

    // If setting as default, unset other defaults for same platform
    if (updates.isDefault) {
      await this.clearDefaultForPlatform(existing.platform);
    }

    await FirestoreService.update(accountsPath(), accountId, updates);

    logger.info('SocialAccountService: Account updated', { accountId });

    return { ...existing, ...updates };
  }

  /**
   * Remove a social account
   */
  static async removeAccount(accountId: string): Promise<boolean> {
    try {
      await FirestoreService.delete(accountsPath(), accountId);
      logger.info('SocialAccountService: Account removed', { accountId });
      return true;
    } catch (error) {
      logger.error('SocialAccountService: Failed to remove account', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Clear the default flag for all accounts of a given platform
   */
  private static async clearDefaultForPlatform(platform: SocialPlatform): Promise<void> {
    try {
      const { where } = await import('firebase/firestore');
      const defaults = await FirestoreService.getAll<SocialAccount>(accountsPath(), [
        where('platform', '==', platform),
        where('isDefault', '==', true),
      ]);

      for (const acct of defaults) {
        await FirestoreService.update(accountsPath(), acct.id, { isDefault: false });
      }
    } catch (error) {
      logger.warn('SocialAccountService: Failed to clear defaults', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
