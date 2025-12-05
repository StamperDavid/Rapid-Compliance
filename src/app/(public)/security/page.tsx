'use client';

import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

export default function SecurityPage() {
  const { theme } = useWebsiteTheme();

  return (
    <PublicLayout>
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-white mb-6">Security & Compliance</h1>
            <p className="text-xl text-gray-300">
              Enterprise-grade security to protect your data
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="p-8 bg-white/5 border border-white/10 rounded-xl">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-2xl font-bold text-white mb-3">Data Encryption</h3>
              <p className="text-gray-300 leading-relaxed">
                All data is encrypted in transit (TLS 1.3) and at rest (AES-256). 
                Your sensitive information is never stored in plain text.
              </p>
            </div>

            <div className="p-8 bg-white/5 border border-white/10 rounded-xl">
              <div className="text-4xl mb-4">🏢</div>
              <h3 className="text-2xl font-bold text-white mb-3">SOC 2 Compliant</h3>
              <p className="text-gray-300 leading-relaxed">
                Our infrastructure and processes meet SOC 2 Type II compliance standards 
                for security, availability, and confidentiality.
              </p>
            </div>

            <div className="p-8 bg-white/5 border border-white/10 rounded-xl">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-2xl font-bold text-white mb-3">GDPR Ready</h3>
              <p className="text-gray-300 leading-relaxed">
                Fully compliant with GDPR, CCPA, and other privacy regulations. 
                Data residency options available for EU customers.
              </p>
            </div>

            <div className="p-8 bg-white/5 border border-white/10 rounded-xl">
              <div className="text-4xl mb-4">🔐</div>
              <h3 className="text-2xl font-bold text-white mb-3">Access Controls</h3>
              <p className="text-gray-300 leading-relaxed">
                Multi-factor authentication, role-based permissions, and IP whitelisting 
                ensure only authorized users can access your data.
              </p>
            </div>

            <div className="p-8 bg-white/5 border border-white/10 rounded-xl">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold text-white mb-3">Regular Audits</h3>
              <p className="text-gray-300 leading-relaxed">
                Independent security audits and penetration testing performed quarterly 
                by certified third-party security firms.
              </p>
            </div>

            <div className="p-8 bg-white/5 border border-white/10 rounded-xl">
              <div className="text-4xl mb-4">💾</div>
              <h3 className="text-2xl font-bold text-white mb-3">Automated Backups</h3>
              <p className="text-gray-300 leading-relaxed">
                Daily automated backups with 30-day retention. Point-in-time recovery 
                available for all data.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Our Security Stack</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-white mb-2">Infrastructure</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>• Google Cloud Platform</li>
                  <li>• Firebase Security Rules</li>
                  <li>• DDoS Protection</li>
                  <li>• WAF (Web Application Firewall)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Application</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>• Rate Limiting</li>
                  <li>• Input Validation</li>
                  <li>• XSS Protection</li>
                  <li>• CSRF Tokens</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Monitoring</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>• 24/7 Security Monitoring</li>
                  <li>• Intrusion Detection</li>
                  <li>• Audit Logging</li>
                  <li>• Anomaly Detection</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Report a Security Issue</h2>
            <p className="text-gray-300 mb-6">
              We take security seriously. If you discover a vulnerability, please report it responsibly.
            </p>
            <a
              href="mailto:security@aisalesplatform.com"
              className="inline-block px-8 py-4 rounded-lg text-lg font-semibold transition"
              style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
            >
              Report Vulnerability →
            </a>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

