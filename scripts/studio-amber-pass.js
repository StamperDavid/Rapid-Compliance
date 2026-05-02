/**
 * Convert amber-* (the studio's separate accent system) to primary-* tokens so
 * Studio CTAs match the rest of the dashboard.
 *
 * Mapping logic:
 *   bg-amber-600 / bg-amber-500           → bg-primary (solid CTA)
 *   hover:bg-amber-500 / hover:bg-amber-400 → hover:bg-primary-dark
 *   text-amber-400 / text-amber-300 / text-amber-500 → text-primary
 *   border-amber-500 / border-amber-400   → border-primary
 *   ring-amber-500                         → ring-primary
 *   bg-amber-500/X (with opacity)         → bg-primary/X
 *   text-amber-500/X                       → text-primary/X
 *   hover:text-amber-300                   → hover:text-primary-light
 *   text-black (paired with bg-amber)     → text-primary-foreground
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'src/app/(dashboard)/content/video/components/StudioModePanel.tsx',
  'src/components/studio/CharacterLibraryModal.tsx',
  'src/components/studio/CinematicControlsPanel.tsx',
  'src/components/studio/PresetLibraryModal.tsx',
  'src/components/studio/SimpleStylePicker.tsx',
];

// Order matters — most specific first.
const REPLACEMENTS = [
  // Solid CTA buttons: amber-600 + amber-500 hover + black text → primary
  [/\bbg-amber-600 hover:bg-amber-500 text-black\b/g, 'bg-primary hover:bg-primary-dark text-primary-foreground'],
  [/\bbg-amber-600\b/g, 'bg-primary'],
  [/\bbg-amber-500\b/g, 'bg-primary'],
  [/\bhover:bg-amber-500\b/g, 'hover:bg-primary-dark'],
  [/\bhover:bg-amber-400\b/g, 'hover:bg-primary-dark'],

  // Opacity variants
  [/\bbg-amber-600\/20\b/g, 'bg-primary/20'],
  [/\bbg-amber-500\/20\b/g, 'bg-primary/20'],
  [/\bbg-amber-500\/10\b/g, 'bg-primary/10'],
  [/\bbg-amber-500\/5\b/g, 'bg-primary/5'],
  [/\bhover:bg-amber-500\/10\b/g, 'hover:bg-primary/10'],

  // Borders
  [/\bborder-amber-500\/40\b/g, 'border-primary/40'],
  [/\bborder-amber-500\/30\b/g, 'border-primary/30'],
  [/\bborder-amber-500\b/g, 'border-primary'],

  // Rings
  [/\bring-amber-500\/50\b/g, 'ring-primary/50'],
  [/\bring-amber-500\/30\b/g, 'ring-primary/30'],
  [/\bring-amber-500\b/g, 'ring-primary'],
  [/\bhover:ring-amber-500\/50\b/g, 'hover:ring-primary/50'],

  // Text — saturated amber → primary-light, muted → primary
  [/\btext-amber-300\b/g, 'text-primary-light'],
  [/\btext-amber-400\b/g, 'text-primary-light'],
  [/\btext-amber-500\/80\b/g, 'text-primary/80'],
  [/\btext-amber-500\/60\b/g, 'text-primary/60'],
  [/\btext-amber-500\b/g, 'text-primary'],
  [/\bhover:text-amber-300\b/g, 'hover:text-primary'],
];

let total = 0;
for (const rel of FILES) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) {
    continue;
  }
  let src = fs.readFileSync(fp, 'utf8');
  let count = 0;
  for (const [re, rep] of REPLACEMENTS) {
    const before = src;
    src = src.replace(re, rep);
    if (src !== before) {
      const matches = before.match(re);
      count += matches ? matches.length : 0;
    }
  }
  if (count > 0) {
    fs.writeFileSync(fp, src, 'utf8');
    console.log(`  ${rel}: ${count} replacements`);
    total += count;
  }
}
console.log(`\nTotal: ${total} replacements across ${FILES.length} files`);
