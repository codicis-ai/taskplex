# TaskPlex

**Stop LLM coding agents from shipping half-finished, overengineered, or drive-by-refactored work.**

TaskPlex is a Claude Code plugin that wraps your coding agent in a governed workflow: design before code, explicit success criteria, foundation-first implementation, adversarial verification, and parallel review before commit. Every step is gated — if the required artifacts aren't there, the pipeline stops.

## The Problem

Left alone, LLM coding agents tend to:

- **Assume instead of asking.** Pick one interpretation silently and run with it.
- **Overcomplicate.** Ship 200 lines when 50 would do. Invent abstractions for single-use code.
- **Refactor adjacent code.** Touch files they were supposed to leave alone. Change comments they don't understand.
- **Declare victory too early.** "Tests pass" without having written a test that actually exercises the change.
- **Lose the thread across phases.** The brief says one thing, the implementation does another, the review checks neither.

TaskPlex doesn't trust the agent to handle any of that. It encodes the discipline as workflow, artifacts, and gates.

## Install

```
/plugin marketplace add codicis-ai/taskplex
/plugin install taskplex
```

Uninstall:

```
/plugin uninstall taskplex
```

## What You Get

Six commands, installable as a Claude Code plugin, backed by 23 specialized agents and a hook-based enforcement layer.

| Command | What it does |
|---------|-------------|
| `/tp [flags] [task]` | **Build something end-to-end.** Runs the full pipeline: design → planning → implementation → QA → validation → completion. Flags pick the route: `--light`, `--standard` (default), `--blueprint`, plus `--plan <path>` to hydrate from an existing PRD and `--skip-design` to jump to execution. |
| `/plan [description]` | **Think before building.** Research, product brief, architecture, strategic critic — no code written. Produces a plan file for later execution. |
| `/drift` | **Check codebase health.** Read-only scan for convention violations, architectural drift, dead code, dependency hygiene. Produces a drift-index score. |
| `/evaluate [mode]` | **Audit what exists.** Two modes: `audit` (investigate quality) and `review` (validate against a brief). |
| `/frontend` | **UI work with design-system discipline.** Component architecture, accessibility, responsive patterns, visual quality. Works standalone in any coding agent; integrates with `/tp` when run inside a pipeline. |
| `/workflow` | **Internal** — phase files and contracts loaded by the pipeline. Not user-invocable. |

## How It Works

### 1. Design phase (never skipped on standard and blueprint routes)

Before any code is written, the pipeline:

- Asks you to pick a **quality profile** (Lean, Standard, Enterprise) — this determines which reviewers run later
- Runs a **convention scan** and asks you to confirm the conventions it found
- Explores user intent and captures it as `brief.md` (requirements), `intent.md` (guardrails), and `success-criteria.json` (structured SC-* criteria that flow through every later phase)
- On the Blueprint route, also runs an `explore` agent for cheap codebase reconnaissance before the architect runs

Design asks questions. It doesn't guess.

### 2. Planning phase

A planning agent writes the spec against the brief and intent, then a **strategic or tactical critic** reviews it (max 3 rounds, bounded). The user approves. The result: `spec.md` + `success-map.json` (SC-* → code targets + verification).

### 3. Implementation — foundation-first

Workers run in parallel, but in **waves**:

- **Wave 0 — Foundation.** Shared types, database schema, API contract, auth model.
- **Wave 1 — Data layer.** Queries, route handlers. Uses Wave 0 types and schema.
- **Wave 2 — Integration.** API clients, components. Uses Wave 0 contract.
- **Wave 3 — Polish.** Error handling, tests. Built on stable Wave 0–2 interfaces.

Each worker produces `worker-evidence.json` documenting which success criteria their code satisfies. **No-invention rule:** Wave 1+ workers consume Wave 0, they never reinvent types or contracts.

### 4. QA

Smoke test → functional journey walkthrough → adversarial verification. Bug-fix loop is bounded (max 3 rounds). Output: `qa-report.md`.

### 5. Validation — parallel reviewers

Reviewers run in parallel. Which reviewers run depends on the quality profile and file patterns:

| Profile | Always runs | Conditional (file patterns) |
|---------|------------|----------------------------|
| Lean | Build checks | — |
| Standard | Security, closure, code review | Database (SQL), e2e (UI), user-workflow (routing) |
| Enterprise | Standard + hardening + compliance | All conditional reviewers |

All reviews inherit `review-standards` — anti-rationalization rules: reading is not verification, types don't validate runtime, evidence over explanation.

The `closure-agent` scores each SC-* from the intent contract as `SATISFIED`, `PARTIAL`, `MISSING`, or `UNSCORABLE`. Missing high-priority criteria = automatic FAIL. The results land in `traceability.json` — a resolved evidence matrix from success criteria → code → verdict.

### 6. Completion

Git commit with a message derived from the brief + traceability. Optional PR. Knowledge persistence to your project memory (if wired up).

## Enforcement

TaskPlex enforces the workflow via **Claude Code hooks** — not by asking the LLM to behave:

- **`tp-design-gate`** (PreToolUse, Edit/Write) — blocks edits when required design artifacts don't exist yet. You can't skip design by just starting to write code.
- **`tp-pre-commit`** (PreToolUse, Bash) — blocks `git commit` unless the required review artifacts for the current quality profile exist.
- **`tp-prompt-check`** (UserPromptSubmit) — catches when you're trying to skip ahead.
- **`tp-session-start`** (SessionStart) — detects in-progress tasks on resume/compact and injects recovery context so you pick up where you left off.
- **`tp-heartbeat`** / **`tp-stop`** / **`tp-pre-compact`** / **`start-task-sentinel`** — lifecycle and state-checkpoint hooks.

Gates are **artifact-based**, not judgment-based. The hook checks whether a file exists. If it doesn't, the edit is blocked with a message explaining what's missing. No LLM in the control loop.

## Intent Contract

Every task carries a success contract through all phases:

```
design/        → success-criteria.json      (structured SC-* with observable outcomes)
planning/      → success-map.json           (SC-* mapped to code targets + verification)
implementation → worker-evidence.json       (per-worker evidence of SC satisfaction)
validation/    → traceability.json          (resolved evidence matrix: SC → code → status)
completion/    → workflow-eval.json         (process self-evaluation)
```

This is how TaskPlex solves **goal-driven execution** — verifiable success criteria, not "make it work." The closure agent scores each SC against actual evidence, not LLM narration.

## Quality Profiles

You pick the profile at the start of each task. Never auto-assigned.

| Profile | Validators | Required artifacts before commit |
|---------|-----------|----------------------------------|
| **Lean** | Build checks only | None |
| **Standard** | Security, closure, code review | `security.md` + `closure.md` + `code-quality.md` |
| **Enterprise** | + hardening + compliance | All of standard + `hardening/report.md` + `compliance.md` |

Conditional reviewers (database, e2e, user-workflow) trigger automatically based on file patterns when the profile is Standard or Enterprise.

## Agents

The plugin ships 23 agent definitions that the pipeline spawns as isolated sessions.

**Design & planning:** `explore`, `architect`, `planning-agent`, `strategic-critic`, `tactical-critic`, `researcher`

**Implementation:** `implementation-agent`, `build-fixer`, `merge-resolver`

**Verification:** `verification-agent` (test-plan + verify modes)

**Review:** `security-reviewer`, `closure-agent`, `code-reviewer`, `hardening-reviewer`, `database-reviewer`, `e2e-reviewer`, `user-workflow-reviewer`, `compliance-agent`

**Shared:** `review-standards` (inherited by all reviewers — anti-rationalization rules)

**Utility:** `drift-scanner`, `session-guardian`

Each agent has a narrow job and explicit input/output contracts. No agent plans and implements; no agent implements and reviews.

## Repository Layout

```
taskplex/
├── .claude-plugin/        # Plugin + marketplace manifests
├── .mcp.json              # MCP server config (Playwright for e2e review)
├── agents/                # 23 agent definitions (system prompts)
├── hooks/                 # Enforcement hooks — design gate, pre-commit, session lifecycle
└── skills/                # Entry points: /tp, /plan, /drift, /evaluate, /frontend, /workflow
    └── workflow/references/
        ├── phases/        # Phase files (init, planning, implementation, qa, validation, completion)
        └── contracts/     # Contracts (intent, success criteria, manifest schema, handoffs)
```

Everything in the repo is directly consumed by the plugin at runtime. There are no build artifacts, no external binaries, and no design documents in the public tree.

## Current State

**Working today (installed via the plugin):**

- All 6 skills (`/tp`, `/plan`, `/drift`, `/evaluate`, `/frontend`, `/workflow`)
- 23 agents wired into the pipeline
- 8 lifecycle and enforcement hooks
- Quality-profile-driven validator selection
- Intent-contract chain (success-criteria → success-map → worker-evidence → traceability → workflow-eval)
- Foundation-first worker decomposition

**Internal, not public:**

- A prototype Go-based pipeline engine exists internally but is not shipped with this plugin and has no public repo. The plugin as distributed runs entirely on Claude Code hooks and skills — no external binary required.

**Designed, not yet built:**

- A dedicated companion app for live pipeline monitoring
- A redesigned enforcement framework for v2

When those are ready, they'll ship separately. Nothing in this README depends on them — the current plugin is self-contained and usable today.

## Known Gaps & Roadmap

TaskPlex currently does not explicitly encode two disciplines that matter for LLM coding quality:

1. **Simplicity First** — there is no rule constraining the *style* of code workers write. A worker could ship an overengineered 200-line solution to a 50-line problem and only the review phase would catch it.
2. **Surgical Changes** — the workflow restricts *which files* a worker can touch, but not *what they do inside* a file. A worker assigned to edit `auth.ts` can refactor unrelated functions in the same file.

These will be added as an **implementation-discipline reference** (inherited by implementation-agent, build-fixer, and merge-resolver) in a near-term update.

## Codicis AI

| Repo | Product |
|------|---------|
| `codicis-ai/taskplex` | TaskPlex — this repo |
| `codicis-ai/memplex` | Project memory and intelligence (private) |
| `codicis-ai/taskwright` | AI personal assistant (private) |
| `codicis-ai/memwright` | Memory desktop application (private) |

## License

All rights reserved.
