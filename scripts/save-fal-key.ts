/**
 * Save the fal.ai API key into Firestore via the platform's apiKeyService
 * (stored at imageGen.fal.apiKey, where getServiceKey('fal') + fal-provider read it).
 * Key is passed via the FAL_KEY env var so it's never written into this file.
 * Run: FAL_KEY='<key>' npx tsx scripts/save-fal-key.ts
 */
import { apiKeyService } from '../src/lib/api-keys/api-key-service';
import { adminDb } from '../src/lib/firebase/admin';
import { getSubCollection } from '../src/lib/firebase/collections';
import { PLATFORM_ID } from '../src/lib/constants/platform';

async function main(): Promise<void> {
  const key = (process.env.FAL_KEY ?? '').trim();
  if (!key) { throw new Error('FAL_KEY env var not set'); }
  if (!adminDb) { throw new Error('adminDb unavailable'); }

  // Preserve any existing imageGen siblings; only set/update fal.apiKey.
  const snap = await adminDb.collection(getSubCollection('apiKeys')).doc(PLATFORM_ID).get();
  const data = (snap.exists ? snap.data() : {}) ?? {};
  const imageGen = { ...((data.imageGen as Record<string, unknown> | undefined) ?? {}) };
  const fal = { ...((imageGen.fal as Record<string, unknown> | undefined) ?? {}) };
  fal.apiKey = key;
  imageGen.fal = fal;

  await apiKeyService.saveKeys({ imageGen } as Parameters<typeof apiKeyService.saveKeys>[0], 'system');

  const check = await apiKeyService.getServiceKey(PLATFORM_ID, 'fal');
  const ok = typeof check === 'string' && check.length > 0;
  console.log(`fal key saved → getServiceKey('fal') reads back: ${ok ? `OK (${(check as string).length} chars)` : 'MISSING'}`);
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
