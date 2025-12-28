# E2E Testing Guide - Best Practices

**Philosophy:** Real testing with actual Firebase, not mocks.

## 🎯 Why No Mocks?

Mock-heavy tests don't catch:
- Real Firestore query issues
- Actual API integration problems  
- Data validation errors
- Security rule violations
- Performance bottlenecks

**Our approach:** Test the actual system end-to-end.

---

## 🚀 Quick Start

### Option 1: Automated Pipeline (Recommended)
```bash
# Runs emulators + seeds data + tests + cleanup
npm run test:e2e:full
```

### Option 2: Manual Control
```bash
# Terminal 1: Start emulators
firebase emulators:start

# Terminal 2: Seed test data
node scripts/seed-e2e-test-data.js

# Terminal 3: Run E2E tests
npm run test:e2e

# When done, stop emulators (Ctrl+C in Terminal 1)
```

---

## 📁 Test Structure

```
tests/
├── e2e-setup.ts                    # Firebase connection & helpers
├── e2e/
│   ├── email-sequences.e2e.test.ts # Sequence enrollment & webhooks
│   ├── sms-campaigns.e2e.test.ts   # SMS delivery tracking
│   ├── workflows.e2e.test.ts       # Workflow execution
│   └── analytics.e2e.test.ts       # Analytics calculations
└── E2E_TESTING_GUIDE.md            # This file
```

---

## ✅ What Gets Tested

### Email Sequences (`email-sequences.e2e.test.ts`)
- ✅ Prospect enrollment (real Firestore write)
- ✅ Duplicate prevention (real query check)
- ✅ Webhook handling (open/click/bounce)
- ✅ Auto-unenroll on bounce
- ✅ Analytics updates (real calculations)

### SMS Campaigns (`sms-campaigns.e2e.test.ts`)
- ✅ Twilio message sending
- ✅ Delivery status tracking
- ✅ Webhook processing
- ✅ Hard bounce handling

### Workflows (`workflows.e2e.test.ts`)
- ✅ All 9 action types
- ✅ Condition evaluation
- ✅ Variable resolution
- ✅ Error handling

---

## 🏗️ Test Data

### Test Organization
- **Name:** E2E Automated Testing Org
- **Email:** e2e-auto-test@example.com
- **Password:** E2ETest123!Secure
- **Plan:** Professional
- **Status:** Active

### Test Prospects (3 created automatically)
1. Alice Anderson - prospect1@testcompany.com - +15555550001
2. Bob Builder - prospect2@testcompany.com - +15555550002
3. Carol Carter - prospect3@testcompany.com - +15555550003

### Test Assets
- 1 Email Sequence (2 steps)
- 1 Workflow (email action)
- API keys configured (test mode)

---

## 🔧 Adding New E2E Tests

### Step 1: Check Prerequisites
```typescript
beforeAll(async () => {
  // Verify emulators are running
  // Get test org from Firestore
  // Verify test data exists
});
```

### Step 2: Write Real Tests (No Mocks!)
```typescript
it('should do something real', async () => {
  // Call actual service
  const result = await MyService.doSomething(orgId);
  
  // Verify in ACTUAL Firestore
  const doc = await db.collection('..').doc('..').get();
  expect(doc.exists).toBe(true);
});
```

### Step 3: Add Cleanup (If Needed)
```typescript
afterAll(async () => {
  // Clean up test data if necessary
  // Don't delete the core test org (it's reused)
});
```

---

## 🎓 Best Practices

### ✅ DO:
- Use real Firestore queries
- Test actual API endpoints
- Verify data persistence
- Test error conditions
- Use descriptive console.logs for debugging
- Set appropriate timeouts (10-30 seconds)

### ❌ DON'T:
- Mock Firestore (defeats the purpose!)
- Use fake data generators
- Skip cleanup
- Test UI in E2E tests (use Playwright for that)
- Make tests dependent on each other

---

## 🐛 Troubleshooting

### "Test organization not found"
```bash
# Seed the test data first
node scripts/seed-e2e-test-data.js
```

### "FIRESTORE_EMULATOR_HOST not set"
```bash
# Start emulators first
firebase emulators:start
```

### "Connection refused"
- Check emulators are running on localhost:8080 (Firestore) and localhost:9099 (Auth)
- Verify firebase.json emulator configuration

### Tests timeout
- Increase timeout in test: `it('test', async () => {}, 30000);`
- Check if emulators are slow (try restarting them)

---

## 📊 Coverage Goals

Target coverage with E2E tests:
- **Critical Flows:** 100% (sequences, payments, auth)
- **Major Features:** 80% (workflows, analytics, CRM)
- **Edge Cases:** 60% (error handling, validation)

---

## 🚀 CI/CD Integration

### GitHub Actions Example
```yaml
- name: Start Firebase Emulators
  run: firebase emulators:start --only firestore,auth &
  
- name: Wait for emulators
  run: sleep 10

- name: Seed test data
  run: node scripts/seed-e2e-test-data.js

- name: Run E2E tests
  run: npm run test:e2e

- name: Stop emulators
  run: pkill -f "firebase emulators"
```

---

## 💡 Tips

1. **Run E2E tests before committing major changes**
2. **Add new E2E test for each new feature**
3. **Keep tests independent** (don't rely on order)
4. **Use descriptive names** (test name = documentation)
5. **Log important steps** for debugging failures

---

**Remember:** If a test fails, it's finding a REAL bug. Fix the code, not the test!




