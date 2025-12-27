/**
 * Accessible Widget Wrapper
 * Ensures all widgets meet WCAG AA standards
 */

'use client';

import { Widget } from '@/types/website';
import { generateAriaId, getAriaLabel, meetsWCAGAA } from '@/lib/accessibility/aria-utils';
import { useEffect, useRef } from 'react';

interface AccessibleWidgetProps {
  widget: Widget;
  children: React.ReactNode;
}

export function AccessibleWidget({ widget, children }: AccessibleWidgetProps) {
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check color contrast if widget has style
    if (widget.style?.color && widget.style?.backgroundColor) {
      const meetsContrast = meetsWCAGAA(
        widget.style.color,
        widget.style.backgroundColor
      );

      if (!meetsContrast) {
        console.warn(
          `[Accessibility] Low contrast detected in widget ${widget.id}. ` +
            `Foreground: ${widget.style.color}, Background: ${widget.style.backgroundColor}`
        );
      }
    }
  }, [widget]);

  // Generate appropriate ARIA attributes based on widget type
  const getAriaAttributes = () => {
    const attrs: Record<string, string> = {};

    switch (widget.type) {
      case 'heading':
        attrs['role'] = 'heading';
        attrs['aria-level'] = String(widget.data.level || 1);
        break;

      case 'button':
        if (widget.data.disabled) {
          attrs['aria-disabled'] = 'true';
        }
        if (widget.data.expanded !== undefined) {
          attrs['aria-expanded'] = String(widget.data.expanded);
        }
        break;

      case 'link':
        if (widget.data.newTab) {
          attrs['aria-label'] = `${widget.data.text || 'Link'} (opens in new tab)`;
        }
        break;

      case 'image':
        if (!widget.data.alt) {
          console.warn(`[Accessibility] Image widget ${widget.id} is missing alt text`);
        }
        break;

      case 'modal':
        attrs['role'] = 'dialog';
        attrs['aria-modal'] = 'true';
        if (widget.data.title) {
          attrs['aria-label'] = widget.data.title;
        }
        break;

      case 'tabs':
        attrs['role'] = 'tablist';
        break;

      case 'accordion':
        attrs['role'] = 'region';
        break;
    }

    return attrs;
  };

  // Check if widget is hidden
  if (widget.hidden) {
    return (
      <div ref={widgetRef} aria-hidden="true" style={{ display: 'none' }}>
        {children}
      </div>
    );
  }

  const ariaAttributes = getAriaAttributes();

  return (
    <div
      ref={widgetRef}
      {...ariaAttributes}
      data-widget-type={widget.type}
      data-widget-id={widget.id}
    >
      {children}
    </div>
  );
}

/**
 * Skip to main content link (for keyboard navigation)
 */
export function SkipToMain() {
  return (
    <a
      href="#main-content"
      className="skip-to-main"
      style={{
        position: 'absolute',
        left: '-9999px',
        zIndex: 999999,
        padding: '12px 24px',
        backgroundColor: '#3b82f6',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '4px',
        fontWeight: '600',
      }}
      onFocus={(e) => {
        e.currentTarget.style.left = '10px';
        e.currentTarget.style.top = '10px';
      }}
      onBlur={(e) => {
        e.currentTarget.style.left = '-9999px';
      }}
    >
      Skip to main content
    </a>
  );
}

/**
 * Screen reader only text
 */
export function SROnly({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="sr-only"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Focus visible utility
 */
export function FocusRing({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="focus-ring"
      style={{
        position: 'relative',
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid #3b82f6';
        e.currentTarget.style.outlineOffset = '2px';
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      {children}
    </div>
  );
}

