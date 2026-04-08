'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { OutboundSequence, ProspectEnrollment } from '@/types/outbound-sequence'
import { logger } from '@/lib/logger/logger';
import { PageTitle } from '@/components/ui/typography';

export default function EmailSequencesPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [sequences, setSequences] = useState<OutboundSequence[]>([]);
  const [enrollments, setEnrollments] = useState<ProspectEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sequences' | 'enrollments'>('sequences');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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

  const confirmDeleteSequence = async () => {
    if (!deleteTarget) { return; }
    try {
      await FirestoreService.delete(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/sequences`,
        deleteTarget
      );
      setSequences(sequences.filter(s => s.id !== deleteTarget));
      toast.success('Sequence deleted');
    } catch (error) {
      logger.error('Error deleting sequence:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      toast.error('Failed to delete sequence');
    } finally {
      setDeleteTarget(null);
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
    <div className="p-8 space-y-6">
      <div>
        {/* Header */}
        <div className="mb-8">
          <Link href="/outbound" className="text-primary text-sm font-medium no-underline hover:underline">
            ← Back to Outbound
          </Link>
          <div className="flex items-center justify-between mt-4">
            <div>
              <PageTitle>Email Sequences</PageTitle>
              <p className="text-muted-foreground text-sm mt-1">
                {loading ? 'Loading...' : `${sequences.length} sequences • ${enrollments.filter(e => e.status === 'active').length} active enrollments`}
              </p>
            </div>
            <div className="flex gap-4">
              <Link
                href="/sequences/analytics"
                className="px-6 py-3 bg-surface-elevated text-foreground border border-border-strong rounded-lg text-sm font-semibold no-underline hover:bg-card transition-colors"
              >
                View Analytics
              </Link>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-primary text-foreground border-none rounded-lg cursor-pointer text-sm font-semibold hover:bg-primary-light transition-colors"
              >
                + Create Sequence
              </button>
            </div>
          </div>
        </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-border-strong mb-8">
            <button
              onClick={() => setActiveTab('sequences')}
              className={`px-6 py-4 bg-transparent border-none cursor-pointer text-sm font-semibold transition-colors ${
                activeTab === 'sequences'
                  ? 'text-primary border-b-[3px] border-primary -mb-px'
                  : 'text-muted-foreground border-b-[3px] border-transparent'
              }`}
            >
              Sequences
            </button>
            <button
              onClick={() => setActiveTab('enrollments')}
              className={`px-6 py-4 bg-transparent border-none cursor-pointer text-sm font-semibold transition-colors ${
                activeTab === 'enrollments'
                  ? 'text-primary border-b-[3px] border-primary -mb-px'
                  : 'text-muted-foreground border-b-[3px] border-transparent'
              }`}
            >
              Enrollments ({enrollments.filter(e => e.status === 'active').length})
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-3xl mb-4">⏳</div>
              <p>Loading sequences...</p>
            </div>
          )}

          {/* Sequences Tab */}
          {!loading && activeTab === 'sequences' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sequences.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-surface-main rounded-2xl border border-border-strong">
                  <div className="text-5xl mb-4">📧</div>
                  <p className="text-muted-foreground mb-6">No sequences yet. Create your first email sequence.</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 bg-primary text-foreground border-none rounded-lg cursor-pointer text-sm font-semibold hover:bg-primary-light transition-colors"
                  >
                    Create First Sequence
                  </button>
                </div>
              ) : (
                sequences.map((seq) => (
                  <div
                    key={seq.id}
                    className="bg-surface-main border border-border-strong rounded-2xl p-6 relative"
                  >
                    {/* Status Badge */}
                    <div className={`absolute top-4 right-4 px-3 py-1 rounded text-xs font-bold uppercase ${
                      seq.status === 'active'
                        ? 'bg-[var(--color-success-dark)] text-[var(--color-success-light)]'
                        : seq.status === 'paused'
                          ? 'bg-[var(--color-warning-dark)] text-[var(--color-warning-light)]'
                          : 'bg-border-strong text-muted-foreground'
                    }`}>
                      {seq.status}
                    </div>

                    <h3 className="text-xl font-bold text-foreground mb-2 pr-20">{seq.name}</h3>
                    <p className="text-muted-foreground text-sm mb-6">
                      {(seq.description !== '' && seq.description != null) ? seq.description : 'No description'}
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div>
                        <div className="text-xs text-muted-foreground">Steps</div>
                        <div className="text-xl text-foreground font-semibold">{seq.steps.length}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Enrolled</div>
                        <div className="text-xl text-foreground font-semibold">{seq.analytics?.totalEnrolled ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Reply Rate</div>
                        <div className="text-xl text-foreground font-semibold">
                          {seq.analytics?.totalSent && seq.analytics.totalSent > 0
                            ? `${Math.round((seq.analytics.totalReplied / seq.analytics.totalSent) * 100)}%`
                            : '0%'
                          }
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      {seq.status === 'draft' && (
                        <button
                          onClick={() => void handleActivateSequence(seq.id)}
                          className="flex-1 py-3 bg-primary text-foreground border-none rounded-lg cursor-pointer text-sm font-semibold hover:bg-primary-light transition-colors"
                        >
                          Activate
                        </button>
                      )}
                      {seq.status === 'active' && (
                        <button
                          onClick={() => void handlePauseSequence(seq.id)}
                          className="flex-1 py-3 bg-[var(--color-warning-dark)] text-[var(--color-warning-light)] border border-[var(--color-warning-light)] rounded-lg cursor-pointer text-sm font-semibold"
                        >
                          Pause
                        </button>
                      )}
                      {seq.status === 'paused' && (
                        <button
                          onClick={() => void handleActivateSequence(seq.id)}
                          className="flex-1 py-3 bg-primary text-foreground border-none rounded-lg cursor-pointer text-sm font-semibold hover:bg-primary-light transition-colors"
                        >
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => {/* Edit functionality - currently unused */}}
                        className="flex-1 py-3 bg-surface-elevated text-foreground border border-border-strong rounded-lg cursor-pointer text-sm font-semibold hover:bg-card transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(seq.id)}
                        className="py-3 px-4 bg-transparent text-error border border-error rounded-lg cursor-pointer text-sm font-semibold hover:bg-error/10 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Enrollments Tab */}
          {!loading && activeTab === 'enrollments' && (
            <div className="bg-surface-main border border-border-strong rounded-2xl overflow-hidden">
              <table className="w-full border-collapse">
                <thead className="bg-surface-main">
                  <tr>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">Prospect</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">Sequence</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">Step</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">Next Action</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-muted-foreground">
                        No enrollments yet. Activate a sequence and enroll prospects.
                      </td>
                    </tr>
                  ) : (
                    enrollments.map((enrollment) => {
                      const sequence = sequences.find(s => s.id === enrollment.sequenceId);
                      return (
                        <tr key={enrollment.id} className="border-b border-border-light">
                          <td className="p-4 text-foreground">{enrollment.prospectId}</td>
                          <td className="p-4 text-foreground">
                            {(() => { const v = sequence?.name; return (v !== '' && v != null) ? v : 'Unknown'; })()}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              enrollment.status === 'active'
                                ? 'bg-[var(--color-success-dark)] text-[var(--color-success-light)]'
                                : 'bg-border-strong text-muted-foreground'
                            }`}>
                              {enrollment.status}
                            </span>
                          </td>
                          <td className="p-4 text-foreground">
                            {enrollment.currentStep + 1} / {sequence?.steps.length ?? 0}
                          </td>
                          <td className="p-4 text-muted-foreground text-sm">
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

      {/* Create Sequence Modal */}
      {showCreateModal && (
        <CreateSequenceModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(name, desc) => void handleCreateSequence(name, desc)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-surface-elevated rounded-2xl border border-border-strong p-8 max-w-[28rem] w-full text-center">
            <h3 className="text-foreground text-xl font-semibold mb-3">Delete Sequence?</h3>
            <p className="text-muted-foreground text-sm mb-6">This cannot be undone. All steps and analytics for this sequence will be permanently removed.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-6 py-3 bg-surface-main text-foreground border border-border-strong rounded-lg cursor-pointer font-semibold hover:bg-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDeleteSequence()}
                className="px-6 py-3 bg-error text-white border-none rounded-lg cursor-pointer font-semibold hover:bg-error/80 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-surface-elevated rounded-2xl border border-border-light max-w-[40rem] w-full">
        <div className="border-b border-border-light px-6 py-5 flex items-center justify-between">
          <h2 className="text-foreground text-2xl font-bold m-0">Create Email Sequence</h2>
          <button onClick={onClose} className="text-muted-foreground bg-transparent border-none cursor-pointer text-2xl hover:text-foreground transition-colors">
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-muted-foreground text-sm font-medium mb-2">
              Sequence Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cold Outreach - Tech Startups"
              className="w-full px-3 py-3 bg-surface-paper border border-border-light text-foreground rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-muted-foreground text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this sequence..."
              rows={3}
              className="w-full px-3 py-3 bg-surface-paper border border-border-light text-foreground rounded-lg text-sm resize-y"
            />
          </div>

          <div className="border-t border-border-light flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-surface-paper border border-border-light text-muted-foreground rounded-lg cursor-pointer text-sm font-semibold hover:bg-card transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 py-3 bg-primary text-foreground border-none rounded-lg cursor-pointer text-sm font-semibold hover:bg-primary-light transition-colors"
            >
              Create Sequence
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

