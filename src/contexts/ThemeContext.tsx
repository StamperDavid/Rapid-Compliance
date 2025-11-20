'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeColors {
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
}

interface ThemeBranding {
  companyName: string;
  logoUrl: string;
  favicon: string;
  primaryColor: string;
  showPoweredBy: boolean;
}

interface ThemeConfig {
  colors: ThemeColors;
  branding: ThemeBranding;
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
    text: { primary: '#ffffff', secondary: '#999999', disabled: '#666666' },
    border: { main: '#1a1a1a', light: '#333333', strong: '#4b5563' },
  },
  branding: {
    companyName: 'AI CRM Platform',
    logoUrl: '',
    favicon: '',
    primaryColor: '#6366f1',
    showPoweredBy: true,
  },
};

interface ThemeContextType {
  theme: ThemeConfig;
  updateTheme: (newTheme: Partial<ThemeConfig>) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        setTheme({ ...DEFAULT_THEME, ...parsed });
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    // Apply CSS variables
    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.colors.primary.main);
    root.style.setProperty('--color-primary-light', theme.colors.primary.light);
    root.style.setProperty('--color-primary-dark', theme.colors.primary.dark);
    root.style.setProperty('--color-secondary', theme.colors.secondary.main);
    root.style.setProperty('--color-accent', theme.colors.accent.main);
    root.style.setProperty('--color-success', theme.colors.success.main);
    root.style.setProperty('--color-error', theme.colors.error.main);
    root.style.setProperty('--color-warning', theme.colors.warning.main);
    root.style.setProperty('--color-bg-main', theme.colors.background.main);
    root.style.setProperty('--color-bg-paper', theme.colors.background.paper);
    root.style.setProperty('--color-bg-elevated', theme.colors.background.elevated);
    root.style.setProperty('--color-text-primary', theme.colors.text.primary);
    root.style.setProperty('--color-text-secondary', theme.colors.text.secondary);
    root.style.setProperty('--color-border-main', theme.colors.border.main);
    root.style.setProperty('--color-border-light', theme.colors.border.light);

    // Apply favicon
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

    // Apply page title
    if (theme.branding.companyName) {
      document.title = `${theme.branding.companyName} - CRM`;
    }
  }, [theme, isLoaded]);

  const updateTheme = (newTheme: Partial<ThemeConfig>) => {
    setTheme(prev => ({ ...prev, ...newTheme }));
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
    localStorage.removeItem('appTheme');
  };

  if (!isLoaded) {
    return <div style={{ backgroundColor: '#000', minHeight: '100vh' }} />;
  }

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

