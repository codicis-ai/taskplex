# TaskPlex Multi-Runtime Distribution Plan

## Goal

Rebuild TaskPlex as a distributable package that works across all major AI coding agent runtimes, not just Claude Code. The core workflow is already runtime-agnostic — only the adapter layer (hooks, commands, agent spawning) is Claude Code-specific.

## Target Runtimes

| Runtime | Skills | Hooks | Slash Commands | Subagents | MCP | Priority |
|---------|:---:|:---:|:---:|:---:|:---:|---|
| **Claude Code** | Yes | Yes (9 events) | Yes | Yes (Agent tool) | Yes | Already built |
| **Gemini CLI** | Yes (GEMINI.md + agents/) | Yes (mature) | Yes (.toml) | Yes | Yes | High |
| **Cursor** | Yes (.mdc rules) | Yes (Pre/PostToolUse) | Partial | Yes | Yes | High |
| **OpenCode** | Yes (agents/) | Yes (plugins) | Yes | Yes | Yes | High |
| **Codex** | Yes (AGENTS.md + skills/) | Yes (experimental) | Yes | Yes | Yes | Medium |
| **Windsurf** | Yes (rules/) | Yes (6 events) | No | No | Yes | Medium |
| **Pi** | Yes (skills/) | Partial (extensions) | Yes | Partial | Yes | Medium |
| **Kilo Code** | Yes (agents/) | No | Yes | Yes (task tool) | Yes | Low |
| **Aider** | Partial (CONVENTIONS.md) | No | No custom | No | No | Low |

## Architecture

```
taskplex/                              # Distributable package
├── SKILL.md                           # Universal thin entry point (~80 lines)
├── phases/                            # Runtime-agnostic workflow (self-contained)
│   ├── init.md                        # Phase 0: initialization + design
│   ├── planning.md                    # Phase 1: planning + implementation
│   ├── qa.md                          # Phase 4.5: product-type QA
│   ├── validation.md                  # Phase 5: validation + completion
│   ├── bootstrap.md                   # Phase -1/-0.5: INTENT.md + conventions
│   └── prd.md                         # Initiative mode extensions
├── contracts/                         # Runtime-agnostic policy + schemas
│   ├── policy.json                    # Quality profiles, limits, agent lists
│   ├── gates.md                       # Gate catalog
│   ├── artifact-contract.md           # Required artifacts by profile
│   ├── manifest-schema.json           # Manifest schema
│   ├── handoff-contract.md            # Agent-to-agent transitions
│   ├── hardening-checks.md            # Hardening check registry
│   └── skill-evolution.md             # Skill evolution spec
├── agents/                            # Runtime-agnostic agent definitions
│   ├── architect.md
│   ├── planning-agent.md
│   ├── implementation-agent.md
│   ├── security-reviewer.md
│   ├── closure-agent.md
│   ├── code-reviewer.md
│   ├── hardening-reviewer.md
│   ├── database-reviewer.md
│   ├── e2e-reviewer.md
│   ├── user-workflow-reviewer.md
│   ├── compliance-agent.md
│   ├── researcher.md
│   ├── merge-resolver.md
│   ├── bootstrap.md
│   ├── prd-bootstrap.md
│   ├── strategic-critic.md
│   ├── tactical-critic.md
│   └── build-fixer.md
├── adapters/                          # Runtime-specific
│   ├── claude-code/
│   │   ├── hooks/                     # 9 .mjs hook files
│   │   ├── commands/                  # taskplex.md, tp.md, plan.md, solidify.md
│   │   └── install.sh
│   ├── gemini-cli/
│   │   ├── hooks/                     # Gemini hook format (stdin/stdout JSON)
│   │   └── install.sh
│   ├── cursor/
│   │   ├── hooks/                     # Cursor hook format
│   │   ├── rules/                     # .mdc rule files
│   │   └── install.sh
│   ├── opencode/
│   │   ├── plugins/                   # OpenCode plugin format
│   │   └── install.sh
│   ├── codex/
│   │   ├── hooks/                     # hooks.json format
│   │   └── install.sh
│   ├── windsurf/
│   │   ├── hooks/                     # Cascade hook format
│   │   └── install.sh
│   └── generic/
│       └── install.sh                 # For runtimes without hooks (prompt-only)
└── skills/                            # Companion skills (also universal)
    ├── frontend/
    ├── evaluate/
    └── plan/
```

## Key Design Decisions

### 1. Thin SKILL.md (~80 lines, not 340+)

The SKILL.md is a router, not the full protocol. It:
- Parses flags and determines route (Light/Standard/Blueprint)
- Points to the current phase file ("Read phases/init.md NOW")
- Contains mid-task change rules (always relevant)
- Contains the phase dispatch table

Everything else lives in phase files that load on demand. This saves ~200 lines of context at trigger time.

### 2. Phase Files Are Self-Contained

Each phase file works independently — it doesn't reference taskplex.md or other phase files except to say "when done, read phases/{next}.md". This means:
- Only one phase file is active in context at a time
- Phase files can reference contracts/ and agents/ by relative path
- No dependency on a runtime-specific command file

### 3. Path Abstraction

All internal references use `$TASKPLEX_HOME/` instead of `~/.claude/taskplex/`:

```markdown
Read: $TASKPLEX_HOME/phases/init.md
Spawn agent from: $TASKPLEX_HOME/agents/architect.md
Policy: $TASKPLEX_HOME/contracts/policy.json
```

Each adapter's install.sh resolves `$TASKPLEX_HOME` to the runtime's skill/config directory:
- Claude Code: `~/.claude/taskplex/`
- Gemini CLI: `~/.gemini/taskplex/` or `.gemini/taskplex/`
- Cursor: `.cursor/taskplex/`
- OpenCode: `.opencode/taskplex/`
- etc.

### 4. Three-Tier Hook Strategy

**Tier 1 — Critical (must have for full enforcement):**
| Hook | What it does | Required for |
|------|-------------|-------------|
| Design gate | Blocks source writes before design complete | Preventing premature coding |
| Pre-commit gate | Blocks commits without validation | Preventing unvalidated commits |
| Implementation gate | Blocks orchestrator inline coding | Forcing agent delegation |

**Tier 2 — Important (improves experience significantly):**
| Hook | What it does | Required for |
|------|-------------|-------------|
| Heartbeat | Tracks files, updates manifest, renders progress | State accuracy |
| Session start | Detects active tasks, injects recovery | Resume after restart |
| Pre-compact | Checkpoints before compaction | Compaction survival |

**Tier 3 — Nice to have:**
| Hook | What it does |
|------|-------------|
| Prompt check | Detects /tp invocation, warns about active tasks |
| Stop guard | Warns on incomplete validation |
| Sentinel | Tool counting for compaction guard |

Adapters implement what the runtime supports. Missing hooks degrade gracefully:
- No design gate → prompt-based enforcement ("before writing any source file, verify manifest.designPhase")
- No heartbeat → manifest updates done by orchestrator inline (less accurate but functional)
- No session start → user manually reads manifest on resume

### 5. Agent Spawning Abstraction

Phase files reference agents generically:
```markdown
Spawn: architect (tier: high)
  Context: brief.md, architecture decisions, conventions
  Writes to: .claude-task/{taskId}/
  Returns: short summary
```

Each adapter maps to the runtime's spawning mechanism:
- Claude Code: `Agent({ subagent_type: 'general-purpose', model: 'opus', prompt: ... })`
- Gemini CLI: `subagent({ model: 'gemini-2.5-pro', prompt: ... })`
- Cursor: parallel subagent with own context
- OpenCode: agent definition in .opencode/agents/
- Codex: [agents] section in config.toml

The model tier mapping is per-adapter:
| Tier | Claude Code | Gemini CLI | Cursor | OpenCode |
|------|------------|------------|--------|----------|
| High (architect) | opus | gemini-2.5-pro | default (strongest) | strongest available |
| Standard (implementation) | sonnet | gemini-2.5-flash | default | default |
| Fast (closure, compliance) | haiku | gemini-2.5-flash | default | fastest available |

### 6. MCP Integration (Universal)

MCP is supported by almost every runtime. Memplex integration works identically across all of them — the MCP protocol is standardized. No adapter needed for MCP.

## Implementation Plan

### Phase 1: Package Structure (1-2 days)
- Create the distributable package structure
- Move core files from `~/.claude/taskplex/` to `taskplex/` package root
- Update all internal references to use `$TASKPLEX_HOME/` paths
- Write the thin universal SKILL.md

### Phase 2: Claude Code Adapter (1 day)
- Extract existing hooks, commands into `adapters/claude-code/`
- Write install.sh that copies/symlinks to `~/.claude/`
- Verify existing functionality preserved

### Phase 3: Gemini CLI Adapter (2-3 days)
- Translate 3 critical hooks to Gemini's hook format (stdin/stdout JSON, exit codes)
- Map agent spawning to Gemini subagent syntax
- Create install.sh for `~/.gemini/` + `.gemini/`
- Test end-to-end on a real task

### Phase 4: Cursor Adapter (2-3 days)
- Translate hooks to Cursor format
- Create .mdc rule files for workflow guidance
- Map subagent spawning
- Test

### Phase 5: Remaining Adapters (1 day each)
- OpenCode, Codex, Windsurf — hooks + install scripts
- Generic (hookless) — prompt-only enforcement for Aider, Kilo Code

### Phase 6: Installer (1 day)
- Universal installer that detects which runtimes are installed
- `taskplex install` → auto-detects Claude Code, Gemini, Cursor, etc.
- Installs adapter for each detected runtime
- Validates installation

## What Changes for Existing Users

**Nothing breaks.** The Claude Code adapter is the existing implementation. The package structure just organizes it differently. Existing `~/.claude/` installations continue working. The adapter install.sh creates the same file structure.

## Open Questions

1. **Should SKILL.md reference phases by relative path or absolute?** Relative is cleaner but requires the runtime to resolve the skill's directory. Most runtimes support this.

2. **How do hookless runtimes handle the design gate?** The SKILL.md includes a self-enforcement instruction, but compliance will be ~75% vs ~99% with hooks. Is that acceptable?

3. **Should we publish as an npm package, a GitHub release, or both?** npm gives easy install (`npx taskplex install`), GitHub release gives manual control.

4. **How do we handle runtime-specific features?** Blueprint worktrees only work in runtimes that support isolation. For runtimes without it, Blueprint degrades to sequential execution (like Team used to be).
