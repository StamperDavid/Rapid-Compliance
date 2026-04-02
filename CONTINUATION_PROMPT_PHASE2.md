# Phase 2: Prompt Engineer Agent + Agent Learning Loop

**Read CLAUDE.md and CONTINUATION_PROMPT.md first.** This prompt continues from the Golden Master & Agent Learning System work completed on April 1, 2026.

## Context

Phase 1 built the infrastructure: Golden Masters for Jasper and Alex, mission grading UI in Mission Control, deliverable rejection routing, mission scheduling, and the GM versioning/deploy system. But the learning loop isn't closed — corrections don't actually modify agent prompts yet.

Phase 2 closes the loop. When the owner grades a mission or rejects a deliverable with feedback, a Prompt Engineer Agent proposes a targeted edit to the producing agent's system prompt. The owner reviews a before/after diff and approves, rejects, or manually edits. Approved changes create a new GM version that deploys immediately. Every version is tracked and rollback is one click.

## What Exists (from Phase 1)

- `src/types/training.ts` — `AgentDomain` includes `'orchestrator' | 'sales_chat'`
- `src/types/mission-grades.ts` — `MissionGrade` interface, `starToScore()`
- `src/lib/orchestrator/jasper-golden-master.ts` — GM loader with 60s cache (currently has `buildLearnedCorrectionsBlock` which must be REPLACED with direct prompt editing)
- `src/lib/orchestrator/mission-grade-service.ts` — `submitGrade()` currently auto-flags for training pipeline. Needs to trigger Prompt Revision Popup instead.
- `src/app/api/orchestrator/missions/[missionId]/grade/route.ts` — POST + GET grade endpoints
- `src/app/(dashboard)/mission-control/_components/StarRating.tsx` — 5-star interactive component
- `src/app/(dashboard)/mission-control/_components/MissionGradeCard.tsx` — overall mission grade card
- `src/app/(dashboard)/mission-control/_components/StepGradeWidget.tsx` — per-step grade widget
- `src/app/api/campaigns/[campaignId]/deliverables/[deliverableId]/route.ts` — deliverable reject/revision already calls `autoFlagForTraining`. Needs to trigger Prompt Revision Popup instead.
- `scripts/seed-golden-masters.js` — seeds `gm_orchestrator_v1` and `gm_sales_chat_v1` in Firestore
- GM documents live in `organizations/rapid-compliance-root/goldenMasters`
- Specialist GMs live in `organizations/rapid-compliance-root/specialistGoldenMasters`
- `src/lib/training/golden-master-updater.ts` — `deployGoldenMaster()` scoped by agentType (bug fixed in Phase 1)

## Known Issues To Fix

1. **Jasper's GM has an empty `systemPrompt`.** The chat route checks `jasperGM.systemPrompt.length > 100` and falls back to the ad-hoc prompt. The GM needs to contain the full compiled prompt (from `JASPER_THOUGHT_PARTNER_PROMPT` + `ADMIN_ORCHESTRATOR_PROMPT`) so Jasper actually spawns from it.

2. **`buildLearnedCorrectionsBlock` must be removed.** The layering approach (appending corrections at the end of the prompt) was an interim shortcut. It leads to contradictions, drift, and overfitting. Replace with direct prompt editing via the Prompt Engineer Agent.

3. **Deliverable routing map is wrong.** `blog` currently routes to `seo` — should route to `content`. Fix in `src/app/api/campaigns/[campaignId]/deliverables/[deliverableId]/route.ts`.

4. **Grade submission currently auto-flags.** `submitGrade()` calls `autoFlagForTraining()` which queues improvement requests. The new flow: grade with explanation → API returns the correction + agent context → frontend triggers Prompt Revision Popup → owner approves → new GM version deployed.

## What To Build

### 1. Prompt Engineer Agent

New file: `src/lib/training/prompt-engineer-agent.ts`

A specialist that takes:
- The agent's current full system prompt
- The owner's correction/feedback text
- The agent type and context

And returns:
- The affected section of the prompt (for the "before" panel)
- A proposed revised section (for the "after" panel)
- An optional clarifying question if the correction conflicts with existing instructions

**Model:** Claude Opus via OpenRouter (best reasoning for instruction editing). Use the existing `OpenRouterProvider` from `src/lib/ai/openrouter-provider.ts`.

The agent's system prompt should instruct it to:
- Only modify the section relevant to the correction
- Never remove existing instructions that aren't contradicted
- Preserve the exact formatting, style, and structure of the prompt
- If unsure, ask for clarification rather than guessing
- Output the before section and after section as clearly delineated blocks

### 2. Prompt Revision API

New endpoint: `POST /api/training/propose-prompt-revision`

Input:
```json
{
  "agentType": "orchestrator",
  "correction": "Always enrich and score leads before drafting outreach",
  "context": "Mission grading — user gave 2 stars"
}
```

This endpoint:
1. Loads the active GM for the specified agentType
2. Sends the GM's systemPrompt + the correction to the Prompt Engineer Agent
3. Returns the proposed revision (before section, after section, optional question)

New endpoint: `POST /api/training/apply-prompt-revision`

Input:
```json
{
  "agentType": "orchestrator",
  "revisedPromptSection": "...",
  "fullRevisedPrompt": "...",
  "changeDescription": "Always enrich and score leads before drafting outreach"
}
```

This endpoint:
1. Creates a new GM version with the revised systemPrompt
2. Deploys it (deactivates previous version of same agentType)
3. Invalidates caches
4. Returns the new version ID

### 3. Prompt Revision Popup Component

New component: `src/components/training/PromptRevisionPopup.tsx`

Three-panel modal:
- **Left: Current** — affected section of current prompt, highlighted
- **Right: Proposed** — revised section with diff highlighting
- **Bottom: Chat** — conversation with Prompt Engineer Agent for clarification

Buttons: Approve, Reject, Edit Manually

This component is shared across all entry points (Mission Control, Campaign Review, Training Center).

### 4. Wire Into Mission Control

When `MissionGradeCard` or `StepGradeWidget` submits a grade WITH an explanation:
1. POST the grade to the grade API (as today)
2. POST to `/api/training/propose-prompt-revision` with agentType `'orchestrator'` and the explanation
3. Open `PromptRevisionPopup` with the response
4. On approve → POST to `/api/training/apply-prompt-revision`

### 5. Wire Into Deliverable Review

When a deliverable is rejected or revision-requested with feedback:
1. PATCH the deliverable status (as today)
2. POST to `/api/training/propose-prompt-revision` with the producing agent's domain and the feedback
3. Open `PromptRevisionPopup`
4. On approve → POST to `/api/training/apply-prompt-revision`

### 6. GM Version Control UI

New component in Training Center: `src/app/(dashboard)/settings/ai-agents/training/_components/GMVersionHistory.tsx`

For each agent type:
- List of all GM versions with timestamps and change descriptions
- Click any version to see the full prompt
- Select two versions to see a diff
- "Rollback to this version" button (deploys the selected version)
- Active version badge

### 7. Fix Jasper's GM systemPrompt

The seed script or a migration must populate `gm_orchestrator_v1.systemPrompt` with the full compiled prompt from `JASPER_THOUGHT_PARTNER_PROMPT` + `ADMIN_ORCHESTRATOR_PROMPT`. The chat route should use the GM's prompt as the base, not the frontend-sent ad-hoc prompt.

### 8. Seed GMs for Remaining Agents

Create GMs for: content, video, social, email. Each needs a systemPrompt populated from their current hardcoded prompts so the Prompt Engineer has something to edit.

## Implementation Order

1. Fix Jasper's GM systemPrompt (unblocks everything)
2. Build Prompt Engineer Agent
3. Build propose/apply API endpoints
4. Build PromptRevisionPopup component
5. Wire into Mission Control grading
6. Wire into deliverable review
7. Build GM Version Control UI
8. Wire into Training Center chat
9. Seed remaining agent GMs
10. Remove `buildLearnedCorrectionsBlock` and the layering approach
11. Fix deliverable routing map (blog → content, not seo)

## Key Principles

- **No feedback = no changes.** The system never modifies a prompt without explicit owner input.
- **Section-targeted edits only.** The Prompt Engineer rewrites only the affected section, never the full prompt.
- **Owner always approves.** Every prompt change goes through the popup with before/after diff.
- **Every version is saved.** Rollback is always one click away.
- **The Prompt Engineer can ask questions.** If a correction conflicts with existing instructions, the agent asks for clarification before proposing.
