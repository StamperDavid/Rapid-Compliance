/**
 * Persist WhatsApp Business credentials to apiKeys/social.whatsapp_business.
 *
 * The WhatsAppBusinessService (src/lib/integrations/whatsapp-business-service.ts) needs:
 *   $env:WHATSAPP_ACCESS_TOKEN="..."          # Meta Graph API token (long-lived recommended)
 *   $env:WHATSAPP_PHONE_NUMBER_ID="..."       # WhatsApp Business phone number ID
 *   $env:WHATSAPP_BUSINESS_ACCOUNT_ID="..."   # optional but recommended (WABA ID)
 *
 * IMPORTANT: WhatsApp Business uses the Meta Cloud API. Setup is multi-step and
 * REQUIRES a verified business via Meta Business Verification (can take days).
 *
 * How to obtain the credentials:
 *   1. Go to https://developers.facebook.com → Create app → Business type.
 *   2. Add the "WhatsApp" product to your app.
 *   3. In Meta Business Suite, complete Business Verification.
 *   4. Add a phone number to your WhatsApp Business Account (must NOT be already
 *      registered in WhatsApp; if it is, deregister it first from the WA app).
 *   5. Verify the phone number via SMS or voice call.
 *   6. From the WhatsApp dashboard in your Meta app:
 *        - Note the Phone Number ID (NOT the actual phone number — the numeric ID)
 *        - Note the WhatsApp Business Account ID (WABA ID)
 *   7. For a permanent token, create a System User in Meta Business Suite:
 *        Business Settings → Users → System Users → Add → Admin
 *      Generate a token with these permissions: whatsapp_business_messaging,
 *      whatsapp_business_management. This token does NOT expire.
 *
 * NOTE: WhatsApp messaging templates require pre-approval from Meta for outbound
 * non-reply messages (24-hour customer service window applies otherwise).
 *
 * After saving, validate by running scripts/audit-social-credentials.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) { return; }
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) {
      const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      if (!process.env[m[1]]) { process.env[m[1]] = v; }
    }
  }
}

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  loadEnvLocal();
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    throw new Error('No serviceAccountKey.json');
  }
}

initAdmin();

function redact(value: string): string {
  if (value.length <= 10) { return '***'; }
  return `set, length: ${value.length}`;
}

async function main(): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !phoneNumberId) {
    console.error('WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID env vars required');
    console.error('See script header for the Meta Business Suite setup flow.');
    process.exit(1);
  }

  // Validate the credentials against the Graph API BEFORE writing them.
  console.log(`Validating WhatsApp token for phone ID ${phoneNumberId}...`);
  const verifyResp = await fetch(
    `https://graph.facebook.com/v19.0/${encodeURIComponent(phoneNumberId)}?fields=verified_name,display_phone_number,quality_rating`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!verifyResp.ok) {
    const errText = await verifyResp.text();
    console.error(`WhatsApp auth failed: HTTP ${verifyResp.status}`);
    console.error(errText.slice(0, 400));
    process.exit(2);
  }
  const profile = await verifyResp.json() as {
    verified_name?: string;
    display_phone_number?: string;
    quality_rating?: string;
  };
  console.log(`✓ Authenticated: ${profile.verified_name ?? '(unknown)'} on ${profile.display_phone_number ?? '(unknown number)'}`);
  console.log(`  quality_rating: ${profile.quality_rating ?? '(unknown)'}`);

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const existingSocial = (existing.social && typeof existing.social === 'object'
    ? (existing.social as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const existingWhatsapp = (existingSocial.whatsapp_business && typeof existingSocial.whatsapp_business === 'object'
    ? (existingSocial.whatsapp_business as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const whatsappPayload: Record<string, unknown> = {
    ...existingWhatsapp,
    accessToken,
    phoneNumberId,
    ...(businessAccountId ? { businessAccountId } : {}),
    verifiedName: profile.verified_name ?? null,
    displayPhoneNumber: profile.display_phone_number ?? null,
    savedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: {
        ...existingSocial,
        whatsapp_business: whatsappPayload,
      },
      updatedAt: now,
      updatedBy: 'save-whatsapp-business-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  // Read back to confirm.
  const verifySnap = await docRef.get();
  const verifyData = verifySnap.data() as Record<string, unknown>;
  const verifySocial = (verifyData.social ?? {}) as Record<string, unknown>;
  const verifyWhatsapp = (verifySocial.whatsapp_business ?? {}) as Record<string, unknown>;

  console.log(`✓ Saved WhatsApp Business credentials at apiKeys/${PLATFORM_ID}.social.whatsapp_business`);
  console.log('  fields:');
  console.log(`    accessToken: ${redact(String(verifyWhatsapp.accessToken ?? ''))}`);
  console.log(`    phoneNumberId: ${String(verifyWhatsapp.phoneNumberId ?? '(missing)')}`);
  if (typeof verifyWhatsapp.businessAccountId === 'string' && verifyWhatsapp.businessAccountId.length > 0) {
    console.log(`    businessAccountId: ${verifyWhatsapp.businessAccountId}`);
  }
  console.log(`    verifiedName: ${String(verifyWhatsapp.verifiedName ?? '(none)')}`);
  console.log(`    displayPhoneNumber: ${String(verifyWhatsapp.displayPhoneNumber ?? '(none)')}`);
  console.log(`  savedAt: ${String(verifyWhatsapp.savedAt ?? '(missing)')}`);
  console.log('');
  console.log('To verify: npx tsx scripts/audit-social-credentials.ts');
  console.log('To test posting: npx tsx scripts/verify-whatsapp-business-post-live.ts');
}

main().catch((err) => { console.error(err); process.exit(1); });
