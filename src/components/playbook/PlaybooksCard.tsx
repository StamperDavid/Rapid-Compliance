/**
 * Playbooks Card
 * 
 * Displays list of available playbooks with filters and search.
 * Shows playbook effectiveness, adoption rate, and status.
 * 
 * @module components/playbook
 */

'use client';

import React, { useState } from 'react';
import type { Playbook, PlaybookCategory, PlaybookStatus } from '@/lib/playbook/types';

interface PlaybooksCardProps {
  playbooks: Playbook[];
  onSelectPlaybook?: (playbook: Playbook) => void;
  className?: string;
}

export function PlaybooksCard({ playbooks, onSelectPlaybook, className = '' }: PlaybooksCardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PlaybookCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<PlaybookStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'effectiveness' | 'adoption' | 'usage'>('effectiveness');
  
  // Filter playbooks
  const filteredPlaybooks = playbooks.filter(playbook => {
    const matchesSearch = playbook.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          playbook.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || playbook.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || playbook.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });
  
  // Sort playbooks
  const sortedPlaybooks = [...filteredPlaybooks].sort((a, b) => {
    switch (sortBy) {
      case 'effectiveness':
        return b.effectiveness - a.effectiveness;
      case 'adoption':
        return b.adoptionRate - a.adoptionRate;
      case 'usage':
        return b.usageCount - a.usageCount;
      default:
        return 0;
    }
  });
  
  // Status badge
  const getStatusBadge = (status: PlaybookStatus) => {
    const badges = {
      active: { text: 'Active', bg: 'bg-green-100', color: 'text-green-800' },
      draft: { text: 'Draft', bg: 'bg-gray-100', color: 'text-gray-800' },
      testing: { text: 'Testing', bg: 'bg-blue-100', color: 'text-blue-800' },
      archived: { text: 'Archived', bg: 'bg-yellow-100', color: 'text-yellow-800' },
      deprecated: { text: 'Deprecated', bg: 'bg-red-100', color: 'text-red-800' },
    };
    const badge = badges[status];
    return (
      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${badge.bg} ${badge.color}`}>
        {badge.text}
      </span>
    );
  };
  
  // Effectiveness color
  const getEffectivenessColor = (score: number) => {
    if (score >= 80) {return 'text-green-600';}
    if (score >= 60) {return 'text-blue-600';}
    if (score >= 40) {return 'text-yellow-600';}
    return 'text-red-600';
  };
  
  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Playbooks Library</h2>
      
      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search playbooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as PlaybookCategory | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="discovery">Discovery</option>
              <option value="demo">Demo</option>
              <option value="objection_handling">Objection Handling</option>
              <option value="closing">Closing</option>
              <option value="negotiation">Negotiation</option>
              <option value="follow_up">Follow-up</option>
              <option value="prospecting">Prospecting</option>
              <option value="relationship_building">Relationship Building</option>
              <option value="competitive_positioning">Competitive Positioning</option>
              <option value="value_articulation">Value Articulation</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PlaybookStatus | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="testing">Testing</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'effectiveness' | 'adoption' | 'usage')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="effectiveness">Effectiveness</option>
              <option value="adoption">Adoption Rate</option>
              <option value="usage">Usage Count</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Playbook List */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {sortedPlaybooks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No playbooks found</p>
            <p className="text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          sortedPlaybooks.map((playbook) => (
            <div
              key={playbook.id}
              onClick={() => onSelectPlaybook?.(playbook)}
              className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                onSelectPlaybook ? 'cursor-pointer hover:border-blue-500' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{playbook.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{playbook.description}</p>
                </div>
                <div className="ml-4">
                  {getStatusBadge(playbook.status)}
                </div>
              </div>
              
              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                  {playbook.category.replace(/_/g, ' ')}
                </span>
                <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">
                  {playbook.conversationType.replace(/_/g, ' ')}
                </span>
                {playbook.tags.slice(0, 3).map((tag, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-50 text-gray-700 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Effectiveness</div>
                  <div className={`font-semibold text-lg ${getEffectivenessColor(playbook.effectiveness)}`}>
                    {playbook.effectiveness}%
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Adoption</div>
                  <div className="font-semibold text-lg">{playbook.adoptionRate}%</div>
                </div>
                <div>
                  <div className="text-gray-600">Usage</div>
                  <div className="font-semibold text-lg">{playbook.usageCount}</div>
                </div>
                <div>
                  <div className="text-gray-600">Confidence</div>
                  <div className="font-semibold text-lg">{playbook.confidence}%</div>
                </div>
              </div>
              
              {/* Content Summary */}
              <div className="mt-3 pt-3 border-t border-gray-200 flex gap-4 text-xs text-gray-600">
                <span>{playbook.patterns.length} patterns</span>
                <span>{playbook.talkTracks.length} talk tracks</span>
                <span>{playbook.objectionResponses.length} objection responses</span>
                <span>{playbook.bestPractices.length} best practices</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Summary */}
      {sortedPlaybooks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-sm text-gray-600">
          <span>Showing {sortedPlaybooks.length} of {playbooks.length} playbooks</span>
          <span>
            Avg Effectiveness: {Math.round(sortedPlaybooks.reduce((sum, p) => sum + p.effectiveness, 0) / sortedPlaybooks.length)}%
          </span>
        </div>
      )}
    </div>
  );
}
