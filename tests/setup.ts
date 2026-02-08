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
  const actualModule = jest.requireActual('@/lib/db/firestore-service');
  
  // Re-export everything from the actual module but override FirestoreService
  const mocked = {
    ...actualModule,
    FirestoreService: AdminFirestoreService,
  };
  
  // Now recreate EmailCampaignService to use the mocked FirestoreService
  // Note: orgId parameter retained for backward compatibility but uses PLATFORM_ID internally
  const { PLATFORM_ID: INTERNAL_PLATFORM_ID } = require('@/lib/constants/platform');

  mocked.EmailCampaignService = class EmailCampaignService {
    static async get(campaignId: string) {
      return AdminFirestoreService.get(
        `${mocked.COLLECTIONS.ORGANIZATIONS}/${INTERNAL_PLATFORM_ID}/${mocked.COLLECTIONS.EMAIL_CAMPAIGNS}`,
        campaignId
      );
    }

    static async set(campaignId: string, data: any) {
      return AdminFirestoreService.set(
        `${mocked.COLLECTIONS.ORGANIZATIONS}/${INTERNAL_PLATFORM_ID}/${mocked.COLLECTIONS.EMAIL_CAMPAIGNS}`,
        campaignId,
        data,
        false
      );
    }

    static async getAll(filters: any[] = []) {
      return AdminFirestoreService.getAll(
        `${mocked.COLLECTIONS.ORGANIZATIONS}/${INTERNAL_PLATFORM_ID}/${mocked.COLLECTIONS.EMAIL_CAMPAIGNS}`,
        filters
      );
    }

    static async getAllPaginated(filters: any[] = [], pageSize: number = 50, lastVisible?: any) {
      return AdminFirestoreService.getAllPaginated(
        `${mocked.COLLECTIONS.ORGANIZATIONS}/${INTERNAL_PLATFORM_ID}/${mocked.COLLECTIONS.EMAIL_CAMPAIGNS}`,
        filters,
        pageSize,
        lastVisible
      );
    }

    static async delete(campaignId: string) {
      return AdminFirestoreService.delete(
        `${mocked.COLLECTIONS.ORGANIZATIONS}/${INTERNAL_PLATFORM_ID}/${mocked.COLLECTIONS.EMAIL_CAMPAIGNS}`,
        campaignId
      );
    }
  };
  
  return mocked;
});

// No mocking of API Key Service - use real implementation for production readiness

import { PLATFORM_ID } from '@/lib/constants/platform';

// Export common test utilities
export const mockOrganizationId = PLATFORM_ID;
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

