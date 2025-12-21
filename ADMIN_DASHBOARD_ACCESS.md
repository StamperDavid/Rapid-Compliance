# 🔐 Admin Dashboard Access Guide

## How to Access the Admin Dashboard

The admin dashboard is your **platform-level control panel** for managing the entire platform (all organizations, users, billing, system settings, etc.).

### Quick Access

**URL**: `http://localhost:3000/admin`

If you're not logged in, you'll be automatically redirected to the login page.

### Login Page

**URL**: `http://localhost:3000/admin/login`

**Demo Mode**: In development, you can use **any email and password** to login.

**Example**:
- Email: `admin@platform.com` (or anything)
- Password: `password` (or anything)

### What's in the Admin Dashboard?

#### 📊 Dashboard (`/admin`)
- Platform overview metrics
- System health status
- Quick stats (organizations, users, revenue)
- Active alerts

#### 🏢 Organizations (`/admin/organizations`)
- View all client organizations
- Create new organizations
- Suspend/activate organizations
- View organization details

#### 👥 Users (`/admin/users`)
- View all platform users
- Manage user accounts
- View invitations

#### 💳 Billing (`/admin/billing`)
- View all subscriptions
- Payment history
- Invoice management
- Refunds

#### 📈 Analytics (`/admin/analytics`)
- Usage analytics
- Revenue reports
- Growth metrics

#### 🏥 System (`/admin/system`)
- **System Health** (`/admin/system/health`) - Monitor services
- **Platform API Keys** (`/admin/system/api-keys`) - ⭐ **Manage YOUR Firebase, Stripe, Gemini keys**
- **Feature Flags** (`/admin/system/flags`) - Enable/disable features
- **Audit Logs** (`/admin/system/logs`) - View all platform actions
- **Settings** (`/admin/system/settings`) - Platform-wide settings

#### 🛠️ Support (`/admin/support`)
- Impersonate users (for support)
- Data exports
- Bulk operations

#### 🔌 Advanced (`/admin/advanced`)
- Integrations management
- Templates
- Compliance
- Custom domains

---

## 🔑 Platform API Keys Management

**This is where YOU manage YOUR platform-level API keys.**

### Access
**URL**: `http://localhost:3000/admin/system/api-keys`

### What You Can Configure

1. **Firebase Configuration** (Required for authentication)
   - Your platform's Firebase project credentials
   - Used for user authentication across all clients
   - Get from: https://console.firebase.google.com

2. **Stripe Configuration** (Required for billing)
   - Your platform's Stripe keys
   - Used for processing customer subscriptions
   - Get from: https://dashboard.stripe.com

3. **Gemini AI Configuration** (Optional)
   - Your platform's Gemini API key
   - Used for platform AI features
   - Get from: https://aistudio.google.com

4. **Email Services** (Optional)
   - SendGrid, Resend API keys
   - For system emails

5. **SMS Services** (Optional)
   - Twilio credentials
   - For system notifications

6. **Search** (Optional)
   - Algolia credentials
   - For platform search

### How It Works

1. **You enter your API keys** in the admin dashboard
2. **Keys are saved to Firestore** in the `admin` collection
3. **Platform uses these keys** for all platform-level operations
4. **Clients manage their own keys** in workspace settings (separate)

### Priority Order

1. **Admin Settings** (from `/admin/system/api-keys`) - Highest priority
2. **Environment Variables** (`.env.local`) - Fallback
3. **Demo Mode** - If neither available

---

## 🔄 Difference: Platform vs Client API Keys

### Platform API Keys (Admin Dashboard)
- **Location**: `/admin/system/api-keys`
- **Who manages**: YOU (platform owner)
- **Used for**: 
  - User authentication (Firebase)
  - Platform billing (Stripe)
  - Platform AI features (Gemini)
  - System services

### Client API Keys (Workspace Settings)
- **Location**: `/workspace/{orgId}/settings/api-keys`
- **Who manages**: Your CLIENTS
- **Used for**:
  - Client's own integrations
  - Client's email/SMS services
  - Client's payment processors
  - Client's AI API keys

---

## 🚀 Quick Start

1. **Start the dev server**:
   ```powershell
   npm run dev
   ```

2. **Navigate to admin login**:
   ```
   http://localhost:3000/admin/login
   ```

3. **Login** (demo mode - any credentials work):
   - Email: `admin@platform.com`
   - Password: `password`

4. **Go to Platform API Keys**:
   - Click "System" in sidebar
   - Click "Platform API Keys"
   - Or go directly: `http://localhost:3000/admin/system/api-keys`

5. **Enter your Firebase credentials**:
   - Get them from Firebase Console
   - Paste into the form
   - Click "Save Platform API Keys"
   - Page will reload and Firebase will be configured

---

## 📝 Notes

- **Admin dashboard is separate** from client workspace settings
- **Platform API keys** are for YOUR platform infrastructure
- **Client API keys** are for each client's own integrations
- In **demo mode**, admin login accepts any credentials
- In **production**, you'll want to set up proper admin authentication

---

## 🔗 Direct Links

- Admin Dashboard: `/admin`
- Admin Login: `/admin/login`
- Platform API Keys: `/admin/system/api-keys`
- System Settings: `/admin/system/settings`
- System Health: `/admin/system/health`



















