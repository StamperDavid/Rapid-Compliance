'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { OutboundSequence, ProspectEnrollment } from '@/types/outbound-sequence'
import { logger } from '@/lib/logger/logger';

export default function EmailSequencesPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [sequences, setSequences] = useState<OutboundSequence[]>([]);
  const [enrollments, setEnrollments] = useState<ProspectEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sequences' | 'enrollments'>('sequences');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load sequences from Firestore
  useEffect(() => {
    if (!PLATFORM_ID) {return;}

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load sequences
        const seqs = await FirestoreService.getAll<OutboundSequence>(
          `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/sequences`,
          []
        );
        setSequences(seqs);

        // Load enrollments
        const enr = await FirestoreService.getAll<ProspectEnrollment>(
          `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/sequenceEnrollments`,
          []
        );
        setEnrollments(enr);
      } catch (error) {
        logger.error('Error loading sequences:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const handleCreateSequence = async (name: string, description: string) => {
    if (!PLATFORM_ID || !user) {return;}

    try {
      const sequenceId = `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newSequence: OutboundSequence = {
        id: sequenceId,
        name,
        description,
        status: 'draft',
        steps: [],
        settings: {
          stopOnReply: true,
          stopOnBounc: true,
          stopOnUnsubscribe: true,
          sendingWindow: {
            enabled: true,
            timezone: 'America/New_York',
            days: [1, 2, 3, 4, 5], // Mon-Fri
            startHour: 9,
            endHour: 17,
          },
        },
        analytics: {
          totalEnrolled: 0,
          activeProspects: 0,
          completedProspects: 0,
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalReplied: 0,
          totalBounced: 0,
          totalUnsubscribed: 0,
          meetingsBooked: 0,
          dealsCreated: 0,
          revenue: 0,
          deliveryRate: 0,
          openRate: 0,
          clickRate: 0,
          replyRate: 0,
          conversionRate: 0,
        },
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/sequences`,
        sequenceId,
        newSequence,
        false
      );

      setSequences([...sequences, newSequence]);
      setShowCreateModal(false);
    } catch (error) {
      logger.error('Error creating sequence:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to create sequence');
    }
  };

  const handleActivateSequence = async (sequenceId: string) => {
    try {
      await FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/sequences`,
        sequenceId,
        { status: 'active' }
      );

      setSequences(sequences.map(s =>
        s.id === sequenceId ? { ...s, status: 'active' as const } : s
      ));
    } catch (error) {
      logger.error('Error activating sequence:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to activate sequence');
    }
  };

  const handlePauseSequence = async (sequenceId: string) => {
    try {
      await FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/sequences`,
        sequenceId,
        { status: 'paused' }
      );

      setSequences(sequences.map(s =>
        s.id === sequenceId ? { ...s, status: 'paused' as const } : s
      ));
    } catch (error) {
      logger.error('Error pausing sequence:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to pause sequence');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/outbound`} style={{ color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none' }}>
              ← Back to Outbound
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                  Email Sequences
                </h1>
                <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
                  {loading ? 'Loading...' : `${sequences.length} sequences • ${enrollments.filter(e => e.status === 'active').length} active enrollments`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Link
                  href={`/sequences/analytics`}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  📊 View Analytics
                </Link>
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-primary)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                  }}
                >
                  + Create Sequence
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border-strong)', marginBottom: '2rem' }}>
            <button
              onClick={() => setActiveTab('sequences')}
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: 'transparent',
                color: activeTab === 'sequences' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                border: 'none',
                borderBottom: `3px solid ${activeTab === 'sequences' ? 'var(--color-primary)' : 'transparent'}`,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              Sequences
            </button>
            <button
              onClick={() => setActiveTab('enrollments')}
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: 'transparent',
                color: activeTab === 'enrollments' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                border: 'none',
                borderBottom: `3px solid ${activeTab === 'enrollments' ? 'var(--color-primary)' : 'transparent'}`,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              Enrollments ({enrollments.filter(e => e.status === 'active').length})
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-disabled)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
              <p>Loading sequences...</p>
            </div>
          )}

          {/* Sequences Tab */}
          {!loading && activeTab === 'sequences' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {sequences.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', backgroundColor: 'var(--color-bg-main)', borderRadius: '1rem', border: '1px solid var(--color-border-strong)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
                  <p style={{ color: 'var(--color-text-disabled)', marginBottom: '1.5rem' }}>No sequences yet. Create your first email sequence.</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-primary)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    Create First Sequence
                  </button>
                </div>
              ) : (
                sequences.map((seq) => (
                  <div
                    key={seq.id}
                    style={{
                      backgroundColor: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: '1rem',
                      padding: '1.5rem',
                      position: 'relative',
                    }}
                  >
                    {/* Status Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      padding: '0.25rem 0.75rem',
                      backgroundColor: seq.status === 'active' ? 'var(--color-success-dark)' : seq.status === 'paused' ? 'var(--color-warning-dark)' : 'var(--color-border-strong)',
                      color: seq.status === 'active' ? 'var(--color-success-light)' : seq.status === 'paused' ? 'var(--color-warning-light)' : 'var(--color-text-secondary)',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                    }}>
                      {seq.status}
                    </div>

                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem', paddingRight: '5rem' }}>
                      {seq.name}
                    </h3>
                    <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                      {(seq.description !== '' && seq.description != null) ? seq.description : 'No description'}
                    </p>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Steps</div>
                        <div style={{ fontSize: '1.25rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{seq.steps.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Enrolled</div>
                        <div style={{ fontSize: '1.25rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>{seq.analytics?.totalEnrolled ?? 0}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Reply Rate</div>
                        <div style={{ fontSize: '1.25rem', color: 'var(--color-text-primary)', fontWeight: '600' }}>
                          {seq.analytics?.totalSent && seq.analytics.totalSent > 0
                            ? `${Math.round((seq.analytics.totalReplied / seq.analytics.totalSent) * 100)}%`
                            : '0%'
                          }
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {seq.status === 'draft' && (
                        <button
                          onClick={() => void handleActivateSequence(seq.id)}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-primary)',
                            color: 'var(--color-text-primary)',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                        >
                          Activate
                        </button>
                      )}
                      {seq.status === 'active' && (
                        <button
                          onClick={() => void handlePauseSequence(seq.id)}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-warning-dark)',
                            color: 'var(--color-warning-light)',
                            border: '1px solid var(--color-warning-light)',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                        >
                          Pause
                        </button>
                      )}
                      {seq.status === 'paused' && (
                        <button
                          onClick={() => void handleActivateSequence(seq.id)}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-primary)',
                            color: 'var(--color-text-primary)',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                        >
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => {/* Edit functionality - currently unused */}}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          backgroundColor: 'var(--color-bg-elevated)',
                          color: 'var(--color-text-primary)',
                          border: '1px solid var(--color-border-strong)',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Enrollments Tab */}
          {!loading && activeTab === 'enrollments' && (
            <div style={{ backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: 'var(--color-bg-main)' }}>
                  <tr>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                      Prospect
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                      Sequence
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                      Status
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                      Step
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                      Next Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-disabled)' }}>
                        No enrollments yet. Activate a sequence and enroll prospects.
                      </td>
                    </tr>
                  ) : (
                    enrollments.map((enrollment) => {
                      const sequence = sequences.find(s => s.id === enrollment.sequenceId);
                      return (
                        <tr key={enrollment.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '1rem', color: 'var(--color-text-primary)' }}>
                            {enrollment.prospectId}
                          </td>
                          <td style={{ padding: '1rem', color: 'var(--color-text-primary)' }}>
                            {(() => { const v = sequence?.name; return (v !== '' && v != null) ? v : 'Unknown'; })()}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: enrollment.status === 'active' ? 'var(--color-success-dark)' : 'var(--color-border-strong)',
                              color: enrollment.status === 'active' ? 'var(--color-success-light)' : 'var(--color-text-secondary)',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                            }}>
                              {enrollment.status}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', color: 'var(--color-text-primary)' }}>
                            {enrollment.currentStep + 1} / {sequence?.steps.length ?? 0}
                          </td>
                          <td style={{ padding: '1rem', color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
                            {enrollment.nextStepAt 
                              ? new Date(enrollment.nextStepAt).toLocaleString()
                              : 'Completed'
                            }
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Sequence Modal */}
      {showCreateModal && (
        <CreateSequenceModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(name, desc) => void handleCreateSequence(name, desc)}
        />
      )}
    </div>
  );
}

function CreateSequenceModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, desc: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.warning('Please enter a sequence name');
      return;
    }
    onCreate(name, description);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
      <div className="bg-surface-elevated" style={{ borderRadius: '1rem', border: '1px solid var(--color-border-light)', maxWidth: '40rem', width: '100%' }}>
        <div className="border-b border-border-light" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="text-[var(--color-text-primary)]" style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
            Create Email Sequence
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-disabled)]" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>
            ✕
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="text-[var(--color-text-secondary)]" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              Sequence Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cold Outreach - Tech Startups"
              className="bg-surface-paper border-border-light text-[var(--color-text-primary)]"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid', borderRadius: '0.5rem', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label className="text-[var(--color-text-secondary)]" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this sequence..."
              rows={3}
              className="bg-surface-paper border-border-light text-[var(--color-text-primary)]"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid', borderRadius: '0.5rem', fontSize: '0.875rem', resize: 'vertical' }}
            />
          </div>

          <div className="border-t border-border-light" style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem' }}>
            <button
              onClick={onClose}
              className="bg-surface-paper border-border-light text-[var(--color-text-secondary)]"
              style={{ flex: 1, padding: '0.75rem', border: '1px solid', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="bg-primary"
              style={{ flex: 1, padding: '0.75rem', color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
            >
              Create Sequence
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

