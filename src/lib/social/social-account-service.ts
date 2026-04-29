/**
 * Social Account Service
 * CRUD operations for managing multiple social media accounts per platform.
 *
 * Storage: organizations/{PLATFORM_ID}/social_accounts/{accountId}
 *
 * IMPORTANT: This service is invoked from server routes (API handlers,
 * cron jobs, integration services). It uses the Firebase Admin SDK so it
 * is NOT subject to Firestore security rules — server code has no client
 * auth context, so client SDK reads return [] silently and writes get
 * blocked. See CLAUDE.md → "Server-Side Firestore — Use Admin SDK".
 */

import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import type { SocialAccount, SocialPlatform } from '@/types/social';

const SOCIAL_ACCOUNTS_COLLECTION = 'social_accounts';

function accountsPath(): string {
  return getSubCollection(SOCIAL_ACCOUNTS_COLLECTION);
}

function getDb() {
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized — SocialAccountService requires server-side execution');
  }
  return adminDb;
}

export class SocialAccountService {
  /**
   * List all social accounts, optionally filtered by platform.
   * Sorted by `addedAt` desc.
   *
   * NOTE: when a platform filter is supplied we sort in JS rather than
   * via Firestore orderBy, because `where('platform') + orderBy('addedAt')`
   * needs a composite index that is not deployed. Per-platform results
   * are small (1-2 rows), so client-side sort is the simpler fix.
   */
  static async listAccounts(platform?: SocialPlatform): Promise<SocialAccount[]> {
    try {
      const collectionRef = getDb().collection(accountsPath());
      let docs;
      if (platform) {
        const snap = await collectionRef.where('platform', '==', platform).get();
        docs = snap.docs;
      } else {
        const snap = await collectionRef.orderBy('addedAt', 'desc').get();
        docs = snap.docs;
      }
      const rows = docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SocialAccount, 'id'>) }));
      if (platform) {
        rows.sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''));
      }
      return rows;
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
      const snap = await getDb().collection(accountsPath()).doc(accountId).get();
      if (!snap.exists) { return null; }
      return { id: snap.id, ...(snap.data() as Omit<SocialAccount, 'id'>) };
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
      const snap = await getDb()
        .collection(accountsPath())
        .where('platform', '==', platform)
        .where('isDefault', '==', true)
        .limit(1)
        .get();
      if (snap.empty) { return null; }
      const d = snap.docs[0];
      return { id: d.id, ...(d.data() as Omit<SocialAccount, 'id'>) };
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

    await getDb().collection(accountsPath()).doc(accountId).set(account);

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

    await getDb().collection(accountsPath()).doc(accountId).update(updates);

    logger.info('SocialAccountService: Account updated', { accountId });

    return { ...existing, ...updates };
  }

  /**
   * Remove a social account
   */
  static async removeAccount(accountId: string): Promise<boolean> {
    try {
      await getDb().collection(accountsPath()).doc(accountId).delete();
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
      const snap = await getDb()
        .collection(accountsPath())
        .where('platform', '==', platform)
        .where('isDefault', '==', true)
        .get();
      const batch = getDb().batch();
      for (const d of snap.docs) {
        batch.update(d.ref, { isDefault: false });
      }
      if (!snap.empty) {
        await batch.commit();
      }
    } catch (error) {
      logger.warn('SocialAccountService: Failed to clear defaults', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
