/**
 * Proof: instruction-based editing (Flux Kontext) keeps the subject and changes only
 * what's asked. Picks a character image, changes ONLY the background, and writes both
 * source and result so they can be compared.
 *   public/edit-source.png  /  public/edit-test.png
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { listAssets } from '@/lib/media/media-library-service';
import { generateHedraImageFromReference } from '@/lib/video/hedra-service';

async function main(): Promise<void> {
  const { assets } = await listAssets({ limit: 120 });
  const target = assets.find(
    (a) => a.type === 'image' && Boolean(a.url) && /velocity|sharon|emily|victoria|katie|ben|lisa|businessman|character/i.test(a.name),
  );
  if (!target) { console.log('No character image found to edit.'); return; }
  console.log(`Editing: ${target.name}`);

  const src = Buffer.from(await (await fetch(target.url)).arrayBuffer());
  await writeFile(path.join(process.cwd(), 'public', 'edit-source.png'), src);

  const instruction = 'Change the background behind the character to a solid bright yellow studio backdrop. Keep the character — face, hair, body, clothing, pose — exactly the same.';
  const r = await generateHedraImageFromReference(instruction, target.url, {});
  console.log(`model=${r.modelName}`);

  const out = Buffer.from(await (await fetch(r.url)).arrayBuffer());
  await writeFile(path.join(process.cwd(), 'public', 'edit-test.png'), out);
  console.log('Wrote public/edit-source.png and public/edit-test.png');
  console.log('View: http://localhost:3000/edit-source.png  vs  http://localhost:3000/edit-test.png');
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error(e); process.exit(1); });
