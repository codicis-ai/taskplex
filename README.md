# TaskPlex

Go-based workflow harness for governed AI software delivery. Design-first development with deterministic enforcement, multi-agent coordination, and per-step model selection.

## Install

```
/plugin marketplace add github.com/codicis-ai/taskplex
/plugin install taskplex
```

The plugin provides the `/taskplex:tp` entry point. The Go harness (`tp` binary) manages the full workflow.

Uninstall:
```
/plugin uninstall taskplex
```

## Commands

| Command | What It Does |
|---------|-------------|
| `/taskplex:tp [flags] [task]` | **Build something.** Triggers the Go harness which manages design, planning, implementation, QA, validation, and completion. Flags: `--light`, `--standard` (default), `--blueprint`. |
| `/taskplex:plan [description]` | **Think before building.** Strategic planning only — research, product context, architecture, critic review. Produces a plan file for later execution. |
| `/taskplex:drift` | **Check codebase health.** Read-only scan for convention violations, drift, dead code. |
| `/taskplex:evaluate [mode]` | **Audit what exists.** Two modes: `audit` (investigate quality) and `review` (validate against a brief). |
| `tp setup` | **Configure agents and models.** Discover installed coding agents, test connections, set per-role model defaults. |
| `tp config amend` | **Change configuration.** Modify role assignments, models, providers anytime. |
| `tp status` | **Monitor execution.** ASCII kanban board of pipeline progress. |
| `tp peek <step>` | **Inspect a step.** See live output from any running step. |
| `tp attach <step>` | **Enter a step.** Connect your terminal to a running step's session. |

## Architecture

TaskPlex is a **Go binary (`tp`)** that owns the entire workflow lifecycle. It is not a set of hooks orchestrating an LLM — it is deterministic Go code making all coordination decisions.

```
User types /taskplex:tp in their coding agent
  │
  └─ Go harness takes over
      │
      ├─ DESIGN (design.yaml)
      │   ├─ Route selection (ask user)
      │   ├─ Manifest creation
      │   ├─ Context loading (INTENT.md, CONVENTIONS.md, memplex)
      │   ├─ Quality profile selection (ask user)
      │   ├─ Convention scan + user confirmation
      │   ├─ Intent exploration + approach selection
      │   ├─ Brief writing
      │   └─ Each step: allowed/blocked tools, required artifacts, interaction mode
      │
      ├─ PLANNING (per-route workflow)
      │   ├─ Spec writing (planning agent)
      │   ├─ Critic review (bounded, max 3 rounds)
      │   ├─ User approval
      │   └─ Test plan (verification agent)
      │
      ├─ IMPLEMENTATION (parallel workers)
      │   ├─ Workers execute in isolated sessions
      │   ├─ Per-worker artifact requirements
      │   ├─ Coherence check + build gate
      │   └─ Tactical critic
      │
      ├─ QA
      │   ├─ Smoke test → journey walkthrough → adversarial verification
      │   ├─ Bug fix loop (max 3 rounds)
      │   └─ QA report
      │
      ├─ VALIDATION (parallel reviewers)
      │   ├─ Security, closure, code review (parallel)
      │   ├─ Conditional: database, e2e, user-workflow (file-pattern triggered)
      │   ├─ Hardening + compliance
      │   └─ Build fixer if reviews find issues
      │
      └─ COMPLETION
          └─ Git commit + PR
```

### What Makes This Different

**No LLM in the control plane.** The Go binary reads YAML workflows, spawns agent sessions, checks artifacts, manages retries, and enforces transitions. It does not ask an LLM what to do next.

**One enforcement hook.** `tp-compliance.mjs` calls `tp state check` before every tool call. The Go binary returns allow/deny based on the current step's rules (allowed_tools, blocked_tools, allowed_writes). This single hook replaces the need for 9 separate hooks.

**Declarative workflows.** Every step defines what tools are allowed, what artifacts are required, what interaction mode to use (question/autonomous/interactive), and what happens on completion. The engine enforces these deterministically.

**Per-step model selection.** Each step can use a different coding agent and model. Claude Opus for architecture, Codex GPT-5.4 for critic review, DeepSeek for cheap workers, Gemini for fast structured checks — all in the same pipeline.

## Execution Routes

| Route | Flag | What Happens |
|-------|------|-------------|
| **Light** | `--light` | Minimal design, single worker, basic QA |
| **Standard** | default | Full design, 1-3 parallel workers, critic review, full validation |
| **Blueprint** | `--blueprint` | Explore pre-pass, conditional architect, multi-agent waves, enterprise validation |

## Quality Profiles

Selected by the user during design (never auto-assigned silently):

| Profile | Validation Agents | Required Artifacts Before Commit |
|---------|------------------|--------------------------------|
| **Lean** | Build checks only | None |
| **Standard** | Security, closure, code review | `security.md` + `closure.md` + `code-quality.md` |
| **Enterprise** | + hardening + compliance | All of standard + `hardening/report.md` + `compliance.md` |

Conditional reviewers trigger based on file patterns: database review for SQL, e2e for UI files, user-workflow for routing files.

## Multi-Agent Model Selection

Users configure which coding agent and model runs each role:

```yaml
# ~/.taskplex/config.yaml
roles:
  architect:     { agent: claude, model: claude-opus-4 }
  critic:        { agent: codex, model: gpt-5.4 }        # different perspective
  implementation:{ agent: pi, model: deepseek-v3.2 }     # cheap for workers
  security:      { agent: gemini, model: gemini-3-pro }
  e2e-testing:   { agent: claude, model: claude-sonnet-4 } # needs Playwright MCP
  closure:       { agent: pi, model: gemini-3-flash-lite } # fast, structured
```

Set up with `tp setup`. Change anytime with `tp config amend`. Quick checkpoint during workflow before execution starts.

## Repository Layout

```
taskplex/                          # This repo — plugin + policy assets
├── .claude-plugin/                # Plugin manifest
├── agents/                        # Agent definitions (.md) — system prompts + tool config
├── hooks/                         # tp-compliance.mjs — single governance hook
├── skills/                        # Entry points (/tp, /plan, /drift, /evaluate)
│   └── workflow/references/       # Phase files + contracts (consumed by Go harness)
├── docs/                          # Design documents + PRDs
└── backup/                        # File backups

tp/                                # Separate repo — Go harness (codicis-ai/tp)
├── cmd/tp/                        # CLI entry point
├── internal/                      # Engine, executors, governance, state, session, IPC
├── workflows/                     # YAML workflow definitions
├── hooks/                         # tp-compliance.mjs (deployed copy)
└── codex/ cursor/ opencode/       # Runtime adapter scaffolds
```

## Design Documents

| Document | Status |
|----------|--------|
| `design-pipeline-architecture.md` | Active — Go harness architecture, dual-executor model, agent pool config |
| `taskplex-documentation.md` | Legacy — needs rewrite for Go-first architecture |
| `REFERENCE.md` | Legacy — needs status tagging per component |
| `multi-runtime-plan.md` | Partially active — multi-runtime concept valid, delivery mechanism changed |

## Codicis AI Organization

| Repo | Product |
|------|---------|
| `codicis-ai/taskplex` | TaskPlex — plugin + policy assets (this repo) |
| `codicis-ai/tp` | Pipeline engine — Go harness |
| `codicis-ai/memplex` | Project memory and intelligence |
| `codicis-ai/taskwright` | AI personal assistant |
| `codicis-ai/memwright` | Memory desktop application |

## Status

**Active runtime**: Go harness (`tp`) — full workflow engine with design, execution, QA, validation. Single governance hook (`tp-compliance.mjs`). Declarative YAML workflows. Native session management (no tmux). Multi-executor support (Claude, Codex, Gemini, Pi SDK).

**Policy assets (this repo)**: Agent definitions, phase files, contracts, review standards — consumed by the Go harness as system prompts and policy inputs.

**Adapter scaffolds**: OpenCode, Cursor, Codex — placeholder directories for runtime integration.

**Designed, not yet built**: Pi SDK executor integration, `tp setup` onboarding, dashboard app integration, full multi-runtime adapter testing.

## License

Private repository. All rights reserved.
