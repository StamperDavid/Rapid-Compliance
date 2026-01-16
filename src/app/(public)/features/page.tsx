'use client';

import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import PageRenderer from '@/components/PageRenderer';
import { usePageContent } from '@/hooks/usePageContent';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

// Fallback content if editor data not available
function FallbackContent() {
  const { theme } = useWebsiteTheme();

  return (
    <>
      {/* Hero */}
      <section className="pt-44 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Everything You Need to
            <br />
            <span style={{ color: theme.primaryColor }}>
              Sell More, Faster
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
            A complete AI-powered sales platform with CRM, automation, and e-commerce built in
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: '🤖', title: 'Trainable AI Agent', desc: 'Custom-trained on YOUR business, products, and sales process' },
              { icon: '🧠', title: 'Customer Memory', desc: 'Remembers every conversation, preference, and interaction' },
              { icon: '💬', title: 'Lead Qualification', desc: 'Automatically scores and qualifies leads using AI' },
              { icon: '📊', title: 'Built-in CRM', desc: 'Manage contacts, deals, and pipeline in one place' },
              { icon: '⚡', title: 'Workflow Automation', desc: 'Auto-follow-ups, email sequences, task creation' },
              { icon: '🛒', title: 'E-Commerce Ready', desc: 'Take payments, manage inventory, process orders' },
            ].map((feature, idx) => (
              <div key={idx} className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Start Your 14-Day Free Trial
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            No credit card required. Full access to all features.
          </p>
          <Link
            href="/onboarding/industry"
            className="inline-block px-12 py-4 rounded-lg text-xl font-semibold transition shadow-lg"
            style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
          >
            Get Started Free →
          </Link>
        </div>
      </section>
    </>
  );
}

export default function FeaturesPage() {
  const { page, loading } = usePageContent('features');

  return (
    <PublicLayout>
      {loading ? (
        <div className="pt-44 pb-20 text-center">
          <div className="text-gray-400">Loading...</div>
        </div>
      ) : page && (page.sections?.length ?? 0) > 0 ? (
        <PageRenderer page={page} />
      ) : (
        <FallbackContent />
      )}
    </PublicLayout>
  );
}
