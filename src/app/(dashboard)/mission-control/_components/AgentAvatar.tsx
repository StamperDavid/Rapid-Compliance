'use client';

/**
 * AgentAvatar — Colored circle chip representing a delegation target.
 * Maps known delegation targets to branding colors and initials.
 */

const AGENT_MAP: Record<string, { label: string; color: string; initial: string }> = {
  BUILDER: { label: 'Builder', color: '#6366f1', initial: 'B' },        // indigo
  ARCHITECT: { label: 'Architect', color: '#6366f1', initial: 'A' },    // indigo
  ARCHITECT_MANAGER: { label: 'Architect', color: '#6366f1', initial: 'A' },
  SALES: { label: 'Sales', color: '#22c55e', initial: 'S' },            // green
  REVENUE_DIRECTOR: { label: 'Sales', color: '#22c55e', initial: 'S' },
  MARKETING: { label: 'Marketing', color: '#f59e0b', initial: 'M' },    // amber
  MARKETING_MANAGER: { label: 'Marketing', color: '#f59e0b', initial: 'M' },
  TRUST: { label: 'Trust', color: '#ec4899', initial: 'T' },            // pink
  REPUTATION_MANAGER: { label: 'Trust', color: '#ec4899', initial: 'T' },
  AGENT: { label: 'Specialist', color: '#06b6d4', initial: 'Sp' },      // cyan
};

interface AgentAvatarProps {
  delegatedTo: string;
  size?: number;
}

export default function AgentAvatar({ delegatedTo, size = 32 }: AgentAvatarProps) {
  const agent = AGENT_MAP[delegatedTo] ?? {
    label: delegatedTo,
    color: '#6b7280',
    initial: delegatedTo.charAt(0).toUpperCase(),
  };

  return (
    <div
      title={agent.label}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: agent.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span style={{
        color: '#fff',
        fontSize: size * 0.375,
        fontWeight: 700,
        lineHeight: 1,
      }}>
        {agent.initial}
      </span>
    </div>
  );
}
