/**
 * WhatsApp Business Service — WhatsApp Cloud API integration
 * Sends messages via the Meta WhatsApp Business Platform
 *
 * Auth: Meta Graph API access token + phone number ID
 * API: https://graph.facebook.com/v18.0/
 *
 * @module integrations/whatsapp-business-service
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WhatsAppConfig {
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
}

export interface WhatsAppMessageRequest {
  to: string;
  text: string;
  previewUrl?: boolean;
}

export interface WhatsAppTemplateRequest {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: Array<{
    type: string;
    parameters: Array<{ type: string; text?: string }>;
  }>;
}

export interface WhatsAppMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface WhatsAppBusinessProfile {
  verified_name: string;
  messaging_product: string;
  quality_rating: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const GRAPH_API = 'https://graph.facebook.com/v18.0';

export class WhatsAppBusinessService {
  private config: WhatsAppConfig;

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return Boolean(this.config.accessToken && this.config.phoneNumberId);
  }

  async sendTextMessage(request: WhatsAppMessageRequest): Promise<WhatsAppMessageResponse> {
    try {
      if (!this.config.accessToken || !this.config.phoneNumberId) {
        return { success: false, error: 'WhatsApp Business not configured' };
      }

      const response = await fetch(
        `${GRAPH_API}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: request.to,
            type: 'text',
            text: {
              body: request.text,
              preview_url: request.previewUrl ?? false,
            },
          }),
        },
      );

      const data = (await response.json()) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };

      if (!response.ok || !data.messages?.length) {
        return { success: false, error: data.error?.message ?? `WhatsApp send failed: ${response.status}` };
      }

      return { success: true, messageId: data.messages[0]?.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[WhatsAppService] Send failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async sendTemplate(request: WhatsAppTemplateRequest): Promise<WhatsAppMessageResponse> {
    try {
      if (!this.config.accessToken || !this.config.phoneNumberId) {
        return { success: false, error: 'WhatsApp Business not configured' };
      }

      const response = await fetch(
        `${GRAPH_API}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: request.to,
            type: 'template',
            template: {
              name: request.templateName,
              language: { code: request.languageCode ?? 'en_US' },
              ...(request.components ? { components: request.components } : {}),
            },
          }),
        },
      );

      const data = (await response.json()) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };

      if (!response.ok || !data.messages?.length) {
        return { success: false, error: data.error?.message ?? 'WhatsApp template send failed' };
      }

      return { success: true, messageId: data.messages[0]?.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[WhatsAppService] Template send failed', error instanceof Error ? error : new Error(msg));
      return { success: false, error: msg };
    }
  }

  async getBusinessProfile(): Promise<WhatsAppBusinessProfile | null> {
    try {
      if (!this.config.accessToken || !this.config.phoneNumberId) {
        return null;
      }

      const res = await fetch(
        `${GRAPH_API}/${this.config.phoneNumberId}/whatsapp_business_profile?fields=verified_name,messaging_product,quality_rating`,
        { headers: { Authorization: `Bearer ${this.config.accessToken}` } },
      );

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as { data?: WhatsAppBusinessProfile[] };
      return data.data?.[0] ?? null;
    } catch {
      return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function createWhatsAppBusinessService(): Promise<WhatsAppBusinessService | null> {
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'whatsapp_business') as WhatsAppConfig | null;
  if (!keys) {
    return null;
  }
  const service = new WhatsAppBusinessService(keys);
  return service.isConfigured() ? service : null;
}
