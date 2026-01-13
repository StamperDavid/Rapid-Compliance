/**
 * AI Agent Tools Registry
 *
 * Central export for all AI agent tools.
 * Add new tools here as they are created.
 */

// Discount & Coupon Tools
export * from './discount-tool';

/**
 * Tool Categories
 */
export const TOOL_CATEGORIES = {
  PRICING: ['get_authorized_discounts', 'validate_coupon', 'apply_discount'],
  // Add more categories as tools are added
  // CRM: ['search_leads', 'create_lead', 'update_lead'],
  // SCHEDULING: ['check_availability', 'book_meeting'],
} as const;
