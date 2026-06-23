/**
 * ONE-OFF MIGRATION: legacy System A pipeline projects (`video_pipeline_projects`) →
 * System B VideoProjects (`videoProjects`), part of the video-path consolidation
 * (Phase 2). Each legacy project's single `shotPlan` becomes a one-doc VideoProject via
 * the real `createVideoProject` (so it is Zod-validated + status-derived like any other).
 * The legacy doc is NOT deleted — it is tagged `migratedToVideoProjectId` so it is
 * idempotent and nothing is lost if the new write needs review.
 *
 * Run: npx tsx scripts/migrate-pipeline-to-videoproject.ts
 */

/* eslint-disable no-console */

import { config } from 'dotenv';
import type { ShotPlan } from '../src/types/shot-plan';

config({ path: '.env.local' });

async function main(): Promise<void> {
  // Import AFTER env is loaded so the Admin SDK initializes with credentials.
  const { adminDb } = await import('../src/lib/firebase/admin');
  const { getSubCollection } = await import('../src/lib/firebase/collections');
  const { createVideoProject } = await import('../src/lib/video/video-project-service');

  if (!adminDb) {
    throw new Error('Firebase Admin not initialized — check .env.local.');
  }

  const col = getSubCollection('video_pipeline_projects');
  const snap = await adminDb.collection(col).get();
  console.log(`=== Pipeline → VideoProject migration ===`);
  console.log(`Found ${snap.size} legacy pipeline project(s).\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const p = doc.data() as Record<string, unknown>;

    if (p.migratedToVideoProjectId) {
      console.log(`  skip (already migrated): ${doc.id} → ${String(p.migratedToVideoProjectId)}`);
      skipped += 1;
      continue;
    }

    // The legacy doc stored a full ShotPlan; createVideoProject Zod-validates it on
    // write, so a bad shape is caught at runtime (the try/catch leaves it in System A).
    const shotPlan = p.shotPlan as ShotPlan | undefined;
    if (!shotPlan) {
      console.log(`  skip (no shotPlan to carry over): ${doc.id}`);
      skipped += 1;
      continue;
    }

    const briefRaw = p.brief;
    const brief =
      typeof briefRaw === 'string'
        ? briefRaw
        : briefRaw && typeof briefRaw === 'object' && 'description' in briefRaw
          ? String((briefRaw as { description?: unknown }).description ?? '')
          : '';

    const title =
      (typeof p.name === 'string' && p.name.trim()) ||
      (typeof p.title === 'string' && p.title.trim()) ||
      shotPlan.title ||
      'Migrated video';

    try {
      // createVideoProject Zod-validates the embedded ShotPlan — if the legacy doc is
      // malformed this throws and the project is LEFT in System A (not lost).
      const created = await createVideoProject({
        title,
        brief: brief || (shotPlan.title ?? ''),
        docs: [shotPlan],
      });
      await adminDb
        .collection(col)
        .doc(doc.id)
        .update({ migratedToVideoProjectId: created.id, migratedAt: new Date().toISOString() });
      console.log(
        `  migrated ${doc.id} → ${created.id}  ("${title}", ${(shotPlan.shots ?? []).length} shots)`,
      );
      migrated += 1;
    } catch (err) {
      console.error(`  FAILED ${doc.id}: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`    (left in System A — not lost; review the shotPlan shape.)`);
      failed += 1;
    }
  }

  console.log(`\nDone. migrated=${migrated} skipped=${skipped} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('MIGRATION FAILED:', e);
  process.exit(1);
});
