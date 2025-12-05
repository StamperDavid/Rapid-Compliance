'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { theme } = useWebsiteTheme();

  const plans = [
    {
      name: 'Agent Only',
      description: 'Just the AI agent - works with your existing tools',
      monthlyPrice: 29,
      yearlyPrice: 280, // ~20% discount
      features: [
        '1 trainable AI sales agent',
        'Unlimited conversations',
        'Website widget embed',
        '3 free integrations',
        'Lead capture & export (CSV)',
        'Email support',
        'Works with Shopify, Stripe, Calendly, etc.',
        '❌ No CRM',
        '❌ No payment processing',
        '❌ No workflow automation'
      ],
      cta: 'Start Free Trial',
      popular: false
    },
    {
      name: 'Starter',
      description: 'AI agent + basic CRM for small businesses',
      monthlyPrice: 49,
      yearlyPrice: 470, // ~20% discount
      features: [
        'Everything in Agent Only, plus:',
        'Built-in CRM (1,000 records)',
        'Lead management',
        'Deal pipeline',
        'Basic workflow automation',
        'Unlimited integrations',
        'Priority email support'
      ],
      cta: 'Start Free Trial',
      popular: false
    },
    {
      name: 'Professional',
      description: 'Complete platform with e-commerce & automation',
      monthlyPrice: 149,
      yearlyPrice: 1430, // ~20% discount
      features: [
        'Everything in Starter, plus:',
        '3 AI sales agents',
        'Advanced CRM (10,000 records)',
        'E-commerce platform',
        'Payment processing (Stripe, PayPal)',
        'Advanced workflow automation',
        'Custom domain & white-labeling',
        'Advanced analytics',
        'Priority support',
        'API access'
      ],
      cta: 'Start Free Trial',
      popular: true
    },
    {
      name: 'Enterprise',
      description: 'For large organizations with custom needs',
      monthlyPrice: null,
      yearlyPrice: null,
      features: [
        'Unlimited AI agents',
        'Unlimited conversations',
        'Unlimited CRM records',
        'Dedicated support',
        'Custom training program',
        'White-label options',
        'Custom integrations',
        'SLA guarantee',
        'Advanced security',
        'Multi-region deployment',
        'Custom contract terms'
      ],
      cta: 'Contact Sales',
      popular: false
    }
  ];

  return (
    <PublicLayout>

      {/* Hero */}
      <section className="pt-32 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required. Cancel anytime.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-lg ${billingCycle === 'monthly' ? 'text-white font-semibold' : 'text-gray-400'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative w-16 h-8 rounded-full transition"
              style={{ backgroundColor: theme.primaryColor }}
            >
              <div className={`absolute top-1 ${billingCycle === 'yearly' ? 'left-9' : 'left-1'} w-6 h-6 bg-white rounded-full transition-all`} />
            </button>
            <span className={`text-lg ${billingCycle === 'yearly' ? 'text-white font-semibold' : 'text-gray-400'}`}>
              Yearly
              <span className="ml-2 text-sm text-green-400">Save 20%</span>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative p-8 rounded-2xl ${
                  plan.popular
                    ? 'shadow-2xl scale-105'
                    : 'bg-white/5 backdrop-blur-sm border border-white/10'
                }`}
                style={plan.popular ? { background: `linear-gradient(to bottom right, ${theme.primaryColor}, ${theme.secondaryColor})`, boxShadow: `0 25px 50px -12px ${theme.primaryColor}80` } : {}}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-yellow-400 text-slate-900 text-sm font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}

                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className={`text-sm mb-6 ${plan.popular ? 'text-white/80' : 'text-gray-400'}`}>
                  {plan.description}
                </p>

                <div className="mb-8">
                  {plan.monthlyPrice !== null ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-bold text-white">
                          ${billingCycle === 'monthly' ? plan.monthlyPrice : Math.round(plan.yearlyPrice! / 12)}
                        </span>
                        <span className={plan.popular ? 'text-white/80' : 'text-gray-400'}>
                          /month
                        </span>
                      </div>
                      {billingCycle === 'yearly' && (
                        <div className="mt-2 text-sm text-green-400">
                          ${plan.yearlyPrice} billed annually
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-3xl font-bold text-white">Custom</div>
                  )}
                </div>

                <Link
                  href={plan.monthlyPrice !== null ? '/signup' : '/contact'}
                  className="block w-full py-3 rounded-lg font-semibold text-center transition mb-8"
                  style={
                    plan.popular
                      ? { backgroundColor: '#ffffff', color: theme.primaryColor }
                      : { backgroundColor: theme.primaryColor, color: '#ffffff' }
                  }
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 mt-0.5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        style={{ color: plan.popular ? '#ffffff' : theme.primaryColor }}
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className={plan.popular ? 'text-white' : 'text-gray-300'}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black/20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'How does the 14-day free trial work?',
                a: "Sign up with your email, no credit card required. You'll get full access to all Professional plan features for 14 days. If you love it, upgrade to continue. If not, your account simply expires."
              },
              {
                q: 'What counts as a "conversation"?',
                a: "A conversation is a complete interaction between your AI agent and a visitor. It starts when they open the chat and ends when they close it or go inactive. Multiple messages within one chat session = 1 conversation."
              },
              {
                q: 'Can I change plans later?',
                a: "Absolutely! Upgrade or downgrade anytime. If you upgrade mid-cycle, we'll prorate the difference. If you downgrade, the change takes effect at your next billing date."
              },
              {
                q: 'What if I exceed my conversation limit?',
                a: "Your agent keeps working! We'll notify you when you hit 80% of your limit. If you exceed it, we'll bill you $0.05 per additional conversation, or you can upgrade to a higher plan."
              },
              {
                q: 'Do you offer discounts for nonprofits or startups?',
                a: "Yes! We offer 50% off for registered nonprofits and early-stage startups (< 1 year old, < $100k funding). Contact us with proof and we'll set you up."
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards (Visa, Mastercard, Amex, Discover) via Stripe. Enterprise customers can arrange for invoicing.'
              }
            ].map((faq, index) => (
              <div
                key={index}
                className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl"
              >
                <h3 className="text-xl font-bold text-white mb-3">{faq.q}</h3>
                <p className="text-gray-300">{faq.a}</p>
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
          <p className="text-xl text-gray-300 mb-8">
            Join hundreds of businesses using AI to close more deals
          </p>
          <Link
            href="/signup"
            className="inline-block px-12 py-4 rounded-lg text-xl font-semibold transition shadow-lg"
            style={{ backgroundColor: theme.primaryColor, color: '#ffffff', boxShadow: `0 10px 40px ${theme.primaryColor}80` }}
          >
            Start Your Free Trial →
          </Link>
        </div>
      </section>

    </PublicLayout>
  );
}

