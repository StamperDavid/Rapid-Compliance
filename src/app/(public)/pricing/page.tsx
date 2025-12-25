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

  // NEW: Volume-based "Growth Partner" pricing
  const tiers = [
    {
      name: 'Tier 1',
      description: '0-100 records',
      monthlyPrice: 400,
      yearlyPrice: 4000,
      recordCapacity: '0-100 records',
      features: [
        'All Features Included',
        'AI Sales Agents (Unlimited)',
        'Lead Scraper & Enrichment',
        'Email Sequences (Unlimited)',
        'Multi-Channel Outreach',
        'Social Media AI',
        'Full CRM Suite',
        'Workflow Automation',
        'API Access',
        'White-Label Options'
      ],
      popular: false
    },
    {
      name: 'Tier 2',
      description: '101-250 records',
      monthlyPrice: 650,
      yearlyPrice: 6500,
      recordCapacity: '101-250 records',
      features: [
        'All Features Included',
        'AI Sales Agents (Unlimited)',
        'Lead Scraper & Enrichment',
        'Email Sequences (Unlimited)',
        'Multi-Channel Outreach',
        'Social Media AI',
        'Full CRM Suite',
        'Workflow Automation',
        'API Access',
        'White-Label Options'
      ],
      popular: true
    },
    {
      name: 'Tier 3',
      description: '251-500 records',
      monthlyPrice: 1000,
      yearlyPrice: 10000,
      recordCapacity: '251-500 records',
      features: [
        'All Features Included',
        'AI Sales Agents (Unlimited)',
        'Lead Scraper & Enrichment',
        'Email Sequences (Unlimited)',
        'Multi-Channel Outreach',
        'Social Media AI',
        'Full CRM Suite',
        'Workflow Automation',
        'API Access',
        'White-Label Options'
      ],
      popular: false
    },
    {
      name: 'Tier 4',
      description: '501-1,000 records',
      monthlyPrice: 1250,
      yearlyPrice: 12500,
      recordCapacity: '501-1,000 records',
      features: [
        'All Features Included',
        'AI Sales Agents (Unlimited)',
        'Lead Scraper & Enrichment',
        'Email Sequences (Unlimited)',
        'Multi-Channel Outreach',
        'Social Media AI',
        'Full CRM Suite',
        'Workflow Automation',
        'API Access',
        'White-Label Options'
      ],
      popular: false
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="pt-44 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <span>🤝</span>
            <span>Growth Partner Pricing</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Success-Linked Pricing
          </h1>
          <p className="text-xl text-gray-300 mb-4 max-w-2xl mx-auto">
            Pay for what you <span className="font-bold text-white">store</span>, not what you <span className="font-bold text-white">use</span>
          </p>
          <p className="text-lg text-gray-400 mb-12 max-w-3xl mx-auto">
            The $400 user gets the <span className="text-indigo-400 font-semibold">same AI Sales Engine</span> as the $1,250 user. 
            No gated features. No usage limits. Just honest, transparent pricing based on your database size.
          </p>
          
          {/* BYOK Badge */}
          <div className="inline-flex items-center gap-3 bg-gray-800/50 border border-gray-700 px-6 py-3 rounded-lg">
            <span className="text-2xl">💡</span>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Bring Your Own Keys (BYOK)</div>
              <div className="text-xs text-gray-400">We don't markup AI tokens. Pay raw market rates for compute.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {tiers.map((tier, index) => (
              <div
                key={index}
                className={`relative p-8 rounded-2xl ${
                  tier.popular
                    ? 'shadow-2xl scale-105'
                    : 'bg-white/5 backdrop-blur-sm border border-white/10'
                }`}
                style={tier.popular ? { background: `linear-gradient(to bottom right, ${theme.primaryColor}, ${theme.secondaryColor})` } : {}}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-yellow-400 text-slate-900 text-sm font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                <p className="text-sm mb-6 text-white/80">{tier.recordCapacity}</p>
                <div className="mb-8">
                  <span className="text-5xl font-bold text-white">${tier.monthlyPrice}</span>
                  <span className="text-white/80">/month</span>
                </div>
                <Link
                  href="/signup"
                  className="block w-full py-3 rounded-lg font-semibold text-center transition mb-8"
                  style={
                    tier.popular
                      ? { backgroundColor: '#ffffff', color: theme.primaryColor }
                      : { backgroundColor: theme.primaryColor, color: '#ffffff' }
                  }
                >
                  Start Free Trial
                </Link>
                <ul className="space-y-3">
                  {tier.features.slice(0, 5).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-white/90">
                      <span style={{ color: tier.popular ? '#ffffff' : theme.primaryColor }}>✓</span>
                      {feature}
                    </li>
                  ))}
                  <li className="text-sm text-white/60 italic">+ All other features</li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Frankenstein Stack Killer - Comparison Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Stop Juggling Multiple Subscriptions
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Replace your "Frankenstein stack" of disconnected tools with one unified platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Before: The Expensive Stack */}
            <div className="bg-red-900/20 border border-red-700/50 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">😫</span>
                <div>
                  <h3 className="text-2xl font-bold text-white">The Old Way</h3>
                  <p className="text-red-300 text-sm">Fragmented & Expensive</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/90">Apollo/ZoomInfo (Lead Data)</span>
                  <span className="text-red-300 font-semibold">$99-399/mo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">Air AI/11x (AI Sales Agents)</span>
                  <span className="text-red-300 font-semibold">$500-2000/mo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">Sintra (Social Media AI)</span>
                  <span className="text-red-300 font-semibold">$49-199/mo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">Zapier (Automation)</span>
                  <span className="text-red-300 font-semibold">$29-599/mo</span>
                </div>
                <div className="border-t border-red-700/50 pt-4 flex justify-between items-center">
                  <span className="text-white font-bold">TOTAL PER MONTH:</span>
                  <span className="text-red-300 font-bold text-2xl">$677-3,197</span>
                </div>
              </div>
              <div className="mt-6 text-red-300/70 text-sm">
                Plus: Manual data syncing, integration headaches, support ticket hell
              </div>
            </div>

            {/* After: Our Platform */}
            <div className="bg-green-900/20 border border-green-700/50 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">🎉</span>
                <div>
                  <h3 className="text-2xl font-bold text-white">The New Way</h3>
                  <p className="text-green-300 text-sm">All-In-One & Affordable</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/90">✓ Lead Scraper & Enrichment</span>
                  <span className="text-green-300 font-semibold">Included</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">✓ AI Sales Agents (Unlimited)</span>
                  <span className="text-green-300 font-semibold">Included</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">✓ Social Media AI</span>
                  <span className="text-green-300 font-semibold">Included</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">✓ Workflow Automation</span>
                  <span className="text-green-300 font-semibold">Included</span>
                </div>
                <div className="border-t border-green-700/50 pt-4 flex justify-between items-center">
                  <span className="text-white font-bold">TOTAL PER MONTH:</span>
                  <span className="text-green-300 font-bold text-2xl">$400-1,250</span>
                </div>
              </div>
              <div className="mt-6 text-green-300/70 text-sm">
                Plus: Everything synced, one dashboard, one support team, BYOK pricing
              </div>
            </div>
          </div>

          {/* Savings Calculator */}
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-8 text-center">
            <h3 className="text-3xl font-bold text-white mb-3">
              Save <span style={{ color: theme.primaryColor }}>$277 - $1,947</span> per month
            </h3>
            <p className="text-gray-300 text-lg mb-6">
              That's <span className="font-bold text-white">$3,324 - $23,364</span> saved per year
            </p>
            <p className="text-gray-400 text-sm max-w-2xl mx-auto">
              While spending less, you get more: a unified platform built for small businesses, 
              not enterprise giants. Your success is our success.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            14-day free trial • Credit card required • Cancel anytime
          </p>
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
