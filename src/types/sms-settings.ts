/**
 * SMS Settings — shared type definitions
 *
 * Single-document config for SMS sending behavior across the platform.
 * Stored in Firestore at `organizations/{org}/settings/sms`. Edited from
 * the SMS settings UI. Loaded by the SMS Specialist at runtime (with a
 * short cache) so configuration changes propagate without a redeploy.
 *
 * The most important field is `maxCharCap` — the ceiling on SMS length
 * that the specialist and the sending layer both enforce to protect
 * against accidentally blowing up the SMS bill. 160 chars = 1 segment,
 * 320 = 2 segments, 480 = 3 segments, 1600 = 10 segments (carrier max).
 * Most platforms set this somewhere between 320 and 480 for marketing
 * SMS and leave higher caps for rare long-form transactional messages.
 */

export type SmsComplianceRegion = 'US' | 'CA' | 'UK' | 'EU' | 'AU' | 'OTHER';

export interface SmsSettings {
  /**
   * Maximum characters per SMS message. The SMS Specialist injects this
   * number into its LLM prompt and targets within it. The sending layer
   * enforces it strictly before handing messages to the carrier API.
   * Default: 480 (3 SMS segments — a safe middle ground for marketing).
   */
  maxCharCap: number;

  /**
   * Default sender identifier. Can be a 10-digit long code (10DLC),
   * a 5-6 digit short code, a toll-free number, or an alphanumeric
   * sender ID (region-dependent). Per-campaign senders override this.
   */
  defaultSenderId: string;

  /**
   * Compliance region — governs which opt-out keywords and disclosure
   * requirements the LLM must include. US = STOP/HELP per TCPA.
   * EU = UK = GDPR + Opt-out link. Changes the compliance footer the
   * LLM must include in every message.
   */
  complianceRegion: SmsComplianceRegion;

  /**
   * If true, every message must include a compliance footer
   * (e.g. "Reply STOP to unsubscribe"). Set to false only for
   * transactional-only accounts with separate compliance flows.
   */
  requireComplianceFooter: boolean;

  /**
   * Default URL shortener domain for links in SMS bodies. Short URLs
   * save precious characters. Blank string means no shortener configured
   * and the LLM should advise on handling long URLs explicitly.
   */
  defaultShortenerDomain: string;

  /** ISO timestamp of last update. */
  updatedAt: string;

  /** User id of last editor. */
  updatedBy: string;
}

export interface UpdateSmsSettingsInput {
  maxCharCap?: number;
  defaultSenderId?: string;
  complianceRegion?: SmsComplianceRegion;
  requireComplianceFooter?: boolean;
  defaultShortenerDomain?: string;
}
