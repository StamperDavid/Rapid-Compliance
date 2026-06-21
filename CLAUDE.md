# Claude Code Project Instructions

> **Scope:** All Claude Code sessions in this project
> **Branch:** dev
> **Last Updated:** April 15, 2026 (Phase 1-4 manager rebuild + training loop complete)

---

## 🔴 STANDING RULE #1: Every LLM agent spawns from its Golden Master, Brand DNA baked in

This rule is absolute and applies to every specialist, manager, orchestrator, and any agent
that calls an LLM. No exceptions, no fallbacks, no runtime merging.

1. **Every LLM agent has a Golden Master doc in Firestore.** The GM doc's `config.systemPrompt`
   field holds the complete agent prompt the LLM sees. At runtime, the agent loads ONE doc
   (the GM) and sends that systemPrompt to the LLM. No second Firestore call for Brand DNA.

2. **Brand DNA is BAKED INTO the GM at seed time, not merged at runtime.** Every seed script
   uses `scripts/lib/brand-dna-helper.js` to fetch Brand DNA from the org doc and merge it
   into the `systemPrompt` field before writing the GM. The runtime specialist code has NO
   `getBrandDNA()` call and NO `buildResolvedSystemPrompt` helper.

3. **This applies to every agent that calls an LLM.** Content generators (Copywriter, Alex),
   analytical agents (Lead Qualifier, Sentiment Analyst), research agents (Scraper,
   Competitor Researcher), scrapers — every single one. Even an agent whose job is to
   scrape a webpage benefits from knowing who it is working for, because it knows which
   information matters and why.

4. **When Brand DNA is edited**, every GM must be reseeded so the new values get baked in.
   Run `node scripts/reseed-all-gms.js` after every Brand DNA edit. (A UI button that does
   this with one click is on the roadmap.)

5. **Definition of done for any new agent rebuild:**
   - Specialist code reads `gm.systemPrompt` and uses it verbatim — no runtime Brand DNA loading.
   - Seed script uses `scripts/lib/brand-dna-helper.js` and writes the merged prompt to `config.systemPrompt`.
   - tsc + lint clean.
   - Seed script has been RUN against dev Firestore (not "I'll run it later").
   - `scripts/verify-brand-dna-injection.ts` shows the specialist's GM has Brand DNA baked in.
   - Only THEN is the agent rebuild complete.

6. **Violations of this rule cost months.** Agents without Brand DNA produce generic output
   that doesn't match the tenant's voice. Runtime-merged Brand DNA makes Training Lab
   editing confusing and breaks versioning. A "partially working" agent is worse than no
   agent because it hides the problem.

---

## 🔴 STANDING RULE #2: No grades = no Golden Master changes

This rule is absolute. The Golden Master for any specialist (or manager) is NEVER modified
unless a human operator explicitly submitted a grade/correction on a specific output.

1. **The only path by which a specialist GM can be edited in production is:**
   human submits a grade → `TrainingFeedback` record created → Prompt Engineer produces
   a surgical edit proposal → human approves → `createIndustryGMVersionFromEdit` creates
   a new versioned GM → `deployIndustryGMVersion` activates it atomically.

2. **There is no automated self-improvement path anywhere in the code.** Specialists do not
   edit their own prompts. Managers do not edit their specialists' prompts based on
   aggregated metrics. There is no background job that "learns from usage patterns."
   Prompts change ONLY when a human types a correction.

3. **The Prompt Engineer rewrites ONE section surgically** — never appends, never stacks,
   never adds new sections, never touches Brand DNA. It identifies the root-cause section,
   rewrites it in place, and returns a before/after diff for human approval.

4. **If an operator never grades anything, the swarm is frozen at its seeded state** —
   that is the correct and intended behavior. The system is not broken; it's waiting for
   human direction.

5. **Safety nets verify this rule at runtime:**
   - `scripts/verify-no-grades-no-changes.ts` — runs N real specialist executions,
     asserts zero GM / TrainingFeedback state changes.
   - `scripts/verify-prompt-edit-changes-behavior.ts` — proves the full grade → edit →
     new-version → changed-output loop with before/after comparison.

6. **Definition of done for any training-loop change:**
   - `scripts/verify-no-grades-no-changes.ts` passes (zero state drift on normal usage)
   - `scripts/verify-prompt-edit-changes-behavior.ts` passes (edits change behavior)
   - Rollback path always works (tests include rollback in a finally block)

7. **Violations of this rule destroy trust.** An agent that edits itself without the
   operator's knowledge is the scariest possible failure mode of an AI system. Prompt
   drift without human review is a trust-breaking violation, not a shortcut.

---

## 🔴 STANDING RULE #3: The live worktree must be synced after every dev commit

The operator's running app at **`localhost:3000` is served from the `D:\rapid-dev`
worktree, NOT from primary (`D:\Future Rapid Compliance` / `dev`).** Claude commits to
`dev`; the operator tests on `rapid-dev`. These diverge instantly. Work that lands on
`dev` is invisible to the operator until `dev` is merged into `rapid-dev`. This rule is
absolute because a missed sync looks exactly like a regression — on June 21, 2026 the
operator saw the library consolidation AND the Shot Doc layout agent "revert" when in
fact they were never synced from `dev` (last sync was June 17; four days of content work
stranded on `dev`).

1. **After ANY commit/push to `dev`, immediately sync every active worktree that runs a
   dev server** — at minimum `D:\rapid-dev`. Do not consider the work delivered until the
   live worktree has it. This supersedes the softer "§5b Sync Active Worktrees" note.

2. **Before telling the operator that any UI/feature change is "done," "live," or
   "visible," PROVE the live worktree has it:**
   ```bash
   cd /d/rapid-dev && git merge-base --is-ancestor <commit-sha> HEAD && echo "live worktree has it"
   ```
   If that prints nothing, it is NOT live for the operator — sync first.

3. **Protect in-progress work in the target worktree before merging.** Check
   `git status` in `rapid-dev` first. If it has uncommitted edits, COMMIT them on
   `rapid-dev` (a `wip(...)` checkpoint) or stash them — never merge over them, and
   **NEVER `git reset --hard`** the live worktree. Untracked files (e.g. RenderZero work)
   survive a merge; tracked uncommitted edits do not.

4. **Cherry-picking a single commit across the divergence is usually WRONG** — recent
   features depend on each other (the library consolidation depends on the Location
   Library commit; the Shot Doc work is a chain). When in doubt, merge all of `origin/dev`
   into `rapid-dev` (the tree merge is typically conflict-free; only the operator's WIP
   files conflict). Resolve WIP conflicts by COMBINING both sides, then `tsc` to prove it.

5. **After any merge into a live worktree, clear its `.next` cache** (`rm -rf .next`) and
   tell the operator to restart the server. **Never restart `localhost:3000` yourself** —
   see [[project_localhost3000_served_from_rapid_dev_worktree]]. Re-arm the dev-log Monitor
   after the operator restarts.

6. **Definition of done for any `dev`-branch UI/feature change:** the change is committed
   on `dev`, merged into `rapid-dev`, `tsc`/lint clean in `rapid-dev`, `.next` cleared, and
   the merge-base check in §2 passes. Only THEN is it "done" for the operator.

---

## Manager Rebuild — Phase 1-4 (April 15, 2026) + Auto-Review Removal (May 8, 2026)

The 10 managers are dispatchers that delegate to specialists, track which specialists ran
(M2a accumulator), and write per-call performance entries. **The autonomous LLM-review path
that briefly lived inside `delegateWithReview` was deleted on May 8, 2026** — operator
verdict: AI grading AI output is bias-stacking, the human reviews every step in Mission
Control instead. The training-loop pipeline (operator grade → Prompt Engineer surgical edit
→ human approve → new GM version → deploy) remains the only mechanism by which a manager
or specialist GM can change.

- **`src/lib/agents/base-manager.ts`** — `delegateWithReview` is now a thin wrapper:
  records the specialist via the M2a accumulator, calls `delegateToSpecialist`, writes a
  perf-tracker entry. No LLM call, no retry loop, no escalation. (Name kept for call-site
  stability — 9 manager subclasses use it. Future cosmetic rename to plain `delegate` is
  safe whenever it feels worth the cascade.)
- **`src/lib/training/manager-golden-master-service.ts`** — parallel to the specialist
  service. Collection: `managerGoldenMasters`. The May 8 manager-grading wire fix added
  `isManagerId()`, `createManagerGMVersionFromEdit`, `listManagerGMVersions`, and a
  signature-aligned `deployManagerGMVersion`.
- **`scripts/seed-{manager}-manager-gm.js`** — 9 manager seed scripts, each with
  department-specific charter + Brand DNA baked in at seed time.
- **`src/lib/agents/prompt-engineer/specialist.ts`** — the meta-specialist that translates
  human corrections into surgical prompt edits. Model: Claude Opus 4.6.
- **`src/lib/training/grade-submission-service.ts`** — orchestrates the grade → edit →
  approve → deploy pipeline. Branches on `_MANAGER` suffix to route to the right GM
  collection. Every write is gated on a `TrainingFeedback` record.
- **`src/types/training.ts`** — `TrainingFeedback` and `ManagerGoldenMaster` types.

Standing-rule runtime proofs still pass:
- `scripts/verify-prompt-engineer.ts` — full grade → edit → deploy round-trip
- `scripts/verify-no-grades-no-changes.ts` — Standing Rule #2 runtime proof
- `scripts/verify-prompt-edit-changes-behavior.ts` — behavioral proof that edits actually
  change specialist output, not just GM bytes
- `scripts/verify-specialist-id-alias-resolver.ts` — admin→seed alias resolution (May 8)

**Phase 3 frontend — DONE (April 15, 2026)**
- 4 API routes at `/api/training/grade-specialist` + `/api/training/feedback/[id]/approve|reject` (the route collision was fixed in this same session)
- 3-box `PromptRevisionPopup` (Keep current / Agent's suggestion / My rewrite) — rewritten in M1
- Version history + one-click rollback UI inline on the Mission Control step detail panel (M2c + M2d)
- Step-level grading routes to the actual specialist that produced the work, not Jasper (M2b)
- Per-mission step `specialistsUsed` accumulator in BaseManager (M2a)

---

## Mission Control Rebuild — M3-M8 COMPLETE (April 15, 2026)

The Mission Control rebuild is fully shipped. Plan-pre-approval, sequential auto-execute
with retry, downstream-changed flag, manual edit path, and inline scrap buttons all
ship in this session.

**M4 — Plan pre-approval.** Jasper now drafts a plan via `propose_mission_plan` instead
of running tools directly. Mission lands in `PLAN_PENDING_APPROVAL`. Operator reviews,
edits any step's args / summary, reorders, deletes, then approves to start execution.

**M3.6/M3.7 — Sequential auto-execute with hard per-step approval gate.** After the
operator approves the plan, the runner walks every approved step in order, sequentially,
without pausing for human gates between steps. Each step gets one auto-retry on failure.
Second failure halts the mission to `AWAITING_APPROVAL` with the failed step in `FAILED`
status. The operator must individually approve every step (or click "Approve all steps")
in the plan view before `/plan/approve` will accept the call.

**M5 — Downstream-changed flag.** When a step is rerun, every downstream step gets an
`upstreamChanged` flag. Operator clears the flag with "Still good — keep this output" or
reruns the step with the new upstream context.

**M6 — Quick manual edit path.** "Edit output directly" button on every COMPLETED/FAILED
step lets the operator overwrite the agent's output without firing the Prompt Engineer.
New `manuallyEdited` audit flag.

**M7 — Inline scrap.** Plan review, in-flight, and halted-step views all have a scrap
button. Halt alert in the step detail panel includes a scrap-the-mission button next to
the rerun option.

**M8 — Cleanup.** Deleted `/settings/ai-agents/swarm-training` (the standalone grading
page that was built in error). All inline grading happens in Mission Control via the
existing M2b `StepGradeWidget` and M2d `SpecialistVersionHistory`.

**Verified end-to-end on real Firestore via three scripts:**
- `scripts/verify-mission-plan-lifecycle.ts` — M4 plan editing (22 assertions)
- `scripts/verify-mission-execution-lifecycle.ts` — M3.6/M3.7 sequential + retry + halt + resume (32 assertions)
- `scripts/verify-upstream-changed-flag.ts` — M5 downstream flag propagation (14 assertions)

**Standing rules respected throughout** — no Brand DNA edits, no specialist GM edits
without a human grade, Jasper still delegates to managers only, plain English in every
user-facing message.

---

## System Identity

**SalesVelocity.ai** is a **multi-tenant SaaS product** currently running in single-tenant mode for development.

- **Architecture:** Penthouse Model (single-tenant development phase — multi-tenant re-enablement planned after QA)
- **Organization ID:** `rapid-compliance-root` (defined in `src/lib/constants/platform.ts`)
- **Firebase Project:** `rapid-compliance-65f87`
- **Domain:** SalesVelocity.ai (hosted at `rapidcompliance.us` until domain migration)
- **Clients** purchase their own deployment of the platform — this is SaaS, not a service agency

The platform currently operates under a single identity for development simplicity. Multi-tenancy was removed ("Scorched Earth") to stabilize the codebase and will be re-enabled after QA completes.

**Critical rules for the multi-tenant transition:**
- **Do NOT hardcode `PLATFORM_ID`** in new code — use helpers from `src/lib/firebase/collections.ts` (`getSubCollection()`, `getPlatformSubCollection()`)
- **Design all new features for multi-tenancy** even while running single-tenant
- **Do NOT remove tenant-aware patterns** if they still exist — they will be needed again
- External API `tenantId` fields (Xero, Microsoft Azure AD) are third-party concepts and must NOT be touched

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

### 2. Design System Compliance (UI/UX)

**All new and modified UI code MUST use the design system.** This is a hard rule, not a suggestion.

#### Page Structure
- **Every dashboard page** must use `<div className="p-8 space-y-6">` as its outermost wrapper
- **Exception:** Full-height layouts (chat panels, editors) that require `h-full` or `flex` layouts
- **Never** use `min-h-screen` or `bg-surface-main` on page wrappers (the layout handles this)

#### Typography — Use Components, Not Raw Tags
| Element | Component | Import from |
|---------|-----------|------------|
| Page title (h1) | `<PageTitle>` | `@/components/ui/typography` |
| Section heading (h2) | `<SectionTitle>` | `@/components/ui/typography` |
| Subsection (h3) | `<SubsectionTitle>` | `@/components/ui/typography` |
| Card heading (h4) | `<CardTitle>` | `@/components/ui/typography` |
| Subtitle / help text | `<SectionDescription>` | `@/components/ui/typography` |
| Small label | `<Caption>` | `@/components/ui/typography` |

**Never** write `<h1 className="text-3xl font-bold ...">` — use `<PageTitle>` instead.

#### Color Tokens — Use Tailwind Classes, Not CSS Variables
| Instead of | Use |
|-----------|-----|
| `text-[var(--color-text-primary)]` | `text-foreground` |
| `text-[var(--color-text-secondary)]` | `text-muted-foreground` |
| `text-[var(--color-text-disabled)]` | `text-muted-foreground` |
| `bg-[var(--color-bg-paper)]` | `bg-card` |
| `bg-[var(--color-bg-elevated)]` | `bg-surface-elevated` |
| `bg-[var(--color-bg-main)]` | `bg-background` |
| `text-[var(--color-primary)]` | `text-primary` |
| `border-[var(--color-border-light)]` | `border-border-light` |

**Never** use `style={{ color: 'var(--color-...)' }}` when a Tailwind class exists.

#### Layout — Responsive Grids, Not Inline Styles
- **Never** use `style={{ gridTemplateColumns: '...' }}` — use Tailwind responsive grid classes
- **Always** include mobile breakpoints: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- **Exception:** Dynamic computed values that can't be expressed as static classes

#### Components — Use the Library
- **Buttons:** Import `Button` from `@/components/ui/button` — never create raw `<button className="px-4 py-2 ...">` elements
- **Cards:** Use `bg-card border border-border-strong rounded-2xl p-6` or `Card` from `@/components/ui/card`
- **Inputs:** Import `Input` from `@/components/ui/input`
- **Dialogs:** Import from `@/components/ui/dialog`

#### Inline Styles — Minimize
- **Prefer Tailwind classes** over `style={{}}` props in all cases
- **Only use inline `style`** for truly dynamic values computed at runtime (e.g., `style={{ width: `${percent}%` }}`)
- **Never** hardcode hex colors, rgb values, or px font sizes in `style` attributes

### 3. Best Practices Only

Claude must adhere to:

- **ENGINEERING_STANDARDS.md** - All API and service layer patterns
- **Zero-Any Policy** - No `any` types in TypeScript
- **Zod Validation** - All API inputs validated with Zod schemas
- **Next.js 14 Async Params** - Always await route params
- **Service Layer Architecture** - Business logic in services, not routes
- **Error Handling Standards** - Proper try/catch with logging
- **Authentication Patterns** - All protected routes verify auth

Do not introduce:
- Security vulnerabilities (XSS, SQL injection, command injection, etc.)
- Over-engineered solutions
- Unnecessary abstractions
- Features beyond what was requested

### 4. Effective Sub-Agent Usage

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
| `SaaS Architect` | UX/UI & product strategy — competitive audits, onboarding flow, user value mapping. Prompt: `.claude/agents/saas-architect.md` |
| `SaaS Auditor` | Compliance, security & verification — endpoint gating, feature completeness, doc accuracy. Prompt: `.claude/agents/saas-auditor.md` |
| `QA Revenue` | Revenue pipeline & payment QA — Stripe integration, checkout, pricing tiers, coupons, e-commerce flow. Prompt: `.claude/agents/qa-revenue-commerce.md` |
| `QA Data Integrity` | Data consistency QA — Zod schema coverage, Firestore structure, referential integrity, analytics accuracy. Prompt: `.claude/agents/qa-data-integrity.md` |
| `QA Growth` | Growth channel QA — social media, email campaigns, SEO, voice AI, video, website builder, forms, SMS. Prompt: `.claude/agents/qa-growth-outreach.md` |
| `QA Platform` | Infrastructure QA — integrations, OAuth flows, webhooks, workflows, agent swarm, API contracts, cron jobs. Prompt: `.claude/agents/qa-platform-infrastructure.md` |

**Rules:**
- Launch multiple agents in parallel when tasks are independent
- Use `Explore` agent for open-ended searches, not direct Glob/Grep
- Use appropriate agent thoroughness levels (quick/medium/very thorough)

**Custom Agents (SaaS Architect, SaaS Auditor & QA Suite):**
- These are invoked via the `general-purpose` agent type with the specialized prompt from `.claude/agents/`
- Before launching, read the agent's prompt file and include it in the task description
- Example: "You are the SaaS Architect. [full prompt from .claude/agents/saas-architect.md]. Now audit the dashboard for competitive gaps."
- These agents research and report — they do NOT write code directly
- Use `SaaS Architect` when evaluating UX, features, onboarding, or competitive positioning
- Use `SaaS Auditor` when verifying security, endpoint protection, documentation accuracy, or compliance
- Use `QA Revenue` when auditing Stripe integration, checkout flows, pricing enforcement, coupons, or e-commerce
- Use `QA Data Integrity` when verifying Zod schemas, Firestore structure, referential integrity, or analytics accuracy
- Use `QA Growth` when testing social media posting, email campaigns, SEO output, voice AI, video, website builder, or forms
- Use `QA Platform` when auditing integrations, OAuth flows, webhooks, workflow engine, agent swarm, or API contracts
- **QA agents can be run in parallel** across all 4 domains for a full platform health check

---

## End-of-Session Requirements

### 5. Commit to GitHub Dev Branch

At the end of each session, Claude must:

1. Stage all changed files: `git add <specific-files>` (not `git add .`)
2. Commit with descriptive message and co-author tag
3. Push to the `dev` branch: `git push origin dev`

**Commit Format:**
```
<type>: <brief description>

<detailed changes>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

### 5b. Sync Active Worktrees

> **This is now governed by 🔴 STANDING RULE #3 (top of this file) — read it.** Syncing
> the live `rapid-dev` worktree is mandatory after every `dev` commit, not just at
> end-of-session, and "done" is not "done" until the merge-base check proves the live
> worktree has the change.

After pushing to `dev`, Claude must also merge `dev` into any active worktree branches that are running a local dev server (e.g., `rapid-dev` at `D:\rapid-dev`). This ensures `localhost:3000` reflects the latest changes immediately.

```bash
# From the target worktree:
cd D:\rapid-dev
git merge origin/dev --no-edit
```

If the merge has conflicts, resolve them before proceeding. Always clear the `.next` cache after merging (`rm -rf .next`) so the dev server picks up the new code.

### 6. Update Single Source of Truth

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
