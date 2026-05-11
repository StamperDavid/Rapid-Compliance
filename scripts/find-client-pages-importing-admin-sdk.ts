/**
 * Walk every `'use client'` page/component and check whether its
 * transitive import graph reaches `admin-firestore-service.ts`. Each
 * such page needs to be converted to call an API route instead of
 * importing the lib service directly — otherwise the build fails the
 * `server-only` guard.
 *
 * Output: per-page report listing the import chain.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', 'src');
const ADMIN_FILE = path.normalize(path.join(SRC, 'lib', 'db', 'admin-firestore-service.ts'));

const importCache = new Map<string, string[]>();

function resolveImportPath(specifier: string, fromFile: string): string | null {
  let resolved: string;
  if (specifier.startsWith('@/')) {
    resolved = path.join(SRC, specifier.slice(2));
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    resolved = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null; // External package
  }

  // Try common file extensions and index files
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    path.join(resolved, 'index.ts'),
    path.join(resolved, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return path.normalize(c);
    }
  }
  return null;
}

/** Returns a list of resolved file paths this file imports (static + dynamic). */
function getImports(filePath: string): string[] {
  if (importCache.has(filePath)) {
    return importCache.get(filePath)!;
  }
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    importCache.set(filePath, []);
    return [];
  }

  const out: string[] = [];
  // Strip multi-line / single-line comments first so commented-out imports don't count.
  const cleaned = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  // Static value imports — explicitly skip `import type { … }` since TS strips those.
  const staticRe = /^\s*import\s+(?!type\b)(?:[^'"`;]+\s+from\s+)?['"`]([^'"`]+)['"`]/gm;
  // Lazy: await import('X') / import('X').then(
  const lazyRe = /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = staticRe.exec(cleaned)) !== null) {
    const resolved = resolveImportPath(m[1], filePath);
    if (resolved) {out.push(resolved);}
  }
  while ((m = lazyRe.exec(cleaned)) !== null) {
    const resolved = resolveImportPath(m[1], filePath);
    if (resolved) {out.push(resolved);}
  }
  importCache.set(filePath, out);
  return out;
}

/** DFS until we hit ADMIN_FILE; return the import chain if reached. */
function chainToAdmin(start: string, visited: Set<string> = new Set(), chain: string[] = []): string[] | null {
  if (visited.has(start)) {return null;}
  visited.add(start);
  if (start === ADMIN_FILE) {return [...chain, start];}

  for (const imp of getImports(start)) {
    const result = chainToAdmin(imp, visited, [...chain, start]);
    if (result) {return result;}
  }
  return null;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && (full.endsWith('.tsx') || full.endsWith('.ts'))) {
      out.push(full);
    }
  }
  return out;
}

const allClientPages = walk(SRC).filter((f) => {
  try {
    const head = fs.readFileSync(f, 'utf-8').slice(0, 500);
    return /^['"]use client['"]/m.test(head);
  } catch {
    return false;
  }
});

console.log(`Scanning ${allClientPages.length} 'use client' files for transitive admin SDK imports…\n`);

const offenders: { file: string; chain: string[] }[] = [];
for (const page of allClientPages) {
  const chain = chainToAdmin(page);
  if (chain) {
    offenders.push({ file: page, chain });
  }
}

if (offenders.length === 0) {
  console.log('✓ No client pages reach admin-firestore-service. Build should pass.');
} else {
  console.log(`✗ ${offenders.length} client page(s) transitively import admin-firestore-service:\n`);
  for (const { file, chain } of offenders) {
    console.log(`  ${path.relative(path.join(SRC, '..'), file)}`);
    if (chain.length > 1) {
      console.log(`    chain: ${chain.map((c) => path.relative(SRC, c)).join(' → ')}`);
    }
    console.log('');
  }
}
