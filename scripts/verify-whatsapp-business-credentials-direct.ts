/**
 * CREDENTIAL SMOKE TEST — direct service call, NOT product-path verification.
 *
 * What this DOES test:
 *   - WhatsApp Business Cloud API /messages endpoint accepts our saved Meta
 *     access token from apiKeyService.getServiceKey('whatsapp_business')
 *   - WhatsAppBusinessService.sendTextMessage() constructs a valid request
 *     and returns the new message id
 *
 * What this does NOT test:
 *   - The product path through Jasper → OutreachManager → WhatsAppExpert
 *     → send_message tool → Mission Control
 *   - Whether WhatsAppExpert.execute() (the function the orchestrator actually
 *     calls) handles the response correctly. This script bypasses it entirely.
 *
 * Renamed Apr 29 2026 from `verify-whatsapp-business-post-live.ts` because the
 * old name implied end-to-end coverage. No orchestrated WhatsApp product-path
 * verify exists yet — that is a KNOWN GAP.
 *
 * Real product path: KNOWN GAP — no `verify-whatsapp-orchestrated-live.ts` yet.
 */

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { createWhatsAppBusinessService } from '@/lib/integrations/whatsapp-business-service';

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i > 0 && process.argv[i + 1]) { return process.argv[i + 1]; }
  return undefined;
}

async function main(): Promise<void> {
  const to = getArg('--to');
  if (!to) {
    console.error('FAIL — --to <phone-in-E.164> is required.');
    console.error('       Example: npx tsx scripts/verify-whatsapp-business-post-live.ts --to +15551234567');
    process.exit(1);
  }

  const text = getArg('--text')
    ?? `[SalesVelocity.ai pipeline test ${new Date().toISOString()}] If you can read this, the WhatsApp Business posting path is wired end-to-end.`;

  console.log('[verify-whatsapp-post] loading service config from Firestore...');
  const service = await createWhatsAppBusinessService();
  if (!service) {
    console.error('FAIL — WhatsApp Business service not configured. Save credentials via the integrations UI first.');
    process.exit(2);
  }

  // Sanity-check the access token before sending.
  const profile = await service.getBusinessProfile();
  if (!profile) {
    console.error('FAIL — WhatsApp business profile fetch failed. Access token may be invalid or expired.');
    process.exit(3);
  }
  console.log(`Authenticated as ${profile.verified_name} (quality: ${profile.quality_rating ?? 'unknown'})`);

  console.log(`\nSending text message to ${to}:`);
  console.log(`  "${text}"`);
  console.log('');

  const result = await service.sendTextMessage({ to, text });

  if (!result.success) {
    console.error(`FAIL — send rejected: ${result.error}`);
    if (result.error?.includes('24') || result.error?.toLowerCase().includes('window')) {
      console.error('Hint: free-form messages require the recipient to have messaged you in the last 24 hours.');
      console.error('      Outside that window, use sendTemplate() with a pre-approved template.');
    }
    process.exit(4);
  }

  console.log('PASS — WhatsApp message sent');
  console.log(`  message id: ${result.messageId ?? '(none)'}`);
  console.log(`  recipient:  ${to}`);
  console.log('  (WhatsApp does not provide a public URL — check the recipient\'s chat.)');
}

main().catch((err) => { console.error(err); process.exit(1); });
