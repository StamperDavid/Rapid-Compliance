'use client';

import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

export default function AboutPage() {
  const { theme } = useWebsiteTheme();

  return (
    <PublicLayout>
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-white mb-6">About Us</h1>
          <p className="text-xl text-gray-300 mb-12">
            Building the future of AI-powered sales automation
          </p>

          <div className="prose prose-invert max-w-none">
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">Our Mission</h2>
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                We believe every business deserves access to world-class sales automation, 
                regardless of size or budget. Our AI Sales Platform democratizes cutting-edge 
                technology, making it accessible to startups and enterprises alike.
              </p>
              <p className="text-gray-300 text-lg leading-relaxed">
                By combining artificial intelligence with proven sales methodologies, we're 
                helping businesses close more deals, nurture better relationships, and grow faster.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">Our Story</h2>
              <p className="text-gray-300 text-lg leading-relaxed mb-4">
                Founded in 2024, AI Sales Platform emerged from a simple observation: most businesses 
                struggle with lead qualification, follow-ups, and sales process consistency. Traditional 
                CRMs require too much manual work. AI chatbots are too generic.
              </p>
              <p className="text-gray-300 text-lg leading-relaxed">
                We built something different - an AI sales agent that learns YOUR business, speaks 
                in YOUR voice, and follows YOUR process. It's like hiring your best sales rep and 
                cloning them to work 24/7.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">Our Values</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <h3 className="text-xl font-bold text-white mb-2">🚀 Innovation First</h3>
                  <p className="text-gray-300">
                    We push boundaries with AI technology while keeping the user experience simple and intuitive.
                  </p>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <h3 className="text-xl font-bold text-white mb-2">🤝 Customer Success</h3>
                  <p className="text-gray-300">
                    Your growth is our success. We're invested in helping you close more deals.
                  </p>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <h3 className="text-xl font-bold text-white mb-2">🔒 Privacy & Security</h3>
                  <p className="text-gray-300">
                    Your data is yours. We use enterprise-grade security and never sell your information.
                  </p>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                  <h3 className="text-xl font-bold text-white mb-2">💡 Transparency</h3>
                  <p className="text-gray-300">
                    No hidden fees, no dark patterns. What you see is what you get.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-3xl font-bold text-white mb-4">Join Us</h2>
              <p className="text-gray-300 text-lg leading-relaxed mb-6">
                We're always looking for talented people who are passionate about AI, sales, 
                and helping businesses grow. Check out our careers page or reach out directly.
              </p>
              <a 
                href="/contact" 
                className="inline-block px-8 py-4 rounded-lg text-lg font-semibold transition"
                style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
              >
                Get in Touch →
              </a>
            </section>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

