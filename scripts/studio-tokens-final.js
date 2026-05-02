/**
 * Comprehensive token sweep across all remaining content/video + voice-lab
 * components. Same mapping as prior passes — design tokens only, no
 * hardcoded colors.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
// Walk content/, studio/, video/ component dirs and collect any .tsx with off-system colors
const COLOR_RE = /(amber|zinc|indigo|pink|red|purple|violet|fuchsia|rose|orange|yellow|emerald|teal|sky|cyan|lime)-\d/;
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      const src = fs.readFileSync(full, 'utf8');
      if (COLOR_RE.test(src)) out.push(path.relative(ROOT, full).replace(/\\/g, '/'));
    }
  }
  return out;
}
const FILES = [
  ...walk(path.join(ROOT, 'src/app/(dashboard)/content')),
  ...walk(path.join(ROOT, 'src/components/studio')),
  ...walk(path.join(ROOT, 'src/components/video')),
];

const REPLACEMENTS = [
  // ── Backgrounds ─────────────────────────────────────────────
  [/\bbg-zinc-950\/95\b/g, 'bg-background/95'],
  [/\bbg-zinc-950\b/g, 'bg-background'],
  [/\bbg-zinc-900\/80\b/g, 'bg-card/80'],
  [/\bbg-zinc-900\/50\b/g, 'bg-card/50'],
  [/\bbg-zinc-900\/30\b/g, 'bg-card/30'],
  [/\bbg-zinc-900\b/g, 'bg-card'],
  [/\bbg-zinc-800\/50\b/g, 'bg-surface-elevated/50'],
  [/\bbg-zinc-800\/30\b/g, 'bg-surface-elevated/30'],
  [/\bbg-zinc-800\b/g, 'bg-surface-elevated'],
  [/\bbg-zinc-700\b/g, 'bg-border-strong'],
  [/\bhover:bg-zinc-800\/50\b/g, 'hover:bg-surface-elevated/50'],
  [/\bhover:bg-zinc-800\b/g, 'hover:bg-surface-elevated'],
  [/\bhover:bg-zinc-700\b/g, 'hover:bg-border-strong'],

  // ── Borders ─────────────────────────────────────────────────
  [/\bborder-zinc-800\b/g, 'border-border-strong'],
  [/\bborder-zinc-700\b/g, 'border-border-strong'],
  [/\bborder-zinc-600\b/g, 'border-border'],
  [/\bborder-zinc-500\b/g, 'border-border'],
  [/\bhover:border-zinc-500\b/g, 'hover:border-border-strong'],
  [/\bhover:border-zinc-600\b/g, 'hover:border-border-strong'],

  // ── Text — saturated → foreground, muted → muted-foreground ─
  [/\btext-zinc-100\b/g, 'text-foreground'],
  [/\btext-zinc-200\b/g, 'text-foreground'],
  [/\btext-zinc-300\b/g, 'text-foreground'],
  [/\btext-zinc-400\b/g, 'text-muted-foreground'],
  [/\btext-zinc-500\b/g, 'text-muted-foreground'],
  [/\btext-zinc-600\b/g, 'text-muted-foreground'],
  [/\btext-zinc-700\b/g, 'text-muted-foreground'],
  [/\bhover:text-zinc-300\b/g, 'hover:text-foreground'],
  [/\bhover:text-zinc-400\b/g, 'hover:text-foreground'],

  // ── Amber (the studio's separate accent) → primary ──────────
  [/\bbg-amber-600 hover:bg-amber-500 text-black\b/g, 'bg-primary hover:bg-primary-dark text-primary-foreground'],
  [/\bbg-amber-600\b/g, 'bg-primary'],
  [/\bbg-amber-500\/50\b/g, 'bg-primary/50'],
  [/\bbg-amber-500\/30\b/g, 'bg-primary/30'],
  [/\bbg-amber-500\/20\b/g, 'bg-primary/20'],
  [/\bbg-amber-500\/10\b/g, 'bg-primary/10'],
  [/\bbg-amber-500\/5\b/g, 'bg-primary/5'],
  [/\bbg-amber-500\b/g, 'bg-primary'],
  [/\bhover:bg-amber-600\b/g, 'hover:bg-primary-dark'],
  [/\bhover:bg-amber-500\/10\b/g, 'hover:bg-primary/10'],
  [/\bhover:bg-amber-500\b/g, 'hover:bg-primary-dark'],
  [/\bborder-amber-500\/50\b/g, 'border-primary/50'],
  [/\bborder-amber-500\/40\b/g, 'border-primary/40'],
  [/\bborder-amber-500\/30\b/g, 'border-primary/30'],
  [/\bborder-amber-500\b/g, 'border-primary'],
  [/\bhover:border-amber-500\/50\b/g, 'hover:border-primary/50'],
  [/\bhover:border-amber-500\b/g, 'hover:border-primary'],
  [/\bring-amber-500\/50\b/g, 'ring-primary/50'],
  [/\bring-amber-500\/30\b/g, 'ring-primary/30'],
  [/\bring-amber-500\b/g, 'ring-primary'],
  [/\bhover:ring-amber-500\/50\b/g, 'hover:ring-primary/50'],
  [/\btext-amber-300\b/g, 'text-primary-light'],
  [/\btext-amber-400\b/g, 'text-primary-light'],
  [/\btext-amber-500\/80\b/g, 'text-primary/80'],
  [/\btext-amber-500\/60\b/g, 'text-primary/60'],
  [/\btext-amber-500\b/g, 'text-primary'],
  [/\bhover:text-amber-400\b/g, 'hover:text-primary-light'],
  [/\bhover:text-amber-300\b/g, 'hover:text-primary'],
  [/\bborder-t-amber-400\b/g, 'border-t-primary-light'],

  // ── Raw indigo → primary ────────────────────────────────────
  [/\bbg-indigo-500\/20\b/g, 'bg-primary/20'],
  [/\bbg-indigo-500\/10\b/g, 'bg-primary/10'],
  [/\bbg-indigo-500\b/g, 'bg-primary'],
  [/\bborder-indigo-500\/40\b/g, 'border-primary/40'],
  [/\bborder-indigo-500\b/g, 'border-primary'],
  [/\bring-indigo-500\/50\b/g, 'ring-primary/50'],
  [/\bring-indigo-500\b/g, 'ring-primary'],
  [/\btext-indigo-300\b/g, 'text-primary-light'],
  [/\btext-indigo-400\b/g, 'text-primary-light'],
  [/\baccent-indigo-500\b/g, 'accent-primary'],

  // ── Long-tail variants caught on second sweep ───────────────
  [/\bhover:bg-amber-700\b/g, 'hover:bg-primary-dark'],
  [/\bhover:bg-zinc-600\b/g, 'hover:bg-border-strong'],
  [/\bhover:bg-zinc-200\b/g, 'hover:bg-surface-elevated'],
  [/\bbg-zinc-600\/80\b/g, 'bg-border-strong/80'],
  [/\bbg-zinc-600\b/g, 'bg-border-strong'],
  [/\bbg-zinc-500\/15\b/g, 'bg-surface-elevated/30'],
  [/\bbg-zinc-500\b/g, 'bg-border-strong'],
  [/\bborder-zinc-400\b/g, 'border-border'],
  [/\bring-zinc-700\/50\b/g, 'ring-border-strong/50'],
  [/\bring-zinc-600\b/g, 'ring-border'],
  [/\bto-zinc-900\b/g, 'to-card'],
  [/\bto-indigo-700\b/g, 'to-primary-dark'],
  [/\bto-indigo-600\b/g, 'to-primary-dark'],
  [/\bto-indigo-500\b/g, 'to-primary'],
  [/\bto-amber-600\/10\b/g, 'to-primary/10'],
  [/\bfrom-amber-500\/20\b/g, 'from-primary/20'],
  [/\bfrom-amber-500\b/g, 'from-primary'],
  [/\bborder-amber-400\b/g, 'border-primary-light'],
  [/\baccent-amber-500\b/g, 'accent-primary'],
  [/\bhover:text-amber-200\b/g, 'hover:text-primary-light'],
  [/\bborder-indigo-400\/40\b/g, 'border-primary-light/40'],
  [/\bbg-indigo-700\/50\b/g, 'bg-primary-dark/50'],
  [/\bbg-amber-700\/60\b/g, 'bg-primary-dark/60'],

  // ── Pink/Purple/Violet/Fuchsia → primary (these were audio-lab "AI Music" themes) ─
  [/\bbg-pink-500\/15\b/g, 'bg-primary/15'],
  [/\bbg-pink-500\/20\b/g, 'bg-primary/20'],
  [/\bbg-pink-500\b/g, 'bg-primary'],
  [/\bborder-pink-500\/40\b/g, 'border-primary/40'],
  [/\bborder-pink-500\/30\b/g, 'border-primary/30'],
  [/\bborder-pink-500\b/g, 'border-primary'],
  [/\bring-pink-500\/50\b/g, 'ring-primary/50'],
  [/\btext-pink-300\b/g, 'text-primary-light'],
  [/\btext-pink-400\b/g, 'text-primary-light'],
  [/\bfrom-pink-500\b/g, 'from-primary'],
  [/\bfrom-pink-600\b/g, 'from-primary-dark'],
  [/\bfrom-pink-700\b/g, 'from-primary-dark'],

  [/\bbg-purple-500\/20\b/g, 'bg-primary/20'],
  [/\bbg-purple-500\/15\b/g, 'bg-primary/15'],
  [/\bbg-purple-500\/10\b/g, 'bg-primary/10'],
  [/\bbg-purple-500\b/g, 'bg-primary'],
  [/\bbg-purple-600\b/g, 'bg-primary-dark'],
  [/\bhover:bg-purple-700\b/g, 'hover:bg-primary-dark'],
  [/\bborder-purple-500\/50\b/g, 'border-primary/50'],
  [/\bborder-purple-500\/40\b/g, 'border-primary/40'],
  [/\bborder-purple-500\/30\b/g, 'border-primary/30'],
  [/\bborder-purple-500\b/g, 'border-primary'],
  [/\bring-purple-500\/50\b/g, 'ring-primary/50'],
  [/\btext-purple-300\b/g, 'text-primary-light'],
  [/\btext-purple-400\b/g, 'text-primary-light'],
  [/\bto-purple-600\b/g, 'to-primary-dark'],
  [/\bto-purple-700\b/g, 'to-primary-dark'],

  [/\bfrom-violet-500\b/g, 'from-primary'],
  [/\bbg-violet-500\b/g, 'bg-primary'],
  [/\btext-violet-400\b/g, 'text-primary-light'],

  [/\bbg-fuchsia-500\b/g, 'bg-primary'],
  [/\btext-fuchsia-400\b/g, 'text-primary-light'],

  // ── Red → destructive (use the design token, not raw red) ─────
  [/\bbg-red-500\/10\b/g, 'bg-destructive/10'],
  [/\bbg-red-500\/20\b/g, 'bg-destructive/20'],
  [/\bbg-red-500\b/g, 'bg-destructive'],
  [/\bbg-red-600\b/g, 'bg-destructive'],
  [/\bhover:bg-red-700\b/g, 'hover:bg-destructive/90'],
  [/\bhover:bg-red-600\b/g, 'hover:bg-destructive/90'],
  [/\bborder-red-500\/20\b/g, 'border-destructive/20'],
  [/\bborder-red-500\/30\b/g, 'border-destructive/30'],
  [/\bborder-red-500\/40\b/g, 'border-destructive/40'],
  [/\bborder-red-500\b/g, 'border-destructive'],
  [/\btext-red-300\b/g, 'text-destructive'],
  [/\btext-red-400\b/g, 'text-destructive'],
  [/\btext-red-500\b/g, 'text-destructive'],
  [/\bhover:text-red-400\b/g, 'hover:text-destructive'],
  [/\bhover:text-red-300\b/g, 'hover:text-destructive'],

  // ── Yellow / Orange → warning-ish (no warning token used in this file set; map to muted accent) ─
  [/\btext-yellow-400\b/g, 'text-primary-light'],
  [/\btext-yellow-500\b/g, 'text-primary'],
  [/\bbg-yellow-500\/10\b/g, 'bg-primary/10'],
  [/\btext-orange-400\b/g, 'text-primary-light'],
  [/\bbg-orange-500\/10\b/g, 'bg-primary/10'],

  // ── Emerald / Teal / Sky / Cyan → success/info → map to primary-light to keep accent visible ─
  [/\btext-emerald-400\b/g, 'text-primary-light'],
  [/\bbg-emerald-500\/10\b/g, 'bg-primary/10'],
  [/\btext-teal-400\b/g, 'text-primary-light'],
  [/\btext-sky-400\b/g, 'text-primary-light'],
  [/\btext-cyan-400\b/g, 'text-primary-light'],

  // ── Catch-all sweep: ANY remaining variant of these color families ────
  // Applied AFTER specific rules so most-specific wins, then everything else
  // converges to the design tokens. Use `g` flag, dynamic build below.
];

// Family → semantic token map. Each family also maps to the right "shade tier"
// based on numeric shade so accents stay legible.
const FAMILY_MAP = {
  amber: 'primary',
  zinc: 'muted',     // grayscale → muted/foreground/border
  gray: 'muted',
  slate: 'muted',
  neutral: 'muted',
  indigo: 'primary',
  pink: 'primary',
  purple: 'primary',
  violet: 'primary',
  fuchsia: 'primary',
  rose: 'destructive',
  red: 'destructive',
  orange: 'primary',  // orange used as accent in the studio, not warning
  yellow: 'primary',
  emerald: 'primary',
  teal: 'primary',
  sky: 'primary',
  cyan: 'primary',
  lime: 'primary',
};

function catchAllSweep(src) {
  // Replace anything like `bg-pink-300/40` or `text-violet-500` or `from-emerald-700`.
  // Also covers hover:/focus:/group-hover: prefixed variants.
  const re = /\b(hover:|focus:|active:|group-hover:|group-focus:|disabled:)?(bg|text|border|ring|from|to|via|accent|fill|stroke|outline|decoration|shadow|caret)-([a-z]+)-(\d+)(\/\d+)?\b/g;
  return src.replace(re, (match, prefix = '', utility, family, _shade, opacity = '') => {
    const semantic = FAMILY_MAP[family];
    if (!semantic) return match;  // unknown family — leave alone
    // For grayscale families → use muted/foreground/border based on utility
    if (semantic === 'muted') {
      if (utility === 'bg') return `${prefix}bg-surface-elevated${opacity}`;
      if (utility === 'text') return `${prefix}text-muted-foreground${opacity}`;
      if (utility === 'border') return `${prefix}border-border-strong${opacity}`;
      if (utility === 'ring') return `${prefix}ring-border-strong${opacity}`;
      if (utility === 'from' || utility === 'to' || utility === 'via') return `${prefix}${utility}-card${opacity}`;
      return match;
    }
    // For accent families → use the matching token
    return `${prefix}${utility}-${semantic}${opacity}`;
  });
}

// Apply catch-all to every collected file as a final pass
for (const rel of FILES) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) continue;
  const before = fs.readFileSync(fp, 'utf8');
  const after = catchAllSweep(before);
  if (after !== before) {
    fs.writeFileSync(fp, after, 'utf8');
  }
}

console.log('Catch-all sweep complete across', FILES.length, 'files.');
