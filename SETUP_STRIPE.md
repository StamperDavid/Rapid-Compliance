# Stripe Setup Guide - Required for Pricing Model

## Prerequisites
You need a Stripe account. Sign up at https://stripe.com if you don't have one.

---

## Step 1: Get Your API Keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)

Add to `.env`:
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
```

---

## Step 2: Create Pricing Products

### Create Tier 1
1. Go to https://dashboard.stripe.com/test/products
2. Click "Add product"
3. Product details:
   - **Name:** Tier 1 - Growth Partner
   - **Description:** 0-100 records, all features included
4. Pricing:
   - **Price:** $400.00 USD
   - **Billing period:** Monthly
   - **Recurring:** Yes
5. Click "Add product"
6. **Copy the Price ID** (starts with `price_`)
7. Add to `.env`: `STRIPE_PRICE_ID_TIER1=price_xxxxx`

### Create Tier 2
1. Repeat above process
2. **Name:** Tier 2 - Growth Partner
3. **Description:** 101-250 records, all features included
4. **Price:** $650.00 USD / Monthly
5. **Copy Price ID** → `STRIPE_PRICE_ID_TIER2=price_xxxxx`

### Create Tier 3
1. **Name:** Tier 3 - Growth Partner
2. **Description:** 251-500 records, all features included
3. **Price:** $1,000.00 USD / Monthly
4. **Copy Price ID** → `STRIPE_PRICE_ID_TIER3=price_xxxxx`

### Create Tier 4
1. **Name:** Tier 4 - Growth Partner
2. **Description:** 501-1,000 records, all features included
3. **Price:** $1,250.00 USD / Monthly
4. **Copy Price ID** → `STRIPE_PRICE_ID_TIER4=price_xxxxx`

---

## Step 3: Set Up Webhook Endpoint

### Create Webhook
1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. **Endpoint URL:** `https://yourdomain.com/api/webhooks/stripe`
   - For local testing: Use ngrok or Stripe CLI
   - For production: Your actual domain
4. **Select events to listen to:**
   - `customer.subscription.trial_will_end`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. **Copy the Signing secret** (starts with `whsec_`)
7. Add to `.env`: `STRIPE_WEBHOOK_SECRET=whsec_xxxxx`

---

## Step 4: Test Webhook Locally (Optional)

### Using Stripe CLI
```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy the webhook signing secret from output
# Add to .env as STRIPE_WEBHOOK_SECRET
```

### Using ngrok
```bash
# Install ngrok: https://ngrok.com

# Start ngrok
ngrok http 3000

# Use ngrok URL for webhook endpoint
# https://xxxx.ngrok.io/api/webhooks/stripe
```

---

## Step 5: Verify Environment Variables

Your `.env` file should now have:

```env
# Stripe API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# Stripe Price IDs
STRIPE_PRICE_ID_TIER1=price_xxxxx
STRIPE_PRICE_ID_TIER2=price_xxxxx
STRIPE_PRICE_ID_TIER3=price_xxxxx
STRIPE_PRICE_ID_TIER4=price_xxxxx

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

---

## Step 6: Install Required Dependencies

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

Already done if you've pulled latest code!

---

## Step 7: Test the Flow

### Test Credit Card Numbers (Stripe Test Mode)
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Insufficient funds: 4000 0000 0000 9995
```

Use any:
- Future expiry date (12/25, 01/26, etc.)
- Any 3-digit CVC
- Any ZIP code

### Test Flow
1. Go to `/signup`
2. Select Tier 1
3. Enter account details
4. Enter test card: `4242 4242 4242 4242`
5. Submit
6. Should create:
   - Firebase user
   - Organization
   - Stripe customer
   - Stripe subscription (trialing status)
7. Check Stripe dashboard → Should see new customer with trial

### Test Trial End
1. In Stripe dashboard, find the subscription
2. Click "Actions" → "Advance clock" (test mode only)
3. Advance to 3 days before trial end
4. Webhook should fire: `trial_will_end`
5. Check logs - should count records and assign tier
6. Owner should receive email notification with tier assignment

---

## Step 8: Go Live (Production)

When ready for production:

1. Switch to **Live mode** in Stripe dashboard
2. Get **Live API keys** (starts with `pk_live_` and `sk_live_`)
3. Create **Live products** (same as test mode)
4. Create **Live webhook** endpoint
5. Update `.env.production` with live keys

---

## Email Notifications

The system automatically sends emails for:

### Trial Ending (3 days before)
- **Trigger:** `customer.subscription.trial_will_end` webhook
- **Recipient:** Organization owner
- **Content:** Tier assignment based on record count
- **Action:** Allows user to adjust records before billing

### Payment Failed
- **Trigger:** `invoice.payment_failed` webhook
- **Recipient:** Organization owner
- **Content:** Payment failure details and retry info
- **Action:** Prompts user to update payment method

**Email Provider Required:** Configure SendGrid, Resend, or SMTP in your organization settings for emails to send.

---

## Troubleshooting

### Webhook not firing?
- Check webhook logs in Stripe dashboard
- Verify signing secret matches `.env`
- Ensure endpoint is publicly accessible (ngrok for local)
- Check server logs for errors

### Payment failing?
- Verify Price IDs in `.env` match Stripe dashboard
- Check API keys are correct (publishable + secret)
- Ensure Stripe Elements loaded (check console)

### Subscription not creating?
- Check server logs for errors
- Verify `/api/billing/subscribe` route exists
- Test endpoint directly with Postman

### Emails not sending?
- Check email provider (SendGrid/Resend/SMTP) is configured
- Verify organization owner has valid email address
- Check server logs for email errors
- Test email service independently via `/api/email/send`

---

## Support

- Stripe Docs: https://stripe.com/docs
- Stripe Dashboard: https://dashboard.stripe.com
- Webhook Guide: https://stripe.com/docs/webhooks

