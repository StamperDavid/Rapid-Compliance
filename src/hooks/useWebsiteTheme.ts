'use client';

import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger/logger';

export interface WebsiteTheme {
  logoUrl: string;
  logoHeight: number;
  companyName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  navBackground: string;
  footerBackground: string;
  fontFamily: string;
  headingFont: string;
}

const DEFAULT_THEME: WebsiteTheme = {
  logoUrl: '/logo.png',
  logoHeight: 48,
  companyName: 'RapidCompliance.US',
  tagline: 'Accelerate Your Growth',
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  accentColor: '#10b981',
  backgroundColor: '#000000',
  textColor: '#ffffff',
  navBackground: 'rgba(15, 23, 42, 0.8)',
  footerBackground: '#0a0a0a',
  fontFamily: 'Inter, sans-serif',
  headingFont: 'Inter, sans-serif',
};

interface BrandingConfig {
  logoUrl?: string;
  logoHeight?: number;
  companyName?: string;
  tagline?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    navBackground?: string;
    footerBackground?: string;
  };
  fonts?: {
    body?: string;
    heading?: string;
  };
}

interface ConfigData {
  branding?: BrandingConfig;
  theme?: Partial<WebsiteTheme>;
}

export function useWebsiteTheme() {
  const [theme, setTheme] = useState<WebsiteTheme>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      // ISOMORPHIC GUARD: Prevent direct Firestore calls from the browser
      // Browser access to platformConfig/website is blocked by Firestore Security Rules
      // This hook runs client-side only ('use client'), so we use the default theme
      // and skip the Firestore call entirely to avoid permission errors.
      // Future enhancement: Fetch custom theme via an API route if needed.
      if (typeof window !== 'undefined') {
        // Running in browser - use default theme to avoid Firestore permission errors
        setLoading(false);
        return;
      }

      try {
        const { FirestoreService } = await import('@/lib/db/firestore-service');

        // Server-side only: Try to load from platform collection, website document
        // Firestore paths must have even segments: collection/document
        const configData = await FirestoreService.get('platformConfig', 'website');

        if (configData && typeof configData === 'object' && 'branding' in configData) {
          const typedConfig = configData as ConfigData;
          const branding = typedConfig.branding;
          if (branding) {
            setTheme({
              logoUrl: branding.logoUrl ?? DEFAULT_THEME.logoUrl,
              logoHeight: branding.logoHeight ?? DEFAULT_THEME.logoHeight,
              companyName: branding.companyName ?? DEFAULT_THEME.companyName,
              tagline: branding.tagline ?? DEFAULT_THEME.tagline,
              primaryColor: branding.colors?.primary ?? DEFAULT_THEME.primaryColor,
              secondaryColor: branding.colors?.secondary ?? DEFAULT_THEME.secondaryColor,
              accentColor: branding.colors?.accent ?? DEFAULT_THEME.accentColor,
              backgroundColor: branding.colors?.background ?? DEFAULT_THEME.backgroundColor,
              textColor: branding.colors?.text ?? DEFAULT_THEME.textColor,
              navBackground: branding.colors?.navBackground ?? DEFAULT_THEME.navBackground,
              footerBackground: branding.colors?.footerBackground ?? DEFAULT_THEME.footerBackground,
              fontFamily: branding.fonts?.body ? `${branding.fonts.body}, sans-serif` : DEFAULT_THEME.fontFamily,
              headingFont: branding.fonts?.heading ? `${branding.fonts.heading}, sans-serif` : DEFAULT_THEME.headingFont,
            });
          }
        } else if (configData && typeof configData === 'object' && 'theme' in configData) {
          const typedConfig = configData as ConfigData;
          const theme = typedConfig.theme;
          if (theme) {
            // Theme data stored directly in website document
            setTheme({ ...DEFAULT_THEME, ...theme });
          }
        }
        // If no config exists, DEFAULT_THEME is already set
      } catch (_error) {
        // Silently fall back to default theme - this is expected if no config exists yet
        logger.info('Using default theme (no custom config found)', { file: 'useWebsiteTheme.ts' });
      } finally {
        setLoading(false);
      }
    };

    void loadTheme();
  }, []);

  return { theme, loading };
}
