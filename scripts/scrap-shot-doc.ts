/**
 * Scrap a Shot Doc and delete EVERY media-library asset it generated (images +
 * videos), matched precisely by URL from the project's stored ShotPlan — so only
 * what THIS shot doc created is removed, nothing else.
 *
 * Usage:
 *   npx tsx scripts/scrap-shot-doc.ts                      list recent shot-doc projects
 *   npx tsx scripts/scrap-shot-doc.ts <projectId>          DRY RUN — show what would delete
 *   npx tsx scripts/scrap-shot-doc.ts <projectId> --delete delete media assets + storage + project
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) {
    return;
  }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m) {
        const [, k, raw] = m;
        const v = raw.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket: `${projectId}.firebasestorage.app`,
  });
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const PROJECTS = `organizations/${PLATFORM_ID}/video_pipeline_projects`;
const MEDIA = `organizations/${PLATFORM_ID}/media`;

/** Pull every media URL the ShotPlan generated, deduped. */
function collectPlanUrls(plan: Record<string, unknown> | undefined): Set<string> {
  const urls = new Set<string>();
  const add = (u: unknown): void => {
    if (typeof u === 'string' && u.trim().length > 0) {
      urls.add(u);
    }
  };
  if (!plan) {
    return urls;
  }
  const floorPlan = plan.floorPlan as { backdropImageUrl?: unknown } | undefined;
  add(floorPlan?.backdropImageUrl);

  const sc = plan.sharedChoices as Record<string, unknown> | undefined;
  if (sc) {
    add(sc.environmentHeroImageUrl);
    for (const u of (sc.environmentReferenceImageUrls as unknown[] | undefined) ?? []) {
      add(u);
    }
    for (const z of (sc.environmentZones as Array<{ heroImageUrl?: unknown }> | undefined) ?? []) {
      add(z.heroImageUrl);
    }
    for (const s of (sc.lightingSwatches as Array<{ imageUrl?: unknown }> | undefined) ?? []) {
      add(s.imageUrl);
    }
    for (const c of (sc.cast as Array<Record<string, unknown>> | undefined) ?? []) {
      for (const u of (c.referenceImageUrls as unknown[] | undefined) ?? []) {
        add(u);
      }
      for (const v of (c.modelSheet as Array<{ imageUrl?: unknown }> | undefined) ?? []) {
        add(v.imageUrl);
      }
    }
    for (const o of (sc.objects as Array<{ referenceImageUrls?: unknown[] }> | undefined) ?? []) {
      for (const u of o.referenceImageUrls ?? []) {
        add(u);
      }
    }
  }
  for (const shot of (plan.shots as Array<{ generated?: Record<string, unknown> }> | undefined) ?? []) {
    add(shot.generated?.keyframeUrl);
    add(shot.generated?.lastFrameUrl);
    add(shot.generated?.videoUrl);
  }
  return urls;
}

/** Storage object path from a Firebase download URL, or null. */
function storagePathFromUrl(url: string): string | null {
  const m = /\/o\/([^?]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : null;
}

async function listProjects(): Promise<void> {
  const db = admin.firestore();
  const snap = await db.collection(PROJECTS).orderBy('updatedAt', 'desc').limit(20).get();
  console.log(`\nRecent shot-doc projects (${snap.size}):\n`);
  for (const doc of snap.docs) {
    const d = doc.data();
    const plan = d.shotPlan as { shots?: unknown[] } | undefined;
    const shots = Array.isArray(plan?.shots) ? plan?.shots.length : 0;
    const urls = collectPlanUrls(d.shotPlan as Record<string, unknown> | undefined);
    console.log(`  ${doc.id}  "${String(d.name ?? '(untitled)').slice(0, 40)}"  shots=${shots}  mediaUrls=${urls.size}`);
  }
  console.log('\nRun `npx tsx scripts/scrap-shot-doc.ts <projectId>` to dry-run a scrap.\n');
}

async function scrap(projectId: string, doDelete: boolean): Promise<void> {
  const db = admin.firestore();
  const ref = db.collection(PROJECTS).doc(projectId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`Project ${projectId} not found.`);
    return;
  }
  const data = snap.data() ?? {};
  const planUrls = collectPlanUrls(data.shotPlan as Record<string, unknown> | undefined);
  console.log(`\nProject ${projectId} — "${String(data.name ?? '').slice(0, 50)}"`);
  console.log(`Plan generated ${planUrls.size} media URLs.\n`);

  // Match media-library assets by url membership (precise — only this doc's output).
  const mediaSnap = await db.collection(MEDIA).get();
  const matches = mediaSnap.docs.filter((m) => {
    const u = (m.data().url as string | undefined) ?? '';
    return u.length > 0 && planUrls.has(u);
  });

  const byType = new Map<string, number>();
  for (const m of matches) {
    const t = String(m.data().type ?? 'unknown');
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  console.log(`Media-library assets matched: ${matches.length}`);
  for (const [t, n] of byType) {
    console.log(`  ${t}: ${n}`);
  }

  if (!doDelete) {
    console.log(`\nDRY RUN. Re-run with --delete to remove these ${matches.length} assets + their`);
    console.log(`storage files + the project doc ${projectId}.\n`);
    return;
  }

  // 1. Delete matched media-library docs + their storage objects (best-effort).
  const bucket = admin.storage().bucket();
  let storageDeleted = 0;
  for (const m of matches) {
    const u = (m.data().url as string | undefined) ?? '';
    const p = u ? storagePathFromUrl(u) : null;
    if (p) {
      await bucket.file(p).delete().then(() => { storageDeleted += 1; }).catch(() => null);
    }
    await m.ref.delete();
  }
  console.log(`\nDeleted ${matches.length} media docs, ${storageDeleted} storage files.`);

  // 2. Delete the project doc itself (scrap the shot doc).
  await ref.delete();
  console.log(`Deleted project doc ${projectId}.\n`);
}

/**
 * Sweep ORPHANED shot-plan media (every asset the build creates is tagged
 * 'shot-plan'). Use when the project doc was already scrapped from the UI, so
 * there is no plan left to match URLs against. Lists by type + day; deletes on
 * --delete (media docs + storage files).
 */
async function scrapOrphans(doDelete: boolean): Promise<void> {
  const db = admin.firestore();
  const snap = await db.collection(MEDIA).where('tags', 'array-contains', 'shot-plan').get();
  console.log(`\nShot-plan media assets in the library: ${snap.size}\n`);

  const byType = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const m of snap.docs) {
    const d = m.data();
    byType.set(String(d.type ?? 'unknown'), (byType.get(String(d.type ?? 'unknown')) ?? 0) + 1);
    const ts = d.createdAt as admin.firestore.Timestamp | undefined;
    const day = ts && typeof ts.toDate === 'function' ? ts.toDate().toISOString().slice(0, 10) : 'unknown';
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  console.log('By type:');
  for (const [t, n] of byType) {
    console.log(`  ${t}: ${n}`);
  }
  console.log('By day:');
  for (const [day, n] of [...byDay].sort()) {
    console.log(`  ${day}: ${n}`);
  }

  if (!doDelete) {
    console.log(`\nDRY RUN. Re-run with \`--orphans --delete\` to remove all ${snap.size} shot-plan assets + their storage files.\n`);
    return;
  }

  const bucket = admin.storage().bucket();
  let storageDeleted = 0;
  for (const m of snap.docs) {
    const u = (m.data().url as string | undefined) ?? '';
    const p = u ? storagePathFromUrl(u) : null;
    if (p) {
      await bucket.file(p).delete().then(() => { storageDeleted += 1; }).catch(() => null);
    }
    await m.ref.delete();
  }
  console.log(`\nDeleted ${snap.size} shot-plan media docs, ${storageDeleted} storage files.\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const doDelete = args.includes('--delete');
  if (args.includes('--orphans')) {
    await scrapOrphans(doDelete);
    process.exit(0);
  }
  const projectId = args.find((a) => /^[A-Za-z0-9]{15,}$/.test(a));
  if (!projectId) {
    await listProjects();
  } else {
    await scrap(projectId, doDelete);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
