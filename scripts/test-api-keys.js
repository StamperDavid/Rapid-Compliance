/**
 * Test all configured API keys by making real API calls.
 * Usage: node scripts/test-api-keys.js
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = admin.firestore();
const DOC = 'organizations/rapid-compliance-root/apiKeys/rapid-compliance-root';

async function run() {
  const doc = await db.doc(DOC).get();
  const d = doc.data();
  const results = [];

  // 1. OpenRouter
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${d.ai.openrouterApiKey}` },
    });
    results.push(['OpenRouter', r.ok ? 'PASS' : `FAIL (${r.status})`]);
  } catch (e) {
    results.push(['OpenRouter', `FAIL: ${e.message}`]);
  }

  // 2. SendGrid
  try {
    const r = await fetch('https://api.sendgrid.com/v3/scopes', {
      headers: { Authorization: `Bearer ${d.email.sendgrid.apiKey}` },
    });
    results.push(['SendGrid', r.ok ? 'PASS' : `FAIL (${r.status})`]);
  } catch (e) {
    results.push(['SendGrid', `FAIL: ${e.message}`]);
  }

  // 3. Stripe
  try {
    const r = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${d.payments.stripe.secretKey}` },
    });
    results.push(['Stripe', r.ok ? 'PASS' : `FAIL (${r.status})`]);
  } catch (e) {
    results.push(['Stripe', `FAIL: ${e.message}`]);
  }

  // 4. Twilio
  try {
    const { accountSid, authToken } = d.sms.twilio;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
    });
    results.push(['Twilio', r.ok ? 'PASS' : `FAIL (${r.status})`]);
  } catch (e) {
    results.push(['Twilio', `FAIL: ${e.message}`]);
  }

  // 5. ElevenLabs
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': d.voice.elevenlabs.apiKey },
    });
    results.push(['ElevenLabs', r.ok ? 'PASS' : `FAIL (${r.status})`]);
  } catch (e) {
    results.push(['ElevenLabs', `FAIL: ${e.message}`]);
  }

  // 6. Unreal Speech
  try {
    const r = await fetch('https://api.v7.unrealspeech.com/stream', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${d.voice.unrealSpeech.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Text: 'test',
        VoiceId: 'Scarlett',
        Bitrate: '192k',
        Speed: '0',
        Pitch: '1.00',
      }),
    });
    // 402 = payment required but auth succeeded
    results.push([
      'Unreal Speech',
      r.ok || r.status === 402 ? 'PASS (auth ok)' : `FAIL (${r.status})`,
    ]);
  } catch (e) {
    results.push(['Unreal Speech', `FAIL: ${e.message}`]);
  }

  // 7. HeyGen
  try {
    const r = await fetch('https://api.heygen.com/v2/user/remaining_quota', {
      headers: { 'X-Api-Key': d.video.heygen.apiKey },
    });
    results.push(['HeyGen', r.ok ? 'PASS' : `FAIL (${r.status})`]);
  } catch (e) {
    results.push(['HeyGen', `FAIL: ${e.message}`]);
  }

  // 8. Runway
  try {
    const r = await fetch('https://api.dev.runwayml.com/v1/tasks', {
      headers: {
        Authorization: `Bearer ${d.video.runway.apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
    });
    // 401/403 = bad key, anything else = auth worked
    results.push([
      'Runway',
      r.status !== 401 && r.status !== 403
        ? `PASS (auth ok, status ${r.status})`
        : `FAIL (${r.status})`,
    ]);
  } catch (e) {
    results.push(['Runway', `FAIL: ${e.message}`]);
  }

  // 9. Google PageSpeed
  try {
    const r = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://google.com&key=${d.seo.pagespeedApiKey}`
    );
    results.push(['PageSpeed', r.ok ? 'PASS' : `FAIL (${r.status})`]);
  } catch (e) {
    results.push(['PageSpeed', `FAIL: ${e.message}`]);
  }

  // 10. DataForSEO
  try {
    const creds = Buffer.from(
      `${d.seo.dataforseoLogin}:${d.seo.dataforseoPassword}`
    ).toString('base64');
    const r = await fetch(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${creds}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          { keyword: 'test', location_code: 2840, language_code: 'en' },
        ]),
      }
    );
    const data = await r.json();
    results.push([
      'DataForSEO',
      r.ok && data.status_code === 20000 ? 'PASS' : `FAIL (${data.status_message || r.status})`,
    ]);
  } catch (e) {
    results.push(['DataForSEO', `FAIL: ${e.message}`]);
  }

  // 11. Twitter/X (get bearer token using consumer key/secret)
  try {
    const tw = d.social.twitter;
    const basicAuth = Buffer.from(
      `${encodeURIComponent(tw.clientId)}:${encodeURIComponent(tw.clientSecret)}`
    ).toString('base64');
    const r = await fetch('https://api.twitter.com/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    results.push(['Twitter/X', r.ok ? 'PASS' : `FAIL (${r.status})`]);
  } catch (e) {
    results.push(['Twitter/X', `FAIL: ${e.message}`]);
  }

  // 12. Slack (test with dummy code exchange - invalid_code = creds valid)
  try {
    const slack = d.integrations?.slack;
    if (slack?.clientId && slack?.clientSecret) {
      const r = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: slack.clientId,
          client_secret: slack.clientSecret,
          code: 'test_dummy_code',
        }),
      });
      const data = await r.json();
      results.push([
        'Slack',
        data.error === 'invalid_code' ? 'PASS (creds valid)' : `FAIL (${data.error})`,
      ]);
    } else {
      results.push(['Slack', 'SKIP (no creds)']);
    }
  } catch (e) {
    results.push(['Slack', `FAIL: ${e.message}`]);
  }

  // Print results
  console.log('\n=== API KEY TEST RESULTS ===\n');
  let pass = 0;
  let fail = 0;
  for (const [name, status] of results) {
    const icon = status.startsWith('PASS') ? '[OK]' : '[!!]';
    if (status.startsWith('PASS')) pass++;
    else fail++;
    console.log(`  ${icon} ${name}: ${status}`);
  }
  console.log(`\n  Score: ${pass}/${pass + fail} passed\n`);

  process.exit(0);
}

run();
