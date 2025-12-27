# Testing Guide - Volume-Based Pricing Model

## ✅ Pre-Deployment Checklist

Before going live, complete these tests:

---

## 1. Stripe Setup Verification

- [ ] Created 4 products in Stripe Dashboard (Tier 1-4)
- [ ] Copied all 4 Price IDs to `.env`
- [ ] Set up webhook endpoint
- [ ] Copied webhook secret to `.env`
- [ ] Tested webhook locally (Stripe CLI or ngrok)
- [ ] Installed dependencies: `npm install @stripe/stripe-js @stripe/react-stripe-js`

**Reference:** See `SETUP_STRIPE.md` for step-by-step instructions

---

## 2. Admin Pricing Management Test

**Goal:** Verify you can update pricing without code

### Steps:
1. Navigate to `/admin/pricing-tiers`
2. Change Tier 1 price from $400 → $420
3. Click "Save Pricing Changes"
4. Verify success message appears
5. Go to `/pricing` (public page)
6. Confirm Tier 1 shows $420
7. Ask AI agent: "How much does your platform cost?"
8. Verify agent knows the new $420 price
9. Change back to $400 and save
10. Verify everything updates again

**Expected Result:** ✅ Pricing updates everywhere without code changes

---

## 3. Signup Flow with Card Collection

**Goal:** Verify trial requires credit card

### Steps:
1. Go to `/signup`
2. Select Tier 1 ($400/mo)
3. Enter account details:
   - Email: test@example.com
   - Password: TestPass123!
   - Company: Test Company
4. **New Step:** Enter test credit card:
   - Number: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - ZIP: `12345`
5. Submit form
6. Verify:
   - Account created successfully
   - Redirected to `/workspace/{orgId}/onboarding`
7. Check Stripe Dashboard:
   - New customer created
   - Subscription status: `trialing`
   - Trial end date: 14 days from now
   - Payment method attached

**Expected Result:** ✅ Cannot start trial without credit card

---

## 4. Record Capacity Tracking

**Goal:** Verify system tracks record count accurately

### Steps:
1. Log into test account
2. Go to `/workspace/{orgId}/crm`
3. Manually create 10 contacts
4. Go to `/workspace/{orgId}/settings/billing`
5. Verify record count shows: **10 / 100 records**
6. Go back to CRM
7. Import CSV with 50 contacts
8. Return to billing page
9. Verify record count shows: **60 / 100 records**
10. Delete 20 contacts
11. Verify record count shows: **40 / 100 records**

**Expected Result:** ✅ Record count updates in real-time

---

## 5. Capacity Blocking Test

**Goal:** Verify imports are blocked when over capacity

### Steps:
1. In Tier 1 account (100 record limit)
2. Manually create or import 95 contacts
3. Prepare CSV with 20 new contacts
4. Attempt to import
5. Should see error: 
   > ⚠️ Cannot import 20 records. Would exceed capacity (115 > 100). Upgrade to Tier 2 ($650/mo) required.
6. Import should be blocked
7. Verify record count still at 95

**Expected Result:** ✅ System blocks over-capacity imports

---

## 6. Trial-End Auto-Billing Test

**Goal:** Verify correct tier assignment at trial end

### Setup:
- Use Stripe Test Mode
- Need Stripe CLI or Dashboard access

### Steps:

**Option A: Stripe CLI (Fastest)**
```bash
# Find subscription ID from dashboard
stripe subscriptions update sub_xxxxx --trial_end now

# Watch webhook fire
# Check logs
```

**Option B: Stripe Dashboard**
1. Go to Stripe Dashboard → Subscriptions
2. Find test subscription
3. Click "Actions" → "End trial"
4. Confirm

**Option C: Wait 14 Days** (Not recommended!)

### Verification:
1. After trial ends, check webhook logs
2. Should see: `customer.subscription.trial_will_end` event
3. System should:
   - Count org's total records
   - Assign appropriate tier (e.g., 150 records → Tier 2)
   - Update Stripe subscription
   - Send email notification
4. Check Stripe Dashboard:
   - Subscription status: `active`
   - Plan: Tier 2 ($650/mo)
   - Next payment scheduled

**Expected Result:** ✅ Auto-assigned to correct tier based on record count

---

## 7. All Features Accessible Test

**Goal:** Verify no feature gating (everyone gets everything)

### Test on Tier 1 Account ($400/mo, lowest tier):

- [ ] Create email sequence
- [ ] Generate AI email
- [ ] Enroll contacts in sequence
- [ ] Schedule meeting
- [ ] Use reply handler
- [ ] Create workflow
- [ ] Access API
- [ ] Use white-label settings
- [ ] Social media AI tools
- [ ] Lead enrichment

**Expected Result:** ✅ ALL features work on Tier 1 (no "upgrade required" messages)

---

## 8. Tier Upgrade Scenario

**Goal:** Verify smooth tier transitions

### Steps:
1. Start with Tier 1 account (40 records)
2. Import 70 more records (total: 110)
3. Check billing page
4. Should show: **110 / 100 records** (over capacity)
5. System should notify: "Upgrade to Tier 2 required"
6. Customer upgrades subscription
7. Billing page shows: **110 / 250 records**
8. Stripe charges difference prorated

**Expected Result:** ✅ Seamless upgrade process

---

## 9. Payment Failure Test

**Goal:** Verify graceful handling of failed payments

### Steps:
1. Create test subscription
2. Use decline test card: `4000 0000 0000 0002`
3. OR in Stripe Dashboard: Simulate payment failure
4. Webhook `invoice.payment_failed` should fire
5. Check organization status
6. Should be marked: `past_due`
7. User should see warning banner

**Expected Result:** ✅ Subscription marked past_due, access potentially restricted

---

## 10. Competitor Comparison Display

**Goal:** Verify "Frankenstein Stack Killer" messaging

### Steps:
1. Go to `/pricing` (logged out)
2. Scroll to comparison section
3. Verify shows:
   - Old way: $677-3,197/mo
   - New way: $400-1,250/mo
   - Savings: $277-1,947/mo
4. Verify all 4 tiers show same features
5. Click "Start Free Trial"
6. Should require card entry

**Expected Result:** ✅ Clear value proposition displayed

---

## 11. AI Agent Pricing Knowledge Test

**Goal:** Verify agent knows current pricing

### Test Queries:
1. "How much does this cost?"
   - Expected: Mentions $400-1,250 range
2. "What's the difference between tiers?"
   - Expected: "Only record capacity, all features included"
3. "Do I get AI agents on the cheapest plan?"
   - Expected: "Yes! All tiers have unlimited AI agents"
4. "Why is this better than ZoomInfo?"
   - Expected: Mentions saving money, all-in-one platform
5. "Do you charge for AI usage?"
   - Expected: Mentions BYOK, no markup

**Expected Result:** ✅ Agent answers accurately with current pricing

---

## 12. Load & Performance Test

**Goal:** Verify system handles realistic data

### Steps:
1. Import 1,000 contacts to test account
2. Record counter should calculate quickly (< 5 seconds)
3. Check billing page loads fast
4. Try to exceed Tier 4 capacity (1,001+ records)
5. Should show: "Contact support for enterprise pricing"

**Expected Result:** ✅ System handles large datasets efficiently

---

## 🐛 Known Issues to Test For

### Common Problems:
- [ ] Webhook secret mismatch → 400 error on webhook
- [ ] Missing Price IDs → Subscription creation fails
- [ ] Card element not loading → Check Stripe publishable key
- [ ] Record count not updating → Check Firestore permissions
- [ ] Email not sending → Check email service integration

---

## 📊 Metrics to Monitor (Post-Launch)

### Day 1-7:
- Trial signups with card vs. without (if you A/B test)
- Webhook success rate (should be ~100%)
- Average tier at trial end
- Payment success rate

### Week 2-4:
- Trial → Paid conversion rate
- Tier distribution (what % in each tier?)
- Average record count per customer
- Feature usage by tier (should be equal!)

### Month 1+:
- Churn rate by tier
- Upgrade frequency (tier 1 → tier 2)
- Customer lifetime value
- Savings claims validation

---

## ✅ Launch Checklist

Before flipping to production:

- [ ] All tests above passed
- [ ] Stripe in LIVE mode (not test)
- [ ] Live webhook configured
- [ ] Environment variables updated for production
- [ ] Email service integrated (SendGrid/Resend)
- [ ] Monitoring set up (Sentry, LogRocket, etc.)
- [ ] Customer support ready for questions
- [ ] Documentation updated
- [ ] Team trained on new pricing model

---

## 🆘 Troubleshooting

### Signup fails with "Payment method required"
- Check Stripe Elements loaded (console errors?)
- Verify publishable key in `.env`
- Test with different card

### Webhook not firing
- Check endpoint is publicly accessible
- Verify webhook secret matches
- Check Stripe Dashboard webhook logs
- Try manual webhook resend

### Wrong tier assigned
- Check record counter logic
- Verify tier calculation in webhook
- Check Firestore record counts

### Agent doesn't know pricing
- Go to `/admin/pricing-tiers`
- Click "Save" to refresh agent knowledge
- Check agent knowledge in Firestore

---

**Questions?** See:
- `PRICING_REFACTOR_COMPLETE.md` - Full overview
- `SETUP_STRIPE.md` - Stripe setup guide
- Stripe Dashboard logs - Webhook/payment debugging

