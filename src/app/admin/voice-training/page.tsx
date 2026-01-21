"use client";

export default function VoiceTrainingPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Voice Agent Training
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Configure and train your AI voice agents for optimal performance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Voice Personality
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Tone
              </label>
              <select
                className="w-full px-4 py-2 bg-[var(--color-background-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] opacity-50"
                disabled
              >
                <option>Professional</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Speech Rate
              </label>
              <input
                type="range"
                className="w-full opacity-50"
                disabled
              />
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Training Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Model Version</span>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">--</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Last Updated</span>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">--</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Total Calls</span>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">--</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-background-secondary)] border border-[var(--color-border)] rounded-lg">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Conversation Scripts
          </h2>
        </div>

        <div className="p-16 text-center">
          <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--color-accent-primary)] text-white rounded-full mb-4">
            In Development
          </span>
          <p className="text-[var(--color-text-secondary)] mb-2">
            Script editor and conversation flow designer
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Including objection handling, call routing, and performance metrics
          </p>
        </div>
      </div>
    </div>
  );
}
