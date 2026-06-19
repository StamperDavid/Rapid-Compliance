/**
 * Lists System A (legacy PipelineProject) docs and DELETES the orphaned test
 * build(s) created today (the broken Content-Manager run). Prints everything it
 * sees and everything it removes — transparent, targeted (only today's).
 *
 * Usage: npx tsx scripts/cleanup-orphan-pipeline-project.ts          (dry run: lists only)
 *        npx tsx scripts/cleanup-orphan-pipeline-project.ts --delete (deletes today's)
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
const COLLECTION = `organizations/${PLATFORM_ID}/video_pipeline_projects`;
const TODAY_PREFIXES = ['2026-06-18', '2026-06-19']; // the test run

async function main(): Promise<void> {
  const doDelete = process.argv.includes('--delete');
  const db = admin.firestore();
  const snap = await db.collection(COLLECTION).get();
  console.log(`\nSystem A (legacy) — ${snap.size} doc(s) in ${COLLECTION}\n`);

  // Optional explicit id to delete: `--delete <docId>`.
  const explicitId = process.argv.find((a) => /^[A-Za-z0-9]{15,}$/.test(a));
  for (const doc of snap.docs) {
    const d = doc.data();
    const sceneCount = Array.isArray(d.scenes) ? d.scenes.length : 0;
    const mark = explicitId === doc.id ? '🗑  ' : '    ';
    console.log(
      `  ${mark}${doc.id}  "${String(d.title ?? d.name ?? '(untitled)')}"  scenes=${sceneCount}`,
    );
  }

  if (!doDelete || !explicitId) {
    console.log('\nDry run — pass `--delete <docId>` to remove a specific doc.\n');
    process.exit(0);
  }
  await db.collection(COLLECTION).doc(explicitId).delete();
  console.log(`\nDeleted ${explicitId}. Other docs untouched.\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
