/**
 * Audit script: scan every active Golden Master (Jasper + every specialist)
 * for the "rule + competing mention" pattern that destroys training fidelity.
 *
 * Pattern detected:
 *   1. The prompt contains a "NEVER", "FORBIDDEN", "DO NOT", "MUST NOT" rule
 *      about a specific tool, phrase, or pattern (called X)
 *   2. The same prompt mentions X positively elsewhere (in tool catalogs,
 *      "GOOD example" snippets, "use X" instructions)
 *
 * When this pattern exists, the LLM gets mixed signals and ignores the rule.
 * Verified against Jasper v4 (had the pattern; ignored the rule) and v5
 * (pattern cleaned up; rule now followed).
 *
 * This script REPORTS only — never writes to Firestore. Operator reviews the
 * report and decides which GMs need a cleanup script (per the Jasper pattern
 * in scripts/cleanup-jasper-gm-conflicts.ts).
 *
 * Usage:
 *   npx tsx scripts/audit-gm-conflicts.ts                    — full report
 *   npx tsx scripts/audit-gm-conflicts.ts --specialist=BLOG_WRITER  — single specialist
 *   npx tsx scripts/audit-gm-conflicts.ts --json             — machine-readable output
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[key]) { process.env[key] = value; }
      }
    }
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const SPECIALIST_GM_COLLECTION = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
const ORCHESTRATOR_GM_COLLECTION = `organizations/${PLATFORM_ID}/goldenMasters`;

// Forbidden-rule signals: phrases that introduce a "don't do X" rule
const FORBIDDEN_RULE_PATTERNS: RegExp[] = [
  /\bNEVER\s+(?:include|use|call|add|put|reference)\b/i,
  /\bMUST\s+NOT\s+/i,
  /\bDO\s+NOT\s+(?:include|use|call|add|put|reference)\b/i,
  /\bFORBIDDEN\b/i,
  /\bnot\s+belong\s+in\s+a\s+plan\b/i,
  /\bare\s+not\s+(?:allowed|permitted)\b/i,
];

// Positive-mention signals around a tool/phrase candidate
const POSITIVE_MENTION_PATTERNS: RegExp[] = [
  /\bGOOD:\s*\[/i,
  /\bUse\s+when\b/i,
  /→\s+use\b/i,
  /^\s*-\s+(?:Call|Use)\s+/im,
  /\b(?:always|recommended)\s+(?:call|use|include)\b/i,
];

interface AuditFinding {
  ruleSnippet: string;
  ruleLineNumber: number;
  rulePctThroughPrompt: number;
  forbiddenTerm: string;       // the word/phrase the rule forbids
  competingMentions: Array<{
    snippet: string;
    lineNumber: number;
    pctThroughPrompt: number;
    matchedPattern: string;
  }>;
}

interface GMAudit {
  gmId: string;
  gmType: 'orchestrator' | 'specialist';
  specialistId: string;
  version: string | number;
  promptLength: number;
  findingsCount: number;
  findings: AuditFinding[];
  isClean: boolean;
}

/**
 * Extract the candidate "forbidden term" from a rule line. Looks for the noun
 * phrase that follows NEVER/MUST NOT/DO NOT etc. Returns up to 50 chars of the
 * term — used to search the rest of the prompt for competing mentions.
 *
 * Heuristic only — won't catch every case but catches the obvious ones.
 */
function extractForbiddenTerm(ruleLine: string): string | null {
  // Try to grab a snake_case identifier first (most precise)
  const snakeMatch = /\b([a-z][a-z0-9_]{4,})\b/.exec(ruleLine);
  if (snakeMatch !== null) { return snakeMatch[1]; }

  // Otherwise grab the noun-phrase-ish chunk after the rule keyword
  const npMatch = /(?:NEVER|MUST NOT|DO NOT|FORBIDDEN)\s+(?:include|use|call|add|put|reference|do|be)?\s*((?:["'][^"']{3,40}["'])|(?:\w+(?:\s+\w+){0,4}))/i.exec(ruleLine);
  if (npMatch !== null) {
    return npMatch[1].replace(/^["']|["']$/g, '').trim();
  }

  return null;
}

function auditPrompt(prompt: string): AuditFinding[] {
  const lines = prompt.split('\n');
  const findings: AuditFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isRule = FORBIDDEN_RULE_PATTERNS.some((p) => p.test(line));
    if (!isRule) { continue; }

    const ruleStart = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
    const term = extractForbiddenTerm(line);
    if (term === null || term.length < 5) { continue; }

    // Look for the term elsewhere in the prompt (excluding the rule line itself
    // and a small buffer of nearby lines that are likely the rule's own context)
    const competingMentions: AuditFinding['competingMentions'] = [];
    const ruleContextStart = Math.max(0, i - 3);
    const ruleContextEnd = Math.min(lines.length, i + 8);

    for (let j = 0; j < lines.length; j++) {
      if (j >= ruleContextStart && j <= ruleContextEnd) { continue; }
      const otherLine = lines[j];
      if (!otherLine.toLowerCase().includes(term.toLowerCase())) { continue; }
      // Check if this mention is in a positive context
      const matchedPattern = POSITIVE_MENTION_PATTERNS.find((p) => p.test(otherLine));
      if (matchedPattern === undefined) { continue; }
      competingMentions.push({
        snippet: otherLine.slice(0, 200),
        lineNumber: j + 1,
        pctThroughPrompt: Math.round((j / lines.length) * 100),
        matchedPattern: matchedPattern.source,
      });
    }

    if (competingMentions.length > 0) {
      findings.push({
        ruleSnippet: line.slice(0, 200),
        ruleLineNumber: i + 1,
        rulePctThroughPrompt: Math.round((i / lines.length) * 100),
        forbiddenTerm: term,
        competingMentions,
      });
    }

    void ruleStart; // not needed in output but reserved for future precision
  }

  return findings;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const specialistFilter = args.find((a) => a.startsWith('--specialist='))?.split('=')[1];
  const jsonOutput = args.includes('--json');

  const db = admin.firestore();
  const audits: GMAudit[] = [];

  // Orchestrator GM (Jasper)
  if (specialistFilter === undefined || specialistFilter === 'JASPER') {
    const orchSnap = await db.collection(ORCHESTRATOR_GM_COLLECTION)
      .where('agentType', '==', 'orchestrator')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (!orchSnap.empty) {
      const doc = orchSnap.docs[0];
      const data = doc.data();
      const prompt = data.systemPrompt ?? '';
      const findings = auditPrompt(prompt);
      audits.push({
        gmId: doc.id,
        gmType: 'orchestrator',
        specialistId: 'JASPER_ORCHESTRATOR',
        version: data.version ?? data.versionNumber ?? '?',
        promptLength: prompt.length,
        findingsCount: findings.length,
        findings,
        isClean: findings.length === 0,
      });
    }
  }

  // All active specialist GMs
  const specSnap = await db.collection(SPECIALIST_GM_COLLECTION)
    .where('isActive', '==', true)
    .get();
  for (const doc of specSnap.docs) {
    const data = doc.data();
    if (specialistFilter !== undefined && data.specialistId !== specialistFilter) { continue; }
    const prompt = (data.config?.systemPrompt ?? data.systemPromptSnapshot ?? '') as string;
    if (!prompt) { continue; }
    const findings = auditPrompt(prompt);
    audits.push({
      gmId: doc.id,
      gmType: 'specialist',
      specialistId: data.specialistId ?? '?',
      version: data.version ?? '?',
      promptLength: prompt.length,
      findingsCount: findings.length,
      findings,
      isClean: findings.length === 0,
    });
  }

  if (jsonOutput) {
    console.log(JSON.stringify(audits, null, 2));
    process.exit(audits.some((a) => !a.isClean) ? 1 : 0);
  }

  // Human-readable report
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Golden Master Conflict Audit');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log(`Scanned ${audits.length} active GMs (1 orchestrator + ${audits.length - 1} specialists)\n`);

  const cleanCount = audits.filter((a) => a.isClean).length;
  const dirtyCount = audits.length - cleanCount;
  console.log(`Result: ${cleanCount} clean, ${dirtyCount} with potential conflicts\n`);

  if (dirtyCount === 0) {
    console.log('All scanned GMs are free of detectable rule/competing-mention conflicts.');
    process.exit(0);
  }

  console.log('GMs with potential conflicts (sorted by findings count):\n');
  const dirty = audits.filter((a) => !a.isClean).sort((a, b) => b.findingsCount - a.findingsCount);

  for (const audit of dirty) {
    console.log(`──────────────────────────────────────────────────────────────────`);
    console.log(`  ${audit.specialistId}  (${audit.gmType}, ${audit.gmId})`);
    console.log(`  Version: ${audit.version} | Prompt: ${audit.promptLength} chars | Findings: ${audit.findingsCount}`);
    console.log(`──────────────────────────────────────────────────────────────────\n`);

    for (const f of audit.findings) {
      console.log(`  Rule (line ${f.ruleLineNumber}, ${f.rulePctThroughPrompt}% through):`);
      console.log(`    "${f.ruleSnippet.trim()}"`);
      console.log(`  Forbidden term identified: "${f.forbiddenTerm}"`);
      console.log(`  Competing mentions (${f.competingMentions.length}):`);
      for (const cm of f.competingMentions.slice(0, 8)) {
        console.log(`    line ${cm.lineNumber} (${cm.pctThroughPrompt}%): ${cm.snippet.trim()}`);
      }
      if (f.competingMentions.length > 8) {
        console.log(`    ... and ${f.competingMentions.length - 8} more`);
      }
      console.log('');
    }
  }

  console.log(`\n${dirty.length} GM(s) need cleanup. For each one, write a one-time cleanup script in scripts/cleanup-<specialist>-gm-conflicts.ts following the pattern in scripts/cleanup-jasper-gm-conflicts.ts. Then re-run this audit to confirm clean.`);
  process.exit(1);
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
