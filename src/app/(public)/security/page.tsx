'use client';

import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import PageRenderer from '@/components/PageRenderer';
import { usePageContent } from '@/hooks/usePageContent';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

function FallbackContent() {
  const { theme } = useWebsiteTheme();

  const features = [
    { icon: '🔒', title: 'Data Encryption', desc: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256).' },
    { icon: '🏢', title: 'SOC 2 Compliant', desc: 'Infrastructure meets SOC 2 Type II compliance standards.' },
    { icon: '🛡️', title: 'GDPR Ready', desc: 'Fully compliant with GDPR, CCPA, and other privacy regulations.' },
    { icon: '🔐', title: 'Access Controls', desc: 'MFA, role-based permissions, and IP whitelisting.' },
    { icon: '🔍', title: 'Regular Audits', desc: 'Quarterly security audits by certified third-party firms.' },
    { icon: '💾', title: 'Automated Backups', desc: 'Daily backups with 30-day retention.' },
  ];

  return (
    <div className="pt-44 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-6">Security & Compliance</h1>
          <p className="text-xl text-gray-300">Enterprise-grade security to protect your data</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {features.map((f, idx) => (
            <div key={idx} className="p-8 bg-white/5 border border-white/10 rounded-xl">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-2xl font-bold text-white mb-3">{f.title}</h3>
              <p className="text-gray-300">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Report a Security Issue</h2>
          <p className="text-gray-300 mb-6">We take security seriously. Report vulnerabilities responsibly.</p>
          <a href="mailto:security@salesvelocity.ai" className="inline-block px-8 py-4 rounded-lg font-semibold" style={{ backgroundColor: theme.primaryColor, color: '#fff' }}>
            Report Vulnerability →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SecurityPage() {
  const { page, loading } = usePageContent('security');

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





