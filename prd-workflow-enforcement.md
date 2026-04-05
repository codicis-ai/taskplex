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

## Solution (REVISED — artifact-based, not flag-based)

**Design principle**: Check what FILES exist on disk, not what the manifest CLAIMS happened. In the memplex session (TASK-20260405-realtime-knowledge), the agent set `criticCompleted: true`, `userAcknowledged: true`, and `implementationDelegated: true` without running critics, asking the user, or spawning agents. Flag-based gates are useless against an agent that pre-sets flags.

### Spec Gate (blocks first)

**Trigger**: Any source file write during `phase === "implementation"` or `phase === "qa"`.

**Check**: `spec.md` exists in `.claude-task/{taskId}/`. For Light route: `brief.md` must exist instead.

**Why**: A PRD is requirements input, not a spec. The planning phase must produce spec.md. This catches the entire "skip planning" failure class — you cannot implement without a spec.

**Route behavior**:
- **Light**: Requires `brief.md` only (no planning agent in Light route)
- **Standard / Team**: Requires `spec.md`
- **Blueprint**: Requires `spec.md`

**Escape hatch**: Create a minimal spec.md in the task directory.

### Critic Gate (blocks second, ARTIFACT-BASED)

**Trigger**: Any source file write during `phase === "implementation"` or `phase === "qa"`, when `executionMode` is `standard`, `team`, or `blueprint`.

**Check**: Review artifact files EXIST in `.claude-task/{taskId}/reviews/`. Does NOT check `manifest.criticCompleted` — flags are unreliable.

**Artifact detection per route**:
- **Blueprint**: Files matching `strategic-review*` or `tactical-review*`
- **Standard / Team**: Files matching `spec-review*`, `spec-critic*`, or `closure*`

**Light route**: Exempt. No critic step.

**Note**: `manifest.criticCompleted` remains as an informational field for progress tracking. The gate ignores it entirely.

**Escape hatch**: Create a review file in `.claude-task/{taskId}/reviews/`.

### Blueprint Artifact Gate (blocks third, Blueprint only)

**Trigger**: Source file write when `executionMode === "blueprint"`.

**Check**: `architecture.md` AND `file-ownership.json` must exist in `.claude-task/{taskId}/`.

**Why**: Without architecture and file ownership, there's no basis for multi-agent parallel execution.

**Escape hatch**: Create the missing files in the task directory.

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
1. Spec gate — blocks if spec.md missing (Standard/Team/Blueprint) or brief.md missing (Light)
2. Critic gate — blocks if no review artifacts in reviews/ (Standard/Team/Blueprint; Light exempt)
3. Blueprint artifact gate — blocks if architecture.md or file-ownership.json missing (Blueprint only)
4. Implementation delegated (existing) — blocks orchestrator source edits
5. Wave gate (existing) — blocks next wave until previous validated
```

All gates are artifact-based (check file existence), except Implementation delegated and Wave gate which remain flag-based (these are set AFTER agents are spawned, so the timing is correct).

During `phase === "validation"`: No new gates.

## What This Does NOT Fix

- **Agent stopping to ask during implementation** — The continuity reminder is advisory only. A full fix requires the Session Guardian (`prd-session-guardian.md`).
- **Agent dispatching workers in wrong order** — The wave gate partially covers this post-write.
- **Agent ignoring task list items** — Task lists remain informational.
- **Scope creep during implementation** — Addressed by Session Guardian Phase 1.
- **Agent pre-setting `implementationDelegated: true` without spawning agents** — This flag is still trusted. Mitigated by the fact that spec + critic + blueprint artifact gates run first, so the agent must at least produce all planning artifacts before reaching this gate.

## Acceptance Criteria

- AC-1: Standard/Team/Blueprint blocks source writes if `spec.md` does not exist
- AC-2: Light blocks source writes if `brief.md` does not exist
- AC-3: Blueprint blocks source writes if `reviews/` has no critic artifacts (checks file names, ignores manifest flags)
- AC-4: Standard/Team blocks source writes if `reviews/` has no spec-review/closure artifacts
- AC-5: Light is NOT blocked by critic gate
- AC-6: Blueprint blocks source writes if `architecture.md` or `file-ownership.json` missing
- AC-7: Heartbeat renders execution continuity reminder in progress.md during implementation/QA
- AC-8: Existing implementation delegated gate and wave gate continue to work (no regression)
- AC-9: Task artifact writes (`.claude-task/` paths) NOT blocked by any gate
- AC-10: Block messages include escape instructions (create the missing file)
- AC-11: Agent pre-setting `criticCompleted: true` in manifest does NOT bypass the critic gate (gate ignores the flag)

## Test Plan

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | No spec, Standard | Source write, no `spec.md` in task dir | Blocked: "No spec.md found" |
| 2 | Has spec, Standard | Source write, `spec.md` exists | Passes spec gate (continues to critic gate) |
| 3 | No brief, Light | Source write, `executionMode: "light"`, no `brief.md` | Blocked: "No brief.md found" |
| 4 | Has brief, Light | Source write, Light, `brief.md` exists | Passes (Light exempt from critic/blueprint gates) |
| 5 | No critic artifacts, Blueprint | Source write, Blueprint, no `reviews/` dir | Blocked: "No critic review artifacts" |
| 6 | Has critic artifacts, Blueprint | `reviews/strategic-review.md` exists | Passes critic gate |
| 7 | Flag set but no artifacts | `criticCompleted: true` in manifest, no review files | Blocked (gate ignores flag) |
| 8 | No critic artifacts, Standard | Source write, Standard, empty `reviews/` | Blocked: mentions spec critic |
| 9 | Has critic artifacts, Standard | `reviews/spec-review.md` or `reviews/closure.md` exists | Passes |
| 10 | Missing architecture, Blueprint | Has spec + reviews, no `architecture.md` | Blocked: "Missing architecture.md" |
| 11 | Missing file-ownership, Blueprint | Has spec + reviews + architecture, no `file-ownership.json` | Blocked: "Missing file-ownership.json" |
| 12 | All artifacts present, Blueprint | spec + reviews + architecture + file-ownership | Passes all gates (continues to impl delegated) |
| 13 | Task artifact write, no spec | Write to `.claude-task/spec.md` | Allowed (task artifacts bypass) |
| 14 | Non-source file write | Write `README.md`, no spec | Allowed (`isSourceFile` returns false) |
| 15 | Heartbeat during impl | File edit, `phase: "implementation"` | progress.md contains continuity reminder |
| 16 | Heartbeat during design | File edit, `phase: "init"` | No continuity reminder |
| 17 | PRD as plan source, no spec | `planSource.origin: "external-file"`, no spec.md | Blocked (PRD is input, not a spec) |

## Files Changed

| File | Change |
|------|--------|
| `~/.claude/hooks/tp-design-gate.mjs` | Spec gate + artifact-based critic gate + blueprint artifact gate inside `isSourceFile()` block |
| `~/.claude/hooks/tp-heartbeat.mjs` | Continuity reminder in `renderProgress()` during implementation/QA |
| `~/.claude/taskplex/phases/planning.md` | `criticCompleted` instruction retained as informational (gate does not read it) |
