/**
 * Restore platform_settings/theme to a CLEAN projection of the operator's Brand
 * Identity (the single source of truth), using the FIXED themeOverlayFromIdentity
 * translator — the one that now carries background / text / border through instead
 * of dropping them. This both restores the pre-logo-swap colors and proves the new
 * translator produces a complete, correct theme doc.
 *
 * Read identity -> read current theme -> compute overlay -> write theme. Idempotent.
 * Run: npx tsx scripts/restore-theme-from-identity.ts
 */
import { adminDb } from '../src/lib/firebase/admin';
import { getBrandIdentity } from '../src/lib/brand/brand-identity-service';
import { themeOverlayFromIdentity } from '../src/lib/brand/brand-identity-bridges';

async function main(): Promise<void> {
  if (!adminDb) { throw new Error('adminDb unavailable'); }

  const identity = await getBrandIdentity();
  const ref = adminDb.collection('platform_settings').doc('theme');
  const snap = await ref.get();
  const existingTheme = (snap.exists ? snap.data() : {}) ?? {};

  const overlay = themeOverlayFromIdentity(identity, existingTheme);
  await ref.set(overlay, { merge: true });

  const colors = (overlay.colors ?? {}) as Record<string, Record<string, string>>;
  const groups = Object.keys(colors);
  console.log('--- THEME RESTORED FROM BRAND IDENTITY ---');
  console.log(`Color groups written (must be 11): ${groups.length} -> ${groups.join(', ')}`);
  console.log(`background.main=${colors.background?.main}  text.primary=${colors.text?.primary}  border.main=${colors.border?.main}`);
  console.log(`primary.main=${colors.primary?.main}  accent.main=${colors.accent?.main}`);
  const missing = groups.filter((g) => Object.values(colors[g]).some((v) => typeof v !== 'string' || v.trim().length === 0));
  console.log(missing.length ? `WARNING — groups with empty fields: ${missing.join(', ')}` : 'All fields populated (no empty/transparent slots).');
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
