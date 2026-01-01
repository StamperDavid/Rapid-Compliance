# 🚨 LAUNCH BLOCKERS - IMMEDIATE ACTION REQUIRED

**Status:** Cannot launch until these are fixed  
**Estimated Time:** 2-3 days  
**Priority:** CRITICAL

---

## DAY 1: Legal Compliance (4-8 hours) ❌ BLOCKER

### Task 1: Create Privacy Policy (2-3 hours)
- [ ] Use template from [Termly](https://termly.io/products/privacy-policy-generator/) or [Iubenda](https://www.iubenda.com/)
- [ ] Create file: `src/app/(public)/privacy/page.tsx`
- [ ] Customize for your data collection practices:
  - User accounts (email, name, company)
  - Firebase/Firestore data storage
  - Stripe payment data
  - Cookie usage (Firebase auth cookies)
  - Third-party services (Twilio, SendGrid, Google Gemini)
- [ ] Add GDPR compliance sections (EU users)
- [ ] Add CCPA compliance sections (California users)
- [ ] Include data retention policy
- [ ] Include user rights (access, deletion, export)

**Example Route:**
```typescript
// src/app/(public)/privacy/page.tsx
export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-gray-600 mb-4">Last Updated: {new Date().toLocaleDateString()}</p>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
        <p>We collect information you provide directly to us...</p>
      </section>
      
      {/* Add all required sections */}
    </div>
  );
}
```

---

### Task 2: Create Terms of Service (2-3 hours)
- [ ] Use template from [Termly](https://termly.io/products/terms-and-conditions-generator/) or legal template site
- [ ] Create file: `src/app/(public)/terms/page.tsx`
- [ ] Include key sections:
  - Acceptance of Terms
  - Service Description
  - User Accounts and Registration
  - Subscription and Payment Terms (Stripe)
  - Prohibited Uses
  - Intellectual Property Rights
  - Limitation of Liability
  - Termination
  - Governing Law
  - Contact Information
- [ ] Review with lawyer (recommended but not required for MVP)

---

### Task 3: Add Cookie Consent Banner (1-2 hours)
- [ ] Install package: `npm install react-cookie-consent`
- [ ] Create component: `src/components/CookieConsent.tsx`
- [ ] Add to root layout: `src/app/layout.tsx`

**Implementation:**
```typescript
// src/components/CookieConsent.tsx
'use client';
import CookieConsent from 'react-cookie-consent';

export default function CookieConsentBanner() {
  return (
    <CookieConsent
      location="bottom"
      buttonText="Accept All"
      declineButtonText="Decline"
      enableDeclineButton
      cookieName="ai-sales-platform-cookie-consent"
      style={{ background: '#1f2937' }}
      buttonStyle={{ background: '#3b82f6', color: '#ffffff', fontSize: '14px' }}
      declineButtonStyle={{ background: '#6b7280', color: '#ffffff', fontSize: '14px' }}
      expires={365}
    >
      We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.{' '}
      <a href="/privacy" className="underline">Learn more</a>
    </CookieConsent>
  );
}
```

```typescript
// src/app/layout.tsx
import CookieConsentBanner from '@/components/CookieConsent';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>{children}</ClientProviders>
        <CookieConsentBanner />  {/* Add this line */}
      </body>
    </html>
  );
}
```

---

### Task 4: Update Footer with Legal Links (30 minutes)
- [ ] Find or create footer component
- [ ] Add links to Privacy Policy and Terms of Service

**Example:**
```typescript
<footer className="bg-gray-900 text-gray-300 py-8 mt-auto">
  <div className="container mx-auto px-4">
    <div className="flex justify-between">
      <div>© 2025 Your Company. All rights reserved.</div>
      <div className="flex gap-6">
        <a href="/privacy" className="hover:text-white">Privacy Policy</a>
        <a href="/terms" className="hover:text-white">Terms of Service</a>
        <a href="/security" className="hover:text-white">Security</a>
      </div>
    </div>
  </div>
</footer>
```

---

### Task 5: Add "I Agree" Checkbox to Signup (30 minutes)
- [ ] Update `src/app/(public)/signup/page.tsx`
- [ ] Add checkbox before submit button
- [ ] Make checkbox required

**Implementation:**
```typescript
// Add to signup form state
const [agreedToTerms, setAgreedToTerms] = useState(false);

// Add before submit button
<label className="flex items-start gap-2 mb-4">
  <input
    type="checkbox"
    checked={agreedToTerms}
    onChange={(e) => setAgreedToTerms(e.target.checked)}
    required
    className="mt-1"
  />
  <span className="text-sm text-gray-300">
    I agree to the{' '}
    <a href="/terms" target="_blank" className="text-blue-400 hover:underline">
      Terms of Service
    </a>{' '}
    and{' '}
    <a href="/privacy" target="_blank" className="text-blue-400 hover:underline">
      Privacy Policy
    </a>
  </span>
</label>

// Update submit button
<button
  type="submit"
  disabled={!agreedToTerms || loading}
  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
>
  Create Account
</button>
```

---

## DAY 2: Security Fixes (3-4 hours) ❌ BLOCKER

### Task 6: Remove Demo Mode Auth Fallback (30 minutes) ⚠️ CRITICAL

**Files to Edit:**
1. `src/hooks/useAuth.ts`
2. `src/components/AuthProvider.tsx`

**Changes:**
```typescript
// BEFORE (DANGEROUS):
if (!isFirebaseConfigured) {
  setUser({
    id: 'demo-user',
    email: 'admin@demo.com',
    displayName: 'Demo Admin',
    role: 'admin',
    organizationId: 'demo',
  });
  setLoading(false);
  return;
}

// AFTER (SAFE):
if (!isFirebaseConfigured) {
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL: Firebase not configured in production');
    throw new Error('Firebase configuration required for production');
  }
  // Demo mode only allowed in development
  setUser({
    id: 'demo-user',
    email: 'admin@demo.com',
    displayName: 'Demo Admin (DEV ONLY)',
    role: 'admin',
    organizationId: 'demo',
  });
  setLoading(false);
  return;
}
```

**Checklist:**
- [ ] Edit `src/hooks/useAuth.ts` line 34
- [ ] Edit `src/components/AuthProvider.tsx` line 30
- [ ] Test that app throws error in production without Firebase config
- [ ] Test that demo mode still works in development
- [ ] Deploy and verify production blocks demo mode

---

### Task 7: Environment Variable Security Audit (2 hours)

**Step 1: Identify All Env Vars (30 min)**
- [ ] Review `env.template` file
- [ ] List all `NEXT_PUBLIC_*` variables (these are exposed to client)
- [ ] List all server-only variables

**Step 2: Audit Client Exposure (1 hour)**
- [ ] Build production bundle: `npm run build`
- [ ] Search bundle for secrets: `grep -r "sk_live_" .next/static/`
- [ ] Search bundle for secrets: `grep -r "sk_test_" .next/static/`
- [ ] Verify only `NEXT_PUBLIC_*` vars are in client bundle

**Step 3: Add Server-Only Guards (30 min)**
- [ ] Add `import 'server-only'` to files using secrets:
  - `src/lib/firebase-admin.ts`
  - `src/lib/billing/stripe-service.ts`
  - `src/lib/ecommerce/payment-service.ts`
  - Any other files with `process.env.STRIPE_SECRET_KEY`, etc.

**Example:**
```typescript
// At top of server-only files
import 'server-only';

// This file uses server-only secrets
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
```

---

### Task 8: Fix Critical TODOs (4-6 hours)

#### TODO 1: Lead Scoring Data Loading (1 hour)
**File:** `src/app/workspace/[orgId]/lead-scoring/page.tsx` line 67

**Current:**
```typescript
// TODO: Load actual scores from Firestore
const scores = [];
```

**Fix:**
```typescript
// Load actual lead scores
const { collection, query, where, getDocs } = await import('firebase/firestore');
const scoresQuery = query(
  collection(db, 'organizations', orgId, 'records'),
  where('entityType', '==', 'leads'),
  where('score', '>', 0)
);
const snapshot = await getDocs(scoresQuery);
const scores = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

---

#### TODO 2: Web Scraper Implementation (2-3 hours)
**File:** `src/lib/scraper-intelligence/scraper-runner.ts` line 515-522

**Options:**
1. **Quick Fix:** Use existing service properly
2. **Better Fix:** Integrate Playwright scraper from `BrowserController.ts`

**Quick Fix:**
```typescript
// Replace placeholder with actual implementation
async function scrapeWebsite(url: string, options: ScrapeOptions): Promise<ScrapeResult> {
  // Use existing scraper intelligence service
  const { ScraperIntelligenceService } = await import('./scraper-intelligence-service');
  const service = new ScraperIntelligenceService();
  
  return await service.enrichFromWebsite(url, options.organizationId);
}
```

---

#### TODO 3: API Key Audit Trail (1 hour)
**File:** `src/lib/api-keys/api-key-service.ts` line 136

**Current:**
```typescript
updatedBy: 'current-user', // TODO: Get from auth context
```

**Fix:**
```typescript
// Get current user from server-side auth
import { getCurrentUser } from '@/lib/auth/server-auth';

// In the function
const currentUser = await getCurrentUser();
const updatedBy = currentUser?.uid || 'system';
```

---

#### TODO 4: Organization-Scoped Access Check (1 hour)
**File:** `src/lib/firebase/admin-dal.ts` line 151

**Current:**
```typescript
// TODO: Add organization-scoped access check
```

**Fix:**
```typescript
// Verify user belongs to organization
export async function verifyOrgAccess(userId: string, orgId: string): Promise<boolean> {
  const userDoc = await adminDb.collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  if (!userData) return false;
  
  // Check if user's organization matches
  if (userData.organizationId !== orgId) {
    logger.error('Organization access denied', undefined, { userId, orgId });
    return false;
  }
  
  return true;
}

// Use in admin-dal functions
if (!(await verifyOrgAccess(userId, organizationId))) {
  throw new Error('Access denied');
}
```

---

## DAY 3: Testing & Deployment (4-6 hours)

### Task 9: Full Regression Test (2 hours)
- [ ] Test signup flow (with new "I agree" checkbox)
- [ ] Test login flow
- [ ] Test password reset
- [ ] Test lead creation
- [ ] Test deal pipeline
- [ ] Test email sequence creation
- [ ] Test workflow creation
- [ ] Test product catalog
- [ ] Test payment flow (Stripe test mode)
- [ ] Test website builder
- [ ] Test custom domain setup

---

### Task 10: Production Environment Setup (2 hours)

**Firebase:**
- [ ] Create production project in Firebase Console
- [ ] Enable Authentication
- [ ] Create Firestore database
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Deploy Firestore indexes: `firebase deploy --only firestore:indexes`
- [ ] Copy production config to `.env.production`

**Stripe:**
- [ ] Switch from test mode to live mode
- [ ] Copy live publishable key to `.env.production`
- [ ] Copy live secret key to `.env.production`
- [ ] Update webhook endpoint to production URL
- [ ] Copy webhook secret to `.env.production`
- [ ] Test webhook with Stripe CLI: `stripe listen --forward-to https://yourdomain.com/api/billing/webhook`

**SendGrid:**
- [ ] Verify production sender email
- [ ] Copy production API key to `.env.production`
- [ ] Test email sending

**Twilio (if using):**
- [ ] Copy production credentials to `.env.production`
- [ ] Test SMS/Voice

**Sentry:**
- [ ] Create production project
- [ ] Copy production DSN to `.env.production`
- [ ] Test error logging

---

### Task 11: Deploy to Vercel (1 hour)
- [ ] Create Vercel project
- [ ] Connect GitHub repo
- [ ] Add all environment variables from `.env.production`
- [ ] Deploy: `vercel --prod`
- [ ] Test production URL
- [ ] Verify health check: `https://yourdomain.com/api/health`
- [ ] Check Vercel logs for errors

---

### Task 12: Post-Deployment Verification (1 hour)
- [ ] Visit production URL
- [ ] Test signup with real email
- [ ] Verify confirmation email received
- [ ] Test login
- [ ] Test lead creation
- [ ] Test payment with real card (then refund)
- [ ] Check Sentry for errors
- [ ] Check Vercel logs for errors
- [ ] Test webhook endpoints (Stripe, SendGrid)
- [ ] Verify custom domain routing (if configured)

---

## EMERGENCY ROLLBACK PLAN

If something goes wrong:

1. **Revert to Previous Deployment**
   ```bash
   vercel rollback
   ```

2. **Check Logs**
   - Vercel Dashboard → Deployments → Logs
   - Sentry Dashboard → Issues
   - Firebase Console → Firestore → Usage

3. **Common Issues:**
   - **500 errors:** Check environment variables in Vercel
   - **Auth not working:** Verify Firebase config
   - **Payments failing:** Check Stripe webhook secret
   - **Emails not sending:** Verify SendGrid API key and sender

---

## SUCCESS CRITERIA

Before announcing launch:
- ✅ Privacy Policy live and linked in footer
- ✅ Terms of Service live and linked in footer
- ✅ Cookie consent banner appears
- ✅ Signup requires "I agree" checkbox
- ✅ Demo mode disabled in production
- ✅ No secrets exposed in client bundle
- ✅ All critical TODOs fixed
- ✅ Full regression test passed
- ✅ Production environment configured
- ✅ Deployed to production
- ✅ Post-deployment verification passed

---

## AFTER LAUNCH (First 24 Hours)

Monitor these metrics:
- [ ] Error rate in Sentry (<1% target)
- [ ] Signup completion rate (>60% target)
- [ ] Payment success rate (>95% target)
- [ ] API response times (p95 <2s target)
- [ ] User feedback/support tickets

If any metric is outside target:
1. Check Sentry for errors
2. Check Vercel logs
3. Check Firebase quota usage
4. Review user flow in PostHog (if configured)

---

## CONTACT

**Questions?** See `PRODUCTION_READINESS_AUDIT_REPORT.md` for full details.

**Next Steps:** After completing these blockers, review the HIGH PRIORITY items in the main audit report.

---

**Good luck with your launch!** 🚀
