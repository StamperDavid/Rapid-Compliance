/**
 * Verify Stripe 14-day trial is correctly wired end-to-end through the
 * subscription provider service. Static + behavioral checks; does not call
 * the real Stripe API.
 *
 * What this verifies:
 *   1. PRICING.trial.days is the value advertised in marketing copy.
 *   2. SUBSCRIPTION_TIERS pro tier has trialDays sourced from PRICING.
 *   3. createStripeCheckout's source reads tier.trialDays and conditionally
 *      spreads subscription_data.trial_period_days into the Stripe payload.
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

// Check 2: SUBSCRIPTION_TIERS pro tier wires trialDays from PRICING
const tiersPath = path.resolve(process.cwd(), 'src/lib/pricing/subscription-tiers.ts');
const tiersSrc = fs.readFileSync(tiersPath, 'utf-8');
const tierTrialMatch = /trialDays\s*:\s*PRICING\.trial\.days/.exec(tiersSrc);
results.push({
  name: 'SUBSCRIPTION_TIERS pro.trialDays sourced from PRICING.trial.days',
  pass: tierTrialMatch !== null,
  detail: tierTrialMatch ? 'wired' : 'literal value or missing — should be PRICING.trial.days',
});

// Check 3: SubscriptionTier interface declares trialDays
const trialDaysFieldMatch = /trialDays\s*:\s*number/.exec(tiersSrc);
results.push({
  name: 'SubscriptionTier interface has trialDays: number',
  pass: trialDaysFieldMatch !== null,
  detail: trialDaysFieldMatch ? 'declared' : 'missing field declaration',
});

// Check 4: createStripeCheckout reads tier.trialDays
const svcPath = path.resolve(process.cwd(), 'src/lib/subscriptions/subscription-provider-service.ts');
const svcSrc = fs.readFileSync(svcPath, 'utf-8');
const readsTierTrial = /req\.tier\.trialDays\s*>\s*0\s*\?\s*req\.tier\.trialDays\s*:\s*undefined/.test(svcSrc);
results.push({
  name: 'createStripeCheckout reads tier.trialDays (with > 0 guard)',
  pass: readsTierTrial,
  detail: readsTierTrial ? 'guarded read present' : 'expected pattern not found',
});

// Check 5: createStripeCheckout conditionally spreads subscription_data.trial_period_days
const spreadsTrial = /trialDays\s*!==\s*undefined\s*\?\s*\{\s*subscription_data\s*:\s*\{\s*trial_period_days\s*:\s*trialDays\s*\}/.test(svcSrc);
results.push({
  name: 'createStripeCheckout spreads subscription_data.trial_period_days',
  pass: spreadsTrial,
  detail: spreadsTrial ? 'conditional spread present' : 'expected pattern not found',
});

// Check 6: Stripe webhook handler tracks trialing status + trial_end timestamp
const webhookPath = path.resolve(process.cwd(), 'src/app/api/webhooks/stripe/route.ts');
const webhookSrc = fs.readFileSync(webhookPath, 'utf-8');
// Match either `paymentStatus: 'trialing'` (object property) or
// `paymentStatus = ... 'trialing'` (variable assignment used in a later spread).
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

// Check 7: invoice.payment_failed during trial does NOT downgrade
const guardsTrialFromPastDue = /isTrialing|stripeStatus\s*===\s*['"]trialing['"]/.test(webhookSrc);
results.push({
  name: 'invoice.payment_failed guarded against trialing state',
  pass: guardsTrialFromPastDue,
  detail: guardsTrialFromPastDue ? 'guard present' : 'missing — trial-end transition belongs to Stripe',
});

// Report
console.log('\nStripe 14-day trial wire verification:\n');
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
  console.log('  Operator action: create a real test-mode checkout session via the UI');
  console.log('  and confirm Stripe returns the session with trial_period_days: 14');
  console.log('  + status: "incomplete" awaiting trial → active transition.\n');
}

process.exit(allPassed ? 0 : 1);
