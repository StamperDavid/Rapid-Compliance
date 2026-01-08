/**
 * CompetitorProfileCard - Display competitor intelligence
 * 
 * Shows key competitor information including strengths, weaknesses,
 * pricing, and features in a beautiful card layout
 */

'use client';

import React from 'react';
import type { CompetitorProfile } from '@/lib/battlecard';

interface CompetitorProfileCardProps {
  profile: CompetitorProfile;
  className?: string;
}

export function CompetitorProfileCard({ profile, className = '' }: CompetitorProfileCardProps) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{profile.companyName}</h2>
          <p className="text-gray-400 text-sm mt-1">{profile.domain}</p>
        </div>
        <div className="flex flex-col items-end space-y-1">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            profile.pricing.competitivePosition === 'premium' 
              ? 'bg-purple-500/20 text-purple-400'
              : profile.pricing.competitivePosition === 'mid-market'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-green-500/20 text-green-400'
          }`}>
            {profile.pricing.competitivePosition.toUpperCase()}
          </span>
          <span className="text-xs text-gray-500">
            Confidence: {Math.round(profile.metadata.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Description */}
      {profile.description && (
        <p className="text-gray-300 text-sm">{profile.description}</p>
      )}

      {/* Key Info Grid */}
      <div className="grid grid-cols-2 gap-4">
        <InfoItem label="Industry" value={(profile.industry !== '' && profile.industry != null) ? profile.industry : 'Unknown'} />
        <InfoItem label="Size" value={(profile.size !== '' && profile.size != null) ? profile.size : 'Unknown'} />
        <InfoItem label="Location" value={(profile.location !== '' && profile.location != null) ? profile.location : 'Unknown'} />
        <InfoItem label="Pricing Model" value={profile.pricing.model} />
      </div>

      {/* Product Offering */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Product Offering
        </h3>
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Category</span>
            <p className="text-white text-sm mt-1">{profile.productOffering.category}</p>
          </div>
          {profile.productOffering.targetMarket.length > 0 && (
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Target Market</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile.productOffering.targetMarket.map((market, i) => (
                  <span key={i} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                    {market}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profile.productOffering.keyFeatures.length > 0 && (
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                Key Features ({profile.productOffering.keyFeatures.length})
              </span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {profile.productOffering.keyFeatures.slice(0, 6).map((feature, i) => (
                  <div key={i} className="text-sm text-gray-300">
                    • {feature.feature}
                  </div>
                ))}
              </div>
              {profile.productOffering.keyFeatures.length > 6 && (
                <p className="text-xs text-gray-500 mt-2">
                  +{profile.productOffering.keyFeatures.length - 6} more features
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-4">
        {/* Strengths */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-green-400 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Strengths ({profile.analysis.strengths.length})
          </h3>
          <div className="space-y-2">
            {profile.analysis.strengths.slice(0, 3).map((strength, i) => (
              <div key={i} className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-green-400">{strength.strength}</span>
                  <ImpactBadge impact={strength.impact} />
                </div>
                <p className="text-xs text-gray-400">{strength.evidence}</p>
              </div>
            ))}
            {profile.analysis.strengths.length > 3 && (
              <p className="text-xs text-gray-500 text-center">
                +{profile.analysis.strengths.length - 3} more strengths
              </p>
            )}
          </div>
        </div>

        {/* Weaknesses */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-red-400 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Weaknesses ({profile.analysis.weaknesses.length})
          </h3>
          <div className="space-y-2">
            {profile.analysis.weaknesses.slice(0, 3).map((weakness, i) => (
              <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-red-400">{weakness.weakness}</span>
                  <ImpactBadge impact={weakness.impact} />
                </div>
                <p className="text-xs text-gray-400 mb-2">{weakness.evidence}</p>
                <div className="bg-gray-900/50 rounded p-2">
                  <p className="text-xs text-yellow-400">
                    <span className="font-medium">How to exploit:</span> {weakness.howToExploit}
                  </p>
                </div>
              </div>
            ))}
            {profile.analysis.weaknesses.length > 3 && (
              <p className="text-xs text-gray-500 text-center">
                +{profile.analysis.weaknesses.length - 3} more weaknesses
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Growth Signals */}
      {(profile.growthSignals.isHiring || profile.growthSignals.recentActivity.length > 0) && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-400 flex items-center mb-3">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Growth Signals
          </h3>
          <div className="space-y-2 text-sm">
            {profile.growthSignals.isHiring && (
              <div className="flex items-center text-gray-300">
                <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                Currently hiring ({profile.growthSignals.jobCount} open roles)
              </div>
            )}
            {profile.growthSignals.recentActivity.slice(0, 3).map((activity, i) => (
              <div key={i} className="flex items-center text-gray-300">
                <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                {activity}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tech Stack */}
      {profile.techStack.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Tech Stack ({profile.techStack.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.techStack.slice(0, 10).map((tech, i) => (
              <span key={i} className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs">
                {tech.name}
              </span>
            ))}
            {profile.techStack.length > 10 && (
              <span className="px-2 py-1 text-gray-500 text-xs">
                +{profile.techStack.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-800">
        <span>Scraped: {new Date(profile.metadata.scrapedAt).toLocaleDateString()}</span>
        <span>Expires: {new Date(profile.metadata.expiresAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <p className="text-white text-sm mt-1 capitalize">{value}</p>
    </div>
  );
}

function ImpactBadge({ impact }: { impact: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-green-500/20 text-green-400',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[impact]}`}>
      {impact.toUpperCase()}
    </span>
  );
}
