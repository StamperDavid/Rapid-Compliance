/**
 * Storyboard Preset Options
 * Dropdown options for visual direction, background, and mood selectors.
 * Each category includes curated presets plus an "Other" option for custom input.
 */

export interface PresetOption {
  value: string;
  label: string;
}

// ============================================================================
// Visual Direction / Shot Type
// ============================================================================

export const VISUAL_DIRECTION_PRESETS: PresetOption[] = [
  { value: 'close-up', label: 'Close-up' },
  { value: 'medium-shot', label: 'Medium Shot' },
  { value: 'wide-shot', label: 'Wide / Establishing Shot' },
  { value: 'over-the-shoulder', label: 'Over-the-Shoulder' },
  { value: 'birds-eye', label: "Bird's Eye View" },
  { value: 'low-angle', label: 'Low Angle (heroic)' },
  { value: 'high-angle', label: 'High Angle (overview)' },
  { value: 'dutch-angle', label: 'Dutch Angle (tension)' },
  { value: 'tracking', label: 'Tracking / Follow Shot' },
  { value: 'pan', label: 'Pan / Tilt' },
  { value: 'zoom-in', label: 'Zoom In (emphasis)' },
  { value: 'zoom-out', label: 'Zoom Out (reveal)' },
  { value: 'pov', label: 'Point of View (POV)' },
  { value: 'split-screen', label: 'Split Screen' },
  { value: 'talking-head', label: 'Talking Head (presenter)' },
  { value: 'cta-card', label: 'CTA / Title Card' },
  { value: 'other', label: 'Other (custom)' },
];

// ============================================================================
// Background / Setting
// ============================================================================

export const BACKGROUND_PRESETS: PresetOption[] = [
  { value: 'modern-office', label: 'Modern Office' },
  { value: 'home-office', label: 'Home Office' },
  { value: 'city-street', label: 'City Street / Urban' },
  { value: 'nature-outdoors', label: 'Nature / Outdoors' },
  { value: 'living-room', label: 'Home / Living Room' },
  { value: 'clean-studio', label: 'Clean Studio (solid BG)' },
  { value: 'abstract-gradient', label: 'Abstract / Gradient' },
  { value: 'conference-room', label: 'Conference Room' },
  { value: 'warehouse', label: 'Warehouse / Industrial' },
  { value: 'restaurant', label: 'Restaurant / Café' },
  { value: 'retail-store', label: 'Retail Store / Showroom' },
  { value: 'medical', label: 'Medical / Healthcare' },
  { value: 'classroom', label: 'Classroom / Education' },
  { value: 'gym', label: 'Gym / Fitness' },
  { value: 'stage', label: 'Stage / Presentation Hall' },
  { value: 'rooftop', label: 'Rooftop / Terrace' },
  { value: 'coworking', label: 'Co-working Space' },
  { value: 'other', label: 'Other (custom)' },
];

// ============================================================================
// Atmosphere / Mood
// ============================================================================

export const MOOD_PRESETS: PresetOption[] = [
  { value: 'professional', label: 'Professional / Corporate' },
  { value: 'energetic', label: 'Energetic / Exciting' },
  { value: 'calm', label: 'Calm / Peaceful' },
  { value: 'dramatic', label: 'Dramatic / Intense' },
  { value: 'warm', label: 'Warm / Friendly' },
  { value: 'cool-modern', label: 'Cool / Modern' },
  { value: 'dark-moody', label: 'Dark / Mysterious' },
  { value: 'playful', label: 'Playful / Fun' },
  { value: 'inspirational', label: 'Inspirational / Uplifting' },
  { value: 'luxurious', label: 'Luxurious / Premium' },
  { value: 'casual', label: 'Casual / Relaxed' },
  { value: 'urgent', label: 'Urgent / Action-oriented' },
  { value: 'nostalgic', label: 'Nostalgic / Retro' },
  { value: 'futuristic', label: 'Futuristic / Tech' },
  { value: 'other', label: 'Other (custom)' },
];

// ============================================================================
// Helpers
// ============================================================================

/** Get the display label for a preset value, or return the raw value if custom */
export function getPresetLabel(presets: PresetOption[], value: string): string {
  const match = presets.find((p) => p.value === value);
  return match ? match.label : value;
}
