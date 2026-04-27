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

  const listResp = await fetch(`${baseUrl}/api/v1/notifications/requests?limit=20`, { headers: auth });
  if (!listResp.ok) { console.error(`list failed: ${listResp.status}`); process.exit(2); }
  const requests = await listResp.json() as Array<{ id: string; account: { acct: string } }>;
  console.log(`Found ${requests.length} pending notification request(s)`);
  if (requests.length === 0) { console.log('Nothing to accept.'); process.exit(0); }

  for (const req of requests) {
    console.log(`Accepting request ${req.id} from @${req.account.acct} ...`);
    const acceptResp = await fetch(`${baseUrl}/api/v1/notifications/requests/${req.id}/accept`, {
      method: 'POST',
      headers: auth,
    });
    if (acceptResp.ok) {
      console.log(`  ✓ accepted`);
    } else {
      const errText = await acceptResp.text();
      console.error(`  ✗ ${acceptResp.status} ${errText.slice(0, 200)}`);
    }
  }
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
