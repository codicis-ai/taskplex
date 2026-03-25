# TaskPlex Pi Plugin — Design & Build Specification

*Source of truth: `~/.claude/taskplex/portability.md` (adapter checklist), pi extension/skills/SDK docs*

---

## Overview

TaskPlex is a structured multi-phase development workflow originally built for Claude Code.
This document defines how to port it to pi as a self-contained pi package, using pi's
native extension, skills, and prompt template systems — no forks, no core modifications.

The portability guide in `~/.claude/taskplex/portability.md` separates TaskPlex into:
- **Core workflow** (agent-agnostic): phase system, gates, artifact contract, quality profiles
- **Adapter layer** (runtime-specific): hooks, agent spawning, model selection, user prompts

This plugin implements the adapter layer for pi. All core workflow documents (phase files,
gate catalog, artifact contract, policy.json) are copied as-is into the plugin's skill
reference directory.

---

## Pi Primitive Mapping

| TaskPlex (Claude Code) | Pi Primitive | Notes |
|---|---|---|
| `/taskplex` slash command | Prompt template (`prompts/taskplex.md`) | Expands to the full orchestration briefing |
| `/tp` alias | Prompt template (`prompts/tp.md`) | Same, shorter trigger |
| Phase files (init, planning, etc.) | Skill reference files | Agent reads them on-demand |
| `SessionStart` hook | `pi.on("session_start")` | Detects in-progress tasks, injects recovery context |
| `PreToolUse (Edit/Write)` hook | `pi.on("tool_call")` — intercept edit/write | Design gate enforcement |
| `PostToolUse (Edit/Write)` hook | `pi.on("tool_result")` — on edit/write result | Heartbeat: manifest update, progress render |
| `PreCompact` hook | `pi.on("session_before_compact")` | Checkpoint snapshot before context reset |
| `Stop` hook | `pi.on("session_shutdown")` | Warn on incomplete validation |
| `PreToolUse (git commit)` hook | `pi.on("tool_call")` — intercept bash | Block git commit if validation not passed |
| `AskUserQuestion` | `ctx.ui.select()` / `ctx.ui.input()` | Route selection, clarifying questions |
| Agent spawning (Team/Blueprint) | Pi subagent subprocess pattern | Spawn `pi --mode json -p --no-session` per agent |
| Model selection (Opus/Sonnet/Haiku) | `pi.setModel()` per agent process flag | `--model` flag on subagent spawn |
| `manifest.json` state | File on disk (same) | Extension reads/writes; survives compaction |
| Session file (viz bridge) | Omit (Claude Code-specific) | Not needed for pi |
| `CONVENTIONS.md` | `AGENTS.md` (pi equivalent) | Pi loads AGENTS.md; content maps 1:1 |

---

## Package Structure

```
taskplex-pi/
├── package.json                        # pi package manifest
│
├── extensions/
│   └── taskplex/
│       ├── index.ts                    # Entry point: registers command, tools, all hooks
│       ├── manifest.ts                 # Manifest read/write/find utilities
│       ├── subagent.ts                 # Agent spawning (Team + Blueprint routes)
│       └── hooks/
│           ├── session-start.ts        # Detect in-progress tasks, inject recovery context
│           ├── design-gate.ts          # Block artifact writes before design sub-phases
│           ├── heartbeat.ts            # Update manifest + render progress on every edit
│           ├── pre-compact.ts          # Checkpoint snapshot before compaction
│           ├── pre-commit.ts           # Block git commit without validation
│           └── stop.ts                 # Warn on incomplete validation at shutdown
│
├── skills/
│   ├── taskplex/
│   │   ├── SKILL.md                    # Main skill — triggers on /tp, /taskplex
│   │   └── phases/
│   │       ├── init.md                 # Copied from ~/.claude/taskplex/phases/init.md
│   │       ├── planning.md             # Copied from ~/.claude/taskplex/phases/planning.md
│   │       ├── qa.md                   # Copied from ~/.claude/taskplex/phases/qa.md
│   │       ├── validation.md           # Copied from ~/.claude/taskplex/phases/validation.md
│   │       └── bootstrap.md            # Copied from ~/.claude/taskplex/phases/bootstrap.md
│   │   └── refs/
│   │       ├── artifact-contract.md    # Copied from ~/.claude/taskplex/artifact-contract.md
│   │       ├── gates.md                # Copied from ~/.claude/taskplex/gates.md
│   │       ├── handoff-contract.md     # Copied from ~/.claude/taskplex/handoff-contract.md
│   │       ├── hardening-checks.md     # Copied from ~/.claude/taskplex/hardening-checks.md
│   │       ├── portability.md          # Copied from ~/.claude/taskplex/portability.md
│   │       └── policy.json             # Copied from ~/.claude/taskplex/policy.json
│   │   └── schemas/
│   │       └── manifest-schema.json    # Copied from ~/.claude/taskplex/manifest-schema.json
│   │
│   ├── plan/
│   │   └── SKILL.md                    # Adapted from ~/.claude/skills/plan/skill.md
│   │
│   └── evaluate/
│       ├── SKILL.md                    # Adapted from ~/.claude/skills/evaluate/skill.md
│       └── modes/
│           ├── audit.md
│           └── review.md
│
└── prompts/
    ├── taskplex.md                     # Full /taskplex prompt template
    └── tp.md                           # /tp alias template
```

---

## File Contents

### `package.json`

```json
{
  "name": "taskplex-pi",
  "version": "1.0.0",
  "description": "TaskPlex structured development workflow for pi",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions/taskplex"],
    "skills": ["./skills"],
    "prompts": ["./prompts"]
  }
}
```

---

### `prompts/taskplex.md`

This is the prompt template that expands when the user types `/taskplex`.
It is the exact equivalent of `~/.claude/commands/taskplex.md` but adapted
to reference pi skill paths instead of `~/.claude/` paths.

```markdown
# TaskPlex — Adaptive Workflow with Agent Orchestration

**Command**: `/taskplex [flags] [task description]`

## Flags

- `--standard` or `--full` — Full design, single implementation agent *(default)*
- `--team` or `--parallel` — Full design, multi-agent execution
- `--blueprint` or `--architect` — Opus architect + critics + multi-agent
- `--light` — Reduced design depth
- `--skip-design` — No design phase (logs degradation)
- `--plan PLAN-{id}` — Use existing plan file

## MANDATORY EXECUTION PROTOCOL

STOP. Read the initialization phase file FIRST:

Use the Read tool to load the skill file at the path shown in:
/skill:taskplex

The skill will tell you to read:
  taskplex/phases/init.md

Read it IN FULL. Then follow every step in order.

The TaskPlex hooks ARE ACTIVE in this pi session:
- design-gate: blocks Edit/Write before design sub-phases complete
- heartbeat: tracks every file edit in manifest
- pre-compact: saves state before context reset
- session-start: detects active tasks on resume

Do NOT write any source code until design is complete and approved.

[rest of the progress checklist and anti-patterns — identical to Claude Code version]
```

**Note:** Copy the full MANDATORY EXECUTION PROTOCOL, PROGRESS CHECKLIST, and
ANTI-PATTERNS sections from `~/.claude/commands/taskplex.md` verbatim.
Only change path references from `~/.claude/taskplex/phases/` to the pi skill
relative paths.

---

### `prompts/tp.md`

```markdown
# /tp — TaskPlex (alias)

Alias for `/taskplex`. Supports all the same flags.

## MANDATORY EXECUTION PROTOCOL

STOP. Your IMMEDIATE next action MUST be to load the taskplex skill:

/skill:taskplex

Then read: taskplex/phases/init.md

Read it IN FULL. Then follow every step in order.
```

---

### `skills/taskplex/SKILL.md`

```markdown
---
name: taskplex
description: Structured multi-phase development workflow. Use when the user types /tp or /taskplex, or when they want to build something with a structured design-first approach, multi-agent execution, or enterprise quality gates. Triggers on /tp, /taskplex, "let's use taskplex", "use the workflow", "structured build".
---

# TaskPlex Skill

This skill provides structured access to the TaskPlex phase files.

When invoked via /taskplex or /tp:
1. The prompt template has already loaded (it sent you here)
2. Read the init phase file to begin: [phases/init.md](phases/init.md)
3. Follow every step in that file sequentially

## Phase Files (read in sequence)

- [phases/init.md](phases/init.md) — ALWAYS read first: task setup, design interaction
- [phases/planning.md](phases/planning.md) — after init: spec, review, implementation
- [phases/qa.md](phases/qa.md) — after implementation: QA walkthrough
- [phases/validation.md](phases/validation.md) — after QA: gates, hardening, compliance
- [phases/bootstrap.md](phases/bootstrap.md) — one-time: if INTENT.md does not exist

## Reference Documents (read when needed)

- [refs/artifact-contract.md](refs/artifact-contract.md) — required artifacts by profile
- [refs/gates.md](refs/gates.md) — gate catalog, execution order, verdict enums
- [refs/handoff-contract.md](refs/handoff-contract.md) — agent-to-agent handoff format
- [refs/hardening-checks.md](refs/hardening-checks.md) — hardening check catalog
- [refs/policy.json](refs/policy.json) — quality profiles, limits

## Path Note (Pi Adapter)

In Claude Code, phase files live at `~/.claude/taskplex/phases/`.
In pi, they live relative to this skill directory.
All path references within phase files have been updated accordingly.
The manifest.json location and .claude-task/ directory structure are unchanged.
```

---

### `extensions/taskplex/index.ts`

This is the main extension entry point. It registers the `/tp` command and
wires all hooks.

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { registerSessionStartHook } from "./hooks/session-start.js";
import { registerDesignGateHook } from "./hooks/design-gate.js";
import { registerHeartbeatHook } from "./hooks/heartbeat.js";
import { registerPreCompactHook } from "./hooks/pre-compact.js";
import { registerPreCommitHook } from "./hooks/pre-commit.js";
import { registerStopHook } from "./hooks/stop.js";

export default function (pi: ExtensionAPI) {

  // ── Session-level hooks ──────────────────────────────────────────────────
  registerSessionStartHook(pi);   // Detect active tasks, inject recovery context
  registerDesignGateHook(pi);     // Block artifact writes before design sub-phases
  registerHeartbeatHook(pi);      // Update manifest + render progress on every edit
  registerPreCompactHook(pi);     // Checkpoint before compaction
  registerPreCommitHook(pi);      // Block git commit without validation
  registerStopHook(pi);           // Warn on incomplete validation at shutdown

  // ── /tp command ─────────────────────────────────────────────────────────
  // The command just sends the /taskplex prompt template as a user message.
  // The template + skill system does the heavy lifting.
  pi.registerCommand("tp", {
    description: "TaskPlex: structured development workflow with design gates and quality profiles",
    handler: async (args, ctx) => {
      // Expand the tp prompt template as a user message
      const message = args
        ? `/taskplex ${args}`
        : "/taskplex";
      pi.sendUserMessage(message, { deliverAs: ctx.isIdle() ? undefined : "followUp" });
    },
  });

  pi.registerCommand("taskplex", {
    description: "TaskPlex: full entry point — /taskplex [--standard|--team|--blueprint|--light] [task]",
    handler: async (args, ctx) => {
      pi.sendUserMessage(args ? `${args}` : "", { deliverAs: ctx.isIdle() ? undefined : "followUp" });
    },
  });
}
```

---

### `extensions/taskplex/manifest.ts`

Utility module — identical in logic to `hook-utils.mjs` in the Claude Code version
but written as typed TypeScript for pi.

```typescript
import fs from "node:fs";
import path from "node:path";

export interface TaskplexManifest {
  schemaVersion: number;
  taskId: string;
  description: string;
  phase: string;
  status: "in-progress" | "completed" | "cancelled";
  designDepth: "light" | "full";
  executionMode: "standard" | "team" | "blueprint";
  designPhase: string;
  qualityProfile: "lean" | "standard" | "enterprise";
  designInteraction?: {
    conventionQuestionsAsked?: number;
    conventionQuestionsAnswered?: number;
    intentQuestionsAsked?: number;
    intentQuestionsAnswered?: number;
    approachesProposed?: boolean;
    approachSelected?: boolean;
    sectionsPresented?: number;
    sectionsApproved?: number;
    userEscaped?: boolean;
  };
  phaseChecklist?: Record<string, Record<string, string>>;
  modifiedFiles?: string[];
  progressNotes?: Array<{ text: string; status: "done" | "active" | "pending" | "issue" }>;
  toolCallCount?: number;
  validation?: Record<string, string>;
  lastUpdated?: string;
  [key: string]: unknown;
}

export interface ActiveTask {
  manifest: TaskplexManifest;
  taskPath: string;
  folder: string;
}

/** Walk up from cwd looking for .claude-task/{id}/manifest.json with status in-progress */
export function findActiveTask(cwd: string): ActiveTask | null {
  const taskRoot = path.join(cwd, ".claude-task");
  if (!fs.existsSync(taskRoot)) return null;

  try {
    const folders = fs.readdirSync(taskRoot);
    for (const folder of folders) {
      const manifestPath = path.join(taskRoot, folder, "manifest.json");
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as TaskplexManifest;
        if (manifest.status === "in-progress") {
          return { manifest, taskPath: path.join(taskRoot, folder), folder };
        }
      } catch { continue; }
    }
  } catch { /* non-fatal */ }

  return null;
}

export function writeManifest(taskPath: string, manifest: TaskplexManifest): void {
  manifest.lastUpdated = new Date().toISOString();
  fs.writeFileSync(
    path.join(taskPath, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
}

export function readManifest(taskPath: string): TaskplexManifest | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(taskPath, "manifest.json"), "utf8"));
  } catch { return null; }
}
```

---

### `extensions/taskplex/hooks/session-start.ts`

Equivalent to `tp-session-start.mjs`. Fires on `session_start` event.

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { findActiveTask } from "../manifest.js";
import path from "node:path";
import fs from "node:fs";

export function registerSessionStartHook(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const task = findActiveTask(ctx.cwd);
    if (!task) return;

    const { manifest, taskPath } = task;
    if (manifest.status === "completed" || manifest.status === "cancelled") return;

    const lines: string[] = [
      `[TaskPlex] Active task detected: ${manifest.taskId}`,
      `Phase: ${manifest.phase} | Status: ${manifest.status}`,
      `Profile: ${manifest.qualityProfile || "standard"} | Route: ${manifest.executionMode || "standard"}`,
    ];

    if (manifest.description) lines.push(`Description: ${manifest.description}`);

    // Phase checklist reconstruction (survives compaction because it's in manifest)
    const checklist = manifest.phaseChecklist;
    if (checklist && typeof checklist === "object") {
      lines.push("", "═══ TASKPLEX PROGRESS (from manifest) ═══");
      const phaseOrder = [
        { key: "initialization",    label: "PHASE 1: INITIALIZATION" },
        { key: "conventionCheck",   label: "PHASE 2: Convention Check" },
        { key: "intentExploration", label: "PHASE 3: Intent Exploration" },
        { key: "planning",          label: "PHASE 4: PLANNING" },
        { key: "implementation",    label: "PHASE 5: IMPLEMENTATION" },
        { key: "validation",        label: "PHASE 6: VALIDATION" },
        { key: "completion",        label: "PHASE 7: COMPLETION" },
      ];
      for (const phase of phaseOrder) {
        const steps = checklist[phase.key];
        if (!steps || typeof steps !== "object") continue;
        const entries = Object.entries(steps);
        const hasActive = entries.some(([, v]) => v === "active");
        const allDone = entries.every(([, v]) => v === "done" || v === "skipped");
        const marker = hasActive ? "📍" : allDone ? "✅" : "⬜";
        lines.push(`${marker} ${phase.label}`);
        for (const [stepId, status] of entries) {
          const icon = status === "done" ? "✅" : status === "active" ? "➡️" : status === "skipped" ? "⏭️" : "⬜";
          lines.push(`  ${icon} ${stepId}`);
        }
      }
      lines.push("═══════════════════════════════════════");
      lines.push("", "MANDATORY: Output this checklist at the top of your next response.");
      lines.push("Resume from the step marked ➡️. Do NOT restart completed steps.");
    }

    // Progress notes
    const active = (manifest.progressNotes || []).filter(n => n.status === "active");
    if (active.length) {
      lines.push("", "In progress:", ...active.map(n => `  - ${n.text}`));
    }

    // Key artifacts
    const artifacts: string[] = [];
    for (const a of ["brief.md", "spec.md", "progress.md"]) {
      if (fs.existsSync(path.join(taskPath, a))) artifacts.push(a);
    }
    if (artifacts.length) {
      const rel = path.relative(ctx.cwd, taskPath).replace(/\\/g, "/");
      lines.push("", `Key artifacts: ${artifacts.map(a => `${rel}/${a}`).join(", ")}`);
    }

    const relManifest = path.relative(ctx.cwd, path.join(taskPath, "manifest.json")).replace(/\\/g, "/");
    lines.push("", `To resume: Read ${relManifest} for full task state.`);

    // Inject into session context
    return {
      message: {
        customType: "taskplex-recovery",
        content: lines.join("\n"),
        display: true,
      }
    };
  });
}
```

---

### `extensions/taskplex/hooks/design-gate.ts`

Equivalent to `tp-design-gate.mjs`. Intercepts `tool_call` for Edit/Write
and blocks artifact writes until the correct design sub-phase is reached.

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { findActiveTask } from "../manifest.js";
import path from "node:path";

// Sub-phase ordering
const SUB_PHASE_ORDER: Record<string, number> = {
  "convention-scan":     0,
  "convention-check":    1,
  "intent-exploration":  2,
  "approach-review":     3,
  "design-approval":     4,
  "brief-writing":       5,
  "prd-bootstrap":       6,
  "prd-critic":          7,
  "prd-approval":        8,
  "planning-active":     9,
};

const ARTIFACT_GATES: Record<string, string> = {
  "conventions.md":          "convention-check",
  "intent-and-journeys.md":  "intent-exploration",
  "research.md":             "intent-exploration",
  "brief.md":                "brief-writing",
  "spec.md":                 "brief-writing",
  "plan.md":                 "brief-writing",
  "architecture.md":         "brief-writing",
  "strategic-review.md":     "prd-critic",
  "prd.md":                  "prd-bootstrap",
};

const ALWAYS_ALLOWED = new Set(["manifest.json", "progress.md", "session.json"]);

export function registerDesignGateHook(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("edit", event) && !isToolCallEventType("write", event)) return;

    const task = findActiveTask(ctx.cwd);
    if (!task) return;

    const { manifest } = task;
    const phase = manifest.phase || "init";

    // Only enforce during init/brief/bootstrap phases
    if (phase !== "init" && phase !== "brief" && phase !== "bootstrap") return;

    const filePath: string = (event.input as any).path || (event.input as any).file_path || "";
    if (!filePath) return;

    const fileName = path.basename(filePath).toLowerCase();

    // Always allow certain files
    if (ALWAYS_ALLOWED.has(fileName)) return;

    // Mid-flow escape: user said "just do it"
    if (manifest.designInteraction?.userEscaped) return;

    const currentSubPhase = manifest.designPhase || "convention-scan";
    const currentOrder = SUB_PHASE_ORDER[currentSubPhase] ?? 0;
    const designDepth = manifest.designDepth || "full";
    const interaction = manifest.designInteraction || {};

    const requiredSubPhase = ARTIFACT_GATES[fileName];
    if (!requiredSubPhase) return;

    const requiredOrder = SUB_PHASE_ORDER[requiredSubPhase] ?? 0;

    // Light mode relaxations
    if (designDepth === "light") {
      if (fileName === "conventions.md" && currentOrder >= 0) return;
      if ((fileName === "brief.md" || fileName === "spec.md") &&
          currentOrder >= SUB_PHASE_ORDER["intent-exploration"]) return;
    }

    // Full mode: interaction evidence check for brief.md
    if (designDepth === "full" && fileName === "brief.md") {
      const missing: string[] = [];
      if ((interaction.intentQuestionsAsked || 0) < 2)
        missing.push(`ask at least 2 clarifying questions (asked: ${interaction.intentQuestionsAsked || 0})`);
      if ((interaction.intentQuestionsAnswered || 0) < 2)
        missing.push(`get at least 2 answers (answered: ${interaction.intentQuestionsAnswered || 0})`);
      if (!interaction.approachesProposed)
        missing.push("propose 2-3 approaches with trade-offs");
      if (!interaction.approachSelected)
        missing.push("get user selection on approach");
      if ((interaction.sectionsApproved || 0) < 1)
        missing.push(`get at least 1 design section approved`);
      if (missing.length > 0) {
        return {
          block: true,
          reason: `TaskPlex design gate: Cannot write brief.md — interaction evidence missing.\n` +
            `Required:\n${missing.map(m => `  - ${m}`).join("\n")}\n\n` +
            `Update manifest.designInteraction fields as you complete each step.\n` +
            `If the user says "just do it", set manifest.designInteraction.userEscaped = true.`
        };
      }
    }

    // Light mode: at least 1 answer required before brief
    if (designDepth === "light" && fileName === "brief.md") {
      if ((interaction.intentQuestionsAnswered || 0) < 1) {
        return {
          block: true,
          reason: `TaskPlex design gate: Even in light mode, at least 1 question must be asked and answered before brief.md. ` +
            `(answered: ${interaction.intentQuestionsAnswered || 0})`
        };
      }
    }

    // Sub-phase order gate
    if (currentOrder < requiredOrder) {
      return {
        block: true,
        reason: `TaskPlex design gate: Cannot write ${fileName} yet.\n` +
          `Current sub-phase: ${currentSubPhase}. Required: ${requiredSubPhase}.\n` +
          `Complete the design interaction steps first and update manifest.designPhase.`
      };
    }
  });
}
```

---

### `extensions/taskplex/hooks/heartbeat.ts`

Equivalent to `tp-heartbeat.mjs`. Fires on `tool_result` for edit/write tools.

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { findActiveTask, writeManifest } from "../manifest.js";
import fs from "node:fs";
import path from "node:path";

export function registerHeartbeatHook(pi: ExtensionAPI) {
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "edit" && event.toolName !== "write") return;

    const task = findActiveTask(ctx.cwd);
    if (!task) return;

    const { manifest, taskPath } = task;
    if (manifest.status === "completed" || manifest.status === "cancelled") return;

    // Track modified file
    const filePath: string = (event as any).input?.path || (event as any).input?.file_path || "";
    if (filePath) {
      if (!manifest.modifiedFiles) manifest.modifiedFiles = [];
      const normalized = filePath.replace(/\\/g, "/");
      if (!manifest.modifiedFiles.includes(normalized)) {
        manifest.modifiedFiles.push(normalized);
      }
    }

    // Increment tool call counter
    manifest.toolCallCount = (manifest.toolCallCount || 0) + 1;

    // Auto-promote phase from artifact presence
    const derivedPhase = derivePhaseFromArtifacts(taskPath);
    if (derivedPhase && phaseOrder(derivedPhase) > phaseOrder(manifest.phase)) {
      manifest.phase = derivedPhase;
    }

    // Write manifest
    writeManifest(taskPath, manifest);

    // Render progress.md from progressNotes
    renderProgress(taskPath, manifest);
  });
}

function phaseOrder(phase: string): number {
  const order: Record<string, number> = {
    "init": 0, "brief": 1, "planning": 2,
    "implementation": 3, "qa": 4, "validation": 5, "completion": 6
  };
  return order[phase] ?? 0;
}

function derivePhaseFromArtifacts(taskPath: string): string | null {
  if (fs.existsSync(path.join(taskPath, "reviews/compliance.md"))) return "completion";
  if (fs.existsSync(path.join(taskPath, "reviews/security.md")))   return "validation";
  if (fs.existsSync(path.join(taskPath, "qa-report.md")))          return "qa";
  if (fs.existsSync(path.join(taskPath, "spec.md")))               return "planning";
  if (fs.existsSync(path.join(taskPath, "brief.md")))              return "brief";
  return null;
}

function renderProgress(taskPath: string, manifest: any): void {
  const notes = manifest.progressNotes || [];
  if (!notes.length) return;
  try {
    const done    = notes.filter((n: any) => n.status === "done");
    const active  = notes.filter((n: any) => n.status === "active");
    const pending = notes.filter((n: any) => n.status === "pending");
    const issues  = notes.filter((n: any) => n.status === "issue");

    const lines = [
      `# Progress: ${manifest.description || manifest.taskId}`,
      `**Phase:** ${manifest.phase} | **Status:** ${manifest.status}`,
      `**Profile:** ${manifest.qualityProfile || "standard"} | **Route:** ${manifest.executionMode || "standard"}`,
      "",
    ];
    if (done.length)    { lines.push("## Completed", ...done.map((n: any) => `- [x] ${n.text}`), ""); }
    if (active.length)  { lines.push("## In Progress", ...active.map((n: any) => `- [ ] **${n.text}**`), ""); }
    if (pending.length) { lines.push("## Pending", ...pending.map((n: any) => `- [ ] ${n.text}`), ""); }
    if (issues.length)  { lines.push("## Issues", ...issues.map((n: any) => `- ⚠ ${n.text}`), ""); }

    if (manifest.modifiedFiles?.length) {
      lines.push(`**Files modified:** ${manifest.modifiedFiles.length}`);
    }
    fs.writeFileSync(path.join(taskPath, "progress.md"), lines.join("\n"));
  } catch { /* non-fatal */ }
}
```

---

### `extensions/taskplex/hooks/pre-compact.ts`

Equivalent to `tp-pre-compact.mjs`. Fires on `session_before_compact`.

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { findActiveTask } from "../manifest.js";
import fs from "node:fs";
import path from "node:path";

export function registerPreCompactHook(pi: ExtensionAPI) {
  pi.on("session_before_compact", async (event, ctx) => {
    const task = findActiveTask(ctx.cwd);
    if (!task) return;

    const { manifest, taskPath } = task;
    if (manifest.status === "completed" || manifest.status === "cancelled") return;

    // Write checkpoint
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const checkpointsDir = path.join(taskPath, "checkpoints");
    fs.mkdirSync(checkpointsDir, { recursive: true });

    const checkpoint = {
      checkpointType: "pre-compact",
      timestamp: new Date().toISOString(),
      taskId: manifest.taskId,
      phase: manifest.phase,
      status: manifest.status,
      designDepth: manifest.designDepth || null,
      executionMode: manifest.executionMode || "standard",
      qualityProfile: manifest.qualityProfile || "standard",
      toolCallCount: manifest.toolCallCount || 0,
      modifiedFiles: manifest.modifiedFiles || [],
      progressNotes: manifest.progressNotes || [],
      phaseChecklist: manifest.phaseChecklist || null,
      validation: manifest.validation || {},
      degradations: (manifest as any).degradations || [],
    };

    fs.writeFileSync(
      path.join(checkpointsDir, `compact-${timestamp}.json`),
      JSON.stringify(checkpoint, null, 2)
    );

    // Return custom summary for compaction
    const activeNotes = (manifest.progressNotes || [])
      .filter(n => n.status === "active")
      .map(n => n.text);

    const summary = [
      `[TaskPlex] Task: ${manifest.taskId} | Phase: ${manifest.phase}`,
      `Profile: ${manifest.qualityProfile || "standard"} | Route: ${manifest.executionMode || "standard"}`,
      activeNotes.length ? `In progress: ${activeNotes.join("; ")}` : "",
      `Files modified: ${(manifest.modifiedFiles || []).length}`,
      `Checkpoint saved. Resume by reading manifest.json on next session start.`,
    ].filter(Boolean).join("\n");

    return {
      compaction: {
        summary,
        firstKeptEntryId: event.preparation.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
      }
    };
  });
}
```

---

### `extensions/taskplex/hooks/pre-commit.ts`

Intercepts bash tool calls that are git commits and blocks them if validation
has not passed.

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { findActiveTask } from "../manifest.js";
import fs from "node:fs";
import path from "node:path";

export function registerPreCommitHook(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    const command: string = event.input.command || "";
    const isCommit = /git\s+commit/.test(command);
    if (!isCommit) return;

    const task = findActiveTask(ctx.cwd);
    if (!task) return;

    const { manifest, taskPath } = task;
    const profile = manifest.qualityProfile || "standard";
    if (profile === "lean") return;

    // Check validation gate
    const gateFile = path.join(taskPath, "validation-gate.json");
    if (!fs.existsSync(gateFile)) {
      return {
        block: true,
        reason: `TaskPlex pre-commit: Commit blocked — validation-gate.json not found.\n` +
          `Complete the validation phase before committing.\n` +
          `Phase files: taskplex/phases/validation.md`
      };
    }

    try {
      const gate = JSON.parse(fs.readFileSync(gateFile, "utf8"));
      if (gate.status !== "passed") {
        return {
          block: true,
          reason: `TaskPlex pre-commit: Commit blocked — validation gate status: ${gate.status}.\n` +
            `Run the full validation phase before committing.`
        };
      }
    } catch {
      return {
        block: true,
        reason: `TaskPlex pre-commit: Could not read validation-gate.json. Run validation first.`
      };
    }
  });
}
```

---

### `extensions/taskplex/hooks/stop.ts`

Warns (but does not block, except in validation) on session shutdown.

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { findActiveTask, writeManifest } from "../manifest.js";
import fs from "node:fs";
import path from "node:path";

export function registerStopHook(pi: ExtensionAPI) {
  pi.on("session_shutdown", async (_event, ctx) => {
    const task = findActiveTask(ctx.cwd);
    if (!task) return;

    const { manifest, taskPath } = task;
    if (manifest.status === "completed" || manifest.status === "cancelled") return;

    // Update timestamp
    writeManifest(taskPath, manifest);

    // In validation phase: warn if not passed
    if (manifest.phase === "validation") {
      const gateFile = path.join(taskPath, "validation-gate.json");
      const passed = fs.existsSync(gateFile) && (() => {
        try { return JSON.parse(fs.readFileSync(gateFile, "utf8")).status === "passed"; }
        catch { return false; }
      })();
      if (!passed) {
        ctx.ui.notify(
          `TaskPlex: Task "${manifest.taskId}" is in validation phase but validation has not passed. Task will be resumable on next session start.`,
          "warning"
        );
      }
    }

    // In implementation phase: note active work
    if (manifest.phase === "implementation") {
      const fileCount = (manifest.modifiedFiles || []).length;
      const active = (manifest.progressNotes || []).filter(n => n.status === "active");
      if (active.length > 0) {
        ctx.ui.notify(
          `TaskPlex: Task "${manifest.taskId}" has active work (${fileCount} files modified). Resumable with /resume.`,
          "info"
        );
      }
    }
  });
}
```

---

### `extensions/taskplex/subagent.ts`

Agent spawning for Team and Blueprint routes. Adapts the pi subagent subprocess
pattern to TaskPlex's agent roles and model tiers.

```typescript
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface AgentDefinition {
  name: string;
  role: "orchestrator" | "implementer" | "reviewer" | "architect";
  model: string;     // e.g. "claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"
  tools?: string[];  // defaults to read,bash,edit,write
  systemPrompt: string;
}

export interface AgentResult {
  agent: string;
  exitCode: number;
  output: string;
  usage: { input: number; output: number; cost: number; turns: number };
}

/**
 * Model tier mapping for TaskPlex roles.
 * Matches portability.md §A3 model selection.
 */
export const MODEL_TIERS = {
  orchestrator: "claude-opus-4-5",   // Tier 1: highest reasoning
  architect:    "claude-opus-4-5",   // Tier 1
  implementer:  "claude-sonnet-4-5", // Tier 2: balanced
  reviewer:     "claude-sonnet-4-5", // Tier 2
  closure:      "claude-haiku-4-5",  // Tier 3: fast/cheap
  compliance:   "claude-haiku-4-5",  // Tier 3
};

/**
 * Spawn a TaskPlex agent as an isolated pi subprocess.
 * Equivalent to the subagent extension's runSingleAgent().
 */
export async function spawnAgent(
  cwd: string,
  agent: AgentDefinition,
  task: string,
  signal?: AbortSignal
): Promise<AgentResult> {
  // Write system prompt to temp file
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskplex-"));
  const promptFile = path.join(tmpDir, `${agent.name}.md`);
  fs.writeFileSync(promptFile, agent.systemPrompt, { mode: 0o600 });

  const args = [
    "--mode", "json",
    "-p",
    "--no-session",
    "--model", agent.model,
    "--append-system-prompt", promptFile,
  ];
  if (agent.tools?.length) args.push("--tools", agent.tools.join(","));
  args.push(`Task: ${task}`);

  const result: AgentResult = {
    agent: agent.name,
    exitCode: 0,
    output: "",
    usage: { input: 0, output: 0, cost: 0, turns: 0 }
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("pi", args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
      let buffer = "";

      proc.stdout.on("data", (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "message_end" && event.message?.role === "assistant") {
              result.usage.turns++;
              const u = event.message.usage;
              if (u) {
                result.usage.input += u.input || 0;
                result.usage.output += u.output || 0;
                result.usage.cost += u.cost?.total || 0;
              }
              // Capture last assistant text as output
              for (const part of event.message.content || []) {
                if (part.type === "text") result.output = part.text;
              }
            }
          } catch { /* skip non-JSON lines */ }
        }
      });

      proc.on("close", (code: number | null) => {
        result.exitCode = code ?? 0;
        resolve();
      });
      proc.on("error", reject);

      if (signal?.aborted) proc.kill("SIGTERM");
      signal?.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
    });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
  }

  return result;
}

/**
 * Spawn agents in parallel with concurrency limit.
 * Used for Team route multi-agent execution.
 */
export async function spawnParallel(
  cwd: string,
  agents: Array<{ agent: AgentDefinition; task: string }>,
  concurrency = 4,
  signal?: AbortSignal
): Promise<AgentResult[]> {
  const results: AgentResult[] = new Array(agents.length);
  let nextIdx = 0;
  const workers = Array(Math.min(concurrency, agents.length)).fill(null).map(async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= agents.length) return;
      results[idx] = await spawnAgent(cwd, agents[idx].agent, agents[idx].task, signal);
    }
  });
  await Promise.all(workers);
  return results;
}
```

---

## Installation Instructions

### Option A: Install from local directory (development)

```bash
# 1. Create the package directory
mkdir -p ~/.pi/agent/extensions/taskplex
mkdir -p ~/.pi/agent/skills/taskplex/phases
mkdir -p ~/.pi/agent/skills/taskplex/refs
mkdir -p ~/.pi/agent/skills/taskplex/schemas
mkdir -p ~/.pi/agent/skills/plan
mkdir -p ~/.pi/agent/skills/evaluate/modes
mkdir -p ~/.pi/agent/prompts

# 2. Copy phase files from Claude Code (update paths to be relative)
cp ~/.claude/taskplex/phases/init.md       ~/.pi/agent/skills/taskplex/phases/
cp ~/.claude/taskplex/phases/planning.md   ~/.pi/agent/skills/taskplex/phases/
cp ~/.claude/taskplex/phases/qa.md         ~/.pi/agent/skills/taskplex/phases/
cp ~/.claude/taskplex/phases/validation.md ~/.pi/agent/skills/taskplex/phases/
cp ~/.claude/taskplex/phases/bootstrap.md  ~/.pi/agent/skills/taskplex/phases/

# 3. Copy reference files
cp ~/.claude/taskplex/artifact-contract.md  ~/.pi/agent/skills/taskplex/refs/
cp ~/.claude/taskplex/gates.md              ~/.pi/agent/skills/taskplex/refs/
cp ~/.claude/taskplex/handoff-contract.md   ~/.pi/agent/skills/taskplex/refs/
cp ~/.claude/taskplex/hardening-checks.md   ~/.pi/agent/skills/taskplex/refs/
cp ~/.claude/taskplex/policy.json           ~/.pi/agent/skills/taskplex/refs/
cp ~/.claude/taskplex/manifest-schema.json  ~/.pi/agent/skills/taskplex/schemas/

# 4. Write SKILL.md, extension files, and prompt templates as defined above

# 5. Install npm dependencies for the extension
cd ~/.pi/agent/extensions/taskplex
npm init -y
npm install @mariozechner/pi-coding-agent @sinclair/typebox

# 6. Reload pi
# In pi interactive session: /reload
```

### Option B: As a pi package (npm or git)

```bash
# Build the package
cd taskplex-pi/
npm install

# Install globally for all pi sessions
pi install ./taskplex-pi

# Or install project-locally
pi install -l ./taskplex-pi

# Verify installation
pi list
```

### Option C: Project-local `.pi/` (no global install)

Place all files under `.pi/` in your project root. Pi discovers
`.pi/extensions/`, `.pi/skills/`, `.pi/prompts/` automatically.

---

## Path Adaptation Notes

Phase files in `~/.claude/taskplex/phases/` contain paths like:
- `~/.claude/taskplex/phases/planning.md`
- `~/.claude/schemas/`
- `~/.claude/agents/`

When copying to pi, do a find-and-replace:

| Claude Code path | Pi path |
|---|---|
| `~/.claude/taskplex/phases/` | `[relative to skill dir]/phases/` |
| `~/.claude/taskplex/` | `[relative to skill dir]/refs/` |
| `~/.claude/schemas/` | `[relative to skill dir]/schemas/` |
| `~/.claude/sessions/` | Omit (pi uses own session system) |
| `~/.claude/agents/` | `.pi/agents/` (if using subagent extension) |

The manifest.json location (`.claude-task/{taskId}/manifest.json`) is **unchanged** —
it lives in the project directory, not in the agent config directory.

---

## What Pi Gains vs Claude Code Version

| Capability | Claude Code | Pi |
|---|---|---|
| Design gate enforcement | ✅ tp-design-gate.mjs | ✅ tool_call intercept |
| Heartbeat manifest updates | ✅ tp-heartbeat.mjs | ✅ tool_result hook |
| Compaction recovery | ✅ tp-pre-compact.mjs | ✅ session_before_compact + custom summary |
| Session resume | ✅ tp-session-start.mjs | ✅ session_start + message injection |
| Pre-commit gate | ✅ tp-pre-commit.mjs | ✅ bash tool_call intercept |
| Multi-model agents | ✅ Claude Code model flags | ✅ --model flag on subprocess |
| Parallel agents (Team) | ✅ Agent tool | ✅ Pi subprocess spawn (proven in subagent example) |
| User interaction | ✅ AskUserQuestion | ✅ ctx.ui.select/input |
| Context survival | ✅ manifest.json on disk | ✅ manifest.json on disk (same) |
| Session visualization | ✅ sess-{pid}.json | ❌ Not ported (Claude Code-specific) |
| Phase files (all phases) | ✅ ~/.claude/taskplex/ | ✅ Copied into skill refs/ |

---

## Key Design Decisions

**1. Prompt templates are the command entry point, not `registerCommand()` alone.**
Pi's prompt template system expands the full MANDATORY EXECUTION PROTOCOL when the
user types `/taskplex`. The `registerCommand("tp")` just forwards to the template.
This means the agent sees the full briefing without the extension having to inject it.

**2. All core workflow logic stays in Markdown files.**
The extension only implements the enforcement layer (hooks). The workflow itself —
what to do in each phase, how to interact with the user, what artifacts to produce —
lives in the phase Markdown files that the agent reads. This matches pi's philosophy.

**3. Subagent spawning uses the proven subprocess pattern.**
Pi's subagent example (in `examples/extensions/subagent/`) already demonstrates
spawning `pi --mode json -p --no-session` per agent. The `subagent.ts` module
in this plugin follows that exact pattern, adding model-tier selection for
TaskPlex's Opus/Sonnet/Haiku role mapping.

**4. Compaction recovery uses pi's `session_before_compact` return value.**
Instead of just saving a file (like the Claude Code version), the pi version
also returns a custom `compaction` object with a summary, which pi includes
in the context summary. This means post-compaction recovery is richer than
the original — the agent sees the task state in the compacted context itself.

**5. The `session_start` hook injects recovery context as a message.**
Pi's `before_agent_start` and `session_start` hooks can return a `message`
that is injected into the session. This replaces the Claude Code hook's
`continueWithContext()` mechanism — same effect, native pi API.
