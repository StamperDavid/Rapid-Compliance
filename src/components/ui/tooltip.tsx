'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  /** Tooltip content text */
  content: string;
  /** Position relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional custom trigger element. Defaults to a small help icon. */
  children?: React.ReactNode;
  /** Icon size when using default help icon trigger */
  size?: number;
}

/**
 * Click-to-open tooltip. Dismisses when clicking outside.
 * Used program-wide for contextual help and explanations.
 *
 * Usage:
 *   <Tooltip content="This is what this means" />
 *   <Tooltip content="Explanation here"><SomeTrigger /></Tooltip>
 */
export function Tooltip({ content, position = 'top', children, size = 14 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [open, handleClickOutside]);

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '6px' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '6px' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '6px' },
  };

  return (
    <span
      ref={ref}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(prev => !prev); }}
      style={{ position: 'relative', display: 'inline-flex', cursor: 'pointer' }}
      role="button"
      aria-label="Show help"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(prev => !prev); } }}
    >
      {children ?? <HelpCircle size={size} style={{ color: 'var(--color-text-disabled)', opacity: 0.6 }} />}
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            ...positionStyles[position],
            padding: '8px 12px',
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: '8px',
            color: 'var(--color-text-secondary)',
            fontSize: '0.75rem',
            lineHeight: '1.5',
            whiteSpace: 'normal',
            minWidth: '180px',
            maxWidth: '280px',
            zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
