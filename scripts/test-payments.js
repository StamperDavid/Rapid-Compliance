#!/usr/bin/env node

/**
 * Payment Testing Script
 * Tests Stripe integration WITHOUT spending real money
 * 
 * Usage:
 *   node scripts/test-payments.js
 * 
 * Requirements:
 *   - STRIPE_SECRET_KEY must be a TEST key (sk_test_...)
 *   - Server must be running on localhost:3000
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}\n${colors.cyan}${msg}${colors.reset}\n${colors.cyan}${'='.repeat(60)}${colors.reset}\n`),
};

// Test card numbers
const TEST_CARDS = {
  success: '4242424242424242',
  declined: '4000000000000002',
  insufficientFunds: '4000000000009995',
  expiredCard: '4000000000000069',
  incorrectCvc: '4000000000000127',
};

async function testPaymentIntentCreation() {
  log.section('Test 1: Create Payment Intent');
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2000, // $20.00
      currency: 'usd',
      payment_method_types: ['card'],
      description: 'Test payment - DO NOT CHARGE',
      metadata: {
        test: 'true',
        environment: 'test',
      },
    });

    log.success(`Payment Intent created: ${paymentIntent.id}`);
    log.info(`Status: ${paymentIntent.status}`);
    log.info(`Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
    
    return paymentIntent;
  } catch (error) {
    log.error(`Failed to create payment intent: ${error.message}`);
    throw error;
  }
}

async function testSuccessfulPayment() {
  log.section('Test 2: Successful Payment');
  
  try {
    // Create payment method with test card
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: TEST_CARDS.success,
        exp_month: 12,
        exp_year: 2034,
        cvc: '123',
      },
    });

    log.info(`Payment method created: ${paymentMethod.id}`);

    // Create and confirm payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // $10.00
      currency: 'usd',
      payment_method: paymentMethod.id,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      description: 'Test successful payment',
    });

    if (paymentIntent.status === 'succeeded') {
      log.success('Payment succeeded!');
      log.info(`Charge ID: ${paymentIntent.latest_charge}`);
      log.info(`Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
      return true;
    } else {
      log.error(`Payment status: ${paymentIntent.status}`);
      return false;
    }
  } catch (error) {
    log.error(`Payment failed: ${error.message}`);
    return false;
  }
}

async function testDeclinedCard() {
  log.section('Test 3: Declined Card');
  
  try {
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: TEST_CARDS.declined,
        exp_month: 12,
        exp_year: 2034,
        cvc: '123',
      },
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
      payment_method: paymentMethod.id,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    });

    log.error('Card should have been declined but wasn\'t!');
    return false;
  } catch (error) {
    if (error.code === 'card_declined') {
      log.success('Card correctly declined');
      log.info(`Error message: ${error.message}`);
      return true;
    } else {
      log.error(`Unexpected error: ${error.message}`);
      return false;
    }
  }
}

async function testRefund() {
  log.section('Test 4: Refund Processing');
  
  try {
    // First create a successful charge
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: TEST_CARDS.success,
        exp_month: 12,
        exp_year: 2034,
        cvc: '123',
      },
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 5000, // $50.00
      currency: 'usd',
      payment_method: paymentMethod.id,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      description: 'Test charge for refund',
    });

    log.info(`Charge created: ${paymentIntent.latest_charge}`);

    // Now refund it
    const refund = await stripe.refunds.create({
      charge: paymentIntent.latest_charge,
      amount: 5000, // Full refund
      reason: 'requested_by_customer',
    });

    if (refund.status === 'succeeded') {
      log.success('Refund processed successfully');
      log.info(`Refund ID: ${refund.id}`);
      log.info(`Amount refunded: $${(refund.amount / 100).toFixed(2)}`);
      return true;
    } else {
      log.error(`Refund status: ${refund.status}`);
      return false;
    }
  } catch (error) {
    log.error(`Refund failed: ${error.message}`);
    return false;
  }
}

async function testSubscription() {
  log.section('Test 5: Subscription Creation');
  
  try {
    // Create a test customer
    const customer = await stripe.customers.create({
      email: 'test@example.com',
      description: 'Test customer for subscription',
      metadata: {
        test: 'true',
      },
    });

    log.info(`Customer created: ${customer.id}`);

    // Create a test price (if it doesn't exist)
    let price;
    try {
      const prices = await stripe.prices.list({
        limit: 1,
        active: true,
      });
      
      if (prices.data.length > 0) {
        price = prices.data[0];
        log.info(`Using existing price: ${price.id}`);
      } else {
        throw new Error('No prices found');
      }
    } catch (e) {
      // Create a test product and price
      const product = await stripe.products.create({
        name: 'Test Subscription Plan',
        description: 'Test plan for automated testing',
      });

      price = await stripe.prices.create({
        product: product.id,
        unit_amount: 999, // $9.99
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
      });

      log.info(`Created test price: ${price.id}`);
    }

    // Attach payment method to customer
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: TEST_CARDS.success,
        exp_month: 12,
        exp_year: 2034,
        cvc: '123',
      },
    });

    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: customer.id,
    });

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethod.id,
      },
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    log.success('Subscription created!');
    log.info(`Subscription ID: ${subscription.id}`);
    log.info(`Status: ${subscription.status}`);
    log.info(`Current period: ${new Date(subscription.current_period_start * 1000).toLocaleDateString()} - ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}`);

    // Clean up - cancel the subscription
    await stripe.subscriptions.cancel(subscription.id);
    log.info('Test subscription cancelled');

    return true;
  } catch (error) {
    log.error(`Subscription test failed: ${error.message}`);
    return false;
  }
}

async function checkTestMode() {
  log.section('Environment Check');
  
  const apiKey = process.env.STRIPE_SECRET_KEY;
  
  if (!apiKey) {
    log.error('STRIPE_SECRET_KEY not set in environment');
    return false;
  }

  if (!apiKey.startsWith('sk_test_')) {
    log.error('⚠️  WARNING: Not using test key! Key should start with sk_test_');
    log.error('Current key starts with: ' + apiKey.substring(0, 8) + '...');
    log.error('ABORTING to prevent real charges!');
    return false;
  }

  log.success('Using Stripe TEST mode ✓');
  log.info('All transactions will be simulated (no real money)');
  
  return true;
}

async function runAllTests() {
  console.log('\n');
  log.section('🧪 Stripe Payment Integration Tests');
  log.info('Testing payment flows WITHOUT spending real money\n');

  // Check we're in test mode
  const isTestMode = await checkTestMode();
  if (!isTestMode) {
    process.exit(1);
  }

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  const tests = [
    { name: 'Payment Intent Creation', fn: testPaymentIntentCreation },
    { name: 'Successful Payment', fn: testSuccessfulPayment },
    { name: 'Declined Card Handling', fn: testDeclinedCard },
    { name: 'Refund Processing', fn: testRefund },
    { name: 'Subscription Creation', fn: testSubscription },
  ];

  for (const test of tests) {
    results.total++;
    try {
      const passed = await test.fn();
      if (passed || passed === undefined) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      log.error(`Test "${test.name}" threw exception: ${error.message}`);
      results.failed++;
    }
  }

  // Summary
  log.section('Test Summary');
  log.info(`Total tests: ${results.total}`);
  log.success(`Passed: ${results.passed}`);
  if (results.failed > 0) {
    log.error(`Failed: ${results.failed}`);
  }

  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  console.log(`\nSuccess rate: ${successRate}%\n`);

  if (results.failed === 0) {
    log.success('🎉 All payment tests passed! Your Stripe integration is working.');
    log.info('💡 Next steps:');
    log.info('   1. Test the checkout UI in your browser');
    log.info('   2. Test webhook handling with Stripe CLI');
    log.info('   3. Test on staging environment');
    process.exit(0);
  } else {
    log.error('❌ Some tests failed. Review the errors above.');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

