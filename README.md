# TaskPlex

Structured workflow orchestration for AI coding agents. Design-first development with quality gates, adversarial verification, and multi-agent coordination.

## Install (Claude Code)

```
/plugin marketplace add github.com/codicis-ai/taskplex
/plugin install taskplex
```

Then use `/taskplex:tp`, `/taskplex:plan`, `/taskplex:drift`, `/taskplex:solidify`, `/taskplex:evaluate`.

For local development:
```bash
git clone https://github.com/codicis-ai/taskplex.git
claude --plugin-dir ./taskplex
```

See **[REFERENCE.md](REFERENCE.md)** for the complete component inventory — all 9 hooks, 23 agents, 7 skills, per-route workflows, and the full enforcement matrix.

## What It Does

TaskPlex wraps every development task in a governed workflow: design before code, verify before commit, review before ship. It runs as hooks, commands, and agent definitions inside AI coding tools — currently Claude Code, with multi-runtime distribution planned for Cursor, Codex, Gemini CLI, OpenCode, Windsurf, Pi, and Antigravity.

**Core thesis**: Agents are commoditized. What differentiates is governance — context architecture, validation pipelines, autonomy management, and audit trails.

## How It Works

```
/tp add user authentication --blueprint

  Phase 1: Design
    A. Convention scan ─── Codebase patterns, memplex conventions
    B. Research ────────── References, problem space, ecosystem survey
    C. Product context ─── User profiles, journeys (DOES/SEES/FEELS), JTBD, contract
    D. Intent ─────────── Synthesize, confirm approach, write intent file (architect guardrails)
  Phase 2: Planning ────── Spec writing (within guardrails), critic review + debate log, user reviews full draft
  Phase 3: Implement ───── Multi-agent parallel execution in git worktrees
  Phase 4: QA ──────────── Product-type-aware testing with structured journey input
  Phase 5: Validate ────── Artifact-based gates, security, closure, code review, hardening, compliance
  Phase 6: Complete ────── Knowledge persistence, git commit, PR
```

Every phase transition is enforced by artifact-based gates. The agent cannot skip design (no spec.md = blocked), bypass critics (no review files = blocked), or commit without validation.

## Key Features

### Execution Routes

| Route | Flag | Design Depth | What Happens |
|-------|------|-------------|-------------|
| **Light** | `--light` | Convention scan + intent confirm | Single agent, minimal spec, self-review |
| **Standard** | default | Conventions + lightweight journeys + intent file | Planning agent + spec critic + 1-3 parallel workers + tactical critic |
| **Blueprint** | `--blueprint` | Full: research + product context + journeys + intent guardrails | Opus architect + strategic/tactical critics + multi-agent in worktrees + waves |

### Enforcement (All Hook-Based, All Artifact-Checked)

| Gate | What It Blocks | How |
|------|---------------|-----|
| **Spec gate** | Implementation without spec.md | File existence check |
| **Critic gate** | Implementation without review artifacts | File existence in reviews/ |
| **Blueprint gate** | Implementation without architecture + file ownership | File existence check |
| **Implementation gate** | Orchestrator coding inline | Manifest flag (set after agent spawn) |
| **Wave gate** | Next wave before previous validates | Manifest state |
| **Guardian trigger gate** | Continued work after scope/ownership/build-loop deviation | guardian-trigger.json exists → blocks |
| **Pre-commit gate** | Git commits without validation + review artifacts | File existence per quality profile |

Every gate is enforced by hooks (PreToolUse). No gate depends on the orchestrator choosing to check something. Artifact-based gates check file existence — the agent cannot fake files without producing content.

### 23 Specialized Agents

| Category | Agents |
|----------|--------|
| **Planning** | architect, planning-agent, strategic-critic, tactical-critic, researcher |
| **Implementation** | implementation-agent, build-fixer, merge-resolver |
| **Verification** | verification-agent (adversarial, two modes: test-plan + verify) |
| **Review** | security-reviewer, closure-agent, code-reviewer, hardening-reviewer, database-reviewer, e2e-reviewer, user-workflow-reviewer, compliance-agent |
| **Utility** | drift-scanner, session-guardian, explore |
| **Bootstrap** | bootstrap, prd-bootstrap |

All review agents share anti-rationalization rules — they are instructed to recognize and resist their own tendency to rationalize passing verdicts.

### Three-Contract Chain

```
1. INTENT CONTRACT (planning)
   AC-1.1 "User can register" → Spec Section 1: Auth module
   "Every requirement has a home in the plan"

2. TEST CONTRACT (pre-implementation)
   AC-1.1 → "I will: POST /register with valid/invalid payloads"
   "Every feature has a pre-committed test"

3. VERIFICATION CONTRACT (QA)
   Execute pre-committed tests with command + output evidence
   "Every test was run, not just read"
```

### Code Intelligence

Agents reference LSP and ast-grep with graceful degradation:
- **LSP**: Diagnostics after edits, find_references before signature changes, semantic rename
- **ast-grep**: Structural code search for convention checking, auth verification, dead code detection
- Falls back to grep when neither is available

### Production Impact Assessment

When a task touches databases, external APIs, caching, auth, or infrastructure, the planning agent adds a production impact section to the spec: blast radius, rollout strategy, rollback plan, operational risks, monitoring metrics. The hardening reviewer validates it.

### Quality Profiles

The user selects the quality profile during init — the agent never picks its own oversight level. Even in autonomous mode, this is agreed upfront.

| Profile | Validation Agents | Required Artifacts Before Commit |
|---------|------------------|--------------------------------|
| **Lean** | None (build checks only) | None |
| **Standard** | security, closure, code review (3 agents) | `security.md` + `closure.md` + `code-quality.md` |
| **Enterprise** | + hardening + compliance (5+ agents) | All of standard + `hardening/report.md` + `compliance.md` |

The pre-commit hook verifies these artifacts exist on disk. Inline grep checks cannot produce them — the review agents must actually run.

### Portable Worktree Isolation

Blueprint agents work in TaskPlex-managed git worktrees — created via `git worktree add`, merged after completion, cleaned up automatically. This is portable across all runtimes with git (not dependent on any runtime's native worktree feature).

### Session Guardian

Background observation during implementation:
- **Scope checks**: Warns when agents edit files outside the spec
- **Ownership checks**: Detects when multiple agents modify the same file
- **Observation log**: Append-only record of every edit for post-task analysis
- **Trigger detection**: Fires alerts on scope alarm (3+ out-of-scope files), ownership conflicts, or build loops

## Architecture

### Plugin (Claude Code — installable)

```
plugin/
├── .claude-plugin/plugin.json     Plugin manifest (v1.0.0)
├── agents/                        23 agent definitions (flat)
├── skills/
│   ├── tp/                        Primary entry point (/taskplex:tp)
│   ├── plan/                      Strategic planning
│   ├── drift/                     Drift detection
│   ├── solidify/                  Skill evolution merge
│   ├── evaluate/                  Product evaluation (audit + review)
│   ├── frontend/                  Frontend development (a11y, responsive, components)
│   └── workflow/references/       Core: 6 phase files + 8 contract files
├── hooks/                         9 hook files + hooks.json wiring
└── .mcp.json                      Playwright MCP
```

### Standalone (manual installation)

```
~/.claude/
├── commands/          5 slash commands
├── hooks/             9 hook files (design gate, heartbeat, pre-commit, etc.)
├── agents/            23 agent definitions (core/ + utility/)
├── taskplex/          6 phase files + 8 contracts
└── skills/            3 companion skills (evaluate, frontend, plan)
```

## Optional Integrations

| Integration | What It Adds |
|-------------|-------------|
| **Memplex** | Cross-session knowledge: file coupling, error resolutions, past decisions. Pre-spawn context assembly for agents. |
| **Playwright MCP** | Browser automation for e2e-reviewer and QA visual verification |
| **OfficeCLI** | Document generation (.docx, .xlsx, .pptx) — companion skill, not bundled |
| **LSP** | Semantic code intelligence for agents (diagnostics, references, rename) |
| **ast-grep** | Structural code search and rewrite |

## Multi-Runtime Distribution (Planned)

| Runtime | Priority | Status |
|---------|----------|--------|
| Claude Code | -- | Built and active |
| Cursor 3 | 1 | Planned — marketplace plugin |
| Pi | 2 | Planned — npm package, full spec in `taskplex-pi-plugin.md` |
| Gemini CLI | 3 | Planned — extension package |
| Codex CLI | 4 | Planned — plugin + marketplace |
| Antigravity | 5 | Planned — MCP Store + VS Code extension |
| OpenCode | 6 | Planned — TypeScript plugin |
| Windsurf | 7 | Planned — manual install |

See `multi-runtime-plan.md` for full distribution architecture.

## Design Documents

This repository (`codicis-ai/taskplex`) contains design, documentation, plugin, and backups:

| Document | Purpose |
|----------|---------|
| `taskplex-documentation.md` | Complete technical documentation |
| `multi-runtime-plan.md` | Cross-runtime distribution plan (8 runtimes) |
| `design-plan-merge.md` | Merge /plan's rich phases (research, journeys, intent guardrails) into /tp |
| `session-guardian-design.md` | Background session observer design (inspired by KAIROS) |
| `prd-workflow-enforcement.md` | PRD: Artifact-based enforcement gates |
| `prd-session-guardian.md` | PRD: Behavioral enforcement (3 phases) |
| `prd-claude-code-plugin.md` | PRD: Claude Code plugin packaging |
| `prd-cursor-plugin.md` | PRD: Cursor 3 plugin adaptation |
| `memplex-integration.md` | Memplex integration spec |
| `test-plan.md` | Comprehensive test plan |

## Codicis AI Organization

| Repo | Product |
|------|---------|
| `codicis-ai/taskplex` | TaskPlex — workflow orchestration (this repo) |
| `codicis-ai/memplex` | Memplex — project memory and intelligence |
| `codicis-ai/taskwright` | TaskWright — AI personal assistant |
| `codicis-ai/memwright` | Memwright — memory desktop application |

## The Full Workflow (what happens)

```
User: /tp add event engine --blueprint

PHASE 1: INITIALIZATION
  ├─ Parse task, select route (Light/Standard/Blueprint)
  ├─ User confirms quality profile (lean/standard/enterprise)
  ├─ Create manifest, task list, session file
  ├─ Load context (INTENT.md, CONVENTIONS.md, memplex if available)
  └─ Detect project type, resolve build commands

PHASE 2: DESIGN
  ├─ Sub-phase A: Convention scan + user confirmation
  ├─ Sub-phase B: Research & discovery (Blueprint — references, problem space)
  ├─ Sub-phase C: Product context (Blueprint — profiles, journeys, JTBD)
  └─ Sub-phase D: Intent exploration + approach selection + section approval
      └─ Writes: brief.md, intent.md (guardrails for architect)

PHASE 3: PLANNING
  ├─ Planning agent writes spec.md (with intent guardrails)
  ├─ Spec critic reviews (bounded: max 3 rounds, specific feedback)
  ├─ User reviews and approves plan
  ├─ Verification agent writes test plan (pre-committed checks)
  └─ Task list refined with specific workers

PHASE 4: IMPLEMENTATION
  ├─ Create worktrees (git worktree add per worker)
  ├─ Spawn parallel workers (Blueprint: in worktrees, Standard: file ownership)
  ├─ Each worker: apply code → self-verify (typecheck/lint) → return
  ├─ Coherence check per worker (does output match brief?)
  ├─ Merge worktree branches
  └─ Build gate (typecheck + lint + tests on merged result)

PHASE 5: QA
  ├─ Apply migrations (if SQL files modified) → write migration-applied.json
  ├─ Start dev server (UI/API types)
  ├─ Smoke test (does it even start?)
  ├─ Journey walkthrough — functional E2E with test data:
  │   ├─ Setup: generate test data, ensure clean state
  │   ├─ Execute: fill forms, submit, verify DB state, chain steps
  │   └─ Cleanup: remove test data
  ├─ Journey coverage check (bounded: max 2 rounds — all spec journeys tested?)
  ├─ Adversarial verification (verification agent tries to break it)
  └─ Bug fix loop (context-preserving, max 3 rounds, verification re-checks)

PHASE 6: VALIDATION
  ├─ Artifact validation (all required files exist)
  ├─ Traceability (ACs → spec → code → tests)
  ├─ Build validation (typecheck + lint + tests)
  ├─ Security review → evidence quality check → re-run if thin
  ├─ Closure verification → evidence quality check
  ├─ Code review → evidence quality check
  ├─ Conditional reviewers (database, e2e, user-workflow — if file patterns match)
  ├─ Hardening (standard: advisory, enterprise: blocking)
  └─ Compliance (final gate — audits all reviews + process)

PHASE 7: COMPLETION
  ├─ Memplex knowledge persistence (file couplings, patterns, decisions)
  ├─ Skill evolution (detect signals, write evolutions.json)
  ├─ Git commit (blocked until all artifacts exist)
  └─ PR creation + task summary
```

## The Enforcement Layer (what prevents shortcuts)

Every enforcement is **hook-based** (fires automatically on every tool call) and **artifact-based** (checks file existence, not manifest flags). The agent cannot bypass enforcement by setting flags.

### Pre-Implementation Gates (tp-design-gate.mjs — PreToolUse on Edit/Write)

| Gate | Checks | Blocks If |
|------|--------|-----------|
| **Spec gate** | `spec.md` exists in task dir | No spec = no implementation (Light: brief.md) |
| **Critic gate** | Review files exist in `reviews/` | No review artifacts = no implementation |
| **Blueprint gate** | `architecture.md` + `file-ownership.json` exist | Missing architecture = no implementation |
| **Implementation gate** | `manifest.implementationDelegated` | Orchestrator can't code inline |
| **Wave gate** | Previous wave completed + validated | Can't skip ahead |
| **Guardian trigger gate** | `guardian-trigger.json` doesn't exist | Must resolve scope/ownership deviations |

### During Implementation (tp-heartbeat.mjs — PostToolUse on Edit/Write)

| Check | What It Does |
|-------|-------------|
| **Scope check** | Warns when files edited outside the spec's file map |
| **Ownership check** | Warns when multiple agents edit the same file |
| **File count check** | Warns when modified files exceed plan by >50% |
| **No-plan detection** | CRITICAL warning if implementation runs without spec |
| **Observation log** | Append-only record of every edit (timestamp, file, owner, status) |
| **Trigger detection** | Writes guardian-trigger.json at thresholds (3+ scope, 1+ ownership, 3+ build loops) |

### Pre-Commit Gates (tp-pre-commit.mjs — PreToolUse on Bash)

| Gate | Checks | Blocks If |
|------|--------|-----------|
| **Validation gate** | `validation-gate.json` exists and passed | No validation = no commit |
| **Mandatory reviews** | `security.md` + `closure.md` + `code-quality.md` exist | Missing review files = no commit |
| **Enterprise reviews** | + `hardening/report.md` + `compliance.md` | Enterprise needs 5+ review files |
| **Conditional reviews** | `database.md` if SQL modified, `e2e.md` if UI modified, `user-workflow.md` if routes modified | File-pattern-triggered reviews must run |
| **E2E SKIP check** | Enterprise: e2e.md verdict != SKIP | Enterprise requires actual browser testing |
| **Migration artifact** | `migration-applied.json` if SQL files modified | Migrations must be applied before commit |

### Quality Feedback Loops

| Loop | Where | What It Catches | Max Rounds |
|------|-------|----------------|------------|
| Spec critic | Planning | Vague specs, missing ACs | 3 |
| Journey coverage | QA | Untested journeys from spec | 2 |
| Review quality | Validation | Shallow "PASS" reports with no evidence | 1 re-run |
| Build fix | Implementation + QA | Compilation/test failures | 3 |
| Bug fix | QA | Bugs found by verification agent | 3 |

## Status

**Built and active**: Claude Code plugin (`plugin/`), 7 skills, 9 hooks, 6 phase files, 8 contracts, 23 agents, full artifact-based enforcement (spec/critic/blueprint/validation/conditional/migration gates), session guardian (scope/ownership/trigger blocking), user-confirmed quality profiles, bounded iteration (spec critic/journey coverage/review quality), functional E2E testing with test data, TaskPlex-managed worktrees, code intelligence (LSP + ast-grep), production impact assessment.

**Designed, not yet built**: Cursor 3 plugin (PRD complete), /plan merge into /tp (design complete), Haiku worker granularity (PRD complete), multi-runtime distribution (6 runtimes), session guardian Phase 3 (background agent), Pi plugin, memplex HTTP API.

## License

Private repository. All rights reserved.
