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

import { PLATFORM_ID } from '@/lib/constants/platform';
import { getAsset, createAsset } from '@/lib/media/media-library-service';
import { persistBufferToStorage } from '@/lib/firebase/storage-utils';
import { removeWhiteBackground } from '@/lib/media/background-removal';
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

  const outBuffer = await removeWhiteBackground(
    inputBuffer,
    input.whiteThreshold !== undefined ? { whiteThreshold: input.whiteThreshold } : {},
  );

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
