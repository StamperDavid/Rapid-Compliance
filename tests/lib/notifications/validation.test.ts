/**
 * Notification Validation Tests
 * 
 * Test suite for Zod validation schemas.
 */

import { describe, it, expect } from '@jest/globals';
import {
  notificationChannelSchema,
  notificationPrioritySchema,
  notificationCategorySchema,
  notificationVariablesSchema,
  sendNotificationRequestSchema,
  updatePreferencesRequestSchema,
  getNotificationsRequestSchema,
  quietHoursSchema,
} from '@/lib/notifications/validation';

describe('Notification Validation', () => {
  describe('Channel Schema', () => {
    it('should accept valid channels', () => {
      const validChannels = ['slack', 'email', 'webhook', 'in_app', 'sms'];
      
      validChannels.forEach((channel) => {
        const result = notificationChannelSchema.safeParse(channel);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid channels', () => {
      const result = notificationChannelSchema.safeParse('invalid_channel');
      expect(result.success).toBe(false);
    });
  });

  describe('Priority Schema', () => {
    it('should accept valid priorities', () => {
      const validPriorities = ['critical', 'high', 'medium', 'low'];
      
      validPriorities.forEach((priority) => {
        const result = notificationPrioritySchema.safeParse(priority);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid priorities', () => {
      const result = notificationPrioritySchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('Category Schema', () => {
    it('should accept valid categories', () => {
      const validCategories = [
        'deal_risk',
        'conversation',
        'coaching',
        'team_performance',
        'playbook',
        'sequence',
        'lead_routing',
        'email_writer',
        'workflow',
        'analytics',
        'forecasting',
        'deal_scoring',
        'battlecard',
        'discovery',
        'system',
      ];
      
      validCategories.forEach((category) => {
        const result = notificationCategorySchema.safeParse(category);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid categories', () => {
      const result = notificationCategorySchema.safeParse('invalid_category');
      expect(result.success).toBe(false);
    });
  });

  describe('Variables Schema', () => {
    it('should accept valid variables', () => {
      const variables = {
        userId: 'user_456',
        dealId: 'deal_789',
        dealName: 'Acme Corp',
        customField: 'custom value',
      };

      const result = notificationVariablesSchema.safeParse(variables);
      expect(result.success).toBe(true);
    });

    it('should require orgId', () => {
      const variables = {
        userId: 'user_456',
      };

      const result = notificationVariablesSchema.safeParse(variables);
      expect(result.success).toBe(false);
    });

    it('should validate email format', () => {
      const validEmail = {
        userEmail: 'user@example.com',
      };

      const invalidEmail = {
        userEmail: 'invalid-email',
      };

      expect(notificationVariablesSchema.safeParse(validEmail).success).toBe(true);
      expect(notificationVariablesSchema.safeParse(invalidEmail).success).toBe(false);
    });

    it('should allow custom fields', () => {
      const variables = {
        customField1: 'value1',
        customField2: 123,
        customField3: { nested: 'object' },
      };

      const result = notificationVariablesSchema.safeParse(variables);
      expect(result.success).toBe(true);
    });
  });

  describe('Send Notification Request Schema', () => {
    it('should accept valid send request', () => {
      const request = {
        userId: 'user_123',
        templateId: 'deal_risk_critical',
        variables: {
          dealId: 'deal_456',
          dealName: 'Acme Corp',
        },
      };

      const result = sendNotificationRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const request = {
        userId: 'user_123',
        templateId: 'deal_risk_critical',
        variables: {
        },
        channels: ['slack', 'in_app'],
        priority: 'high',
        scheduledFor: new Date().toISOString(),
      };

      const result = sendNotificationRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should require userId', () => {
      const request = {
        templateId: 'deal_risk_critical',
        variables: {
        },
      };

      const result = sendNotificationRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should require templateId', () => {
      const request = {
        userId: 'user_123',
        variables: {
        },
      };

      const result = sendNotificationRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should require variables', () => {
      const request = {
        userId: 'user_123',
        templateId: 'deal_risk_critical',
      };

      const result = sendNotificationRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('Update Preferences Request Schema', () => {
    it('should accept valid preferences update', () => {
      const request = {
        userId: 'user_123',
        enabled: true,
        channels: {
          slack: {
            enabled: true,
            threadMessages: true,
          },
        },
      };

      const result = updatePreferencesRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should allow partial updates', () => {
      const request = {
        userId: 'user_123',
        enabled: false,
      };

      const result = updatePreferencesRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate channel preferences', () => {
      const request = {
        userId: 'user_123',
        channels: {
          slack: {
            enabled: true,
            quietHours: {
              enabled: true,
              start: '22:00',
              end: '08:00',
              timezone: 'America/New_York',
            },
          },
        },
      };

      const result = updatePreferencesRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should require userId and orgId', () => {
      const request = {
        enabled: true,
      };

      const result = updatePreferencesRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('Quiet Hours Schema', () => {
    it('should accept valid quiet hours', () => {
      const quietHours = {
        enabled: true,
        start: '22:00',
        end: '08:00',
        timezone: 'America/New_York',
      };

      const result = quietHoursSchema.safeParse(quietHours);
      expect(result.success).toBe(true);
    });

    it('should validate time format', () => {
      const invalidTime = {
        enabled: true,
        start: '10:00 PM',
        end: '08:00',
        timezone: 'America/New_York',
      };

      const result = quietHoursSchema.safeParse(invalidTime);
      expect(result.success).toBe(false);
    });

    it('should require all fields', () => {
      const incomplete = {
        enabled: true,
        start: '22:00',
      };

      const result = quietHoursSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('should accept 24-hour time format', () => {
      const times = [
        { start: '00:00', end: '23:59' },
        { start: '09:30', end: '17:30' },
        { start: '14:15', end: '14:45' },
      ];

      times.forEach((time) => {
        const quietHours = {
          enabled: true,
          ...time,
          timezone: 'UTC',
        };

        const result = quietHoursSchema.safeParse(quietHours);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid time format', () => {
      const invalidTimes = [
        '25:00', // Invalid hour
        '12:60', // Invalid minute
        '12:5',  // Missing leading zero
        '1:30',  // Missing leading zero
      ];

      invalidTimes.forEach((time) => {
        const quietHours = {
          enabled: true,
          start: time,
          end: '08:00',
          timezone: 'UTC',
        };

        const result = quietHoursSchema.safeParse(quietHours);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Get Notifications Request Schema', () => {
    it('should accept valid query parameters', () => {
      const request = {
        categories: ['deal_risk', 'conversation'],
        statuses: ['pending', 'delivered'],
        unreadOnly: true,
        limit: 50,
      };

      const result = getNotificationsRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should apply default limit', () => {
      const request = {};

      const result = getNotificationsRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('should enforce limit bounds', () => {
      const tooLarge = {
        limit: 150,
      };

      const result = getNotificationsRequestSchema.safeParse(tooLarge);
      expect(result.success).toBe(false);
    });

    it('should accept pagination cursor', () => {
      const request = {
        limit: 25,
        startAfter: 'notification_123',
      };

      const result = getNotificationsRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });
});
