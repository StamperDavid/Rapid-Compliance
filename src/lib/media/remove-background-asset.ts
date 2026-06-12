/**
 * Orchestration for background removal: resolve a source image (a library asset or
 * a URL), strip its solid white background with the deterministic editor, persist the
 * transparent PNG, and register it as a NEW library asset (the original is kept).
 *
 * Shared by the HTTP route (/api/content/image/remove-background) and the Content
 * Manager chat, so both behave identically.
 */

import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getAsset, createAsset } from '@/lib/media/media-library-service';
import { persistBufferToStorage } from '@/lib/firebase/storage-utils';
import { removeWhiteBackground, isSolidWhiteBackground } from '@/lib/media/background-removal';
import { removeBackgroundWithFal } from '@/lib/ai/providers/fal-provider';
import type { UnifiedMediaAsset } from '@/types/media-library';

export interface RemoveBackgroundInput {
  /** Library asset to edit (preferred — keeps a parent link). */
  assetId?: string;
  /** Or an arbitrary image URL (e.g. a chat attachment). */
  imageUrl?: string;
  /** Optional name for the saved asset; defaults to "<source> (transparent)". */
  name?: string;
  /** Override white-detection threshold (0-255) for stubborn near-white plates. */
  whiteThreshold?: number;
  /** Who to attribute the created asset to. */
  userId: string;
}

export async function removeBackgroundAndSave(
  input: RemoveBackgroundInput,
): Promise<UnifiedMediaAsset> {
  let sourceUrl: string;
  let baseName: string;
  let parentAssetId: string | undefined;

  if (input.assetId) {
    const asset = await getAsset(input.assetId);
    if (!asset?.url) {
      throw new Error('Source asset not found');
    }
    sourceUrl = asset.url;
    baseName = asset.name || 'image';
    parentAssetId = asset.id;
  } else if (input.imageUrl) {
    sourceUrl = input.imageUrl;
    baseName = 'image';
  } else {
    throw new Error('Provide either assetId or imageUrl');
  }

  const upstream = await fetch(sourceUrl);
  if (!upstream.ok) {
    throw new Error('Could not fetch the source image');
  }
  const inputBuffer = Buffer.from(await upstream.arrayBuffer());

  // Pick the right tool. A solid white/near-white background is handled by the fast,
  // exact, free deterministic white-key (preserves the artwork pixel-for-pixel —
  // ideal for logos). Anything else (a colored or photographic background) needs a
  // real subject-segmentation model (Fal BiRefNet). We do NOT fall back to the
  // white-key for a non-white image — that would silently strip nothing and hand
  // back an unchanged copy; instead we surface the real reason it couldn't run.
  const solidWhite = await isSolidWhiteBackground(inputBuffer);
  let outBuffer: Buffer;
  if (solidWhite) {
    outBuffer = await removeWhiteBackground(
      inputBuffer,
      input.whiteThreshold !== undefined ? { whiteThreshold: input.whiteThreshold } : {},
    );
  } else {
    try {
      outBuffer = await sharp(await removeBackgroundWithFal(sourceUrl)).png().toBuffer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('[remove-background] cutout model unavailable for non-white image', { error: msg });
      throw new Error(
        `This image has a non-white background, which needs the AI cutout model — and that isn't available right now: ${msg}`,
      );
    }
  }

  const meta = await sharp(outBuffer).metadata();
  const dimensions =
    meta.width && meta.height ? { width: meta.width, height: meta.height } : undefined;

  const storagePath = `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`;
  const url = await persistBufferToStorage(outBuffer, storagePath, 'image/png');
  if (!url) {
    throw new Error('Storage is unavailable');
  }

  const cleanName = baseName.replace(/\.[a-z0-9]+$/i, '');
  return createAsset({
    type: 'image',
    category: 'other',
    name: input.name ?? `${cleanName} (transparent)`,
    url,
    mimeType: 'image/png',
    fileSize: outBuffer.length,
    source: 'derived',
    createdBy: input.userId,
    tags: ['transparent', 'background-removed'],
    ...(dimensions ? { dimensions } : {}),
    ...(parentAssetId ? { parentAssetId } : {}),
  });
}
