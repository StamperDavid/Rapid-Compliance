/**
 * Migration: compose the canonical Brand Identity from the three legacy stores.
 *
 * READ-ONLY on the three sources:
 *   1. org root `brandDNA`                      → voice
 *   2. platform/website-editor-config `.branding` → companyName / tagline / fonts / colors
 *   3. settings/brand-kit                        → logo / typography / introOutro
 *      (logo fallback chain: own logo → website branding.logoUrl absolute → /logo.png)
 *
 * Writes the composed BrandIdentity to settings/brand-identity with { merge: true }.
 * Idempotent. Supports `--dry-run` (prints the composed object, writes NOTHING).
 *
 * Usage:
 *   npx tsx scripts/migrate-to-brand-identity.ts --dry-run
 *   npx tsx scripts/migrate-to-brand-identity.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

import {
  DEFAULT_BRAND_IDENTITY,
  type BrandExampleAsset,
  type BrandIdentity,
  type BrandPalette,
  type BrandVoice,
} from '../src/types/brand-identity';
import type {
  BrandIntroOutro,
  BrandLogo,
  BrandTypography,
} from '../src/types/brand-kit';
import type { BrandingFonts } from '../src/types/website-editor';

const PLATFORM_ID = 'rapid-compliance-root';

function initAdmin(): void {
  if (admin.apps.length > 0) {
    return;
  }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(sakPath)) {
      const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
      throw new Error('Missing FIREBASE_ADMIN_* env vars and no serviceAccountKey.json');
    }
  }
}

// ── Source shapes (read-only) ───────────────────────────────────────────────

interface OrgBrandDNA {
  companyDescription?: string;
  uniqueValue?: string;
  targetAudience?: string;
  toneOfVoice?: string;
  communicationStyle?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
  industry?: string;
  competitors?: string[];
}

interface WebsiteBranding {
  logoUrl?: string;
  companyName?: string;
  tagline?: string;
  fonts?: Partial<BrandingFonts>;
  colors?: Partial<BrandPalette>;
}

interface BrandKitDoc {
  logo?: BrandLogo | null;
  typography?: Partial<BrandTypography>;
  introOutro?: Partial<BrandIntroOutro>;
}

// ── Composition ─────────────────────────────────────────────────────────────

function composeVoice(dna: OrgBrandDNA | undefined): BrandVoice {
  const d = dna ?? {};
  const base = DEFAULT_BRAND_IDENTITY.voice;
  return {
    companyDescription: d.companyDescription ?? base.companyDescription,
    uniqueValue: d.uniqueValue ?? base.uniqueValue,
    targetAudience: d.targetAudience ?? base.targetAudience,
    toneOfVoice: d.toneOfVoice ?? base.toneOfVoice,
    communicationStyle: d.communicationStyle ?? base.communicationStyle,
    keyPhrases: d.keyPhrases ?? base.keyPhrases,
    avoidPhrases: d.avoidPhrases ?? base.avoidPhrases,
    industry: d.industry ?? base.industry,
    competitors: d.competitors ?? base.competitors,
  };
}

function resolveLogo(kit: BrandKitDoc | undefined, web: WebsiteBranding | undefined): BrandLogo {
  // 1. brand-kit's own logo (must have an absolute url to be compositable)
  const ownUrl = kit?.logo?.url;
  if (ownUrl && /^https?:\/\//i.test(ownUrl) && kit?.logo) {
    return kit.logo;
  }
  // 2. website editor branding.logoUrl (absolute http(s) only)
  const webUrl = web?.logoUrl;
  if (typeof webUrl === 'string' && /^https?:\/\//i.test(webUrl)) {
    return { url: webUrl, position: 'bottom-right', opacity: 0.85, scale: 0.1 };
  }
  // 3. static asset the app ships with
  return { url: '/logo.png', position: 'bottom-right', opacity: 0.85, scale: 0.1 };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  initAdmin();
  const db = admin.firestore();

  const orgPath = `organizations/${PLATFORM_ID}`;
  const websitePath = `organizations/${PLATFORM_ID}/platform/website-editor-config`;
  const brandKitPath = `organizations/${PLATFORM_ID}/settings/brand-kit`;
  const identityPath = `organizations/${PLATFORM_ID}/settings/brand-identity`;

  // ── READ (read-only on all three sources) ──
  const [orgDoc, websiteDoc, brandKitSnap] = await Promise.all([
    db.doc(orgPath).get(),
    db.doc(websitePath).get(),
    db.doc(brandKitPath).get(),
  ]);

  const dna = orgDoc.exists
    ? ((orgDoc.data() as { brandDNA?: OrgBrandDNA }).brandDNA ?? undefined)
    : undefined;
  const web = websiteDoc.exists
    ? ((websiteDoc.data() as { branding?: WebsiteBranding }).branding ?? undefined)
    : undefined;
  const kit = brandKitSnap.exists ? (brandKitSnap.data() as BrandKitDoc) : undefined;

  // ── COMPOSE ──
  const voice = composeVoice(dna);

  const fonts: BrandingFonts = {
    heading: web?.fonts?.heading ?? DEFAULT_BRAND_IDENTITY.fonts.heading,
    body: web?.fonts?.body ?? DEFAULT_BRAND_IDENTITY.fonts.body,
  };

  const colors: BrandPalette = { ...DEFAULT_BRAND_IDENTITY.colors, ...web?.colors };

  const typography: BrandTypography = {
    ...DEFAULT_BRAND_IDENTITY.typography,
    ...kit?.typography,
  };

  const introOutro: BrandIntroOutro = {
    ...DEFAULT_BRAND_IDENTITY.introOutro,
    ...kit?.introOutro,
  };

  const logo = resolveLogo(kit, web);

  const exampleAssets: BrandExampleAsset[] = DEFAULT_BRAND_IDENTITY.exampleAssets;

  const identity: BrandIdentity = {
    voice,
    companyName: web?.companyName ?? DEFAULT_BRAND_IDENTITY.companyName,
    tagline: web?.tagline ?? DEFAULT_BRAND_IDENTITY.tagline,
    logo,
    colors,
    fonts,
    typography,
    introOutro,
    exampleAssets,
    // The runtime read-bridge in getBrandIdentity() repopulates this from the LIVE
    // theme doc when absent; seeding the default keeps the type complete here.
    dashboardTheme: DEFAULT_BRAND_IDENTITY.dashboardTheme,
    updatedAt: new Date().toISOString(),
    updatedBy: 'migrate-to-brand-identity',
  };

  if (dryRun) {
    console.log('\n=== DRY RUN — composed BrandIdentity (NOTHING written) ===');
    console.log(`Sources read:`);
    console.log(`  org brandDNA:        ${dna ? 'found' : 'MISSING (defaults used)'}`);
    console.log(`  website branding:    ${web ? 'found' : 'MISSING (defaults used)'}`);
    console.log(`  brand-kit:           ${kit ? 'found' : 'MISSING (defaults used)'}`);
    console.log(`Target (NOT written):  ${identityPath}\n`);
    console.log(JSON.stringify(identity, null, 2));
    console.log('\n=== DRY RUN complete — no write performed ===\n');
    return;
  }

  // ── WRITE (idempotent) ──
  await db.doc(identityPath).set(identity, { merge: true });
  console.log(`\n✅ Wrote canonical brand identity → ${identityPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
