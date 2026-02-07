'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from './AuthProvider';
import { SkipToMain } from '@/components/website-builder/AccessibleWidget';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <MotionConfig reducedMotion="user">
        <SkipToMain />
        {children}
      </MotionConfig>
    </AuthProvider>
  );
}






















