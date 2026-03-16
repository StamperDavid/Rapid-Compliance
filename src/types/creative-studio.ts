/**
 * Creative Studio Types — Cinematic Content Engine
 *
 * Types for the RenderZero-caliber cinematic AI generation system.
 * Used by: Video Studio, Image Generation, Jasper, Campaigns, Characters, Script Generation.
 */

import { z } from 'zod';

// ─── Preset Categories ──────────────────────────────────────────────

export const PRESET_CATEGORIES = [
  'shotType',
  'camera',
  'focalLength',
  'lensType',
  'lighting',
  'filmStock',
  'photographerStyle',
  'movieLook',
  'filter',
  'artStyle',
  'composition',
] as const;
export type PresetCategory = (typeof PRESET_CATEGORIES)[number];

export const VIEWING_DIRECTIONS = ['front', 'back', 'left', 'right'] as const;
export type ViewingDirection = (typeof VIEWING_DIRECTIONS)[number];

export const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '21:9', '4:3', '3:2'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const STUDIO_PROVIDERS = ['fal', 'google', 'openai', 'hedra', 'kling'] as const;
export type StudioProvider = (typeof STUDIO_PROVIDERS)[number];

export const GENERATION_STATUSES = [
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const GENERATION_TYPES = ['image', 'video'] as const;
export type GenerationType = (typeof GENERATION_TYPES)[number];

export const CHARACTER_SLOT_TYPES = ['face', 'outfit', 'object', 'scene'] as const;
export type CharacterSlotType = (typeof CHARACTER_SLOT_TYPES)[number];

export const STITCH_MODES = ['single', 'stitch'] as const;
export type StitchMode = (typeof STITCH_MODES)[number];

export const STUDIO_MODES = ['generate', 'edit'] as const;
export type StudioMode = (typeof STUDIO_MODES)[number];

// ─── Cinematic Presets ──────────────────────────────────────────────

export interface CinematicPreset {
  id: string;
  name: string;
  category: PresetCategory;
  promptFragment: string;
  thumbnail?: string;
  tags: string[];
  description?: string;
}

export interface GenrePreset {
  id: string;
  name: string;
  description: string;
  config: CinematicConfig;
  tags: string[];
}

// ─── Cinematic Configuration ────────────────────────────────────────

export interface CinematicConfig {
  shotType?: string;
  viewingDirection?: ViewingDirection;
  subjectUnawareOfCamera?: boolean;
  lighting?: string;
  atmosphere?: string;
  camera?: string;
  focalLength?: string;
  lensType?: string;
  filmStock?: string;
  aspectRatio?: AspectRatio;
  temperature?: number;
  photographerStyle?: string;
  movieLook?: string;
  filters?: string[];
  artStyle?: string;
  composition?: string;
}

export interface SceneGenerationConfig extends CinematicConfig {
  scriptText?: string;
  visualDescription?: string;
  avatarId?: string;
  voiceId?: string;
  sceneIndex?: number;
  duration?: number;
}

// ─── Provider Configuration ─────────────────────────────────────────

export interface ProviderCapability {
  type: GenerationType;
  models: string[];
  maxResolution: string;
  supportedAspectRatios: AspectRatio[];
  supportsCharacterRef: boolean;
  supportsStyleRef: boolean;
  supportsInpainting: boolean;
}

export interface ProviderConfig {
  provider: StudioProvider;
  displayName: string;
  description: string;
  isConfigured: boolean;
  isHealthy: boolean;
  capabilities: ProviderCapability[];
  costPerUnit: Record<string, number>;
  recommended: string[];
}

// ─── Generation Request/Result ──────────────────────────────────────

export interface GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  type: GenerationType;
  provider?: StudioProvider;
  model?: string;
  presets: CinematicConfig;
  size?: string;
  quality?: string;
  characters?: CharacterReference[];
  referenceImages?: string[];
  globalReference?: string;
  narrativeAnglePrompting?: boolean;
  mode?: StudioMode;
  inpaintMask?: string;
  campaignId?: string;
  projectId?: string;
}

export interface GenerationResult {
  id: string;
  url: string;
  thumbnailUrl?: string;
  revisedPrompt?: string;
  provider: StudioProvider;
  model: string;
  cost: number;
  metadata: GenerationMetadata;
  createdAt: string;
}

export interface GenerationMetadata {
  width: number;
  height: number;
  duration?: number;
  format: string;
  seed?: number;
  steps?: number;
  cfgScale?: number;
}

// ─── Studio Generation (Firestore document) ─────────────────────────

export interface StudioGeneration {
  id: string;
  userId: string;
  prompt: string;
  assembledPrompt: string;
  negativePrompt?: string;
  type: GenerationType;
  presets: CinematicConfig;
  provider: StudioProvider;
  model: string;
  status: GenerationStatus;
  result?: GenerationResult;
  error?: string;
  cost: number;
  campaignId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ─── Character System ───────────────────────────────────────────────

export interface CharacterSlot {
  type: CharacterSlotType;
  mode: StitchMode;
  imageUrls: string[];
}

export interface CharacterReference {
  id?: string;
  name: string;
  slots: CharacterSlot[];
  physicalDescription?: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  slots: CharacterSlot[];
  physicalDescription?: string;
  voiceId?: string;
  style?: string;
  hedraAvatarId?: string;
  thumbnailUrl?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Custom Presets (user-saved) ────────────────────────────────────

export interface CustomPreset {
  id: string;
  name: string;
  description?: string;
  config: CinematicConfig;
  userId: string;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Cost Tracking ──────────────────────────────────────────────────

export interface CostEntry {
  id: string;
  generationId: string;
  userId: string;
  provider: StudioProvider;
  model: string;
  type: GenerationType;
  cost: number;
  resolution?: string;
  campaignId?: string;
  createdAt: string;
}

export interface CostSummary {
  totalCost: number;
  byProvider: Record<string, number>;
  byType: Record<string, number>;
  byCampaign: Record<string, number>;
  generationCount: number;
  period: { start: string; end: string };
}

// ─── Render Queue ───────────────────────────────────────────────────

export interface RenderQueueItem {
  id: string;
  status: GenerationStatus;
  prompt: string;
  provider: StudioProvider;
  model: string;
  type: GenerationType;
  progress?: number;
  result?: GenerationResult;
  error?: string;
  createdAt: string;
  estimatedCost: number;
}

// ─── Zod Schemas ────────────────────────────────────────────────────

export const CinematicConfigSchema = z.object({
  shotType: z.string().optional(),
  viewingDirection: z.enum(VIEWING_DIRECTIONS).optional(),
  subjectUnawareOfCamera: z.boolean().optional(),
  lighting: z.string().optional(),
  atmosphere: z.string().optional(),
  camera: z.string().optional(),
  focalLength: z.string().optional(),
  lensType: z.string().optional(),
  filmStock: z.string().optional(),
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
  temperature: z.number().min(0).max(1).optional(),
  photographerStyle: z.string().optional(),
  movieLook: z.string().optional(),
  filters: z.array(z.string()).optional(),
  artStyle: z.string().optional(),
  composition: z.string().optional(),
});

export const CharacterSlotSchema = z.object({
  type: z.enum(CHARACTER_SLOT_TYPES),
  mode: z.enum(STITCH_MODES),
  imageUrls: z.array(z.string().url()).max(4),
});

export const CharacterReferenceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  slots: z.array(CharacterSlotSchema),
  physicalDescription: z.string().optional(),
});

export const GenerationRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  negativePrompt: z.string().optional(),
  type: z.enum(GENERATION_TYPES),
  provider: z.enum(STUDIO_PROVIDERS).optional(),
  model: z.string().optional(),
  presets: CinematicConfigSchema.default({}),
  size: z.string().optional(),
  quality: z.string().optional(),
  characters: z.array(CharacterReferenceSchema).max(4).optional(),
  referenceImages: z.array(z.string()).max(14).optional(),
  globalReference: z.string().optional(),
  narrativeAnglePrompting: z.boolean().optional(),
  mode: z.enum(STUDIO_MODES).optional(),
  inpaintMask: z.string().optional(),
  campaignId: z.string().optional(),
  projectId: z.string().optional(),
});

export type GenerationRequestInput = z.infer<typeof GenerationRequestSchema>;

export const ProviderValidateSchema = z.object({
  provider: z.enum(STUDIO_PROVIDERS),
  apiKey: z.string().min(1, 'API key is required'),
});

export type ProviderValidateInput = z.infer<typeof ProviderValidateSchema>;

export const SavePresetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  config: CinematicConfigSchema,
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).max(20).default([]),
});

export type SavePresetInput = z.infer<typeof SavePresetSchema>;

export const CreateCharacterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slots: z.array(CharacterSlotSchema).default([]),
  physicalDescription: z.string().max(1000).optional(),
  voiceId: z.string().optional(),
  style: z.string().optional(),
  hedraAvatarId: z.string().optional(),
  tags: z.array(z.string()).max(20).default([]),
});

export type CreateCharacterInput = z.infer<typeof CreateCharacterSchema>;

export const CostQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  provider: z.enum(STUDIO_PROVIDERS).optional(),
  type: z.enum(GENERATION_TYPES).optional(),
});

export type CostQueryInput = z.infer<typeof CostQuerySchema>;
