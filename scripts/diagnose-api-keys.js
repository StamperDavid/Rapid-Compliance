/**
 * Diagnostic: Check ALL Firestore API keys for non-ASCII characters
 * that would cause "Cannot convert argument to a ByteString" errors
 * when placed in HTTP headers.
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let serviceAccount = null;
const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (fs.existsSync(keyPath)) {
  serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
} else if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
  serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function checkString(label, val) {
  if (typeof val !== 'string') return;
  for (let i = 0; i < val.length; i++) {
    const code = val.charCodeAt(i);
    if (code > 127) {
      console.log('!! FOUND NON-ASCII: ' + label);
      console.log('   Index: ' + i + ', Char code: ' + code + ', Char: ' + JSON.stringify(val[i]));
      console.log('   Context: ...' + JSON.stringify(val.substring(Math.max(0, i - 5), i + 5)) + '...');
      console.log('   Full value preview: ' + JSON.stringify(val.substring(0, 30)) + '...');
      // Check if this would be "index 7" in a Bearer header
      if (i === 0) {
        console.log('   >> This char at position 0 would be INDEX 7 in "Bearer ${key}" header!');
      }
      return;
    }
  }
  console.log('OK: ' + label + ' (' + val.length + ' chars, preview: ' + val.substring(0, 12) + '...)');
}

function deepCheck(obj, prefix) {
  if (!obj) return;
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix + '.' + key;
    if (typeof val === 'string' && val.length > 0 && (
      key.toLowerCase().includes('key') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('api') ||
      key.toLowerCase().includes('sid') ||
      key.toLowerCase().includes('password')
    )) {
      checkString(fullKey, val);
    } else if (typeof val === 'object' && val !== null && !(val instanceof Date) && !(val._seconds !== undefined)) {
      deepCheck(val, fullKey);
    }
  }
}

async function main() {
  console.log('\n========================================');
  console.log('API KEY NON-ASCII CHARACTER DIAGNOSTIC');
  console.log('========================================\n');

  // Check org-level API keys
  console.log('--- Organization API Keys ---');
  try {
    const orgSnap = await db
      .collection('organizations')
      .doc('rapid-compliance-root')
      .collection('apiKeys')
      .doc('rapid-compliance-root')
      .get();
    if (orgSnap.exists) {
      deepCheck(orgSnap.data(), 'orgKeys');
    } else {
      console.log('No org-level keys document found');
    }
  } catch (e) {
    console.log('Error reading org keys: ' + e.message);
  }

  // Check platform admin keys
  console.log('\n--- Platform Admin Keys ---');
  try {
    const platSnap = await db.collection('admin').doc('platform-api-keys').get();
    if (platSnap.exists) {
      deepCheck(platSnap.data(), 'platformKeys');
    } else {
      console.log('No platform keys document found');
    }
  } catch (e) {
    console.log('Error reading platform keys: ' + e.message);
  }

  // Also check the system prompt text for bullet points that might end up in headers
  console.log('\n--- Header Value Simulation ---');
  // Simulate what "Bearer ${key}" looks like for each key
  try {
    const orgSnap = await db
      .collection('organizations')
      .doc('rapid-compliance-root')
      .collection('apiKeys')
      .doc('rapid-compliance-root')
      .get();
    if (orgSnap.exists) {
      const data = orgSnap.data();
      const keysToTest = {
        'openrouter': data?.ai?.openrouterApiKey,
        'hedra': data?.video?.hedra?.apiKey,
        'elevenlabs': data?.voice?.elevenlabs?.apiKey,
        'unrealSpeech': data?.voice?.unrealSpeech?.apiKey,
      };

      for (const [name, key] of Object.entries(keysToTest)) {
        if (!key || typeof key !== 'string') {
          console.log(name + ': NOT SET');
          continue;
        }
        // Test as "Bearer ${key}" (Authorization header)
        const bearerVal = 'Bearer ' + key;
        for (let i = 0; i < bearerVal.length; i++) {
          if (bearerVal.charCodeAt(i) > 255) {
            console.log('!! ' + name + ': "Bearer ${key}" fails at INDEX ' + i + ' (char code ' + bearerVal.charCodeAt(i) + ')');
            break;
          }
        }
        // Test as raw key (x-api-key header)
        for (let i = 0; i < key.length; i++) {
          if (key.charCodeAt(i) > 255) {
            console.log('!! ' + name + ': raw key fails at INDEX ' + i + ' (char code ' + key.charCodeAt(i) + ')');
            break;
          }
        }
        console.log(name + ': CLEAN (preview: ' + key.substring(0, 12) + '...)');
      }
    }
  } catch (e) {
    console.log('Error in header simulation: ' + e.message);
  }

  console.log('\n========================================');
  console.log('DIAGNOSTIC COMPLETE');
  console.log('========================================\n');

  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
