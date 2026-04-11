const https = require('https');
const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: 'rapid-compliance-65f87.firebasestorage.app',
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

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
        console.log(`  GET ${path} -> ${res.statusCode}`);
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body.substring(0, 500) }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const apiKey = await getHedraKey();

  // Try listing image assets
  console.log('--- Trying Hedra asset endpoints ---');
  const r1 = await hedraGet('/assets?type=image', apiKey);
  console.log('  Result:', JSON.stringify(r1.data).substring(0, 500));

  // Try getting a specific asset by ID
  const COLLECTION = 'organizations/rapid-compliance-root/avatar_profiles';
  const doc = await db.collection(COLLECTION).doc('hedra-david-headshot').get();
  const data = doc.data();
  const hedraAssetId = data?.hedraAssetId;
  console.log('\n  hedraAssetId from doc:', hedraAssetId);

  if (hedraAssetId) {
    const r2 = await hedraGet(`/assets/${hedraAssetId}`, apiKey);
    console.log('  Asset detail:', JSON.stringify(r2.data).substring(0, 500));
  }

  // Also try character/portrait endpoints
  console.log('\n--- Trying other Hedra endpoints ---');
  const r3 = await hedraGet('/characters', apiKey);
  console.log('  characters:', JSON.stringify(r3.data).substring(0, 300));

  const r4 = await hedraGet('/portraits', apiKey);
  console.log('  portraits:', JSON.stringify(r4.data).substring(0, 300));

  const r5 = await hedraGet('/projects', apiKey);
  console.log('  projects:', JSON.stringify(r5.data).substring(0, 300));
}

main().catch(console.error);
