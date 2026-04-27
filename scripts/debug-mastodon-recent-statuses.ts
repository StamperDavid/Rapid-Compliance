/* eslint-disable no-console */
import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function main(): Promise<void> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'mastodon') as { accessToken?: string; instanceUrl?: string; accountId?: string } | null;
  if (!keys?.accessToken || !keys.instanceUrl || !keys.accountId) { console.error('Mastodon not configured'); process.exit(1); }
  const auth = { ...BROWSER_HEADERS, Authorization: `Bearer ${keys.accessToken}` };

  const resp = await fetch(`${keys.instanceUrl}/api/v1/accounts/${keys.accountId}/statuses?limit=10&exclude_replies=false`, { cache: 'no-store', headers: auth });
  if (!resp.ok) { console.error(`status fetch failed: ${resp.status}`); process.exit(2); }
  const statuses = await resp.json() as Array<{ id: string; created_at: string; visibility: string; in_reply_to_id?: string | null; in_reply_to_account_id?: string | null; content: string }>;
  console.log(`Last ${statuses.length} statuses from the brand:\n`);
  for (const s of statuses) {
    console.log(`──────────`);
    console.log(`id:                    ${s.id}`);
    console.log(`created_at:            ${s.created_at}`);
    console.log(`visibility:            ${s.visibility}`);
    console.log(`in_reply_to_id:        ${s.in_reply_to_id ?? '(none)'}`);
    console.log(`in_reply_to_account_id:${s.in_reply_to_account_id ?? '(none)'}`);
    console.log(`content:               ${s.content.slice(0, 200).replace(/<[^>]+>/g, '')}`);
  }
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
