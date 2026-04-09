import * as React from 'react';
import { cn } from '@/lib/utils';
import { PageTitle, SectionDescription } from './typography';

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  ({ className, title, description, actions, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-8 space-y-6', className)}
      {...props}
    >
      {(title ?? actions) && (
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && <PageTitle>{title}</PageTitle>}
            {description && (
              <SectionDescription className="mt-1">{description}</SectionDescription>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
);
PageContainer.displayName = 'PageContainer';

export { PageContainer };
