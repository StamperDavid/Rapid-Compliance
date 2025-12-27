'use client';

import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import PageRenderer from '@/components/PageRenderer';
import { usePageContent } from '@/hooks/usePageContent';

function FallbackContent() {
  return (
    <div className="pt-44 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-4">Terms of Service</h1>
        <p className="text-gray-400 mb-12">Last updated: December 2024</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <p className="text-gray-300 text-lg leading-relaxed">
              Welcome to SalesVelocity.ai. By accessing or using our platform, you agree to be bound 
              by these Terms of Service. Please read them carefully.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Account Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              You must be 18 years or older to use this service. You are responsible for maintaining 
              the security of your account and password. You may not use the service for any illegal purpose.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Acceptable Use</h2>
            <p className="text-gray-300 leading-relaxed">
              You agree not to misuse our services, interfere with other users, attempt unauthorized access, 
              or use the platform to send spam or malicious content.
            </p>
          </section>

          <section>
            <p className="text-gray-400">
              Questions? Contact us at legal@salesvelocity.ai
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function TermsPage() {
  const { page, loading } = usePageContent('terms');

  return (
    <PublicLayout>
      {loading ? (
        <div className="pt-44 pb-20 text-center"><div className="text-gray-400">Loading...</div></div>
      ) : page && page.sections && page.sections.length > 0 ? (
        <PageRenderer page={page} />
      ) : (
        <FallbackContent />
      )}
    </PublicLayout>
  );
}






