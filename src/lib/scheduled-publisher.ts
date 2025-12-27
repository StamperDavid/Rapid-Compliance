/**
 * Scheduled Publisher
 * Processes scheduled pages and blog posts to publish them at the right time
 * CRITICAL: Multi-tenant - processes all orgs safely
 */

import { db, admin } from '@/lib/firebase-admin';

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
    console.log('[Scheduled Publisher] Starting scheduled pages check...');

    const now = new Date();
    const items: ScheduledItem[] = [];

    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();

    // For each organization, check for scheduled pages
    for (const orgDoc of orgsSnapshot.docs) {
      const organizationId = orgDoc.id;

      try {
        // Get scheduled pages
        const pagesSnapshot = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('website')
          .doc('pages')
          .collection('items')
          .where('status', '==', 'scheduled')
          .get();

        pagesSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.scheduledFor) {
            const scheduledDate = new Date(data.scheduledFor);
            if (scheduledDate <= now) {
              items.push({
                id: doc.id,
                organizationId,
                scheduledFor: data.scheduledFor,
                title: data.title || 'Untitled',
                type: 'page',
              });
            }
          }
        });

        // Get scheduled blog posts
        const postsSnapshot = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('website')
          .doc('config')
          .collection('blog-posts')
          .where('status', '==', 'scheduled')
          .get();

        postsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.scheduledFor) {
            const scheduledDate = new Date(data.scheduledFor);
            if (scheduledDate <= now) {
              items.push({
                id: doc.id,
                organizationId,
                scheduledFor: data.scheduledFor,
                title: data.title || 'Untitled',
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

    console.log(`[Scheduled Publisher] Found ${items.length} items ready to publish`);

    // Publish each item
    for (const item of items) {
      try {
        await publishScheduledItem(item);
        processed++;
        console.log(`[Scheduled Publisher] Published ${item.type} "${item.title}" for org ${item.organizationId}`);
      } catch (publishError) {
        console.error(`[Scheduled Publisher] Error publishing ${item.type} ${item.id}:`, publishError);
        errors++;
      }
    }

    console.log(`[Scheduled Publisher] Complete. Processed: ${processed}, Errors: ${errors}`);
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
    const pageRef = db
      .collection('organizations')
      .doc(item.organizationId)
      .collection('website')
      .doc('pages')
      .collection('items')
      .doc(item.id);

    const pageDoc = await pageRef.get();
    if (!pageDoc.exists) {
      throw new Error('Page not found');
    }

    const pageData = pageDoc.data();

    // Create version snapshot
    const currentVersion = pageData?.version || 1;
    const versionRef = pageRef.collection('versions').doc(`v${currentVersion}`);

    await versionRef.set({
      version: currentVersion,
      content: pageData?.content,
      seo: pageData?.seo,
      title: pageData?.title,
      slug: pageData?.slug,
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
    const auditRef = db
      .collection('organizations')
      .doc(item.organizationId)
      .collection('website')
      .doc('audit-log')
      .collection('entries');

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
    const postRef = db
      .collection('organizations')
      .doc(item.organizationId)
      .collection('website')
      .doc('config')
      .collection('blog-posts')
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
    const auditRef = db
      .collection('organizations')
      .doc(item.organizationId)
      .collection('website')
      .doc('audit-log')
      .collection('entries');

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

