'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;          // 1-5
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function StarRating({ value, onChange, disabled = false, size = 'sm' }: StarRatingProps) {
  const starSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => { if (!disabled) { onChange(star); } }}
          disabled={disabled}
          className={cn(
            'transition-colors',
            disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110',
          )}
          title={`${star} star${star !== 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              starSize,
              star <= value
                ? 'fill-amber-400 text-amber-400'
                : 'fill-none text-zinc-600',
            )}
          />
        </button>
      ))}
    </div>
  );
}
