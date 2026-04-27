/**
 * Social Post Image Helper
 *
 * Resolves the image attached to an organic social post in priority order:
 *   1. If the operator provided a `providedImageUrl`, use it AS-IS — no
 *      DALL-E call, no Firestore persist. Operator-provided media is
 *      trusted and never replaced or "improved" by the system.
 *   2. Otherwise, generate via DALL-E, download (DALL-E URLs expire in
 *      a few hours), compress to JPEG, persist the base64 in Firestore
 *      under `social_post_images/{postId}`, and return the public URL
 *      path the post body should reference for media attachment.
 *
 * This mirrors `blog-featured-image.ts` exactly — same caching pattern,
 * same operator-first priority, same non-fatal failure semantics. The
 * point is so we have ONE image-resolution rule applied everywhere:
 * provided → use it; absent → generate.
 *
 * Failure is non-fatal: if image generation or persistence fails, returns
 * null and the caller should publish the post without an image rather
 * than block the whole post.
 *
 * @module content/social-post-image
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { generateImage } from '@/lib/ai/image-generation-service';
import { logger } from '@/lib/logger/logger';
import sharp from 'sharp';

const COLLECTION = 'social_post_images';

export interface SocialPostImageInput {
  /** Stable id for this image. Convention: `socimg_<platform>_<missionId|timestamp>`. */
  imageId: string;
  /**
   * Platform the post will publish to (used in the prompt + log context).
   * Free-form string — typical values: 'twitter', 'bluesky', 'mastodon',
   * 'linkedin', 'facebook', 'instagram', 'pinterest'.
   */
  platform: string;
  /** The actual post text — drives the image prompt so the image matches. */
  postText: string;
  /** Brief topical context if available (e.g., "AI agent swarms for sales-ops"). */
  topic?: string;
  /**
   * Optional brand-level style hint. Pass the tenant's tone/style so the
   * image matches the brand voice (e.g. "clean, modern, corporate").
   */
  brandStyleHint?: string;
  /**
   * Operator-provided image URL. When supplied, the helper returns this
   * URL unchanged — no DALL-E call, no Firestore persist, no API spend.
   * Explicit opt-out for posts where the operator already chose the image.
   */
  providedImageUrl?: string;
}

export interface SocialPostImageResult {
  /** Public URL path the post body should reference for media attachment. */
  url: string;
  /** DALL-E's revised prompt (or 'operator-provided' marker when short-circuited). */
  revisedPrompt: string;
  /** Whether the URL came from the operator (true) or DALL-E (false). */
  operatorProvided: boolean;
}

/**
 * Build the DALL-E prompt from the post text + topic. Image gen for social
 * is more aggressive on platform-appropriateness than blogs — square crop
 * for most platforms, no text overlays, brand-aware style.
 */
function buildImagePrompt(input: SocialPostImageInput): string {
  const styleSuffix = input.brandStyleHint
    ? ` Style: ${input.brandStyleHint}.`
    : ' Style: clean, professional, modern.';

  const topicLine = input.topic
    ? `The post is about: ${input.topic}.`
    : '';

  return [
    `Social media accompanying image for a ${input.platform} post.`,
    `The post text reads: "${input.postText.slice(0, 240)}".`,
    topicLine,
    'The image should be visually engaging and thematically relevant to the post.',
    'Do not include any text, words, letters, or typography in the image.',
    'Square or near-square aspect ratio works for most social platforms.',
    styleSuffix,
  ].filter((s) => s.length > 0).join(' ');
}

/**
 * Resolve the image for a social post — use the operator's URL if
 * supplied, otherwise generate via DALL-E and cache.
 *
 * Returns null only when image generation/persistence fails AND no
 * operator URL was provided. Caller should treat null as "no image"
 * and publish the post without media.
 */
export async function generateAndStoreSocialPostImage(
  input: SocialPostImageInput,
): Promise<SocialPostImageResult | null> {
  // OPERATOR-PROVIDED PATH — short-circuit before any API spend.
  if (input.providedImageUrl && input.providedImageUrl.trim().length > 0) {
    logger.info('[SocialPostImage] Using operator-provided image — skipping DALL-E', {
      imageId: input.imageId,
      platform: input.platform,
      providedImageUrl: input.providedImageUrl,
    });
    return {
      url: input.providedImageUrl.trim(),
      revisedPrompt: 'operator-provided (no DALL-E call)',
      operatorProvided: true,
    };
  }

  if (!adminDb) {
    logger.warn('[SocialPostImage] Firestore admin not available — skipping', {
      imageId: input.imageId,
    });
    return null;
  }

  const prompt = buildImagePrompt(input);

  let dalleUrl: string;
  let revisedPrompt: string;
  try {
    const result = await generateImage(prompt, {
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',
    });
    dalleUrl = result.url;
    revisedPrompt = result.revisedPrompt;
  } catch (err) {
    logger.warn('[SocialPostImage] DALL-E generation failed', {
      imageId: input.imageId,
      platform: input.platform,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // Same compression/storage pattern as blog-featured-image — DALL-E URLs
  // expire within a few hours, so we download once, JPEG-compress, and
  // cache base64 in Firestore. 1024x1024 PNGs land at ~1MB raw; q85 JPEG
  // compresses to ~80-150KB which fits comfortably under Firestore's
  // 1,048,487-byte field limit.
  let base64: string;
  const contentType = 'image/jpeg';
  try {
    const response = await fetch(dalleUrl);
    if (!response.ok) {
      throw new Error(`Fetch returned ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const compressed = await sharp(Buffer.from(arrayBuffer))
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    base64 = compressed.toString('base64');

    logger.info('[SocialPostImage] Compressed image for Firestore', {
      imageId: input.imageId,
      platform: input.platform,
      originalBytes: arrayBuffer.byteLength,
      compressedBytes: compressed.byteLength,
      base64Bytes: base64.length,
    });

    if (base64.length > 1_000_000) {
      logger.warn('[SocialPostImage] Compressed image too large — re-compressing at q70', {
        imageId: input.imageId,
        base64Bytes: base64.length,
      });
      const recompressed = await sharp(Buffer.from(arrayBuffer))
        .jpeg({ quality: 70, mozjpeg: true })
        .toBuffer();
      base64 = recompressed.toString('base64');
      if (base64.length > 1_000_000) {
        throw new Error(`Compressed image still too large for Firestore (${base64.length} bytes)`);
      }
    }
  } catch (err) {
    logger.warn('[SocialPostImage] Failed to download or compress generated image', {
      imageId: input.imageId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // Persist base64 in Firestore for a stable URL the publish step can use.
  try {
    const path = getSubCollection(COLLECTION);
    await adminDb.collection(path).doc(input.imageId).set({
      imageId: input.imageId,
      platform: input.platform,
      base64,
      contentType,
      prompt,
      revisedPrompt,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('[SocialPostImage] Firestore persist failed', {
      imageId: input.imageId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  return {
    url: `/api/content/social-post-image/${input.imageId}`,
    revisedPrompt,
    operatorProvided: false,
  };
}
