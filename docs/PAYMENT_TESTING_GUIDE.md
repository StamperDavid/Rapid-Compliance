# Payment & Checkout Testing Guide

## 🎯 Testing WITHOUT Spending Money

Stripe provides a complete test mode that simulates real payments **without charging actual money**. All transactions are fake but behave identically to production.

---

## 🔑 Test Mode Setup

### 1. Get Test API Keys

In your Stripe Dashboard:
1. Toggle "Test Mode" in top right (should show a "TEST DATA" badge)
2. Go to Developers → API Keys
3. Copy your **test** keys:
   - `pk_test_...` (publishable key)
   - `sk_test_...` (secret key)

### 2. Configure Environment Variables

```bash
# In .env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_TEST_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_SECRET
STRIPE_WEBHOOK_SECRET=whsec_YOUR_TEST_WEBHOOK_SECRET
```

---

## 💳 Test Card Numbers

Stripe provides special card numbers that simulate different scenarios:

### ✅ Successful Payments

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Visa - Always succeeds |
| `5555 5555 5555 4444` | Mastercard - Always succeeds |
| `3782 822463 10005` | American Express - Always succeeds |
| `6011 1111 1111 1117` | Discover - Always succeeds |

**Use ANY future expiry date (e.g., 12/34)**  
**Use ANY 3-digit CVC (e.g., 123)**  
**Use ANY ZIP code (e.g., 12345)**

### ❌ Test Failures

| Card Number | Scenario |
|-------------|----------|
| `4000 0000 0000 0002` | Card declined (generic) |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 0127` | Incorrect CVC |
| `4000 0000 0000 0119` | Processing error |

### 🔐 Test 3D Secure (SCA)

| Card Number | Scenario |
|-------------|----------|
| `4000 0025 0000 3155` | Requires authentication (always succeeds) |
| `4000 0000 0000 3220` | Requires authentication (always fails) |

---

## 🧪 Testing Checklist

### 1. Basic Checkout Flow

```bash
# Test successful payment
1. Navigate to /checkout or payment page
2. Enter test card: 4242 4242 4242 4242
3. Expiry: 12/34, CVC: 123, ZIP: 12345
4. Submit payment
5. ✅ Verify success page appears
6. ✅ Check Stripe dashboard for payment
7. ✅ Check database for order record
```

### 2. Failed Payment Handling

```bash
# Test card declined
1. Use card: 4000 0000 0000 0002
2. Submit payment
3. ✅ Verify error message shown
4. ✅ Verify no order created in database
5. ✅ Verify user can retry
```

### 3. Subscription Testing

```bash
# Test recurring subscription
1. Choose a subscription plan
2. Enter test card: 4242 4242 4242 4242
3. Submit
4. ✅ Verify subscription created in Stripe
5. ✅ Verify customer can access features
6. ✅ Test cancellation flow
```

### 4. Webhook Testing

```bash
# Test payment success webhook
1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Forward webhooks to local: stripe listen --forward-to localhost:3000/api/billing/webhook
3. Make a test payment
4. ✅ Verify webhook received in terminal
5. ✅ Verify webhook handler processes event
6. ✅ Check logs for successful processing
```

---

## 🚀 Automated Test Script

Run the automated payment test suite:

```bash
npm run test:payments
```

This tests:
- ✅ Payment intent creation
- ✅ Successful charge
- ✅ Declined card handling
- ✅ Refund processing
- ✅ Subscription creation
- ✅ Webhook handling

---

## 🔍 Debugging Test Payments

### View Test Payments in Stripe Dashboard

1. Go to https://dashboard.stripe.com/test/payments
2. Toggle "Test Mode" ON
3. See all test transactions (clearly marked as TEST)

### Common Issues

**❌ "No such customer"**
- Using production key in test mode (or vice versa)
- Check your environment variables

**❌ "Invalid API key"**
- Webhook secret doesn't match
- Regenerate webhook secret in test mode

**❌ Webhook not receiving events**
- Use Stripe CLI for local development
- Or use ngrok to expose localhost

---

## 📊 Test Scenarios to Cover

### Critical Paths
- [ ] Successful one-time payment
- [ ] Successful subscription creation
- [ ] Card declined (generic)
- [ ] Insufficient funds
- [ ] Expired card
- [ ] Incorrect CVC
- [ ] 3D Secure authentication
- [ ] Refund processing
- [ ] Subscription cancellation
- [ ] Subscription upgrade/downgrade
- [ ] Payment method update

### Edge Cases
- [ ] Multiple rapid payments (rate limiting)
- [ ] Duplicate payment prevention
- [ ] Network timeout during payment
- [ ] Webhook failure & retry
- [ ] Partial refunds
- [ ] Disputed charges

### Security Tests
- [ ] Invalid amount (negative, zero)
- [ ] Tampered payment intent
- [ ] Expired payment intent
- [ ] Cross-organization payment attempt
- [ ] Webhook signature verification

---

## 🎓 Stripe Test Mode Features

### What's Simulated (FREE)
✅ Card processing  
✅ Bank transfers  
✅ Subscriptions  
✅ Invoices  
✅ Refunds  
✅ Disputes  
✅ Webhooks  
✅ 3D Secure authentication  
✅ Fraud detection  

### What's Different
- Instant settlement (vs 2-7 days in production)
- No real bank communication
- All data clearly marked as "TEST"
- Can be reset/cleared anytime

---

## 🛠️ Stripe CLI Commands

```bash
# Listen for webhooks locally
stripe listen --forward-to localhost:3000/api/billing/webhook

# Trigger specific webhook events
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
stripe trigger charge.refunded

# Create test payment
stripe payment_intents create --amount=2000 --currency=usd

# List test payments
stripe payment_intents list --limit=10

# Refund a payment
stripe refunds create --payment-intent=pi_xxx
```

---

## 📝 Test Checklist Summary

Before launching to production:

**Payment Flow**
- [ ] Successful payment creates order
- [ ] Failed payment shows error
- [ ] User can retry after failure
- [ ] Payment confirmation email sent
- [ ] Receipt generated

**Subscriptions**
- [ ] New subscription created correctly
- [ ] Customer can cancel
- [ ] Webhook updates subscription status
- [ ] Prorated upgrades work
- [ ] Failed payment retries configured

**Security**
- [ ] Webhook signatures verified
- [ ] Payment intents validated
- [ ] HTTPS enforced (in production)
- [ ] Amounts validated server-side
- [ ] Cross-organization checks

**Error Handling**
- [ ] Network failures handled gracefully
- [ ] Webhook failures logged
- [ ] Users notified of payment issues
- [ ] Support team alerted on critical errors

---

## 🚀 Going to Production

When ready to accept real payments:

1. **Switch to live keys:**
   ```bash
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   ```

2. **Update webhook endpoint** in Stripe Dashboard (live mode)

3. **Test with $0.50 real charge** to verify everything works

4. **Monitor first few transactions** closely

5. **Set up alerts** for failed payments

---

## 💡 Pro Tips

1. **Use Stripe CLI** for webhook testing - it's way easier than ngrok
2. **Test on mobile** - payment forms behave differently on phones
3. **Test all card brands** - Amex has different validation rules
4. **Simulate slow networks** - use Chrome DevTools throttling
5. **Test with real email** - verify confirmation emails work

---

## 📚 Resources

- [Stripe Test Cards](https://stripe.com/docs/testing)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Webhook Testing](https://stripe.com/docs/webhooks/test)
- [Payment Intents API](https://stripe.com/docs/api/payment_intents)



