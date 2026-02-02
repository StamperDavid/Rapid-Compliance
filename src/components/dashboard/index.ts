/**
 * Unified Dashboard Components
 * Export barrel for easier imports
 */

export { default as UnifiedSidebar } from './UnifiedSidebar';
export { NAVIGATION_SECTIONS, getNavigationSection, getNavigationForRole } from './navigation-config';

// Re-export types from unified-rbac for convenience
export type {
  UnifiedUser,
  AccountRole,
  NavigationSection,
  NavigationItem,
  NavigationStructure,
  NavigationCategory,
} from '@/types/unified-rbac';
