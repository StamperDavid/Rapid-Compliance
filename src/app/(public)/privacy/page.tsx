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
        <p className="text-gray-400 mb-12">Last updated: February 2026</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <p className="text-gray-300 text-lg leading-relaxed">
              At SalesVelocity.ai, we take your privacy seriously. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              <span className="font-semibold text-white">Account Information:</span> Name, email address, company name,
              and payment details when you create an account or subscribe to a plan.
            </p>
            <p className="text-gray-300 leading-relaxed mb-3">
              <span className="font-semibold text-white">Business Data:</span> CRM records, contacts, deals, products,
              and other business information you store on our platform.
            </p>
            <p className="text-gray-300 leading-relaxed mb-3">
              <span className="font-semibold text-white">AI Training Data:</span> Information you provide to train your
              AI agents, including business descriptions, FAQs, product details, and training feedback.
            </p>
            <p className="text-gray-300 leading-relaxed">
              <span className="font-semibold text-white">Usage Data:</span> We automatically collect device information,
              IP addresses, browser type, pages visited, and feature usage patterns to improve our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              We use your information to provide and improve our services, personalize your experience,
              communicate with you, and ensure platform security. We never sell your personal data.
            </p>
            <p className="text-gray-300 leading-relaxed">
              Your business data and AI training data are used exclusively to power your own account.
              We do not use your data to train AI models for other customers or for any other purpose
              outside of delivering our services to you.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Data Security</h2>
            <p className="text-gray-300 leading-relaxed">
              All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. API keys
              are stored with additional encryption layers. We conduct regular security audits and maintain
              infrastructure on enterprise-grade cloud providers with SOC 2 compliance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Third-Party Services</h2>
            <p className="text-gray-300 leading-relaxed">
              We integrate with third-party services including Stripe (payments), Firebase (authentication
              and database), SendGrid (email), and Twilio (SMS/voice). When you use BYOK features, your
              API keys are sent directly to the respective AI providers. Each third-party service operates
              under its own privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Data Retention & Deletion</h2>
            <p className="text-gray-300 leading-relaxed">
              We retain your data for as long as your account is active. Upon account termination, your data
              is retained for 30 days to allow for export, after which it is permanently deleted. You may request
              immediate deletion by contacting privacy@salesvelocity.ai.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Your Rights</h2>
            <p className="text-gray-300 leading-relaxed">
              You have the right to access, correct, export, and delete your personal data at any time.
              You may also opt out of non-essential communications. For GDPR-covered individuals, you have
              additional rights including data portability and the right to object to processing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Cookies & Tracking</h2>
            <p className="text-gray-300 leading-relaxed">
              We use essential cookies for authentication and session management. We use analytics cookies
              to understand platform usage and improve our service. You can manage cookie preferences through
              your browser settings.
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









