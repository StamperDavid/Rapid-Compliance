/**
 * Read-only: dump the operator's color palette from every store that holds one, so we
 * can see what their REAL brand colors are (and where they live) before restoring them.
 * Run: npx tsx scripts/inspect-brand-colors.ts
 */
import { adminDb } from '../src/lib/firebase/admin';
import { getSubCollection } from '../src/lib/firebase/collections';

async function dump(label: string, path: string, pick: (d: Record<string, unknown>) => unknown): Promise<void> {
  if (!adminDb) { throw new Error('adminDb unavailable'); }
  const snap = await adminDb.doc(path).get();
  if (!snap.exists) { console.log(`\n[${label}] ${path}\n  (doc does not exist)`); return; }
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  console.log(`\n[${label}] ${path}`);
  console.log(JSON.stringify(pick(data), null, 2));
}

async function main(): Promise<void> {
  const settings = getSubCollection('settings');
  const platform = getSubCollection('platform');
  await dump('BRAND IDENTITY (the page you edit)', `${settings}/brand-identity`, (d) => d.colors);
  await dump('BRAND KIT', `${settings}/brand-kit`, (d) => d.colors);
  await dump('WEBSITE CONFIG', `${platform}/website-editor-config`, (d) => {
    const branding = d.branding as Record<string, unknown> | undefined;
    return branding?.colors ?? d.colors ?? '(no colors field)';
  });
  await dump('THEME (live, post-repair)', 'platform_settings/theme', (d) => d.colors);
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
