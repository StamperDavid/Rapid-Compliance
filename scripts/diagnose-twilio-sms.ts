/**
 * READ-ONLY Twilio SMS diagnostic — captures WHY the live SMS send fails
 * without sending a single message. Hits only Twilio GET endpoints:
 *   - Account             → trial vs full, account status
 *   - IncomingPhoneNumbers → the SMS-capable from-numbers this account owns
 *   - OutgoingCallerIds    → numbers a TRIAL account is allowed to text
 *
 * Then it cross-checks the stored from-number + the intended test recipient
 * (OUTREACH_TEST_PHONE, default +12088718552) against those lists and prints a
 * plain-English verdict. NO SMS is sent. NO Twilio config is changed.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/diagnose-twilio-sms.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const TEST_PHONE = process.env.OUTREACH_TEST_PHONE ?? '+12088718552';

function basicAuth(sid: string, token: string): string {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
}

function mask(value: string): string {
  if (value.length <= 6) { return '***'; }
  return `${value.slice(0, 4)}…${value.slice(-2)} (len ${value.length})`;
}

async function twilioGet(sid: string, token: string, path: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}${path}`;
  const res = await fetch(url, { headers: { Authorization: basicAuth(sid, token) } });
  let body: unknown = null;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { ok: res.ok, status: res.status, body };
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

async function main(): Promise<void> {
  const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
  const { PLATFORM_ID } = await import('@/lib/constants/platform');

  console.log('=== Twilio SMS diagnostic (read-only, no send) ===\n');
  console.log('Intended test recipient (OUTREACH_TEST_PHONE):', TEST_PHONE, '\n');

  const raw: unknown = await apiKeyService.getServiceKey(PLATFORM_ID, 'twilio');
  if (raw == null || typeof raw !== 'object') {
    console.error('❌ No Twilio credentials found in Firestore for this platform. sendSMS would return "No SMS provider configured."');
    process.exit(1);
  }
  const keys = raw as Record<string, unknown>;
  const accountSid = typeof keys.accountSid === 'string' ? keys.accountSid : '';
  const authToken = typeof keys.authToken === 'string' ? keys.authToken : '';
  const storedFrom = typeof keys.phoneNumber === 'string' && keys.phoneNumber !== '' ? keys.phoneNumber : null;

  console.log('Stored credentials:');
  console.log('  accountSid   :', accountSid ? mask(accountSid) : '❌ MISSING');
  console.log('  authToken    :', authToken ? `present (${mask(authToken)})` : '❌ MISSING');
  console.log('  phoneNumber  :', storedFrom ?? '❌ NOT SET — this alone makes sendViaTwilio return "Twilio phone number not configured"');
  console.log('');

  if (!accountSid || !authToken) {
    console.error('❌ Cannot probe Twilio without both accountSid and authToken. Stop here.');
    process.exit(1);
  }

  // 1) Account: trial vs full
  const acct = await twilioGet(accountSid, authToken, '.json');
  if (!acct.ok) {
    console.error(`❌ Twilio account GET failed (HTTP ${acct.status}). Credentials may be invalid/revoked. Body:`, acct.body);
    process.exit(1);
  }
  const acctObj = acct.body as Record<string, unknown>;
  const acctType = typeof acctObj.type === 'string' ? acctObj.type : 'unknown';
  const acctStatus = typeof acctObj.status === 'string' ? acctObj.status : 'unknown';
  console.log('Account:');
  console.log('  type   :', acctType, acctType === 'Trial' ? '⚠️  TRIAL — can only text VERIFIED numbers (error 21608 otherwise)' : '');
  console.log('  status :', acctStatus);
  console.log('');

  // 2) Owned SMS-capable from-numbers
  const owned = await twilioGet(accountSid, authToken, '/IncomingPhoneNumbers.json');
  const ownedList = asArray((owned.body as Record<string, unknown> | null)?.incoming_phone_numbers);
  console.log(`Owned phone numbers (${ownedList.length}):`);
  for (const n of ownedList) {
    const cap = n.capabilities as Record<string, unknown> | undefined;
    console.log(`  ${String(n.phone_number)}  sms=${cap ? String(cap.sms) : '?'}`);
  }
  if (ownedList.length === 0) { console.log('  (none) — no number to send FROM'); }
  console.log('');

  // 3) Verified caller IDs (trial accounts may text these)
  const verified = await twilioGet(accountSid, authToken, '/OutgoingCallerIds.json');
  const verifiedList = asArray((verified.body as Record<string, unknown> | null)?.outgoing_caller_ids);
  const verifiedNumbers = verifiedList.map((v) => String(v.phone_number));
  console.log(`Verified caller IDs (${verifiedNumbers.length}):`, verifiedNumbers.length ? verifiedNumbers.join(', ') : '(none)');
  console.log('');

  // ── Verdict ────────────────────────────────────────────────────────────────
  const ownedNumbers = ownedList.map((n) => String(n.phone_number));
  const effectiveFrom = storedFrom ?? (ownedNumbers[0] ?? null);
  const fromIsOwned = effectiveFrom !== null && ownedNumbers.includes(effectiveFrom);
  const toIsVerified = verifiedNumbers.includes(TEST_PHONE);
  const toIsOwned = ownedNumbers.includes(TEST_PHONE);

  console.log('=== VERDICT ===');
  if (!storedFrom && ownedNumbers.length === 0) {
    console.log('Root cause: NO from-number. The Twilio key has no phoneNumber AND the account owns no numbers.');
    console.log('Fix: buy/configure an SMS-capable Twilio number and store it as the key\'s phoneNumber.');
  } else if (!storedFrom && ownedNumbers.length > 0) {
    console.log(`Root cause: the Twilio key has NO phoneNumber stored, so sendViaTwilio uses no "from".`);
    console.log(`  The account DOES own ${ownedNumbers.join(', ')} — store one of these as the key\'s phoneNumber.`);
  } else if (storedFrom && !fromIsOwned) {
    console.log(`Root cause: stored from-number ${storedFrom} is NOT in this account\'s owned numbers (${ownedNumbers.join(', ') || 'none'}).`);
    console.log('  Twilio would reject the send (wrong/foreign from-number). Use an owned number.');
  } else if (acctType === 'Trial' && !toIsVerified && !toIsOwned) {
    console.log(`Root cause: TRIAL account + recipient ${TEST_PHONE} is NOT a verified caller ID → Twilio error 21608.`);
    console.log(`  Fix (operator action, no code): verify ${TEST_PHONE} in Twilio Console → Phone Numbers → Verified Caller IDs,`);
    console.log('  OR upgrade the Twilio account out of trial. (Do NOT change A2P/consent config.)');
  } else {
    console.log('No blocking precondition detected from the read-only probes:');
    console.log(`  from=${effectiveFrom ?? 'n/a'} (owned=${fromIsOwned}), to=${TEST_PHONE} (verified=${toIsVerified}, owned=${toIsOwned}), account=${acctType}.`);
    console.log('  If the live send still fails, the real Twilio error string is in the FAILED report\'s errors[] —');
    console.log('  re-run the live verify script and print live.errors to capture the exact code.');
  }
}

main().catch((e) => { console.error('DIAGNOSTIC ERROR:', e instanceof Error ? e.message : String(e)); process.exit(1); });
