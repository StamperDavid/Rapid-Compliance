require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: 'rapid-compliance-65f87',
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();

function printKeys(obj, prefix) {
  if (!obj || typeof obj !== 'object') return;
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? prefix + '.' + key : key;
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date) && !val._seconds) {
      printKeys(val, path);
    } else if (typeof val === 'string' && val.length > 0) {
      console.log(path + ': ' + val.slice(0, 8) + '... (' + val.length + ' chars)');
    } else if (typeof val === 'string' && val.length === 0) {
      console.log(path + ': EMPTY STRING');
    } else if (val === null || val === undefined) {
      console.log(path + ': NULL');
    } else {
      console.log(path + ': ' + typeof val + ' = ' + JSON.stringify(val).slice(0, 50));
    }
  }
}

// Services that expect keys and where they look
const EXPECTED_KEYS = {
  'ai.openrouterApiKey': 'OpenRouter (Jasper LLM)',
  'ai.openaiApiKey': 'OpenAI (Sora video, GPT fallback)',
  'ai.anthropicApiKey': 'Anthropic (Claude direct)',
  'ai.geminiApiKey': 'Google Gemini',
  'video.heygen.apiKey': 'HeyGen (AI Avatar Video)',
  'video.sora.apiKey': 'Sora (Text-to-Video)',
  'video.runway.apiKey': 'Runway (Gen-3 Video)',
  'voice.elevenlabs.apiKey': 'ElevenLabs (Voice AI)',
  'voice.unrealSpeech.apiKey': 'Unreal Speech (TTS)',
  'enrichment.serperApiKey': 'Serper.dev (Google Search)',
  'enrichment.clearbitApiKey': 'Clearbit (Enrichment)',
  'enrichment.crunchbaseApiKey': 'Crunchbase (Company Data)',
  'enrichment.newsApiKey': 'NewsAPI (News)',
  'enrichment.rapidApiKey': 'RapidAPI (LinkedIn etc)',
  'enrichment.builtWithApiKey': 'BuiltWith (Tech Stack)',
  'seo.pagespeedApiKey': 'Google PageSpeed',
  'seo.dataforseoLogin': 'DataForSEO (login)',
  'seo.dataforseoPassword': 'DataForSEO (password)',
  'payments.stripe.secretKey': 'Stripe (Payments)',
  'payments.stripe.publicKey': 'Stripe (Public Key)',
  'payments.stripe.webhookSecret': 'Stripe (Webhook)',
  'email.sendgrid.apiKey': 'SendGrid (Email)',
  'email.resend.apiKey': 'Resend (Email)',
  'sms.twilio.accountSid': 'Twilio (SMS/Voice)',
  'sms.twilio.authToken': 'Twilio (Auth)',
  'sms.twilio.phoneNumber': 'Twilio (Phone)',
  'social.twitter.clientId': 'Twitter/X API',
  'social.linkedin.clientId': 'LinkedIn API',
  'integrations.slack.webhookUrl': 'Slack',
};

db.collection('organizations/rapid-compliance-root/apiKeys').doc('rapid-compliance-root').get().then(doc => {
  if (!doc.exists) { console.log('NO API KEYS DOCUMENT FOUND'); process.exit(1); }
  const data = doc.data();

  console.log('========================================');
  console.log('  FIRESTORE API KEYS AUDIT');
  console.log('========================================\n');

  console.log('--- WHAT IS STORED ---');
  printKeys(data, '');

  console.log('\n--- EXPECTED vs ACTUAL ---');
  for (const [path, label] of Object.entries(EXPECTED_KEYS)) {
    const parts = path.split('.');
    let val = data;
    for (const p of parts) {
      val = val ? val[p] : undefined;
    }
    const status = (typeof val === 'string' && val.length > 0)
      ? '  CONFIGURED  ' + val.slice(0, 8) + '...'
      : '  MISSING';
    const icon = status.includes('CONFIGURED') ? '[OK]' : '[--]';
    console.log(icon + ' ' + label.padEnd(35) + status);
  }

  process.exit(0);
}).catch(e => { console.error('Error:', e.message); process.exit(1); });
