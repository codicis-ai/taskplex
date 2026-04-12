# TaskPlex Artifact Contract
<!-- Canonical reference for all task artifacts. Defines what exists, who creates it, and which profiles require it. -->

**Canonical ownership**: This file is the single source of truth for artifact directory structure, ownership (who creates each artifact), and profile requirements. Phase docs reference this contract; they do not duplicate artifact matrices or ownership rules.

## Task Directory Structure

```
.claude-task/{taskId}/
├── manifest.json              # Phase 0 — orchestrator creates, heartbeat updates
├── progress.md                # Heartbeat renders from manifest.progressNotes
├── brief.md                   # Phase 0 Step 9 — product brief agent
├── success-criteria.json      # Design phase — structured SC-* success contract
├── spec.md                    # Planning phase — architect or orchestrator
├── success-map.json           # Planning phase — SC-* to code / verification mapping
├── workflow-eval.json         # Completion/validation — workflow self-evaluation
├── architecture.md            # Planning phase — architect agent (architect route only)
├── gate-decisions.json        # Validation — orchestrator logs each gate
├── validation-gate.json       # Validation Step 9 — orchestrator writes after compliance passes
├── degradations.json          # Phase 0 Step 9b — orchestrator (standard + enterprise)
├── traceability.json          # Phase 0 Step 9b — orchestrator (standard + enterprise)
├── readiness.json             # Phase 0 Step 9b — orchestrator (enterprise only)
├── reviews/
│   ├── security.md            # Validation Step 2 — security-reviewer agent
│   ├── closure.md             # Validation Step 3 — closure-agent
│   ├── code-review.md         # Validation Step 4 — code-reviewer agent
│   ├── compliance.md          # Validation Step 8 — compliance-agent (always last)
│   ├── database.md            # Conditional — database-reviewer agent
│   ├── e2e.md                 # Conditional — e2e-validator agent
│   ├── user-workflow.md       # Conditional — user-workflow agent
│   ├── dependency-compliance.md  # Enterprise E1
│   ├── migration-safety.md    # Enterprise E2
│   ├── operability.md         # Enterprise E3
│   └── custom-gate-{name}.md  # Custom gates from conventions.json
├── hardening/
│   ├── report.md              # Hardening Step 7a — human-readable
│   ├── gate-decision.json     # Hardening Step 7b — machine-readable verdict
│   ├── dependency-report.json # Hardening Step 7c — audit detail
│   ├── secrets-report.json    # Hardening Step 7c
│   ├── coverage-report.json   # Hardening Step 7c
│   └── license-report.json    # Hardening Step 7c
├── checkpoints/               # PreCompact hook — automatic snapshots
├── pipeline/*/worker-evidence.json  # Execution — per-worker SC evidence
├── workers/                   # Parallel execution — worker status JSONs
└── deferred/                  # Items found outside scope during implementation
```

## Required Artifacts by Profile

| Artifact | lean | standard | enterprise | Created By | Created At |
|----------|:----:|:--------:|:----------:|------------|------------|
| manifest.json | **R** | **R** | **R** | Orchestrator | Phase 0 Step 1 |
| progress.md | **R** | **R** | **R** | Heartbeat hook | Phase 0+ (rendered) |
| brief.md | **R** | **R** | **R** | Product brief agent | Phase 0 Step 9 |
| success-criteria.json | — | **R** | **R** | Orchestrator / design phase | Design phase |
| spec.md | — | **R** | **R** | Architect/orchestrator | Planning phase |
| success-map.json | — | **R** | **R** | Planning agent / orchestrator | Planning phase |
| workflow-eval.json | — | **A** | **R** | Compliance agent / workflow eval step | Post-validation |
| architecture.md | — | — | **R** (architect only) | Architect agent | Planning phase |
| degradations.json | — | **R** | **R** | Orchestrator | Phase 0 Step 9b |
| traceability.json | — | **R** | **R** | Orchestrator | Phase 0 Step 9b / Validation Step 0.5 |
| readiness.json | — | — | **R** | Orchestrator | Phase 0 Step 9b / Validation Step 7 |
| gate-decisions.json | **R** | **R** | **R** | Orchestrator | Validation start |
| validation-gate.json | **R** | **R** | **R** | Orchestrator | Validation Step 9 |
| reviews/security.md | **R** | **R** | **R** | security-reviewer | Validation Step 2 |
| reviews/closure.md | **R** | **R** | **R** | closure-agent | Validation Step 3 |
| reviews/code-review.md | — | **R** | **R** | code-reviewer | Validation Step 4 |
| reviews/compliance.md | **R** | **R** | **R** | compliance-agent | Validation Step 8 |
| hardening/* | — | **A** | **R** | hardening-agent | Validation Step 7.5 |

**R** = required (blocks completion if missing/failing), **A** = advisory (produced and evaluated; red-line rule violations still block — see `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/hardening-checks.md` → "Red-Line Rules"), **—** = not applicable

## Session File (Visualizer Bridge)

```
~/.claude/sessions/sess-{pid}.json
```

Created in Phase 0 Step 2. Updated by heartbeat hook. Consumed by Agent World Viz watcher. Contains: sessionId, taskId, cwd, phase, route, status, events (trace spans), fanOut state.

## Artifact Validation Gate (Step 0)

Before validation begins, the orchestrator checks all required artifacts exist and are non-empty. Missing artifacts block the pipeline with `status: blocked:missing-artifacts`.

The heartbeat hook also runs a lightweight artifact check on phase transition to validation (F3).
