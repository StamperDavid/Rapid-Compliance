'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg" />
              <span className="text-xl font-bold text-white">AI Sales Platform</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/features" className="text-gray-300 hover:text-white transition">
                Features
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-white transition">
                Pricing
              </Link>
              <Link href="/docs" className="text-gray-300 hover:text-white transition">
                Docs
              </Link>
              <Link href="/login" className="text-gray-300 hover:text-white transition">
                Login
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-purple-300">AI-Powered Sales Automation</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Your AI Sales Team,
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Working 24/7
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
              Train a custom AI sales agent on your business in minutes. Deploy it on your website. 
              Watch it qualify leads, answer questions, and close deals while you sleep.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition shadow-lg shadow-purple-500/50"
              >
                Start Free Trial →
              </Link>
              <button
                onClick={() => {
                  document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-white/10 text-white rounded-lg text-lg font-semibold hover:bg-white/20 transition border border-white/20"
              >
                See Demo
              </button>
            </div>

            <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">10x</div>
              <div className="text-gray-400">More Qualified Leads</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">24/7</div>
              <div className="text-gray-400">Always Available</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">5min</div>
              <div className="text-gray-400">Setup Time</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">90%</div>
              <div className="text-gray-400">Customer Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Three Steps to Your AI Sales Team
            </h2>
            <p className="text-xl text-gray-300">
              Get up and running in minutes, not weeks
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute top-0 left-0 w-12 h-12 bg-purple-500/20 border-2 border-purple-500 rounded-full flex items-center justify-center text-2xl font-bold text-purple-400">
                1
              </div>
              <div className="pt-16 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                <h3 className="text-2xl font-bold text-white mb-4">Train Your Agent</h3>
                <p className="text-gray-300 mb-4">
                  Answer a few questions about your business, upload your product docs, 
                  and our AI learns everything about your offerings.
                </p>
                <div className="text-sm text-purple-400">
                  ⚡ Takes 5 minutes
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute top-0 left-0 w-12 h-12 bg-purple-500/20 border-2 border-purple-500 rounded-full flex items-center justify-center text-2xl font-bold text-purple-400">
                2
              </div>
              <div className="pt-16 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                <h3 className="text-2xl font-bold text-white mb-4">Practice & Perfect</h3>
                <p className="text-gray-300 mb-4">
                  Role-play as a customer in our training sandbox. Give feedback. 
                  The AI improves with every session.
                </p>
                <div className="text-sm text-purple-400">
                  🎯 Real improvement
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute top-0 left-0 w-12 h-12 bg-purple-500/20 border-2 border-purple-500 rounded-full flex items-center justify-center text-2xl font-bold text-purple-400">
                3
              </div>
              <div className="pt-16 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                <h3 className="text-2xl font-bold text-white mb-4">Deploy Everywhere</h3>
                <p className="text-gray-300 mb-4">
                  Embed your AI agent on your website with one line of code. 
                  It works on WordPress, Shopify, or any site.
                </p>
                <div className="text-sm text-purple-400">
                  🚀 One-click embed
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need to Sell More
            </h2>
            <p className="text-xl text-gray-300">
              Not just a chatbot. A complete AI sales platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '🤖',
                title: 'Trainable AI Agent',
                description: 'Custom-trained on YOUR business, products, and sales process'
              },
              {
                icon: '🧠',
                title: 'Customer Memory',
                description: 'Remembers every conversation, preference, and interaction'
              },
              {
                icon: '💬',
                title: 'Lead Qualification',
                description: 'Automatically scores and qualifies leads using AI'
              },
              {
                icon: '📊',
                title: 'Built-in CRM',
                description: 'Manage contacts, deals, and pipeline in one place'
              },
              {
                icon: '⚡',
                title: 'Workflow Automation',
                description: 'Auto-follow-ups, email sequences, task creation'
              },
              {
                icon: '🛒',
                title: 'E-Commerce Ready',
                description: 'Take payments, manage inventory, process orders'
              },
              {
                icon: '📈',
                title: 'Real-Time Analytics',
                description: 'Track conversions, revenue, and agent performance'
              },
              {
                icon: '🎨',
                title: 'White-Label Ready',
                description: 'Your brand, your colors, your domain'
              },
              {
                icon: '🔗',
                title: 'Integrations',
                description: 'Connect to Stripe, Slack, Google, and more'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo-section" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              See It In Action
            </h2>
            <p className="text-xl text-gray-300">
              This very website is powered by our AI sales agent. Try it!
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8">
              <div className="text-center text-gray-400 mb-4">
                👇 Our AI sales agent will appear here 👇
              </div>
              <div className="bg-slate-800/50 rounded-lg p-12 text-center">
                <div className="text-6xl mb-4">🤖</div>
                <p className="text-gray-300">
                  AI Widget will be embedded here
                  <br />
                  <span className="text-sm text-gray-500">(Coming in next commit)</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Trusted by Growing Businesses
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "This AI agent increased our lead conversion by 300%. It's like having a top sales rep working 24/7.",
                author: "Sarah Johnson",
                role: "CEO, TechStart Inc"
              },
              {
                quote: "We went from manually qualifying every lead to having AI do it for us. Saved us 20 hours a week.",
                author: "Michael Chen",
                role: "Founder, GrowthLabs"
              },
              {
                quote: "The training is so easy. We had our AI agent up and running in under an hour.",
                author: "Emily Rodriguez",
                role: "Sales Director, CloudCorp"
              }
            ].map((testimonial, index) => (
              <div
                key={index}
                className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl"
              >
                <div className="text-yellow-400 text-2xl mb-4">★★★★★</div>
                <p className="text-gray-300 mb-4 italic">"{testimonial.quote}"</p>
                <div className="border-t border-white/10 pt-4">
                  <div className="font-semibold text-white">{testimonial.author}</div>
                  <div className="text-sm text-gray-400">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to 10x Your Sales?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join hundreds of businesses using AI to close more deals
          </p>
          <Link
            href="/signup"
            className="inline-block px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition shadow-lg shadow-purple-500/50"
          >
            Start Your Free Trial →
          </Link>
          <div className="mt-6 text-sm text-gray-400">
            No credit card required • 14-day free trial • Cancel anytime
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-white mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/features" className="hover:text-white transition">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
                <li><Link href="/docs" className="hover:text-white transition">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white transition">About</Link></li>
                <li><Link href="/blog" className="hover:text-white transition">Blog</Link></li>
                <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/privacy" className="hover:text-white transition">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition">Terms</Link></li>
                <li><Link href="/security" className="hover:text-white transition">Security</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Connect</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition">Twitter</a></li>
                <li><a href="#" className="hover:text-white transition">LinkedIn</a></li>
                <li><a href="#" className="hover:text-white transition">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center text-gray-400">
            <p>© 2024 AI Sales Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Floating Chat Widget (Placeholder) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg shadow-purple-500/50 flex items-center justify-center text-white text-2xl hover:scale-110 transition animate-pulse">
          💬
        </button>
      </div>
    </div>
  );
}

