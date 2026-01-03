/**
 * Slack Validation Tests
 * 
 * Comprehensive test coverage for Slack validation schemas.
 */

import {
  sendSlackMessageSchema,
  createChannelMappingSchema,
  updateWorkspaceSettingsSchema,
  listChannelsSchema,
  oauthCallbackSchema,
  validateInput,
} from '@/lib/slack/validation';

describe('Slack Validation', () => {
  describe('sendSlackMessageSchema', () => {
    it('should validate valid message', () => {
      const valid = {
        workspaceId: 'workspace-1',
        channelId: 'C123',
        text: 'Test message',
        category: 'system',
      };
      
      const result = sendSlackMessageSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('text'); // default
        expect(result.data.priority).toBe('medium'); // default
      }
    });
    
    it('should validate message with blocks', () => {
      const valid = {
        workspaceId: 'workspace-1',
        channelId: 'C123',
        text: 'Test message',
        type: 'blocks',
        category: 'deal_risk',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Hello *world*',
            },
          },
        ],
      };
      
      const result = sendSlackMessageSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
    });
    
    it('should reject missing workspaceId', () => {
      const invalid = {
        channelId: 'C123',
        text: 'Test message',
        category: 'system',
      };
      
      const result = sendSlackMessageSchema.safeParse(invalid);
      
      expect(result.success).toBe(false);
    });
    
    it('should reject empty text', () => {
      const invalid = {
        workspaceId: 'workspace-1',
        channelId: 'C123',
        text: '',
        category: 'system',
      };
      
      const result = sendSlackMessageSchema.safeParse(invalid);
      
      expect(result.success).toBe(false);
    });
    
    it('should reject text over 40000 characters', () => {
      const invalid = {
        workspaceId: 'workspace-1',
        channelId: 'C123',
        text: 'a'.repeat(40001),
        category: 'system',
      };
      
      const result = sendSlackMessageSchema.safeParse(invalid);
      
      expect(result.success).toBe(false);
    });
    
    it('should validate message with mentions', () => {
      const valid = {
        workspaceId: 'workspace-1',
        channelId: 'C123',
        text: 'Test message',
        category: 'system',
        mentions: {
          users: ['U123', 'U456'],
          channel: true,
        },
      };
      
      const result = sendSlackMessageSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('createChannelMappingSchema', () => {
    it('should validate valid mapping', () => {
      const valid = {
        workspaceId: 'workspace-1',
        category: 'deal_risk',
        channelId: 'C123',
        channelName: 'deals',
      };
      
      const result = createChannelMappingSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minPriority).toBe('low'); // default
        expect(result.data.enabled).toBe(true); // default
      }
    });
    
    it('should validate mapping with custom priority', () => {
      const valid = {
        workspaceId: 'workspace-1',
        category: 'deal_risk',
        channelId: 'C123',
        channelName: 'deals',
        minPriority: 'high',
      };
      
      const result = createChannelMappingSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minPriority).toBe('high');
      }
    });
    
    it('should reject invalid category', () => {
      const invalid = {
        workspaceId: 'workspace-1',
        category: 'invalid_category',
        channelId: 'C123',
        channelName: 'deals',
      };
      
      const result = createChannelMappingSchema.safeParse(invalid);
      
      expect(result.success).toBe(false);
    });
    
    it('should reject missing channelName', () => {
      const invalid = {
        workspaceId: 'workspace-1',
        category: 'deal_risk',
        channelId: 'C123',
      };
      
      const result = createChannelMappingSchema.safeParse(invalid);
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('updateWorkspaceSettingsSchema', () => {
    it('should validate valid settings update', () => {
      const valid = {
        enabled: true,
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00',
          timezone: 'America/New_York',
        },
      };
      
      const result = updateWorkspaceSettingsSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
    });
    
    it('should validate rate limit settings', () => {
      const valid = {
        rateLimit: {
          maxMessagesPerMinute: 30,
          maxMessagesPerHour: 1000,
        },
      };
      
      const result = updateWorkspaceSettingsSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
    });
    
    it('should validate batching settings', () => {
      const valid = {
        batching: {
          enabled: true,
          intervalMinutes: 15,
          maxBatchSize: 10,
        },
      };
      
      const result = updateWorkspaceSettingsSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid time format', () => {
      const invalid = {
        quietHours: {
          enabled: true,
          start: '10pm', // Invalid format
          end: '08:00',
          timezone: 'America/New_York',
        },
      };
      
      const result = updateWorkspaceSettingsSchema.safeParse(invalid);
      
      expect(result.success).toBe(false);
    });
    
    it('should reject invalid hour in time', () => {
      const invalid = {
        quietHours: {
          enabled: true,
          start: '25:00', // Invalid hour
          end: '08:00',
          timezone: 'America/New_York',
        },
      };
      
      const result = updateWorkspaceSettingsSchema.safeParse(invalid);
      
      expect(result.success).toBe(false);
    });
    
    it('should reject rate limit out of range', () => {
      const invalid = {
        rateLimit: {
          maxMessagesPerMinute: 0, // Too low
          maxMessagesPerHour: 1000,
        },
      };
      
      const result = updateWorkspaceSettingsSchema.safeParse(invalid);
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('listChannelsSchema', () => {
    it('should validate valid list request', () => {
      const valid = {
        workspaceId: 'workspace-1',
      };
      
      const result = listChannelsSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.excludeArchived).toBe(true); // default
        expect(result.data.limit).toBe(100); // default
      }
    });
    
    it('should validate with types filter', () => {
      const valid = {
        workspaceId: 'workspace-1',
        types: ['public_channel', 'private_channel'],
      };
      
      const result = listChannelsSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
    });
    
    it('should validate with pagination', () => {
      const valid = {
        workspaceId: 'workspace-1',
        limit: 50,
        cursor: 'next-page-cursor',
      };
      
      const result = listChannelsSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
    });
    
    it('should reject limit out of range', () => {
      const invalid = {
        workspaceId: 'workspace-1',
        limit: 2000, // Too high
      };
      
      const result = listChannelsSchema.safeParse(invalid);
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('oauthCallbackSchema', () => {
    it('should validate valid callback', () => {
      const valid = {
        code: 'oauth-code-123',
        state: 'state-token-456',
      };
      
      const result = oauthCallbackSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
    });
    
    it('should reject missing code', () => {
      const invalid = {
        state: 'state-token-456',
      };
      
      const result = oauthCallbackSchema.safeParse(invalid);
      
      expect(result.success).toBe(false);
    });
    
    it('should reject empty state', () => {
      const invalid = {
        code: 'oauth-code-123',
        state: '',
      };
      
      const result = oauthCallbackSchema.safeParse(invalid);
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('validateInput helper', () => {
    it('should return success for valid input', () => {
      const result = validateInput(
        oauthCallbackSchema,
        { code: 'test', state: 'test' }
      );
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('test');
      }
    });
    
    it('should return errors for invalid input', () => {
      const result = validateInput(
        oauthCallbackSchema,
        { code: '' }
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeDefined();
      }
    });
  });
});
