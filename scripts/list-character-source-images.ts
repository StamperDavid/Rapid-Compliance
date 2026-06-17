/**
 * Discovery only (no generation): list candidate CLEAN character images from
 * brand-assets storage + the media library, so we test with a real Velocity hero
 * portrait instead of a scene thumbnail. Run: npx tsx scripts/list-character-source-images.ts
 */
import { adminStorage } from '../src/lib/firebase/admin';
import { listAssets } from '../src/lib/media/media-library-service';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const IMG = /\.(png|jpg|jpeg|webp)$/i;

async function main(): Promise<void> {
  console.log('=== BRAND-ASSETS storage images ===');
  if (adminStorage) {
    const [files] = await adminStorage.bucket(BUCKET).getFiles({
      prefix: `organizations/${PLATFORM_ID}/brand-assets/`,
    });
    const imgs = files.filter((f) => IMG.test(f.name));
    if (imgs.length === 0) { console.log('  (none)'); }
    for (const f of imgs) {
      console.log(`  - ${f.name.split('/').pop()}  [${f.name}]`);
    }
  } else {
    console.log('  storage unavailable');
  }

  console.log('\n=== MEDIA LIBRARY images matching velocity/hero/character ===');
  const { assets } = await listAssets({ limit: 300 });
  const matches = assets.filter(
    (a) => a.type === 'image' && /velocity|hero|character|avatar/i.test(a.name ?? ''),
  );
  if (matches.length === 0) { console.log('  (none)'); }
  for (const a of matches) {
    console.log(`  - ${a.name}`);
  }
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
