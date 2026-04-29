/* eslint-disable no-console */
import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();

import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';

async function main(): Promise<void> {
  const gm = await getActiveSpecialistGMByIndustry('TWITTER_X_EXPERT', 'saas_sales_ops');
  if (!gm) { console.error('No active TWITTER_X_EXPERT GM'); process.exit(1); }
  console.log(`GM id=${gm.id} version=${gm.version} promptLen=${gm.systemPromptSnapshot?.length ?? 0}`);
  console.log('--- systemPrompt ---');
  console.log(gm.systemPromptSnapshot ?? gm.config.systemPrompt ?? '');
}

main().catch((err) => { console.error(err); process.exit(1); });
