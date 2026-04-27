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
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'mastodon') as { accessToken?: string; instanceUrl?: string } | null;
  if (!keys?.accessToken || !keys.instanceUrl) { console.error('Mastodon not configured'); process.exit(1); }
  const baseUrl = keys.instanceUrl.replace(/\/$/, '');
  const auth = { ...BROWSER_HEADERS, Authorization: `Bearer ${keys.accessToken}` };

  console.log('═══ All notifications (mention type) ═══');
  const notifResp = await fetch(`${baseUrl}/api/v1/notifications?types[]=mention&limit=20`, { headers: auth });
  const notifs = await notifResp.json() as Array<{ id: string; type: string; created_at: string; account: { acct: string }; status?: { id: string; visibility: string; content: string; created_at: string } }>;
  console.log(`Got ${notifs.length} mention notifications`);
  for (const n of notifs.slice(0, 10)) {
    console.log(`──────────`);
    console.log(`id:           ${n.id}`);
    console.log(`from:         @${n.account.acct}`);
    console.log(`created_at:   ${n.created_at}`);
    if (n.status) {
      console.log(`status.id:         ${n.status.id}`);
      console.log(`status.visibility: ${n.status.visibility}`);
      console.log(`status.content:    ${n.status.content.slice(0, 200).replace(/<[^>]+>/g, '')}`);
    }
  }

  console.log('\n═══ Filtered notifications (pending approval) ═══');
  const filteredResp = await fetch(`${baseUrl}/api/v2/notifications/policy`, { headers: auth });
  const policy = await filteredResp.json();
  console.log('Policy:', JSON.stringify(policy, null, 2).slice(0, 800));

  // Try filtered notifications endpoint if available
  const requestsResp = await fetch(`${baseUrl}/api/v1/notifications/requests?limit=20`, { headers: auth });
  if (requestsResp.ok) {
    const requests = await requestsResp.json() as Array<{ id: string; account: { acct: string }; last_status?: { content: string; visibility: string } }>;
    console.log(`\nFiltered/pending notification requests: ${requests.length}`);
    for (const r of requests) {
      console.log(`──────────`);
      console.log(`from: @${r.account.acct}`);
      if (r.last_status) {
        console.log(`status: ${r.last_status.content.slice(0, 200).replace(/<[^>]+>/g, '')}`);
        console.log(`visibility: ${r.last_status.visibility}`);
      }
    }
  } else {
    console.log(`(notifications/requests returned ${requestsResp.status} — may not be supported on this instance)`);
  }
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
