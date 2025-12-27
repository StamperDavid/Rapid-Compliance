/**
 * Mobile Navigation Component
 * Responsive hamburger menu for mobile devices
 */

'use client';

import { useState } from 'react';
import { NavItem } from '@/types/website';

interface MobileNavigationProps {
  items: NavItem[];
  logo?: string;
  brandName?: string;
}

export function MobileNavigation({ items, logo, brandName }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          {/* Logo/Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {logo && (
              <img
                src={logo}
                alt={brandName || 'Logo'}
                style={{ height: '32px', width: 'auto' }}
              />
            )}
            {brandName && (
              <span
                style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#111827',
                }}
              >
                {brandName}
              </span>
            )}
          </div>

          {/* Desktop Navigation */}
          <div
            className="desktop-nav"
            style={{
              display: 'flex',
              gap: '32px',
              alignItems: 'center',
            }}
          >
            {items.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target={item.newTab ? '_blank' : undefined}
                rel={item.newTab ? 'noopener noreferrer' : undefined}
                style={{
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '16px',
                  fontWeight: '500',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#374151';
                }}
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="mobile-hamburger"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px',
            }}
            aria-label="Toggle menu"
          >
            {isOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div
            className="mobile-menu"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              borderBottom: '1px solid #e5e7eb',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              padding: '20px',
            }}
          >
            {items.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target={item.newTab ? '_blank' : undefined}
                rel={item.newTab ? 'noopener noreferrer' : undefined}
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'block',
                  padding: '12px 0',
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '16px',
                  fontWeight: '500',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </nav>

      <style>{`
        @media (max-width: 767px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-hamburger {
            display: block !important;
          }
        }

        @media (min-width: 768px) {
          .mobile-menu {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}

