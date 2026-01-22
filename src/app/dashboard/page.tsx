"use client";

import React from "react";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { useTenantData, usePlatformOrganizations } from "@/hooks/useUnifiedData";
import {
  Building2,
  Users,
  Target,
  TrendingUp,
  Activity,
  DollarSign,
  Zap,
} from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  trend?: {
    value: number;
    positive: boolean;
  };
}

/**
 * Stat Card Component
 */
function StatCard({ title, value, icon, trend }: StatCardProps): React.ReactElement {
  return (
    <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">{title}</p>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">{value}</p>
          {trend && (
            <div
              className={`flex items-center gap-1 mt-2 text-sm ${
                trend.positive ? "text-[var(--color-success)]" : "text-[var(--color-error)]"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>{trend.positive ? "+" : ""}{trend.value}%</span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
          {icon}
        </div>
      </div>
    </div>
  );
}

/**
 * Platform Admin Dashboard
 * Shows system health, all organizations, platform metrics
 */
function PlatformAdminDashboard(): React.ReactElement {
  const { data: organizations, loading } = usePlatformOrganizations();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--color-text-secondary)]">Loading platform data...</p>
        </div>
      </div>
    );
  }

  const activeOrgs = organizations.filter((org) => org.status === "active").length;
  const totalUsers = organizations.reduce(
    (sum, org) => sum + (typeof org.userCount === "number" ? org.userCount : 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
          Platform Overview
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          System-wide metrics and organization management
        </p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Organizations"
          value={organizations.length}
          icon={<Building2 className="w-6 h-6" />}
          trend={{ value: 12, positive: true }}
        />
        <StatCard
          title="Active Organizations"
          value={activeOrgs}
          icon={<Activity className="w-6 h-6" />}
        />
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={<Users className="w-6 h-6" />}
          trend={{ value: 8, positive: true }}
        />
        <StatCard
          title="System Health"
          value="99.9%"
          icon={<Zap className="w-6 h-6" />}
        />
      </div>

      {/* Organizations List */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Organizations
        </h3>
        <div className="space-y-3">
          {organizations.length === 0 ? (
            <p className="text-[var(--color-text-secondary)]">No organizations found</p>
          ) : (
            organizations.slice(0, 5).map((org) => (
              <div
                key={org.id as string}
                className="flex items-center justify-between p-4 bg-[var(--color-bg-paper)] rounded-lg border border-[var(--color-border-light)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">
                      {org.name as string}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {org.userCount as number} users
                    </p>
                  </div>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    org.status === "active"
                      ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                      : "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                  }`}
                >
                  {org.status as string}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Tenant User Dashboard
 * Shows tenant-specific metrics, leads, deals, activity
 */
function TenantUserDashboard(): React.ReactElement {
  const { user } = useUnifiedAuth();
  const { data: users, loading: usersLoading } = useTenantData("users");
  const { loading: workspacesLoading } = useTenantData("workspaces");

  const loading = usersLoading || workspacesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--color-text-secondary)]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
          Welcome back, {user?.displayName}
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          Here&apos;s what&apos;s happening with your business today
        </p>
      </div>

      {/* Business Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Leads"
          value={42}
          icon={<Target className="w-6 h-6" />}
          trend={{ value: 15, positive: true }}
        />
        <StatCard
          title="Open Deals"
          value={18}
          icon={<DollarSign className="w-6 h-6" />}
          trend={{ value: 8, positive: true }}
        />
        <StatCard
          title="Team Members"
          value={users.length}
          icon={<Users className="w-6 h-6" />}
        />
        <StatCard
          title="Conversion Rate"
          value="24%"
          icon={<TrendingUp className="w-6 h-6" />}
          trend={{ value: 3, positive: true }}
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Recent Activity
        </h3>
        <div className="space-y-3">
          <ActivityItem
            title="New lead created"
            description="John Doe added a new lead"
            time="5 minutes ago"
          />
          <ActivityItem
            title="Deal closed"
            description="Sarah Smith closed a $50,000 deal"
            time="1 hour ago"
          />
          <ActivityItem
            title="Email campaign sent"
            description="Marketing team sent 'Spring Sale' campaign"
            time="2 hours ago"
          />
          <ActivityItem
            title="Team member joined"
            description="Mike Johnson joined the sales team"
            time="1 day ago"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionButton
            label="Add Lead"
            description="Create a new lead"
            icon={<Target className="w-5 h-5" />}
          />
          <ActionButton
            label="View Deals"
            description="Manage your pipeline"
            icon={<DollarSign className="w-5 h-5" />}
          />
          <ActionButton
            label="Analytics"
            description="View reports"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Activity Item Component
 */
function ActivityItem({
  title,
  description,
  time,
}: {
  title: string;
  description: string;
  time: string;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-3 p-3 bg-[var(--color-bg-paper)] rounded-lg border border-[var(--color-border-light)]">
      <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
        <Activity className="w-4 h-4 text-[var(--color-primary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--color-text-primary)] text-sm">{title}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
        <p className="text-xs text-[var(--color-text-disabled)] mt-1">{time}</p>
      </div>
    </div>
  );
}

/**
 * Action Button Component
 */
function ActionButton({
  label,
  description,
  icon,
}: {
  label: string;
  description: string;
  icon: React.ReactElement;
}): React.ReactElement {
  return (
    <button
      type="button"
      className="flex items-start gap-3 p-4 bg-[var(--color-bg-paper)] rounded-lg border border-[var(--color-border-light)] hover:border-[var(--color-primary)] transition-colors cursor-pointer text-left"
    >
      <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0 text-[var(--color-primary)]">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium text-[var(--color-text-primary)]">{label}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
      </div>
    </button>
  );
}

/**
 * Main Dashboard Page
 * Renders different views based on user role
 */
export default function DashboardPage(): React.ReactElement {
  const { user, loading, isPlatformAdmin } = useUnifiedAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-secondary)]">Please log in to continue</p>
      </div>
    );
  }

  // Show platform admin dashboard if user is platform_admin with no tenant selected
  if (isPlatformAdmin() && !user.tenantId) {
    return <PlatformAdminDashboard />;
  }

  // Show tenant user dashboard for all other roles
  return <TenantUserDashboard />;
}
