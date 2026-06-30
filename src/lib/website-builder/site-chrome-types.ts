/**
 * Site Chrome — shared data contract
 *
 * The "chrome" is the site-wide frame that wraps every public page: the
 * early-access banner, the top nav/header, and the footer. Historically this
 * was hardcoded inside `PublicLayout` (`src/components/PublicLayout.tsx`) +
 * `EarlyAccessBanner` (`src/components/EarlyAccessBanner.tsx`) and reproduced,
 * pixel-for-pixel but inert, by `SiteChromePreview` in the website-builder
 * editor.
 *
 * To make the chrome CLICKABLE + EDITABLE + DELETABLE (Elementor-style), the
 * editor now renders the preview FROM DATA shaped by these types instead of
 * from hardcoded markup. `DEFAULT_SITE_CHROME` below captures the REAL current
 * chrome verbatim so an editor with no saved customisation looks identical to
 * the live site.
 *
 * This file is the single source of truth both the renderer
 * (`SiteChromePreview`) and the edit panel / save path code to.
 */

/** A single labelled link (used in the header nav and footer columns). */
export interface ChromeLink {
  label: string;
  /** Internal path (e.g. `/pricing`) or absolute URL (e.g. `https://...`). */
  url: string;
}

/** A footer column: a heading plus a list of links. */
export interface ChromeFooterColumn {
  title: string;
  links: ChromeLink[];
}

/**
 * The full, editable site chrome. Three regions — `banner`, `header`,
 * `footer` — match the `ChromeRegion` union and the three selectable areas in
 * the editor preview.
 */
export interface SiteChrome {
  banner: {
    /** When false, the banner region is hidden (treated as "deleted"). */
    enabled: boolean;
    /** The pitch copy shown in the banner. */
    text: string;
    /** Optional call-to-action button label. */
    ctaLabel?: string;
    /** Optional call-to-action destination. */
    ctaUrl?: string;
  };
  header: {
    /** Logo image src shown at the left of the nav. */
    logoUrl: string;
    /** Primary navigation links. */
    links: ChromeLink[];
    /** Optional highlighted call-to-action button at the right of the nav. */
    ctaLabel?: string;
    /** Optional call-to-action destination. */
    ctaUrl?: string;
  };
  footer: {
    /** Footer link columns (rendered left-to-right). */
    columns: ChromeFooterColumn[];
    /** Copyright / fine-print line under the columns. */
    copyright: string;
  };
}

/** The three selectable / editable regions of the chrome. */
export type ChromeRegion = 'banner' | 'header' | 'footer';

/**
 * The REAL current chrome, captured verbatim from the live site so the editor
 * looks identical out of the box.
 *
 * Sources:
 *  - banner copy + CTA  → `EarlyAccessBanner.tsx` (desktop variant)
 *  - logo + nav links + Early Access CTA → `PublicLayout.tsx` nav
 *  - footer columns + copyright → `PublicLayout.tsx` footer
 *
 * The copyright year is evaluated at module load so it stays current, matching
 * the live footer's `new Date().getFullYear()`.
 */
export const DEFAULT_SITE_CHROME: SiteChrome = {
  banner: {
    enabled: true,
    text: 'SalesVelocity.ai is launching soon — Early access list members get skip-the-line priority onboarding when we open the doors.',
    ctaLabel: 'Reserve my spot',
    ctaUrl: '/early-access',
  },
  header: {
    logoUrl: '/logo.png',
    links: [
      { label: 'Features', url: '/features' },
      { label: 'Pricing', url: '/pricing' },
      { label: 'FAQ', url: '/faq' },
      { label: 'About', url: '/about' },
      { label: 'Contact', url: '/contact' },
      { label: 'Login', url: '/login' },
    ],
    ctaLabel: 'Early Access',
    ctaUrl: '/early-access',
  },
  footer: {
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Features', url: '/features' },
          { label: 'Pricing', url: '/pricing' },
          { label: 'FAQ', url: '/faq' },
          { label: 'Documentation', url: '/docs' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'About', url: '/about' },
          { label: 'Blog', url: '/blog' },
          { label: 'Contact', url: '/contact' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { label: 'Privacy', url: '/privacy' },
          { label: 'Terms', url: '/terms' },
          { label: 'Security', url: '/security' },
        ],
      },
      {
        title: 'Connect',
        links: [
          { label: 'Twitter', url: 'https://twitter.com' },
          { label: 'LinkedIn', url: 'https://linkedin.com' },
          { label: 'GitHub', url: 'https://github.com' },
        ],
      },
    ],
    copyright: `© ${new Date().getFullYear()} SalesVelocity.ai. All rights reserved.`,
  },
};
