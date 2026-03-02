# SalesVelocity.ai — Continuation Prompt

**Always** review CLAUDE.md rules before starting a task.

## Context

- **Repository:** https://github.com/StamperDavid/Rapid-Compliance
- **Branch:** dev
- **Last Updated:** March 2, 2026

## Platform State

| Metric | Value |
|--------|-------|
| Physical Routes (page.tsx) | 171 |
| API Endpoints (route.ts) | 315 |
| TypeScript Files | 1,439 |
| AI Agents (FUNCTIONAL) | 54 (46 swarm + 6 standalone + 2 Growth Analyst variants) |
| RBAC | 4-role (`owner`/`admin`/`manager`/`member`) in code; Firestore rules binary (`isAdmin`/`isAuthenticated`) |
| Hosting | Vercel (rapidcompliance.us) — brand is SalesVelocity.ai |

### Build Health

- `tsc --noEmit` — **PASSES**
- `npm run lint` — **PASSES (zero warnings)**
- `npm run build` — **PASSES**
- 16 justified `eslint-disable` comments (ratcheted)

## Recent Work (March 2026)

- **SEO system seeded** — Brand DNA, Website SEO (robots OFF), SEO Lab Training (18 keywords) all in Firestore. Launch command: `npx tsx scripts/seo-launch.ts`
- **Golden Masters extended** to swarm specialists with versioned snapshots
- **Coaching unified** into Training Center with 7-tab layout
- **SalesVelocity.ai rebrand** — all Jasper prompts, domain references corrected
- **Unified Agent Training system** — performance tracking, improvement requests, specialist metrics

## Launch Readiness (~97%)

### Ready

- Single-tenant architecture (Penthouse Model)
- 54 AI agents operational with hierarchical orchestration
- Stripe checkout + webhooks + subscription handling
- SendGrid email integration
- Firebase Auth with password reset
- SEO system (robots.txt, sitemap.xml, llms.txt, Brand DNA, AI bot access)
- Legal pages (Privacy, Terms, Security)
- Onboarding flow (4-step: industry → niche → account → setup)
- Website builder with custom domains
- Error boundaries + Sentry integration
- PWA manifest

### Needs Attention Before Launch

| Area | What's Needed |
|------|---------------|
| **Stripe** | Production API keys, create products/prices, test checkout |
| **Email DNS** | SPF/DKIM/DMARC records for salesvelocity.ai |
| **OAuth apps** | Register Google, Microsoft, Twitter, LinkedIn apps with production redirect URIs |
| **Twilio** | Verify account SID + auth token, test voice calls |
| **Domain** | CNAME/A records to Vercel, verify SSL |
| **Vercel env vars** | Set all production env vars (see `.env.example`) |
| **SEO flip** | Run `npx tsx scripts/seo-launch.ts` when ready |
| **Analytics** | Verify GA4 script injection on public pages |
| **Legal review** | Update company address for CAN-SPAM, review terms currency |

### Known Technical Debt

| Issue | Severity |
|-------|----------|
| 115 placeholder tests (`expect(true).toBe(true)`) | HIGH |
| ~49% Zod validation coverage on API routes | MEDIUM |
| Facebook/Instagram blocked (Meta Developer Portal) | MEDIUM |
| LinkedIn uses unofficial RapidAPI wrapper | MEDIUM |
| 37 skipped tests (need external services) | LOW |

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations |
| `src/lib/constants/platform.ts` | PLATFORM_ID and identity |
| `.env.example` | All required environment variables |
