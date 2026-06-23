/**
 * Regenerate the 5 seeded starter characters with a FULL-BODY base + multiple reference
 * ANGLES (front / side / back / face close-up / costume), the way the video pipeline
 * builds a cast member's model sheet. Updates each existing AvatarProfile in place:
 * frontalImageUrl + fullBodyImageUrl = the new full-body front; additionalImageUrls =
 * the angle views. Uses the PHOTOREAL prompt approach (lead with the medium, forbid
 * 3D/CGI) so the starters read as real people, not Pixar.
 *
 * SPENDS fal money (~5 images x 5 characters). Run: npx tsx scripts/regen-starter-characters.ts
 */

/* eslint-disable no-console */

import { randomUUID } from 'node:crypto';

import { adminAuth, adminStorage } from '../src/lib/firebase/admin';
import { firebaseDownloadUrl } from '../src/lib/firebase/storage-utils';
import { generateWithFal, generateFromReferenceWithFal } from '../src/lib/ai/providers/fal-provider';
import { createAsset } from '../src/lib/media/media-library-service';
import { listAvatarProfiles, updateAvatarProfile } from '../src/lib/video/avatar-profile-service';
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

const STARTERS: Starter[] = [
  { name: 'Maya Chen', age: 'late 20s', gender: 'woman', ethnicity: 'East Asian', build: 'slim', hair: 'shoulder-length straight black hair', wardrobe: 'a tailored charcoal blazer over a white tee, smart-casual' },
  { name: 'Marcus Reed', age: 'in his 40s', gender: 'man', ethnicity: 'Black', build: 'athletic', hair: 'short black hair with a neatly trimmed beard', wardrobe: 'a well-fitted navy business suit, no tie' },
  { name: 'Sofia Alvarez', age: 'in her 30s', gender: 'woman', ethnicity: 'Latina', build: 'medium', hair: 'long wavy dark-brown hair', wardrobe: 'a warm rust-colored knit sweater and dark jeans, approachable' },
  { name: 'James O’Brien', age: 'in his 50s', gender: 'man', ethnicity: 'White', build: 'average', hair: 'short greying hair, clean-shaven', wardrobe: 'a soft blue button-down shirt and chinos, trustworthy advisor look' },
  { name: 'Aisha Khan', age: 'early 20s', gender: 'woman', ethnicity: 'South Asian', build: 'slim', hair: 'long dark hair', wardrobe: 'a relaxed mustard hoodie, energetic young-creator vibe' },
];

// Photoreal anti-CGI clause — mirrors characterStyleDirective in shot-plan-generation-service.
const PHOTO_CLAUSE =
  'This is a PHOTOGRAPH of a real human being — true-to-life skin texture, pores and fine detail; ' +
  'NOT a 3D render, NOT CGI, NOT an illustration, NOT a cartoon, and NOT a Pixar/animated look.';

function basePrompt(s: Starter): string {
  return (
    `A real photograph, cinematic studio portrait. A full-length portrait of ${s.name}, a ${s.age} ` +
    `${s.ethnicity} ${s.gender}, ${s.build} build, ${s.hair}, wearing ${s.wardrobe}. The subject stands ` +
    `naturally facing the camera, head to toe, arms relaxed at the sides, on a seamless light-grey ` +
    `(#d9d9d9) studio backdrop, even soft studio lighting, sharp focus, no props, no text. ${PHOTO_CLAUSE} ` +
    `Single subject, full body visible.`
  );
}

const VIEWS: { label: string; view: string; framing: string }[] = [
  { label: 'side', view: 'full side profile view', framing: 'full body head-to-toe, relaxed natural standing pose' },
  { label: 'back', view: 'back view, facing away from camera', framing: 'full body head-to-toe, relaxed natural standing pose' },
  { label: 'face', view: 'front-facing head-and-shoulders portrait', framing: 'tight close-up on the face, head and shoulders only, sharp facial detail' },
  { label: 'costume', view: 'three-quarter view emphasising the wardrobe and any accessories', framing: 'medium close-up on the costume, wardrobe textures and accessory detail' },
];

function viewPrompt(v: { view: string; framing: string }): string {
  return (
    `Keep the EXACT same person from the reference image — identical face, hairstyle, and wardrobe — ` +
    `now shown ${v.view}, ${v.framing}, on the same seamless light-grey (#d9d9d9) studio backdrop, ` +
    `even soft studio lighting, consistent identity. A real photograph — true-to-life skin texture, ` +
    `NOT a 3D render, NOT CGI, NOT an illustration. Sharp focus, no props, no text.`
  );
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

async function persist(url: string, name: string, label: string, uid: string, prompt: string): Promise<string> {
  const buf = await fetchToBuffer(url);
  const id = randomUUID();
  const sp = `organizations/${PLATFORM_ID}/media/images/${id}.png`;
  const token = randomUUID();
  await adminStorage!.bucket(BUCKET).file(sp).save(buf, {
    metadata: { contentType: 'image/png', metadata: { firebaseStorageDownloadTokens: token, source: 'starter-character' } },
  });
  const stored = firebaseDownloadUrl(BUCKET, sp, token);
  await createAsset({
    type: 'image',
    category: 'character',
    name: `${name} — ${label}`,
    url: stored,
    mimeType: 'image/png',
    fileSize: buf.length,
    source: 'ai-generated',
    aiProvider: 'fal',
    aiPrompt: prompt,
    createdBy: uid,
    characterName: name,
    tags: ['starter', 'character', label],
  });
  return stored;
}

async function main(): Promise<void> {
  if (!adminStorage) {
    throw new Error('storage unavailable');
  }
  const uid = await resolveUid();
  const existing = await listAvatarProfiles(uid, { ownOnly: true });
  const byName = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p]));

  let updated = 0;
  let missing = 0;
  for (const s of STARTERS) {
    const profile = byName.get(s.name.trim().toLowerCase());
    if (!profile) {
      console.log(`skip (no existing profile): ${s.name}`);
      missing += 1;
      continue;
    }
    try {
      const bp = basePrompt(s);
      console.log(`[${s.name}] generating full-body base…`);
      const base = await generateWithFal(bp, { aspectRatio: '9:16' });
      if (!base.url) {
        console.log(`  FAILED (no base image): ${s.name}`);
        continue;
      }
      const frontalUrl = await persist(base.url, s.name, 'front (full body)', uid, bp);

      const angleUrls: string[] = [];
      for (const v of VIEWS) {
        try {
          const vp = viewPrompt(v);
          console.log(`  [${s.name}] view: ${v.label}…`);
          const out = await generateFromReferenceWithFal(vp, frontalUrl, {});
          if (out.url) {
            angleUrls.push(await persist(out.url, s.name, v.label, uid, vp));
          }
        } catch (err) {
          console.log(`    view ${v.label} failed (continuing): ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const res = await updateAvatarProfile(profile.id, {
        frontalImageUrl: frontalUrl,
        fullBodyImageUrl: frontalUrl,
        additionalImageUrls: angleUrls,
      });
      console.log(`  ${res.success ? 'updated' : `UPDATE FAILED: ${res.error ?? '?'}`} "${s.name}" — front + ${angleUrls.length} angles`);
      if (res.success) {
        updated += 1;
      }
    } catch (err) {
      console.log(`ERROR for ${s.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nDONE — ${updated} regenerated, ${missing} missing, of ${STARTERS.length} starters.`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('REGEN FAILED:', msg);
    if (/403|exhausted|balance|insufficient/i.test(msg)) {
      console.error('NOTE: looks like a fal balance issue, not a code defect.');
    }
    process.exit(1);
  });
