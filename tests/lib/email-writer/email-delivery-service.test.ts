/**
 * Email Delivery Service Tests
 *
 * Tests for SendGrid email delivery, tracking, and Signal Bus integration
 */

import {
  sendEmail,
  updateDeliveryStatus,
  incrementOpenCount,
  incrementClickCount,
  getDeliveryStatsForUser,
  type EmailDeliveryOptions,
  type EmailDeliveryResult,
  type EmailDeliveryRecord,
} from '@/lib/email-writer/email-delivery-service';
import sgMail from '@sendgrid/mail';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { adminDb } from '@/lib/firebase/admin';

// Mock dependencies
jest.mock('@sendgrid/mail');
jest.mock('@/lib/logger/logger');
jest.mock('@/lib/orchestration/coordinator-factory-server');
jest.mock('@/lib/firebase/collections', () => ({
  getSubCollection: jest.fn((sub: string) => `organizations/rapid-compliance-root/${sub}`),
  COLLECTIONS: { ORGANIZATIONS: 'organizations' },
}));

// Mock retryWithBackoff to execute the operation once without retries or delays
jest.mock('@/lib/utils/retry', () => ({
  retryWithBackoff: jest.fn(async (operation: () => Promise<unknown>) => operation()),
}));

// Mock adminDb with proper collection/doc chain (inline to avoid TDZ)
jest.mock('@/lib/firebase/admin', () => {
  const mockSet = jest.fn().mockResolvedValue(undefined);
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockGet = jest.fn().mockResolvedValue({
    exists: true,
    data: () => ({
      id: 'delivery_123',
      status: 'sent',
      }),
  });
  const mockDoc = jest.fn(() => ({
    set: mockSet,
    update: mockUpdate,
    get: mockGet,
  }));
  const mockWhere = jest.fn();
  // Set up chainable where pattern
  mockWhere.mockReturnValue({
    where: mockWhere,
    orderBy: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ docs: [] }),
      }),
    }),
    get: jest.fn().mockResolvedValue({ docs: [] }),
  });
  const mockCollection = jest.fn(() => ({
    doc: mockDoc,
    where: mockWhere,
  }));
  return {
    __esModule: true,
    adminDb: { collection: mockCollection },
  };
});

describe('Email Delivery Service', () => {
  // Mock implementations
  const mockSgMail = {
    setApiKey: jest.fn(),
    send: jest.fn(),
  };

  const mockCoordinator = {
    emitSignal: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeAll(() => {
    // Set up mocks
    Object.assign(sgMail, mockSgMail);
    jest.mocked(getServerSignalCoordinator).mockReturnValue(mockCoordinator as unknown as ReturnType<typeof getServerSignalCoordinator>);

    // Set required environment variables
    process.env.SENDGRID_API_KEY = 'test-api-key';
    process.env.FROM_EMAIL = 'noreply@example.com';
    process.env.FROM_NAME = 'AI Sales Platform';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply mocks that clearAllMocks wipes
    jest.mocked(getServerSignalCoordinator).mockReturnValue(mockCoordinator as unknown as ReturnType<typeof getServerSignalCoordinator>);
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      // Arrange
      const options: EmailDeliveryOptions = {
        userId: 'user_123',
        to: 'recipient@example.com',
        toName: 'John Doe',
        subject: 'Test Email',
        html: '<p>Test email body</p>',
        text: 'Test email body',
        dealId: 'deal_123',
        trackOpens: true,
        trackClicks: true,
      };

      mockSgMail.send.mockResolvedValue([{
        statusCode: 202,
        headers: {
          'x-message-id': 'sg_message_123',
        },
      }]);

      // Act
      const result: EmailDeliveryResult = await sendEmail(options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('sg_message_123');
      expect(result.deliveryId).toBeDefined();
      expect(mockSgMail.setApiKey).toHaveBeenCalledWith('test-api-key');
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: {
            email: 'recipient@example.com',
            name: 'John Doe',
          },
          from: {
            email: 'noreply@example.com',
            name: 'AI Sales Platform',
          },
          subject: 'Test Email',
          text: 'Test email body',
          html: '<p>Test email body</p>',
        })
      );
    });

    it('should handle SendGrid errors', async () => {
      // Arrange
      const options: EmailDeliveryOptions = {
        userId: 'user_123',
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
        text: 'Test',
      };

      mockSgMail.send.mockRejectedValue(new Error('SendGrid API error'));

      // Act
      const result: EmailDeliveryResult = await sendEmail(options);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('SendGrid API error');
      expect(result.deliveryId).toBeDefined();
    });

    it('should include tracking settings', async () => {
      // Arrange
      const options: EmailDeliveryOptions = {
        userId: 'user_123',
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
        text: 'Test',
        trackOpens: true,
        trackClicks: false,
      };

      mockSgMail.send.mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'msg_123' },
      }]);

      // Act
      await sendEmail(options);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          trackingSettings: {
            clickTracking: {
              enable: false,
              enableText: false,
            },
            openTracking: {
              enable: true,
            },
          },
        })
      );
    });

    it('should include custom args for tracking', async () => {
      // Arrange
      const options: EmailDeliveryOptions = {
        userId: 'user_123',
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
        text: 'Test',
        dealId: 'deal_123',
        emailId: 'email_abc',
        campaignId: 'campaign_xyz',
      };

      mockSgMail.send.mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'msg_123' },
      }]);

      // Act
      await sendEmail(options);

      // Assert
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          customArgs: expect.objectContaining({
            userId: 'user_123',
            dealId: 'deal_123',
            emailId: 'email_abc',
            campaignId: 'campaign_xyz',
          }),
        })
      );
    });

    it('should emit email.sent signal on success', async () => {
      // Arrange
      const options: EmailDeliveryOptions = {
        userId: 'user_123',
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
        text: 'Test',
        dealId: 'deal_123',
      };

      mockSgMail.send.mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'msg_123' },
      }]);

      // Act
      await sendEmail(options);

      // Assert — source emits with orgId (from PLATFORM_ID) and capitalized priority
      expect(mockCoordinator.emitSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email.sent',
          priority: 'Medium',
          metadata: expect.objectContaining({
            to: 'recipient@example.com',
            subject: 'Test Email',
            dealId: 'deal_123',
          }),
        })
      );
    });

    it('should emit email.delivery.failed signal on error', async () => {
      // Arrange
      const options: EmailDeliveryOptions = {
        userId: 'user_123',
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
        text: 'Test',
      };

      mockSgMail.send.mockRejectedValue(new Error('API error'));

      // Act
      await sendEmail(options);

      // Assert — source emits with orgId (from PLATFORM_ID) and capitalized priority
      expect(mockCoordinator.emitSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email.delivery.failed',
          priority: 'High',
          metadata: expect.objectContaining({
            to: 'recipient@example.com',
            error: 'API error',
          }),
        })
      );
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update delivery status', async () => {
      // Act
      await updateDeliveryStatus('delivery_123', 'delivered', {
        deliveredAt: new Date('2026-01-02T12:00:00Z'),
      });

      // Assert — verify collection was called on the mocked adminDb
      expect(adminDb!.collection).toHaveBeenCalled();
    });
  });

  describe('incrementOpenCount', () => {
    it('should increment open count and emit signal', async () => {
      // Act
      await incrementOpenCount('delivery_123');

      // Assert — source emits with orgId and capitalized priority
      expect(mockCoordinator.emitSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email.opened',
          priority: 'Low',
        })
      );
    });
  });

  describe('incrementClickCount', () => {
    it('should increment click count and emit signal', async () => {
      // Act
      await incrementClickCount('delivery_123');

      // Assert — source emits with orgId and capitalized priority
      expect(mockCoordinator.emitSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email.clicked',
          priority: 'Medium',
        })
      );
    });
  });

  describe('getDeliveryStatsForUser', () => {
    it('should calculate delivery stats correctly', async () => {
      // Arrange
      const mockRecords: Partial<EmailDeliveryRecord>[] = [
        { status: 'sent', uniqueOpens: 0, uniqueClicks: 0 },
        { status: 'opened', uniqueOpens: 1, uniqueClicks: 0 },
        { status: 'opened', uniqueOpens: 1, uniqueClicks: 0 },
        { status: 'clicked', uniqueOpens: 1, uniqueClicks: 1 },
        { status: 'bounced', uniqueOpens: 0, uniqueClicks: 0 },
        { status: 'failed', uniqueOpens: 0, uniqueClicks: 0 },
      ];

      // Build a chainable where mock that ultimately resolves with our records
      const mockQuery: {
        where: jest.Mock;
        get: jest.Mock;
      } = {
        where: jest.fn(),
        get: jest.fn().mockResolvedValue({
          docs: mockRecords.map(data => ({ data: () => data })),
        }),
      };
      // Make .where() return self for chaining
      mockQuery.where.mockReturnValue(mockQuery);

      // Use mockReturnValueOnce to avoid polluting subsequent tests
      const db = adminDb!;
      jest.mocked(db.collection).mockReturnValueOnce(mockQuery as unknown as ReturnType<typeof db.collection>);

      // Act
      const stats = await getDeliveryStatsForUser('user_123');

      // Assert
      expect(stats.totalSent).toBe(5); // All except failed
      expect(stats.totalOpened).toBe(3); // opened + clicked
      expect(stats.totalClicked).toBe(1);
      expect(stats.totalBounced).toBe(1);
      expect(stats.totalFailed).toBe(1);
      expect(stats.openRate).toBe(60); // 3/5 * 100
      expect(stats.clickRate).toBe(20); // 1/5 * 100
      expect(stats.bounceRate).toBe(20); // 1/5 * 100
    });
  });

  describe('environment validation', () => {
    it('should return failure if SENDGRID_API_KEY is missing', async () => {
      process.env.SENDGRID_API_KEY = '';

      const options: EmailDeliveryOptions = {
        userId: 'user_123',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      };

      const result = await sendEmail(options);

      // Restore to the value set in beforeAll
      process.env.SENDGRID_API_KEY = 'test-api-key';

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return failure if FROM_EMAIL is missing', async () => {
      process.env.FROM_EMAIL = '';

      const options: EmailDeliveryOptions = {
        userId: 'user_123',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      };

      const result = await sendEmail(options);

      // Restore to the value set in beforeAll
      process.env.FROM_EMAIL = 'noreply@example.com';

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
