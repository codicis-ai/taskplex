# PRD: TaskPlex Cursor 3 Plugin

> **Status**: Ready to build
> **Priority**: High — largest AI coding agent user base, most capable platform
> **Scope**: Adapt Claude Code plugin for Cursor 3 plugin format
> **Estimated effort**: 2-3 days
> **Dependencies**: Claude Code plugin complete (`plugin/` directory in codicis-ai/taskplex)
> **Repo**: `codicis-ai/taskplex` — `cursor-plugin/` directory (parallel to `plugin/`)

## Problem Statement

TaskPlex's Claude Code plugin is built. Cursor 3 is the highest-priority distribution target (largest user base, async subagents, native /worktree, marketplace). The plugin system is structurally similar to Claude Code's — same concepts (skills, agents, hooks, MCP, rules) — but the hook system is fundamentally different, requiring adaptation of the enforcement layer.

## Goal

Package TaskPlex as a Cursor 3 plugin that installs from the Cursor Marketplace and provides `/taskplex:tp`, `/taskplex:plan`, `/taskplex:drift`, `/taskplex:solidify`, `/taskplex:evaluate` with the same governance workflow as the Claude Code version.

## Key Differences: Cursor vs Claude Code

### Hook Events

| TaskPlex Hook | Claude Code Event | Cursor Event | Impact |
|---|---|---|---|
| Design gate | `PreToolUse` (Edit\|Write) — blocks | No `beforeFileEdit` event | **Critical** — must use rules + skill logic |
| Heartbeat | `PostToolUse` (Edit\|Write) | `afterFileEdit` | Direct match — observation + progress |
| Pre-commit | `PreToolUse` (Bash) — blocks | `beforeShellExecution` — blocks | Direct match — different JSON format |
| Prompt check | `UserPromptSubmit` — injects context | `beforeSubmitPrompt` — informational only | **No injection** — use `.mdc` rules |
| Session start | `SessionStart` | None | **Missing** — use rules + manual resume |
| Pre-compact | `PreCompact` | None | **Missing** — rely on manifest persistence |
| Stop | `Stop` | `stop` | Direct match |
| Sentinel | `PostToolUse` (Read\|Bash\|etc) | None | **Missing** — drop (low value) |

### Hook I/O Format

| Aspect | Claude Code | Cursor |
|--------|-----------|--------|
| **Stdin** | `{ tool_name, tool_input, cwd }` | `{ hook_event_name, conversation_id, generation_id, workspace_roots, ... }` |
| **Blocking** | stdout JSON `{ permissionDecision: "deny", ... }` | stdout JSON `{ permission: "deny", ... }` or exit code 2 |
| **Context injection** | `additionalContext` field in stdout | `agentMessage` field (blocking hooks only) |
| **Matchers** | `matcher` field filters by tool name | No matchers — all hooks fire for their event |

### Other Differences

| Aspect | Claude Code | Cursor |
|--------|-----------|--------|
| Agent directory | `agents/` | `subagents/` |
| Rules | None in plugin format | `rules/*.mdc` (always injected into prompts) |
| Plugin manifest | `.claude-plugin/plugin.json` | `.cursor-plugin/plugin.json` |
| Local testing | `claude --plugin-dir ./path` | Symlink to `~/.cursor/plugins/` |
| Path variables | `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` | TBD — verify during implementation |

## Enforcement Strategy

### Design Gate (Critical — Different Approach)

Claude Code: Hook blocks file edits before design completes.
Cursor: No `beforeFileEdit` hook exists.

**Cursor approach — three layers**:

1. **`.mdc` rule** (always injected): `taskplex-design-gate.mdc` instructs the agent to check for spec.md, review artifacts, and architecture.md before any source edit. Weaker than a hook but present in every prompt.

2. **Skill logic**: The `/taskplex:tp` SKILL.md orchestrator controls when subagents are spawned. Implementation subagents are only spawned after design artifacts exist. The orchestrator IS the gate — it doesn't delegate until ready.

3. **`afterFileEdit` detection**: If a source file is edited before design completes, the heartbeat hook detects it and writes a warning. Can't block but can alert.

**Combined effect**: The agent would need to ignore the always-on rule, bypass the skill's spawn logic, AND ignore post-edit warnings to skip design. Not as strong as Claude Code's hard block, but three independent checks.

### Artifact-Based Gates (Spec, Critic, Blueprint)

These work identically to Claude Code — the skill orchestrator checks for file existence before proceeding. No hook dependency. The spec gate, critic gate, and blueprint artifact gate are all logic in the SKILL.md, not in hooks.

### Pre-Commit Gate

`beforeShellExecution` can detect `git commit` commands and block with `permission: "deny"`. Functionally identical to Claude Code. Different JSON format.

### Prompt Context Injection

Claude Code: `tp-prompt-check` hook injects workflow context.
Cursor: `beforeSubmitPrompt` is informational only.

**Cursor approach**: `.mdc` rules provide the same context:
- `taskplex-workflow.mdc` — always-on workflow governance rules
- `taskplex-conventions.mdc` — convention enforcement

Rules are injected into every prompt automatically. No hook needed.

### Session Recovery

Claude Code: `tp-session-start` hook detects active tasks on resume.
Cursor: No session lifecycle hooks.

**Cursor approach**:
- `taskplex-resume.mdc` rule: "On session start, check for `.claude-task/*/manifest.json` with `status: in-progress`. If found, resume the active task."
- Manual: `/taskplex:resume` skill for explicit recovery.

## Plugin Structure

```
cursor-plugin/
├── .cursor-plugin/
│   └── plugin.json
├── skills/
│   ├── tp/
│   │   └── SKILL.md                    # Primary workflow entry point
│   ├── plan/
│   │   └── SKILL.md                    # Strategic planning
│   ├── drift/
│   │   └── SKILL.md                    # Drift detection
│   ├── solidify/
│   │   └── SKILL.md                    # Merge skill evolutions
│   ├── evaluate/
│   │   ├── SKILL.md
│   │   ├── modes/
│   │   ├── references/
│   │   └── templates/
│   ├── frontend/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── templates/
│   ├── resume/
│   │   └── SKILL.md                    # Session recovery (Cursor-specific)
│   └── workflow/
│       ├── SKILL.md
│       └── references/
│           ├── phases/                  # Shared with Claude Code (taskplex-core)
│           │   ├── init.md
│           │   ├── planning.md
│           │   ├── qa.md
│           │   ├── validation.md
│           │   ├── bootstrap.md
│           │   └── prd.md
│           └── contracts/               # Shared with Claude Code (taskplex-core)
│               ├── policy.json
│               ├── gates.md
│               ├── artifact-contract.md
│               ├── manifest-schema.json
│               ├── handoff-contract.md
│               ├── hardening-checks.md
│               ├── portability.md
│               └── skill-evolution.md
├── subagents/                           # Cursor naming (was agents/ in Claude Code)
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
├── rules/
│   ├── taskplex-design-gate.mdc        # Soft design enforcement (always-on)
│   ├── taskplex-workflow.mdc           # Workflow governance + phase reminder
│   ├── taskplex-conventions.mdc        # Convention enforcement
│   └── taskplex-resume.mdc            # Session recovery detection
├── hooks/
│   ├── hooks.json                       # 3 hooks (heartbeat, pre-commit, stop)
│   ├── hook-utils.mjs                   # Adapted for Cursor stdin format
│   ├── tp-heartbeat.mjs                # afterFileEdit → observation + progress
│   ├── tp-pre-commit.mjs               # beforeShellExecution → block git commit
│   └── tp-stop.mjs                     # stop → warn on incomplete validation
├── mcp.json                            # Playwright MCP
└── README.md
```

## Plugin Manifest

```json
{
  "name": "taskplex",
  "displayName": "TaskPlex",
  "version": "1.0.0",
  "description": "Structured workflow orchestration — design-first development with quality gates, adversarial verification, and multi-agent coordination.",
  "author": {
    "name": "Codicis AI"
  },
  "keywords": [
    "workflow", "orchestration", "governance", "multi-agent",
    "quality-gates", "verification", "design-first"
  ],
  "license": "UNLICENSED"
}
```

## hooks.json (Cursor Format)

```json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [
      {
        "command": "node hooks/tp-heartbeat.mjs"
      }
    ],
    "beforeShellExecution": [
      {
        "command": "node hooks/tp-pre-commit.mjs"
      }
    ],
    "stop": [
      {
        "command": "node hooks/tp-stop.mjs"
      }
    ]
  }
}
```

3 hooks instead of Claude Code's 9. The other 6 are replaced by `.mdc` rules and skill logic.

## .mdc Rules

### taskplex-design-gate.mdc

```markdown
---
description: TaskPlex design enforcement. Prevents source edits before design phase completes.
globs: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.rs", "**/*.py", "**/*.go", "**/*.java", "**/*.rb", "**/*.vue", "**/*.svelte", "**/*.css", "**/*.scss", "**/*.sql"]
alwaysApply: true
---

BEFORE editing any source file, you MUST verify ALL of the following:

1. A `.claude-task/` directory exists with a `manifest.json` where `phase` is `implementation` or later
2. A `spec.md` file exists in the task directory (Standard/Blueprint routes)
3. Review artifacts exist in the `reviews/` subdirectory (Standard/Blueprint routes)
4. For Blueprint: `architecture.md` and `file-ownership.json` exist in the task directory

If ANY check fails: DO NOT edit the file. Inform the user that the TaskPlex design phase must complete first. This is a governance requirement — not a suggestion.

If no `.claude-task/` directory exists (no active TaskPlex task), this rule does not apply.
```

### taskplex-workflow.mdc

```markdown
---
description: TaskPlex workflow governance. Ensures structured phase progression.
alwaysApply: true
---

When running a TaskPlex task (/taskplex:tp):

EXECUTION CONTINUITY: After the user approves the plan, run to completion. Do NOT stop to ask "should I continue?" between agent dispatches.

ARTIFACT REQUIREMENTS:
- spec.md must exist before implementation
- Review artifacts must exist before implementation (Standard/Blueprint)
- architecture.md + file-ownership.json must exist before implementation (Blueprint)
- validation-gate.json must exist before git commit

PHASE PROGRESSION: init → design → planning → implementation → QA → validation → completion. Do not skip phases.
```

### taskplex-resume.mdc

```markdown
---
description: TaskPlex session recovery. Detects active tasks on session start.
alwaysApply: true
---

At the start of every session, check for `.claude-task/*/manifest.json` files with `status: "in-progress"`. If found:

1. Read the manifest to determine current phase
2. Read `progress.md` in the task directory for context
3. Inform the user: "Found active TaskPlex task: {description}. Phase: {phase}. Resume or start fresh?"
4. If resuming, continue from the current phase using the manifest state
```

## hook-utils.mjs Adaptation

The shared utility needs a Cursor-compatible stdin parser:

```javascript
// Cursor stdin format:
// { hook_event_name, conversation_id, generation_id, workspace_roots, ... }
//
// Claude Code stdin format:
// { tool_name, tool_input, cwd, ... }

export async function parseStdin() {
  const input = await readStdin();
  try {
    if (input.trim()) return JSON.parse(input);
  } catch { /* ignore */ }
  return {};
}

// Normalize across runtimes
export function normalizeCwd(hookInput) {
  // Cursor provides workspace_roots array
  if (hookInput.workspace_roots && hookInput.workspace_roots.length > 0) {
    return hookInput.workspace_roots[0];
  }
  // Claude Code provides cwd
  return hookInput.cwd || process.cwd();
}
```

## tp-heartbeat.mjs Adaptation

Cursor's `afterFileEdit` provides:
```json
{
  "hook_event_name": "afterFileEdit",
  "conversation_id": "...",
  "generation_id": "...",
  "workspace_roots": ["/path/to/project"],
  "file_path": "/path/to/edited/file.ts",
  "diff": "..."
}
```

The heartbeat reads `file_path` instead of `tool_input.file_path`. Core logic (manifest update, observation log, scope checks, guardian triggers) stays identical.

## tp-pre-commit.mjs Adaptation

Cursor's `beforeShellExecution` provides:
```json
{
  "hook_event_name": "beforeShellExecution",
  "conversation_id": "...",
  "command": "git commit -m 'feat: add auth'",
  "workspace_roots": ["/path/to/project"]
}
```

**Blocking output**:
```json
{
  "permission": "deny",
  "agentMessage": "TaskPlex pre-commit: Commit blocked — validation has not passed."
}
```

Or simply exit with code 2 (simplest blocking mechanism in Cursor).

## Shared Core (taskplex-core)

The `skills/workflow/references/` directory is **identical** between Claude Code and Cursor plugins:

```
skills/workflow/references/
├── phases/          # init.md, planning.md, qa.md, validation.md, bootstrap.md, prd.md
└── contracts/       # policy.json, gates.md, manifest-schema.json, etc.
```

These files use `${CLAUDE_PLUGIN_ROOT}` paths in the Claude Code version. For Cursor, determine the equivalent variable (likely relative paths from the skill directory, or a Cursor-specific variable). If no variable exists, use relative paths from the SKILL.md location.

**Implementation**: Copy from `plugin/skills/workflow/references/` with path variable replacement. If Cursor has no path variable equivalent, use relative references in SKILL.md (e.g., "Read the file `references/phases/init.md` in this skill's directory").

## Subagent Definitions

Rename `agents/` to `subagents/`. Content is identical — Cursor subagents use the same markdown format with frontmatter (name, model, tools).

Cursor subagents have additional capabilities:
- **Async by default** — don't block the parent
- **Own context + model** — can specify different models per subagent
- `SubagentStart` / `SubagentStop` lifecycle hooks available

This naturally supports TaskPlex's Blueprint route (parallel multi-agent execution).

## Resume Skill (Cursor-Specific)

Since Cursor has no `SessionStart` hook, add a `/taskplex:resume` skill:

```markdown
---
name: resume
description: Resume an in-progress TaskPlex task. Detects active tasks and recovers context.
---

# TaskPlex Resume

Check for active TaskPlex tasks and resume from where you left off.

1. Scan for `.claude-task/*/manifest.json` files with `status: "in-progress"`
2. If multiple found: present list, ask user which to resume
3. Read the manifest for current phase, modified files, progress
4. Read `progress.md` for task narrative
5. Continue from the current phase
```

## Acceptance Criteria

- AC-1: Plugin installs from Cursor Marketplace
- AC-2: `/taskplex:tp`, `/taskplex:plan`, `/taskplex:drift`, `/taskplex:solidify`, `/taskplex:evaluate` skills work
- AC-3: All 23 subagents are registered and spawnable
- AC-4: `afterFileEdit` hook fires and updates manifest + observation log
- AC-5: `beforeShellExecution` hook blocks `git commit` without validation
- AC-6: `stop` hook warns on incomplete validation
- AC-7: `.mdc` design gate rule prevents source edits before design complete (soft enforcement)
- AC-8: `.mdc` workflow rule injects governance context into every prompt
- AC-9: `.mdc` resume rule detects active tasks on session start
- AC-10: `/taskplex:resume` skill recovers active task context
- AC-11: Phase files readable from skill references directory
- AC-12: Existing `.claude-task/` manifests work (same format as Claude Code)
- AC-13: Playwright MCP activates via mcp.json
- AC-14: Subagents spawn asynchronously for Blueprint parallel execution
- AC-15: Plugin coexists with user's existing hooks and rules
- AC-16: Works on Windows (path separator handling)

## Test Plan

| # | Test | Expected |
|---|------|----------|
| 1 | Install from marketplace | Plugin appears in Cursor plugin list |
| 2 | `/taskplex:tp add auth` | Manifest created, design phase begins |
| 3 | Edit source before design | `.mdc` rule prevents edit (agent refuses) |
| 4 | Heartbeat fires | `afterFileEdit` → manifest updated, observations logged |
| 5 | `git commit` without validation | `beforeShellExecution` blocks with deny |
| 6 | Blueprint spawns subagents | Async subagents run in parallel |
| 7 | Spec gate in skill | Skill orchestrator won't spawn workers without spec.md |
| 8 | Critic gate in skill | Skill orchestrator won't spawn workers without review artifacts |
| 9 | Task stop | `stop` hook warns about incomplete validation |
| 10 | Session resume (rule) | New session detects active task via `.mdc` rule |
| 11 | Session resume (skill) | `/taskplex:resume` recovers context manually |
| 12 | Phase file reads | Orchestrator reads init.md from skill references |
| 13 | Subagent definitions | All 23 subagents listed in `/subagents` |
| 14 | Coexistence | User rules + TaskPlex rules both active |
| 15 | Windows paths | Full task on Windows, no path errors |

## Implementation Phases

### Phase 1: Structure + manifest (2 hours)
- Create `cursor-plugin/` directory in `codicis-ai/taskplex`
- Create `.cursor-plugin/plugin.json`
- Copy `subagents/` from `plugin/agents/` (rename directory)
- Copy `skills/` from `plugin/skills/` (identical)
- Copy `mcp.json` from `plugin/.mcp.json`

### Phase 2: Rules (2 hours)
- Write `taskplex-design-gate.mdc`
- Write `taskplex-workflow.mdc`
- Write `taskplex-conventions.mdc`
- Write `taskplex-resume.mdc`
- Create `skills/resume/SKILL.md`

### Phase 3: Hook adaptation (half day)
- Create Cursor-format `hooks.json` (3 events)
- Adapt `hook-utils.mjs` for Cursor stdin format (`workspace_roots` vs `cwd`, `file_path` field)
- Adapt `tp-heartbeat.mjs` for `afterFileEdit` input format
- Adapt `tp-pre-commit.mjs` for `beforeShellExecution` input/output format (`permission: "deny"` or exit code 2)
- Adapt `tp-stop.mjs` for Cursor `stop` format
- Syntax check all hooks

### Phase 4: Path references (2 hours)
- Determine Cursor's equivalent of `${CLAUDE_PLUGIN_ROOT}` for skill reference paths
- If no variable: use relative paths from SKILL.md location
- Update all phase files and contracts with correct paths
- Verify no hardcoded `~/.claude/` or `${CLAUDE_PLUGIN_ROOT}` references remain

### Phase 5: Test end-to-end (half day)
- Symlink to `~/.cursor/plugins/taskplex`
- Run Light route task
- Run Standard route task (verify skill-level artifact gates)
- Verify subagent spawning
- Verify `.mdc` rules active in prompts
- Test on Windows

### Phase 6: Marketplace submission
- Push to `codicis-ai/taskplex` under `cursor-plugin/`
- Submit to Cursor Marketplace
- README with installation + migration guide

## Enforcement Comparison

| Gate | Claude Code | Cursor | Strength |
|------|-----------|--------|----------|
| Spec exists | Hook (hard block) | Skill logic (hard — won't spawn without spec) | Equal |
| Critic review | Hook (hard block) | Skill logic (hard — won't spawn without reviews) | Equal |
| Blueprint artifacts | Hook (hard block) | Skill logic (hard — won't spawn without arch + ownership) | Equal |
| Design-phase edits | Hook (hard block on every Edit/Write) | Rule (soft — in every prompt but agent can ignore) | **Weaker** |
| Pre-commit | Hook (hard block) | Hook (hard block via beforeShellExecution) | Equal |
| Execution continuity | Advisory (heartbeat reminder) | Rule (always-on .mdc) | **Stronger** (rules are always present) |
| Session recovery | Hook (SessionStart) | Rule + manual skill | **Weaker** |

**Net assessment**: Most gates are equally strong because they're artifact-based (skill logic, not hooks). The design-phase edit gate is weaker in Cursor (rule vs hook). Session recovery is weaker. Execution continuity is actually stronger (rules vs advisory heartbeat).

## Open Questions

1. **Cursor path variable**: Does Cursor have an equivalent to `${CLAUDE_PLUGIN_ROOT}`? If not, how do skills reference their own `references/` directory? Likely relative paths, but needs verification.

2. **Cursor plugin data persistence**: Does Cursor have `${CLAUDE_PLUGIN_DATA}` equivalent for evolutions.json? If not, write to `.claude-task/` (project-level) or `~/.cursor/data/taskplex/`.

3. **Subagent definition format**: Are Cursor subagent `.md` files identical to Claude Code agent `.md` files (frontmatter + instructions)? Likely yes based on docs, but needs verification.

4. **`.mdc` rule enforcement**: How reliably do Cursor agents follow `.mdc` rules? If compliance is low, the design gate is effectively non-existent. Need real-world testing data.

5. **Hook `afterFileEdit` context**: Does it include the full file path, the diff, or just the file name? The heartbeat needs the file path for scope/ownership checks.
