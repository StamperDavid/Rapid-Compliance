/**
 * READ-ONLY — diagnose why "add image from library to character" fails to move.
 *
 * Checks the two collections the move touches:
 *   - organizations/<PLATFORM>/media           (what the picker lists + deleteAsset deletes)
 *   - organizations/<PLATFORM>/avatar_profiles  (the character it appends onto)
 *
 * Prints the media inventory (by type + source), a sample of image docs (the ids
 * the picker hands to /add-image), and each character's slot counts. NOTHING is
 * modified.
 *
 * Usage: npx tsx scripts/diagnose-media-move.ts
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
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const MEDIA = `organizations/${PLATFORM_ID}/media`;
const PROFILES = `organizations/${PLATFORM_ID}/avatar_profiles`;

async function main(): Promise<void> {
  const db = admin.firestore();

  // ── Media inventory ────────────────────────────────────────────────────────
  const media = await db.collection(MEDIA).get();
  console.log(`\n=== MEDIA: ${media.size} docs in ${MEDIA} ===`);
  const byType = new Map<string, number>();
  const bySource = new Map<string, number>();
  const imageSamples: Array<Record<string, unknown>> = [];
  for (const doc of media.docs) {
    const d = doc.data();
    const type = String(d.type ?? '(missing)');
    const source = String(d.source ?? '(missing)');
    byType.set(type, (byType.get(type) ?? 0) + 1);
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
    if (type === 'image' && imageSamples.length < 8) {
      imageSamples.push({
        id: doc.id,
        type,
        source,
        name: d.name ?? d.filename ?? '(no name)',
        hasUrl: Boolean(d.url),
        userId: d.userId ?? '(none)',
      });
    }
  }
  console.log('\n-- by type --');
  for (const [k, v] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  }
  console.log('\n-- by source --');
  for (const [k, v] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  }
  console.log('\n-- sample image docs (these ids are what the picker sends to /add-image) --');
  for (const s of imageSamples) {
    console.log(`  ${JSON.stringify(s)}`);
  }

  // ── Character slots ──────────────────────────────────────────────────────────
  const profiles = await db.collection(PROFILES).get();
  console.log(`\n=== AVATAR_PROFILES: ${profiles.size} docs in ${PROFILES} ===`);
  for (const doc of profiles.docs) {
    const d = doc.data();
    const additional = Array.isArray(d.additionalImageUrls) ? d.additionalImageUrls.length : 0;
    console.log(
      `  ${String(d.name ?? '(no name)').padEnd(22)} id=${doc.id}  source=${d.source ?? '?'}  ` +
        `frontal=${d.frontalImageUrl ? 'Y' : 'n'} additional=${additional} ` +
        `fullBody=${d.fullBodyImageUrl ? 'Y' : 'n'} upperBody=${d.upperBodyImageUrl ? 'Y' : 'n'}`,
    );
  }

  // ── Cross-reference: are a character's referenced images STILL in media? ─────
  // If a URL the character references also exists as a media doc, then the move's
  // delete step did NOT remove it (or it was added by upload, not move).
  const mediaUrlToId = new Map<string, string>();
  for (const doc of media.docs) {
    const url = doc.data().url;
    if (typeof url === 'string') {
      mediaUrlToId.set(url, doc.id);
    }
  }
  console.log('\n=== CROSS-REFERENCE: character images still present in media ===');
  for (const doc of profiles.docs) {
    const d = doc.data();
    const refs: string[] = [];
    if (typeof d.frontalImageUrl === 'string') refs.push(d.frontalImageUrl);
    if (Array.isArray(d.additionalImageUrls)) {
      for (const u of d.additionalImageUrls) {
        if (typeof u === 'string') refs.push(u);
      }
    }
    if (typeof d.fullBodyImageUrl === 'string') refs.push(d.fullBodyImageUrl);
    if (typeof d.upperBodyImageUrl === 'string') refs.push(d.upperBodyImageUrl);
    console.log(`\n  ${d.name ?? '(no name)'} — ${refs.length} referenced image(s):`);
    for (const u of refs) {
      const stillInMedia = mediaUrlToId.get(u);
      console.log(`    ${stillInMedia ? 'STILL IN LIBRARY (media doc ' + stillInMedia + ')' : 'moved/clean'}  ${u.slice(0, 80)}`);
    }
  }

  console.log('\nDone. (read-only — nothing modified)\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
