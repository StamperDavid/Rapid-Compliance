/**
 * Responsive Page Renderer
 * Automatically applies mobile-responsive styling to page content
 * Handles breakpoints: desktop (1200px+), tablet (768-1199px), mobile (<768px)
 */

'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { GradientStops, PageSection, ShapeDivider, Widget, WidgetStyle } from '@/types/website';
import type {
  LogoItem,
  GalleryImage,
  PricingPlan,
  SocialIcon,
  TabItem,
  AccordionItem
} from '@/types/widget-content';
import {
  canonicalWidgetType,
  readFeatures,
  readStats,
  readFaqs,
  readPlans,
  formatPlanPrice,
  formatPlanPeriod,
} from '@/lib/website-builder/widget-normalizer';
import { SHAPE_DIVIDERS } from '@/lib/website-builder/shape-divider-catalog';
import { themeToTokens, tokensToCssVars } from '@/lib/website-builder/global-styles';
import SafeHtml from '@/components/SafeHtml';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';
import { OptimizedImage } from './OptimizedImage';
import { AccessibleWidget, SkipToMain } from './AccessibleWidget';
import { WebsiteFormWidget } from './WebsiteFormWidget';
import { useGlobalStyles } from './GlobalStylesContext';
import { Icon } from './Icon';

interface ConvertedStyle extends Omit<React.CSSProperties, 'padding' | 'margin'> {
  padding?: string;
  margin?: string;
}

// ---------------------------------------------------------------------------
// Gradient helpers (real Elementor-Pro-class gradient text + fills)
// ---------------------------------------------------------------------------

/** Build a `linear-gradient(...)` string from structured colour stops. */
function buildLinearGradient(g: GradientStops): string {
  const angle = typeof g.angle === 'number' ? g.angle : 90;
  const stops = g.via ? `${g.from}, ${g.via}, ${g.to}` : `${g.from}, ${g.to}`;
  return `linear-gradient(${angle}deg, ${stops})`;
}

/**
 * CSS that paints an element's TEXT with a gradient (background-clip:text).
 * Applied to the text element itself — never a multi-child wrapper — so the
 * gradient maps onto the glyphs, matching `bg-clip-text text-transparent`.
 */
function gradientTextStyle(g: GradientStops): React.CSSProperties {
  return {
    backgroundImage: buildLinearGradient(g),
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  };
}

/** Translucent variant of any CSS colour, theme-aware (no hex parsing). */
function withAlpha(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

interface ResponsiveRendererProps {
  content: PageSection[];
  breakpoint?: 'desktop' | 'tablet' | 'mobile';
}

export function ResponsiveRenderer({ content, breakpoint = 'desktop' }: ResponsiveRendererProps) {
  // The page renders on the SITE'S real published theme (dark base + light text +
  // site font), so a page with no per-section background still looks like the live
  // site instead of white-on-white. Per-section backgrounds/gradients win because
  // sections default to `transparent`, letting this base show through. This is the
  // SAME render path used by the editor canvas and the public /sites route, so what
  // the operator sees is what publishes.
  const { theme } = useWebsiteTheme();

  // Global design tokens (Elementor "Global Colors/Fonts"): emit the brand
  // colours/fonts as CSS custom properties at the page root so any descendant
  // widget referencing `var(--gc-*)` / `var(--gf-*)` resolves to the live brand.
  //
  // Source priority: the editor mounts a GlobalStylesProvider so token edits
  // preview live (context wins); the public /sites route has NO provider, so we
  // seed the same tokens straight from the brand/theme. Either way the emitted
  // vars are IDENTICAL to the current brand.
  //
  // This is purely additive: existing widgets store raw hex/font strings (not
  // these vars), so adding extra custom properties changes NO existing widget's
  // computed style — live output stays byte-identical for all current content.
  const contextTokens = useGlobalStyles();
  const globalCssVars = useMemo(
    () => tokensToCssVars(contextTokens ?? themeToTokens(theme)),
    [contextTokens, theme],
  );

  return (
    <div
      className="responsive-page"
      role="main"
      id="main-content"
      style={{
        ...globalCssVars,
        background: theme.backgroundColor,
        color: theme.textColor,
        fontFamily: theme.fontFamily,
      }}
    >
      <SkipToMain />
      {content.map((section, idx) => (
        <Section key={section.id || idx} section={section} breakpoint={breakpoint} />
      ))}

      <style>{`
        .responsive-page {
          width: 100%;
          min-height: 100vh;
        }

        /* Responsive typography */
        @media (max-width: 767px) {
          h1 { font-size: 28px !important; }
          h2 { font-size: 24px !important; }
          h3 { font-size: 20px !important; }
          h4 { font-size: 18px !important; }
          p { font-size: 16px; line-height: 1.6; }
        }

        /* Responsive spacing — padding now lives on the inner band container */
        @media (max-width: 767px) {
          .section-inner { padding: 40px 20px !important; }
          .widget { margin-bottom: 20px !important; }
        }

        /* Responsive images */
        img {
          max-width: 100%;
          height: auto;
        }

        /* Responsive buttons */
        button, .button {
          min-width: fit-content;
          padding: 12px 24px;
        }

        @media (max-width: 767px) {
          button, .button {
            width: 100%;
            display: block;
          }
        }

        /* Responsive grids */
        .feature-grid,
        .pricing-grid,
        .logo-grid {
          display: grid;
          gap: 24px;
        }

        @media (min-width: 1200px) {
          .feature-grid,
          .pricing-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .logo-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        @media (min-width: 768px) and (max-width: 1199px) {
          .feature-grid,
          .pricing-grid,
          .logo-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 767px) {
          .feature-grid,
          .pricing-grid,
          .logo-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Responsive flexbox */
        .flex-container {
          display: flex;
          gap: 24px;
        }

        @media (max-width: 767px) {
          .flex-container {
            flex-direction: column;
          }
        }

        /* Responsive navigation */
        @media (max-width: 767px) {
          .nav-menu {
            display: none;
            position: fixed;
            top: 60px;
            left: 0;
            right: 0;
            background: white;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          
          .nav-menu.open {
            display: block;
          }

          .hamburger {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}

function Section({ section, breakpoint }: { section: PageSection; breakpoint: string }) {
  const getResponsivePadding = () => {
    if (breakpoint === 'mobile') {
      return '40px 20px';
    }
    if (breakpoint === 'tablet') {
      return '60px 40px';
    }
    return section.padding
      ? `${section.padding.top ?? '80px'} ${section.padding.right ?? '40px'} ${section.padding.bottom ?? '80px'} ${section.padding.left ?? '40px'}`
      : '80px 40px';
  };

  // Section shape dividers (Elementor-style). Only active when a section
  // explicitly sets a divider with a real (non-`none`) shape. When neither is
  // set, NOTHING below changes the section's style or markup — `hasDivider`
  // stays false and the section renders byte-identically to before.
  const topDivider =
    section.shapeDividerTop && section.shapeDividerTop.type !== 'none'
      ? section.shapeDividerTop
      : undefined;
  const bottomDivider =
    section.shapeDividerBottom && section.shapeDividerBottom.type !== 'none'
      ? section.shapeDividerBottom
      : undefined;
  const hasDivider = topDivider !== undefined || bottomDivider !== undefined;

  // The <section> is a full-bleed BAND: its background reaches the page edges.
  // Vertical/horizontal padding and the max-width cap live on the inner
  // container so content stays centred at a sane reading width (≈1280px) even
  // on ultra-wide screens, while the colour band still spans edge to edge.
  const sectionStyle: React.CSSProperties = {
    backgroundColor: section.backgroundColor ?? 'transparent',
    backgroundImage: section.backgroundImage ? `url(${section.backgroundImage})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    width: '100%',
    // Only when a divider is present: become the positioning context and clip
    // the overlay SVGs to the band. Spread is empty (no added keys) otherwise.
    ...(hasDivider ? { position: 'relative', overflow: 'hidden' } : {}),
  };

  // Full-width sections still cap their inner content at 1280px; constrained
  // sections honour their explicit maxWidth (defaulting to 1200px).
  const innerMaxWidth = section.fullWidth
    ? '1280px'
    : section.maxWidth !== undefined
      ? `${section.maxWidth}px`
      : '1200px';

  const innerStyle: React.CSSProperties = {
    maxWidth: innerMaxWidth,
    margin: '0 auto',
    padding: getResponsivePadding(),
    width: '100%',
    // Sit content above any edge-pinned divider (which defaults to z-index 1);
    // a `front` divider opts to z-index 3 to overlap content. Only applied when
    // a divider exists, so dividerless sections keep identical inner markup.
    ...(hasDivider ? { position: 'relative', zIndex: 2 } : {}),
  };

  return (
    <section className="section" style={sectionStyle}>
      {topDivider && <ShapeDividerLayer divider={topDivider} position="top" />}
      {bottomDivider && <ShapeDividerLayer divider={bottomDivider} position="bottom" />}
      <div className="section-inner" style={innerStyle}>
        <div
          className={section.columns.length > 1 ? 'flex-container' : ''}
          // Multi-column sections honor optional per-section layout fields when
          // set; when unset, `undefined` leaves the existing `.flex-container`
          // CSS (gap:24px, default align) untouched — byte-identical for pages
          // that never set them.
          style={
            section.columns.length > 1
              ? {
                  gap: section.columnGap !== undefined ? `${section.columnGap}px` : undefined,
                  alignItems: section.verticalAlign,
                }
              : undefined
          }
        >
          {section.columns.map((column, idx) => (
            <div
              key={column.id || idx}
              style={{
                flex: section.columns.length > 1 ? `${column.width}` : undefined,
                width: section.columns.length === 1 ? '100%' : undefined,
              }}
            >
              {column.widgets.map((widget, widgetIdx) => (
                <AccessibleWidget key={widget.id || widgetIdx} widget={widget}>
                  <div className="widget">
                    <WidgetRenderer widget={widget} breakpoint={breakpoint} />
                  </div>
                </AccessibleWidget>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * One section shape divider, pinned to the top or bottom edge of its section.
 *
 * The catalog path is authored fill-against-top; a TOP divider renders as-is and
 * a BOTTOM divider is rotated 180deg so the same path serves both edges. `flip`
 * mirrors horizontally, `invert` flips the shape vertically (peak<->valley), and
 * `front` lifts the divider above section content. The layer is decorative and
 * never intercepts pointer events.
 */
function ShapeDividerLayer({
  divider,
  position,
}: {
  divider: ShapeDivider;
  position: 'top' | 'bottom';
}): React.JSX.Element | null {
  const shape = SHAPE_DIVIDERS[divider.type as Exclude<typeof divider.type, 'none'>];
  if (!shape) {
    return null;
  }

  const height = typeof divider.height === 'number' && divider.height > 0 ? divider.height : 100;
  const widthPct =
    typeof divider.width === 'number' && divider.width >= 100 ? divider.width : 100;
  const fill = divider.color && divider.color.trim() !== '' ? divider.color : 'var(--color-bg-elevated)';

  // Combine the edge rotation with the optional flip/invert mirrors.
  const transforms: string[] = [];
  if (position === 'bottom') {
    transforms.push('rotate(180deg)');
  }
  if (divider.flip) {
    transforms.push('scaleX(-1)');
  }
  if (divider.invert) {
    transforms.push('scaleY(-1)');
  }

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    [position]: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: `${widthPct}%`,
    minWidth: '100%',
    lineHeight: 0,
    zIndex: divider.front ? 3 : 1,
    pointerEvents: 'none',
  };

  const svgStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    height: `${height}px`,
    transform: transforms.length > 0 ? transforms.join(' ') : undefined,
    transformOrigin: 'center',
  };

  return (
    <div className={`shape-divider shape-divider-${position}`} style={containerStyle} aria-hidden="true">
      <svg
        viewBox={shape.viewBox}
        preserveAspectRatio={shape.preserveAspectRatio ?? 'none'}
        xmlns="http://www.w3.org/2000/svg"
        style={svgStyle}
      >
        {(shape.paths ?? []).map((d, idx) => (
          <path key={idx} d={d} fill={fill} fillOpacity={0.55} />
        ))}
        <path d={shape.path} fill={fill} />
      </svg>
    </div>
  );
}

function WidgetRenderer({ widget, breakpoint }: { widget: Widget; breakpoint: string }) {
  const convertSpacing = (spacing: { top?: string; right?: string; bottom?: string; left?: string }): string => {
    return `${spacing.top ?? '0'} ${spacing.right ?? '0'} ${spacing.bottom ?? '0'} ${spacing.left ?? '0'}`;
  };

  const convertStyleToCSS = (style: Partial<WidgetStyle>): ConvertedStyle => {
    const result: ConvertedStyle = {};

    // Strip the structured fields that are NOT raw CSS properties; they are
    // expanded into real CSS below (gradients) or handled per-widget (text
    // gradient). Everything else maps 1:1 onto React.CSSProperties.
    const { padding, margin, textGradient: _textGradient, backgroundGradient, ...otherProps } = style;
    Object.assign(result, otherProps);

    // Convert padding if it exists and is an object
    if (padding) {
      if (typeof padding === 'string') {
        result.padding = padding;
      } else {
        result.padding = convertSpacing(padding);
      }
    }

    // Convert margin if it exists and is an object
    if (margin) {
      if (typeof margin === 'string') {
        result.margin = margin;
      } else {
        result.margin = convertSpacing(margin);
      }
    }

    // Expand a structured background gradient into a real CSS background-image.
    if (backgroundGradient) {
      result.backgroundImage = buildLinearGradient(backgroundGradient);
    }

    return result;
  };

  // Merge the raw style with any responsive override FIRST, then convert once,
  // so structured fields (textGradient) from a breakpoint override are honoured.
  let mergedRaw: Partial<WidgetStyle> = { ...(widget.style ?? {}) };
  if (breakpoint === 'mobile' && widget.responsive?.mobile) {
    mergedRaw = { ...mergedRaw, ...widget.responsive.mobile };
  } else if (breakpoint === 'tablet' && widget.responsive?.tablet) {
    mergedRaw = { ...mergedRaw, ...widget.responsive.tablet };
  }

  const style = convertStyleToCSS(mergedRaw);
  const textGradient = mergedRaw.textGradient;

  // Style for a standalone text element: applies the widget style, paints a
  // gradient onto the glyphs when requested, and auto-centres a constrained
  // (max-width) block so hero/intro copy constrains and centres faithfully.
  const textBlockStyle = (): React.CSSProperties => {
    const out: React.CSSProperties = { ...style };
    if (textGradient) {
      Object.assign(out, gradientTextStyle(textGradient));
    }
    if (style.maxWidth !== undefined && style.margin === undefined && style.marginLeft === undefined) {
      out.marginLeft = 'auto';
      out.marginRight = 'auto';
    }
    return out;
  };

  // Route legacy widget type names (feature-grid, pricing-table) to their
  // canonical cases so seed/template content renders identically to native
  // canonical content.
  switch (canonicalWidgetType(widget.type)) {
    case 'heading': {
      const level = widget.data.level ?? 1;
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      const textVal = widget.data.text as string | null | undefined;
      return (
        <HeadingTag style={textBlockStyle()}>
          {String(textVal !== '' && textVal != null ? textVal : 'Heading')}
        </HeadingTag>
      );
    }

    case 'text': {
      const contentVal = widget.data.content as string | null | undefined;
      return (
        <p style={textBlockStyle()}>
          {String(contentVal !== '' && contentVal != null ? contentVal : 'Text content')}
        </p>
      );
    }

    case 'button': {
      const buttonTextVal = widget.data.text as string | null | undefined;
      return (
        <button
          style={{
            padding: '12px 24px',
            backgroundColor: (widget.data.color as string) ?? 'var(--color-info)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            ...style,
          }}
          onClick={() => {
            if (widget.data.url) {
              window.location.href = widget.data.url as string;
            }
          }}
        >
          {String(buttonTextVal !== '' && buttonTextVal != null ? buttonTextVal : 'Button')}
        </button>
      );
    }

    case 'image': {
      const altVal = widget.data.alt as string | null | undefined;
      return (
        <OptimizedImage
          src={(widget.data.src as string) ?? 'https://via.placeholder.com/800x400'}
          alt={altVal !== '' && altVal != null ? altVal : 'Image'}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '8px',
            ...style,
          }}
          sizes={{
            mobile: '100vw',
            tablet: '50vw',
            desktop: '33vw',
          }}
        />
      );
    }

    case 'hero': {
      const heroHeadingVal = widget.data.heading as string | null | undefined;
      const heroSubheadingVal = widget.data.subheading as string | null | undefined;
      return (
        <div
          style={{
            textAlign: 'center',
            padding: breakpoint === 'mobile' ? '40px 20px' : '80px 40px',
            backgroundImage: widget.data.backgroundImage
              ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${widget.data.backgroundImage})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: 'white',
            borderRadius: '8px',
            ...style,
            // A constrained hero centres itself on the page (max-width band).
            ...(style.maxWidth !== undefined && style.margin === undefined
              ? { marginLeft: 'auto', marginRight: 'auto' }
              : {}),
          }}
        >
          <h1
            style={{
              fontSize: breakpoint === 'mobile' ? '32px' : '48px',
              fontWeight: 'bold',
              marginBottom: '16px',
              ...(textGradient ? gradientTextStyle(textGradient) : {}),
            }}
          >
            {String(heroHeadingVal !== '' && heroHeadingVal != null ? heroHeadingVal : 'Hero Heading')}
          </h1>
          <p
            style={{
              fontSize: breakpoint === 'mobile' ? '16px' : '20px',
              marginBottom: '32px',
              maxWidth: '600px',
              margin: '0 auto 32px',
            }}
          >
            {String(heroSubheadingVal !== '' && heroSubheadingVal != null ? heroSubheadingVal : 'Hero subheading')}
          </p>
          {(widget.data.buttonText as string) && (
            <button
              style={{
                padding: '16px 32px',
                backgroundColor: 'var(--color-info)',
                color: 'var(--color-text-primary)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '18px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
              onClick={() => {
                if (widget.data.buttonUrl) {
                  window.location.href = String(widget.data.buttonUrl);
                }
              }}
            >
              {String(widget.data.buttonText)}
            </button>
          )}
        </div>
      );
    }

    case 'features': {
      const features = readFeatures(widget.data);
      return (
        <div className="feature-grid" style={style}>
          {features.map((feature, idx: number) => (
            <div
              key={idx}
              style={{
                padding: '24px',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              {feature.icon && (
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                  {feature.icon}
                </div>
              )}
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>
                {feature.title}
              </h3>
              <p style={{ color: 'var(--color-text-disabled)', fontSize: '14px' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      );
    }

    case 'pricing': {
      const plans = readPlans(widget.data);
      return <PricingWidget plans={plans} data={widget.data} style={style} />;
    }

    case 'testimonial': {
      const quoteVal = widget.data.quote as string | null | undefined;
      const authorVal = widget.data.author as string | null | undefined;
      const roleVal = widget.data.role as string | null | undefined;
      return (
        <div
          style={{
            padding: '32px',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '8px',
            textAlign: 'center',
            ...style,
          }}
        >
          <p
            style={{
              fontSize: '18px',
              fontStyle: 'italic',
              color: 'var(--color-border-strong)',
              marginBottom: '16px',
            }}
          >
            &quot;{String(quoteVal !== '' && quoteVal != null ? quoteVal : 'Testimonial quote')}&quot;
          </p>
          <div style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>
            {String(authorVal !== '' && authorVal != null ? authorVal : 'Author Name')}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--color-text-disabled)' }}>
            {String(roleVal !== '' && roleVal != null ? roleVal : 'Role / Company')}
          </div>
        </div>
      );
    }

    case 'cta': {
      const ctaHeadingVal = widget.data.heading as string | null | undefined;
      const ctaTextRaw = widget.data.text as string | null | undefined;
      const ctaTextVal = ctaTextRaw !== '' && ctaTextRaw != null
        ? ctaTextRaw
        : (widget.data.subheading as string | null | undefined);
      const ctaButtonTextVal = widget.data.buttonText as string | null | undefined;
      return (
        <div
          style={{
            textAlign: 'center',
            padding: breakpoint === 'mobile' ? '40px 20px' : '60px 40px',
            backgroundColor: 'var(--color-info)',
            borderRadius: '8px',
            color: 'white',
            ...style,
          }}
        >
          <h2
            style={{
              fontSize: breakpoint === 'mobile' ? '24px' : '32px',
              fontWeight: 'bold',
              marginBottom: '16px',
              ...(textGradient ? gradientTextStyle(textGradient) : {}),
            }}
          >
            {String(ctaHeadingVal !== '' && ctaHeadingVal != null ? ctaHeadingVal : 'Ready to get started?')}
          </h2>
          <p style={{ fontSize: '18px', marginBottom: '24px' }}>
            {String(ctaTextVal !== '' && ctaTextVal != null ? ctaTextVal : 'Join thousands of satisfied customers')}
          </p>
          <button
            style={{
              padding: '16px 32px',
              backgroundColor: 'white',
              color: 'var(--color-info)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {String(ctaButtonTextVal !== '' && ctaButtonTextVal != null ? ctaButtonTextVal : 'Get Started')}
          </button>
        </div>
      );
    }

    case 'logo-grid': {
      const logos = (widget.data.logos as LogoItem[]) || [];
      return (
        <div className="logo-grid">
          { }
          {logos.map((logo, idx: number) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: '8px',
              }}
            >
              <Image
                src={logo.src}
                alt={logo.alt}
                width={120}
                height={60}
                unoptimized
                style={{
                  maxWidth: '120px',
                  maxHeight: '60px',
                  opacity: 0.7,
                }}
              />
            </div>
          ))}
        </div>
      );
    }

    case 'link': {
      const linkTextVal = widget.data.text as string | null | undefined;
      return (
        <a
          href={(widget.data.url as string) ?? '#'}
          target={widget.data.openInNewTab ? '_blank' : undefined}
          rel={widget.data.openInNewTab ? 'noopener noreferrer' : undefined}
          style={style}
        >
          {String(linkTextVal !== '' && linkTextVal != null ? linkTextVal : 'Link')}
        </a>
      );
    }

    case 'video': {
      const embedUrl = getVideoEmbedUrl(
        (widget.data.url as string) ?? '',
        (widget.data.provider as string) ?? 'youtube'
      );
      if (!embedUrl) {
        return null;
      }
      return (
        <div style={style}>
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px' }}>
            <iframe
              src={embedUrl}
              title="Embedded video"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      );
    }

    case 'spacer':
      return <div style={{ height: (widget.data.height as string) ?? '2rem', ...style }} />;

    case 'divider':
      return (
        <hr
          style={{
            border: 'none',
            height: (widget.data.thickness as string) ?? '1px',
            backgroundColor: (widget.data.color as string) ?? 'rgba(255,255,255,0.1)',
            ...style,
          }}
        />
      );

    case 'container':
    case 'row':
    case 'column': {
      // BACKWARD COMPAT + LIVE SAFETY: a container authored before true nesting
      // has no `children` array — render it byte-identically to before (a styled
      // empty box). It only becomes a real recursive flex/grid box once
      // `children` is an array (even `[]`), which only new-editor content has.
      if (widget.children === undefined) {
        return <div style={style} />;
      }
      const children = widget.children;
      const isEmpty = children.length === 0;
      // Sensible flex defaults when unset; `row` flows horizontally, everything
      // else vertically. Any style the widget sets (display/gap/justify/align/…)
      // wins over these defaults.
      const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: widget.type === 'row' ? 'row' : 'column',
        gap: '16px',
        alignItems: 'stretch',
        ...style,
      };
      // An empty container gets a small min-height so it stays visible/selectable
      // in the editor. On a live page an empty flex box is harmless.
      if (isEmpty && containerStyle.minHeight === undefined) {
        containerStyle.minHeight = '40px';
      }
      return (
        <div style={containerStyle} data-container-empty={isEmpty ? 'true' : undefined}>
          {children.map((child, childIdx) => (
            <AccessibleWidget key={child.id || childIdx} widget={child}>
              <div className="widget">
                <WidgetRenderer widget={child} breakpoint={breakpoint} />
              </div>
            </AccessibleWidget>
          ))}
        </div>
      );
    }

    case 'stats': {
      const stats = readStats(widget.data);
      return (
        <div className="feature-grid" style={style}>
          {stats.map((stat, idx: number) => (
            <div key={idx} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--color-info)', marginBottom: '0.5rem' }}>
                {stat.number}
              </div>
              <div style={{ fontSize: '1.125rem', color: 'var(--color-text-disabled)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      );
    }

    case 'counter': {
      const numberVal = (widget.data.number as number) ?? 0;
      const suffixVal = (widget.data.suffix as string) ?? '';
      const labelVal = (widget.data.label as string) ?? '';
      return (
        <div style={{ textAlign: 'center', ...style }}>
          <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--color-info)' }}>
            {numberVal}{suffixVal}
          </div>
          <div style={{ fontSize: '1rem', color: 'var(--color-text-disabled)', marginTop: '0.5rem' }}>{labelVal}</div>
        </div>
      );
    }

    case 'progress': {
      const percentage = Math.max(0, Math.min(100, (widget.data.percentage as number) ?? 0));
      const barColor = (widget.data.color as string) ?? 'var(--color-info)';
      const barLabel = (widget.data.label as string) ?? '';
      return (
        <div style={style}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem' }}>{barLabel}</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>{percentage}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: barColor, borderRadius: '4px' }} />
          </div>
        </div>
      );
    }

    case 'gallery': {
      const images = (widget.data.images as GalleryImage[]) || [];
      const columns = (widget.data.columns as number) || 3;
      return (
        <div
          style={{
            ...style,
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: (widget.data.gap as string) || '1rem',
          }}
        >
          {images.map((img, idx: number) => (
            <Image
              key={idx}
              src={img.src}
              alt={img.alt}
              width={400}
              height={250}
              unoptimized
              style={{ width: '100%', height: '250px', objectFit: 'cover', borderRadius: '8px' }}
            />
          ))}
        </div>
      );
    }

    case 'icon-box':
      return (
        <div style={style}>
          <div style={{ marginBottom: '1rem' }}><Icon name={String(widget.data.icon ?? '')} size={48} /></div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{String(widget.data.title ?? '')}</h3>
          <p style={{ color: 'var(--color-text-disabled)' }}>{String(widget.data.description ?? '')}</p>
        </div>
      );

    case 'social-icons': {
      const icons = (widget.data.icons as SocialIcon[]) ?? [];
      return (
        <div style={{ ...style, display: 'flex', gap: '1rem' }}>
          {icons.map((icon, idx: number) => (
            <a
              key={idx}
              href={icon.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={icon.platform}
              style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-info)',
                color: 'white',
                borderRadius: '50%',
                textDecoration: 'none',
                fontSize: '1.25rem',
              }}
            >
              {icon.icon ? <Icon name={String(icon.icon)} size={20} /> : getSocialIcon(icon.platform)}
            </a>
          ))}
        </div>
      );
    }

    case 'html':
      return <SafeHtml style={style} html={(widget.data.html as string) ?? ''} preset="rich-text" />;

    case 'code':
      return (
        <pre style={{ overflowX: 'auto', ...style }}>
          <code>{String((widget.data.code as string) ?? '')}</code>
        </pre>
      );

    case 'map': {
      const address = (widget.data.address as string) ?? '';
      const lat = widget.data.latitude as number | undefined;
      const lng = widget.data.longitude as number | undefined;
      const zoom = (widget.data.zoom as number) ?? 12;
      const query = address.trim() !== ''
        ? encodeURIComponent(address)
        : (lat != null && lng != null ? `${lat},${lng}` : '');
      if (!query) {
        return null;
      }
      return (
        <iframe
          title={address || 'Map'}
          src={`https://www.google.com/maps?q=${query}&z=${zoom}&output=embed`}
          style={{ width: '100%', height: '400px', border: 'none', borderRadius: '8px', ...style }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      );
    }

    case 'tabs': {
      const tabs = (widget.data.tabs as TabItem[]) ?? [];
      return <TabsWidget tabs={tabs} style={style} />;
    }

    case 'accordion': {
      const items = (widget.data.items as AccordionItem[]) ?? [];
      return <AccordionWidget items={items} style={style} />;
    }

    case 'faq': {
      const faqs = readFaqs(widget.data);
      return <AccordionWidget items={faqs.map((f) => ({ title: f.question, content: f.answer }))} style={style} />;
    }

    case 'modal':
      return (
        <ModalWidget
          buttonText={(widget.data.buttonText as string) ?? 'Open Modal'}
          title={(widget.data.title as string) ?? ''}
          content={(widget.data.content as string) ?? ''}
          buttonColor={(widget.data.buttonColor as string) ?? 'var(--color-info)'}
          style={style}
        />
      );

    case 'countdown':
      return (
        <CountdownTimer
          targetDate={(widget.data.targetDate as string) ?? ''}
          labels={widget.data.labels as { days?: string; hours?: string; minutes?: string; seconds?: string } | undefined}
          style={style}
        />
      );

    case 'slider': {
      const slides = (widget.data.slides as Array<{ image: string; caption?: string }>) ?? [];
      return (
        <SliderWidget
          slides={slides}
          autoplay={widget.data.autoplay !== false}
          interval={(widget.data.interval as number) ?? 5000}
          style={style}
        />
      );
    }

    case 'blog-list':
      return (
        <BlogListWidget
          columns={(widget.data.layout as string) === 'list' ? 1 : 3}
          showExcerpt={widget.data.showExcerpt !== false}
          showAuthor={widget.data.showAuthor !== false}
          showDate={widget.data.showDate !== false}
          style={style}
        />
      );

    case 'blog-post':
      return <BlogPostWidget postId={(widget.data.postId as string) ?? ''} style={style} />;

    case 'contact-form':
    case 'newsletter':
    case 'custom-form':
      return <WebsiteFormWidget widget={widget} style={style} breakpoint={breakpoint} />;

    case 'ecommerce':
      // Product showcase is data-driven and has no public render contract yet;
      // render nothing rather than a placeholder box on a live page.
      return null;

    default:
      // Unknown widget type — never show placeholder text on a published site.
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helper render utilities + interactive sub-widgets (live site only)
// ---------------------------------------------------------------------------

function getVideoEmbedUrl(url: string, provider: string): string {
  if (!url) {
    return '';
  }
  if (provider === 'youtube') {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  }
  if (provider === 'vimeo') {
    const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
    return videoId ? `https://player.vimeo.com/video/${videoId}` : '';
  }
  return url;
}

function getSocialIcon(platform: string): string {
  const icons: Record<string, string> = {
    facebook: 'f',
    twitter: 'X',
    instagram: 'IG',
    linkedin: 'in',
    youtube: 'YT',
    github: 'GH',
  };
  return icons[platform] || platform[0]?.toUpperCase() || '?';
}

function optionalColor(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * Theme-aware pricing table. Renders on the site's DARK theme by default
 * (dark glass cards, light text, the featured plan highlighted with the brand
 * accent and a gradient price number), matching the real site instead of the
 * old hardcoded white card. Per-plan and per-widget overrides are honoured:
 *   - `style.backgroundColor`      → non-featured card background
 *   - `data.cardBackground`        → non-featured card background (alias)
 *   - `data.borderColor`           → card border colour
 *   - `data.featuredColor`         → accent for the featured plan + price gradient
 *   - `data.priceGradient`         → explicit { from, to, angle } for the price number
 */
function PricingWidget({
  plans,
  data,
  style,
}: {
  plans: PricingPlan[];
  data: Record<string, unknown>;
  style: ConvertedStyle;
}) {
  const { theme } = useWebsiteTheme();

  const featuredColor = optionalColor(data.featuredColor) ?? theme.primaryColor;
  const cardBackground =
    optionalColor(data.cardBackground) ?? optionalColor(style.backgroundColor) ?? withAlpha(theme.textColor, 4);
  const cardBorderColor = optionalColor(data.borderColor) ?? withAlpha(theme.textColor, 12);
  const mutedColor = withAlpha(theme.textColor, 65);

  const rawPriceGradient = data.priceGradient;
  const priceGradient: GradientStops =
    typeof rawPriceGradient === 'object' && rawPriceGradient !== null
      ? (rawPriceGradient as GradientStops)
      : { from: theme.primaryColor, to: theme.secondaryColor, angle: 90 };

  return (
    <div className="pricing-grid" style={style}>
      {plans.map((plan, idx: number) => {
        const period = formatPlanPeriod(plan.period ?? '');
        const featured = Boolean(plan.featured);
        return (
          <div
            key={idx}
            style={{
              position: 'relative',
              padding: '32px',
              background: featured
                ? `linear-gradient(160deg, ${withAlpha(featuredColor, 16)}, ${withAlpha(featuredColor, 4)})`
                : cardBackground,
              border: `1px solid ${featured ? featuredColor : cardBorderColor}`,
              borderRadius: '16px',
              textAlign: 'center',
              color: theme.textColor,
              boxShadow: featured
                ? `0 0 0 1px ${featuredColor}, 0 24px 48px -24px ${withAlpha(featuredColor, 55)}`
                : undefined,
            }}
          >
            {featured && (
              <div
                style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: featuredColor,
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  padding: '4px 14px',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                }}
              >
                Most Popular
              </div>
            )}
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: theme.textColor }}>
              {plan.name}
            </h3>
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
              <span style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.05, ...gradientTextStyle(priceGradient) }}>
                {formatPlanPrice(plan.price)}
              </span>
              {period !== '' && (
                <span style={{ fontSize: '16px', fontWeight: 'normal', color: mutedColor }}>{period}</span>
              )}
            </div>
            {plan.features.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', textAlign: 'left' }}>
                {plan.features.map((feature, fIdx) => (
                  <li
                    key={fIdx}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px', fontSize: '14px', color: theme.textColor }}
                  >
                    <span style={{ color: featuredColor, flexShrink: 0 }}>&#10003;</span>
                    {feature}
                  </li>
                ))}
              </ul>
            )}
            <button
              style={{
                width: '100%',
                padding: '12px',
                background: featured ? featuredColor : 'transparent',
                color: featured ? '#ffffff' : theme.textColor,
                border: `1px solid ${featuredColor}`,
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => {
                if (plan.buttonUrl) {
                  window.location.href = plan.buttonUrl;
                }
              }}
            >
              {plan.buttonText !== undefined && plan.buttonText !== '' ? plan.buttonText : 'Choose Plan'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TabsWidget({ tabs, style }: { tabs: TabItem[]; style: React.CSSProperties }) {
  const [active, setActive] = useState(0);
  if (tabs.length === 0) {
    return null;
  }
  const current = tabs[Math.min(active, tabs.length - 1)];
  return (
    <div style={style}>
      <div style={{ borderBottom: '1px solid var(--color-border-light)', display: 'flex', flexWrap: 'wrap' }}>
        {tabs.map((tab, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setActive(index)}
            style={{
              padding: '12px 24px',
              background: index === active ? 'var(--color-info)' : 'transparent',
              color: index === active ? 'white' : 'var(--color-text-disabled)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              borderBottom: index === active ? '2px solid var(--color-info)' : 'none',
            }}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <div style={{ padding: '20px', background: 'var(--color-bg-elevated)' }}>
        {current?.content ?? ''}
      </div>
    </div>
  );
}

function AccordionWidget({ items, style }: { items: AccordionItem[]; style: React.CSSProperties }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  if (items.length === 0) {
    return null;
  }
  return (
    <div style={style}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            style={{
              border: '1px solid var(--color-border-light)',
              borderRadius: '8px',
              marginBottom: '8px',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              aria-expanded={isOpen}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '16px',
                background: 'var(--color-bg-elevated)',
                fontSize: '16px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: 'none',
                color: 'inherit',
              }}
            >
              {item.title}
              <span style={{ fontSize: '12px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                &#x25BC;
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '16px', borderTop: '1px solid var(--color-border-light)', lineHeight: 1.6 }}>
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ModalWidget({
  buttonText,
  title,
  content,
  buttonColor,
  style,
}: {
  buttonText: string;
  title: string;
  content: string;
  buttonColor: string;
  style: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={style}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '12px 24px',
          background: buttonColor,
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 500,
        }}
      >
        {buttonText}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-paper, #1a1a2e)',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
          >
            {title && <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{title}</h3>}
            <p style={{ marginBottom: '1.5rem' }}>{content}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: '10px 20px',
                background: buttonColor,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CountdownLabels {
  days?: string;
  hours?: string;
  minutes?: string;
  seconds?: string;
}

function CountdownTimer({
  targetDate,
  labels,
  style,
}: {
  targetDate: string;
  labels?: CountdownLabels;
  style: React.CSSProperties;
}) {
  const target = useMemo(() => {
    const t = new Date(targetDate).getTime();
    return Number.isNaN(t) ? 0 : t;
  }, [targetDate]);

  // Start unmounted so server + first client render match (no hydration
  // mismatch from comparing server time to client time); fill in on mount.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      return;
    }
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (target === 0 || remaining === null) {
    return null;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const units: Array<{ value: number; label: string }> = [
    { value: days, label: labels?.days ?? 'Days' },
    { value: hours, label: labels?.hours ?? 'Hours' },
    { value: minutes, label: labels?.minutes ?? 'Minutes' },
    { value: seconds, label: labels?.seconds ?? 'Seconds' },
  ];

  return (
    <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', ...style }}>
      {units.map((unit) => (
        <div key={unit.label} style={{ textAlign: 'center', minWidth: '60px' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>
            {String(unit.value).padStart(2, '0')}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>{unit.label}</div>
        </div>
      ))}
    </div>
  );
}

function SliderWidget({
  slides,
  autoplay,
  interval,
  style,
}: {
  slides: Array<{ image: string; caption?: string }>;
  autoplay: boolean;
  interval: number;
  style: React.CSSProperties;
}) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (!autoplay || count <= 1) {
      return;
    }
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % count);
    }, Math.max(1500, interval));
    return () => clearInterval(id);
  }, [autoplay, interval, count]);

  if (count === 0) {
    return null;
  }
  const current = slides[index];

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '8px', ...style }}>
      <Image
        src={current.image}
        alt={current.caption ?? `Slide ${index + 1}`}
        width={800}
        height={400}
        unoptimized
        style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
      />
      {current.caption && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '1rem',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
            color: 'white',
          }}
        >
          {current.caption}
        </div>
      )}
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => setIndex((prev) => (prev - 1 + count) % count)}
            style={sliderArrowStyle('left')}
          >
            &#8249;
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => setIndex((prev) => (prev + 1) % count)}
            style={sliderArrowStyle('right')}
          >
            &#8250;
          </button>
          <div style={{ position: 'absolute', bottom: '0.5rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: i === index ? 'white' : 'rgba(255,255,255,0.5)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function sliderArrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: '0.5rem',
    transform: 'translateY(-50%)',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0,0,0,0.4)',
    color: 'white',
    fontSize: '1.5rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

interface BlogSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featuredImage?: string;
  authorName?: string;
  publishedAt?: string;
  readTime?: number;
}

function BlogListWidget({
  columns,
  showExcerpt,
  showAuthor,
  showDate,
  style,
}: {
  columns: number;
  showExcerpt: boolean;
  showAuthor: boolean;
  showDate: boolean;
  style: React.CSSProperties;
}) {
  const [posts, setPosts] = useState<BlogSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/blog/posts')
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((data: { posts?: BlogSummary[] }) => {
        if (!cancelled) {
          setPosts(Array.isArray(data.posts) ? data.posts : []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Until loaded, or when there are genuinely no posts, render nothing rather
  // than a placeholder box.
  if (!loaded || posts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, columns)}, 1fr)`,
        gap: '1.5rem',
      }}
    >
      {posts.map((post) => (
        <a
          key={post.id}
          href={`/blog/${post.slug}`}
          style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            border: '1px solid var(--color-border-light)',
            borderRadius: '12px',
            overflow: 'hidden',
            background: 'var(--color-bg-elevated)',
          }}
        >
          {post.featuredImage && (
            <Image
              src={post.featuredImage}
              alt={post.title}
              width={400}
              height={220}
              unoptimized
              style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
            />
          )}
          <div style={{ padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>{post.title}</h3>
            {showExcerpt && post.excerpt && (
              <p style={{ margin: '0 0 0.75rem', color: 'var(--color-text-disabled)', fontSize: '0.95rem' }}>
                {post.excerpt}
              </p>
            )}
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-disabled)' }}>
              {showAuthor && post.authorName ? post.authorName : ''}
              {showAuthor && showDate && post.authorName && post.publishedAt ? ' · ' : ''}
              {showDate && post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

function BlogPostWidget({ postId, style }: { postId: string; style: React.CSSProperties }) {
  const [post, setPost] = useState<{ title: string; excerpt?: string; featuredImage?: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!postId) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    fetch(`/api/public/blog/posts/${encodeURIComponent(postId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { post?: { title: string; excerpt?: string; featuredImage?: string } } | null) => {
        if (!cancelled) {
          setPost(data?.post ?? null);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (!loaded || !post) {
    return null;
  }

  return (
    <article style={style}>
      {post.featuredImage && (
        <Image
          src={post.featuredImage}
          alt={post.title}
          width={800}
          height={400}
          unoptimized
          style={{ width: '100%', height: 'auto', borderRadius: '12px', marginBottom: '1.5rem', display: 'block' }}
        />
      )}
      <h2 style={{ marginBottom: '0.75rem' }}>{post.title}</h2>
      {post.excerpt && <p style={{ color: 'var(--color-text-disabled)' }}>{post.excerpt}</p>}
      <a href={`/blog/${encodeURIComponent(postId)}`} style={{ color: 'var(--color-info)' }}>
        Read more →
      </a>
    </article>
  );
}

