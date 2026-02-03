/**
 * Lead Routing Dashboard Page
 *
 * Displays intelligent lead routing insights including:
 * - Recent routing assignments
 * - Team availability and capacity
 * - Routing performance metrics
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  RoutingAssignmentsCard,
  RepAvailabilityCard,
  RoutingMetricsCard,
} from '@/components/routing';
import type {
  LeadAssignment,
  SalesRep,
  RoutingMetrics,
} from '@/lib/routing/types';
import { FirestoreService } from '@/lib/db/firestore-service';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export default function RoutingDashboard() {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<LeadAssignment[]>([]);
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [metrics, setMetrics] = useState<RoutingMetrics | null>(null);

  useEffect(() => {
    const fetchRoutingData = async () => {
      try {
        setLoading(true);

        // Fetch routing assignments
        const assignmentsResult = await FirestoreService.getAll<LeadAssignment>(
          `organizations/${DEFAULT_ORG_ID}/routing/assignments`
        );

        // Fetch sales reps
        const repsResult = await FirestoreService.getAll<SalesRep>(
          `organizations/${DEFAULT_ORG_ID}/salesReps`
        );

        // Fetch routing metrics (single document)
        let metricsData: RoutingMetrics | null = null;
        try {
          metricsData = await FirestoreService.get<RoutingMetrics>(
            `organizations/${DEFAULT_ORG_ID}/routing`,
            'metrics'
          );
        } catch (_error) {
          // Metrics document doesn't exist yet
          logger.info('No routing metrics found');
        }

        setAssignments(assignmentsResult);
        setReps(repsResult);
        setMetrics(metricsData);
      } catch (error) {
        logger.error('Failed to fetch routing data', error instanceof Error ? error : undefined);
        // Set empty states on error
        setAssignments([]);
        setReps([]);
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchRoutingData();
  }, []);

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Lead Routing Dashboard</h1>
          <p className="text-gray-400 mt-2">
            Monitor intelligent lead assignments and team capacity
          </p>
        </div>

        {/* Empty State */}
        {!loading && assignments.length === 0 && reps.length === 0 && !metrics && (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-12 text-center">
            <h2 className="text-xl font-semibold text-white mb-2">No Routing Data Available</h2>
            <p className="text-gray-400">
              Lead routing assignments and team data will appear here once configured.
            </p>
          </div>
        )}

        {/* Metrics Overview */}
        {!loading && metrics && (
          <div className="mb-6">
            <RoutingMetricsCard metrics={metrics} loading={loading} />
          </div>
        )}

        {/* Main Content Grid */}
        {(loading || assignments.length > 0 || reps.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Assignments */}
            <div>
              <RoutingAssignmentsCard assignments={assignments} loading={loading} />
            </div>

            {/* Team Availability */}
            <div>
              <RepAvailabilityCard reps={reps} loading={loading} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
