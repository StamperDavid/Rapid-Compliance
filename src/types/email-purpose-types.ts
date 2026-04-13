/**
 * Email Purpose Types — shared type definitions
 *
 * Email purpose types are a Firestore-backed taxonomy of the "why" behind
 * a marketing email. They classify the email (cold intro, warm follow-up,
 * re-engagement, win-back, upsell, etc.) so the Email Specialist can
 * compose appropriately, the UI can group and report on them, and
 * analytics can track performance by intent.
 *
 * The list is expandable at runtime — new types are created inline from
 * the campaign creation flow (Task #43b) and immediately become selectable
 * without a code deploy.
 */

export interface EmailPurposeType {
  /** Firestore document id (same as slug for default seeded types) */
  id: string;
  /** Human-readable display name (e.g. "Cold Intro", "Win-Back After Churn") */
  name: string;
  /**
   * Stable machine slug used by the LLM as the enum value.
   * Lowercase, snake_case. Never changes after creation even if the display
   * name is edited, so historical campaigns remain resolvable.
   */
  slug: string;
  /**
   * One-sentence description of when this type should be used. Injected
   * into the Email Specialist LLM prompt so the model can pick the right
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
   * User id of the creator, or `'system'` for the 9 seeded defaults.
   * Used for audit and for UI filtering ("show me only custom types").
   */
  createdBy: string;
}

/**
 * Input shape for creating a new email purpose type.
 * The server generates id, slug (from name), createdAt, and sets
 * active=true, usageCount=0, lastUsedAt=null.
 */
export interface CreateEmailPurposeTypeInput {
  name: string;
  description: string;
  /** Optional explicit slug — if omitted, server slugifies name. */
  slug?: string;
}
