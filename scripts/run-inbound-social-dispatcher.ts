/**
 * Manually run the inbound-social-dispatcher logic without going
 * through the Vercel cron HTTP route. Useful for tests + on-demand
 * dispatch when the cron's 1-minute interval is too slow.
 *
 * Reads the same Firestore collection, generates the same LLM-backed
 * reply, sends through the same X API path. Marks events processed
 * the same way.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

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

import { OpenRouterProvider } from '../src/lib/ai/openrouter-provider';
import { getBrandDNA } from '../src/lib/brand/brand-dna-service';

const PLATFORM_ID = 'rapid-compliance-root';

interface TwitterCreds {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27')
    .replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function buildOAuth1Header(method: string, url: string, creds: TwitterCreds): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };
  const paramString = Object.keys(oauthParams).sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`).join('&');
  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.accessTokenSecret)}`;
  oauthParams.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  return `OAuth ${Object.keys(oauthParams).sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`).join(', ')}`;
}

async function loadTwitterCreds(): Promise<TwitterCreds | null> {
  const db = admin.firestore();
  const snap = await db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  if (!snap.exists) { return null; }
  const data = snap.data() as Record<string, unknown>;
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;
  const tw = (social.twitter && typeof social.twitter === 'object' ? social.twitter : {}) as Record<string, unknown>;
  const out: TwitterCreds = {
    consumerKey: String(tw.consumerKey ?? ''),
    consumerSecret: String(tw.consumerSecret ?? ''),
    accessToken: String(tw.accessToken ?? ''),
    accessTokenSecret: String(tw.accessTokenSecret ?? ''),
  };
  return out.consumerKey && out.consumerSecret && out.accessToken && out.accessTokenSecret ? out : null;
}

async function generateReplyText(inboundText: string): Promise<string> {
  const brand = await getBrandDNA();
  const brandDescription = brand?.companyDescription ?? 'SalesVelocity.ai — an AI agent swarm for sales and marketing.';
  const tone = brand?.toneOfVoice ?? 'professional yet approachable';
  const avoid = brand?.avoidPhrases?.join('", "') ?? '';

  const systemPrompt = [
    `You are the brand X / Twitter DM responder for ${brandDescription}`,
    `Tone: ${tone}`,
    avoid ? `Never use these phrases: "${avoid}"` : '',
    'Reply rules:',
    '- One short paragraph, 1-3 sentences, under 240 characters total.',
    '- Acknowledge what the sender said specifically (do not be generic).',
    '- If the sender is asking about the product, give a concrete one-line answer + a single next step (e.g., "DM me your use case and I will tell you which agents fit").',
    '- If the sender is being adversarial / spam / off-topic, decline politely and stop.',
    '- Never offer pricing in DMs — direct them to https://www.salesvelocity.ai for pricing.',
    '- Never make up product features that have not been described to you.',
    '- No marketing-speak ("revolutionary", "industry-leading"), no exclamation overload, no emojis.',
    '- Plain text only. No links unless the user explicitly asked where to find something.',
    'Respond with ONLY the reply text — no JSON, no preamble, no quotes.',
  ].filter(Boolean).join('\n');

  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: 'claude-sonnet-4.6',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Inbound DM from a prospect:\n\n${inboundText}\n\nWrite the reply.` },
    ],
    temperature: 0.6,
    maxTokens: 300,
  });
  return (response.content ?? '').trim();
}

async function sendDirectMessage(creds: TwitterCreds, recipientId: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = `https://api.twitter.com/2/dm_conversations/with/${encodeURIComponent(recipientId)}/messages`;
  const auth = buildOAuth1Header('POST', url, creds);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const responseText = await response.text();
  if (!response.ok) { return { success: false, error: `HTTP ${response.status} ${responseText.slice(0, 300)}` }; }
  try {
    const parsed = JSON.parse(responseText) as { data?: { dm_event_id?: string } };
    return { success: true, messageId: parsed.data?.dm_event_id };
  } catch { return { success: true }; }
}

async function main(): Promise<void> {
  const creds = await loadTwitterCreds();
  if (!creds) { console.error('Twitter creds missing'); process.exit(1); }
  const db = admin.firestore();
  // Single-where to avoid needing a composite index. Filter client-side.
  const rawSnap = await db
    .collection(`organizations/${PLATFORM_ID}/inboundSocialEvents`)
    .where('provider', '==', 'twitter')
    .get();
  const unprocessedDocs = rawSnap.docs.filter((d) => {
    const data = d.data() as { processed?: boolean };
    return data.processed !== true;
  }).slice(0, 20);
  console.log(`Found ${rawSnap.size} total twitter events, ${unprocessedDocs.length} unprocessed`);
  const snap = { docs: unprocessedDocs };

  let replied = 0, skipped = 0, failed = 0;
  for (const doc of snap.docs) {
    const event = doc.data() as { id: string; kind: string; payload: { for_user_id?: string; direct_message_events?: Array<{ message_create?: { sender_id?: string; message_data?: { text?: string } } }> } };
    const updateNow = new Date().toISOString();

    if (event.kind !== 'direct_message_events') {
      await doc.ref.update({ processed: true, processedAt: updateNow, skippedReason: `Kind=${event.kind} not auto-handled` });
      console.log(`  ${event.id}: skipped (kind=${event.kind})`);
      skipped++;
      continue;
    }

    const dmEvents = event.payload.direct_message_events ?? [];
    const ourId = event.payload.for_user_id;
    const dm = dmEvents.find((d) => d.message_create?.sender_id !== ourId && d.message_create?.message_data?.text);
    if (!dm?.message_create) {
      await doc.ref.update({ processed: true, processedAt: updateNow, skippedReason: 'No reply-eligible DM' });
      console.log(`  ${event.id}: skipped (self-loop or empty)`);
      skipped++;
      continue;
    }

    const senderId = dm.message_create.sender_id;
    const inboundText = dm.message_create.message_data?.text;
    if (!senderId || !inboundText) {
      await doc.ref.update({ processed: true, processedAt: updateNow, skippedReason: 'Missing sender or text' });
      skipped++;
      continue;
    }

    try {
      console.log(`  ${event.id}: generating reply for "${inboundText.slice(0, 50)}"`);
      const replyText = await generateReplyText(inboundText);
      console.log(`    LLM reply: "${replyText}"`);

      const sendResult = await sendDirectMessage(creds, senderId, replyText);
      if (!sendResult.success) {
        await doc.ref.update({ processed: true, processedAt: updateNow, error: sendResult.error });
        console.log(`    SEND FAILED: ${sendResult.error}`);
        failed++;
        continue;
      }

      await doc.ref.update({
        processed: true,
        processedAt: updateNow,
        reply: { text: replyText, sentAt: updateNow, messageId: sendResult.messageId ?? null },
      });
      console.log(`    SENT — message id ${sendResult.messageId}`);
      replied++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await doc.ref.update({ processed: true, processedAt: updateNow, error: msg });
      console.log(`    ERROR: ${msg}`);
      failed++;
    }
  }

  console.log(`\nReplied=${replied}  Skipped=${skipped}  Failed=${failed}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
