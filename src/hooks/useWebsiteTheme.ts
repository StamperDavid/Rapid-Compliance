'use client';

import { useState, useEffect } from 'react';

export interface WebsiteTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

const DEFAULT_THEME: WebsiteTheme = {
  primaryColor: '#6366f1', // Indigo - consistent across all pages
  secondaryColor: '#8b5cf6', // Purple
  accentColor: '#10b981', // Green for success/checkmarks
  backgroundColor: '#000000', // Pure black
  textColor: '#ffffff',
  fontFamily: 'Inter, sans-serif',
};

export function useWebsiteTheme() {
  const [theme, setTheme] = useState<WebsiteTheme>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const { FirestoreService } = await import('@/lib/db/firestore-service');
        const websiteData = await FirestoreService.get('platform/website', 'theme');
        
        if (websiteData) {
          setTheme({ ...DEFAULT_THEME, ...websiteData });
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

