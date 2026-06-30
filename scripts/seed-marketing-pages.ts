/**
 * Import the existing marketing pages (captured from the hardcoded site) into the
 * visual editor's store (`website/pages/items`) as EDITABLE DRAFT pages, so they
 * show up in the editor's page list and can be edited.
 *
 * SAFETY: every page is forced to status:'draft'. The live site only ever shows
 * PUBLISHED pages (and the public read endpoint is published-only), so importing
 * these drafts CANNOT change the live marketing site. The operator edits the
 * drafts and publishes when ready.
 *
 * Idempotent: upserts by id (slug), so re-running updates in place.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/seed-marketing-pages.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main(): Promise<void> {
  const { adminDal } = await import('@/lib/firebase/admin-dal');
  const { getSubCollection } = await import('@/lib/firebase/collections');
  const { FieldValue } = await import('firebase-admin/firestore');
  const { pages: corePages } = await import('./marketing-import/pages-core');
  const { pages: infoPages } = await import('./marketing-import/pages-info');
  const { pages: legalPages } = await import('./marketing-import/pages-legal');

  if (!adminDal) {
    console.error('❌ No admin DB available.');
    process.exit(1);
  }

  const pagesRef = adminDal.getNestedCollection(`${getSubCollection('website')}/pages/items`);
  const all = [...corePages, ...infoPages, ...legalPages];

  console.log(`Importing ${all.length} marketing pages as DRAFTS into the editor store…\n`);
  for (const page of all) {
    const id = page.id && page.id.length > 0 ? page.id : page.slug;
    const sectionCount = Array.isArray(page.content) ? page.content.length : 0;
    await pagesRef.doc(id).set(
      {
        id,
        title: page.title,
        slug: page.slug,
        status: 'draft', // forced draft — importing can never change the live site
        content: page.content,
        seo: page.seo ?? {},
        version: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'marketing-import',
        lastEditedBy: 'marketing-import',
      },
      { merge: false },
    );
    console.log(`  ✓ ${page.slug.padEnd(12)} "${page.title}"  (${sectionCount} sections) — draft`);
  }

  console.log(`\n✅ Done — ${all.length} pages now appear in the editor's Pages list (all drafts).`);
  console.log('   Your live site is unchanged: the public site only renders PUBLISHED pages.');
  process.exit(0);
}

main().catch((e) => { console.error('SEED ERROR:', e instanceof Error ? e.message : String(e)); process.exit(1); });
