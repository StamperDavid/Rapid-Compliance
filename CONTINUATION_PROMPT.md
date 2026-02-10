# SalesVelocity.ai — Launch Checklist

**Repository:** https://github.com/StamperDavid/Rapid-Compliance
**Branch:** dev
**Last Updated:** February 10, 2026
**Status:** All development complete. Deployment pending.

---

## Platform Summary

- **Architecture:** Single-tenant penthouse model
- **Org ID:** `rapid-compliance-root` | **Firebase:** `rapid-compliance-65f87`
- **Scale:** 159 pages, 226 API endpoints, 52 AI agents, 330K+ LOC
- **Code Health:** TypeScript 0 errors, ESLint 0 warnings, Build passes clean

---

## Launch Checklist

### Step 1: Deploy Firestore Indexes (~15 min)
```bash
firebase login --reauth
firebase deploy --only firestore:indexes
```
- Fixes 3 failing service tests (need composite indexes on `status+createdAt`, `stage+createdAt`)
- Indexes are already defined in `firestore.indexes.json` — just need to be pushed

### Step 2: Production Deploy to Vercel (~2-3 hrs)
- [ ] Import GitHub repo into Vercel (if not already done)
- [ ] Transfer environment variables from `.env.local` to Vercel dashboard
- [ ] Set production domain to SalesVelocity.ai
- [ ] Verify 7 cron jobs activate (defined in `vercel.json`)
- [ ] Update OAuth callback URLs to production domain:
  - Gmail OAuth redirect
  - Outlook OAuth redirect
  - Slack OAuth redirect
- [ ] Configure Stripe webhook endpoint to production URL
- [ ] Verify Firebase Auth authorized domains include production domain

**Already resolved during Feb 9 deployment debugging:**
- force-dynamic on 163 API routes (prevents static prerender)
- Firebase service account key: base64-encoded for Vercel
- PEM private key normalization for Vercel whitespace
- Husky graceful fallback in CI
- DAL singleton lazy-init for cold starts

### Step 3: Smoke Test the OODA Loop (~2-3 hrs)
- [ ] Create a lead via dashboard or public form
- [ ] Verify Event Router fires and routes to Revenue Director
- [ ] Confirm Revenue Director qualifies lead (BANT scoring 0-100)
- [ ] Check Outreach Manager enrolls lead in sequence
- [ ] Verify operations-cycle cron processes it (4h operational cycle)
- [ ] Test Jasper chat with a customer conversation
- [ ] Confirm ConversationMemory persists and retrieves interaction
- [ ] Test voice call flow (Twilio → Voice Agent → transcript persistence)
- [ ] Verify executive briefing dashboard populates

### Step 4: Fix What Breaks (~variable)
Budget time for:
- Environment variable mismatches between local and Vercel
- Vercel cold start timing (MemoryVault hydration, DAL init)
- External API rate limits (OpenRouter, Twilio, SendGrid)
- OAuth redirect URI mismatches on production domain
- Firebase security rules blocking legitimate production requests
- Stripe webhook signature verification with production keys

### Step 5: Wire Up Outbound Webhook Dispatch (~3-4 hrs)
- Settings UI exists with event list — backend dispatch not implemented
- EventRouter can trigger internal agent actions but can't notify external systems
- This is the last functional code gap

---

## Post-Launch Improvements

| Task | Priority | Notes |
|------|----------|-------|
| Reduce `as unknown as` casts | Low | ~132 remain, ~70% legitimate Firebase bridging |
| Nonce-based CSP | Low | Replace `unsafe-inline` for scripts |
| Clean stale git branches | Low | 8 local + 5 remote branches (18-60 days old) |
| Remove idle worktrees | Low | `rapid-ai-features` and `rapid-sandbox` idle since Feb 6 |

---

## Boundaries (Not Building Now)

- No plugin/hook registry — internal infrastructure is intentionally closed
- No external agent registration API — 52-agent swarm is a closed system
- No public REST API / OpenAPI spec — all 226 endpoints are internal
- No "WordPress extensibility" — deferred until post-launch

**Inbound integration paths that DO work:**
- `POST /api/workflows/webhooks/{workflowId}` — generic webhook trigger (HMAC)
- `GET/POST /api/public/forms/{formId}` — public form submission
- 6 service webhooks: Stripe, SendGrid, SendGrid Inbound, Twilio SMS, Twilio Voice, Gmail

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | 52-agent system inventory |
| `src/lib/constants/platform.ts` | DEFAULT_ORG_ID and platform identity |
| `vercel.json` | 7 cron entries for autonomous operations |
| `firestore.indexes.json` | Composite indexes (defined, NOT YET deployed) |
| `src/lib/orchestration/event-router.ts` | 25+ event rules → Manager actions |
| `src/lib/orchestrator/jasper-command-authority.ts` | Executive briefings + approval gateway |
| `src/lib/conversation/conversation-memory.ts` | Unified retrieval + Lead Briefing generator |
| `src/lib/agents/shared/memory-vault.ts` | Shared agent knowledge (Firestore-backed) |

---

## Documentation Inventory

**Root docs** (3 active): CLAUDE.md, README.md, ENGINEERING_STANDARDS.md
**Root context** (2 files): CONTINUATION_PROMPT.md, AGENT_REGISTRY.json
**docs/** (3 files): single_source_of_truth.md, playwright-audit-2026-01-30.md, test-results-summary.md
**docs/master_library/** (16 files): Per-feature audit summaries from Feb 5, 2026
**docs/archive/** (19 files): Historical records + archived specs
**.claude/agents/** (6 files): QA and architecture agent prompts
