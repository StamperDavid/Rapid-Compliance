/**
 * DiscoveryHub — Main 3-panel layout for the Intelligence Discovery Hub
 *
 * Left:   Jasper chat (direct research operations)
 * Center: Findings grid (discovered entities with enrichment)
 * Right:  Operation log (real-time audit trail)
 */

'use client';

import React from 'react';
import { useIntelligenceDiscovery } from '@/hooks/useIntelligenceDiscovery';
import DiscoveryChatPanel from './DiscoveryChatPanel';
import FindingsGrid from './FindingsGrid';
import OperationLogPanel from './OperationLogPanel';

export default function DiscoveryHub() {
  const discovery = useIntelligenceDiscovery();

  return (
    <div className="h-[calc(100vh-7rem)] grid grid-cols-[320px_1fr_300px]">
      {/* Left — Jasper Chat */}
      <DiscoveryChatPanel
        messages={discovery.chatMessages}
        loading={discovery.chatLoading}
        onSendMessage={discovery.sendChatMessage}
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
      />

      {/* Right — Operation Log */}
      <OperationLogPanel
        actions={discovery.actions}
        loading={discovery.actionsLoading}
        activeOperation={discovery.activeOperation}
      />
    </div>
  );
}
