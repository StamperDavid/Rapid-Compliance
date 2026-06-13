'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger/logger';

export interface ThemeConfig {
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
  typography: {
    fontFamily: { heading: string; body: string; mono: string };
    fontSize: { xs: string; sm: string; base: string; lg: string; xl: string; '2xl': string; '3xl': string };
    fontWeight: { light: number; normal: number; medium: number; semibold: number; bold: number };
  };
  layout: {
    borderRadius: { sm: string; md: string; lg: string; xl: string; full: string; card: string; button: string; input: string };
    spacing: { xs: string; sm: string; md: string; lg: string; xl: string };
    shadow: { sm: string; md: string; lg: string; xl: string; glow: string };
  };
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
    background: { main: '#000000', paper: '#0a0a0a', elevated: '#1a1a1a' },
    text: { primary: '#ffffff', secondary: '#9ca3af', disabled: '#6b7280' },
    border: { main: '#1f2937', light: '#111827', strong: '#374151' },
  },
  typography: {
    fontFamily: { heading: 'Inter, sans-serif', body: 'Inter, sans-serif', mono: 'Fira Code, monospace' },
    fontSize: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
    fontWeight: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  layout: {
    borderRadius: { sm: '0.25rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem', full: '9999px', card: '0.75rem', button: '0.5rem', input: '0.375rem' },
    spacing: { xs: '0.5rem', sm: '1rem', md: '1.5rem', lg: '2rem', xl: '3rem' },
    shadow: { sm: '0 1px 2px 0 rgba(0,0,0,0.05)', md: '0 4px 6px -1px rgba(0,0,0,0.1)', lg: '0 10px 15px -3px rgba(0,0,0,0.1)', xl: '0 20px 25px -5px rgba(0,0,0,0.1)', glow: '0 0 20px rgba(99,102,241,0.5)' },
  },
  branding: {
    companyName: 'My CRM',
    logoUrl: '',
    favicon: '',
    primaryColor: '#6366f1',
    showPoweredBy: true,
  },
};

/**
 * Build a COMPLETE colors object from a (possibly partial) saved palette, guaranteeing
 * every group + field exists so the CSS-var application can NEVER crash on a missing
 * value. A missing color falls back to the app's standard DEFAULT_THEME value for that
 * exact slot — never `transparent` (which made un-set colors invisible / the whole UI
 * black) and never a fabricated brand color.
 */
function fillColors(saved: unknown): ThemeConfig['colors'] {
  const savedColors = (saved && typeof saved === 'object' ? saved : {}) as Record<string, Record<string, string>>;
  const defaults = DEFAULT_THEME.colors as unknown as Record<string, Record<string, string>>;
  const out: Record<string, Record<string, string>> = {};
  for (const [group, fields] of Object.entries(defaults)) {
    const sg = savedColors[group];
    const savedGroup: Record<string, string> = sg && typeof sg === 'object' ? sg : {};
    const filled: Record<string, string> = {};
    for (const [key, defVal] of Object.entries(fields)) {
      const v = savedGroup[key];
      filled[key] = typeof v === 'string' && v.trim().length > 0 ? v : defVal;
    }
    out[group] = filled;
  }
  return out as ThemeConfig['colors'];
}

/**
 * Hook to load platform theme from Firestore
 * Loads global theme config and applies CSS variables to document.documentElement
 */
export function useOrgTheme() {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrgTheme = async () => {
      try {
        const { FirestoreService } = await import('@/lib/db/firestore-service');
        const themeData = await FirestoreService.get('platform_settings', 'theme');

        if (themeData) {
          // Deep-merge each section against DEFAULT_THEME so a partial saved palette
          // can NEVER leave a group (e.g. colors.primary) undefined. A naive shallow
          // spread would replace the whole `colors`/`typography`/`layout` object with
          // the saved partial and crash the CSS-var application on a missing field.
          const saved = themeData as Partial<ThemeConfig>;
          setTheme({
            colors: fillColors(saved.colors),
            typography: {
              fontFamily: { ...DEFAULT_THEME.typography.fontFamily, ...saved.typography?.fontFamily },
              fontSize: { ...DEFAULT_THEME.typography.fontSize, ...saved.typography?.fontSize },
              fontWeight: { ...DEFAULT_THEME.typography.fontWeight, ...saved.typography?.fontWeight },
            },
            layout: {
              borderRadius: { ...DEFAULT_THEME.layout.borderRadius, ...saved.layout?.borderRadius },
              spacing: { ...DEFAULT_THEME.layout.spacing, ...saved.layout?.spacing },
              shadow: { ...DEFAULT_THEME.layout.shadow, ...saved.layout?.shadow },
            },
            branding: { ...DEFAULT_THEME.branding, ...saved.branding },
          });
        }
      } catch (error) {
        logger.error('Failed to load platform theme:', error instanceof Error ? error : new Error(String(error)), { file: 'useOrgTheme.ts' });
      } finally {
        setLoading(false);
      }
    };

    void loadOrgTheme();
  }, []);

  // Apply CSS variables whenever theme changes
  useEffect(() => {
    if (loading) {return;}

    const root = document.documentElement;

    // Convert hex color to RGB triplet string (e.g. "#6366f1" → "99, 102, 241")
    const hexToRgbString = (hex: string): string | null => {
      const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!match) { return null; }
      return `${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}`;
    };

    // Set a color variable and its -rgb companion
    const setColor = (name: string, value: string) => {
      root.style.setProperty(name, value);
      const rgb = hexToRgbString(value);
      if (rgb) { root.style.setProperty(`${name}-rgb`, rgb); }
    };

    // Safe color read: a missing group OR field falls back to the app's standard
    // DEFAULT_THEME value for that slot (never `transparent`, never a fabricated brand
    // color), so a partial saved theme can never blank or crash this effect. This is
    // belt-and-suspenders with fillColors() on load.
    const defaultColors = DEFAULT_THEME.colors as unknown as Record<string, Record<string, string>>;
    const col = (group: string, field: string): string => {
      const groups = theme.colors as unknown as Record<string, Record<string, string> | undefined>;
      const v = groups[group]?.[field];
      if (typeof v === 'string' && v.length > 0) { return v; }
      return defaultColors[group]?.[field] ?? '#000000';
    };

    // Apply color variables (with auto-generated RGB companions)
    setColor('--color-primary', col('primary', 'main'));
    root.style.setProperty('--color-primary-light', col('primary', 'light'));
    root.style.setProperty('--color-primary-dark', col('primary', 'dark'));
    root.style.setProperty('--color-primary-contrast', col('primary', 'contrast'));
    setColor('--color-secondary', col('secondary', 'main'));
    setColor('--color-accent', col('accent', 'main'));
    setColor('--color-success', col('success', 'main'));
    setColor('--color-error', col('error', 'main'));
    setColor('--color-warning', col('warning', 'main'));
    setColor('--color-info', col('info', 'main'));

    // Background colors
    root.style.setProperty('--color-bg-main', col('background', 'main'));
    root.style.setProperty('--color-bg-paper', col('background', 'paper'));
    root.style.setProperty('--color-bg-elevated', col('background', 'elevated'));

    // Text colors
    root.style.setProperty('--color-text-primary', col('text', 'primary'));
    root.style.setProperty('--color-text-secondary', col('text', 'secondary'));
    setColor('--color-text-disabled', col('text', 'disabled'));

    // Border colors
    root.style.setProperty('--color-border-main', col('border', 'main'));
    root.style.setProperty('--color-border-light', col('border', 'light'));
    root.style.setProperty('--color-border-strong', col('border', 'strong'));

    // Typography
    root.style.setProperty('--font-heading', theme.typography.fontFamily.heading);
    root.style.setProperty('--font-body', theme.typography.fontFamily.body);
    root.style.setProperty('--font-mono', theme.typography.fontFamily.mono);

    // Border radius
    root.style.setProperty('--radius-card', theme.layout.borderRadius.card);
    root.style.setProperty('--radius-button', theme.layout.borderRadius.button);
    root.style.setProperty('--radius-input', theme.layout.borderRadius.input);

    // Apply favicon if provided
    if (theme.branding.favicon) {
      let favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = theme.branding.favicon;
    }

    // Update page title with company name
    if (theme.branding.companyName) {
      const pageTitle = document.title.split(' - ')[1] || 'CRM';
      document.title = `${theme.branding.companyName} - ${pageTitle}`;
    }
  }, [theme, loading]);

  return { theme, loading };
}


















