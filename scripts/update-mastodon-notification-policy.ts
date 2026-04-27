/**
 * Update the brand's Mastodon notification policy so ALL incoming DMs
 * and mentions are accepted into the main inbox without filtering.
 *
 * Why: Mastodon's default policy filters private mentions from non-
 * followers (anti-spam). For an auto-reply brand account, that filter
 * causes legitimate DMs to get quarantined into a separate "requests"
 * pile that our cron's poll of /api/v1/conversations doesn't see.
 * Setting all five filter axes to "accept" means every incoming DM
 * lands in conversations, where our dispatcher can pick it up.
 *
 * Five axes Mastodon offers (each accept|filter|drop):
 *   - for_not_following: people the brand doesn't follow
 *   - for_not_followers: people who don't follow the brand
 *   - for_new_accounts: accounts < 30 days old
 *   - for_private_mentions: direct DMs (the one biting us tonight)
 *   - for_limited_accounts: silenced/limited instances
 *
 * Idempotent — safe to re-run; PATCH only changes the listed fields.
 */

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

interface NotificationPolicy {
  for_not_following?: 'accept' | 'filter' | 'drop';
  for_not_followers?: 'accept' | 'filter' | 'drop';
  for_new_accounts?: 'accept' | 'filter' | 'drop';
  for_private_mentions?: 'accept' | 'filter' | 'drop';
  for_limited_accounts?: 'accept' | 'filter' | 'drop';
  summary?: { pending_requests_count?: number; pending_notifications_count?: number };
}

async function main(): Promise<void> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'mastodon') as { accessToken?: string; instanceUrl?: string } | null;
  if (!keys?.accessToken || !keys.instanceUrl) { console.error('Mastodon not configured'); process.exit(1); }
  const baseUrl = keys.instanceUrl.replace(/\/$/, '');
  const auth = { ...BROWSER_HEADERS, Authorization: `Bearer ${keys.accessToken}` };

  // Read current policy
  console.log('Current notification policy:');
  const before = await fetch(`${baseUrl}/api/v2/notifications/policy`, { headers: auth });
  if (!before.ok) { console.error(`GET failed: ${before.status}`); process.exit(2); }
  const beforePolicy = await before.json() as NotificationPolicy;
  console.log(JSON.stringify(beforePolicy, null, 2));

  // Update — set everything to accept
  const update = {
    for_not_following: 'accept',
    for_not_followers: 'accept',
    for_new_accounts: 'accept',
    for_private_mentions: 'accept',
    for_limited_accounts: 'accept',
  };
  console.log('\nApplying update:');
  console.log(JSON.stringify(update, null, 2));

  const patchResp = await fetch(`${baseUrl}/api/v2/notifications/policy`, {
    method: 'PATCH',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!patchResp.ok) {
    const errText = await patchResp.text();
    console.error(`PATCH failed: ${patchResp.status} ${errText.slice(0, 400)}`);
    process.exit(3);
  }

  // Verify
  const after = await fetch(`${baseUrl}/api/v2/notifications/policy`, { headers: auth });
  if (!after.ok) { console.error(`Verify GET failed: ${after.status}`); process.exit(4); }
  const afterPolicy = await after.json() as NotificationPolicy;
  console.log('\nUpdated notification policy:');
  console.log(JSON.stringify(afterPolicy, null, 2));

  const allAccept = (
    afterPolicy.for_not_following === 'accept' &&
    afterPolicy.for_not_followers === 'accept' &&
    afterPolicy.for_new_accounts === 'accept' &&
    afterPolicy.for_private_mentions === 'accept' &&
    afterPolicy.for_limited_accounts === 'accept'
  );
  if (!allAccept) {
    console.error('\n✗ One or more axes did not flip to accept');
    process.exit(5);
  }
  console.log('\n✓ All five axes set to accept. All incoming DMs and mentions will now land directly in the main inbox.');
}

main().catch((err) => { console.error(err); process.exit(1); });
