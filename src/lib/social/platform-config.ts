/**
 * Social Platform Configuration — Single Source of Truth
 * All platform metadata (labels, icons, colors, character limits) lives here.
 * Every UI component and service should import from this file.
 *
 * @module social/platform-config
 */

import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';

// ─── Platform Metadata ──────────────────────────────────────────────────────

export interface PlatformMeta {
  label: string;
  icon: string;        // Short text/emoji icon for compact display
  emoji: string;       // Emoji for badges/notifications
  color: string;       // Primary brand hex color
  tailwind: string;    // Tailwind border/bg/text for unselected state
  tailwindSelected: string; // Tailwind classes for selected state
  charLimit: number;   // Max characters per post (0 = no text limit)
}

export const PLATFORM_META: Record<SocialPlatform, PlatformMeta> = {
  twitter: {
    label: 'Twitter / X',
    icon: '𝕏',
    emoji: '🐦',
    color: '#000000',
    tailwind: 'border-zinc-500 bg-zinc-900 text-white',
    tailwindSelected: 'border-zinc-400 bg-zinc-800 ring-2 ring-zinc-500',
    charLimit: 280,
  },
  linkedin: {
    label: 'LinkedIn',
    icon: 'in',
    emoji: '💼',
    color: '#0A66C2',
    tailwind: 'border-blue-600 bg-blue-950 text-blue-400',
    tailwindSelected: 'border-blue-500 bg-blue-900 ring-2 ring-blue-500',
    charLimit: 3000,
  },
  facebook: {
    label: 'Facebook',
    icon: 'f',
    emoji: '👤',
    color: '#1877F2',
    tailwind: 'border-blue-500 bg-blue-950 text-blue-400',
    tailwindSelected: 'border-blue-400 bg-blue-900 ring-2 ring-blue-400',
    charLimit: 63206,
  },
  instagram: {
    label: 'Instagram',
    icon: '📷',
    emoji: '📷',
    color: '#E1306C',
    tailwind: 'border-pink-500 bg-pink-950 text-pink-400',
    tailwindSelected: 'border-pink-400 bg-pink-900 ring-2 ring-pink-400',
    charLimit: 2200,
  },
  youtube: {
    label: 'YouTube',
    icon: '▶',
    emoji: '▶️',
    color: '#FF0000',
    tailwind: 'border-red-500 bg-red-950 text-red-400',
    tailwindSelected: 'border-red-400 bg-red-900 ring-2 ring-red-400',
    charLimit: 5000,
  },
  tiktok: {
    label: 'TikTok',
    icon: '♪',
    emoji: '🎵',
    color: '#00F2EA',
    tailwind: 'border-cyan-400 bg-cyan-950 text-cyan-400',
    tailwindSelected: 'border-cyan-300 bg-cyan-900 ring-2 ring-cyan-300',
    charLimit: 2200,
  },
  bluesky: {
    label: 'Bluesky',
    icon: '🦋',
    emoji: '🦋',
    color: '#0085FF',
    tailwind: 'border-sky-500 bg-sky-950 text-sky-400',
    tailwindSelected: 'border-sky-400 bg-sky-900 ring-2 ring-sky-400',
    charLimit: 300,
  },
  threads: {
    label: 'Threads',
    icon: '@',
    emoji: '🧵',
    color: '#000000',
    tailwind: 'border-zinc-500 bg-zinc-900 text-zinc-300',
    tailwindSelected: 'border-zinc-400 bg-zinc-800 ring-2 ring-zinc-400',
    charLimit: 500,
  },
  truth_social: {
    label: 'Truth Social',
    icon: 'T',
    emoji: '🗽',
    color: '#5448EE',
    tailwind: 'border-indigo-500 bg-indigo-950 text-indigo-400',
    tailwindSelected: 'border-indigo-400 bg-indigo-900 ring-2 ring-indigo-400',
    charLimit: 500,
  },
  mastodon: {
    label: 'Mastodon',
    icon: 'M',
    emoji: '🐘',
    color: '#6364FF',
    tailwind: 'border-purple-500 bg-purple-950 text-purple-400',
    tailwindSelected: 'border-purple-400 bg-purple-900 ring-2 ring-purple-400',
    charLimit: 500,
  },
  telegram: {
    label: 'Telegram',
    icon: '✈',
    emoji: '✈️',
    color: '#26A5E4',
    tailwind: 'border-sky-400 bg-sky-950 text-sky-400',
    tailwindSelected: 'border-sky-300 bg-sky-900 ring-2 ring-sky-300',
    charLimit: 4096,
  },
  reddit: {
    label: 'Reddit',
    icon: 'R',
    emoji: '🤖',
    color: '#FF4500',
    tailwind: 'border-orange-500 bg-orange-950 text-orange-400',
    tailwindSelected: 'border-orange-400 bg-orange-900 ring-2 ring-orange-400',
    charLimit: 40000,
  },
  pinterest: {
    label: 'Pinterest',
    icon: 'P',
    emoji: '📌',
    color: '#E60023',
    tailwind: 'border-red-500 bg-red-950 text-red-400',
    tailwindSelected: 'border-red-400 bg-red-900 ring-2 ring-red-400',
    charLimit: 500,
  },
  whatsapp_business: {
    label: 'WhatsApp Business',
    icon: 'W',
    emoji: '💬',
    color: '#25D366',
    tailwind: 'border-green-500 bg-green-950 text-green-400',
    tailwindSelected: 'border-green-400 bg-green-900 ring-2 ring-green-400',
    charLimit: 4096,
  },
  google_business: {
    label: 'Google Business',
    icon: 'G',
    emoji: '📍',
    color: '#4285F4',
    tailwind: 'border-blue-500 bg-blue-950 text-blue-400',
    tailwindSelected: 'border-blue-400 bg-blue-900 ring-2 ring-blue-400',
    charLimit: 1500,
  },
};

// ─── Helper Functions ────────────────────────────────────────────────────────

export function getPlatformLabel(platform: SocialPlatform): string {
  return PLATFORM_META[platform].label;
}

export function getPlatformIcon(platform: SocialPlatform): string {
  return PLATFORM_META[platform].icon;
}

export function getPlatformEmoji(platform: SocialPlatform): string {
  return PLATFORM_META[platform].emoji;
}

export function getPlatformColor(platform: SocialPlatform): string {
  return PLATFORM_META[platform].color;
}

export function getPlatformCharLimit(platform: SocialPlatform): number {
  return PLATFORM_META[platform].charLimit;
}

/**
 * Build a Record<string, string> of platform colors for inline styles.
 * Useful for charts, badges, and legacy code that uses hex color maps.
 */
export function getPlatformColorMap(): Record<SocialPlatform, string> {
  const map = {} as Record<SocialPlatform, string>;
  for (const p of SOCIAL_PLATFORMS) {
    map[p] = PLATFORM_META[p].color;
  }
  return map;
}

/**
 * Build a Record<string, { bg: string; text: string }> for calendar event colors.
 */
export function getPlatformEventColors(): Record<SocialPlatform, { bg: string; text: string }> {
  const map = {} as Record<SocialPlatform, { bg: string; text: string }>;
  for (const p of SOCIAL_PLATFORMS) {
    map[p] = { bg: PLATFORM_META[p].color, text: '#ffffff' };
  }
  return map;
}

// Re-export for convenience
export { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
