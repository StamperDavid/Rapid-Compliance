# Pricing Refactor Progress - Session Update

**Started:** December 25, 2025  
**Status:** Phase 2 In Progress (60% Complete)  

---

## ✅ COMPLETED: Phase 1 - Pricing Structure Foundation (100%)

### What We Built:
1. **Single Source of Truth** - `VOLUME_TIERS` constant
   - Tier 1: $400/mo (0-100 records)
   - Tier 2: $650/mo (101-250 records)
   - Tier 3: $1,000/mo (251-500 records)
   - Tier 4: $1,250/mo (501-1,000 records)

2. **Type System Overhaul** (`src/types/subscription.ts`)
   - New `SubscriptionTier` type
   - Added helper functions: `getTierForRecordCount()`, `getTierPricing()`, `isWithinTierCapacity()`
   - Marked old `SubscriptionPlan` as deprecated
   - Added `ALL_INCLUSIVE_FEATURES` constant
   - Added `BYOK_PROVIDERS` constant

3. **Stripe Service Updated** (`src/lib/billing/stripe-service.ts`)
   - New `STRIPE_TIERS` replacing old `PLANS`
   - `createSubscription()` updated to accept `SubscriptionTier` + `paymentMethodId`
   - New `updateSubscriptionTier()` for auto-scaling
   - New `checkRecordCapacity()` replacing old usage limits
   - Legacy functions marked as deprecated

4. **UI Updates**
   - **Billing Page** (`src/app/workspace/[orgId]/settings/billing/page.tsx`)
     - Shows 4 tiers with record capacity
     - Record capacity progress bar (only limit tracked)
     - "All Features Included" badge
     - BYOK callout added
     - Usage stats shown for analytics (not limits)
   
   - **Public Pricing Page** (`src/app/(public)/pricing/page.tsx`)
     - "Success-Linked Pricing" hero
     - "Growth Partner Pricing" badge
     - BYOK messaging in hero
     - 4-tier grid layout
     - **"Frankenstein Stack Killer" comparison section**
       - Shows old way: $677-3,197/mo for fragmented tools
       - Shows new way: $400-1,250/mo all-inclusive
       - Savings calculator: Save $277-1,947/mo

---

## 🔄 IN PROGRESS: Phase 2 - Remove Feature Gating (40%)

### What's Been Done:
1. **Feature Gate Service** (`src/lib/subscription/feature-gate.ts`)
   - ✅ `hasFeature()` now always returns `true` for active/trialing subs
   - ✅ Added new `checkRecordCapacity()` method
   - ✅ Updated `createDefaultSubscription()` to use tiers
   - ✅ Removed all feature restriction logic

### What's Left:
- ⏳ Simplify subscription middleware (`src/lib/subscription/middleware.ts`)
- ⏳ Remove feature checks from API routes (need to grep and update ~20 routes)
- ⏳ Update `toggleFeature()` method (may not be needed anymore)

---

## ⏸️ PENDING: Phase 3 - Record Counting Infrastructure

### Needs to Be Built:
1. **New File:** `src/lib/subscription/record-counter.ts`
   - `getRecordCount(orgId)` - Count contacts + leads + companies + deals + products
   - `getTierForRecordCount(count)` - Calculate appropriate tier
   - `canAddRecords(orgId, count)` - Check if import would exceed capacity

2. **Integration Points:**
   - CSV import flow (`src/app/crm/page.tsx`)
   - API bulk import routes
   - Manual record creation
   - Data migration tools

---

## ⏸️ PENDING: Phase 4 - Trial & Billing

### Needs to Be Built:
1. **Signup Flow** (`src/app/(public)/signup/page.tsx`)
   - Add Stripe Elements for card collection
   - Mandatory card capture before trial starts
   - Update messaging: "14-day free trial, card required"

2. **Webhook Handler** (`src/app/api/webhooks/stripe/route.ts`)
   - Handle `customer.subscription.trial_will_end` event
   - Count org's records at trial end
   - Auto-upgrade/downgrade to appropriate tier
   - Send email notification with tier assignment

---

## 📊 Overall Progress: 60%

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Pricing Structure | ✅ Complete | 100% |
| Phase 2: Remove Feature Gating | 🔄 In Progress | 40% |
| Phase 3: Record Counting | ⏸️ Pending | 0% |
| Phase 4: Trial & Billing | ⏸️ Pending | 0% |
| Phase 5: Marketing Copy | ✅ Complete | 100% |

---

## 🎯 Next Steps

1. **Finish Phase 2** (30 minutes)
   - Simplify middleware
   - Remove feature checks from API routes
   - Test that all features are accessible

2. **Build Phase 3** (1-2 hours)
   - Create record counter service
   - Integrate with import flows
   - Add capacity warnings

3. **Build Phase 4** (1-2 hours)
   - Stripe card collection at signup
   - Webhook for trial-end auto-billing
   - Email templates

---

## 🚨 Important Notes

### What Changed:
- **OLD:** Feature-gated tiers (Starter/Pro/Enterprise)
- **NEW:** Volume-based tiers (Tier 1-4)
- **OLD:** Features locked behind higher tiers
- **NEW:** Everyone gets everything, pay for storage only
- **OLD:** Trial with no payment required
- **NEW:** Trial requires card, auto-bills based on usage

### Backward Compatibility:
- Old `SubscriptionPlan` type kept but marked deprecated
- Legacy functions (`createSubscriptionLegacy`, `updateSubscription`) kept
- Old fields in `OrganizationSubscription` marked optional
- Migration path: Can run both models simultaneously during transition

### Environment Variables Needed:
```env
# NEW: Add these to .env
STRIPE_PRICE_ID_TIER1=price_xxx
STRIPE_PRICE_ID_TIER2=price_xxx
STRIPE_PRICE_ID_TIER3=price_xxx
STRIPE_PRICE_ID_TIER4=price_xxx

# OLD: These can be deprecated eventually
STRIPE_PRICE_ID_STARTER=price_xxx
STRIPE_PRICE_ID_PROFESSIONAL=price_xxx
STRIPE_PRICE_ID_ENTERPRISE=price_xxx
```

---

## 💾 Git Commits

**Commit 1:** `d7f1a0d` - Phase 1 Complete: Volume-based pricing structure
- Created VOLUME_TIERS as single source of truth
- Updated type definitions
- Refactored Stripe service
- Updated all UI with new messaging
- Added "Frankenstein Stack Killer" comparison

**Commit 2:** (Pending) - Phase 2 Complete: Feature gating removed

---

## 🎉 Vision Alignment

This refactor embodies your vision:
> "This software is supposed to allow small businesses that do not currently have access to these tools a quick, easy, and affordable means of keeping up with the big boys."

**How we're delivering:**
- ✅ **Affordable:** $400 entry point vs. $677+ for competitor stack
- ✅ **All-Inclusive:** No feature gating - everyone gets the full platform
- ✅ **Transparent:** BYOK pricing, no hidden token markups
- ✅ **Fair:** Pay for what you store (success-linked), not what you use
- ✅ **Small Business Focused:** Designed for 0-1,000 records, not enterprise giants

The "Frankenstein Stack Killer" comparison makes it crystal clear: 
**Save $277-1,947/mo while getting more features than the fragmented stack.**

