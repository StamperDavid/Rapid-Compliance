/**
 * Convert raw Tailwind indigo-* refs (which happen to look like the dashboard's
 * primary indigo but bypass the token system) into bg-primary / text-primary /
 * border-primary so future theme changes propagate.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'src/app/(dashboard)/content/video/components/StudioModePanel.tsx',
  'src/components/studio/CharacterElementsTool.tsx',
  'src/components/studio/CinematicControlsPanel.tsx',
  'src/components/studio/GenerateEditToggle.tsx',
  'src/components/studio/VisualPresetPicker.tsx',
];

const REPLACEMENTS = [
  // backgrounds
  [/\bbg-indigo-500\/20\b/g, 'bg-primary/20'],
  [/\bbg-indigo-500\/10\b/g, 'bg-primary/10'],
  [/\bbg-indigo-500\b/g, 'bg-primary'],

  // borders
  [/\bborder-indigo-500\/40\b/g, 'border-primary/40'],
  [/\bborder-indigo-500\b/g, 'border-primary'],

  // rings
  [/\bring-indigo-500\/50\b/g, 'ring-primary/50'],
  [/\bring-indigo-500\b/g, 'ring-primary'],

  // text
  [/\btext-indigo-300\b/g, 'text-primary-light'],
  [/\btext-indigo-400\b/g, 'text-primary-light'],

  // form accent
  [/\baccent-indigo-500\b/g, 'accent-primary'],
];

let total = 0;
for (const rel of FILES) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) continue;
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
