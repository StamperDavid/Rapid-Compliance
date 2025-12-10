# Test Suite

Comprehensive tests for the AI Sales Platform.

## Test Coverage

### ✅ Unit Tests
- **Ensemble Service** - Multi-model AI scoring and selection
- **Payment Service** - Payment processing across 8 providers
- **OAuth Service** - OAuth 2.0 flows for integrations
- **QuickBooks Service** - Accounting sync (customers, invoices, payments)
- **Xero Service** - Accounting sync (contacts, invoices, payments)

### 🔄 Integration Tests (Pending)
- API endpoint tests
- Database integration tests
- External service mocks

### 🌐 E2E Tests (Pending)
- Full user flows
- Payment processing
- Agent conversations
- Workflow execution

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test ensemble-service.test.ts

# Watch mode
npm test -- --watch
```

## Test Structure

```
tests/
├── setup.ts                    # Global test configuration
├── ensemble-service.test.ts    # AI ensemble tests
├── payment-service.test.ts     # Payment provider tests
├── oauth-service.test.ts       # OAuth integration tests
└── README.md                   # This file
```

## Writing Tests

### Example Test

```typescript
import { describe, it, expect } from '@jest/globals';

describe('My Feature', () => {
  it('should work correctly', () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

### Mocking

Tests use Jest mocks for external services:
- Firestore
- API Keys
- External APIs (Stripe, QuickBooks, etc.)

See `setup.ts` for global mocks.

## TODO

- [ ] Add integration tests for API routes
- [ ] Add E2E tests with Playwright
- [ ] Increase coverage to 80%+
- [ ] Add performance tests
- [ ] Add load tests for ensemble mode











