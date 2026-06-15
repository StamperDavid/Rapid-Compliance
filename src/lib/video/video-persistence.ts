/**
 * Video Persistence Service
 *
 * Downloads completed videos from the engine's expiring CDN and uploads them
 * to Firebase Storage for permanent access. This runs automatically
 * during scene polling — the moment the engine marks a video as complete,
 * we persist it so the URL never expires.
 *
 * Deduplication: A module-level Map tracks in-flight persistence operations.
 * If multiple poll cycles hit the same completed scene before the first
 * download finishes, they all await the same Promise instead of starting
 * duplicate downloads.
 */

import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { unlink, mkdir } from 'fs/promises';
import { logger } from '@/lib/logger/logger';
import { adminStorage } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// In-Flight Deduplication
// ============================================================================

/** Map of generationId → Promise<permanentUrl>. Prevents duplicate downloads. */
const inFlightPersistence = new Map<string, Promise<string>>();

// ============================================================================
// Core Persistence Function
// ============================================================================

/**
 * Download a completed video from the engine's CDN and upload to Firebase Storage.
 * Returns a long-lived signed URL (365 days).
 *
 * Throws if Firebase Storage is unavailable or if all upload retries are
 * exhausted — callers must treat this as a hard failure, not a fallback.
 *
 * Deduplicates: if another call is already persisting the same generationId,
 * this call awaits the existing operation instead of starting a new one.
 */
export async function persistVideoToStorage(
  generationId: string,
  videoUrl: string,
  projectId: string,
  sceneId: string,
): Promise<string> {
  // Firebase Storage not available — hard failure, not a silent fallback
  if (!adminStorage) {
    throw new Error('Video persistence failed: Firebase Storage is not initialized');
  }

  // Deduplicate: if already persisting this generation, await the existing operation
  const existing = inFlightPersistence.get(generationId);
  if (existing) {
    logger.info('Video persistence already in flight, awaiting existing operation', {
      generationId: generationId.slice(0, 8),
      file: 'video-persistence.ts',
    });
    return existing;
  }

  // Start persistence and track it
  const persistPromise = doPersist(generationId, videoUrl, projectId, sceneId);
  inFlightPersistence.set(generationId, persistPromise);

  try {
    return await persistPromise;
  } finally {
    inFlightPersistence.delete(generationId);
  }
}

/**
 * Internal: actual download + upload logic.
 * Caller guarantees adminStorage is non-null before calling this.
 */
async function doPersist(
  generationId: string,
  videoUrl: string,
  projectId: string,
  sceneId: string,
): Promise<string> {
  if (!adminStorage) {
    throw new Error('Firebase Storage not available');
  }
  const storage = adminStorage;
  const workDir = join(tmpdir(), `sv-persist-${randomUUID().slice(0, 8)}`);
  const tempPath = join(workDir, `${sceneId}.mp4`);

  try {
    await mkdir(workDir, { recursive: true });

    // Download from the engine CDN
    logger.info('Downloading video for persistence', {
      generationId: generationId.slice(0, 8),
      sceneId: sceneId.slice(0, 8),
      file: 'video-persistence.ts',
    });

    const downloadStart = Date.now();
    const response = await fetch(videoUrl, { redirect: 'follow' });

    if (!response.ok) {
      throw new Error(`Video download failed: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const { writeFile } = await import('fs/promises');
    await writeFile(tempPath, buffer);

    logger.info('Video downloaded for persistence', {
      generationId: generationId.slice(0, 8),
      sizeBytes: buffer.length,
      downloadMs: Date.now() - downloadStart,
      file: 'video-persistence.ts',
    });

    // Upload to Firebase Storage with 365-day signed URL
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
          provider: 'fal',
          persistedAt: new Date().toISOString(),
        },
      },
    });

    const file = bucket.file(storagePath);
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });

    logger.info('Video persisted to Firebase Storage', {
      generationId: generationId.slice(0, 8),
      sceneId: sceneId.slice(0, 8),
      sizeBytes: buffer.length,
      file: 'video-persistence.ts',
    });

    return signedUrl;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Video persistence failed', error as Error, {
      generationId: generationId.slice(0, 8),
      sceneId: sceneId.slice(0, 8),
      file: 'video-persistence.ts',
    });
    throw new Error(`Video persistence failed: ${msg}`);
  } finally {
    // Cleanup temp file (best-effort)
    await unlink(tempPath).catch(() => { /* ignore */ });
    const { rmdir } = await import('fs/promises');
    await rmdir(workDir).catch(() => { /* ignore */ });
  }
}
