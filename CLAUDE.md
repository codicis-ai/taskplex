# TaskPlex — Go-Based Workflow Harness for AI Agents

## What TaskPlex Is

TaskPlex is a **Go-based workflow harness** that governs the full lifecycle of AI-assisted software development. A deterministic Go binary (`tp`) manages design, planning, implementation, QA, validation, and completion — no LLM in the control plane.

**Core thesis**: The governance infrastructure IS the product. Agents are commoditized — what differentiates is the intent contract, deterministic enforcement, and audit trail.

## Architecture

### Control Plane

The Go harness (`tp`) owns the entire workflow:
- Reads YAML workflow definitions
- Spawns isolated agent sessions per step
- Enforces per-step tool restrictions and artifact requirements
- Manages state, retries, parallelism, and transitions deterministically
- Single enforcement hook (`tp-compliance.mjs`) calls `tp state check` before every tool call

### Entry Point

User types `/taskplex:tp` in their coding agent → Go harness takes over for everything.

### Intent Contract (Central Driver)

Every task is governed by a **success contract** that flows through all phases:

```
Design → success-criteria.json    (structured SC-* with observable outcomes)
Planning → success-map.json       (SC-* mapped to code targets + verification)
Implementation → worker-evidence.json  (per-worker evidence of SC satisfaction)
Validation → traceability.json    (resolved evidence matrix: SC → code → status)
Completion → workflow-eval.json   (process self-evaluation)
```

Each success criterion gets a status: `SATISFIED`, `PARTIAL`, `MISSING`, or `UNSCORABLE`.
Missing high-priority SC = automatic FAIL.

### Workflow Phases

1. **Initialization** — Route selection, quality profile (user confirms), build commands, context loading
2. **Convention Scan** — Codebase patterns + user confirmation
3. **Exploration** — Fast reconnaissance via explore agent → `exploration-summary.md`
4. **Intent Exploration** — User journeys, approach selection, write `brief.md` + `intent.md` + `success-criteria.json`
5. **Planning** — Spec writing with intent guardrails, critic review (max 3 rounds), write `success-map.json`
6. **Implementation (Foundation First)**:
   - Wave 0: Foundation — shared types, database schema, API contract, auth model
   - Wave 1: Data layer — queries, route handlers (uses Wave 0 types + schema)
   - Wave 2: Integration — API clients, components (uses Wave 0 contract)
   - Wave 3: Polish — error handling, tests (stable interfaces from Wave 0-2)
   - Each worker produces `worker-evidence.json` for SC satisfaction
   - No-Invention Rule: Wave 1+ workers consume Wave 0, never invent interfaces
7. **QA** — Migrations, dev server, functional E2E journeys, adversarial verification
8. **Validation** — Parallel reviewers, traceability resolution, workflow eval, compliance
9. **Completion** — Git commit, PR, knowledge persistence

### Execution Routes

| Route | Flag | What Happens |
|-------|------|-------------|
| **Light** | `--light` | Minimal design, single worker, basic QA |
| **Standard** | default | Full design, 1-3 parallel workers, critic review, full validation |
| **Blueprint** | `--blueprint` | Explore pre-pass, conditional architect (only when needed), multi-agent waves, enterprise validation |

### Quality Profiles (user-confirmed, never auto-assigned)

| Profile | Validation Agents | Required Artifacts |
|---------|------------------|--------------------|
| **Lean** | Build checks only | None |
| **Standard** | Security, closure, code review | `security.md` + `closure.md` + `code-quality.md` |
| **Enterprise** | + hardening + compliance | All of standard + `hardening/report.md` + `compliance.md` |

Conditional reviewers trigger by file patterns: database (SQL), e2e (UI), user-workflow (routing).

## Enforcement Model

### Single Governance Hook

`tp-compliance.mjs` calls `tp state check` before every tool call. The Go binary checks the current step's allowed/blocked tools and returns allow/deny. This ONE hook replaces all prior enforcement hooks.

### Artifact-Based Progression

The Go engine checks file existence between steps. Missing artifacts block progression deterministically — no LLM judgment involved.

### Declarative Step Rules

Each YAML step defines:
- `allowed_tools` / `blocked_tools` — what the agent can do
- `artifacts.required` — what must exist before completion
- `interaction.mode` — question / autonomous / interactive
- `skip_conditions` — when to skip
- `on_complete` — manifest updates, events emitted

## Agents

### Planning & Design
| Agent | Role |
|-------|------|
| `explore` | Fast codebase reconnaissance — maps terrain before architect. Writes `exploration-summary.md`. Cannot make decisions. |
| `architect` | Architecture decisions only. Reads prepared inputs (brief, intent, exploration-summary). Writes `architecture.md` + `worker-strategy.md`. Returns BLOCKED if inputs insufficient. |
| `planning-agent` | Writes spec from brief + intent guardrails. Writes `success-map.json`. |
| `strategic-critic` | Reviews architecture/PRD strategic soundness |
| `tactical-critic` | Reviews per-feature spec quality |
| `researcher` | External research (web search) |

### Implementation
| Agent | Role |
|-------|------|
| `implementation-agent` | Implements code per brief. Produces `worker-evidence.json` for SC satisfaction. |
| `build-fixer` | Fixes build/review failures |
| `merge-resolver` | Resolves git merge conflicts |

### Verification
| Agent | Role |
|-------|------|
| `verification-agent` | Adversarial testing. Two modes: test-plan + verify. |

### Review
| Agent | Role |
|-------|------|
| `security-reviewer` | OWASP-focused security scan |
| `closure-agent` | Success contract verification — scores each SC-* against implementation evidence. SATISFIED/PARTIAL/MISSING/UNSCORABLE. |
| `code-reviewer` | Code quality, conventions |
| `hardening-reviewer` | Production readiness, EXPLAIN ANALYZE |
| `database-reviewer` | Query correctness, migration safety |
| `e2e-reviewer` | Functional journey testing via Playwright |
| `user-workflow-reviewer` | Navigation coherence |
| `compliance-agent` | Final gate — cross-validates all reviews + success contract |

### Shared
| Asset | Role |
|-------|------|
| `review-standards` | Anti-rationalization rules, verdict-findings consistency |

### Utility
| Agent | Role |
|-------|------|
| `drift-scanner` | Read-only codebase drift scan |
| `session-guardian` | One-shot analysis when deviations detected |
| `build-fixer` | Fix build/review failures |

## Multi-Agent Model Selection

Users configure which coding agent and model runs each role:

```yaml
# ~/.taskplex/config.yaml
roles:
  architect:      { agent: claude, model: claude-opus-4 }
  critic:         { agent: codex, model: gpt-5.4 }
  implementation: { agent: pi, model: deepseek-v3.2 }
  security:       { agent: gemini, model: gemini-3-pro }
  e2e-testing:    { agent: claude, model: claude-sonnet-4 }
  closure:        { agent: pi, model: gemini-3-flash-lite }
```

Configured via `tp setup` (one-time), `tp config amend` (change anytime), and workflow checkpoint (per-task adjustment).

## Key Artifacts

| Artifact | Phase | Purpose |
|----------|-------|---------|
| `brief.md` | Design | User stories, ACs, scope |
| `intent.md` | Design | Binding guardrails for architect |
| `success-criteria.json` | Design | Structured SC-* success contract |
| `exploration-summary.md` | Design | Codebase reconnaissance for architect |
| `spec.md` | Planning | Implementation plan |
| `success-map.json` | Planning | SC-* → code targets + verification |
| `architecture.md` | Planning (Blueprint) | Architecture decisions |
| `worker-strategy.md` | Planning (Blueprint) | Worker decomposition plan |
| `file-ownership.json` | Planning | Worker file assignments |
| `worker-evidence.json` | Implementation | Per-worker SC evidence |
| `reviews/*.md` | Validation | Review verdicts |
| `traceability.json` | Validation | Resolved SC evidence matrix |
| `workflow-eval.json` | Validation | Process self-evaluation |

## Repository Layout

```
taskplex/                           # This repo — plugin + policy assets
├── .claude-plugin/                 # Plugin manifest
├── agents/                         # Agent definitions — system prompts consumed by Go harness
├── hooks/                          # tp-compliance.mjs — single governance hook
├── skills/                         # Entry points + workflow references
│   └── workflow/references/        # Phase files + contracts (policy inputs to Go harness)
├── backup/                         # File backups
└── *.md                            # Design documents + PRDs

tp/                                 # Separate repo (codicis-ai/tp) — Go harness
├── cmd/tp/                         # CLI entry point
├── internal/                       # Engine, executors, governance, state, session, IPC
├── workflows/                      # YAML workflow definitions (design, standard, blueprint, etc.)
└── codex/ cursor/ opencode/        # Runtime adapter scaffolds
```

## Design Documents

| Document | Status |
|----------|--------|
| `design-pipeline-architecture.md` | Active — Go harness architecture, dual-executor model, agent pool config |
| `design-plan-merge.md` | Superseded — /plan phases merged into design.yaml |
| `multi-runtime-plan.md` | Partially active — multi-runtime concept valid, delivery via Go harness |
| `prd-haiku-worker-granularity.md` | Active — granular workers, exact code briefs |
| `taskplex-documentation.md` | Legacy — needs rewrite for Go-first architecture |
| `REFERENCE.md` | Legacy — needs status tagging |
| Other PRDs | Historical — document design decisions that led to current architecture |

## Codicis AI Organization

| Repo | Product |
|------|---------|
| `codicis-ai/taskplex` | Plugin + policy assets (this repo) |
| `codicis-ai/tp` | Go harness — pipeline engine |
| `codicis-ai/memplex` | Project memory and intelligence |
| `codicis-ai/taskwright` | AI personal assistant |
| `codicis-ai/memwright` | Memory desktop application |

## What's Built

- Go harness (`tp`) — full workflow engine with design, execution, QA, validation
- Declarative YAML workflows (design.yaml, standard.yaml, blueprint.yaml, light.yaml)
- Single governance hook (`tp-compliance.mjs` → `tp state check`)
- Native Go session management (PTY/process, no tmux)
- Intent contract chain: success-criteria → success-map → worker-evidence → traceability → workflow-eval
- Explore agent for cheap codebase reconnaissance before architect
- Conditional architect (Blueprint — only when architectural decisions needed)
- Multi-executor support (Claude, Codex, Gemini, Pi SDK planned)
- Governance amendment system (workflow amend, executor amend, audited)
- Packet execution engine for granular worker decomposition
- IPC server for real-time monitoring
- Agent definitions consumed as system prompts by Go harness
- Phase files and contracts consumed as policy inputs

## What's Designed, Not Built

- Pi SDK executor integration (cheap models for workers)
- `tp setup` onboarding (discover agents, test connections, model presets)
- Dashboard app integration (kanban monitoring)
- Full multi-runtime adapter testing (Codex, Cursor, OpenCode)
- Workflow eval gate (process self-evaluation)
