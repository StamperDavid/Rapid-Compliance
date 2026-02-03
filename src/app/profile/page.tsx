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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar */}
        <div style={{ 
          width: sidebarOpen ? '260px' : '70px',
          backgroundColor: 'var(--color-bg-paper)',
          borderRight: '1px solid var(--color-bg-elevated)',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            <Link
              href="/crm"
              style={{
                width: '100%',
                padding: '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                borderLeft: '3px solid transparent',
                fontSize: '0.875rem',
                fontWeight: '400',
                textDecoration: 'none'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🏠</span>
              {sidebarOpen && <span>Back to CRM</span>}
            </Link>

            {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
              <Link
                key={key}
                href={`/crm?view=${key}`}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-secondary)',
                  borderLeft: '3px solid transparent',
                  fontSize: '0.875rem',
                  fontWeight: '400',
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>

          <div style={{ padding: '1rem', borderTop: '1px solid var(--color-bg-elevated)' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'var(--color-bg-elevated)',
                color: 'var(--color-text-secondary)',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              {sidebarOpen ? '← Collapse' : '→'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <Link
                href="/crm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: primaryColor,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  marginBottom: '1.5rem'
                }}
              >
                ← Back to CRM
              </Link>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>My Profile</h1>
              <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
                Manage your personal information and preferences
              </p>
            </div>

            {/* Profile Info Card */}
            <div style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-light)', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: primaryColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: 'var(--color-text-primary)'
                }}>
                  {user.displayName?.charAt(0) ?? 'U'}
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>{user.displayName ?? 'User'}</h2>
                  <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
                    {user.email} • <span style={{ textTransform: 'capitalize', color: primaryColor, fontWeight: 600 }}>{user.role}</span>
                  </p>
                </div>
              </div>

              {/* Basic Information */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Basic Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Display Name</label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem', color: 'var(--color-text-disabled)', fontSize: '0.875rem', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Job Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                      placeholder="e.g. Sales Manager"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Department</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
                      placeholder="e.g. Sales"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Timezone</label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-light)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}
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
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Preferences</h3>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Language</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem', color: '#fff', fontSize: '0.875rem', maxWidth: '300px' }}
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
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Notifications</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.emailNotifications}
                      onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })}
                      style={{ width: '1.125rem', height: '1.125rem' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Email Notifications</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Receive email updates about your activity</div>
                    </div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.smsNotifications}
                      onChange={(e) => setFormData({ ...formData, smsNotifications: e.target.checked })}
                      style={{ width: '1.125rem', height: '1.125rem' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>SMS Notifications</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Receive text messages for important updates</div>
                    </div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.browserNotifications}
                      onChange={(e) => setFormData({ ...formData, browserNotifications: e.target.checked })}
                      style={{ width: '1.125rem', height: '1.125rem' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>Browser Notifications</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Get desktop notifications while using the app</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Link
                href="/crm"
                style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500', border: '1px solid var(--color-border-light)' }}
              >
                Cancel
              </Link>
              <button
                onClick={handleSaveClick}
                disabled={isSaving}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: isSaving ? 'var(--color-primary-dark)' : 'var(--color-primary)',
                  color: 'white',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                {isSaving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Message Toast */}
      {saveMessage && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          padding: '1rem 1.5rem',
          backgroundColor: saveMessage.includes('success') ? 'var(--color-success-dark)' : '#7f1d1d',
          border: `1px solid ${saveMessage.includes('success') ? 'var(--color-success)' : 'var(--color-error-dark)'}`,
          borderRadius: '0.5rem',
          color: 'var(--color-text-primary)',
          fontSize: '0.875rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          zIndex: 1000
        }}>
          {saveMessage}
        </div>
      )}
    </div>
  );
}

