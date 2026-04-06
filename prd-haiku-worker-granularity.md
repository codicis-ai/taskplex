# PRD: Haiku-Compatible Worker Granularity

> **Status**: Ready to build
> **Priority**: High — directly impacts cost, reliability, and multi-model support
> **Scope**: Architect agent, planning agent, worker brief format, implementation agent
> **Estimated effort**: Half day (prompt updates, no hook changes)

## Problem Statement

Worker briefs vary wildly in complexity. Worker 0A (apple-notes event-engine) is "add these exact types to this file" — Haiku can do it. Worker 1C is "create a large routes file + integrate AppState + spawn engine + wire evaluator + add scheduler job" across 4 files — Haiku will fail, even Sonnet struggles.

The architect decides decomposition with no constraint on per-worker complexity. The result: some workers need Opus-level reasoning while others are copy-paste. This forces all workers to run on Sonnet (expensive, slow) when most work is mechanical.

**Goal**: Every worker brief must be completable by Haiku. If it's not, the architect must decompose further. The architect does the thinking; workers do the typing.

## Evidence

From `apple-notes/.claude-task/event-engine-v1/workers/`:

**Worker 0A** (Haiku-compatible):
- 1 file to modify
- Exact code provided (200 lines of Rust, copy-paste)
- Single verification: `cargo check -p shared`
- Clear "do not touch" boundaries
- Result: any model can complete this

**Worker 1C** (NOT Haiku-compatible):
- 4 files to create/modify
- Architectural decisions required (how to wire AppState, how to structure routes)
- Multiple concerns (CRUD routes + webhook routes + scheduler integration + AppState wiring)
- Integration reasoning needed (understanding how EventBus, RuleEvaluator, ActionExecutor connect)
- Result: needs Sonnet minimum, ideally Opus

## The Granularity Rule

**Every worker brief must pass the Haiku Test:**

1. **Max 2 files** — create 1, modify 1 (or modify 2, or create 2 small ones)
2. **Exact code provided** — the brief contains the actual code to write, not a description of what to design
3. **Zero architectural decisions** — "put this code here," never "figure out how to connect these"
4. **Single concern** — one verb: "add types," "create handler," "wire import" — not "create + integrate + wire + add"
5. **Single verification command** — `cargo check -p {crate}` or `npm run typecheck`, not "verify the integration works"
6. **No cross-file reasoning** — the worker doesn't need to understand how their file connects to other workers' files

**If a brief fails any criterion, split it.**

## How Worker 1C Should Be Decomposed

**Before** (1 worker, 4 files, multiple concerns):
```
Worker 1C: API Routes + AppState + Integration
  - Create api/src/routes/events.rs (large file, many handlers)
  - Modify api/src/main.rs (add EventEngine to AppState)
  - Modify api/src/routes/mod.rs (register events module)
  - Modify core/src/scheduler.rs (add event_cleanup job)
```

**After** (5 workers, 1-2 files each, exact code):
```
Worker 1C-1: Event rule CRUD routes
  - Create api/src/routes/events.rs with CRUD handlers only
  - Brief includes: exact function signatures, exact Supabase queries, exact error handling
  - Verify: cargo check -p api

Worker 1C-2: Webhook receiver routes  
  - Add webhook_routes() function to api/src/routes/events.rs
  - Brief includes: exact HMAC validation code, exact handler
  - Verify: cargo check -p api

Worker 1C-3: Wire events module into router
  - Modify api/src/routes/mod.rs — add 3 lines (import + route registration)
  - Brief includes: exact lines to add, exact location
  - Verify: cargo check -p api

Worker 1C-4: Add EventEngine to AppState
  - Modify api/src/main.rs — add field to AppState + tokio::spawn in main()
  - Brief includes: exact code block for both changes
  - Verify: cargo check -p api

Worker 1C-5: Add event_cleanup to scheduler
  - Modify core/src/scheduler.rs — add one match arm in tick()
  - Brief includes: exact match arm code
  - Verify: cargo check -p taskwright-core
```

## Worker Brief Format (Updated)

```markdown
# Worker {wave}{letter}: {Single-Verb Title}

## What to Do (one sentence)
{verb} {what} in {file}.

## File
- **{Create|Modify}**: `{exact/path/to/file.ext}`
- **Read (reference only)**: `{path/to/pattern.ext}` — follow this pattern for {what}

## Exact Code

{The actual code to write. Not pseudocode, not a description — the real code.
For modifications: show the before and after, with enough context to locate the change.
For new files: show the complete file content.}

```{language}
// === ADD THIS after line containing "{anchor text}" ===

{exact code}
```

## Do NOT Touch
- {file1} — owned by another worker
- {file2} — not in scope
- Do NOT modify any existing code except where specified above

## Verify
```bash
{single command}
```
Must exit 0 with no errors.
```

**Key changes from current format**:
- "Exact Code" section is MANDATORY — replaces "Implementation Steps"
- "What to Do" is one sentence, one verb
- No "Key Types/Interfaces" section — types are in the exact code
- No "Patterns to Follow" section — the exact code IS the pattern
- No "Test Expectations" section — tests run at wave validation, not per worker
- "Verify" is a single command, not a checklist

## What This Means for Each Agent

### Architect Agent

The architect's job gets harder. Instead of writing high-level briefs and letting workers figure out the code, the architect must:

1. **Write the actual code** for every worker brief — function bodies, not signatures
2. **Decompose until every brief passes the Haiku Test** — if a brief has 2+ concerns, split it
3. **Provide anchors** — "add this after the line containing `pub fn routes()`"
4. **More workers, simpler each** — 15 workers at 1 file each beats 5 workers at 3 files each

Add to architect.md:

```markdown
## Worker Sizing Rule (MANDATORY)

Every worker brief MUST pass the Haiku Test — a Haiku-class model must be able to 
complete the worker by following the brief literally, with no reasoning required.

**Haiku Test criteria** (ALL must be true):
1. Max 2 files (create 1 + modify 1, or similar)
2. Brief contains EXACT code to write (not descriptions or pseudocode)
3. Zero architectural decisions required
4. Single concern (one verb in the title)
5. Single verification command
6. No cross-file reasoning needed

**If a brief fails any criterion, split it into smaller workers.**

More workers = cheaper execution (Haiku vs Sonnet) + faster (parallel) + more reliable.
The architect does the thinking; workers do the typing.
```

### Planning Agent (Standard Route)

Same rule applies. The planning agent writes spec sections, and each section becomes a worker brief. Sections must be Haiku-compatible.

Add to planning-agent.md:

```markdown
## Section Sizing

Each section in the spec must be implementable by a Haiku-class model.
If a section requires multiple files or architectural reasoning, split it.
Include exact code in the spec for non-trivial changes.
```

### Implementation Agent

The implementation agent becomes simpler — it's applying exact code from the brief, not solving problems. Its self-verification is a single command.

Update the agent definition to clarify:

```markdown
## Execution Model

Your brief contains the EXACT code to write. Your job is:
1. Read the brief
2. Apply the code changes exactly as specified
3. Run the verification command
4. Report status

You are NOT expected to design solutions, make architectural decisions, or 
figure out how code connects. If the brief is unclear, report STATUS: blocked
rather than guessing.
```

### Wave Structure

More workers means more waves for sequential dependencies, but more parallelism within each wave:

```
Wave 0: Foundation (parallel — no dependencies)
  Worker 0A: Add types to shared/types.rs          [1 file, exact code]
  Worker 0B: Create migration SQL                    [1 file, exact SQL]

Wave 1: Core modules (sequential within wave, each builds on 0)
  Worker 1A: Create events.rs — EventBus struct      [1 file, exact code]
  Worker 1B: Add EventEngine impl to events.rs       [1 file, exact code]
  Worker 1C: Create rules.rs — RuleEvaluator         [1 file, exact code]
  Worker 1D: Create actions.rs — ActionExecutor      [1 file, exact code]

Wave 2: Wiring (parallel — all depend on Wave 1)
  Worker 2A: Add EventEngine to AppState             [1 file, exact code]
  Worker 2B: Wire events module into router          [1 file, 3 lines]
  Worker 2C: Add scheduler job                       [1 file, 1 match arm]

Wave 3: Routes (parallel — depend on Wave 2)
  Worker 3A: Event rule CRUD routes                  [1 file, exact handlers]
  Worker 3B: Webhook receiver routes                 [1 file, exact handler]
  Worker 3C: Event history + health routes           [1 file, exact handlers]

Wave 4: Integration (parallel — depend on Wave 3)
  Worker 4A: Channel event emission                  [1 file, modify existing]
  Worker 4B: Email ingestion endpoint                [1 file, add handler]

Wave 5: Frontend (parallel — depend on Wave 3)
  Worker 5A: Event history page                      [1 file, exact component]
  Worker 5B: Rule management page                    [1 file, exact component]
  Worker 5C: Mobile type sync                        [1 file, add types]
```

17 workers instead of 12. Each is 1 file, exact code, single verify. All runnable on Haiku.

## Model Selection Per Role

| Role | Model | Why |
|------|-------|-----|
| Architect | Opus | Designs architecture, writes exact code for every worker brief |
| Strategic critic | Opus/Sonnet | Reviews architecture decisions |
| Tactical critic | Sonnet | Reviews spec quality |
| Planning agent | Sonnet | Writes spec sections (needs reasoning for decomposition) |
| **Implementation workers** | **Haiku** | Apply exact code from briefs — no reasoning needed |
| Verification agent | Sonnet | Adversarial testing needs reasoning |
| Security reviewer | Sonnet | Security analysis needs reasoning |
| Closure agent | Haiku | Checklist verification |
| Code reviewer | Sonnet | Code quality analysis |
| Hardening reviewer | Sonnet | Production readiness checks |
| Database reviewer | Sonnet | Query analysis + EXPLAIN |
| E2E reviewer | Sonnet | Functional journey testing |
| Compliance agent | Haiku | Process audit checklist |
| Build fixer | Sonnet | Needs reasoning to fix errors |
| Drift scanner | Haiku | Pattern matching, no reasoning |
| Session guardian | Haiku | Read observations, report patterns |

**Cost impact**: Workers are the highest-volume agents (5-17 per task). Moving them from Sonnet to Haiku cuts the implementation phase cost by ~80%.

## Acceptance Criteria

- AC-1: Architect agent prompt includes the Haiku Test criteria and worker sizing rule
- AC-2: Worker brief format updated — "Exact Code" section mandatory, no "Implementation Steps"
- AC-3: Planning agent prompt includes section sizing guidance
- AC-4: Implementation agent prompt clarifies execution model (apply code, don't design)
- AC-5: Worker 1C from event-engine example would be split into 5 workers under new rules
- AC-6: Implementation agent frontmatter specifies `model: haiku` as default
- AC-7: Brief quality checklist updated to include Haiku Test criteria

## Test Plan

| # | Test | Expected |
|---|------|----------|
| 1 | Architect writes worker brief for complex task | Each brief ≤ 2 files, exact code provided |
| 2 | Haiku receives well-formed brief | Applies code correctly, verify passes |
| 3 | Haiku receives poorly-formed brief (no exact code) | Reports STATUS: blocked |
| 4 | Wave with 10+ parallel Haiku workers | All complete, wave merge succeeds |
| 5 | Cost comparison: 5 Sonnet workers vs 15 Haiku workers | Haiku cheaper + faster |

## Implementation

### Files to Change

| File | Change |
|------|--------|
| `~/.claude/agents/core/architect.md` | Add Haiku Test, worker sizing rule, updated brief format |
| `~/.claude/agents/core/planning-agent.md` | Add section sizing guidance |
| `~/.claude/agents/core/implementation-agent.md` | Clarify execution model, change default model to haiku |
| `~/.claude/taskplex/phases/planning.md` | Update worker dispatch to use haiku for implementation agents |

### What Does NOT Change

- Hook infrastructure (no enforcement changes — this is prompt-level guidance)
- Phase files (workflow stays the same, just more granular workers)
- Validation pipeline (same gates, same reviewers)
- QA phase (same journey testing)

## Open Questions

1. **Should model selection be per-worker?** Some workers might genuinely need Sonnet (e.g., complex refactoring where exact code can't be provided). The architect could flag these: `model: sonnet` in the brief frontmatter. Default: haiku.

2. **How does this affect wave validation?** More workers = more merge points. Wave validation (build + test after merge) becomes more important. But each individual worker is more likely to succeed, so fewer fix rounds.

3. **Does this increase architect time?** Yes — the architect writes more code in briefs. But architect time is one-shot (Opus, expensive but once). Worker time is multiplied (N workers × per-worker cost). Investing more in the architect to save on workers is the right tradeoff.

4. **What about Standard route (no architect)?** The planning agent writes sections, not full code. For Standard route, sections should still follow the sizing rule but may include more description and less exact code. Workers on Standard may need Sonnet for the first version, with a path to Haiku as the planning agent learns to write more prescriptive specs.
