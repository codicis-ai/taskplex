# TaskPlex Reference Guide

Complete inventory of all components and how they work together across Light, Standard, and Blueprint routes.

---

## Components

### Hooks (9 files in `hooks/`)

| Hook | Event | Fires On | What It Does |
|------|-------|----------|-------------|
| `tp-design-gate.mjs` | PreToolUse | Edit, Write | **Blocks** source writes. Checks: quality profile set, spec exists, critic reviews exist, blueprint artifacts exist, implementation delegated, wave gate, guardian trigger |
| `tp-heartbeat.mjs` | PostToolUse | Edit, Write | **Monitors** every edit. Manifest update, progress.md, init warnings, guardian scope/ownership/file-count checks, observation log, trigger detection |
| `tp-pre-commit.mjs` | PreToolUse | Bash | **Blocks** `git commit`. Checks: validation passed, mandatory + conditional review artifacts exist per profile, migration artifact, e2e SKIP (enterprise), verdict-findings mismatch |
| `tp-prompt-check.mjs` | UserPromptSubmit | All prompts | **Injects** workflow context. Detects /tp, warns active tasks, injects phase reminder |
| `tp-session-start.mjs` | SessionStart | Startup, resume, compact | **Detects** active tasks. Renders checklist, injects recovery context |
| `tp-pre-compact.mjs` | PreCompact | Before compaction | **Checkpoints** manifest + progress to checkpoint file |
| `tp-stop.mjs` | Stop | Session end | **Warns/blocks** incomplete validation |
| `start-task-sentinel.mjs` | PostToolUse | Read, Bash, Grep, etc. | **Tracks** non-edit tool calls for token estimation |
| `hook-utils.mjs` | — | — | **Shared**: stdin parsing, task discovery, planned file reading, ownership inference |

### Agents (23 in `agents/`)

#### Planning & Design (5)

| Agent | Model | Edits | Purpose |
|-------|-------|-------|---------|
| `architect` | opus | No | Design architecture, write code-level worker briefs |
| `planning-agent` | sonnet | No | Write spec.md, interact with user, file-ownership.json |
| `strategic-critic` | opus | No | Review architecture/PRD strategic soundness |
| `tactical-critic` | sonnet | No | Review per-feature spec quality |
| `researcher` | sonnet | No | External research (WebSearch/WebFetch) |

#### Implementation (3)

| Agent | Model | Edits | Purpose |
|-------|-------|-------|---------|
| `implementation-agent` | sonnet | Yes | Implement code per brief. LSP diagnostics, ast-grep. Self-verify. Max 3 fix rounds. |
| `build-fixer` | sonnet | Yes | Fix build/review failures |
| `merge-resolver` | sonnet | Yes | Resolve git merge conflicts between worktree branches |

#### Verification (1)

| Agent | Model | Edits | Purpose |
|-------|-------|-------|---------|
| `verification-agent` | sonnet | No | Adversarial testing. Two modes: test-plan (pre-impl) + verify (QA). Runs commands, can't edit. Anti-rationalization. LSP + ast-grep. |

#### Review (8)

| Agent | Model | Edits | Purpose | Triggered When |
|-------|-------|-------|---------|---------------|
| `security-reviewer` | sonnet | No | OWASP security scan | Always (standard + enterprise) |
| `closure-agent` | haiku | No | Requirements verification — every AC has code evidence | Always |
| `code-reviewer` | sonnet | No | Code quality, conventions. LSP + ast-grep. | Standard + enterprise |
| `hardening-reviewer` | sonnet | No | Production readiness. Bash for EXPLAIN ANALYZE. Validates production impact assessment. | Standard (advisory), enterprise (blocking) |
| `database-reviewer` | sonnet | No | Query correctness, schema, migration safety. Bash for EXPLAIN ANALYZE. | SQL/migration files modified |
| `e2e-reviewer` | sonnet | No | Functional journey testing via Playwright. Fills forms, submits, verifies data. | UI files modified |
| `user-workflow-reviewer` | haiku | No | Navigation coherence, orphaned features | Routing files modified |
| `compliance-agent` | haiku | No | Final gate. Process audit, verdict-findings mismatch, no-deferral check. | Always (runs last) |

#### Shared Reference (1)

| File | Purpose |
|------|---------|
| `review-standards` | Anti-rationalization rules, evidence requirements, verdict-findings consistency. Included by all reviewers. |

#### Bootstrap (2)

| Agent | Model | Purpose |
|-------|-------|---------|
| `bootstrap` | sonnet | Project bootstrap — INTENT.md + conventions |
| `prd-bootstrap` | opus | Initiative mode PRD generation |

#### Utility (3)

| Agent | Model | Purpose |
|-------|-------|---------|
| `drift-scanner` | haiku | Read-only codebase drift scan. LSP + ast-grep. |
| `session-guardian` | haiku | One-shot analysis when guardian trigger fires |
| `explore` | haiku | Fast codebase exploration |

### Skills (7 in `skills/`)

| Skill | Command | Purpose |
|-------|---------|---------|
| `tp` | `/taskplex:tp` | Primary workflow — full TaskPlex |
| `plan` | `/taskplex:plan` | Strategic planning without implementation |
| `drift` | `/taskplex:drift` | Codebase drift scanner |
| `solidify` | `/taskplex:solidify` | Merge skill evolutions |
| `evaluate` | `/taskplex:evaluate` | Product evaluation — audit + review |
| `frontend` | Auto (UI files) | Frontend dev — design system, a11y, responsive |
| `workflow` | Auto (by tp) | Core phases + contracts — not user-invocable |

### Phase Files (6 in `skills/workflow/references/phases/`)

| File | Phase | Purpose |
|------|-------|---------|
| `init.md` | 0 | Route selection, quality profile, build commands, conventions, intent exploration |
| `planning.md` | 1 | Spec writing, critic review, worker dispatch, worktree management |
| `qa.md` | 4.5 | Migrations, dev server, functional E2E journeys, adversarial verification, fix loop |
| `validation.md` | 5 | Review quality protocol, 12-step pipeline, hardening, compliance |
| `bootstrap.md` | -1 | Project bootstrap (INTENT.md) |
| `prd.md` | — | Initiative mode (PRD decomposition, waves) |

### Contract Files (8 in `skills/workflow/references/contracts/`)

| File | Purpose |
|------|---------|
| `policy.json` | Quality profiles, iteration limits, agent lists |
| `gates.md` | Gate catalog — names, verdicts, execution order |
| `artifact-contract.md` | Required artifacts by quality profile |
| `manifest-schema.json` | Manifest JSON schema |
| `handoff-contract.md` | Agent-to-agent transition format |
| `hardening-checks.md` | Hardening check registry, risk profiles, red-lines |
| `portability.md` | Cross-runtime portability spec |
| `skill-evolution.md` | Skill evolution system |

---

## Route Workflows

### Light Route

```
/tp --light fix the login button

INIT
├─ Route: light, Profile: lean (user confirms)
├─ Build commands detected
├─ Convention scan (automated)
└─ Intent: synthesize + confirm → brief.md

PLANNING
├─ Orchestrator writes minimal spec.md
├─ No critic (light exempt)
└─ User acknowledges

IMPLEMENTATION
├─ Gates: brief.md exists ← design-gate BLOCKS
├─ Single agent or inline (lean)
├─ Heartbeat: scope checks, observation log
└─ Build gate

QA
├─ Migrations if SQL → migration-applied.json
├─ Smoke test
└─ Journey walkthrough (abbreviated)

VALIDATION
├─ Build check only (lean profile)
└─ No review agents

COMMIT
├─ Lean: no review artifacts required
└─ Pre-commit passes after build

Agents: ~1-2 | Hooks: all 9 active, lean gates
```

### Standard Route

```
/tp add user authentication

INIT
├─ Route: standard, Profile: standard (user confirms)
├─ Build commands detected
├─ Convention scan + 2-4 user questions
└─ Intent exploration: lightweight journeys, approaches, section approval
    → brief.md + intent.md

PLANNING
├─ planning-agent → spec.md + sections.json + file-ownership.json
├─ Spec critic (max 3 rounds, specific feedback) → reviews/spec-review.md
├─ verification-agent → test-plan.md
├─ User reviews structured summary
└─ Task list expanded with workers

IMPLEMENTATION
├─ Gates: qualityProfile, spec.md, reviews/, implementationDelegated ← ALL BLOCK
├─ 1-3 parallel workers (shared workspace, file ownership)
├─ Heartbeat: scope, ownership, file count, observation log, triggers
├─ Guardian trigger → design-gate BLOCKS next edit
├─ Coherence check per worker
├─ Build gate (typecheck + lint + tests)
└─ Tactical critic review

QA
├─ Migrations → migration-applied.json
├─ Dev server startup
├─ Functional E2E journeys (fill forms, submit, verify DB, chain steps)
├─ Journey coverage check (max 2 rounds)
├─ Adversarial verification (verification-agent)
└─ Bug fix loop (context-preserving, max 3 rounds)

VALIDATION
├─ Review Quality Protocol per reviewer (evidence density, verdict-findings, no-deferral)
├─ Mandatory: security-reviewer, closure-agent, code-reviewer
├─ Conditional: database-reviewer, e2e-reviewer, user-workflow-reviewer
├─ Hardening (advisory)
├─ Compliance (final gate)
└─ All artifacts required at pre-commit

COMMIT
├─ Pre-commit checks: validation-gate + mandatory reviews + conditional reviews + migration + verdict consistency
└─ Git commit + PR

Agents: ~10-15 | Hooks: all 9, all gates enforcing
```

### Blueprint Route

```
/tp --blueprint redesign the event engine

INIT
├─ Route: blueprint, Profile: enterprise (user confirms)
├─ Build commands detected
├─ Convention scan + user questions
└─ Full intent exploration + intent.md (architect guardrails)

PLANNING
├─ architect (opus) → architecture.md + spec.md + worker briefs + file-ownership.json
├─ Strategic critic (opus) + tactical critic (sonnet) → review artifacts
├─ Spec critic (max 3 rounds)
├─ User reviews FULL architect draft
├─ verification-agent → test-plan.md
└─ Task list expanded: waves + workers

IMPLEMENTATION (per wave)
├─ Gates: qualityProfile, spec.md, reviews/, architecture.md, file-ownership.json,
│         implementationDelegated, wave gate, guardian trigger ← ALL BLOCK
├─ Create worktrees: git worktree add per worker (max 8 concurrent)
├─ Spawn parallel workers (each in own worktree)
├─ Heartbeat: scope, ownership, file count, triggers → BLOCKS if triggered
├─ Coherence check per worker
├─ Merge worktree branches (merge-resolver if conflicts)
├─ Cleanup worktrees
├─ Wave validation: build + tests + journey check + cross-wave + regression
└─ Wave gate: must complete before next wave ← HOOK ENFORCED

QA
├─ Migrations → migration-applied.json
├─ Dev server startup
├─ Full functional E2E journeys with test data
├─ Journey coverage check (max 2 rounds)
├─ Adversarial verification
└─ Bug fix loop (context-preserving, max 3 rounds)

VALIDATION
├─ Review Quality Protocol per reviewer
├─ Mandatory: security, closure, code review
├─ Conditional: database, e2e (SKIP blocked for enterprise), user-workflow
├─ Enterprise: hardening (BLOCKING) + compliance
├─ Enterprise-only: dependency/license, migration safety, observability
├─ Compliance cross-validates everything
└─ All artifacts required at pre-commit

COMMIT
├─ Pre-commit: ALL artifacts + ALL conditional + migration + enterprise e2e + verdict consistency
└─ Git commit + PR

Agents: ~15-30+ | Hooks: all 9, all gates enforcing, guardian blocking
```

---

## Enforcement Matrix

Every enforcement is hook-based (fires automatically) and artifact-based (checks file existence, not flags).

### Pre-Implementation Gates (design-gate hook)

| Gate | What Blocks | Light | Standard | Blueprint |
|------|------------|-------|----------|-----------|
| Quality profile null | No `qualityProfile` in manifest | Yes | Yes | Yes |
| No spec.md | File missing | — | **Blocks** | **Blocks** |
| No brief.md | File missing | **Blocks** | — | — |
| No critic reviews | No files in `reviews/` | — | **Blocks** | **Blocks** |
| No architecture.md | File missing | — | — | **Blocks** |
| No file-ownership.json | File missing | — | — | **Blocks** |
| Not delegated | `implementationDelegated` false | — | **Blocks** | **Blocks** |
| Wave incomplete | Previous wave not validated | — | — | **Blocks** |
| Guardian trigger | `guardian-trigger.json` exists | **Blocks** | **Blocks** | **Blocks** |

### During Implementation (heartbeat hook)

| Check | Light | Standard | Blueprint |
|-------|-------|----------|-----------|
| Scope check (file outside plan) | Warn | Warn | Warn |
| Ownership conflict | — | Warn | Warn |
| File count >50% over plan | Warn | Warn | Warn |
| No-plan detection | **Critical warn** | **Critical warn** | **Critical warn** |
| Observation log | Log | Log | Log |
| Guardian triggers (→ blocks via design-gate) | 3+ scope | 3+ scope, 1+ ownership, 3+ build | 3+ scope, 1+ ownership, 3+ build |
| Init completeness (quality profile, build cmds) | Warn | Warn | Warn |

### Pre-Commit Gates (pre-commit hook)

| Gate | Light/Lean | Standard | Enterprise |
|------|-----------|----------|-----------|
| validation-gate.json | — | **Blocks** | **Blocks** |
| reviews/security.md | — | **Blocks** | **Blocks** |
| reviews/closure.md | — | **Blocks** | **Blocks** |
| reviews/code-quality.md | — | **Blocks** | **Blocks** |
| hardening/report.md | — | — | **Blocks** |
| reviews/compliance.md | — | — | **Blocks** |
| reviews/database.md (SQL modified) | — | **Blocks** | **Blocks** |
| reviews/e2e.md (UI modified) | — | **Blocks** | **Blocks** |
| reviews/e2e.md verdict ≠ SKIP | — | — | **Blocks** |
| reviews/user-workflow.md (routes modified) | — | **Blocks** | **Blocks** |
| migration-applied.json (SQL modified) | — | **Blocks** | **Blocks** |
| Must Fix + PASS verdict | — | **Blocks** | **Blocks** |

### Quality Feedback Loops

| Loop | Phase | What It Catches | Max Rounds |
|------|-------|----------------|------------|
| Spec critic | Planning | Vague specs, missing ACs | 3 |
| Build fix | Implementation | Compilation/test failures | 3 |
| Journey coverage | QA | Untested journeys from spec | 2 |
| Bug fix | QA | Bugs found by verification agent | 3 |
| Review quality | Validation | Shallow reports, verdict-findings mismatch | 1 re-run |
