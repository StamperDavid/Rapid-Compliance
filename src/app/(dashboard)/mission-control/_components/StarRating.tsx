'use client';

/**
 * StarRating — Interactive 5-star rating input.
 *
 * Uses inline SVG stars so there is no dependency on any icon library.
 * Supports read-only display mode for showing existing grades.
 */

import { useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md';
  readonly?: boolean;
}

const SIZE_PX: Record<'sm' | 'md', number> = {
  sm: 14,
  md: 20,
};

function StarIcon({ filled, hovered }: { filled: boolean; hovered: boolean }) {
  const color = filled || hovered ? '#f59e0b' : 'var(--color-text-disabled)';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled || hovered ? color : 'none'}
      stroke={color}
      strokeWidth={1.8}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );
}

export default function StarRating({
  value,
  onChange,
  size = 'md',
  readonly = false,
}: StarRatingProps) {
  const [hoverIndex, setHoverIndex] = useState<number>(0);
  const px = SIZE_PX[size];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? '0.125rem' : '0.25rem',
      }}
      onMouseLeave={() => {
        if (!readonly) { setHoverIndex(0); }
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const hovered = !readonly && hoverIndex > 0 && star <= hoverIndex;

        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            onClick={() => {
              if (!readonly) { onChange(star); }
            }}
            onMouseEnter={() => {
              if (!readonly) { setHoverIndex(star); }
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: readonly ? 'default' : 'pointer',
              width: px,
              height: px,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            <StarIcon filled={filled} hovered={hovered} />
          </button>
        );
      })}
    </div>
  );
}
