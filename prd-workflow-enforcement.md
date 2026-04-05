# PRD: Workflow Enforcement — Structural Gates + Continuity Reminder

> **Status**: Ready to build
> **Priority**: High — addresses failures observed in production TaskPlex sessions
> **Scope**: Hook extensions + manifest schema additions
> **Estimated effort**: Small (1-2 hours)
> **Companion**: `prd-session-guardian.md` (Layer 2 — behavioral enforcement, build after this)

## Problem Statement

In a real TaskPlex session (apple-notes project, event-engine-v1 task, Blueprint route, enterprise quality profile), the orchestrating agent:

1. **Skipped the mandatory critic review** after the architect returned — jumped directly toward dispatching implementation workers, despite the critic step being in the task list
2. **Skipped user plan acknowledgment** — `manifest.planSource.userAcknowledged` remained `false` while `manifest.implementationDelegated` was set to `true`
3. **Stopped to ask the user twice** during implementation, violating the execution continuity rule

These are not edge cases. They represent a category of failure: **the agent ignores procedural instructions under context pressure**. When the architect produces 12 worker briefs, a spec, and an architecture doc, the agent builds momentum toward the "big" step (implementation) and skips "small" steps (critic, acknowledgment).

Prompt-level instructions are insufficient. The execution continuity rule is already a HARD RULE in planning.md. The critic step is in the phase file and task list. The agent ignored both. The only reliable enforcement is **structural** — hooks that block tool calls.

## Evidence

From `apple-notes/.claude-task/event-engine-v1/manifest.json`:
- `planSource.userAcknowledged: false` — plan never formally approved
- `implementationDelegated: true` — implementation was flagged as started
- `implementationAgents: []` — no agents actually dispatched
- `phaseChecklist.planning.critic-review: "pending"` — critic never ran
- `reviews/` directory empty — no review artifacts produced

## Solution

### Acknowledgment Gate (blocks first)

**Trigger**: Any source file write during `phase === "implementation"` or `phase === "qa"`.

**Check**: `manifest.planSource?.userAcknowledged === true`

**Block message**: "TaskPlex acknowledgment gate: User has not acknowledged the plan. Run Pre-Implementation Acknowledgment (Phase A.3) before proceeding. Use AskUserQuestion to present the plan summary and get approval."

**No manifest schema change needed** — `planSource.userAcknowledged` already exists.

**Route behavior**:
- **Light**: Subject to this gate. Light route has a Pre-Implementation Acknowledgment step (Phase A.3 in planning.md). The spec is shorter but user approval is still required.
- **Standard**: Subject to this gate.
- **Blueprint**: Subject to this gate.

**Location**: `tp-design-gate.mjs`, inside the implementation/QA block, nested within the `isSourceFile()` conditional. Runs FIRST before all other implementation gates.

### Critic Gate (blocks second)

**Trigger**: Any source file write during `phase === "implementation"` or `phase === "qa"`, when `executionMode` is `standard`, `team`, or `blueprint`.

**Check**: `manifest.criticCompleted === true`

**Block message per route**:
- **Blueprint**: "TaskPlex critic gate: Strategic and tactical critic reviews not completed. Spawn strategic-critic and tactical-critic before implementation. See planning.md Blueprint Phase A.2."
- **Standard / Team**: "TaskPlex critic gate: Spec critic review not completed. Spawn closure-agent for spec review before implementation. See planning.md Standard Phase A.2."

**Light route**: Exempt. Light route has no critic step.

**Manifest schema addition**:
```json
{
  "criticCompleted": false
}
```

**Set by**: Orchestrator, after critics return APPROVED. But since orchestrator prompt compliance is the very problem this PRD addresses, the hook also detects critic completion from review artifacts:

**Artifact-based detection (fallback)**: If `criticCompleted` is not set but review files exist in `.claude-task/{taskId}/reviews/` matching `strategic-review*` or `tactical-review*` (Blueprint) or `spec-review*` (Standard), the hook treats the critic as completed and sets `manifest.criticCompleted = true` itself. This prevents deadlock when the orchestrator forgets to set the flag.

**Escape hatch**: If the user needs to bypass the critic gate (e.g., re-running after a failed session), they can manually set `criticCompleted: true` in manifest.json. The block message includes this instruction.

**Location**: `tp-design-gate.mjs`, inside the implementation/QA block, nested within `isSourceFile()`, runs AFTER acknowledgment gate.

### Execution Continuity Reminder (advisory, not a gate)

**Trigger**: Every file edit heartbeat during `phase === "implementation"` or `phase === "qa"`, but ONLY when the edit originates from the orchestrator context (not from a spawned worker agent).

**Action**: Append a short reminder to the `progress.md` rendered by `tp-heartbeat.mjs`.

**Message**: `EXECUTION CONTINUITY: After user approves plan, run to completion. Do not stop to ask "should I continue?"`

**Location**: `tp-heartbeat.mjs`, added to the `renderProgress()` function output during implementation/QA phases.

**This is advisory, not blocking.** It survives context compaction because progress.md is re-rendered on every heartbeat. It does NOT fire for spawned worker agents — workers don't need the reminder (they run to completion by default via `max_turns`).

**Note**: This reminder and the Session Guardian's observation log (companion PRD Phase 1) both add output to `tp-heartbeat.mjs`. They are independent additions — the reminder goes in `renderProgress()`, while the guardian's scope/ownership checks would be a separate code block before `renderProgress()`. No merge conflict.

## Gate Ordering in tp-design-gate.mjs

During `phase === "implementation"` or `phase === "qa"`, inside the `isSourceFile()` conditional:

```
1. Acknowledgment gate — blocks if planSource.userAcknowledged !== true
2. Critic gate — blocks if (standard|team|blueprint) and criticCompleted !== true
   (with artifact-based fallback detection)
3. Implementation delegated (existing) — blocks orchestrator source edits
4. Wave gate (existing) — blocks next wave until previous validated
```

During `phase === "validation"`: No new gates. Validation runs after implementation is complete — acknowledgment and critic are already past. Existing gates do not apply to validation phase.

## What This Does NOT Fix

- **Agent stopping to ask during implementation** — The continuity reminder is advisory only. A full fix requires the Session Guardian (`prd-session-guardian.md`) which can detect conversational patterns.
- **Agent dispatching workers in wrong order** — The wave gate partially covers this, but only after workers start writing files. Pre-dispatch ordering is behavioral.
- **Agent ignoring task list items** — Task lists remain informational. Gates are the structural enforcement layer.
- **Scope creep during implementation** — Addressed by Session Guardian Phase 1 (scope checks in heartbeat).

## Acceptance Criteria

- AC-1: Blueprint route blocks source file writes if `criticCompleted !== true`, with Blueprint-specific error message mentioning strategic + tactical critics
- AC-2: Standard route blocks source file writes if `criticCompleted !== true`, with Standard-specific error message mentioning spec critic
- AC-3: Light route is NOT blocked by critic gate (no `criticCompleted` field needed)
- AC-4: All routes (including Light) block source file writes if `planSource.userAcknowledged !== true`, with clear error message
- AC-5: Heartbeat renders execution continuity reminder in progress.md during implementation/QA phases
- AC-6: Existing implementation gate and wave gate continue to work (no regression)
- AC-7: Task artifact writes (`.claude-task/` paths) are NOT blocked by new gates
- AC-8: Critic gate detects review artifacts as fallback when `criticCompleted` flag is not set
- AC-9: `criticCompleted` field absent or `undefined` is treated as `false`
- AC-10: Block messages include instructions for manual escape (edit manifest.json)

## Test Plan

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Blueprint, no critic, no artifacts | Source write, `criticCompleted: false`, no review files | Blocked with Blueprint critic message |
| 2 | Blueprint, critic done via flag | Source write, `criticCompleted: true` | Allowed (passes to next gate) |
| 3 | Blueprint, critic done via artifacts | Source write, `criticCompleted` absent, `reviews/strategic-review.md` exists | Allowed (artifact detection sets flag) |
| 4 | Standard, no critic | Source write, `criticCompleted: false` | Blocked with Standard critic message (mentions spec critic) |
| 5 | Standard, `criticCompleted` absent | Source write, no field in manifest | Blocked (undefined treated as false) |
| 6 | Team route, no critic | Source write, `executionMode: "team"`, `criticCompleted: false` | Blocked (team follows standard critic rules) |
| 7 | Light, no critic | Source write, `executionMode: "light"`, no `criticCompleted` | Allowed (light exempt) |
| 8 | Any route, not acknowledged | Source write, `userAcknowledged: false` | Blocked with acknowledgment message |
| 9 | Any route, acknowledged | Source write, `userAcknowledged: true` | Allowed (passes to next gate) |
| 10 | Light route, not acknowledged | Source write, `executionMode: "light"`, `userAcknowledged: false` | Blocked (light still requires acknowledgment) |
| 11 | Task artifact write, not acknowledged | Write to `.claude-task/spec.md`, `userAcknowledged: false` | Allowed (task artifacts bypass gates) |
| 12 | Non-source file write | Write to `README.md`, not acknowledged | Allowed (`isSourceFile` returns false) |
| 13 | Heartbeat during impl | File edit, `phase: "implementation"` | progress.md contains continuity reminder |
| 14 | Heartbeat during design | File edit, `phase: "init"` | No continuity reminder in progress.md |
| 15 | Heartbeat during validation | File edit, `phase: "validation"` | No continuity reminder |
| 16 | Resumed session, flag persisted | Source write, manifest from previous session with `userAcknowledged: true` | Allowed (flag persisted in manifest.json) |

## Files Changed

| File | Change |
|------|--------|
| `~/.claude/hooks/tp-design-gate.mjs` | Add acknowledgment gate + critic gate (with artifact fallback) inside `isSourceFile()` block |
| `~/.claude/hooks/tp-heartbeat.mjs` | Add continuity reminder to `renderProgress()` during implementation/QA |
| `~/.claude/taskplex/manifest-schema.json` | Document `criticCompleted` field |
| `~/.claude/taskplex/phases/planning.md` | Add instruction to set `criticCompleted = true` after critics return (all routes) |
