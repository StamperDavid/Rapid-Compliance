'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, Minus } from 'lucide-react';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, checked, onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      const el = innerRef.current;
      if (el) {
        el.indeterminate = indeterminate ?? false;
      }
    }, [indeterminate]);

    // Merge refs
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    const isChecked = indeterminate ?? checked;

    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          ref={innerRef}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            'w-4 h-4 rounded border transition-all flex items-center justify-center',
            isChecked
              ? 'bg-primary border-primary'
              : 'bg-surface-elevated border-border-strong hover:border-[var(--color-text-secondary)]',
            className
          )}
        >
          {indeterminate ? (
            <Minus className="w-3 h-3 text-white" />
          ) : checked ? (
            <Check className="w-3 h-3 text-white" />
          ) : null}
        </div>
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
