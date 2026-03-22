/**
 * Background Music Library — Curated royalty-free tracks for video assembly.
 *
 * Tracks are defined here as metadata. The actual audio files are expected
 * to live in Firebase Storage at a known path and are referenced by URL
 * when the user selects them.
 *
 * For now, the URLs point to placeholder paths in Firebase Storage.
 * Upload actual royalty-free tracks to match these paths before going live.
 *
 * Categories: upbeat, corporate, chill, dramatic, inspirational, ambient
 */

export type MusicCategory = 'upbeat' | 'corporate' | 'chill' | 'dramatic' | 'inspirational' | 'ambient';

export interface MusicTrack {
  id: string;
  name: string;
  category: MusicCategory;
  durationSeconds: number;
  bpm: number;
  description: string;
  /** Firebase Storage path — resolved to a signed URL at runtime */
  storagePath: string;
}

export const MUSIC_CATEGORY_LABELS: Record<MusicCategory, string> = {
  upbeat: 'Upbeat',
  corporate: 'Corporate',
  chill: 'Chill',
  dramatic: 'Dramatic',
  inspirational: 'Inspirational',
  ambient: 'Ambient',
};

const MUSIC_TRACKS: MusicTrack[] = [
  // Upbeat
  {
    id: 'music-upbeat-drive',
    name: 'Drive Forward',
    category: 'upbeat',
    durationSeconds: 60,
    bpm: 120,
    description: 'Energetic, positive, great for product demos',
    storagePath: 'music/upbeat-drive.mp3',
  },
  {
    id: 'music-upbeat-spark',
    name: 'Creative Spark',
    category: 'upbeat',
    durationSeconds: 60,
    bpm: 128,
    description: 'Fun and playful, ideal for social ads',
    storagePath: 'music/upbeat-spark.mp3',
  },
  // Corporate
  {
    id: 'music-corporate-horizon',
    name: 'New Horizon',
    category: 'corporate',
    durationSeconds: 60,
    bpm: 100,
    description: 'Professional, clean, suited for business presentations',
    storagePath: 'music/corporate-horizon.mp3',
  },
  {
    id: 'music-corporate-clarity',
    name: 'Clear Vision',
    category: 'corporate',
    durationSeconds: 60,
    bpm: 95,
    description: 'Polished and modern, perfect for quarterly updates',
    storagePath: 'music/corporate-clarity.mp3',
  },
  {
    id: 'music-corporate-progress',
    name: 'Steady Progress',
    category: 'corporate',
    durationSeconds: 60,
    bpm: 105,
    description: 'Confident and forward-moving',
    storagePath: 'music/corporate-progress.mp3',
  },
  // Chill
  {
    id: 'music-chill-drift',
    name: 'Gentle Drift',
    category: 'chill',
    durationSeconds: 60,
    bpm: 85,
    description: 'Relaxed lo-fi vibes, great for testimonials',
    storagePath: 'music/chill-drift.mp3',
  },
  {
    id: 'music-chill-breeze',
    name: 'Afternoon Breeze',
    category: 'chill',
    durationSeconds: 60,
    bpm: 80,
    description: 'Soft and warm, keeps focus on the speaker',
    storagePath: 'music/chill-breeze.mp3',
  },
  // Dramatic
  {
    id: 'music-dramatic-rise',
    name: 'The Rise',
    category: 'dramatic',
    durationSeconds: 60,
    bpm: 90,
    description: 'Building tension, cinematic impact',
    storagePath: 'music/dramatic-rise.mp3',
  },
  {
    id: 'music-dramatic-epic',
    name: 'Epic Moment',
    category: 'dramatic',
    durationSeconds: 60,
    bpm: 110,
    description: 'Grand, powerful, suitable for announcements',
    storagePath: 'music/dramatic-epic.mp3',
  },
  // Inspirational
  {
    id: 'music-inspire-hope',
    name: 'Seeds of Hope',
    category: 'inspirational',
    durationSeconds: 60,
    bpm: 92,
    description: 'Uplifting piano-driven, perfect for case studies',
    storagePath: 'music/inspire-hope.mp3',
  },
  {
    id: 'music-inspire-journey',
    name: 'The Journey',
    category: 'inspirational',
    durationSeconds: 60,
    bpm: 98,
    description: 'Motivational with a building crescendo',
    storagePath: 'music/inspire-journey.mp3',
  },
  {
    id: 'music-inspire-dawn',
    name: 'New Dawn',
    category: 'inspirational',
    durationSeconds: 60,
    bpm: 88,
    description: 'Optimistic and warm, good for company culture videos',
    storagePath: 'music/inspire-dawn.mp3',
  },
  // Ambient
  {
    id: 'music-ambient-space',
    name: 'Open Space',
    category: 'ambient',
    durationSeconds: 60,
    bpm: 70,
    description: 'Atmospheric pad, barely noticeable backdrop',
    storagePath: 'music/ambient-space.mp3',
  },
  {
    id: 'music-ambient-focus',
    name: 'Deep Focus',
    category: 'ambient',
    durationSeconds: 60,
    bpm: 65,
    description: 'Minimal texture, lets the voice dominate',
    storagePath: 'music/ambient-focus.mp3',
  },
  {
    id: 'music-ambient-night',
    name: 'Night Sky',
    category: 'ambient',
    durationSeconds: 60,
    bpm: 72,
    description: 'Ethereal and calm, perfect for reflective content',
    storagePath: 'music/ambient-night.mp3',
  },
];

/** Get all available background music tracks. */
export function getMusicTracks(): MusicTrack[] {
  return MUSIC_TRACKS;
}

/** Get tracks filtered by category. */
export function getMusicTracksByCategory(category: MusicCategory): MusicTrack[] {
  return MUSIC_TRACKS.filter((t) => t.category === category);
}

/** Find a track by ID. */
export function getMusicTrackById(id: string): MusicTrack | undefined {
  return MUSIC_TRACKS.find((t) => t.id === id);
}
