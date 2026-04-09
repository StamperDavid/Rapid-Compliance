import * as React from 'react';
import { cn } from '@/lib/utils';

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
}

const PageTitle = React.forwardRef<HTMLHeadingElement, TypographyProps>(
  ({ className, as: Tag = 'h1', ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn('text-3xl font-bold text-foreground', className)}
      {...props}
    />
  )
);
PageTitle.displayName = 'PageTitle';

const SectionTitle = React.forwardRef<HTMLHeadingElement, TypographyProps>(
  ({ className, as: Tag = 'h2', ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn('text-xl font-semibold text-foreground', className)}
      {...props}
    />
  )
);
SectionTitle.displayName = 'SectionTitle';

const SubsectionTitle = React.forwardRef<HTMLHeadingElement, TypographyProps>(
  ({ className, as: Tag = 'h3', ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn('text-lg font-semibold text-foreground', className)}
      {...props}
    />
  )
);
SubsectionTitle.displayName = 'SubsectionTitle';

const CardTitle = React.forwardRef<HTMLHeadingElement, TypographyProps>(
  ({ className, as: Tag = 'h4', ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn('text-base font-semibold text-foreground', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const SectionDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
);
SectionDescription.displayName = 'SectionDescription';

const Caption = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  )
);
Caption.displayName = 'Caption';

export {
  PageTitle,
  SectionTitle,
  SubsectionTitle,
  CardTitle,
  SectionDescription,
  Caption,
};
