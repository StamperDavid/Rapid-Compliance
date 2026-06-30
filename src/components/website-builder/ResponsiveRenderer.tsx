/**
 * Responsive Page Renderer
 * Automatically applies mobile-responsive styling to page content
 * Handles breakpoints: desktop (1200px+), tablet (768-1199px), mobile (<768px)
 */

'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { PageSection, Widget } from '@/types/website';
import type {
  LogoItem,
  GalleryImage,
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
import SafeHtml from '@/components/SafeHtml';
import { OptimizedImage } from './OptimizedImage';
import { AccessibleWidget, SkipToMain } from './AccessibleWidget';
import { WebsiteFormWidget } from './WebsiteFormWidget';

interface ConvertedStyle extends Omit<React.CSSProperties, 'padding' | 'margin'> {
  padding?: string;
  margin?: string;
}

interface ResponsiveRendererProps {
  content: PageSection[];
  breakpoint?: 'desktop' | 'tablet' | 'mobile';
}

export function ResponsiveRenderer({ content, breakpoint = 'desktop' }: ResponsiveRendererProps) {
  return (
    <div className="responsive-page" role="main" id="main-content">
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

        /* Responsive spacing */
        @media (max-width: 767px) {
          .section { padding: 40px 20px !important; }
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

  const sectionStyle: React.CSSProperties = {
    backgroundColor: section.backgroundColor ?? 'transparent',
    backgroundImage: section.backgroundImage ? `url(${section.backgroundImage})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: getResponsivePadding(),
    maxWidth: section.fullWidth ? '100%' : section.maxWidth ?? '1200px',
    margin: '0 auto',
    width: '100%',
  };

  return (
    <section className="section" style={sectionStyle}>
      <div className={section.columns.length > 1 ? 'flex-container' : ''}>
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
    </section>
  );
}

function WidgetRenderer({ widget, breakpoint }: { widget: Widget; breakpoint: string }) {
  const convertSpacing = (spacing: { top?: string; right?: string; bottom?: string; left?: string }): string => {
    return `${spacing.top ?? '0'} ${spacing.right ?? '0'} ${spacing.bottom ?? '0'} ${spacing.left ?? '0'}`;
  };

  const convertStyleToCSS = (style: Partial<typeof widget.style>): ConvertedStyle => {
    const result: ConvertedStyle = {};

    if (!style) {
      return result;
    }

    // Copy all properties except padding and margin
    const { padding, margin, ...otherProps } = style;
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

    return result;
  };

  const getResponsiveStyle = (): React.CSSProperties => {
    const baseStyle = convertStyleToCSS(widget.style ?? {});

    // Apply responsive overrides
    if (breakpoint === 'mobile' && widget.responsive?.mobile) {
      const mobileStyle = convertStyleToCSS(widget.responsive.mobile);
      return { ...baseStyle, ...mobileStyle };
    }
    if (breakpoint === 'tablet' && widget.responsive?.tablet) {
      const tabletStyle = convertStyleToCSS(widget.responsive.tablet);
      return { ...baseStyle, ...tabletStyle };
    }

    return baseStyle;
  };

  const style = getResponsiveStyle();

  // Route legacy widget type names (feature-grid, pricing-table) to their
  // canonical cases so seed/template content renders identically to native
  // canonical content.
  switch (canonicalWidgetType(widget.type)) {
    case 'heading': {
      const level = widget.data.level ?? 1;
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      const textVal = widget.data.text as string | null | undefined;
      return (
        <HeadingTag style={style}>
          {String(textVal !== '' && textVal != null ? textVal : 'Heading')}
        </HeadingTag>
      );
    }

    case 'text': {
      const contentVal = widget.data.content as string | null | undefined;
      return (
        <p style={style}>
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
          }}
        >
          <h1
            style={{
              fontSize: breakpoint === 'mobile' ? '32px' : '48px',
              fontWeight: 'bold',
              marginBottom: '16px',
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
        <div className="feature-grid">
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
      return (
        <div className="pricing-grid">
          {plans.map((plan, idx: number) => {
            const period = formatPlanPeriod(plan.period ?? '');
            return (
              <div
                key={idx}
                style={{
                  padding: '32px',
                  backgroundColor: 'white',
                  border: plan.featured ? '2px solid var(--color-info)' : '2px solid var(--color-border-light)',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}
              >
                <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px' }}>
                  {plan.name}
                </h3>
                <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '24px' }}>
                  {formatPlanPrice(plan.price)}
                  {period !== '' && (
                    <span style={{ fontSize: '16px', fontWeight: 'normal', color: 'var(--color-text-disabled)' }}>
                      {period}
                    </span>
                  )}
                </div>
                {plan.features.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', textAlign: 'left' }}>
                    {plan.features.map((feature, fIdx) => (
                      <li
                        key={fIdx}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px', fontSize: '14px' }}
                      >
                        <span style={{ color: 'var(--color-info)' }}>&#10003;</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: plan.featured ? 'var(--color-info)' : 'white',
                    color: plan.featured ? 'white' : 'var(--color-border-strong)',
                    border: plan.featured ? 'none' : '1px solid var(--color-border-light)',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: '500',
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
    case 'column':
      // Layout primitives carry only styling in this model (no nested widget
      // tree). Render the styled box; never a placeholder.
      return <div style={style} />;

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
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{String(widget.data.icon ?? '')}</div>
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
              {getSocialIcon(icon.platform)}
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

