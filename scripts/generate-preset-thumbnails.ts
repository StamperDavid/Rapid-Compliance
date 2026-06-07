/**
 * Generate cinematic preset example images — ONE TIME.
 *
 * For every preset in the visual categories, render a single representative
 * example image via Hedra, persist it to Firebase Storage, and write the
 * {presetId: url} map to src/lib/ai/cinematic-preset-thumbnails.generated.ts so
 * the preset pickers show visuals instead of initials.
 *
 * Idempotent / resumable: presets that already have a URL in the generated map
 * are skipped, so you can re-run after a crash or rate-limit without paying for
 * images twice.
 *
 * Usage:
 *   npx tsx scripts/generate-preset-thumbnails.ts
 *   npx tsx scripts/generate-preset-thumbnails.ts --category=photographerStyle
 *   npx tsx scripts/generate-preset-thumbnails.ts --limit=5      # smoke test
 *   npx tsx scripts/generate-preset-thumbnails.ts --force        # regenerate all
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env BEFORE any app module (admin.ts reads env at import time).
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OUT_PATH = path.resolve(process.cwd(), 'src/lib/ai/cinematic-preset-thumbnails.generated.ts');

// Categories to generate examples for (owner's list).
const CATEGORIES = [
  'shotType',
  'lighting',
  'camera',
  'focalLength',
  'lensType',
  'filmStock',
  'artStyle',
  'photographerStyle',
  'videographerStyle',
  'movieLook',
  'filter',
  'composition',
] as const;

const CONCURRENCY = 5;

interface PresetLike {
  id: string;
  name: string;
  category: string;
  promptFragment: string;
}

function buildPrompt(preset: PresetLike): string {
  const frag = preset.promptFragment;
  switch (preset.category) {
    case 'photographerStyle':
      return `A striking professional photograph in the style of ${preset.name}: ${frag}. A single clear human subject, magazine quality.`;
    case 'videographerStyle':
      return `A cinematic film still — ${frag}. A single clear subject, atmospheric, professional.`;
    case 'movieLook':
      return `A cinematic film still with the look and color grade of ${preset.name}: ${frag}. A single clear subject, atmospheric.`;
    case 'lighting':
      return `A portrait of a person demonstrating ${preset.name}: ${frag}. Clean and professional.`;
    case 'shotType':
      return `A ${preset.name} of a person in a modern setting: ${frag}.`;
    case 'camera':
      return `A professional photograph with the look of footage shot on a ${preset.name}: ${frag}. A single clear subject.`;
    case 'focalLength':
      return `A photograph of a person shot at ${preset.name}: ${frag}.`;
    case 'lensType':
      return `A photograph demonstrating a ${preset.name}: ${frag}.`;
    case 'filmStock':
      return `A photograph with the look of ${preset.name} film stock: ${frag}.`;
    case 'filter':
      return `A photograph with a ${preset.name} effect: ${frag}.`;
    case 'artStyle':
      return `An image rendered in ${preset.name} art style: ${frag}.`;
    case 'composition':
      return `A photograph using ${preset.name}: ${frag}.`;
    default:
      return `${preset.name}: ${frag}.`;
  }
}

function writeMap(map: Record<string, string>): void {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(map).sort()) {
    sorted[key] = map[key];
  }
  const header = `/**\n * AUTO-GENERATED — do not edit by hand.\n *\n * Maps cinematic preset id -> a permanent example-image URL (Firebase Storage),\n * generated ONCE by scripts/generate-preset-thumbnails.ts and reused forever so\n * the preset pickers show visual examples instead of initials.\n *\n * Re-run: npx tsx scripts/generate-preset-thumbnails.ts\n */\n\n`;
  fs.writeFileSync(OUT_PATH, `${header}export const PRESET_THUMBNAILS: Record<string, string> = ${JSON.stringify(sorted, null, 2)};\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const categoryArg = args.find((a) => a.startsWith('--category='))?.split('=')[1];
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? Number(limitArg) : Infinity;

  // Dynamic imports AFTER dotenv so app modules see the env.
  const { getPresetsByCategory } = await import('@/lib/ai/cinematic-presets');
  const { generateHedraImage } = await import('@/lib/video/hedra-service');
  const { persistUrlToStorage } = await import('@/lib/firebase/storage-utils');
  const { PLATFORM_ID } = await import('@/lib/constants/platform');
  const existing = await import('@/lib/ai/cinematic-preset-thumbnails.generated');

  const map: Record<string, string> = force ? {} : { ...existing.PRESET_THUMBNAILS };

  const categories = categoryArg ? [categoryArg] : [...CATEGORIES];
  const todo: PresetLike[] = [];
  for (const category of categories) {
    const presets = getPresetsByCategory(category as Parameters<typeof getPresetsByCategory>[0]) as PresetLike[];
    for (const preset of presets) {
      if (!force && map[preset.id]) {
        continue;
      }
      todo.push(preset);
    }
  }
  const work = todo.slice(0, limit);

  console.log(`Preset thumbnail generation: ${work.length} to generate (${Object.keys(map).length} already done), concurrency ${CONCURRENCY}`);

  let done = 0;
  let failed = 0;
  let cursor = 0;

  async function worker(workerId: number): Promise<void> {
    while (cursor < work.length) {
      const index = cursor;
      cursor += 1;
      const preset = work[index];
      try {
        const gen = await generateHedraImage(buildPrompt(preset), { aspectRatio: '1:1', resolution: '720p' });
        const permanentUrl = await persistUrlToStorage(
          gen.url,
          `organizations/${PLATFORM_ID}/preset-thumbnails/${preset.id}.png`,
          'image/png',
        );
        map[preset.id] = permanentUrl;
        done += 1;
        if (done % 5 === 0) {
          writeMap(map);
        }
        console.log(`  [${done + failed}/${work.length}] ✓ ${preset.category}/${preset.id} (w${workerId})`);
      } catch (err) {
        failed += 1;
        console.warn(`  [${done + failed}/${work.length}] ✗ ${preset.category}/${preset.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  writeMap(map);
  console.log(`\nDone. Generated ${done}, failed ${failed}, total in map ${Object.keys(map).length}.`);
  console.log(`Wrote ${OUT_PATH}`);
  process.exit(failed > 0 && done === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Preset thumbnail generation failed:', err);
  process.exit(1);
});
