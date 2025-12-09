'use client';

import React from 'react';
import PublicLayout from '@/components/PublicLayout';

export default function TermsPage() {
  return (
    <PublicLayout>
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-white mb-6">Terms of Service</h1>
          <p className="text-gray-400 mb-12">Last updated: December 5, 2024</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Agreement to Terms</h2>
              <p className="text-gray-300 leading-relaxed">
                By accessing or using AI Sales Platform, you agree to be bound by these Terms of Service. 
                If you disagree with any part of these terms, you may not access the service.
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Use License</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                We grant you a limited, non-exclusive, non-transferable license to use the service for your business purposes, subject to these terms.
              </p>
              <p className="text-gray-300 leading-relaxed font-semibold mb-2">You agree NOT to:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Resell or redistribute the service</li>
                <li>Reverse engineer or decompile the software</li>
                <li>Use the service for illegal activities</li>
                <li>Spam or abuse our infrastructure</li>
                <li>Share your account credentials</li>
                <li>Scrape or extract data without permission</li>
              </ul>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Subscription and Billing</h2>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Subscriptions are billed monthly or annually</li>
                <li>Payments are processed securely through Stripe</li>
                <li>You can cancel anytime from your account settings</li>
                <li>Refunds are provided within 14 days of initial purchase</li>
                <li>Price changes will be communicated 30 days in advance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Data Ownership</h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                You retain all rights to your data. We never claim ownership of:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Your customer data and contacts</li>
                <li>Your sales conversations and transcripts</li>
                <li>Your custom AI training data</li>
                <li>Your content and files</li>
              </ul>
              <p className="text-gray-300 leading-relaxed mt-4">
                You can export all your data at any time and delete it upon account closure.
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Service Availability</h2>
              <p className="text-gray-300 leading-relaxed">
                We strive for 99.9% uptime but cannot guarantee uninterrupted service. We are not liable for:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>Scheduled maintenance downtime</li>
                <li>Third-party service failures (AI providers, cloud infrastructure)</li>
                <li>Force majeure events</li>
                <li>Internet connectivity issues</li>
              </ul>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Limitation of Liability</h2>
              <p className="text-gray-300 leading-relaxed">
                AI Sales Platform and its affiliates will not be liable for any indirect, incidental, 
                special, consequential, or punitive damages resulting from your use of the service. 
                Our total liability shall not exceed the amount you paid us in the past 12 months.
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Termination</h2>
              <p className="text-gray-300 leading-relaxed">
                We reserve the right to terminate or suspend your account immediately if you violate 
                these terms. Upon termination, you will have 30 days to export your data before it is deleted.
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Changes to Terms</h2>
              <p className="text-gray-300 leading-relaxed">
                We may update these terms from time to time. We will notify you of significant changes 
                via email. Continued use of the service after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Contact</h2>
              <p className="text-gray-300 leading-relaxed">
                Questions about these Terms? Contact us at:<br />
                <a href="mailto:legal@aisalesplatform.com" className="text-indigo-400 hover:underline">
                  legal@aisalesplatform.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}






