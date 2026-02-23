'use client';

/**
 * Human Power Dialer Component
 * Kixie-grade power dialer with WebRTC softphone
 * Features: Multi-line dialing, voicemail drop, screen pop, call transfer
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

// Types
interface DialerContact {
  id: string;
  name: string;
  phone: string;
  company?: string;
  email?: string;
  status?: string;
  notes?: string;
  lastContactedAt?: Date;
  crmRecordId?: string;
  crmEntityType?: 'lead' | 'contact' | 'deal';
}

interface ActiveCall {
  id: string;
  contact: DialerContact;
  status: 'dialing' | 'ringing' | 'connected' | 'on-hold' | 'transferring' | 'ended';
  startTime: Date;
  duration: number;
  line: number;
  muted: boolean;
  recording: boolean;
  answeredBy?: 'human' | 'machine' | 'unknown';
}

interface DialerConfig {
  maxConcurrentCalls: number;
  dialDelay: number;
  abandonTimeout: number;
  voicemailDetection: boolean;
  voicemailDropEnabled: boolean;
  localPresence: boolean;
  autoAdvance: boolean;
}

interface PowerDialerProps {
  campaignId?: string;
  contacts?: DialerContact[];
  onCallComplete?: (contact: DialerContact, outcome: string, notes: string) => void;
  onContactChange?: (contact: DialerContact | null) => void;
  className?: string;
}

const DEFAULT_CONFIG: DialerConfig = {
  maxConcurrentCalls: 1,
  dialDelay: 1000,
  abandonTimeout: 30000,
  voicemailDetection: true,
  voicemailDropEnabled: true,
  localPresence: false,
  autoAdvance: true,
};

const CALL_OUTCOMES = [
  { id: 'connected', label: 'Connected', color: 'var(--color-success)' },
  { id: 'voicemail', label: 'Voicemail', color: 'var(--color-warning)' },
  { id: 'no-answer', label: 'No Answer', color: 'var(--color-neutral-500)' },
  { id: 'busy', label: 'Busy', color: 'var(--color-error)' },
  { id: 'wrong-number', label: 'Wrong Number', color: 'var(--color-error-dark)' },
  { id: 'callback', label: 'Callback Requested', color: 'var(--color-info)' },
  { id: 'not-interested', label: 'Not Interested', color: 'var(--color-neutral-400)' },
  { id: 'qualified', label: 'Qualified Lead', color: 'var(--color-success-light)' },
];

export default function HumanPowerDialer({
  campaignId: _campaignId,
  contacts: initialContacts = [],
  onCallComplete,
  onContactChange,
  className,
}: PowerDialerProps) {
  const { user } = useAuth();
  const authFetch = useAuthFetch();

  // State
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [contacts, _setContacts] = useState<DialerContact[]>(initialContacts);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [selectedCall, setSelectedCall] = useState<ActiveCall | null>(null);
  const [config, setConfig] = useState<DialerConfig>(DEFAULT_CONFIG);
  const [callNotes, setCallNotes] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [voicemailDrops, setVoicemailDrops] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const [selectedVoicemail, setSelectedVoicemail] = useState<string>('');
  const [stats, setStats] = useState({
    totalCalls: 0,
    connected: 0,
    voicemails: 0,
    noAnswer: 0,
    totalTalkTime: 0,
  });

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadVoicemailDrops = useCallback(async () => {
    try {
      const response = await authFetch('/api/voice/voicemail-drops');
      if (response.ok) {
        const data = await response.json() as { drops?: Array<{ id: string; name: string; url: string }> };
        setVoicemailDrops(data.drops ?? []);
      }
    } catch (error) {
      logger.error('Failed to load voicemail drops:', error instanceof Error ? error : new Error(String(error)), { file: 'HumanPowerDialer.tsx' });
    }
  }, [authFetch]);

  const dialNext = useCallback(async () => {
    if (isPaused || currentIndex >= contacts.length) {
      return;
    }
    if (activeCalls.length >= config.maxConcurrentCalls) {
      return;
    }

    const contact = contacts[currentIndex];
    setCurrentIndex(prev => prev + 1);

    try {
      const response = await authFetch('/api/voice/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: contact.phone,
          userId: user?.id,
          contactId: contact.id,
          localPresence: config.localPresence,
          machineDetection: config.voicemailDetection,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate call');
      }

      const data = await response.json() as { callId: string };

      const newCall: ActiveCall = {
        id: data.callId,
        contact,
        status: 'dialing',
        startTime: new Date(),
        duration: 0,
        line: activeCalls.length + 1,
        muted: false,
        recording: false,
      };

      setActiveCalls(prev => [...prev, newCall]);
      setSelectedCall(newCall);
      setStats(prev => ({ ...prev, totalCalls: prev.totalCalls + 1 }));

      // Set up timeout for abandoned calls
      setTimeout(() => {
        setActiveCalls(prev =>
          prev.map(call =>
            call.id === newCall.id && call.status === 'dialing'
              ? { ...call, status: 'ended' }
              : call
          )
        );
      }, config.abandonTimeout);
    } catch (error) {
      logger.error('Dial error:', error instanceof Error ? error : new Error(String(error)), { file: 'HumanPowerDialer.tsx' });
    }
  }, [isPaused, currentIndex, contacts, activeCalls.length, config.maxConcurrentCalls, config.localPresence, config.voicemailDetection, config.abandonTimeout, user?.id, authFetch]);

  // Load voicemail drops
  useEffect(() => {
    void loadVoicemailDrops();
  }, [loadVoicemailDrops]);

  // Timer for call duration
  useEffect(() => {
    if (activeCalls.some(c => c.status === 'connected')) {
      timerRef.current = setInterval(() => {
        setActiveCalls(prev =>
          prev.map(call =>
            call.status === 'connected'
              ? { ...call, duration: Math.floor((Date.now() - call.startTime.getTime()) / 1000) }
              : call
          )
        );
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [activeCalls]);

  // Notify parent of contact changes
  useEffect(() => {
    const currentContact = contacts[currentIndex] ?? null;
    onContactChange?.(currentContact);
  }, [currentIndex, contacts, onContactChange]);

  const startDialer = useCallback(async () => {
    if (contacts.length === 0) {
      logger.warn('No contacts to dial. Please load a contact list first.');
      return;
    }

    setIsActive(true);
    setIsPaused(false);
    await dialNext();
  }, [contacts.length, dialNext]);

  const endCall = useCallback(async (callId: string) => {
    try {
      await authFetch(`/api/voice/calls/${callId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const call = activeCalls.find(c => c.id === callId);
      if (call) {
        setStats(prev => ({
          ...prev,
          totalTalkTime: prev.totalTalkTime + call.duration,
        }));
      }

      setActiveCalls(prev => prev.filter(c => c.id !== callId));

      if (selectedCall?.id === callId) {
        setSelectedCall(null);
      }

      // Auto-advance to next contact if enabled
      if (config.autoAdvance && isActive && !isPaused) {
        setTimeout(() => {
          void dialNext();
        }, config.dialDelay);
      }
    } catch (error) {
      logger.error('End call error:', error instanceof Error ? error : new Error(String(error)), { file: 'HumanPowerDialer.tsx' });
    }
  }, [activeCalls, selectedCall?.id, config.autoAdvance, config.dialDelay, isActive, isPaused, dialNext, authFetch]);

  const stopDialer = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);

    // End all active calls
    activeCalls.forEach(call => {
      void endCall(call.id);
    });
  }, [activeCalls, endCall]);

  const pauseDialer = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeDialer = useCallback(async () => {
    setIsPaused(false);
    if (activeCalls.length < config.maxConcurrentCalls) {
      await dialNext();
    }
  }, [activeCalls.length, config.maxConcurrentCalls, dialNext]);

  const _answerCall = async (_callId: string) => {
    try {
      await authFetch(`/api/voice/calls/${_callId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      setActiveCalls(prev =>
        prev.map(call =>
          call.id === _callId
            ? { ...call, status: 'connected' }
            : call
        )
      );
    } catch (error) {
      logger.error('Answer error:', error instanceof Error ? error : new Error(String(error)), { file: 'HumanPowerDialer.tsx' });
    }
  };

  const holdCall = async (callId: string, hold: boolean) => {
    try {
      await authFetch(`/api/voice/calls/${callId}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hold }),
      });

      setActiveCalls(prev =>
        prev.map(call =>
          call.id === callId
            ? { ...call, status: hold ? 'on-hold' : 'connected' }
            : call
        )
      );
    } catch (error) {
      logger.error('Hold error:', error instanceof Error ? error : new Error(String(error)), { file: 'HumanPowerDialer.tsx' });
    }
  };

  const muteCall = async (callId: string, muted: boolean) => {
    try {
      await authFetch(`/api/voice/calls/${callId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted }),
      });

      setActiveCalls(prev =>
        prev.map(call =>
          call.id === callId ? { ...call, muted } : call
        )
      );
    } catch (error) {
      logger.error('Mute error:', error instanceof Error ? error : new Error(String(error)), { file: 'HumanPowerDialer.tsx' });
    }
  };

  const transferCall = async (callId: string) => {
    if (!transferTarget) {
      logger.warn('Please enter a transfer target');
      return;
    }

    try {
      await authFetch(`/api/voice/calls/${callId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: transferTarget,
        }),
      });

      setActiveCalls(prev =>
        prev.map(call =>
          call.id === callId ? { ...call, status: 'transferring' } : call
        )
      );

      setShowTransfer(false);
      setTransferTarget('');
    } catch (error) {
      logger.error('Transfer error:', error instanceof Error ? error : new Error(String(error)), { file: 'HumanPowerDialer.tsx' });
    }
  };

  const dropVoicemail = async (callId: string) => {
    if (!selectedVoicemail) {
      logger.warn('Please select a voicemail to drop');
      return;
    }

    try {
      await authFetch(`/api/voice/calls/${callId}/voicemail-drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voicemailId: selectedVoicemail,
        }),
      });

      setStats(prev => ({ ...prev, voicemails: prev.voicemails + 1 }));
      await endCall(callId);
    } catch (error) {
      logger.error('Voicemail drop error:', error instanceof Error ? error : new Error(String(error)), { file: 'HumanPowerDialer.tsx' });
    }
  };

  const saveDisposition = async () => {
    if (!selectedCall || !selectedOutcome) {
      logger.warn('Please select a call outcome');
      return;
    }

    try {
      await authFetch('/api/voice/disposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: selectedCall.id,
          contactId: selectedCall.contact.id,
          outcome: selectedOutcome,
          notes: callNotes,
          duration: selectedCall.duration,
          userId: user?.id,
        }),
      });

      // Update stats based on outcome
      if (selectedOutcome === 'connected' || selectedOutcome === 'qualified') {
        setStats(prev => ({ ...prev, connected: prev.connected + 1 }));
      } else if (selectedOutcome === 'voicemail') {
        setStats(prev => ({ ...prev, voicemails: prev.voicemails + 1 }));
      } else if (selectedOutcome === 'no-answer') {
        setStats(prev => ({ ...prev, noAnswer: prev.noAnswer + 1 }));
      }

      onCallComplete?.(selectedCall.contact, selectedOutcome, callNotes);

      // Clear disposition form
      setCallNotes('');
      setSelectedOutcome('');

      await endCall(selectedCall.id);
    } catch (error) {
      logger.error('Save disposition error:', error instanceof Error ? error : new Error(String(error)), { file: 'HumanPowerDialer.tsx' });
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: ActiveCall['status']): string => {
    const colors: Record<ActiveCall['status'], string> = {
      dialing: 'var(--color-warning)',
      ringing: 'var(--color-info)',
      connected: 'var(--color-success)',
      'on-hold': 'var(--color-neutral-500)',
      transferring: 'var(--color-secondary)',
      ended: 'var(--color-neutral-400)',
    };
    return colors[status];
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--color-bg-paper)', borderRadius: '1rem', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--color-neutral-900)', borderBottom: '1px solid var(--color-border-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>
            Power Dialer
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isActive ? (
              <>
                {isPaused ? (
                  <button
                    onClick={() => {
                      void resumeDialer();
                    }}
                    style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-success)', color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      pauseDialer();
                    }}
                    style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-warning)', color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                  >
                    Pause
                  </button>
                )}
                <button
                  onClick={() => {
                    stopDialer();
                  }}
                  style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-error)', color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
                >
                  Stop
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  void startDialer();
                }}
                style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-primary)', color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
              >
                Start Dialing
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{ padding: '0.5rem', backgroundColor: 'var(--color-border-main)', border: '1px solid var(--color-border-light)', borderRadius: '0.375rem', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
        >
          Settings
        </button>
      </div>

      {/* Stats Bar */}
      <div style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-neutral-900)', borderBottom: '1px solid var(--color-border-main)', display: 'flex', gap: '2rem' }}>
        <div>
          <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>Total Calls</span>
          <div style={{ color: 'var(--color-text-primary)', fontWeight: '600' }}>{stats.totalCalls}</div>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>Connected</span>
          <div style={{ color: 'var(--color-success)', fontWeight: '600' }}>{stats.connected}</div>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>Voicemails</span>
          <div style={{ color: 'var(--color-warning)', fontWeight: '600' }}>{stats.voicemails}</div>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>No Answer</span>
          <div style={{ color: 'var(--color-neutral-500)', fontWeight: '600' }}>{stats.noAnswer}</div>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>Talk Time</span>
          <div style={{ color: 'var(--color-text-primary)', fontWeight: '600' }}>{formatDuration(stats.totalTalkTime)}</div>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>Remaining</span>
          <div style={{ color: 'var(--color-info)', fontWeight: '600' }}>{contacts.length - currentIndex}</div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Call Lines */}
        <div style={{ width: '280px', borderRight: '1px solid var(--color-border-main)', overflowY: 'auto' }}>
          <div style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Active Lines ({activeCalls.length}/{config.maxConcurrentCalls})
            </h3>

            {activeCalls.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
                No active calls
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {activeCalls.map(call => (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: selectedCall?.id === call.id ? 'var(--color-bg-elevated)' : 'transparent',
                      border: `1px solid ${selectedCall?.id === call.id ? 'var(--color-border-light)' : 'transparent'}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '600', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                        Line {call.line}
                      </span>
                      <span style={{
                        padding: '0.125rem 0.375rem',
                        backgroundColor: getStatusColor(call.status),
                        color: 'var(--color-text-primary)',
                        borderRadius: '0.25rem',
                        fontSize: '0.625rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                      }}>
                        {call.status}
                      </span>
                    </div>
                    <div style={{ color: 'var(--color-neutral-300)', fontSize: '0.875rem' }}>{call.contact.name}</div>
                    <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>{call.contact.phone}</div>
                    {call.status === 'connected' && (
                      <div style={{ color: 'var(--color-success)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        {formatDuration(call.duration)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Screen Pop / Call Details */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedCall ? (
            <>
              {/* Contact Info */}
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-main)' }}>
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>
                      {selectedCall.contact.name}
                    </h2>
                    <p style={{ color: 'var(--color-text-secondary)', margin: '0.25rem 0' }}>{selectedCall.contact.company}</p>
                    <p style={{ color: 'var(--color-primary)', margin: 0 }}>{selectedCall.contact.phone}</p>
                  </div>

                  {/* Call Controls */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(selectedCall.status === 'connected' || selectedCall.status === 'on-hold') && (
                      <>
                        <button
                          onClick={() => {
                            void muteCall(selectedCall.id, !selectedCall.muted);
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: selectedCall.muted ? 'var(--color-error)' : 'var(--color-border-main)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          {selectedCall.muted ? 'Unmute' : 'Mute'}
                        </button>
                        <button
                          onClick={() => {
                            void holdCall(selectedCall.id, selectedCall.status !== 'on-hold');
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: selectedCall.status === 'on-hold' ? 'var(--color-warning)' : 'var(--color-border-main)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          {selectedCall.status === 'on-hold' ? 'Resume' : 'Hold'}
                        </button>
                        <button
                          onClick={() => setShowTransfer(true)}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: 'var(--color-border-main)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          Transfer
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        void endCall(selectedCall.id);
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--color-error)',
                        color: 'var(--color-text-primary)',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                      }}
                    >
                      End Call
                    </button>
                  </div>
                </div>

                {/* Voicemail Drop */}
                {selectedCall.answeredBy === 'machine' && config.voicemailDropEnabled && (
                  <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--color-bg-elevated)', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-warning)', marginBottom: '0.5rem' }}>
                      Voicemail Detected
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        value={selectedVoicemail}
                        onChange={e => setSelectedVoicemail(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          backgroundColor: 'var(--color-bg-paper)',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '0.375rem',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        <option value="">Select voicemail to drop...</option>
                        {voicemailDrops.map(vm => (
                          <option key={vm.id} value={vm.id}>{vm.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          void dropVoicemail(selectedCall.id);
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: 'var(--color-warning)',
                          color: 'var(--color-text-primary)',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                        }}
                      >
                        Drop VM
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes & Disposition */}
              <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Call Notes
                  </label>
                  <textarea
                    value={callNotes}
                    onChange={e => setCallNotes(e.target.value)}
                    placeholder="Enter notes about this call..."
                    style={{
                      width: '100%',
                      minHeight: '120px',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '0.5rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Call Outcome
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {CALL_OUTCOMES.map(outcome => (
                      <button
                        key={outcome.id}
                        onClick={() => setSelectedOutcome(outcome.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: selectedOutcome === outcome.id ? outcome.color : 'var(--color-bg-elevated)',
                          color: 'var(--color-text-primary)',
                          border: `1px solid ${selectedOutcome === outcome.id ? outcome.color : 'var(--color-border-light)'}`,
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        {outcome.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <button
                    onClick={() => {
                      void saveDisposition();
                    }}
                    disabled={!selectedOutcome}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: selectedOutcome ? 'var(--color-primary)' : 'var(--color-border-light)',
                      color: 'var(--color-text-primary)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: selectedOutcome ? 'pointer' : 'not-allowed',
                      fontSize: '1rem',
                      fontWeight: '600',
                    }}
                  >
                    Save & End Call
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-disabled)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>No active call selected</div>
                <p>{isActive ? 'Waiting for next call...' : 'Click "Start Dialing" to begin'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransfer && selectedCall && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '1rem',
            padding: '1.5rem',
            width: '400px',
            maxWidth: '90vw',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
              Transfer Call
            </h3>
            <input
              type="tel"
              value={transferTarget}
              onChange={e => setTransferTarget(e.target.value)}
              placeholder="Enter phone number or extension..."
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--color-bg-main)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.5rem',
                color: 'var(--color-text-primary)',
                fontSize: '1rem',
                marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowTransfer(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-border-main)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void transferCall(selectedCall.id);
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-primary)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '1rem',
            padding: '1.5rem',
            width: '500px',
            maxWidth: '90vw',
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
              Dialer Settings
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  Max Concurrent Lines (1-3)
                </label>
                <input
                  type="number"
                  min="1"
                  max="3"
                  value={config.maxConcurrentCalls}
                  onChange={e => setConfig({ ...config, maxConcurrentCalls: parseInt(e.target.value) || 1 })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: 'var(--color-bg-paper)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '0.375rem',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={config.voicemailDetection}
                  onChange={e => setConfig({ ...config, voicemailDetection: e.target.checked })}
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
                <label style={{ color: 'var(--color-neutral-300)', fontSize: '0.875rem' }}>
                  Enable voicemail detection
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={config.voicemailDropEnabled}
                  onChange={e => setConfig({ ...config, voicemailDropEnabled: e.target.checked })}
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
                <label style={{ color: 'var(--color-neutral-300)', fontSize: '0.875rem' }}>
                  Enable voicemail drops
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={config.localPresence}
                  onChange={e => setConfig({ ...config, localPresence: e.target.checked })}
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
                <label style={{ color: 'var(--color-neutral-300)', fontSize: '0.875rem' }}>
                  Local presence (use local area codes)
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={config.autoAdvance}
                  onChange={e => setConfig({ ...config, autoAdvance: e.target.checked })}
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
                <label style={{ color: 'var(--color-neutral-300)', fontSize: '0.875rem' }}>
                  Auto-advance to next contact
                </label>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-primary)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden audio element for ringtone/hold music */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
