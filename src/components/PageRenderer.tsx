'use client';

import React from 'react';
import Link from 'next/link';
import { PageContent } from '@/hooks/usePageContent';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

interface WidgetElement {
  id: string;
  type: string;
  content?: any;
  children?: WidgetElement[];
  styles?: {
    desktop?: Record<string, string>;
    tablet?: Record<string, string>;
    mobile?: Record<string, string>;
  };
  settings?: Record<string, any>;
}

function ElementRenderer({ element }: { element: WidgetElement }) {
  const { theme } = useWebsiteTheme();
  const styles = element.styles?.desktop || {};

  switch (element.type) {
    case 'heading':
      const Tag = (element.settings?.tag || 'h2') as keyof JSX.IntrinsicElements;
      return <Tag style={styles}>{element.content}</Tag>;

    case 'text':
      return <p style={styles}>{element.content}</p>;

    case 'button':
      return (
        <Link
          href={element.settings?.href || '#'}
          style={{
            display: 'inline-block',
            textDecoration: 'none',
            ...styles,
          }}
        >
          {element.content}
        </Link>
      );

    case 'image':
      return (
        <img
          src={typeof element.content === 'string' ? element.content : '/placeholder.jpg'}
          alt={element.settings?.alt || ''}
          style={{ maxWidth: '100%', ...styles }}
        />
      );

    case 'icon':
      return <span style={{ fontSize: '3rem', ...styles }}>{element.content}</span>;

    case 'spacer':
      return <div style={{ height: styles.height || '40px' }} />;

    case 'divider':
      return <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '2rem 0', ...styles }} />;

    case 'stats':
      if (element.content?.items) {
        return (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4rem', flexWrap: 'wrap', ...styles }}>
            {element.content.items.map((item: { value: string; label: string }, idx: number) => (
              <div key={idx} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: theme.primaryColor }}>{item.value}</div>
                <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)' }}>{item.label}</div>
              </div>
            ))}
          </div>
        );
      }
      return null;

    case 'feature-grid':
      if (element.content?.items) {
        return (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '24px',
            ...styles 
          }}>
            {element.content.items.map((item: { icon: string; title: string; desc: string }, idx: number) => (
              <div 
                key={idx} 
                style={{ 
                  padding: '24px', 
                  backgroundColor: 'rgba(255,255,255,0.05)', 
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{item.icon}</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>{item.title}</h3>
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        );
      }
      return null;

    case 'faq':
      if (element.content?.items) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', ...styles }}>
            {element.content.items.map((item: { q: string; a: string }, idx: number) => (
              <div 
                key={idx} 
                style={{ 
                  padding: '24px', 
                  backgroundColor: 'rgba(255,255,255,0.05)', 
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#fff', marginBottom: '12px' }}>{item.q}</h3>
                <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>{item.a}</p>
              </div>
            ))}
          </div>
        );
      }
      return null;

    case 'pricing-table':
      if (element.content?.plans) {
        return (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '24px',
            ...styles 
          }}>
            {element.content.plans.map((plan: { name: string; price: string; period: string; features: string[]; highlighted?: boolean }, idx: number) => (
              <div 
                key={idx} 
                style={{ 
                  padding: '32px', 
                  backgroundColor: plan.highlighted ? theme.primaryColor : 'rgba(255,255,255,0.05)', 
                  borderRadius: '16px',
                  border: plan.highlighted ? 'none' : '1px solid rgba(255,255,255,0.1)',
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
                    backgroundColor: '#fbbf24',
                    color: '#000',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    borderRadius: '9999px',
                  }}>
                    MOST POPULAR
                  </div>
                )}
                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>{plan.name}</h3>
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 'bold', color: '#fff' }}>{plan.price}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{plan.period}</span>
                </div>
                <Link
                  href="/signup"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px',
                    textAlign: 'center',
                    backgroundColor: plan.highlighted ? '#fff' : theme.primaryColor,
                    color: plan.highlighted ? theme.primaryColor : '#fff',
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
                    <li key={fIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px', color: 'rgba(255,255,255,0.9)' }}>
                      <span style={{ color: plan.highlighted ? '#fff' : theme.primaryColor }}>✓</span>
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
      if (typeof element.content === 'object') {
        return (
          <div style={{ 
            padding: '32px', 
            backgroundColor: 'rgba(255,255,255,0.05)', 
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            ...styles 
          }}>
            <p style={{ fontSize: '1.25rem', fontStyle: 'italic', color: '#fff', marginBottom: '16px', lineHeight: '1.6' }}>
              "{element.content.quote}"
            </p>
            <div>
              <div style={{ fontWeight: 'bold', color: '#fff' }}>{element.content.author}</div>
              <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>
                {element.content.role}{element.content.company ? `, ${element.content.company}` : ''}
              </div>
            </div>
          </div>
        );
      }
      return null;

    case 'icon-box':
      if (typeof element.content === 'object') {
        return (
          <div style={{ 
            padding: '24px', 
            backgroundColor: 'rgba(255,255,255,0.05)', 
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            ...styles 
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{element.content.icon}</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>{element.content.title}</h3>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>{element.content.text}</p>
          </div>
        );
      }
      return null;

    case 'counter':
      if (typeof element.content === 'object') {
        return (
          <div style={{ textAlign: 'center', ...styles }}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: theme.primaryColor }}>
              {element.content.number}{element.content.suffix}
            </div>
            <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)' }}>{element.content.label}</div>
          </div>
        );
      }
      return null;

    case 'hero':
    case 'cta':
      if (typeof element.content === 'object') {
        return (
          <div style={{ textAlign: 'center', ...styles }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '16px' }}>{element.content.title}</h2>
            {element.content.subtitle && (
              <p style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.8)', marginBottom: '24px', maxWidth: '600px', margin: '0 auto 24px' }}>
                {element.content.subtitle}
              </p>
            )}
            {element.content.buttonText && (
              <Link
                href={element.content.buttonLink || '/signup'}
                style={{
                  display: 'inline-block',
                  padding: '16px 32px',
                  backgroundColor: theme.primaryColor,
                  color: '#fff',
                  borderRadius: '8px',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                {element.content.buttonText}
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
  if (!page || !page.sections) {
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
