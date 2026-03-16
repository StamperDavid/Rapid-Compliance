'use client';

/**
 * AgentAvatar — Colored circle chip representing a delegation target.
 * Maps known delegation targets to branding colors and initials.
 */

const AGENT_MAP: Record<string, { label: string; color: string; initial: string }> = {
  // Core delegation agents
  BUILDER: { label: 'Builder', color: '#6366f1', initial: 'B' },
  ARCHITECT: { label: 'Architect', color: '#6366f1', initial: 'A' },
  ARCHITECT_MANAGER: { label: 'Architect', color: '#6366f1', initial: 'A' },
  SALES: { label: 'Sales', color: '#22c55e', initial: 'S' },
  REVENUE_DIRECTOR: { label: 'Sales', color: '#22c55e', initial: 'S' },
  MARKETING: { label: 'Marketing', color: '#f59e0b', initial: 'M' },
  MARKETING_MANAGER: { label: 'Marketing', color: '#f59e0b', initial: 'M' },
  TRUST: { label: 'Trust', color: '#ec4899', initial: 'T' },
  REPUTATION_MANAGER: { label: 'Trust', color: '#ec4899', initial: 'T' },
  CONTENT: { label: 'Content', color: '#f59e0b', initial: 'C' },
  COMMERCE: { label: 'Commerce', color: '#059669', initial: 'Co' },
  OUTREACH: { label: 'Outreach', color: '#7c3aed', initial: 'O' },
  INTELLIGENCE: { label: 'Intelligence', color: '#0284c7', initial: 'I' },
  AGENT: { label: 'Specialist', color: '#06b6d4', initial: 'Sp' },
  // Video orchestration chain agents
  VIDEO_RESEARCH: { label: 'Research Agent', color: '#8b5cf6', initial: 'R' },
  VIDEO_STRATEGY: { label: 'Strategy Agent', color: '#0ea5e9', initial: 'St' },
  VIDEO_SCRIPT: { label: 'Script Writer', color: '#f97316', initial: 'Sc' },
  VIDEO_CINEMATIC: { label: 'Cinematic Director', color: '#e11d48', initial: 'Ci' },
  VIDEO_THUMBNAILS: { label: 'Image Generator', color: '#14b8a6', initial: 'IG' },
  PRODUCE_VIDEO: { label: 'Video Director', color: '#6366f1', initial: 'V' },
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
