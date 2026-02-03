/**
 * Onboarding Layout
 *
 * Simple layout for the onboarding flow pages.
 * Minimal chrome to keep focus on the onboarding experience.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Started - Rapid Compliance',
  description: 'Create your AI-powered sales agent in minutes. Start with your industry, then customize to your business.',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
