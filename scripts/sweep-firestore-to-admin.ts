/**
 * Bulk-sweep src/lib server-side files from FirestoreService → AdminFirestoreService.
 *
 * One-shot script. Run with `npx tsx scripts/sweep-firestore-to-admin.ts`.
 * Reports per-file diffs to stdout.
 *
 * EXCLUDED (intentionally on client SDK):
 *   - chat-session-service.ts — consumed by /conversations/page.tsx (browser)
 *   - api-key-service.ts — onSnapshot real-time listener
 *   - orchestration/SignalCoordinator.ts — onSnapshot real-time listener
 *   - db/firestore-service.ts — the source file
 *   - db/admin-firestore-service.ts — the source file
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', 'src', 'lib');

const EXCLUDED = new Set([
  path.join(ROOT, 'agent', 'chat-session-service.ts'),
  path.join(ROOT, 'api-keys', 'api-key-service.ts'),
  path.join(ROOT, 'orchestration', 'SignalCoordinator.ts'),
  path.join(ROOT, 'db', 'firestore-service.ts'),
  path.join(ROOT, 'db', 'admin-firestore-service.ts'),
]);

interface Replacement {
  pattern: RegExp;
  replacement: string;
  description: string;
}

const REPLACEMENTS: Replacement[] = [
  // Combined static imports must come BEFORE bare ones so we extract COLLECTIONS first.
  {
    pattern: /import \{ FirestoreService, COLLECTIONS \} from '@\/lib\/db\/firestore-service';?/g,
    replacement: `import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';\nimport { COLLECTIONS } from '@/lib/db/firestore-service';`,
    description: 'static import with COLLECTIONS',
  },
  {
    pattern: /import \{ FirestoreService \} from '@\/lib\/db\/firestore-service';?/g,
    replacement: `import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';`,
    description: 'static FirestoreService import',
  },
  // Combined lazy destructure: extract COLLECTIONS into its own import, swap FirestoreService.
  {
    pattern: /const \{ FirestoreService, COLLECTIONS \} = await import\('@\/lib\/db\/firestore-service'\);/g,
    replacement: `const { COLLECTIONS } = await import('@/lib/db/firestore-service');\n    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');`,
    description: 'lazy destructure with COLLECTIONS',
  },
  {
    pattern: /const \{ FirestoreService \} = await import\('@\/lib\/db\/firestore-service'\);/g,
    replacement: `const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');`,
    description: 'lazy destructure',
  },
  // Fire-and-forget pattern: void import(...).then(({ FirestoreService }) => ...)
  {
    pattern: /import\('@\/lib\/db\/firestore-service'\)\.then\(\(\{ FirestoreService \}\)/g,
    replacement: `import('@/lib/db/admin-firestore-service').then(({ AdminFirestoreService })`,
    description: 'lazy .then() import',
  },
  // Method calls — longest prefixes first so generics keep their `<`.
  {
    pattern: /\bFirestoreService\.getAllPaginated</g,
    replacement: 'AdminFirestoreService.getAllPaginated<',
    description: 'getAllPaginated<T>',
  },
  {
    pattern: /\bFirestoreService\.getAllPaginated\(/g,
    replacement: 'AdminFirestoreService.getAllPaginated(',
    description: 'getAllPaginated(',
  },
  {
    pattern: /\bFirestoreService\.getAll</g,
    replacement: 'AdminFirestoreService.getAll<',
    description: 'getAll<T>',
  },
  {
    pattern: /\bFirestoreService\.getAll\(/g,
    replacement: 'AdminFirestoreService.getAll(',
    description: 'getAll(',
  },
  {
    pattern: /\bFirestoreService\.get</g,
    replacement: 'AdminFirestoreService.get<',
    description: 'get<T>',
  },
  {
    pattern: /\bFirestoreService\.get\(/g,
    replacement: 'AdminFirestoreService.get(',
    description: 'get(',
  },
  {
    pattern: /\bFirestoreService\.set\(/g,
    replacement: 'AdminFirestoreService.setLikeClient(',
    description: 'set( → setLikeClient(',
  },
  {
    pattern: /\bFirestoreService\.update\(/g,
    replacement: 'AdminFirestoreService.updateLikeClient(',
    description: 'update( → updateLikeClient(',
  },
  {
    pattern: /\bFirestoreService\.delete\(/g,
    replacement: 'AdminFirestoreService.delete(',
    description: 'delete(',
  },
  {
    pattern: /\bFirestoreService\.batchWrite\(/g,
    replacement: 'AdminFirestoreService.batchWrite(',
    description: 'batchWrite(',
  },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && full.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const allFiles = walk(ROOT).filter((f) => !EXCLUDED.has(f));

let touched = 0;
let totalChanges = 0;

for (const file of allFiles) {
  const original = fs.readFileSync(file, 'utf-8');
  if (!original.includes('FirestoreService')) {
    continue;
  }

  let updated = original;
  const fileChanges: string[] = [];

  for (const { pattern, replacement, description } of REPLACEMENTS) {
    const before = updated;
    updated = updated.replace(pattern, replacement);
    if (before !== updated) {
      const count = (before.match(pattern) ?? []).length;
      fileChanges.push(`  ${count}× ${description}`);
      totalChanges += count;
    }
  }

  if (updated !== original) {
    fs.writeFileSync(file, updated, 'utf-8');
    touched += 1;
    console.log(`✓ ${path.relative(path.join(__dirname, '..'), file)}`);
    fileChanges.forEach((c) => console.log(c));
  }
}

console.log(`\nDone. ${touched} files touched, ${totalChanges} replacements.`);
