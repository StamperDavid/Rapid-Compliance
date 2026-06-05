/**
 * BACKFILL — populate the `members` subcollection from the canonical `users`
 * roster.
 *
 * The canonical "person" record is the TOP-LEVEL `users/{uid}` collection
 * (written by invite-accept + create-super-admin.js). But the leaderboard,
 * lead-routing auto-assign, and @mention/task notifications read a DIFFERENT
 * store — getSubCollection('members')/{uid} — which historically only got a
 * write at member-add time and NOT on invite-accept. So invited users were
 * invisible to those features.
 *
 * This one-shot script walks every non-agent, non-removed doc in the top-level
 * `users` collection and ensures a matching `members` subcollection doc exists.
 * Idempotent — safe to re-run. Skips members that already exist.
 *
 * Usage:  npx tsx scripts/backfill-team-members.ts
 */

/* eslint-disable no-console */

import { AdminFirestoreService } from '../src/lib/db/admin-firestore-service';
import { getSubCollection } from '../src/lib/firebase/collections';

const MEMBERS = getSubCollection('members');

interface UserDoc {
  id: string;
  email?: string;
  name?: string;
  displayName?: string;
  fullName?: string;
  role?: string;
  status?: string;
  [k: string]: unknown;
}

interface MemberDoc {
  userId: string;
  email: string;
  name: string;
  role: string;
  [k: string]: unknown;
}

function isAgent(user: UserDoc): boolean {
  const email = user.email ?? '';
  return (
    user.id.startsWith('agent_') ||
    email.startsWith('agent_') ||
    email.includes('@ai-agent.')
  );
}

function resolveName(user: UserDoc): string {
  const email = user.email ?? '';
  const emailPrefix = email.includes('@') ? email.split('@')[0] : email;
  return (
    user.name ??
    user.displayName ??
    user.fullName ??
    (emailPrefix !== '' ? emailPrefix : undefined) ??
    'Unknown'
  );
}

async function main(): Promise<void> {
  // Read the TOP-LEVEL `users` collection (not a subcollection).
  const users = await AdminFirestoreService.getAll<UserDoc>('users', []);
  console.log(`Found ${users.length} user doc(s) in top-level "users" collection.`);

  let ensured = 0;
  let skipped = 0;
  let filtered = 0;

  for (const user of users) {
    if (isAgent(user)) {
      filtered++;
      continue;
    }
    if (user.status === 'removed') {
      filtered++;
      continue;
    }

    const existing = await AdminFirestoreService.get<MemberDoc>(MEMBERS, user.id);
    if (existing) {
      console.log(`  = skip ${user.id} (${user.email ?? 'no-email'}) — member already exists`);
      skipped++;
      continue;
    }

    await AdminFirestoreService.set<Record<string, unknown>>(MEMBERS, user.id, {
      userId: user.id,
      email: user.email ?? '',
      name: resolveName(user),
      role: user.role ?? 'member',
      addedAt: new Date().toISOString(),
    });
    console.log(`  + ensured ${user.id} (${user.email ?? 'no-email'}) — ${resolveName(user)} [${user.role ?? 'member'}]`);
    ensured++;
  }

  console.log(
    `\n✓ Done. ${ensured} member(s) ensured, ${skipped} already existed, ${filtered} filtered (agents/removed).`,
  );
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Backfill failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
