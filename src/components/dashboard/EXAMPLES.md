# UnifiedSidebar Examples

This document shows how the UnifiedSidebar component adapts for different user roles.

## Example 1: Platform Admin

```tsx
const platformAdminUser: UnifiedUser = {
  id: 'admin-001',
  email: 'admin@platform.com',
  displayName: 'Platform Admin',
  role: 'platform_admin',
  tenantId: null,
  status: 'active',
  mfaEnabled: true,
};

<UnifiedSidebar
  user={platformAdminUser}
  brandName="AI Sales Platform"
  primaryColor="#6366f1"
/>
```

**Visible Sections:**
- ✅ System (Health, Organizations, Users, Feature Flags, Audit Logs, Settings)
- ✅ Dashboard (Overview, Analytics)
- ✅ Sales (Leads, Deals, Voice Agents, AI Sales Agent)
- ✅ Marketing (Social Media, Email Campaigns, Email Templates, Website)
- ✅ AI Swarm (Swarm Control, Agent Training, Agent Persona, Knowledge Base)
- ✅ Analytics (Reports, Revenue, Pipeline, Platform Analytics)
- ✅ Settings (Organization, Team, API Keys, Integrations, Billing, E-Commerce, Products)

**Special Features:**
- Role badge shows "Platform Admin" in primary color
- Footer shows "Platform View"
- Can see platform-wide analytics

---

## Example 2: Organization Owner

```tsx
const ownerUser: UnifiedUser = {
  id: 'owner-001',
  email: 'owner@company.com',
  displayName: 'John Smith',
  role: 'owner',
  tenantId: 'org-acme-corp',
  status: 'active',
  mfaEnabled: true,
  avatarUrl: 'https://example.com/avatar.jpg',
};

<UnifiedSidebar
  user={ownerUser}
  organizationId="org-acme-corp"
  brandName="Acme Corp"
  primaryColor="#10b981"
/>
```

**Visible Sections:**
- ❌ System (Hidden - platform admin only)
- ✅ Dashboard (Overview, Analytics)
- ✅ Sales (Leads, Deals, Voice Agents, AI Sales Agent)
- ✅ Marketing (Social Media, Email Campaigns, Email Templates, Website)
- ✅ AI Swarm (Swarm Control, Agent Training, Agent Persona, Knowledge Base)
- ✅ Analytics (Reports, Revenue, Pipeline)
- ✅ Settings (Organization, Team, API Keys, Integrations, Billing, E-Commerce, Products)

**Special Features:**
- Role badge shows "Owner"
- Footer shows "Org: org-acme..."
- Full access to all tenant features including billing

---

## Example 3: Admin

```tsx
const adminUser: UnifiedUser = {
  id: 'admin-001',
  email: 'admin@company.com',
  displayName: 'Jane Doe',
  role: 'admin',
  tenantId: 'org-acme-corp',
  status: 'active',
  mfaEnabled: false,
};

<UnifiedSidebar
  user={adminUser}
  organizationId="org-acme-corp"
  brandName="Acme Corp"
  primaryColor="#10b981"
/>
```

**Visible Sections:**
- ❌ System (Hidden - platform admin only)
- ✅ Dashboard (Overview, Analytics)
- ✅ Sales (Leads, Deals, Voice Agents, AI Sales Agent)
- ✅ Marketing (Social Media, Email Campaigns, Email Templates, Website)
- ✅ AI Swarm (Swarm Control, Agent Training, Agent Persona, Knowledge Base)
- ✅ Analytics (Reports, Revenue, Pipeline)
- ✅ Settings (Organization, Team, API Keys, Integrations, E-Commerce, Products)
  - ❌ Billing (Hidden - owner only)

**Differences from Owner:**
- Cannot manage billing
- Cannot delete organization
- Otherwise has full access

---

## Example 4: Manager

```tsx
const managerUser: UnifiedUser = {
  id: 'manager-001',
  email: 'manager@company.com',
  displayName: 'Bob Wilson',
  role: 'manager',
  tenantId: 'org-acme-corp',
  status: 'active',
  mfaEnabled: false,
};

<UnifiedSidebar
  user={managerUser}
  organizationId="org-acme-corp"
  brandName="Acme Corp"
  primaryColor="#10b981"
/>
```

**Visible Sections:**
- ❌ System (Hidden)
- ✅ Dashboard (Overview, Analytics)
- ✅ Sales (Leads, Deals, Voice Agents, AI Sales Agent)
- ✅ Marketing (Social Media, Email Campaigns, Email Templates)
  - ❌ Website (Hidden - admin+ only)
- ❌ AI Swarm (Hidden - admin+ only)
- ✅ Analytics (Reports, Revenue, Pipeline)
- ❌ Settings (Hidden - admin+ only)

**Team-Level Access:**
- Can manage leads and deals
- Can run email campaigns
- Can view all reports
- Cannot access AI Swarm or system settings

---

## Example 5: Employee

```tsx
const employeeUser: UnifiedUser = {
  id: 'employee-001',
  email: 'employee@company.com',
  displayName: 'Alice Johnson',
  role: 'employee',
  tenantId: 'org-acme-corp',
  status: 'active',
  mfaEnabled: false,
};

<UnifiedSidebar
  user={employeeUser}
  organizationId="org-acme-corp"
  brandName="Acme Corp"
  primaryColor="#10b981"
/>
```

**Visible Sections:**
- ❌ System (Hidden)
- ✅ Dashboard (Overview, Analytics)
- ✅ Sales (Leads, Deals)
  - ❌ Voice Agents (Hidden - manager+ only)
  - ❌ AI Sales Agent (Hidden - manager+ only)
- ❌ Marketing (Hidden - manager+ only)
- ❌ AI Swarm (Hidden - admin+ only)
- ✅ Analytics (Reports, Revenue, Pipeline)
- ❌ Settings (Hidden - admin+ only)

**Individual Contributor Access:**
- Can view leads and deals (own records only)
- Can view reports
- Cannot manage campaigns or settings
- Limited to operational tasks

---

## Example 6: With Custom Branding

```tsx
const customUser: UnifiedUser = {
  id: 'owner-002',
  email: 'owner@retailshop.com',
  displayName: 'Mike Chen',
  role: 'owner',
  tenantId: 'org-retail-shop',
  status: 'active',
  mfaEnabled: true,
  avatarUrl: 'https://example.com/mike.jpg',
};

<UnifiedSidebar
  user={customUser}
  organizationId="org-retail-shop"
  brandName="Retail Shop Pro"
  primaryColor="#f59e0b"  // Orange theme
/>
```

**Branding Applied:**
- Brand name: "Retail Shop Pro"
- Primary color: Orange (#f59e0b)
- User avatar displayed
- Custom organization context

---

## Example 7: Collapsed State

```tsx
const [collapsed, setCollapsed] = useState(false);

<UnifiedSidebar
  user={adminUser}
  organizationId="org-acme-corp"
  isCollapsed={collapsed}
  onToggleCollapse={() => setCollapsed(!collapsed)}
  brandName="Acme Corp"
/>
```

**Collapsed View (64px width):**
- Only icons visible
- Tooltips on hover
- User avatar only (no name)
- Collapse/expand button centered

**Expanded View (280px width):**
- Icons + labels
- User info with avatar and name
- Section headers
- Badge counts visible

---

## Example 8: Mobile Responsive

```tsx
// Mobile automatically handled - no props needed

<UnifiedSidebar
  user={managerUser}
  organizationId="org-acme-corp"
  brandName="Acme Corp"
/>
```

**Mobile Behavior (< 768px):**
- Sidebar hidden by default
- FAB button in bottom-right corner
- Opens as full-screen overlay
- Backdrop closes sidebar
- Close button (X) in header

**Desktop Behavior (≥ 768px):**
- Sidebar always visible
- No FAB button
- No backdrop
- Collapse/expand inline

---

## Example 9: With Notification Badges

```tsx
// Add badges to navigation items in navigation-config.ts

{
  id: 'leads',
  label: 'Leads',
  href: '/sales/leads',
  icon: Target,
  requiredPermission: 'canViewLeads',
  badge: 5,  // 5 new leads
}
```

**Badge Display:**
- Red pill with white text
- Shows count next to label
- Hidden in collapsed state
- Only visible when expanded

---

## Example 10: Integration with Layout

```tsx
'use client';

import { useState } from 'react';
import UnifiedSidebar from '@/components/dashboard/UnifiedSidebar';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { theme } = useOrgTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!user) return <div>Loading...</div>;

  return (
    <div className="flex min-h-screen">
      <UnifiedSidebar
        user={user}
        organizationId={user.tenantId ?? undefined}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        brandName={theme?.branding?.companyName ?? 'AI Sales Platform'}
        primaryColor={theme?.colors?.primary?.main ?? '#6366f1'}
      />
      <main
        className="flex-1 overflow-y-auto"
        style={{
          marginLeft: sidebarCollapsed ? '64px' : '280px',
          transition: 'margin-left 300ms',
        }}
      >
        {children}
      </main>
    </div>
  );
}
```

---

## Testing Different Roles

To test different roles, update the user object:

```tsx
// Test as Platform Admin
const testUser: UnifiedUser = { ...baseUser, role: 'platform_admin', tenantId: null };

// Test as Owner
const testUser: UnifiedUser = { ...baseUser, role: 'owner', tenantId: 'org-123' };

// Test as Admin
const testUser: UnifiedUser = { ...baseUser, role: 'admin', tenantId: 'org-123' };

// Test as Manager
const testUser: UnifiedUser = { ...baseUser, role: 'manager', tenantId: 'org-123' };

// Test as Employee
const testUser: UnifiedUser = { ...baseUser, role: 'employee', tenantId: 'org-123' };
```

Each role will show different sections automatically via `filterNavigationByRole()`.
