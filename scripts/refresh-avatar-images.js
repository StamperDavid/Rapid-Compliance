/**
 * Refresh stock avatar images — download from Hedra, upload to Firebase Storage,
 * and update Firestore docs with permanent URLs.
 */
const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
const https = require('https');
const http = require('http');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: 'rapid-compliance-65f87.firebasestorage.app',
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();
const COLLECTION = 'organizations/rapid-compliance-root/avatar_profiles';

// Hedra API key from Firestore
async function getHedraKey() {
  const doc = await db.doc('organizations/rapid-compliance-root/apiKeys/rapid-compliance-root').get();
  const data = doc.data();
  return data?.video?.hedra?.apiKey;
}

// Try to list Hedra assets
async function listHedraAssets(apiKey) {
  const url = 'https://api.hedra.com/web-app/public/assets';
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'x-api-key': apiKey },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Hedra assets response status:', res.statusCode);
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            resolve(data);
          } catch (e) {
            console.log('Raw response:', body.substring(0, 500));
            resolve(null);
          }
        } else {
          console.log('Response:', body.substring(0, 300));
          resolve(null);
        }
      });
    });
    req.on('error', reject);
  });
}

// Download a URL to a buffer
function downloadUrl(url) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    lib.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// Upload buffer to Firebase Storage and get public URL
async function uploadToStorage(buffer, filename, contentType) {
  const file = bucket.file(`avatar-profiles/${filename}`);
  await file.save(buffer, {
    metadata: { contentType },
    public: true,
  });
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/avatar-profiles/${filename}`;
  console.log('  Uploaded to:', publicUrl);
  return publicUrl;
}

async function main() {
  const apiKey = await getHedraKey();
  if (!apiKey) {
    console.error('No Hedra API key found');
    return;
  }
  console.log('Got Hedra API key');

  // Try listing assets from Hedra
  console.log('\n--- Checking Hedra assets API ---');
  const assets = await listHedraAssets(apiKey);
  if (assets) {
    console.log('Assets found:', Array.isArray(assets) ? assets.length : 'not an array');
    if (Array.isArray(assets)) {
      assets.slice(0, 10).forEach(a => {
        console.log('  Asset:', a.id, '| type:', a.type, '| name:', a.name);
        if (a.url) console.log('    URL:', a.url.substring(0, 100));
        if (a.download_url) console.log('    Download:', a.download_url.substring(0, 100));
      });
    } else {
      console.log('Response shape:', JSON.stringify(assets).substring(0, 500));
    }
  }

  // Get current stock avatar docs
  console.log('\n--- Current stock avatar docs ---');
  const snap = await db.collection(COLLECTION).where('userId', '==', 'system').get();
  for (const doc of snap.docs) {
    const data = doc.data();
    console.log(doc.id, '| frontalImageUrl:', data.frontalImageUrl?.substring(0, 80));
  }
}

main().catch(console.error);
