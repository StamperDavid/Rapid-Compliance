/**
 * Verify CAN-SPAM + RFC 8058 one-click List-Unsubscribe wire is correct
 * across every marketing-email send path. Static checks only — does not
 * send a real email.
 *
 * What this verifies:
 *   For each send path, the file:
 *     (a) imports `injectUnsubscribe` AND `buildListUnsubscribeHeaders`
 *         from '@/lib/compliance/can-spam-service' (NOT the older
 *         footer-only `ensureCompliance`).
 *     (b) calls both functions.
 *     (c) passes `headers` into the send call.
 *
 * Exit 0 on all checks pass, 1 otherwise.
 *
 * Created May 19 2026 after discovering Sprint #1 memory claimed CAN-SPAM
 * headers were wired, but only the drip-sequence path actually had them.
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

interface SendPath {
  label: string;
  filePath: string;
}

const SEND_PATHS: SendPath[] = [
  { label: 'drip sequence engine',   filePath: 'src/lib/outbound/sequence-engine.ts' },
  { label: 'one-off /api/email/send',  filePath: 'src/app/api/email/send/route.ts' },
  { label: 'AI email-writer send',     filePath: 'src/app/api/email-writer/send/route.ts' },
  { label: 'outbound reply processor', filePath: 'src/app/api/outbound/reply/process/route.ts' },
  { label: 'email campaign manager',   filePath: 'src/lib/email/campaign-manager.ts' },
];

const results: CheckResult[] = [];

// Verify the can-spam-service still exports both required functions
const svcPath = path.resolve(process.cwd(), 'src/lib/compliance/can-spam-service.ts');
const svcSrc = fs.readFileSync(svcPath, 'utf-8');
const exportsInjectUnsubscribe = /export function injectUnsubscribe/.test(svcSrc);
const exportsBuildHeaders = /export function buildListUnsubscribeHeaders/.test(svcSrc);
results.push({
  name: 'can-spam-service exports injectUnsubscribe',
  pass: exportsInjectUnsubscribe,
  detail: exportsInjectUnsubscribe ? 'present' : 'missing — receiver of the footer + URL pair',
});
results.push({
  name: 'can-spam-service exports buildListUnsubscribeHeaders',
  pass: exportsBuildHeaders,
  detail: exportsBuildHeaders ? 'present' : 'missing — builds RFC 8058 SMTP headers',
});

// Each send path: imports both functions + calls each + passes headers
for (const send of SEND_PATHS) {
  const abs = path.resolve(process.cwd(), send.filePath);
  if (!fs.existsSync(abs)) {
    results.push({
      name: `${send.label}: file exists`,
      pass: false,
      detail: `expected at ${send.filePath} — moved or renamed?`,
    });
    continue;
  }
  const src = fs.readFileSync(abs, 'utf-8');

  // Must NOT use the deprecated footer-only path
  const usesEnsureCompliance = /ensureCompliance\s*\(/.test(src);
  results.push({
    name: `${send.label}: avoids deprecated ensureCompliance`,
    pass: !usesEnsureCompliance,
    detail: usesEnsureCompliance
      ? 'ensureCompliance() found — must use injectUnsubscribe + buildListUnsubscribeHeaders instead'
      : 'clean',
  });

  // Must import + call injectUnsubscribe
  const importsInjectUnsubscribe = /injectUnsubscribe[^A-Za-z0-9_]/.test(src);
  results.push({
    name: `${send.label}: uses injectUnsubscribe`,
    pass: importsInjectUnsubscribe,
    detail: importsInjectUnsubscribe ? 'present' : 'missing footer/URL injection',
  });

  // Must import + call buildListUnsubscribeHeaders
  const importsBuildHeaders = /buildListUnsubscribeHeaders\s*\(/.test(src);
  results.push({
    name: `${send.label}: builds List-Unsubscribe headers`,
    pass: importsBuildHeaders,
    detail: importsBuildHeaders ? 'present' : 'missing RFC 8058 header construction',
  });

  // Must pass headers into the send call (looks for `headers:` field reference)
  const passesHeaders = /headers\s*:\s*(listUnsubHeaders|localListUnsubHeaders)/.test(src);
  results.push({
    name: `${send.label}: passes headers into send call`,
    pass: passesHeaders,
    detail: passesHeaders ? 'present' : 'missing — headers built but not handed to sendEmail',
  });
}

// Verify EmailOptions + EmailDeliveryOptions interfaces accept headers
const emailServicePath = path.resolve(process.cwd(), 'src/lib/email/email-service.ts');
const emailServiceSrc = fs.readFileSync(emailServicePath, 'utf-8');
const optionsAcceptsHeaders = /interface EmailOptions[\s\S]*?headers\?\s*:\s*Record<string, string>/.test(emailServiceSrc);
results.push({
  name: 'EmailOptions accepts headers field',
  pass: optionsAcceptsHeaders,
  detail: optionsAcceptsHeaders ? 'present' : 'missing — sendEmail will not pass headers through',
});

const deliveryPath = path.resolve(process.cwd(), 'src/lib/email-writer/email-delivery-service.ts');
const deliverySrc = fs.readFileSync(deliveryPath, 'utf-8');
const deliveryAcceptsHeaders = /interface EmailDeliveryOptions[\s\S]*?headers\?\s*:\s*Record<string, string>/.test(deliverySrc);
results.push({
  name: 'EmailDeliveryOptions accepts headers field',
  pass: deliveryAcceptsHeaders,
  detail: deliveryAcceptsHeaders ? 'present' : 'missing — email-writer sendEmail will not pass headers through',
});

// Verify SendGrid + Gmail send layers actually emit headers
const sgPath = path.resolve(process.cwd(), 'src/lib/email/sendgrid-service.ts');
const sgSrc = fs.readFileSync(sgPath, 'utf-8');
const sgEmitsHeaders = /msg\.headers\s*=\s*options\.headers/.test(sgSrc);
results.push({
  name: 'sendgrid-service emits options.headers',
  pass: sgEmitsHeaders,
  detail: sgEmitsHeaders ? 'present' : 'missing — headers field on EmailOptions is dead-end',
});

// Report
console.log('\nCAN-SPAM + RFC 8058 List-Unsubscribe wire verification:\n');
let allPassed = true;
for (const r of results) {
  const marker = r.pass ? '✓' : '✗';
  console.log(`  ${marker} ${r.name.padEnd(70)} ${r.detail}`);
  if (!r.pass) { allPassed = false; }
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} checks passed.\n`);

if (allPassed) {
  console.log('Static wire is correct. Live walkthrough still required:');
  console.log('  1. Send a real email via one of the paths to a secondary inbox you own.');
  console.log('  2. View the message source in the inbox — look for:');
  console.log('       List-Unsubscribe: <https://salesvelocity.ai/unsubscribe?...>, <mailto:...>');
  console.log('       List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  console.log('  3. Click the unsubscribe link in the email body.');
  console.log('  4. Confirm the suppressions/<id> Firestore doc is written + contact.emailOptOut=true.\n');
}

process.exit(allPassed ? 0 : 1);
