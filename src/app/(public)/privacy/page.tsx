'use client';

import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import PageRenderer from '@/components/PageRenderer';
import { usePageContent } from '@/hooks/usePageContent';

function FallbackContent() {
  return (
    <div className="pt-44 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-4">Privacy Policy</h1>
        <p className="text-gray-400 mb-12">Last updated: December 2024</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <p className="text-gray-300 text-lg leading-relaxed">
              At SalesVelocity.ai, we take your privacy seriously. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Information We Collect</h2>
            <p className="text-gray-300 leading-relaxed">
              We collect information you provide directly, including account details, business information, 
              and content you upload. We also automatically collect usage data and device information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">How We Use Your Information</h2>
            <p className="text-gray-300 leading-relaxed">
              We use your information to provide and improve our services, personalize your experience, 
              communicate with you, and ensure platform security. We never sell your personal data.
            </p>
          </section>

          <section>
            <p className="text-gray-400">
              Questions? Contact us at privacy@salesvelocity.ai
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  const { page, loading } = usePageContent('privacy');

  return (
    <PublicLayout>
      {loading ? (
        <div className="pt-44 pb-20 text-center"><div className="text-gray-400">Loading...</div></div>
      ) : page?.sections && page.sections.length > 0 ? (
        <PageRenderer page={page} />
      ) : (
        <FallbackContent />
      )}
    </PublicLayout>
  );
}









