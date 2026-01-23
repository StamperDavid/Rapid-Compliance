# Migration Guide: Unified Sidebar

This guide helps you migrate from the old dual-sidebar system to the new unified sidebar.

## Overview

**Before:** Two separate sidebars
- `CommandCenterSidebar.tsx` - Platform admin sidebar
- Inline sidebar in `workspace/[orgId]/layout.tsx` - Tenant user sidebar

**After:** One unified sidebar
- `UnifiedSidebar.tsx` - Single sidebar adapts to user role

## Step-by-Step Migration

### 1. Update User Data Structure

**Old (Admin):**
```typescript
interface AdminUser {
  displayName: string;
  role: string;
}
```

**Old (Workspace):**
```typescript
const { user } = useAuth();
// user.role was inconsistent
```

**New (Unified):**
```typescript
import type { UnifiedUser } from '@/types/unified-rbac';

const user: UnifiedUser = {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;        // 'platform_admin' | 'owner' | 'admin' | 'manager' | 'employee'
  tenantId: string | null;
  status: 'active' | 'suspended' | 'pending';
  mfaEnabled: boolean;
  avatarUrl?: string;
  workspaceId?: string;
};
```

### 2. Replace CommandCenterSidebar

**Old:**
```tsx
import CommandCenterSidebar from '@/components/admin/CommandCenterSidebar';

<CommandCenterSidebar
  organizationId={organizationId}
  adminUser={{ displayName: "Admin", role: "super_admin" }}
  isCollapsed={collapsed}
  onToggleCollapse={() => setCollapsed(!collapsed)}
/>
```

**New:**
```tsx
import UnifiedSidebar from '@/components/dashboard/UnifiedSidebar';
import type { UnifiedUser } from '@/types/unified-rbac';

const user: UnifiedUser = {
  id: adminUser.id,
  email: adminUser.email,
  displayName: adminUser.displayName,
  role: 'platform_admin',  // Mapped from old admin role
  tenantId: null,           // Platform admins have null tenant
  status: 'active',
  mfaEnabled: adminUser.mfaEnabled || false,
  avatarUrl: adminUser.avatarUrl,
};

<UnifiedSidebar
  user={user}
  organizationId={organizationId}
  isCollapsed={collapsed}
  onToggleCollapse={() => setCollapsed(!collapsed)}
  brandName="AI Sales Platform"
  primaryColor="#6366f1"
/>
```

### 3. Replace Workspace Layout Sidebar

**Old:**
```tsx
// Inline sidebar in layout.tsx
<aside className="...">
  {navSections.map((section) => (
    <div key={section.title}>
      <span>{section.title}</span>
      {section.items.map((item) => (
        <Link href={item.href}>
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  ))}
</aside>
```

**New:**
```tsx
import UnifiedSidebar from '@/components/dashboard/UnifiedSidebar';
import type { UnifiedUser } from '@/types/unified-rbac';

const user: UnifiedUser = {
  id: authUser.id,
  email: authUser.email,
  displayName: authUser.displayName,
  role: authUser.role,      // Already using AccountRole
  tenantId: orgId,
  status: 'active',
  mfaEnabled: authUser.mfaEnabled || false,
  avatarUrl: authUser.avatarUrl,
};

<UnifiedSidebar
  user={user}
  organizationId={orgId}
  brandName={theme?.branding?.companyName || "AI CRM"}
  primaryColor={theme?.colors?.primary?.main || "#6366f1"}
/>
```

### 4. Role Mapping

Map old roles to new unified roles:

**Admin System (CommandCenterSidebar):**
```typescript
const roleMapping = {
  'super_admin': 'platform_admin',
  'admin': 'platform_admin',
  'support': 'admin',
  'viewer': 'employee',
};
```

**Tenant System (Workspace):**
```typescript
// Already uses the correct AccountRole values
// 'owner' | 'admin' | 'manager' | 'employee'
// No mapping needed
```

### 5. Update Permission Checks

**Old:**
```typescript
if (user.role === 'super_admin') {
  // Show admin features
}
```

**New:**
```typescript
import { hasUnifiedPermission, isPlatformAdminRole } from '@/types/unified-rbac';

if (isPlatformAdminRole(user.role)) {
  // Show platform admin features
}

if (hasUnifiedPermission(user.role, 'canManageOrganization')) {
  // Show organization management
}
```

### 6. Update Navigation URLs

**Platform Admin URLs:**
- `/admin/command-center?org=${orgId}` → `/dashboard`
- `/admin/organizations?org=${orgId}` → `/admin/organizations`
- `/admin/system/health?org=${orgId}` → `/admin/system/health`

**Tenant URLs:**
- `/workspace/${orgId}/dashboard` → `/workspace/${orgId}/dashboard` (unchanged)
- Organization context automatically added by UnifiedSidebar

### 7. Custom Navigation Items

If you added custom items to the old sidebars, add them to `navigation-config.ts`:

```typescript
// In UNIFIED_NAVIGATION.sections, find appropriate section
{
  id: 'custom-feature',
  label: 'Custom Feature',
  href: '/custom-feature',
  icon: CustomIcon,
  requiredPermission: 'canAccessCustomFeature',
}
```

## Permission System Changes

### Old Permission Checks

**Admin System:**
```typescript
const canViewSystemHealth = adminUser.role === 'super_admin';
const canManageOrgs = ['super_admin', 'admin'].includes(adminUser.role);
```

**Tenant System:**
```typescript
const canInviteUsers = hasPermission(user, 'invite_users');
```

### New Unified Permission Checks

```typescript
import { hasUnifiedPermission, getUnifiedPermissions } from '@/types/unified-rbac';

// Single permission check
const canViewSystemHealth = hasUnifiedPermission(user.role, 'canViewSystemHealth');

// Multiple permissions
const permissions = getUnifiedPermissions(user.role);
if (permissions.canManageOrganization && permissions.canInviteUsers) {
  // User can do both
}
```

## Breaking Changes

1. **No more emoji icons** - All icons are now from `lucide-react`
2. **No "God Mode" link** - Role determines visibility naturally
3. **Consistent permission naming** - Use `canXxx` format
4. **tenantId is required** - All non-platform_admin users must have tenantId
5. **URL structure standardized** - Platform admin uses `/admin/*`, tenants use `/workspace/${orgId}/*`

## Testing Checklist

- [ ] Platform admin can see System section
- [ ] Tenant owner can see all sections except System
- [ ] Tenant admin cannot see billing
- [ ] Manager cannot see Settings section
- [ ] Employee can only see Dashboard, Sales, Analytics
- [ ] Active route highlighting works
- [ ] Collapsed state persists
- [ ] Mobile menu opens/closes correctly
- [ ] Permission checks work for all navigation items
- [ ] Organization context in URLs is correct

## Common Issues

### Issue: Navigation items not showing
**Cause:** Missing permission in role definition
**Fix:** Add permission to `UNIFIED_ROLE_PERMISSIONS` in `unified-rbac.ts`

### Issue: Wrong organization context in URLs
**Cause:** Hardcoded organization ID or missing organizationId prop
**Fix:** Pass `organizationId` to UnifiedSidebar, it will automatically inject it

### Issue: Sidebar not adapting to role changes
**Cause:** User object not updating
**Fix:** Ensure user prop is reactive and updates when role changes

### Issue: TypeScript errors on UnifiedUser
**Cause:** Missing required fields
**Fix:** Ensure all required fields are provided (id, email, displayName, role, tenantId, status, mfaEnabled)

## Support

For questions or issues:
1. Check the README.md in this directory
2. Review the unified-rbac.ts types file
3. Consult the @Architect for structural decisions
