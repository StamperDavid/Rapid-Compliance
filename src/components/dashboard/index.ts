/**
 * Unified Dashboard Components
 * Export barrel for easier imports
 */

export { default as UnifiedSidebar } from './UnifiedSidebar';
export { UNIFIED_NAVIGATION, getNavigationSection, getNavigationByCategory } from './navigation-config';

// Re-export types from unified-rbac for convenience
export type {
  UnifiedUser,
  AccountRole,
  NavigationSection,
  NavigationItem,
  NavigationStructure,
  NavigationCategory,
} from '@/types/unified-rbac';
