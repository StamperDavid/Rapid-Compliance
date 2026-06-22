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
 * Make a logo's solid (near-black) BACKGROUND fully transparent. Many brand logos
 * ship as a light/colored mark on a black rectangle; simply fading opacity then
 * leaves a faded black box. This keys out near-black pixels (alpha→0) so the logo
 * composites cleanly with NO background. Best-effort: returns the original buffer on
 * any failure. NOTE: this also clears genuinely-black parts of the mark — acceptable
 * because the brand logo is light-on-black; a logo with intentional black detail
 * should be supplied as a real transparent PNG instead.
 */
async function makeBackgroundTransparent(buf: Buffer): Promise<Buffer> {
  try {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (channels < 4) {
      return buf;
    }
    const out = Buffer.from(data);
    // Threshold catches the black field + most of its anti-aliased halo without
    // eating typical colored/white logo pixels.
    const THRESHOLD = 42;
    for (let i = 0; i < out.length; i += channels) {
      if (out[i] <= THRESHOLD && out[i + 1] <= THRESHOLD && out[i + 2] <= THRESHOLD) {
        out[i + 3] = 0;
      }
    }
    return await sharp(out, { raw: { width, height, channels } }).png().toBuffer();
  } catch {
    return buf;
  }
}

/**
 * Load the logo bytes and key out any near-black background so it composites with a
 * fully transparent background. Supports a remote URL (fetch) OR a local static asset
 * path like '/logo.png' (read from the app's public/ folder on disk) — the tenant's
 * real logo currently ships as a static asset rather than an uploaded URL.
 */
async function loadLogoBuffer(url: string): Promise<Buffer | null> {
  try {
    let raw: Buffer;
    if (url.startsWith('/') && !url.startsWith('//')) {
      const fsMod = await import('node:fs/promises');
      const pathMod = await import('node:path');
      raw = await fsMod.readFile(pathMod.join(process.cwd(), 'public', url));
    } else {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        return null;
      }
      raw = Buffer.from(await res.arrayBuffer());
    }
    return await makeBackgroundTransparent(raw);
  } catch {
    return null;
  }
}

/**
 * Download a base image + load the brand logo and composite the logo onto the base
 * at the configured corner, scale, and opacity. Returns the composited PNG buffer,
 * or null if anything goes wrong (caller falls back to the un-composited image).
 */
export async function compositeBrandLogo(baseImageUrl: string, logo: BrandLogo): Promise<Buffer | null> {
  try {
    const [baseRes, logoBuf] = await Promise.all([
      fetch(baseImageUrl, { redirect: 'follow' }),
      loadLogoBuffer(logo.url),
    ]);
    if (!baseRes.ok || !logoBuf) {
      return null;
    }
    const baseBuf = Buffer.from(await baseRes.arrayBuffer());

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

/**
 * Download a base image + load the brand logo and composite the logo CENTERED
 * (both horizontally and vertically), scaled larger than the corner watermark so
 * it reads as the product's own branding on an isolated studio prop shot. Reuses
 * the same alpha-fade pipeline as `compositeBrandLogo`. Returns the composited PNG
 * buffer, or null on any failure (caller falls back to the un-composited image).
 *
 * @param scale Logo width as a fraction of the base width. Defaults to ~0.34,
 *              clamped to the 0.12–0.5 range.
 */
export async function compositeBrandLogoCentered(
  baseImageUrl: string,
  logo: BrandLogo,
  scale = 0.34,
): Promise<Buffer | null> {
  try {
    const [baseRes, logoBuf] = await Promise.all([
      fetch(baseImageUrl, { redirect: 'follow' }),
      loadLogoBuffer(logo.url),
    ]);
    if (!baseRes.ok || !logoBuf) {
      return null;
    }
    const baseBuf = Buffer.from(await baseRes.arrayBuffer());

    const base = sharp(baseBuf);
    const baseMeta = await base.metadata();
    const baseW = baseMeta.width ?? 1024;
    const baseH = baseMeta.height ?? 1024;

    const clampedScale = Math.min(0.5, Math.max(0.12, scale || 0.34));
    const logoW = Math.round(baseW * clampedScale);

    // Same alpha-fade technique as the corner compositor: multiply the logo's
    // alpha by the configured opacity via a 'dest-in' white tile.
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
    const left = Math.max(0, Math.round((baseW - logoW) / 2));
    const top = Math.max(0, Math.round((baseH - logoH) / 2));

    return await base.composite([{ input: faded, top, left }]).png().toBuffer();
  } catch (err) {
    logger.warn('[logo-compositor] Failed to composite centered brand logo; using image as-is', {
      error: err instanceof Error ? err.message : String(err),
      file: 'logo-compositor.ts',
    });
    return null;
  }
}
