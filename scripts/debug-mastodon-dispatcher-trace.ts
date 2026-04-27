/* eslint-disable no-console */
import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { createMastodonService } from '@/lib/integrations/mastodon-service';

async function main(): Promise<void> {
  console.log('Step 1: createMastodonService()');
  const service = await createMastodonService();
  if (!service) { console.error('  ✗ service is null — Mastodon not configured'); process.exit(1); }
  console.log('  ✓ service created');

  console.log('\nStep 2: service.getProfile()');
  const profile = await service.getProfile();
  if (!profile) { console.error('  ✗ profile null — token may be invalid'); process.exit(2); }
  console.log(`  ✓ @${profile.acct} (id=${profile.id})`);

  console.log('\nStep 3: service.pollDirectMessages()');
  const pollResult = await service.pollDirectMessages();
  console.log(`  success: ${pollResult.success}`);
  if (pollResult.error) { console.log(`  error: ${pollResult.error}`); }
  console.log(`  conversations.length: ${pollResult.conversations.length}`);

  if (pollResult.conversations.length > 0) {
    console.log('\nStep 4: walking the for-loop the cron uses');
    let checked = 0;
    let skippedReadCount = 0;
    let skippedNoStatusCount = 0;
    let skippedBrandSelfCount = 0;
    let skippedEmptyTextCount = 0;
    for (const convo of pollResult.conversations) {
      if (!convo.unread) { skippedReadCount++; continue; }
      if (!convo.last_status) { skippedNoStatusCount++; continue; }
      const status = convo.last_status;
      if (status.account.id === profile.id) { skippedBrandSelfCount++; continue; }
      const plainText = status.content.replace(/<[^>]+>/g, '').trim();
      if (!plainText) { skippedEmptyTextCount++; continue; }
      checked++;
      console.log(`  [check ${checked}] convoId=${convo.id} statusId=${status.id} from=@${status.account.acct} visibility=${status.visibility} text="${plainText.slice(0, 100)}"`);
    }
    console.log(`\n  Summary: checked=${checked} skippedRead=${skippedReadCount} skippedNoStatus=${skippedNoStatusCount} skippedBrandSelf=${skippedBrandSelfCount} skippedEmptyText=${skippedEmptyTextCount}`);
  }

  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
