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
- Implementation delegation — team/blueprint routes must use agents, not inline coding

---

## 2. Entry Points

There are **four paths** into TaskPlex, each serving a different purpose:

### 2.1 `/taskplex` (or `/tp`) — Task Execution

**Files**: `~/.claude/commands/taskplex.md`, `~/.claude/commands/tp.md`

The primary command. Runs the full workflow from design through implementation to validation and completion.

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
1. The `tp-prompt-check` hook fires (UserPromptSubmit event) — injects workflow reminder or active task warning
2. If evolutions.json exists for the taskplex skill, load it (Step 0.5)
3. The orchestrator reads `~/.claude/taskplex/phases/init.md` and begins Step 0

### 2.2 `/plan` — Strategic Thinking & Architecture

**Files**: `~/.claude/commands/plan.md`, `~/.claude/skills/plan/skill.md`

Pre-implementation thinking. Produces approved plan files that feed into `/tp`.

**Two routes**:
- **Full** — Research → Product Context (brief) → Architecture → Critic review
- **Quick** — Architecture → Critic review (skip research and product context)

**Output**: `PLAN-{id}.md` in `.claude-task/plans/` with `processedByLifecycle: true` metadata. When fed to `/tp --plan PLAN-{id}`, it skips redundant planning.

### 2.3 `/evaluate` — Audit What Exists

**Files**: `~/.claude/skills/evaluate/skill.md`, `~/.claude/skills/evaluate/modes/`

Two modes: **Audit** (investigate quality) and **Review** (validate against brief). Also invoked automatically at task completion if `product/brief.md` exists.

### 2.4 `frontend` — Frontend Development Skill

**Files**: `~/.claude/skills/frontend/skill.md`, `~/.claude/skills/frontend/references/`, `~/.claude/skills/frontend/templates/`

**Standalone skill** — works in any coding agent (Claude Code, Codex, Cursor) without TaskPlex. Triggers automatically on UI work (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.css` files).

Provides:
- Design system detection (component libraries, tokens, themes, icons)
- CSS approach detection and enforcement (Tailwind, CSS Modules, styled-components)
- Component specification template (props, states, variants, accessibility)
- Accessibility checklist (WCAG, ARIA, keyboard nav, contrast)
- Responsive design patterns (breakpoint detection, mobile-first)
- Visual review protocol (screenshot-based QA via agent-browser)

**TaskPlex integration**: When running via `/tp`, enriches Sub-phase A (conventions), Sub-phase B (UI questions), planning (component specs), implementation (CSS/component conventions in agent context), and QA (visual review).

**Complements** the `frontend-design` plugin (aesthetic guidance) with structural rigor (architecture, accessibility, responsive, conventions).

### 2.5 `/solidify` — Merge Skill Evolutions

**File**: `~/.claude/commands/solidify.md`

User-initiated merge of staged skill improvements from `evolutions.json` into skill source files. Part of the skill evolution system.

### 2.6 How They Connect

```
/plan ──produces──▶ PLAN-{id}.md ──feeds──▶ /tp --plan PLAN-{id}
                                                    │
                                              (builds it)
                                          frontend skill enriches UI tasks
                                                    │
                                                    ▼
                                            /evaluate (review mode)
                                         validates against brief
                                                    │
                                                    ▼
                                      skill evolution detects signals
                                                    │
                                                    ▼
                                      /solidify merges improvements
```

---

## 3. The Workflow

### Phase -1: Project Bootstrap (one-time)

**File**: `~/.claude/taskplex/phases/bootstrap.md`

**Trigger**: Only when no `INTENT.md` exists in the project root.

Uses the **adaptive interaction model** — no autonomous agent generation. The orchestrator:

1. **Gathers context** (< 30 seconds) from 4 sources:
   - Source A: invocation context (task description, flags)
   - Source B: project documentation (README, CLAUDE.md, package.json)
   - Source C: structural scan (glob, grep for domain signals)
   - Source D: memplex knowledge (if available — search_knowledge, query_knowledge_graph)
2. **Synthesizes and confirms** — adapts question to context density (high/medium/low)
3. **Targeted follow-ups** (0-3 questions) — only about gaps
4. **Drafts INTENT.md** from conversation — presents for user review

Convention bootstrap (Phase -0.5) is deferred — runs in background, presents after completion.

### Phase 0: Initialization

**File**: `~/.claude/taskplex/phases/init.md`

| Step | What |
|------|------|
| 0a | Parse task description |
| 0b | Route selection (Standard/Team/Blueprint or menu) |
| 1 | Create `.claude-task/{taskId}/manifest.json` |
| 2 | Create session file |
| **2b** | **Create task list** (TaskCreate for high-level phases — refined later at Phase A.4) |
| 3 | Load context (INTENT.md, CONVENTIONS.md, CLAUDE.md) |
| **3a** | **Detect memplex availability** (check for MCP tools, set `manifest.memplexAvailable`, first-task notice) |
| 3b | PRD/Plan detection (only on explicit flags) |
| 4 | Detect project type, load convention overrides, conflict detection, git config |

**Sub-phase A — Convention Check**:
- Both modes: Automated scan + memplex convention lookup (if available)
- Full mode adds: 2-4 targeted questions

**Sub-phase B — Research & Discovery** (designed, not yet built — see `design-plan-merge.md`):
- Blueprint + Standard-conditional: Read references, investigate problem space, scan codebase, present research summary
- Light: Skipped

**Sub-phase C — Product Context** (designed, not yet built — see `design-plan-merge.md`):
- Blueprint only: User profiles, core journeys (DOES/SEES/FEELS tables), jobs to be done, feature assessment (Kill/Fix/Keep/Build/Defer), contract + scope
- Produces `product/brief.md` (project-level, persists across tasks)
- Standard + Light: Skipped (Standard gets lightweight journeys in Sub-phase D)

**Sub-phase D — Intent Exploration (Adaptive Interaction Model v2)**:

Context gathered from **4 sources** before asking anything:
1. **Invocation context** — task description, flags, referenced files
2. **Project documentation** — INTENT.md, CLAUDE.md, product/brief.md
3. **Quick codebase scan** — 3-5 Grep/Glob calls
4. **Memplex knowledge** (if available) — past decisions, rejected approaches, corrections

Enriched with (designed, not yet built):
- **Intent file**: `.claude-task/{taskId}/intent.md` — confirmed problem, goal, scope, user decisions as architect guardrails
- **Journey integration**: Blueprint uses journey tables from Sub-phase C. Standard generates lightweight inline tables.

**Gate criteria** (flags, not counters):
| Mode | Required |
|------|----------|
| **Full** | `contextConfirmed` + `ambiguitiesResolved` + `approachSelected` + `sectionsApproved >= 1` |
| **Light** | `contextConfirmed` |

**Step 7b — Goal Traceability** (if INTENT.md exists): Map each acceptance criterion in brief.md back to INTENT.md success criteria. Stored in `manifest.goalTraceability`. Informational, not a gate.

### Phase 1: Planning

**File**: `~/.claude/taskplex/phases/planning.md`

**User Visibility Rules** (hard rule, all routes):
- Before every agent spawn: tell the user what's happening and estimated time
- After every agent return: read the artifact and **present it inline** — never say "review file X"
- Present artifacts section by section for long outputs

**Execution Continuity Rule** (hard rule, all routes):
- User's last checkpoint is Pre-Implementation Acknowledgment
- After that, implementation runs non-stop — no "should I continue?"
- Independent agents dispatched in a single message (parallel tool calls)

| Step | Standard | Team | Blueprint |
|------|----------|------|-----------|
| A | Planning agent writes spec | Planning agent writes spec + sections + file-ownership | Architecture decisions with user |
| A.1 | Research (conditional) | Research (conditional) | Architect (opus) writes architecture + spec + worker briefs |
| A.2 | Spec critic (closure-agent, haiku) | Spec critic | User reviews architecture inline |
| A.3 | **User reviews full spec inline** | **User reviews full spec inline** | Research (conditional) |
| **A.4** | **Refine task list** — replace placeholders with actual plan tasks | **Refine task list** — per-worker tasks | **Refine task list** — per-worker tasks |
| B | Implementation agent (sonnet) | Workers dispatched in parallel | Workers dispatched in parallel to worktrees |
| — | Coherence check (haiku) | Coherence check per worker | Coherence check per worker (before merge) |
| — | Build gate (typecheck + lint + tests) | Merge + build gate | Merge + build gate |
| — | Update documentation | Update documentation | Update documentation |

**Memplex context assembly**: Before every agent spawn, if memplex available, orchestrator calls `file_intelligence`, `get_error_resolution`, `search_knowledge` and includes results in agent prompt as "Known Context" block.

**Implementation gate**: The `tp-design-gate` hook blocks orchestrator source edits in team/blueprint mode until `manifest.implementationDelegated = true` (set after agents are dispatched).

### Phase 4.5: QA

**File**: `~/.claude/taskplex/phases/qa.md`

| Product Type | QA Method |
|-------------|-----------|
| UI App (web) | Browser walkthrough via agent-browser |
| CLI | Run commands, check exit codes and output |
| API / Service | Call endpoints, check responses |
| Library / Module | Skip (no runnable surface) |

Steps: Smoke test → Journey walkthrough → Adversarial verification (spawns verification agent) → Bug triage + context-preserving fix loop (max 3 rounds, fix agent preserves context via SendMessage, verification agent re-checks after each round, memplex error resolution check) → QA report.

### Phase 5: Validation

**File**: `~/.claude/taskplex/phases/validation.md`

**Stage 1 — Review Gates** (ordered per `gates.md`):

| Step | Gate | Agent | Model |
|------|------|-------|-------|
| 0 | Artifact validation | (orchestrator) | — |
| 0.5 | Traceability | (orchestrator) | — |
| 1 | Build validation | (orchestrator) / build-fixer | sonnet |
| 1b | Convention compliance | (orchestrator) | — |
| 2 | Security review | security-reviewer | sonnet |
| 3 | Closure | closure-agent | haiku |
| 4 | Code review | code-reviewer | sonnet |
| 5 | Conditional (database, e2e, user-workflow) | database-reviewer / e2e-reviewer / user-workflow-reviewer | sonnet/haiku |
| 5.5 | Enterprise gates (E1-E3) | (orchestrator) | — |
| 5.7 | Custom gates | (from conventions.json) | — |
| 6 | Build-fixer | build-fixer | sonnet |

**Stage 2 — Hardening** (standard + enterprise):
- hardening-reviewer (sonnet) runs automated checks + builds human checklist
- Red-line rules block regardless of score

**Stage 3 — Completion**:

| Step | What |
|------|------|
| 8 | Compliance agent (haiku) — mandatory final gate |
| 9 | Write validation-gate.json |
| 10 | Git commit + push/PR |
| 11.4 | **Memplex knowledge persistence** (write file couplings, error resolutions, patterns, decisions) |
| 11.5 | **Skill evolution** (detect signals, generate evolution entry if threshold exceeded) |
| 11.7 | Product brief validation (if product/brief.md exists) |
| Summary | Present consolidated task summary with memplex + evolution info |

---

## 4. Execution Routes

### 4.1 Standard Route

```
Orchestrator
    │
    ├──▶ [Pre-spawn status message]
    ├──▶ [Memplex context assembly]
    ├──▶ Planning Agent (sonnet)
    │       Writes: spec.md
    │
    ├──▶ Spec Critic — closure-agent (haiku)
    │
    ├──▶ [User reviews full spec inline]
    ├──▶ [Refine task list from plan]
    │
    ├──▶ [Pre-spawn status + memplex assembly]
    ├──▶ Implementation Agent (sonnet)
    │
    ├──▶ Coherence Check — closure-agent (haiku, fast)
    ├──▶ Build Gate (typecheck + lint + tests)
    ├──▶ Update Documentation
    │
    ├──▶ QA Phase
    └──▶ Validation Pipeline
```

### 4.2 Team Route

```
Orchestrator
    │
    ├──▶ Planning Agent (sonnet, team mode)
    │       Writes: spec.md, sections.json, file-ownership.json
    │
    ├──▶ Spec Critic — closure-agent (haiku)
    ├──▶ [User reviews full spec inline]
    ├──▶ [Refine task list — per-worker tasks]
    │
    ├──┬──▶ Worker 1 (sonnet) — all dispatched in ONE message
    │  ├──▶ Worker 2 (sonnet)
    │  └──▶ Worker 3 (sonnet)
    │
    ├──▶ Coherence Check per worker (parallel haiku calls)
    ├──▶ Build Gate
    ├──▶ Update Documentation
    │
    ├──▶ QA Phase
    └──▶ Validation Pipeline
```

### 4.3 Blueprint Route

```
Orchestrator
    │
    ├──▶ [Architecture decisions with user]
    │
    ├──▶ [Pre-spawn status: "Spawning architect, 5-15 minutes..."]
    ├──▶ [Memplex context assembly]
    ├──▶ Architect (opus)
    │
    ├──▶ [Present architecture + spec INLINE — section by section]
    ├──▶ [User reviews and approves]
    ├──▶ [Refine task list — per-worker tasks]
    │
    ├──▶ Researcher (sonnet, conditional)
    │
    ├──┬──▶ Worker 1 (sonnet, worktree) — all dispatched in ONE message
    │  ├──▶ Worker 2 (sonnet, worktree)
    │  └──▶ Worker 3 (sonnet, worktree)
    │
    ├──▶ Coherence Check per worker (before merge)
    ├──▶ Merge + Build Gate
    ├──▶ Update Documentation
    │
    ├──▶ QA Phase
    └──▶ Validation Pipeline
```

### 4.4 Initiative Mode (`--prd`)

Blueprint at scale:
- Feature decomposition into wave-based execution
- Wave 0 (sequential) → Wave 1+ (parallel via worktrees)
- **Wave validation**: build gate (typecheck + lint + tests) per wave — blocks next wave if broken
- Cross-feature closure check at finalization
- Full validation pipeline runs once at the end

---

## 5. Quality Profiles

**User-confirmed**: The quality profile is presented to the user during init (Step 5) with auto-detected defaults. The user must approve or change it. Even in autonomous mode, this is agreed upfront — the agent never picks its own oversight level.

| Profile | Required Gates | Hardening | Default For |
|---------|---------------|-----------|-------------|
| **Lean** | Build checks only | Skipped | Light route |
| **Standard** | security, closure, code review (3 agents) | Advisory (red-lines block) | Standard route |
| **Enterprise** | All standard + hardening (blocking) + compliance (5+ agents) | Blocking | Blueprint route |

**Validation artifact gate** (pre-commit hook): The commit is blocked unless the actual review files exist on disk. Inline grep checks do not produce these files — the review agents must be spawned.

| Profile | Required Artifacts Before Commit |
|---------|--------------------------------|
| **Lean** | None — build pass sufficient |
| **Standard** | `reviews/security.md` + `reviews/closure.md` + `reviews/code-quality.md` |
| **Enterprise** | All of standard + `hardening/report.md` + `reviews/compliance.md` |

---

## 6. Hooks

### 6.1 Hook Architecture

```
User types /tp ──▶ UserPromptSubmit ──▶ tp-prompt-check.mjs
                                           ├─ Detects /tp invocation
                                           ├─ Warns about active tasks
                                           └─ Injects workflow reminder

Claude writes code ──▶ PreToolUse (Edit|Write) ──▶ tp-design-gate.mjs
                                                       ├─ DESIGN GATE: Checks designPhase + artifact mapping
                                                       ├─ Checks interaction evidence flags
                                                       └─ IMPLEMENTATION GATE: Blocks orchestrator source
                                                          edits in team/blueprint until implementationDelegated

Claude edits file ──▶ PostToolUse (Edit|Write) ──▶ tp-heartbeat.mjs (async)
                                                       ├─ Tracks modified files
                                                       ├─ Increments tool call counters
                                                       ├─ Auto-promotes phase
                                                       └─ Renders progress.md + compaction guard

Claude reads/greps ──▶ PostToolUse (Read|Bash|...) ──▶ start-task-sentinel.mjs (async)
                                                          └─ Tool counting + compaction guard

Claude runs git commit ──▶ PreToolUse (Bash) ──▶ tp-pre-commit.mjs
                                                     └─ BLOCKS if validation not passed

Context compaction ──▶ PreCompact ──▶ tp-pre-compact.mjs
                                         └─ Snapshots manifest + phaseChecklist to checkpoints/

Session start ──▶ SessionStart ──▶ tp-session-start.mjs
                                       ├─ Detects active tasks
                                       ├─ Renders phase checklist from manifest
                                       ├─ Instructs TaskCreate recreation
                                       └─ Injects recovery context

Session stop ──▶ Stop ──▶ tp-stop.mjs
                              └─ Blocks stop during incomplete validation (non-lean)
```

### 6.2 Hook Details

| Hook | Event | Matcher | Blocking | Timeout |
|------|-------|---------|----------|---------|
| `tp-prompt-check` | UserPromptSubmit | all | No | 5s |
| `tp-design-gate` | PreToolUse | `Edit\|Write` | **Yes** (design gate + implementation gate) | 5s |
| `tp-pre-commit` | PreToolUse | `Bash` | **Yes** | 10s |
| `tp-heartbeat` | PostToolUse | `Edit\|Write` | No (async) | 5s |
| `start-task-sentinel` | PostToolUse | `Read\|Bash\|Grep\|...` | No (async) | 3s |
| `tp-pre-compact` | PreCompact | `*` | No | 10s |
| `tp-session-start` | SessionStart | `startup\|resume\|compact` | No | 10s |
| `tp-stop` | Stop | all | **Conditional** | 10s |

### 6.3 Design & Implementation Gate

The `tp-design-gate.mjs` hook serves two enforcement roles:

**Design gate** (during init/brief phases):
- Artifact-to-sub-phase mapping (e.g., brief.md requires `brief-writing` phase)
- Interaction evidence flags (`contextConfirmed`, `ambiguitiesResolved`, `approachSelected`, `sectionsApproved`)

**Implementation gates** (during implementation/qa phases, inside `isSourceFile()` check):

| Gate | Check | Routes | Block Message |
|------|-------|--------|---------------|
| **Acknowledgment** | `planSource.userAcknowledged !== true` | All (including Light) | "Run Pre-Implementation Acknowledgment" |
| **Critic** | `criticCompleted !== true` | Standard, Team, Blueprint (Light exempt) | Route-specific: Blueprint mentions strategic/tactical, Standard mentions spec critic |
| **Implementation delegated** | `implementationDelegated !== true` | Standard, Team, Blueprint | "Delegate to agents, not inline" |
| **Wave** | Previous wave not completed/validated | Blueprint only | "Complete previous wave first" |

Gate ordering: Acknowledgment → Critic → Implementation delegated → Wave. Each gate runs only if the previous one passes.

The **critic gate** includes artifact-based fallback detection: if `criticCompleted` flag is not set but review files exist in `reviews/` (e.g., `strategic-review*.md`), the hook auto-sets the flag. This prevents deadlock when the orchestrator forgets to set it.

`.claude-task/` artifacts always allowed — gates only block source file writes.

### 6.5 Worktree Management (TaskPlex-managed)

Blueprint route agents work in isolated git worktrees managed directly by TaskPlex via `git worktree` commands — NOT via Claude Code's `isolation: "worktree"` parameter. This is intentional for cross-runtime portability (Cursor, Codex, Gemini, OpenCode, Windsurf, Antigravity all have git).

**Lifecycle**:
1. **Create**: `git worktree add .claude-task/{taskId}/worktrees/worker-{n} -b tp-worker-{taskId}-{n}`
2. **Agent prompt**: Includes worktree path as working directory
3. **Merge**: `git merge --no-ff tp-worker-{taskId}-{n}` (merge-resolver agent if conflicts)
4. **Cleanup**: `git worktree remove` + `git branch -d`

**Tracked in**: `manifest.worktrees.{worker}.{path, branch, status, createdAt, mergedAt}`

Standard route does NOT use worktrees — agents share the workspace with file-ownership.json enforcement.

### 6.4 Compaction Survival

```
manifest.phaseChecklist ──written by orchestrator──▶ manifest.json on disk
                                                          │
tp-heartbeat writes manifest on every edit ────────────▶ disk
                                                          │
tp-pre-compact snapshots to checkpoints/ ──────────────▶ disk
                                                          │
tp-session-start reads manifest + checkpoint ───────────▶ injects into context
                                                          │
                                              instructs TaskCreate recreation
```

---

## 7. Subagent Architecture

### 7.1 Core Principle: Write to Disk, Return Structured Summary

Agents write detailed output to `.claude-task/{taskId}/` and return a **structured working summary** (~20-40 lines). Not a terse 3-liner, not the full artifact. The orchestrator presents this summary inline — files are for persistence, the conversation is where the user reviews.

Summary format: component/section name + what it does + files + key decisions + which ACs it addresses.

### 7.2 Memplex Context Assembly

Since agents cannot call MCP tools, the orchestrator hydrates each agent's prompt before spawning:

1. `file_intelligence` per primary file (max 3) — coupled files, known issues
2. `get_error_resolution` — previously solved errors in target files
3. `search_knowledge` scoped to agent's section — patterns, decisions, corrections
4. Results formatted as "Known Context" block in agent prompt

If memplex unavailable: block omitted, agent gets spec + brief + conventions only.

### 7.3 Agent Roster

| Agent | Model | Can Edit | Purpose |
|-------|-------|:---:|---------|
| **planning-agent** | sonnet | No | Write spec.md from brief, interact with user |
| **architect** | opus | No | Design architecture, write worker briefs, structured summary return |
| **implementation-agent** | sonnet | **Yes** | Implement code changes per spec, mandatory self-verification. LSP diagnostics after edits, find_references before signature changes, ast-grep for structural transforms. |
| **verification-agent** | sonnet | No | Adversarial testing — tries to break code. Two modes: test-plan (pre-impl) and verify (QA). Cannot edit files. LSP diagnostics sweep + ast-grep structural checks. |
| **security-reviewer** | sonnet | No | OWASP-focused security scan, CVE lookups via WebSearch |
| **closure-agent** | haiku | No | Requirements traceability, brief verification, spec critic |
| **code-reviewer** | sonnet | No | Code quality, convention compliance. LSP type checks + ast-grep convention scanning. |
| **hardening-reviewer** | sonnet | No | Production readiness, runs audit tools via Bash. Validates production impact assessment (rollout, rollback, risks, monitoring). |
| **database-reviewer** | sonnet | No | Query correctness, schema, migration safety |
| **e2e-reviewer** | sonnet | No | Live UI validation via Playwright MCP (preferred) or agent-browser (fallback) |
| **user-workflow-reviewer** | haiku | No | Navigation coherence, orphaned features |
| **compliance-agent** | haiku | No | Final gate — process + convention audit |
| **researcher** | sonnet | No | External research, web search |
| **build-fixer** | sonnet | **Yes** | Fix build/review issues |
| **merge-resolver** | sonnet | **Yes** | Git merge conflict resolution |
| **prd-bootstrap** | opus | No | Initiative mode PRD generation |
| **strategic-critic** | opus | No | Strategic review of PRDs |
| **tactical-critic** | sonnet | No | Tactical review of per-feature specs |
| **drift-scanner** | haiku | No | Read-only codebase drift scan (conventions, deps, imports, dead code). LSP diagnostics sweep + ast-grep structural drift detection. |
| **session-guardian** | haiku | No | One-shot analysis agent for scope/ownership/build-loop deviations. Spawned by orchestrator when guardian trigger file detected. |

**Shared reference**: `review-standards.md` — anti-rationalization rules, evidence requirements, adversarial mindset. Referenced by all review agents.

### 7.4 Agent Tool Permissions

| Role | Read | Glob | Grep | Write | Edit | Bash | Web | AskUser |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| planning-agent | Y | Y | Y | Y | - | - | - | Y |
| architect | Y | Y | Y | Y* | - | - | Y | - |
| implementation-agent | Y | Y | Y | Y | Y | Y | - | - |
| security-reviewer | Y | Y | Y | Y** | - | - | Y | - |
| closure-agent | Y | Y | Y | Y** | - | - | - | - |
| code-reviewer | Y | Y | Y | Y** | - | - | - | - |
| hardening-reviewer | Y | Y | Y | Y** | - | Y | - | - |
| database-reviewer | Y | Y | Y | Y** | - | - | - | - |
| e2e-reviewer | Y | Y | Y | Y** | - | Y*** | - | - |
| user-workflow-reviewer | Y | Y | Y | Y** | - | - | - | - |
| compliance-agent | Y | Y | Y | Y** | - | - | - | - |
| researcher | Y | Y | Y | Y**** | - | - | Y | - |
| build-fixer | Y | Y | Y | - | Y | Y | - | - |

\* .claude-task/ only | \** review report paths only | \*** agent-browser only | \**** research/ only

### 7.5 Handoff Contract

Every agent transition produces a structured record in `manifest.workerHandoffs[]`:
```json
{
  "workerId": "worker-auth-01",
  "direction": "orchestrator→worker | worker→orchestrator",
  "context": { "currentState": "...", "relevantFiles": [...] },
  "deliverable": { "description": "...", "acceptanceCriteria": [...] },
  "verdict": { "status": "pass|fail|blocked", "evidence": [...] }
}
```

### 7.6 Three-Contract Chain (Intent → Test → Verification)

Quality assurance flows through three pre-committed contracts:

```
Brief (ACs)
    ▼
1. INTENT CONTRACT (Phase A.3)
   AC-1.1 → Wave 0: Auth ✓
   AC-2.1 → Wave 1: Dashboard ✓
   AC-3.1 → NOT MAPPED ⚠️  ← caught before implementation
   "Every requirement has a home in the plan"
    ▼
2. TEST CONTRACT (Phase A.3b)
   AC-1.1 → "I will: POST /register, POST /login, test expired token"
   AC-2.1 → "I will: GET /dashboard, check streaming, verify stats"
   "Every feature has a pre-committed test"
    ▼
3. VERIFICATION (QA 4.5.4)
   Execute pre-committed tests
   Run adversarial probes (boundary, concurrency, injection, etc.)
   "Every test was run with command+output evidence"
```

### 7.7 Verification Agent (Adversarial Testing)

The verification agent operates in two modes:

**Mode 1 — Test Plan** (pre-implementation, Phase A.3b): Reads the spec, produces `test-plan.md` listing exact checks and adversarial probes it will run. The implementation agent sees this plan. Sprint contract pattern.

**Mode 2 — Verify** (QA Step 4.5.4): Executes the pre-committed test plan. Must run commands for evidence — code reading rejected. At least 3 adversarial probes mandatory. Anti-rationalization prompts prevent skip-and-pass behavior.

Cannot edit files. Reports bugs to the orchestrator for the context-preserving fix loop (see 7.11).

### 7.8 Implementation Coherence Check

After each agent returns, before build gate: spawn closure-agent (haiku) for a fast spec-vs-code check. If DRIFT detected, one revision round. Prevents design drift from compounding before validation.

### 7.9 Narrative Progress (Cold Start Recovery)

`progress.md` includes a Task Narrative section assembled by the heartbeat hook:
- Task description, approach (from brief.md), current focus, key decisions, blockers, next steps
- Phase transition log with narrative summaries
- Injected ABOVE the phase checklist on session resume (first thing LLM reads)
- Included in pre-compact checkpoints

### 7.10 Code Intelligence (LSP + ast-grep)

Four agents reference code intelligence tools with graceful degradation — agents fall back to grep/build when unavailable:

**LSP operations used**:
| Operation | Agents | Purpose |
|-----------|--------|---------|
| `lsp_diagnostics` | implementation, verification, code-review, drift | Type errors after edits, codebase-wide type health |
| `lsp_find_references` | implementation, verification, code-review, drift | Call site discovery, dead export detection, wiring verification |
| `lsp_rename` | implementation | Semantic rename across all files |
| `lsp_goto_definition` | implementation | Navigate through aliases, re-exports, type defs |
| `lsp_hover` | code-review | Type context without tracing definitions |

**ast-grep patterns used**:
- Convention violation scanning (default exports, wrong libraries, missing wrappers)
- Auth middleware verification on API routes
- Dead console.log detection (actual calls only, not comments)
- Pattern compliance checking against conventions.json

**Design principle**: No agent requires these tools. Every operation has a grep/build fallback. But when available, they prevent entire bug categories (stale references, structural drift, dead exports) that text search cannot catch.

### 7.11 Context-Preserving QA Fix Loop

When the QA phase finds bugs (Step 4.5.5), the fix loop preserves agent context across iterations instead of spawning cold agents:

**For Standard/Blueprint routes**:
1. **Round 1**: Spawn focused fix agent with verification report + original spec + bug list
2. **Round 2+**: Continue same agent via `SendMessage` (preserves context). Falls back to new agent with round 1 summary if runtime doesn't support continuation.
3. After each fix round, the **verification agent** re-checks — not the fix agent self-assessing

**For Light route**: Fix inline (orchestrator already has context).

**Key invariant**: The exit condition is controlled by the adversarial verification agent, not the fixer. Max 3 rounds, then hard escalate. This is bounded iteration with external verification — not open-ended self-assessment.

### 7.12 Production Impact Assessment

Conditional section in spec.md, triggered when tasks touch production-sensitive areas.

**Detection** (orchestrator, before spawning planning agent): Grep brief.md + modified files for triggers:
- Database queries, schemas, migrations
- API endpoints serving external traffic
- Caching logic, TTLs, cache invalidation
- Authentication, authorization, session handling
- Infrastructure configuration (CI/CD, deployment, env vars)
- Retry logic, timeouts, circuit breakers
- Shared services consumed by multiple systems

**Spec section** (written by planning agent when triggered):
- **Blast radius**: Services affected, traffic exposure
- **Rollout strategy**: Feature flag, canary, blue-green, or immediate
- **Rollback plan**: Specific steps to reverse the change
- **Operational risks**: Identified risks with mitigations
- **Monitoring**: Key metrics and alert conditions

**Validation** (hardening reviewer): Checks that the section exists when triggers are present, and that each sub-section is substantive (specific rollback steps, named metrics, at least 1 operational risk). Missing section flagged as P0 for infrastructure-touching changes.

**Skipped for**: Pure UI changes, internal tooling, documentation, test-only changes, local dev scripts.

### 7.13 Session Guardian (Behavioral Enforcement)

A background observation system layered on top of structural gates. Three phases:

**Phase 1 (built)**: Heartbeat hook (`tp-heartbeat.mjs`) runs cheap synchronous checks on every file edit during implementation/QA:
- **Scope check**: Compares edited file against planned file set (from `file-ownership.json` primary, `spec.md` regex fallback). Warns on out-of-scope source files.
- **Ownership check**: Tracks edits per file with inferred owner from `file-ownership.json` reverse-lookup. Warns when multiple owners edit the same file.
- **File count check**: Warns when `modifiedFiles` count exceeds planned count by >50%.
- **Observation log**: Append-only log at `.claude-task/{taskId}/observations.md` — every edit with timestamp, file, owner, status. Used by Phase 2 triggers and memplex at completion.
- **Phase 2 triggers**: Writes `guardian-trigger.json` when thresholds crossed (3+ scope warnings, 1+ ownership conflict, 3+ build-fix rounds).

**Phase 2 (triggers built, agent spawning via orchestrator)**: Orchestrator checks for `guardian-trigger.json` between wave dispatches. If present, spawns `session-guardian` agent (haiku, read-only) for deeper analysis. Agent reads observations + spec, returns structured alert. Orchestrator writes to `guardian-alerts.md`.

**Phase 3 (deferred)**: Full KAIROS-style persistent background agent. Depends on runtime support for background agents. Design in `session-guardian-design.md`.

**Relationship to structural gates**: Gates (acknowledgment, critic, implementation, wave) block tool calls. Guardian observes and advises. Gates catch state violations. Guardian catches behavioral drift. Defense-in-depth.

---

## 8. State Management

### 8.1 The Manifest (`manifest.json`)

Central state file. Key fields:

| Category | Fields |
|----------|--------|
| Phase tracking | `phase`, `designPhase`, `phaseChecklist` |
| Interaction evidence | `designInteraction` (contextConfirmed, ambiguitiesResolved, approachSelected, sectionsApproved, contextSources, contextDensity) |
| Implementation | `implementationDelegated`, `criticCompleted`, `modifiedFiles`, `implementationAgents` |
| Validation | `validation.*` (per-gate results) |
| Quality | `qualityProfile`, `degradations`, `overrides`, `escalations` |
| Memplex | `memplexAvailable`, `memplexContext`, `knowledgeSaved` |
| Goals | `goalTraceability` (AC-to-INTENT mapping), `intentTraceability` (AC-to-architecture mapping) |
| Evolution | `skillEvolution` (signal, evolution ID, type) |
| Drift | `driftBaseline` (drift index at task start for before/after comparison) |
| Completeness | `completenessCheck` (endpoint-to-frontend coverage), `frontendParity` |
| Git | `git.*` (branch, commits, PR) |
| Workers | `workerHandoffs`, `waveProgress` |

### 8.2 Task List Lifecycle

```
Init Step 2b:     Create high-level placeholder tasks
Phase A.4:        Refine — replace placeholders with actual plan tasks
                  (per-worker, docs, QA method, validation gates)
During execution: TaskUpdate as each step completes
Mid-task changes: User directs updates naturally
Session resume:   Recreate from manifest.phaseChecklist
```

### 8.3 Mid-Task Changes

The user can redirect at any time. The orchestrator:
1. Handles it naturally — scope changes update brief/spec/tasks
2. Always keeps task list current (TaskCreate/TaskUpdate)
3. Always keeps manifest and artifacts current
4. Side questions don't advance workflow state
5. Pause saves state for session-start resume

---

## 9. Memplex Integration

Memplex is an **optional** enhancement. When available, it provides cross-session knowledge. When unavailable, TaskPlex operates fully using codebase scanning.

| Phase | Memplex Call | What it provides |
|-------|-------------|-----------------|
| Bootstrap | search_knowledge, query_knowledge_graph | Prior project context |
| Convention check | search_knowledge("conventions"), file_intelligence | Conventions from past tasks |
| Intent exploration | search_knowledge, search_conversations | Past decisions, rejected approaches |
| Agent spawning | file_intelligence, get_error_resolution, search_knowledge | Per-agent "Known Context" block |
| QA bug fixing | get_error_resolution | Known resolutions for bugs |
| Build-fixer | get_error_resolution | Known resolutions for build errors |
| Completion | write_knowledge | Save couplings, resolutions, patterns, decisions |

**Graceful degradation**: If unavailable, skip silently. No errors, no degradation logged.

**Completion note**: With memplex: "Knowledge saved: {N} couplings, {M} resolutions." Without: "Patterns discovered: {N}. Cross-session persistence requires memplex."

---

## 10. Skill Evolution

**File**: `~/.claude/taskplex/skill-evolution.md`

Skills improve from execution feedback via a staged pipeline:

```
Signal Detection (keyword-based, no LLM)  →  Attribution (which skill?)
    →  Evolution Generator (LLM call)  →  evolutions.json (staged)
    →  /solidify (user-approved merge into SKILL.md)
```

**Signals**: build-fix rounds >= 2, escalations, QA bugs > 2, review resubmissions, user corrections.

**Evolution types**: Troubleshooting (from failures) and Examples (from corrections).

**evolutions.json**: Per-skill file at `~/.claude/skills/{skill}/evolutions.json`. Loaded before skill invocation.

---

## 11. Contract Files

| File | Purpose |
|------|---------|
| `policy.json` | Quality profiles, iteration limits, execution mode configs, agent lists |
| `gates.md` | Gate catalog — names, verdict enums, execution order |
| `artifact-contract.md` | Required artifacts by profile, directory structure |
| `manifest-schema.json` | Canonical field definitions for manifest.json |
| `handoff-contract.md` | Agent-to-agent transition format |
| `hardening-checks.md` | Check registry, risk profiles, red-line rules |
| `portability.md` | Core workflow vs adapter layer separation |
| `skill-evolution.md` | Skill evolution system spec |

---

## 12. File Locations

### Core Contracts
```
~/.claude/taskplex/
├── phases/init.md, planning.md, qa.md, validation.md, bootstrap.md, prd.md
├── policy.json, gates.md, artifact-contract.md, manifest-schema.json
├── handoff-contract.md, hardening-checks.md, portability.md
└── skill-evolution.md
```

### Commands
```
~/.claude/commands/
├── taskplex.md, tp.md        # Main commands (Light/Standard/Blueprint routes)
├── plan.md                   # /plan strategic planning
├── solidify.md               # /solidify skill evolution merge
├── drift.md                  # /drift codebase drift scanner
└── taskplex-adapter-checklist.md
```

### Hooks (9 files)
```
~/.claude/hooks/
├── hook-utils.mjs            # Shared utilities
├── tp-design-gate.mjs        # Design gate + implementation gate
├── tp-session-start.mjs      # Session resume + task recreation
├── tp-heartbeat.mjs          # File tracking + phase auto-promotion
├── tp-pre-commit.mjs         # Commit validation enforcement
├── tp-pre-compact.mjs        # Compaction checkpoint
├── tp-prompt-check.mjs       # /tp detection + active task warning
├── tp-stop.mjs               # Validation completion enforcement
└── start-task-sentinel.mjs   # Non-edit tool counting
```

### Agents (19 core + 4 utility)
```
~/.claude/agents/core/
├── architect.md              # Opus architecture design (structured summary return)
├── planning-agent.md         # Spec writing + user interaction (structured summary)
├── implementation-agent.md   # Code implementation (mandatory self-verification)
├── verification-agent.md     # Adversarial testing — two modes: test-plan + verify
├── review-standards.md       # Shared anti-rationalization rules for all reviewers
├── security-reviewer.md      # OWASP security scan + CVE lookups
├── closure-agent.md          # Requirements verification + spec critic
├── code-reviewer.md          # Code quality + conventions
├── hardening-reviewer.md     # Production readiness + audit tools
├── database-reviewer.md      # SQL/schema/migration review
├── e2e-reviewer.md           # Live UI validation (Playwright MCP preferred, agent-browser fallback)
├── user-workflow-reviewer.md # Navigation coherence
├── compliance-agent.md       # Final gate — process audit
├── researcher.md             # External research
├── merge-resolver.md         # Git merge conflicts
├── bootstrap.md              # Convention discovery
├── prd-bootstrap.md          # Initiative mode PRD generation
├── strategic-critic.md       # PRD strategic review
└── tactical-critic.md        # PRD tactical review

~/.claude/agents/utility/
├── build-fixer.md            # Fix build/review issues
├── drift-scanner.md          # Read-only codebase drift detection
└── explore.md                # Codebase exploration
```

### Skills
```
~/.claude/skills/
├── evaluate/                 # Product evaluation (audit + review)
├── frontend/                 # Frontend development (standalone + TaskPlex integration)
│   ├── skill.md              # Trigger + standalone + TaskPlex hooks
│   ├── references/
│   │   ├── design-system.md  # Detect component libraries, tokens, themes
│   │   ├── css-patterns.md   # Detect CSS approach (Tailwind/Modules/styled)
│   │   ├── component-spec.md # Component architecture template
│   │   ├── accessibility.md  # WCAG checklist, ARIA patterns, keyboard nav
│   │   └── responsive.md     # Breakpoint detection, mobile-first patterns
│   └── templates/
│       └── visual-review.md  # Screenshot-based visual QA protocol
└── plan/                     # Planning trigger wrapper
```

---

## 13. Design Decisions

### Why prompt-based orchestration?
Zero infrastructure. The LLM reads phase files and makes contextual decisions. Hooks provide hard enforcement for critical gates (design gate, implementation gate, pre-commit).

### Why write-to-disk, return-summary?
Context window management. Agents write artifacts to disk and return 5-15 lines. The orchestrator reads files when needed and presents them inline to the user.

### Why adaptive interaction?
Fixed minimums (`intentQuestionsAnswered >= 2`) forced ceremony on well-documented tasks. Adaptive interaction focuses on resolved ambiguity — asks until it has enough, stops when it isn't adding value.

### Why split reviewers?
The unified `reviewer.md` (264 lines, 7 profiles via `--focus` flag) had one model, one tool set. Split agents get: appropriate models (haiku for fast checks, sonnet for deep analysis), unique tools (security gets WebSearch, hardening gets Bash, e2e gets agent-browser), and focused criteria.

### Why the implementation gate?
Without it, the orchestrator in blueprint/team mode would code inline instead of delegating to agents in worktrees. The gate blocks source edits until `implementationDelegated = true`.

### Why the coherence check?
Catches design drift during implementation (one haiku call) rather than waiting for the full validation pipeline. Saves a validation → build-fix → re-validation cycle when an agent builds something adjacent to the spec.

### Why the three-contract chain?
Inspired by Anthropic's harness engineering research (sprint contracts). The generator-evaluator pattern works better when they pre-agree on what "done" looks like. Intent contract (ACs → architecture), test contract (spec → test plan), verification (execute tests) — each catches gaps at the right stage.

### Why the anti-rationalization prompts?
LLMs are biased toward their own output. The verification agent is explicitly told the exact excuses it will generate to skip checks ("the code looks correct based on my reading" → "reading is not verification, run it"). This is from Claude Code's internal verification agent design.

### Why presentation detail levels?
Full artifacts overwhelm (~500 lines). Terse summaries (~3 lines) lose context. Structured working summaries (~20-30 lines) are the sweet spot — enough to review and give feedback in the chat without opening files.

### Why the invariant floor?
Four gates cannot be disabled: security, closure, compliance, build. Prevents convention overrides or lean profiles from skipping critical quality checks.

### Why drift detection between tasks?
Validation is per-task. Between tasks, nothing watches for convention drift, dependency rot, or test coverage erosion. The `/drift` command and drift-scanner agent provide a periodic hygiene check.
