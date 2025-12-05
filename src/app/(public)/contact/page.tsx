'use client';

import React, { useState } from 'react';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

export default function ContactPage() {
  const { theme } = useWebsiteTheme();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement actual form submission
    console.log('Form submitted:', formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <PublicLayout>
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-6">Get in Touch</h1>
            <p className="text-xl text-gray-300">
              Have questions? We'd love to hear from you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': theme.primaryColor } as any}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': theme.primaryColor } as any}
                    placeholder="john@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': theme.primaryColor } as any}
                    placeholder="Acme Corp"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Message *
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 resize-none"
                    style={{ '--tw-ring-color': theme.primaryColor } as any}
                    placeholder="Tell us how we can help..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-8 py-4 rounded-lg text-lg font-semibold transition transform hover:scale-105"
                  style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
                >
                  Send Message
                </button>

                {submitted && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-center">
                    ✓ Message sent! We'll get back to you soon.
                  </div>
                )}
              </form>
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <div className="text-3xl mb-4">📧</div>
                <h3 className="text-xl font-bold text-white mb-2">Email Us</h3>
                <p className="text-gray-300 mb-2">support@aisalesplatform.com</p>
                <p className="text-gray-400 text-sm">We typically respond within 24 hours</p>
              </div>

              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <div className="text-3xl mb-4">💬</div>
                <h3 className="text-xl font-bold text-white mb-2">Live Chat</h3>
                <p className="text-gray-300 mb-2">Available 9am-6pm EST</p>
                <p className="text-gray-400 text-sm">Click the chat widget in the bottom right</p>
              </div>

              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <div className="text-3xl mb-4">📚</div>
                <h3 className="text-xl font-bold text-white mb-2">Documentation</h3>
                <p className="text-gray-300 mb-2">Check our comprehensive guides</p>
                <a href="/docs" className="text-sm hover:underline" style={{ color: theme.primaryColor }}>
                  Browse Documentation →
                </a>
              </div>

              <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <div className="text-3xl mb-4">🎯</div>
                <h3 className="text-xl font-bold text-white mb-2">Sales Inquiries</h3>
                <p className="text-gray-300 mb-2">sales@aisalesplatform.com</p>
                <p className="text-gray-400 text-sm">For enterprise plans and custom solutions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

