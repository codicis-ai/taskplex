# taskplex: PRD Mode
<!-- Loaded by orchestrator when PRD mode is activated. Self-contained. -->

**Gate catalog**: `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/gates.md` — per-feature gate execution follows standard/architect route gates.

PRD mode is an orchestration layer over taskplex. Each feature becomes a separate taskplex invocation with pre-filled context from the PRD.

---

## ⚠️ Design Phase Gating (HARD RULE)

PRD mode uses the same `manifest.designPhase` sub-phase system as all other modes. The design sub-phases from `init.md` (convention-scan → convention-check → intent-exploration → approach-review → design-approval → brief-writing) MUST be completed first. PRD mode then continues with additional sub-phases:

```
brief-writing → prd-bootstrap → prd-critic → prd-approval → planning-active
```

The `tp-design-gate` hook **blocks artifact writes** if the sub-phase has not been reached:
- `prd.md`, `prd-state.json` — blocked until `designPhase = "prd-bootstrap"`
- `strategic-review.md`, `tactical-review.md` — blocked until `designPhase = "prd-critic"`

**You MUST update `manifest.designPhase` explicitly** after completing each step.

---

## PRD Phase 0.5: Product Brief (BEFORE bootstrap)

**designPhase: inherits from init.md Sub-phase B** — brief.md must already be written.

**This is the most critical step.** No code without clear intent.

**HARD RULE:** By the time PRD Phase 0.5 begins, the user has ALREADY been through the full design interaction in init.md (convention questions, clarifying questions, approach selection, design approval). The brief.md has been written from that approved design. Do NOT re-run the design interaction here.

Run the Product Brief agent to **formalize** the approved brief into PRD format:

> Read ${CLAUDE_PLUGIN_ROOT}/agents/product-brief.md
  Mode: PRD (full brief with component-grouped user stories)

The product-brief agent:
1. **Reads** the already-approved brief.md from init.md Sub-phase B
2. **Restructures** into PRD-format brief (component-grouped user stories, testable success criteria)
3. **Asks** MVP vs Full scope decision + 1-2 PRD-specific questions (feature granularity, wave strategy)
4. **Finalizes** the brief

After brief is confirmed, **set `manifest.designInteraction.prdBriefConfirmed = true`**:

1. Write `.claude-task/PRD-{id}/brief.md` with:
   - Problem statement, users
   - Component-grouped user stories (US-1, US-2...) with acceptance criteria (AC-1.1, AC-1.2...)
   - Scope (included vs excluded, MVP vs Full)
   - Success criteria (SC-1, SC-2... — must be TESTABLE)

2. Include the brief.md content in the PRD bootstrap prompt so features inherit it.

**Key principle**: The product brief is the CONTRACT. If it's not in brief.md, it's not a requirement.

## PRD Phase 1: Bootstrap

**→ Set `manifest.designPhase = "prd-bootstrap"` before spawning.**

> Spawn prd-bootstrap (opus) from ${CLAUDE_PLUGIN_ROOT}/agents/prd-bootstrap.md
  Context: user description, **product brief** (from Phase 0.5), INTENT.md, CONVENTIONS.md, CLAUDE.md, .schema/ overviews
  Writes: .claude-task/PRD-{timestamp}/prd.md, .claude-task/PRD-{timestamp}/prd-state.json
  Returns: "PRD bootstrapped: {N} features across {W} waves"

After bootstrap completes, append lifecycle metadata to `prd.md`:
```markdown
---
## Lifecycle Metadata
- processedByLifecycle: true
- lifecycleSource: /taskplex --prd
- briefGenerated: true
- conventionsRefreshed: true
- architectReviewed: false
- criticReviewed: false
- createdAt: {ISO timestamp}
```
The `architectReviewed` and `criticReviewed` flags are updated to `true` after Phases 1.5 and 2 complete respectively. This metadata is checked by `/taskplex` when the PRD is passed as input to a task.

## PRD Phase 1.5: Strategic Critic Reviews PRD

**→ Set `manifest.designPhase = "prd-critic"` before spawning.**

> Spawn strategic-critic (opus) from ${CLAUDE_PLUGIN_ROOT}/agents/strategic-critic.md
  Context: prd.md, INTENT.md, CONVENTIONS.md — review the PRD as a whole
  Writes: .claude-task/PRD-{id}/strategic-review.md
  Returns: "Verdict: APPROVED|NEEDS_REVISION"

- If NEEDS_REVISION: update prd.md per feedback, re-review (max per policy `limits.reviewResubmissions`)
- If REJECTED (deadlock after limit): mark PRD as `blocked:critic-deadlock`, notify user
- If APPROVED: update lifecycle metadata in prd.md: `architectReviewed: true`

## PRD Phase 2: Tactical Critic Reviews PRD

> Spawn tactical-critic (sonnet) from ${CLAUDE_PLUGIN_ROOT}/agents/tactical-critic.md
  Context: prd.md, CONVENTIONS.md, .schema/ docs — review per-feature specs
  Writes: .claude-task/PRD-{id}/tactical-review.md
  Returns: "Verdict: APPROVED|NEEDS_REVISION"

- Same escalation rules as Phase 1.5
- If APPROVED: update lifecycle metadata in prd.md: `criticReviewed: true`

## PRD Phase 2b: User Reviews PRD

**→ Set `manifest.designPhase = "prd-approval"` before presenting to user.**

**HARD RULE — STOP AND PRESENT TO THE USER. DO NOT AUTO-PROCEED.**

Present the critic-reviewed PRD to the user in a structured format:

1. **Initiative Overview**: Problem statement, target users, success criteria (from brief.md)
2. **Feature List**: Each feature with:
   - ID, name, complexity score
   - Dependencies (which features it depends on)
   - Brief description of what it delivers
3. **Wave Plan**: Which features execute in which wave, and why
4. **Risk Assessment**: Key risks, mitigations, assumptions
5. **Critic Feedback Summary**: What the critics flagged and what was changed

Then ask:
- `AskUserQuestion`: **Approve and proceed** / **Modify features** / **Cancel PRD**

**After user approves**: Set `manifest.designInteraction.prdUserReviewed = true`.

If the user modifies features, loop back to Phase 1 (re-bootstrap with changes). Do NOT proceed without explicit approval.

## PRD Phase 2c: Choose Execution Mode

`AskUserQuestion`: "How should features be executed?"

**Interactive mode** (Recommended):
- Each feature gets pre-filled context from PRD (replaces interview)
- Single confirmation per feature before implementation starts
- Critic reviews still happen per route (Standard/Architect features get reviewed)
- User sees progress updates between features

**Autonomous mode**:
- PRD context replaces Phase 0.5 interviews entirely
- Critic APPROVED = auto-proceed (no user confirmation)
- Drift from spec is logged but not prompted
- Deferred items fixed without prompting

**→ After user confirms execution mode, set `manifest.designInteraction.prdExecutionModeChosen = true` and `manifest.designPhase = "planning-active"`**
- HALT on critic deadlock (never proceed with rejected plan, mark `blocked:critic-deadlock`)

**Dual-write (F4)**: Write executionMode to **both** files:
1. `prd-state.json` → `executionMode` field (authoritative for PRD)
2. `manifest.json` → `executionMode` field (authoritative for hooks/resume)

Both files must agree. If either write fails, retry once then warn user.

## PRD Phase 2d: Branch Strategy (git integration)

If `manifest.git.available === true` and `manifest.git.config.createBranch === true`:
- Each wave gets its own branch: `feat/prd-{id}-wave{N}` (e.g., `feat/prd-20260305-wave0`)
- Wave 0 branch created from `manifest.git.baseBranch`
- Subsequent wave branches created from the merged result of the previous wave
- If git not available: skip all branch operations, execute on current working directory

## PRD Phase 3: Wave Execution

For each wave (0, 1, 2, ...):

1. Update `prd-state.json`: set wave status to `in-progress`
2. Emit trace span: `wave-start` with wave number and feature list
3. **Create wave branch** (if git available + createBranch): `git checkout -b feat/prd-{id}-wave{N}`

3. **Wave 0** (sequential on main branch):
   For each feature in wave 0:
   - Update prd-state.json: feature status = `in-progress`
   - Emit trace span: `feature-start`
   - **Feature attempt tracking (F2)**: Check `prd-state.json` feature attempt count. In autonomous mode, max per policy `limits.prdFeatureAttemptsAutonomous`. If at limit, mark `blocked:session-limit` and skip to next feature.
   - **Implementation dispatch (F1)**: Each feature is implemented via a one-shot implementation agent:
     1. Assemble context per `~/.claude/agents/context-assembly.md` using PRD feature requirements + Layer 0-3
     2. Pre-hydrate: files from feature spec, file_intelligence per primary file (if cm available)
     3. If Interactive: `AskUserQuestion` with pre-filled context — "Feature F{N}: {title}. Requirements: {summary}. Proceed?"
     4. If Autonomous: skip confirmation, proceed directly
     > Spawn implementation-agent (sonnet) from ${CLAUDE_PLUGIN_ROOT}/agents/implementation-agent.md
       Pre-hydrate: files from feature spec, file_intelligence per primary file
       Context: assembled payload (Layers 0-4), feature requirements, max_turns: 30
       Writes: source code changes, deferred items
       Returns: "STATUS: completed|blocked. FILES_MODIFIED: [...]. BUILD: pass|fail."
     5. On return: update `manifest.modifiedFiles`, update `prd-state.json` feature status
     6. The orchestrator NEVER writes implementation code in PRD mode — only dispatch + state tracking
   - Update prd-state.json: feature status = `completed` or `failed`
   - Emit trace span: `feature-complete` or `feature-failed`
   - If failed: mark dependent features as `blocked`, continue to next feature

4. **Wave 1+** (parallel via worktrees OR sequential):
   - If worktrees available: spawn each feature in isolated worktree via implementation-agent
   - If not: execute sequentially on main branch via implementation-agent
   - Same one-shot dispatch pattern as Wave 0
   - Each feature updates prd-state.json on completion
   - Fan-out/fan-in tracking in session file
   - Feature attempt limit (F2): per policy `limits.prdFeatureAttemptsAutonomous`, then `blocked:session-limit`

## PRD Phase 4: Wave Merge

After each wave completes:

1. List completed feature branches
2. **Merge strategy** (from `manifest.git.config.mergeStrategy`, default `squash`):
   - `squash`: `git merge --squash {feature-branch}` then `git commit -m "feat(prd): wave {N} - {summary}"`
   - `merge`: `git merge --no-ff {feature-branch}`
   - `rebase`: `git rebase {feature-branch}`
3. For each branch, merge into the wave branch (or main if no wave branching):
   - Apply the configured merge strategy
   - If conflicts:
     > Spawn merge-resolver (sonnet) from ${CLAUDE_PLUGIN_ROOT}/agents/merge-resolver.md
       Context: source branch, target branch, conflict files, feature descriptions
       Returns: "Merge resolved: {N} files. Typecheck: PASS/FAIL"
   - If merge-resolver fails: mark feature as `blocked:merge-conflict`, notify user
3. Run typecheck + lint on merged result
4. Update prd-state.json: wave status = `completed`

## PRD Phase 5: Finalization

1. **Cross-Feature Intent Check** (before per-feature validation):
   > Spawn closure-agent (haiku) from ${CLAUDE_PLUGIN_ROOT}/agents/closure-agent.md
     Context: `.claude-task/PRD-{id}/brief.md`, aggregated modifiedFiles from all completed features (from prd-state.json), planning artifact = `prd.md`
     Writes: `.claude-task/PRD-{id}/reviews/cross-feature-closure.md`
     Returns: "PASS" | "FAIL: {what's missing}"

   The closure agent verifies cross-cutting requirements (e.g., "all pages use same auth pattern", "consistent error handling") that span multiple features. If FAIL: report to user before proceeding with per-feature validation.

2. Run full Validation Pipeline across the merged result
3. Generate final report:
   ```markdown
   ## PRD Completion Report: {title}

   ### Features
   | ID | Title | Status | Complexity | Route |
   |----|-------|--------|------------|-------|
   | F0 | ... | completed | 3 | express |
   | F1 | ... | completed | 6 | standard |

   ### Issues Encountered
   - {any failures, blocks, merge conflicts}

   ### Convention Violations Fixed
   - {any violations caught and fixed during code review}

   ### Files Changed
   - {complete list}
   ```
4. **PRD PR Creation** (if git available + createPR + pushed):
   - One comprehensive PR covering the entire initiative (not per-feature)
   - PR title: `feat(prd): {initiative title}` (max 70 chars)
   - PR body includes: initiative overview, feature completion table, wave summary, cross-feature closure result, quality gate summary, files changed
   - Uses same G4-G5 flow from completion.md (push confirmation → PR creation via `gh`)
   - Labels: `route:prd`, `profile:{profile}`
   - Store PR URL in `prd-state.json` and `manifest.git.prUrl`
5. Present to user
6. Clean up: archive prd-state.json

## PRD Failure Handling

- **Feature failure**: Mark feature as `failed`, mark dependents as `blocked` (not `skipped` — blocked is resumable)
- **Merge conflict**: Try merge-resolver. If unresolvable, mark as `blocked:merge-conflict`
- **Critic deadlock**: After 2 revision rounds, mark as `blocked:critic-deadlock`
- **User can resume**: `blocked` features can be retried. `skipped` is terminal.

## PRD Status Tracking (prd-state.json)

```json
{
  "prdId": "PRD-{timestamp}",
  "title": "Initiative Title",
  "status": "in-progress|completed|paused|blocked",
  "executionMode": "interactive|autonomous",
  "createdAt": "ISO timestamp",
  "features": {
    "F0": {
      "title": "Feature title",
      "complexity": 3,
      "route": "express|standard|architect",
      "wave": 0,
      "status": "pending|in-progress|completed|failed|blocked",
      "dependencies": [],
      "worker": "worktree-branch-name|null",
      "phase": "planning|spec-review|implementing|code-review|validating|done",
      "startedAt": "ISO|null",
      "completedAt": "ISO|null",
      "blockedBy": "merge-conflict|critic-deadlock|dependency-F{N}|null",
      "notifications": []
    }
  },
  "waves": {
    "0": { "status": "pending|in-progress|completed", "features": ["F0"] },
    "1": { "status": "pending|in-progress|completed", "features": ["F1", "F2"] }
  },
  "currentWave": 0,
  "mergeResults": {},
  "finalReport": null
}
```

## PRD Resume Flow

On session start (handled by session-start hook):
1. Scan `.claude-task/PRD-*` directories for `prd-state.json`
2. If found with `status: 'in-progress'` or `status: 'paused'`:
   - Display PRD status to user
   - User runs `/taskplex --prd` to resume
3. Resume picks up from last incomplete wave/feature

**Execution mode recovery (F4):**
On resume, re-read and apply executionMode:
1. Read `prd-state.json.executionMode` (authoritative for PRD)
2. If present: apply immediately, ensure `manifest.json.executionMode` matches (sync if needed)
3. If missing: `AskUserQuestion` (same as Phase 2c — Interactive or Autonomous)
4. Write chosen mode to both files (dual-write)

For non-PRD resume:
1. Read `manifest.json.executionMode`
2. If present: apply (future-proofing for when non-PRD autonomous is added)
3. If missing: default to interactive (no prompt)
