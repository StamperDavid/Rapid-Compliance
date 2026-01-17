/**
 * Scheduled Publisher
 * Processes scheduled pages and blog posts to publish them at the right time
 * CRITICAL: Multi-tenant - processes all orgs safely
 * 
 * REFACTORED: Now uses adminDal for environment-aware collection access
 */

import { admin } from '@/lib/firebase-admin';
import { adminDal } from '@/lib/firebase/admin-dal';

interface ScheduledItem {
  id: string;
  organizationId: string;
  scheduledFor: string;
  title: string;
  type: 'page' | 'blog-post';
}

/**
 * Check and publish scheduled pages across all organizations
 */
export async function processScheduledPages(): Promise<{
  processed: number;
  errors: number;
}> {
  let processed = 0;
  let errors = 0;

  try {
    // Starting scheduled pages check
    const now = new Date();
    const items: ScheduledItem[] = [];

    // Get all organizations (DAL-refactored instance #1)
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }
    const orgsSnapshot = await adminDal.getCollection('ORGANIZATIONS').get();

    // For each organization, check for scheduled pages
    for (const orgDoc of orgsSnapshot.docs) {
      const organizationId = orgDoc.id;

      try {
        // Get scheduled pages (DAL-refactored instances #2-3)
        const pagesSnapshot = await adminDal
          .getCollection('ORGANIZATIONS')
          .doc(organizationId)
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
                organizationId,
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
          .doc(organizationId)
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
                organizationId,
                scheduledFor: data.scheduledFor as string,
                title: data.title !== '' && data.title != null ? (data.title as string) : 'Untitled',
                type: 'blog-post',
              });
            }
          }
        });
      } catch (orgError) {
        console.error(`[Scheduled Publisher] Error processing org ${organizationId}:`, orgError);
        errors++;
      }
    }

    // Found items ready to publish

    // Publish each item
    for (const item of items) {
      try {
        await publishScheduledItem(item);
        processed++;
        // Published item
      } catch (publishError) {
        console.error(`[Scheduled Publisher] Error publishing ${item.type} ${item.id}:`, publishError);
        errors++;
      }
    }

    // Processing complete
  } catch (error) {
    console.error('[Scheduled Publisher] Fatal error:', error);
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
    // DAL-refactored instances #6-7
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }
    const pageRef = adminDal
      .getCollection('ORGANIZATIONS')
      .doc(item.organizationId)
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

    // Create audit log (DAL-refactored - page audit)
    const auditRef = adminDal
      .getCollection('ORGANIZATIONS')
      .doc(item.organizationId)
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
      organizationId: item.organizationId,
    });
  } else if (item.type === 'blog-post') {
    // DAL-refactored instance #10
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }
    const postRef = adminDal
      .getCollection('ORGANIZATIONS')
      .doc(item.organizationId)
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

    // Create audit log (DAL-refactored - blog post audit)
    const auditRef = adminDal
      .getCollection('ORGANIZATIONS')
      .doc(item.organizationId)
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
      organizationId: item.organizationId,
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

