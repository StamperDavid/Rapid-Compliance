# Unified Sidebar Components

This directory contains the unified sidebar implementation for the Command Center unification project.

## Overview

The unified sidebar replaces two separate sidebars:
1. `src/components/admin/CommandCenterSidebar.tsx` (Platform Admin)
2. Inline sidebar in `src/app/workspace/[orgId]/layout.tsx` (Tenant Users)

## Components

### UnifiedSidebar.tsx

Main sidebar component that adapts based on `user.role` from the unified RBAC system.

**Features:**
- Role-based section visibility
- Collapsible/Expandable state (280px expanded, 64px collapsed)
- Mobile responsive with hamburger menu
- User profile display with avatar
- Active route highlighting
- Badge support for notifications
- Smooth transitions and animations

**Props:**
```typescript
interface UnifiedSidebarProps {
  user: UnifiedUser;              // Current user with unified role
  organizationId?: string;        // Organization ID for URL context
  isCollapsed?: boolean;          // External collapsed state
  onToggleCollapse?: () => void;  // External collapse handler
  brandName?: string;             // Custom brand name
  primaryColor?: string;          // Custom primary color
}
```

**Usage:**
```tsx
import UnifiedSidebar from '@/components/dashboard/UnifiedSidebar';
import type { UnifiedUser } from '@/types/unified-rbac';

export default function DashboardLayout({ children }) {
  const user: UnifiedUser = {
    id: 'user-123',
    email: 'user@example.com',
    displayName: 'John Doe',
    role: 'admin',
    tenantId: 'org-123',
    status: 'active',
    mfaEnabled: false,
  };

  return (
    <div className="flex">
      <UnifiedSidebar
        user={user}
        organizationId="org-123"
        brandName="My Company"
        primaryColor="#6366f1"
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

### navigation-config.ts

Defines the complete navigation structure with all sections and items.

**Structure:**
```typescript
export const UNIFIED_NAVIGATION: NavigationStructure = {
  sections: [
    {
      id: 'system',           // Platform admin only
      label: 'System',
      icon: Wrench,
      allowedRoles: ['platform_admin'],
      items: [...],
    },
    {
      id: 'dashboard',        // All roles
      label: 'Dashboard',
      icon: LayoutDashboard,
      allowedRoles: ['platform_admin', 'owner', 'admin', 'manager', 'employee'],
      items: [...],
    },
    // ... more sections
  ],
};
```

**Navigation Items:**
Each item can specify a `requiredPermission` that maps to `UnifiedPermissions`:

```typescript
{
  id: 'system-health',
  label: 'System Health',
  href: '/admin/system/health',
  icon: Activity,
  requiredPermission: 'canViewSystemHealth',
}
```

## Section Visibility by Role

| Section    | platform_admin | owner | admin | manager | employee |
|------------|----------------|-------|-------|---------|----------|
| System     | ✓              |       |       |         |          |
| Dashboard  | ✓              | ✓     | ✓     | ✓       | ✓        |
| Sales      | ✓              | ✓     | ✓     | ✓       | ✓        |
| Marketing  | ✓              | ✓     | ✓     | ✓       |          |
| Swarm      | ✓              | ✓     | ✓     |         |          |
| Analytics  | ✓              | ✓     | ✓     | ✓       | ✓        |
| Settings   | ✓              | ✓     | ✓     |         |          |

## Permission-Based Filtering

The sidebar uses `filterNavigationByRole()` from `@/types/unified-rbac` to automatically filter sections and items based on the user's role and permissions.

**Example:**
```typescript
import { filterNavigationByRole } from '@/types/unified-rbac';
import { UNIFIED_NAVIGATION } from './navigation-config';

const filteredSections = filterNavigationByRole(
  UNIFIED_NAVIGATION.sections,
  user.role
);
```

## Adding New Navigation Items

1. **Add permission to unified-rbac.ts** (if needed):
```typescript
export interface UnifiedPermissions {
  // ... existing permissions
  canManageNewFeature: boolean;
}
```

2. **Update UNIFIED_ROLE_PERMISSIONS** for each role

3. **Add navigation item to navigation-config.ts**:
```typescript
{
  id: 'new-feature',
  label: 'New Feature',
  href: '/new-feature',
  icon: Star,
  requiredPermission: 'canManageNewFeature',
}
```

## Styling

The sidebar uses CSS custom properties for theming:
- `--color-bg-paper`: Main background
- `--color-bg-elevated`: Elevated surface (header, footer)
- `--color-border-light`: Borders
- `--color-text-primary`: Primary text
- `--color-text-secondary`: Secondary text
- `--color-text-disabled`: Disabled text
- `--color-primary`: Primary brand color
- `--color-accent`: Accent color

## Mobile Behavior

- Desktop (≥768px): Always visible, collapsible
- Mobile (<768px): Hidden by default, opens as overlay
- FAB toggle button in bottom-right corner
- Backdrop overlay when open
- Closes on navigation

## TypeScript

All components use strict TypeScript with no `any` types:
- `UnifiedUser` from unified-rbac.ts
- `NavigationSection` and `NavigationItem` interfaces
- Proper typing for all props and state
- Type-safe permission checks

## ESLint Compliance

- No duplicate imports
- Nullish coalescing operators (`??`) instead of logical OR (`||`)
- Proper displayName for React.memo components
- No console statements in production code
