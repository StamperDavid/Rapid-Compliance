/**
 * Slack Service Tests
 *
 * Comprehensive test coverage for SlackService class.
 */

import crypto from 'crypto';
import { SlackService } from '@/lib/slack/slack-service';
import type { SlackServiceConfig, SlackWorkspace } from '@/lib/slack/types';
import { Timestamp } from 'firebase-admin/firestore';

// Mock fetch
global.fetch = jest.fn();

describe('SlackService', () => {
  let service: SlackService;
  let mockConfig: SlackServiceConfig;

  beforeEach(() => {
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      signingSecret: 'test-signing-secret',
      scopes: ['channels:read', 'chat:write'],
      rateLimit: {
        maxPerMinute: 60,
        maxPerHour: 3000,
      },
      retry: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
      },
      verifyWebhooks: true,
    };

    service = new SlackService(mockConfig);

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate correct OAuth URL', () => {
      const state = 'test-state';
      const redirectUri = 'https://example.com/callback';

      const url = service.getAuthorizationUrl(state, redirectUri);

      expect(url).toContain('slack.com/oauth/v2/authorize');
      expect(url).toContain(`client_id=${mockConfig.clientId}`);
      expect(url).toContain(`state=${state}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(url).toContain('scope=');
    });
  });

  describe('exchangeOAuthCode', () => {
    it('should successfully exchange code for token', async () => {
      const mockResponse = {
        ok: true,
        access_token: 'xoxb-test-token',
        token_type: 'bot',
        scope: 'channels:read,chat:write',
        bot_user_id: 'U123',
        app_id: 'A123',
        team: {
          id: 'T123',
          name: 'Test Team',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.exchangeOAuthCode('test-code', 'https://example.com/callback');

      expect(result.access_token).toBe('xoxb-test-token');
      expect(result.team.id).toBe('T123');
      expect(result.bot_user_id).toBe('U123');
    });

    it('should reject on failed exchange', async () => {
      const mockResponse = {
        ok: false,
        error: 'invalid_code',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 400,
        json: () => Promise.resolve(mockResponse),
      });

      await expect(
        service.exchangeOAuthCode('invalid-code', 'https://example.com/callback')
      ).rejects.toMatchObject({ error: 'invalid_code' });
    });
  });

  describe('sendMessage', () => {
    let mockWorkspace: SlackWorkspace;

    beforeEach(() => {
      mockWorkspace = {
        id: 'workspace-1',
        organizationId: 'org-1',
        teamId: 'T123',
        teamName: 'Test Team',
        botToken: 'xoxb-test-token',
        botUserId: 'U123',
        scopes: ['channels:read', 'chat:write'],
        installedBy: {
          userId: 'user-1',
        },
        status: 'connected',
        connectedAt: Timestamp.now(),
        settings: {
          enabled: true,
          mentions: {
            allowChannelMentions: true,
            allowHereMentions: true,
          },
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
    });

    it('should successfully send text message', async () => {
      const mockResponse = {
        ok: true,
        channel: 'C123',
        ts: '1234567890.123456',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve({
            ok: true,
            permalink: 'https://example.slack.com/archives/C123/p1234567890123456',
          }),
        });

      const result = await service.sendMessage(mockWorkspace, {
        channelId: 'C123',
        text: 'Test message',
        type: 'text',
        priority: 'medium',
        category: 'system',
      });

      expect(result.ts).toBe('1234567890.123456');
      expect(result.channel).toBe('C123');
      expect(result.permalink).toBeTruthy();
    });

    it('should add channel mention for critical priority', async () => {
      const mockResponse = {
        ok: true,
        channel: 'C123',
        ts: '1234567890.123456',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve({
            ok: true,
            permalink: 'https://example.slack.com/archives/C123/p1234567890123456',
          }),
        });

      await service.sendMessage(mockWorkspace, {
        channelId: 'C123',
        text: 'Critical alert',
        type: 'text',
        priority: 'critical',
        category: 'deal_risk',
        mentions: {
          channel: true,
        },
      });

      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      const messageCall = fetchCalls.find((call: unknown[]) => {
        const url = call[0] as string;
        return url.includes('chat.postMessage');
      });
      if (!messageCall) {
        throw new Error('Expected chat.postMessage call not found');
      }
      const payload = JSON.parse((messageCall[1] as { body: string }).body);

      expect(payload.text).toContain('<!channel>');
    });

    it('should send message with blocks', async () => {
      const mockResponse = {
        ok: true,
        channel: 'C123',
        ts: '1234567890.123456',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve({
            ok: true,
            permalink: 'https://example.slack.com/archives/C123/p1234567890123456',
          }),
        });

      await service.sendMessage(mockWorkspace, {
        channelId: 'C123',
        text: 'Test message',
        type: 'blocks',
        priority: 'medium',
        category: 'system',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Hello *world*',
            },
          },
        ],
      });

      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      const messageCall = fetchCalls.find((call: unknown[]) => {
        const url = call[0] as string;
        return url.includes('chat.postMessage');
      });
      if (!messageCall) {
        throw new Error('Expected chat.postMessage call not found');
      }
      const payload = JSON.parse((messageCall[1] as { body: string }).body);

      expect(payload.blocks).toHaveLength(1);
      expect(payload.blocks[0].type).toBe('section');
    });

    it('should handle rate limit errors', async () => {
      // Create service with maxRetries: 1 so it fails immediately without delays
      const noRetryService = new SlackService({
        ...mockConfig,
        retry: { ...mockConfig.retry, maxRetries: 1, initialDelayMs: 1, maxDelayMs: 1 },
      });

      const mockResponse = {
        ok: false,
        error: 'rate_limited',
        retry_after: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        status: 429,
        json: () => Promise.resolve(mockResponse),
      });

      await expect(
        noRetryService.sendMessage(mockWorkspace, {
          channelId: 'C123',
          text: 'Test message',
          type: 'text',
          priority: 'medium',
          category: 'system',
        })
      ).rejects.toMatchObject({ error: 'rate_limited' });
    });
  });

  describe('listChannels', () => {
    it('should successfully list channels', async () => {
      const mockResponse = {
        ok: true,
        channels: [
          {
            id: 'C123',
            name: 'general',
            is_channel: true,
            is_group: false,
            is_im: false,
            is_mpim: false,
            is_private: false,
            created: 1234567890,
            is_archived: false,
            is_member: true,
            num_members: 10,
          },
          {
            id: 'C456',
            name: 'random',
            is_channel: true,
            is_group: false,
            is_im: false,
            is_mpim: false,
            is_private: false,
            created: 1234567890,
            is_archived: false,
            is_member: false,
            num_members: 5,
          },
        ],
        response_metadata: {
          next_cursor: '',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.listChannels('xoxb-test-token', {
        excludeArchived: true,
        limit: 100,
      });

      expect(result.channels).toHaveLength(2);
      expect(result.channels[0].name).toBe('general');
      expect(result.channels[0].type).toBe('public_channel');
    });

    it('should handle pagination', async () => {
      const mockResponse = {
        ok: true,
        channels: [],
        response_metadata: {
          next_cursor: 'next-page-cursor',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.listChannels('xoxb-test-token', {
        limit: 100,
        cursor: 'current-cursor',
      });

      expect(result.nextCursor).toBe('next-page-cursor');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({ type: 'event_callback' });

      // Generate valid signature
      const sigBasestring = `v0:${timestamp}:${body}`;
      const signature = `v0=${crypto
        .createHmac('sha256', mockConfig.signingSecret)
        .update(sigBasestring)
        .digest('hex')}`;

      const isValid = service.verifyWebhookSignature(timestamp, signature, body);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({ type: 'event_callback' });
      const signature = 'v0=invalid-signature';

      const isValid = service.verifyWebhookSignature(timestamp, signature, body);

      expect(isValid).toBe(false);
    });

    it('should reject old timestamp', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000 - 400).toString(); // 6+ minutes ago
      const body = JSON.stringify({ type: 'event_callback' });
      const signature = 'v0=test';

      const isValid = service.verifyWebhookSignature(oldTimestamp, signature, body);

      expect(isValid).toBe(false);
    });
  });

  describe('testAuth', () => {
    it('should successfully test auth', async () => {
      const mockResponse = {
        ok: true,
        url: 'https://example.slack.com/',
        team: 'Test Team',
        user: 'test-user',
        team_id: 'T123',
        user_id: 'U123',
        bot_id: 'B123',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.testAuth('xoxb-test-token');

      expect(result.team_id).toBe('T123');
      expect(result.bot_id).toBe('B123');
    });

    it('should reject on invalid token', async () => {
      const mockResponse = {
        ok: false,
        error: 'invalid_auth',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 401,
        json: () => Promise.resolve(mockResponse),
      });

      await expect(
        service.testAuth('invalid-token')
      ).rejects.toMatchObject({ error: 'invalid_auth' });
    });
  });

  describe('revokeToken', () => {
    it('should successfully revoke token', async () => {
      const mockResponse = {
        ok: true,
        revoked: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await expect(
        service.revokeToken('xoxb-test-token')
      ).resolves.not.toThrow();
    });

    it('should handle already revoked token', async () => {
      const mockResponse = {
        ok: false,
        error: 'token_revoked',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      await expect(
        service.revokeToken('xoxb-test-token')
      ).resolves.not.toThrow();
    });
  });
});
