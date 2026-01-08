/**
 * Rep Availability Card Component
 * 
 * Displays team member availability and capacity for lead routing
 */

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SalesRep } from '@/lib/routing/types';

interface RepAvailabilityCardProps {
  reps: SalesRep[];
  loading?: boolean;
}

export function RepAvailabilityCard({ reps, loading }: RepAvailabilityCardProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const availableReps = reps.filter(r => r.isAvailable && !r.currentWorkload.isAtCapacity);
  const atCapacityReps = reps.filter(r => r.currentWorkload.isAtCapacity);
  const unavailableReps = reps.filter(r => !r.isAvailable);

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Team Availability</h3>
        <p className="text-sm text-gray-500">Current capacity and availability</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{availableReps.length}</div>
          <div className="text-xs text-gray-600 mt-1">Available</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{atCapacityReps.length}</div>
          <div className="text-xs text-gray-600 mt-1">At Capacity</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{unavailableReps.length}</div>
          <div className="text-xs text-gray-600 mt-1">Unavailable</div>
        </div>
      </div>

      <div className="space-y-3">
        {reps.map(rep => (
          <RepRow key={rep.id} rep={rep} />
        ))}
      </div>
    </Card>
  );
}

function RepRow({ rep }: { rep: SalesRep }) {
  const capacityColor = getCapacityColor(rep.currentWorkload.utilizationPercentage);

  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="font-medium text-gray-900">{rep.name}</div>
          <Badge variant={rep.isAvailable ? 'default' : 'destructive'} className="text-xs">
            {rep.availabilityStatus ?? (rep.isAvailable ? 'Available' : 'Unavailable')}
          </Badge>
          <Badge variant={getPerformanceBadgeVariant(rep.performanceTier)} className="text-xs">
            {formatPerformanceTier(rep.performanceTier)}
          </Badge>
        </div>
        <div className="text-sm text-gray-600">
          Score: <span className="font-medium text-gray-900">{rep.overallScore}</span>
        </div>
      </div>

      <div className="space-y-2">
        {/* Capacity bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Capacity</span>
            <span>{rep.currentWorkload.utilizationPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${capacityColor}`}
              style={{ width: `${rep.currentWorkload.utilizationPercentage}%` }}
            />
          </div>
        </div>

        {/* Lead stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Active:</span>
            <span className="ml-1 font-medium text-gray-900">
              {rep.currentWorkload.activeLeads}/{rep.capacity.maxActiveLeads}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Today:</span>
            <span className="ml-1 font-medium text-gray-900">
              {rep.currentWorkload.leadsAssignedToday}/{rep.capacity.maxNewLeadsPerDay}
            </span>
          </div>
          <div>
            <span className="text-gray-500">This Week:</span>
            <span className="ml-1 font-medium text-gray-900">
              {rep.currentWorkload.leadsAssignedThisWeek}/{rep.capacity.maxNewLeadsPerWeek}
            </span>
          </div>
        </div>

        {/* Remaining capacity */}
        {rep.currentWorkload.remainingCapacity.leads > 0 && (
          <div className="text-xs text-green-600 font-medium">
            Can accept {rep.currentWorkload.remainingCapacity.leads} more lead{rep.currentWorkload.remainingCapacity.leads > 1 ? 's' : ''}
          </div>
        )}

        {rep.currentWorkload.isAtCapacity && (
          <div className="text-xs text-red-600 font-medium">
            At maximum capacity
          </div>
        )}
      </div>
    </div>
  );
}

function getCapacityColor(utilization: number): string {
  if (utilization >= 90) {return 'bg-red-500';}
  if (utilization >= 70) {return 'bg-yellow-500';}
  return 'bg-green-500';
}

function getPerformanceBadgeVariant(tier: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (tier) {
    case 'top_performer':
      return 'default';
    case 'high_performer':
      return 'secondary';
    case 'at_risk':
      return 'destructive';
    default:
      return 'outline';
  }
}

function formatPerformanceTier(tier: string): string {
  return tier.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
