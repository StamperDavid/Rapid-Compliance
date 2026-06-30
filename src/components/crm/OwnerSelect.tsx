'use client';

import { useEffect, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

/**
 * A team member that can own a CRM record. Mirrors the shape returned by
 * GET /api/team/members.
 */
interface TeamMember {
  readonly uid: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
}

interface TeamMembersResponse {
  readonly success?: boolean;
  readonly members?: TeamMember[];
}

interface OwnerSelectProps {
  /** Current ownerId. Empty string or undefined means "Unassigned". */
  readonly value: string | undefined;
  /** Called with the chosen ownerId (empty string when set to Unassigned). */
  readonly onChange: (ownerId: string) => void;
  /** Visible field label. Defaults to "Owner". */
  readonly label?: string;
  /** DOM id for the underlying select (and its label). */
  readonly id?: string;
}

const SELECT_CLASS =
  'w-full px-4 py-2 bg-surface-elevated text-foreground border border-border-light rounded-lg text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60';

/**
 * OwnerSelect — a labeled dropdown for assigning the owner of a CRM record
 * (contact, company, or lead). Fetches the assignable team roster from
 * /api/team/members and renders an "Unassigned" option plus one entry per
 * teammate (name + email). Written in plain English with clear loading and
 * empty states so non-technical users always know what is happening.
 */
export function OwnerSelect({
  value,
  onChange,
  label = 'Owner',
  id = 'owner-select',
}: OwnerSelectProps): React.JSX.Element {
  const authFetch = useAuthFetch();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const loadMembers = async (): Promise<void> => {
      try {
        const res = await authFetch('/api/team/members');
        const json = (await res.json()) as TeamMembersResponse;
        if (!active) {
          return;
        }
        if (res.ok && json.success && Array.isArray(json.members)) {
          setMembers(json.members);
        } else {
          setLoadFailed(true);
        }
      } catch (error: unknown) {
        if (!active) {
          return;
        }
        setLoadFailed(true);
        logger.error(
          'Error loading team members for OwnerSelect:',
          error instanceof Error ? error : new Error(String(error)),
          { file: 'OwnerSelect.tsx' },
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadMembers();
    return () => {
      active = false;
    };
  }, [authFetch]);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-2">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        disabled={loading}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
      >
        {loading ? (
          <option value={value ?? ''}>Loading team members…</option>
        ) : (
          <>
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.uid} value={member.uid}>
                {member.email !== '' ? `${member.name} (${member.email})` : member.name}
              </option>
            ))}
          </>
        )}
      </select>
      {!loading && loadFailed && (
        <p className="mt-1 text-sm text-muted-foreground">
          We couldn&apos;t load your team list right now. You can still save other changes.
        </p>
      )}
      {!loading && !loadFailed && members.length === 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          No team members found yet — this record will stay unassigned.
        </p>
      )}
    </div>
  );
}
