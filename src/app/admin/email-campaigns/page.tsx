"use client";

export default function EmailCampaignsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              Email Campaigns
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              Create, manage, and track automated email campaigns
            </p>
          </div>
          <button
            className="px-4 py-2 bg-[var(--color-accent-primary)] text-white rounded-lg opacity-50 cursor-not-allowed"
            disabled
          >
            Create Campaign
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Active Campaigns
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">--</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Currently running</p>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Total Sent
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">--</p>
          <p className="text-xs text-[var(--color-text-secondary)]">All time</p>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Avg. Open Rate
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">--%</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Last 30 days</p>
        </div>
      </div>

      <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Campaign List
          </h2>
        </div>

        <div className="p-16 text-center">
          <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--color-accent-primary)] text-white rounded-full mb-4">
            Coming Soon
          </span>
          <p className="text-[var(--color-text-secondary)] mb-2">
            Email campaign builder and management dashboard
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Including templates, A/B testing, and performance analytics
          </p>
        </div>
      </div>
    </div>
  );
}
