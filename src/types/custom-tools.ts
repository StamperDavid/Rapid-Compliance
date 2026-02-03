/**
 * Custom Tools Types
 *
 * Organizations can add custom tools/apps that appear in their sidebar.
 * These tools are rendered as sandboxed iframes pointing to external URLs.
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Custom Tool configuration
 * Represents an external app/tool that can be embedded in the workspace sidebar
 */
export interface CustomTool {
  id: string;
  name: string;
  description?: string;
  icon: string; // emoji or lucide icon name (e.g., "Wrench", "Calculator", or emoji)
  url: string; // external URL to embed (must be https)
  enabled: boolean;
  order: number;
  allowedRoles?: string[]; // roles that can see this tool (empty = all roles)
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy?: string; // userId who created this tool
}

/**
 * Form data for creating/editing a custom tool
 */
export interface CustomToolFormData {
  name: string;
  description?: string;
  icon: string;
  url: string;
  enabled: boolean;
  allowedRoles?: string[];
}

/**
 * Validation result for custom tool URLs
 */
export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a custom tool URL for security
 * - Must be HTTPS (no HTTP or javascript:)
 * - Must be a valid URL format
 */
export function validateToolUrl(url: string): UrlValidationResult {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'URL is required' };
  }

  // Trim whitespace
  const trimmedUrl = url.trim();

  // Check for javascript: protocol (security risk)
  if (trimmedUrl.toLowerCase().startsWith('javascript:')) {
    return { valid: false, error: 'JavaScript URLs are not allowed' };
  }

  // Check for data: protocol (security risk)
  if (trimmedUrl.toLowerCase().startsWith('data:')) {
    return { valid: false, error: 'Data URLs are not allowed' };
  }

  // Require HTTPS for security
  if (!trimmedUrl.toLowerCase().startsWith('https://')) {
    return { valid: false, error: 'Only HTTPS URLs are allowed' };
  }

  // Validate URL format
  try {
    const parsedUrl = new URL(trimmedUrl);

    // Additional validation - must have a hostname
    if (!parsedUrl.hostname) {
      return { valid: false, error: 'Invalid URL format' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * List of common lucide icon names for the icon picker
 */
export const COMMON_TOOL_ICONS = [
  // Tools & Utilities
  'Wrench',
  'Settings',
  'Calculator',
  'Terminal',
  'Code',
  'Database',
  'Server',
  'Cloud',
  'Globe',
  'Link',
  // Communication
  'MessageSquare',
  'Mail',
  'Phone',
  'Video',
  'Users',
  // Files & Documents
  'FileText',
  'FolderOpen',
  'Image',
  'FileSpreadsheet',
  'FileCode',
  // Analytics & Charts
  'BarChart',
  'LineChart',
  'PieChart',
  'TrendingUp',
  'Activity',
  // Business
  'Briefcase',
  'DollarSign',
  'CreditCard',
  'ShoppingCart',
  'Package',
  // Other
  'Zap',
  'Star',
  'Heart',
  'Bookmark',
  'Clock',
] as const;

/**
 * Common emoji icons for custom tools
 */
export const COMMON_EMOJI_ICONS = [
  '🔧', '⚙️', '🧮', '💻', '📊',
  '📈', '📉', '📋', '📝', '📁',
  '💼', '💰', '🛒', '📦', '🔗',
  '🌐', '☁️', '🗄️', '🔌', '⚡',
  '💬', '📧', '📞', '🎥', '👥',
  '🎯', '🚀', '⭐', '❤️', '🔖',
] as const;
