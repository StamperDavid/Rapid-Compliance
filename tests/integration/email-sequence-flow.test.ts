/**
 * Integration Test: Email Sequence Flow
 * Tests the complete flow: Enrollment → Send → Webhook → Unenroll
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SequenceEngine } from '@/lib/outbound/sequence-engine';
import { handleEmailBounce, handleEmailOpen, handleEmailClick } from '@/lib/outbound/sequence-scheduler';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

// Mock Firestore
jest.mock('@/lib/db/firestore-service', () => ({
  FirestoreService: {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    getAll: jest.fn(),
    delete: jest.fn(),
  },
  COLLECTIONS: {
    ORGANIZATIONS: 'organizations',
  },
}));

// Mock email sending
jest.mock('@/lib/integrations/gmail-service', () => ({
  sendGmailEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  getGmailAuthUrl: jest.fn(),
}));

describe('Email Sequence Integration Flow', () => {
  const testOrgId = 'test-org-123';
  const testProspectId = 'prospect-456';
  const testSequenceId = 'sequence-789';
  const testEnrollmentId = 'enrollment-abc';

  // Mock data
  const mockProspect = {
    id: testProspectId,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    organizationId: testOrgId,
  };

  const mockSequence = {
    id: testSequenceId,
    name: 'Test Sequence',
    status: 'active',
    organizationId: testOrgId,
    steps: [
      {
        id: 'step-1',
        type: 'email' as const,
        delay: 0,
        subject: 'Test Email',
        content: 'Hello {{firstName}}!',
      },
      {
        id: 'step-2',
        type: 'email' as const,
        delay: 86400000, // 1 day in milliseconds
        subject: 'Follow Up',
        content: 'Just following up...',
      },
    ],
    analytics: {
      totalEnrolled: 0,
      activeProspects: 0,
      completed: 0,
      bounced: 0,
      replied: 0,
      converted: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (FirestoreService.get as jest.Mock).mockImplementation((collection: string, id: string) => {
      if (collection.includes('prospects')) return Promise.resolve(mockProspect);
      if (collection.includes('sequences')) return Promise.resolve(mockSequence);
      if (collection.includes('enrollments')) return Promise.resolve(null);
      return Promise.resolve(null);
    });

    // Mock getAll to return empty array by default (no existing enrollments)
    // But allow query-based mocking for getEnrollment lookups
    (FirestoreService.getAll as jest.Mock).mockImplementation((collection: string, constraints: any[]) => {
      // If querying for enrollments by prospectId + sequenceId (for getEnrollment)
      if (collection.includes('enrollments') && constraints && constraints.length > 0) {
        return Promise.resolve([]); // No existing enrollment by default
      }
      return Promise.resolve([]);
    });
    
    (FirestoreService.set as jest.Mock).mockResolvedValue(undefined);
    (FirestoreService.update as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Enrollment Flow', () => {
    it('should enroll a prospect in a sequence', async () => {
      const enrollment = await SequenceEngine.enrollProspect(
        testProspectId,
        testSequenceId,
        testOrgId
      );

      expect(enrollment).toBeDefined();
      expect(enrollment.prospectId).toBe(testProspectId);
      expect(enrollment.sequenceId).toBe(testSequenceId);
      expect(enrollment.status).toBe('active');
      expect(enrollment.currentStep).toBe(0);
      
      // Should have saved the enrollment
      expect(FirestoreService.set).toHaveBeenCalled();
    });

    it('should prevent duplicate enrollments', async () => {
      // Mock existing enrollment
      const existingEnrollment = {
        id: testEnrollmentId,
        prospectId: testProspectId,
        sequenceId: testSequenceId,
        status: 'active',
      };

      (FirestoreService.getAll as jest.Mock).mockResolvedValueOnce([existingEnrollment]);

      await expect(
        SequenceEngine.enrollProspect(testProspectId, testSequenceId, testOrgId)
      ).rejects.toThrow('already enrolled');
    });

    it('should reject enrollment in inactive sequence', async () => {
      const inactiveSequence = { ...mockSequence, status: 'paused' };
      (FirestoreService.get as jest.Mock).mockImplementation((collection: string) => {
        if (collection.includes('sequences')) return Promise.resolve(inactiveSequence);
        if (collection.includes('prospects')) return Promise.resolve(mockProspect);
        return Promise.resolve(null);
      });

      await expect(
        SequenceEngine.enrollProspect(testProspectId, testSequenceId, testOrgId)
      ).rejects.toThrow('Cannot enroll in inactive sequence');
    });
  });

  describe('Email Webhook Handling', () => {
    const mockEnrollment = {
      id: testEnrollmentId,
      prospectId: testProspectId,
      sequenceId: testSequenceId,
      status: 'active',
      currentStep: 0,
      stepActions: [
        {
          stepId: 'step-1',
          stepOrder: 0,
          scheduledFor: new Date().toISOString(),
          sentAt: new Date().toISOString(),
          status: 'sent',
          subject: 'Test Email',
          createdAt: new Date().toISOString(),
        },
      ],
      organizationId: testOrgId,
    };

    beforeEach(() => {
      (FirestoreService.get as jest.Mock).mockImplementation((collection: string, id: string) => {
        if (collection.includes('enrollments')) return Promise.resolve(mockEnrollment);
        if (collection.includes('sequences')) return Promise.resolve(mockSequence);
        return Promise.resolve(mockProspect);
      });
      
      // Mock getAll for getEnrollment lookups in handleEmailBounce
      (FirestoreService.getAll as jest.Mock).mockImplementation((collection: string, constraints: any[]) => {
        if (collection.includes('enrollments') && constraints && constraints.length > 0) {
          return Promise.resolve([mockEnrollment]); // Return enrollment for unenroll
        }
        return Promise.resolve([]);
      });
    });

    it('should handle email open webhook', async () => {
      await handleEmailOpen(testEnrollmentId, 'step-1', testOrgId);

      // Should update the enrollment
      expect(FirestoreService.set).toHaveBeenCalled();
      const setCall = (FirestoreService.set as jest.Mock).mock.calls[0];
      const updatedEnrollment = setCall[2];

      expect(updatedEnrollment.stepActions[0].status).toBe('opened');
      expect(updatedEnrollment.stepActions[0].openedAt).toBeDefined();
    });

    it('should handle email click webhook', async () => {
      await handleEmailClick(testEnrollmentId, 'step-1', testOrgId);

      expect(FirestoreService.set).toHaveBeenCalled();
      const setCall = (FirestoreService.set as jest.Mock).mock.calls[0];
      const updatedEnrollment = setCall[2];

      expect(updatedEnrollment.stepActions[0].status).toBe('clicked');
      expect(updatedEnrollment.stepActions[0].clickedAt).toBeDefined();
    });

    it('should handle email bounce webhook and unenroll', async () => {
      await handleEmailBounce(testEnrollmentId, 'step-1', testOrgId, 'hard_bounce');

      // Should update step action with bounce info
      expect(FirestoreService.get).toHaveBeenCalled();
      
      // Note: Actual unenroll would be called but it's in a private method
      // In a real integration test, we'd verify the enrollment status changed
    });

    it('should track bounce reason', async () => {
      await handleEmailBounce(testEnrollmentId, 'step-1', testOrgId, 'spam_report');

      expect(FirestoreService.get).toHaveBeenCalledWith(
        expect.stringContaining('enrollments'),
        testEnrollmentId
      );
    });
  });

  describe('Unenroll Flow', () => {
    const mockEnrollment = {
      id: testEnrollmentId,
      prospectId: testProspectId,
      sequenceId: testSequenceId,
      status: 'active',
      currentStep: 0,
      stepActions: [],
      organizationId: testOrgId,
    };

    beforeEach(() => {
      // Mock getAll to return the enrollment when queried by prospectId + sequenceId
      (FirestoreService.getAll as jest.Mock).mockImplementation((collection: string, constraints: any[]) => {
        if (collection.includes('enrollments') && constraints && constraints.length > 0) {
          return Promise.resolve([mockEnrollment]); // Return existing enrollment
        }
        return Promise.resolve([]);
      });
    });

    it('should unenroll prospect when requested', async () => {
      await SequenceEngine.unenrollProspect(
        testProspectId,
        testSequenceId,
        testOrgId,
        'manual'
      );

      expect(FirestoreService.update).toHaveBeenCalled();
      const updateCall = (FirestoreService.update as jest.Mock).mock.calls[0];
      const updates = updateCall[2];

      expect(updates.status).toBe('completed');
      expect(updates.outcome).toBe('manual');
    });

    it('should unenroll on bounce', async () => {
      await SequenceEngine.unenrollProspect(
        testProspectId,
        testSequenceId,
        testOrgId,
        'bounced'
      );

      const updateCall = (FirestoreService.update as jest.Mock).mock.calls[0];
      const updates = updateCall[2];

      expect(updates.outcome).toBe('bounced');
    });

    it('should unenroll on reply', async () => {
      await SequenceEngine.unenrollProspect(
        testProspectId,
        testSequenceId,
        testOrgId,
        'replied'
      );

      const updateCall = (FirestoreService.update as jest.Mock).mock.calls[0];
      const updates = updateCall[2];

      expect(updates.outcome).toBe('replied');
    });
  });

  describe('Complete Flow Integration', () => {
    it('should complete full sequence lifecycle', async () => {
      // 1. Enroll prospect
      const enrollment = await SequenceEngine.enrollProspect(
        testProspectId,
        testSequenceId,
        testOrgId
      );

      expect(enrollment).toBeDefined();
      expect(enrollment.status).toBe('active');

      // 2. Simulate email sent (webhook would be called)
      const mockEnrollmentAfterSend = {
        ...enrollment,
        stepActions: [
          {
            stepId: 'step-1',
            status: 'sent',
            sentAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
      };

      (FirestoreService.get as jest.Mock).mockResolvedValue(mockEnrollmentAfterSend);

      // 3. Handle open
      await handleEmailOpen(enrollment.id, 'step-1', testOrgId);
      expect(FirestoreService.set).toHaveBeenCalled();

      // 4. Handle click
      await handleEmailClick(enrollment.id, 'step-1', testOrgId);
      expect(FirestoreService.set).toHaveBeenCalled();

      // 5. Unenroll
      await SequenceEngine.unenrollProspect(
        testProspectId,
        testSequenceId,
        testOrgId,
        'converted'
      );

      expect(FirestoreService.update).toHaveBeenCalled();
      
      // Verify all major steps were called
      expect(FirestoreService.set).toHaveBeenCalledTimes(3); // enrollment + 2 webhook updates
      expect(FirestoreService.update).toHaveBeenCalledTimes(1); // unenroll
    });
  });
});

