/**
 * SMS Purpose Types — shared type definitions
 *
 * SMS purpose types are a Firestore-backed taxonomy of the "why" behind
 * a marketing SMS. They classify the SMS (cold outreach, appointment
 * reminder, shipping update, flash offer, win-back, etc.) so the SMS
 * Specialist can compose appropriately, the UI can group and report on
 * them, and analytics can track performance by intent.
 *
 * Intentionally separate from Email Purpose Types — SMS and email have
 * different use-case profiles. SMS has transactional patterns (shipping
 * updates, appointment reminders, payment reminders) that don't map to
 * email, and email has long-form patterns (case study, deep nurture)
 * that don't fit SMS's 160-character limits.
 *
 * The list is expandable at runtime — new types are created from the
 * campaign creation flow and immediately become selectable without a
 * code deploy. Same pattern as email purpose types.
 */

export interface SmsPurposeType {
  /** Firestore document id (same as slug for default seeded types) */
  id: string;
  /** Human-readable display name (e.g. "Flash Offer", "Appointment Reminder") */
  name: string;
  /**
   * Stable machine slug used by the LLM as the enum value.
   * Lowercase, snake_case. Never changes after creation even if the
   * display name is edited, so historical campaigns remain resolvable.
   */
  slug: string;
  /**
   * One-sentence description of when this type should be used. Injected
   * into the SMS Specialist LLM prompt so the model can pick the right
   * type for a given brief. Also shown in the UI combobox as help text.
   */
  description: string;
  /**
   * Soft-archive flag. Archived types remain in Firestore so historical
   * campaigns resolve, but they are hidden from the UI combobox and are
   * not offered to the LLM for new compositions.
   */
  active: boolean;
  /**
   * Count of campaigns that have used this type. Used to sort the UI
   * combobox by recency-of-use so the most-used types float to the top.
   */
  usageCount: number;
  /** ISO timestamp of last use — updated atomically alongside usageCount. */
  lastUsedAt: string | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /**
   * User id of the creator, or `'system'` for the 8 seeded defaults.
   * Used for audit and for UI filtering.
   */
  createdBy: string;
}

export interface CreateSmsPurposeTypeInput {
  name: string;
  description: string;
  /** Optional explicit slug — if omitted, server slugifies name. */
  slug?: string;
}
