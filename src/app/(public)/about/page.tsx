'use client';

import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import PageRenderer from '@/components/PageRenderer';
import { usePageContent } from '@/hooks/usePageContent';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

function FallbackContent() {
  const { theme } = useWebsiteTheme();

  return (
    <div className="pt-44 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-6">About Us</h1>
        <p className="text-xl text-gray-300 mb-12">
          Building the future of AI-powered sales automation
        </p>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Our Mission</h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            We believe every business deserves access to world-class sales automation, 
            regardless of size or budget. SalesVelocity.ai democratizes cutting-edge 
            technology, making it accessible to startups and enterprises alike.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Our Story</h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            Founded in 2024, SalesVelocity.ai emerged from a simple observation: most businesses 
            struggle with lead qualification, follow-ups, and sales process consistency.
          </p>
        </section>

        <section>
          <Link 
            href="/contact" 
            className="inline-block px-8 py-4 rounded-lg text-lg font-semibold transition"
            style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
          >
            Get in Touch →
          </Link>
        </section>
      </div>
    </div>
  );
}

export default function AboutPage() {
  const { page, loading } = usePageContent('about');

  return (
    <PublicLayout>
      {loading ? (
        <div className="pt-44 pb-20 text-center">
          <div className="text-gray-400">Loading...</div>
        </div>
      ) : page && page.sections && page.sections.length > 0 ? (
        <PageRenderer page={page} />
      ) : (
        <FallbackContent />
      )}
    </PublicLayout>
  );
}

