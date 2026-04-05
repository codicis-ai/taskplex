# PRD: TaskPlex Claude Code Plugin (Revised)

> **Status**: Ready to build
> **Priority**: High — prerequisite for all distribution
> **Scope**: Repackage existing files into Claude Code plugin format, update path references
> **Estimated effort**: 2-3 days
> **Dependencies**: None — uses existing built features
> **Revision**: Incorporates all 14 fixes from tactical critic review

## Problem Statement

TaskPlex is 50+ files scattered across `~/.claude/` subdirectories with manual `settings.json` hook wiring. There is no install mechanism, no version tracking, no update path. Giving TaskPlex to another person requires walking them through copying files into 6 directories and patching settings.json without clobbering their existing configuration.

Claude Code has a plugin system that supports every component TaskPlex uses: skills, agents, hooks, and MCP servers. Plugins install with one command, update via version tracking, and coexist with user configuration via namespacing.

## Goal

Package TaskPlex as a Claude Code plugin that installs with:
```
claude plugin install taskplex@jasnaidu-sa
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

**Note**: No `commands/` directory — plugin docs state `commands/` is legacy. All entry points are `skills/` with SKILL.md files. The current `taskplex.md` and `tp.md` commands become the `taskplex` skill's SKILL.md. Other commands (`plan`, `solidify`, `drift`) become their own skills.

```
taskplex-plugin/
├── .claude-plugin/
│   └── plugin.json
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
│   ├── tp/                              # Primary entry point: /taskplex:tp
│   │   └── SKILL.md                     # Merged from taskplex.md + tp.md
│   ├── plan/
│   │   └── SKILL.md                     # Strategic planning
│   ├── drift/
│   │   └── SKILL.md                     # Drift detection
│   ├── solidify/
│   │   └── SKILL.md                     # Merge skill evolutions
│   ├── evaluate/
│   │   ├── SKILL.md
│   │   ├── modes/
│   │   │   ├── audit.md
│   │   │   └── review.md
│   │   ├── references/
│   │   │   └── scope-guide.md
│   │   └── templates/
│   │       └── brief-template.md
│   ├── frontend/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── templates/
│   └── workflow/                         # Core workflow references (phases + contracts)
│       ├── SKILL.md                      # Not user-invocable — model-invoked by tp skill
│       └── references/
│           ├── phases/
│           │   ├── init.md
│           │   ├── planning.md
│           │   ├── qa.md
│           │   ├── validation.md
│           │   ├── bootstrap.md
│           │   └── prd.md
│           └── contracts/
│               ├── policy.json
│               ├── gates.md
│               ├── artifact-contract.md
│               ├── manifest-schema.json
│               ├── handoff-contract.md
│               ├── hardening-checks.md
│               ├── portability.md
│               └── skill-evolution.md
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
└── README.md
```

**Key structural decisions**:
- No `commands/` — all entry points are skills (per plugin docs guidance)
- No `settings.json` at plugin root — only `agent` key is supported, which we don't need
- `workflow/` skill holds phases and contracts as references — model-invoked, not user-invoked
- `evolutions.json` NOT in plugin directory (see Skill Evolution section below)
- `/taskplex:taskplex` redundancy eliminated — primary command is `/taskplex:tp`

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
    "workflow", "orchestration", "governance", "multi-agent",
    "quality-gates", "verification", "design-first"
  ]
}
```

## Skill Namespacing

| Current | Plugin | User types |
|---------|--------|-----------|
| `/tp` | `/taskplex:tp` | `/taskplex:tp add user auth --blueprint` |
| `/plan` | `/taskplex:plan` | `/taskplex:plan redesign the API` |
| `/drift` | `/taskplex:drift` | `/taskplex:drift` |
| `/solidify` | `/taskplex:solidify` | `/taskplex:solidify` |
| `/evaluate` | `/taskplex:evaluate` | `/taskplex:evaluate audit` |

**No `/taskplex:taskplex`** — the `taskplex.md` command content is merged into the `tp` skill's SKILL.md. One entry point, no redundancy.

## hooks.json Format

Uses `${CLAUDE_PLUGIN_ROOT}` — the official Claude Code variable for plugin install directory:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/tp-design-gate.mjs\""
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/tp-pre-commit.mjs\""
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
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/tp-heartbeat.mjs\""
          }
        ]
      },
      {
        "matcher": "Read|Bash|Grep|Glob|Agent|WebFetch|WebSearch",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/start-task-sentinel.mjs\""
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
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/tp-prompt-check.mjs\""
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
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/tp-session-start.mjs\""
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
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/tp-pre-compact.mjs\""
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
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/tp-stop.mjs\""
          }
        ]
      }
    ]
  }
}
```

## Path Reference Updates

### Phase files, contracts, and skill instructions

**No `$TASKPLEX_HOME` abstraction.** Claude Code supports `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` — these are substituted in skill content, agent content, hook commands, and MCP/LSP configs. Custom variables are not supported.

All hardcoded `~/.claude/taskplex/` paths become:
```
${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/
```

Examples:
- `Read ~/.claude/taskplex/phases/init.md` → `Read ${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/phases/init.md`
- `Read ~/.claude/taskplex/policy.json` → `Read ${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/contracts/policy.json`

### Agent definitions

Agent references change from path-based to name-based:
- `Spawn from ~/.claude/agents/core/implementation-agent.md` → `Spawn agent: implementation-agent`
- Plugin registers all agents in its `agents/` directory. Claude Code resolves by name.

### Hook .mjs files — CRITICAL AUDIT

The hook `.mjs` files contain hardcoded `~/.claude/` strings in **user-facing output messages** — the LLM reads these messages and follows the instructions. After plugin install, those paths won't exist.

**Files requiring path audit** (every `.mjs` file that emits instructions referencing `~/.claude/`):

| File | Issue | Fix |
|------|-------|-----|
| `tp-design-gate.mjs` | Block messages reference `~/.claude/taskplex/phases/planning.md` | Replace with `the planning phase file` (path-agnostic) |
| `tp-pre-commit.mjs` | Instructions reference `~/.claude/taskplex/` | Same approach |
| `tp-prompt-check.mjs` | Workflow reminders reference `~/.claude/taskplex/phases/` | Same approach |
| `tp-session-start.mjs` | Resume instructions reference `~/.claude/taskplex/` | Same approach |
| `tp-stop.mjs` | Instructions reference `~/.claude/taskplex/` | Same approach |

**Approach**: Hook output messages should be path-agnostic. Instead of "Read ~/.claude/taskplex/phases/planning.md", say "Read the planning phase file." The skill instructions (which DO have `${CLAUDE_PLUGIN_ROOT}` substitution) tell the orchestrator where to find files. Hooks should reference concepts ("the planning phase"), not paths.

**Relative imports**: `hook-utils.mjs` is imported via `import.meta.url` + `fileURLToPath` + `dirname`. This resolves from the hook file's actual location, which works from the plugin cache at `~/.claude/plugins/cache/`. All hooks are in the same `hooks/` directory. No change needed for imports.

## Skill Evolution — Persistent Data

`evolutions.json` stores skill evolution state. This file gets WRITTEN at task completion and READ before next skill invocation. It MUST persist across plugin updates.

**Problem**: `${CLAUDE_PLUGIN_ROOT}` points to the plugin cache which is wiped on plugin update. Writing `evolutions.json` there means losing evolution state on every update.

**Solution**: Use `${CLAUDE_PLUGIN_DATA}` — the persistent data directory for plugin state. This survives plugin updates.

```
${CLAUDE_PLUGIN_DATA}/evolutions.json    # Persists across updates
${CLAUDE_PLUGIN_DATA}/skill-state.json   # Any other persistent plugin state
```

Phase files and skill instructions that reference evolutions.json use `${CLAUDE_PLUGIN_DATA}/evolutions.json` instead of a path relative to the skill directory.

## taskplex-core Extraction

The plugin structure naturally creates the `taskplex-core` package from the multi-runtime plan:

```
taskplex-plugin/skills/workflow/references/
  = taskplex-core/

Contains:
  phases/     — workflow phase instructions
  contracts/  — policy, gates, schemas, handoffs
```

Plus `taskplex-plugin/agents/` = core agent definitions.

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

Memplex is NOT bundled — separate product, separate install. TaskPlex detects availability at runtime.
OfficeCLI is NOT bundled — companion skill, install separately.

## Migration Path for Existing Users

### Automated detection

Add a check to the `tp-session-start` hook: on SessionStart, scan for old `~/.claude/hooks/tp-*.mjs` files. If found alongside plugin installation, emit a warning:

```
WARNING: TaskPlex manual installation detected alongside plugin.
Old hooks in ~/.claude/hooks/ will fire IN ADDITION to plugin hooks, causing double execution.
Remove old files: ~/.claude/hooks/tp-*.mjs, hook-utils.mjs, start-task-sentinel.mjs
Remove hook entries from ~/.claude/settings.json
See migration guide: {URL}
```

### Manual migration steps

1. Install the plugin: `claude plugin install taskplex@jasnaidu-sa`
2. Remove old files from `~/.claude/`:
   - Delete `~/.claude/hooks/tp-*.mjs`, `hook-utils.mjs`, `start-task-sentinel.mjs`
   - Delete `~/.claude/taskplex/` directory
   - Delete `~/.claude/agents/core/` and `~/.claude/agents/utility/` (TaskPlex agents only — preserve user's custom agents)
   - Delete `~/.claude/commands/taskplex.md`, `tp.md`, `plan.md`, `solidify.md`, `drift.md`
   - Delete `~/.claude/skills/evaluate/`, `frontend/`, `plan/`
3. Remove TaskPlex hook entries from `~/.claude/settings.json` (plugin's `hooks.json` replaces them)
4. Copy `~/.claude/taskplex/evolutions.json` (if exists) to the plugin data directory
5. Commands change from `/tp` to `/taskplex:tp`

### Rollback procedure

If the plugin breaks mid-task:
1. `claude plugin disable taskplex` — disables plugin without removing it
2. Restore manual installation from backup (the `taskplex` design repo has a `backup/` directory with all files)
3. Re-add hook entries to `~/.claude/settings.json`

**Backward compatibility**: Existing `.claude-task/` directories and manifests are unaffected — they're project-level, not plugin-level. Active tasks continue to work. Hooks use `process.cwd()` to find `.claude-task/`, not plugin-relative paths.

## Acceptance Criteria

- AC-1: Plugin installs via `claude plugin install taskplex@marketplace`
- AC-2: `/taskplex:tp`, `/taskplex:plan`, `/taskplex:drift`, `/taskplex:solidify`, `/taskplex:evaluate` skills work
- AC-3: All 9 hooks fire correctly from plugin cache location (design gate blocks, heartbeat tracks, pre-commit blocks)
- AC-4: All 23 agents are registered and spawnable by name
- AC-5: All companion skills (evaluate, frontend, plan) available and testable
- AC-6: Phase files readable from `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/`
- AC-7: Hook `.mjs` files find and import `hook-utils.mjs` correctly via relative paths from cache
- AC-8: Existing `.claude-task/` manifests and task artifacts continue to work (hooks use `process.cwd()`)
- AC-9: Plugin hooks coexist with user's existing non-TaskPlex hooks (no clobber)
- AC-10: No hardcoded `~/.claude/` paths remain in any hook output message or skill instruction
- AC-11: Playwright MCP activates when plugin is enabled (optional, via .mcp.json)
- AC-12: Plugin version tracked in plugin.json, updates work via `claude plugin update`
- AC-13: `evolutions.json` stored in `${CLAUDE_PLUGIN_DATA}`, survives plugin updates
- AC-14: Migration detection warns when old manual files coexist with plugin
- AC-15: Plugin works correctly on Windows (mixed path separators handled)
- AC-16: Error messages from gates include resolved path for debugging (not just "file not found")

## Test Plan

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1 | Fresh install | `claude plugin install taskplex@marketplace` | Plugin listed in `/plugin list` |
| 2 | Skills available | `/help` | Shows `/taskplex:tp`, `/taskplex:plan`, etc. No `/taskplex:taskplex` |
| 3 | Start task | `/taskplex:tp add user auth` | Manifest created, design phase begins |
| 4 | Design gate fires | Write source file before design complete | Blocked with path-agnostic message |
| 5 | Spec gate fires | Write source file with no spec.md | Blocked: "No spec.md found" |
| 6 | Critic gate fires | Write source file with no review artifacts | Blocked: "No critic review artifacts" |
| 7 | Heartbeat fires | Edit a file during implementation | `progress.md` updated, observations logged |
| 8 | Pre-commit fires | `git commit` without validation | Blocked with validation message |
| 9 | Agent spawn | Blueprint route spawns architect by name | Architect agent runs, returns output |
| 10 | Phase file reads | Orchestrator reads init.md via `${CLAUDE_PLUGIN_ROOT}` | Phase instructions loaded correctly |
| 11 | Frontend skill | Frontend work triggers frontend skill | Skill activates, provides guidance |
| 12 | Evaluate skill | `/taskplex:evaluate` | Audit/review modes available |
| 13 | Plan skill | `/taskplex:plan redesign API` | Strategic planning flow begins |
| 14 | Existing task resume | Start Claude Code with existing `.claude-task/` | Session-start hook detects task |
| 15 | Coexistence | User has custom (non-TaskPlex) hooks in settings.json | Both plugin hooks and user hooks fire |
| 16 | Migration detection | Old `~/.claude/hooks/tp-*.mjs` files present | Warning emitted about dual registration |
| 17 | Uninstall | `/plugin uninstall taskplex` | Plugin removed, user files intact |
| 18 | Dev mode | `claude --plugin-dir ./taskplex-plugin` | Plugin loads from local directory |
| 19 | Cache execution | Hooks run from `~/.claude/plugins/cache/` | `import.meta.url` resolves correctly |
| 20 | Windows paths | Run full task on Windows | No mixed separator errors |
| 21 | Plugin update | Bump version, update | evolutions.json preserved in `${CLAUDE_PLUGIN_DATA}` |
| 22 | Rollback | `claude plugin disable taskplex`, restore manual | Manual installation works again |
| 23 | No hardcoded paths | Grep all plugin files for `~/.claude/` | Zero matches outside README |

## Implementation Phases

### Phase 1: Create plugin structure (half day)
- Create directory structure per layout above
- Create `plugin.json` manifest
- Copy all files from `~/.claude/` into plugin directories
- Flatten agents from `core/` + `utility/` into single `agents/` directory
- Merge `taskplex.md` + `tp.md` into `skills/tp/SKILL.md`
- Convert `plan.md`, `solidify.md`, `drift.md` commands into skills
- Move phase files and contracts into `skills/workflow/references/`

### Phase 2: Path reference audit (half day)
- Replace all `~/.claude/taskplex/` with `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/` in phase files
- Replace all `~/.claude/agents/core/` and `~/.claude/agents/utility/` with agent-name-only references
- Audit every `.mjs` hook file for hardcoded `~/.claude/` in output messages — make path-agnostic
- Replace evolutions.json references with `${CLAUDE_PLUGIN_DATA}/evolutions.json`
- Run test 23 (grep for remaining `~/.claude/` references)

### Phase 3: hooks.json + migration detection (2-3 hours)
- Create `hooks/hooks.json` with `${CLAUDE_PLUGIN_ROOT}` paths
- Add migration coexistence check to `tp-session-start.mjs`
- Test each hook fires correctly from cache location

### Phase 4: Test end-to-end (half day)
- Run `claude --plugin-dir ./taskplex-plugin`
- Execute full Light route task (test 3)
- Execute Standard route task with gates (tests 4-8)
- Verify agent spawning by name (test 9)
- Verify skill activation (tests 11-13)
- Run on Windows specifically (test 20)

### Phase 5: GitHub marketplace + README (2-3 hours)
- Create `taskplex-plugin` repo (separate from design repo)
- Push plugin structure
- Write installation README with migration guide
- Test: `claude plugin install taskplex@jasnaidu-sa`

### Phase 6: Official Anthropic marketplace submission
- Submit via claude.ai/settings/plugins/submit
- Documentation, screenshots, description
- Review process (1-2 days)

## Resolved Questions (from critic review)

1. **Plugin name**: `taskplex` — clarity for marketplace discovery. Commands are `/taskplex:tp`, `/taskplex:plan`, etc.

2. **Hook command paths**: `${CLAUDE_PLUGIN_ROOT}` — confirmed as the official variable.

3. **Single repo or separate repo?** Separate — marketplace needs clean root with `.claude-plugin/` at top level. Design docs stay in `jasnaidu-sa/taskplex`.

4. **Keep standalone mode?** Yes — documented as alternative for development. Plugin is primary path.

5. **Companion skills**: Bundled in v1 (evaluate, frontend, plan). Split later if size is an issue.

6. **Version strategy**: Semver. Start at 1.0.0.

7. **`$TASKPLEX_HOME`**: Dropped. Use `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/` directly.

8. **`commands/` directory**: Dropped. All entry points are skills per plugin docs guidance.

9. **`/taskplex:taskplex` redundancy**: Eliminated. Primary command is `/taskplex:tp`.

10. **`evolutions.json` persistence**: `${CLAUDE_PLUGIN_DATA}` — survives plugin updates.

11. **Migration safety**: SessionStart hook detects old files, warns about dual registration.

12. **Rollback**: Documented procedure using `plugin disable` + backup restoration.
