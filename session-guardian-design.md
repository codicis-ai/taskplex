# TaskPlex Session Guardian — Design Document

> **Origin**: Research into Claude Code's KAIROS (unreleased persistent background daemon) and safety classifier patterns. April 2026.
> **Status**: Design — not yet built.

## Background: What Claude Code Leaked

Two architectural patterns were discovered in Claude Code's source leak (v2.1.88, March 2026):

### KAIROS — Persistent Background Daemon

An always-on agent that:
- Receives periodic **tick** messages via the event queue (not user-triggered)
- On each tick: checks for actionable work in conversation history, pending tasks, running commands
- If work found → acts. If idle → calls `SleepTool` (yields, saves API cost)
- Auto-backgrounds long-running commands after 15 seconds
- Uses **append-only daily logs** for memory (not rewriting MEMORY.md on every observation)
- A separate `/dream` command consolidates daily logs into structured knowledge nightly
- User input always preempts ticks (`priority: 'later'`)
- Referenced 150+ times in source, feature-flagged off in public build

**Tick mechanism** (from leaked source):
```typescript
const scheduleProactiveTick = 
  feature('PROACTIVE') || feature('KAIROS')
    ? () => {
        setTimeout(() => {
          const tickContent = `<${TICK_TAG}>${new Date().toLocaleTimeString()}</${TICK_TAG}>`
          enqueue({
            mode: 'prompt',
            value: tickContent,
            uuid: randomUUID(),
            priority: 'later',
            isMeta: true,
          })
          void run()
        }, 0)
      }
    : undefined
```

**15-second auto-backgrounding**:
```typescript
const ASSISTANT_BLOCKING_BUDGET_MS = 15_000;

if (feature('KAIROS') && getKairosActive() && isMainThread) {
  setTimeout(() => {
    if (shellCommand.status === 'running' && backgroundShellId === undefined) {
      assistantAutoBackgrounded = true;
      startBackgrounding(/* ... */);
    }
  }, ASSISTANT_BLOCKING_BUDGET_MS).unref();
}
```

### Safety Classifier — Secondary Model Oversight

A separate Sonnet 4.6 model that:
- Monitors the primary session's tool calls in real-time
- Evaluates each action against a permission schema
- Blocks risky operations before they execute
- Reviews subagent action history on completion
- Prepends security warnings if concerns found
- Writes structured audit logs for retrospective review

## Concept: TaskPlex Session Guardian

A background observer that runs alongside the TaskPlex workflow during implementation/QA phases — monitoring agent actions and workflow state, not executing tasks.

### What It Would Monitor

| Signal | What to Watch | Why |
|--------|--------------|-----|
| **Spec drift** | Compare each agent's file writes against spec.md sections | Implementation agents silently deviate from spec — coherence check catches this only AFTER agent returns |
| **Convention violations in real-time** | Watch file edits as they happen against conventions.json | Currently caught in validation (late). Catching during implementation is cheaper. |
| **Build health** | After each file write, check if `lsp_diagnostics` shows new errors | Currently waits for agent self-verification. Earlier signal = fewer compounding errors. |
| **Scope creep** | Track files modified vs files in spec's file map | Agent touching files not in spec = scope creep. Flag immediately. |
| **Token budget** | Monitor agent turn count approaching max_turns | Agents that are about to hit their limit should be warned, not surprised |
| **Cross-agent conflicts** | In Standard/Blueprint, watch if two agents modify overlapping files | File ownership is declared in file-ownership.json but not enforced in real-time |

### Architecture

```
                    ┌─────────────────────┐
                    │  TaskPlex Guardian   │
                    │  (background agent)  │
                    │                      │
                    │  Tick loop:          │
                    │  1. Read manifest    │
                    │  2. Check signals    │
                    │  3. Flag or sleep    │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
         File edits      Agent returns     Phase transitions
         (heartbeat      (worker handoff   (manifest.phase
          hook data)       summaries)        changes)
```

**Key constraint**: The guardian is **read-only + advisory**. It cannot edit files, block operations, or spawn agents. It writes alerts. The orchestrator and user decide whether to act.

This is deliberately weaker than Claude Code's safety classifier (which blocks). TaskPlex already has hard gates via hooks. The guardian fills the gap between "hook fires on every tool call" (too granular, no context) and "validation runs after everything is done" (too late).

## Implementation Options

### Option A: Hook-Based (no new agent)

Extend `tp-heartbeat` hook to run lightweight checks on each file edit:
- Compare edited file against spec file map → flag if not in scope
- Check file-ownership.json → flag if wrong agent owns the file
- Count modified files → warn if significantly exceeding spec's file map

**Pros**: No API cost, runs synchronously, already has hook infrastructure.
**Cons**: Hooks are simple JS — can't do semantic checks (spec drift, convention analysis). Limited to file reads and string matching.

### Option B: Background Agent (KAIROS-style)

Spawn a lightweight background agent (haiku) at the start of implementation that:
- Ticks every N file edits (not time-based — triggered by heartbeat hook incrementing a counter)
- Reads manifest + recent file changes
- Runs quick checks (convention grep, scope check, file ownership)
- Writes alerts to `.claude-task/{taskId}/guardian-alerts.md`
- Orchestrator reads alerts after each worker returns

**Pros**: Can do semantic analysis (is this edit consistent with spec?), scales to complex checks.
**Cons**: API cost per tick, adds latency, needs background agent support in the runtime.

### Option C: Hybrid (recommended)

The heartbeat hook does cheap checks (scope, ownership, file count) synchronously. When it detects something suspicious, it spawns a one-shot haiku agent for deeper analysis.

**Pros**: Zero cost when things are fine, smart analysis when they're not. Best of both.
**Cons**: Slightly more complex hook logic.

**Recommendation**: Start with Option A, design for Option C, defer Option B until KAIROS-style background agents ship publicly.

## autoDream for TaskPlex: Continuous Observation Logging

KAIROS's `/dream` consolidation maps to memplex knowledge persistence at completion. TaskPlex already does this — at task end, it saves file couplings, error resolutions, patterns, decisions.

The difference: KAIROS accumulates observations continuously (append-only daily logs) and consolidates later. TaskPlex writes knowledge in one batch at the end.

**Proposed enhancement**: The guardian (or heartbeat hook) maintains an append-only observation log during the task:

```markdown
<!-- .claude-task/{taskId}/observations.md — append-only -->
[14:32] agent-1: modified auth.ts (not in spec file map) — SCOPE WARNING
[14:33] agent-1: circular import between auth.ts and session.ts — tried extract types approach
[14:35] agent-2: modified shared/types.ts (owned by agent-1) — OWNERSHIP CONFLICT
[14:38] agent-1: 3 build-fix rounds on auth module, solution was extracting types to types.ts
```

At completion, the memplex persistence step reads this log and extracts richer knowledge than the current one-shot approach:
- "auth.ts and session.ts have circular import risk — solution is type extraction"
- "agent touching shared/types.ts causes ownership conflicts in multi-agent mode"

This is a **memplex enhancement** — the observation log feeds better knowledge into the existing persistence pipeline.

## Runtime Feasibility

| Runtime | Background Agent Support | Guardian Feasible? |
|---------|------------------------|-------------------|
| Claude Code | `run_in_background` parameter on Agent tool | Yes — spawn guardian at implementation start |
| Cursor | Async subagents (run to completion by default) | Yes — native |
| OpenCode | Custom agents + Bun shell | Yes — plugin can manage lifecycle |
| Pi | `pi.on("tool_result")` + extension state | Partial — hook-based only (no background agents yet) |
| Codex | Multi-agent v2 | Yes — but limited hook triggers |
| Gemini CLI | Multi-registry subagents | Yes |
| Windsurf | No subagents | No — hook-based only |
| Antigravity | Manager View | Yes — natural fit |

## Implementation Phases

### Phase 1: Hook Extension (Option A)

Extend `tp-heartbeat.mjs`:
1. On each file edit, read `spec.md` file map (cache after first read)
2. Check if edited file is in scope → write warning to guardian-alerts.md if not
3. Check file-ownership.json → warn on ownership violations
4. Track cumulative file count → warn if exceeding spec by >50%

**Estimated effort**: Small — heartbeat hook already fires on every edit. Adding 3 checks with cached file reads.

### Phase 2: Observation Log

Add append-only logging to heartbeat hook:
1. Log every file edit with timestamp, agent ID, file path
2. Log warnings (scope, ownership, build failures)
3. At task completion, memplex persistence reads the log

**Estimated effort**: Small — append to a file on each heartbeat tick.

### Phase 3: Hybrid Trigger (Option C)

Add threshold detection to heartbeat hook:
1. Define trigger conditions (3+ scope warnings, ownership conflict, build failure after 2+ rounds)
2. When triggered, spawn one-shot haiku agent with recent observations
3. Haiku agent reads spec + observations + recent file changes → writes analysis to guardian-alerts.md
4. Orchestrator checks guardian-alerts.md after each worker returns

**Estimated effort**: Medium — needs trigger logic, one-shot agent spawning from hook context.

### Phase 4: Full Background Agent (Option B, deferred)

Wait for KAIROS-style background agent support in Claude Code:
1. Spawn guardian agent at implementation start with `run_in_background: true`
2. Guardian ticks on heartbeat counter (not time)
3. Full semantic analysis on each tick
4. Continuous alert stream

**Estimated effort**: Medium-large — needs background agent lifecycle management, tick mechanism.

## Open Questions

1. **Should the guardian be able to STOP an agent?** Current design is advisory-only. But if an agent is 15 turns deep on a file outside its scope, an early stop saves tokens. This crosses from "observer" to "enforcer" — different trust model.

2. **How does the guardian interact with the orchestrator?** If the orchestrator is dormant while agents run (execution continuity rule), who reads the guardian's alerts? Options: (a) orchestrator checks alerts between agent dispatches, (b) alerts inject into the orchestrator's context, (c) alerts are user-facing only.

3. **Cost model for Option B**: At haiku rates, how many ticks per task? If each tick is ~500 tokens input + 200 tokens output, and a typical task has 50-100 file edits, that's 10-20 ticks (every 5 edits) = ~14K tokens = ~$0.01. Negligible. But if the model hallucinates and generates verbose responses, costs compound.

4. **Should observation logs persist across tasks?** KAIROS uses daily logs that accumulate across sessions. TaskPlex observations are per-task. Cross-task patterns ("agent-1 always struggles with auth module") would be valuable but are currently memplex's domain.

## References

- [KAIROS Architecture Deep Dive (Substack)](https://codepointer.substack.com/p/claude-code-architecture-of-kairos)
- [Claude Code Source Leak — The New Stack](https://thenewstack.io/claude-code-source-leak/)
- [Claude Code Leak: KAIROS Permanent Agent (Idlen)](https://www.idlen.io/news/claude-code-leak-source-code-kairos-permanent-agent-undercover-mode-anthropic)
- [KAIROS and autoDream (ThePlanetTools)](https://theplanettools.ai/blog/claude-code-kairos-autodream-ai-never-sleeps)
- [Claude Code Architecture (WaveSpeedAI)](https://wavespeed.ai/blog/posts/claude-code-agent-harness-architecture/)
