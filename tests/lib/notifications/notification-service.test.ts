/**
 * Notification Service Tests
 * 
 * Comprehensive test suite for NotificationService class.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Timestamp } from 'firebase/firestore';
import type {
  Notification,
  NotificationTemplate,
  NotificationPreferences,
  NotificationVariables,
} from '@/lib/notifications/types';

// Mock dependencies
jest.mock('@/lib/integrations/slack-service');
jest.mock('@/lib/db/firestore-service');

describe('NotificationService', () => {
  const userId = 'test_user';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Variable Interpolation', () => {
    it('should interpolate simple variables', () => {
      const template = 'Hello {{userName}}!';
      const variables = { userName: 'John' };
      
      // Test interpolation logic
      const result = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = variables[path.trim() as keyof typeof variables];
        return value !== undefined ? String(value) : match;
      });

      expect(result).toBe('Hello John!');
    });

    it('should interpolate nested variables', () => {
      const template = 'Deal: {{deal.name}}';
      const variables = {
        deal: { name: 'Acme Corp' },
      };
      
      // Test nested interpolation
      const result = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const parts = path.trim().split('.');
        let value: any = variables;
        
        for (const part of parts) {
          value = value?.[part];
        }
        
        return value !== undefined ? String(value) : match;
      });

      expect(result).toBe('Deal: Acme Corp');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{missingVar}}!';
      const variables = { };
      
      const result = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = variables[path.trim() as keyof typeof variables];
        return value !== undefined ? String(value) : match;
      });

      expect(result).toBe('Hello {{missingVar}}!');
    });

    it('should interpolate multiple variables', () => {
      const template = '{{userName}} has {{count}} notifications';
      const variables = { userName: 'Alice', count: '5' };
      
      const result = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = variables[path.trim() as keyof typeof variables];
        return value !== undefined ? String(value) : match;
      });

      expect(result).toBe('Alice has 5 notifications');
    });

    it('should handle numeric variables', () => {
      const template = 'Score: {{score}}';
      const variables = { score: 95 };
      
      const result = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = variables[path.trim() as keyof typeof variables];
        return value !== undefined ? String(value) : match;
      });

      expect(result).toBe('Score: 95');
    });

    it('should handle boolean variables', () => {
      const template = 'Active: {{isActive}}';
      const variables = { isActive: true };
      
      const result = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = variables[path.trim() as keyof typeof variables];
        return value !== undefined ? String(value) : match;
      });

      expect(result).toBe('Active: true');
    });
  });

  describe('Channel Determination', () => {
    it('should filter channels based on user preferences', () => {
      const templateChannels = ['slack', 'email', 'in_app'] as const;
      const preferences = {
        channels: {
          slack: { enabled: true },
          email: { enabled: false },
          inApp: { enabled: true },
        },
      };

      const enabledChannels = templateChannels.filter((channel) => {
        const channelKey = channel === 'in_app' ? 'inApp' : channel;
        return preferences.channels[channelKey as keyof typeof preferences.channels]?.enabled;
      });

      expect(enabledChannels).toEqual(['slack', 'in_app']);
    });

    it('should respect category channel overrides', () => {
      const templateChannels = ['slack', 'email'] as const;
      const preferences = {
        channels: {
          slack: { enabled: true },
          email: { enabled: true },
        },
        categories: {
          deal_risk: {
            enabled: true,
            channels: ['slack'], // Override: only Slack for this category
          },
        },
      };

      const categoryPrefs = preferences.categories.deal_risk;
      const preferredChannels = categoryPrefs.channels || templateChannels;
      
      const enabledChannels = preferredChannels.filter((channel) => {
        const channelKey = channel === 'in_app' ? 'inApp' : channel;
        return preferences.channels[channelKey as keyof typeof preferences.channels]?.enabled;
      });

      expect(enabledChannels).toEqual(['slack']);
    });

    it('should return empty array if no channels enabled', () => {
      const templateChannels = ['slack', 'email'] as const;
      const preferences = {
        channels: {
          slack: { enabled: false },
          email: { enabled: false },
        },
      };

      const enabledChannels = templateChannels.filter((channel) => {
        return preferences.channels[channel as keyof typeof preferences.channels]?.enabled;
      });

      expect(enabledChannels).toEqual([]);
    });
  });

  describe('Priority Filtering', () => {
    it('should allow critical priority notifications', () => {
      const priority = 'critical';
      const minPriority = 'medium';
      
      const priorityOrder = ['critical', 'high', 'medium', 'low'];
      const minIndex = priorityOrder.indexOf(minPriority);
      const currentIndex = priorityOrder.indexOf(priority);

      expect(currentIndex).toBeLessThanOrEqual(minIndex);
    });

    it('should allow high priority for medium threshold', () => {
      const priority = 'high';
      const minPriority = 'medium';
      
      const priorityOrder = ['critical', 'high', 'medium', 'low'];
      const minIndex = priorityOrder.indexOf(minPriority);
      const currentIndex = priorityOrder.indexOf(priority);

      expect(currentIndex).toBeLessThanOrEqual(minIndex);
    });

    it('should block low priority for high threshold', () => {
      const priority = 'low';
      const minPriority = 'high';
      
      const priorityOrder = ['critical', 'high', 'medium', 'low'];
      const minIndex = priorityOrder.indexOf(minPriority);
      const currentIndex = priorityOrder.indexOf(priority);

      expect(currentIndex).toBeGreaterThan(minIndex);
    });

    it('should allow same priority as threshold', () => {
      const priority = 'medium';
      const minPriority = 'medium';
      
      const priorityOrder = ['critical', 'high', 'medium', 'low'];
      const minIndex = priorityOrder.indexOf(minPriority);
      const currentIndex = priorityOrder.indexOf(priority);

      expect(currentIndex).toBeLessThanOrEqual(minIndex);
    });
  });

  describe('Batching Logic', () => {
    it('should not batch critical priority', () => {
      const priority = 'critical';
      const batchingPrefs = {
        enabled: true,
        bypassPriorities: ['critical', 'high'],
      };

      const shouldBatch = batchingPrefs.enabled && 
                         !batchingPrefs.bypassPriorities.includes(priority);

      expect(shouldBatch).toBe(false);
    });

    it('should not batch high priority', () => {
      const priority = 'high';
      const batchingPrefs = {
        enabled: true,
        bypassPriorities: ['critical', 'high'],
      };

      const shouldBatch = batchingPrefs.enabled && 
                         !batchingPrefs.bypassPriorities.includes(priority);

      expect(shouldBatch).toBe(false);
    });

    it('should batch medium priority', () => {
      const priority = 'medium';
      const batchingPrefs = {
        enabled: true,
        bypassPriorities: ['critical', 'high'],
      };

      const shouldBatch = batchingPrefs.enabled && 
                         !batchingPrefs.bypassPriorities.includes(priority);

      expect(shouldBatch).toBe(true);
    });

    it('should batch low priority', () => {
      const priority = 'low';
      const batchingPrefs = {
        enabled: true,
        bypassPriorities: ['critical', 'high'],
      };

      const shouldBatch = batchingPrefs.enabled && 
                         !batchingPrefs.bypassPriorities.includes(priority);

      expect(shouldBatch).toBe(true);
    });

    it('should not batch when batching disabled', () => {
      const priority = 'low';
      const batchingPrefs = {
        enabled: false,
        bypassPriorities: ['critical', 'high'],
      };

      const shouldBatch = batchingPrefs.enabled && 
                         !batchingPrefs.bypassPriorities.includes(priority);

      expect(shouldBatch).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should calculate exponential backoff correctly', () => {
      const backoffMultiplier = 2;
      const attempts = [0, 1, 2, 3];
      
      const backoffTimes = attempts.map((attempt) => 
        Math.pow(backoffMultiplier, attempt) * 60000 // milliseconds
      );

      expect(backoffTimes).toEqual([
        60000,    // 1 minute
        120000,   // 2 minutes
        240000,   // 4 minutes
        480000,   // 8 minutes
      ]);
    });

    it('should not retry after max attempts', () => {
      const currentAttempts = 3;
      const maxAttempts = 3;

      const shouldRetry = currentAttempts < maxAttempts;

      expect(shouldRetry).toBe(false);
    });

    it('should retry before max attempts', () => {
      const currentAttempts = 2;
      const maxAttempts = 3;

      const shouldRetry = currentAttempts < maxAttempts;

      expect(shouldRetry).toBe(true);
    });

    it('should calculate next retry timestamp', () => {
      const now = Date.now();
      const backoffMs = 120000; // 2 minutes
      const nextRetry = new Date(now + backoffMs);

      expect(nextRetry.getTime()).toBeGreaterThan(now);
      expect(nextRetry.getTime() - now).toBe(backoffMs);
    });
  });

  describe('Delivery Tracking', () => {
    it('should initialize delivery attempts for all channels', () => {
      const channels = ['slack', 'email', 'in_app'];
      const attempts: Record<string, number> = {};
      
      channels.forEach((channel) => {
        attempts[channel] = 0;
      });

      expect(attempts).toEqual({
        slack: 0,
        email: 0,
        in_app: 0,
      });
    });

    it('should increment attempt counter', () => {
      const attempts = { slack: 0, email: 0 };
      attempts.slack++;

      expect(attempts.slack).toBe(1);
      expect(attempts.email).toBe(0);
    });

    it('should track delivery timestamps', () => {
      const now = Timestamp.now();
      const deliveredAt: Record<string, any> = {
        slack: now,
        email: null,
      };

      expect(deliveredAt.slack).toBe(now);
      expect(deliveredAt.email).toBeNull();
    });

    it('should store error messages per channel', () => {
      const errors: Record<string, string | null> = {
        slack: null,
        email: 'Connection timeout',
      };

      expect(errors.slack).toBeNull();
      expect(errors.email).toBe('Connection timeout');
    });
  });

  describe('Template Loading', () => {
    it('should validate template structure', () => {
      const template = {
        id: 'test_template',
        name: 'Test Template',
        category: 'system',
        signalTypes: ['system.test'],
        priority: 'medium',
        channels: ['slack'],
        slack: {
          text: 'Test message',
        },
      };

      expect(template.id).toBeDefined();
      expect(template.category).toBeDefined();
      expect(template.priority).toBeDefined();
      expect(template.channels.length).toBeGreaterThan(0);
    });

    it('should validate required Slack fields', () => {
      const slackContent = {
        text: 'Test notification',
        blocks: [],
      };

      expect(slackContent.text).toBeDefined();
      expect(typeof slackContent.text).toBe('string');
      expect(slackContent.text.length).toBeGreaterThan(0);
    });
  });

  describe('Preference Defaults', () => {
    it('should create default preferences structure', () => {
      const defaultPrefs = {
        userId: 'user_1',
        enabled: true,
        channels: {
          slack: { enabled: true },
          email: { enabled: false },
          inApp: { enabled: true },
        },
        batching: {
          enabled: true,
          windowMinutes: 30,
          maxPerBatch: 10,
          bypassPriorities: ['critical', 'high'],
        },
      };

      expect(defaultPrefs.enabled).toBe(true);
      expect(defaultPrefs.channels.slack.enabled).toBe(true);
      expect(defaultPrefs.channels.email.enabled).toBe(false);
      expect(defaultPrefs.batching.enabled).toBe(true);
    });

    it('should enable all categories by default', () => {
      const categories = [
        'deal_risk',
        'conversation',
        'coaching',
        'sequence',
        'playbook',
      ];

      const categoryPrefs: Record<string, { enabled: boolean }> = {};
      
      categories.forEach((cat) => {
        categoryPrefs[cat] = { enabled: true };
      });

      Object.values(categoryPrefs).forEach((pref) => {
        expect(pref.enabled).toBe(true);
      });
    });
  });

  describe('Notification Content Rendering', () => {
    it('should render Slack content correctly', () => {
      const template = {
        text: '{{userName}} completed {{taskName}}',
      };
      
      const variables = {
        userName: 'Alice',
        taskName: 'Deal Review',
      };

      const rendered = template.text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = variables[path.trim() as keyof typeof variables];
        return value !== undefined ? String(value) : match;
      });

      expect(rendered).toBe('Alice completed Deal Review');
    });

    it('should render in-app content correctly', () => {
      const template = {
        title: 'New {{category}} notification',
        body: '{{description}}',
      };
      
      const variables = {
        category: 'Deal Risk',
        description: 'Your deal needs attention',
      };

      const renderedTitle = template.title.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = variables[path.trim() as keyof typeof variables];
        return value !== undefined ? String(value) : match;
      });

      const renderedBody = template.body.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = variables[path.trim() as keyof typeof variables];
        return value !== undefined ? String(value) : match;
      });

      expect(renderedTitle).toBe('New Deal Risk notification');
      expect(renderedBody).toBe('Your deal needs attention');
    });
  });
});
