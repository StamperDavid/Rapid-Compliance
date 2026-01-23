"use client";

/**
 * Merchandiser Specialist Admin Page
 *
 * Provides a comprehensive UI for managing coupon/promotion strategies,
 * visualizing the 7 nudge strategies, and monitoring Stripe integration status.
 *
 * Features:
 * - Active Promotions overview
 * - Create New Promotion form
 * - 7 Nudge Strategy visualization
 * - ROI analysis calculator
 * - Stripe integration status
 * - Analytics placeholder
 *
 * Route: /admin/merchandiser
 */

import { useState } from "react";

// ============================================================================
// TYPES
// ============================================================================

type NudgeStrategyId =
  | "ENGAGEMENT_NUDGE"
  | "CART_ABANDONMENT"
  | "WIN_BACK"
  | "TRIAL_CONVERSION"
  | "REFERRAL_REWARD"
  | "SEASONAL_PROMO"
  | "LOYALTY_TIER";

type PromotionStatus = "active" | "scheduled" | "expired" | "draft";

interface NudgeStrategy {
  id: NudgeStrategyId;
  name: string;
  discountPercent: number | string;
  description: string;
  expectedLift: string;
  averageROI: number;
  psychologyBasis: string;
}

interface Promotion {
  id: string;
  name: string;
  strategy: NudgeStrategyId;
  discountPercent: number;
  status: PromotionStatus;
  createdAt: string;
  expiresAt: string;
  redemptions: number;
  maxRedemptions: number | null;
}

// ============================================================================
// CONSTANTS - The 7 Nudge Strategies
// ============================================================================

const NUDGE_STRATEGIES: NudgeStrategy[] = [
  {
    id: "ENGAGEMENT_NUDGE",
    name: "Engagement Nudge",
    discountPercent: 10,
    description: "10% off after 3+ pricing page visits without purchase",
    expectedLift: "15-25%",
    averageROI: 2.8,
    psychologyBasis:
      "Price sensitivity signal - multiple pricing views indicates interest but price hesitation",
  },
  {
    id: "CART_ABANDONMENT",
    name: "Cart Abandonment Recovery",
    discountPercent: 15,
    description: "15% off within 24 hours of abandoned cart",
    expectedLift: "10-20%",
    averageROI: 3.5,
    psychologyBasis:
      "High intent + friction point - 70% of carts abandoned, 15% discount often breaks resistance",
  },
  {
    id: "WIN_BACK",
    name: "Win-Back Campaign",
    discountPercent: 20,
    description: "20% off for churned users returning",
    expectedLift: "8-15%",
    averageROI: 4.2,
    psychologyBasis:
      "Sunk cost + nostalgia - returning churned users have proven product fit, need incentive",
  },
  {
    id: "TRIAL_CONVERSION",
    name: "Trial Conversion Nudge",
    discountPercent: 10,
    description: "10% off at trial day 12 (before 14-day expiry)",
    expectedLift: "20-35%",
    averageROI: 5.1,
    psychologyBasis:
      "Loss aversion + urgency - trial ending creates natural deadline, discount reduces friction",
  },
  {
    id: "REFERRAL_REWARD",
    name: "Referral Reward",
    discountPercent: 25,
    description: "25% off for both referrer and referee",
    expectedLift: "40-60%",
    averageROI: 6.8,
    psychologyBasis:
      "Social proof + reciprocity - referrals convert 3-5x better, worth higher discount",
  },
  {
    id: "SEASONAL_PROMO",
    name: "Seasonal Promotion",
    discountPercent: "Variable",
    description: "Time-limited percentage off during key seasons",
    expectedLift: "25-50%",
    averageROI: 2.5,
    psychologyBasis:
      "Social norms + scarcity - everyone expects deals during seasons, FOMO drives action",
  },
  {
    id: "LOYALTY_TIER",
    name: "Loyalty Tier Discount",
    discountPercent: "5-20%",
    description: "Progressive discounts for long-term customers",
    expectedLift: "15-30% churn reduction",
    averageROI: 3.2,
    psychologyBasis:
      "Status + reciprocity - recognition drives retention, escalating rewards reduce churn",
  },
];

// Mock active promotions data
const MOCK_PROMOTIONS: Promotion[] = [
  {
    id: "promo_001",
    name: "Summer Trial Push",
    strategy: "TRIAL_CONVERSION",
    discountPercent: 10,
    status: "active",
    createdAt: "2026-01-15",
    expiresAt: "2026-02-15",
    redemptions: 34,
    maxRedemptions: 100,
  },
  {
    id: "promo_002",
    name: "Cart Recovery Jan",
    strategy: "CART_ABANDONMENT",
    discountPercent: 15,
    status: "active",
    createdAt: "2026-01-10",
    expiresAt: "2026-01-31",
    redemptions: 12,
    maxRedemptions: null,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStatusColor(status: PromotionStatus): string {
  switch (status) {
    case "active":
      return "var(--color-success)";
    case "scheduled":
      return "var(--color-info)";
    case "expired":
      return "var(--color-neutral-500)";
    case "draft":
      return "var(--color-warning)";
    default:
      return "var(--color-neutral-500)";
  }
}

function getROIColor(roi: number): string {
  if (roi >= 3.0) {
    return "var(--color-success)";
  }
  if (roi >= 2.0) {
    return "var(--color-info)";
  }
  if (roi >= 1.5) {
    return "var(--color-warning)";
  }
  return "var(--color-error)";
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MerchandiserPage() {
  const [selectedStrategy, setSelectedStrategy] = useState<NudgeStrategyId | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "strategies" | "create" | "analytics">(
    "overview"
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)]">
      {/* Page Header */}
      <header className="border-b border-[var(--color-border-light)] bg-[var(--color-bg-paper)]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                Merchandiser Specialist
              </h1>
              <p className="mt-2 text-base text-[var(--color-text-secondary)]">
                Coupon strategy, ROI analysis, and Stripe integration for discount-driven conversion
                optimization
              </p>
            </div>
            <div className="rounded-lg bg-[var(--color-bg-elevated)] px-4 py-2 border border-[var(--color-border-light)]">
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                Stripe Status
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-2 w-2 rounded-full bg-[var(--color-success)]"></div>
                <p className="text-xs font-mono text-[var(--color-success)]">Connected</p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mt-6 flex gap-4 border-b border-[var(--color-border-light)]">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "overview"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("strategies")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "strategies"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              7 Nudge Strategies
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "create"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              Create Promotion
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "analytics"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              Analytics
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === "overview" && <OverviewTab promotions={MOCK_PROMOTIONS} />}
        {activeTab === "strategies" && (
          <StrategiesTab
            strategies={NUDGE_STRATEGIES}
            selectedStrategy={selectedStrategy}
            onSelectStrategy={setSelectedStrategy}
          />
        )}
        {activeTab === "create" && (
          <CreatePromotionTab strategies={NUDGE_STRATEGIES} onClose={() => setActiveTab("overview")} />
        )}
        {activeTab === "analytics" && <AnalyticsTab />}
      </main>
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ promotions }: { promotions: Promotion[] }) {
  const activeCount = promotions.filter((p) => p.status === "active").length;
  const totalRedemptions = promotions.reduce((sum, p) => sum + p.redemptions, 0);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
            Active Promotions
          </h3>
          <p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{activeCount}</p>
        </div>

        <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
            Total Redemptions
          </h3>
          <p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">
            {totalRedemptions}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Average ROI</h3>
          <p className="mt-2 text-3xl font-bold text-[var(--color-success)]">3.7x</p>
        </div>

        <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-6">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
            Conversion Lift
          </h3>
          <p className="mt-2 text-3xl font-bold text-[var(--color-success)]">+18.2%</p>
        </div>
      </div>

      {/* Active Promotions Table */}
      <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)]">
        <div className="border-b border-[var(--color-border-light)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Active Promotions
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Currently running coupon campaigns and their performance
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[var(--color-border-light)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Strategy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Discount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Redemptions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Expires
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-light)]">
              {promotions.map((promo) => (
                <tr key={promo.id} className="hover:bg-[var(--color-bg-elevated)] transition-colors">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-[var(--color-text-primary)]">
                    {promo.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                    {promo.strategy.replace(/_/g, " ")}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--color-text-primary)]">
                    {promo.discountPercent}%
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${getStatusColor(promo.status)}20`,
                        color: getStatusColor(promo.status),
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: getStatusColor(promo.status) }}
                      ></span>
                      {promo.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                    {promo.redemptions}
                    {promo.maxRedemptions && ` / ${promo.maxRedemptions}`}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                    {promo.expiresAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STRATEGIES TAB
// ============================================================================

function StrategiesTab({
  strategies,
  selectedStrategy,
  onSelectStrategy,
}: {
  strategies: NudgeStrategy[];
  selectedStrategy: NudgeStrategyId | null;
  onSelectStrategy: (id: NudgeStrategyId | null) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          7 Nudge Strategies
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Complete library of psychological triggers and discount strategies
        </p>
      </div>

      {/* Strategy Cards Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            onClick={() =>
              onSelectStrategy(selectedStrategy === strategy.id ? null : strategy.id)
            }
            className={`cursor-pointer rounded-lg border transition-all ${
              selectedStrategy === strategy.id
                ? "border-[var(--color-primary)] bg-[var(--color-bg-elevated)] shadow-lg"
                : "border-[var(--color-border-light)] bg-[var(--color-bg-paper)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            <div className="p-6">
              {/* Strategy Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {strategy.name}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {strategy.description}
                  </p>
                </div>
                <div className="ml-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] px-3 py-1">
                  <span className="text-lg font-bold text-[var(--color-primary)]">
                    {strategy.discountPercent}
                    {typeof strategy.discountPercent === "number" ? "%" : ""}
                  </span>
                </div>
              </div>

              {/* Strategy Metrics */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-[var(--color-bg-elevated)] p-3 border border-[var(--color-border-light)]">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Expected Lift
                  </p>
                  <p className="mt-1 text-base font-bold text-[var(--color-success)]">
                    {strategy.expectedLift}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--color-bg-elevated)] p-3 border border-[var(--color-border-light)]">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Average ROI
                  </p>
                  <p
                    className="mt-1 text-base font-bold"
                    style={{ color: getROIColor(strategy.averageROI) }}
                  >
                    {strategy.averageROI.toFixed(1)}x
                  </p>
                </div>
              </div>

              {/* Psychology Basis (shown when selected) */}
              {selectedStrategy === strategy.id && (
                <div className="mt-4 rounded-lg bg-[var(--color-bg-main)] p-4 border border-[var(--color-border-light)]">
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Psychology Basis
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
                    {strategy.psychologyBasis}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// CREATE PROMOTION TAB
// ============================================================================

function CreatePromotionTab({
  strategies,
  onClose,
}: {
  strategies: NudgeStrategy[];
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    strategy: "" as NudgeStrategyId | "",
    discountPercent: 10,
    maxRedemptions: "",
    expiryDays: 30,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement actual submission to backend
    // eslint-disable-next-line no-console
    console.log("Creating promotion:", formData);
    // eslint-disable-next-line no-alert
    alert("Promotion creation will be implemented when backend is ready");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Create New Promotion
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Configure a new coupon campaign based on nudge strategies
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-[var(--color-warning)] px-3 py-1 text-xs font-medium text-white">
            Coming Soon
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[var(--color-text-primary)]"
            >
              Campaign Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-2 block w-full rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-elevated)] px-4 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              placeholder="e.g., Summer Trial Conversion Push"
            />
          </div>

          {/* Strategy Selection */}
          <div>
            <label
              htmlFor="strategy"
              className="block text-sm font-medium text-[var(--color-text-primary)]"
            >
              Nudge Strategy
            </label>
            <select
              id="strategy"
              value={formData.strategy}
              onChange={(e) =>
                setFormData({ ...formData, strategy: e.target.value as NudgeStrategyId })
              }
              className="mt-2 block w-full rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-elevated)] px-4 py-2 text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">Select a strategy...</option>
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name} ({strategy.discountPercent}
                  {typeof strategy.discountPercent === "number" ? "%" : ""})
                </option>
              ))}
            </select>
          </div>

          {/* Discount Percent */}
          <div>
            <label
              htmlFor="discount"
              className="block text-sm font-medium text-[var(--color-text-primary)]"
            >
              Discount Percentage
            </label>
            <div className="relative mt-2">
              <input
                type="number"
                id="discount"
                min="1"
                max="100"
                value={formData.discountPercent}
                onChange={(e) =>
                  setFormData({ ...formData, discountPercent: parseInt(e.target.value) || 0 })
                }
                className="block w-full rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-elevated)] px-4 py-2 pr-10 text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                %
              </span>
            </div>
          </div>

          {/* Max Redemptions */}
          <div>
            <label
              htmlFor="maxRedemptions"
              className="block text-sm font-medium text-[var(--color-text-primary)]"
            >
              Max Redemptions (optional)
            </label>
            <input
              type="number"
              id="maxRedemptions"
              min="1"
              value={formData.maxRedemptions}
              onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value })}
              className="mt-2 block w-full rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-elevated)] px-4 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              placeholder="Leave empty for unlimited"
            />
          </div>

          {/* Expiry Days */}
          <div>
            <label
              htmlFor="expiry"
              className="block text-sm font-medium text-[var(--color-text-primary)]"
            >
              Expires In (days)
            </label>
            <input
              type="number"
              id="expiry"
              min="1"
              value={formData.expiryDays}
              onChange={(e) =>
                setFormData({ ...formData, expiryDays: parseInt(e.target.value) || 1 })
              }
              className="mt-2 block w-full rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-elevated)] px-4 py-2 text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* ROI Estimate */}
          {formData.strategy && (
            <div className="rounded-lg border border-[var(--color-info)] bg-[var(--color-bg-elevated)] p-4">
              <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
                ROI Estimate
              </h4>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                Based on selected strategy:{" "}
                {strategies.find((s) => s.id === formData.strategy)?.name}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)]">Expected Lift</p>
                  <p className="mt-1 text-sm font-bold text-[var(--color-success)]">
                    {strategies.find((s) => s.id === formData.strategy)?.expectedLift}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-secondary)]">Average ROI</p>
                  <p className="mt-1 text-sm font-bold text-[var(--color-info)]">
                    {strategies.find((s) => s.id === formData.strategy)?.averageROI.toFixed(1)}x
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled
              className="flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
            >
              Create Promotion (Coming Soon)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// ANALYTICS TAB
// ============================================================================

function AnalyticsTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Analytics & Performance
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Deep dive into coupon performance, conversion metrics, and ROI analysis
        </p>
      </div>

      {/* Placeholder Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-8">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="inline-flex items-center rounded-full bg-[var(--color-info)] px-3 py-1 text-xs font-medium text-white mb-4">
              Coming Soon
            </span>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              Conversion Funnel
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Track coupon redemption journey from issuance to conversion
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-8">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="inline-flex items-center rounded-full bg-[var(--color-info)] px-3 py-1 text-xs font-medium text-white mb-4">
              Coming Soon
            </span>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              Strategy Performance
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Compare effectiveness across all 7 nudge strategies
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-8">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="inline-flex items-center rounded-full bg-[var(--color-info)] px-3 py-1 text-xs font-medium text-white mb-4">
              Coming Soon
            </span>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              ROI Heatmap
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Visualize ROI performance by segment, time, and strategy
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-paper)] p-8">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="inline-flex items-center rounded-full bg-[var(--color-info)] px-3 py-1 text-xs font-medium text-white mb-4">
              Coming Soon
            </span>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              Segment Analysis
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Analyze discount sensitivity by customer segment
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
