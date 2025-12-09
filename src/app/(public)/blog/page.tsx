'use client';

import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

const BLOG_POSTS = [
  {
    id: '1',
    title: 'How AI is Transforming Sales in 2024',
    excerpt: 'Discover the latest trends in AI-powered sales automation and how businesses are leveraging technology to close more deals.',
    author: 'Sarah Johnson',
    date: 'Dec 1, 2024',
    category: 'AI & Technology',
    readTime: '5 min read',
  },
  {
    id: '2',
    title: '10 Best Practices for Training Your AI Sales Agent',
    excerpt: 'Learn how to get the most out of your AI sales agent with these proven training techniques.',
    author: 'Michael Chen',
    date: 'Nov 28, 2024',
    category: 'Best Practices',
    readTime: '8 min read',
  },
  {
    id: '3',
    title: 'Case Study: How TechCorp Increased Conversions by 300%',
    excerpt: 'A deep dive into how one company used AI automation to triple their lead conversion rate in just 3 months.',
    author: 'Emily Rodriguez',
    date: 'Nov 25, 2024',
    category: 'Case Studies',
    readTime: '6 min read',
  },
];

export default function BlogPage() {
  const { theme } = useWebsiteTheme();

  return (
    <PublicLayout>
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-white mb-6">Blog</h1>
            <p className="text-xl text-gray-300">
              Insights, guides, and news about AI-powered sales
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {BLOG_POSTS.map((post) => (
              <article
                key={post.id}
                className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition"
              >
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="px-3 py-1 text-xs font-semibold rounded-full"
                      style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}
                    >
                      {post.category}
                    </span>
                    <span className="text-sm text-gray-400">{post.readTime}</span>
                  </div>

                  <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-opacity-80 transition">
                    {post.title}
                  </h2>

                  <p className="text-gray-300 mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div>
                      <div className="text-sm font-medium text-white">{post.author}</div>
                      <div className="text-xs text-gray-400">{post.date}</div>
                    </div>
                    <button
                      className="text-sm font-semibold hover:underline"
                      style={{ color: theme.primaryColor }}
                    >
                      Read More →
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Coming Soon Notice */}
          <div className="mt-16 text-center p-8 bg-white/5 border border-white/10 rounded-xl">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-2xl font-bold text-white mb-2">More Posts Coming Soon</h3>
            <p className="text-gray-300">
              We're working on more great content. Subscribe to our newsletter to get notified when we publish new articles.
            </p>
            <form className="mt-6 max-w-md mx-auto flex gap-3">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': theme.primaryColor } as any}
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-lg font-semibold transition"
                style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}






