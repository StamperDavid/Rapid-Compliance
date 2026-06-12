/**
 * Proof: general background removal (Fal BiRefNet) on a real NON-white-background
 * image from the library. Confirms the cutout path works on any background, not just
 * solid white. Writes public/cutout-test.png (view at /cutout-test.png).
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { listAssets } from '@/lib/media/media-library-service';
import { isSolidWhiteBackground } from '@/lib/media/background-removal';
import { removeBackgroundWithFal } from '@/lib/ai/providers/fal-provider';

async function main(): Promise<void> {
  const { assets } = await listAssets({ limit: 100 });
  const images = assets.filter((a) => a.type === 'image' && a.url);
  console.log(`image assets: ${images.length}`);

  let target: (typeof images)[number] | null = null;
  for (const a of images) {
    try {
      const buf = Buffer.from(await (await fetch(a.url)).arrayBuffer());
      const solid = await isSolidWhiteBackground(buf);
      console.log(`  ${solid ? 'solid-white' : 'COLORED   '} | ${a.name}`);
      if (!solid && !target) { target = a; }
    } catch { /* skip unreadable */ }
  }
  if (!target) { console.log('No non-white image found to test BiRefNet.'); return; }

  console.log(`\nRunning BiRefNet cutout on: ${target.name}`);
  const out = await removeBackgroundWithFal(target.url);
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) { if (data[i] === 0) { transparent += 1; } }
  const total = info.width * info.height;
  console.log(`Cutout: ${info.width}x${info.height}, transparent ${((transparent / total) * 100).toFixed(1)}%`);

  await writeFile(path.join(process.cwd(), 'public', 'cutout-test.png'), out);
  console.log('Wrote public/cutout-test.png — view at http://localhost:3000/cutout-test.png');
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error(e); process.exit(1); });
