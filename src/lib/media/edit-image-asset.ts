/**
 * Instruction-based image EDITING — change part of an existing image while keeping
 * the rest, instead of regenerating it from scratch.
 *
 * Runs on Flux Kontext (an editing model in the Hedra catalog, via the existing
 * Hedra key — no extra credential): it takes the operator's exact image + a plain
 * instruction ("make the shirt red", "remove the person on the left") and returns a
 * version with only that change applied. The result is saved as a NEW library asset;
 * the original is always kept.
 *
 * Shared by the HTTP route (/api/content/image/edit) and the Content Manager chat.
 */

import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

import { PLATFORM_ID } from '@/lib/constants/platform';
import { getAsset, createAsset } from '@/lib/media/media-library-service';
import { persistBufferToStorage } from '@/lib/firebase/storage-utils';
import { generateHedraImageFromReference } from '@/lib/video/hedra-service';
import type { UnifiedMediaAsset } from '@/types/media-library';

export interface EditImageInput {
  /** Library asset to edit (preferred — keeps a parent link). */
  assetId?: string;
  /** Or an arbitrary image URL (e.g. a chat attachment). */
  imageUrl?: string;
  /** The plain-language change to make, e.g. "make the logo bigger". */
  instruction: string;
  /** Optional name for the saved asset; defaults to "<source> (edited)". */
  name?: string;
  /** Who to attribute the created asset to. */
  userId: string;
}

export async function editImageAndSave(input: EditImageInput): Promise<UnifiedMediaAsset> {
  const instruction = input.instruction.trim();
  if (!instruction) {
    throw new Error('Tell me what to change.');
  }

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

  // The edit itself — Flux Kontext keeps the image and applies only the instruction.
  const edited = await generateHedraImageFromReference(instruction, sourceUrl, {});

  // Pull the result bytes once so we can persist permanently + record real dimensions.
  const res = await fetch(edited.url);
  if (!res.ok) {
    throw new Error('The edit was produced but could not be retrieved');
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buffer).metadata();
  const dimensions =
    meta.width && meta.height ? { width: meta.width, height: meta.height } : undefined;

  const storagePath = `organizations/${PLATFORM_ID}/media/images/${randomUUID()}.png`;
  const url = await persistBufferToStorage(buffer, storagePath, 'image/png');
  if (!url) {
    throw new Error('Storage is unavailable');
  }

  const cleanName = baseName.replace(/\.[a-z0-9]+$/i, '');
  return createAsset({
    type: 'image',
    category: 'other',
    name: input.name ?? `${cleanName} (edited)`,
    url,
    mimeType: 'image/png',
    fileSize: buffer.length,
    source: 'derived',
    createdBy: input.userId,
    tags: ['edited'],
    aiPrompt: instruction,
    ...(dimensions ? { dimensions } : {}),
    ...(parentAssetId ? { parentAssetId } : {}),
  });
}
