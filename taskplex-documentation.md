# TaskPlex — Complete Technical Documentation

## 1. Overview

TaskPlex is a **workflow orchestration framework** that wraps every development task in a structured, multi-phase process with quality gates, user interaction checkpoints, and validation pipelines. It runs inside Claude Code as a set of slash commands, hooks, agent definitions, and contract files.

**Core thesis**: The governance infrastructure IS the product. Agents are commoditized — what differentiates is context architecture, validation, autonomy management, and audit trails.

**What it enforces**:
- Design-first development — you cannot code before the design is approved
- Quality gates at every phase transition
- User involvement at every decision point
- Structured agent handoffs with evidence-based verdicts
- Audit trails for every deviation, override, and escalation

---

## 2. Entry Points

There are **three paths** into TaskPlex, each serving a different purpose:

### 2.1 `/taskplex` (or `/tp`) — Task Execution

**Files**: `~/.claude/commands/taskplex.md`, `~/.claude/commands/tp.md`

The primary command. Runs the full 7-phase workflow from design through implementation to validation and completion. This is what you use when you have a task to build.

```
/tp                                  # interactive: asks what to work on + route
/tp add user authentication          # asks route choice, then begins
/tp --light fix the login button     # standard route, light design
/tp --team refactor the API layer    # full design, multi-agent execution
/tp --blueprint redesign the pipeline # opus architect + multi-agent + worktrees
/tp --prd Q3 feature roadmap         # blueprint at initiative scale
/tp --skip-design fix typo           # no design phase (logs degradation)
/tp --plan PLAN-{id}                 # use an existing approved plan
```

**What happens when invoked**:
1. The `tp-prompt-check` hook fires (UserPromptSubmit event)
2. It detects the `/tp` invocation and injects a workflow reminder
3. If an active task exists, it warns the user and offers resume/new/cancel
4. The orchestrator reads `~/.claude/taskplex/phases/init.md` and begins Step 0

### 2.2 `/plan` — Strategic Thinking & Architecture

**Files**: `~/.claude/commands/plan.md`, `~/.claude/skills/plan/skill.md`

Pre-implementation thinking. Use when you want to explore an idea, research approaches, create a product brief, or design architecture *before* committing to building. Produces approved plan files that feed into `/tp`.

```
/plan                                # asks route (Full or Quick)
/plan redesign the notification system
```

**Two routes**:
- **Full** — Research → Product Context (brief) → Architecture → Critic review
- **Quick** — Architecture → Critic review (skip research and product context)

**Output**: `PLAN-{id}.md` in `.claude-task/plans/` with `processedByLifecycle: true` metadata. When fed to `/tp --plan PLAN-{id}`, it skips redundant planning (strategic critic already ran).

### 2.3 `/evaluate` — Audit What Exists

**Files**: `~/.claude/skills/evaluate/skill.md`, `~/.claude/skills/evaluate/modes/`

Post-implementation evaluation. Two modes:
- **Audit** — Investigate quality, UX, DX of existing products
- **Review** — Validate implementation against a product brief

Also invoked automatically at the end of a `/tp` task if `product/brief.md` exists — the system offers to validate the implementation against the brief.

### 2.4 How They Connect

```
/plan ──produces──▶ PLAN-{id}.md ──feeds──▶ /tp --plan PLAN-{id}
                                                    │
                                              (builds it)
                                                    │
                                                    ▼
                                            /evaluate (review mode)
                                         validates against brief
```

---

## 3. The Workflow (7 Phases)

### Phase -1: Project Bootstrap (one-time)

**File**: `~/.claude/taskplex/phases/bootstrap.md`

**Trigger**: Only when no `INTENT.md` exists in the project root.

Uses the **adaptive interaction model** — no autonomous agent generation. The orchestrator:

1. **Gathers context** (< 30 seconds) — reads README, CLAUDE.md, package.json, scans project structure
2. **Synthesizes and confirms** — presents understanding, adapts question to context density (high/medium/low)
3. **Targeted follow-ups** (0-3 questions) — only about gaps, stops when ambiguity is resolved
4. **Drafts INTENT.md** from conversation — presents for user review, max 2 revision rounds

Convention bootstrap (Phase -0.5) is deferred — runs in background during the first task, presents results after completion. Never blocks the first task.

### Phase 0: Initialization

**File**: `~/.claude/taskplex/phases/init.md`

**Steps 0-4**: Parse task, create manifest, create session file, load context (INTENT.md, CONVENTIONS.md, CLAUDE.md), detect project type, load convention overrides.

**Sub-phase A — Convention Check**:
- Both modes: Automated scan of target area (naming, structure, imports, error handling)
- Full mode adds: 2-4 targeted questions to confirm/correct inferences

**Sub-phase B — Intent Exploration (Adaptive Interaction Model v2)**:

The system gathers context from three sources before asking anything:
1. **Invocation context** — task description, flags, referenced files
2. **Project documentation** — INTENT.md, CLAUDE.md, product/brief.md
3. **Quick codebase scan** — 3-5 Grep/Glob calls on the target area

Then it assesses **context density**:
- **High** → confirmation question, minimal follow-ups
- **Medium** → targeted gap questions
- **Low** → open exploration questions

**Gate criteria** (flags, not counters):
| Mode | Required Flags |
|------|---------------|
| **Full** | `contextConfirmed` + `ambiguitiesResolved` + `approachSelected` + `sectionsApproved >= 1` |
| **Light** | `contextConfirmed` |

Question counters (`intentQuestionsAsked`, etc.) are kept for observability but are NOT gate criteria.

**Design sub-phase progression**:
```
convention-scan → convention-check → intent-exploration → approach-review → design-approval → brief-writing
```

Each sub-phase must advance in order. The `tp-design-gate` hook blocks file writes if you try to skip ahead.

### Phase 1: Planning

**File**: `~/.claude/taskplex/phases/planning.md`

Route-dependent:

| Route | What Happens |
|-------|-------------|
| **Standard** | Planning agent writes `spec.md` → spec critic reviews → user acknowledges plan |
| **Team** | Planning agent writes `spec.md` + `sections.json` + `file-ownership.json` → critic → user acknowledges |
| **Blueprint** | Architecture decisions with user → opus architect writes `architecture.md` + `spec.md` + worker briefs → user confirms direction |

**Mandatory gate**: `planSource.userAcknowledged = true` before implementation can begin.

### Phase 2: Implementation

Route-dependent:

| Route | Agents | Isolation |
|-------|--------|-----------|
| **Standard** | 1 implementation agent (sonnet) | Shared workspace |
| **Team** | 1-3 implementation agents (sonnet), one per section | Shared workspace, file ownership enforced |
| **Blueprint** | 1-3 implementation agents (sonnet) | Each in its own git worktree |

All agents follow the same pattern: read spec, implement, run build checks, return short summary + write everything to disk.

### Phase 4.5: QA

**File**: `~/.claude/taskplex/phases/qa.md`

Product-type-aware testing:

| Product Type | QA Method |
|-------------|-----------|
| UI App (web) | Browser walkthrough via agent-browser |
| CLI | Run commands, check exit codes and output |
| API / Service | Call endpoints, check responses |
| Library / Module | Skip (no runnable surface) |

Steps: Smoke test → Journey walkthrough (from brief or inferred) → Edge case probing → Bug triage + fix loop (max 3 rounds) → QA report.

QA is **not a hard gate** — validation runs regardless. But QA failures are noted for the code reviewer.

### Phase 5: Validation

**File**: `~/.claude/taskplex/phases/validation.md`

Three stages:

**Stage 1 — Review Gates** (ordered per `gates.md`):
1. Artifact validation (blocking pre-check)
2. Traceability (standard + enterprise)
3. Build validation (typecheck, lint, tests)
4. Convention compliance
5. Security review
6. Closure (requirements verification)
7. Code review (standard + enterprise)
8. Conditional gates (database, e2e, user-workflow — triggered by file patterns)
9. Enterprise gates (dependency compliance, migration safety, operability)
10. Custom gates (from conventions.json)

**Stage 2 — Hardening** (standard + enterprise):
- Automated checks (dependency scan, secrets scan, type safety, error handling, test coverage)
- Red-line rules that block regardless of score (critical vulnerabilities, secrets detected)
- Readiness scorecard

**Stage 3 — Completion**:
- Compliance agent (haiku) — mandatory final gate, audits process + convention compliance
- Write `validation-gate.json`
- Git commit (never `git add .` — stage files individually)
- Push/PR confirmation with user
- Task summary
- Cleanup stale plan files from `~/.claude/plans/`

---

## 4. Execution Routes

### 4.1 Standard Route

```
Orchestrator
    │
    ├──▶ Planning Agent (sonnet)
    │       Writes: spec.md
    │       Returns: 8-15 line summary
    │
    ├──▶ Spec Critic (haiku)
    │       Reviews: spec.md against brief.md
    │       Returns: APPROVED | NEEDS_REVISION
    │
    ├──▶ [User acknowledges plan]
    │
    ├──▶ Implementation Agent (sonnet)
    │       Reads: spec.md
    │       Writes: source code, deferred items
    │       Returns: STATUS + FILES_MODIFIED + BUILD
    │
    └──▶ Validation Pipeline
```

Default for most tasks. Single-threaded. Max 20 files, 25 turns.

### 4.2 Team Route

```
Orchestrator
    │
    ├──▶ Planning Agent (sonnet, team mode)
    │       Writes: spec.md, sections.json, file-ownership.json
    │
    ├──▶ Spec Critic (haiku)
    │
    ├──▶ [User acknowledges plan]
    │
    ├──┬──▶ Worker 1 (sonnet) — Section A
    │  ├──▶ Worker 2 (sonnet) — Section B
    │  └──▶ Worker 3 (sonnet) — Section C
    │       Each reads: spec.md#section-N, file-ownership.json
    │       Each writes: code + workers/{workerId}.json
    │       Each returns: STATUS + FILES_MODIFIED + BUILD
    │
    └──▶ Validation Pipeline
```

1-3 parallel agents, each owning at most 10-12 files. File ownership prevents conflicts.

### 4.3 Blueprint Route

```
Orchestrator
    │
    ├──▶ [Architecture decisions with user — 1-3 AskUserQuestion]
    │
    ├──▶ Architect (opus)
    │       Writes: architecture.md, spec.md, worker briefs, file-ownership.json
    │       Returns: 5-10 line summary
    │
    ├──▶ [User confirms direction]
    │
    ├──▶ Researcher (sonnet, conditional)
    │       Writes: research/*.md
    │
    ├──┬──▶ Worker 1 (sonnet, worktree)
    │  ├──▶ Worker 2 (sonnet, worktree)
    │  └──▶ Worker 3 (sonnet, worktree)
    │       Each in isolated git worktree
    │       Post-merge with conflict resolution
    │
    └──▶ Validation Pipeline
```

Full opus-level architecture + isolated worktrees. Default quality profile: enterprise.

### 4.4 Initiative Mode (`--prd`)

Blueprint at scale. Extends with:
- Feature decomposition into wave-based execution
- Wave 0 (sequential, foundational) → Wave 1+ (parallel)
- Cross-feature closure check
- Per-feature status tracking in `prd-state.json`
- Interactive or autonomous execution mode (user chooses)

---

## 5. Quality Profiles

| Profile | Required Gates | Hardening | Auto-Commit | Default For |
|---------|---------------|-----------|-------------|-------------|
| **Lean** | (none) | Skipped | Yes | Trivial tasks |
| **Standard** | tests, lint, security, closure, code review, compliance | Advisory (red-lines still block) | No | Standard/Team routes |
| **Enterprise** | All standard + typecheck, hardening, readiness | Blocking | No | Blueprint route |

Configured in `~/.claude/taskplex/policy.json`.

---

## 6. Hooks

All hooks are globally active in `~/.claude/settings.json`. They share utilities from `~/.claude/hooks/hook-utils.mjs`.

### 6.1 Hook Architecture

```
User types /tp ──▶ UserPromptSubmit ──▶ tp-prompt-check.mjs
                                           │
                                           ├─ Detects /tp invocation
                                           ├─ Warns about active tasks
                                           └─ Injects workflow reminder

Claude writes code ──▶ PreToolUse (Edit|Write) ──▶ tp-design-gate.mjs
                                                       │
                                                       ├─ Checks manifest.designPhase
                                                       ├─ Checks artifact → sub-phase mapping
                                                       ├─ Checks interaction evidence flags
                                                       └─ BLOCKS or ALLOWS the write

Claude edits file ──▶ PostToolUse (Edit|Write) ──▶ tp-heartbeat.mjs (async)
                                                       │
                                                       ├─ Tracks modified files
                                                       ├─ Increments tool call counters
                                                       ├─ Auto-promotes phase
                                                       ├─ Updates timestamp
                                                       ├─ Renders progress.md
                                                       └─ Compaction guard warning

Claude reads/greps ──▶ PostToolUse (Read|Bash|...) ──▶ start-task-sentinel.mjs (async)
                                                          │
                                                          ├─ Increments tool call counter
                                                          └─ Compaction guard warning

Claude runs git commit ──▶ PreToolUse (Bash) ──▶ tp-pre-commit.mjs
                                                     │
                                                     ├─ Detects git commit in command
                                                     ├─ Checks validation-gate.json
                                                     └─ BLOCKS if validation not passed

Context compaction ──▶ PreCompact ──▶ tp-pre-compact.mjs
                                         │
                                         ├─ Snapshots manifest to checkpoints/
                                         ├─ Includes phase, progress, workers
                                         └─ Emits recovery instructions

Session start ──▶ SessionStart ──▶ tp-session-start.mjs
                                       │
                                       ├─ Detects active tasks
                                       ├─ Reads latest checkpoint
                                       ├─ Renders phase checklist
                                       └─ Injects recovery context

Session stop ──▶ Stop ──▶ tp-stop.mjs
                              │
                              ├─ Warns if validation incomplete
                              ├─ Blocks stop during validation (non-lean)
                              └─ Updates manifest timestamp
```

### 6.2 Hook Details

| Hook | Event | Matcher | Blocking | Timeout |
|------|-------|---------|----------|---------|
| `tp-prompt-check` | UserPromptSubmit | all | No (injects context) | 5s |
| `tp-design-gate` | PreToolUse | `Edit\|Write` | **Yes** (can deny) | 5s |
| `tp-pre-commit` | PreToolUse | `Bash` | **Yes** (can deny) | 10s |
| `tp-heartbeat` | PostToolUse | `Edit\|Write` | No (async) | 5s |
| `start-task-sentinel` | PostToolUse | `Read\|Bash\|Grep\|...` | No (async) | 3s |
| `tp-pre-compact` | PreCompact | `*` | No (emits message) | 10s |
| `tp-session-start` | SessionStart | `startup\|resume\|compact` | No (injects context) | 10s |
| `tp-stop` | Stop | all | **Conditional** (blocks in validation) | 10s |

### 6.3 Design Gate Enforcement

The design gate is the core enforcement mechanism. It uses an **artifact-to-sub-phase mapping**:

| Artifact | Minimum Sub-Phase |
|----------|------------------|
| `conventions.md` | `convention-check` |
| `intent-and-journeys.md` | `intent-exploration` |
| `brief.md` | `brief-writing` |
| `spec.md` | `brief-writing` |
| `architecture.md` | `brief-writing` |
| `prd.md` | `prd-bootstrap` |

For `brief.md` in full mode, the gate additionally checks **interaction evidence flags**:
- `contextConfirmed` — user confirmed the orchestrator's synthesis
- `ambiguitiesResolved` — all gaps resolved through adaptive questioning
- `approachSelected` — user chose from proposed approaches
- `sectionsApproved >= 1` — at least one design section approved

Files always allowed regardless of phase: `manifest.json`, `progress.md`, `session.json`.

### 6.4 Fail-Safe Design

Every hook catches errors and falls through gracefully. No hook will crash and block the user. Pattern:
```javascript
try {
  // hook logic
} catch (error) {
  if (process.env.TF_DEBUG) console.error(`[hook-name] ${error.message}`);
  allowTool(); // or continueQuietly()
}
```

### 6.5 Shared Utilities (`hook-utils.mjs`)

| Function | Purpose |
|----------|---------|
| `parseStdin()` | Parse hook input from stdin (JSON) |
| `normalizeCwd()` | Windows path normalization |
| `findSessionTask()` | Find the most recent active task in `.claude-task/` |
| `findActiveTasks()` | Find all non-stale, non-completed tasks |
| `isValidationPassed()` | Check validation-gate.json, manifest, or review files |
| `readLatestCheckpoint()` | Read most recent compaction checkpoint |
| `detectFileState()` | Derive phase from existing artifacts |
| `allowTool()` / `denyTool()` | PreToolUse output helpers |
| `continueWithContext()` / `continueQuietly()` | SessionStart output helpers |

---

## 7. Subagent Architecture

### 7.1 Core Principle: Write to Disk, Return a Summary

Every subagent follows the same pattern:
1. **Receives** a prompt pointing to files on disk (spec, brief, etc.)
2. **Reads** those files itself — the orchestrator does NOT assemble a payload
3. **Does its work** (planning, implementing, reviewing, researching)
4. **Writes all detailed output to disk** in `.claude-task/{taskId}/`
5. **Returns only a short summary** (5-15 lines) to the orchestrator

This is critical for context management. The orchestrator has a limited context window. If agents returned full plans, reviews, or implementations as text, the orchestrator would fill up fast. Instead:

```
Orchestrator context:
  "PLANNING COMPLETE. Spec: spec.md. Files affected: 12. Key decisions: ..."
  (15 lines)

On disk (.claude-task/{taskId}/):
  spec.md (full implementation plan — 200+ lines)
  conventions-snapshot.json
  sections.json
  file-ownership.json
```

The orchestrator only needs enough to decide what to do next — it reads files from disk when it needs details.

### 7.2 Agent Roster

| Agent | Model | Tier | Can Edit Code | Can Spawn Agents | Purpose |
|-------|-------|------|:---:|:---:|---------|
| **planning-agent** | sonnet | Standard | No | No | Write spec.md from brief, interact with user |
| **architect** | opus | High | No | No | Design architecture, write worker briefs |
| **implementation-agent** | sonnet | Standard | **Yes** | No | Implement code changes per spec |
| **reviewer** | sonnet/haiku | Standard | No | No | Review code (security, closure, code quality, etc.) |
| **researcher** | sonnet | Medium | No | No | External research, write findings to disk |
| **compliance-agent** | haiku | Fast | No | No | Final gate audit (process + convention compliance) |
| **build-fixer** | sonnet | Standard | **Yes** | No | Fix build/review issues, zero tolerance |
| **merge-resolver** | sonnet | Standard | **Yes** | No | Resolve git merge conflicts (Blueprint route) |

### 7.3 Agent Tool Permissions

Agents are deliberately restricted:

| Role | Read | Glob | Grep | Write | Edit | Bash | Web | AskUser |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| planning-agent | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| architect | ✓ | ✓ | ✓ | ✓* | ✗ | ✗ | ✓ | ✗ |
| implementation-agent | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| reviewer | ✓ | ✓ | ✓ | ✓** | ✗ | ✗ | ✗ | ✗ |
| researcher | ✓ | ✓ | ✓ | ✓*** | ✗ | ✗ | ✓ | ✗ |
| compliance-agent | ✓ | ✓ | ✓ | ✓** | ✗ | ✗ | ✗ | ✗ |
| build-fixer | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ |

\* Write only to `.claude-task/{taskId}/`
\** Write only to review report paths
\*** Write only to `.claude-task/{taskId}/research/`

Key restrictions:
- **No agent can spawn other agents** — only the orchestrator dispatches
- **Planning agents cannot edit source code** — they plan, not implement
- **Reviewers cannot edit code** — they identify issues, they don't fix them
- **Implementation agents cannot access the web** — they work from the spec

### 7.4 Handoff Contract

Every agent-to-agent transition produces a structured record:

```json
{
  "workerId": "worker-auth-01",
  "direction": "orchestrator→worker | worker→orchestrator | worker→reviewer",
  "fromAgent": "orchestrator",
  "toAgent": "implementation-agent:worker-auth-01",
  "context": {
    "currentState": "Planning complete, spec approved",
    "relevantFiles": [{ "path": "spec.md#section-3", "role": "Implementation spec" }],
    "dependencies": "None",
    "constraints": "Max 25 turns"
  },
  "deliverable": {
    "description": "Implement Section 3: Authentication",
    "acceptanceCriteria": ["AC-3.1", "AC-3.2"],
    "evidenceRequired": "Build passes, criteria met with file:line citations"
  },
  "verdict": {
    "status": "pass | fail | needs-revision | blocked | escalated",
    "evidence": [
      { "type": "file-citation", "reference": "src/auth/jwt.ts:45", "detail": "..." }
    ]
  }
}
```

Handoffs are stored in `manifest.workerHandoffs[]` and `workers/{workerId}.json`.

### 7.5 Model Tier Strategy

| Tier | Model | Used For | Why |
|------|-------|----------|-----|
| **High** | Opus | Architect, strategic critic | Complex reasoning, architecture decisions |
| **Standard** | Sonnet | Planning, implementation, review, research, build-fix | Balanced capability/speed |
| **Fast** | Haiku | Compliance, closure, spec critic | Quick checks, low reasoning load |

### 7.6 Escalation Pattern

When an agent hits an iteration limit (build-fix, review resubmission):

1. Agent writes structured escalation report to `manifest.escalations[]`
2. Report includes: attempt history, root cause analysis, recommendation
3. Recommendations: `reassign`, `decompose`, `revise-approach`, `accept-with-limitations`, `defer`
4. Orchestrator presents options to user — never auto-resolves

---

## 8. State Management

### 8.1 The Manifest (`manifest.json`)

Central state file at `.claude-task/{taskId}/manifest.json`. Source of truth for:
- Current phase and design sub-phase
- Design interaction evidence (flags + counters)
- Modified files list
- Validation gate results
- Quality profile and execution mode
- Degradations, overrides, escalations
- Worker handoffs
- Build commands (resolved from conventions + detection)
- Git state (branch, commits, PR)

Schema: `~/.claude/taskplex/manifest-schema.json`

### 8.2 Compaction Survival

TaskPlex is designed to survive context compaction:

1. **Before compaction**: `tp-pre-compact` hook snapshots manifest + progress to `checkpoints/compact-{timestamp}.json`
2. **After compaction**: `tp-session-start` hook reads manifest, renders phase checklist, injects recovery context
3. **Phase checklist** is persisted in `manifest.phaseChecklist` — survives compaction because it's on disk, not in chat context

### 8.3 Session Resume

On session start, the `tp-session-start` hook:
1. Scans `.claude-task/` for active tasks (non-completed, non-stale)
2. Reads the most recent manifest
3. Checks for recent checkpoints (within 5 minutes → compaction recovery)
4. Renders the phase checklist from `manifest.phaseChecklist`
5. Injects full recovery context as `additionalContext`

Staleness thresholds:
- Normal tasks: 4 hours
- Autonomous/PRD tasks: 24 hours

---

## 9. Contract Files

| File | Purpose |
|------|---------|
| `policy.json` | Quality profiles, iteration limits, execution mode configs, design depth settings |
| `gates.md` | Gate catalog — names, verdict enums, execution order, manifest field mapping |
| `artifact-contract.md` | Required artifacts by profile, directory structure, ownership |
| `manifest-schema.json` | Canonical field definitions for manifest.json |
| `handoff-contract.md` | Agent-to-agent transition format, worker status schema |
| `hardening-checks.md` | Check registry, risk profiles, red-line rules, scorecard |
| `portability.md` | Core workflow vs adapter layer separation for porting to other runtimes |

---

## 10. Adaptive Interaction Model (v2)

The interaction model was redesigned to be context-driven rather than counter-driven. This applies to both bootstrap (Phase -1) and the design phase (Sub-phase B).

### Principle

**Ask until ambiguity is resolved, stop when it isn't adding value.** Never ask what the docs already answer. Rich input gets less ceremony, vague input gets more.

### Context Gathering

Before any user interaction, the system gathers from three sources:
1. **Invocation** — task description, flags, referenced files
2. **Documentation** — INTENT.md, CLAUDE.md, README.md, product/brief.md
3. **Codebase scan** — 3-5 Grep/Glob calls on the target area

### Context Density

| Density | Signal | Effect |
|---------|--------|--------|
| **High** | Detailed description + docs cover scope/constraints | Confirmation question → minimal follow-ups |
| **Medium** | Clear description but sparse docs, or unfamiliar area | Targeted gap-fill questions |
| **Low** | Vague description, no docs, unfamiliar codebase | Open exploration questions |

### Gate Criteria (Flags, Not Counters)

| Flag | Meaning | Gate For |
|------|---------|----------|
| `contextConfirmed` | User confirmed the orchestrator's synthesis | All modes |
| `ambiguitiesResolved` | No open gaps remain | Full mode |
| `approachSelected` | User chose from proposed approaches | Full mode |
| `sectionsApproved >= 1` | At least one design section approved | Full mode |

Counter fields (`intentQuestionsAsked`, `conventionQuestionsAsked`, etc.) still exist for observability and metrics — they are NOT gate criteria.

### Sufficiency Check

You have enough context when you can answer:
- What is being built and why?
- Who is affected and how?
- What's in scope and what's explicitly out?
- What are the key constraints or risks?
- What does "done" look like?

---

## 11. File Locations

### Core Contracts
```
~/.claude/taskplex/
├── phases/init.md           # Phase 0: initialization + design
├── phases/planning.md       # Phase 1: planning + implementation dispatch
├── phases/qa.md             # Phase 4.5: product-type QA
├── phases/validation.md     # Phase 5: validation pipeline + completion
├── phases/bootstrap.md      # Phase -1/-0.5: INTENT.md + conventions bootstrap
├── phases/prd.md            # Initiative mode extensions
├── policy.json              # Quality profiles, limits, execution modes
├── gates.md                 # Gate catalog
├── artifact-contract.md     # Required artifacts by profile
├── manifest-schema.json     # Manifest JSON schema v2
├── handoff-contract.md      # Agent-to-agent transition format
├── hardening-checks.md      # Hardening check registry
└── portability.md           # Adapter checklist for porting
```

### Commands
```
~/.claude/commands/
├── taskplex.md              # Main /taskplex command
├── tp.md                    # /tp alias
├── plan.md                  # /plan strategic planning
└── taskplex-adapter-checklist.md  # Adapter template
```

### Hooks
```
~/.claude/hooks/
├── hook-utils.mjs           # Shared utilities
├── tp-session-start.mjs     # SessionStart
├── tp-prompt-check.mjs      # UserPromptSubmit
├── tp-design-gate.mjs       # PreToolUse (Edit|Write)
├── tp-pre-commit.mjs        # PreToolUse (Bash)
├── tp-heartbeat.mjs         # PostToolUse (Edit|Write)
├── start-task-sentinel.mjs  # PostToolUse (Read|Bash|...)
├── tp-pre-compact.mjs       # PreCompact
└── tp-stop.mjs              # Stop
```

### Agents
```
~/.claude/agents/core/
├── planning-agent.md        # Spec writing, user interaction
├── architect.md             # Opus-level architecture design
├── implementation-agent.md  # Code implementation
├── reviewer.md              # Unified reviewer (security, closure, code quality, etc.)
├── researcher.md            # External research
├── compliance-agent.md      # Final gate audit
├── bootstrap.md             # Project bootstrap (legacy — now handled inline)
└── merge-resolver.md        # Git merge conflict resolution

~/.claude/agents/utility/
└── build-fixer.md           # Fix build/review issues
```

### Skills
```
~/.claude/skills/
├── evaluate/                # Product evaluation (audit + review modes)
│   ├── skill.md
│   ├── modes/audit.md
│   ├── modes/brief.md      # (redirects to /plan)
│   ├── modes/spec.md       # (retired — covered by /tp design phase)
│   ├── modes/review.md
│   ├── references/
│   └── templates/
└── plan/
    └── skill.md             # Trigger wrapper for /plan command
```

### Task Artifacts (per task)
```
.claude-task/{taskId}/
├── manifest.json            # Central state (heartbeat-updated)
├── progress.md              # Rendered from manifest.progressNotes
├── brief.md                 # Approved design brief
├── spec.md                  # Implementation specification
├── architecture.md          # Architecture design (Blueprint only)
├── gate-decisions.json      # Every gate verdict logged
├── validation-gate.json     # Final validation result
├── traceability.json        # Requirement → code → test mapping
├── reviews/                 # Review reports (security, closure, code, compliance, etc.)
├── hardening/               # Hardening reports and scorecards
├── checkpoints/             # Pre-compaction snapshots
├── workers/                 # Worker status files (Team/Blueprint)
├── deferred/                # Out-of-scope items found during implementation
└── research/                # Research findings (if researcher ran)
```

---

## 12. Design Decisions & Trade-offs

### Why prompt-based orchestration (not a runtime)?

The orchestrator is the LLM itself, guided by phase files. There's no separate runtime process coordinating agents. This means:
- **Pro**: Zero infrastructure. Works with vanilla Claude Code.
- **Pro**: The LLM can adapt — it reads phase files and makes contextual decisions.
- **Con**: Enforcement depends on hooks + LLM compliance. A sufficiently confused LLM could skip steps.
- **Mitigation**: Hooks provide hard enforcement for critical gates (design gate, pre-commit).

### Why write-to-disk, return-summary for agents?

Context window management. If agents returned their full output as text:
- A spec.md (200 lines) + architecture.md (300 lines) + 3 worker briefs = easily 1000+ lines of context consumed
- The orchestrator would compact faster, losing task state

By writing to disk and returning 5-15 lines, agents consume minimal orchestrator context while producing full artifacts.

### Why adaptive interaction instead of fixed minimums?

Fixed minimums (`intentQuestionsAnswered >= 2`) created two problems:
1. **Forced ceremony** — well-documented tasks still required 2+ questions, wasting user time
2. **False confidence** — hitting the counter didn't mean the questions were good

Adaptive interaction focuses on **resolved ambiguity**, not question count. The system asks until it has enough, then stops.

### Why the invariant floor?

Four gates cannot be disabled by any configuration: security, closure, compliance, build. This prevents:
- Convention overrides from disabling security review
- Lean profile from skipping requirement verification
- Custom gates from replacing the compliance audit

The invariant floor ensures a minimum quality standard regardless of configuration.
