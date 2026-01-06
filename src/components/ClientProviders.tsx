'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}






















