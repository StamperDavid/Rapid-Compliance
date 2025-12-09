'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const { theme } = useWebsiteTheme();

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.backgroundColor, color: theme.textColor, fontFamily: theme.fontFamily }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg" />
              <span className="text-xl font-bold text-white">AI Sales Platform</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/features" className="text-gray-300 hover:text-white transition">
                Features
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-white transition">
                Pricing
              </Link>
              <Link href="/about" className="text-gray-300 hover:text-white transition">
                About
              </Link>
              <Link href="/contact" className="text-gray-300 hover:text-white transition">
                Contact
              </Link>
              <Link href="/login" className="text-gray-300 hover:text-white transition">
                Login
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded-lg font-semibold transition"
                style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {children}
      </main>

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
                <li><a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Twitter</a></li>
                <li><a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">LinkedIn</a></li>
                <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center text-gray-400">
            <p>© 2024 AI Sales Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Floating Chat Widget */}
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          className="w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-white text-2xl hover:scale-110 transition"
          style={{ backgroundColor: theme.primaryColor }}
        >
          💬
        </button>
      </div>
    </div>
  );
}






