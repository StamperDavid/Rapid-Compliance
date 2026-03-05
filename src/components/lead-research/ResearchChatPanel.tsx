'use client';

import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import IcpSummaryBadge from './IcpSummaryBadge';
import ResearchControls from './ResearchControls';
import type { ResearchChatMessage, ResearchSchedule } from '@/types/lead-research';
import type { IcpProfile } from '@/types/icp-profile';

interface ResearchChatPanelProps {
  messages: ResearchChatMessage[];
  chatLoading: boolean;
  onSend: (text: string) => void;
  activeIcpProfile: IcpProfile | null;
  onEditIcp?: () => void;
  schedule: ResearchSchedule | null;
  scheduleLoading: boolean;
  onRunNow: () => Promise<void>;
  onUpdateSchedule: (updates: Partial<ResearchSchedule>) => Promise<void>;
}

export default function ResearchChatPanel({
  messages,
  chatLoading,
  onSend,
  activeIcpProfile,
  onEditIcp,
  schedule,
  scheduleLoading,
  onRunNow,
  onUpdateSchedule,
}: ResearchChatPanelProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-elevated)] border-r border-[var(--color-border-light)]">
      <div className="p-3 border-b border-[var(--color-border-light)]">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          AI Lead Researcher
        </h2>
        <IcpSummaryBadge profile={activeIcpProfile} onEditClick={onEditIcp} />
      </div>

      <ChatMessageList messages={messages} />
      <ChatInput onSend={onSend} isLoading={chatLoading} />
      <ResearchControls
        schedule={schedule}
        scheduleLoading={scheduleLoading}
        onRunNow={onRunNow}
        onUpdateSchedule={onUpdateSchedule}
      />
    </div>
  );
}
