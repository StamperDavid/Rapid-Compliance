/* eslint-disable no-console */
import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { createMastodonService } from '@/lib/integrations/mastodon-service';

async function main(): Promise<void> {
  const service = await createMastodonService();
  if (!service) { console.error('Mastodon service not configured'); process.exit(1); }
  const profile = await service.getProfile();
  console.log(`Authenticated as: @${profile?.acct} (id=${profile?.id})\n`);
  const result = await service.pollDirectMessages();
  if (!result.success) { console.error(`Poll failed: ${result.error}`); process.exit(2); }
  console.log(`Total conversations: ${result.conversations.length}`);
  for (const convo of result.conversations) {
    console.log(`──────────`);
    console.log(`convoId: ${convo.id}`);
    console.log(`unread:  ${convo.unread}`);
    console.log(`accounts: ${convo.accounts.map((a) => `@${a.acct}`).join(', ')}`);
    if (convo.last_status) {
      console.log(`last_status.id:         ${convo.last_status.id}`);
      console.log(`last_status.from:       @${convo.last_status.account.acct}`);
      console.log(`last_status.created_at: ${convo.last_status.created_at}`);
      console.log(`last_status.visibility: ${convo.last_status.visibility}`);
      console.log(`last_status.content:    ${convo.last_status.content.slice(0, 200)}`);
    }
  }
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
