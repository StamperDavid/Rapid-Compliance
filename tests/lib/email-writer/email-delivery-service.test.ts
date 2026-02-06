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
jest.mock('@/lib/firebase/admin');

describe('Email Delivery Service', () => {
  // Mock implementations
  const mockSgMail = {
    setApiKey: jest.fn(),
    send: jest.fn(),
  };
  
  const mockCoordinator = {
    emitSignal: jest.fn(),
  };
  
  const mockAdminDb = {
    Timestamp: {
      now: jest.fn(() => ({ toDate: () => new Date('2026-01-02T12:00:00Z') })),
      fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
    },
    FieldValue: {
      increment: jest.fn((value: number) => value),
    },
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        get: jest.fn(() => ({
          exists: true,
          data: () => ({
            id: 'delivery_123',
            status: 'sent',
          }),
        })),
      })),
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn(() => ({
              docs: [],
            })),
          })),
        })),
        where: jest.fn(() => ({
          where: jest.fn(() => ({
            get: jest.fn(() => ({
              docs: [],
            })),
          })),
          get: jest.fn(() => ({
            docs: [],
          })),
        })),
        get: jest.fn(() => ({
          docs: [],
        })),
      })),
    })),
  };
  
  beforeAll(() => {
    // Set up mocks
    Object.assign(sgMail, mockSgMail);
    jest.mocked(getServerSignalCoordinator).mockReturnValue(mockCoordinator as unknown as ReturnType<typeof getServerSignalCoordinator>);
    Object.assign(adminDb ?? {}, mockAdminDb);
    
    // Set required environment variables
    process.env.SENDGRID_API_KEY = 'test-api-key';
    process.env.FROM_EMAIL = 'noreply@example.com';
    process.env.FROM_NAME = 'AI Sales Platform';
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      // Arrange
      const options: EmailDeliveryOptions = {
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
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
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
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
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
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
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
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
            organizationId: 'org_123',
            workspaceId: 'workspace_123',
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
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
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
      
      // Assert
      expect(mockCoordinator.emitSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email.sent',
          organizationId: 'org_123',
          priority: 'medium',
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
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
        text: 'Test',
      };
      
      mockSgMail.send.mockRejectedValue(new Error('API error'));
      
      // Act
      await sendEmail(options);
      
      // Assert
      expect(mockCoordinator.emitSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email.delivery.failed',
          organizationId: 'org_123',
          priority: 'high',
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
      
      // Assert
      expect(mockAdminDb.collection).toHaveBeenCalled();
    });
  });
  
  describe('incrementOpenCount', () => {
    it('should increment open count and emit signal', async () => {
      // Act
      await incrementOpenCount('delivery_123');
      
      // Assert
      expect(mockCoordinator.emitSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email.opened',
          organizationId: 'org_123',
          priority: 'low',
        })
      );
    });
  });
  
  describe('incrementClickCount', () => {
    it('should increment click count and emit signal', async () => {
      // Act
      await incrementClickCount('delivery_123');
      
      // Assert
      expect(mockCoordinator.emitSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email.clicked',
          organizationId: 'org_123',
          priority: 'medium',
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
      
      const mockQuery: {
        where: jest.Mock;
        orderBy: jest.Mock;
        get: jest.Mock;
      } = {
        where: jest.fn(function(this: typeof mockQuery) { return this; }),
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn(() => ({
              docs: [],
            })),
          })),
        })),
        get: jest.fn(() => ({
          docs: mockRecords.map(data => ({ data: () => data })),
        })),
      };
      mockAdminDb.collection.mockReturnValue(mockQuery as unknown as ReturnType<typeof mockAdminDb.collection>);
      
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
    it('should throw error if SENDGRID_API_KEY is missing', async () => {
      // Arrange
      const originalKey = process.env.SENDGRID_API_KEY;
      const originalEmail = process.env.FROM_EMAIL;
      const originalName = process.env.FROM_NAME;
      
      try {
        // Temporarily unset required env vars
        process.env.SENDGRID_API_KEY = '';
        process.env.FROM_EMAIL = originalEmail ?? '';
        process.env.FROM_NAME = originalName ?? '';
        
        const options: EmailDeliveryOptions = {
          organizationId: 'org_123',
          workspaceId: 'workspace_123',
          userId: 'user_123',
          to: 'recipient@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        };
        
        // Act & Assert
        const result = await sendEmail(options);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      } finally {
        // Restore
        if (originalKey !== undefined) {
          process.env.SENDGRID_API_KEY = originalKey;
        } else {
          delete process.env.SENDGRID_API_KEY;
        }
      }
    });
    
    it('should throw error if FROM_EMAIL is missing', async () => {
      // Arrange
      const originalKey = process.env.SENDGRID_API_KEY;
      const originalEmail = process.env.FROM_EMAIL;
      const originalName = process.env.FROM_NAME;
      
      try {
        // Temporarily unset required env vars
        process.env.SENDGRID_API_KEY = originalKey ?? '';
        process.env.FROM_EMAIL = '';
        process.env.FROM_NAME = originalName ?? '';
        
        const options: EmailDeliveryOptions = {
          organizationId: 'org_123',
          workspaceId: 'workspace_123',
          userId: 'user_123',
          to: 'recipient@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        };
        
        // Act & Assert
        const result = await sendEmail(options);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      } finally {
        // Restore
        if (originalEmail !== undefined) {
          process.env.FROM_EMAIL = originalEmail;
        } else {
          delete process.env.FROM_EMAIL;
        }
      }
    });
  });
});
