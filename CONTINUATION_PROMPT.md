# SalesVelocity.ai Platform - Continuation Prompt

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Commit: `cd181754` docs: add QA agent suite to CLAUDE.md sub-agent registry

## Current State (February 6, 2026)

### Architecture
- **Single-tenant penthouse model** — fully converted from multi-tenant SaaS
- **51 AI agents** (47 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **148 physical routes**, **215 API endpoints**, **331K lines of TypeScript**

### What's Done
- Single-tenant conversion: COMPLETE (-71K lines, -185 files)
- SalesVelocity.ai rebrand: COMPLETE
- CSS variable theme system: COMPLETE
- Agent hierarchy with full manager orchestration: COMPLETE
- 4-role RBAC with API gating and sidebar filtering: COMPLETE

### What's In Progress
- **Stabilization Roadmap** — see `docs/single_source_of_truth.md` section "Stabilization Roadmap"
- The system has 100 TODO comments, 76 files with mock data, zero error boundaries, and minimal accessibility
- The goal is to solidify existing functionality before adding new features

## Trigger Phrase

Paste this into a new context window to begin work:

```
Execute Stabilization Roadmap. Read CLAUDE.md first, then docs/single_source_of_truth.md — focus on the "Stabilization Roadmap" section. Begin with the next incomplete Tier 1 task. Do not skip to Tier 2 until Tier 1 is verified complete.
```

## Key Files
| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc with Stabilization Roadmap |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (51 agents) |
| `src/lib/constants/platform.ts` | DEFAULT_ORG_ID and platform identity |

## Documentation Inventory (Clean)

**Root docs** (5 files): CLAUDE.md, README.md, ENGINEERING_STANDARDS.md, COMPETITIVE_ANALYSIS_BRIEFING.md, SOCIAL-MEDIA-AI-SPEC.md
**docs/** (3 files): single_source_of_truth.md, playwright-audit-2026-01-30.md, test-results-summary.md
**docs/master_library/** (16 files): Per-feature audit summaries from Feb 5, 2026
**docs/archive/** (16 files): Historical records — do not reference for architectural decisions
**.claude/agents/** (6 files): QA and architecture agent prompts

**Deleted** (February 6, 2026): CONTINUATION_PROMPT.md (old), SYSTEM_TRANSFER_MANIFEST.md, PATH_SYNC_REPORT.md, WORKFLOW_STATE_IMPLEMENTATION.md, LEGACY_ROUTE_REDIRECTS.md, eslint-output.txt, tsc-output.txt, app_structure.txt, rule-breakdown.txt, unique-files-with-unused-vars.txt, docs/audit_dashboard_connectivity.md
