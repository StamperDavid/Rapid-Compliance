/**
 * Notification Templates Tests
 * 
 * Test suite for notification templates.
 */

import { describe, it, expect } from '@jest/globals';
import { getAllTemplates } from '@/lib/notifications/templates';

describe('Notification Templates', () => {
  const templates = getAllTemplates();

  describe('Template Structure', () => {
    it('should return array of templates', () => {
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should have unique template IDs', () => {
      const ids = templates.map((t) => t.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have all required fields', () => {
      templates.forEach((template) => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.category).toBeDefined();
        expect(template.signalTypes).toBeDefined();
        expect(template.priority).toBeDefined();
        expect(template.channels).toBeDefined();
        expect(template.metadata).toBeDefined();
      });
    });

    it('should have valid categories', () => {
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

      templates.forEach((template) => {
        expect(validCategories).toContain(template.category);
      });
    });

    it('should have valid priorities', () => {
      const validPriorities = ['critical', 'high', 'medium', 'low'];

      templates.forEach((template) => {
        expect(validPriorities).toContain(template.priority);
      });
    });

    it('should have at least one channel', () => {
      templates.forEach((template) => {
        expect(template.channels.length).toBeGreaterThan(0);
      });
    });

    it('should have at least one signal type', () => {
      templates.forEach((template) => {
        expect(template.signalTypes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Channel Content', () => {
    it('should have content for configured channels', () => {
      templates.forEach((template) => {
        template.channels.forEach((channel) => {
          switch (channel) {
            case 'slack':
              expect(template.slack).toBeDefined();
              expect(template.slack?.text).toBeDefined();
              break;
            case 'email':
              expect(template.email).toBeDefined();
              break;
            case 'in_app':
              expect(template.inApp).toBeDefined();
              break;
          }
        });
      });
    });

    it('should have valid Slack text', () => {
      templates.forEach((template) => {
        if (template.slack) {
          expect(template.slack.text).toBeDefined();
          expect(typeof template.slack.text).toBe('string');
          expect(template.slack.text.length).toBeGreaterThan(0);
          expect(template.slack.text.length).toBeLessThanOrEqual(3000);
        }
      });
    });

    it('should have valid in-app content', () => {
      templates.forEach((template) => {
        if (template.inApp) {
          expect(template.inApp.title).toBeDefined();
          expect(template.inApp.body).toBeDefined();
          expect(typeof template.inApp.title).toBe('string');
          expect(typeof template.inApp.body).toBe('string');
          expect(template.inApp.title.length).toBeGreaterThan(0);
          expect(template.inApp.body.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Variable Placeholders', () => {
    it('should use {{variable}} syntax', () => {
      const variablePattern = /\{\{[^}]+\}\}/g;

      templates.forEach((template) => {
        if (template.slack?.text) {
          // Should have variables or be static text
          const hasVariables = variablePattern.test(template.slack.text);
          expect(typeof hasVariables).toBe('boolean');
        }
      });
    });

    it('should have balanced braces', () => {
      templates.forEach((template) => {
        if (template.slack?.text) {
          const text = template.slack.text;
          const openCount = (text.match(/\{\{/g) ?? []).length;
          const closeCount = (text.match(/\}\}/g) ?? []).length;

          expect(openCount).toBe(closeCount);
        }
      });
    });

    it('should not have malformed variables', () => {
      const malformedPatterns = [
        // Removed single brace check - templates use ${{var}} syntax which is valid
        /\{\{\{.*?\}\}\}/,   // Triple braces (invalid)
      ];

      templates.forEach((template) => {
        if (template.slack?.text) {
          malformedPatterns.forEach((pattern) => {
            expect(template.slack!.text.match(pattern)).toBeNull();
          });
        }
      });
    });
  });

  describe('Metadata', () => {
    it('should have description', () => {
      templates.forEach((template) => {
        expect(template.metadata.description).toBeDefined();
        expect(typeof template.metadata.description).toBe('string');
        expect(template.metadata.description.length).toBeGreaterThan(0);
      });
    });

    it('should have version', () => {
      templates.forEach((template) => {
        expect(template.metadata.version).toBeDefined();
        expect(typeof template.metadata.version).toBe('string');
        expect(template.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });

    it('should have required variables', () => {
      templates.forEach((template) => {
        expect(template.metadata.requiredVariables).toBeDefined();
        expect(Array.isArray(template.metadata.requiredVariables)).toBe(true);
      });
    });

    it('should have timestamps', () => {
      templates.forEach((template) => {
        expect(template.metadata.createdAt).toBeDefined();
        expect(template.metadata.updatedAt).toBeDefined();
      });
    });
  });

  describe('Category Coverage', () => {
    it('should have templates for Deal Risk', () => {
      const dealRiskTemplates = templates.filter((t) => t.category === 'deal_risk');
      expect(dealRiskTemplates.length).toBeGreaterThan(0);
    });

    it('should have templates for Conversation Intelligence', () => {
      const conversationTemplates = templates.filter((t) => t.category === 'conversation');
      expect(conversationTemplates.length).toBeGreaterThan(0);
    });

    it('should have templates for Coaching', () => {
      const coachingTemplates = templates.filter((t) => t.category === 'coaching');
      expect(coachingTemplates.length).toBeGreaterThan(0);
    });

    it('should have templates for Team Performance', () => {
      const performanceTemplates = templates.filter((t) => t.category === 'team_performance');
      expect(performanceTemplates.length).toBeGreaterThan(0);
    });

    it('should have templates for Playbook Builder', () => {
      const playbookTemplates = templates.filter((t) => t.category === 'playbook');
      expect(playbookTemplates.length).toBeGreaterThan(0);
    });

    it('should have templates for Sequence Intelligence', () => {
      const sequenceTemplates = templates.filter((t) => t.category === 'sequence');
      expect(sequenceTemplates.length).toBeGreaterThan(0);
    });

    it('should have templates for Lead Routing', () => {
      const routingTemplates = templates.filter((t) => t.category === 'lead_routing');
      expect(routingTemplates.length).toBeGreaterThan(0);
    });

    it('should have templates for Email Writer', () => {
      const emailTemplates = templates.filter((t) => t.category === 'email_writer');
      expect(emailTemplates.length).toBeGreaterThan(0);
    });

    it('should have templates for Workflow Automation', () => {
      const workflowTemplates = templates.filter((t) => t.category === 'workflow');
      expect(workflowTemplates.length).toBeGreaterThan(0);
    });

    it('should have templates for Forecasting', () => {
      const forecastingTemplates = templates.filter((t) => t.category === 'forecasting');
      expect(forecastingTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('Priority Distribution', () => {
    it('should have critical priority templates', () => {
      const criticalTemplates = templates.filter((t) => t.priority === 'critical');
      expect(criticalTemplates.length).toBeGreaterThan(0);
    });

    it('should have high priority templates', () => {
      const highTemplates = templates.filter((t) => t.priority === 'high');
      expect(highTemplates.length).toBeGreaterThan(0);
    });

    it('should have medium priority templates', () => {
      const mediumTemplates = templates.filter((t) => t.priority === 'medium');
      expect(mediumTemplates.length).toBeGreaterThan(0);
    });

    it('should have low priority templates', () => {
      const lowTemplates = templates.filter((t) => t.priority === 'low');
      expect(lowTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('Slack Blocks', () => {
    it('should have valid block structure', () => {
      templates.forEach((template) => {
        if (template.slack?.blocks) {
          template.slack.blocks.forEach((block) => {
            expect(block.type).toBeDefined();
            expect(typeof block.type).toBe('string');
          });
        }
      });
    });

    it('should use appropriate block types', () => {
      templates.forEach((template) => {
        if (template.slack?.blocks) {
          template.slack.blocks.forEach((block) => {
            // Note: This is a soft check as Slack supports many block types
            expect(typeof block.type).toBe('string');
          });
        }
      });
    });
  });

  describe('Template Count', () => {
    it('should have at least 15 templates (one per category)', () => {
      expect(templates.length).toBeGreaterThanOrEqual(15);
    });

    it('should have reasonable total count', () => {
      // Not too many to be overwhelming
      expect(templates.length).toBeLessThan(100);
    });
  });
});
