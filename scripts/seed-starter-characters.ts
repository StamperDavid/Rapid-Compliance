/**
 * Seed the Character Library with a few ready-made STARTER characters so a new
 * user's library is never empty. Each starter gets a generated full-body frontal
 * reference (fal), persisted to OUR Storage and tagged category 'character' (so it
 * obeys the "characters own their images" rule), then a Character-Library
 * AvatarProfile owned by the operator (source 'custom' → shows in the own-only
 * Characters library). Idempotent: a starter whose name already exists is skipped.
 *
 * SPENDS a little fal money (~$0.05 per image). Run: npx tsx scripts/seed-starter-characters.ts
 */

/* eslint-disable no-console */

import { randomUUID } from 'node:crypto';

import { adminAuth, adminStorage } from '../src/lib/firebase/admin';
import { firebaseDownloadUrl } from '../src/lib/firebase/storage-utils';
import { generateWithFal } from '../src/lib/ai/providers/fal-provider';
import { createAsset } from '../src/lib/media/media-library-service';
import {
  createAvatarProfile,
  listAvatarProfiles,
} from '../src/lib/video/avatar-profile-service';
import { PLATFORM_ID } from '../src/lib/constants/platform';

const BUCKET = 'rapid-compliance-65f87.firebasestorage.app';
const EMAILS = ['dstamper@rapidcompliance.us', 'dstamper@salesvelocity.ai'];

interface Starter {
  name: string;
  age: string;
  gender: string;
  ethnicity: string;
  build: string;
  hair: string;
  wardrobe: string;
}

/** A small, deliberately DIVERSE starter cast — broadly useful for SMB videos. */
const STARTERS: Starter[] = [
  { name: 'Maya Chen', age: 'late 20s', gender: 'woman', ethnicity: 'East Asian', build: 'slim', hair: 'shoulder-length straight black hair', wardrobe: 'a tailored charcoal blazer over a white tee, smart-casual' },
  { name: 'Marcus Reed', age: 'in his 40s', gender: 'man', ethnicity: 'Black', build: 'athletic', hair: 'short black hair with a neatly trimmed beard', wardrobe: 'a well-fitted navy business suit, no tie' },
  { name: 'Sofia Alvarez', age: 'in her 30s', gender: 'woman', ethnicity: 'Latina', build: 'medium', hair: 'long wavy dark-brown hair', wardrobe: 'a warm rust-colored knit sweater and dark jeans, approachable' },
  { name: 'James O’Brien', age: 'in his 50s', gender: 'man', ethnicity: 'White', build: 'average', hair: 'short greying hair, clean-shaven', wardrobe: 'a soft blue button-down shirt and chinos, trustworthy advisor look' },
  { name: 'Aisha Khan', age: 'early 20s', gender: 'woman', ethnicity: 'South Asian', build: 'slim', hair: 'long dark hair', wardrobe: 'a relaxed mustard hoodie, energetic young-creator vibe' },
];

function frontalPrompt(s: Starter): string {
  return (
    `Full-body character reference of ${s.name}, a ${s.age} ${s.ethnicity} ${s.gender}, ` +
    `${s.build} build, ${s.hair}, wearing ${s.wardrobe}. A single neutral standing full-body ` +
    `subject, head to toe, front-facing in a neutral A-pose, isolated on a seamless light-grey ` +
    `(#d9d9d9) photographic studio background, even soft studio lighting, photorealistic, sharp ` +
    `focus, no props, no text. Single character, full body visible.`
  );
}

function description(s: Starter): string {
  return `${s.name} — a ${s.age} ${s.ethnicity} ${s.gender}, ${s.build} build, ${s.hair}. A versatile presenter/spokesperson starter character. Default wardrobe: ${s.wardrobe}.`;
}

async function resolveUid(): Promise<string> {
  if (!adminAuth) {
    throw new Error('adminAuth unavailable');
  }
  for (const email of EMAILS) {
    try {
      const u = await adminAuth.getUserByEmail(email);
      console.log(`Operator: ${email} -> uid ${u.uid}`);
      return u.uid;
    } catch {
      /* try next */
    }
  }
  throw new Error('Could not resolve operator uid from known emails');
}

async function fetchToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`image download failed (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Persist a generated image to OUR Storage + register it as a CHARACTER asset. */
async function persistCharacterImage(buf: Buffer, name: string, uid: string, prompt: string): Promise<string> {
  const id = randomUUID();
  const sp = `organizations/${PLATFORM_ID}/media/images/${id}.png`;
  const token = randomUUID();
  await adminStorage!.bucket(BUCKET).file(sp).save(buf, {
    metadata: { contentType: 'image/png', metadata: { firebaseStorageDownloadTokens: token, source: 'starter-character' } },
  });
  const url = firebaseDownloadUrl(BUCKET, sp, token);
  await createAsset({
    type: 'image',
    category: 'character',
    name: `${name} — starter reference`,
    url,
    mimeType: 'image/png',
    fileSize: buf.length,
    source: 'ai-generated',
    aiProvider: 'fal',
    aiPrompt: prompt,
    createdBy: uid,
    characterName: name,
    tags: ['starter', 'character'],
  });
  return url;
}

async function main(): Promise<void> {
  if (!adminStorage) {
    throw new Error('storage unavailable');
  }
  const uid = await resolveUid();

  const existing = await listAvatarProfiles(uid, { ownOnly: true });
  const existingNames = new Set(existing.map((p) => p.name.trim().toLowerCase()));

  let created = 0;
  let skipped = 0;
  for (const s of STARTERS) {
    if (existingNames.has(s.name.trim().toLowerCase())) {
      console.log(`skip (already in library): ${s.name}`);
      skipped += 1;
      continue;
    }
    try {
      const prompt = frontalPrompt(s);
      console.log(`generating frontal for ${s.name}…`);
      const gen = await generateWithFal(prompt, { aspectRatio: '9:16' });
      if (!gen.url) {
        console.log(`FAILED (no image): ${s.name}`);
        continue;
      }
      const buf = await fetchToBuffer(gen.url);
      const frontalUrl = await persistCharacterImage(buf, s.name, uid, prompt);

      const result = await createAvatarProfile(uid, {
        name: s.name,
        frontalImageUrl: frontalUrl,
        source: 'custom',
        role: 'presenter',
        styleTag: 'real',
        description: description(s),
      });
      if (!result.success || !result.profile) {
        console.log(`FAILED (profile): ${s.name} — ${result.error ?? 'unknown'}`);
        continue;
      }
      console.log(`  created starter "${s.name}" profileId=${result.profile.id}`);
      created += 1;
    } catch (err) {
      console.log(`ERROR for ${s.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nDONE — ${created} created, ${skipped} skipped (already present), of ${STARTERS.length} starters.`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('STARTER SEED FAILED:', msg);
    if (/403|exhausted|balance|insufficient/i.test(msg)) {
      console.error('NOTE: looks like a fal balance issue, not a code defect.');
    }
    process.exit(1);
  });
