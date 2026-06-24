/**
 * One-time cleanup: delete media assets ORPHANED by already-deleted video projects.
 *
 * An asset is an orphan when it carries a `projectId` that no longer exists in EITHER
 * project collection (System A `video_pipeline_projects` or System B `videoProjects`) —
 * i.e. its project was deleted/scrapped but (before the cascade fix) its media stayed.
 *
 * PROTECTED: any image whose URL belongs to a SAVED Character-Library character is NEVER
 * deleted, even if it's tagged to a dead project.
 *
 * Dry run (lists only):  npx tsx scripts/cleanup-orphaned-project-media.ts
 * Delete:                npx tsx scripts/cleanup-orphaned-project-media.ts --delete
 */

/* eslint-disable no-console */

import { adminDb } from '../src/lib/firebase/admin';
import { getSubCollection } from '../src/lib/firebase/collections';

const MEDIA = getSubCollection('media');
const PIPELINE = getSubCollection('video_pipeline_projects');
const VIDEO_PROJECTS = getSubCollection('videoProjects');
const AVATAR_PROFILES = getSubCollection('avatar_profiles');

interface MediaAsset {
  id: string;
  url: string;
  projectId?: string;
  category?: string;
  type?: string;
}

async function existingProjectIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const path of [PIPELINE, VIDEO_PROJECTS]) {
    const snap = await adminDb.collection(path).get();
    snap.forEach((d) => ids.add(d.id));
  }
  return ids;
}

async function protectedCharacterUrls(): Promise<Set<string>> {
  const urls = new Set<string>();
  const snap = await adminDb.collection(AVATAR_PROFILES).get();
  snap.forEach((d) => {
    const p = d.data() as {
      frontalImageUrl?: string;
      additionalImageUrls?: string[];
      fullBodyImageUrl?: string | null;
      upperBodyImageUrl?: string | null;
      looks?: Array<{ imageUrls?: string[] }>;
    };
    const candidates = [
      p.frontalImageUrl,
      ...(p.additionalImageUrls ?? []),
      p.fullBodyImageUrl ?? '',
      p.upperBodyImageUrl ?? '',
      ...(p.looks ?? []).flatMap((l) => l.imageUrls ?? []),
    ];
    for (const u of candidates) {
      if (typeof u === 'string' && u.length > 0) {
        urls.add(u);
      }
    }
  });
  return urls;
}

async function main(): Promise<void> {
  const doDelete = process.argv.includes('--delete');

  const [liveProjects, protectedUrls] = await Promise.all([
    existingProjectIds(),
    protectedCharacterUrls(),
  ]);
  console.log(`Live projects: ${liveProjects.size}. Protected saved-character images: ${protectedUrls.size}.\n`);

  const snap = await adminDb.collection(MEDIA).get();
  const orphans: MediaAsset[] = [];
  let protectedSkipped = 0;
  const byMissingProject = new Map<string, number>();

  snap.forEach((doc) => {
    const d = doc.data() as MediaAsset;
    const projectId = d.projectId;
    if (!projectId) {
      return; // not tied to a project
    }
    if (liveProjects.has(projectId)) {
      return; // its project still exists — not an orphan
    }
    if (d.url && protectedUrls.has(d.url)) {
      protectedSkipped += 1;
      return; // belongs to a saved character — protected
    }
    orphans.push({ ...d, id: doc.id });
    byMissingProject.set(projectId, (byMissingProject.get(projectId) ?? 0) + 1);
  });

  console.log(`Scanned ${snap.size} media assets.`);
  console.log(`Orphaned (project deleted, not a saved character): ${orphans.length}`);
  console.log(`Protected saved-character images skipped: ${protectedSkipped}\n`);

  console.log('Orphans grouped by their dead project:');
  for (const [pid, count] of [...byMissingProject.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(4)}  from deleted project ${pid}`);
  }

  if (!doDelete) {
    console.log('\nDry run — pass --delete to remove these orphaned assets.');
    return;
  }

  console.log(`\nDeleting ${orphans.length} orphaned asset(s)…`);
  let removed = 0;
  for (const a of orphans) {
    await adminDb.collection(MEDIA).doc(a.id).delete();
    removed += 1;
  }
  console.log(`Done — removed ${removed} orphaned asset(s). Saved characters untouched.`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
