/**
 * Scheduled Publisher
 * Processes scheduled pages and blog posts to publish them at the right time
 * Single-tenant: processes only the platform organization
 *
 * REFACTORED: Now uses adminDal for environment-aware collection access
 */

import { admin } from '@/lib/firebase-admin';
import { adminDal } from '@/lib/firebase/admin-dal';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

interface ScheduledItem {
  id: string;
  scheduledFor: string;
  title: string;
  type: 'page' | 'blog-post';
}

/**
 * Check and publish scheduled pages for the platform organization
 */
export async function processScheduledPages(): Promise<{
  processed: number;
  errors: number;
}> {
  let processed = 0;
  let errors = 0;

  try {
    const now = new Date();
    const items: ScheduledItem[] = [];

    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    try {
      // Get scheduled pages (DAL-refactored instances #2-3)
      const pagesSnapshot = await adminDal
        .getCollection('ORGANIZATIONS')
        .doc(PLATFORM_ID)
        .collection(adminDal.getSubColPath('website'))
        .doc('pages')
        .collection(adminDal.getSubColPath('items'))
        .where('status', '==', 'scheduled')
        .get();

      pagesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.scheduledFor) {
          const scheduledDate = new Date(data.scheduledFor as string | number | Date);
          if (scheduledDate <= now) {
            items.push({
              id: doc.id,
              scheduledFor: data.scheduledFor as string,
              title: data.title !== '' && data.title != null ? (data.title as string) : 'Untitled',
              type: 'page',
            });
          }
        }
      });

      // Get scheduled blog posts (DAL-refactored instances #4-5)
      const postsSnapshot = await adminDal
        .getCollection('ORGANIZATIONS')
        .doc(PLATFORM_ID)
        .collection(adminDal.getSubColPath('website'))
        .doc('config')
        .collection(adminDal.getSubColPath('blog-posts'))
        .where('status', '==', 'scheduled')
        .get();

      postsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.scheduledFor) {
          const scheduledDate = new Date(data.scheduledFor as string | number | Date);
          if (scheduledDate <= now) {
            items.push({
              id: doc.id,
              scheduledFor: data.scheduledFor as string,
              title: data.title !== '' && data.title != null ? (data.title as string) : 'Untitled',
              type: 'blog-post',
            });
          }
        }
      });
    } catch (orgError) {
      logger.error('[Scheduled Publisher] Error processing platform org', orgError instanceof Error ? orgError : new Error(String(orgError)), { file: 'scheduled-publisher.ts' });
      errors++;
    }

    // Publish each item
    for (const item of items) {
      try {
        await publishScheduledItem(item);
        processed++;
      } catch (publishError) {
        logger.error(`[Scheduled Publisher] Error publishing ${item.type} ${item.id}`, publishError instanceof Error ? publishError : new Error(String(publishError)), { file: 'scheduled-publisher.ts' });
        errors++;
      }
    }

  } catch (error) {
    logger.error('[Scheduled Publisher] Fatal error', error instanceof Error ? error : new Error(String(error)), { file: 'scheduled-publisher.ts' });
    errors++;
  }

  return { processed, errors };
}

/**
 * Publish a scheduled item
 */
async function publishScheduledItem(item: ScheduledItem): Promise<void> {
  const now = admin.firestore.Timestamp.now();

  if (item.type === 'page') {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }
    const pageRef = adminDal
      .getCollection('ORGANIZATIONS')
      .doc(PLATFORM_ID)
      .collection(adminDal.getSubColPath('website'))
      .doc('pages')
      .collection(adminDal.getSubColPath('items'))
      .doc(item.id);

    const pageDoc = await pageRef.get();
    if (!pageDoc.exists) {
      throw new Error('Page not found');
    }

    const pageData = pageDoc.data();

    // Create version snapshot
    const currentVersion = (pageData?.version as number | undefined) ?? 1;
    const versionRef = pageRef.collection('versions').doc(`v${currentVersion}`);

    await versionRef.set({
      version: currentVersion,
      content: pageData?.content as unknown,
      seo: pageData?.seo as unknown,
      title: pageData?.title as string | undefined,
      slug: pageData?.slug as string | undefined,
      status: 'scheduled',
      createdAt: now,
      createdBy: 'scheduled-publisher',
    });

    // Publish the page
    await pageRef.update({
      status: 'published',
      publishedAt: now.toDate().toISOString(),
      scheduledFor: admin.firestore.FieldValue.delete(),
      lastPublishedVersion: currentVersion,
      updatedAt: now,
      lastEditedBy: 'scheduled-publisher',
    });

    // Create audit log
    const auditRef = adminDal
      .getCollection('ORGANIZATIONS')
      .doc(PLATFORM_ID)
      .collection(adminDal.getSubColPath('website'))
      .doc('audit-log')
      .collection(adminDal.getSubColPath('entries'));

    await auditRef.add({
      type: 'page_auto_published',
      pageId: item.id,
      pageTitle: item.title,
      scheduledFor: item.scheduledFor,
      performedBy: 'scheduled-publisher',
      performedAt: now,
    });
  } else if (item.type === 'blog-post') {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }
    const postRef = adminDal
      .getCollection('ORGANIZATIONS')
      .doc(PLATFORM_ID)
      .collection(adminDal.getSubColPath('website'))
      .doc('config')
      .collection(adminDal.getSubColPath('blog-posts'))
      .doc(item.id);

    // Publish the post
    await postRef.update({
      status: 'published',
      publishedAt: now.toDate().toISOString(),
      scheduledFor: null,
      updatedAt: now.toDate().toISOString(),
      lastEditedBy: 'scheduled-publisher',
    });

    // Create audit log
    const auditRef = adminDal
      .getCollection('ORGANIZATIONS')
      .doc(PLATFORM_ID)
      .collection(adminDal.getSubColPath('website'))
      .doc('audit-log')
      .collection(adminDal.getSubColPath('entries'));

    await auditRef.add({
      type: 'blog_post_auto_published',
      postId: item.id,
      postTitle: item.title,
      scheduledFor: item.scheduledFor,
      performedBy: 'scheduled-publisher',
      performedAt: now.toDate().toISOString(),
    });
  }
}

/**
 * Run the scheduled publisher (call this from a cron job or API endpoint)
 */
export async function runScheduledPublisher() {
  const result = await processScheduledPages();
  return result;
}
