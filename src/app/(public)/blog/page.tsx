'use client';

import React from 'react';
import PublicLayout from '@/components/PublicLayout';
import PageRenderer from '@/components/PageRenderer';
import { usePageContent } from '@/hooks/usePageContent';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

function FallbackContent() {
  const { theme } = useWebsiteTheme();

  const posts = [
    { id: '1', title: 'How AI is Transforming Sales in 2024', category: 'AI & Technology', date: 'Dec 1, 2024' },
    { id: '2', title: '10 Best Practices for Training Your AI Agent', category: 'Best Practices', date: 'Nov 28, 2024' },
    { id: '3', title: 'Case Study: 300% Conversion Increase', category: 'Case Studies', date: 'Nov 25, 2024' },
  ];

  return (
    <div className="pt-44 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-6">Blog</h1>
          <p className="text-xl text-gray-300">Insights, guides, and news about AI-powered sales</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <article key={post.id} className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition p-6">
              <span className="px-3 py-1 text-xs font-semibold rounded-full" style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}>
                {post.category}
              </span>
              <h2 className="text-2xl font-bold text-white mt-4 mb-3">{post.title}</h2>
              <div className="text-xs text-gray-400">{post.date}</div>
            </article>
          ))}
        </div>

        <div className="mt-16 text-center p-8 bg-white/5 border border-white/10 rounded-xl">
          <h3 className="text-2xl font-bold text-white mb-2">More Posts Coming Soon</h3>
          <p className="text-gray-300">Subscribe to our newsletter to get notified.</p>
        </div>
      </div>
    </div>
  );
}

export default function BlogPage() {
  const { page, loading } = usePageContent('blog');

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
