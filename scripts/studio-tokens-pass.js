/**
 * One-shot find/replace: convert raw Tailwind grayscale color refs in the
 * Magic Studio panel + studio sub-components to design-system tokens, so the
 * Content Generator hub matches the rest of the dashboard.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'src/app/(dashboard)/content/video/components/StudioModePanel.tsx',
  'src/components/studio/CharacterElementsTool.tsx',
  'src/components/studio/CharacterLibraryModal.tsx',
  'src/components/studio/CinematicControlsPanel.tsx',
  'src/components/studio/ConstructedPromptDisplay.tsx',
  'src/components/studio/GenerateEditToggle.tsx',
  'src/components/studio/PresetLibraryModal.tsx',
  'src/components/studio/RenderQueuePanel.tsx',
  'src/components/studio/SimpleStylePicker.tsx',
  'src/components/studio/VisualPresetPicker.tsx',
];

// Order matters — most specific first.
const REPLACEMENTS = [
  // backgrounds
  [/\bbg-zinc-950\b/g, 'bg-background'],
  [/\bbg-zinc-900\/50\b/g, 'bg-card/50'],
  [/\bbg-zinc-900\/80\b/g, 'bg-card/80'],
  [/\bbg-zinc-900\b/g, 'bg-card'],
  [/\bbg-zinc-800\b/g, 'bg-surface-elevated'],
  [/\bbg-zinc-700\b/g, 'bg-surface-elevated'],
  // borders
  [/\bborder-zinc-800\b/g, 'border-border-strong'],
  [/\bborder-zinc-700\b/g, 'border-border-strong'],
  [/\bborder-zinc-600\b/g, 'border-border'],
  [/\bborder-zinc-500\b/g, 'border-border'],
  [/\bhover:border-zinc-500\b/g, 'hover:border-border-strong'],
  [/\bhover:border-zinc-600\b/g, 'hover:border-border-strong'],
  // text — saturated to muted
  [/\btext-zinc-100\b/g, 'text-foreground'],
  [/\btext-zinc-200\b/g, 'text-foreground'],
  [/\btext-zinc-300\b/g, 'text-foreground'],
  [/\btext-zinc-400\b/g, 'text-muted-foreground'],
  [/\btext-zinc-500\b/g, 'text-muted-foreground'],
  [/\btext-zinc-600\b/g, 'text-muted-foreground'],
  [/\btext-zinc-700\b/g, 'text-muted-foreground'],
  [/\bhover:text-zinc-300\b/g, 'hover:text-foreground'],
  [/\bhover:text-zinc-400\b/g, 'hover:text-foreground'],
];

let total = 0;
for (const rel of FILES) {
  const fp = path.join(ROOT, rel);
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
