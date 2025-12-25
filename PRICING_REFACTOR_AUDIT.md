# Pricing Model Refactor - Technical Audit

**Date:** December 25, 2025  
**Current Model:** Feature-gated tiers (Starter/Professional/Enterprise/Custom)  
**Target Model:** Volume-based, all-inclusive "Growth Partner" pricing  

---

## Executive Summary

After auditing the codebase, here's the **BRUTAL TRUTH** about this refactor:

**Complexity Level:** ⚠️ **MAJOR REFACTOR** - This touches 50+ files across the entire stack

**Timeline Estimate:**
- **Quick & Dirty:** 3-4 days (just make it work)
- **Production Quality:** 7-10 days (proper testing, no regressions)

**Why It's Complex:**
1. Feature-gating logic is **deeply embedded** across the entire platform
2. Multiple pricing definitions exist in **3 separate locations** (inconsistent)
3. Subscription creation happens in **multiple places** (signup, billing API, admin tools)
4. Trial logic currently **doesn't require credit cards**
5. No existing "record count" tracking infrastructure

---

## Current State Analysis

### 1. Pricing Definitions (INCONSISTENT - Major Problem)

**Location 1:** `src/types/subscription.ts` (Lines 442-458)
```typescript
starter: { monthly: 99, yearly: 990 }
professional: { monthly: 299, yearly: 2990 }
enterprise: { monthly: 999, yearly: 9990 }
custom: { monthly: 0, yearly: 0 }
```

**Location 2:** `src/lib/billing/stripe-service.ts` (Lines 36-72)
```typescript
pro: { price: 9900 } // $99/month
enterprise: { price: 49900 } // $499/month
```

**Location 3:** `src/app/workspace/[orgId]/settings/billing/page.tsx` (Lines 127-190)
```typescript
'agent-only': { price: '$29' }
starter: { price: '$49' }
professional: { price: '$149' }
enterprise: { price: 'Custom' }
```

**Location 4:** `src/app/(public)/pricing/page.tsx` (Lines 15-37)
```typescript
'Agent Only': { monthlyPrice: 29 }
'Starter': { monthlyPrice: 49 }
'Professional': { monthlyPrice: 149 }
```

❌ **PROBLEM:** Four different sources of truth = guaranteed bugs

### 2. Feature-Gating Architecture

**Core Feature Gate Service:** `src/lib/subscription/feature-gate.ts` (476 lines)
- Used extensively across **dozens of API routes**
- Controls access to: AI Email Writer, Prospect Finder, LinkedIn, SMS, Sequences, etc.
- Plan limits defined in `PLAN_LIMITS` object (Lines 212-438)

**Feature Gate Middleware:** `src/lib/subscription/middleware.ts` (265 lines)
- `requireFeature()` - Blocks API calls if feature not available
- `requireLimit()` - Enforces monthly usage limits
- `withFeatureGate()` - Wrapper for protected API routes

**Where It's Used:** (Found via grep)
- ❌ All outbound email routes
- ❌ AI agent routes
- ❌ Lead scraping routes
- ❌ Social media automation routes

### 3. Subscription Creation Flow

**Current Trial Logic:**
- 14-day trial created by default
- ❌ **NO credit card required** (see `createSubscription()` in stripe-service.ts)
- Trial just expires, no auto-billing

**Creation Points:**
1. `src/app/(public)/signup/page.tsx` (Lines 89-140) - User self-signup
2. `src/app/api/billing/subscribe/route.ts` - API endpoint
3. `src/lib/subscription/feature-gate.ts` (Line 271) - `createDefaultSubscription()`

### 4. Record Count Tracking (DOESN'T EXIST!)

**Current Record Limits:**
```typescript
// From scripts/seed-production-test-orgs.js (Lines 346-381)
starter: { maxRecordsPerWorkspace: 10000 }
professional: { maxRecordsPerWorkspace: 100000 }
enterprise: { maxRecordsPerWorkspace: 1000000 }
```

❌ **PROBLEM:** These limits are **defined but not enforced**
- No code actively counts records
- No code blocks imports when limit reached
- Just documentation, not actual enforcement

**Where Records Live:**
- Contacts in Firestore: `organizations/{orgId}/workspaces/{workspaceId}/contacts`
- Leads: `organizations/{orgId}/workspaces/{workspaceId}/leads`
- Companies: `organizations/{orgId}/workspaces/{workspaceId}/companies`
- Deals: `organizations/{orgId}/workspaces/{workspaceId}/deals`
- Products: `organizations/{orgId}/workspaces/{workspaceId}/products`

**Import Logic:** `src/app/crm/page.tsx` (Lines 242-283)
- Simple CSV import
- ❌ **No capacity checks before import**
- ❌ **No record counting after import**

---

## What Needs to Change

### PHASE 1: New Pricing Structure (Core Refactor)

#### 1.1 Update Type Definitions
**File:** `src/types/subscription.ts`

**Changes:**
```typescript
// OLD: Feature-based plans
export type SubscriptionPlan = 'starter' | 'professional' | 'enterprise' | 'custom';

// NEW: Volume-based tiers
export type SubscriptionTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';

// NEW: Single source of truth
export const VOLUME_TIERS = {
  tier1: {
    name: 'Tier 1',
    price: 400,
    recordMin: 0,
    recordMax: 100,
  },
  tier2: {
    name: 'Tier 2',
    price: 650,
    recordMin: 101,
    recordMax: 250,
  },
  tier3: {
    name: 'Tier 3',
    price: 1000,
    recordMin: 251,
    recordMax: 500,
  },
  tier4: {
    name: 'Tier 4',
    price: 1250,
    recordMin: 501,
    recordMax: 1000,
  },
};

// REMOVE: All of PLAN_LIMITS (Lines 212-438)
// Everyone gets everything, no feature gating
```

#### 1.2 Update Stripe Service
**File:** `src/lib/billing/stripe-service.ts`

**Changes:**
- Replace `PLANS` object with `VOLUME_TIERS`
- Remove all limit enforcement (lines 200-230)
- Keep only `records` in limits (remove aiConversations, emails, gmv)

#### 1.3 Update Billing Page UI
**File:** `src/app/workspace/[orgId]/settings/billing/page.tsx`

**Changes:**
- Replace `plans` array (Lines 127-190) with new tier structure
- Update pricing cards to show record ranges
- Remove feature lists (all tiers have all features)

#### 1.4 Update Public Pricing Page
**File:** `src/app/(public)/pricing/page.tsx`

**Changes:**
- Replace hardcoded pricing with `VOLUME_TIERS`
- Add messaging: "All-Inclusive", "BYOK Architecture", "Frankenstein Stack Killer"
- Create comparison table vs. competitors

### PHASE 2: Remove Feature Gating (Dangerous - Test Thoroughly!)

#### 2.1 Gut the Feature Gate Service
**File:** `src/lib/subscription/feature-gate.ts`

**Changes:**
```typescript
// BEFORE: Complex feature checking (476 lines)
static async hasFeature(orgId, feature): Promise<boolean> {
  // Check subscription, check limits, check add-ons...
}

// AFTER: Everything returns true (10 lines)
static async hasFeature(orgId, feature): Promise<boolean> {
  return true; // Everyone has everything
}

// REMOVE: toggleFeature(), all limit checking
// KEEP: Record count enforcement (new function)
```

#### 2.2 Simplify Middleware
**File:** `src/lib/subscription/middleware.ts`

**Changes:**
```typescript
// BEFORE: requireFeature() blocks access based on plan
export async function requireFeature(request, orgId, feature) {
  const hasAccess = await FeatureGate.hasFeature(orgId, feature);
  if (!hasAccess) return 403;
}

// AFTER: Always allow (or remove entirely)
export async function requireFeature(request, orgId, feature) {
  return null; // Allow all features
}

// NEW: Add requireRecordCapacity()
export async function requireRecordCapacity(orgId, additionalRecords) {
  const currentCount = await getRecordCount(orgId);
  const tier = getTierForRecordCount(currentCount + additionalRecords);
  // Return upgrade notice if over capacity
}
```

#### 2.3 Find & Remove All Feature Gate Calls
**Search Pattern:** `FeatureGate.hasFeature` or `requireFeature`

**Files to Update:** (Need to grep for exact list)
- All API routes in `src/app/api/outbound/*`
- AI agent routes
- Lead enrichment routes
- Any route checking "professional" or "enterprise" features

**Action:** Remove the checks, or make them always pass

### PHASE 3: Record Counting Infrastructure (NEW CODE)

#### 3.1 Create Record Counter Service
**New File:** `src/lib/subscription/record-counter.ts`

```typescript
export class RecordCounter {
  /**
   * Get total record count for organization across all workspaces
   */
  static async getRecordCount(orgId: string): Promise<number> {
    // Count contacts + leads + companies + deals + products
    // Aggregate across all workspaces
  }
  
  /**
   * Determine tier based on record count
   */
  static getTierForRecordCount(count: number): SubscriptionTier {
    if (count <= 100) return 'tier1';
    if (count <= 250) return 'tier2';
    if (count <= 500) return 'tier3';
    return 'tier4';
  }
  
  /**
   * Check if operation would exceed capacity
   */
  static async canAddRecords(orgId: string, count: number): Promise<{
    allowed: boolean;
    currentCount: number;
    newTotal: number;
    currentTier: string;
    requiredTier?: string;
  }> {
    // Check if adding records would require upgrade
  }
}
```

#### 3.2 Hook Into Import Process
**File:** `src/app/crm/page.tsx`

**Changes:**
```typescript
// Line 242: Add capacity check before import
const handleImportFile = async (e) => {
  const file = e.target.files?.[0];
  
  // NEW: Check capacity
  const canImport = await RecordCounter.canAddRecords(orgId, rowCount);
  if (!canImport.allowed) {
    showToast(`Cannot import. Would require ${canImport.requiredTier}. Current tier: ${canImport.currentTier}`, 'error');
    return;
  }
  
  // Proceed with import...
}
```

#### 3.3 Real-time Record Count Tracking
**Where to add:**
- After CSV import completes
- After manual record creation
- After data migration
- After API bulk operations

### PHASE 4: Trial & Billing Changes

#### 4.1 Require Credit Card for Trial
**File:** `src/app/(public)/signup/page.tsx`

**Changes:**
```typescript
// BEFORE: Trial created without payment
const handleSubmit = async () => {
  await createUserWithEmailAndPassword();
  // No payment collection
}

// AFTER: Must collect payment before trial
const handleSubmit = async () => {
  // Step 1: Collect credit card with Stripe Elements
  const paymentMethod = await stripe.createPaymentMethod({...});
  
  // Step 2: Create customer with payment method
  const customer = await createCustomer(email, name, { paymentMethod });
  
  // Step 3: Create subscription with trial
  const subscription = await createSubscription(customer.id, 'tier1', 14);
  
  // Step 4: Create account
  await createUserWithEmailAndPassword();
}
```

**New UI Needed:**
- Add Stripe Elements for card input
- Show "14-day free trial, then $400/mo (based on usage)" messaging
- Legal disclaimer about auto-billing

#### 4.2 Auto-Scaling Billing at Trial End
**File:** `src/lib/billing/stripe-service.ts`

**New Function:**
```typescript
/**
 * Calculate tier based on current record count
 * Called via webhook when trial ends
 */
export async function handleTrialEnd(subscriptionId: string): Promise<void> {
  const subscription = await getSubscription(subscriptionId);
  const orgId = subscription.metadata.organizationId;
  
  // Count records
  const recordCount = await RecordCounter.getRecordCount(orgId);
  
  // Determine tier
  const tier = RecordCounter.getTierForRecordCount(recordCount);
  
  // Update subscription to correct tier
  await updateSubscription(subscriptionId, tier);
  
  // Notify customer of their tier
  await sendEmail(customer.email, `Your trial ended. You're on ${tier} ($${VOLUME_TIERS[tier].price}/mo) with ${recordCount} records.`);
}
```

**Webhook Handler:**
**File:** `src/app/api/webhooks/stripe/route.ts` (may need to create)

```typescript
export async function POST(request: NextRequest) {
  const event = await stripe.webhooks.constructEvent(request.body, signature, secret);
  
  if (event.type === 'customer.subscription.trial_will_end') {
    // 3 days before trial ends, calculate their tier
    await handleTrialEnd(event.data.object.id);
  }
  
  if (event.type === 'customer.subscription.updated') {
    // Trial just ended, finalize billing
    await finalizeTrialToPaidConversion(event.data.object.id);
  }
}
```

### PHASE 5: Marketing Copy Updates

#### 5.1 Pricing Page Messaging
**File:** `src/app/(public)/pricing/page.tsx`

**New Sections:**
1. Hero: "Success-Linked Pricing - Pay for What You Store, Not What You Use"
2. BYOK Callout: "We Don't Markup AI - Connect Your Own API Keys"
3. Comparison Table:
   ```
   What You're Replacing:
   - Apollo/ZoomInfo: $99-399/mo
   - Air AI/11x: $500-2000/mo
   - Sintra Social: $49-199/mo
   - Zapier: $29-599/mo
   TOTAL: $677-3197/mo
   
   Our Price: $400-1250/mo (ALL INCLUDED)
   ```

#### 5.2 Features Page
**File:** `src/app/(public)/features/page.tsx`

**Update:** Remove tier badges ("Professional only", "Enterprise feature", etc.)
**Add:** "Every feature, every tier" badge

---

## Files Requiring Changes (Comprehensive List)

### Core Pricing & Subscription (CRITICAL)
- ✅ `src/types/subscription.ts` - Complete rewrite of tier structure
- ✅ `src/lib/billing/stripe-service.ts` - Update plan definitions
- ✅ `src/lib/subscription/feature-gate.ts` - Gut feature gating, add record counting
- ✅ `src/lib/subscription/middleware.ts` - Remove feature checks
- ✅ `src/app/api/billing/subscribe/route.ts` - Update subscription creation

### Record Counting (NEW CODE)
- ✅ `src/lib/subscription/record-counter.ts` - **NEW FILE** to create
- ✅ `src/app/crm/page.tsx` - Add capacity checks to import
- ✅ `src/app/api/contacts/import/route.ts` - Add capacity enforcement (if exists)

### Trial & Payment (CRITICAL)
- ✅ `src/app/(public)/signup/page.tsx` - Add Stripe card collection
- ✅ `src/app/api/webhooks/stripe/route.ts` - Handle trial end auto-billing
- ✅ Create trial-end email templates

### UI Updates (Frontend)
- ✅ `src/app/workspace/[orgId]/settings/billing/page.tsx` - New tier cards
- ✅ `src/app/(public)/pricing/page.tsx` - Complete redesign with new messaging
- ✅ `src/app/(public)/features/page.tsx` - Remove tier badges

### API Routes to Update (Remove Feature Checks)
Need to grep for: `requireFeature`, `FeatureGate.hasFeature`, `checkFeatureAccess`

**Likely candidates:**
- `src/app/api/outbound/**/*.ts` - All outbound features
- `src/app/api/ai/**/*.ts` - AI agent routes
- `src/app/api/enrichment/**/*.ts` - Lead enrichment
- `src/app/api/social/**/*.ts` - Social media automation

### Database Schema (Firestore)
**Collection:** `organizations/{orgId}/subscriptions`

**Before:**
```typescript
{
  plan: 'professional',
  outboundFeatures: { /* 100+ lines of feature flags */ },
  billing: { basePrice: 299 }
}
```

**After:**
```typescript
{
  tier: 'tier2',
  recordCount: 175,
  billing: { basePrice: 650 }
}
```

### Environment Variables
**File:** `.env`

**Add:**
```
# Stripe Price IDs for new tiers
STRIPE_PRICE_ID_TIER1=price_xxx
STRIPE_PRICE_ID_TIER2=price_xxx
STRIPE_PRICE_ID_TIER3=price_xxx
STRIPE_PRICE_ID_TIER4=price_xxx
```

**Remove:**
```
# Old plan price IDs
STRIPE_PRICE_ID_STARTER=price_xxx
STRIPE_PRICE_ID_PROFESSIONAL=price_xxx
STRIPE_PRICE_ID_ENTERPRISE=price_xxx
```

---

## Migration Strategy for Existing Customers

### Scenario 1: Platform Already Live with Customers

**Problem:** Existing subscriptions on old plans need migration

**Solution:**
```typescript
// scripts/migrate-subscriptions-to-volume.ts
async function migrateExistingSubscriptions() {
  // 1. Get all organizations with active subscriptions
  const orgs = await getAllOrganizations();
  
  for (const org of orgs) {
    // 2. Count their current records
    const recordCount = await RecordCounter.getRecordCount(org.id);
    
    // 3. Determine appropriate tier
    const tier = RecordCounter.getTierForRecordCount(recordCount);
    
    // 4. Calculate price difference
    const oldPrice = org.subscription.billing.basePrice;
    const newPrice = VOLUME_TIERS[tier].price;
    
    // 5. Grandfather existing customers OR migrate with notice
    if (newPrice > oldPrice) {
      // Send email: "Your plan is changing to tier X on [date]"
      await scheduleSubscriptionChange(org.id, tier, 30); // 30 days notice
    } else {
      // Immediate upgrade if they're saving money
      await updateSubscription(org.subscriptionId, tier);
    }
  }
}
```

### Scenario 2: Pre-Launch (No Customers Yet)

✅ **Just deploy** - No migration needed

---

## Risk Assessment

### 🔴 HIGH RISK: Breaking Changes
1. **Feature Gate Removal** - Could accidentally enable paid features on free accounts
   - **Mitigation:** Deploy to staging first, manual QA of all feature access
   
2. **Pricing Confusion** - Multiple pricing sources = guaranteed bugs during transition
   - **Mitigation:** Create single source of truth FIRST, then update all consumers
   
3. **Trial Auto-Billing** - Could charge customers unexpectedly if webhook fails
   - **Mitigation:** Test webhooks extensively, add retry logic, send warning emails 3 days before

### 🟡 MEDIUM RISK: New Code Required
1. **Record Counting** - Brand new infrastructure that doesn't exist
   - **Mitigation:** Build incrementally, add logging, test with large datasets
   
2. **Credit Card Collection** - New Stripe Elements integration needed
   - **Mitigation:** Use Stripe's official React components, test in Stripe Test Mode

### 🟢 LOW RISK: UI Updates
1. **Pricing Page Copy** - Just frontend changes
2. **Billing Page Cards** - Just visual updates

---

## Testing Checklist

### Before Deployment
- [ ] Test record counter with 0, 50, 100, 101, 250, 251, 500, 501, 1000 records
- [ ] Test import blocking when over capacity
- [ ] Test CSV import of 500 records (capacity check)
- [ ] Test trial signup with credit card capture
- [ ] Test trial-to-paid conversion via Stripe webhook (Test Mode)
- [ ] Verify all features accessible on Tier 1
- [ ] Verify pricing page shows correct tiers
- [ ] Test upgrade flow: Tier 1 → Tier 2 when hitting 101 records
- [ ] Test downgrade scenario: Delete records, tier should update
- [ ] Load test record counter with 10,000+ records

### Post-Deployment (First Week)
- [ ] Monitor Stripe webhooks for failures
- [ ] Check for any 403 errors (feature gating accidentally blocking)
- [ ] Verify customer emails being sent correctly
- [ ] Monitor record counts vs. billing tier accuracy

---

## Estimated Effort Breakdown

| Phase | Task | Time Estimate |
|-------|------|---------------|
| 1 | Update pricing definitions (single source of truth) | 4 hours |
| 1 | Update Stripe service | 3 hours |
| 1 | Update billing page UI | 4 hours |
| 1 | Update public pricing page | 6 hours |
| **PHASE 1 TOTAL** | | **17 hours (2 days)** |
| | | |
| 2 | Gut feature gate service | 3 hours |
| 2 | Simplify middleware | 2 hours |
| 2 | Find & remove all feature gate calls (grep + manual) | 8 hours |
| 2 | Test all features still work | 4 hours |
| **PHASE 2 TOTAL** | | **17 hours (2 days)** |
| | | |
| 3 | Build record counter service | 6 hours |
| 3 | Hook into import process | 3 hours |
| 3 | Add real-time tracking | 4 hours |
| 3 | Test with large datasets | 3 hours |
| **PHASE 3 TOTAL** | | **16 hours (2 days)** |
| | | |
| 4 | Add Stripe card collection to signup | 6 hours |
| 4 | Build trial-end auto-scaling logic | 5 hours |
| 4 | Create webhook handler | 4 hours |
| 4 | Test trial flow end-to-end | 4 hours |
| 4 | Create email templates | 2 hours |
| **PHASE 4 TOTAL** | | **21 hours (2.5 days)** |
| | | |
| 5 | Update pricing page copy | 4 hours |
| 5 | Update features page | 2 hours |
| 5 | Create comparison section | 3 hours |
| **PHASE 5 TOTAL** | | **9 hours (1 day)** |
| | | |
| **GRAND TOTAL** | | **80 hours (10 days)** |

**With testing, bug fixes, and buffer: 12-15 days**

---

## Recommendation

### Option A: Full Production Refactor (15 days)
✅ Do all 5 phases  
✅ Proper testing  
✅ Migration plan for existing customers  
✅ No technical debt  

**Best for:** If you have time and want it done right

### Option B: MVP Fast Track (5 days)
⚠️ Skip Phase 3 (record counting) initially  
⚠️ Manual tier assignment at signup  
⚠️ No auto-scaling (customers manually upgrade)  
⚠️ Quick & dirty, accumulate tech debt  

**Best for:** If you need to launch ASAP and refine later

### Option C: Staged Rollout (20 days, but lower risk)
✅ Week 1: Phases 1-2 (new pricing, remove gating)  
✅ Week 2: Phase 3-4 (record counting, trials)  
✅ Week 3: Phase 5 + testing + migration  

**Best for:** If you want to derisk with incremental deploys

---

## Next Steps

1. **Decide on option** (A, B, or C above)
2. **Review this audit** - Add anything I missed
3. **Prioritize phases** - What's absolutely required for launch?
4. **Create Stripe products** - Set up the 4 tiers in Stripe Dashboard
5. **Start with Phase 1** - Single source of truth for pricing

---

## Questions for You

1. Do you have ANY existing paid customers? (Affects migration complexity)
2. When is your target launch date? (Affects which option to choose)
3. Are you comfortable requiring credit cards for trial? (Some drop-off expected)
4. What happens if a customer EXCEEDS their tier's max records?
   - Auto-upgrade and charge more? (Risky)
   - Block new records until they upgrade? (Better)
   - Grace period? (Most user-friendly)
5. Do you want yearly pricing or just monthly to start?

---

**Bottom Line:** This is doable, but it's not trivial. The platform was built with feature-gating baked in deeply. Ripping that out and replacing with volume-based pricing touches 50+ files. Budget 2 weeks for production quality.

