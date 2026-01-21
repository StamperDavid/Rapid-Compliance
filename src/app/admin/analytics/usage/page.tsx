"use client";

export default function UsageAnalyticsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Usage Analytics
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Track system usage, API calls, and resource consumption
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            API Calls
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">--</p>
          <p className="text-xs text-[var(--color-text-secondary)]">This month</p>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Active Users
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">--</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Last 30 days</p>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Storage Used
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">--</p>
          <p className="text-xs text-[var(--color-text-secondary)]">GB</p>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Avg Response Time
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">--</p>
          <p className="text-xs text-[var(--color-text-secondary)]">ms</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              API Usage Over Time
            </h2>
          </div>
          <div className="p-16 text-center">
            <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--color-accent-primary)] text-white rounded-full mb-4">
              Coming Soon
            </span>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Interactive usage charts
            </p>
          </div>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Top Endpoints
            </h2>
          </div>
          <div className="p-16 text-center">
            <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--color-accent-primary)] text-white rounded-full mb-4">
              Coming Soon
            </span>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Endpoint usage breakdown
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
