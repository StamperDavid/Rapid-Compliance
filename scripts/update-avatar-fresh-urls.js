/**
 * Update stock avatar Firestore docs with fresh signed URLs from Hedra API.
 */
const https = require('https');
const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');

if (admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
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

// Map: Hedra asset ID -> Firestore doc ID
const ASSET_TO_DOC = {
  '9267fa5c-e796-4afd-919a-8b431f0531ea': 'hedra-david-headshot',
  'a955a24a-1912-4874-a922-effc0effaeab': 'hedra-david-home-office',
  '8cdc67cd-0ff7-40cb-b648-cbcdd28dcb5c': 'hedra-david-tech-office',
};

async function main() {
  const apiKey = await getHedraKey();
  if (!apiKey) { console.error('No Hedra API key'); return; }

  const assets = await hedraGet('/assets?type=image', apiKey);
  if (!Array.isArray(assets)) {
    console.error('Failed to list Hedra assets');
    return;
  }

  console.log(`Found ${assets.length} Hedra image assets`);
  let updated = 0;

  for (const asset of assets) {
    const docId = ASSET_TO_DOC[asset.id];
    if (!docId) continue;

    // Use the public variant URL (fresh signed)
    const imageUrl = asset.asset?.url;
    if (!imageUrl) {
      console.log(`No URL for ${asset.id}`);
      continue;
    }

    console.log(`Updating ${docId} with fresh URL`);
    console.log(`  URL: ${imageUrl.substring(0, 120)}...`);

    await db.collection(COLLECTION).doc(docId).update({
      frontalImageUrl: imageUrl,
    });
    console.log(`  Done!`);
    updated++;
  }

  console.log(`\nUpdated ${updated} avatar profiles with fresh image URLs`);
}

main().catch(console.error);
