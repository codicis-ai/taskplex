# Design: Pipeline Architecture — Interactive Design + Deterministic Execution

> **Status**: Research / Design
> **Priority**: Strategic — potential architecture for execution/validation phases
> **Scope**: Execution model for post-planning phases. Design phase stays interactive.
> **Dependencies**: Claude Code (for design), tmux + pipeline engine (for execution)

## Problem Statement

TaskPlex's current architecture has a single orchestrator that reads phase files and makes decisions. This session has demonstrated the fundamental flaw: **the orchestrator is an unreliable actor**. It skips planning, ignores critics, does inline greps instead of spawning reviewers, pre-sets flags without running steps, and declares validation passed with unfixed bugs.

We've built increasingly complex hook enforcement to compensate — 9 hooks, artifact-based gates, guardian triggers, verdict-findings mismatch detection. Every fix adds another layer of "catch the orchestrator doing the wrong thing." The complexity is growing faster than the reliability.

**Root cause**: A single LLM session manages the entire workflow. It has competing priorities (finish fast vs do it right), context pressure (long sessions lose instructions), and no structural isolation between roles.

## Proposed Architecture: Split Model

The insight: **the design phase works fine as an interactive Claude Code session. The execution phase is where the orchestrator fails.** Split them.

### Two Modes, One Workflow

```
Mode 1: Interactive Design (current Claude Code session)
  ├─ User runs /taskplex:tp in their normal Claude Code session
  ├─ Init: route, quality profile, build commands
  ├─ Convention scan + user questions
  ├─ Intent exploration + approach selection
  ├─ Brief.md + intent.md written
  ├─ Planning agent writes spec.md
  ├─ Critic reviews (bounded, max 3 rounds)
  ├─ User reviews and approves plan
  │
  └─ HANDOFF POINT: user says "proceed" → triggers pipeline execution

Mode 2: Pipeline Execution (deterministic engine + isolated sessions)
  ├─ Pipeline engine reads spec.md, file-ownership.json, manifest.json
  ├─ Spawns Claude Code sessions in tmux per pipeline step
  ├─ Each session runs its role independently
  ├─ Pipeline checks artifacts between steps
  └─ Reports results back to original session
```

The handoff is the `/taskplex:execute` skill (or `tp pipeline` CLI). It reads the approved plan artifacts and launches the deterministic pipeline.

### Three Layers

```
Layer 1: Pipeline Engine (Go binary — NOT an LLM)
  - Reads YAML workflow definition
  - Spawns Claude Code sessions in tmux per step
  - Manages context flow between steps
  - Checks artifact requirements before marking steps complete
  - Handles loop-back, retries, conditions, parallelism
  - Deterministic — no LLM judgment, no shortcuts

Layer 2: Claude Code Session (one per pipeline step)
  - Each step runs in its own tmux session as a full Claude Code instance
  - Session loads the agent definition for that step's role
  - Session has its own context window — no bleed from other steps
  - Session can spawn an Agent Team for internal parallelism

Layer 3: Agent Teams (optional, within a session)
  - An implementation session can spawn an Agent Team of workers
  - A validation session can spawn an Agent Team of reviewers
  - Workers/reviewers coordinate via shared task list + peer messaging
  - Team lead coordinates within session; pipeline engine coordinates across sessions
```

### Sessions Spawning Teams

Each pipeline session IS a Claude Code instance. Within that instance, it can spawn an Agent Team for parallelism:

```
Pipeline Engine (deterministic, Go)
  │
  ├─ Session: Implementation (Claude Code + Agent Team)
  │     └─ Agent Team:
  │         ├─ Worker-1 (worktree, implementation-agent definition)
  │         ├─ Worker-2 (worktree, implementation-agent definition)
  │         ├─ Worker-3 (worktree, implementation-agent definition)
  │         └─ Team lead merges worktrees after workers complete
  │
  ├─ Session: QA (Claude Code + Agent Team)
  │     └─ Agent Team:
  │         ├─ Journey-tester (functional E2E with Playwright)
  │         └─ Verifier (adversarial testing)
  │
  ├─ Session: Validation (Claude Code + Agent Team)
  │     └─ Agent Team:
  │         ├─ Security reviewer
  │         ├─ Code reviewer
  │         ├─ Closure agent
  │         ├─ Database reviewer (conditional)
  │         ├─ E2E reviewer (conditional)
  │         └─ Compliance agent (runs last, cross-validates all)
  │
  └─ Session: Completion (Claude Code, single agent)
        └─ Git commit + PR
```

**Each session can be a single agent OR an Agent Team.** The pipeline engine doesn't care — it just checks artifacts when the session finishes.

**The validation session is the most powerful.** All reviewers run as teammates. They can claim review tasks independently, message each other ("I found an auth issue — check the session handling"), challenge findings, and the compliance agent sees all outputs and cross-validates.

### Does Nesting Work?

**Yes, with constraints:**
- No nested teams (a teammate can't spawn its own team)
- One team per session
- Teams share the session's workspace (worktrees provide isolation)

Architecture:
```
Pipeline Engine → spawns N Claude Code sessions (in tmux)
Each session → optionally runs 1 Agent Team
Each team → has M teammates (Claude Code sub-sessions)
```

For a Blueprint task: 4 sessions × 3-5 teammates average = 12-20 concurrent Claude instances at peak. The design phase runs in the original session (1 instance), so it only gets expensive at execution time.

### Why This Split Works

The design phase is ALREADY reliable — the user is present, asking questions, approving sections. The orchestrator doesn't skip steps during design because the user is guiding the conversation.

The execution phase is where every failure happens — implementation shortcuts, skipped reviews, inline greps, fake verdicts. This is exactly what the pipeline isolates.

By splitting at the plan approval boundary:
- **No change to the design UX** — same interactive flow users are used to
- **No pipeline overhead for simple tasks** — Light route can skip the pipeline entirely
- **Pipeline only runs the unreliable parts** — execution and validation
- **Original session stays open** — reads pipeline results, handles completion

## YAML Pipeline Definition

### Standard Route

```yaml
name: standard
description: TaskPlex Standard workflow

config:
  quality_profile: "${QUALITY_PROFILE}"  # set during init
  max_retries: 3

steps:
  # === Design (interactive, single agent) ===
  - name: init
    type: interactive  # pauses for user input
    agent: orchestrator
    directive: |
      Run initialization: route selection, quality profile (ask user),
      build commands, convention scan, intent exploration.
      Write brief.md and intent.md.
    artifacts:
      required:
        - .claude-task/${TASK_ID}/manifest.json
        - .claude-task/${TASK_ID}/brief.md
    timeout: 30m

  # === Planning (agent team: planner + critic) ===
  - name: planning
    type: team
    context: [init]
    teammates:
      - name: planner
        agent: planning-agent
        directive: "Write spec.md from brief.md. Follow intent.md guardrails."
      - name: critic
        agent: closure-agent
        directive: "Review spec against brief. Specific feedback on gaps."
    coordination: |
      Planner writes spec. Critic reviews. If NEEDS_REVISION, planner revises.
      Loop until APPROVED or max 3 rounds. Then planner writes file-ownership.json.
    artifacts:
      required:
        - .claude-task/${TASK_ID}/spec.md
        - .claude-task/${TASK_ID}/file-ownership.json
        - .claude-task/${TASK_ID}/reviews/spec-review.md
    timeout: 20m

  - name: user-approval
    type: interactive
    context: [planning]
    directive: "Present spec summary. User approves or requests changes."
    timeout: 10m

  - name: test-plan
    type: single
    agent: verification-agent
    context: [planning]
    directive: "MODE: test-plan. Read spec, write test-plan.md."
    artifacts:
      required:
        - .claude-task/${TASK_ID}/test-plan.md
    timeout: 10m

  # === Implementation (agent team: workers) ===
  - name: implementation
    type: team
    context: [planning, test-plan]
    teammates:
      - name: worker-1
        agent: implementation-agent
        worktree: true
      - name: worker-2
        agent: implementation-agent
        worktree: true
      - name: worker-3
        agent: implementation-agent
        worktree: true
    coordination: |
      Team lead reads file-ownership.json, assigns files to workers.
      Workers implement in worktrees. After all complete, lead merges.
      Build gate: typecheck + lint + tests on merged result.
    artifacts:
      required:
        - build-pass  # special: pipeline checks build exit code
    timeout: 45m

  # === QA (agent team: journeys + verification) ===
  - name: qa
    type: team
    context: [implementation]
    teammates:
      - name: journey-tester
        agent: orchestrator
        directive: "Apply migrations. Start dev server. Run functional E2E journeys."
      - name: verifier
        agent: verification-agent
        directive: "MODE: verify. Adversarial testing."
    coordination: |
      Journey-tester runs first (migrations, journeys).
      Verifier runs after (adversarial probes).
      If bugs found, journey-tester fixes (max 3 rounds).
    artifacts:
      required:
        - .claude-task/${TASK_ID}/reviews/verification.md
    condition: "manifest.qa.status != 'skipped'"
    loop:
      goto: implementation
      max: 2
      pass: "PASS"
      fail: "FAIL"
    timeout: 30m

  # === Validation (agent team: all reviewers in parallel) ===
  - name: validation
    type: team
    context: [implementation, qa]
    teammates:
      - name: security
        agent: security-reviewer
      - name: code-quality
        agent: code-reviewer
      - name: closure
        agent: closure-agent
      - name: database
        agent: database-reviewer
        condition: "modifiedFiles contains *.sql"
      - name: e2e
        agent: e2e-reviewer
        condition: "modifiedFiles contains *.tsx|*.jsx"
      - name: hardening
        agent: hardening-reviewer
        condition: "${QUALITY_PROFILE} in [standard, enterprise]"
      - name: compliance
        agent: compliance-agent
        depends_on: [security, code-quality, closure]  # runs after all others
    coordination: |
      All reviewers run in parallel (except compliance which waits).
      Each writes to reviews/. Compliance cross-validates all.
    artifacts:
      required:
        - .claude-task/${TASK_ID}/reviews/security.md
        - .claude-task/${TASK_ID}/reviews/closure.md
        - .claude-task/${TASK_ID}/reviews/code-quality.md
        - .claude-task/${TASK_ID}/reviews/compliance.md
      conditional:
        - file: .claude-task/${TASK_ID}/reviews/database.md
          when: "modifiedFiles contains *.sql"
        - file: .claude-task/${TASK_ID}/reviews/e2e.md
          when: "modifiedFiles contains *.tsx|*.jsx"
        - file: .claude-task/${TASK_ID}/hardening/report.md
          when: "${QUALITY_PROFILE} in [standard, enterprise]"
    quality_check:
      verdict_findings_mismatch: true  # pipeline engine checks for Must Fix + PASS
      min_citations:
        security.md: 3
        code-quality.md: 5
        closure.md: 1_per_ac
    loop:
      goto: implementation
      max: 1
      pass: "all reviews PASS|APPROVED"
      fail: "any review FAIL|NEEDS_REVISION"
    timeout: 30m

  # === Completion ===
  - name: commit
    type: single
    agent: orchestrator
    context: [validation]
    directive: "Git commit + PR. All validation artifacts verified by pipeline."
    timeout: 5m
```

### Blueprint Route

Same structure but with:
- Architect session (opus) before planning
- Strategic + tactical critic teammates in planning team
- Wave-based implementation (multiple implementation team sessions, sequential)
- Enterprise hardening + compliance as blocking

### Light Route

Minimal pipeline:
```yaml
steps:
  - name: init
    type: interactive
  - name: implementation
    type: single
    agent: implementation-agent
  - name: build
    type: single
    directive: "Run typecheck + lint"
  - name: commit
    type: single
```

## Pipeline Engine (the Go binary)

The pipeline engine is NOT an LLM. It's deterministic code that:

### 1. Reads YAML + Resolves Variables
```go
pipeline := LoadYAML(".taskplex/workflows/standard.yaml")
pipeline.Resolve(map[string]string{
    "TASK_ID": taskId,
    "QUALITY_PROFILE": qualityProfile,
})
```

### 2. Spawns tmux Sessions
```go
func (e *Engine) RunStep(step Step) {
    session := tmux.NewSession(step.Name)
    
    if step.Type == "team" {
        // Launch claude with agent team configuration
        session.Send(fmt.Sprintf("claude --agent-team %s", step.TeamConfig()))
    } else if step.Type == "interactive" {
        // Launch claude in interactive mode
        session.Send("claude")
    } else {
        // Launch claude with specific agent
        session.Send(fmt.Sprintf("claude --agent %s --prompt '%s'", step.Agent, step.FullPrompt()))
    }
}
```

### 3. Checks Artifacts Before Completing Steps
```go
func (e *Engine) CheckArtifacts(step Step) bool {
    for _, artifact := range step.Artifacts.Required {
        path := e.ResolvePath(artifact)
        if !fileExists(path) {
            return false  // step NOT complete — artifact missing
        }
        
        // Quality checks
        if step.QualityCheck.VerdictFindingsMismatch {
            if hasMustFixWithPass(path) {
                return false  // verdict-findings mismatch
            }
        }
    }
    return true
}
```

### 4. Manages Loop-Back
```go
func (e *Engine) HandleLoop(step Step, result StepResult) {
    if result.Failed && step.Loop.Retries < step.Loop.Max {
        step.Loop.Retries++
        e.RunStep(e.FindStep(step.Loop.Goto))  // jump back
    } else if result.Failed {
        e.Abort("Max retries exceeded for step: " + step.Name)
    }
}
```

### 5. Handles Parallel Execution
```go
func (e *Engine) RunParallel(steps []Step) {
    var wg sync.WaitGroup
    for _, step := range steps {
        wg.Add(1)
        go func(s Step) {
            defer wg.Done()
            e.RunStep(s)
        }(step)
    }
    wg.Wait()
}
```

## What This Eliminates

| Current Problem | How Pipeline Solves It |
|----------------|----------------------|
| Orchestrator skips planning | Planning is a separate session — can't be skipped, pipeline won't proceed without spec.md |
| Orchestrator skips critics | Critic is a teammate in the planning team — runs automatically |
| Orchestrator does inline greps instead of spawning reviewers | Each reviewer IS a session/teammate — they run regardless of what any other agent wants |
| Orchestrator pre-sets flags without running steps | Pipeline checks artifacts (files on disk), not flags |
| Orchestrator ignores quality profile | Pipeline engine reads quality profile and determines which steps to run — deterministic |
| Verdict-findings mismatch | Pipeline engine parses review files and checks — deterministic code, not LLM judgment |
| Agent skips quality profile selection | Init step has `artifacts.required: [manifest.json]` with quality profile check |
| Build commands not resolved | Pipeline engine reads manifest.buildCommands — fails if empty |
| Context loss after compaction | Each session has its own context — no compaction across sessions |

## What This Keeps

| TaskPlex Feature | How It Maps |
|-----------------|-------------|
| Agent definitions (23 .md files) | Teammate types / agent types in pipeline steps |
| Phase files (init, planning, qa, validation) | Directives in YAML steps |
| Quality profiles | Pipeline config variable, determines which steps run |
| Artifact requirements | `artifacts.required` in YAML — checked by deterministic engine |
| Review standards | Loaded by each reviewer session (same .md files) |
| Anti-rationalization | Part of agent definitions — each reviewer teammate gets them |
| Worktree management | `worktree: true` on implementation teammates — pipeline engine handles git worktree |
| Memplex integration | Each session can have MCP servers configured |
| Playwright MCP | QA and e2e-reviewer sessions get Playwright |

## Cost Model

| Architecture | Sessions | Est. Tokens | Est. Cost |
|-------------|----------|-------------|-----------|
| Current (single orchestrator) | 1 + subagents | ~300K | ~$5 |
| Pipeline (tmux sessions) | 6 sessions | ~500K | ~$8 |
| Pipeline + Agent Teams | 6 sessions × 3 avg teammates | ~1.5M | ~$20 |
| Pipeline + Teams + Blueprint | 8 sessions × 4 avg teammates | ~2.5M | ~$35 |

Significant cost increase. The value proposition: **reliability, not cost**. Every task completes correctly because the structure prevents shortcuts.

## What Needs to Be Built

### Phase 1: Pipeline Engine (Go binary)
- YAML parser for workflow definitions
- tmux session management (spawn, monitor, capture output)
- Artifact checking (file existence + quality checks)
- Context chaining (output capture → next step's input)
- Loop-back / retry logic
- Parallel step execution
- Condition evaluation (file pattern matching)
- CLI: `tp pipeline "task"`, `tp pipeline status`, `tp pipeline peek`

### Phase 2: Workflow Definitions
- `standard.yaml` — Standard route pipeline
- `blueprint.yaml` — Blueprint route with architect + waves
- `light.yaml` — Minimal pipeline
- Variable resolution ($TASK_ID, $QUALITY_PROFILE, etc.)

### Phase 3: Agent Team Integration
- Configure team sessions with teammate definitions
- Map agent .md files to teammate types
- Handle team lifecycle within pipeline steps
- Agent team hooks (TaskCompleted, TeammateIdle) for quality enforcement

### Phase 4: Multi-Runtime Support
- Abstract AI CLI interaction (Claude, Gemini, Codex, Copilot)
- Runtime-specific readiness detection
- Runtime-specific prompt delivery
- Runtime-specific output parsing

## Relationship to Current Architecture

The split model means both architectures coexist in a single workflow:

```
/taskplex:tp "build event engine" --blueprint

  ┌─────────────────────────────────────────────┐
  │  Claude Code Session (interactive design)    │
  │  Current plugin architecture — hooks active  │
  │                                              │
  │  Init → Conventions → Intent → Planning →    │
  │  Critic → User approves plan                 │
  │                                              │
  │  User: "proceed"                             │
  └──────────────────┬──────────────────────────┘
                     │
                     ▼ /taskplex:execute
  ┌─────────────────────────────────────────────┐
  │  Pipeline Engine (deterministic Go binary)   │
  │  New architecture — tmux sessions            │
  │                                              │
  │  Implementation → QA → Validation →          │
  │  Each in isolated Claude Code sessions       │
  │  Artifact checks between every step          │
  │                                              │
  │  Results written to .claude-task/            │
  └──────────────────┬──────────────────────────┘
                     │
                     ▼ pipeline complete
  ┌─────────────────────────────────────────────┐
  │  Original Claude Code Session resumes        │
  │  Reads validation results, runs completion   │
  │  Git commit + PR                             │
  └─────────────────────────────────────────────┘
```

**Light route**: Skips the pipeline entirely. Runs in the current single-session model with hooks. Quick and cheap.

**Standard route**: Design phase interactive, execution via pipeline with 3-4 sessions. Moderate cost, high reliability.

**Blueprint route**: Design phase interactive, execution via pipeline with 4-6 sessions + Agent Teams within each. Higher cost, maximum reliability.

**Shared across both**: Agent definitions, review standards, phase instructions, artifact requirements. The execution model differs, not the governance content.

## Mission Control: Kanban Dashboard

The memwright/memplex desktop app becomes a real-time monitoring dashboard for pipeline execution.

### Kanban Board View

Each pipeline session is a card that moves through columns automatically:

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   QUEUED    │ │   ACTIVE    │ │   REVIEW    │ │  COMPLETE   │ │   FAILED    │
├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────┤
│             │ │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │             │
│ Worker-3    │ │ │Worker-1 │ │ │ │Security │ │ │ │ Spec    │ │ │             │
│ E2E Review  │ │ │impl-agt │ │ │ │reviewer │ │ │ │ Critic  │ │ │             │
│ Compliance  │ │ │12 files │ │ │ │3 checks │ │ │ │APPROVED │ │ │             │
│             │ │ │ 67% ░░░ │ │ │ │scanning │ │ │ └─────────┘ │ │             │
│             │ │ └─────────┘ │ │ └─────────┘ │ │ ┌─────────┐ │ │             │
│             │ │ ┌─────────┐ │ │ ┌─────────┐ │ │ │ Worker  │ │ │             │
│             │ │ │Worker-2 │ │ │ │Code     │ │ │ │  -2     │ │ │             │
│             │ │ │impl-agt │ │ │ │Reviewer │ │ │ │ MERGED  │ │ │             │
│             │ │ │ 34% ░░░ │ │ │ │5 files  │ │ │ └─────────┘ │ │             │
│             │ │ └─────────┘ │ │ └─────────┘ │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

Cards show:
- Session name and agent type
- Progress (files modified / total, tool calls)
- Current activity (from latest observation log entry)
- Verdict (when review completes)
- Retry count (if in a loop)

Cards move automatically as `pipeline-state.json` updates.

### Session Detail View

Click a card to see the live session:

```
┌─────────────────────────────────────────────────────────┐
│ Worker-1: implementation-agent (sonnet)                  │
│ Status: ACTIVE | Worktree: tp-worker-task-1              │
│ Files: 8/12 modified | Tool calls: 47 | Fix rounds: 1   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Live Terminal Output (from tmux capture-pane)             │
│ ─────────────────────────────────────────────             │
│ Editing core/src/events.rs...                            │
│ Running cargo check -p core...                           │
│ ✓ Check passed                                           │
│ Editing api/src/routes/events.rs...                      │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Observations (from observations.md)                      │
│ ─────────────────────────────────────────────             │
│ [14:32] EDIT events.rs owner:worker-1 status:in-scope   │
│ [14:33] EDIT routes.rs owner:worker-1 status:in-scope   │
│ [14:35] EDIT utils.rs  owner:worker-1 status:OUT-OF-SCOPE│
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Guardian: ⚠ 1 scope warning                             │
│ [Stop Session] [Send Message] [Attach Terminal]          │
└─────────────────────────────────────────────────────────┘
```

### Session Management

**Stop a session**: Click "Stop Session" on any card. The pipeline engine:
1. Sends SIGTERM to the tmux session
2. Marks the step as `stopped` in pipeline-state.json
3. Dependent steps move to `blocked`
4. The dashboard shows which steps are now blocked

**Restart a session**: Click "Restart" on a stopped/failed card. The pipeline engine:
1. Creates a new tmux session for that step
2. Passes the same context (including any prior output from the failed attempt)
3. The step resumes — retry count increments

**Does stopping break the workflow?** It pauses it. Dependent steps wait. The pipeline doesn't proceed past a stopped step. When you restart, it picks up from where it stopped.

**Attach terminal**: Opens the actual tmux pane in a terminal window. You see exactly what the agent sees and can type into it. This is for debugging — if an agent is stuck, you can look at its terminal and intervene directly.

### User Queries and Interaction

**Can queries come back to the main Windows terminal?**

Yes — with a messaging layer. The pipeline engine runs a lightweight local server (WebSocket or file-based):

```
Pipeline session needs input → writes to .claude-task/{taskId}/pipeline-queries.json:
{
  "session": "implementation",
  "query": "Build failed with: cannot find module 'shared/types'. Is the path correct?",
  "timestamp": "ISO",
  "status": "pending"
}

Dashboard shows query notification → user types response in dashboard or main terminal

User responds → writes to .claude-task/{taskId}/pipeline-responses.json:
{
  "session": "implementation",
  "response": "The path is shared/src/types.rs, not shared/types",
  "timestamp": "ISO"
}

Pipeline engine injects response into the tmux session
```

Alternatively, the dashboard could forward queries to the original Claude Code session in the Windows terminal, where the user is already working. The original session sees:

```
[Pipeline Query from: implementation]
Build failed with: cannot find module 'shared/types'. Is the path correct?

> The path is shared/src/types.rs — check the Cargo.toml path configuration
```

The response gets relayed back to the pipeline session.

**The simplest version**: queries just appear in the dashboard. User responds there. No need to route back to the Windows terminal — the dashboard IS the interaction surface during pipeline execution.

### Data Sources

The dashboard reads these files (all in `.claude-task/{taskId}/`):

| File | Updates | What It Shows |
|------|---------|-------------|
| `pipeline-state.json` | Pipeline engine writes after each step transition | Step statuses, active sessions, retry counts, current step |
| `pipeline-log.jsonl` | Pipeline engine appends per event | Timeline of all step start/complete/fail events |
| `manifest.json` | Heartbeat hook updates per edit | Phase, tool counts, modified files, progress notes |
| `observations.md` | Heartbeat hook appends per edit | Per-file edit log with scope/ownership status |
| `guardian-trigger.json` | Heartbeat hook writes on deviation | Active guardian alerts |
| `reviews/*.md` | Review agents write on completion | Review verdicts and findings |
| `progress.md` | Heartbeat hook renders per edit | Task narrative, phase transitions |
| `pipeline-queries.json` | Pipeline sessions write when stuck | Pending questions for user |

All files are on the shared filesystem (Windows drive mounted in WSL at `/mnt/c/`). The desktop app running on Windows reads them directly — no API needed, just file watching.

### Integration with Memplex

The desktop app already has memplex integration. During pipeline execution:
- **Live knowledge capture**: As sessions produce observations and reviews, memplex can ingest patterns in real-time (not just at completion)
- **Cross-session insights**: "Worker-1 struggled with the same auth.ts issue that was resolved in a previous task" — memplex surfaces this to the dashboard
- **Post-pipeline analysis**: After the pipeline completes, memplex processes the full observation log for cross-task learning

## CLI Interface (Primary — No App Required)

The pipeline works fully from the terminal. The desktop app is optional visual polish.

### Pipeline Execution

```bash
# Start pipeline from approved plan
tp pipeline "add event engine" --task-id TASK-event-engine-v1
tp pipeline "add auth" --route standard --profile standard
tp pipeline "redesign API" --route blueprint --profile enterprise

# Start from existing plan (after /taskplex:plan)
tp pipeline --plan PLAN-20260406-frontend --route blueprint

# Resume a paused pipeline
tp pipeline resume --task-id TASK-event-engine-v1
```

### Monitoring

```bash
# Kanban status view (ASCII)
tp status

═══ TaskPlex Pipeline: event-engine ═══
Route: Blueprint | Profile: Enterprise | Elapsed: 12m 34s

 DONE            ACTIVE           QUEUED
 ────            ──────           ──────
 ✓ Spec          ▶ Worker-1       □ QA Journeys
 ✓ Critic          12/15 files    □ Verification
 ✓ Test Plan     ▶ Worker-2       □ Security Review
                    8/10 files    □ Code Review
                 ▶ Worker-3       □ Closure
                    3/7 files     □ Compliance
                                  □ Commit

# Watch mode — auto-refreshes every 2 seconds
tp status --watch

# Detailed step status
tp status --detail

Step: implementation
  Session: implementation-team
  Teammates: 3 active (worker-1, worker-2, worker-3)
  Worker-1: 12/15 files, 47 tool calls, 1 fix round, in-scope
  Worker-2: 8/10 files, 32 tool calls, 0 fix rounds, in-scope
  Worker-3: 3/7 files, 18 tool calls, 0 fix rounds, 1 scope warning
  Guardian: 1 scope warning (worker-3 edited utils.rs — not in plan)
  Next: merge → build gate → QA
```

### Session Inspection

```bash
# See last N lines of a session's terminal output
tp peek worker-1
tp peek worker-1 -n 200

# Follow mode — streams output like tail -f
tp peek worker-1 -f

# Full tmux attach — you ARE in the session, can type
tp attach worker-1
# Detach: Ctrl-B then D (standard tmux detach)

# See all observations for a session
tp log worker-1

[14:32:01] EDIT core/src/events.rs owner:worker-1 status:in-scope
[14:32:15] EDIT core/src/events.rs owner:worker-1 status:in-scope
[14:33:02] EDIT api/src/routes.rs  owner:worker-1 status:in-scope
[14:33:45] BASH cargo check -p core → exit 0
[14:34:12] EDIT core/src/utils.rs  owner:worker-1 status:OUT-OF-SCOPE ⚠

# Full pipeline event log
tp log

[14:20:00] PIPELINE START route=blueprint profile=enterprise
[14:20:02] STEP spec STARTED session=planning-team
[14:24:15] STEP spec COMPLETED artifacts=[spec.md, file-ownership.json]
[14:24:16] STEP critic STARTED session=planning-team
[14:25:30] STEP critic COMPLETED verdict=APPROVED round=2
[14:25:31] STEP test-plan STARTED session=verification
[14:27:00] STEP test-plan COMPLETED artifacts=[test-plan.md]
[14:27:01] STEP implementation STARTED session=implementation-team teammates=3
[14:34:12] GUARDIAN scope-warning worker-3 core/src/utils.rs
```

### Session Management

```bash
# Stop a session (pauses workflow — dependent steps wait)
tp stop worker-1
# Output: Worker-1 stopped. Dependent steps (merge, QA) now blocked.

# Stop all sessions
tp stop --all

# Restart a stopped or failed session
tp restart worker-1
# Output: Worker-1 restarted (attempt 2/3). Context from attempt 1 included.

# Kill pipeline entirely (abort, no cleanup)
tp kill
# Output: Pipeline killed. 3 sessions terminated. Task status: aborted.
```

### User Interaction

```bash
# Show pending questions from pipeline sessions
tp queries

[PENDING] Worker-1 asks:
  "Build failed: cannot find module 'shared/types'. Is the path correct?"
  Session: implementation | Step: implementation | 2 minutes ago

[PENDING] Security reviewer asks:
  "Found OAuth redirect to user-supplied URL. Is this intentional?"
  Session: validation | Step: security-review | 30 seconds ago

# Respond to a query
tp respond worker-1 "The path is shared/src/types.rs — check Cargo.toml"
tp respond security "No, that's a bug — the redirect URL should be validated"

# Send a message to any session proactively
tp send worker-1 "Focus on the API routes first, leave the scheduler for last"
```

### Review Inspection

```bash
# Show review verdicts
tp reviews

 Review              Verdict    Findings   Evidence
 ──────              ───────    ────────   ────────
 security.md         PASS       0 critical  8 citations
 code-quality.md     NEEDS_REV  3 must-fix  12 citations
 closure.md          APPROVED   33/35 ACs   35 citations
 database.md         WARN       2 issues    5 citations
 e2e.md              PASS       3 journeys  9 screenshots
 compliance.md       (pending)

# Show specific review detail
tp review security

# Show guardian status
tp guardian

 Trigger      Threshold   Current   Status
 ──────       ─────────   ───────   ──────
 Scope        3+ files    1         OK
 Ownership    1+ conflict 0         OK
 Build loop   3+ rounds   1         OK
```

### Pipeline Configuration

```bash
# List available workflows
tp workflows
  default.yaml     Standard route pipeline
  blueprint.yaml   Blueprint route with waves + agent teams
  light.yaml       Minimal pipeline (no reviews)

# Validate a workflow
tp validate blueprint.yaml
  ✓ 7 steps defined
  ✓ All agent definitions found
  ✓ Artifact requirements valid
  ✓ Dependencies acyclic
  ✓ Loop-back targets valid

# Show pipeline config
tp config
  Agent: claude (Claude Code)
  Timeout: 10m per step
  Max retries: 3
  Worktree cap: 8
  Quality profile: enterprise
```

### Relationship: CLI vs Dashboard App

| Capability | CLI (`tp`) | Dashboard App |
|-----------|-----------|---------------|
| Start pipeline | `tp pipeline "task"` | Click "New Pipeline" |
| Kanban status | `tp status` (ASCII) | Visual board with drag |
| Live terminal | `tp peek -f` / `tp attach` | Embedded terminal view |
| Stop/restart | `tp stop` / `tp restart` | Click buttons on card |
| Queries | `tp queries` / `tp respond` | Notification + reply box |
| Review verdicts | `tp reviews` | Cards with verdict badges |
| Guardian alerts | `tp guardian` | Warning indicators on cards |
| Event log | `tp log` | Scrollable timeline |
| Memplex insights | — | Cross-session knowledge overlay |

The CLI is the primary interface. The app adds: visual kanban, click-to-attach, memplex integration, and persistent history across tasks.

## Open Questions

1. **Agent Teams experimental status.** If we depend on Agent Teams for within-session parallelism and they change or break, the pipeline degrades to sequential execution within each session (one reviewer at a time instead of parallel). Acceptable — just slower.

2. **Cost at scale.** Blueprint with teams: ~$20-35 per task. Standard without teams: ~$8-12. Light (no pipeline): ~$3-5. Is the cost gradient acceptable? Users self-select via route choice.

3. **Windows support.** tmux doesn't run natively on Windows. Options: WSL (works, adds friction), or a Windows-native session manager. DevPit has the same limitation. Current user is on Windows — this is a real blocker.

4. **Pipeline engine as Go binary or Node.js?** DevPit uses Go. TaskPlex could use Node.js (already in the ecosystem — hooks are .mjs). Go is faster and compiles to a single binary. Node.js is more accessible for contributors.

5. **Start without Agent Teams?** Phase 1: sequential sessions (like DevPit). Phase 2: add Agent Teams for parallelism. This removes the experimental dependency for the initial build.

6. **How does the original session know the pipeline is done?** Options: (a) polling — check for completion artifact, (b) the pipeline engine writes a signal file and the session's heartbeat hook detects it, (c) the user manually resumes with `/taskplex:complete`.

7. **Should the pipeline engine be distributed separately?** It's a binary, not a plugin. Options: npm package (`npx taskplex-pipeline`), homebrew, or bundled in the plugin's `bin/` directory (Claude Code plugins support `bin/` for executables added to PATH).
