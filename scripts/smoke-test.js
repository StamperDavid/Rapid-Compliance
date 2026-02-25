/**
 * Full Smoke Test — hits every major feature on localhost:3000
 * Usage: node scripts/smoke-test.js
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const BASE = 'http://localhost:3000';
const ADMIN_UID = 'tR5mQzsdzTghmwdGSZtg6FLSg6s1'; // David Stamper

async function getIdToken() {
  const customToken = await admin.auth().createCustomToken(ADMIN_UID);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const data = await r.json();
  if (!data.idToken) throw new Error('Failed to get ID token: ' + JSON.stringify(data));
  return data.idToken;
}

async function hit(name, method, url, token, body) {
  try {
    const headers = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';

    const r = await fetch(`${BASE}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }

    const ok = r.ok || r.status === 304;
    return { name, ok, status: r.status, json, error: json?.error || json?.message };
  } catch (e) {
    return { name, ok: false, status: 0, error: e.message };
  }
}

async function hitPage(name, url) {
  try {
    const r = await fetch(`${BASE}${url}`, { redirect: 'manual' });
    // 200 = rendered, 307/302 = auth redirect (page exists but needs login)
    const ok = r.ok || r.status === 307 || r.status === 302;
    return { name, ok, status: r.status };
  } catch (e) {
    return { name, ok: false, status: 0, error: e.message };
  }
}

async function run() {
  console.log('\n=== FULL SMOKE TEST ===\n');
  console.log('Getting auth token...');
  const token = await getIdToken();
  console.log('Auth token obtained.\n');

  const results = [];

  // ============================================================
  // PAGES (check they exist - 200 or auth redirect = OK)
  // ============================================================
  console.log('--- Pages ---');
  const pages = [
    ['Login', '/login'],
    ['Dashboard', '/dashboard'],
    ['CRM Contacts', '/contacts'],
    ['CRM Pipeline', '/deals'],
    ['Email Campaigns', '/email/campaigns'],
    ['Outbound Sequences', '/outbound/sequences'],
    ['AI Agents Settings', '/settings/ai-agents'],
    ['API Keys Settings', '/settings/api-keys'],
    ['Voice Training', '/voice/training'],
    ['SEO Training', '/seo/training'],
    ['Content Video', '/content/video'],
    ['Social Media', '/social/activity'],
    ['E-commerce Orders', '/orders'],
    ['Mission Control', '/mission-control'],
    ['Forms', '/forms'],
    ['Website Builder', '/website/pages'],
    ['Analytics', '/analytics'],
    ['Social Command Center', '/social/command-center'],
    ['Settings', '/settings'],
  ];

  for (const [name, url] of pages) {
    const r = await hitPage(name, url);
    results.push(r);
    console.log(`  ${r.ok ? '[OK]' : '[!!]'} ${name}: ${r.status}`);
  }

  // ============================================================
  // API: API Keys
  // ============================================================
  console.log('\n--- API: API Keys ---');

  const r1 = await hit('Load API Keys', 'GET', '/api/settings/api-keys?PLATFORM_ID=rapid-compliance-root', token);
  results.push(r1);
  console.log(`  ${r1.ok ? '[OK]' : '[!!]'} Load API Keys: ${r1.status} (${r1.json?.keys ? Object.keys(r1.json.keys).length + ' keys' : r1.error})`);

  // Test individual keys via the test endpoint
  console.log('\n--- API: Key Validation ---');
  const keysToTest = ['openrouter', 'sendgrid', 'stripe_secret', 'elevenlabs', 'heygen', 'serper'];
  for (const svc of keysToTest) {
    const r = await hit(`Test ${svc}`, 'GET', `/api/settings/api-keys/test?PLATFORM_ID=rapid-compliance-root&service=${svc}`, token);
    results.push(r);
    console.log(`  ${r.json?.success ? '[OK]' : '[!!]'} ${svc}: ${r.json?.success ? 'PASS' : r.json?.error || r.status}`);
  }

  // ============================================================
  // API: CRM
  // ============================================================
  console.log('\n--- API: CRM ---');

  const crm1 = await hit('Contacts', 'GET', '/api/contacts?limit=5', token);
  results.push(crm1);
  console.log(`  ${crm1.ok ? '[OK]' : '[!!]'} Contacts: ${crm1.status}`);

  const crm2 = await hit('Pipeline Analytics', 'GET', '/api/analytics/pipeline', token);
  results.push(crm2);
  console.log(`  ${crm2.ok ? '[OK]' : '[!!]'} Pipeline Analytics: ${crm2.status}`);

  const crm3 = await hit('Admin Stats', 'GET', '/api/admin/stats', token);
  results.push(crm3);
  console.log(`  ${crm3.ok ? '[OK]' : '[!!]'} Admin Stats: ${crm3.status}`);

  // ============================================================
  // API: AI / Jasper
  // ============================================================
  console.log('\n--- API: AI / Jasper ---');

  // GET models list
  const ai0 = await hit('Jasper Models', 'GET', '/api/orchestrator/chat', token);
  results.push(ai0);
  console.log(`  ${ai0.ok ? '[OK]' : '[!!]'} Jasper Models: ${ai0.status}`);

  // POST chat
  const ai1 = await hit('Jasper Chat', 'POST', '/api/orchestrator/chat', token, {
    message: 'Hello Jasper, reply with just: Smoke test received.',
    context: 'admin',
    systemPrompt: 'You are Jasper, an AI assistant. Keep responses brief.',
    conversationHistory: [],
    modelId: 'google/gemini-2.0-flash-001',
  });
  results.push(ai1);
  console.log(`  ${ai1.ok ? '[OK]' : '[!!]'} Jasper Chat: ${ai1.status}`);

  // Agent config
  const ai2 = await hit('Agent Config', 'GET', '/api/agent/config', token);
  results.push(ai2);
  console.log(`  ${ai2.ok ? '[OK]' : '[!!]'} Agent Config: ${ai2.status}`);

  // ============================================================
  // API: Email
  // ============================================================
  console.log('\n--- API: Email ---');

  const em1 = await hit('Email Templates', 'GET', '/api/admin/templates', token);
  results.push(em1);
  console.log(`  ${em1.ok ? '[OK]' : '[!!]'} Email Templates: ${em1.status}`);

  const em2 = await hit('Email Campaigns', 'GET', '/api/email/campaigns', token);
  results.push(em2);
  console.log(`  ${em2.ok ? '[OK]' : '[!!]'} Email Campaigns: ${em2.status}`);

  // ============================================================
  // API: Voice / TTS
  // ============================================================
  console.log('\n--- API: Voice / TTS ---');

  // Get TTS providers info
  const tts0 = await hit('TTS Providers', 'GET', '/api/voice/tts?action=providers', token);
  results.push(tts0);
  console.log(`  ${tts0.ok ? '[OK]' : '[!!]'} TTS Providers: ${tts0.status}`);

  // ElevenLabs synthesis
  const tts1 = await hit('TTS ElevenLabs', 'POST', '/api/voice/tts', token, {
    text: 'Smoke test.',
    engine: 'elevenlabs',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
  });
  results.push(tts1);
  console.log(`  ${tts1.ok ? '[OK]' : '[!!]'} TTS ElevenLabs: ${tts1.status} ${tts1.error || ''}`);

  // Unreal synthesis
  const tts2 = await hit('TTS Unreal', 'POST', '/api/voice/tts', token, {
    text: 'Smoke test.',
    engine: 'unreal',
    voiceId: 'Scarlett',
  });
  results.push(tts2);
  console.log(`  ${tts2.ok ? '[OK]' : '[!!]'} TTS Unreal: ${tts2.status} ${tts2.error || ''}`);

  // ============================================================
  // API: Outbound
  // ============================================================
  console.log('\n--- API: Outbound ---');

  const ob1 = await hit('Sequences', 'GET', '/api/outbound/sequences', token);
  results.push(ob1);
  console.log(`  ${ob1.ok ? '[OK]' : '[!!]'} Sequences: ${ob1.status}`);

  // ============================================================
  // API: Workflows
  // ============================================================
  console.log('\n--- API: Workflows ---');

  const wf1 = await hit('Workflows', 'GET', '/api/workflows', token);
  results.push(wf1);
  console.log(`  ${wf1.ok ? '[OK]' : '[!!]'} Workflows: ${wf1.status}`);

  // ============================================================
  // API: Social
  // ============================================================
  console.log('\n--- API: Social ---');

  const so1 = await hit('Social Posts', 'GET', '/api/social/posts', token);
  results.push(so1);
  console.log(`  ${so1.ok ? '[OK]' : '[!!]'} Social Posts: ${so1.status}`);

  // ============================================================
  // API: Video
  // ============================================================
  console.log('\n--- API: Video ---');

  const v1 = await hit('Video Projects', 'GET', '/api/video/project/list', token);
  results.push(v1);
  console.log(`  ${v1.ok ? '[OK]' : '[!!]'} Video Projects: ${v1.status}`);

  const v2 = await hit('Video Voices', 'GET', '/api/video/voices', token);
  results.push(v2);
  console.log(`  ${v2.ok ? '[OK]' : '[!!]'} Video Voices: ${v2.status}`);

  // ============================================================
  // API: E-Commerce
  // ============================================================
  console.log('\n--- API: E-Commerce ---');

  const ec1 = await hit('Orders', 'GET', '/api/ecommerce/orders', token);
  results.push(ec1);
  console.log(`  ${ec1.ok ? '[OK]' : '[!!]'} Orders: ${ec1.status}`);

  const ec2 = await hit('Cart', 'GET', '/api/ecommerce/cart', token);
  results.push(ec2);
  console.log(`  ${ec2.ok ? '[OK]' : '[!!]'} Cart: ${ec2.status}`);

  // ============================================================
  // API: Forms
  // ============================================================
  console.log('\n--- API: Forms ---');

  const f1 = await hit('Forms', 'GET', '/api/forms', token);
  results.push(f1);
  console.log(`  ${f1.ok ? '[OK]' : '[!!]'} Forms: ${f1.status}`);

  // ============================================================
  // API: Swarm
  // ============================================================
  console.log('\n--- API: Swarm ---');

  const sw1 = await hit('Swarm Status', 'GET', '/api/admin/swarm/execute', token);
  results.push(sw1);
  console.log(`  ${sw1.ok ? '[OK]' : '[!!]'} Swarm Status: ${sw1.status}`);

  // ============================================================
  // API: Health
  // ============================================================
  console.log('\n--- API: Health ---');

  const h1 = await hit('Health', 'GET', '/api/health', token);
  results.push(h1);
  console.log(`  ${h1.ok ? '[OK]' : '[!!]'} Health: ${h1.status} ${h1.json?.status || ''}`);

  const h2 = await hit('Health Detailed', 'GET', '/api/health/detailed', token);
  results.push(h2);
  console.log(`  ${h2.ok ? '[OK]' : '[!!]'} Health Detailed: ${h2.status}`);

  // ============================================================
  // SUMMARY
  // ============================================================
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  console.log('\n=== RESULTS ===\n');
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log(`  TOTAL:  ${results.length}`);
  console.log(`  SCORE:  ${Math.round((passed / results.length) * 100)}%\n`);

  if (failed > 0) {
    console.log('  Failures:');
    results.filter(r => !r.ok).forEach(r => {
      console.log(`    [!!] ${r.name}: ${r.status} ${r.error || ''}`);
    });
    console.log('');
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
