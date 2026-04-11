/**
 * Download stock avatar images from Hedra and upload to Firebase Storage
 * for permanent URLs that never expire.
 */
const https = require('https');
const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: 'rapid-compliance-65f87.appspot.com',
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();
const COLLECTION = 'organizations/rapid-compliance-root/avatar_profiles';

async function getHedraKey() {
  const doc = await db.doc('organizations/rapid-compliance-root/apiKeys/rapid-compliance-root').get();
  return doc.data()?.video?.hedra?.apiKey;
}

function hedraGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.hedra.com/web-app/public${path}`, {
      headers: { 'x-api-key': apiKey },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: res.headers['content-type'] || 'image/jpeg',
      }));
    }).on('error', reject);
  });
}

// Map: Hedra asset ID -> Firestore doc ID
const ASSET_TO_DOC = {
  '9267fa5c-e796-4afd-919a-8b431f0531ea': 'hedra-david-headshot',
  'a955a24a-ec89-48e4-8edc-b94e94e00b3f': 'hedra-david-home-office',
  '8cdc67cd-0b38-477f-adfe-a0eea84e3595': 'hedra-david-tech-office',
};

async function main() {
  const apiKey = await getHedraKey();
  if (!apiKey) { console.error('No Hedra API key'); return; }

  // Get fresh signed URLs from Hedra
  const assets = await hedraGet('/assets?type=image', apiKey);
  if (!Array.isArray(assets)) {
    console.error('Failed to get assets from Hedra');
    return;
  }

  console.log(`Found ${assets.length} Hedra image assets`);

  for (const asset of assets) {
    const docId = ASSET_TO_DOC[asset.id];
    if (!docId) {
      console.log(`  Skipping asset ${asset.id} (${asset.name}) - not mapped to a stock avatar`);
      continue;
    }

    // Get the full-res image URL from the asset
    const imageUrl = asset.asset?.url || asset.thumbnail_url;
    if (!imageUrl) {
      console.log(`  No URL for asset ${asset.id}`);
      continue;
    }

    console.log(`\nProcessing: ${asset.name} -> ${docId}`);
    console.log(`  Source URL: ${imageUrl.substring(0, 100)}...`);

    // Download the image
    try {
      const { buffer, contentType } = await downloadBuffer(imageUrl);
      console.log(`  Downloaded: ${buffer.length} bytes (${contentType})`);

      // Upload to Firebase Storage
      const ext = contentType.includes('png') ? 'png' : 'jpg';
      const filename = `${docId}.${ext}`;
      const file = bucket.file(`avatar-profiles/${filename}`);

      await file.save(buffer, {
        metadata: { contentType },
        public: true,
      });

      const permanentUrl = `https://storage.googleapis.com/${bucket.name}/avatar-profiles/${filename}`;
      console.log(`  Uploaded to: ${permanentUrl}`);

      // Update Firestore doc
      await db.collection(COLLECTION).doc(docId).update({
        frontalImageUrl: permanentUrl,
      });
      console.log(`  Updated Firestore doc: ${docId}`);

    } catch (err) {
      console.error(`  ERROR for ${docId}:`, err.message);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
