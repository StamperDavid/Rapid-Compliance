# Navigation Structure - AI CRM Platform

## Overview
The entire application now uses a **consistent dark theme** with uniform navigation patterns. All pages are accessible through a logical, role-based structure.

---

## Page Hierarchy

### 1. **Root Entry Point** (`/`)
- **File**: `src/app/page.tsx`
- **Purpose**: Auto-redirects to `/crm`
- **Theme**: Black loading screen
- **User Experience**: Seamless redirect to main CRM interface

---

### 2. **Main CRM Interface** (`/crm`)
- **File**: `src/app/crm/page.tsx`
- **Purpose**: Primary interface for all users (employees, managers, admins)
- **Theme**: Dark theme (#000000 background)
- **Features**:
  - Left sidebar with all standard schemas (Leads, Companies, Contacts, Deals, Products, Quotes, Invoices, Orders, Tasks)
  - Top bar with search, filters, import CSV, and export
  - Data table with CRUD operations
  - AdminBar for admins/managers (hidden for employees)
- **Navigation**:
  - Sidebar links to `/crm?view={schema}` for each entity
  - AdminBar links to `/workspace/demo-org/settings` (admin only)
  - Logo in AdminBar links back to `/crm`

---

### 3. **Sales Dashboard** (`/dashboard`)
- **File**: `src/app/dashboard/page.tsx`
- **Purpose**: Sales performance overview for managers and admins
- **Theme**: Dark theme (#000000 background)
- **Features**:
  - Revenue stats, active deals, new leads, tasks due
  - Sales pipeline visualization
  - AI performance metrics
  - Recent activity feed
  - Today's tasks
  - Top performers leaderboard
  - Quick action buttons to CRM entities
- **Navigation**:
  - Sidebar with Dashboard (active) + all CRM entities
  - Links to specific CRM views (`/crm?view={entity}`)

---

### 4. **Settings Hub** (`/workspace/demo-org/settings`)
- **File**: `src/app/workspace/[orgId]/settings/page.tsx`
- **Purpose**: Admin settings and configuration (admin/owner only)
- **Theme**: Dark theme (#000000 background)
- **Features** (Permission-based):
  - **Core Configuration**: Organization, API Keys, Billing
  - **Customization**: Theme & Branding, Email Templates, Custom Domain
  - **Users & Access**: Team Members, Security, Notifications
  - **Integrations**: Integrations, Webhooks, API Access
  - **Advanced**: Schema Editor, Workflows, AI Agents
- **Navigation**:
  - Sidebar with "Back to CRM" + all entity links
  - Header link "← Back to CRM"
  - Each setting card links to specific setting page

#### 4a. **API Keys** (`/workspace/demo-org/settings/api-keys`)
- **File**: `src/app/workspace/[orgId]/settings/api-keys/page.tsx`
- **Theme**: Dark theme
- **Navigation**: "← Back to Settings" → `/workspace/demo-org/settings`

#### 4b. **Theme Editor** (`/workspace/demo-org/settings/theme`)
- **File**: `src/app/workspace/[orgId]/settings/theme/page.tsx`
- **Theme**: Dark theme
- **Features**: Live preview, color customization, typography, layout, branding (logo/favicon upload)
- **Navigation**: "← Back to Settings" → `/workspace/demo-org/settings`

---

### 5. **Schema Editor** (`/workspace/demo-org/schemas`)
- **File**: `src/app/workspace/[orgId]/schemas/page.tsx`
- **Purpose**: Create and manage custom data schemas (admin only)
- **Theme**: Dark theme (#000000 background)
- **Features**:
  - View existing schemas
  - Create new schemas with custom fields
  - Edit/delete schemas
  - View data for each schema
- **Navigation**:
  - Header: "← Back to Settings" → `/workspace/demo-org/settings`
  - Schema cards: "View Data" → `/workspace/demo-org/entities/{entityName}`

---

### 6. **Entity Data View** (`/workspace/demo-org/entities/[entityName]`)
- **File**: `src/app/workspace/[orgId]/entities/[entityName]/page.tsx`
- **Purpose**: View and edit data for custom schemas created in Schema Editor
- **Theme**: Dark theme (#000000 background)
- **Features**:
  - Data table with CRUD operations
  - Add/edit record modal
- **Navigation**:
  - Header: "← Back to Schemas" → `/workspace/demo-org/schemas`
  - AdminBar for admins

---

## Role-Based Access

### **Employee Role**
- **Access**: `/crm` only
- **Features**: View and edit their own data, limited permissions
- **No Access**: Settings, Schema Editor, API Keys, Theme Editor
- **AdminBar**: Hidden

### **Manager Role**
- **Access**: `/crm`, `/dashboard`
- **Features**: Full CRM access + sales performance dashboard
- **Limited Access**: Some settings depending on permissions
- **AdminBar**: Visible with Settings link

### **Admin/Owner Role**
- **Access**: All pages
- **Features**: Full platform access including:
  - Settings Hub
  - API Keys configuration
  - Theme & branding customization
  - Schema Editor
  - All CRM and dashboard features
- **AdminBar**: Visible with all options

---

## Design Consistency

### **Color Palette** (Uniform across all pages)
- **Background**: `#000000` (pure black)
- **Surface**: `#0a0a0a` (very dark gray)
- **Elevated**: `#1a1a1a` (dark gray)
- **Borders**: `#333` (medium dark gray)
- **Text Primary**: `#fff` (white)
- **Text Secondary**: `#999` (light gray)
- **Text Disabled**: `#666` (medium gray)
- **Primary Accent**: `#6366f1` (indigo)
- **Success**: `#10b981` (emerald)
- **Error**: `#dc2626` (red)
- **Warning**: `#f59e0b` (amber)

### **Typography**
- **Headers**: Bold, white text
- **Body**: Regular weight, white/gray text
- **Links**: Indigo color (#6366f1) with hover states
- **Buttons**: Consistent padding, border-radius, hover effects

### **Components**
- **Cards**: Dark background (#1a1a1a), border (#333), rounded corners (0.75rem)
- **Inputs**: Dark background (#1a1a1a), border (#333), white text
- **Buttons**: Indigo primary (#6366f1), gray secondary (#222)
- **Modals**: Dark overlay (rgba(0,0,0,0.7)), dark content (#0a0a0a)
- **Sidebar**: Consistent across Dashboard, Settings, and CRM

---

## Removed/Deleted Pages

### **Pages Removed for Simplicity**:
1. ❌ `src/app/import/page.tsx` - Generic import page (replaced with inline CSV import in CRM tables)
2. ❌ `src/app/workspace/[orgId]/dashboard/page.tsx` - Confusing light-themed workspace dashboard (consolidated into Settings Hub)

### **Pages Simplified**:
1. ✅ `src/app/page.tsx` - Changed from login form → dev navigation → direct redirect to `/crm`

---

## Key Features Integrated

### **CSV Import**
- **Location**: `/crm` page
- **Access**: Import CSV button in top bar
- **Functionality**: Schema-aware import for the active entity view
- **Smart Mapping**: Auto-detects columns and maps to schema fields

### **Settings Management**
- **Location**: `/workspace/demo-org/settings`
- **Access**: AdminBar → Settings (admin only)
- **Organization**: Categorized into 5 sections for easy discovery

### **Theme Customization**
- **Location**: `/workspace/demo-org/settings/theme`
- **Access**: Settings Hub → Theme & Branding
- **Features**: Live preview, presets, custom colors, logo/favicon upload

### **Schema Management**
- **Location**: `/workspace/demo-org/schemas`
- **Access**: Settings Hub → Schema Editor
- **Features**: Create custom entities, define fields, view data

---

## Consistent Navigation Patterns

### **Back Navigation**
- All pages have clear "← Back to X" links
- Consistent placement in header
- Indigo color (#6366f1) for visibility

### **Breadcrumb Logic**
```
/ (root)
└── /crm (main interface)
    ├── /dashboard (sales overview)
    └── /workspace/demo-org/settings (admin settings hub)
        ├── /workspace/demo-org/settings/api-keys
        ├── /workspace/demo-org/settings/theme
        └── /workspace/demo-org/schemas (schema editor)
            └── /workspace/demo-org/entities/{entityName} (custom entity data)
```

### **Sidebar Pattern**
All major pages use the same left sidebar:
- Collapse/expand button at bottom
- Consistent link styling
- Active state highlighting (lighter background, colored border)

---

## Organization ID Consistency
All workspace routes use **`demo-org`** as the organization ID:
- `/workspace/demo-org/settings`
- `/workspace/demo-org/settings/api-keys`
- `/workspace/demo-org/settings/theme`
- `/workspace/demo-org/schemas`
- `/workspace/demo-org/entities/{entityName}`

This ensures all links work correctly and there's no confusion between different org ID variations.

---

## Testing Checklist

### ✅ **Theme Consistency**
- [x] All pages use dark theme (#000000 background)
- [x] No light-themed pages remaining
- [x] Consistent color palette across all pages
- [x] Uniform button and input styling

### ✅ **Navigation**
- [x] All "Back" links point to correct parent pages
- [x] Organization IDs are consistent (`demo-org`)
- [x] No broken links to deleted pages
- [x] AdminBar only shows for non-employee roles

### ✅ **Functionality**
- [x] CSV import integrated into CRM
- [x] CRUD operations work on all entity tables
- [x] Settings accessible from AdminBar (admin only)
- [x] Theme editor saves and applies changes
- [x] Schema editor creates custom entities

### ✅ **Code Quality**
- [x] No linter errors
- [x] No duplicate exports
- [x] Consistent coding patterns
- [x] Proper TypeScript types

---

## User Flow Examples

### **Employee Login → Daily Work**
1. User lands on `/` → auto-redirects to `/crm`
2. Sees dark CRM interface with Leads view by default
3. Can switch between entities using sidebar
4. Can add/edit/delete records with modals
5. **Cannot** access Settings (AdminBar hidden)

### **Admin Login → Configure Platform**
1. User lands on `/` → auto-redirects to `/crm`
2. Sees AdminBar with Settings link
3. Clicks Settings → `/workspace/demo-org/settings`
4. Configures API keys, customizes theme, creates schemas
5. Returns to CRM via "Back to CRM" links

### **Manager Login → Review Performance**
1. User lands on `/` → auto-redirects to `/crm`
2. Can navigate to `/dashboard` via sidebar or AdminBar
3. Reviews sales pipeline, AI metrics, team performance
4. Clicks entity quick actions to jump to specific CRM views
5. Returns to daily work in CRM

---

## Summary

**Status**: ✅ **FULLY UNIFORM**

All pages now share:
- Consistent dark theme (#000000)
- Uniform navigation patterns
- Role-based access control
- Integrated functionality (no isolated pages)
- Professional, modern UI/UX

The platform is ready for further feature development with a solid, unified foundation.

