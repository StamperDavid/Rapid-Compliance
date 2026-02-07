'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';

interface ThemeBranding {
  companyName?: string;
  logoUrl?: string;
}

interface ThemeColors {
  primary?: {
    main?: string;
  };
}

interface Theme {
  branding?: ThemeBranding;
  colors?: ThemeColors;
}

interface UserWithExtras {
  phone?: string;
  title?: string;
  department?: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme] = useState<Theme | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    phone: '',
    title: '',
    department: '',
    timezone: 'America/New_York',
    language: 'en',
    emailNotifications: true,
    smsNotifications: false,
    browserNotifications: true,
  });

  useEffect(() => {
    // LEGACY BACKUP (DO NOT USE): const savedTheme = localStorage.getItem('appTheme');
    // LEGACY BACKUP (DO NOT USE): if (savedTheme) {
    // LEGACY BACKUP (DO NOT USE):   try {
    // LEGACY BACKUP (DO NOT USE):     setTheme(JSON.parse(savedTheme));
    // LEGACY BACKUP (DO NOT USE):   } catch (error) {
    // LEGACY BACKUP (DO NOT USE):     logger.error('Failed to load theme:', error, { file: 'page.tsx' });
    // LEGACY BACKUP (DO NOT USE):   }
    // LEGACY BACKUP (DO NOT USE): }
  }, []);

  useEffect(() => {
    if (user) {
      const userWithExtras = user as unknown as UserWithExtras;
      setFormData(prev => ({
        ...prev,
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        phone: userWithExtras.phone ?? '',
        title: userWithExtras.title ?? '',
        department: userWithExtras.department ?? '',
      }));
    }
  }, [user]);

  const colorsPrimaryMain = theme?.colors?.primary?.main;
  const primaryColor = (colorsPrimaryMain !== '' && colorsPrimaryMain != null) ? colorsPrimaryMain : 'var(--color-primary)';

  const handleSaveClick = () => {
    void handleSave();
  };

  const handleSave = async () => {
    if (!user) {
      return;
    }

    setIsSaving(true);
    try {
      await FirestoreService.set(
        COLLECTIONS.USERS,
        user.id,
        {
          displayName: formData.displayName,
          phone: formData.phone,
          title: formData.title,
          department: formData.department,
          timezone: formData.timezone,
          language: formData.language,
          notifications: {
            email: formData.emailNotifications,
            sms: formData.smsNotifications,
            browser: formData.browserNotifications,
          },
          updatedAt: new Date().toISOString(),
        },
        false
      );
      
      setSaveMessage('Profile updated successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      logger.error('Failed to save profile:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      setSaveMessage('Failed to save profile');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-main text-text-primary">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-main">
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        <div className="bg-surface-paper border-r border-border-light flex flex-col transition-all duration-300" style={{ width: sidebarOpen ? '260px' : '70px' }}>
          <nav className="flex-1 py-4 overflow-y-auto">
            <Link
              href="/crm"
              className="w-full py-3.5 px-5 flex items-center gap-3 bg-transparent text-text-secondary border-l-[3px] border-transparent text-sm font-normal no-underline"
            >
              <span className="text-xl">🏠</span>
              {sidebarOpen && <span>Back to CRM</span>}
            </Link>

            {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
              <Link
                key={key}
                href={`/crm?view=${key}`}
                className="w-full py-3.5 px-5 flex items-center gap-3 bg-transparent text-text-secondary border-l-[3px] border-transparent text-sm font-normal no-underline"
              >
                <span className="text-xl">{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-border-light">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full p-2 bg-surface-elevated text-text-secondary border-0 rounded-md cursor-pointer text-sm"
            >
              {sidebarOpen ? '← Collapse' : '→'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-[900px] mx-auto">
            {/* Header */}
            <div className="mb-8">
              <Link
                href="/crm"
                className="inline-flex items-center gap-2 text-sm font-medium no-underline mb-6"
                style={{ color: primaryColor }}
              >
                ← Back to CRM
              </Link>
              <h1 className="text-3xl font-bold text-text-primary mb-2">My Profile</h1>
              <p className="text-text-secondary text-sm">
                Manage your personal information and preferences
              </p>
            </div>

            {/* Profile Info Card */}
            <div className="bg-surface-elevated border border-border-light rounded-2xl p-8 mb-8">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-text-primary" style={{ backgroundColor: primaryColor }}>
                  {user.displayName?.charAt(0) ?? 'U'}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-text-primary mb-1">{user.displayName ?? 'User'}</h2>
                  <p className="text-text-secondary text-sm">
                    {user.email} • <span className="capitalize font-semibold" style={{ color: primaryColor }}>{user.role}</span>
                  </p>
                </div>
              </div>

              {/* Basic Information */}
              <div className="mb-8">
                <h3 className="text-base font-semibold text-text-primary mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Display Name</label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full px-2.5 py-2.5 bg-surface-paper border border-border-light rounded-lg text-text-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      className="w-full px-2.5 py-2.5 bg-surface-paper border border-border-light rounded-lg text-text-secondary text-sm cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-2.5 py-2.5 bg-surface-paper border border-border-light rounded-lg text-text-primary text-sm"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Job Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-2.5 py-2.5 bg-surface-paper border border-border-light rounded-lg text-text-primary text-sm"
                      placeholder="e.g. Sales Manager"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Department</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-2.5 py-2.5 bg-surface-paper border border-border-light rounded-lg text-text-primary text-sm"
                      placeholder="e.g. Sales"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Timezone</label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      className="w-full px-2.5 py-2.5 bg-surface-paper border border-border-light rounded-lg text-text-primary text-sm"
                    >
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Europe/Paris">Paris (CET)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Preferences */}
              <div className="mb-8">
                <h3 className="text-base font-semibold text-text-primary mb-4">Preferences</h3>
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Language</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full max-w-xs px-2.5 py-2.5 bg-surface-paper border border-border-light rounded-lg text-text-primary text-sm"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="pt">Português</option>
                  </select>
                </div>
              </div>

              {/* Notifications */}
              <div>
                <h3 className="text-base font-semibold text-text-primary mb-4">Notifications</h3>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.emailNotifications}
                      onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })}
                      className="w-4.5 h-4.5"
                    />
                    <div>
                      <div className="text-sm text-text-primary">Email Notifications</div>
                      <div className="text-xs text-text-secondary">Receive email updates about your activity</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.smsNotifications}
                      onChange={(e) => setFormData({ ...formData, smsNotifications: e.target.checked })}
                      className="w-4.5 h-4.5"
                    />
                    <div>
                      <div className="text-sm text-text-primary">SMS Notifications</div>
                      <div className="text-xs text-text-secondary">Receive text messages for important updates</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.browserNotifications}
                      onChange={(e) => setFormData({ ...formData, browserNotifications: e.target.checked })}
                      className="w-4.5 h-4.5"
                    />
                    <div>
                      <div className="text-sm text-text-primary">Browser Notifications</div>
                      <div className="text-xs text-text-secondary">Get desktop notifications while using the app</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end">
              <Link
                href="/crm"
                className="px-6 py-3 bg-surface-elevated text-text-secondary rounded-lg no-underline text-sm font-medium border border-border-light"
              >
                Cancel
              </Link>
              <button
                onClick={handleSaveClick}
                disabled={isSaving}
                className={`px-6 py-3 text-white rounded-lg border-0 text-sm font-semibold ${isSaving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'}`}
                style={{ backgroundColor: isSaving ? 'var(--color-primary-dark)' : 'var(--color-primary)' }}
              >
                {isSaving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Message Toast */}
      {saveMessage && (
        <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-lg text-text-primary text-sm shadow-2xl z-[1000] ${saveMessage.includes('success') ? 'bg-success-dark border border-success' : 'bg-red-900 border border-error-dark'}`}>
          {saveMessage}
        </div>
      )}
    </div>
  );
}

