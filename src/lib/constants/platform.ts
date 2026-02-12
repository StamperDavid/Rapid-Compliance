/**
 * Platform-level configuration and utilities
 * @module lib/constants/platform
 *
 * SalesVelocity.ai — Single-tenant platform (Penthouse Model)
 * There is NO multi-tenant/org layer. This file defines the platform root identity.
 */

/**
 * Platform root identifier used as the Firestore document root.
 * This is the single identity for the entire SalesVelocity.ai platform.
 */
export const PLATFORM_ID = 'rapid-compliance-root' as const;

/** @deprecated Use PLATFORM_ID instead. Will be removed in next cleanup pass. */
export const DEFAULT_ORG_ID = PLATFORM_ID;

/**
 * Platform AI assistant name.
 * Single-tenant — the assistant is always Jasper. No per-org customization.
 */
export const ASSISTANT_NAME = 'Jasper' as const;

/**
 * Platform company configuration
 */
export const COMPANY_CONFIG = {
  id: PLATFORM_ID,
  name: 'SalesVelocity.ai',
} as const;
