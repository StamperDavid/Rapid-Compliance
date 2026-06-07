/**
 * Brand logo compositor.
 *
 * Generative image models cannot reproduce a precise logo from text, so we
 * overlay the REAL logo asset (from the brand kit) onto a generated image —
 * exactly how the website renders the real logo. Deterministic, pixel-accurate.
 */

import sharp from 'sharp';
import type { BrandLogo } from '@/types/brand-kit';
import { logger } from '@/lib/logger/logger';

function gravityOffset(
  position: BrandLogo['position'],
  baseW: number,
  baseH: number,
  logoW: number,
  logoH: number,
  margin: number,
): { top: number; left: number } {
  const right = Math.max(0, baseW - logoW - margin);
  const bottom = Math.max(0, baseH - logoH - margin);
  switch (position) {
    case 'top-left':
      return { top: margin, left: margin };
    case 'top-right':
      return { top: margin, left: right };
    case 'bottom-left':
      return { top: bottom, left: margin };
    case 'bottom-right':
    default:
      return { top: bottom, left: right };
  }
}

/**
 * Download a base image + the brand logo and composite the logo onto the base at
 * the configured corner, scale, and opacity. Returns the composited PNG buffer,
 * or null if anything goes wrong (caller falls back to the un-composited image).
 */
export async function compositeBrandLogo(baseImageUrl: string, logo: BrandLogo): Promise<Buffer | null> {
  try {
    const [baseRes, logoRes] = await Promise.all([
      fetch(baseImageUrl, { redirect: 'follow' }),
      fetch(logo.url, { redirect: 'follow' }),
    ]);
    if (!baseRes.ok || !logoRes.ok) {
      return null;
    }
    const baseBuf = Buffer.from(await baseRes.arrayBuffer());
    const logoBuf = Buffer.from(await logoRes.arrayBuffer());

    const base = sharp(baseBuf);
    const baseMeta = await base.metadata();
    const baseW = baseMeta.width ?? 1024;
    const baseH = baseMeta.height ?? 1024;

    const scale = Math.min(0.25, Math.max(0.05, logo.scale || 0.1));
    const logoW = Math.round(baseW * scale);

    // Resize logo, then scale its alpha by the configured opacity using a
    // tiled semi-transparent white over the logo with the 'dest-in' blend
    // (keeps the logo pixels, multiplies their alpha by the white's alpha).
    const opacity = Math.min(1, Math.max(0, logo.opacity ?? 0.85));
    const resized = await sharp(logoBuf).resize({ width: logoW }).ensureAlpha().png().toBuffer();
    const faded = await sharp(resized)
      .composite([
        {
          input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer();

    const fadedMeta = await sharp(faded).metadata();
    const logoH = fadedMeta.height ?? Math.round(logoW * 0.4);
    const margin = Math.round(baseW * 0.03);
    const { top, left } = gravityOffset(logo.position, baseW, baseH, logoW, logoH, margin);

    return await base.composite([{ input: faded, top, left }]).png().toBuffer();
  } catch (err) {
    logger.warn('[logo-compositor] Failed to composite brand logo; using image as-is', {
      error: err instanceof Error ? err.message : String(err),
      file: 'logo-compositor.ts',
    });
    return null;
  }
}
