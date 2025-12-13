'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import PageRenderer from '@/components/PageRenderer';
import { usePageContent } from '@/hooks/usePageContent';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

// Fallback content if editor data not available
function FallbackContent() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { theme } = useWebsiteTheme();

  const plans = [
    {
      name: 'Agent Only',
      description: 'Just the AI agent',
      monthlyPrice: 29,
      features: ['1 AI sales agent', 'Unlimited conversations', 'Website widget', 'Email support'],
      popular: false
    },
    {
      name: 'Starter',
      description: 'AI agent + CRM',
      monthlyPrice: 49,
      features: ['Everything in Agent Only', 'Built-in CRM', 'Lead management', 'Workflow automation'],
      popular: false
    },
    {
      name: 'Professional',
      description: 'Complete platform',
      monthlyPrice: 149,
      features: ['Everything in Starter', '3 AI agents', 'E-commerce', 'Custom domain', 'API access'],
      popular: true
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="pt-44 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Start with a 14-day free trial. No charge until your trial ends.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative p-8 rounded-2xl ${
                  plan.popular
                    ? 'shadow-2xl scale-105'
                    : 'bg-white/5 backdrop-blur-sm border border-white/10'
                }`}
                style={plan.popular ? { background: `linear-gradient(to bottom right, ${theme.primaryColor}, ${theme.secondaryColor})` } : {}}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-yellow-400 text-slate-900 text-sm font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-sm mb-6 text-white/80">{plan.description}</p>
                <div className="mb-8">
                  <span className="text-5xl font-bold text-white">${plan.monthlyPrice}</span>
                  <span className="text-white/80">/month</span>
                </div>
                <Link
                  href="/signup"
                  className="block w-full py-3 rounded-lg font-semibold text-center transition mb-8"
                  style={
                    plan.popular
                      ? { backgroundColor: '#ffffff', color: theme.primaryColor }
                      : { backgroundColor: theme.primaryColor, color: '#ffffff' }
                  }
                >
                  Start Free Trial
                </Link>
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-white/90">
                      <span style={{ color: plan.popular ? '#ffffff' : theme.primaryColor }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <Link
            href="/signup"
            className="inline-block px-12 py-4 rounded-lg text-xl font-semibold transition"
            style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
          >
            Start Your Free Trial →
          </Link>
        </div>
      </section>
    </>
  );
}

export default function PricingPage() {
  const { page, loading } = usePageContent('pricing');

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
