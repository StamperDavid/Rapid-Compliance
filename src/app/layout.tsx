import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI CRM Platform',
  description: 'Multi-tenant CRM with AI agents and e-commerce',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

