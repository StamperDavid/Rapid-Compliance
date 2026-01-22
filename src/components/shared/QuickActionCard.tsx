'use client';

import Link from 'next/link';
import Tooltip from '@/components/Tooltip';

interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: string;
  tooltip?: string;
}

export function QuickActionCard({ title, description, href, icon, tooltip }: QuickActionCardProps) {
  const card = (
    <Link
      href={href}
      className="block bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6 no-underline transition-all duration-200 hover:border-[var(--color-primary)] hover:-translate-y-0.5"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
        {title}
      </div>
      <div className="text-sm text-[var(--color-text-secondary)]">{description}</div>
    </Link>
  );

  if (tooltip) {
    return <Tooltip content={tooltip} position="top">{card}</Tooltip>;
  }

  return card;
}
