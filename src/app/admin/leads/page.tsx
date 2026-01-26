"use client";

import { Target } from "lucide-react";
import { UnderConstruction } from "@/components/admin/UnderConstruction";

export default function LeadsPage() {
  return (
    <UnderConstruction
      title="Lead Management"
      description="View, filter, and manage all leads in your sales pipeline"
      status="coming-soon"
      icon={<Target className="w-6 h-6" />}
      plannedFeatures={[
        "Lead list with advanced filtering",
        "Lead scoring and prioritization",
        "Status updates and activity tracking",
        "Bulk actions and imports",
      ]}
      redirectTo={{
        href: "/admin/command-center",
        label: "Go to Command Center",
      }}
    >
      {/* Scaffolded UI for preview */}
      <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg mb-6">
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search leads..."
              className="flex-1 px-4 py-2 bg-[var(--color-background-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
              disabled
            />
            <button
              className="px-4 py-2 bg-[var(--color-accent-primary)] text-white rounded-lg opacity-50 cursor-not-allowed"
              disabled
            >
              Add Lead
            </button>
          </div>
        </div>
      </div>
    </UnderConstruction>
  );
}
