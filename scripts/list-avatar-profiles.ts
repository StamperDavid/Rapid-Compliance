/**
 * Read-only: list saved AvatarProfiles (characters) so we can pick two for the
 * two-character talking test. Prints id, name, source, and image counts.
 * Run: npx tsx scripts/list-avatar-profiles.ts
 */
import { adminDb } from '../src/lib/firebase/admin';
import { getSubCollection } from '../src/lib/firebase/collections';

async function main(): Promise<void> {
  if (!adminDb) { throw new Error('adminDb unavailable'); }
  const col = getSubCollection('avatar_profiles');
  const snap = await adminDb.collection(col).get();
  console.log(`Collection: ${col}  —  ${snap.size} profile(s)\n`);
  snap.forEach((doc) => {
    const d = doc.data() as Record<string, unknown>;
    const extra = Array.isArray(d.additionalImageUrls) ? d.additionalImageUrls.length : 0;
    const looks = Array.isArray(d.looks) ? d.looks.length : 0;
    console.log(`• ${doc.id}`);
    console.log(`    name:    ${String(d.name ?? '(unnamed)')}`);
    console.log(`    source:  ${String(d.source ?? '?')}`);
    console.log(`    frontal: ${d.frontalImageUrl ? 'yes' : 'NO'}   +${extra} extra image(s), ${looks} look(s)`);
  });
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
