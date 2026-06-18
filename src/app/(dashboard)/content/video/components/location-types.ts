/**
 * Location Library — shared client types (ADDITIVE, client-safe).
 *
 * Locations mirror Characters but for PLACES: a reusable "digital set" defined
 * once (its locked layout/furniture/materials/lighting description plus reference
 * images and optional reference video) and reused across every video.
 *
 * The backend service + API routes are owned by a sibling agent. This file is the
 * exact client-side contract the UI codes against:
 *
 *   GET  /api/video/locations?scope=own        → { success, locations: LocationProfile[] }
 *   POST /api/video/locations                  → { success, location }
 *   GET    /api/video/locations/[locationId]   → { success, location }
 *   PATCH  /api/video/locations/[locationId]   → { success, location }
 *   DELETE /api/video/locations/[locationId]   → { success }
 */

/** A saved, reusable location (digital set). */
export interface LocationProfile {
  id: string;
  userId: string;
  name: string;
  /** The locked set description — layout, furniture, windows, walls, materials, lighting.
   *  This is what keeps the room consistent across every shot. */
  description: string;
  referenceImageUrls: string[];
  referenceVideoUrls: string[];
  source: 'custom';
  createdAt: string;
  updatedAt: string;
}

/** GET /api/video/locations?scope=own */
export interface LocationsListResponse {
  success: boolean;
  locations?: LocationProfile[];
  error?: string;
}

/** POST /api/video/locations  +  PATCH/GET /api/video/locations/[id] */
export interface LocationMutationResponse {
  success: boolean;
  location?: LocationProfile;
  error?: string;
}

/** DELETE /api/video/locations/[id] */
export interface LocationDeleteResponse {
  success: boolean;
  error?: string;
}

/** The create/update payload the API consumes. */
export interface LocationFormPayload {
  name: string;
  description: string;
  referenceImageUrls: string[];
  referenceVideoUrls: string[];
}
