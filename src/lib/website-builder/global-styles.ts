/**
 * Global Design System — tokens engine (Elementor "Global Colors/Fonts").
 *
 * The site's brand colours/fonts become CSS custom properties at the page root
 * so widgets can *reference* them (`var(--gc-primary)`, `var(--gf-heading)`).
 * Editing a brand token then updates every widget that references it — "edit
 * once, applies everywhere."
 *
 * UNIFY, don't fork: every token here is DERIVED from the existing
 * `WebsiteTheme` / brand (`useWebsiteTheme`). There is no second brand store.
 * All helpers are pure and immutable.
 */

import type { WebsiteTheme } from '@/hooks/useWebsiteTheme';
import type {
  GlobalColorToken,
  GlobalFontToken,
  GlobalStyleTokens,
} from '@/types/website';

// Re-export the token contracts so consumers can import them from either the
// canonical types module or this engine module.
export type { GlobalColorToken, GlobalFontToken, GlobalStyleTokens };

// ---------------------------------------------------------------------------
// CSS custom-property naming — the single naming convention for the whole app
// ---------------------------------------------------------------------------

const COLOR_PREFIX = '--gc-';
const FONT_PREFIX = '--gf-';

/** The CSS custom-property NAME for a colour token, e.g. `--gc-primary`. */
export function globalColorVar(id: string): string {
  return `${COLOR_PREFIX}${id}`;
}

/** A CSS `var(...)` REFERENCE to a colour token, e.g. `var(--gc-primary)`. */
export function globalColorRef(id: string): string {
  return `var(${globalColorVar(id)})`;
}

/** The CSS custom-property NAME for a font token, e.g. `--gf-heading`. */
export function globalFontVar(id: string): string {
  return `${FONT_PREFIX}${id}`;
}

/** A CSS `var(...)` REFERENCE to a font token, e.g. `var(--gf-heading)`. */
export function globalFontRef(id: string): string {
  return `var(${globalFontVar(id)})`;
}

// Matches `var(--gc-<id>)` / `var(--gf-<id>)`, optionally with a fallback arg,
// tolerant of surrounding whitespace. Capture group 1 is the token id.
const COLOR_REF_RE = /^\s*var\(\s*--gc-([A-Za-z0-9_-]+)\s*(?:,[^)]*)?\)\s*$/;
const FONT_REF_RE = /^\s*var\(\s*--gf-([A-Za-z0-9_-]+)\s*(?:,[^)]*)?\)\s*$/;

/** True when `value` is a reference to a global COLOR token. */
export function isGlobalColorRef(value: string | undefined): boolean {
  return value !== undefined && COLOR_REF_RE.test(value);
}

/** True when `value` is a reference to a global FONT token. */
export function isGlobalFontRef(value: string | undefined): boolean {
  return value !== undefined && FONT_REF_RE.test(value);
}

/**
 * Extract the token `<id>` from a `var(--gc-<id>)` / `var(--gf-<id>)` reference
 * (also accepts a raw `--gc-<id>` / `--gf-<id>` var name). Returns `null` when
 * the value is not a recognisable global-token reference.
 */
export function refTokenId(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const colorRef = COLOR_REF_RE.exec(value);
  if (colorRef) {
    return colorRef[1];
  }
  const fontRef = FONT_REF_RE.exec(value);
  if (fontRef) {
    return fontRef[1];
  }
  // Bare custom-property name, e.g. `--gc-primary` or `--gf-heading`.
  const bare = /^\s*--g[cf]-([A-Za-z0-9_-]+)\s*$/.exec(value);
  return bare ? bare[1] : null;
}

// ---------------------------------------------------------------------------
// Seeding tokens from the brand/theme
// ---------------------------------------------------------------------------

/**
 * Strip a font-family stack down to its clean primary family:
 * `"Poppins, sans-serif"` → `"Poppins"`, `'"Times New Roman", serif'` → the
 * unquoted first family. Falls back to the trimmed input when there is nothing
 * to strip. Pure — never mutates its argument.
 */
function cleanFontFamily(family: string): string {
  const first = family.split(',')[0]?.trim() ?? family.trim();
  // Drop matching surrounding quotes a stack may carry, e.g. `"Times New Roman"`.
  return first.replace(/^['"]/, '').replace(/['"]$/, '').trim();
}

/** True when the string is a usable, non-empty colour value. */
function usableColor(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Seed the token set from the current brand/theme — the DEFAULT global palette.
 *
 * Colours: primary, secondary, accent, text, background, plus nav/footer when
 * the theme carries usable values. Fonts: heading (from `theme.headingFont`)
 * and body (from `theme.fontFamily`), each cleaned of its `, sans-serif` tail.
 */
export function themeToTokens(theme: WebsiteTheme): GlobalStyleTokens {
  const colorSeeds: Array<{ id: string; name: string; value: string | undefined }> = [
    { id: 'primary', name: 'Primary', value: theme.primaryColor },
    { id: 'secondary', name: 'Secondary', value: theme.secondaryColor },
    { id: 'accent', name: 'Accent', value: theme.accentColor },
    { id: 'text', name: 'Text', value: theme.textColor },
    { id: 'background', name: 'Background', value: theme.backgroundColor },
    { id: 'nav', name: 'Navigation', value: theme.navBackground },
    { id: 'footer', name: 'Footer', value: theme.footerBackground },
  ];

  const colors: GlobalColorToken[] = colorSeeds
    .filter((seed) => usableColor(seed.value))
    .map((seed) => ({ id: seed.id, name: seed.name, value: (seed.value as string).trim() }));

  const fonts: GlobalFontToken[] = [
    { id: 'heading', name: 'Heading', family: cleanFontFamily(theme.headingFont) },
    { id: 'body', name: 'Body', family: cleanFontFamily(theme.fontFamily) },
  ];

  return { colors, fonts };
}

// ---------------------------------------------------------------------------
// Emitting CSS custom properties
// ---------------------------------------------------------------------------

/**
 * The CSS custom properties to emit at the page root for a token set, e.g.
 * `{ '--gc-primary': '#6366f1', '--gf-heading': 'Poppins', ... }`. The result
 * is a fresh object (never a shared reference) so callers may spread it safely.
 */
export function tokensToCssVars(tokens: GlobalStyleTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const color of tokens.colors) {
    vars[globalColorVar(color.id)] = color.value;
  }
  for (const font of tokens.fonts) {
    vars[globalFontVar(font.id)] = font.family;
  }
  return vars;
}
