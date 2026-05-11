/**
 * One-shot diagnostic: what API credentials are already stored, and where?
 * Lists every doc in apiKeys collection + dumps top-level structure.
 *
 * Read-only.
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

const envPath = 'D:/Future Rapid Compliance/.env.local';
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) {
    const v = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
const sa = JSON.parse(
  fs.readFileSync('D:/Future Rapid Compliance/serviceAccountKey.json', 'utf-8'),
);
admin.initializeApp({ credential: admin.credential.cert(sa) });

function maskValue(v: unknown): string {
  if (typeof v !== 'string') return `<${typeof v}>`;
  if (v.length === 0) return '<empty>';
  if (v.length <= 8) return `${v.slice(0, 2)}…`;
  return `${v.slice(0, 4)}…${v.slice(-4)} (${v.length} chars)`;
}

function summarize(obj: unknown, depth = 0, maxDepth = 3): void {
  const indent = '  '.repeat(depth);
  if (obj === null || obj === undefined) {
    console.log(`${indent}<${obj === null ? 'null' : 'undefined'}>`);
    return;
  }
  if (Array.isArray(obj)) {
    console.log(`${indent}[array, ${obj.length} items]`);
    return;
  }
  if (typeof obj !== 'object') {
    console.log(`${indent}${typeof obj === 'string' ? maskValue(obj) : String(obj)}`);
    return;
  }
  if (depth >= maxDepth) {
    console.log(`${indent}{<truncated, ${Object.keys(obj).length} keys>}`);
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      console.log(`${indent}${k} = <${v === null ? 'null' : 'undefined'}>`);
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      console.log(`${indent}${k}:`);
      summarize(v, depth + 1, maxDepth);
    } else if (Array.isArray(v)) {
      console.log(`${indent}${k}: [array, ${v.length} items]`);
    } else if (typeof v === 'string') {
      const isSecret = k.toLowerCase().includes('secret') || k.toLowerCase().includes('token') || k.toLowerCase().includes('key') || k.toLowerCase().includes('password');
      console.log(`${indent}${k} = ${isSecret ? maskValue(v) : `"${v.length > 80 ? v.slice(0, 77) + '…' : v}"`}`);
    } else {
      console.log(`${indent}${k} = ${String(v)}`);
    }
  }
}

(async () => {
  console.log('\n=== API credentials audit (rapid-compliance-root) ===\n');

  const apiKeysRef = admin.firestore().collection('organizations').doc('rapid-compliance-root').collection('apiKeys');
  const snap = await apiKeysRef.get();

  if (snap.empty) {
    console.log('apiKeys subcollection is empty. Trying alternate paths…');
  } else {
    console.log(`Found ${snap.size} doc(s) in organizations/rapid-compliance-root/apiKeys:\n`);
    for (const doc of snap.docs) {
      console.log(`─── DOC: ${doc.id} ───`);
      const data = doc.data();
      console.log(`Top-level keys: ${Object.keys(data).sort().join(', ')}\n`);
      summarize(data);
      console.log();
    }
  }

  // Also check root-level apiKeys (legacy / alt shape)
  const rootApiKeys = admin.firestore().collection('apiKeys');
  const rootSnap = await rootApiKeys.get();
  if (!rootSnap.empty) {
    console.log(`\nFound ${rootSnap.size} doc(s) in root collection apiKeys (legacy?):`);
    for (const doc of rootSnap.docs) {
      console.log(`  - ${doc.id}: keys=${Object.keys(doc.data()).join(', ')}`);
    }
  }

  process.exit(0);
})().catch((err) => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
