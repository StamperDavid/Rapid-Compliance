/**
 * Widget Renderer
 * Renders each widget type based on its data and style
 */

'use client';

import { Widget, WidgetStyle, Spacing } from '@/types/website';

interface WidgetRendererProps {
  widget: Widget;
  isEditable?: boolean;
}

export default function WidgetRenderer({ widget, isEditable = false }: WidgetRendererProps) {
  const style = convertWidgetStyleToCSS(widget.style);

  switch (widget.type) {
    case 'heading':
      const HeadingTag = (widget.data.tag || 'h2') as keyof JSX.IntrinsicElements;
      return <HeadingTag style={style}>{widget.data.text || 'Heading'}</HeadingTag>;

    case 'text':
      return <p style={style}>{widget.data.content || 'Text content'}</p>;

    case 'button':
      return (
        <a 
          href={widget.data.url || '#'} 
          target={widget.data.openInNewTab ? '_blank' : undefined}
          rel={widget.data.openInNewTab ? 'noopener noreferrer' : undefined}
          style={{ ...style, display: 'inline-block', textDecoration: 'none' }}
        >
          {widget.data.text || 'Button'}
        </a>
      );

    case 'link':
      return (
        <a 
          href={widget.data.url || '#'}
          target={widget.data.openInNewTab ? '_blank' : undefined}
          rel={widget.data.openInNewTab ? 'noopener noreferrer' : undefined}
          style={style}
        >
          {widget.data.text || 'Link'}
        </a>
      );

    case 'image':
      return (
        <div style={style}>
          <img 
            src={widget.data.src || 'https://via.placeholder.com/800x400'} 
            alt={widget.data.alt || ''}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
          {widget.data.caption && (
            <p style={{ 
              fontSize: '0.875rem', 
              color: '#6c757d', 
              marginTop: '0.5rem',
              textAlign: 'center',
            }}>
              {widget.data.caption}
            </p>
          )}
        </div>
      );

    case 'video':
      return (
        <div style={style}>
          <div style={{ 
            position: 'relative', 
            paddingBottom: '56.25%', 
            height: 0,
            overflow: 'hidden',
          }}>
            <iframe
              src={getVideoEmbedUrl(widget.data.url, widget.data.provider)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      );

    case 'spacer':
      return <div style={{ height: widget.data.height || '2rem', ...style }} />;

    case 'divider':
      return (
        <hr style={{
          border: 'none',
          height: widget.data.thickness || '1px',
          backgroundColor: widget.data.color || '#dee2e6',
          ...style,
        }} />
      );

    case 'hero':
      return (
        <div style={{
          ...style,
          backgroundImage: widget.data.backgroundImage ? `url(${widget.data.backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}>
          <h1 style={{ fontSize: '3rem', fontWeight: '700', marginBottom: '1rem' }}>
            {widget.data.heading || 'Welcome'}
          </h1>
          {widget.data.subheading && (
            <p style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>
              {widget.data.subheading}
            </p>
          )}
          {widget.data.buttonText && (
            <a 
              href={widget.data.buttonUrl || '#'}
              style={{
                display: 'inline-block',
                padding: '1rem 2rem',
                background: '#007bff',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '1.125rem',
                fontWeight: '600',
              }}
            >
              {widget.data.buttonText}
            </a>
          )}
        </div>
      );

    case 'features':
      return (
        <div style={{
          ...style,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '2rem',
        }}>
          {(widget.data.features || []).map((feature: any, i: number) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{feature.icon}</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{feature.title}</h3>
              <p style={{ color: '#6c757d' }}>{feature.description}</p>
            </div>
          ))}
        </div>
      );

    case 'pricing':
      return (
        <div style={{
          ...style,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
        }}>
          {(widget.data.plans || []).map((plan: any, i: number) => (
            <div 
              key={i} 
              style={{
                padding: '2rem',
                background: plan.featured ? '#007bff' : 'white',
                color: plan.featured ? 'white' : '#212529',
                border: plan.featured ? 'none' : '1px solid #dee2e6',
                borderRadius: '8px',
                textAlign: 'center',
              }}
            >
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{plan.name}</h3>
              <div style={{ fontSize: '3rem', fontWeight: '700', marginBottom: '1rem' }}>
                {plan.price}
                <span style={{ fontSize: '1rem', fontWeight: '400' }}>/{plan.period}</span>
              </div>
              <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                marginBottom: '2rem',
                textAlign: 'left',
              }}>
                {plan.features.map((feature: string, j: number) => (
                  <li key={j} style={{ padding: '0.5rem 0' }}>✓ {feature}</li>
                ))}
              </ul>
              <a 
                href={plan.buttonUrl || '#'}
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  background: plan.featured ? 'white' : '#007bff',
                  color: plan.featured ? '#007bff' : 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontWeight: '600',
                }}
              >
                {plan.buttonText}
              </a>
            </div>
          ))}
        </div>
      );

    case 'testimonial':
      return (
        <div style={style}>
          <p style={{ 
            fontSize: '1.125rem', 
            fontStyle: 'italic', 
            marginBottom: '1.5rem',
            lineHeight: '1.6',
          }}>
            "{widget.data.quote}"
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            {widget.data.avatar && (
              <img 
                src={widget.data.avatar} 
                alt={widget.data.author}
                style={{ 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
            )}
            <div>
              <div style={{ fontWeight: '600' }}>{widget.data.author}</div>
              <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>{widget.data.role}</div>
            </div>
          </div>
        </div>
      );

    case 'cta':
      return (
        <div style={style}>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{widget.data.heading}</h2>
          {widget.data.subheading && (
            <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>{widget.data.subheading}</p>
          )}
          <a 
            href={widget.data.buttonUrl || '#'}
            style={{
              display: 'inline-block',
              padding: '1rem 2rem',
              background: 'white',
              color: '#007bff',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '1.125rem',
              fontWeight: '600',
            }}
          >
            {widget.data.buttonText}
          </a>
        </div>
      );

    case 'stats':
      return (
        <div style={{
          ...style,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2rem',
        }}>
          {(widget.data.stats || []).map((stat: any, i: number) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: '700', color: '#007bff', marginBottom: '0.5rem' }}>
                {stat.number}
              </div>
              <div style={{ fontSize: '1.125rem', color: '#6c757d' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      );

    case 'gallery':
      return (
        <div style={{
          ...style,
          display: 'grid',
          gridTemplateColumns: `repeat(${widget.data.columns || 3}, 1fr)`,
          gap: widget.data.gap || '1rem',
        }}>
          {(widget.data.images || []).map((img: any, i: number) => (
            <img 
              key={i}
              src={img.src} 
              alt={img.alt}
              style={{ 
                width: '100%', 
                height: '250px',
                objectFit: 'cover',
                borderRadius: '4px',
              }}
            />
          ))}
        </div>
      );

    case 'contact-form':
      return (
        <form style={style} onSubmit={(e) => e.preventDefault()}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Name</label>
            <input type="text" style={inputStyle} placeholder="Your name" />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Email</label>
            <input type="email" style={inputStyle} placeholder="your@email.com" />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Message</label>
            <textarea rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Your message" />
          </div>
          <button type="submit" style={buttonStyle}>
            {widget.data.submitText || 'Send Message'}
          </button>
        </form>
      );

    case 'newsletter':
      return (
        <div style={style}>
          <h3 style={{ marginBottom: '1rem' }}>{widget.data.heading}</h3>
          <form style={{ display: 'flex', gap: '0.5rem' }} onSubmit={(e) => e.preventDefault()}>
            <input 
              type="email" 
              placeholder={widget.data.placeholder || 'Enter your email'}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button type="submit" style={buttonStyle}>
              {widget.data.buttonText || 'Subscribe'}
            </button>
          </form>
        </div>
      );

    case 'social-icons':
      return (
        <div style={{ ...style, display: 'flex', gap: '1rem' }}>
          {(widget.data.icons || []).map((icon: any, i: number) => (
            <a 
              key={i}
              href={icon.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#007bff',
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

    case 'accordion':
      return (
        <div style={style}>
          {(widget.data.items || []).map((item: any, i: number) => (
            <details key={i} style={{ 
              marginBottom: '0.5rem',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              padding: '1rem',
            }}>
              <summary style={{ fontWeight: '600', cursor: 'pointer' }}>
                {item.title}
              </summary>
              <p style={{ marginTop: '0.75rem', color: '#6c757d' }}>
                {item.content}
              </p>
            </details>
          ))}
        </div>
      );

    case 'icon-box':
      return (
        <div style={style}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{widget.data.icon}</div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{widget.data.title}</h3>
          <p style={{ color: '#6c757d' }}>{widget.data.description}</p>
        </div>
      );

    case 'html':
      return <div style={style} dangerouslySetInnerHTML={{ __html: widget.data.html || '' }} />;

    case 'code':
      return (
        <pre style={style}>
          <code>{widget.data.code || ''}</code>
        </pre>
      );

    default:
      return (
        <div style={{
          ...style,
          padding: '1rem',
          background: '#f8f9fa',
          border: '1px dashed #dee2e6',
          borderRadius: '4px',
          textAlign: 'center',
          color: '#6c757d',
        }}>
          {widget.type} widget
        </div>
      );
  }
}

// Helper functions
function convertWidgetStyleToCSS(widgetStyle?: WidgetStyle): React.CSSProperties {
  if (!widgetStyle) return {};

  return {
    padding: widgetStyle.padding ? convertSpacingToCSS(widgetStyle.padding) : undefined,
    margin: widgetStyle.margin ? convertSpacingToCSS(widgetStyle.margin) : undefined,
    width: widgetStyle.width,
    height: widgetStyle.height,
    display: widgetStyle.display,
    flexDirection: widgetStyle.flexDirection,
    alignItems: widgetStyle.alignItems,
    justifyContent: widgetStyle.justifyContent,
    fontFamily: widgetStyle.fontFamily,
    fontSize: widgetStyle.fontSize,
    fontWeight: widgetStyle.fontWeight,
    lineHeight: widgetStyle.lineHeight,
    letterSpacing: widgetStyle.letterSpacing,
    textAlign: widgetStyle.textAlign,
    textTransform: widgetStyle.textTransform,
    color: widgetStyle.color,
    backgroundColor: widgetStyle.backgroundColor,
    border: widgetStyle.border,
    borderRadius: widgetStyle.borderRadius,
    borderWidth: widgetStyle.borderWidth,
    borderColor: widgetStyle.borderColor,
    borderStyle: widgetStyle.borderStyle,
    boxShadow: widgetStyle.boxShadow,
    opacity: widgetStyle.opacity,
    transform: widgetStyle.transform,
    transition: widgetStyle.transition,
    backgroundImage: widgetStyle.backgroundImage,
    backgroundSize: widgetStyle.backgroundSize,
    backgroundPosition: widgetStyle.backgroundPosition,
    backgroundRepeat: widgetStyle.backgroundRepeat,
  };
}

function convertSpacingToCSS(spacing: Spacing): string {
  const top = spacing.top || '0';
  const right = spacing.right || spacing.top || '0';
  const bottom = spacing.bottom || spacing.top || '0';
  const left = spacing.left || spacing.right || spacing.top || '0';
  return `${top} ${right} ${bottom} ${left}`;
}

function getVideoEmbedUrl(url: string, provider: string): string {
  if (!url) return '';
  
  if (provider === 'youtube') {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  } else if (provider === 'vimeo') {
    const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
    return videoId ? `https://player.vimeo.com/video/${videoId}` : '';
  }
  
  return url;
}

function getSocialIcon(platform: string): string {
  const icons: Record<string, string> = {
    facebook: 'f',
    twitter: '𝕏',
    instagram: '📷',
    linkedin: 'in',
    youtube: '▶️',
    github: '🐙',
  };
  return icons[platform] || '•';
}

// Common styles
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  border: '1px solid #ced4da',
  borderRadius: '4px',
  fontSize: '1rem',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  background: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '1rem',
  fontWeight: '500',
};

