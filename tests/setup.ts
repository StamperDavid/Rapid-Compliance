/**
 * Test Setup
 * Global test configuration and mocks
 */

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
Object.defineProperty(process.env, 'NODE_ENV', {
  value: 'test',
  writable: true,
});

// Mock Firestore
jest.mock('@/lib/db/firestore-service', () => ({
  FirestoreService: {
    get: jest.fn(),
    set: jest.fn(),
    getAll: jest.fn(),
    delete: jest.fn(),
  },
  COLLECTIONS: {
    ORGANIZATIONS: 'organizations',
    USERS: 'users',
    WORKSPACES: 'workspaces',
  },
}));

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

