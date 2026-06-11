/**
 * Proof: deterministic background removal on the real brand logo.
 * Reads public/logo.png, strips the white background, writes a transparent PNG to
 * public/logo-transparent.png (viewable at http://localhost:3000/logo-transparent.png).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { removeWhiteBackground } from '@/lib/media/background-removal';

async function main(): Promise<void> {
  const src = path.join(process.cwd(), 'public', 'logo.png');
  const input = await readFile(src);

  const before = await sharp(input).metadata();
  console.log(`Source: ${src} — ${before.width}x${before.height}, channels=${before.channels}, hasAlpha=${before.hasAlpha}`);

  const out = await removeWhiteBackground(input);

  const after = await sharp(out).metadata();
  // Count transparent pixels to confirm the background was actually punched out.
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) { transparent += 1; }
  }
  const total = info.width * info.height;
  console.log(`Result: ${after.width}x${after.height}, hasAlpha=${after.hasAlpha}`);
  console.log(`Transparent pixels: ${transparent}/${total} (${((transparent / total) * 100).toFixed(1)}%)`);

  const dest = path.join(process.cwd(), 'public', 'logo-transparent.png');
  await writeFile(dest, out);
  console.log(`Wrote ${dest}`);
  console.log('View at: http://localhost:3000/logo-transparent.png');
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error(e); process.exit(1); });
