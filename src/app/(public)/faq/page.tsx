'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqItems: FAQItem[] = [
  // Getting Started
  {
    category: 'Getting Started',
    question: 'How do I get started with RapidCompliance.US?',
    answer: 'Getting started is easy! Sign up for a 14-day free trial, complete the onboarding questionnaire about your business, and your AI agent will be ready to train. The whole process takes less than an hour.'
  },
  {
    category: 'Getting Started',
    question: 'Do I need technical skills to use the platform?',
    answer: 'No technical skills required! Our platform is designed for business owners and sales teams. The onboarding wizard guides you through everything, and embedding your AI agent on your website is as simple as copying one line of code.'
  },
  {
    category: 'Getting Started',
    question: 'How long does it take to set up my AI agent?',
    answer: 'Most businesses have their AI agent trained and ready to deploy within 1-2 hours. The onboarding process takes about 15-30 minutes, and training sessions typically take 30-60 minutes depending on complexity.'
  },
  
  // AI Agent
  {
    category: 'AI Agent',
    question: 'How does the AI agent learn about my business?',
    answer: 'During onboarding, you answer questions about your business, products, pricing, and sales process. You can also upload documents, link to your website, and provide FAQs. The AI synthesizes all this information into a comprehensive understanding of your business.'
  },
  {
    category: 'AI Agent',
    question: 'Can I train my AI agent to handle specific scenarios?',
    answer: 'Absolutely! Our Training Center lets you role-play as a customer and give feedback on the AI responses. The more you train, the better your agent gets at handling your unique sales situations and objections.'
  },
  {
    category: 'AI Agent',
    question: 'What is a Golden Master?',
    answer: 'A Golden Master is a production-ready snapshot of your trained AI agent. Once your training score reaches 80%+, you can save a Golden Master and deploy it to your website. You can maintain multiple versions and rollback if needed.'
  },
  {
    category: 'AI Agent',
    question: 'Will the AI agent ever say something incorrect?',
    answer: 'Our Golden Master architecture is specifically designed to prevent hallucinations. The AI only uses information you provide during training and onboarding. If it encounters a question outside its knowledge, it will offer to connect the visitor with a human.'
  },
  
  // Pricing & Billing
  {
    category: 'Pricing & Billing',
    question: 'How does the free trial work?',
    answer: 'You get 14 days of full access to all features. A credit card is required to start the trial, but you wont be charged until the trial ends. You can cancel anytime during the trial with no charges.'
  },
  {
    category: 'Pricing & Billing',
    question: 'What happens after my trial ends?',
    answer: 'After your trial, your chosen plan will be billed automatically. Your AI agent and all configurations remain intact. If you dont want to continue, simply cancel before the trial ends.'
  },
  {
    category: 'Pricing & Billing',
    question: 'Can I upgrade or downgrade my plan?',
    answer: 'Yes! You can change your plan at any time. Upgrades take effect immediately with prorated billing. Downgrades take effect at the start of your next billing cycle.'
  },
  {
    category: 'Pricing & Billing',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure Stripe integration. For Enterprise plans, we also offer invoice billing.'
  },
  
  // Features
  {
    category: 'Features',
    question: 'What CRM features are included?',
    answer: 'Our built-in CRM includes contacts, companies, deals, products/services, invoices, quotes, tasks, and more. You can also create custom entities and fields to match your specific workflow.'
  },
  {
    category: 'Features',
    question: 'Can I integrate with my existing tools?',
    answer: 'Yes! We integrate with popular tools including Stripe, QuickBooks, Xero, Slack, Zapier, Gmail, Outlook, and more. Enterprise plans also include full API access for custom integrations.'
  },
  {
    category: 'Features',
    question: 'Does the platform support e-commerce?',
    answer: 'Yes! You can create an embeddable online storefront, sell products and services, process payments, and manage inventory. The AI agent can guide customers through purchases directly in the chat.'
  },
  {
    category: 'Features',
    question: 'Can I white-label the platform?',
    answer: 'Professional and Enterprise plans include white-labeling. You can customize colors, logos, and branding throughout the platform and customer-facing widgets.'
  },
  
  // Technical
  {
    category: 'Technical',
    question: 'How do I embed the AI agent on my website?',
    answer: 'Simply copy the one-line embed code from your dashboard and paste it into your website HTML, just before the closing </body> tag. It works on any website including WordPress, Shopify, Wix, and custom sites.'
  },
  {
    category: 'Technical',
    question: 'Is my data secure?',
    answer: 'Absolutely. We use industry-standard encryption (AES-256) for data at rest and TLS 1.3 for data in transit. We are SOC 2 Type II compliant and GDPR ready. Your data is never used to train other customers AI agents.'
  },
  {
    category: 'Technical',
    question: 'What is your uptime guarantee?',
    answer: 'We maintain 99.9% uptime SLA for all paid plans. Our infrastructure is hosted on enterprise-grade cloud providers with automatic failover and redundancy.'
  },
  
  // Support
  {
    category: 'Support',
    question: 'What support options are available?',
    answer: 'All plans include email support. Professional plans add priority support with faster response times. Enterprise plans include dedicated account management and phone support.'
  },
  {
    category: 'Support',
    question: 'Do you offer onboarding help?',
    answer: 'Yes! Our guided onboarding wizard walks you through setup. Professional and Enterprise plans include personalized onboarding sessions with our team to ensure you get the most out of the platform.'
  },
];

export default function FAQPage() {
  const { theme } = useWebsiteTheme();
  const [openItems, setOpenItems] = useState<number[]>([0]);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(faqItems.map(item => item.category)))];
  
  const filteredItems = activeCategory === 'All' 
    ? faqItems 
    : faqItems.filter(item => item.category === activeCategory);

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="pt-44 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Find answers to common questions about RapidCompliance.US
          </p>
        </div>
      </section>

      {/* Category Filter */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  activeCategory === category
                    ? 'text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                style={activeCategory === category ? { backgroundColor: theme.primaryColor } : {}}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Items */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-4">
            {filteredItems.map((item, index) => (
              <div
                key={index}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/5 transition"
                >
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
                      {item.category}
                    </span>
                    <span className="text-lg font-semibold text-white">
                      {item.question}
                    </span>
                  </div>
                  <span className="text-2xl text-gray-400 ml-4">
                    {openItems.includes(index) ? '−' : '+'}
                  </span>
                </button>
                {openItems.includes(index) && (
                  <div className="px-6 pb-5 text-gray-300 leading-relaxed border-t border-white/10 pt-4">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Still have questions?
          </h2>
          <p className="text-gray-300 mb-8">
            Our team is here to help. Reach out and we&apos;ll get back to you shortly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="px-8 py-4 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition border border-white/20"
            >
              Contact Us
            </Link>
            <Link
              href="/onboarding/industry"
              className="px-8 py-4 rounded-lg font-semibold transition"
              style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}








