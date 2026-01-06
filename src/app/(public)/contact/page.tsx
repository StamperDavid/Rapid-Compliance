'use client';

import React, { useState } from 'react';
import PublicLayout from '@/components/PublicLayout';
import PageRenderer from '@/components/PageRenderer';
import { usePageContent } from '@/hooks/usePageContent';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';
import { logger } from '@/lib/logger/logger';

function FallbackContent() {
  const { theme } = useWebsiteTheme();
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    logger.info('Contact form submitted', { email: formData.email, company: formData.company });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="pt-44 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-6">Get in Touch</h1>
          <p className="text-xl text-gray-300">Have questions? We&apos;d love to hear from you.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <form onSubmit={(e) => { handleSubmit(e); }} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                placeholder="john@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Message *</label>
              <textarea
                required
                rows={6}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white resize-none"
                placeholder="Tell us how we can help..."
              />
            </div>
            <button
              type="submit"
              className="w-full px-8 py-4 rounded-lg text-lg font-semibold transition"
              style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
            >
              Send Message
            </button>
            {submitted && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-center">
                ✓ Message sent! We&apos;ll get back to you soon.
              </div>
            )}
          </form>

          <div className="space-y-6">
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <div className="text-3xl mb-4">📧</div>
              <h3 className="text-xl font-bold text-white mb-2">Email Us</h3>
              <p className="text-gray-300">support@salesvelocity.ai</p>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <div className="text-3xl mb-4">💬</div>
              <h3 className="text-xl font-bold text-white mb-2">Live Chat</h3>
              <p className="text-gray-300">Available 9am-6pm EST</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  const { page, loading } = usePageContent('contact');

  return (
    <PublicLayout>
      {loading ? (
        <div className="pt-44 pb-20 text-center">
          <div className="text-gray-400">Loading...</div>
        </div>
      ) : page?.sections?.length > 0 ? (
        <PageRenderer page={page} />
      ) : (
        <FallbackContent />
      )}
    </PublicLayout>
  );
}






