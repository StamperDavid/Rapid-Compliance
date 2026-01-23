/**
 * BattlecardView - Interactive Battlecard Display
 * 
 * Shows comprehensive competitive battlecard with:
 * - Feature comparison matrix
 * - Pricing comparison
 * - Battle tactics and talk tracks
 * - Objection handling
 * - Discovery questions
 * - Key messaging
 */

'use client';

import React, { useState } from 'react';
import type { Battlecard } from '@/lib/battlecard';

interface BattlecardViewProps {
  battlecard: Battlecard;
  className?: string;
}

export function BattlecardView({ battlecard, className = '' }: BattlecardViewProps) {
  const [activeTab, setActiveTab] = useState<'comparison' | 'tactics' | 'messaging'>('comparison');

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {battlecard.ourProduct} vs {battlecard.competitorName}
            </h1>
            <p className="text-gray-400 text-sm">{battlecard.competitorDomain}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500">Battlecard ID</span>
            <p className="text-white text-sm font-mono">{battlecard.id.substring(0, 12)}...</p>
            <span className="text-xs text-gray-500">
              Generated: {new Date(battlecard.metadata.generatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <TabButton
          active={activeTab === 'comparison'}
          onClick={() => setActiveTab('comparison')}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }
        >
          Feature &amp; Pricing
        </TabButton>
        <TabButton
          active={activeTab === 'tactics'}
          onClick={() => setActiveTab('tactics')}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        >
          Battle Tactics
        </TabButton>
        <TabButton
          active={activeTab === 'messaging'}
          onClick={() => setActiveTab('messaging')}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          }
        >
          Key Messaging
        </TabButton>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'comparison' && (
          <ComparisonTab battlecard={battlecard} />
        )}
        {activeTab === 'tactics' && (
          <TacticsTab battlecard={battlecard} />
        )}
        {activeTab === 'messaging' && (
          <MessagingTab battlecard={battlecard} />
        )}
      </div>
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  children, 
  icon 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 text-sm font-medium transition-colors ${
        active
          ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-400'
          : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function ComparisonTab({ battlecard }: { battlecard: Battlecard }) {
  return (
    <div className="space-y-8">
      {/* Pricing Comparison */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <svg className="w-6 h-6 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pricing Comparison
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">Our Positioning</h3>
            <p className="text-gray-300 text-sm">{battlecard.pricingComparison.ourPositioning}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-400 mb-2">Their Positioning</h3>
            <p className="text-gray-300 text-sm">{battlecard.pricingComparison.theirPositioning}</p>
          </div>
        </div>
        <div className={`border rounded-lg p-4 ${
          battlecard.pricingComparison.advantage === 'us'
            ? 'bg-green-500/10 border-green-500/20'
            : battlecard.pricingComparison.advantage === 'them'
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-gray-800/50 border-gray-700'
        }`}>
          <h3 className="text-sm font-semibold text-white mb-2">Key Differences</h3>
          <ul className="space-y-1">
            {battlecard.pricingComparison.keyDifferences.map((diff, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start">
                <span className="mr-2">•</span>
                <span>{diff}</span>
              </li>
            ))}
          </ul>
          {battlecard.pricingComparison.valueJustification.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-white mt-3 mb-2">Value Justification</h3>
              <ul className="space-y-1">
                {battlecard.pricingComparison.valueJustification.map((just, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start">
                    <span className="mr-2">✓</span>
                    <span>{just}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Feature Comparison */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center">
          <svg className="w-6 h-6 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Feature Comparison
        </h2>
        <div className="space-y-6">
          {battlecard.featureComparison.map((category, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
                  {category.category}
                </h3>
              </div>
              <div className="divide-y divide-gray-700">
                {category.features.map((feature, _j) => (
                  <div key={_j} className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-800/30 transition-colors">
                    <div className="col-span-5 text-sm text-gray-300">
                      {feature.featureName}
                    </div>
                    <div className="col-span-2 text-center">
                      <FeatureBadge value={feature.us} _label="Us" />
                    </div>
                    <div className="col-span-2 text-center">
                      <FeatureBadge value={feature.them} _label="Them" />
                    </div>
                    <div className="col-span-3 text-center">
                      <AdvantageBadge advantage={feature.advantage} />
                    </div>
                    {feature.notes && (
                      <div className="col-span-12 text-xs text-gray-500 italic">
                        {feature.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TacticsTab({ battlecard }: { battlecard: Battlecard }) {
  return (
    <div className="space-y-8">
      {/* Ideal Situations */}
      <TacticsSection
        title="When We Win"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        iconColor="text-green-400"
        bgColor="bg-green-500/10"
        borderColor="border-green-500/20"
      >
        {battlecard.tactics.idealSituations.map((sit, i) => (
          <div key={i} className="bg-gray-800/50 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-white">{sit.situation}</h4>
            <p className="text-sm text-gray-400"><strong>Why:</strong> {sit.reasoning}</p>
            <div className="bg-green-500/10 border border-green-500/20 rounded p-3 mt-2">
              <p className="text-sm text-green-400"><strong>Talk Track:</strong></p>
              <p className="text-sm text-gray-300 mt-1 italic">{'"'}{sit.talkTrack}{'"'}</p>
            </div>
          </div>
        ))}
      </TacticsSection>

      {/* Challenging Situations */}
      <TacticsSection
        title="When They Might Win"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
        iconColor="text-yellow-400"
        bgColor="bg-yellow-500/10"
        borderColor="border-yellow-500/20"
      >
        {battlecard.tactics.challengingSituations.map((sit, i) => (
          <div key={i} className="bg-gray-800/50 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-white">{sit.situation}</h4>
            <p className="text-sm text-gray-400"><strong>Why:</strong> {sit.reasoning}</p>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3 mt-2">
              <p className="text-sm text-blue-400"><strong>Mitigation:</strong></p>
              <p className="text-sm text-gray-300 mt-1">{sit.mitigation}</p>
            </div>
          </div>
        ))}
      </TacticsSection>

      {/* Objection Handling */}
      <TacticsSection
        title="Objection Handling"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        }
        iconColor="text-blue-400"
        bgColor="bg-blue-500/10"
        borderColor="border-blue-500/20"
      >
        {battlecard.tactics.objectionHandling.map((obj, i) => (
          <div key={i} className="bg-gray-800/50 rounded-lg p-4 space-y-2">
            <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
              <p className="text-sm text-red-400"><strong>Objection:</strong></p>
              <p className="text-sm text-gray-300 mt-1 italic">{'"'}{obj.objection}{'"'}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
              <p className="text-sm text-green-400"><strong>Response:</strong></p>
              <p className="text-sm text-gray-300 mt-1">{obj.response}</p>
            </div>
            {obj.proofPoints.length > 0 && (
              <div className="bg-gray-900/50 rounded p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Proof Points:</p>
                <ul className="space-y-1">
                  {obj.proofPoints.map((proof, j) => (
                    <li key={j} className="text-sm text-gray-300 flex items-start">
                      <span className="text-blue-400 mr-2">✓</span>
                      <span>{proof}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </TacticsSection>

      {/* Competitive Traps */}
      {battlecard.tactics.competitiveTraps.length > 0 && (
        <TacticsSection
          title="Competitive Traps"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          iconColor="text-purple-400"
          bgColor="bg-purple-500/10"
          borderColor="border-purple-500/20"
        >
          {battlecard.tactics.competitiveTraps.map((trap, i) => (
            <div key={i} className="bg-gray-800/50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-purple-400">{trap.trap}</h4>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Setup</p>
                  <p className="text-sm text-gray-300 mt-1">{trap.setup}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Delivery</p>
                  <p className="text-sm text-gray-300 mt-1 italic">{'"'}{trap.delivery}{'"'}</p>
                </div>
              </div>
            </div>
          ))}
        </TacticsSection>
      )}

      {/* Discovery Questions */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Qualifying Questions
          </h3>
          <div className="space-y-2">
            {battlecard.discoveryQuestions.qualifyingQuestions.map((q, i) => (
              <div key={i} className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <p className="text-sm text-gray-300">{i + 1}. {q}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <svg className="w-5 h-5 mr-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Landmine Questions
          </h3>
          <div className="space-y-2">
            {battlecard.discoveryQuestions.landmineQuestions.map((q, i) => (
              <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-sm text-gray-300">{i + 1}. {q}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessagingTab({ battlecard }: { battlecard: Battlecard }) {
  return (
    <div className="space-y-6">
      {/* Elevator Pitch */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          30-Second Elevator Pitch
        </h3>
        <p className="text-gray-300 text-lg italic leading-relaxed">{'"'}{battlecard.keyMessages.elevator}{'"'}</p>
      </div>

      {/* Executive Summary */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
          <svg className="w-6 h-6 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Why We Win (Executive Summary)
        </h3>
        <p className="text-gray-300 leading-relaxed">{battlecard.keyMessages.executiveSummary}</p>
      </div>

      {/* Risk Mitigation */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
          <svg className="w-6 h-6 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0121 12c0 .932-.11 1.837-.318 2.698M5.682 4.682A11.96 11.96 0 0012 3c.932 0 1.837.11 2.698.318M3 12c0 .932.11 1.837.318 2.698M18.318 19.318A11.96 11.96 0 0112 21c-.932 0-1.837-.11-2.698-.318" />
          </svg>
          Addressing Switching Concerns
        </h3>
        <ul className="space-y-3">
          {battlecard.keyMessages.riskMitigation.map((risk, i) => (
            <li key={i} className="flex items-start">
              <span className="text-yellow-400 mr-3 mt-1">✓</span>
              <span className="text-gray-300">{risk}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TacticsSection({
  title,
  icon,
  iconColor,
  children
}: {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className={`text-xl font-bold text-white flex items-center ${iconColor}`}>
        {icon}
        <span className="ml-2">{title}</span>
      </h2>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function FeatureBadge({ value, _label }: { value: 'yes' | 'no' | 'partial' | 'unknown'; _label: string }) {
  const config = {
    yes: { icon: '✓', color: 'text-green-400 bg-green-500/20' },
    no: { icon: '✗', color: 'text-red-400 bg-red-500/20' },
    partial: { icon: '◐', color: 'text-yellow-400 bg-yellow-500/20' },
    unknown: { icon: '?', color: 'text-gray-400 bg-gray-500/20' },
  };

  const { icon, color } = config[value];

  return (
    <span className={`inline-flex items-center justify-center w-20 px-2 py-1 rounded text-xs font-medium ${color}`}>
      <span className="mr-1">{icon}</span>
      <span className="capitalize">{value}</span>
    </span>
  );
}

function AdvantageBadge({ advantage }: { advantage: 'us' | 'them' | 'neutral' }) {
  const config = {
    us: { text: 'Our Advantage', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    them: { text: 'Their Advantage', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    neutral: { text: 'Neutral', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  };

  const { text, color } = config[advantage];

  return (
    <span className={`inline-block px-3 py-1 rounded border text-xs font-medium ${color}`}>
      {text}
    </span>
  );
}
