'use client';

/* eslint-disable @next/next/no-img-element -- User uploaded images displayed in preview */

import { useState, useEffect } from 'react';
import Link from 'next/link'
import { logger } from '@/lib/logger/logger';

interface ThemeConfig {
  // Colors
  colors: {
    primary: { main: string; light: string; dark: string; contrast: string };
    secondary: { main: string; light: string; dark: string; contrast: string };
    accent: { main: string; light: string; dark: string; contrast: string };
    success: { main: string; light: string; dark: string };
    warning: { main: string; light: string; dark: string };
    error: { main: string; light: string; dark: string };
    info: { main: string; light: string; dark: string };
    neutral: { 100: string; 200: string; 300: string; 400: string; 500: string; 600: string; 700: string; 800: string; 900: string };
    background: { main: string; paper: string; elevated: string };
    text: { primary: string; secondary: string; disabled: string };
    border: { main: string; light: string; strong: string };
  };
  
  // Typography
  typography: {
    fontFamily: { heading: string; body: string; mono: string };
    fontSize: { xs: string; sm: string; base: string; lg: string; xl: string; '2xl': string; '3xl': string };
    fontWeight: { light: number; normal: number; medium: number; semibold: number; bold: number };
  };
  
  // Layout
  layout: {
    borderRadius: { sm: string; md: string; lg: string; xl: string; full: string; card: string; button: string; input: string };
    spacing: { xs: string; sm: string; md: string; lg: string; xl: string };
    shadow: { sm: string; md: string; lg: string; xl: string; glow: string };
  };
  
  // Branding
  branding: {
    companyName: string;
    logoUrl: string;
    favicon: string;
    primaryColor: string;
    showPoweredBy: boolean;
  };
}

const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5', contrast: '#ffffff' },
    secondary: { main: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed', contrast: '#ffffff' },
    accent: { main: '#ec4899', light: '#f472b6', dark: '#db2777', contrast: '#ffffff' },
    success: { main: '#10b981', light: '#34d399', dark: '#059669' },
    warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
    error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
    info: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
    neutral: { 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827' },
    background: { main: '#ffffff', paper: '#f9fafb', elevated: '#ffffff' },
    text: { primary: '#111827', secondary: '#6b7280', disabled: '#9ca3af' },
    border: { main: '#e5e7eb', light: '#f3f4f6', strong: '#d1d5db' },
  },
  typography: {
    fontFamily: { heading: 'Inter, sans-serif', body: 'Inter, sans-serif', mono: 'Fira Code, monospace' },
    fontSize: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  layout: {
    borderRadius: { sm: '0.25rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem', full: '9999px', card: '0.75rem', button: '0.5rem', input: '0.375rem' },
    spacing: { xs: '0.5rem', sm: '1rem', md: '1.5rem', lg: '2rem', xl: '3rem' },
    shadow: { sm: '0 1px 2px 0 rgba(0,0,0,0.05)', md: '0 4px 6px -1px rgba(0,0,0,0.1)', lg: '0 10px 15px -3px rgba(0,0,0,0.1)', xl: '0 20px 25px -5px rgba(0,0,0,0.1)', glow: '0 0 20px rgba(var(--color-primary-rgb),0.5)' },
  },
  branding: {
    companyName: 'My Company',
    logoUrl: '',
    favicon: '',
    primaryColor: '#6366f1',
    showPoweredBy: true,
  },
};

const THEME_PRESETS = [
  { name: 'Modern Blue', primary: '#3b82f6', secondary: '#8b5cf6', accent: '#06b6d4' },
  { name: 'Purple Dream', primary: '#8b5cf6', secondary: '#a855f7', accent: '#ec4899' },
  { name: 'Forest Green', primary: '#10b981', secondary: '#059669', accent: '#14b8a6' },
  { name: 'Sunset Orange', primary: '#f59e0b', secondary: '#f97316', accent: '#ef4444' },
  { name: 'Ocean Teal', primary: '#14b8a6', secondary: '#06b6d4', accent: '#3b82f6' },
  { name: 'Rose Pink', primary: '#ec4899', secondary: '#f43f5e', accent: '#fb7185' },
  { name: 'Dark Mode', primary: '#6366f1', secondary: '#8b5cf6', accent: '#ec4899' },
  { name: 'Professional Gray', primary: '#4b5563', secondary: '#6b7280', accent: '#3b82f6' },
];

export default function ThemeEditorPage() {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [activeSection, setActiveSection] = useState<'colors' | 'typography' | 'layout' | 'branding'>('colors');
  const [activeColorGroup, setActiveColorGroup] = useState<'brand' | 'semantic' | 'neutral' | 'background'>('brand');
  const [showPreview, setShowPreview] = useState(true);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [faviconPreview, setFaviconPreview] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load saved theme from Firestore
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const { FirestoreService } = await import('@/lib/db/firestore-service');
        const themeData = await FirestoreService.get(
          'platform_settings',
          'theme'
        );
        
        if (themeData) {
          const typedTheme = themeData as ThemeConfig;
          setTheme(typedTheme);
          if (typedTheme.branding?.logoUrl) {
            setLogoPreview(typedTheme.branding.logoUrl);
          }
          if (typedTheme.branding?.favicon) {
            setFaviconPreview(typedTheme.branding.favicon);
          }
        } else {
          // Try localStorage as fallback (for migration)
          const savedTheme = localStorage.getItem('appTheme');
          if (savedTheme) {
            try {
              const parsed = JSON.parse(savedTheme) as ThemeConfig;
              setTheme(parsed);
              if (parsed.branding?.logoUrl) {
                setLogoPreview(parsed.branding.logoUrl);
              }
              if (parsed.branding?.favicon) {
                setFaviconPreview(parsed.branding.favicon);
              }
            } catch (error) {
              logger.error('Failed to load theme:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
            }
          }
        }
      } catch (error) {
        logger.error('Failed to load theme from Firestore:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
        // Fallback to localStorage
        const savedTheme = localStorage.getItem('appTheme');
        if (savedTheme) {
          try {
            const parsed = JSON.parse(savedTheme) as ThemeConfig;
            setTheme(parsed);
          } catch (e) {
            logger.error('Failed to load theme:', e instanceof Error ? e : new Error(String(e)), { file: 'page.tsx' });
          }
        }
      }
    };

    void loadTheme();
  }, []);

  const updateColor = (path: string[], value: string) => {
    setTheme(prev => {
      const newTheme = { ...prev };
      let current: Record<string, unknown> = newTheme as unknown as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]] as Record<string, unknown>;
      }
      current[path[path.length - 1]] = value;
      return newTheme;
    });
  };

  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    setTheme(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        primary: { main: preset.primary, light: adjustColor(preset.primary, 20), dark: adjustColor(preset.primary, -20), contrast: '#ffffff' },
        secondary: { main: preset.secondary, light: adjustColor(preset.secondary, 20), dark: adjustColor(preset.secondary, -20), contrast: '#ffffff' },
        accent: { main: preset.accent, light: adjustColor(preset.accent, 20), dark: adjustColor(preset.accent, -20), contrast: '#ffffff' },
      }
    }));
  };

  const adjustColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return `#${  (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1)}`;
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setLogoPreview(base64);
        setTheme(prev => ({ ...prev, branding: { ...prev.branding, logoUrl: base64 } }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFaviconPreview(base64);
        setTheme(prev => ({ ...prev, branding: { ...prev.branding, favicon: base64 } }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAndApply = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Save to Firestore
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        'platform_settings',
        'theme',
        {
          ...theme,
          updatedAt: new Date().toISOString(),
        },
        false
      );

      // Also save to localStorage as fallback/cache
      localStorage.setItem('appTheme', JSON.stringify(theme));

      // Apply favicon if present
      if (theme.branding.favicon) {
        const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (favicon) {
          favicon.href = theme.branding.favicon;
        } else {
          const newFavicon = document.createElement('link');
          newFavicon.rel = 'icon';
          newFavicon.href = theme.branding.favicon;
          document.head.appendChild(newFavicon);
        }
      }

      // Apply page title if company name is set
      if (theme.branding.companyName) {
        document.title = `${theme.branding.companyName} - CRM`;
      }

      // Apply all CSS custom properties for global theme
      const root = document.documentElement;
      root.style.setProperty('--color-primary', theme.colors.primary.main);
      root.style.setProperty('--color-primary-light', theme.colors.primary.light);
      root.style.setProperty('--color-primary-dark', theme.colors.primary.dark);
      root.style.setProperty('--color-secondary', theme.colors.secondary.main);
      root.style.setProperty('--color-accent', theme.colors.accent.main);
      root.style.setProperty('--color-success', theme.colors.success.main);
      root.style.setProperty('--color-error', theme.colors.error.main);
      root.style.setProperty('--color-warning', theme.colors.warning.main);
      root.style.setProperty('--color-info', theme.colors.info.main);
      root.style.setProperty('--color-bg-main', theme.colors.background.main);
      root.style.setProperty('--color-bg-paper', theme.colors.background.paper);
      root.style.setProperty('--color-bg-elevated', theme.colors.background.elevated);
      root.style.setProperty('--color-text-primary', theme.colors.text.primary);
      root.style.setProperty('--color-text-secondary', theme.colors.text.secondary);
      root.style.setProperty('--color-text-disabled', theme.colors.text.disabled);
      root.style.setProperty('--color-border-main', theme.colors.border.main);
      root.style.setProperty('--color-border-light', theme.colors.border.light);
      root.style.setProperty('--color-border-strong', theme.colors.border.strong);
      root.style.setProperty('--font-heading', theme.typography.fontFamily.heading);
      root.style.setProperty('--font-body', theme.typography.fontFamily.body);
      root.style.setProperty('--font-mono', theme.typography.fontFamily.mono);
      root.style.setProperty('--radius-card', theme.layout.borderRadius.card);
      root.style.setProperty('--radius-button', theme.layout.borderRadius.button);
      root.style.setProperty('--radius-input', theme.layout.borderRadius.input);

      setSaveMessage({ type: 'success', message: 'Theme saved and applied successfully!' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to save theme';
      setSaveMessage({ type: 'error', message: errorMessage });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const exportTheme = () => {
    const json = JSON.stringify(theme, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `theme-${theme.branding.companyName.toLowerCase().replace(/\s/g, '-')}.json`;
    a.click();
  };

  const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>{label}</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ height: '2.5rem', width: '4rem', borderRadius: '0.375rem', border: '1px solid #333', cursor: 'pointer', backgroundColor: '#1a1a1a' }} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }} className="sticky top-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href={`/settings`} style={{ color: '#6366f1', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none' }}>
                ← Back to Settings
              </Link>
              <div style={{ height: '1.5rem', width: '1px', backgroundColor: '#333' }}></div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>Professional Theme Editor</h1>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowPreview(!showPreview)} style={{ padding: '0.625rem 1rem', border: '1px solid #333', color: '#999', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}>
                {showPreview ? 'Hide' : 'Show'} Preview
              </button>
              <button onClick={exportTheme} style={{ padding: '0.625rem 1rem', border: '1px solid #333', color: '#999', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}>
                📥 Export Theme
              </button>
              <button
                onClick={() => void handleSaveAndApply()}
                disabled={isSaving}
                style={{ 
                  padding: '0.625rem 1.5rem', 
                  backgroundColor: isSaving ? '#4f46e5' : '#6366f1', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '0.5rem', 
                  cursor: isSaving ? 'not-allowed' : 'pointer', 
                  fontSize: '0.875rem', 
                  fontWeight: '600',
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                {isSaving ? '💾 Saving...' : '✅ Save & Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Message Toast */}
      {saveMessage && (
        <div style={{
          position: 'fixed',
          top: '5rem',
          right: '1rem',
          padding: '1rem 1.5rem',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          zIndex: 50,
          backgroundColor: saveMessage.type === 'success' ? '#065f46' : '#7f1d1d',
          color: saveMessage.type === 'success' ? '#6ee7b7' : '#fca5a5',
          fontWeight: '600',
          border: `1px solid ${saveMessage.type === 'success' ? '#10b981' : '#dc2626'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>{saveMessage.type === 'success' ? '✅' : '❌'}</span>
          {saveMessage.message}
        </div>
      )}

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' }}>
          {/* Sidebar Navigation */}
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {[
              { id: 'colors', label: 'Colors', icon: '🎨' },
              { id: 'typography', label: 'Typography', icon: '📝' },
              { id: 'layout', label: 'Layout & Spacing', icon: '📐' },
              { id: 'branding', label: 'Branding', icon: '🏢' },
            ].map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as typeof activeSection)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.875rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  backgroundColor: activeSection === section.id ? '#1a1a1a' : 'transparent',
                  color: activeSection === section.id ? '#6366f1' : '#999',
                  border: activeSection === section.id ? '1px solid #333' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ marginRight: '0.5rem' }}>{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>

          {/* Editor Panel */}
          <div style={{ gridColumn: showPreview ? 'span 6' : 'span 10' }}>
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '0.75rem', border: '1px solid #1a1a1a', padding: '1.5rem' }}>
              
              {/* COLORS SECTION */}
              {activeSection === 'colors' && (
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Color System</h2>
                  
                  {/* Theme Presets */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem' }}>Quick Start Presets</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                      {THEME_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => applyPreset(preset)}
                          style={{
                            padding: '0.75rem',
                            border: '1px solid #333',
                            borderRadius: '0.5rem',
                            backgroundColor: '#111',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#6366f1';
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#333';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                            <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.25rem', backgroundColor: preset.primary }}></div>
                            <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.25rem', backgroundColor: preset.secondary }}></div>
                            <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.25rem', backgroundColor: preset.accent }}></div>
                          </div>
                          <p style={{ fontSize: '0.75rem', fontWeight: '500', color: '#fff' }}>{preset.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Group Tabs */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #1a1a1a' }}>
                    {[
                      { id: 'brand', label: 'Brand Colors' },
                      { id: 'semantic', label: 'Semantic Colors' },
                      { id: 'neutral', label: 'Neutral Colors' },
                      { id: 'background', label: 'Backgrounds' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveColorGroup(tab.id as typeof activeColorGroup)}
                        style={{
                          padding: '0.625rem 1rem',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderBottom: activeColorGroup === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                          color: activeColorGroup === tab.id ? '#6366f1' : '#999',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Brand Colors */}
                  {activeColorGroup === 'brand' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                        <ColorPicker label="Primary" value={theme.colors.primary.main} onChange={(v) => updateColor(['colors', 'primary', 'main'], v)} />
                        <ColorPicker label="Primary Light" value={theme.colors.primary.light} onChange={(v) => updateColor(['colors', 'primary', 'light'], v)} />
                        <ColorPicker label="Primary Dark" value={theme.colors.primary.dark} onChange={(v) => updateColor(['colors', 'primary', 'dark'], v)} />
                        <ColorPicker label="Contrast" value={theme.colors.primary.contrast} onChange={(v) => updateColor(['colors', 'primary', 'contrast'], v)} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                        <ColorPicker label="Secondary" value={theme.colors.secondary.main} onChange={(v) => updateColor(['colors', 'secondary', 'main'], v)} />
                        <ColorPicker label="Secondary Light" value={theme.colors.secondary.light} onChange={(v) => updateColor(['colors', 'secondary', 'light'], v)} />
                        <ColorPicker label="Secondary Dark" value={theme.colors.secondary.dark} onChange={(v) => updateColor(['colors', 'secondary', 'dark'], v)} />
                        <ColorPicker label="Contrast" value={theme.colors.secondary.contrast} onChange={(v) => updateColor(['colors', 'secondary', 'contrast'], v)} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                        <ColorPicker label="Accent" value={theme.colors.accent.main} onChange={(v) => updateColor(['colors', 'accent', 'main'], v)} />
                        <ColorPicker label="Accent Light" value={theme.colors.accent.light} onChange={(v) => updateColor(['colors', 'accent', 'light'], v)} />
                        <ColorPicker label="Accent Dark" value={theme.colors.accent.dark} onChange={(v) => updateColor(['colors', 'accent', 'dark'], v)} />
                        <ColorPicker label="Contrast" value={theme.colors.accent.contrast} onChange={(v) => updateColor(['colors', 'accent', 'contrast'], v)} />
                      </div>
                    </div>
                  )}

                  {/* Semantic Colors */}
                  {activeColorGroup === 'semantic' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <ColorPicker label="Success" value={theme.colors.success.main} onChange={(v) => updateColor(['colors', 'success', 'main'], v)} />
                        <ColorPicker label="Success Light" value={theme.colors.success.light} onChange={(v) => updateColor(['colors', 'success', 'light'], v)} />
                        <ColorPicker label="Success Dark" value={theme.colors.success.dark} onChange={(v) => updateColor(['colors', 'success', 'dark'], v)} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <ColorPicker label="Warning" value={theme.colors.warning.main} onChange={(v) => updateColor(['colors', 'warning', 'main'], v)} />
                        <ColorPicker label="Warning Light" value={theme.colors.warning.light} onChange={(v) => updateColor(['colors', 'warning', 'light'], v)} />
                        <ColorPicker label="Warning Dark" value={theme.colors.warning.dark} onChange={(v) => updateColor(['colors', 'warning', 'dark'], v)} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <ColorPicker label="Error" value={theme.colors.error.main} onChange={(v) => updateColor(['colors', 'error', 'main'], v)} />
                        <ColorPicker label="Error Light" value={theme.colors.error.light} onChange={(v) => updateColor(['colors', 'error', 'light'], v)} />
                        <ColorPicker label="Error Dark" value={theme.colors.error.dark} onChange={(v) => updateColor(['colors', 'error', 'dark'], v)} />
                      </div>
                    </div>
                  )}

                  {/* Neutral Colors */}
                  {activeColorGroup === 'neutral' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                      {Object.entries(theme.colors.neutral).map(([shade, color]) => (
                        <ColorPicker key={shade} label={`Gray ${shade}`} value={color} onChange={(v) => updateColor(['colors', 'neutral', shade], v)} />
                      ))}
                    </div>
                  )}

                  {/* Background Colors */}
                  {activeColorGroup === 'background' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <ColorPicker label="Main Background" value={theme.colors.background.main} onChange={(v) => updateColor(['colors', 'background', 'main'], v)} />
                      <ColorPicker label="Paper Background" value={theme.colors.background.paper} onChange={(v) => updateColor(['colors', 'background', 'paper'], v)} />
                      <ColorPicker label="Elevated Background" value={theme.colors.background.elevated} onChange={(v) => updateColor(['colors', 'background', 'elevated'], v)} />
                      <ColorPicker label="Primary Text" value={theme.colors.text.primary} onChange={(v) => updateColor(['colors', 'text', 'primary'], v)} />
                      <ColorPicker label="Secondary Text" value={theme.colors.text.secondary} onChange={(v) => updateColor(['colors', 'text', 'secondary'], v)} />
                    </div>
                  )}
                </div>
              )}

              {/* TYPOGRAPHY SECTION */}
              {activeSection === 'typography' && (
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Typography System</h2>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem' }}>Font Families</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>Heading Font</label>
                          <input type="text" value={theme.typography.fontFamily.heading} onChange={(e) => setTheme(prev => ({ ...prev, typography: { ...prev.typography, fontFamily: { ...prev.typography.fontFamily, heading: e.target.value } } }))} style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>Body Font</label>
                          <input type="text" value={theme.typography.fontFamily.body} onChange={(e) => setTheme(prev => ({ ...prev, typography: { ...prev.typography, fontFamily: { ...prev.typography.fontFamily, body: e.target.value } } }))} style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>Monospace Font</label>
                          <input type="text" value={theme.typography.fontFamily.mono} onChange={(e) => setTheme(prev => ({ ...prev, typography: { ...prev.typography, fontFamily: { ...prev.typography.fontFamily, mono: e.target.value } } }))} style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem' }}>Font Sizes</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                        {Object.entries(theme.typography.fontSize).map(([size, value]) => (
                          <div key={size}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem', textTransform: 'capitalize' }}>{size}</label>
                            <input type="text" value={value} onChange={(e) => setTheme(prev => ({ ...prev, typography: { ...prev.typography, fontSize: { ...prev.typography.fontSize, [size]: e.target.value } } }))} style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem' }}>Font Weights</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                        {Object.entries(theme.typography.fontWeight).map(([weight, value]) => (
                          <div key={weight}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem', textTransform: 'capitalize' }}>{weight}</label>
                            <input type="number" value={value} min="100" max="900" step="100" onChange={(e) => setTheme(prev => ({ ...prev, typography: { ...prev.typography, fontWeight: { ...prev.typography.fontWeight, [weight]: parseInt(e.target.value) } } }))} style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* LAYOUT SECTION */}
              {activeSection === 'layout' && (
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Layout & Spacing</h2>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem' }}>Border Radius</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                        {Object.entries(theme.layout.borderRadius).map(([size, value]) => (
                          <div key={size}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem', textTransform: 'capitalize' }}>{size}</label>
                            <input type="text" value={value} onChange={(e) => setTheme(prev => ({ ...prev, layout: { ...prev.layout, borderRadius: { ...prev.layout.borderRadius, [size]: e.target.value } } }))} style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem' }}>Spacing Scale</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                        {Object.entries(theme.layout.spacing).map(([size, value]) => (
                          <div key={size}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{size}</label>
                            <input type="text" value={value} onChange={(e) => setTheme(prev => ({ ...prev, layout: { ...prev.layout, spacing: { ...prev.layout.spacing, [size]: e.target.value } } }))} style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem' }}>Box Shadows</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {Object.entries(theme.layout.shadow).map(([size, value]) => (
                          <div key={size}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem', textTransform: 'capitalize' }}>{size}</label>
                            <input type="text" value={value} onChange={(e) => setTheme(prev => ({ ...prev, layout: { ...prev.layout, shadow: { ...prev.layout.shadow, [size]: e.target.value } } }))} style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.75rem', fontFamily: 'monospace' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BRANDING SECTION */}
              {activeSection === 'branding' && (
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>White-Label Branding</h2>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Company Name */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>Company Name</label>
                      <input 
                        type="text" 
                        value={theme.branding.companyName} 
                        onChange={(e) => setTheme(prev => ({ ...prev, branding: { ...prev.branding, companyName: e.target.value } }))} 
                        placeholder="Enter your company name"
                        style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }} 
                      />
                    </div>

                    {/* Logo Upload */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>Company Logo</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                        {/* Preview */}
                        <div style={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '2px dashed #333', 
                          borderRadius: '0.5rem', 
                          padding: '1.5rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          minHeight: '150px'
                        }}>
                          {(logoPreview || theme.branding.logoUrl) ? (
                            <img 
                              src={logoPreview || theme.branding.logoUrl} 
                              alt="Logo preview" 
                              style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain' }}
                            />
                          ) : (
                            <div style={{ textAlign: 'center', color: '#666' }}>
                              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🖼️</div>
                              <p style={{ fontSize: '0.75rem' }}>No logo</p>
                            </div>
                          )}
                        </div>

                        {/* Upload Options */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            id="logo-upload"
                            style={{ display: 'none' }}
                          />
                          <label 
                            htmlFor="logo-upload"
                            style={{
                              padding: '0.75rem 1rem',
                              backgroundColor: '#6366f1',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              textAlign: 'center',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem'
                            }}
                          >
                            📤 Upload Logo
                          </label>
                          
                          <div style={{ color: '#666', fontSize: '0.75rem', textAlign: 'center' }}>or</div>
                          
                          <input 
                            type="url" 
                            value={theme.branding.logoUrl.startsWith('data:') ? '' : theme.branding.logoUrl} 
                            onChange={(e) => {
                              setTheme(prev => ({ ...prev, branding: { ...prev.branding, logoUrl: e.target.value } }));
                              setLogoPreview('');
                            }} 
                            placeholder="https://yoursite.com/logo.svg" 
                            style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }} 
                          />
                          
                          {(logoPreview || theme.branding.logoUrl) && (
                            <button
                              onClick={() => {
                                setLogoPreview('');
                                setTheme(prev => ({ ...prev, branding: { ...prev.branding, logoUrl: '' } }));
                              }}
                              style={{
                                padding: '0.5rem',
                                backgroundColor: '#7f1d1d',
                                color: '#fca5a5',
                                border: '1px solid #991b1b',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '500'
                              }}
                            >
                              🗑️ Remove Logo
                            </button>
                          )}

                          <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
                            Recommended: PNG or SVG, transparent background, 200x50px
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Favicon Upload */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>Favicon</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                        {/* Preview */}
                        <div style={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '2px dashed #333', 
                          borderRadius: '0.5rem', 
                          padding: '1.5rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          minHeight: '100px'
                        }}>
                          {(faviconPreview || theme.branding.favicon) ? (
                            <img 
                              src={faviconPreview || theme.branding.favicon} 
                              alt="Favicon preview" 
                              style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                            />
                          ) : (
                            <div style={{ textAlign: 'center', color: '#666' }}>
                              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⭐</div>
                              <p style={{ fontSize: '0.75rem' }}>No favicon</p>
                            </div>
                          )}
                        </div>

                        {/* Upload Options */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <input
                            type="file"
                            accept="image/*,.ico"
                            onChange={handleFaviconUpload}
                            id="favicon-upload"
                            style={{ display: 'none' }}
                          />
                          <label 
                            htmlFor="favicon-upload"
                            style={{
                              padding: '0.75rem 1rem',
                              backgroundColor: '#6366f1',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              textAlign: 'center',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem'
                            }}
                          >
                            📤 Upload Favicon
                          </label>
                          
                          <div style={{ color: '#666', fontSize: '0.75rem', textAlign: 'center' }}>or</div>
                          
                          <input 
                            type="url" 
                            value={theme.branding.favicon.startsWith('data:') ? '' : theme.branding.favicon} 
                            onChange={(e) => {
                              setTheme(prev => ({ ...prev, branding: { ...prev.branding, favicon: e.target.value } }));
                              setFaviconPreview('');
                            }} 
                            placeholder="https://yoursite.com/favicon.ico" 
                            style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }} 
                          />
                          
                          {(faviconPreview || theme.branding.favicon) && (
                            <button
                              onClick={() => {
                                setFaviconPreview('');
                                setTheme(prev => ({ ...prev, branding: { ...prev.branding, favicon: '' } }));
                              }}
                              style={{
                                padding: '0.5rem',
                                backgroundColor: '#7f1d1d',
                                color: '#fca5a5',
                                border: '1px solid #991b1b',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '500'
                              }}
                            >
                              🗑️ Remove Favicon
                            </button>
                          )}

                          <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
                            Recommended: ICO or PNG, 32x32px or 64x64px
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Primary Brand Color */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>Primary Brand Color</label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input 
                          type="color" 
                          value={theme.branding.primaryColor} 
                          onChange={(e) => setTheme(prev => ({ ...prev, branding: { ...prev.branding, primaryColor: e.target.value } }))} 
                          style={{ height: '3rem', width: '5rem', borderRadius: '0.375rem', border: '1px solid #333', cursor: 'pointer', backgroundColor: '#1a1a1a' }} 
                        />
                        <input 
                          type="text" 
                          value={theme.branding.primaryColor} 
                          onChange={(e) => setTheme(prev => ({ ...prev, branding: { ...prev.branding, primaryColor: e.target.value } }))} 
                          style={{ flex: 1, padding: '0.625rem 0.875rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }} 
                        />
                      </div>
                    </div>

                    {/* Show Powered By */}
                    <div style={{ 
                      backgroundColor: '#1a1a1a', 
                      border: '1px solid #333', 
                      borderRadius: '0.5rem', 
                      padding: '1rem'
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={theme.branding.showPoweredBy} 
                          onChange={(e) => setTheme(prev => ({ ...prev, branding: { ...prev.branding, showPoweredBy: e.target.checked } }))} 
                          style={{ width: '1.25rem', height: '1.25rem' }} 
                        />
                        <div>
                          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', display: 'block' }}>Show &quot;Powered By&quot; branding</span>
                          <span style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginTop: '0.25rem' }}>
                            Display attribution in the footer (required for free tier)
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Preview Panel */}
          {showPreview && (
            <div style={{ gridColumn: 'span 4' }}>
              <div style={{ position: 'sticky', top: '6rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ backgroundColor: '#0a0a0a', borderRadius: '0.75rem', border: '1px solid #1a1a1a', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Live Preview</h3>
                  
                  {/* Brand Preview */}
                  <div style={{ marginBottom: '1.5rem', padding: '1.5rem', borderRadius: '0.5rem', background: `linear-gradient(135deg, ${theme.colors.primary.main}, ${theme.colors.secondary.main})` }}>
                    {(logoPreview || theme.branding.logoUrl) ? (
                      <img 
                        src={logoPreview || theme.branding.logoUrl} 
                        alt="Logo" 
                        style={{ maxHeight: '40px', marginBottom: '0.75rem' }}
                      />
                    ) : (
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem', fontFamily: theme.typography.fontFamily.heading }}>{theme.branding.companyName}</h2>
                    )}
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem' }}>Your brand identity</p>
                  </div>

                  {/* Buttons */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Buttons</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button style={{ backgroundColor: theme.colors.primary.main, color: theme.colors.primary.contrast, borderRadius: theme.layout.borderRadius.button, padding: '0.5rem 1rem', fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>Primary</button>
                      <button style={{ backgroundColor: theme.colors.secondary.main, color: theme.colors.secondary.contrast, borderRadius: theme.layout.borderRadius.button, padding: '0.5rem 1rem', fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>Secondary</button>
                      <button style={{ backgroundColor: theme.colors.accent.main, color: theme.colors.accent.contrast, borderRadius: theme.layout.borderRadius.button, padding: '0.5rem 1rem', fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>Accent</button>
                      <button style={{ border: `1px solid ${theme.colors.border.main}`, color: theme.colors.text.primary, borderRadius: theme.layout.borderRadius.button, padding: '0.5rem 1rem', fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium, backgroundColor: 'transparent' }}>Outline</button>
                    </div>
                  </div>

                  {/* Cards */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Cards</p>
                    <div style={{ backgroundColor: theme.colors.background.paper, borderRadius: theme.layout.borderRadius.card, padding: theme.layout.spacing.md, border: `1px solid ${theme.colors.border.main}`, boxShadow: theme.layout.shadow.md }}>
                      <h4 style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.text.primary, marginBottom: '0.5rem' }}>Card Title</h4>
                      <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary }}>This is a preview of how cards will look with your theme applied.</p>
                    </div>
                  </div>

                  {/* Inputs */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Inputs</p>
                    <input type="text" placeholder="Your input..." style={{ width: '100%', padding: '0.625rem 0.875rem', fontSize: theme.typography.fontSize.sm, border: `1px solid ${theme.colors.border.main}`, borderRadius: theme.layout.borderRadius.input, backgroundColor: theme.colors.background.main }} />
                  </div>

                  {/* Alerts */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Status Messages</p>
                    <div style={{ backgroundColor: `${theme.colors.success.light  }20`, color: theme.colors.success.dark, padding: '0.75rem', borderRadius: theme.layout.borderRadius.md, fontSize: theme.typography.fontSize.sm, border: `1px solid ${theme.colors.success.main}` }}>✓ Success message</div>
                    <div style={{ backgroundColor: `${theme.colors.error.light  }20`, color: theme.colors.error.dark, padding: '0.75rem', borderRadius: theme.layout.borderRadius.md, fontSize: theme.typography.fontSize.sm, border: `1px solid ${theme.colors.error.main}` }}>× Error message</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
