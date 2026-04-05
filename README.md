# TaskPlex

Structured workflow orchestration for AI coding agents. Design-first development with quality gates, adversarial verification, and multi-agent coordination.

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

### Enforcement (9 Hooks)

| Hook | What It Blocks |
|------|---------------|
| **Design gate** | File writes before design is approved |
| **Acknowledgment gate** | Implementation before user approves the plan |
| **Critic gate** | Implementation before critic review completes |
| **Implementation gate** | Orchestrator coding inline (must delegate to agents) |
| **Wave gate** | Next wave before previous wave validates |
| **Pre-commit gate** | Git commits without validation passing |
| **Session guardian** | Scope creep, ownership conflicts, build loops (advisory) |

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

| Profile | What It Means |
|---------|--------------|
| **Lean** | Minimal gates, no hardening |
| **Standard** | Full review pipeline, advisory hardening |
| **Enterprise** | Full pipeline + blocking hardening + dependency/license/migration checks |

### Portable Worktree Isolation

Blueprint agents work in TaskPlex-managed git worktrees — created via `git worktree add`, merged after completion, cleaned up automatically. This is portable across all runtimes with git (not dependent on any runtime's native worktree feature).

### Session Guardian

Background observation during implementation:
- **Scope checks**: Warns when agents edit files outside the spec
- **Ownership checks**: Detects when multiple agents modify the same file
- **Observation log**: Append-only record of every edit for post-task analysis
- **Trigger detection**: Fires alerts on scope alarm (3+ out-of-scope files), ownership conflicts, or build loops

## Architecture

```
~/.claude/
├── commands/          5 slash commands (taskplex, tp, plan, solidify, drift)
├── hooks/             9 hook files (design gate, heartbeat, pre-commit, etc.)
├── agents/
│   ├── core/          19 agent definitions
│   └── utility/       4 utility agents
├── taskplex/
│   ├── phases/        6 phase files (init, planning, qa, validation, bootstrap, prd)
│   ├── policy.json    Quality profiles, limits, agent lists
│   ├── gates.md       Gate catalog
│   └── ...            7 contract/schema files
└── skills/
    ├── evaluate/      Product evaluation (audit + review)
    ├── frontend/      Frontend development (design system, a11y, responsive)
    └── plan/          Strategic planning wrapper
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

This repository contains the design, documentation, and backups for TaskPlex:

| Document | Purpose |
|----------|---------|
| `taskplex-documentation.md` | Complete technical documentation |
| `multi-runtime-plan.md` | Cross-runtime distribution plan (8 runtimes) |
| `design-plan-merge.md` | Merge /plan's rich phases (research, journeys, intent guardrails) into /tp |
| `session-guardian-design.md` | Background session observer design (inspired by KAIROS) |
| `prd-workflow-enforcement.md` | PRD: Artifact-based enforcement gates |
| `prd-session-guardian.md` | PRD: Behavioral enforcement (3 phases) |
| `memplex-integration.md` | Memplex integration spec |
| `test-plan.md` | Comprehensive test plan (15 tests) |

## Status

**Built and active**: 5 commands, 9 hooks, 6 phase files, 8 contracts, 23 agents, 3 skills, artifact-based enforcement gates, session guardian Phase 1, TaskPlex-managed worktrees, code intelligence (LSP + ast-grep), production impact assessment, context-preserving QA fix loop.

**Designed, not yet built**: /plan merge into /tp (research, product context, journeys, intent guardrails), multi-runtime distribution, Pi plugin, session guardian Phases 2-3, board architecture, memplex HTTP API.

## License

Private repository. All rights reserved.
