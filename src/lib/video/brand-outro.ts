/**
 * Deterministic brand OUTRO renderer.
 *
 * The closing "Brand Close / CTA / outro" scene of a storyboard must show the
 * REAL brand logo + the official tagline — never an AI-invented text card. The
 * normal storyboard-thumbnail path strips all branding language from the prompt
 * (so the image model can't paint a fake logo), which leaves the outro scene
 * with no brand mark at all. This module fixes that by compositing a clean,
 * pixel-accurate branded outro with sharp instead of asking the image model to
 * draw it:
 *
 *   - solid brand-colored background (the brand's dark background color),
 *   - the REAL logo (read from disk / fetched), centered, upper-middle, ~35% wide,
 *   - the official tagline as crisp SVG text centered below the logo.
 *
 * No AI guessing for this scene — same logo + tagline every render.
 */

import sharp from 'sharp';
import { logger } from '@/lib/logger/logger';

const FILE = 'brand-outro.ts';

export interface BrandOutroOptions {
  /** Official tagline, rendered verbatim below the logo. */
  tagline: string;
  /** Logo source — an absolute http(s) URL OR a local static path like '/logo.png'. */
  logoUrl: string;
  /** Background fill (hex). The brand's dark background color, e.g. '#000000'. */
  bgColor: string;
  /** Optional accent (hex) for the tagline; defaults to white. */
  accentColor?: string;
  width: number;
  height: number;
}

/** Hex-color guard. Falls back to a sane default when a value is missing/garbage. */
function safeHex(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value.trim())
    ? value.trim()
    : fallback;
}

/**
 * Load the logo bytes. Supports a remote URL (fetch) OR a local static asset path
 * like '/logo.png' (read from the app's public/ folder on disk) — the tenant's real
 * logo currently ships as a static asset. Mirrors logo-compositor's loader.
 */
async function loadLogoBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('/') && !url.startsWith('//')) {
      const fsMod = await import('node:fs/promises');
      const pathMod = await import('node:path');
      return await fsMod.readFile(pathMod.join(process.cwd(), 'public', url));
    }
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** XML-escape tagline text so it's safe inside the SVG text node. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Render the deterministic branded outro and return the composited PNG buffer.
 * Never throws — on any failure it returns a plain brand-colored card with the
 * tagline (logo omitted) so the caller always gets a usable image.
 */
export async function renderBrandOutro(opts: BrandOutroOptions): Promise<Buffer> {
  const width = Math.max(64, Math.round(opts.width) || 1024);
  const height = Math.max(64, Math.round(opts.height) || 576);
  const bg = safeHex(opts.bgColor, '#000000');
  const textColor = safeHex(opts.accentColor, '#FFFFFF');
  const tagline = (opts.tagline ?? '').trim();

  // Tagline SVG text layer — centered, sized relative to the frame width.
  const taglineFontSize = Math.max(18, Math.round(width * 0.045));
  const taglineSvg = tagline
    ? Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
          `<text x="50%" y="68%" text-anchor="middle" dominant-baseline="middle" ` +
          `font-family="Inter, Arial, Helvetica, sans-serif" font-size="${taglineFontSize}" ` +
          `font-weight="600" fill="${textColor}" letter-spacing="0.5">${escapeXml(tagline)}</text>` +
          `</svg>`,
      )
    : null;

  // Base solid brand-colored background.
  const base = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: bg,
    },
  });

  const layers: sharp.OverlayOptions[] = [];

  // Real logo — scaled to ~35% of the frame width, horizontally centered, upper-middle.
  try {
    const logoBuf = await loadLogoBuffer(opts.logoUrl);
    if (logoBuf) {
      const logoW = Math.round(width * 0.35);
      const resizedLogo = await sharp(logoBuf)
        .resize({ width: logoW, fit: 'inside', withoutEnlargement: false })
        .png()
        .toBuffer();
      const logoMeta = await sharp(resizedLogo).metadata();
      const logoH = logoMeta.height ?? Math.round(logoW * 0.4);
      const left = Math.round((width - logoW) / 2);
      // Upper-middle: center the logo around ~38% of the frame height.
      const top = Math.max(0, Math.round(height * 0.38 - logoH / 2));
      layers.push({ input: resizedLogo, top, left });
    } else {
      logger.warn('[brand-outro] Logo could not be loaded; rendering tagline-only outro', {
        logoUrl: opts.logoUrl,
        file: FILE,
      });
    }
  } catch (err) {
    logger.warn('[brand-outro] Logo composite step failed; rendering tagline-only outro', {
      error: err instanceof Error ? err.message : String(err),
      file: FILE,
    });
  }

  if (taglineSvg) {
    layers.push({ input: taglineSvg, top: 0, left: 0 });
  }

  return base.composite(layers).png().toBuffer();
}
