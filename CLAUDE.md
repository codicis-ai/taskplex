# TaskPlex — Structured Workflow Orchestration for AI Agents

## What TaskPlex Is

TaskPlex is a **workflow orchestration framework** that enforces structured, multi-phase development workflows for AI coding agents (Claude Code, pi). It wraps every development task in a design-first process with quality gates, user interaction checkpoints, and validation pipelines.

**Core thesis**: The governance infrastructure IS the product. Not the agents. Agents are commoditized — what differentiates is context architecture, validation, autonomy management, and audit trails.

## Architecture Overview

### Entry Points
- `/taskplex` or `/tp` — Claude Code slash commands (`~/.claude/commands/taskplex.md`, `tp.md`)
- `/plan` — Strategic thinking & architecture command (`~/.claude/commands/plan.md`)

### Workflow Phases (7 phases, sequential)
1. **Initialization** — Parse task, create manifest, load context, detect project type
2. **Design (Sub-phase A)** — Convention scan + optional user questions about codebase patterns
3. **Design (Sub-phase B)** — Intent exploration with user: scope, journeys, approaches, section-by-section approval
4. **Planning** — Spec writing by planning agent, spec critic review, user acknowledges plan
5. **Implementation** — Single or multi-agent execution depending on route
5.5. **QA** — Product-type-aware testing: browser walkthrough, CLI execution, API calls
6. **Validation** — Build checks, security review, closure, code review, hardening, compliance
7. **Completion** — Git commit, PR creation, task summary

### Execution Routes (3)
| Route | Flag | Agents | Use Case |
|-------|------|--------|----------|
| **Standard** | `--standard` | 1 agent | Default, single-threaded |
| **Team** | `--team` | 1-3 parallel agents | Independent sections |
| **Blueprint** | `--blueprint` | Opus architect + critics + multi-agent + worktrees | Complex features |

Initiative mode (`--prd`) extends Blueprint with feature decomposition and wave-based execution.

### Quality Profiles (3)
| Profile | Gates | Hardening |
|---------|-------|-----------|
| **Lean** | Minimal | Skipped |
| **Standard** | Full (security, closure, code review, compliance) | Advisory |
| **Enterprise** | Full + readiness + dependency/license/migration/operability | Blocking |

### Design Depth (2)
- **Full** (default) — 2-4 convention questions, 2-6 intent questions, approach proposals, section-by-section approval
- **Light** (`--light`) — 1-2 critical questions, minimal brief

## Key Enforcement Mechanisms

### Hooks (defined in commands, referenced but NOT yet wired in settings.json)
| Hook | Purpose | Enforcement |
|------|---------|-------------|
| `tp-design-gate` | Blocks file writes before design sub-phases complete | Hard — checks `manifest.designPhase` + interaction counters |
| `tp-heartbeat` | Tracks every file edit, updates manifest, renders progress | Hard — errors without session file |
| `tp-pre-commit` | Blocks git commits without `validation-gate.json` | Hard |
| `tp-session-start` | Detects active tasks on session resume, injects recovery context | Advisory |
| `tp-pre-compact` | Checkpoints state before context compaction | Advisory |
| `tp-stop` | Warns on incomplete validation at session end | Advisory (non-blocking) |

**Current state**: Hook scripts are **not yet implemented** as `.mjs` files and **not configured** in `settings.json`. The commands describe them as if active, but enforcement is currently prompt-based only.

### Design Gate Sub-phases (must advance in order)
```
convention-scan → convention-check → intent-exploration → approach-review → design-approval → brief-writing
```

### Adaptive Interaction Model (v2)
The design phase uses **adaptive interaction** — question count is driven by context density, not hard minimums. The system gathers context from three sources (invocation, docs, codebase scan), synthesizes it, then asks only about gaps.

**Gate criteria** (flags, not counters):
- **Full mode**: `contextConfirmed && ambiguitiesResolved && approachSelected && sectionsApproved >= 1`
- **Light mode**: `contextConfirmed`
- Question counters (`intentQuestionsAsked`, etc.) are kept for observability but are NOT gate criteria

**Bootstrap (Phase -1)** also uses this model — no autonomous agent generation of INTENT.md. The orchestrator asks, listens, writes from conversation.

### Manifest (`manifest.json`)
Central state file at `.claude-task/{taskId}/manifest.json`. Tracks phase, design interaction evidence, modified files, validation results, degradations, escalations, and worker handoffs. Schema at `~/.claude/taskplex/manifest-schema.json`.

## File Locations

### Core Contracts (runtime-agnostic)
```
~/.claude/taskplex/
├── phases/init.md          # Phase 0: initialization + design
├── phases/planning.md      # Phase 1: planning + implementation dispatch
├── phases/qa.md            # Phase 4.5: product-type QA
├── phases/validation.md    # Phase 5: validation pipeline + completion
├── phases/bootstrap.md     # Phase -1/-0.5: INTENT.md + conventions bootstrap
├── phases/prd.md           # Initiative mode extensions
├── policy.json             # Quality profiles, limits, execution modes
├── gates.md                # Gate catalog: names, verdicts, execution order
├── artifact-contract.md    # Required artifacts by profile
├── manifest-schema.json    # Manifest JSON schema v2
├── handoff-contract.md     # Agent-to-agent transition format
├── hardening-checks.md     # Hardening check registry
└── portability.md          # Adapter checklist for porting to other runtimes
```

### Commands
```
~/.claude/commands/
├── taskplex.md             # Main /taskplex command definition
├── tp.md                   # /tp alias
├── plan.md                 # /plan strategic planning command
├── taskplex-adapter-checklist.md  # Template for building new adapters
└── (other unrelated commands)
```

### Related Skills
- `~/.claude/skills/evaluate/` — Product evaluation (audit, brief, spec, review modes)
- `~/.claude/skills/plan/` — Planning support

## Design Documents (this project directory)

| File | Purpose |
|------|---------|
| `board-architecture.md` | CEO & Board multi-agent decision system for pi |
| `business-agent-framework.md` | Enterprise agent deployment research synthesis |
| `taskplex-pi-gap-analysis.md` | Claude Code → pi hook mapping with gap analysis |
| `taskplex-pi-plugin.md` | Complete pi plugin build specification (43KB) |

## What's Built vs What's Designed

### Built and Active (Claude Code)
- `/taskplex` and `/tp` command definitions with full protocol
- `/plan` command with Full/Quick routes
- All phase files (init, planning, qa, validation, bootstrap)
- All contract files (gates, artifacts, handoffs, policy, schema)
- Adapter checklist template
- Design documents for pi port

### Designed but Not Implemented
- Hook scripts (`.mjs` files) — referenced everywhere but no actual code exists
- Agent definitions (`~/.claude/agents/core/*.md`) — referenced in phase files but not verified
- Pi plugin — fully specified in `taskplex-pi-plugin.md` but not built
- `conventions.json` schema — referenced but schema file not verified
- Session file / visualizer bridge — referenced but no viz app exists
- Board architecture — designed but not built

### Key Gap
**Hooks are the enforcement layer** — without them, the entire design gate, heartbeat, pre-commit, and session recovery system is advisory-only. The commands describe hard enforcement but it currently relies on the LLM following instructions rather than actual hook scripts blocking operations.
