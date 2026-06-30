/**
 * Font Catalog — Google Fonts + system fonts for the website-builder font picker.
 *
 * This is the single source of truth for which fonts the editor offers, their
 * categories, and their realistically-available weights. The picker reads it to
 * render a categorised, searchable list; the loader reads it to build a single
 * `fonts.googleapis.com/css2` URL so only fonts actually in use get fetched.
 *
 * Editor-side only. The live public renderer is not touched here — on-demand
 * loading for published sites is a separate, later step (see report).
 */

import type { Page } from '@/types/website';

export interface FontDef {
  family: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
  weights: number[];
}

/**
 * System / web-safe fonts. These are NOT fetched from Google — they resolve to
 * the user's OS fonts — so they have no Google Fonts URL. Shown as a small group
 * at the top of the picker for an instant, zero-network choice.
 */
export const SYSTEM_FONTS: FontDef[] = [
  { family: 'system-ui', category: 'sans-serif', weights: [400, 500, 600, 700] },
  { family: 'Arial', category: 'sans-serif', weights: [400, 700] },
  { family: 'Helvetica', category: 'sans-serif', weights: [400, 700] },
  { family: 'Verdana', category: 'sans-serif', weights: [400, 700] },
  { family: 'Tahoma', category: 'sans-serif', weights: [400, 700] },
  { family: 'Georgia', category: 'serif', weights: [400, 700] },
  { family: 'Times New Roman', category: 'serif', weights: [400, 700] },
  { family: 'Courier New', category: 'monospace', weights: [400, 700] },
];

/**
 * Curated set of popular Google Fonts spanning every category, each with the
 * weights Google actually serves for that family. ~80 families.
 */
export const GOOGLE_FONTS: FontDef[] = [
  // ---- Sans-serif -------------------------------------------------------
  { family: 'Inter', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Roboto', category: 'sans-serif', weights: [300, 400, 500, 700, 900] },
  { family: 'Open Sans', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Lato', category: 'sans-serif', weights: [300, 400, 700, 900] },
  { family: 'Montserrat', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Poppins', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Raleway', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Source Sans 3', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 900] },
  { family: 'Nunito', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Nunito Sans', category: 'sans-serif', weights: [300, 400, 600, 700, 800] },
  { family: 'Work Sans', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Rubik', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'DM Sans', category: 'sans-serif', weights: [400, 500, 600, 700] },
  { family: 'Space Grotesk', category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Manrope', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Plus Jakarta Sans', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Archivo', category: 'sans-serif', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Figtree', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Outfit', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Sora', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Mulish', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Karla', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Quicksand', category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Josefin Sans', category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Barlow', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Heebo', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'PT Sans', category: 'sans-serif', weights: [400, 700] },
  { family: 'Cabin', category: 'sans-serif', weights: [400, 500, 600, 700] },
  { family: 'Fira Sans', category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Kanit', category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Assistant', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Lexend', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Urbanist', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Be Vietnam Pro', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Epilogue', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Red Hat Display', category: 'sans-serif', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Albert Sans', category: 'sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Titillium Web', category: 'sans-serif', weights: [300, 400, 600, 700] },

  // ---- Serif ------------------------------------------------------------
  { family: 'Playfair Display', category: 'serif', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Merriweather', category: 'serif', weights: [300, 400, 700, 900] },
  { family: 'Lora', category: 'serif', weights: [400, 500, 600, 700] },
  { family: 'Source Serif 4', category: 'serif', weights: [300, 400, 500, 600, 700] },
  { family: 'PT Serif', category: 'serif', weights: [400, 700] },
  { family: 'Libre Baskerville', category: 'serif', weights: [400, 700] },
  { family: 'Cormorant Garamond', category: 'serif', weights: [300, 400, 500, 600, 700] },
  { family: 'EB Garamond', category: 'serif', weights: [400, 500, 600, 700, 800] },
  { family: 'Crimson Text', category: 'serif', weights: [400, 600, 700] },
  { family: 'Bitter', category: 'serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Domine', category: 'serif', weights: [400, 500, 600, 700] },
  { family: 'Roboto Slab', category: 'serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Zilla Slab', category: 'serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Spectral', category: 'serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Noto Serif', category: 'serif', weights: [400, 500, 600, 700] },
  { family: 'Bodoni Moda', category: 'serif', weights: [400, 500, 600, 700, 800, 900] },

  // ---- Display ----------------------------------------------------------
  { family: 'Oswald', category: 'display', weights: [300, 400, 500, 600, 700] },
  { family: 'Bebas Neue', category: 'display', weights: [400] },
  { family: 'Anton', category: 'display', weights: [400] },
  { family: 'Archivo Black', category: 'display', weights: [400] },
  { family: 'Righteous', category: 'display', weights: [400] },
  { family: 'Abril Fatface', category: 'display', weights: [400] },
  { family: 'Comfortaa', category: 'display', weights: [300, 400, 500, 600, 700] },
  { family: 'Lobster', category: 'display', weights: [400] },
  { family: 'Fjalla One', category: 'display', weights: [400] },
  { family: 'Teko', category: 'display', weights: [300, 400, 500, 600, 700] },
  { family: 'Staatliches', category: 'display', weights: [400] },
  { family: 'Alfa Slab One', category: 'display', weights: [400] },
  { family: 'Unbounded', category: 'display', weights: [300, 400, 500, 600, 700, 800] },

  // ---- Handwriting ------------------------------------------------------
  { family: 'Dancing Script', category: 'handwriting', weights: [400, 500, 600, 700] },
  { family: 'Pacifico', category: 'handwriting', weights: [400] },
  { family: 'Caveat', category: 'handwriting', weights: [400, 500, 600, 700] },
  { family: 'Satisfy', category: 'handwriting', weights: [400] },
  { family: 'Great Vibes', category: 'handwriting', weights: [400] },
  { family: 'Shadows Into Light', category: 'handwriting', weights: [400] },
  { family: 'Permanent Marker', category: 'handwriting', weights: [400] },
  { family: 'Kalam', category: 'handwriting', weights: [300, 400, 700] },
  { family: 'Indie Flower', category: 'handwriting', weights: [400] },
  { family: 'Courgette', category: 'handwriting', weights: [400] },

  // ---- Monospace --------------------------------------------------------
  { family: 'JetBrains Mono', category: 'monospace', weights: [400, 500, 600, 700, 800] },
  { family: 'Fira Code', category: 'monospace', weights: [300, 400, 500, 600, 700] },
  { family: 'Source Code Pro', category: 'monospace', weights: [300, 400, 500, 600, 700, 900] },
  { family: 'IBM Plex Mono', category: 'monospace', weights: [300, 400, 500, 600, 700] },
  { family: 'Space Mono', category: 'monospace', weights: [400, 700] },
  { family: 'Roboto Mono', category: 'monospace', weights: [300, 400, 500, 600, 700] },
  { family: 'Inconsolata', category: 'monospace', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Ubuntu Mono', category: 'monospace', weights: [400, 700] },
];

/** Every font the picker can offer (system group first, then Google fonts). */
export const ALL_FONTS: FontDef[] = [...SYSTEM_FONTS, ...GOOGLE_FONTS];

// ---------------------------------------------------------------------------
// Lookup maps (built once)
// ---------------------------------------------------------------------------

const GOOGLE_FONT_MAP: Map<string, FontDef> = new Map(
  GOOGLE_FONTS.map((f) => [f.family.toLowerCase(), f]),
);

const CATALOG_MAP: Map<string, FontDef> = new Map(
  ALL_FONTS.map((f) => [f.family.toLowerCase(), f]),
);

/** CSS generic-family fallback appended after a chosen font. */
export function categoryFallback(category: FontDef['category']): string {
  switch (category) {
    case 'serif':
      return 'serif';
    case 'monospace':
      return 'monospace';
    case 'handwriting':
      return 'cursive';
    case 'display':
    case 'sans-serif':
    default:
      return 'sans-serif';
  }
}

/** Build a ready-to-use CSS `font-family` stack for a catalog family. */
export function fontFamilyStack(family: string): string {
  const def = getFont(family);
  const fallback = def ? categoryFallback(def.category) : 'sans-serif';
  const needsQuotes = /\s/.test(family);
  const head = needsQuotes ? `'${family}'` : family;
  return `${head}, ${fallback}`;
}

/** Look up a font (system or Google) by family name, case-insensitively. */
export function getFont(family: string): FontDef | undefined {
  return CATALOG_MAP.get(family.toLowerCase());
}

/** True when the family is one we can fetch from Google Fonts. */
export function isGoogleFont(family: string): boolean {
  return GOOGLE_FONT_MAP.has(family.toLowerCase());
}

/**
 * Resolve a raw CSS `font-family` value (which may be a stack like
 * `"Inter, system-ui, sans-serif"`) to its catalog family name, or undefined.
 */
export function matchCatalogFamily(fontFamily?: string): string | undefined {
  if (fontFamily === undefined || fontFamily === '') {
    return undefined;
  }
  const firstToken = (fontFamily.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '');
  return CATALOG_MAP.get(firstToken.toLowerCase())?.family;
}

/**
 * Walk a page (section → column → widget, including responsive overrides) and
 * collect the distinct catalog font families actually used. Used by the editor
 * to load only the fonts on the page rather than the whole catalog.
 */
export function collectUsedFonts(page: Page): string[] {
  const found = new Set<string>();
  const consider = (fontFamily?: string): void => {
    const match = matchCatalogFamily(fontFamily);
    if (match !== undefined) {
      found.add(match);
    }
  };

  for (const section of page.content ?? []) {
    for (const column of section.columns ?? []) {
      for (const widget of column.widgets ?? []) {
        consider(widget.style?.fontFamily);
        consider(widget.responsive?.mobile?.fontFamily);
        consider(widget.responsive?.tablet?.fontFamily);
      }
    }
  }

  return Array.from(found);
}

/**
 * Build a single `fonts.googleapis.com/css2` stylesheet URL for the given
 * families (with optional explicit weights). System / unknown families are
 * skipped. Returns null when nothing is Google-loadable.
 */
export function googleFontsHref(
  families: { family: string; weights?: number[] }[],
): string | null {
  const seen = new Set<string>();
  const params: string[] = [];

  for (const req of families) {
    const def = GOOGLE_FONT_MAP.get(req.family.toLowerCase());
    if (def === undefined || seen.has(def.family)) {
      continue;
    }
    seen.add(def.family);

    const requested =
      req.weights !== undefined && req.weights.length > 0
        ? req.weights.filter((w) => def.weights.includes(w))
        : def.weights;
    const weights = requested.length > 0 ? requested : def.weights;
    const uniqueSorted = Array.from(new Set(weights)).sort((a, b) => a - b);

    const encodedName = def.family.replace(/ /g, '+');
    params.push(`family=${encodedName}:wght@${uniqueSorted.join(';')}`);
  }

  if (params.length === 0) {
    return null;
  }
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}
