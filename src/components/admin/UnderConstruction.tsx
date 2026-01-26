"use client";

import React from "react";
import Link from "next/link";
import { Construction, ArrowRight } from "lucide-react";

/**
 * Status types for the Under Construction badge
 */
export type ConstructionStatus = "coming-soon" | "in-development" | "planned";

/**
 * Props for the UnderConstruction component
 */
export interface UnderConstructionProps {
  /** Page title */
  title: string;
  /** Page description */
  description: string;
  /** Development status */
  status?: ConstructionStatus;
  /** List of planned features */
  plannedFeatures?: string[];
  /** Optional redirect link (e.g., to command center) */
  redirectTo?: {
    href: string;
    label: string;
  };
  /** Optional icon to display */
  icon?: React.ReactNode;
  /** Optional children for additional content (like scaffolded UI) */
  children?: React.ReactNode;
}

/**
 * Status badge configuration
 */
const statusConfig: Record<ConstructionStatus, { label: string; className: string }> = {
  "coming-soon": {
    label: "Coming Soon",
    className: "bg-[var(--color-accent-primary)] text-white",
  },
  "in-development": {
    label: "In Development",
    className: "bg-amber-500 text-white",
  },
  planned: {
    label: "Planned",
    className: "bg-[var(--color-text-secondary)] text-white",
  },
};

/**
 * UnderConstruction Component
 *
 * Standardized component for displaying "under construction" or "coming soon" pages
 * in the admin dashboard. Provides consistent UX for pages that are not yet implemented.
 *
 * Usage:
 * ```tsx
 * <UnderConstruction
 *   title="Deal Pipeline"
 *   description="Track and manage deals through your sales pipeline"
 *   status="in-development"
 *   plannedFeatures={[
 *     "Drag-and-drop deal management",
 *     "Stage progression tracking",
 *     "Win/loss analysis"
 *   ]}
 *   redirectTo={{ href: "/admin/command-center", label: "Go to Command Center" }}
 * />
 * ```
 */
export function UnderConstruction({
  title,
  description,
  status = "coming-soon",
  plannedFeatures,
  redirectTo,
  icon,
  children,
}: UnderConstructionProps): React.ReactElement {
  const { label: statusLabel, className: statusClassName } = statusConfig[status];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {icon && <span className="text-[var(--color-primary)]">{icon}</span>}
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{title}</h1>
        </div>
        <p className="text-[var(--color-text-secondary)]">{description}</p>
      </div>

      {/* Optional scaffolded UI */}
      {children}

      {/* Under Construction Banner */}
      <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-12 text-center">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-background-primary)] border border-[var(--color-border)] flex items-center justify-center">
            <Construction className="w-8 h-8 text-[var(--color-text-secondary)]" />
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={`inline-block px-3 py-1 text-xs font-medium rounded-full mb-4 ${statusClassName}`}
        >
          {statusLabel}
        </span>

        {/* Planned Features */}
        {plannedFeatures && plannedFeatures.length > 0 && (
          <div className="mt-4 mb-6">
            <p className="text-sm text-[var(--color-text-secondary)] mb-3">Planned features:</p>
            <ul className="inline-block text-left space-y-2">
              {plannedFeatures.map((feature, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Redirect Link */}
        {redirectTo && (
          <Link
            href={redirectTo.href}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors mt-4"
          >
            {redirectTo.label}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default UnderConstruction;
