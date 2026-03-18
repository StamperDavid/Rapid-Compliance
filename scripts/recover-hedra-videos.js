/**
 * Recover Hedra video generation results and map them to project scenes.
 *
 * This script:
 * 1. Reads the Hedra API key from Firestore
 * 2. Polls each generation ID for its status and video URL
 * 3. Reads the project from Firestore to get scene IDs
 * 4. Updates the project with generatedScenes so the pipeline can advance
 *
 * Run: node scripts/recover-hedra-videos.js
 */

const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
if (admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const BASE = 'https://api.hedra.com/web-app/public';
const PROJECT_ID = '2nbbMBTpVXFpnbRMyknj';

// Scene-to-generation mapping (from Hedra library asset IDs)
// NOTE: Scene 1 and Scene 2 had the same ID — Scene 1 may need correction
const SCENE_GENERATION_MAP = [
  { sceneNumber: 1, generationId: '4c508cd2-6dd9-451b-92a6-fe1c55acb615' },
  { sceneNumber: 2, generationId: '4c508cd2-6dd9-451b-92a6-fe1c55acb615' }, // Same as Scene 1 — may be wrong
  { sceneNumber: 3, generationId: 'a98d5f9a-19eb-4fde-817c-2cd42dbc17f8' },
  { sceneNumber: 4, generationId: '3ca43998-8c8c-4502-8264-8668ebbb82ef' },
  { sceneNumber: 5, generationId: 'ad9078cf-d90b-4034-989f-413166569a2d' },
  { sceneNumber: 6, generationId: '09dc109d-f078-46de-830c-c12e6036fa8c' },
  { sceneNumber: 7, generationId: 'ffcb3498-6388-41e6-aca4-e133d2f752f9' },
  { sceneNumber: 8, generationId: '10072e49-e156-4a55-aff5-2cf0a84863f6' },
];

async function main() {
  // 1. Get Hedra API key
  const doc = await db.doc('organizations/rapid-compliance-root/apiKeys/rapid-compliance-root').get();
  const key = doc.data()?.video?.hedra?.apiKey;
  if (!key) { console.error('No Hedra API key found in Firestore'); process.exit(1); }
  const h = { 'x-api-key': key, Accept: 'application/json' };

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  RECOVER HEDRA VIDEO GENERATION RESULTS                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 2. Load the project from Firestore
  const projectDoc = await db.doc(`organizations/rapid-compliance-root/video_pipeline_projects/${PROJECT_ID}`).get();
  if (!projectDoc.exists) {
    console.error(`Project ${PROJECT_ID} not found in Firestore`);
    process.exit(1);
  }
  const project = projectDoc.data();
  console.log(`Project: "${project.name}" — ${project.scenes?.length ?? 0} scenes\n`);

  if (!project.scenes || project.scenes.length === 0) {
    console.error('Project has no scenes');
    process.exit(1);
  }

  // 3. Poll each generation ID for status/video URL
  console.log('Polling Hedra for generation statuses...\n');
  const generatedScenes = [];

  for (const mapping of SCENE_GENERATION_MAP) {
    const scene = project.scenes.find(s => s.sceneNumber === mapping.sceneNumber);
    if (!scene) {
      console.warn(`  Scene ${mapping.sceneNumber}: NOT FOUND in project — skipping`);
      continue;
    }

    try {
      const r = await fetch(`${BASE}/generations/${mapping.generationId}/status`, { headers: h });
      if (!r.ok) {
        const errText = await r.text();
        console.error(`  Scene ${mapping.sceneNumber} (${mapping.generationId.slice(0, 8)}...): POLL FAILED ${r.status} — ${errText.slice(0, 200)}`);
        generatedScenes.push({
          sceneId: scene.id,
          providerVideoId: mapping.generationId,
          provider: 'hedra',
          status: 'failed',
          videoUrl: null,
          thumbnailUrl: null,
          progress: 0,
          error: `Poll failed: ${r.status}`,
        });
        continue;
      }

      const data = await r.json();
      const videoUrl = data.url || data.video_url || data.download_url || null;
      const status = (data.status === 'complete' || data.status === 'completed') ? 'completed' : data.status === 'failed' ? 'failed' : 'generating';

      console.log(`  Scene ${mapping.sceneNumber} (${mapping.generationId.slice(0, 8)}...): ${data.status} — ${videoUrl ? videoUrl.slice(0, 80) + '...' : 'no URL'}`);

      generatedScenes.push({
        sceneId: scene.id,
        providerVideoId: mapping.generationId,
        provider: 'hedra',
        status,
        videoUrl,
        thumbnailUrl: null,
        progress: status === 'completed' ? 100 : (data.progress || 0),
        error: data.error_message || data.error || null,
      });
    } catch (err) {
      console.error(`  Scene ${mapping.sceneNumber}: ERROR — ${err.message}`);
      generatedScenes.push({
        sceneId: scene.id,
        providerVideoId: mapping.generationId,
        provider: 'hedra',
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        progress: 0,
        error: err.message,
      });
    }
  }

  // 4. Summary
  const completed = generatedScenes.filter(s => s.status === 'completed');
  const failed = generatedScenes.filter(s => s.status === 'failed');
  const other = generatedScenes.filter(s => s.status !== 'completed' && s.status !== 'failed');

  console.log(`\n── Results ──────────────────────────────────────────────`);
  console.log(`  Completed: ${completed.length}`);
  console.log(`  Failed:    ${failed.length}`);
  console.log(`  Other:     ${other.length}`);
  console.log();

  if (completed.length === 0) {
    console.log('No completed videos found. The generation IDs may not be valid.');
    console.log('Raw data from first poll:');
    // Show raw response for debugging
    const testR = await fetch(`${BASE}/generations/${SCENE_GENERATION_MAP[0].generationId}/status`, { headers: h });
    console.log(`  Status: ${testR.status}`);
    if (testR.ok) {
      const testData = await testR.json();
      console.log(`  Response:`, JSON.stringify(testData, null, 2));
    } else {
      console.log(`  Error:`, await testR.text());
    }
    process.exit(1);
  }

  // 5. Update Firestore project with generatedScenes
  console.log('Updating Firestore project with recovered generation data...');
  await db.doc(`organizations/rapid-compliance-root/video_pipeline_projects/${PROJECT_ID}`).update({
    generatedScenes,
    currentStep: 'generation',
    status: completed.length === generatedScenes.length ? 'assembled' : 'generating',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log('✓ Firestore updated successfully!\n');

  // 6. Print video URLs for reference
  console.log('── Video URLs ───────────────────────────────────────────');
  for (const gs of generatedScenes) {
    const sceneNum = SCENE_GENERATION_MAP.find(m => m.generationId === gs.providerVideoId)?.sceneNumber ?? '?';
    console.log(`  Scene ${sceneNum}: ${gs.videoUrl ?? 'N/A'}`);
  }

  console.log('\n── Next Steps ───────────────────────────────────────────');
  console.log('  1. Reload the project in the video studio');
  console.log('  2. Navigate to the Generation step — videos should appear');
  console.log('  3. Click "Continue to Assembly" to proceed');
  console.log('  NOTE: Scene 1 and Scene 2 have the same Hedra ID — verify Scene 1 is correct');
}

main().catch(console.error);
