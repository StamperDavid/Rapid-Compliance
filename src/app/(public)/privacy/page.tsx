'use client';

import React from 'react';
import PublicLayout from '@/components/PublicLayout';

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-white mb-6">Privacy Policy</h1>
          <p className="text-gray-400 mb-12">Last updated: December 5, 2024</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Introduction</h2>
              <p className="text-gray-300 leading-relaxed">
                AI Sales Platform ("we," "our," or "us") is committed to protecting your privacy. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
                when you use our service.
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Information We Collect</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Personal Information</h3>
                  <ul className="list-disc list-inside text-gray-300 space-y-2">
                    <li>Name and contact information (email, phone number)</li>
                    <li>Company name and business details</li>
                    <li>Payment and billing information</li>
                    <li>Account credentials</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Usage Data</h3>
                  <ul className="list-disc list-inside text-gray-300 space-y-2">
                    <li>Log data and analytics</li>
                    <li>Device and browser information</li>
                    <li>IP address and location data</li>
                    <li>Cookies and similar technologies</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">How We Use Your Information</h2>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Provide and maintain our service</li>
                <li>Process your transactions</li>
                <li>Send you updates and marketing communications (with your consent)</li>
                <li>Improve and optimize our platform</li>
                <li>Detect and prevent fraud or abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Data Security</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                We implement industry-standard security measures to protect your data, including:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security audits and penetration testing</li>
                <li>Access controls and authentication</li>
                <li>Secure cloud infrastructure (Firebase/Google Cloud)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Your Rights</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                Depending on your location, you may have the following rights:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Delete your data (right to be forgotten)</li>
                <li>Export your data (data portability)</li>
                <li>Opt-out of marketing communications</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Third-Party Services</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                We use the following third-party services:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Google Firebase (hosting and database)</li>
                <li>Stripe (payment processing)</li>
                <li>OpenAI / Anthropic / Google (AI services)</li>
                <li>SendGrid (email delivery)</li>
                <li>Analytics providers (Google Analytics, etc.)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Contact Us</h2>
              <p className="text-gray-300 leading-relaxed">
                If you have questions about this Privacy Policy, please contact us at:<br />
                <a href="mailto:privacy@aisalesplatform.com" className="text-indigo-400 hover:underline">
                  privacy@aisalesplatform.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}







