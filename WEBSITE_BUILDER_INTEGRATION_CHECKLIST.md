# Website Builder Integration & Testing Checklist

Use this checklist to verify the website builder is fully integrated and functional.

## ✅ Pre-Integration Setup

### Database Setup
- [ ] Run database initialization script: `node scripts/init-website-builder-db.js`
- [ ] Verify Firestore collections created for each organization
- [ ] Verify global collections exist (`custom-domains`, `subdomains`)
- [ ] Deploy updated Firestore rules: `firebase deploy --only firestore:rules`

### Environment Variables
- [ ] All required env vars set (see `WEBSITE_BUILDER_ENVIRONMENT_SETUP.md`)
- [ ] Firebase credentials configured
- [ ] Vercel API credentials set (if using custom domains)
- [ ] App URL and base domain configured
- [ ] Cron secret set (if using scheduled publishing)

### Dependencies
- [ ] All npm packages installed: `npm install`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No linting errors: `npm run lint`

---

## 🧪 Sprint 5: Publishing & Preview Testing

### Publishing Workflow
- [ ] **Create draft page**
  - Navigate to `/workspace/{orgId}/website/pages`
  - Click "Create Page"
  - Fill in title and slug
  - Verify page created with status="draft"

- [ ] **Publish page**
  - Open page in editor
  - Click "Publish"
  - Verify status changes to "published"
  - Verify `publishedAt` timestamp set
  - Verify audit log entry created

- [ ] **Unpublish page**
  - Click "Unpublish" on published page
  - Verify status reverts to "draft"
  - Verify audit log entry created

- [ ] **Schedule page**
  - Click "Schedule"
  - Set future date/time
  - Verify status changes to "scheduled"
  - Verify `scheduledFor` field set

### Preview System
- [ ] **Generate preview link**
  - Open draft page
  - Click "Preview"
  - Verify preview token generated
  - Verify preview URL created

- [ ] **Access preview**
  - Open preview URL in incognito window
  - Verify page content displays
  - Verify "Preview Mode" banner shows
  - Verify responsive breakpoints work

- [ ] **Preview expiration**
  - Wait 24+ hours OR manually set old expiry in DB
  - Try accessing preview link
  - Verify "Preview token expired" error

### Version History
- [ ] **Create versions**
  - Publish page multiple times
  - Verify versions created in `versions` subcollection
  - Verify version numbers increment

- [ ] **View history**
  - Navigate to version history
  - Verify all versions listed
  - Verify version metadata correct

- [ ] **Restore version**
  - Click "Restore" on old version
  - Verify page content restored
  - Verify status becomes "draft"

### Audit Log
- [ ] **View audit log**
  - Navigate to `/workspace/{orgId}/website/settings`
  - Click "Audit Log"
  - Verify entries displayed

- [ ] **Filter audit log**
  - Filter by event type
  - Filter by page
  - Verify filtering works

### Scheduled Publishing
- [ ] **Setup cron**
  - Configure Vercel cron in `vercel.json`
  - OR setup external cron job

- [ ] **Test scheduled publish**
  - Create page scheduled for 5 minutes from now
  - Wait 5 minutes
  - Verify cron runs
  - Verify page status changes to "published"
  - Verify audit log entry created

### Performance
- [ ] **Image optimization**
  - Add images to page
  - Inspect network tab
  - Verify WebP/AVIF served when supported
  - Verify responsive srcsets used

- [ ] **Lazy loading**
  - Create page with multiple images
  - Open browser DevTools Network tab
  - Scroll slowly
  - Verify images load as they enter viewport

- [ ] **CDN caching**
  - Access published page
  - Check response headers
  - Verify `Cache-Control` headers present
  - Verify `stale-while-revalidate` set

---

## 🌐 Sprint 6: Custom Domains Testing

### Domain Management UI
- [ ] **Add custom domain**
  - Navigate to `/workspace/{orgId}/website/domains`
  - Click "Add Domain"
  - Enter domain name (e.g., `example.com`)
  - Verify domain added
  - Verify DNS instructions displayed

- [ ] **View DNS records**
  - Click "Show DNS Records"
  - Verify CNAME or A records displayed
  - Verify values are correct

- [ ] **Remove domain**
  - Click "Remove" on domain
  - Confirm deletion
  - Verify domain removed from UI
  - Verify domain removed from Firestore

### DNS Verification
- [ ] **Configure DNS**
  - Add CNAME/A records at DNS provider
  - Wait for propagation (5-60 minutes)

- [ ] **Verify DNS**
  - Click "Verify DNS" button
  - If not ready: verify "DNS records not found" error
  - If ready: verify status changes to "verified"

### SSL Provisioning (Requires Vercel API)
- [ ] **Automatic SSL**
  - After DNS verification
  - Wait 5-10 minutes
  - Verify SSL status becomes "active"
  - Verify `sslIssuedAt` timestamp set

- [ ] **Test SSL redirect**
  - Access custom domain via HTTP
  - Verify automatic redirect to HTTPS
  - Verify page loads correctly

### Custom Domain Routing
- [ ] **Test custom domain**
  - Access site via custom domain
  - Verify correct organization's content loads
  - Verify multi-tenant isolation

- [ ] **Test subdomain**
  - Access site via `{subdomain}.yourplatform.com`
  - Verify correct organization's content loads

---

## 📱 Sprint 7: Mobile & Accessibility Testing

### Responsive Design
- [ ] **Desktop view (1920px)**
  - All templates display correctly
  - Navigation works
  - Images scale properly

- [ ] **Tablet view (768px)**
  - Layout adapts appropriately
  - Touch targets are large enough
  - Navigation accessible

- [ ] **Mobile view (375px)**
  - Content stacks vertically
  - Hamburger menu appears
  - Text remains readable
  - No horizontal scrolling

### Mobile Navigation
- [ ] **Hamburger menu**
  - Click hamburger icon
  - Verify menu opens
  - Click menu item
  - Verify menu closes
  - Verify navigation works

### Accessibility (WCAG AA)
- [ ] **Keyboard navigation**
  - Tab through all interactive elements
  - Verify focus indicators visible
  - Verify logical tab order
  - Test "Skip to main content" link

- [ ] **Screen reader**
  - Test with screen reader (NVDA/JAWS/VoiceOver)
  - Verify ARIA labels present
  - Verify headings hierarchical
  - Verify images have alt text

- [ ] **Color contrast**
  - Use browser DevTools or WAVE
  - Verify all text meets 4.5:1 ratio
  - Verify buttons/links have good contrast

- [ ] **Forms**
  - All form fields have labels
  - Error messages are clear
  - Required fields indicated

---

## 📝 Sprint 8: Testing & Documentation

### E2E Tests
- [ ] **Run test suite**
  ```bash
  npm run test:e2e
  ```
- [ ] All tests pass
- [ ] No console errors during tests

### User Documentation
- [ ] Review `docs/WEBSITE_BUILDER_USER_GUIDE.md`
- [ ] All features documented
- [ ] Screenshots/examples clear
- [ ] Troubleshooting section helpful

### Onboarding Flow
- [ ] **First-time user**
  - Access website builder as new user
  - Verify onboarding modal appears
  - Complete all onboarding steps
  - Verify site initialized correctly

---

## 🔒 Security & Multi-Tenant Testing

### Organization Isolation
- [ ] **Create test orgs**
  - Create 2+ test organizations
  - Create pages in each

- [ ] **Test isolation**
  - Try accessing Org A's pages from Org B
  - Verify 403 Forbidden error
  - Check API responses don't leak data

- [ ] **Custom domain isolation**
  - Add domain to Org A
  - Try adding same domain to Org B
  - Verify "domain already in use" error

### API Security
- [ ] **Missing organizationId**
  - Call API without organizationId
  - Verify 400 Bad Request error

- [ ] **Wrong organizationId**
  - Call API with different organizationId
  - Verify 403 Forbidden error

- [ ] **Firestore rules**
  - Try direct Firestore access from client
  - Verify rules enforce isolation
  - Verify no cross-org reads/writes

---

## ⚡ Performance Testing

### Page Load Speed
- [ ] **Lighthouse audit**
  - Run Lighthouse on published page
  - Performance score >= 90
  - Accessibility score >= 90
  - Best Practices score >= 90
  - SEO score >= 90

### API Response Times
- [ ] **List pages** - < 500ms
- [ ] **Get single page** - < 200ms
- [ ] **Publish page** - < 1s
- [ ] **Generate preview** - < 500ms

### Database Performance
- [ ] Monitor Firestore usage
- [ ] Verify indexes created
- [ ] No slow queries (> 1s)

---

## 🐛 Known Issues to Test

### Edge Cases
- [ ] Page with no content
- [ ] Page with 100+ widgets
- [ ] Extremely long page title/slug
- [ ] Special characters in content
- [ ] Multiple domains per org
- [ ] Domain transfer between orgs
- [ ] Concurrent edits (2 users same page)
- [ ] Network failure during save
- [ ] Browser refresh during publish

### Error Handling
- [ ] Invalid page ID
- [ ] Expired preview token
- [ ] DNS verification failure
- [ ] SSL provisioning failure
- [ ] Cron job failure
- [ ] Firestore quota exceeded

---

## 📊 Final Production Checklist

### Pre-Launch
- [ ] All integration tests passing
- [ ] All security tests passing
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Environment variables set in production
- [ ] Firestore rules deployed
- [ ] Cron jobs configured
- [ ] Error monitoring setup (Sentry)
- [ ] Analytics configured

### Launch
- [ ] Deploy to production
- [ ] Smoke test all features
- [ ] Monitor error logs
- [ ] Monitor performance
- [ ] Test with real users

### Post-Launch
- [ ] Collect user feedback
- [ ] Monitor performance metrics
- [ ] Track error rates
- [ ] Review audit logs
- [ ] Plan next iteration

---

## 🎯 Success Criteria

The website builder is **ready for production** when:

- ✅ ALL checklist items completed
- ✅ Zero critical bugs
- ✅ Performance scores >= 90
- ✅ Multi-tenant isolation verified
- ✅ Custom domains working with SSL
- ✅ Scheduled publishing working
- ✅ Documentation complete
- ✅ E2E tests passing

**Current Status:** 🔄 Integration in progress

Update this document as you complete each section!

