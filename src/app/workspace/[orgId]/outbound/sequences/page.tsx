'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { SequenceEngine } from '@/lib/outbound/sequence-engine';
import { OutboundSequence, ProspectEnrollment } from '@/types/outbound-sequence';

export default function EmailSequencesPage() {
  const { user } = useAuth();
  const params = useParams();
  const orgId = params.orgId as string;

  const [sequences, setSequences] = useState<OutboundSequence[]>([]);
  const [enrollments, setEnrollments] = useState<ProspectEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sequences' | 'enrollments'>('sequences');
  const [selectedSequence, setSelectedSequence] = useState<OutboundSequence | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load sequences from Firestore
  useEffect(() => {
    if (!orgId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load sequences
        const seqs = await FirestoreService.getAll<OutboundSequence>(
          `${COLLECTIONS.ORGANIZATIONS}/${orgId}/sequences`,
          []
        );
        setSequences(seqs);

        // Load enrollments
        const enr = await FirestoreService.getAll<ProspectEnrollment>(
          `${COLLECTIONS.ORGANIZATIONS}/${orgId}/sequenceEnrollments`,
          []
        );
        setEnrollments(enr);
      } catch (error) {
        console.error('Error loading sequences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orgId]);

  const handleCreateSequence = async (name: string, description: string) => {
    if (!orgId || !user) return;

    try {
      const sequenceId = `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newSequence: OutboundSequence = {
        id: sequenceId,
        organizationId: orgId,
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
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/sequences`,
        sequenceId,
        newSequence,
        false
      );

      setSequences([...sequences, newSequence]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating sequence:', error);
      alert('Failed to create sequence');
    }
  };

  const handleActivateSequence = async (sequenceId: string) => {
    try {
      await FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/sequences`,
        sequenceId,
        { status: 'active' }
      );

      setSequences(sequences.map(s => 
        s.id === sequenceId ? { ...s, status: 'active' as const } : s
      ));
    } catch (error) {
      console.error('Error activating sequence:', error);
      alert('Failed to activate sequence');
    }
  };

  const handlePauseSequence = async (sequenceId: string) => {
    try {
      await FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/sequences`,
        sequenceId,
        { status: 'paused' }
      );

      setSequences(sequences.map(s => 
        s.id === sequenceId ? { ...s, status: 'paused' as const } : s
      ));
    } catch (error) {
      console.error('Error pausing sequence:', error);
      alert('Failed to pause sequence');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000' }}>
      <AdminBar />

      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/workspace/${orgId}/outbound`} style={{ color: '#6366f1', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none' }}>
              ← Back to Outbound
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                  Email Sequences
                </h1>
                <p style={{ color: '#666', fontSize: '0.875rem' }}>
                  {loading ? 'Loading...' : `${sequences.length} sequences • ${enrollments.filter(e => e.status === 'active').length} active enrollments`}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6366f1',
                  color: '#fff',
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

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #333', marginBottom: '2rem' }}>
            <button
              onClick={() => setActiveTab('sequences')}
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: 'transparent',
                color: activeTab === 'sequences' ? '#6366f1' : '#999',
                border: 'none',
                borderBottom: `3px solid ${activeTab === 'sequences' ? '#6366f1' : 'transparent'}`,
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
                color: activeTab === 'enrollments' ? '#6366f1' : '#999',
                border: 'none',
                borderBottom: `3px solid ${activeTab === 'enrollments' ? '#6366f1' : 'transparent'}`,
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
            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
              <p>Loading sequences...</p>
            </div>
          )}

          {/* Sequences Tab */}
          {!loading && activeTab === 'sequences' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {sequences.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
                  <p style={{ color: '#666', marginBottom: '1.5rem' }}>No sequences yet. Create your first email sequence.</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#6366f1',
                      color: '#fff',
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
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
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
                      backgroundColor: seq.status === 'active' ? '#065f46' : seq.status === 'paused' ? '#78350f' : '#374151',
                      color: seq.status === 'active' ? '#6ee7b7' : seq.status === 'paused' ? '#fbbf24' : '#9ca3af',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                    }}>
                      {seq.status}
                    </div>

                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem', paddingRight: '5rem' }}>
                      {seq.name}
                    </h3>
                    <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                      {seq.description || 'No description'}
                    </p>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Steps</div>
                        <div style={{ fontSize: '1.25rem', color: '#fff', fontWeight: '600' }}>{seq.steps.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Enrolled</div>
                        <div style={{ fontSize: '1.25rem', color: '#fff', fontWeight: '600' }}>{seq.analytics.totalEnrolled}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Reply Rate</div>
                        <div style={{ fontSize: '1.25rem', color: '#fff', fontWeight: '600' }}>
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
                          onClick={() => handleActivateSequence(seq.id)}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            backgroundColor: '#6366f1',
                            color: '#fff',
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
                          onClick={() => handlePauseSequence(seq.id)}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            backgroundColor: '#78350f',
                            color: '#fbbf24',
                            border: '1px solid #fbbf24',
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
                          onClick={() => handleActivateSequence(seq.id)}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            backgroundColor: '#6366f1',
                            color: '#fff',
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
                        onClick={() => setSelectedSequence(seq)}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          backgroundColor: '#222',
                          color: '#fff',
                          border: '1px solid #333',
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
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '1rem', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#111' }}>
                  <tr>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase' }}>
                      Prospect
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase' }}>
                      Sequence
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase' }}>
                      Status
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase' }}>
                      Step
                    </th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#999', textTransform: 'uppercase' }}>
                      Next Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
                        No enrollments yet. Activate a sequence and enroll prospects.
                      </td>
                    </tr>
                  ) : (
                    enrollments.map((enrollment) => {
                      const sequence = sequences.find(s => s.id === enrollment.sequenceId);
                      return (
                        <tr key={enrollment.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                          <td style={{ padding: '1rem', color: '#fff' }}>
                            {enrollment.prospectId}
                          </td>
                          <td style={{ padding: '1rem', color: '#fff' }}>
                            {sequence?.name || 'Unknown'}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: enrollment.status === 'active' ? '#065f46' : '#374151',
                              color: enrollment.status === 'active' ? '#6ee7b7' : '#9ca3af',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                            }}>
                              {enrollment.status}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', color: '#fff' }}>
                            {enrollment.currentStep + 1} / {sequence?.steps.length || 0}
                          </td>
                          <td style={{ padding: '1rem', color: '#666', fontSize: '0.875rem' }}>
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
          onCreate={handleCreateSequence}
        />
      )}
    </div>
  );
}

function CreateSequenceModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, desc: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('Please enter a sequence name');
      return;
    }
    onCreate(name, description);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
      <div style={{ backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333', maxWidth: '40rem', width: '100%' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
            Create Email Sequence
          </h2>
          <button onClick={onClose} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>
            ✕
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
              Sequence Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cold Outreach - Tech Startups"
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this sequence..."
              rows={3}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: '0.75rem', border: '1px solid #333', color: '#999', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              style={{ flex: 1, padding: '0.75rem', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
            >
              Create Sequence
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

