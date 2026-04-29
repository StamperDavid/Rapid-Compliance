/**
 * Auto-generate src/lib/agents/agent-registry.ts from the filesystem.
 *
 * Source of truth: every `manager.ts` and `specialist.ts` file under
 * `src/lib/agents/`. Each file's exported `CONFIG.identity` block is parsed
 * to produce one AGENT_REGISTRY entry. STANDALONE agents (Jasper, Voice
 * Agent, etc.) are kept as a curated tail because they don't follow the
 * convention of one-file-per-agent under a known directory.
 *
 * Why this script exists: the manual array drifted from reality (52 in
 * registry vs 56 specialist + 10 manager files on disk = 14 silent gaps).
 * Going forward this script is the only thing that writes the registry.
 *
 * Usage:
 *   npx tsx scripts/generate-agent-registry.ts          # write
 *   npx tsx scripts/generate-agent-registry.ts --check  # exit 1 on diff
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(process.cwd(), 'src/lib/agents');
const OUTPUT = path.resolve(process.cwd(), 'src/lib/agents/agent-registry.ts');
const CHECK_MODE = process.argv.includes('--check');

// ─── Types matching agent-registry.ts ────────────────────────────────────────

type AgentTier = 'L1' | 'L2' | 'L3' | 'STANDALONE';

interface AgentEntry {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  parentId: string | null;
  capabilities: string[];
  /** Source file path, for the auto-gen comment. */
  source: string;
  /** Friendly department label for the section header. */
  department: string;
}

// ─── Walk the filesystem ─────────────────────────────────────────────────────

function walkAgentFiles(dir: string, out: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAgentFiles(full, out);
      continue;
    }
    if (entry.name === 'manager.ts' || entry.name === 'specialist.ts') {
      out.push(full);
    }
  }
}

// ─── Identity block extraction ───────────────────────────────────────────────

interface ParsedIdentity {
  id: string;
  name: string;
  reportsTo: string | null;
  capabilities: string[];
}

/**
 * Parse the `identity: { ... }` block out of a CONFIG-style declaration.
 * Tolerates `id: SPECIALIST_ID` references by resolving the matching
 * `const SPECIALIST_ID = 'XXX'` line earlier in the file.
 *
 * Some manager files inline multiple specialist `identity: {` configs
 * before declaring their own. We pick the one whose role matches the
 * file kind (manager.ts → role:'manager', specialist.ts → role:'specialist').
 */
function parseIdentity(filePath: string): ParsedIdentity | null {
  const source = fs.readFileSync(filePath, 'utf-8');
  const isManagerFile = path.basename(filePath) === 'manager.ts';
  const targetRole = isManagerFile ? 'manager' : 'specialist';

  // Walk the file and collect every `identity: { ... }` block.
  const blocks: string[] = [];
  let scanFrom = 0;
  while (true) {
    const startIdx = source.indexOf('identity: {', scanFrom);
    if (startIdx === -1) { break; }
    let depth = 0;
    let i = source.indexOf('{', startIdx);
    const blockStart = i;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === '{') { depth++; }
      else if (ch === '}') {
        depth--;
        if (depth === 0) { break; }
      }
    }
    if (depth !== 0) { break; }
    blocks.push(source.slice(blockStart + 1, i));
    scanFrom = i + 1;
  }
  if (blocks.length === 0) { return null; }

  // Pick the block whose role matches the file kind. Fall back to the
  // first block if none match (shouldn't happen with current conventions).
  const block =
    blocks.find((b) => new RegExp(`role:\\s*['\"]${targetRole}['\"]`).test(b)) ?? blocks[0];

  // id — accept literal 'XXX' or a SPECIALIST_ID/MANAGER_ID reference.
  let id = '';
  const idLiteralMatch = /\bid:\s*['"]([A-Z0-9_]+)['"]/.exec(block);
  if (idLiteralMatch) {
    id = idLiteralMatch[1];
  } else {
    const idRefMatch = /\bid:\s*([A-Z_]+)\b/.exec(block);
    if (idRefMatch) {
      const constName = idRefMatch[1];
      const constMatch = new RegExp(`const\\s+${constName}\\s*=\\s*['"]([A-Z0-9_]+)['"]`).exec(source);
      if (constMatch) { id = constMatch[1]; }
    }
  }
  if (!id) { return null; }

  // name
  const nameMatch = /\bname:\s*['"]([^'"]+)['"]/.exec(block);
  if (!nameMatch) { return null; }
  const name = nameMatch[1];

  // reportsTo — string literal or null
  let reportsTo: string | null = null;
  const reportsToMatch = /\breportsTo:\s*(?:['"]([A-Z0-9_]+)['"]|null)/.exec(block);
  if (reportsToMatch && reportsToMatch[1]) {
    reportsTo = reportsToMatch[1];
  }

  // capabilities — array of string literals
  const capsMatch = /\bcapabilities:\s*\[([\s\S]*?)\]/.exec(block);
  const capabilities: string[] = [];
  if (capsMatch) {
    const capsText = capsMatch[1];
    const re = /['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(capsText)) !== null) {
      capabilities.push(m[1]);
    }
  }

  return { id, name, reportsTo, capabilities };
}

// ─── Tier inference ──────────────────────────────────────────────────────────

function inferTier(filePath: string): AgentTier {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (rel === 'orchestrator/manager.ts') { return 'L1'; }
  if (rel.endsWith('/manager.ts')) { return 'L2'; }
  return 'L3';
}

function inferDepartment(filePath: string, tier: AgentTier): string {
  if (tier === 'L1') { return 'L1 - MASTER ORCHESTRATOR'; }
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  // For L2: dept = first segment (e.g. 'marketing'). For L3: same logic, but
  // some specialists live nested deeper (architect/copy/specialist.ts → architect).
  const dept = parts[0];
  if (tier === 'L2') { return `L2 - ${dept.toUpperCase()} MANAGER`; }
  return `L3 - ${dept.toUpperCase()} SPECIALISTS`;
}

// ─── STANDALONE — curated tail ───────────────────────────────────────────────

// Curated tail. AI_CHAT_SALES_AGENT is intentionally excluded because it's
// already represented by src/lib/agents/sales-chat/specialist.ts at L3.
// GROWTH_STRATEGIST is excluded because it has its own specialist file at
// src/lib/agents/growth-strategist/specialist.ts (L3 standalone-style).
const STANDALONE_AGENTS: AgentEntry[] = [
  {
    id: 'JASPER',
    name: 'Jasper',
    role: 'Internal AI Assistant & Swarm Commander',
    tier: 'STANDALONE',
    parentId: null,
    capabilities: ['Swarm Command', 'Executive Briefings', 'System Orchestration', 'Employee Management', 'Strategic Guidance'],
    source: 'src/lib/agents/orchestrator/jasper-handler.ts',
    department: 'STANDALONE',
  },
  {
    id: 'VOICE_AGENT_HANDLER',
    name: 'Voice Agent',
    role: 'Voice AI Agent',
    tier: 'STANDALONE',
    parentId: null,
    capabilities: ['AI Phone Conversations', 'Lead Qualification (Voice)', 'Deal Closing (Voice)', 'Warm Transfer'],
    source: 'src/lib/voice/voice-agent-handler.ts',
    department: 'STANDALONE',
  },
  {
    id: 'AUTONOMOUS_POSTING_AGENT',
    name: 'Autonomous Posting Agent',
    role: 'Social Media Automation',
    tier: 'STANDALONE',
    parentId: null,
    capabilities: ['LinkedIn Posting', 'Twitter Posting', 'Content Scheduling', 'Queue Management'],
    source: 'src/lib/social/autonomous-posting-agent.ts',
    department: 'STANDALONE',
  },
  {
    id: 'CHAT_SESSION_SERVICE',
    name: 'Chat Session Service',
    role: 'Agent Infrastructure',
    tier: 'STANDALONE',
    parentId: null,
    capabilities: ['Session Management', 'Conversation Monitoring', 'Agent Instance Lifecycle', 'Golden Master Spawning'],
    source: 'src/lib/agents/chat-session-service.ts',
    department: 'STANDALONE',
  },
];

// ─── Build the entry list ────────────────────────────────────────────────────

function deriveRole(tier: AgentTier, name: string, defaultParentId: string | null): string {
  void defaultParentId;
  if (tier === 'L1') { return 'Swarm CEO'; }
  if (tier === 'L2') { return name; }
  return name;
}

function collectAgents(): AgentEntry[] {
  const files: string[] = [];
  walkAgentFiles(ROOT, files);
  files.sort();

  const entries: AgentEntry[] = [];
  for (const file of files) {
    const tier = inferTier(file);
    const parsed = parseIdentity(file);
    if (!parsed) {
      console.warn(`  ! Could not parse identity from ${path.relative(process.cwd(), file)}`);
      continue;
    }
    const department = inferDepartment(file, tier);
    const role = deriveRole(tier, parsed.name, parsed.reportsTo);
    let parentId = parsed.reportsTo;
    // L1 always has parentId null; ignore whatever the file says.
    if (tier === 'L1') { parentId = null; }
    // For L2 managers reporting to JASPER in code, the dashboard expects
    // 'MASTER_ORCHESTRATOR' as the registry parent (Jasper is the L1 alias).
    if (tier === 'L2' && (parentId === 'JASPER' || parentId === null)) {
      parentId = 'MASTER_ORCHESTRATOR';
    }
    entries.push({
      id: parsed.id,
      name: parsed.name,
      role,
      tier,
      parentId,
      capabilities: parsed.capabilities,
      source: path.relative(process.cwd(), file).replace(/\\/g, '/'),
      department,
    });
  }
  return entries;
}

// ─── Render ─────────────────────────────────────────────────────────────────

function indent(s: string, n: number): string {
  const pad = ' '.repeat(n);
  return s.split('\n').map((l) => (l.length > 0 ? pad + l : l)).join('\n');
}

function renderEntry(e: AgentEntry): string {
  const capsLines = e.capabilities.map((c) => `'${c.replace(/'/g, "\\'")}'`).join(', ');
  const parent = e.parentId === null ? 'null' : `'${e.parentId}'`;
  return `  {
    id: '${e.id}',
    name: ${JSON.stringify(e.name)},
    role: ${JSON.stringify(e.role)},
    tier: '${e.tier}',
    parentId: ${parent},
    capabilities: [${capsLines}],
  },`;
}

function renderRegistry(entries: AgentEntry[]): string {
  // Group by department for readable section headers.
  const grouped = new Map<string, AgentEntry[]>();
  for (const e of entries) {
    const list = grouped.get(e.department) ?? [];
    list.push(e);
    grouped.set(e.department, list);
  }
  const sectionOrder = [
    'L1 - MASTER ORCHESTRATOR',
    // L2 managers — alphabetical
    ...Array.from(grouped.keys()).filter((k) => k.startsWith('L2 - ')).sort(),
    // L3 specialists — alphabetical by department
    ...Array.from(grouped.keys()).filter((k) => k.startsWith('L3 - ')).sort(),
    'STANDALONE',
  ];

  const sections: string[] = [];
  for (const section of sectionOrder) {
    const list = grouped.get(section);
    if (!list || list.length === 0) { continue; }
    const header = `  // =========================================================================
  // ${section} (${list.length})
  // =========================================================================`;
    const body = list.map(renderEntry).join('\n');
    sections.push(`${header}\n${body}`);
  }

  const total = entries.length;
  const counts = {
    L1: entries.filter((e) => e.tier === 'L1').length,
    L2: entries.filter((e) => e.tier === 'L2').length,
    L3: entries.filter((e) => e.tier === 'L3').length,
    STANDALONE: entries.filter((e) => e.tier === 'STANDALONE').length,
  };

  return `/**
 * Dynamic Agent Registry — Single Source of Truth
 *
 * AUTO-GENERATED by scripts/generate-agent-registry.ts.
 * DO NOT EDIT BY HAND. Run \`npx tsx scripts/generate-agent-registry.ts\`
 * after adding or removing an agent file. CI runs the same script with
 * \`--check\` and fails the build on drift.
 *
 * Total agents: ${total}
 *   L1 (Master Orchestrator): ${counts.L1}
 *   L2 (Managers):            ${counts.L2}
 *   L3 (Specialists):         ${counts.L3}
 *   STANDALONE:               ${counts.STANDALONE}
 *
 * Generated at: ${new Date().toISOString()}
 *
 * @module lib/agents/agent-registry
 */

// ============================================================================
// TYPES
// ============================================================================

/** Agent tier in the swarm hierarchy */
export type AgentTier = 'L1' | 'L2' | 'L3' | 'STANDALONE';

/** Definition of an agent in the registry */
export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  parentId: string | null;
  capabilities: string[];
}

// ============================================================================
// COMPLETE AGENT REGISTRY
// ============================================================================

/**
 * Authoritative registry of every agent in the platform.
 * Counts are computed from this array — never hardcoded elsewhere.
 */
export const AGENT_REGISTRY: AgentDefinition[] = [
${sections.join('\n\n')}
];

// ============================================================================
// COMPUTED STATS (calculated once at module init)
// ============================================================================

const l1Agents = AGENT_REGISTRY.filter(a => a.tier === 'L1');
const l2Agents = AGENT_REGISTRY.filter(a => a.tier === 'L2');
const l3Agents = AGENT_REGISTRY.filter(a => a.tier === 'L3');
const standaloneAgents = AGENT_REGISTRY.filter(a => a.tier === 'STANDALONE');
const swarmAgents = AGENT_REGISTRY.filter(a => a.tier !== 'STANDALONE');

export const AGENT_COUNTS = {
  total: AGENT_REGISTRY.length,
  swarm: swarmAgents.length,
  L1: l1Agents.length,
  L2: l2Agents.length,
  L3: l3Agents.length,
  STANDALONE: standaloneAgents.length,
} as const;

/** Display names for L2 manager domains */
const DOMAIN_DISPLAY_NAMES: Record<string, string> = {
  INTELLIGENCE_MANAGER: 'Intelligence',
  MARKETING_MANAGER: 'Marketing',
  BUILDER_MANAGER: 'Builder',
  COMMERCE_MANAGER: 'Commerce',
  OUTREACH_MANAGER: 'Outreach',
  CONTENT_MANAGER: 'Content',
  ARCHITECT_MANAGER: 'Architecture',
  REVENUE_DIRECTOR: 'Revenue',
  REPUTATION_MANAGER: 'Reputation',
};

// ============================================================================
// GETTER FUNCTIONS
// ============================================================================

/** Total number of agents (all tiers) */
export function getAgentCount(): number {
  return AGENT_REGISTRY.length;
}

/** Number of agents in the swarm hierarchy (L1 + L2 + L3, excludes standalone) */
export function getSwarmAgentCount(): number {
  return swarmAgents.length;
}

/** Number of standalone agents */
export function getStandaloneCount(): number {
  return standaloneAgents.length;
}

/** Number of L2 managers (also = number of domains) */
export function getManagerCount(): number {
  return l2Agents.length;
}

/** Number of L3 specialists */
export function getSpecialistCount(): number {
  return l3Agents.length;
}

/** Number of L1 orchestrators */
export function getOrchestratorCount(): number {
  return l1Agents.length;
}

/** Number of domains (= number of L2 managers) */
export function getDomainCount(): number {
  return l2Agents.length;
}

/** Get all agents of a specific tier */
export function getAgentsByTier(tier: AgentTier): AgentDefinition[] {
  return AGENT_REGISTRY.filter((a) => a.tier === tier);
}

/** Get a specific agent by ID */
export function getAgentById(id: string): AgentDefinition | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}

/** Get all agents whose parent is the given id */
export function getAgentsByParent(parentId: string): AgentDefinition[] {
  return AGENT_REGISTRY.filter((a) => a.parentId === parentId);
}

/** Get all specialists under a specific manager */
export function getSpecialistsByManager(managerId: string): AgentDefinition[] {
  return AGENT_REGISTRY.filter((a) => a.tier === 'L3' && a.parentId === managerId);
}

/** Get display names for all domains (derived from L2 managers) */
export function getDomainNames(): string[] {
  return l2Agents.map((m) => DOMAIN_DISPLAY_NAMES[m.id] ?? m.name);
}

/**
 * Human-readable swarm summary.
 * Example: "70-agent AI swarm across 9 domains"
 */
export function getSwarmSummary(): string {
  return \`\${getAgentCount()}-agent AI swarm across \${getDomainCount()} domains\`;
}

/**
 * Human-readable hierarchy breakdown.
 * Example: "1 Master Orchestrator + 9 Domain Managers + 56 Specialists + 4 Standalone"
 */
export function getHierarchySummary(): string {
  return \`\${l1Agents.length} Master Orchestrator + \${l2Agents.length} Domain Managers + \${l3Agents.length} Specialists + \${standaloneAgents.length} Standalone\`;
}

/** Full stats breakdown object */
export function getAgentRegistryStats(): {
  total: number;
  orchestrators: number;
  managers: number;
  specialists: number;
  standalone: number;
  swarm: number;
  domains: number;
} {
  return {
    total: AGENT_REGISTRY.length,
    orchestrators: l1Agents.length,
    managers: l2Agents.length,
    specialists: l3Agents.length,
    standalone: standaloneAgents.length,
    swarm: swarmAgents.length,
    domains: l2Agents.length,
  };
}

/**
 * Build the hardcoded blueprint agent section dynamically.
 * Used by jasper-tools.ts getHardcodedBlueprintSection().
 */
export function buildAgentBlueprintSection(): string {
  const lines: string[] = [];
  lines.push(\`\${getAgentCount()} TOTAL AGENTS: \${getHierarchySummary()}\`);
  lines.push('');
  lines.push(\`MASTER ORCHESTRATOR (L1): \${l1Agents[0]?.role ?? 'Swarm CEO'} — command dispatch, saga workflows, intent-based domain routing\`);
  lines.push('');
  lines.push(\`\${l2Agents.length} DOMAIN MANAGERS (L2):\`);

  l2Agents.forEach((manager, idx) => {
    const specs = getSpecialistsByManager(manager.id);
    const specNames = specs.map((s) => s.name).join(', ');
    lines.push(\`\${idx + 1}. \${manager.name} — \${specs.length} specialists (\${specNames})\`);
  });

  lines.push('');
  lines.push(\`STANDALONE AGENTS (\${standaloneAgents.length}):\`);
  standaloneAgents.forEach((agent) => {
    const capSummary = agent.capabilities.slice(0, 2).join(', ');
    lines.push(\`- \${agent.name} (\${agent.role} — \${capSummary})\`);
  });

  return lines.join('\\n');
}
`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const fileEntries = collectAgents();
  const entries: AgentEntry[] = [...fileEntries, ...STANDALONE_AGENTS];
  const next = renderRegistry(entries);

  if (CHECK_MODE) {
    const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf-8') : '';
    // Strip the timestamp line for the comparison (it always changes).
    const stripTimestamp = (s: string): string => s.replace(/^\s*\* Generated at: .*$/m, ' * Generated at: <timestamp>');
    if (stripTimestamp(current) !== stripTimestamp(next)) {
      console.error('agent-registry.ts is out of sync with src/lib/agents/**');
      console.error('Run: npx tsx scripts/generate-agent-registry.ts');
      process.exit(1);
    }
    console.log(`✓ agent-registry.ts is in sync (${entries.length} agents)`);
    return;
  }

  fs.writeFileSync(OUTPUT, next, 'utf-8');
  console.log(`✓ Wrote ${path.relative(process.cwd(), OUTPUT)} with ${entries.length} agents`);
  console.log(`  L1: ${entries.filter((e) => e.tier === 'L1').length}`);
  console.log(`  L2: ${entries.filter((e) => e.tier === 'L2').length}`);
  console.log(`  L3: ${entries.filter((e) => e.tier === 'L3').length}`);
  console.log(`  STANDALONE: ${entries.filter((e) => e.tier === 'STANDALONE').length}`);
}

main();
