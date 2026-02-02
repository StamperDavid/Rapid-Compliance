/**
 * Single-Tenant Navigation Configuration
 * Rapid Compliance - Single Company Model
 *
 * NAVIGATION STRUCTURE:
 * - Dashboard: Main overview and metrics
 * - Lead Pipeline: Lead management and CRM
 * - Agent Swarm: AI agent orchestration
 * - Social Media: Social media management
 * - Company Settings: Organization configuration
 */

import {
  LayoutDashboard,
  Target,
  Bot,
  Share2,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { NavigationSection, AccountRole } from '@/types/unified-rbac';

// =============================================================================
// ROUTE BUILDERS - Single-tenant workspace routes
// =============================================================================

/**
 * Workspace route builders
 * Use :orgId placeholder - replaced at render time with DEFAULT_ORG_ID
 */
const ws = {
  dashboard: '/workspace/:orgId/dashboard',
  leads: '/workspace/:orgId/leads',
  swarm: '/workspace/:orgId/swarm',
  social: '/workspace/:orgId/social/campaigns',
  settings: '/workspace/:orgId/settings',
} as const;

// =============================================================================
// ROLE GROUPS
// =============================================================================

/** All roles can access */
const ALL_ROLES: AccountRole[] = ['superadmin', 'admin', 'manager', 'employee'];

/** Admin+ roles (admin and superadmin) */
const ADMIN_PLUS: AccountRole[] = ['superadmin', 'admin'];

// =============================================================================
// SINGLE-TENANT NAVIGATION SECTIONS
// =============================================================================

/**
 * Clean, single-tenant navigation
 * ONLY contains: Dashboard, Lead Pipeline, Agent Swarm, Social Media, Company Settings
 */
export const NAVIGATION_SECTIONS: NavigationSection[] = [
  // =========================================================================
  // 1. DASHBOARD
  // =========================================================================
  {
    id: 'command_center',
    label: 'Dashboard',
    icon: LayoutDashboard as LucideIcon,
    iconColor: '#6366f1', // Indigo
    allowedRoles: ALL_ROLES,
    collapsible: false,
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: ws.dashboard,
        icon: LayoutDashboard as LucideIcon,
        iconColor: '#6366f1', // Indigo
      },
    ],
  },

  // =========================================================================
  // 2. LEAD PIPELINE
  // =========================================================================
  {
    id: 'crm',
    label: 'Lead Pipeline',
    icon: Target as LucideIcon,
    iconColor: '#ef4444', // Red
    allowedRoles: ALL_ROLES,
    collapsible: false,
    items: [
      {
        id: 'leads',
        label: 'Lead Pipeline',
        href: ws.leads,
        icon: Target as LucideIcon,
        iconColor: '#ef4444', // Red
        requiredPermission: 'canViewLeads',
      },
    ],
  },

  // =========================================================================
  // 3. AGENT SWARM
  // =========================================================================
  {
    id: 'ai_workforce',
    label: 'Agent Swarm',
    icon: Bot as LucideIcon,
    iconColor: '#06b6d4', // Cyan
    allowedRoles: ADMIN_PLUS,
    collapsible: false,
    items: [
      {
        id: 'swarm',
        label: 'Agent Swarm',
        href: ws.swarm,
        icon: Bot as LucideIcon,
        iconColor: '#06b6d4', // Cyan
        requiredPermission: 'canAccessSwarmPanel',
      },
    ],
  },

  // =========================================================================
  // 4. SOCIAL MEDIA
  // =========================================================================
  {
    id: 'content_factory',
    label: 'Social Media',
    icon: Share2 as LucideIcon,
    iconColor: '#3b82f6', // Blue
    allowedRoles: ALL_ROLES,
    collapsible: false,
    items: [
      {
        id: 'social-media',
        label: 'Social Media',
        href: ws.social,
        icon: Share2 as LucideIcon,
        iconColor: '#3b82f6', // Blue
        requiredPermission: 'canManageSocialMedia',
      },
    ],
  },

  // =========================================================================
  // 5. COMPANY SETTINGS
  // =========================================================================
  {
    id: 'settings',
    label: 'Company Settings',
    icon: Settings as LucideIcon,
    iconColor: '#64748b', // Slate
    allowedRoles: ADMIN_PLUS,
    collapsible: false,
    items: [
      {
        id: 'company-settings',
        label: 'Company Settings',
        href: ws.settings,
        icon: Settings as LucideIcon,
        iconColor: '#64748b', // Slate
        requiredPermission: 'canManageOrganization',
      },
    ],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get navigation sections for a specific role
 * Single-tenant: no admin context, no platform admin sections
 *
 * @param role - The user's account role
 * @returns Navigation sections appropriate for the role
 */
export function getNavigationForRole(role: AccountRole): NavigationSection[] {
  return NAVIGATION_SECTIONS.filter(section =>
    section.allowedRoles.includes(role)
  );
}

/**
 * Helper to get a specific section by ID
 */
export function getNavigationSection(sectionId: string): NavigationSection | undefined {
  return NAVIGATION_SECTIONS.find((section) => section.id === sectionId);
}

/**
 * Helper to replace :orgId placeholder with actual organization ID
 * Call this when rendering navigation items
 */
export function resolveWorkspaceRoute(href: string, orgId: string): string {
  return href.replace(':orgId', orgId);
}

/**
 * Get navigation with resolved workspace routes for a specific role
 */
export function getResolvedNavigation(orgId: string, role: AccountRole) {
  const sections = getNavigationForRole(role);

  return {
    sections: sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        href: resolveWorkspaceRoute(item.href, orgId),
        children: item.children?.map((child) => ({
          ...child,
          href: resolveWorkspaceRoute(child.href, orgId),
        })),
      })),
    })),
  };
}

/**
 * Get section count
 */
export function getSectionCount(): number {
  return NAVIGATION_SECTIONS.length;
}

// Legacy exports for backward compatibility (deprecated)
/** @deprecated Use NAVIGATION_SECTIONS instead */
export const CLIENT_SECTIONS = NAVIGATION_SECTIONS;
/** @deprecated No longer used in single-tenant model */
export type AdminNavigationContext = never;
