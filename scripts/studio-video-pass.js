/**
 * Tokenize the remaining video-hub files (the OLD AI Video Studio shell that
 * sits above StudioModePanel — separate from the Magic Studio I already
 * tokenized). Same mapping rules as the prior 3 passes.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'src/app/(dashboard)/content/video/page.tsx',
  'src/app/(dashboard)/content/video/components/VideoPipelineStepper.tsx',
];

const REPLACEMENTS = [
  // Backgrounds
  [/\bbg-zinc-950\/95\b/g, 'bg-background/95'],
  [/\bbg-zinc-950\b/g, 'bg-background'],
  [/\bbg-zinc-900\/50\b/g, 'bg-card/50'],
  [/\bbg-zinc-900\b/g, 'bg-card'],
  [/\bbg-zinc-800\/50\b/g, 'bg-surface-elevated/50'],
  [/\bbg-zinc-800\b/g, 'bg-surface-elevated'],
  [/\bhover:bg-zinc-800\/50\b/g, 'hover:bg-surface-elevated/50'],

  // Borders
  [/\bborder-zinc-800\b/g, 'border-border-strong'],
  [/\bborder-zinc-700\b/g, 'border-border-strong'],
  [/\bborder-zinc-600\b/g, 'border-border'],

  // Text
  [/\btext-zinc-300\b/g, 'text-foreground'],
  [/\btext-zinc-400\b/g, 'text-muted-foreground'],
  [/\btext-zinc-500\b/g, 'text-muted-foreground'],
  [/\btext-zinc-600\b/g, 'text-muted-foreground'],
  [/\bhover:text-zinc-300\b/g, 'hover:text-foreground'],

  // Amber → primary
  [/\bbg-amber-600 hover:bg-amber-500 text-black\b/g, 'bg-primary hover:bg-primary-dark text-primary-foreground'],
  [/\bbg-amber-600\b/g, 'bg-primary'],
  [/\bbg-amber-500\/50\b/g, 'bg-primary/50'],
  [/\bbg-amber-500\/10\b/g, 'bg-primary/10'],
  [/\bbg-amber-500\b/g, 'bg-primary'],
  [/\bhover:bg-amber-500\b/g, 'hover:bg-primary-dark'],
  [/\bborder-amber-500\/50\b/g, 'border-primary/50'],
  [/\bborder-amber-500\b/g, 'border-primary'],
  [/\bhover:border-amber-500\/50\b/g, 'hover:border-primary/50'],
  [/\btext-amber-300\b/g, 'text-primary-light'],
  [/\btext-amber-400\b/g, 'text-primary-light'],
  [/\bhover:text-amber-400\b/g, 'hover:text-primary-light'],
  [/\btext-amber-500\b/g, 'text-primary'],
];

let total = 0;
for (const rel of FILES) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) {
    console.log(`  (skip — not found) ${rel}`);
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
  } else {
    console.log(`  ${rel}: 0 replacements`);
  }
}
console.log(`\nTotal: ${total} replacements`);
