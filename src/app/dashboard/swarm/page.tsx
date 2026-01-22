"use client";

import React from "react";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";
import { GitBranch, Bot, Activity, Zap, GraduationCap } from "lucide-react";

/**
 * AI Swarm Control Page
 * Displays and manages the AI agent swarm
 */
export default function SwarmPage(): React.ReactElement {
  const { user, permissions } = useUnifiedAuth();

  const canAccessSwarmPanel = permissions?.canAccessSwarmPanel ?? false;

  if (!canAccessSwarmPanel) {
    return (
      <div className="text-center py-12">
        <GitBranch className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-disabled)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
          Access Restricted
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          You don&apos;t have permission to access the AI Swarm panel.
        </p>
        <p className="text-sm text-[var(--color-text-disabled)] mt-2">
          This feature is only available to Owner and Admin roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            AI Swarm Control
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Manage and orchestrate your AI agent swarm
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Deploy Agent
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Active Agents</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">8</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-success)]/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-[var(--color-success)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Tasks Completed</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">142</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-info)]/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[var(--color-info)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Efficiency</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">94%</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-warning)]/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[var(--color-warning)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Training</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">3</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Active Agents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AgentCard
            name="Sales Agent"
            status="active"
            tasks={42}
            efficiency={96}
          />
          <AgentCard
            name="Lead Qualifier"
            status="active"
            tasks={38}
            efficiency={92}
          />
          <AgentCard
            name="Email Writer"
            status="active"
            tasks={28}
            efficiency={88}
          />
          <AgentCard
            name="Social Media Manager"
            status="training"
            tasks={0}
            efficiency={0}
          />
        </div>
      </div>

      {/* Placeholder Content */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-light)] p-8 text-center">
        <GitBranch className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-disabled)]" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          AI Swarm Orchestration
        </h3>
        <p className="text-[var(--color-text-secondary)] mb-4">
          This page will display your AI agent swarm with real-time monitoring and control.
        </p>
        <div className="text-sm text-[var(--color-text-disabled)]">
          <p>Role: {user?.role}</p>
          <p>Tenant: {user?.tenantId ?? "Platform"}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Agent Card Component
 */
function AgentCard({
  name,
  status,
  tasks,
  efficiency,
}: {
  name: string;
  status: "active" | "training" | "idle";
  tasks: number;
  efficiency: number;
}): React.ReactElement {
  const statusColors = {
    active: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
    training: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
    idle: "bg-[var(--color-text-disabled)]/10 text-[var(--color-text-disabled)]",
  };

  return (
    <div className="p-4 bg-[var(--color-bg-paper)] rounded-lg border border-[var(--color-border-light)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-[var(--color-primary)]" />
          </div>
          <div>
            <p className="font-medium text-[var(--color-text-primary)]">{name}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">{tasks} tasks</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
          {status}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-secondary)]">Efficiency</span>
        <span className="font-medium text-[var(--color-text-primary)]">{efficiency}%</span>
      </div>
    </div>
  );
}
