# YC Pre-Submission Health Check — 2026-04-30T20:30:00Z

**Branch:** `dev` @ `c75e07f0` ("refactor(ux): collapse new pages into existing hubs + dashboard")
**Run mode:** Local (cloud agent auto-disabled with `auto_disabled_repo_access` — re-running here)

---

## TL;DR

**Don't ship as-is. Two P0 fixes needed first, both small.** The production build currently OOMs because the `build` script doesn't bump Node's heap limit (your `lint` script does — easy port). And lint reports 14 unnecessary-type-assertion errors that are 100% auto-fixable with `eslint --fix`. Together these are ~5 minutes of work and they unblock everything else. Beyond that: TypeCheck is clean, 4 places in core engines still use **mock data** (deal scoring, revenue forecasting, sequence metrics, coaching/team API) — YC reviewers probing those features will see fake numbers. Decide for each whether to wire-real or label-coming-soon before submitting.

---

## P0 BLOCKERS (cannot ship)

### 1. `npm run build` runs out of memory

```
FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory
```

**Root cause**: `package.json` has:
```json
"build": "next build",
"lint": "cross-env NODE_OPTIONS=--max-old-space-size=8192 eslint src/ --max-warnings 0",
```

The lint script bumps heap to 8GB; the build script doesn't, so it dies at the default 4GB during Next's optimized production compile.

**Fix (one-line change to package.json):**
```json
"build": "cross-env NODE_OPTIONS=--max-old-space-size=8192 next build",
```

### 2. 14 ESLint errors (all `@typescript-eslint/no-unnecessary-type-assertion`)

All redundant `as Type` casts where TypeScript already knows the return type. **Every one auto-fixable with `npm run lint:fix`.**

| File | Lines |
|------|-------|
| `src/app/api/chat/public/route.ts` | 86, 94, 153 |
| `src/app/api/coupons/[couponId]/status/route.ts` | 49 |
| `src/app/api/coupons/route.ts` | 111 |
| `src/app/api/ecommerce/checkout/create-session/route.ts` | 91, 105, 131 |
| `src/app/api/ecommerce/orders/[orderId]/route.ts` | 36 |
| `src/app/api/features/route.ts` | 41, 64 |
| `src/lib/agent/base-model-builder.ts` | 282 |
| `src/lib/analytics/lead-nurturing.ts` | 279 |
| `src/lib/orchestrator/jasper-tools.ts` | 4123 |

**Fix:** `npm run lint:fix` then re-run `npm run lint` to confirm clean.

### 3. Silent CI bug (less urgent but related)

When I ran `npm run lint`, the underlying `eslint` printed 14 errors but the npm wrapper still reported `exit code 0`. This means **CI thinks lint is passing when it isn't**. Likely a `cross-env` exit-code propagation issue. Worth investigating after submission, but not a blocker today since the actual lint run will be visible.

---

## P1 — Should Fix Before Submitting

### 4. Mock data still wired in production code paths

Four spots where YC reviewers — or your own demo — will surface fake numbers if they probe these features:

| File | Line | What it does |
|------|------|--------------|
| `src/lib/templates/revenue-forecasting-engine.ts` | 145 | "Fetch deals in pipeline (mock for now)" — 30/60/90-day forecast on `/templates` reads mock deals |
| `src/lib/templates/deal-scoring-engine.ts` | 120 | "Get deal data (mock for now)" — deal scoring on `/templates` reads mock data |
| `src/lib/sequence/sequence-engine.ts` | 145, 603, 633 | "currently using mock data" / "synchronous and returns mock data" — sequence metrics |
| `src/app/api/coaching/team/route.ts` | 230 | "using mock data — you would replace this with actual team member queries" — team coaching API |

**Decision per item: wire-real, OR move the UI to "Coming Soon" gating.** What you cannot do is leave fake numbers showing in a YC demo.

(Note: `src/app/api/admin/voice/stats/route.ts:171` falls back to mock only when Firestore fails — that's a defensible fallback, not the same problem.)

### 5. ~100 `as unknown as` casts across 50+ files

Per memory `feedback_pessimism_produces_corner_cutting_and_hidden_gaps.md`, you've explicitly told me these often hide silent shortcuts. Most are likely legit Firestore-data → typed-model conversions, but the volume is itself a yellow flag. Highest-concentration files worth a focused review (not all need to be fixed today):

- `src/lib/agents/sales/revenue/manager.ts` — 4 occurrences
- `src/lib/integrations/seo/dataforseo-service.ts` — 7 occurrences
- `src/lib/analytics/dashboard/analytics-engine.ts` — 4 occurrences
- `src/lib/analytics/dashboard/events.ts` — 5 occurrences
- `src/lib/agent/instance-manager.ts` — 3 occurrences

**Decision:** accept and move on for YC; revisit after submission. (Each one would need a real schema → model assertion, which is hours of work.)

---

## P2 — Watch-fors

### 6. 67 `console.log` calls in `src/lib/`
Mostly in `src/lib/logger/logger.ts` (which IS the logger, so legit). But 16 other files have them — should be replaced with `logger.info()` / `logger.warn()` calls so production logs stay structured.

### 7. 30 TODO/FIXME/HACK markers across 15 files
Cross-referenced against last-3-days commits — manageable. Specific known TODOs already documented in `manual_qa_test_plan.md`:
- `mission-control/_components/StepGradeWidget.tsx` (toolResult prop)
- `content/video/studio/page.tsx:480` (Copywriter route wiring)
- `marketing/manager.ts` and several specialists (in-comment notes)

### 8. "for now / temporarily / coming soon" copy
Many are legit Coming-Soon UI labels (e.g. social platform gating per your memory matrix). Scan-cleaned the suspicious code ones — they all overlap with the mock-data findings in P1.

---

## Stage-by-stage results

### Stage 1 — Setup ✓
- Branch: `dev`
- Latest commit: `c75e07f0` 2026-04-30 06:24 -0600
- 41 commits in last 3 days (very active)

### Stage 2 — Static checks
| Check | Status | Notes |
|---|---|---|
| `npx tsc --noEmit` | **PASS** ✓ | Type-clean |
| `npm run lint` | **FAIL** 🛑 | 14 errors, all auto-fixable |
| `npm run build` | **FAIL** 🛑 | OOMs at 4GB heap; needs NODE_OPTIONS bump |

### Stage 3 — Runtime invariant checks
**Skipped on this run** — these need a clean `next dev` + Firebase Admin creds. Run manually:

```bash
npx tsx scripts/verify-brand-dna-injection.ts
npx tsx scripts/verify-no-grades-no-changes.ts
npx tsx scripts/verify-prompt-edit-changes-behavior.ts
npx tsx scripts/verify-managers-review.ts
npx tsx scripts/verify-content-manager-review.ts
npx tsx scripts/verify-prompt-engineer.ts
npx tsx scripts/verify-mission-plan-lifecycle.ts
npx tsx scripts/verify-mission-execution-lifecycle.ts
npx tsx scripts/verify-upstream-changed-flag.ts
```

### Stage 4 — Drift hunt
| Pattern | Count | Severity |
|---|---|---|
| `as unknown as` casts | ~100 | P1 watch |
| `eslint-disable` / `@ts-ignore` / `@ts-expect-error` | 3 | OK (all `react-hooks/exhaustive-deps`) |
| TODO / FIXME / HACK / XXX | 30 across 15 files | OK |
| "coming soon" / "for now" / "not implemented" / "temporarily" | ~80 | Mostly legit UI labels; 4 code-side mock-data spots are the real concern |
| Empty `catch {}` blocks | 0 | ✓ Clean |
| `console.log` in `src/app/api/**` | 0 | ✓ Clean |
| `console.log` in `src/lib/**` | 67 across 19 files | Most in logger.ts |

### Stage 5 — Surface diff against `manual_qa_test_plan.md`
**Not run yet** — will follow up after the P0 fixes are in.

---

## What he should do at his desk (RIGHT NOW)

In order:

1. ☐ Edit `package.json` line `"build": "next build"` → `"build": "cross-env NODE_OPTIONS=--max-old-space-size=8192 next build"`
2. ☐ Run `npm run lint:fix` — fixes all 14 errors automatically
3. ☐ Run `npm run lint` to confirm clean
4. ☐ Run `npm run build` to confirm production build now succeeds
5. ☐ Decide on each of the 4 mock-data spots in P1 #4: wire-real or label-coming-soon
6. ☐ Run the 9 verify-*.ts scripts manually with Firebase creds set
7. ☐ Resume manual QA walkthrough from `docs/manual_qa_test_plan.md` Phase 1

Steps 1-4 are ~5 minutes total. Step 5 is the real decision-making block.
