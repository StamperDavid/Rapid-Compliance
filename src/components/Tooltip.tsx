'use client';

import { useState, ReactNode, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export default function Tooltip({ 
  content, 
  children, 
  position = 'top',
  delay = 200 
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const targetRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      setShow(true);
    }, delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setShow(false);
  };

  // Calculate tooltip position when it becomes visible
  useEffect(() => {
    if (show && targetRef.current && tooltipRef.current) {
      const targetRect = targetRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = targetRect.top + scrollY - tooltipRect.height - 8;
          left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'bottom':
          top = targetRect.bottom + scrollY + 8;
          left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);
          break;
        case 'left':
          top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipRect.height / 2);
          left = targetRect.left + scrollX - tooltipRect.width - 8;
          break;
        case 'right':
          top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipRect.height / 2);
          left = targetRect.right + scrollX + 8;
          break;
      }

      // Keep tooltip within viewport bounds
      const padding = 8;
      if (left < padding) left = padding;
      if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
      }
      if (top < padding) top = padding;
      if (top + tooltipRect.height > window.innerHeight + scrollY - padding) {
        top = window.innerHeight + scrollY - tooltipRect.height - padding;
      }

      setTooltipStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 99999, // Very high z-index to ensure it's on top
      });
    }
  }, [show, position]);

  const arrowPosition = {
    top: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: '4px 4px 0 4px',
      borderColor: '#1a1a1a transparent transparent transparent',
    },
    bottom: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: '0 4px 4px 4px',
      borderColor: 'transparent transparent #1a1a1a transparent',
    },
    left: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: '4px 0 4px 4px',
      borderColor: 'transparent transparent transparent #1a1a1a',
    },
    right: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: '4px 4px 4px 0',
      borderColor: 'transparent #1a1a1a transparent transparent',
    },
  };

  const tooltipContent = show && typeof window !== 'undefined' ? (
    createPortal(
      <div
        ref={tooltipRef}
        style={{
          ...tooltipStyle,
          padding: '0.5rem 0.75rem',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          fontSize: '0.75rem',
          borderRadius: '0.375rem',
          border: '1px solid #333',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          opacity: show ? 1 : 0,
          transition: 'opacity 0.15s ease-in-out',
        }}
      >
        {content}
        {/* Arrow */}
        <div
          style={{
            position: 'absolute',
            width: 0,
            height: 0,
            borderStyle: 'solid',
            ...arrowPosition[position],
          }}
        />
      </div>,
      document.body
    )
  ) : null;

  return (
    <div 
      ref={targetRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {tooltipContent}
    </div>
  );
}

