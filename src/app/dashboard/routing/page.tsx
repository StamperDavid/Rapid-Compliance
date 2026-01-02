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

export default function RoutingDashboard() {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<LeadAssignment[]>([]);
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [metrics, setMetrics] = useState<RoutingMetrics | null>(null);

  useEffect(() => {
    // TODO: Fetch real data from API
    // For now, using mock data
    const mockData = loadMockData();
    setAssignments(mockData.assignments);
    setReps(mockData.reps);
    setMetrics(mockData.metrics);
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lead Routing Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Monitor intelligent lead assignments and team capacity
          </p>
        </div>

        {/* Metrics Overview */}
        {metrics && (
          <div className="mb-6">
            <RoutingMetricsCard metrics={metrics} loading={loading} />
          </div>
        )}

        {/* Main Content Grid */}
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
      </div>
    </div>
  );
}

// Mock data for development
function loadMockData() {
  const now = new Date();

  const assignments: LeadAssignment[] = [
    {
      id: 'assignment_1',
      leadId: 'lead_abc123',
      repId: 'rep_1',
      orgId: 'org_demo',
      assignmentMethod: 'automatic',
      strategy: 'performance_weighted',
      matchedRules: [],
      matchScore: 92,
      confidence: 0.88,
      reason: 'High performer (Score: 92); Territory match; Available capacity: 15 leads',
      alternatives: [
        { repId: 'rep_2', repName: 'Bob Smith', matchScore: 85, reasons: ['High capacity available'] },
      ],
      status: 'active',
      assignedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      id: 'assignment_2',
      leadId: 'lead_def456',
      repId: 'rep_2',
      orgId: 'org_demo',
      assignmentMethod: 'automatic',
      strategy: 'workload_balanced',
      matchedRules: [],
      matchScore: 78,
      confidence: 0.75,
      reason: 'Workload balancing; Specialization match: Industry, Company Size',
      status: 'pending',
      assignedAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago
    },
    {
      id: 'assignment_3',
      leadId: 'lead_ghi789',
      repId: 'rep_1',
      orgId: 'org_demo',
      assignmentMethod: 'automatic',
      strategy: 'performance_weighted',
      matchedRules: [],
      matchScore: 95,
      confidence: 0.92,
      reason: 'Top performer; Hot lead priority; Territory match',
      status: 'completed',
      assignedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
      acceptedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000),
      firstContactAt: new Date(now.getTime() - 22 * 60 * 60 * 1000),
      qualifiedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
    },
  ];

  const reps: SalesRep[] = [
    {
      id: 'rep_1',
      orgId: 'org_demo',
      name: 'Alice Johnson',
      email: 'alice@company.com',
      performanceTier: 'top_performer',
      overallScore: 92,
      skillScores: {
        prospecting: 95,
        discovery: 90,
        needsAnalysis: 88,
        presentation: 92,
        objectionHandling: 90,
        negotiation: 87,
        closing: 94,
        relationshipBuilding: 91,
        productKnowledge: 89,
        crmHygiene: 85,
        timeManagement: 88,
        aiToolAdoption: 93,
      },
      capacity: {
        maxActiveLeads: 50,
        maxNewLeadsPerDay: 5,
        maxNewLeadsPerWeek: 20,
      },
      currentWorkload: {
        activeLeads: 35,
        leadsAssignedToday: 2,
        leadsAssignedThisWeek: 8,
        totalPipelineValue: 500000,
        utilizationPercentage: 70,
        isAtCapacity: false,
        remainingCapacity: {
          leads: 15,
          dailyLeads: 3,
          weeklyLeads: 12,
        },
      },
      specializations: {
        industries: ['Technology', 'SaaS'],
        companySizes: ['enterprise', 'mid_market'],
      },
      territories: [],
      isAvailable: true,
      availabilityStatus: 'available',
      routingPreferences: {
        autoAccept: true,
        notifyOnAssignment: true,
        notifyOnHotLead: true,
      },
    },
    {
      id: 'rep_2',
      orgId: 'org_demo',
      name: 'Bob Smith',
      email: 'bob@company.com',
      performanceTier: 'high_performer',
      overallScore: 85,
      skillScores: {
        prospecting: 82,
        discovery: 88,
        needsAnalysis: 85,
        presentation: 87,
        objectionHandling: 84,
        negotiation: 83,
        closing: 86,
        relationshipBuilding: 88,
        productKnowledge: 82,
        crmHygiene: 80,
        timeManagement: 85,
        aiToolAdoption: 84,
      },
      capacity: {
        maxActiveLeads: 40,
        maxNewLeadsPerDay: 4,
        maxNewLeadsPerWeek: 16,
      },
      currentWorkload: {
        activeLeads: 20,
        leadsAssignedToday: 1,
        leadsAssignedThisWeek: 4,
        totalPipelineValue: 300000,
        utilizationPercentage: 50,
        isAtCapacity: false,
        remainingCapacity: {
          leads: 20,
          dailyLeads: 3,
          weeklyLeads: 12,
        },
      },
      specializations: {
        industries: ['Healthcare', 'Finance'],
        companySizes: ['mid_market', 'smb'],
      },
      territories: [],
      isAvailable: true,
      availabilityStatus: 'available',
      routingPreferences: {
        autoAccept: true,
        notifyOnAssignment: true,
        notifyOnHotLead: true,
      },
    },
    {
      id: 'rep_3',
      orgId: 'org_demo',
      name: 'Carol Davis',
      email: 'carol@company.com',
      performanceTier: 'average',
      overallScore: 72,
      skillScores: {
        prospecting: 70,
        discovery: 75,
        needsAnalysis: 72,
        presentation: 74,
        objectionHandling: 70,
        negotiation: 68,
        closing: 73,
        relationshipBuilding: 76,
        productKnowledge: 71,
        crmHygiene: 69,
        timeManagement: 72,
        aiToolAdoption: 75,
      },
      capacity: {
        maxActiveLeads: 30,
        maxNewLeadsPerDay: 3,
        maxNewLeadsPerWeek: 12,
      },
      currentWorkload: {
        activeLeads: 28,
        leadsAssignedToday: 3,
        leadsAssignedThisWeek: 11,
        totalPipelineValue: 200000,
        utilizationPercentage: 93,
        isAtCapacity: true,
        remainingCapacity: {
          leads: 2,
          dailyLeads: 0,
          weeklyLeads: 1,
        },
      },
      specializations: {
        industries: ['Retail', 'E-commerce'],
        companySizes: ['smb', 'startup'],
      },
      territories: [],
      isAvailable: true,
      availabilityStatus: 'busy',
      routingPreferences: {
        autoAccept: false,
        notifyOnAssignment: true,
        notifyOnHotLead: true,
      },
    },
    {
      id: 'rep_4',
      orgId: 'org_demo',
      name: 'Dave Wilson',
      email: 'dave@company.com',
      performanceTier: 'high_performer',
      overallScore: 88,
      skillScores: {
        prospecting: 85,
        discovery: 90,
        needsAnalysis: 87,
        presentation: 89,
        objectionHandling: 86,
        negotiation: 85,
        closing: 90,
        relationshipBuilding: 91,
        productKnowledge: 84,
        crmHygiene: 82,
        timeManagement: 87,
        aiToolAdoption: 88,
      },
      capacity: {
        maxActiveLeads: 45,
        maxNewLeadsPerDay: 5,
        maxNewLeadsPerWeek: 18,
      },
      currentWorkload: {
        activeLeads: 12,
        leadsAssignedToday: 0,
        leadsAssignedThisWeek: 2,
        totalPipelineValue: 150000,
        utilizationPercentage: 27,
        isAtCapacity: false,
        remainingCapacity: {
          leads: 33,
          dailyLeads: 5,
          weeklyLeads: 16,
        },
      },
      specializations: {
        industries: ['Manufacturing', 'Logistics'],
        companySizes: ['enterprise', 'mid_market'],
      },
      territories: [],
      isAvailable: false,
      availabilityStatus: 'vacation',
      routingPreferences: {
        autoAccept: true,
        notifyOnAssignment: true,
        notifyOnHotLead: true,
      },
    },
  ];

  const metrics: RoutingMetrics = {
    orgId: 'org_demo',
    period: {
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate: now,
    },
    volume: {
      totalLeadsRouted: 284,
      automaticAssignments: 256,
      manualAssignments: 18,
      reassignments: 10,
      queuedLeads: 5,
    },
    efficiency: {
      averageRoutingTimeMs: 145,
      averageTimeToAcceptance: 2.3,
      averageTimeToFirstContact: 4.8,
      routingSuccessRate: 0.94,
    },
    quality: {
      averageMatchScore: 87,
      averageConfidence: 0.85,
      conversionRate: 0.42,
      rejectionRate: 0.06,
    },
    workloadDistribution: [
      {
        repId: 'rep_1',
        repName: 'Alice Johnson',
        leadsAssigned: 95,
        acceptanceRate: 0.98,
        conversionRate: 0.48,
        utilizationPercentage: 70,
      },
      {
        repId: 'rep_2',
        repName: 'Bob Smith',
        leadsAssigned: 78,
        acceptanceRate: 0.96,
        conversionRate: 0.41,
        utilizationPercentage: 50,
      },
      {
        repId: 'rep_3',
        repName: 'Carol Davis',
        leadsAssigned: 61,
        acceptanceRate: 0.89,
        conversionRate: 0.35,
        utilizationPercentage: 93,
      },
      {
        repId: 'rep_4',
        repName: 'Dave Wilson',
        leadsAssigned: 50,
        acceptanceRate: 0.94,
        conversionRate: 0.44,
        utilizationPercentage: 27,
      },
    ],
    strategyPerformance: [
      {
        strategy: 'performance_weighted',
        usageCount: 156,
        conversionRate: 0.45,
        averageMatchScore: 89,
      },
      {
        strategy: 'workload_balanced',
        usageCount: 78,
        conversionRate: 0.39,
        averageMatchScore: 84,
      },
      {
        strategy: 'skill_matched',
        usageCount: 32,
        conversionRate: 0.41,
        averageMatchScore: 86,
      },
    ],
    topPerformers: [
      { repId: 'rep_1', repName: 'Alice Johnson', metric: 'conversion_rate', value: 0.48 },
      { repId: 'rep_2', repName: 'Bob Smith', metric: 'acceptance_rate', value: 0.96 },
      { repId: 'rep_4', repName: 'Dave Wilson', metric: 'average_match_score', value: 91 },
    ],
  };

  return { assignments, reps, metrics };
}
