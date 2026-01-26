"use client";

import { Handshake } from "lucide-react";
import { UnderConstruction } from "@/components/admin/UnderConstruction";

export default function DealsPage() {
  return (
    <UnderConstruction
      title="Deal Pipeline"
      description="Track and manage deals through your sales pipeline stages"
      status="in-development"
      icon={<Handshake className="w-6 h-6" />}
      plannedFeatures={[
        "Interactive drag-and-drop pipeline",
        "Deal value tracking",
        "Stage progression analytics",
        "Win/loss analysis",
      ]}
      redirectTo={{
        href: "/admin/command-center",
        label: "Go to Command Center",
      }}
    >
      {/* Pipeline Stage Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {["Prospecting", "Qualification", "Proposal", "Closing"].map((stage) => (
          <div
            key={stage}
            className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-4"
          >
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
              {stage}
            </h3>
            <div className="space-y-2">
              <div className="h-20 bg-[var(--color-background-primary)] border border-[var(--color-border)] rounded opacity-50" />
            </div>
          </div>
        ))}
      </div>
    </UnderConstruction>
  );
}
