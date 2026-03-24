/**
 * DiscoveryHub — Main 3-panel layout for the Intelligence Discovery Hub
 *
 * Left:   Jasper chat (direct research operations)
 * Center: Findings grid (discovered entities with enrichment)
 * Right:  Operation log (real-time audit trail)
 */

'use client';

import React, { useCallback } from 'react';
import { useIntelligenceDiscovery } from '@/hooks/useIntelligenceDiscovery';
import DiscoveryChatPanel from './DiscoveryChatPanel';
import FindingsGrid from './FindingsGrid';
import OperationLogPanel from './OperationLogPanel';
import ActionDetailDrawer from './ActionDetailDrawer';
import SourceConfigDrawer from './SourceConfigDrawer';

export default function DiscoveryHub() {
  const discovery = useIntelligenceDiscovery();

  const { findings, clearSelection, toggleFindingSelection, updateSource, startOperation, convertToLeads, exportCSV, converting, exporting } = discovery;

  // Scroll to a finding row in the center panel by toggling its selection
  const handleNavigateToFinding = useCallback((findingId: string) => {
    const found = findings.some((f) => f.id === findingId);
    if (found) {
      clearSelection();
      toggleFindingSelection(findingId);
    }
  }, [findings, clearSelection, toggleFindingSelection]);

  // Save source configuration from the drawer — spread to Record for the hook's generic API
  const handleSaveSource = useCallback(async (sourceId: string, updates: object) => {
    await updateSource(sourceId, updates as Record<string, unknown>);
  }, [updateSource]);

  // Test scrape — start an operation for the source
  const handleTestScrape = useCallback(async (sourceId: string) => {
    await startOperation(sourceId);
  }, [startOperation]);

  return (
    <div className="h-[calc(100vh-7rem)] grid grid-cols-[320px_1fr_300px]">
      {/* Left — Jasper Chat */}
      <DiscoveryChatPanel
        messages={discovery.chatMessages}
        loading={discovery.chatLoading}
        onSendMessage={discovery.sendChatMessage}
        initialLoading={discovery.sourcesLoading}
      />

      {/* Center — Findings Grid */}
      <FindingsGrid
        sources={discovery.sources}
        sourcesLoading={discovery.sourcesLoading}
        operations={discovery.operations}
        activeOperation={discovery.activeOperation}
        operationsLoading={discovery.operationsLoading}
        onSelectOperation={discovery.selectOperation}
        onStartOperation={discovery.startOperation}
        findings={discovery.findings}
        findingsLoading={discovery.findingsLoading}
        findingsHasMore={discovery.findingsHasMore}
        onLoadMore={discovery.loadMoreFindings}
        enrichmentFilter={discovery.enrichmentFilter}
        approvalFilter={discovery.approvalFilter}
        onEnrichmentFilterChange={discovery.setEnrichmentFilter}
        onApprovalFilterChange={discovery.setApprovalFilter}
        selectedIds={discovery.selectedFindingIds}
        onToggleSelect={discovery.toggleFindingSelection}
        onSelectAll={discovery.selectAllFindings}
        onClearSelection={discovery.clearSelection}
        onApprove={discovery.approveFinding}
        onReject={discovery.rejectFinding}
        onEnrich={discovery.enrichFinding}
        onBulkApprove={discovery.bulkApprove}
        onBulkReject={discovery.bulkReject}
        templates={discovery.templates}
        onInstallTemplate={discovery.createSourceFromTemplate}
        onConfigureSource={discovery.setConfigSource}
        onConvertToLeads={convertToLeads}
        onExportCSV={exportCSV}
        converting={converting}
        exporting={exporting}
      />

      {/* Right — Operation Log */}
      <OperationLogPanel
        actions={discovery.actions}
        loading={discovery.actionsLoading}
        activeOperation={discovery.activeOperation}
        onSelectAction={discovery.setSelectedAction}
      />

      {/* Action Detail Drawer */}
      <ActionDetailDrawer
        action={discovery.selectedAction}
        onClose={() => discovery.setSelectedAction(null)}
        onNavigateToFinding={handleNavigateToFinding}
      />

      {/* Source Config Drawer */}
      <SourceConfigDrawer
        source={discovery.configSource}
        onClose={() => discovery.setConfigSource(null)}
        onSave={handleSaveSource}
        onTestScrape={handleTestScrape}
      />
    </div>
  );
}
