/**
 * Build the "Velocity" character in the Character Library from the reference
 * images in C:\Users\David\Desktop\Velocity. Uploads each image to storage,
 * registers it in the media library, and creates the AvatarProfile under the
 * operator's account. Run: npx tsx scripts/build-velocity-character.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { adminAuth, adminStorage } from '../src/lib/firebase/admin';
import { firebaseDownloadUrl } from '../src/lib/firebase/storage-utils';
import { createAsset } from '../src/lib/media/media-library-service';
import { createAvatarProfile, type CharacterLook } from '../src/lib/video/avatar-profile-service';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const DIR = 'C:\\Users\\David\\Desktop\\Velocity';
const EMAILS = ['dstamper@rapidcompliance.us', 'dstamper@salesvelocity.ai'];

const FRONTAL = '241be87d-7fcc-4920-8e89-ee0062b86916.png';
const FILES: Array<{ file: string; label: string }> = [
  { file: FRONTAL, label: 'Velocity — Hero (face anchor)' },
  { file: '3a391fae-a4ff-44fd-b739-0f7995beedfd (1).png', label: 'Velocity — Hero + Civilian (side by side)' },
  { file: '0b3b8bfb-5d74-43c7-9a66-3a816f2f01f6.png', label: 'Velocity — Hero at desk' },
  { file: '7e8faf6e-cced-45f2-a2a1-a6165ef6b745.png', label: 'Velocity — Hero collage' },
  { file: 'Storyboard 5_ Emily and Victoria Rise.png', label: 'Velocity — Hero running (full body)' },
];

async function resolveUid(): Promise<string> {
  if (!adminAuth) { throw new Error('adminAuth unavailable'); }
  for (const email of EMAILS) {
    try {
      const u = await adminAuth.getUserByEmail(email);
      console.log(`Operator: ${email} → uid ${u.uid}`);
      return u.uid;
    } catch { /* try next */ }
  }
  throw new Error('Could not resolve operator uid from known emails');
}

async function uploadOne(localPath: string, name: string, uid: string): Promise<string> {
  const buf = fs.readFileSync(localPath);
  const id = randomUUID();
  const sp = `organizations/${PLATFORM_ID}/media/images/${id}.png`;
  const token = randomUUID();
  await adminStorage!.bucket(BUCKET).file(sp).save(buf, {
    metadata: { contentType: 'image/png', metadata: { firebaseStorageDownloadTokens: token, source: 'velocity-character' } },
  });
  const url = firebaseDownloadUrl(BUCKET, sp, token);
  await createAsset({
    type: 'image', category: 'photo', name, url, mimeType: 'image/png',
    fileSize: buf.length, source: 'user-upload', createdBy: uid,
    tags: ['velocity', 'character-reference'],
  });
  return url;
}

async function main(): Promise<void> {
  if (!adminStorage) { throw new Error('storage unavailable'); }
  const uid = await resolveUid();

  const urls: Record<string, string> = {};
  for (const f of FILES) {
    const lp = path.join(DIR, f.file);
    if (!fs.existsSync(lp)) { console.log(`MISSING: ${f.file}`); continue; }
    urls[f.file] = await uploadOne(lp, f.label, uid);
    console.log(`uploaded: ${f.file}`);
  }

  const frontal = urls[FRONTAL];
  if (!frontal) { throw new Error('face anchor image missing'); }
  const additional = FILES.slice(1).map((f) => urls[f.file]).filter(Boolean).slice(0, 4);

  const heroLook: CharacterLook = {
    id: randomUUID(),
    name: 'Velocity — Hero',
    outfitDescription:
      'Dark navy/black tactical bodysuit with glowing purple energy accents and panel lines, the SalesVelocity arrow emblem on the chest, fingerless armored gloves.',
    imageUrls: [frontal, urls['Storyboard 5_ Emily and Victoria Rise.png'], urls['0b3b8bfb-5d74-43c7-9a66-3a816f2f01f6.png']].filter(Boolean),
    videoUrls: [],
    audioUrls: [],
    isPrimary: true,
  };

  const description =
    'Velocity — the SalesVelocity superhero. Stylized comic-book / Pixar-style character (NOT photorealistic): athletic adult man, short brown/auburn hair, full reddish-brown beard, determined heroic expression. HERO: dark navy-and-black tactical bodysuit with glowing purple energy accents and panel lines, the SalesVelocity arrow emblem on the chest, fingerless armored gloves; neon tech/city aesthetic. CIVILIAN (same exact face, hair, beard): olive-green t-shirt and jeans, no suit. Keep the illustrated comic art style across every scene.';

  const result = await createAvatarProfile(uid, {
    name: 'Velocity',
    frontalImageUrl: frontal,
    source: 'custom',
    role: 'hero',
    styleTag: 'stylized',
    additionalImageUrls: additional,
    looks: [heroLook],
    description,
    isDefault: true,
  });

  if (!result.success || !result.profile) {
    console.log(`FAILED: ${result.error ?? 'unknown'}`);
    process.exit(1);
  }
  console.log(`\n✅ CHARACTER CREATED — "Velocity" profileId=${result.profile.id}`);
  console.log(`   face anchor + ${additional.length} reference images + 1 Hero look`);
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
