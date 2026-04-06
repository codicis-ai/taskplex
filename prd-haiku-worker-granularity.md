# PRD: Haiku-Compatible Worker Granularity (Revised)

> **Status**: Ready to build
> **Priority**: High — directly impacts cost, reliability, and multi-model support
> **Scope**: Architect agent, planning agent, worker brief format, implementation agent
> **Estimated effort**: Half day (prompt updates, no hook changes)
> **Revision**: Incorporates all 7 fixes from tactical critic review

## Problem Statement

Worker briefs vary wildly in complexity. Worker 0A (apple-notes event-engine) is "add these exact types to this file" — Haiku can do it. Worker 1C is "create a large routes file + integrate AppState + spawn engine + wire evaluator + add scheduler job" across 4 files — Haiku will fail, even Sonnet struggles.

The architect decides decomposition with no constraint on per-worker complexity. The result: some workers need Opus-level reasoning while others are copy-paste. This forces all workers to run on Sonnet (expensive, slow) when most work is mechanical.

**Goal**: Every worker brief must be completable by Haiku by default. If it's not, the architect must either decompose further OR flag the worker as `model: sonnet`. The architect does the thinking; workers do the typing.

## The Granularity Rule

**Every worker brief must pass the Haiku Test:**

1. **Max 2 files** — create 1, modify 1 (or modify 2, or create 2 small ones)
2. **Exact code provided** — the brief contains the actual code to write, not a description of what to design
3. **Zero architectural decisions** — "put this code here," never "figure out how to connect these"
4. **Single concern** — one verb: "add types," "create handler," "wire import" — not "create + integrate + wire + add"
5. **Single verification command** — `cargo check -p {crate}` or `npm run typecheck`
6. **No cross-file reasoning** — the worker doesn't need to understand how their file connects to other workers' files
7. **Within a wave, no two workers write the same file** — prevents merge conflicts. If two changes target the same file, put them in sequential waves.
8. **Reference snippets inline** — don't point to a 500-line file and say "follow this pattern." Include the relevant 10-20 lines in the brief.

**If a brief fails any criterion, either split it OR flag it as `model: sonnet`.**

## Model Escape Hatch (Required Feature)

Not all work can be reduced to exact code. Some tasks require reasoning:

- **Refactoring** — restructuring existing code across multiple files
- **Complex integration** — wiring systems where the exact code depends on runtime behavior
- **Test writing** — meaningful tests require understanding the code under test

The architect MUST flag these workers explicitly:

```markdown
---
model: sonnet
reason: "Refactoring task — needs to understand existing code structure"
---
```

**Default**: `model: haiku` (not specified in frontmatter — Haiku is the baseline).
**Override**: `model: sonnet` when the Haiku Test cannot be met. The architect must state why.

The goal is 80%+ workers on Haiku, not 100%. Forcing 100% would degrade quality on tasks that genuinely need reasoning.

## Bug Recovery Protocol

The architect writes code without running it. Some of that code will have bugs — wrong field names, missing imports, type mismatches. When a Haiku worker's verify command fails:

**Round 1 — Self-fix attempt (Haiku):**
The implementation agent already has 3 build-fix rounds in its protocol. Haiku can fix simple issues: missing imports, typos, wrong field names. The brief's "Exact Code" section gives it the intent — it can patch obvious errors.

**Round 2 — Escalate to Sonnet fixer:**
If Haiku fails after 3 rounds, the orchestrator spawns `build-fixer` (Sonnet) with:
- The original brief
- The error output
- The worker's current file state

Sonnet has the reasoning to understand WHY the code is wrong and fix it.

**Round 3 — Escalate to user:**
If Sonnet fixer also fails (rare — usually means the architect's design is wrong), escalate with a structured report. This is the existing escalation protocol.

**Key insight**: Most architect code bugs are simple (wrong import path, missing derive, wrong field name). Haiku can fix these. The 3-round self-fix handles 80% of cases. Sonnet fixer handles 19%. User escalation is the 1%.

## Test Ownership

The PRD previously removed tests from worker briefs without saying who writes them. Here's the explicit design:

**Per-worker**: No unit tests. Workers apply code and run `cargo check` / `npm run typecheck`. They do not write tests. This keeps briefs simple and Haiku-compatible.

**Per-wave (after merge)**: The wave validation step includes:
1. Build check (existing)
2. Run existing tests (existing — regression check)
3. **Test worker**: The architect includes 1-2 dedicated test workers per wave. These are flagged `model: sonnet` because writing meaningful tests requires reasoning.

```
Wave 2: Routes (parallel)
  Worker 2A: Event rule CRUD routes        [haiku, exact code]
  Worker 2B: Webhook receiver routes       [haiku, exact code]
  Worker 2C: Wire module into router       [haiku, 3 lines]
  Worker 2D-test: Tests for Wave 2 routes  [sonnet, writes tests for 2A+2B]
```

The test worker runs AFTER the implementation workers merge but WITHIN the wave (before wave validation declares the wave complete). This way:
- Implementation workers are Haiku (cheap, fast)
- Test workers are Sonnet (can reason about edge cases)
- Wave validation has tests to run

## Same-File Rule

**Within a wave, no two workers may write the same file.**

If two changes need to go to the same file, they must be in sequential waves:

```
// WRONG — merge conflict
Wave 3 (parallel):
  Worker 3A: CRUD routes in events.rs
  Worker 3B: Webhook routes in events.rs    ← SAME FILE

// RIGHT — sequential
Wave 3: Worker 3A: CRUD routes in events.rs
Wave 4: Worker 3B: Add webhook routes to events.rs (depends on 3A)
```

The architect must verify this when writing file-ownership.json. The wave gate already blocks next-wave writes until previous wave validates — this naturally enforces the sequential ordering.

## Worktree Cap

**Maximum 8 concurrent worktrees per wave.** Excess workers queue and dispatch after the first batch completes.

Rationale: 17 concurrent worktrees = 17 full repo checkouts. For large projects (Rust workspace, monorepo), this causes disk pressure and slow git operations. 8 is the practical limit for most systems.

If a wave has 10 workers: dispatch 8 in parallel, wait for completions, dispatch remaining 2 into freed worktree slots.

This limit is set in `policy.json` as `limits.maxParallelWorkers` (default: 8, max: 12).

## Reference Snippet Rule

Workers should not need to read large files to find anchor points. The architect must:

**Include relevant context inline** in the brief:

```markdown
## Exact Code

Find the `impl AppState` block in `api/src/main.rs`. The block currently looks like:

```rust
// EXISTING (for context — do NOT rewrite this):
impl AppState {
    pub fn new(supabase: SupabaseClient, pa: PaService) -> Self {
        Self { supabase, pa, scheduler: None }
    }
}
```

Change to:

```rust
impl AppState {
    pub fn new(supabase: SupabaseClient, pa: PaService) -> Self {
        Self { supabase, pa, scheduler: None, event_engine: None }
    }
}
```

Also add this field to the struct definition (find `pub struct AppState`):

```rust
pub event_engine: Option<Arc<EventEngine>>,
```
```

**Maximum reference file size**: If the worker needs to read a reference file, it must be < 200 lines. If larger, the architect extracts the relevant section into the brief.

## Cost Model

Rough estimate based on current API pricing (Opus $15/Sonnet $3/Haiku $0.25 per 1M input tokens):

**Current (5 Sonnet workers, lean architect):**
| Component | Tokens | Cost |
|-----------|--------|------|
| Architect (Opus) | ~50K in + 30K out | ~$1.50 |
| 5 workers (Sonnet) | ~150K in + 100K out | ~$0.75 |
| **Total** | | **~$2.25** |

**Proposed (15 Haiku workers, detailed architect):**
| Component | Tokens | Cost |
|-----------|--------|------|
| Architect (Opus) | ~150K in + 80K out | ~$3.45 |
| 13 workers (Haiku) | ~100K in + 50K out | ~$0.04 |
| 2 test workers (Sonnet) | ~40K in + 30K out | ~$0.21 |
| **Total** | | **~$3.70** |

**Verdict**: More expensive per task (~$1.45 more), not cheaper. The cost saving claim was wrong.

**BUT** — the value proposition is not cost, it's **reliability and speed**:
- 13 parallel Haiku workers complete in ~30s each vs 5 sequential Sonnet workers at ~2-3min each
- Haiku applying exact code has higher success rate than Sonnet interpreting vague briefs
- Failed workers are cheaper to retry ($0.003 vs $0.15)
- Wave merge catches integration issues early (more, smaller merges)

**Revised value proposition**: Haiku workers are **faster and more reliable**, not cheaper. The architect investment pays for itself in fewer failed workers, fewer fix rounds, and faster wall-clock time.

## Decomposition Example (Revised — Fixes Same-File Rule)

**Worker 1C decomposed with same-file rule applied:**

```
Wave 1: Core modules (parallel — no file overlaps)
  Worker 1A: Create events.rs — EventBus + EventEngine  [haiku, 1 new file]
  Worker 1B: Create rules.rs — RuleEvaluator             [haiku, 1 new file]
  Worker 1C: Create actions.rs — ActionExecutor           [haiku, 1 new file]

Wave 2: Wiring (parallel — no file overlaps)
  Worker 2A: Add EventEngine to AppState (main.rs)        [haiku, 1 file]
  Worker 2B: Add event_cleanup to scheduler.rs            [haiku, 1 file]
  Worker 2C: Wire events module into routes/mod.rs        [haiku, 1 file, 3 lines]

Wave 3: Routes — CRUD (single worker per file)
  Worker 3A: Create events.rs with CRUD routes            [haiku, 1 new file]

Wave 4: Routes — Webhooks (builds on 3A's file)
  Worker 4A: Add webhook_routes() to events.rs            [haiku, 1 file, adds to 3A's file]
  Worker 4B: Add event history + health routes to events.rs... 
```

Wait — this creates too many sequential waves for one file. Better approach:

```
Wave 3: All routes (single worker — this file is too interconnected to split)
  Worker 3A: Create events.rs with ALL routes             [sonnet, 1 new large file]
  ← model: sonnet because this is a large file with interconnected handlers
```

**Lesson**: Not everything should be Haiku. The architect uses judgment: split where clean boundaries exist, keep together where splitting creates worse problems.

## Acceptance Criteria

- AC-1: Architect agent prompt includes the Haiku Test criteria and worker sizing rule
- AC-2: Worker brief format updated — "Exact Code" section mandatory, reference snippets inline
- AC-3: Planning agent prompt includes section sizing guidance
- AC-4: Implementation agent prompt clarifies execution model (apply code, don't design)
- AC-5: Architect can flag workers as `model: sonnet` with reason
- AC-6: Implementation agent default model is `haiku` in frontmatter
- AC-7: Brief quality checklist updated to include Haiku Test + same-file rule
- AC-8: Bug recovery protocol defined: Haiku self-fix (3 rounds) → Sonnet fixer → user escalation
- AC-9: Test workers included per wave, flagged `model: sonnet`
- AC-10: Same-file rule enforced: within a wave, no two workers write the same file
- AC-11: Worktree cap set in policy.json (default 8)
- AC-12: Reference snippet rule: max 200-line reference files, architect inlines relevant sections

## Test Plan

| # | Test | Expected |
|---|------|----------|
| 1 | Architect writes briefs for complex task | 80%+ briefs pass Haiku Test, remainder flagged `model: sonnet` |
| 2 | Haiku receives well-formed brief | Applies code correctly, verify passes |
| 3 | Haiku verify fails (architect bug) | Self-fix succeeds within 3 rounds |
| 4 | Haiku self-fix fails | Sonnet build-fixer spawned and resolves |
| 5 | Wave with 8 parallel Haiku workers | All complete, wave merge succeeds |
| 6 | Wave with same-file conflict detected | Architect splits into sequential waves |
| 7 | Test worker writes tests post-merge | Tests cover the wave's implementation |
| 8 | Sonnet-flagged worker for refactoring | Completes task requiring code understanding |
| 9 | Worker brief points to 500-line reference | Architect inline-quotes relevant 20 lines instead |
| 10 | 12 workers in a wave | First 8 dispatch, remaining 4 queue, all complete |

## Files to Change

| File | Change |
|------|--------|
| `~/.claude/agents/core/architect.md` | Add Haiku Test, worker sizing rule, same-file rule, reference snippet rule, test worker guidance, `model:` frontmatter in briefs |
| `~/.claude/agents/core/planning-agent.md` | Add section sizing guidance |
| `~/.claude/agents/core/implementation-agent.md` | Clarify execution model, change default model to haiku, bug recovery protocol |
| `~/.claude/taskplex/phases/planning.md` | Update worker dispatch to respect worktree cap, use haiku default |
| `~/.claude/taskplex/policy.json` | Add `limits.maxParallelWorkers: 8` |

## Resolved Questions

1. **Model selection per worker**: Required feature. Architect flags `model: sonnet` when Haiku Test can't be met. Default is Haiku.

2. **Wave validation with more workers**: Same process — build + test after merge. More workers means more merges per wave, but each is smaller and lower-risk. Worktree cap prevents scaling issues.

3. **Architect time increase**: Yes — 3x more tokens. But the value is speed and reliability, not cost. Revised cost model shows ~$1.45 more per task, but faster wall-clock and fewer retries.

4. **Standard route**: Planning agent writes sections with more description, less exact code. Standard workers default to Sonnet. Path to Haiku as planning agent specs become more prescriptive over time. Not blocked.

5. **Refactoring tasks**: Flagged `model: sonnet`. The Haiku Test identifies these — "zero architectural decisions" criterion fails for refactoring, so the architect flags it.

6. **Test ownership**: Architect includes test workers per wave, flagged `model: sonnet`. Tests run post-merge, within the wave, before wave validation completes.

7. **Same-file conflicts**: Within-wave rule enforced. Architect must verify file-ownership.json has no same-file conflicts per wave. If unavoidable (interconnected file), keep as single Sonnet worker instead of splitting.
