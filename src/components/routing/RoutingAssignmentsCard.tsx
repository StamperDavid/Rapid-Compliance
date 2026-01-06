/**
 * Routing Assignments Card Component
 * 
 * Displays recent lead routing assignments with match scores and status
 */

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LeadAssignment, AssignmentStatus } from '@/lib/routing/types';

interface RoutingAssignmentsCardProps {
  assignments: LeadAssignment[];
  loading?: boolean;
}

export function RoutingAssignmentsCard({ assignments, loading }: RoutingAssignmentsCardProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Assignments</h3>
        <p className="text-sm text-gray-500">Latest lead routing assignments</p>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No assignments yet</p>
          <p className="text-sm mt-1">Assignments will appear here once leads are routed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map(assignment => (
            <AssignmentRow key={assignment.id} assignment={assignment} />
          ))}
        </div>
      )}
    </Card>
  );
}

function AssignmentRow({ assignment }: { assignment: LeadAssignment }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900">
              Lead #{assignment.leadId.substring(0, 8)}
            </span>
            <Badge variant={getStatusVariant(assignment.status)}>
              {formatStatus(assignment.status)}
            </Badge>
          </div>
          <p className="text-sm text-gray-600">
            Assigned to: <span className="font-medium">Rep #{assignment.repId.substring(0, 8)}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-blue-600">
            {assignment.matchScore}%
          </div>
          <div className="text-xs text-gray-500">Match Score</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Method:</span>
            <span className="ml-2 text-gray-900 capitalize">
              {assignment.assignmentMethod.replace('_', ' ')}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Strategy:</span>
            <span className="ml-2 text-gray-900 capitalize">
              {assignment.strategy.replace('_', ' ')}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Confidence:</span>
            <span className="ml-2 text-gray-900">
              {Math.round(assignment.confidence * 100)}%
            </span>
          </div>
          <div>
            <span className="text-gray-500">Assigned:</span>
            <span className="ml-2 text-gray-900">
              {formatDate(assignment.assignedAt)}
            </span>
          </div>
        </div>

        {assignment.reason && (
          <div className="mt-3 text-sm">
            <span className="text-gray-500">Reason:</span>
            <p className="text-gray-700 mt-1">{assignment.reason}</p>
          </div>
        )}

        {assignment.alternatives && assignment.alternatives.length > 0 && (
          <div className="mt-3">
            <details className="text-sm">
              <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
                {assignment.alternatives.length} alternative{assignment.alternatives.length > 1 ? 's' : ''} considered
              </summary>
              <div className="mt-2 space-y-1 pl-4">
                {assignment.alternatives.map((alt, idx) => (
                  <div key={idx} className="text-gray-600">
                    <span className="font-medium">{alt.repName}</span>
                    <span className="text-gray-500"> - {alt.matchScore}% match</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusVariant(status: AssignmentStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'completed':
      return 'outline';
    case 'rejected':
    case 'expired':
      return 'destructive';
    default:
      return 'outline';
  }
}

function formatStatus(status: AssignmentStatus): string {
  return status.replace('_', ' ').split(' ').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {return `${days}d ago`;}
  if (hours > 0) {return `${hours}h ago`;}
  if (minutes > 0) {return `${minutes}m ago`;}
  return 'Just now';
}
