'use client';

import React, { type ReactNode } from 'react';
import { useOrgTheme } from '@/hooks/useOrgTheme';

interface OrgThemeProviderProps {
  children: ReactNode;
}

/**
 * Wrapper component that loads and applies organization-specific theme
 * Use this to wrap pages that should use the org's custom theme
 */
export default function OrgThemeProvider({ children }: OrgThemeProviderProps) {
  const { loading } = useOrgTheme();

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#000000', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#ffffff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
          <div>Loading your workspace...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


















