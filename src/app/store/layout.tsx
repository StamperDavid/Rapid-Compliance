'use client';

import { ThemeProvider } from '@/contexts/ThemeContext';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
