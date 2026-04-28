'use client';

import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import PageRenderer from '@/components/PageRenderer';
import { usePageContent } from '@/hooks/usePageContent';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';
import {
  Handshake,
  Lightbulb,
  Zap,
  BarChart3,
  Unlock,
  Frown,
  PartyPopper,
  CheckCircle2,
} from 'lucide-react';

// Fallback content if editor data not available
function FallbackContent() {
  const { theme } = useWebsiteTheme();

  const allFeatures = [
    'Custom AI Sales Agent (Fully Trainable)',
    'Lead Scraper & Enrichment',
    'Email Sequences (Unlimited)',
    'Multi-Channel Outreach (Email, LinkedIn, SMS)',
    'Full CRM Suite',
    'Custom Schemas & Objects',
    'Workflow Automation',
    'Built-in E-Commerce Engine',
    'API Access',
    'White-Label Options',
    'Email & Chat Support',
  ];

  const fairUseLimits = [
    '50,000 CRM records',
    '100 AI agents per account',
    '10,000 scheduled social posts / month',
    '5,000 outbound emails / day',
  ];

  return (
    <>
      {/* Hero */}
      <section className="pt-44 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Handshake className="w-4 h-4" />
            <span>Flat Pricing — One Price</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            One price. All features. Forever.
          </h1>
          <p className="text-xl text-gray-300 mb-4 max-w-2xl mx-auto">
            <span className="font-bold text-white">$299 per month, flat.</span> BYOK on AI so you pay raw market rates direct to your provider. No tiers, no upsells, no surprises.
          </p>
          <p className="text-lg text-gray-400 mb-8 max-w-3xl mx-auto">
            No feature gating. No record limits. No tier juggling. Just one price that works.
          </p>

          {/* BYOK Hero Callout */}
          <div className="max-w-3xl mx-auto mb-12">
            <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/40 rounded-2xl p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <Lightbulb className="w-8 h-8 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">Bring Your Own Keys (BYOK)</h3>
                  <p className="text-indigo-300 font-semibold">Zero AI Token Markup. 100% Transparent.</p>
                </div>
              </div>
              <p className="text-white/90 text-lg leading-relaxed mb-4">
                Connect your own API key and pay the AI provider directly at <span className="font-bold text-indigo-300">raw market rates</span>.
                We don&apos;t touch your AI costs—that&apos;s your direct relationship with the provider. No hidden fees. No markup. Just honest pricing.
              </p>
              <div className="bg-purple-500/20 border border-purple-500/40 rounded-lg p-4 mb-4">
                <p className="text-purple-200 text-sm flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span><span className="font-bold">We recommend OpenRouter</span> - One key gives you access to GPT-4, Claude, Gemini, Llama, and 200+ models. Simpler than managing multiple provider keys.</span>
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2 text-white/80">
                  <span className="text-indigo-400 text-lg font-bold">⭐</span>
                  <span><span className="font-semibold text-indigo-300">OpenRouter</span> (Recommended)</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="text-indigo-400 text-lg">✓</span>
                  <span>OpenAI Direct (Optional)</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="text-indigo-400 text-lg">✓</span>
                  <span>Anthropic Direct (Optional)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="mb-3">
                <Zap className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="font-semibold text-white mb-2">All Features Unlocked</div>
              <div className="text-sm text-gray-400">From day one, every feature is available to you</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="mb-3">
                <BarChart3 className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="font-semibold text-white mb-2">Flat Pricing</div>
              <div className="text-sm text-gray-400">$299/mo for everyone. No tiers, no record-based scaling.</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="mb-3">
                <Unlock className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="font-semibold text-white mb-2">BYOK on AI</div>
              <div className="text-sm text-gray-400">Pay raw rates direct to OpenAI / Anthropic / OpenRouter</div>
            </div>
          </div>
        </div>
      </section>

      {/* Single Pricing Card */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="relative rounded-3xl p-[2px] bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-500 shadow-2xl shadow-indigo-500/20">
            <div className="bg-gray-950 rounded-3xl p-10 md:p-12">
              {/* Headline price */}
              <div className="text-center mb-8">
                <div className="text-7xl md:text-8xl font-extrabold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent leading-none mb-3">
                  $299
                </div>
                <div className="text-2xl font-semibold text-white mb-4">per month, flat</div>
                <div className="inline-block bg-indigo-500/15 border border-indigo-500/40 rounded-lg px-5 py-3">
                  <p className="text-white text-sm md:text-base">
                    <span className="font-bold text-indigo-300">BYOK on AI</span> — pay raw market rates direct to OpenAI / Anthropic / OpenRouter. Zero markup.
                  </p>
                </div>
              </div>

              {/* What's included */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider text-center">
                  What&apos;s Included
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  {allFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-200 text-sm">
                      <CheckCircle2 className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Fair use */}
              <div className="mb-8 p-5 bg-white/5 border border-white/10 rounded-xl">
                <h4 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
                  Fair Use Limits
                </h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  {fairUseLimits.map((limit, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-400">•</span>
                      <span>{limit}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 mt-3 italic">
                  Reasonable use applies for everything else — contact us if you have an enterprise-scale need.
                </p>
              </div>

              {/* CTA */}
              <Link
                href="/early-access"
                className="block w-full text-center px-8 py-4 rounded-xl text-lg font-semibold transition shadow-lg hover:scale-[1.02]"
                style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
              >
                Get early access →
              </Link>
              <p className="text-xs text-gray-500 mt-4 text-center">
                14-day free trial • No credit card required • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI-Native Workforce Value */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              One Workforce. Raw Market Rates.
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Your AI-Native workforce runs on direct APIs with zero wrapper markup.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Before: The Expensive Stack */}
            <div className="bg-slate-800/50 border border-slate-600/50 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center">
                  <Frown className="w-7 h-7 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">The Old Way</h3>
                  <p className="text-gray-400 text-sm">Fragmented & Expensive</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/90">Apollo/ZoomInfo (Lead Data)</span>
                  <span className="text-gray-300 font-semibold">$99-399/mo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">Air AI/11x (AI Sales Agents)</span>
                  <span className="text-gray-300 font-semibold">$500-2000/mo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">Outreach Tool (Email/LinkedIn)</span>
                  <span className="text-gray-300 font-semibold">$49-199/mo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">Zapier (Automation)</span>
                  <span className="text-gray-300 font-semibold">$29-599/mo</span>
                </div>
                <div className="border-t border-slate-600/50 pt-4 flex justify-between items-center">
                  <span className="text-white font-bold">TOTAL PER MONTH:</span>
                  <span className="text-gray-200 font-bold text-2xl">$677-3,197</span>
                </div>
              </div>
              <div className="mt-6 text-gray-400 text-sm">
                Plus: Integration hell, 5 support teams, data syncing nightmares
              </div>
            </div>

            {/* After: Our Platform */}
            <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/50 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <PartyPopper className="w-7 h-7 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">The New Way</h3>
                  <p className="text-indigo-300 text-sm">All-In-One & Affordable</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/90">✓ Lead Scraper & Enrichment</span>
                  <span className="text-indigo-300 font-semibold">Included</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">✓ AI Sales Agents (Unlimited)</span>
                  <span className="text-indigo-300 font-semibold">Included</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">✓ Multi-Channel Outreach</span>
                  <span className="text-indigo-300 font-semibold">Included</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/90">✓ Workflow Automation</span>
                  <span className="text-indigo-300 font-semibold">Included</span>
                </div>
                <div className="border-t border-indigo-500/50 pt-4 flex justify-between items-center">
                  <span className="text-white font-bold">TOTAL PER MONTH:</span>
                  <span className="text-indigo-300 font-bold text-2xl">$299 flat</span>
                </div>
              </div>
              <div className="mt-6 text-indigo-300/70 text-sm">
                Plus: Everything synced, one dashboard, one support team, BYOK on AI
              </div>
            </div>
          </div>

          {/* Savings Calculator */}
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-8 text-center">
            <h3 className="text-3xl font-bold text-white mb-3">
              Save <span style={{ color: theme.primaryColor }}>$378 - $2,898</span> per month
            </h3>
            <p className="text-gray-300 text-lg mb-6">
              That&apos;s <span className="font-bold text-white">$4,536 - $34,776</span> saved per year
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
          <p className="text-xl text-gray-300 mb-4">
            One price. Every feature. Sign up once and you&apos;re done.
          </p>
          <p className="text-lg text-gray-400 mb-8">
            14-day free trial • No credit card required • Cancel anytime
          </p>
          <Link
            href="/early-access"
            className="inline-block px-12 py-4 rounded-lg text-xl font-semibold transition hover:scale-105"
            style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
          >
            Get early access →
          </Link>
          <p className="text-sm text-gray-500 mt-6">
            $299/month flat. BYOK on AI. Fair-use caps apply.
          </p>
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
      ) : page && (page.sections?.length ?? 0) > 0 ? (
        <PageRenderer page={page} />
      ) : (
        <FallbackContent />
      )}
    </PublicLayout>
  );
}
