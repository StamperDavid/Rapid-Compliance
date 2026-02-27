'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface SubpageNavItem {
  label: string;
  href: string;
}

interface SubpageNavProps {
  items: SubpageNavItem[];
}

/**
 * Horizontal route-based tab navigation bar for consolidated hub pages.
 * Highlights the active tab based on the current pathname.
 * Used on pages like Social Hub, Training Hub, Analytics Overview, etc.
 */
export default function SubpageNav({ items }: SubpageNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sub-page navigation"
      style={{
        display: 'flex',
        gap: '0.25rem',
        padding: '0.25rem',
        backgroundColor: 'var(--color-bg-elevated)',
        borderRadius: '0.5rem',
        border: '1px solid var(--color-border-light)',
        marginBottom: '1.5rem',
        overflowX: 'auto',
      }}
    >
      {items.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              backgroundColor: isActive ? 'rgba(var(--color-primary-rgb), 0.1)' : 'transparent',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
