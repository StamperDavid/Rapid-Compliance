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
        <p className="text-gray-400 mb-12">Last updated: February 2026</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <p className="text-gray-300 text-lg leading-relaxed">
              Welcome to SalesVelocity.ai. By accessing or using our platform, you agree to be bound
              by these Terms of Service. Please read them carefully.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Account Terms</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              You must be 18 years or older to use this service. You are responsible for maintaining
              the security of your account and password. You may not use the service for any illegal purpose.
            </p>
            <p className="text-gray-300 leading-relaxed">
              You are responsible for all activity that occurs under your account. You must notify us immediately
              of any unauthorized use of your account or any other breach of security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Acceptable Use</h2>
            <p className="text-gray-300 leading-relaxed">
              You agree not to misuse our services, interfere with other users, attempt unauthorized access,
              or use the platform to send spam or malicious content. You may not use AI-generated content from our
              platform in ways that violate applicable laws, including but not limited to CAN-SPAM, TCPA, and GDPR regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Billing & Payments</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              Paid plans are billed monthly based on CRM record usage. All fees are non-refundable except as required
              by law. We reserve the right to change pricing with 30 days&apos; notice.
            </p>
            <p className="text-gray-300 leading-relaxed">
              Free trials provide full access for 14 days. If you do not cancel before the trial ends, your payment
              method will be charged for the applicable plan.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. AI Usage & BYOK</h2>
            <p className="text-gray-300 leading-relaxed">
              When using the Bring Your Own Key (BYOK) feature, you are solely responsible for your API key security
              and any charges incurred with third-party AI providers. SalesVelocity.ai does not mark up or profit from
              your AI provider costs. Your API keys are encrypted at rest and never shared.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Data Ownership</h2>
            <p className="text-gray-300 leading-relaxed">
              You retain full ownership of all data you upload, create, or generate through our platform. We do not
              use your business data to train AI models for other customers. Upon account termination, you may request
              a full export of your data within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Service Availability</h2>
            <p className="text-gray-300 leading-relaxed">
              We strive to maintain 99.9% uptime but do not guarantee uninterrupted service. We are not liable for
              any downtime, data loss, or damages arising from service interruptions, whether scheduled or unscheduled.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Termination</h2>
            <p className="text-gray-300 leading-relaxed">
              Either party may terminate this agreement at any time. Upon termination, your access to the platform will
              cease and your data will be retained for 30 days before permanent deletion, unless you request earlier deletion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              To the maximum extent permitted by law, SalesVelocity.ai shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly
              or indirectly. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.
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
      ) : page?.sections && page.sections.length > 0 ? (
        <PageRenderer page={page} />
      ) : (
        <FallbackContent />
      )}
    </PublicLayout>
  );
}









