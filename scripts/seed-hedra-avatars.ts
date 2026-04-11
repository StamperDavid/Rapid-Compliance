import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/avatar_profiles`;

const avatars = [
  {
    id: 'hedra-david-headshot',
    name: 'David - Professional Headshot',
    tier: 'standard',
    frontalImageUrl: 'https://imagedelivery.net/yn_JX_LzJpQI9TTynGwR_Q/1b25a4db-4237-4639-5976-90dc7cb99301/public?exp=1772963277&sig=ce5626f0db250498abcbc31e703d4e7b3f3a3c38895f0c67ae0e2e0646d08170',
    description: 'Original headshot uploaded to Hedra',
    hedraAssetId: '9267fa5c-e796-4afd-919a-8b431f0531ea',
  },
  {
    id: 'hedra-david-tech-office',
    name: 'David - Tech Startup',
    tier: 'standard',
    frontalImageUrl: 'https://imagedelivery.net/yn_JX_LzJpQI9TTynGwR_Q/c7eb2d35-2f41-484a-6ed4-477e4fe92101/public?exp=1772963277&sig=f9d778ff95bbf16fda04677f2f12817e747153fce89e7b3f9293b3f96e0cceef',
    description: 'AI-generated: black turtleneck in modern tech office',
    hedraAssetId: '8cdc67cd-0ff7-40cb-b648-cbcdd28dcb5c',
  },
  {
    id: 'hedra-david-home-office',
    name: 'David - Home Office',
    tier: 'standard',
    frontalImageUrl: 'https://imagedelivery.net/yn_JX_LzJpQI9TTynGwR_Q/d7594c0b-2994-4991-a104-45c3ef491301/public?exp=1772963277&sig=3301363c0ffa5aea13d3ef4fd97fdf2f03585ae71b1b241a7a09cf49dc69525a',
    description: 'AI-generated: casual button-down in modern home office',
    hedraAssetId: 'a955a24a-1912-4874-a922-effc0effaeab',
  },
];

async function seed() {
  for (const avatar of avatars) {
    await db.collection(COLLECTION).doc(avatar.id).set({
      userId: 'system',
      name: avatar.name,
      tier: avatar.tier,
      frontalImageUrl: avatar.frontalImageUrl,
      additionalImageUrls: [],
      fullBodyImageUrl: null,
      upperBodyImageUrl: null,
      greenScreenClips: [],
      voiceId: 'e8e70cb7-97de-4571-9bab-3d33ce5fc8dc',
      voiceName: 'David (Trustworthy)',
      voiceProvider: 'hedra',
      preferredEngine: 'hedra',
      description: avatar.description,
      isDefault: avatar.id === 'hedra-david-headshot',
      isStock: true,
      hedraAssetId: avatar.hedraAssetId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`Seeded: ${avatar.name}`);
  }
  console.log('Done! 3 avatar profiles seeded.');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
