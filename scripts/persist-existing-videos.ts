/**
 * One-time migration: Persist existing Hedra videos to Firebase Storage
 *
 * Reads all video pipeline projects from Firestore, finds scenes with
 * completed status and a providerVideoId, re-polls Hedra for fresh URLs,
 * downloads the videos, uploads to Firebase Storage, and updates Firestore
 * with permanent URLs.
 *
 * Usage:
 *   npx tsx scripts/persist-existing-videos.ts
 *
 * Requires:
 *   - FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY env vars
 *   - Hedra API key in Firestore (Settings > API Keys)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import * as admin from 'firebase-admin';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, unlink, rmdir } from 'fs/promises';
import { randomUUID } from 'crypto';

// ============================================================================
// Firebase Init
// ============================================================================

const PLATFORM_ID = 'rapid-compliance-root';
const FIREBASE_PROJECT_ID = 'rapid-compliance-65f87';
const COLLECTION = `organizations/${PLATFORM_ID}/video_pipeline_projects`;

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ?? `${FIREBASE_PROJECT_ID}.firebasestorage.app`;

  if (serviceAccountKey) {
    const parsed = JSON.parse(serviceAccountKey) as admin.ServiceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(parsed),
      storageBucket,
    });
  } else if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });
  } else {
    console.error('ERROR: No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY');
    process.exit(1);
  }
}

const db = admin.firestore();
const storage = admin.storage();

// ============================================================================
// Hedra API
// ============================================================================

const HEDRA_BASE_URL = 'https://api.hedra.com/web-app/public';

async function getHedraApiKey(): Promise<string> {
  // Primary: admin/platform-api-keys → video.hedra.apiKey
  const platformDoc = await db.collection('admin').doc('platform-api-keys').get();
  if (platformDoc.exists) {
    const data = platformDoc.data();
    const key = data?.video?.hedra?.apiKey;
    if (typeof key === 'string' && key.length > 0) return key;
  }

  // Fallback: organizations/{PLATFORM_ID}/apiKeys/{PLATFORM_ID}
  const orgDoc = await db
    .collection('organizations').doc(PLATFORM_ID)
    .collection('apiKeys').doc(PLATFORM_ID)
    .get();
  if (orgDoc.exists) {
    const data = orgDoc.data();
    const key = data?.video?.hedra?.apiKey;
    if (typeof key === 'string' && key.length > 0) return key;
  }

  throw new Error('Hedra API key not found in Firestore');
}

interface HedraStatusData {
  id: string;
  status: string;
  url?: string;
  video_url?: string;
  download_url?: string;
  error?: string;
  error_message?: string;
}

async function getHedraVideoUrl(apiKey: string, generationId: string): Promise<string | null> {
  const response = await fetch(`${HEDRA_BASE_URL}/generations/${generationId}/status`, {
    headers: { 'x-api-key': apiKey },
  });

  if (!response.ok) {
    console.warn(`  Hedra status check failed for ${generationId.slice(0, 8)}: ${response.status}`);
    return null;
  }

  const data = (await response.json()) as HedraStatusData;

  if (data.status === 'complete' || data.status === 'completed') {
    return data.url ?? data.video_url ?? data.download_url ?? null;
  }

  console.warn(`  Generation ${generationId.slice(0, 8)} status: ${data.status} (not complete)`);
  return null;
}

// ============================================================================
// Persistence
// ============================================================================

async function downloadAndUpload(
  hedraUrl: string,
  projectId: string,
  sceneId: string,
  generationId: string,
): Promise<string> {
  const workDir = join(tmpdir(), `sv-migrate-${randomUUID().slice(0, 8)}`);
  const tempPath = join(workDir, `${sceneId.slice(0, 8)}.mp4`);

  try {
    await mkdir(workDir, { recursive: true });

    // Download from Hedra
    const downloadStart = Date.now();
    const response = await fetch(hedraUrl, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(tempPath, buffer);

    const downloadMs = Date.now() - downloadStart;
    const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
    console.log(`    Downloaded: ${sizeMB}MB in ${downloadMs}ms`);

    // Upload to Firebase Storage
    const storagePath = `organizations/${PLATFORM_ID}/videos/${projectId}/scene_${sceneId}_${Date.now()}.mp4`;
    const bucket = storage.bucket();

    await bucket.upload(tempPath, {
      destination: storagePath,
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          generationId,
          sceneId,
          projectId,
          provider: 'hedra',
          migratedAt: new Date().toISOString(),
        },
      },
    });

    const file = bucket.file(storagePath);
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });

    console.log(`    Uploaded to Firebase Storage`);
    return signedUrl;
  } finally {
    await unlink(tempPath).catch(() => {});
    await rmdir(workDir).catch(() => {});
  }
}

// ============================================================================
// Main Migration
// ============================================================================

interface GeneratedScene {
  sceneId: string;
  providerVideoId: string;
  provider: string | null;
  status: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  progress: number;
  error: string | null;
}

async function migrate() {
  console.log('=== Persist Existing Hedra Videos to Firebase Storage ===\n');

  // Get Hedra API key
  let hedraKey: string;
  try {
    hedraKey = await getHedraApiKey();
    console.log('Hedra API key loaded from Firestore\n');
  } catch (err) {
    console.error('Failed to get Hedra API key:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Load all video projects
  const snapshot = await db.collection(COLLECTION).get();
  console.log(`Found ${snapshot.size} video pipeline projects\n`);

  let totalScenes = 0;
  let persisted = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const projectId = doc.id;
    const projectName = (data.name as string) ?? 'Untitled';
    const generatedScenes = (data.generatedScenes ?? []) as GeneratedScene[];

    // Find completed scenes with a providerVideoId that need persistence
    const scenesToPersist = generatedScenes.filter((s) => {
      if (s.status !== 'completed') return false;
      if (!s.providerVideoId) return false;
      // Already persisted to Firebase Storage — skip
      if (s.videoUrl?.includes('firebasestorage.googleapis.com') || s.videoUrl?.includes('storage.googleapis.com')) {
        return false;
      }
      return true;
    });

    if (scenesToPersist.length === 0) {
      continue;
    }

    console.log(`Project: "${projectName}" (${projectId.slice(0, 8)}...)`);
    console.log(`  ${scenesToPersist.length} scene(s) need persistence\n`);
    totalScenes += scenesToPersist.length;

    // Process each scene sequentially to avoid overwhelming Hedra/Storage
    const updatedScenes = [...generatedScenes];

    for (const scene of scenesToPersist) {
      const idx = updatedScenes.findIndex((s) => s.sceneId === scene.sceneId);
      if (idx === -1) continue;

      console.log(`  Scene ${scene.sceneId.slice(0, 8)}... (gen: ${scene.providerVideoId.slice(0, 8)}...)`);

      try {
        // Get fresh URL from Hedra
        const freshUrl = await getHedraVideoUrl(hedraKey, scene.providerVideoId);
        if (!freshUrl) {
          console.log(`    SKIP: Could not get fresh URL from Hedra\n`);
          skipped++;
          continue;
        }

        // Download and upload to Firebase Storage
        const permanentUrl = await downloadAndUpload(freshUrl, projectId, scene.sceneId, scene.providerVideoId);

        // Update the scene in the array
        updatedScenes[idx] = {
          ...updatedScenes[idx],
          videoUrl: permanentUrl,
        };

        persisted++;
        console.log(`    PERSISTED\n`);

        // Rate limit: wait 1 second between scenes
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`    FAILED: ${msg}\n`);
        failed++;
      }
    }

    // Update Firestore with the permanent URLs
    if (persisted > 0) {
      try {
        await db.collection(COLLECTION).doc(projectId).update({
          generatedScenes: updatedScenes,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`  Firestore updated for project ${projectId.slice(0, 8)}...\n`);
      } catch (err) {
        console.error(`  ERROR updating Firestore: ${err instanceof Error ? err.message : err}\n`);
      }
    }
  }

  console.log('\n=== Migration Complete ===');
  console.log(`Total scenes found: ${totalScenes}`);
  console.log(`Persisted: ${persisted}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);

  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration crashed:', err);
  process.exit(1);
});
