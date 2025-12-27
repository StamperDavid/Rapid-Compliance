# 🚀 Website Builder - Quick Start

**Test the multi-tenant website builder in 3 steps**

---

## Step 1: Seed Test Data

```bash
npm run seed:website-test
```

**This creates:**
- Organization A (`testa.localhost:3000`)
- Organization B (`testb.localhost:3000`)
- Sample pages for each
- Website settings configured

---

## Step 2: Start Server

```bash
npm run dev
```

Wait for: `✓ Ready on http://localhost:3000`

---

## Step 3: Test Multi-Tenant Isolation

### Quick Visual Test

Open these URLs in your browser:

**Organization A's Site:**
```
http://testa.localhost:3000
```
Expected: Homepage saying "Welcome to Organization A"

**Organization B's Site:**
```
http://testb.localhost:3000
```
Expected: Homepage saying "Welcome to Organization B"

**Non-Existent Site:**
```
http://invalid.localhost:3000
```
Expected: 404 "Site Not Found" page

### Quick API Test

**Get Org A's pages:**
```bash
curl "http://localhost:3000/api/website/pages?organizationId=org_test_a"
```

**Get Org B's pages:**
```bash
curl "http://localhost:3000/api/website/pages?organizationId=org_test_b"
```

**Try without organizationId (should fail):**
```bash
curl "http://localhost:3000/api/website/pages"
```
Expected: `{"error":"organizationId is required"}`

### Settings Pages

**Org A Settings:**
```
http://localhost:3000/workspace/org_test_a/website/settings
```

**Org B Settings:**
```
http://localhost:3000/workspace/org_test_b/website/settings
```

Each should show different subdomain values (`testa` vs `testb`)

---

## ✅ What to Verify

| Test | Expected Result |
|------|-----------------|
| Visit `testa.localhost:3000` | Shows Org A content ONLY |
| Visit `testb.localhost:3000` | Shows Org B content ONLY |
| API call for Org A | Returns Org A pages ONLY |
| API call for Org B | Returns Org B pages ONLY |
| API without orgId | Returns 400 error |
| Settings page for Org A | Shows `subdomain: "testa"` |
| Settings page for Org B | Shows `subdomain: "testb"` |
| Invalid subdomain | Returns 404 error |

**If all tests pass:** Multi-tenant isolation is working! ✅

---

## 🔍 Full Testing Guide

For comprehensive testing of all security features:

📖 See **WEBSITE_BUILDER_TESTING_GUIDE.md**

---

## 🐛 Troubleshooting

### Subdomain not resolving?

**On Windows:**
1. Edit: `C:\Windows\System32\drivers\etc\hosts`
2. Add:
   ```
   127.0.0.1 testa.localhost
   127.0.0.1 testb.localhost
   ```

**On Mac/Linux:**
1. Edit: `/etc/hosts`
2. Add same lines above

### Middleware not running?

Check console for middleware logs. You should see:
```
[Middleware] Subdomain detected: testa
[Middleware] Mapped to org: org_test_a
```

### API returns errors?

1. Verify Firestore is running
2. Check `serviceAccountKey.json` exists
3. Run: `npm run dev` (restart server)

---

## 📊 What Was Built

**Sprint 1 delivered:**
- ✅ Complete type system (500+ lines)
- ✅ Firestore security rules (100+ lines)
- ✅ 5 API routes with org validation
- ✅ Subdomain routing middleware
- ✅ Site settings UI
- ✅ Public site renderer
- ✅ Test suite structure
- ✅ Seed scripts

**Multi-tenant security:**
- ✅ Every query scoped to organizationId
- ✅ Firestore rules enforce isolation
- ✅ Cannot access other org's data
- ✅ Domain/subdomain hijacking prevented
- ✅ Public vs draft separation

---

## 🎯 Next Steps

After verifying multi-tenant isolation works:

**Sprint 2: Visual Page Builder** (6-7 days)
- Drag-drop editor
- 35+ widgets
- Visual styling
- Content editing
- Template system

**Ready to proceed when you are!**

