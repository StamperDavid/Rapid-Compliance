/**
 * Unit Tests: src/lib/constants/platform.ts
 *
 * Validates the single-tenant platform identity constants exported from the
 * platform module. These values are the authoritative root identifiers for the
 * entire SalesVelocity.ai system and must never drift.
 */

import { describe, it, expect } from '@jest/globals';
import {
  PLATFORM_ID,
  ASSISTANT_NAME,
  COMPANY_CONFIG,
} from '@/lib/constants/platform';

// ============================================================================
// PLATFORM_ID
// ============================================================================

describe('PLATFORM_ID', () => {
  it("is the literal string 'rapid-compliance-root'", () => {
    expect(PLATFORM_ID).toBe('rapid-compliance-root');
  });

  it('is of type string', () => {
    expect(typeof PLATFORM_ID).toBe('string');
  });
});

// ============================================================================
// ASSISTANT_NAME
// ============================================================================

describe('ASSISTANT_NAME', () => {
  it("is the literal string 'Jasper'", () => {
    expect(ASSISTANT_NAME).toBe('Jasper');
  });

  it('is of type string', () => {
    expect(typeof ASSISTANT_NAME).toBe('string');
  });
});

// ============================================================================
// COMPANY_CONFIG
// ============================================================================

describe('COMPANY_CONFIG', () => {
  it('id matches PLATFORM_ID exactly', () => {
    expect(COMPANY_CONFIG.id).toBe(PLATFORM_ID);
  });

  it("name is 'SalesVelocity.ai'", () => {
    expect(COMPANY_CONFIG.name).toBe('SalesVelocity.ai');
  });

  it('id is of type string', () => {
    expect(typeof COMPANY_CONFIG.id).toBe('string');
  });

  it('name is of type string', () => {
    expect(typeof COMPANY_CONFIG.name).toBe('string');
  });

  it('has exactly the expected keys (no extra fields)', () => {
    expect(Object.keys(COMPANY_CONFIG).sort()).toEqual(['id', 'name']);
  });
});
