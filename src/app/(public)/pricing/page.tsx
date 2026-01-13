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
} from 'lucide-react';

// Fallback content if editor data not available
function FallbackContent() {
  const { theme } = useWebsiteTheme();

  const pricingTiers = [
    { records: '0-100', price: '$400' },
    { records: '101-250', price: '$650' },
    { records: '251-500', price: '$1,000' },
    { records: '501-1,000', price: '$1,250' },
    { records: '1,000+', price: 'Custom' },
  ];

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
    'BYOK: Zero AI Markup',
  ];

  return (
    <>
      {/* Hero */}
      <section className="pt-44 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Handshake className="w-4 h-4" />
            <span>Usage-Based Pricing</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            One Platform. All Features. Always.
          </h1>
          <p className="text-xl text-gray-300 mb-4 max-w-2xl mx-auto">
            You pay based on <span className="font-bold text-white">CRM records stored</span>. Everything else is unlimited.
          </p>
          <p className="text-lg text-gray-400 mb-8 max-w-3xl mx-auto">
            No feature gating. No usage limits. No choosing plans. Your pricing automatically scales with your business needs.
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
              <div className="font-semibold text-white mb-2">Usage-Based Pricing</div>
              <div className="text-sm text-gray-400">Only pay for CRM records stored—everything else unlimited</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <div className="mb-3">
                <Unlock className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="font-semibold text-white mb-2">Auto-Scales with You</div>
              <div className="text-sm text-gray-400">As your CRM grows, your tier adjusts automatically</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Breakdown */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-3">How Pricing Works</h2>
            <p className="text-gray-400">Your monthly price is determined by the number of CRM records you store</p>
          </div>
          
          {/* Pricing Table */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 px-6 py-4 border-b border-white/10">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-white">CRM Records</span>
                <span className="font-semibold text-white">Monthly Price</span>
              </div>
            </div>
            <div className="divide-y divide-white/10">
              {pricingTiers.map((tier, index) => (
                <div key={index} className="px-6 py-5 hover:bg-white/5 transition">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">{tier.records} records</span>
                    <span className="text-2xl font-bold text-white">{tier.price}<span className="text-sm text-gray-400 font-normal">/month</span></span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-indigo-500/10 border-t border-indigo-500/30 px-6 py-4">
              <div className="flex items-center gap-2 text-sm text-indigo-300">
                <Lightbulb className="w-4 h-4" />
                <span>All tiers include 100% of features. No limits. No restrictions.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* All Features Included */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Everything Included. Always.</h2>
            <p className="text-gray-400">Every tier gets the complete platform with zero restrictions</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allFeatures.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
                <span className="text-green-400 text-xl">✓</span>
                <span className="text-white">{feature}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-8 p-6 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl text-center">
            <p className="text-gray-300 text-lg mb-4">
              <span className="font-bold text-white">No hidden fees.</span> No per-user charges. No AI token markup. No surprise costs.
            </p>
            <p className="text-gray-400">
              Just transparent, usage-based pricing: <span className="text-white font-semibold">You pay for CRM records.</span> We don&apos;t markup your AI costs. Period.
            </p>
          </div>
        </div>
      </section>

      {/* Total Cost Transparency */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-900/50 to-transparent">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Total Cost Breakdown: 100% Transparent
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-6">
              You pay TWO costs: our platform fee + your own AI usage. We show you exactly what you&apos;ll spend vs. competitors who hide AI markups.
            </p>
            <div className="inline-block bg-indigo-500/20 border border-indigo-500/40 rounded-lg px-6 py-3">
              <p className="text-indigo-300 font-semibold flex items-center justify-center gap-2"><Lightbulb className="w-4 h-4" /> How Billing Works</p>
              <p className="text-indigo-200/80 text-sm mt-1">You get ONE monthly bill from us ($400-1,250). For AI, you prepay credits with OpenRouter (or your chosen provider) which deduct as you use them.</p>
            </div>
          </div>

          {/* Real-World Example */}
          <div className="mb-12 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-4 text-center flex items-center justify-center gap-3">
              <BarChart3 className="w-7 h-7 text-indigo-400" /> Real Example: 200 CRM Records, 1,000 AI Conversations/Month
            </h3>
            <p className="text-gray-300 text-center mb-8">Here&apos;s what you&apos;d actually pay each month:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Competitor Total Cost */}
              <div className="bg-slate-800/50 border border-slate-600/50 rounded-xl p-6">
                <div className="text-center mb-4">
                  <h4 className="text-xl font-bold text-white mb-1">Typical AI Platform</h4>
                  <p className="text-gray-400 text-sm">All-in-one bill (markup hidden)</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-600/30">
                    <span className="text-gray-300">Platform Fee</span>
                    <span className="text-white font-semibold">$1,500/mo</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-600/30">
                    <span className="text-gray-300">AI Usage <span className="text-xs text-gray-400">(marked up 400%)</span></span>
                    <span className="text-white font-semibold">$400/mo</span>
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    (Real OpenRouter cost: ~$100, but you pay $400)
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t-2 border-slate-500/50">
                    <span className="text-white font-bold text-lg">TOTAL YOU PAY</span>
                    <span className="text-gray-200 font-bold text-2xl">$1,900/mo</span>
                  </div>
                </div>
              </div>

              {/* Our Total Cost */}
              <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/50 rounded-xl p-6">
                <div className="text-center mb-4">
                  <h4 className="text-xl font-bold text-white mb-1">Our Platform (BYOK)</h4>
                  <p className="text-indigo-300 text-sm">Prepaid credits (full transparency)</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-indigo-500/30">
                    <div>
                      <div className="text-gray-300">Platform Fee</div>
                      <div className="text-xs text-indigo-400">Monthly bill from us</div>
                    </div>
                    <span className="text-white font-semibold">$400/mo</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-indigo-500/30">
                    <div>
                      <div className="text-gray-300">AI Credits <span className="text-xs text-indigo-400">(prepaid, 0% markup)</span></div>
                      <div className="text-xs text-indigo-400">Prepaid to OpenRouter</div>
                    </div>
                    <span className="text-white font-semibold">~$100/mo</span>
                  </div>
                  <div className="text-xs text-indigo-300/70 mb-3">
                    (You prepay credits with OpenRouter at cost)
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t-2 border-indigo-500/50">
                    <span className="text-white font-bold text-lg">TOTAL YOU PAY</span>
                    <span className="text-indigo-300 font-bold text-2xl">$500/mo</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <div className="inline-block bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/50 rounded-xl px-8 py-4">
                <p className="text-indigo-300 font-bold text-2xl mb-2">
                  You Save: $1,400/month ($16,800/year)
                </p>
                <p className="text-white text-sm">
                  Same functionality. Full transparency. Massive savings.
                </p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">How Your Billing Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-start gap-3 mb-4">
                  <div className="bg-indigo-500 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold flex-shrink-0">1</div>
                  <div>
                    <h4 className="font-bold text-white mb-1">Platform Bill (From Us)</h4>
                    <p className="text-gray-300 text-sm">$400-1,250/month based on your CRM records stored. Includes ALL features.</p>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-start gap-3 mb-4">
                  <div className="bg-green-500 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold flex-shrink-0">2</div>
                  <div>
                    <h4 className="font-bold text-white mb-1">AI Credits (Prepaid to Your Provider)</h4>
                    <p className="text-gray-300 text-sm">You prepay credits with OpenRouter (or your chosen provider). Usage deducts from your balance at raw market rates. Typically $50-200/month for most businesses. No monthly AI bill—just top up as needed.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
              <p className="text-gray-300 text-sm text-center">
                <span className="font-bold text-white">How it works:</span> You get ONE monthly bill from us for the platform. For AI, you prepay credits with OpenRouter (recommended) and usage deducts at cost. No AI bills, no surprises, complete control.
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
                  <span className="text-indigo-300 font-bold text-2xl">$400-1,250</span>
                </div>
              </div>
              <div className="mt-6 text-indigo-300/70 text-sm">
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
              That&apos;s <span className="font-bold text-white">$3,324 - $23,364</span> saved per year
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
            Sign up once. No plan selection needed. Your pricing automatically adjusts as you grow.
          </p>
          <p className="text-lg text-gray-400 mb-8">
            14-day free trial • No credit card required • Cancel anytime
          </p>
          <Link
            href="/onboarding/industry"
            className="inline-block px-12 py-4 rounded-lg text-xl font-semibold transition hover:scale-105"
            style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
          >
            Start Your Free Trial →
          </Link>
          <p className="text-sm text-gray-500 mt-6">
            Start with 1,000 free records. Upgrade when you need more capacity.
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
      ) : (page?.sections?.length ?? 0) > 0 ? (
        <PageRenderer page={page!} />
      ) : (
        <FallbackContent />
      )}
    </PublicLayout>
  );
}
