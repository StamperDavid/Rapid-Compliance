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

      {/* Features Grid — grouped by category, sourced from universal-knowledge.ts */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">

          {/* AI Workforce — the headline differentiator */}
          <div>
            <h2 className="text-3xl font-bold text-white text-center mb-2">A 69-Agent AI Workforce, Not a Chatbot</h2>
            <p className="text-gray-400 text-center mb-10 max-w-3xl mx-auto">
              57 specialists, 11 department managers, and one Master Orchestrator — all trained on your brand voice and reviewed in your Mission Control dashboard.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: '🧠', title: 'Master Orchestrator (Jasper)', desc: 'Your AI strategy partner — interprets goals and delegates to the swarm.' },
                { icon: '🎬', title: 'Mission Control', desc: 'Every agent action lands here for your approval. You become the director, not the doer.' },
                { icon: '🏋️', title: 'Training Lab', desc: 'Grade an agent’s output and the Golden Master updates. Agents learn your brand over time.' },
                { icon: '🧬', title: 'Brand DNA', desc: 'Train every agent on your tone, voice, key phrases, and topics to avoid — once.' },
              ].map((f, idx) => (
                <div key={idx} className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-4xl mb-3">{f.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sales */}
          <div>
            <h2 className="text-3xl font-bold text-white text-center mb-10">Sales</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: '📊', title: 'Full CRM Suite', desc: 'Leads, contacts, deals, companies, custom schemas, kanban + table views.' },
                { icon: '💬', title: 'AI Conversations', desc: 'Your customer-facing chat agent qualifies leads 24/7 across web, social DMs, and Messenger.' },
                { icon: '🎯', title: 'AI Lead Scoring', desc: '0–100 score with grade tiers. Hot/warm/cold prioritization without spreadsheets.' },
                { icon: '🔮', title: 'AI Deal Scoring & Forecasting', desc: 'Per-deal close probability and revenue forecast keyed to your pipeline.' },
                { icon: '🎓', title: 'AI Sales Coaching', desc: 'Per-rep performance insights, strengths, weaknesses, and personalized recommendations.' },
                { icon: '📄', title: 'Proposal & Document Builder', desc: 'Generate proposals, contracts, and e-signatures with your brand templates.' },
              ].map((f, idx) => (
                <div key={idx} className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Marketing & Outreach */}
          <div>
            <h2 className="text-3xl font-bold text-white text-center mb-10">Marketing & Outreach</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: '✉️', title: 'Email Sequences & Campaigns', desc: 'Unlimited multi-step campaigns with open/click tracking and AI-generated copy.' },
                { icon: '💬', title: 'SMS Outreach', desc: 'Twilio-powered SMS campaigns with 90%+ open rates for time-sensitive sends.' },
                { icon: '📱', title: 'Social Media', desc: 'Post and schedule across Twitter/X, LinkedIn, Facebook, Instagram, TikTok, YouTube, Bluesky, Mastodon, Threads, Pinterest.' },
                { icon: '📋', title: 'Forms', desc: 'Drag-drop builder with AI-suggested questions; submissions land directly in CRM.' },
                { icon: '🎯', title: 'Lead Scraper & Enrichment', desc: 'Built-in lead-hunter pulls prospects from Apollo, Clearbit, and custom logic.' },
                { icon: '🤝', title: 'A/B Testing', desc: 'Run experiments across funnels, landing pages, and campaigns with auto-winner detection.' },
              ].map((f, idx) => (
                <div key={idx} className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Voice AI */}
          <div>
            <h2 className="text-3xl font-bold text-white text-center mb-10">Voice AI</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { icon: '📞', title: 'Voice AI Closers (Outbound)', desc: 'AI prospectors call and qualify leads, then hand warm conversations to a human power-dialer.' },
                { icon: '☎️', title: 'AI Receptionist (Inbound)', desc: 'Answers your business line 24/7, qualifies callers, books appointments, escalates the urgent stuff.' },
              ].map((f, idx) => (
                <div key={idx} className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Content Engine */}
          <div>
            <h2 className="text-3xl font-bold text-white text-center mb-2">Content Engine</h2>
            <p className="text-gray-400 text-center mb-10 max-w-3xl mx-auto">
              The Magic Studio gives you a unified canvas for image, video, music, and copy — every output trained on your Brand DNA.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: '✨', title: 'Magic Studio', desc: 'Single canvas for image + video + music + copy generation. Drag, refine, reuse.' },
                { icon: '🎥', title: 'Video Production', desc: 'Hedra-powered avatars, AI-narrated voice-overs, scene assembly, post-production.' },
                { icon: '🎵', title: 'Music Generation', desc: 'Brand-tuned, royalty-free tracks for video, ads, and podcasts.' },
                { icon: '✍️', title: 'AI Copywriting', desc: 'Blog posts, ad copy, emails, scripts — every piece runs through your brand voice.' },
                { icon: '🖼️', title: 'Media Library', desc: 'Centralized assets, brand kit, intro/outro reels, Hedra characters.' },
                { icon: '📅', title: 'Content Calendar', desc: 'Plan and schedule every piece of content across every channel from one place.' },
              ].map((f, idx) => (
                <div key={idx} className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Website + SEO */}
          <div>
            <h2 className="text-3xl font-bold text-white text-center mb-10">Website & SEO</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: '🌐', title: 'Website Builder', desc: 'Drag-drop sections + AI page generation. Clone any competitor’s site in minutes.' },
                { icon: '📝', title: 'Blog & Content Publishing', desc: 'Built-in blog with SEO scoring, category management, and RSS auto-publish.' },
                { icon: '🔍', title: 'SEO Suite', desc: 'Keyword research, competitor tracking, content briefs, and rank tracking.' },
                { icon: '🏷️', title: 'White-Label & Custom Domain', desc: 'Your brand on every page. Custom domain support and theme customization.' },
                { icon: '⚡', title: 'AI Search Visibility', desc: 'Track how your brand surfaces in ChatGPT, Perplexity, and Claude searches.' },
                { icon: '📑', title: 'Forms & Landing Pages', desc: 'Pair forms with landing pages and pipe submissions straight into your sales pipeline.' },
              ].map((f, idx) => (
                <div key={idx} className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Commerce + Operations */}
          <div>
            <h2 className="text-3xl font-bold text-white text-center mb-10">Commerce & Operations</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: '🛒', title: 'E-Commerce Storefront', desc: 'Built-in Stripe + multi-provider checkout (PayPal, Adyen, Square, Chargebee, more).' },
                { icon: '🧾', title: 'Invoicing & Recurring Billing', desc: 'Automated invoices, payment recording, and subscription management.' },
                { icon: '⚡', title: 'Workflow Automation', desc: 'Visual builder with triggers, conditions, and multi-step actions across email/SMS/social/CRM.' },
                { icon: '📈', title: 'Real-Time Analytics', desc: 'Pipeline, ecommerce, and workflow analytics dashboards across every channel.' },
                { icon: '⚠️', title: 'Risk Prediction', desc: 'AI-powered deal slippage prediction with intervention recommendations.' },
                { icon: '🔌', title: '69+ Integrations', desc: 'Stripe, Zoom, Google Workspace, Microsoft 365, Twilio, social platforms, accounting tools, and more.' },
              ].map((f, idx) => (
                <div key={idx} className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
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
            href="/early-access"
            className="inline-block px-12 py-4 rounded-lg text-xl font-semibold transition shadow-lg"
            style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
          >
            Get early access →
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
