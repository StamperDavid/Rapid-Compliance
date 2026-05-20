/**
 * Verify Stripe 14-day trial is correctly wired end-to-end through the
 * subscription provider service. Static + behavioral checks; does not call
 * the real Stripe API.
 *
 * Updated May 19 2026 — single-product pricing model. No tiers.
 *
 * What this verifies:
 *   1. PRICING.trial.days is the value advertised in marketing copy.
 *   2. PRICING.monthlyPrice is the flat-rate price.
 *   3. subscription-provider-service.ts reads trial days from PRICING.trial.days.
 *   4. createStripeCheckout conditionally spreads subscription_data.trial_period_days.
 *   5. Stripe webhook tracks `paymentStatus = 'trialing'` and reads trial_end.
 *   6. invoice.payment_failed guarded against trialing state.
 *   7. Deleted tier files are actually gone (regression guard).
 *
 * What this does NOT verify:
 *   - That Stripe's API accepts and applies the payload (requires real test
 *     creds + an actual stripe.checkout.sessions.create call).
 *
 * Exit 0 on all checks pass, 1 otherwise.
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

const EXPECTED_TRIAL_DAYS = 14;
const EXPECTED_PRICE = 299;

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

const results: CheckResult[] = [];

// Check 1: PRICING.trial.days
const pricingPath = path.resolve(process.cwd(), 'src/lib/config/pricing.ts');
const pricingSrc = fs.readFileSync(pricingPath, 'utf-8');
const pricingTrialMatch = /trial\s*:\s*\{[^}]*days\s*:\s*(\d+)/.exec(pricingSrc);
if (pricingTrialMatch && Number(pricingTrialMatch[1]) === EXPECTED_TRIAL_DAYS) {
  results.push({ name: 'PRICING.trial.days', pass: true, detail: `= ${pricingTrialMatch[1]}` });
} else {
  results.push({
    name: 'PRICING.trial.days',
    pass: false,
    detail: pricingTrialMatch ? `found ${pricingTrialMatch[1]}, expected ${EXPECTED_TRIAL_DAYS}` : 'not found in pricing.ts',
  });
}

// Check 2: PRICING.monthlyPrice
const priceMatch = /monthlyPrice\s*:\s*(\d+)/.exec(pricingSrc);
if (priceMatch && Number(priceMatch[1]) === EXPECTED_PRICE) {
  results.push({ name: 'PRICING.monthlyPrice', pass: true, detail: `= $${priceMatch[1]}` });
} else {
  results.push({
    name: 'PRICING.monthlyPrice',
    pass: false,
    detail: priceMatch ? `found $${priceMatch[1]}, expected $${EXPECTED_PRICE}` : 'not found in pricing.ts',
  });
}

// Check 3: subscription-provider-service constants pull from PRICING
const svcPath = path.resolve(process.cwd(), 'src/lib/subscriptions/subscription-provider-service.ts');
const svcSrc = fs.readFileSync(svcPath, 'utf-8');
const constsReadPricing = /TRIAL_DAYS\s*=\s*PRICING\.trial\.days/.test(svcSrc)
  && /PRICE_CENTS\s*=\s*PRICING\.monthlyPrice/.test(svcSrc);
results.push({
  name: 'subscription-provider-service constants read PRICING',
  pass: constsReadPricing,
  detail: constsReadPricing
    ? 'TRIAL_DAYS + PRICE_CENTS sourced from PRICING'
    : 'expected `TRIAL_DAYS = PRICING.trial.days` + `PRICE_CENTS = PRICING.monthlyPrice * 100`',
});

// Check 4: createStripeCheckout conditionally spreads subscription_data.trial_period_days
const spreadsTrial = /trialDays\s*!==\s*undefined\s*\?\s*\{\s*subscription_data\s*:\s*\{\s*trial_period_days\s*:\s*trialDays\s*\}/.test(svcSrc);
results.push({
  name: 'createStripeCheckout spreads subscription_data.trial_period_days',
  pass: spreadsTrial,
  detail: spreadsTrial ? 'conditional spread present' : 'expected pattern not found',
});

// Check 5: Stripe webhook handler tracks trialing status + trial_end timestamp
const webhookPath = path.resolve(process.cwd(), 'src/app/api/webhooks/stripe/route.ts');
const webhookSrc = fs.readFileSync(webhookPath, 'utf-8');
const tracksTrialing = /paymentStatus[\s\S]{0,200}['"]trialing['"]/.test(webhookSrc);
const tracksTrialEnd = /trial_end/.test(webhookSrc);
results.push({
  name: 'Stripe webhook tracks paymentStatus="trialing"',
  pass: tracksTrialing,
  detail: tracksTrialing ? 'present' : 'missing — webhook must propagate trial state to user doc',
});
results.push({
  name: 'Stripe webhook reads trial_end timestamp',
  pass: tracksTrialEnd,
  detail: tracksTrialEnd ? 'present' : 'missing — webhook must persist trial_end on user doc',
});

// Check 6: invoice.payment_failed during trial does NOT downgrade
const guardsTrialFromPastDue = /isTrialing|stripeStatus\s*===\s*['"]trialing['"]/.test(webhookSrc);
results.push({
  name: 'invoice.payment_failed guarded against trialing state',
  pass: guardsTrialFromPastDue,
  detail: guardsTrialFromPastDue ? 'guard present' : 'missing — trial-end transition belongs to Stripe',
});

// Check 7: Deleted tier files are actually gone (regression guard)
const deletedPaths = [
  'src/lib/pricing/subscription-tiers.ts',
  'src/lib/middleware/tier-enforcement.ts',
  'src/app/(dashboard)/settings/billing/page.tsx',
  'src/app/(dashboard)/subscriptions/page.tsx',
  'tests/lib/pricing/subscription-tiers.test.ts',
];
for (const p of deletedPaths) {
  const abs = path.resolve(process.cwd(), p);
  const exists = fs.existsSync(abs);
  results.push({
    name: `Removed: ${p}`,
    pass: !exists,
    detail: exists ? 'STILL EXISTS — tier rip is incomplete' : 'deleted',
  });
}

// Report
console.log('\nStripe 14-day trial wire verification (single-product model):\n');
let allPassed = true;
for (const r of results) {
  const marker = r.pass ? '✓' : '✗';
  console.log(`  ${marker} ${r.name.padEnd(70)} ${r.detail}`);
  if (!r.pass) { allPassed = false; }
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} checks passed.\n`);

if (allPassed) {
  console.log('Static wire is correct. Live Stripe API test still required:');
  console.log('  Operator action: click "Start 14-day free trial" on /settings/billing,');
  console.log('  complete Stripe Checkout with a test card, return to billing, confirm:');
  console.log('  - Subscription shows status="trialing" with trial-end date');
  console.log('  - Stripe Dashboard shows the subscription with trial_period_days=14\n');
}

process.exit(allPassed ? 0 : 1);
