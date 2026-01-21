"use client";

export default function DealsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Deal Pipeline
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Track and manage deals through your sales pipeline stages
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Prospecting
          </h3>
          <div className="space-y-2">
            <div className="h-20 bg-[var(--color-background-primary)] border border-[var(--color-border)] rounded opacity-50"></div>
          </div>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Qualification
          </h3>
          <div className="space-y-2">
            <div className="h-20 bg-[var(--color-background-primary)] border border-[var(--color-border)] rounded opacity-50"></div>
          </div>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Proposal
          </h3>
          <div className="space-y-2">
            <div className="h-20 bg-[var(--color-background-primary)] border border-[var(--color-border)] rounded opacity-50"></div>
          </div>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Closing
          </h3>
          <div className="space-y-2">
            <div className="h-20 bg-[var(--color-background-primary)] border border-[var(--color-border)] rounded opacity-50"></div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-16 text-center">
        <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--color-accent-primary)] text-white rounded-full mb-4">
          In Development
        </span>
        <p className="text-[var(--color-text-secondary)] mb-2">
          Interactive deal pipeline with drag-and-drop functionality
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Including deal value tracking, stage progression, and win/loss analysis
        </p>
      </div>
    </div>
  );
}
