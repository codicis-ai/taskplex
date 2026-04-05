# PRD: Session Guardian — Behavioral Enforcement Layer

> **Status**: Design — build after workflow enforcement gates are in place
> **Priority**: Medium — addresses behavioral failures that structural gates cannot catch
> **Scope**: Hook extensions (Phase 1), hybrid agent triggers (Phase 2), full background agent (Phase 3)
> **Dependencies**: `prd-workflow-enforcement.md` (Layer 1 — structural gates) must ship first
> **Reference**: `session-guardian-design.md` for full technical design and KAIROS research

## Problem Statement

TaskPlex has two enforcement layers today:
1. **Hooks** — fire on every tool call, enforce binary state checks (design gate, implementation gate, wave gate, pre-commit gate)
2. **Phase instructions** — prompt-level rules the agent should follow (execution continuity, dispatch sequencing, critic ordering)

Layer 1 is reliable. Layer 2 is not. Agents ignore prompt instructions under context pressure — they skip steps, stop to ask, dispatch workers out of order, and drift from the spec during long implementation runs.

The companion PRD (`prd-workflow-enforcement.md`) converts the most critical Layer 2 failures into Layer 1 gates: critic completion, user acknowledgment. But several failure classes **cannot be expressed as binary state checks**:

| Failure | Why hooks can't catch it |
|---------|------------------------|
| Agent stops to ask "should I continue?" during implementation | No file write happens — no hook fires |
| Agent builds momentum and skips a "small" step | Hook only fires on the write, not on the intent to skip |
| Agent dispatches workers before all dependencies are met | Workers haven't written files yet — wave gate hasn't fired |
| Implementation drifts from spec (scope creep, wrong approach) | Hook sees the file write but doesn't know the spec |
| Two agents modify the same file despite file ownership declarations | Both writes are individually valid — conflict only visible in aggregate |

These are **behavioral** failures — they require understanding what the agent is doing in context, not just checking a manifest field.

## Solution: Three-Phase Session Guardian

A background observation system that monitors workflow progression and agent behavior during implementation and QA phases. Layered on top of structural gates (Layer 1), not replacing them.

### Design Principles

1. **Read-only + advisory** — the guardian cannot edit files, block operations, or spawn agents. It writes alerts. The orchestrator and user decide whether to act. (Structural blocking stays with hooks.)
2. **Zero cost when things are fine** — no API calls, no background agents when the workflow progresses normally. Cost only incurred when deviations detected.
3. **Graceful degradation** — every check has a cheaper fallback. Full guardian unavailable? Hook-based checks still work. No background agents? One-shot haiku on trigger still works.

---

## Phase 1: Heartbeat Scope & Ownership Checks

**What**: Extend `tp-heartbeat.mjs` with cheap, synchronous checks on every file edit during implementation and QA phases.

**Note**: This adds a new code block to `tp-heartbeat.mjs`, separate from the execution continuity reminder added by `prd-workflow-enforcement.md`. The continuity reminder goes in `renderProgress()`. The guardian checks go in `main()`, before the manifest write. No merge conflict — they are independent additions.

### Scope Data Source

The PRD references "spec file map" — here is the concrete definition:

**Primary source**: `file-ownership.json` in `.claude-task/{taskId}/`. This is a structured JSON file written by the planning agent for Standard/Blueprint routes. It contains an exhaustive list of files per worker. The union of all `ownedFiles` arrays + `sharedFiles` array = the complete set of planned files.

**Fallback source**: If `file-ownership.json` does not exist (Light route, or planning agent didn't write it), extract file paths from `spec.md` by parsing the "File Map" table (lines matching `| path/to/file |`). This is a regex extraction, not semantic parsing.

**If neither exists**: Skip all scope checks. Log a note in observations but emit no warnings. This is the graceful degradation path.

### Agent Identity

The heartbeat hook does not receive agent identity in `hookInput`. To determine which agent is editing:

**Method**: Check the process environment. Spawned agents run as subprocesses. The orchestrator sets the worker ID in the agent prompt, but the hook cannot read the prompt. Instead, use the **file-ownership.json lookup in reverse**: if the edited file appears in exactly one worker's `ownedFiles`, the editor is that worker. If it appears in `sharedFiles` or multiple workers, the editor is ambiguous — log as "unknown agent" and skip ownership warnings for that edit.

**Limitation**: This is imperfect. An agent editing an unplanned file has no ownership entry, so identity is unknown. Phase 2's analysis agent can do deeper investigation when triggered.

### Checks Added

| Check | How | Alert |
|-------|-----|-------|
| **Scope check** | Compare edited file against planned file set (from file-ownership.json or spec), cached | "WARNING: {file} not in planned file set. Possible scope creep." |
| **Ownership check** | Reverse-lookup edited file in file-ownership.json, check inferred owner matches expected | "WARNING: {file} owned by {owner}, but edit context suggests different agent. Ownership conflict." |
| **File count check** | Count `manifest.modifiedFiles.length` vs planned file count | "WARNING: {N} files modified, plan specified {M}. Exceeding scope by {%}." |
| **Observation log** | Append every edit to `.claude-task/{taskId}/observations.md` | No alert — log only. Used by Phase 2+ and memplex at completion. |

**File count threshold**: Warn at >50% over plan. This threshold is initial and will be tuned based on real data from observation logs. If false positive rate exceeds 20% in the first 10 tasks, raise to 75%.

**Cache strategy**: `file-ownership.json` is read once and cached as a JS object in module scope. Cache invalidated by comparing file size (not mtime — mtime has 2-second granularity on Windows NTFS, which can miss rapid writes). File size change is a reliable signal that the file was rewritten. Planned file set derived on cache load. Per-edit cost after cache: object key lookup, <1ms.

**Alert output**: Warnings appended to the heartbeat hook's existing output message (the `result` field in the PostToolUse response). Repeated warnings for the same file are deduplicated via a `Set` in module scope (only alert once per file per hook process lifetime).

**Observation log format** (append-only, line-per-edit, parseable):
```
[2026-04-05T14:32:00Z] EDIT shared/src/types.rs owner:worker-0a status:in-scope
[2026-04-05T14:33:00Z] EDIT core/src/utils.rs owner:unknown status:OUT-OF-SCOPE
[2026-04-05T14:35:00Z] EDIT shared/src/types.rs owner:worker-0c status:OWNERSHIP-CONFLICT(expected:worker-0a)
```

**Log size**: One line per edit, ~100 bytes per line. A 500-edit task produces ~50KB. No rotation needed at this scale. If a task exceeds 2000 edits (unusual), the log will be ~200KB — still manageable. Phase 2 reads only the last 10 lines (`tail` equivalent), not the full file.

**At task completion**: Memplex persistence step reads `observations.md` and extracts patterns:
- Files that consistently trigger scope warnings → potential missing spec coverage
- Ownership conflicts → file coupling data for `write_knowledge`
- Agent behavioral patterns → cross-session learning

### Acceptance Criteria (Phase 1)

- AC-1.1: Heartbeat warns when edited file is not in planned file set (from file-ownership.json or spec.md)
- AC-1.2: Heartbeat warns on ownership conflicts when the inferred owner doesn't match file-ownership.json
- AC-1.3: Heartbeat warns when `manifest.modifiedFiles.length` exceeds planned file count by >50%
- AC-1.4: Observations log appended on every edit with timestamp, file, inferred owner, and status
- AC-1.5: File-ownership.json cached with size-based invalidation — per-edit overhead < 5ms
- AC-1.6: Warnings deduplicated per file per session (Set-based)
- AC-1.7: No warnings during design/planning/validation phases (only implementation + QA)
- AC-1.8: Missing file-ownership.json AND missing spec.md → skip all scope checks, no errors
- AC-1.9: Missing file-ownership.json WITH spec.md → fall back to regex file extraction from spec
- AC-1.10: Observation log created in `.claude-task/{taskId}/observations.md` (not blocked by design gate — this path is inside `.claude-task/`)

### Files Changed (Phase 1)

| File | Change |
|------|--------|
| `~/.claude/hooks/tp-heartbeat.mjs` | Add scope check, ownership check, file count check, observation log append (new code block in `main()` before manifest write) |
| `~/.claude/hooks/hook-utils.mjs` | Add `readPlannedFiles(taskPath)` with caching (reads file-ownership.json, falls back to spec.md regex) |

### Test Plan (Phase 1)

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Edit file in plan | Write `core/src/events.rs`, file in file-ownership.json | No warning, logged as "in-scope" |
| 2 | Edit file not in plan | Write `core/src/utils.rs`, not in any ownership list | Scope warning in output |
| 3 | Edit file, correct owner | Write `types.rs`, in worker-0a's ownedFiles, process is worker-0a context | No ownership warning |
| 4 | Edit file, wrong owner | Write `types.rs`, in worker-0a's ownedFiles, process is worker-0c context | Ownership warning |
| 5 | Edit shared file | Write `shared/types.ts`, in `sharedFiles` | No ownership warning (shared files are exempt) |
| 6 | Exceed file count | Modify 13 files when plan lists 8 | File count warning (62% over) |
| 7 | At threshold | Modify 12 files when plan lists 8 | File count warning (50% exactly — threshold is >) |
| 8 | No file-ownership.json, has spec | No ownership file, spec has File Map table | Falls back to spec regex, scope check works |
| 9 | No file-ownership.json, no spec | Neither file exists | No warnings, no errors, observation logged as "no-plan" |
| 10 | Repeated edit same file | Edit `types.rs` twice, out of scope | Warning only on first edit |
| 11 | Design phase edit | Edit during `phase: "init"` | No guardian checks, no observation log |
| 12 | Implementation phase edit | Edit during `phase: "implementation"` | Guardian checks run |
| 13 | QA phase edit | Edit during `phase: "qa"` | Guardian checks run |
| 14 | Validation phase edit | Edit during `phase: "validation"` | No guardian checks |
| 15 | Observation log append | Any edit during implementation | Line appended to observations.md |

---

## Phase 2: Hybrid Behavioral Detection

**What**: Add trigger conditions to the heartbeat hook that spawn a one-shot haiku agent for deeper analysis when accumulated signals cross a threshold.

**Architectural note**: Spawning an agent from a hook is novel for TaskPlex. The hook runs synchronously (PostToolUse). The approach: the hook writes a trigger file (`.claude-task/{taskId}/guardian-trigger.json`) and the heartbeat's output message includes "GUARDIAN TRIGGER: {reason}. Check guardian-alerts.md after next agent returns." The **orchestrator** (not the hook) spawns the haiku agent when it sees this message between worker dispatches. This avoids the sync/async timing problem — the hook stays synchronous, the orchestrator handles agent spawning in its normal flow.

**Triggers** (any one writes the trigger file):

| Trigger | Condition | Why |
|---------|-----------|-----|
| **Scope alarm** | 3+ distinct files outside plan in a single task | Likely systematic drift, not a one-off helper file |
| **Ownership conflict** | Any ownership violation in Standard/Blueprint route | Cross-agent file conflicts can cause merge failures |
| **Build loop** | `manifest.iterationCounts.buildFixRounds >= 3` | Approaching the hard limit — may need architectural intervention |

**Removed from original design**: "Stalled progress" trigger (80% turns / <50% spec coverage). This is unimplementable — `max_turns` is not persisted to the manifest, and "spec coverage percentage" is not tracked. If we need this, it requires a manifest schema addition first. Deferred to Phase 3 where the background agent has access to richer state.

**Analysis agent definition** (`~/.claude/agents/utility/session-guardian.md`):
```yaml
---
name: session-guardian
model: haiku
disallowedTools:
  - Edit
  - Write
  - NotebookEdit
  - Agent
  - Task
requiredTools:
  - Read
  - Glob
  - Grep
allowedTools: []
---
```

The agent can read files and search but cannot modify anything. It returns its analysis as a summary string. The orchestrator writes the alert to `guardian-alerts.md`.

**Analysis agent input** (provided by orchestrator):
- Last 10 lines from `observations.md`
- Relevant spec sections (for scope alarm: the file map; for build loop: the failing section)
- Manifest state (phase, iteration counts, modified files)
- The trigger reason

**Max turns**: 5 (read observations, read spec, read manifest, grep for patterns, return analysis).

**Alert format** (written by orchestrator from agent's return):
```markdown
## Guardian Alert — {timestamp}
**Trigger**: {which trigger fired}
**Analysis**: {agent's analysis, 1-3 sentences}
**Recommendation**: {specific action}
**Severity**: info | warning | urgent
```

**Orchestrator integration**: After each implementation worker returns, before dispatching the next, the orchestrator:
1. Checks if `guardian-trigger.json` exists
2. If yes: spawns session-guardian agent, writes alert to `guardian-alerts.md`, deletes trigger file
3. Reads `guardian-alerts.md` for any unread alerts
4. Urgent alerts → present to user
5. Warning alerts → factor into dispatch decisions
6. Info alerts → log only

### Acceptance Criteria (Phase 2)

- AC-2.1: Scope alarm trigger written after 3+ distinct out-of-scope files
- AC-2.2: Ownership conflict trigger written immediately on any conflict in multi-agent routes
- AC-2.3: Build loop trigger written when `iterationCounts.buildFixRounds >= 3`
- AC-2.4: Trigger file is JSON with `{ trigger, reason, timestamp, context }` structure
- AC-2.5: Session-guardian agent has `disallowedTools` enforcing read-only (Edit, Write, NotebookEdit, Agent, Task all blocked)
- AC-2.6: Orchestrator spawns analysis agent between worker dispatches (not from hook)
- AC-2.7: Alerts written to guardian-alerts.md with severity classification
- AC-2.8: No trigger file written when no conditions are met (zero cost baseline)
- AC-2.9: Trigger file deleted after analysis agent runs (prevents re-triggering on same event)

### Files Changed (Phase 2)

| File | Change |
|------|--------|
| `~/.claude/hooks/tp-heartbeat.mjs` | Add trigger condition evaluation, write trigger file when thresholds crossed |
| `~/.claude/agents/utility/session-guardian.md` | New agent definition (read-only analysis agent) |
| `~/.claude/taskplex/phases/planning.md` | Add orchestrator instruction to check guardian-trigger.json between dispatches |

### Test Plan (Phase 2)

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Scope alarm fires | 3 distinct out-of-scope edits in observations | Trigger file written with `trigger: "scope-alarm"` |
| 2 | Scope alarm doesn't fire | 2 out-of-scope edits | No trigger file |
| 3 | Ownership fires | 1 ownership conflict in Standard route | Trigger file written with `trigger: "ownership-conflict"` |
| 4 | Ownership in Light route | 1 ownership conflict, `executionMode: "light"` | No trigger (Light has no file ownership) |
| 5 | Build loop fires | `iterationCounts.buildFixRounds: 3` | Trigger file written with `trigger: "build-loop"` |
| 6 | Build loop below threshold | `buildFixRounds: 2` | No trigger |
| 7 | Guardian agent read-only | Agent attempts Edit tool | Blocked by disallowedTools |
| 8 | Orchestrator reads trigger | Trigger file exists between dispatches | Orchestrator spawns guardian, writes alert, deletes trigger |
| 9 | No trigger file | Normal execution, no thresholds crossed | No agent spawned, no cost |

---

## Phase 3: Full Background Agent (Deferred)

**What**: Persistent background agent running throughout implementation, receiving tick-based wake-ups (KAIROS pattern).

**Depends on**: Claude Code shipping background agent support (KAIROS is currently feature-flagged off). Or a runtime that natively supports persistent background agents (Cursor async subagents, OpenCode custom agents).

**Architecture**:
- Spawned at implementation start with `run_in_background: true`
- Ticks on heartbeat counter (every N file edits), not time-based
- Full conversational awareness — can detect patterns like "agent is composing a 'should I continue?' message"
- Continuous alert stream, not trigger-based
- Sleep between ticks (KAIROS SleepTool pattern) to minimize API cost

**What it adds over Phase 2**:
- **Conversational pattern detection** — catches execution continuity violations, momentum-based step skipping
- **Continuous monitoring** — not just triggered on thresholds, sees the full stream
- **Proactive nudges** — "Wave 1 dependencies met. Dispatch wave 1 workers now."
- **Stalled progress detection** — background agent CAN track turn count and spec coverage because it runs alongside the agent

**Deferred because**:
1. KAIROS-style background agents aren't publicly available in Claude Code yet
2. Phase 1 + Phase 2 cover the most impactful failure modes
3. The observation log from Phase 1 collects the data needed to design Phase 3's detection patterns

### Acceptance Criteria (Phase 3 — preliminary, will refine when building)

- AC-3.1: Background agent spawns at implementation start, receives ticks
- AC-3.2: Ticks are event-driven (heartbeat counter), not time-based
- AC-3.3: User input always preempts guardian ticks
- AC-3.4: Guardian detects execution continuity violations (agent pausing to ask)
- AC-3.5: Guardian detects step-skipping patterns (momentum past mandatory steps)
- AC-3.6: Guardian detects dispatch sequencing errors (wrong wave order)
- AC-3.7: API cost per task < $0.05 at haiku rates (bounded tick count)
- AC-3.8: Guardian sleeps when idle (no cost during worker execution)
- AC-3.9: Stalled progress detection (turn count vs spec coverage) — moved here from Phase 2

---

## Runtime Feasibility

| Runtime | Phase 1 | Phase 2 | Phase 3 |
|---------|:-------:|:-------:|:-------:|
| Claude Code | Yes (hook extension) | Yes (orchestrator spawns agent) | Deferred (needs KAIROS) |
| Cursor | Yes (plugin hook) | Yes (async subagent) | Yes (native async) |
| OpenCode | Yes (25+ hooks) | Yes (custom tool + agent) | Yes (plugin state machine) |
| Pi | Yes (tool_result event) | Partial (extension-based) | No (no background agents) |
| Codex | Partial (Bash-only hooks) | Partial (multi-agent v2) | Partial |
| Gemini CLI | Yes (BeforeTool) | Yes (multi-registry agent) | Yes (sandbox) |
| Windsurf | Yes (post_write_code) | No (no subagents) | No |
| Antigravity | Yes (VS Code ext) | Yes (Manager View) | Yes (natural fit) |

Note: Antigravity was added to the multi-runtime plan at priority 5 (Medium) earlier in this session. The feasibility assessment reflects the updated plan.

---

## Relationship to Workflow Enforcement Gates

```
Layer 1: Hook Gates (prd-workflow-enforcement.md)
  ├── Acknowledgment gate — blocks if user hasn't approved plan
  ├── Critic gate — blocks if critics haven't run (with artifact fallback)
  ├── Implementation delegated (existing) — blocks orchestrator inline coding
  └── Wave gate (existing) — blocks next wave until previous validated
  
  → Structural. Binary. Blocks tool calls. Catches state violations.
  → Build first. Works today.

Layer 2: Session Guardian (this PRD)
  ├── Phase 1: Scope + ownership + observation log (hook-based, zero cost)
  ├── Phase 2: Trigger-based analysis agent (haiku, cost on deviation only)
  └── Phase 3: Persistent background agent (deferred)
  
  → Behavioral. Contextual. Advisory (escalates to user for urgent).
  → Catches drift, sequencing, conversational patterns.
  → Build after Layer 1 gates are in place.
```

**Scope definition difference**: Layer 1 uses `isSourceFile()` (from hook-utils.mjs) to determine what gates block — this excludes config files, markdown, etc. Layer 2 uses the planned file set (from file-ownership.json or spec.md) to determine what's "in scope." These are different concepts and will sometimes disagree: editing a config file mentioned in the spec is "in scope" (guardian says fine) but "not a source file" (gate doesn't apply). This is correct behavior — the gate only blocks source code, the guardian tracks all planned files.

The guardian assumes gates exist. It doesn't try to block — it observes and advises. The gates are the safety net that catches failures the guardian misses or the agent ignores.

---

## Success Metrics

| Metric | How to Measure | Target |
|--------|---------------|--------|
| Scope creep detection | Observation log shows warnings that were actionable | >80% of scope deviations caught before worker returns |
| Ownership conflict detection | Warnings emitted before merge failure | 100% of conflicts detected (Phase 1 is deterministic given correct file-ownership.json) |
| False positive rate | Warnings that were not actual problems | <20% — tune 50% file count threshold from real data |
| API cost (Phase 2) | Haiku tokens per task with triggers | < $0.02 per task average |
| Workflow completion rate | Tasks completing without user intervention | Improve from current baseline (measured after Layer 1 gates ship) |

---

## Open Questions

1. **Should the guardian be able to STOP an agent?** Current design is advisory-only. But if an agent is 15 turns deep on a file outside its scope, an early stop saves tokens. This would cross from "observer" to "enforcer" — different trust model. **Decision: defer to Phase 3 evaluation.**

2. **Should observations persist across tasks?** KAIROS uses daily logs across sessions. TaskPlex observations are per-task. Cross-task patterns ("worker-0a always struggles with auth module") are valuable but are memplex's domain. **Decision: per-task logs, memplex extracts cross-task patterns at completion.**

3. **How does the guardian interact with the orchestrator during execution continuity?** The orchestrator is dormant while agents run. **Decision: orchestrator checks trigger files between worker dispatches (Phase 2). Phase 3 can inject into orchestrator context directly via tick messages.**

4. **What behavioral patterns should Phase 3 detect?** We need real data from Phase 1's observation logs. **Decision: collect data in Phase 1, design patterns for Phase 3 based on evidence.**

5. **File count threshold tuning**: The initial 50% threshold is a guess. After 10 tasks with observation logs, review false positive rate and adjust. If >20% false positives, raise to 75%. If <5%, consider lowering to 30%.
