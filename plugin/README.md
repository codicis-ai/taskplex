# TaskPlex — Claude Code Plugin

Structured workflow orchestration for AI coding agents. Design-first development with quality gates, adversarial verification, and multi-agent coordination.

## Install

```bash
claude plugin install taskplex@codicis-ai
```

Or test locally:
```bash
claude --plugin-dir ./taskplex-plugin
```

## Commands

| Command | What It Does |
|---------|-------------|
| `/taskplex:tp [flags] [task]` | Run the full workflow: design, plan, implement, QA, validate |
| `/taskplex:plan [description]` | Strategic thinking and architecture (no implementation) |
| `/taskplex:drift` | Scan codebase for convention violations and architectural drift |
| `/taskplex:solidify` | Merge skill evolutions into source |
| `/taskplex:evaluate` | Audit or review an existing implementation |

## Execution Routes

| Route | Flag | Design Depth |
|-------|------|-------------|
| **Light** | `--light` | Convention scan + intent confirm |
| **Standard** | *(default)* | Conventions + lightweight journeys + intent file |
| **Blueprint** | `--blueprint` | Full: research + product context + journeys + intent guardrails |

## What It Enforces

Every phase transition is enforced by artifact-based gates:

- **Spec gate** — No `spec.md` = no implementation (Standard/Blueprint)
- **Critic gate** — No review artifacts = no implementation
- **Blueprint gate** — No `architecture.md` or `file-ownership.json` = no implementation
- **Implementation gate** — Orchestrator must delegate to agents, not code inline
- **Pre-commit gate** — No validation = no git commit
- **Session guardian** — Warns on scope creep, ownership conflicts, build loops

## What's Included

- **23 agents**: architect, planning, implementation, verification, 7 reviewers, critics, utilities
- **7 skills**: tp, plan, drift, solidify, evaluate, frontend, workflow (core phases)
- **9 hooks**: design gate, heartbeat, pre-commit, session start, pre-compact, prompt check, stop, sentinel
- **6 phase files**: init, planning, QA, validation, bootstrap, PRD
- **8 contracts**: policy, gates, artifacts, manifest schema, handoffs, hardening, portability, evolution

## Optional Integrations

| Integration | How to Enable |
|-------------|--------------|
| **Playwright MCP** | Bundled in `.mcp.json` — activates on plugin enable |
| **Memplex** | Install separately — TaskPlex detects and uses if available |
| **LSP** | Install language server plugins — agents use when available |
| **ast-grep** | Install CLI — agents use for structural code search |

## Migration from Manual Install

If you previously installed TaskPlex by copying files to `~/.claude/`:

1. Install the plugin: `claude plugin install taskplex@codicis-ai`
2. Remove old hooks: `rm ~/.claude/hooks/tp-*.mjs ~/.claude/hooks/hook-utils.mjs ~/.claude/hooks/start-task-sentinel.mjs`
3. Remove old TaskPlex files: `rm -rf ~/.claude/taskplex/`
4. Remove old agents: delete TaskPlex agents from `~/.claude/agents/core/` and `~/.claude/agents/utility/`
5. Remove old commands: `rm ~/.claude/commands/{taskplex,tp,plan,solidify,drift}.md`
6. Remove old skills: `rm -rf ~/.claude/skills/{evaluate,frontend,plan}/`
7. Remove TaskPlex hook entries from `~/.claude/settings.json`

Your `.claude-task/` project directories are unaffected — active tasks continue to work.

Commands change from `/tp` to `/taskplex:tp`.

## Version

1.0.0

## License

All rights reserved.
