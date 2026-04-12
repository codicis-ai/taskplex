---
name: tp
description: TaskPlex pipeline — the single entry point for building something end-to-end. Runs design, planning, implementation, QA, validation, and completion as a governed workflow with quality gates. Flags select the execution route (--light, --standard, --blueprint) and let you hydrate from an existing plan (--plan) or skip straight to execution (--skip-design). Use whenever the user wants to build, implement, or ship a feature, fix, or change — "build X", "implement Y", "add this feature", "fix this bug", "ship this".
---

# /tp — TaskPlex Pipeline

**Command**: `/tp [flags] [task description]`

Single entry point for all development tasks. Invokes the `tp` pipeline engine which manages design, planning, implementation, QA, validation, and completion deterministically.

## Flags

**Route** (passed to `tp pipeline`):
- `--standard` — Full design, foundation-first workers *(default)*
- `--blueprint` — Explore pre-pass, conditional architect, full feature decomposition
- `--light` — Minimal design, single worker, basic QA

**Modifiers:**
- `--plan <path>` — Hydrate from an existing planning document (PRD, brief, spec)
- `--skip-design` — Skip design phase, go straight to execution

## Examples

```
/tp add user authentication               # standard route, full design
/tp --light fix the login button           # light route
/tp --plan product/billing-prd.md          # hydrate from existing PRD
/tp --blueprint redesign the data pipeline # full architect + feature decomposition
```

---

## EXECUTION PROTOCOL

When this skill is invoked, you MUST run the `tp` pipeline engine. Do NOT orchestrate the workflow yourself — tp handles all phases, agent spawning, artifact checking, and progress display.

### Step 1: Parse the invocation

Extract from the user's message:
- **Task description** — what they want to build/fix/change
- **Route** — standard (default), blueprint, or light
- **Plan file** — if they reference an existing document (PRD, brief, spec)
- **Project root** — the current working directory

### Step 2: Build and run the tp command

The tp binary and all runtime files are bundled with this plugin at `${CLAUDE_PLUGIN_ROOT}/bin/`.

Construct the command based on parsed flags. The binary is at `${CLAUDE_PLUGIN_ROOT}/bin/tp.exe` (Windows) or `${CLAUDE_PLUGIN_ROOT}/bin/tp` (Linux/Mac):

```bash
TP_BIN="${CLAUDE_PLUGIN_ROOT}/bin/tp.exe"  # or tp on Linux/Mac
TP_DIR="${CLAUDE_PLUGIN_ROOT}/bin"

"$TP_BIN" pipeline "<task description>" \
  --task-dir "$(pwd)" \
  --workflow "$TP_DIR/workflows/design.yaml" \
  [--plan <path>] \
  [--task-id <id>]
```

**Workflow selection:**
- For a fresh task (no existing artifacts): `--workflow "$TP_DIR/workflows/design.yaml"`
- For execution only (artifacts already exist): `--workflow "$TP_DIR/workflows/execution.yaml"`
- For light route: `--workflow "$TP_DIR/workflows/light.yaml"`
- The hydrate phase auto-detects and skips satisfied design steps

**Run it via Bash.** The tp binary streams progress to stdout — the user sees the kanban board, step transitions, and completion status in real time. Do NOT capture or suppress the output.

If the binary is not found at the expected path, tell the user:
```
tp binary not found at ${CLAUDE_PLUGIN_ROOT}/bin/tp. 
Rebuild with: cd /path/to/tp && go build -o /path/to/taskplex/bin/tp ./cmd/tp/
```

### Step 4: Monitor and report

After tp completes:
- If **success**: report the task summary from `.taskplex/{taskId}/task-summary.md`
- If **failure**: read the pipeline state from `.taskplex/{taskId}/pipeline-state.json`, identify which step failed, and report the error
- If tp needs **user input** during design (route selection, quality profile, plan approval): tp's design steps handle this through their own interaction modes

### Example command construction

Set the base paths first:
```bash
TP_BIN="${CLAUDE_PLUGIN_ROOT}/bin/tp.exe"
TP_DIR="${CLAUDE_PLUGIN_ROOT}/bin"
```

User says: `/tp implement the billing dashboard`
```bash
"$TP_BIN" pipeline "implement the billing dashboard" \
  --task-dir "$(pwd)" \
  --workflow "$TP_DIR/workflows/design.yaml"
```

User says: `/tp --plan product/phase2-prd.md implement P1 remote meeting transcripts`
```bash
"$TP_BIN" pipeline "implement P1 remote meeting transcripts" \
  --task-dir "$(pwd)" \
  --workflow "$TP_DIR/workflows/design.yaml" \
  --plan product/phase2-prd.md
```

User says: `/tp --light fix the login button`
```bash
"$TP_BIN" pipeline "fix the login button" \
  --task-dir "$(pwd)" \
  --workflow "$TP_DIR/workflows/light.yaml"
```

---

## WHAT tp HANDLES (you do NOT do these)

- Task directory creation (`.taskplex/{taskId}/`)
- Manifest creation and flag management
- Project type and build command detection
- Convention scanning
- Context gathering and user interaction (design steps)
- Success contract and spec writing
- Foundation-first worker decomposition
- Parallel agent spawning in isolated sessions
- Artifact checking between steps
- QA (smoke, journey, adversarial)
- Validation (security, closure, code review, hardening, compliance)
- Git commit and PR creation
- Progress display (kanban board, step transitions)

## WHAT YOU DO

- Parse the user's invocation to extract flags and description
- Construct and run the `tp pipeline` command
- Report results after completion
- Handle the case where tp is not installed

## ANTI-PATTERNS

1. **NEVER orchestrate the workflow yourself** — no reading phase files, no creating manifests, no spawning agents manually. tp does all of this.
2. **NEVER create `.claude-task/` directories** — tp uses `.taskplex/` and creates it automatically.
3. **NEVER write manifest.json, brief.md, spec.md yourself** — tp's workflow steps handle artifact creation.
4. **NEVER ask design questions yourself** — tp's design workflow handles user interaction through its own steps.
5. **NEVER skip running tp and try to "do it faster"** — the deterministic pipeline is the point.
