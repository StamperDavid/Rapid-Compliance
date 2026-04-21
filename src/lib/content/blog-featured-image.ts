/**
 * Blog Featured Image Helper
 *
 * Generates a featured image for a blog post via DALL-E, downloads it, stores
 * the base64 in Firestore under `blog_featured_images/{postId}`, and returns
 * the public URL path that the blog post document should reference.
 *
 * Why the base64/proxy pattern:
 * DALL-E returns temporary URLs that expire within a few hours. If we stored
 * the raw DALL-E URL on the BlogPost doc, every blog would ship with a broken
 * image icon by the next day. We mirror the scene_previews pattern used for
 * video storyboard thumbnails — download once at creation time, cache the
 * bytes in Firestore, serve via a dedicated route with a year-long cache
 * header.
 *
 * Failure is non-fatal: if image generation or persistence fails, returns null
 * and the caller should persist the blog without a featured image rather than
 * block the whole blog. The log carries the failure reason.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { generateImage } from '@/lib/ai/image-generation-service';
import { logger } from '@/lib/logger/logger';

const COLLECTION = 'blog_featured_images';

export interface BlogFeaturedImageInput {
  postId: string;
  title: string;
  excerpt: string;
  /**
   * Optional brand-level style hint to shape the image. Pass the tenant's
   * tone/style so the image matches the blog's voice (e.g. "clean, modern,
   * corporate" vs "vibrant, playful").
   */
  brandStyleHint?: string;
}

export interface BlogFeaturedImageResult {
  /** Public URL path to set on BlogPost.featuredImage */
  url: string;
  /** DALL-E's revised prompt, stored alongside for debugging */
  revisedPrompt: string;
}

/**
 * Build the DALL-E prompt from the blog's title and excerpt. Intentionally
 * instructs for an editorial-style landscape image with no text overlays
 * (text in DALL-E output is usually garbled and unprofessional for blogs).
 */
function buildImagePrompt(input: BlogFeaturedImageInput): string {
  const styleSuffix = input.brandStyleHint
    ? ` Style: ${input.brandStyleHint}.`
    : ' Style: clean, professional, editorial.';

  return [
    `Editorial featured image for a blog post titled "${input.title}".`,
    `The post is about: ${input.excerpt}`,
    'The image should be visually striking and thematically relevant.',
    'Do not include any text, words, letters, or typography in the image.',
    'Landscape orientation, suitable as a blog header banner.',
    styleSuffix,
  ].join(' ');
}

/**
 * Generate a featured image, persist the bytes, and return the public URL path.
 *
 * Returns null if anything fails — caller should treat as "no image" and
 * persist the blog without a featuredImage field.
 */
export async function generateAndStoreBlogFeaturedImage(
  input: BlogFeaturedImageInput,
): Promise<BlogFeaturedImageResult | null> {
  if (!adminDb) {
    logger.warn('[BlogFeaturedImage] Firestore admin not available — skipping', {
      postId: input.postId,
    });
    return null;
  }

  const prompt = buildImagePrompt(input);

  let dalleUrl: string;
  let revisedPrompt: string;
  try {
    const result = await generateImage(prompt, {
      size: '1792x1024',
      quality: 'standard',
      style: 'natural',
    });
    dalleUrl = result.url;
    revisedPrompt = result.revisedPrompt;
  } catch (err) {
    logger.warn('[BlogFeaturedImage] DALL-E generation failed', {
      postId: input.postId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // Download the DALL-E bytes before the temporary URL expires
  let base64: string;
  let contentType: string;
  try {
    const response = await fetch(dalleUrl);
    if (!response.ok) {
      throw new Error(`Fetch returned ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString('base64');
    contentType = response.headers.get('content-type') ?? 'image/png';
  } catch (err) {
    logger.warn('[BlogFeaturedImage] Failed to download generated image', {
      postId: input.postId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  // Persist base64 in Firestore
  try {
    const path = getSubCollection(COLLECTION);
    await adminDb.collection(path).doc(input.postId).set({
      postId: input.postId,
      base64,
      contentType,
      prompt,
      revisedPrompt,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('[BlogFeaturedImage] Firestore persist failed', {
      postId: input.postId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  return {
    url: `/api/website/blog/featured-image/${input.postId}`,
    revisedPrompt,
  };
}
