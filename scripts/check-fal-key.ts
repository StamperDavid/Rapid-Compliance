/**
 * Read-only: is a fal.ai API key configured for this org? Prints presence + a
 * masked preview only — never the full key. Run: npx tsx scripts/check-fal-key.ts
 */
import { apiKeyService } from '../src/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '../src/lib/constants/platform';

function mask(v: string): string {
  if (v.length <= 8) { return `${v.slice(0, 2)}…(${v.length} chars)`; }
  return `${v.slice(0, 4)}…${v.slice(-3)} (${v.length} chars)`;
}

async function main(): Promise<void> {
  const raw = await apiKeyService.getServiceKey(PLATFORM_ID, 'fal');
  let keyStr: string | null = null;
  if (typeof raw === 'string') {
    keyStr = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const cand = obj.apiKey ?? obj.key ?? obj.fal ?? null;
    keyStr = typeof cand === 'string' ? cand : null;
  }
  if (keyStr && keyStr.trim().length > 0) {
    console.log(`fal API key: CONFIGURED  [${mask(keyStr.trim())}]`);
  } else {
    console.log(`fal API key: NOT CONFIGURED (raw value: ${raw === null ? 'null' : JSON.stringify(raw).slice(0, 80)})`);
  }
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
