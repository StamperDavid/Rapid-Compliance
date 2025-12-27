# 🧪 Website Builder - Testing Guide

**Multi-Tenant Isolation Verification**

---

## 🚀 Quick Start Testing

### 1. Seed Test Data

```bash
npm run seed:website-test
```

This creates:
- **Organization A** (`org_test_a`) with subdomain `testa`
- **Organization B** (`org_test_b`) with subdomain `testb`
- Sample pages for each org
- Settings configured

### 2. Start Dev Server

```bash
npm run dev
```

### 3. Test Multi-Tenant Isolation

---

## ✅ Test Scenarios

### Test 1: Subdomain Isolation

**Verify Org A and Org B are completely isolated**

1. **Visit Org A's site:**
   ```
   http://testa.localhost:3000
   ```
   - Should show Org A's homepage
   - Should NOT show any Org B content

2. **Visit Org B's site:**
   ```
   http://testb.localhost:3000
   ```
   - Should show Org B's homepage
   - Should NOT show any Org A content

3. **Visit non-existent subdomain:**
   ```
   http://invalid.localhost:3000
   ```
   - Should show 404 "Site Not Found" page

**✅ PASS:** Each subdomain shows only its org's content

---

### Test 2: API Isolation

**Verify API routes enforce org boundaries**

1. **Get Org A's pages:**
   ```bash
   curl "http://localhost:3000/api/website/pages?organizationId=org_test_a"
   ```
   - Should return Org A's pages only

2. **Get Org B's pages:**
   ```bash
   curl "http://localhost:3000/api/website/pages?organizationId=org_test_b"
   ```
   - Should return Org B's pages only
   - Should NOT include Org A's pages

3. **Try to get pages without organizationId:**
   ```bash
   curl "http://localhost:3000/api/website/pages"
   ```
   - Should return 400 Bad Request
   - Error: "organizationId is required"

**✅ PASS:** API enforces organizationId requirement

---

### Test 3: Cross-Org Access Prevention

**Verify Org A cannot access Org B's data**

1. **Try to get Org B's page with Org A's ID:**
   
   Get Org B's page ID from the seed script output, then:
   ```bash
   curl "http://localhost:3000/api/website/pages/[ORG_B_PAGE_ID]?organizationId=org_test_a"
   ```
   - Should return 404 (page not found in Org A)
   
   OR if you try with Org B's organizationId but Org A credentials:
   - Should return 403 Forbidden (once auth is implemented)

**✅ PASS:** Cannot access another org's pages

---

### Test 4: Settings Isolation

**Verify settings are org-scoped**

1. **Visit Org A's settings page:**
   ```
   http://localhost:3000/workspace/org_test_a/website/settings
   ```
   - Should show Org A's settings
   - Subdomain should be "testa"

2. **Visit Org B's settings page:**
   ```
   http://localhost:3000/workspace/org_test_b/website/settings
   ```
   - Should show Org B's settings
   - Subdomain should be "testb"

3. **Check API responses:**
   ```bash
   curl "http://localhost:3000/api/website/settings?organizationId=org_test_a"
   ```
   - Should show `"subdomain": "testa"`

**✅ PASS:** Each org has isolated settings

---

### Test 5: Page Creation Isolation

**Verify new pages are org-scoped**

1. **Create page in Org A:**
   ```bash
   curl -X POST "http://localhost:3000/api/website/pages" \
     -H "Content-Type: application/json" \
     -d '{
       "organizationId": "org_test_a",
       "page": {
         "title": "Test Page A",
         "slug": "test-a",
         "content": [],
         "status": "published"
       }
     }'
   ```

2. **Verify page exists in Org A:**
   ```bash
   curl "http://localhost:3000/api/website/pages?organizationId=org_test_a"
   ```
   - Should include "Test Page A"

3. **Verify page does NOT exist in Org B:**
   ```bash
   curl "http://localhost:3000/api/website/pages?organizationId=org_test_b"
   ```
   - Should NOT include "Test Page A"

**✅ PASS:** New pages are org-scoped

---

### Test 6: Subdomain Registry

**Verify subdomain conflicts are prevented**

1. **Check existing subdomains:**
   ```bash
   # In Firestore console, check /subdomains collection
   # Should see: testa → org_test_a, testb → org_test_b
   ```

2. **Try to claim an existing subdomain** (via Firestore):
   - Attempt to create `/subdomains/testa` with different organizationId
   - Should be blocked by Firestore rules

**✅ PASS:** Subdomains cannot be hijacked

---

### Test 7: Custom Domain Isolation

**Verify custom domain mapping**

1. **Add custom domain to Org A:**
   ```bash
   curl -X PUT "http://localhost:3000/api/website/settings" \
     -H "Content-Type: application/json" \
     -d '{
       "organizationId": "org_test_a",
       "settings": {
         "customDomain": "www.test-a.com"
       }
     }'
   ```

2. **Verify domain registered:**
   ```bash
   curl "http://localhost:3000/api/website/domain/www.test-a.com"
   ```
   - Should return: `"organizationId": "org_test_a"`

3. **Try to register same domain for Org B:**
   - Should fail (domain already claimed)

**✅ PASS:** Domains map to single org only

---

## 🔍 Browser Testing

### Test Published vs Draft Isolation

1. **Create draft page in Org A:**
   - Go to settings, create page with status="draft"

2. **Visit as public user:**
   ```
   http://testa.localhost:3000/draft-page
   ```
   - Should return 404 (draft not public)

3. **Create published page:**
   - Create page with status="published"

4. **Visit as public user:**
   ```
   http://testa.localhost:3000/published-page
   ```
   - Should show the page (published is public)

**✅ PASS:** Drafts require authentication, published are public

---

## 🛡️ Security Verification

### Check Firestore Rules

1. **Open Firebase Console → Firestore → Rules**

2. **Verify rules exist for:**
   - `/organizations/{orgId}/website/pages/{pageId}`
   - `/organizations/{orgId}/website/settings`
   - `/customDomains/{domain}`
   - `/subdomains/{subdomain}`

3. **Test rules in Firestore Rules Playground:**
   ```
   Authenticated as: user@example.com (orgId: org_test_a)
   Try to read: /organizations/org_test_b/website/pages/page1
   Expected: DENIED
   ```

**✅ PASS:** Firestore rules enforce isolation

---

## 📊 Performance Testing

### Check Middleware Caching

1. **Visit subdomain multiple times:**
   ```bash
   curl -w "@curl-format.txt" "http://testa.localhost:3000"
   curl -w "@curl-format.txt" "http://testa.localhost:3000"
   ```

2. **Check server logs:**
   - First request: Should query Firestore
   - Second request (within 5 min): Should use cache

**✅ PASS:** Subdomain lookups are cached

---

## 🐛 Troubleshooting

### Subdomain not working?

**Issue:** `testa.localhost:3000` doesn't resolve

**Solution:**
1. Check if middleware is running (look for middleware logs)
2. Verify `/subdomains/testa` exists in Firestore
3. Try adding to hosts file:
   ```
   # /etc/hosts (Mac/Linux) or C:\Windows\System32\drivers\etc\hosts (Windows)
   127.0.0.1 testa.localhost
   127.0.0.1 testb.localhost
   ```

### API returns 404?

**Issue:** API route not found

**Solution:**
1. Verify dev server is running: `npm run dev`
2. Check API route exists: `src/app/api/website/...`
3. Check for TypeScript errors: `npm run type-check`

### Firestore permission denied?

**Issue:** Getting permission errors

**Solution:**
1. Check Firebase Admin SDK is initialized
2. Verify `serviceAccountKey.json` exists and is valid
3. Check Firestore rules are deployed

---

## ✅ Testing Checklist

Mark each as you test:

- [ ] Subdomain routing works (testa.localhost, testb.localhost)
- [ ] Each subdomain shows only its org's content
- [ ] Non-existent subdomains return 404
- [ ] API requires organizationId parameter
- [ ] API returns only requested org's data
- [ ] Cannot access other org's pages
- [ ] Settings page is org-scoped
- [ ] New pages are isolated to creator's org
- [ ] Subdomain conflicts prevented
- [ ] Custom domains map to single org
- [ ] Draft pages not publicly accessible
- [ ] Published pages are public
- [ ] Firestore rules enforce isolation
- [ ] Middleware caches subdomain lookups
- [ ] No linter/TypeScript errors

---

## 🎯 Expected Results

After running all tests, you should verify:

1. **Zero data leaks** - Org A cannot see Org B's content
2. **Subdomain isolation** - Each subdomain shows only its org
3. **API validation** - All routes require organizationId
4. **Domain protection** - Cannot hijack subdomains/domains
5. **Public/private separation** - Drafts hidden, published visible
6. **Performance** - Caching works, fast lookups

**If all tests pass, multi-tenant architecture is verified! ✅**

---

## 📝 Manual Test Log

Date: _______________  
Tester: _______________

| Test | Status | Notes |
|------|--------|-------|
| Subdomain routing | [ ] Pass [ ] Fail | |
| API isolation | [ ] Pass [ ] Fail | |
| Cross-org prevention | [ ] Pass [ ] Fail | |
| Settings isolation | [ ] Pass [ ] Fail | |
| Page creation | [ ] Pass [ ] Fail | |
| Subdomain registry | [ ] Pass [ ] Fail | |
| Domain isolation | [ ] Pass [ ] Fail | |
| Draft/published | [ ] Pass [ ] Fail | |
| Firestore rules | [ ] Pass [ ] Fail | |
| Performance | [ ] Pass [ ] Fail | |

**Overall Result:** [ ] PASS [ ] FAIL

**Issues Found:**
_____________________________________
_____________________________________
_____________________________________

