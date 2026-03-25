# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 25, 2026 (Stub Eradication + Payment Agnosticism Complete)

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **58 AI agents** (46 swarm + 7 standalone + 5 QA) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions enforced on 36+ API routes
- **184 pages**, **404+ API routes**, **1,628 TypeScript files**, **~350K+ lines**
- **212 React components**, **55 type definition files**
- **Deployed via Vercel** — dev → main → Vercel auto-deploy

### Build Health (Verified March 25, 2026)
- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- Zero `eslint-disable` comments — **CLEAN**
- Zero `any` type annotations — Zero-Any Policy enforced
- Zero `@ts-ignore` / `@ts-expect-error` — clean

### Payment System — FULLY COMPLETE (March 25, 2026)
- **12 payment providers** fully implemented (Stripe, PayPal, Square, Authorize.Net, 2Checkout, Mollie, Razorpay, Braintree, Paddle, Adyen, Chargebee, Hyperswitch)
- **12 webhook handlers** with signature verification + Firestore order updates
- Provider-agnostic dispatcher, refund router, subscription billing
- Commerce Payment Specialist agent is provider-agnostic
- Zod schemas accept all 6 subscription providers (stripe, authorizenet, paypal, square, paddle, chargebee)
- Dead Stripe-only routes removed, widget checkout made provider-agnostic
- Just needs API keys in Firestore `/settings/api-keys` to activate any provider

---

## What to Build Next — Stub Eradication

**CRITICAL RULE:** This project has a zero-tolerance policy on stubs, placeholders, TODOs, and Promise.resolve(null). Every function must be fully implemented. Read CLAUDE.md and ENGINEERING_STANDARDS.md before writing any code.

### Issue 1: Bandwidth Voice Provider — CRITICAL
**File:** `src/lib/voice/voice-factory.ts` (lines 215-218)
**Current:** `throw new Error('Bandwidth provider not yet implemented')`
**Fix:** Implement `BandwidthProvider` class following the same pattern as `TwilioProvider` and `TelnyxProvider` in the same file.
- Bandwidth REST API: `https://voice.bandwidth.com/api/v2/accounts/{accountId}/calls`
- Auth: Basic Auth with API token + secret
- API keys stored in Firestore via `apiKeyService.getServiceKey(PLATFORM_ID, 'bandwidth')`
- Needs: `makeCall()`, `sendDTMF()`, `hangup()`, `getCallStatus()` methods
- Config interface: `{ accountId, apiToken, apiSecret, applicationId, fromNumber }`

### Issue 2: Vonage Voice Provider — CRITICAL
**File:** `src/lib/voice/voice-factory.ts` (lines 220-223)
**Current:** `throw new Error('Vonage provider not yet implemented')`
**Fix:** Implement `VonageProvider` class following same pattern.
- Vonage Voice API: `https://api.nexmo.com/v1/calls`
- Auth: JWT with application_id + private_key
- API keys stored in Firestore via `apiKeyService.getServiceKey(PLATFORM_ID, 'vonage')`
- Needs: `makeCall()`, `sendDTMF()`, `hangup()`, `getCallStatus()` methods
- Config interface: `{ apiKey, apiSecret, applicationId, privateKey, fromNumber }`

### Issue 3: Video Frame Extraction — HIGH
**File:** `src/lib/vision/vision-service.ts` (lines 237-245)
**Current:** `logger.warn('[Video] Frame extraction not yet implemented, using mock data'); return [];`
**Fix:** Implement real frame extraction.
- Option A: Use a cloud video processing API (Google Video Intelligence API or similar) to extract keyframes
- Option B: Use server-side FFmpeg via `fluent-ffmpeg` (if available) to extract frames at intervals
- Option C: If neither is available, use the video's thumbnail URL from the provider as a single frame
- The function accepts `videoUrl` and options `{ interval, maxFrames }`, returns `string[]` (base64 frames)
- Used by `analyzeVideo()` at line 204

### Issue 4: VOICE_AI_SPECIALIST — HIGH
**File:** `src/lib/agents/outreach/manager.ts`
- **Line 495-496:** `VOICE_AI_SPECIALIST` registration is commented out
- **Lines 937-943:** Voice channel returns `{ success: false, status: 'BLOCKED', blockReason: 'VOICE_AI_SPECIALIST not yet implemented' }`
**Fix:**
- Create `src/lib/agents/outreach/voice/specialist.ts` following the pattern of `email/specialist.ts` and `sms/specialist.ts`
- The specialist should use the voice-factory.ts providers (Twilio, Telnyx, Bandwidth, Vonage) to place calls
- Register it in `registerAllSpecialists()` and wire the `executeChannelStep()` voice case to delegate to it
- Must handle: AI-driven voice conversations, call recording, transcript logging, outcome tracking

### Issue 5: Catalog Sync — HIGH
**File:** `src/lib/agents/commerce/catalog/specialist.ts` (lines 638-646)
**Current:** Always returns `{ success: false, error: 'Catalog sync for "${source}" is not yet implemented' }`
**Fix:** Implement sync for each source:
- **Stripe:** Fetch products via Stripe Products API (`stripe.products.list()`), map to internal Product schema, upsert to Firestore
- **Shopify:** Fetch via Shopify REST API (`/admin/api/2024-01/products.json`), handle variants and inventory
- **WooCommerce:** Fetch via WooCommerce REST API (`/wp-json/wc/v3/products`), map to Product schema
- **Manual:** Accept product array in payload and bulk-write to Firestore
- API keys from Firestore apiKeyService. Handle pagination for large catalogs.

### Issue 6: Vertex AI Fine-Tuning — MEDIUM
**File:** `src/lib/ai/fine-tuning/vertex-tuner.ts`
- **Lines 45-52:** `createVertexAIFineTuningJob()` rejects with "not configured" error
- **Lines 65-69:** `uploadToCloudStorage()` throws "not configured" error
**Fix:**
- Use `@google-cloud/aiplatform` SDK to create supervised fine-tuning jobs
- Use `@google-cloud/storage` SDK to upload training data
- Credentials from `apiKeyService.getServiceKey(PLATFORM_ID, 'googleCloud')`
- If Google Cloud credentials not configured, return a clear error (NOT throw) explaining what keys are needed

### Issue 7: Workflow Triggers — MEDIUM
**Files:**
- `src/lib/workflows/triggers/schedule-trigger.ts` (lines 40-45)
- `src/lib/workflows/triggers/firestore-trigger.ts` (lines 40-45)
**Current:** Store config in Firestore but log warning "Cloud Scheduler/Functions deployment not yet implemented"
**Fix:**
- For schedule triggers: Use Google Cloud Scheduler API to create cron jobs that hit an internal `/api/cron/workflow-execute` endpoint
- For Firestore triggers: Use an internal polling approach — a cron job that checks for recent changes in watched collections and fires workflow runs
- Alternative: If Cloud Functions deployment is too complex, use Next.js API cron routes (already have 10+ cron handlers in `/api/cron/`)

### Issue 8: Form Templates Mock Data — MEDIUM
**File:** `src/app/(dashboard)/forms/page.tsx` (lines 70-113)
**Current:** Hardcoded `FORM_TEMPLATES` array with 6 templates that have no field definitions
**Fix:**
- Move templates to Firestore `form_templates` collection (seed via demo data script)
- Each template needs: `fields: FormField[]`, `settings` (theme, layout), `successMessage`, `notificationEmail`
- Load templates from Firestore on page mount
- Pre-built templates should include real field configs (e.g., Contact Form = name + email + phone + message fields with validation)

---

## Execution Order

1. **Issues 1 & 2 together** (voice providers) — both in the same file, same pattern
2. **Issue 4** (VOICE_AI_SPECIALIST) — depends on voice providers being done
3. **Issues 3, 5, 6** (video frames, catalog sync, vertex) — independent, can parallelize
4. **Issues 7 & 8** (workflow triggers, form templates) — independent, can parallelize

## Verification Checklist

After ALL fixes:
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes with zero errors
- [ ] No new `any` types introduced
- [ ] No new `eslint-disable` comments
- [ ] No `Promise.resolve(null)` or `throw new Error('not implemented')` anywhere
- [ ] `grep -r "not yet implemented\|not implemented\|coming soon" src/lib/ --include="*.ts"` returns ZERO matches
- [ ] Commit and push to dev branch
- [ ] Merge dev into rapid-dev worktree
