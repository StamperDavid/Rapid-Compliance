'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger/logger';

/**
 * Admin Theme Configuration
 * Isolated from Client/Org themes - stored in platform-level settings
 */
export interface AdminThemeConfig {
  colors: {
    primary: { main: string; light: string; dark: string; contrast: string };
    secondary: { main: string; light: string; dark: string; contrast: string };
    accent: { main: string; light: string; dark: string; contrast: string };
    success: { main: string; light: string; dark: string };
    warning: { main: string; light: string; dark: string };
    error: { main: string; light: string; dark: string };
    info: { main: string; light: string; dark: string };
    background: { main: string; paper: string; elevated: string };
    text: { primary: string; secondary: string; disabled: string };
    border: { main: string; light: string; strong: string };
  };
  branding: {
    platformName: string;
    logoUrl: string;
    primaryColor: string;
  };
}

/**
 * Default Admin Theme
 * Platform-level defaults - distinct from org-level defaults
 */
const DEFAULT_ADMIN_THEME: AdminThemeConfig = {
  colors: {
    primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5', contrast: '#ffffff' },
    secondary: { main: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed', contrast: '#ffffff' },
    accent: { main: '#ec4899', light: '#f472b6', dark: '#db2777', contrast: '#ffffff' },
    success: { main: '#10b981', light: '#34d399', dark: '#059669' },
    warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
    error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
    info: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
    background: { main: '#000000', paper: '#0a0a0a', elevated: '#1a1a1a' },
    text: { primary: '#ffffff', secondary: '#9ca3af', disabled: '#6b7280' },
    border: { main: '#1f2937', light: '#333333', strong: '#4b5563' },
  },
  branding: {
    platformName: 'Platform Admin',
    logoUrl: '',
    primaryColor: '#6366f1',
  },
};

/**
 * Apply Admin theme CSS variables to a scoped container element
 * This ISOLATES Admin theming from Client/Org theming which affects document.documentElement
 */
export function applyAdminThemeToContainer(
  container: HTMLElement | null,
  theme: AdminThemeConfig
): void {
  if (!container) {return;}

  // Apply Admin-scoped color variables
  container.style.setProperty('--admin-color-primary', theme.colors.primary.main);
  container.style.setProperty('--admin-color-primary-light', theme.colors.primary.light);
  container.style.setProperty('--admin-color-primary-dark', theme.colors.primary.dark);
  container.style.setProperty('--admin-color-secondary', theme.colors.secondary.main);
  container.style.setProperty('--admin-color-accent', theme.colors.accent.main);
  container.style.setProperty('--admin-color-success', theme.colors.success.main);
  container.style.setProperty('--admin-color-error', theme.colors.error.main);
  container.style.setProperty('--admin-color-warning', theme.colors.warning.main);
  container.style.setProperty('--admin-color-info', theme.colors.info.main);

  // Background colors
  container.style.setProperty('--admin-color-bg-main', theme.colors.background.main);
  container.style.setProperty('--admin-color-bg-paper', theme.colors.background.paper);
  container.style.setProperty('--admin-color-bg-elevated', theme.colors.background.elevated);

  // Text colors
  container.style.setProperty('--admin-color-text-primary', theme.colors.text.primary);
  container.style.setProperty('--admin-color-text-secondary', theme.colors.text.secondary);
  container.style.setProperty('--admin-color-text-disabled', theme.colors.text.disabled);

  // Border colors
  container.style.setProperty('--admin-color-border-main', theme.colors.border.main);
  container.style.setProperty('--admin-color-border-light', theme.colors.border.light);
  container.style.setProperty('--admin-color-border-strong', theme.colors.border.strong);

  // Branding
  container.style.setProperty('--admin-primary-color', theme.branding.primaryColor);

  // CRITICAL: Override standard variables within Admin scope
  // This ensures Admin components using var(--color-*) get Admin values, not Org values
  container.style.setProperty('--color-primary', theme.colors.primary.main);
  container.style.setProperty('--color-primary-light', theme.colors.primary.light);
  container.style.setProperty('--color-primary-dark', theme.colors.primary.dark);
  container.style.setProperty('--color-secondary', theme.colors.secondary.main);
  container.style.setProperty('--color-accent', theme.colors.accent.main);
  container.style.setProperty('--color-bg-main', theme.colors.background.main);
  container.style.setProperty('--color-bg-paper', theme.colors.background.paper);
  container.style.setProperty('--color-bg-elevated', theme.colors.background.elevated);
  container.style.setProperty('--color-text-primary', theme.colors.text.primary);
  container.style.setProperty('--color-text-secondary', theme.colors.text.secondary);
  container.style.setProperty('--color-text-disabled', theme.colors.text.disabled);
  container.style.setProperty('--color-border-main', theme.colors.border.main);
  container.style.setProperty('--color-border-light', theme.colors.border.light);
  container.style.setProperty('--color-border-strong', theme.colors.border.strong);
  container.style.setProperty('--color-background', theme.colors.background.main);
}

/**
 * Hook to load and apply Admin-specific theme
 * Loads from platform-level settings in Firestore
 * ISOLATED from organization/client theming
 *
 * @returns theme config, loading state, container ref, and update function
 */
export function useAdminTheme() {
  const [theme, setTheme] = useState<AdminThemeConfig>(DEFAULT_ADMIN_THEME);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load Admin theme from platform settings
  useEffect(() => {
    const loadAdminTheme = async () => {
      try {
        const { FirestoreService } = await import('@/lib/db/firestore-service');
        // Load Admin theme from platform-level settings
        // Path: platform_settings/adminTheme
        const rawThemeData: unknown = await FirestoreService.get(
          'platform_settings',
          'adminTheme'
        );

        if (isPartialAdminThemeConfig(rawThemeData)) {
          // Merge with defaults to ensure all properties exist
          // Use type guards for safe property access
          setTheme(prevTheme => {
            const colorsUpdate = isAdminThemeColors(rawThemeData.colors)
              ? rawThemeData.colors
              : {};
            const brandingUpdate = isAdminThemeBranding(rawThemeData.branding)
              ? rawThemeData.branding
              : {};

            return {
              ...prevTheme,
              colors: {
                ...prevTheme.colors,
                ...colorsUpdate,
              },
              branding: {
                ...prevTheme.branding,
                ...brandingUpdate,
              },
            };
          });
        }
      } catch (_error) {
        // If platform config doesn't exist, use defaults silently
        logger.debug('Using default admin theme', { file: 'useAdminTheme.ts' });
      } finally {
        setLoading(false);
      }
    };

    void loadAdminTheme();
  }, []);

  // Apply theme to container when theme or container changes
  useEffect(() => {
    if (!loading && containerRef.current) {
      applyAdminThemeToContainer(containerRef.current, theme);
    }
  }, [theme, loading]);

  // Callback to set container ref and apply theme immediately
  const setContainerRef = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
    if (element && !loading) {
      applyAdminThemeToContainer(element, theme);
    }
  }, [theme, loading]);

  // Update theme (for future Admin settings UI)
  const updateTheme = useCallback((updates: Partial<AdminThemeConfig>) => {
    setTheme(current => ({
      ...current,
      ...updates,
      colors: {
        ...current.colors,
        ...(updates.colors ?? {}),
      },
      branding: {
        ...current.branding,
        ...(updates.branding ?? {}),
      },
    }));
  }, []);

  return {
    theme,
    loading,
    setContainerRef,
    updateTheme,
    primaryColor: theme.branding.primaryColor,
    brandName: theme.branding.platformName,
  };
}

/**
 * Admin Theme Context indicator
 * Used by child components to detect if they're in Admin theme scope
 */
export const ADMIN_THEME_SCOPE_CLASS = 'admin-theme-scope';

/**
 * Type guard to validate AdminThemeConfig colors structure
 */
function isAdminThemeColors(obj: unknown): obj is Partial<AdminThemeConfig['colors']> {
  return typeof obj === 'object' && obj !== null;
}

/**
 * Type guard to validate AdminThemeConfig branding structure
 */
function isAdminThemeBranding(obj: unknown): obj is Partial<AdminThemeConfig['branding']> {
  return typeof obj === 'object' && obj !== null;
}

/**
 * Type guard to validate partial AdminThemeConfig
 */
function isPartialAdminThemeConfig(obj: unknown): obj is Partial<AdminThemeConfig> {
  return typeof obj === 'object' && obj !== null;
}
