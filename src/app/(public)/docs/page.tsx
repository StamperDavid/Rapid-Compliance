'use client';

import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import PageRenderer from '@/components/PageRenderer';
import { usePageContent } from '@/hooks/usePageContent';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

function FallbackContent() {
  const { theme } = useWebsiteTheme();

  const categories = [
    { icon: '🚀', title: 'Getting Started', docs: ['Quick Start Guide', 'Account Setup', 'Training Your Agent'] },
    { icon: '📊', title: 'CRM & Sales', docs: ['Managing Leads', 'Deal Pipeline', 'Workflow Automation'] },
    { icon: '🤖', title: 'AI Configuration', docs: ['Agent Personality', 'Knowledge Base', 'Advanced Prompting'] },
    { icon: '🔗', title: 'Integrations', docs: ['Stripe', 'Google Calendar', 'Slack', 'API Reference'] },
  ];

  return (
    <div className="pt-44 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-6">Documentation</h1>
          <p className="text-xl text-gray-300 mb-8">Everything you need to know about using SalesVelocity.ai</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {categories.map((cat, idx) => (
            <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="text-3xl mb-3">{cat.icon}</div>
              <h2 className="text-xl font-bold text-white mb-3">{cat.title}</h2>
              <ul className="space-y-2">
                {cat.docs.map((doc, dIdx) => (
                  <li key={dIdx} className="text-gray-400 hover:text-white cursor-pointer">{doc}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Need Help?</h2>
          <p className="text-gray-300 mb-6">Our support team responds within 24 hours.</p>
          <Link href="/contact" className="inline-block px-8 py-4 rounded-lg font-semibold" style={{ backgroundColor: theme.primaryColor, color: '#fff' }}>
            Contact Support →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DocsPage() {
  const { page, loading } = usePageContent('docs');

  return (
    <PublicLayout>
      {loading ? (
        <div className="pt-44 pb-20 text-center"><div className="text-gray-400">Loading...</div></div>
      ) : page && page.sections && page.sections.length > 0 ? (
        <PageRenderer page={page} />
      ) : (
        <FallbackContent />
      )}
    </PublicLayout>
  );
}
