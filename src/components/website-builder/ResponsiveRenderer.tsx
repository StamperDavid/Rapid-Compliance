/**
 * Responsive Page Renderer
 * Automatically applies mobile-responsive styling to page content
 * Handles breakpoints: desktop (1200px+), tablet (768-1199px), mobile (<768px)
 */

'use client';

import type { PageSection, Widget } from '@/types/website';
import { OptimizedImage } from './OptimizedImage';
import { AccessibleWidget, SkipToMain } from './AccessibleWidget';

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
  const convertSpacing = (spacing?: any): string => {
    if (!spacing) {return '0';}
    if (typeof spacing === 'string') {return spacing;}
    return `${spacing.top ?? 0} ${spacing.right ?? 0} ${spacing.bottom ?? 0} ${spacing.left ?? 0}`;
  };

  const getResponsiveStyle = (): React.CSSProperties => {
    const baseStyle: any = { ...(widget.style ?? {}) };
    
    // Convert Spacing objects to CSS strings
    if (baseStyle.padding && typeof baseStyle.padding === 'object') {
      baseStyle.padding = convertSpacing(baseStyle.padding);
    }
    if (baseStyle.margin && typeof baseStyle.margin === 'object') {
      baseStyle.margin = convertSpacing(baseStyle.margin);
    }
    
    // Apply responsive overrides
    if (breakpoint === 'mobile' && widget.responsive?.mobile) {
      const mobileStyle: any = { ...widget.responsive.mobile };
      if (mobileStyle.padding && typeof mobileStyle.padding === 'object') {
        mobileStyle.padding = convertSpacing(mobileStyle.padding);
      }
      if (mobileStyle.margin && typeof mobileStyle.margin === 'object') {
        mobileStyle.margin = convertSpacing(mobileStyle.margin);
      }
      return { ...baseStyle, ...mobileStyle };
    }
    if (breakpoint === 'tablet' && widget.responsive?.tablet) {
      const tabletStyle: any = { ...widget.responsive.tablet };
      if (tabletStyle.padding && typeof tabletStyle.padding === 'object') {
        tabletStyle.padding = convertSpacing(tabletStyle.padding);
      }
      if (tabletStyle.margin && typeof tabletStyle.margin === 'object') {
        tabletStyle.margin = convertSpacing(tabletStyle.margin);
      }
      return { ...baseStyle, ...tabletStyle };
    }
    
    return baseStyle;
  };

  const style = getResponsiveStyle();

  switch (widget.type) {
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
            backgroundColor: (widget.data.color as string) ?? '#3b82f6',
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
                backgroundColor: '#3b82f6',
                color: 'white',
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
      const features = (widget.data.features as any[]) || [];
      return (
        <div className="feature-grid">
          {features.map((feature: any, idx: number) => (
            <div
              key={idx}
              style={{
                padding: '24px',
                backgroundColor: '#f9fafb',
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
              <p style={{ color: '#6b7280', fontSize: '14px' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      );
    }

    case 'pricing': {
      const plans = (widget.data.plans as any[]) || [];
      return (
        <div className="pricing-grid">
          {plans.map((plan: any, idx: number) => (
            <div
              key={idx}
              style={{
                padding: '32px',
                backgroundColor: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px' }}>
                {plan.name}
              </h3>
              <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '24px' }}>
                ${plan.price}
                <span style={{ fontSize: '16px', fontWeight: 'normal', color: '#6b7280' }}>
                  /month
                </span>
              </div>
              <button
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: plan.featured ? '#3b82f6' : 'white',
                  color: plan.featured ? 'white' : '#374151',
                  border: plan.featured ? 'none' : '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Choose Plan
              </button>
            </div>
          ))}
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
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            textAlign: 'center',
            ...style,
          }}
        >
          <p
            style={{
              fontSize: '18px',
              fontStyle: 'italic',
              color: '#374151',
              marginBottom: '16px',
            }}
          >
            &quot;{String(quoteVal !== '' && quoteVal != null ? quoteVal : 'Testimonial quote')}&quot;
          </p>
          <div style={{ fontWeight: '600', color: '#111827' }}>
            {String(authorVal !== '' && authorVal != null ? authorVal : 'Author Name')}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {String(roleVal !== '' && roleVal != null ? roleVal : 'Role / Company')}
          </div>
        </div>
      );
    }

    case 'cta': {
      const ctaHeadingVal = widget.data.heading as string | null | undefined;
      const ctaTextVal = widget.data.text as string | null | undefined;
      const ctaButtonTextVal = widget.data.buttonText as string | null | undefined;
      return (
        <div
          style={{
            textAlign: 'center',
            padding: breakpoint === 'mobile' ? '40px 20px' : '60px 40px',
            backgroundColor: '#3b82f6',
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
              color: '#3b82f6',
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
      const logos = (widget.data.logos as any[]) || [];
      return (
        <div className="logo-grid">
          {logos.map((logo: any, idx: number) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
              }}
            >
              <img
                src={logo.src}
                alt={logo.alt}
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

    default:
      return (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f3f4f6',
            borderRadius: '6px',
            color: '#6b7280',
            ...style,
          }}
        >
          {widget.type} widget
        </div>
      );
  }
}

