"use client";

export default function LeadsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Lead Management
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          View, filter, and manage all leads in your sales pipeline
        </p>
      </div>

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

        <div className="p-16 text-center">
          <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--color-accent-primary)] text-white rounded-full mb-4">
            Coming Soon
          </span>
          <p className="text-[var(--color-text-secondary)] mb-2">
            Lead list, filtering, and management features
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Including lead scoring, status updates, and activity tracking
          </p>
        </div>
      </div>
    </div>
  );
}
