'use client';

import { useState, useEffect } from 'react';

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
  companyName: 'SalesVelocity.ai',
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

export function useWebsiteTheme() {
  const [theme, setTheme] = useState<WebsiteTheme>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const { FirestoreService } = await import('@/lib/db/firestore-service');
        
        // Try to load from the new config structure first
        const configData = await FirestoreService.get('platform/website', 'config');
        
        if (configData?.branding) {
          const branding = configData.branding;
          setTheme({
            logoUrl: branding.logoUrl || DEFAULT_THEME.logoUrl,
            logoHeight: branding.logoHeight || DEFAULT_THEME.logoHeight,
            companyName: branding.companyName || DEFAULT_THEME.companyName,
            tagline: branding.tagline || DEFAULT_THEME.tagline,
            primaryColor: branding.colors?.primary || DEFAULT_THEME.primaryColor,
            secondaryColor: branding.colors?.secondary || DEFAULT_THEME.secondaryColor,
            accentColor: branding.colors?.accent || DEFAULT_THEME.accentColor,
            backgroundColor: branding.colors?.background || DEFAULT_THEME.backgroundColor,
            textColor: branding.colors?.text || DEFAULT_THEME.textColor,
            navBackground: branding.colors?.navBackground || DEFAULT_THEME.navBackground,
            footerBackground: branding.colors?.footerBackground || DEFAULT_THEME.footerBackground,
            fontFamily: branding.fonts?.body ? `${branding.fonts.body}, sans-serif` : DEFAULT_THEME.fontFamily,
            headingFont: branding.fonts?.heading ? `${branding.fonts.heading}, sans-serif` : DEFAULT_THEME.headingFont,
          });
        } else {
          // Fallback to old theme structure
          const themeData = await FirestoreService.get('platform/website', 'theme');
          if (themeData) {
            setTheme({ ...DEFAULT_THEME, ...themeData });
          }
        }
      } catch (error) {
        console.error('Failed to load website theme:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, []);

  return { theme, loading };
}
