"use client";

export default function CommandCenterPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Command Center
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Real-time overview of all system operations, metrics, and agent activity
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Active Leads
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">--</p>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Open Deals
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">--</p>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Active Campaigns
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">--</p>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Voice Agent Status
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">--</p>
        </div>
      </div>

      <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--color-accent-primary)] text-white rounded-full mb-4">
              In Development
            </span>
            <p className="text-[var(--color-text-secondary)]">
              Dashboard metrics and real-time monitoring coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
