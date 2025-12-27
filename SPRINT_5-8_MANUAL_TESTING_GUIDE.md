# Sprint 5-8 Manual Testing Guide

## ✅ Setup Complete

### What Was Just Completed:

1. **Environment Configuration** ✅
   - Added website builder env vars to `env.template`
   - Configured Vercel cron for scheduled publishing

2. **Database Initialization** ✅
   - Initialized website builder collections for all 26 organizations
   - Created sample homepage for each org
   - Set up audit log structure
   - Initialized global custom domains and subdomains collections

3. **Frontend-Backend Integration** ✅
   - Added Publish/Unpublish buttons to editor toolbar
   - Added Preview button to generate shareable preview links
   - Implemented publish, unpublish, and preview functions
   - Fixed API response handling bugs

---

## 🧪 Sprint 5 Feature Testing

### Test 1: Access Website Builder

1. Open browser to: `http://localhost:3000`
2. Login to the platform (if not already logged in)
3. Navigate to any organization workspace
4. Click "Website" in the sidebar
5. You should see the website builder pages list

**Expected Result:** Website pages list loads without errors

---

### Test 2: Create and Edit a Page

1. From the pages list, click "New Page" or click on an existing page
2. You should be redirected to the page editor
3. The editor should show:
   - Page title and slug
   - Status badge (draft/published)
   - Three-panel layout: Widgets | Canvas | Properties
   - Toolbar with: Undo, Redo, Breakpoint switcher, Preview, Publish, Save

**Expected Result:** Editor loads successfully with all UI elements visible

**URL Format:** `http://localhost:3000/workspace/{orgId}/website/editor?pageId={pageId}`

---

### Test 3: Publish a Page

1. Open a page in the editor (status should be "draft")
2. Click the **"🚀 Publish"** button in the toolbar
3. Wait for the request to complete

**Expected Result:**
- Success alert: "Page published successfully! 🚀"
- Status badge changes from "DRAFT" to "PUBLISHED"
- Button changes to "📤 Unpublish"

**What Happens Behind the Scenes:**
- Creates a version snapshot (v1, v2, etc.)
- Updates page status to "published"
- Sets `publishedAt` timestamp
- Creates audit log entry

**Testing the API Directly:**
```bash
# Get a pageId from the database or UI
curl -X POST "http://localhost:3000/api/website/pages/{pageId}/publish" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "{orgId}"}'
```

---

### Test 4: Unpublish a Page

1. With a published page open, click **"📤 Unpublish"**
2. Confirm the action in the popup

**Expected Result:**
- Success alert: "Page unpublished successfully."
- Status badge changes back to "DRAFT"
- Button changes back to "🚀 Publish"
- `scheduledFor` field is cleared (if it was scheduled)

---

### Test 5: Generate Preview Link

1. Open any page (draft or published) in the editor
2. Click the **"👁️ Preview"** button
3. A preview link should open in a new tab
4. A prompt should show the preview URL for copying

**Expected Result:**
- New tab opens showing the preview page with:
  - Yellow "Preview Mode" banner at top
  - Breakpoint switcher (Desktop/Tablet/Mobile)
  - Page content rendered
- Prompt displays preview URL (valid for 24 hours)

**Preview URL Format:** `http://localhost:3000/preview/{token}`

**Testing the Preview:**
- Copy the preview link
- Open it in an incognito/private window
- Should see the page content without needing to login
- Preview banner should show status and last updated time

---

### Test 6: Preview Expiration

**Note:** Preview tokens expire after 24 hours. To test expiration:

**Option A - Manual Database Edit:**
1. Generate a preview link
2. In Firebase Console, navigate to:
   ```
   organizations/{orgId}/website/preview-tokens/tokens/{token}
   ```
3. Change `expiresAt` to a past date
4. Try accessing the preview link

**Expected Result:** "Preview token has expired" error message

**Option B - Wait 24 Hours:**
1. Generate a preview link
2. Wait 24+ hours
3. Try accessing it

---

### Test 7: Version History

**Check Version Creation:**
1. Publish a page multiple times (make small edits between publishes)
2. In Firebase Console, navigate to:
   ```
   organizations/{orgId}/website/pages/items/{pageId}/versions
   ```
3. You should see version documents: `v1`, `v2`, `v3`, etc.

**Each version should contain:**
- `version` number
- `content` snapshot
- `seo` data
- `title` and `slug`
- `status` at time of publishing
- `createdAt` timestamp
- `createdBy` user

**Note:** Version restoration UI is not yet implemented. Versions are being created correctly.

---

### Test 8: Audit Log

**Check Audit Log Entries:**
1. After publishing/unpublishing pages, navigate to Firebase Console:
   ```
   organizations/{orgId}/website/audit-log/entries
   ```

**Expected Audit Log Entries:**
- `page_published` - When page is published
- `page_unpublished` - When page is unpublished
- `page_scheduled` - When page is scheduled for future publishing

**Each entry should contain:**
- `type` - Event type
- `pageId` - Page that was modified
- `pageTitle` - Page title
- `performedBy` - Currently "system" (TODO: actual user)
- `performedAt` - Timestamp
- `organizationId` - Organization ID
- `version` - Version number (for publish events)

**Note:** Audit log viewer UI is not yet implemented. Logs are being created correctly in the database.

---

## 🐛 Known Issues & Limitations

### Current Limitations:

1. **User Authentication Incomplete**
   - All actions currently use "system" as the user
   - TODO: Integrate actual user from Firebase Auth
   - APIs have `TODO: Use actual user` comments

2. **UI Not Yet Built:**
   - ❌ Audit log viewer page
   - ❌ Version history viewer
   - ❌ Version restoration functionality
   - ❌ Schedule publishing UI (API exists, no UI)

3. **Scheduled Publishing Not Tested:**
   - Cron job configured in `vercel.json`
   - API endpoint exists: `/api/cron/scheduled-publisher`
   - Not tested because Vercel cron only works in production
   - For local testing, would need external cron service

4. **Firebase Rules Not Deployed:**
   - Firebase CLI needs re-authentication
   - Rules are written and in `firestore.rules`
   - May need to run: `firebase login --reauth && firebase deploy --only firestore:rules`

---

## 🔍 Checking Firebase Data

### Published Page Status:
```
organizations/{orgId}/website/pages/items/{pageId}
```
Fields to check:
- `status: "published"`
- `publishedAt: "2025-..."
- `lastPublishedVersion: 1`
- `updatedAt: Timestamp`

### Preview Tokens:
```
organizations/{orgId}/website/preview-tokens/tokens/{token}
```
Fields:
- `pageId`
- `organizationId`
- `createdAt`
- `expiresAt` (24 hours from creation)
- `createdBy`

### Version History:
```
organizations/{orgId}/website/pages/items/{pageId}/versions/v{N}
```

### Audit Log:
```
organizations/{orgId}/website/audit-log/entries/{entryId}
```

---

## 📊 Success Criteria for Sprint 5

| Feature | Status | Notes |
|---------|--------|-------|
| Publish workflow | ✅ Backend ready, ✅ UI connected | Test by clicking Publish button |
| Unpublish workflow | ✅ Backend ready, ✅ UI connected | Test by clicking Unpublish button |
| Preview generation | ✅ Backend ready, ✅ UI connected | Test by clicking Preview button |
| Preview page display | ✅ Implemented | Preview page shows content correctly |
| Preview expiration | ✅ Implemented | Expires after 24 hours |
| Version history creation | ✅ Backend ready, ❌ UI not built | Versions created correctly |
| Audit log creation | ✅ Backend ready, ❌ UI not built | Audit entries created correctly |
| Multi-tenant isolation | ✅ Implemented | All APIs validate organizationId |
| Scheduled publishing API | ✅ Backend ready, ❌ UI not built | Can test with API directly |

---

## 🚀 Next Steps

### To Complete Sprint 5:

1. **Test All Features Manually** (You are here!)
   - Follow this testing guide
   - Report any bugs found
   - Verify data is created correctly in Firebase

2. **Build Missing UI Components:**
   - Audit log viewer page
   - Version history viewer with restore functionality
   - Schedule publishing modal/form

3. **Implement User Authentication:**
   - Replace "system" user with actual Firebase Auth user
   - Get user from session in API routes

4. **Deploy Firestore Rules:**
   - Re-authenticate Firebase CLI
   - Deploy rules to enforce security

5. **Test Scheduled Publishing:**
   - Deploy to Vercel staging
   - Test cron job execution
   - Verify scheduled pages publish automatically

---

## 📝 Reporting Bugs

When reporting bugs, please include:

1. **Steps to reproduce**
2. **Expected behavior**
3. **Actual behavior**
4. **Browser console errors** (F12 → Console tab)
5. **Network request details** (F12 → Network tab)
6. **Firebase data state** (if applicable)

---

## ✅ What to Test Next

After Sprint 5 testing is complete, we'll move on to:

- **Sprint 6**: Custom domains, DNS verification, SSL provisioning
- **Sprint 7**: Responsive design, mobile navigation, accessibility
- **Sprint 8**: E2E tests, performance optimization, documentation

**Current Focus:** Complete Sprint 5 testing and bug fixing before moving forward.

