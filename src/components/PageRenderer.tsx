'use client';

import React from 'react';
import Link from 'next/link';
import type { PageContent } from '@/hooks/usePageContent';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

interface StatsItem {
  value?: string;
  label?: string;
}

interface FeatureItem {
  icon?: string;
  title?: string;
  desc?: string;
}

interface FaqItem {
  q?: string;
  a?: string;
}

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
}

interface TestimonialContent {
  quote?: string;
  author?: string;
  role?: string;
  company?: string;
}

interface IconBoxContent {
  icon?: string;
  title?: string;
  text?: string;
}

interface CounterContent {
  number?: string;
  suffix?: string;
  label?: string;
}

interface HeroCtaContent {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
}

interface WidgetContent {
  items?: StatsItem[] | FeatureItem[] | FaqItem[];
  plans?: PricingPlan[];
  quote?: string;
  author?: string;
  role?: string;
  company?: string;
  icon?: string;
  title?: string;
  text?: string;
  number?: string;
  suffix?: string;
  label?: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
}

interface WidgetSettings {
  tag?: string;
  href?: string;
  alt?: string;
}

interface WidgetElement {
  id: string;
  type: string;
  content?: WidgetContent | string;
  children?: WidgetElement[];
  styles?: {
    desktop?: Record<string, string>;
    tablet?: Record<string, string>;
    mobile?: Record<string, string>;
  };
  settings?: WidgetSettings;
}

function ElementRenderer({ element }: { element: WidgetElement }) {
  const { theme } = useWebsiteTheme();
  const styles = element.styles?.desktop ?? {};

  // Helper to get content as WidgetContent object
  const contentObj = typeof element.content === 'object' ? element.content : null;

  switch (element.type) {
    case 'heading': {
      const settingsTag = element.settings?.tag;
      const Tag = ((settingsTag !== '' && settingsTag != null) ? settingsTag : 'h2') as keyof React.JSX.IntrinsicElements;
      return <Tag style={styles}>{typeof element.content === 'string' ? element.content : ''}</Tag>;
    }

    case 'text':
      return <p style={styles}>{typeof element.content === 'string' ? element.content : ''}</p>;

    case 'button': {
      const settingsHref = element.settings?.href;
      return (
        <Link
          href={(settingsHref ?? '#')}
          style={{
            display: 'inline-block',
            textDecoration: 'none',
            ...styles,
          }}
        >
          {typeof element.content === 'string' ? element.content : ''}
        </Link>
      );
    }

    case 'image':
      return (
        /* eslint-disable-next-line @next/next/no-img-element -- Dynamic CMS image content */
        <img
          src={typeof element.content === 'string' ? element.content : '/placeholder.jpg'}
          alt={element.settings?.alt ?? ''}
          style={{ maxWidth: '100%', ...styles }}
        />
      );

    case 'icon':
      return <span style={{ fontSize: '3rem', ...styles }}>{typeof element.content === 'string' ? element.content : ''}</span>;

    case 'spacer':
      return <div style={{ height: styles.height ?? '40px' }} />;

    case 'divider':
      return <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '2rem 0', ...styles }} />;

    case 'stats':
      if (contentObj?.items) {
        const statsItems = contentObj.items as StatsItem[];
        return (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4rem', flexWrap: 'wrap', ...styles }}>
            {statsItems.map((item, idx) => (
              <div key={idx} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: theme.primaryColor }}>{item.value}</div>
                <div style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}>{item.label}</div>
              </div>
            ))}
          </div>
        );
      }
      return null;

    case 'feature-grid':
      if (contentObj?.items) {
        const featureItems = contentObj.items as FeatureItem[];
        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            ...styles
          }}>
            {featureItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '24px',
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border-light)',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{item.icon}</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '8px' }}>{item.title}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        );
      }
      return null;

    case 'faq':
      if (contentObj?.items) {
        const faqItems = contentObj.items as FaqItem[];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', ...styles }}>
            {faqItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '24px',
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border-light)',
                }}
              >
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '12px' }}>{item.q}</h3>
                <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>{item.a}</p>
              </div>
            ))}
          </div>
        );
      }
      return null;

    case 'pricing-table':
      if (contentObj?.plans) {
        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            ...styles
          }}>
            {contentObj.plans.map((plan, idx) => (
              <div
                key={idx}
                style={{
                  padding: '32px',
                  backgroundColor: plan.highlighted ? theme.primaryColor : 'var(--color-bg-elevated)',
                  borderRadius: '16px',
                  border: plan.highlighted ? 'none' : '1px solid var(--color-border-light)',
                  position: 'relative',
                  transform: plan.highlighted ? 'scale(1.05)' : 'none',
                }}
              >
                {plan.highlighted && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '4px 16px',
                    backgroundColor: 'var(--color-warning)',
                    color: 'var(--color-bg-main)',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    borderRadius: '9999px',
                  }}>
                    MOST POPULAR
                  </div>
                )}
                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '8px' }}>{plan.name}</h3>
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{plan.price}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{plan.period}</span>
                </div>
                <Link
                  href="/onboarding/industry"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px',
                    textAlign: 'center',
                    backgroundColor: plan.highlighted ? 'var(--color-text-primary)' : theme.primaryColor,
                    color: plan.highlighted ? theme.primaryColor : 'var(--color-text-primary)',
                    borderRadius: '8px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    marginBottom: '24px',
                  }}
                >
                  Get Started
                </Link>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px', color: 'var(--color-text-primary)' }}>
                      <span style={{ color: plan.highlighted ? 'var(--color-text-primary)' : theme.primaryColor }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      }
      return null;

    case 'testimonial':
      if (contentObj) {
        const testimonial = contentObj as TestimonialContent;
        return (
          <div style={{
            padding: '32px',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '16px',
            border: '1px solid var(--color-border-light)',
            ...styles
          }}>
            <p style={{ fontSize: '1.25rem', fontStyle: 'italic', color: 'var(--color-text-primary)', marginBottom: '16px', lineHeight: '1.6' }}>
              &quot;{testimonial.quote}&quot;
            </p>
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{testimonial.author}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                {testimonial.role}{testimonial.company ? `, ${testimonial.company}` : ''}
              </div>
            </div>
          </div>
        );
      }
      return null;

    case 'icon-box':
      if (contentObj) {
        const iconBox = contentObj as IconBoxContent;
        return (
          <div style={{
            padding: '24px',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '12px',
            border: '1px solid var(--color-border-light)',
            ...styles
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{iconBox.icon}</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '8px' }}>{iconBox.title}</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>{iconBox.text}</p>
          </div>
        );
      }
      return null;

    case 'counter':
      if (contentObj) {
        const counter = contentObj as CounterContent;
        return (
          <div style={{ textAlign: 'center', ...styles }}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: theme.primaryColor }}>
              {counter.number}{counter.suffix}
            </div>
            <div style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}>{counter.label}</div>
          </div>
        );
      }
      return null;

    case 'hero':
    case 'cta':
      if (contentObj) {
        const heroCta = contentObj as HeroCtaContent;
        return (
          <div style={{ textAlign: 'center', ...styles }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '16px' }}>{heroCta.title}</h2>
            {heroCta.subtitle && (
              <p style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', marginBottom: '24px', maxWidth: '600px', margin: '0 auto 24px' }}>
                {heroCta.subtitle}
              </p>
            )}
            {heroCta.buttonText && (
              <Link
                href={heroCta.buttonLink ?? '/signup'}
                style={{
                  display: 'inline-block',
                  padding: '16px 32px',
                  backgroundColor: theme.primaryColor,
                  color: 'var(--color-text-primary)',
                  borderRadius: '8px',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                {heroCta.buttonText}
              </Link>
            )}
          </div>
        );
      }
      return null;

    default:
      // For unknown types, try to render content as text
      if (typeof element.content === 'string') {
        return <div style={styles}>{element.content}</div>;
      }
      return null;
  }
}

interface PageRendererProps {
  page: PageContent;
}

export default function PageRenderer({ page }: PageRendererProps) {
  if (!page?.sections) {
    return null;
  }

  return (
    <>
      {page.sections
        .filter(section => section.visible !== false)
        .map(section => (
          <section
            key={section.id}
            style={{
              ...section.styles?.desktop,
            }}
          >
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
              {section.children?.map(element => (
                <ElementRenderer key={element.id} element={element} />
              ))}
            </div>
          </section>
        ))}
    </>
  );
}









