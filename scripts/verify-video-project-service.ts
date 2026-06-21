/**
 * VERIFY (real Firestore, cheap — no LLM/fal) — the VideoProject service backbone:
 * create → per-doc replace → status derivation → list → delete.
 *
 * Proves the data layer the whole multi-doc flow sits on:
 *   - createVideoProject with 2 doc stills (no video) → status 'review'
 *   - replaceProjectDoc with a doc that now has finalVideoUrl → 'generating'
 *   - replace the 2nd doc with a video → every doc has video → 'assembled'
 *   - getVideoProject / listVideoProjects find it
 *   - deleteVideoProject removes it
 *
 * Usage: npx tsx scripts/verify-video-project-service.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const eq = t.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}
loadEnvLocal();

function fail(step: string, detail: unknown): never {
  const msg = detail instanceof Error ? detail.message : String(detail);
  throw new Error(`[STEP FAILED: ${step}] ${msg}`);
}
function assert(cond: boolean, label: string, detail?: unknown): void {
  if (!cond) {
    fail(label, detail ?? 'assertion failed');
  }
  // eslint-disable-next-line no-console
  console.log(`  ✓ ${label}`);
}

const FAKE_VIDEO = 'https://firebasestorage.googleapis.com/v0/b/x/o/fake.mp4?alt=media&token=t';

async function main(): Promise<void> {
  const {
    createVideoProject,
    getVideoProject,
    replaceProjectDoc,
    listVideoProjects,
    deleteVideoProject,
  } = await import('../src/lib/video/video-project-service');
  const { makeBlankShotPlan } = await import('../src/lib/video/shot-plan-blank');

  /* eslint-disable no-console */
  let projectId = '';
  try {
    console.log('STEP 1 — create a project with 2 docs, no video');
    const docA = makeBlankShotPlan('Scene 1');
    const docB = makeBlankShotPlan('Scene 2');
    const created = await createVideoProject({ title: 'Service Verification', brief: 'two-scene test', docs: [docA, docB] });
    projectId = created.id;
    assert(created.docs.length === 2, 'project has 2 docs');
    assert(created.status === 'review', `status is 'review' before any video (got '${created.status}')`);

    console.log('STEP 2 — give doc A a video → status should be generating');
    const afterA = await replaceProjectDoc(projectId, { ...docA, finalVideoUrl: FAKE_VIDEO });
    assert(afterA.status === 'generating', `status is 'generating' with 1 of 2 videos (got '${afterA.status}')`);

    console.log('STEP 3 — give doc B a video → every doc has video → assembled');
    const afterB = await replaceProjectDoc(projectId, { ...docB, finalVideoUrl: FAKE_VIDEO });
    assert(afterB.status === 'assembled', `status is 'assembled' when all docs have video (got '${afterB.status}')`);

    console.log('STEP 4 — get + list find it');
    const fetched = await getVideoProject(projectId);
    assert(Boolean(fetched), 'getVideoProject returns the project');
    assert(fetched?.docs.every((d) => Boolean(d.finalVideoUrl)) ?? false, 'both docs carry their finalVideoUrl');
    const summaries = await listVideoProjects();
    const summary = summaries.find((s) => s.id === projectId);
    assert(Boolean(summary), 'listVideoProjects includes it');
    assert(summary?.docsWithVideo === 2, `summary reports 2 docs with video (got ${summary?.docsWithVideo})`);
  } finally {
    if (projectId) {
      console.log('STEP 5 — cleanup (delete the test project)');
      await deleteVideoProject(projectId);
      const gone = await getVideoProject(projectId);
      assert(gone === null, 'project deleted — gone from Firestore');
    }
  }

  console.log('\n✅ VIDEO-PROJECT SERVICE VERIFY PASSED — create/replace/status/list/delete all correct.');
  process.exit(0);
  /* eslint-enable no-console */
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('\n❌ VERIFY FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
