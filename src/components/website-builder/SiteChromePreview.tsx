/**
 * Site Chrome Preview
 *
 * Faithful reproduction of the public site's chrome — the early-access banner,
 * the top nav/header, and the footer — exactly as `PublicLayout`
 * (`src/components/PublicLayout.tsx`) + `EarlyAccessBanner`
 * (`src/components/EarlyAccessBanner.tsx`) publish them.
 *
 * Two modes:
 *  - **Inert (default).** Rendered NON-INTERACTIVE inside the editor canvas so
 *    the chrome never steals an editor click or navigates. Same pixels as the
 *    live site, in normal document flow (no `fixed`, no chat widget).
 *  - **Editable.** Each region (banner / header / footer) becomes hoverable +
 *    clickable + visibly selectable, Elementor-style. Clicking a region emits
 *    `onSelectRegion(region)`; the `selectedRegion` is outlined. Inner links
 *    are still rendered as plain text (spans) so they never navigate inside the
 *    editor.
 *
 * The component is now DATA-DRIVEN: editable content (banner copy/CTA, nav
 * logo/links/CTA, footer columns/copyright) comes from the `chrome` prop;
 * styling tokens (colors, fonts, logo height — the part that keeps the exact
 * faithful look) come from `useWebsiteTheme`, matching `PublicLayout`.
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';
import type { ChromeRegion, SiteChrome } from '@/lib/website-builder/site-chrome-types';

type Breakpoint = 'desktop' | 'tablet' | 'mobile';

interface ChromeProps {
  chrome: SiteChrome;
  breakpoint: Breakpoint;
  editable?: boolean;
  selectedRegion?: ChromeRegion | null;
  onSelectRegion?: (region: ChromeRegion) => void;
}

// The real banner publishes its desktop copy at `sm:` (>=640px) and the compact
// copy below it. Tablet (768px) and desktop both clear `sm:`, so only the mobile
// breakpoint gets the compact pitch. Driven off the prop, not Tailwind responsive
// classes, because the canvas width is a container — not the viewport — so `sm:`
// utilities would always resolve to the editor's real (desktop) viewport.
function isCompact(breakpoint: Breakpoint): boolean {
  return breakpoint === 'mobile';
}

const REGION_LABEL: Record<ChromeRegion, string> = {
  banner: 'Banner',
  header: 'Header',
  footer: 'Footer',
};

/**
 * Wraps a chrome region. When `editable`, it captures clicks (emitting the
 * region), shows a hover/selected outline, and a small region label badge.
 * When not editable, it renders its children verbatim with zero added markup.
 */
interface RegionWrapProps {
  region: ChromeRegion;
  editable: boolean;
  selected: boolean;
  onSelect?: (region: ChromeRegion) => void;
  className?: string;
  children: React.ReactNode;
}

function RegionWrap({
  region,
  editable,
  selected,
  onSelect,
  className,
  children,
}: RegionWrapProps) {
  if (!editable) {
    return <>{children}</>;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Select ${REGION_LABEL[region]}`}
      aria-pressed={selected}
      onClick={() => onSelect?.(region)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect?.(region);
        }
      }}
      className={`group relative cursor-pointer outline-none transition ${
        selected
          ? 'ring-2 ring-inset ring-primary'
          : 'hover:ring-2 hover:ring-inset hover:ring-primary/50'
      } ${className ?? ''}`}
    >
      <span
        className={`pointer-events-none absolute left-2 top-2 z-10 rounded-md px-2 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm transition ${
          selected
            ? 'bg-primary opacity-100'
            : 'bg-primary/80 opacity-0 group-hover:opacity-100'
        }`}
      >
        {REGION_LABEL[region]}
      </span>
      {children}
    </div>
  );
}

/**
 * Banner + top navigation, rendered ABOVE the editable page body.
 */
export function SiteHeaderPreview({
  chrome,
  breakpoint,
  editable = false,
  selectedRegion = null,
  onSelectRegion,
}: ChromeProps) {
  const { theme } = useWebsiteTheme();
  // Mirror PublicLayout: nav height tracks the logo height.
  const navHeight = Math.max(80, (theme.logoHeight ?? 48) + 32);
  const compact = isCompact(breakpoint);
  const companyName =
    theme.companyName !== '' && theme.companyName != null ? theme.companyName : 'SalesVelocity.ai';

  const { banner, header } = chrome;
  const logoUrl = header.logoUrl !== '' ? header.logoUrl : theme.logoUrl;

  return (
    <div
      aria-hidden={!editable}
      style={editable ? { userSelect: 'none' } : { pointerEvents: 'none', userSelect: 'none' }}
    >
      {/* Early-access banner — verbatim from EarlyAccessBanner, de-fixed. */}
      {banner.enabled && (
        <RegionWrap
          region="banner"
          editable={editable}
          selected={selectedRegion === 'banner'}
          onSelect={onSelectRegion}
        >
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
              {compact ? (
                <div className="flex items-center gap-2 text-sm font-medium flex-1 min-w-0">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{banner.text}</span>
                  {banner.ctaLabel != null && banner.ctaLabel !== '' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-white text-indigo-700 text-xs font-semibold flex-shrink-0">
                      {banner.ctaLabel}
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm md:text-base flex-1 min-w-0">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{banner.text}</span>
                  {banner.ctaLabel != null && banner.ctaLabel !== '' && (
                    <span className="inline-flex items-center gap-1 px-4 py-1.5 rounded-md bg-white text-indigo-700 text-sm font-semibold flex-shrink-0">
                      {banner.ctaLabel}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </div>
              )}
              <span className="flex-shrink-0 p-1 rounded-md">
                <X className="w-4 h-4" />
              </span>
            </div>
          </div>
        </RegionWrap>
      )}

      {/* Top navigation — verbatim from PublicLayout, de-fixed (sits in flow). */}
      <RegionWrap
        region="header"
        editable={editable}
        selected={selectedRegion === 'header'}
        onSelect={onSelectRegion}
      >
        <nav
          className="backdrop-blur-lg border-b border-white/10"
          style={{ backgroundColor: theme.navBackground ?? 'rgba(15, 23, 42, 0.8)' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center" style={{ height: `${navHeight}px` }}>
              <span className="flex items-center gap-2">
                {logoUrl !== '' ? (
                  <Image
                    src={logoUrl}
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
                  {header.links.map((link) => (
                    <span
                      key={`${link.label}-${link.url}`}
                      className="transition"
                      style={{ color: theme.textColor, opacity: 0.8 }}
                    >
                      {link.label}
                    </span>
                  ))}
                  {header.ctaLabel != null && header.ctaLabel !== '' && (
                    <span
                      className="px-4 py-2 rounded-lg font-semibold"
                      style={{
                        backgroundColor: theme.primaryColor ?? 'var(--color-primary)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {header.ctaLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </nav>
      </RegionWrap>
    </div>
  );
}

/**
 * Site footer, rendered BELOW the editable page body.
 */
export function SiteFooterPreview({
  chrome,
  breakpoint,
  editable = false,
  selectedRegion = null,
  onSelectRegion,
}: ChromeProps) {
  const { theme } = useWebsiteTheme();
  const compact = isCompact(breakpoint);
  const { footer } = chrome;

  return (
    <RegionWrap
      region="footer"
      editable={editable}
      selected={selectedRegion === 'footer'}
      onSelect={onSelectRegion}
    >
      <footer
        aria-hidden={!editable}
        className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10"
        style={{
          backgroundColor: theme.footerBackground ?? 'var(--color-bg-paper)',
          ...(editable ? { userSelect: 'none' } : { pointerEvents: 'none', userSelect: 'none' }),
        }}
      >
        <div className="max-w-7xl mx-auto">
          {/* Real footer is `grid-cols-2 md:grid-cols-4`; driven by prop here so the
              column count matches the chosen breakpoint, not the editor viewport. */}
          <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-4'} gap-8 mb-8`}>
            {footer.columns.map((column) => (
              <div key={column.title}>
                <h3 className="font-semibold mb-4" style={{ color: theme.textColor }}>
                  {column.title}
                </h3>
                <ul className="space-y-2" style={{ color: theme.textColor, opacity: 0.6 }}>
                  {column.links.map((link) => (
                    <li key={`${link.label}-${link.url}`}>{link.label}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div
            className="border-t border-white/10 pt-8 text-center"
            style={{ color: theme.textColor, opacity: 0.6 }}
          >
            <p>{footer.copyright}</p>
          </div>
        </div>
      </footer>
    </RegionWrap>
  );
}

/**
 * Combined chrome preview — banner + header stacked directly above the footer,
 * with no page body in between. Useful for a dedicated chrome-editing surface
 * (e.g. `ChromeEditor`) that edits the frame on its own. In the main editor
 * canvas the header and footer are placed separately (around the page body) via
 * `SiteHeaderPreview` / `SiteFooterPreview`.
 */
export function SiteChromePreview(props: ChromeProps) {
  return (
    <>
      <SiteHeaderPreview {...props} />
      <SiteFooterPreview {...props} />
    </>
  );
}
