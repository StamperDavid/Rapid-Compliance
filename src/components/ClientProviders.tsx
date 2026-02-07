'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './AuthProvider';
import { SkipToMain } from '@/components/website-builder/AccessibleWidget';
import { NavigationProgress } from '@/components/NavigationProgress';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <MotionConfig reducedMotion="user">
        <SkipToMain />
        <NavigationProgress />
        <Toaster position="top-right" />
        {children}
      </MotionConfig>
    </AuthProvider>
  );
}






















