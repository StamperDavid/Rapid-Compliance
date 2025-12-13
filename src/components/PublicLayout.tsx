'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const { theme, loading } = useWebsiteTheme();

  // Calculate nav height based on logo height
  const navHeight = Math.max(80, (theme.logoHeight || 48) + 32);

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.backgroundColor, color: theme.textColor, fontFamily: theme.fontFamily }}>
      {/* Navigation */}
      <nav 
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg border-b border-white/10"
        style={{ backgroundColor: theme.navBackground || 'rgba(15, 23, 42, 0.8)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center" style={{ height: `${navHeight}px` }}>
            <Link href="/" className="flex items-center gap-2">
              {theme.logoUrl ? (
                <img 
                  src={theme.logoUrl} 
                  alt={theme.companyName || 'SalesVelocity.ai'} 
                  style={{ 
                    height: `${theme.logoHeight || 48}px`, 
                    width: 'auto', 
                    objectFit: 'contain',
                  }} 
                />
              ) : (
                <span 
                  className="text-2xl font-bold"
                  style={{ color: theme.textColor, fontFamily: theme.headingFont }}
                >
                  {theme.companyName || 'SalesVelocity.ai'}
                </span>
              )}
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/features" className="hover:opacity-100 transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                Features
              </Link>
              <Link href="/pricing" className="hover:opacity-100 transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                Pricing
              </Link>
              <Link href="/about" className="hover:opacity-100 transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                About
              </Link>
              <Link href="/contact" className="hover:opacity-100 transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                Contact
              </Link>
              <Link href="/login" className="hover:opacity-100 transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                Login
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded-lg font-semibold transition hover:opacity-90"
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
      <footer 
        className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10"
        style={{ backgroundColor: theme.footerBackground || '#0a0a0a' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4" style={{ color: theme.textColor }}>Product</h3>
              <ul className="space-y-2" style={{ color: theme.textColor, opacity: 0.6 }}>
                <li><Link href="/features" className="hover:opacity-100 transition">Features</Link></li>
                <li><Link href="/pricing" className="hover:opacity-100 transition">Pricing</Link></li>
                <li><Link href="/docs" className="hover:opacity-100 transition">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4" style={{ color: theme.textColor }}>Company</h3>
              <ul className="space-y-2" style={{ color: theme.textColor, opacity: 0.6 }}>
                <li><Link href="/about" className="hover:opacity-100 transition">About</Link></li>
                <li><Link href="/blog" className="hover:opacity-100 transition">Blog</Link></li>
                <li><Link href="/contact" className="hover:opacity-100 transition">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4" style={{ color: theme.textColor }}>Legal</h3>
              <ul className="space-y-2" style={{ color: theme.textColor, opacity: 0.6 }}>
                <li><Link href="/privacy" className="hover:opacity-100 transition">Privacy</Link></li>
                <li><Link href="/terms" className="hover:opacity-100 transition">Terms</Link></li>
                <li><Link href="/security" className="hover:opacity-100 transition">Security</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4" style={{ color: theme.textColor }}>Connect</h3>
              <ul className="space-y-2" style={{ color: theme.textColor, opacity: 0.6 }}>
                <li><a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition">Twitter</a></li>
                <li><a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition">LinkedIn</a></li>
                <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center" style={{ color: theme.textColor, opacity: 0.6 }}>
            <p>© {new Date().getFullYear()} {theme.companyName || 'SalesVelocity.ai'}. All rights reserved.</p>
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
