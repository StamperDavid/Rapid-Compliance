/**
 * Read-only inventory of reference images available for the Seedance multi-character
 * test: the Velocity profile's images + any Pipedrive/businessman/villain/hero images
 * in the media library and brand-assets storage. Prints names + URLs so we know exactly
 * what we can feed Seedance. Run: npx tsx scripts/inventory-character-refs.ts
 */
import { adminStorage } from '../src/lib/firebase/admin';
import { getAvatarProfile } from '../src/lib/video/avatar-profile-service';
import { listAssets } from '../src/lib/media/media-library-service';
import { firebaseDownloadUrl } from '../src/lib/firebase/storage-utils';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const VELOCITY_PROFILE = '7c1171f7-d8b1-4dbe-863c-26a485b4f317';
const IMG = /\.(png|jpg|jpeg|webp)$/i;

async function main(): Promise<void> {
  console.log('===== VELOCITY profile images =====');
  const v = await getAvatarProfile(VELOCITY_PROFILE);
  if (!v) {
    console.log('  Velocity profile NOT found');
  } else {
    console.log(`  name: ${v.name}  source: ${v.source}`);
    console.log(`  frontal: ${v.frontalImageUrl ?? '(none)'}`);
    (v.additionalImageUrls ?? []).forEach((u, i) => console.log(`  extra[${i}]: ${u}`));
    (v.looks ?? []).forEach((look) => {
      console.log(`  look "${look.name}": ${(look.imageUrls ?? []).length} image(s)`);
      (look.imageUrls ?? []).forEach((u, i) => console.log(`     look-img[${i}]: ${u}`));
    });
  }

  console.log('\n===== MEDIA LIBRARY images (velocity/hero/pipedrive/businessman/villain) =====');
  const { assets } = await listAssets({ limit: 400 });
  const re = /velocity|hero|pipedrive|businessman|villain/i;
  const matches = assets.filter((a) => a.type === 'image' && re.test(a.name ?? '') && typeof a.url === 'string');
  if (matches.length === 0) { console.log('  (none)'); }
  for (const a of matches) {
    console.log(`  - [${a.id}] ${a.name}`);
    console.log(`      ${a.url}`);
  }

  console.log('\n===== BRAND-ASSETS storage images =====');
  if (adminStorage) {
    const [files] = await adminStorage.bucket(BUCKET).getFiles({ prefix: `organizations/${PLATFORM_ID}/brand-assets/` });
    const imgs = files.filter((f) => IMG.test(f.name));
    if (imgs.length === 0) { console.log('  (none)'); }
    for (const f of imgs) { console.log(`  - ${f.name.split('/').pop()}`); }
  } else {
    console.log('  storage unavailable');
  }
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
