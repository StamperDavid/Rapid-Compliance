/**
 * Location Library — LocationProfile type + Zod schema.
 *
 * A LocationProfile is a digital, REUSABLE SET (a place). It mirrors the
 * Character Library (AvatarProfile) but anchors a PLACE instead of a person.
 *
 * The `description` field is the LOCKED set description — layout, furniture and
 * its placement, windows and which walls they're on, materials, surfaces,
 * lighting, distinguishing features. That description, paired with the reference
 * images/videos, is what keeps the room IDENTICAL across every render.
 *
 * Locations are user-created ('custom') in the Location Library with full
 * environment-identity control.
 */

import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

/** Location source — 'custom' = user-created in the Location Library */
export type LocationSource = 'custom';

export interface LocationProfile {
  id: string;
  userId: string;
  name: string; // e.g. "Embroidery Studio"
  /**
   * The LOCKED set description: layout, furniture and its placement, windows and
   * which walls they're on, materials, surfaces, lighting, distinguishing
   * features. This is what keeps the room IDENTICAL every render.
   */
  description: string;
  /** Photos of the space, ideally several angles (the environment identity anchors). */
  referenceImageUrls: string[];
  /** Optional video walkthrough(s) of the space. */
  referenceVideoUrls: string[];
  source: 'custom';
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Full LocationProfile schema (validates a complete persisted/returned record).
 */
export const LocationProfileSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  referenceImageUrls: z.array(z.string().url()),
  referenceVideoUrls: z.array(z.string().url()),
  source: z.literal('custom'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Schema for creating a new LocationProfile. `userId`, `id`, `source`, and
 * timestamps are assigned server-side, so they are not part of the input.
 */
export const CreateLocationProfileSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  referenceImageUrls: z.array(z.string().url()).default([]),
  referenceVideoUrls: z.array(z.string().url()).default([]),
  source: z.literal('custom').optional(),
});

/**
 * Schema for partially updating a LocationProfile. Every field is optional so
 * callers can PATCH just the field(s) they changed.
 */
export const UpdateLocationProfileSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  referenceImageUrls: z.array(z.string().url()).optional(),
  referenceVideoUrls: z.array(z.string().url()).optional(),
  source: z.literal('custom').optional(),
});

// ============================================================================
// Input Types (mirroring the avatar-profile Create/Update equivalents)
// ============================================================================

export interface CreateLocationProfileData {
  name: string;
  description?: string;
  referenceImageUrls?: string[];
  referenceVideoUrls?: string[];
  source?: LocationSource;
}

export interface UpdateLocationProfileData {
  name?: string;
  description?: string;
  referenceImageUrls?: string[];
  referenceVideoUrls?: string[];
  source?: LocationSource;
}
