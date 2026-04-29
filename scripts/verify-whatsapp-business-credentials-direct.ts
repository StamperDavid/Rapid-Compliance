/**
 * Live verify: send a real WhatsApp message from the brand's WhatsApp
 * Business number via the saved Meta Cloud API access token.
 *
 * Exercises:
 *   1. apiKeyService.getServiceKey('whatsapp_business') reads the saved config
 *   2. createWhatsAppBusinessService() builds a configured service instance
 *   3. WhatsAppBusinessService.sendTextMessage() POSTs to /messages
 *   4. WhatsApp returns the new message id
 *
 * WARNING: This script sends a REAL message to a real WhatsApp number.
 * Free-form text messages can ONLY be sent to recipients who have messaged
 * the business in the last 24 hours (the WhatsApp customer service window).
 * Outside that window, only pre-approved templates are allowed — this script
 * does not exercise the template path; use sendTemplate() for that.
 *
 * After running, MANUALLY DELETE the message from the recipient's chat if
 * you have control over it. Run from D:\Future Rapid Compliance:
 *   npx tsx scripts/verify-whatsapp-business-post-live.ts --to +15551234567
 *
 * Usage:
 *   npx tsx scripts/verify-whatsapp-business-post-live.ts --to +15551234567
 *   npx tsx scripts/verify-whatsapp-business-post-live.ts --to +15551234567 --text "Custom"
 *
 * Phone number MUST be in E.164 format with country code (no spaces, no dashes).
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
