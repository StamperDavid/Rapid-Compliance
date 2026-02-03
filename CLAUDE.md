# Claude Code Project Instructions

> **Scope:** All Claude Code sessions in this project
> **Branch:** dev
> **Last Updated:** February 3, 2026

---

## System Identity

**This is a Single-Tenant system.** The platform identity is **RapidCompliance.US**.

- **Architecture:** Penthouse Model (single company, NOT a SaaS/multi-tenant platform)
- **Organization ID:** `rapid-compliance-root` (defined in `src/lib/constants/platform.ts`)
- **Firebase Project:** `rapid-compliance-65f87`
- **Domain:** RapidCompliance.US
- **Clients** purchase services and products — they do NOT receive SaaS tenants

All code, routes, agents, and database paths operate under this single identity. There is no org-switching, no tenant isolation, and no multi-org logic. Any remnant of multi-tenant patterns should be treated as legacy debt and removed.

---

## Core Constraints

### 1. No Modification of Linting or Code Quality Rules

Claude is **NOT ALLOWED** to modify, disable, bypass, or weaken any of the following:

- ESLint configuration (`eslint.config.mjs`)
- TypeScript configuration (`tsconfig.json`)
- Pre-commit hooks (`.husky/`)
- Lint-staged configuration
- Any `// eslint-disable` comments (do not add new ones)
- Any `@ts-ignore` or `@ts-expect-error` comments (do not add new ones)
- The Zero-Any Policy defined in `ENGINEERING_STANDARDS.md`

If code fails linting or type-checking, **fix the underlying code**, not the rules.

### 2. Best Practices Only

Claude must adhere to:

- **ENGINEERING_STANDARDS.md** - All API and service layer patterns
- **Zero-Any Policy** - No `any` types in TypeScript
- **Zod Validation** - All API inputs validated with Zod schemas
- **Next.js 15 Async Params** - Always await route params
- **Service Layer Architecture** - Business logic in services, not routes
- **Error Handling Standards** - Proper try/catch with logging
- **Authentication Patterns** - All protected routes verify auth

Do not introduce:
- Security vulnerabilities (XSS, SQL injection, command injection, etc.)
- Over-engineered solutions
- Unnecessary abstractions
- Features beyond what was requested

### 3. Effective Sub-Agent Usage

Claude must use sub-agents proactively for efficiency:

| Agent Type | Use Case |
|------------|----------|
| `Explore` | Codebase exploration, finding files, understanding architecture |
| `Plan` | Designing implementation strategies |
| `Architect` | Analyzing project structure, mapping dependencies |
| `CodeScout` | Searching for code patterns, finding function usages |
| `fixer` | High-precision refactoring, ESLint warning resolution |
| `Reviewer` | Final audit on code changes |
| `steward` | Updating documentation after refactors |

**Rules:**
- Launch multiple agents in parallel when tasks are independent
- Use `Explore` agent for open-ended searches, not direct Glob/Grep
- Use appropriate agent thoroughness levels (quick/medium/very thorough)

---

## End-of-Session Requirements

### 4. Commit to GitHub Dev Branch

At the end of each session, Claude must:

1. Stage all changed files: `git add <specific-files>` (not `git add .`)
2. Commit with descriptive message and co-author tag
3. Push to the `dev` branch: `git push origin dev`

**Commit Format:**
```
<type>: <brief description>

<detailed changes>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

### 5. Update Single Source of Truth

At the end of each session where architecture, routes, agents, or significant functionality changed, Claude must update:

**File:** `docs/single_source_of_truth.md`

Update the following sections as applicable:
- Executive Summary metrics
- Verified Live Route Map (if routes added/removed)
- Agent Registry (if agents added/modified)
- API Implementation Notes (if API endpoints changed)
- Last Updated timestamp

**Format for timestamp:**
```markdown
**Last Updated:** [Month Day, Year] ([Brief description of changes])
```

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `AGENT_REGISTRY.json` | AI agent configurations |
| `eslint.config.mjs` | Linting rules (DO NOT MODIFY) |
| `tsconfig.json` | TypeScript config (DO NOT MODIFY) |

### Pre-Commit Checks

Before committing, ensure:
- [ ] `npm run lint` passes
- [ ] `npm run type-check` (or `npx tsc --noEmit`) passes
- [ ] `npm run build` succeeds
- [ ] No new `any` types introduced
- [ ] No new eslint-disable comments added

---

## Verification Commands

```bash
# Type check
npx tsc --noEmit

# Lint check
npm run lint

# Build verification
npm run build

# Check for any types in API
grep -r "any" src/app/api/ --include="*.ts" | grep -v node_modules

# Git status before commit
git status
```

---

## Worktree Protocol

This project uses **git worktrees** to enable parallel development without branch-switching.

### Active Worktrees

| Worktree | Path | Branch | Purpose |
|----------|------|--------|---------|
| Primary | `D:\Future Rapid Compliance` | `dev` | Main development (production-bound) |
| Rapid-Dev | `D:\rapid-dev` | `rapid-dev` | Feature development and experimentation |
| AI Features | `D:\rapid-ai-features` | `feature/agent-enhancements` | AI agent work |
| Sandbox | `D:\rapid-sandbox` | `experiment/ui-refactor` | UI experiments |

### Rules for Sub-Agents

1. **Always confirm which worktree you are operating in** before making changes. Check the working directory path.
2. **Never modify files across worktree boundaries.** If a task targets `rapid-dev`, all file reads/writes must use `D:\rapid-dev\...` paths.
3. **The `dev` branch is production-bound.** Only reviewed, tested code lands here. Use `rapid-dev` for in-progress work.
4. **Merging:** When `rapid-dev` work is complete, merge into `dev` via PR or direct merge — never force-push.
5. **Shared constants:** `DEFAULT_ORG_ID`, `COMPANY_CONFIG`, and platform identity are defined in `src/lib/constants/platform.ts`. These are the same across all worktrees (they come from the same repo).

### Creating New Worktrees

```bash
# From the primary worktree:
git worktree add <path> -b <new-branch> dev
```

### Listing / Removing Worktrees

```bash
git worktree list
git worktree remove <path>
```

---

*These instructions are binding for all Claude Code sessions in this project.*
