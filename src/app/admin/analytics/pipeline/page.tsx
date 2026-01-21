"use client";

export default function PipelineAnalyticsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Pipeline Analytics
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Analyze sales pipeline performance, conversion rates, and revenue metrics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Pipeline Value
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">$--</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Total opportunity value</p>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Win Rate
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">--%</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Last 90 days</p>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Avg Deal Size
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">$--</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Per closed deal</p>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Sales Cycle
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">-- days</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Average duration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Conversion Funnel
            </h2>
          </div>
          <div className="p-16 text-center">
            <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--color-accent-primary)] text-white rounded-full mb-4">
              Coming Soon
            </span>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Stage-by-stage conversion rates
            </p>
          </div>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Revenue Forecast
            </h2>
          </div>
          <div className="p-16 text-center">
            <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--color-accent-primary)] text-white rounded-full mb-4">
              Coming Soon
            </span>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Projected revenue by quarter
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Pipeline Health Score
          </h2>
        </div>
        <div className="p-16 text-center">
          <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--color-accent-primary)] text-white rounded-full mb-4">
            In Development
          </span>
          <p className="text-[var(--color-text-secondary)] mb-2">
            Comprehensive pipeline health analysis
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Including deal velocity, aging analysis, and risk assessment
          </p>
        </div>
      </div>
    </div>
  );
}
