import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import { ClientProviders } from '@/components/ClientProviders';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SalesVelocity.ai - Accelerate Your Growth',
  description: 'SalesVelocity platform with custom AI agents, CRM, and e-commerce',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  const nonce = headersList.get('x-nonce') ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} nonce={nonce}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
