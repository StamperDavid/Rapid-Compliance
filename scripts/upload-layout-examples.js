/**
 * Upload the OpenArt Smart Shot layout-example screenshots to Firebase Storage and
 * print a LAYOUT_EXAMPLES array (public download URLs + content notes) to paste into
 * scripts/seed-shot-plan-planner-gm.js. Each note teaches the agent how a DIFFERENT
 * story produces a DIFFERENT sheet (what is shown + how it is arranged).
 *
 * Usage: node scripts/upload-layout-examples.js
 */

const admin = require('firebase-admin');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PLATFORM_ID = 'rapid-compliance-root';
const FOLDER = 'C:/Users/David/Desktop/manual testing';

// Ordered simple → complex so the agent reads a clear progression.
const EXAMPLES = [
  {
    file: 'Screenshot 2026-06-19 144219.png',
    note:
      'Single human lead (noir detective): the cast section is ONE wide turnaround + character notes; ' +
      'one location; the overhead alley FLOOR-PLAN camera-blocking is large and prominent in the environment band.',
  },
  {
    file: 'Screenshot 2026-06-19 144125.png',
    note:
      'Human-led SaaS/founder story (one lead + supporting cast): a wide PRIMARY-FOUNDER turnaround + a ' +
      'consolidated supporting-cast block + a LARGE top-down floor-plan / camera-blocking map. Cast compact, blocking large.',
  },
  {
    file: 'Screenshot 2026-06-19 144155.png',
    note:
      'Ensemble of three human leads + a tribe group: the cast section is THREE character columns + ONE ' +
      'consolidated group block + costume/prop tiles. A multi-location journey = several environment zones + a wide left-to-right route/blocking strip.',
  },
  {
    file: 'Screenshot 2026-06-19 144404.png',
    note:
      'Creature/object lead, NO human cast: the reference section is a genetically-modified battle-bear ' +
      'turnaround + a weaponized-drone model sheet, with threat/material notes instead of wardrobe; a large top-down chase-lane floor plan.',
  },
  {
    file: 'Screenshot 2026-06-19 144430.png',
    note:
      'Creature + weaponized object focus: a creature + object reference section, and an environment band ' +
      'DOMINATED by a big top-down FLOOR PLAN — the blocking diagram can be the single largest element on the page.',
  },
  {
    file: 'Screenshot 2026-06-19 144516.png',
    note:
      'Environment/world-led journey (fantasy biomes, a unicorn), NO human cast: the FIRST section is the ' +
      'WORLD reference — six biome tiles — not a cast. When the story is about PLACES, the page leads with environment, then a big top-down floor plan + side elevation.',
  },
];

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing FIREBASE_ADMIN_* env vars in .env.local');
    process.exit(1);
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket: `${projectId}.firebasestorage.app`,
  });
}

async function main() {
  const bucket = admin.storage().bucket();
  const out = [];
  for (const ex of EXAMPLES) {
    const token = crypto.randomUUID();
    const dest = `organizations/${PLATFORM_ID}/layout-examples/${ex.file.replace(/\s+/g, '_')}`;
    await bucket.upload(path.join(FOLDER, ex.file), {
      destination: dest,
      metadata: { contentType: 'image/png', metadata: { firebaseStorageDownloadTokens: token } },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(dest)}?alt=media&token=${token}`;
    out.push({ url, note: ex.note });
    console.log(`  uploaded ${ex.file}`);
  }
  console.log(`\nUploaded ${out.length} layout examples. Paste this into LAYOUT_EXAMPLES:\n`);
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error('Upload failed:', e);
  process.exit(1);
});
