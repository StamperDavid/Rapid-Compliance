/**
 * One-shot repair for platform_settings/theme.
 *
 * A brand-identity save (triggered by today's logo swap) wrote an INCOMPLETE `colors`
 * object — only the brand/semantic groups — which left background/text/border/neutral/info
 * undefined. The dashboard then rendered colorless. This restores a COMPLETE color set:
 * every value the operator actually has is PRESERVED; only missing groups/fields are
 * filled with the app's standard defaults (mirrors DEFAULT_THEME in useOrgTheme.ts).
 *
 * Run: npx tsx scripts/repair-theme-colors.ts
 */
import { adminDb } from '../src/lib/firebase/admin';

const DEFAULT_COLORS: Record<string, Record<string, string>> = {
  primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5', contrast: '#ffffff' },
  secondary: { main: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed', contrast: '#ffffff' },
  accent: { main: '#ec4899', light: '#f472b6', dark: '#db2777', contrast: '#ffffff' },
  success: { main: '#10b981', light: '#34d399', dark: '#059669' },
  warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
  error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
  info: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
  neutral: { '100': '#f3f4f6', '200': '#e5e7eb', '300': '#d1d5db', '400': '#9ca3af', '500': '#6b7280', '600': '#4b5563', '700': '#374151', '800': '#1f2937', '900': '#111827' },
  background: { main: '#000000', paper: '#0a0a0a', elevated: '#1a1a1a' },
  text: { primary: '#ffffff', secondary: '#9ca3af', disabled: '#6b7280' },
  border: { main: '#1f2937', light: '#111827', strong: '#374151' },
};

function asRecord(v: unknown): Record<string, string> {
  return v && typeof v === 'object' ? (v as Record<string, string>) : {};
}

async function main(): Promise<void> {
  if (!adminDb) { throw new Error('adminDb unavailable'); }
  const ref = adminDb.collection('platform_settings').doc('theme');
  const snap = await ref.get();
  const data = (snap.exists ? snap.data() : {}) ?? {};
  const existingColors = asRecord(data.colors) as Record<string, unknown>;

  const missingGroups: string[] = [];
  const filled: Record<string, Record<string, string>> = {};

  for (const [group, defFields] of Object.entries(DEFAULT_COLORS)) {
    const ex = asRecord(existingColors[group]);
    if (!existingColors[group] || typeof existingColors[group] !== 'object') {
      missingGroups.push(group);
    }
    // Default fields first, then the operator's real values win where non-empty.
    const merged: Record<string, string> = { ...defFields };
    for (const [k, v] of Object.entries(ex)) {
      if (typeof v === 'string' && v.trim().length > 0) { merged[k] = v; }
    }
    filled[group] = merged;
  }

  // Preserve any extra color groups the doc had that aren't in our default set.
  for (const [group, val] of Object.entries(existingColors)) {
    if (!filled[group] && val && typeof val === 'object') {
      filled[group] = val as Record<string, string>;
    }
  }

  await ref.set({ colors: filled, updatedAt: new Date().toISOString() }, { merge: true });

  console.log('--- THEME REPAIR ---');
  console.log(`Groups that were MISSING (the cause of the blank colors): ${missingGroups.length ? missingGroups.join(', ') : '(none)'}`);
  console.log(`Brand colors preserved → primary.main=${filled.primary.main}, secondary.main=${filled.secondary.main}, accent.main=${filled.accent.main}`);
  console.log(`All color groups now present: ${Object.keys(filled).join(', ')}`);
}

main().then(() => process.exit(0)).catch((e: unknown) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
