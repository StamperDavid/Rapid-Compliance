/**
 * Unit Tests for Validation Schemas
 * Tests critical input validation to ensure security
 */

import {
  emailSendSchema,
  smsSendSchema,
  paymentIntentSchema,
  workflowExecuteSchema,
  leadScoringSchema,
  campaignCreateSchema,
  validateInput,
} from '@/lib/validation/schemas';

describe('Validation Schemas', () => {
  describe('emailSendSchema', () => {
    it('should validate correct email data', () => {
      const validData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        organizationId: 'org-123',
      };
      const result = validateInput(emailSendSchema, validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        to: 'not-an-email',
        subject: 'Test',
        html: '<p>Test</p>',
        organizationId: 'org-123',
      };
      const result = validateInput(emailSendSchema, invalidData);
      expect(result.success).toBe(false);
    });

    it('should require organizationId', () => {
      const invalidData = {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      };
      const result = validateInput(emailSendSchema, invalidData);
      expect(result.success).toBe(false);
    });

    it('should require either html or text', () => {
      const invalidData = {
        to: 'test@example.com',
        subject: 'Test',
        organizationId: 'org-123',
      };
      const result = validateInput(emailSendSchema, invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('smsSendSchema', () => {
    it('should validate correct SMS data', () => {
      const validData = {
        to: '+1234567890',
        message: 'Test message',
        organizationId: 'org-123',
      };
      const result = validateInput(smsSendSchema, validData);
      expect(result.success).toBe(true);
    });

    it('should require organizationId', () => {
      const invalidData = {
        to: '+1234567890',
        message: 'Test',
      };
      const result = validateInput(smsSendSchema, invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createPaymentIntentSchema', () => {
    it('should validate correct payment intent data', () => {
      const validData = {
        amount: 1000,
        currency: 'usd',
        organizationId: 'org-123',
      };
      const result = validateInput(paymentIntentSchema, validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative amounts', () => {
      const invalidData = {
        amount: -100,
        currency: 'usd',
        organizationId: 'org-123',
      };
      const result = validateInput(paymentIntentSchema, invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('workflowExecuteSchema', () => {
    it('should validate correct workflow execution data', () => {
      const validData = {
        workflowId: 'workflow-123',
        triggerData: { event: 'contact.created' },
        organizationId: 'org-123',
      };
      const result = validateInput(workflowExecuteSchema, validData);
      expect(result.success).toBe(true);
    });
  });

  describe('leadScoringSchema', () => {
    it('should validate correct lead scoring data', () => {
      const validData = {
        leadId: 'lead-123',
        organizationId: 'org-123',
      };
      const result = validateInput(leadScoringSchema, validData);
      expect(result.success).toBe(true);
    });
  });

  describe('createCampaignSchema', () => {
    it('should validate correct campaign data', () => {
      const validData = {
        name: 'Test Campaign',
        subject: 'Test Subject',
        templateId: 'template-123',
        recipientList: ['test@example.com'],
        organizationId: 'org-123',
      };
      const result = validateInput(campaignCreateSchema, validData);
      expect(result.success).toBe(true);
    });
  });
});

