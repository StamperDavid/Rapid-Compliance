/**
 * Read-only: print the URL of media-library assets by id.
 * Run: npx tsx scripts/lookup-assets.ts <id> [<id> ...]
 */
import { getAsset } from '../src/lib/media/media-library-service';

async function main(): Promise<void> {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.log('usage: npx tsx scripts/lookup-assets.ts <id> [<id> ...]');
    return;
  }
  for (const id of ids) {
    const asset = await getAsset(id);
    if (!asset) {
      console.log(`[${id}] NOT FOUND`);
      continue;
    }
    console.log(`[${id}] ${asset.name} (${asset.type}/${asset.category})\n   ${asset.url}`);
  }
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
