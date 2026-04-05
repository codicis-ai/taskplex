# PRD: TaskPlex Claude Code Plugin

> **Status**: Ready to build
> **Priority**: High — prerequisite for all distribution
> **Scope**: Repackage existing files into Claude Code plugin format, update path references
> **Estimated effort**: 1-2 days
> **Dependencies**: None — uses existing built features

## Problem Statement

TaskPlex is 50+ files scattered across `~/.claude/` subdirectories with manual `settings.json` hook wiring. There is no install mechanism, no version tracking, no update path. Giving TaskPlex to another person requires walking them through copying files into 6 directories and patching settings.json without clobbering their existing configuration.

Claude Code has a plugin system that supports every component TaskPlex uses: commands, agents, skills, hooks, and MCP servers. Plugins install with one command, update via version tracking, and coexist with user configuration via namespacing.

## Goal

Package TaskPlex as a Claude Code plugin that installs with:
```
/plugin marketplace add github.com/jasnaidu-sa/taskplex-plugin
/plugin install taskplex
```

And makes `/taskplex:tp`, `/taskplex:plan`, `/taskplex:drift`, `/taskplex:solidify`, and `/taskplex:evaluate` available immediately.

## Current File Inventory

| Category | Location | Count | Files |
|----------|----------|-------|-------|
| Commands | `~/.claude/commands/` | 5 | taskplex.md, tp.md, plan.md, solidify.md, drift.md |
| Hooks | `~/.claude/hooks/` | 10 | hook-utils.mjs, tp-design-gate.mjs, tp-heartbeat.mjs, tp-pre-commit.mjs, tp-session-start.mjs, tp-pre-compact.mjs, tp-prompt-check.mjs, tp-stop.mjs, start-task-sentinel.mjs |
| Hook wiring | `~/.claude/settings.json` | 9 entries | PreToolUse, PostToolUse, UserPromptSubmit, SessionStart, PreCompact, Stop |
| Core agents | `~/.claude/agents/core/` | 19 | architect, planning-agent, implementation-agent, verification-agent, review-standards, security-reviewer, closure-agent, code-reviewer, hardening-reviewer, database-reviewer, e2e-reviewer, user-workflow-reviewer, compliance-agent, researcher, merge-resolver, bootstrap, prd-bootstrap, strategic-critic, tactical-critic |
| Utility agents | `~/.claude/agents/utility/` | 4 | build-fixer, drift-scanner, explore, session-guardian |
| Phase files | `~/.claude/taskplex/phases/` | 6 | init.md, planning.md, qa.md, validation.md, bootstrap.md, prd.md |
| Contract files | `~/.claude/taskplex/` | 8 | policy.json, gates.md, artifact-contract.md, manifest-schema.json, handoff-contract.md, hardening-checks.md, portability.md, skill-evolution.md |
| Skills | `~/.claude/skills/` | 3 dirs | evaluate/ (skill + modes + refs + templates), frontend/ (skill + refs + templates), plan/ (skill wrapper) |

**Total**: ~55 files to package.

## Plugin Structure

```
taskplex-plugin/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── taskplex.md
│   ├── tp.md
│   ├── plan.md
│   ├── solidify.md
│   └── drift.md
├── agents/
│   ├── architect.md
│   ├── planning-agent.md
│   ├── implementation-agent.md
│   ├── verification-agent.md
│   ├── review-standards.md
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
│   ├── build-fixer.md
│   ├── drift-scanner.md
│   ├── explore.md
│   └── session-guardian.md
├── skills/
│   ├── taskplex/
│   │   ├── SKILL.md                    # Core workflow entry point
│   │   └── references/
│   │       ├── phases/
│   │       │   ├── init.md
│   │       │   ├── planning.md
│   │       │   ├── qa.md
│   │       │   ├── validation.md
│   │       │   ├── bootstrap.md
│   │       │   └── prd.md
│   │       ├── contracts/
│   │       │   ├── policy.json
│   │       │   ├── gates.md
│   │       │   ├── artifact-contract.md
│   │       │   ├── manifest-schema.json
│   │       │   ├── handoff-contract.md
│   │       │   ├── hardening-checks.md
│   │       │   ├── portability.md
│   │       │   └── skill-evolution.md
│   │       └── evolutions.json         # Skill evolution state (initially empty)
│   ├── evaluate/
│   │   ├── SKILL.md
│   │   ├── modes/
│   │   │   ├── audit.md
│   │   │   └── review.md (brief.md)
│   │   ├── references/
│   │   │   └── scope-guide.md
│   │   └── templates/
│   │       └── brief-template.md
│   ├── frontend/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── templates/
│   └── plan/
│       └── SKILL.md
├── hooks/
│   ├── hooks.json                       # All 9 hook wirings
│   ├── hook-utils.mjs
│   ├── tp-design-gate.mjs
│   ├── tp-heartbeat.mjs
│   ├── tp-pre-commit.mjs
│   ├── tp-session-start.mjs
│   ├── tp-pre-compact.mjs
│   ├── tp-prompt-check.mjs
│   ├── tp-stop.mjs
│   └── start-task-sentinel.mjs
├── .mcp.json                            # Optional: playwright MCP config
├── settings.json                        # Plugin default settings (if needed)
└── README.md
```

## Plugin Manifest

```json
{
  "name": "taskplex",
  "description": "Structured workflow orchestration for AI coding agents. Design-first development with quality gates, adversarial verification, and multi-agent coordination.",
  "version": "1.0.0",
  "author": {
    "name": "Jas Naidu"
  },
  "homepage": "https://github.com/jasnaidu-sa/taskplex",
  "repository": {
    "type": "git",
    "url": "https://github.com/jasnaidu-sa/taskplex-plugin"
  },
  "license": "UNLICENSED",
  "keywords": [
    "workflow",
    "orchestration",
    "governance",
    "multi-agent",
    "quality-gates",
    "verification",
    "design-first"
  ]
}
```

## Command Namespacing

| Current | Plugin | User types |
|---------|--------|-----------|
| `/tp` | `/taskplex:tp` | `/taskplex:tp add user auth --blueprint` |
| `/taskplex` | `/taskplex:taskplex` | `/taskplex:taskplex add user auth` |
| `/plan` | `/taskplex:plan` | `/taskplex:plan redesign the API` |
| `/drift` | `/taskplex:drift` | `/taskplex:drift` |
| `/solidify` | `/taskplex:solidify` | `/taskplex:solidify` |

The namespace prefix comes from `plugin.json` `name` field. All commands get `taskplex:` prefix.

**Note**: If this is too verbose, we could name the plugin `tp` so commands become `/tp:tp`, `/tp:plan`, `/tp:drift`. But `taskplex` is clearer for marketplace discovery.

## hooks.json Format

Migrated from settings.json hook entries to plugin hooks.json format (identical structure, just in a different file):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$PLUGIN_DIR/hooks/tp-design-gate.mjs\""
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$PLUGIN_DIR/hooks/tp-pre-commit.mjs\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$PLUGIN_DIR/hooks/tp-heartbeat.mjs\""
          }
        ]
      },
      {
        "matcher": "Read|Bash|Grep|Glob|Agent|WebFetch|WebSearch",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$PLUGIN_DIR/hooks/start-task-sentinel.mjs\""
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$PLUGIN_DIR/hooks/tp-prompt-check.mjs\""
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup|resume|compact",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$PLUGIN_DIR/hooks/tp-session-start.mjs\""
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$PLUGIN_DIR/hooks/tp-pre-compact.mjs\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$PLUGIN_DIR/hooks/tp-stop.mjs\""
          }
        ]
      }
    ]
  }
}
```

**Open question**: Does `$PLUGIN_DIR` work in hook commands, or do we need to resolve the path differently? The hook `.mjs` files use `import.meta.url` to find `hook-utils.mjs` via relative import, which should work from any location. The `hooks.json` command just needs to invoke the right `.mjs` file. Need to verify this during implementation.

## Path Reference Updates

All files that reference `~/.claude/` paths need updating:

### Phase files (init.md, planning.md, etc.)
Current: `Read ~/.claude/taskplex/phases/qa.md`
Plugin: `Read $TASKPLEX_HOME/phases/qa.md`

The `$TASKPLEX_HOME` variable resolves to the plugin's `skills/taskplex/references/` directory. This resolution happens in the orchestrator (the LLM reading the phase files), not in code — the phase files are markdown instructions, not executables.

**Approach**: Replace all hardcoded `~/.claude/taskplex/` paths with `$TASKPLEX_HOME/` in phase files. Add a resolution instruction at the top of `init.md`:

```markdown
$TASKPLEX_HOME resolves to the taskplex plugin's references directory.
If installed as plugin: {plugin-install-dir}/skills/taskplex/references/
If standalone: ~/.claude/taskplex/
```

### Agent definitions
Current: `Read ~/.claude/agents/core/review-standards.md`
Plugin: These are in the `agents/` directory of the plugin, resolved by Claude Code's agent system. References like "spawn implementation-agent" just work because the plugin registers the agents.

### Hook files (.mjs)
Current: `hook-utils.mjs` imported via `import.meta.url` relative path
Plugin: Same — relative imports from the hook file's location. No change needed as long as all hooks are in the same directory.

### Command files
Current: `Read ~/.claude/taskplex/phases/init.md`
Plugin: `Read $TASKPLEX_HOME/phases/init.md`

Same `$TASKPLEX_HOME` replacement as phase files.

## taskplex-core Extraction

The plugin structure naturally creates the `taskplex-core` package from the multi-runtime plan:

```
taskplex-plugin/skills/taskplex/references/
  = taskplex-core/

Contains:
  phases/     — workflow phase instructions
  contracts/  — policy, gates, schemas, handoffs
```

Plus the agents in `taskplex-plugin/agents/` are also core.

For other runtime plugins (Cursor, Codex, etc.), they reference or copy this same core. The Claude Code plugin is the first consumer and the canonical source.

## Optional MCP Configuration

`.mcp.json` at plugin root configures MCP servers that activate when the plugin is enabled:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

Memplex is NOT bundled — it's a separate product with its own install. TaskPlex detects memplex availability at runtime and degrades gracefully.

OfficeCLI is NOT bundled — it's a companion skill, install separately.

## Migration Path for Existing Users

For users who already have TaskPlex installed manually:

1. Install the plugin: `/plugin install taskplex`
2. Remove old files from `~/.claude/`:
   - Delete `~/.claude/hooks/tp-*.mjs`, `hook-utils.mjs`, `start-task-sentinel.mjs`
   - Delete `~/.claude/taskplex/` directory
   - Delete `~/.claude/agents/core/` and `~/.claude/agents/utility/` (TaskPlex agents only)
   - Delete `~/.claude/commands/taskplex.md`, `tp.md`, `plan.md`, `solidify.md`, `drift.md`
   - Delete `~/.claude/skills/evaluate/`, `frontend/`, `plan/`
3. Remove hook entries from `~/.claude/settings.json` (the plugin's `hooks.json` replaces them)
4. Commands change from `/tp` to `/taskplex:tp`

**Backward compatibility**: Existing `.claude-task/` directories and manifests are unaffected — they're project-level, not plugin-level. Active tasks continue to work.

## Acceptance Criteria

- AC-1: Plugin installs via `/plugin install taskplex` from a GitHub marketplace
- AC-2: `/taskplex:tp`, `/taskplex:plan`, `/taskplex:drift`, `/taskplex:solidify` commands work
- AC-3: All 9 hooks fire correctly (design gate blocks, heartbeat tracks, pre-commit blocks, etc.)
- AC-4: All 23 agents are registered and spawnable
- AC-5: All 3 companion skills (evaluate, frontend, plan) are available
- AC-6: Phase files are readable from the plugin's references directory
- AC-7: Hook `.mjs` files find and import `hook-utils.mjs` correctly via relative paths
- AC-8: Existing `.claude-task/` manifests and task artifacts continue to work
- AC-9: Plugin coexists with user's existing hooks and commands (no clobber)
- AC-10: `$TASKPLEX_HOME` resolves correctly in all phase and command files
- AC-11: Playwright MCP activates when plugin is enabled (optional, via .mcp.json)
- AC-12: Plugin version tracked in plugin.json, marketplace shows version

## Test Plan

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1 | Fresh install | `/plugin marketplace add {url}` → `/plugin install taskplex` | Plugin listed in `/plugin list` |
| 2 | Commands available | `/help` | Shows `/taskplex:tp`, `/taskplex:plan`, etc. |
| 3 | Start task | `/taskplex:tp add user auth` | Manifest created, design phase begins |
| 4 | Design gate fires | Write source file before design complete | Blocked with gate message |
| 5 | Heartbeat fires | Edit a file during implementation | `progress.md` updated, observations logged |
| 6 | Pre-commit fires | `git commit` without validation | Blocked with validation message |
| 7 | Agent spawn | Blueprint route spawns architect | Architect agent runs, returns output |
| 8 | Spec gate fires | Write source file with no spec.md | Blocked: "No spec.md found" |
| 9 | Critic gate fires | Write source file with no review artifacts | Blocked: "No critic review artifacts" |
| 10 | Phase file reads | Orchestrator reads init.md from plugin | Phase instructions loaded correctly |
| 11 | Skill trigger | Frontend work triggers frontend skill | Skill activates, provides guidance |
| 12 | Evaluate skill | `/taskplex:evaluate` | Audit/review modes available |
| 13 | Existing task resume | Start Claude Code with existing `.claude-task/` | Session-start hook detects task, renders checklist |
| 14 | Coexistence | User has custom hooks in settings.json | Both plugin hooks and user hooks fire |
| 15 | Uninstall | `/plugin uninstall taskplex` | Plugin removed, user files intact |
| 16 | Dev mode test | `claude --plugin-dir ./taskplex-plugin` | Plugin loads from local directory |

## Implementation Phases

### Phase 1: Create plugin structure (half day)
- Create directory structure matching the layout above
- Create `plugin.json` manifest
- Copy all files from `~/.claude/` into plugin directories
- Flatten agents from `core/` + `utility/` into single `agents/` directory

### Phase 2: Path references (half day)
- Replace all `~/.claude/taskplex/` references with `$TASKPLEX_HOME/`
- Add `$TASKPLEX_HOME` resolution instruction to init.md
- Replace all `~/.claude/agents/core/` and `~/.claude/agents/utility/` references with agent names only (plugin resolves)
- Verify relative imports in hook .mjs files

### Phase 3: hooks.json (2-3 hours)
- Create `hooks/hooks.json` from settings.json entries
- Determine correct command paths (verify `$PLUGIN_DIR` or equivalent)
- Test each hook fires correctly

### Phase 4: Test end-to-end (half day)
- Run `claude --plugin-dir ./taskplex-plugin`
- Execute a full Light route task
- Execute a Standard route task
- Verify all gates fire
- Verify agent spawning works
- Verify skill activation

### Phase 5: GitHub marketplace + README (2-3 hours)
- Create `taskplex-plugin` repo (or subdirectory of existing repo)
- Push plugin structure
- Create marketplace manifest
- Write installation README
- Test: `/plugin marketplace add` → `/plugin install`

### Phase 6: Official Anthropic marketplace submission (1-2 days for review)
- Submit via claude.ai/settings/plugins/submit
- Documentation, screenshots, description

## Open Questions

1. **Plugin name**: `taskplex` (clear, discoverable) vs `tp` (shorter commands like `/tp:tp`). Recommendation: `taskplex` — clarity over brevity in a marketplace.

2. **Hook command paths**: Does `$PLUGIN_DIR` or similar variable exist in hooks.json commands? If not, we may need to use absolute paths resolved at install time, or a wrapper script. Need to verify with the plugins reference.

3. **Single repo or separate repo?** The design docs and backups stay in `jasnaidu-sa/taskplex`. The plugin could be:
   - A subdirectory of the same repo (`taskplex/plugin/`)
   - A separate repo (`jasnaidu-sa/taskplex-plugin`)
   Recommendation: Separate repo — marketplace needs a clean root with `.claude-plugin/` at top level.

4. **Should we keep standalone mode?** After the plugin exists, should the manual `~/.claude/` installation remain documented as an alternative? Recommendation: Yes, for development and for users who can't use plugins. But plugin is the primary path.

5. **Companion skills bundled or separate?** Evaluate, frontend, plan — bundle in v1, split if plugin size becomes an issue. These are small markdown files, not heavyweight dependencies.

6. **Version strategy**: Semver. Major = breaking phase/gate changes. Minor = new features. Patch = bug fixes. Start at 1.0.0.
