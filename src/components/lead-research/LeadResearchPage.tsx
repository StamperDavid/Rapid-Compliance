'use client';

import { useState } from 'react';
import { useLeadResearch } from '@/hooks/useLeadResearch';
import ResearchChatPanel from './ResearchChatPanel';
import ResultsPanel from './ResultsPanel';
import UrlSourcesPanel from './UrlSourcesPanel';
import IcpSettingsDrawer from './IcpSettingsDrawer';

export default function LeadResearchPage() {
  const {
    chatMessages, chatLoading, sendMessage,
    icpProfiles, activeIcpProfile, refreshIcpProfiles,
    batches, activeBatch, batchResults, batchesLoading, resultsLoading,
    selectedResultIds, resultStatusFilter, setResultStatusFilter,
    toggleResultSelection, selectAllResults, clearSelection,
    setActiveBatch, loadBatchResults,
    approveResult, rejectResult, bulkApprove, convertResults,
    urlSources, urlSourcesLoading, addUrlSource, removeUrlSource,
    schedule, scheduleLoading, updateSchedule, runScheduleNow,
    exportCsv,
  } = useLeadResearch();
  const [icpDrawerOpen, setIcpDrawerOpen] = useState(false);

  return (
    <>
      <div className="h-[calc(100vh-7rem)] grid grid-cols-[320px_1fr_280px]">
        {/* Left: AI Chat + ICP + Controls */}
        <ResearchChatPanel
          messages={chatMessages}
          chatLoading={chatLoading}
          onSend={(text: string) => void sendMessage(text)}
          activeIcpProfile={activeIcpProfile}
          onEditIcp={() => setIcpDrawerOpen(true)}
          schedule={schedule}
          scheduleLoading={scheduleLoading}
          onRunNow={runScheduleNow}
          onUpdateSchedule={updateSchedule}
        />

        {/* Center: Results */}
        <ResultsPanel
          batches={batches}
          activeBatch={activeBatch}
          results={batchResults}
          batchesLoading={batchesLoading}
          resultsLoading={resultsLoading}
          selectedIds={selectedResultIds}
          statusFilter={resultStatusFilter}
          onSetStatusFilter={setResultStatusFilter}
          onToggleSelect={toggleResultSelection}
          onSelectAll={selectAllResults}
          onClearSelection={clearSelection}
          onSetActiveBatch={setActiveBatch}
          onLoadBatchResults={(batchId: string, status?: string) => void loadBatchResults(batchId, status)}
          onApprove={(id: string) => void approveResult(id)}
          onReject={(id: string) => void rejectResult(id)}
          onBulkApprove={() => void bulkApprove()}
          onConvert={(ids: string[]) => void convertResults(ids)}
          onExportCsv={(batchId: string) => void exportCsv(batchId)}
        />

        {/* Right: URL Sources */}
        <UrlSourcesPanel
          sources={urlSources}
          loading={urlSourcesLoading}
          onAdd={addUrlSource}
          onRemove={(id: string) => void removeUrlSource(id)}
        />
      </div>

      {/* ICP Settings Drawer */}
      <IcpSettingsDrawer
        isOpen={icpDrawerOpen}
        onClose={() => setIcpDrawerOpen(false)}
        profile={activeIcpProfile}
        profiles={icpProfiles}
        onSaved={() => void refreshIcpProfiles()}
      />
    </>
  );
}
