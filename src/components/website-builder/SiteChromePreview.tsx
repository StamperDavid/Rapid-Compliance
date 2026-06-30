/**
 * Site Chrome Preview
 *
 * Faithful, NON-INTERACTIVE reproduction of the public site's chrome — the
 * early-access banner, the top nav/header, and the footer — exactly as
 * `PublicLayout` (`src/components/PublicLayout.tsx`) + `EarlyAccessBanner`
 * (`src/components/EarlyAccessBanner.tsx`) publish them.
 *
 * Why a copy instead of rendering `PublicLayout` directly: the real layout
 * carries the Alex chat widget, `usePathname`/localStorage state, and `fixed`
 * positioning that publishes the banner/nav as overlays. Inside the editor
 * canvas we need the SAME pixels but in normal document flow (banner → header →
 * body → footer, stacked) and fully inert so the chrome never steals an editor
 * click or navigates. The markup below mirrors the source verbatim (same
 * classes, same theme tokens, same copy/links) with the `fixed`/z-index/chat
 * concerns removed.
 *
 * Both pieces are `aria-hidden` with `pointer-events: none` — they DISPLAY the
 * real page frame; editing the chrome itself is a later feature.
 */

'use client';

import Image from 'next/image';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import type { WebsiteTheme } from '@/hooks/useWebsiteTheme';

type Breakpoint = 'desktop' | 'tablet' | 'mobile';

interface ChromeProps {
  theme: WebsiteTheme;
  breakpoint: Breakpoint;
}

// The real banner publishes its desktop copy at `sm:` (>=640px) and the compact
// copy below it. Tablet (768px) and desktop both clear `sm:`, so only the mobile
// breakpoint gets the compact pitch. Driven off the prop, not Tailwind responsive
// classes, because the canvas width is a container — not the viewport — so `sm:`
// utilities would always resolve to the editor's real (desktop) viewport.
function isCompact(breakpoint: Breakpoint): boolean {
  return breakpoint === 'mobile';
}

/**
 * Banner + top navigation, rendered ABOVE the editable page body.
 */
export function SiteHeaderPreview({ theme, breakpoint }: ChromeProps) {
  // Mirror PublicLayout: nav height tracks the logo height.
  const navHeight = Math.max(80, (theme.logoHeight ?? 48) + 32);
  const compact = isCompact(breakpoint);
  const companyName =
    theme.companyName !== '' && theme.companyName != null ? theme.companyName : 'SalesVelocity.ai';

  const navLinks = ['Features', 'Pricing', 'FAQ', 'About', 'Contact', 'Login'];

  return (
    <div aria-hidden style={{ pointerEvents: 'none', userSelect: 'none' }}>
      {/* Early-access banner — verbatim from EarlyAccessBanner, de-fixed. */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
          {compact ? (
            <div className="flex items-center gap-2 text-sm font-medium flex-1 min-w-0">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Launching soon</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white text-indigo-700 text-xs font-semibold flex-shrink-0">
                Get early access
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm md:text-base flex-1 min-w-0">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                <span className="font-semibold">SalesVelocity.ai is launching soon</span>
                <span className="opacity-90">
                  {' '}
                  &mdash; Early access list members get skip-the-line priority onboarding when we
                  open the doors.
                </span>
              </span>
              <span className="inline-flex items-center gap-1 px-4 py-1.5 rounded-md bg-white text-indigo-700 text-sm font-semibold flex-shrink-0">
                Reserve my spot
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          )}
          <span className="flex-shrink-0 p-1 rounded-md">
            <X className="w-4 h-4" />
          </span>
        </div>
      </div>

      {/* Top navigation — verbatim from PublicLayout, de-fixed (sits in flow). */}
      <nav
        className="backdrop-blur-lg border-b border-white/10"
        style={{ backgroundColor: theme.navBackground ?? 'rgba(15, 23, 42, 0.8)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center" style={{ height: `${navHeight}px` }}>
            <span className="flex items-center gap-2">
              {theme.logoUrl ? (
                <Image
                  src={theme.logoUrl}
                  alt={companyName}
                  width={200}
                  height={theme.logoHeight ?? 48}
                  unoptimized
                  style={{
                    height: `${theme.logoHeight ?? 48}px`,
                    width: 'auto',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <span
                  className="text-2xl font-bold"
                  style={{ color: theme.textColor, fontFamily: theme.headingFont }}
                >
                  {companyName}
                </span>
              )}
            </span>

            {compact ? (
              // Mobile: hamburger button, matching PublicLayout's md-and-below state.
              <span className="p-2 rounded-lg" style={{ color: theme.textColor }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </span>
            ) : (
              <div className="flex items-center gap-8">
                {navLinks.map((label) => (
                  <span key={label} className="transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                    {label}
                  </span>
                ))}
                <span
                  className="px-4 py-2 rounded-lg font-semibold"
                  style={{
                    backgroundColor: theme.primaryColor ?? 'var(--color-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Early Access
                </span>
              </div>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}

interface FooterColumn {
  heading: string;
  links: string[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  { heading: 'Product', links: ['Features', 'Pricing', 'FAQ', 'Documentation'] },
  { heading: 'Company', links: ['About', 'Blog', 'Contact'] },
  { heading: 'Legal', links: ['Privacy', 'Terms', 'Security'] },
  { heading: 'Connect', links: ['Twitter', 'LinkedIn', 'GitHub'] },
];

/**
 * Site footer, rendered BELOW the editable page body.
 */
export function SiteFooterPreview({ theme, breakpoint }: ChromeProps) {
  const compact = isCompact(breakpoint);
  const companyName =
    theme.companyName !== '' && theme.companyName != null ? theme.companyName : 'SalesVelocity.ai';

  return (
    <footer
      aria-hidden
      className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10"
      style={{
        backgroundColor: theme.footerBackground ?? 'var(--color-bg-paper)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Real footer is `grid-cols-2 md:grid-cols-4`; driven by prop here so the
            column count matches the chosen breakpoint, not the editor viewport. */}
        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-4'} gap-8 mb-8`}>
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="font-semibold mb-4" style={{ color: theme.textColor }}>
                {column.heading}
              </h3>
              <ul className="space-y-2" style={{ color: theme.textColor, opacity: 0.6 }}>
                {column.links.map((link) => (
                  <li key={link}>{link}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className="border-t border-white/10 pt-8 text-center"
          style={{ color: theme.textColor, opacity: 0.6 }}
        >
          <p>
            © {new Date().getFullYear()} {companyName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
