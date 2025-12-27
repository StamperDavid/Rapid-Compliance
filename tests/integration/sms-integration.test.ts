/**
 * SMS Integration Tests  
 * Real integration tests for SMS sending (uses test mode/sandbox)
 */

import { describe, it, expect } from '@jest/globals';
import { sendSMS } from '@/lib/sms/sms-service';

describe('SMS Integration Tests', () => {
  describe('SMS Sending (Requires Twilio Test Account)', () => {
    it.skip('should send SMS via Twilio test mode', async () => {
      // SKIP: Requires Twilio test credentials configured
      // To run this test:
      // 1. Get Twilio test Account SID and Auth Token
      // 2. Configure in apiKeyService for test org
      // 3. Remove .skip from this test
      
      const result = await sendSMS({
        to: '+15005550006', // Twilio magic number (valid, delivers in test mode)
        message: 'Test message from integration test',
        from: '+15005550006', // Twilio test number
        organizationId: 'test-org',
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.provider).toBe('twilio');
    });

    it.skip('should handle invalid phone numbers', async () => {
      // SKIP: Requires Twilio configured
      
      const result = await sendSMS({
        to: '+15005550001', // Twilio magic number (invalid)
        message: 'Test message',
        from: '+15005550006',
        organizationId: 'test-org',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid');
    });
  });

  describe('SMS Provider Configuration', () => {
    it('should have Twilio and Vonage providers configured', () => {
      // This test verifies provider configurations exist
      const { SMS_PROVIDERS } = require('@/lib/sms/sms-service');
      
      expect(SMS_PROVIDERS).toBeDefined();
      expect(Array.isArray(SMS_PROVIDERS)).toBe(true);
      
      const providerIds = SMS_PROVIDERS.map((p: any) => p.id);
      expect(providerIds).toContain('twilio');
      expect(providerIds).toContain('vonage');
    });
  });

  describe('Phone Number Validation', () => {
    it('should validate phone numbers', () => {
      const { validatePhoneNumber } = require('@/lib/sms/sms-service');
      
      // Valid formats
      expect(validatePhoneNumber('+15551234567')).toBe(true);
      expect(validatePhoneNumber('+447911123456')).toBe(true);
      
      // Invalid formats
      expect(validatePhoneNumber('555-1234')).toBe(false);
      expect(validatePhoneNumber('not-a-phone')).toBe(false);
    });
  });

  describe('SMS Templates', () => {
    it('should support variable replacement in templates', () => {
      const { renderSMSTemplate } = require('@/lib/sms/sms-service');
      
      const template = 'Hello {{firstName}}, your order {{orderNumber}} is ready!';
      const variables = {
        firstName: 'John',
        orderNumber: 'ORD-12345',
      };
      
      const rendered = renderSMSTemplate(template, variables);
      expect(rendered).toBe('Hello John, your order ORD-12345 is ready!');
    });
  });
});



