# Archived Documentation

This directory contains documentation that has been superseded by `docs/single_source_of_truth.md`.

**Archive Date:** January 26, 2026
**Reason:** Documentation cleanup to establish single authoritative reference

---

## Archived Files

### Forensic Audits (High Priority Archive)

| File | Original Location | Archive Reason |
|------|-------------------|----------------|
| GROUND_TRUTH_DISCOVERY.md | Project root | Superseded by SSOT - outdated agent counts (27 vs 44) |
| FEATURE_PARITY_AUDIT.md | Project root | Superseded by SSOT - middleware fixes now implemented |
| FORENSIC_AUDIT_V3.md | Project root | Historical record of "God Mode" removal |
| FORENSIC_AUDIT_BRIEFING.md | Project root | Contains outdated framework version references |

### Architecture Documentation

| File | Original Location | Archive Reason |
|------|-------------------|----------------|
| SYSTEM_MAP_JAN_2026.md | `docs/` | Superseded by SSOT route map |
| SYSTEM_BLUEPRINT.md | Project root | Outdated architecture - contains deprecated references |
| ARCHITECTURE_GRAPH.md | Project root | Outdated agent count (18 vs 44) |
| orchestrator-system-blueprint.md | `src/lib/orchestrator/` | Duplicate of broader architecture docs |

### Redirect Documentation

| File | Original Location | Archive Reason |
|------|-------------------|----------------|
| REDIRECT_IMPLEMENTATION_REPORT.md | Project root | Duplicate of LEGACY_ROUTE_REDIRECTS.md |
| REDIRECT_FLOW_DIAGRAM.md | Project root | Visual complement - keep text doc only |
| REDIRECT_TEST_CASES.md | Project root | Test cases now in codebase |

### Miscellaneous

| File | Original Location | Archive Reason |
|------|-------------------|----------------|
| VERIFIED.md | Project root | Historical progress log from Jan 12, 2026 |
| workflow_state.md | Project root | Temporary state file |

---

## Active Root-Level Documentation (Not Archived)

The following files remain at the project root as they serve active purposes:

| File | Purpose | Status |
|------|---------|--------|
| README.md | Project overview | ACTIVE - Update refs to SSOT |
| ENGINEERING_STANDARDS.md | Coding standards (enforced by hooks) | ACTIVE |
| LEGACY_ROUTE_REDIRECTS.md | Middleware redirect documentation | ACTIVE |
| PATH_SYNC_REPORT.md | Route structure reference | ACTIVE |
| WORKFLOW_STATE_IMPLEMENTATION.md | Workflow feature implementation | ACTIVE |
| SYSTEM_TRANSFER_MANIFEST.md | Onboarding reference | ACTIVE |
| COMPETITIVE_ANALYSIS_BRIEFING.md | Competitive positioning | ACTIVE |
| SOCIAL-MEDIA-AI-SPEC.md | Feature specification | ACTIVE |

---

## Component-Specific Documentation (Not Archived)

These files remain in their original locations as they provide contextual information:

| File | Location | Purpose |
|------|----------|---------|
| DATABASE_SCHEMA.md | `src/lib/forms/` | Form Builder Firestore schema |
| README.md | `src/lib/agents/trust/gmb/` | GMB Specialist capabilities |
| README.md | `src/components/dashboard/` | Unified Sidebar documentation |
| IMPLEMENTATION_SUMMARY.md | `src/components/dashboard/` | Sidebar implementation details |
| MIGRATION.md | `src/components/dashboard/` | Sidebar migration guide |
| EXAMPLES.md | `src/components/dashboard/` | Sidebar usage examples |

---

## Usage Policy

1. **DO NOT** reference archived documents for architectural decisions
2. **DO** reference `docs/single_source_of_truth.md` as the authoritative source
3. **DO** keep component-specific docs updated with code changes
4. **DO** archive temporary audit/discovery docs within 24 hours of creation

---

*Archive last updated: January 26, 2026*
