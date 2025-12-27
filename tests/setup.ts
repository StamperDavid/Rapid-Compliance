/**
 * Test Setup
 * Global test configuration - uses real Firebase Admin SDK
 */

// Set test environment
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
Object.defineProperty(process.env, 'NODE_ENV', {
  value: 'test',
  writable: true,
});

// Mock FirestoreService to use AdminFirestoreService (proper way for tests)
// This uses Admin SDK which bypasses security rules
jest.mock('@/lib/db/firestore-service', () => {
  const { AdminFirestoreService } = jest.requireActual('@/lib/db/admin-firestore-service');
  return {
    FirestoreService: AdminFirestoreService,
    COLLECTIONS: jest.requireActual('@/lib/db/firestore-service').COLLECTIONS,
  };
});

// Mock API Key Service
jest.mock('@/lib/api-keys/api-key-service', () => ({
  apiKeyService: {
    getKeys: jest.fn(),
    getServiceKey: jest.fn(),
    saveKeys: jest.fn(),
  },
}));

// Export common test utilities
export const mockOrganizationId = 'test-org-123';
export const mockWorkspaceId = 'test-workspace-456';
export const mockUserId = 'test-user-789';

export const mockCustomer = {
  id: 'customer-123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '+1234567890',
};

export const mockPaymentRequest = {
  workspaceId: mockWorkspaceId,
  amount: 100,
  currency: 'USD',
  paymentMethod: 'card',
  paymentToken: 'tok_test_123',
  customer: mockCustomer,
};

