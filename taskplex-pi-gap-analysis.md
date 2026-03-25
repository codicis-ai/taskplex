# TaskPlex Pi Plugin — Hook Gap Analysis

*Cross-reference of every Claude Code hook against pi's actual event API.
Identifies what maps cleanly, what needs adaptation, and what is genuinely lost.*

---

## Hook Inventory

| Claude Code Hook | Event Type | Pi Event | Maps? |
|---|---|---|---|
| `tp-session-start.mjs` | SessionStart | `session_start` + `before_agent_start` | ⚠️ Partial — see Gap 1 |
| `tp-design-gate.mjs` | PreToolUse (Edit/Write) | `tool_call` | ✅ Direct |
| `tp-heartbeat.mjs` | PostToolUse (Edit/Write) | `tool_result` | ✅ Direct |
| `tp-pre-compact.mjs` | PreCompact | `session_before_compact` | ✅ Better in pi |
| `tp-pre-commit.mjs` | PreToolUse (Bash: git commit) | `tool_call` (bash intercept) | ✅ Direct |
| `tp-stop.mjs` | Stop | `session_shutdown` | ❌ Notify only — see Gap 2 |
| `tp-prompt-check.mjs` | UserPromptSubmit | `input` + `before_agent_start` | ⚠️ Partial — see Gap 3 |
| `start-task-sentinel.mjs` | PostToolUse (Read/Bash/Grep) | `tool_result` (extend heartbeat) | ⚠️ Not mapped — see Gap 4 |

---

## Confirmed Gaps

---

### Gap 1 — `session_start` Cannot Inject Context (BUG in design doc)

**Claude Code behavior:**
`tp-session-start.mjs` calls `continueWithContext(text)` which injects `additionalContext`
into the hook response. This text appears in the agent's context on the next turn — it
shows the checklist, recovery state, and which manifest to read.

**Pi reality:**
`session_start` is notification-only. No return value is consumed. Returning a `message`
object from `session_start` does nothing.

The design doc's `session-start.ts` contains this bug:
```typescript
// WRONG — session_start ignores return values
pi.on("session_start", async (_event, ctx) => {
  // ...
  return {
    message: { customType: "taskplex-recovery", content: lines.join("\n"), display: true }
  };
});
```

**Fix:**
Use `before_agent_start` for injection, which DOES support returning a message.
But `before_agent_start` fires on EVERY agent turn — not just the first after session
start. So the extension needs a one-shot flag in memory:

```typescript
export function registerSessionStartHook(pi: ExtensionAPI) {
  // State in extension memory (survives turns, not compaction)
  let recoveryInjected = false;
  let pendingRecovery: string | null = null;

  // Step 1: session_start — detect task, store recovery text in memory
  pi.on("session_start", async (_event, ctx) => {
    const task = findActiveTask(ctx.cwd);
    if (!task) return;
    const { manifest, taskPath } = task;
    if (manifest.status === "completed" || manifest.status === "cancelled") return;

    // Build recovery lines (same logic as before)
    pendingRecovery = buildRecoveryText(manifest, taskPath, ctx.cwd);
    recoveryInjected = false; // reset flag for this session
  });

  // Step 2: before_agent_start — inject once on first turn
  pi.on("before_agent_start", async (event, ctx) => {
    if (!pendingRecovery || recoveryInjected) return;
    recoveryInjected = true;
    const text = pendingRecovery;
    pendingRecovery = null;
    return {
      message: {
        customType: "taskplex-recovery",
        content: text,
        display: true,
      }
    };
  });
}
```

**Important:** The `before_agent_start` message is "stored in session, sent to LLM"
per the pi docs. This means it persists in the conversation history after injection —
exactly what we want. It doesn't re-inject on every turn because of the `recoveryInjected` flag.

---

### Gap 2 — `session_shutdown` Cannot Block Stop

**Claude Code behavior:**
`tp-stop.mjs` calls `blockStop(reason)` when the task is in the validation phase and
`validation-gate.json` has not passed. This prevents the user from exiting until they
complete validation (or force-quit).

**Pi reality:**
`session_shutdown` is cleanup-only. Pi docs: "Fired on exit (Ctrl+C, Ctrl+D, SIGTERM)
for cleanup, save state, etc." There is no `blockStop()` equivalent. No return value
is consumed. The stop cannot be prevented.

**Impact:**
A user can Ctrl+C out of a session mid-validation without the enforcement stop.
The task state is still preserved in manifest.json (recoverable), but the hard
gate is gone.

**Mitigation (best achievable in pi):**
Warn visibly but cannot block:
```typescript
pi.on("session_shutdown", async (_event, ctx) => {
  const task = findActiveTask(ctx.cwd);
  if (!task) return;
  const { manifest, taskPath } = task;
  if (manifest.phase === "validation") {
    const passed = isValidationPassed(taskPath);
    if (!passed) {
      // Cannot block — can only notify
      ctx.ui.notify(
        `⚠ TaskPlex: "${manifest.taskId}" is mid-validation. ` +
        `Resumable next session — run /resume to continue.`,
        "warning"
      );
    }
  }
  writeManifest(taskPath, manifest); // persist timestamp
});
```

**Residual risk:** User can exit mid-validation. The task is recoverable but the
blocking enforcement is not replicated. Document this as a known behavioral difference.

---

### Gap 3 — `tp-prompt-check.mjs` (UserPromptSubmit) → `input` + `before_agent_start`

**Claude Code behavior:**
`tp-prompt-check.mjs` fires on every user prompt via `UserPromptSubmit` and returns
`additionalContext` which is injected as hidden system context (not visible in the
conversation). It does two things:

1. Detects `/tp` or `/taskplex` invocation → injects the "TASKPLEX WORKFLOW ACTIVATED"
   reminder banner and the mandatory first-action instruction
2. Detects active task + code-sounding request in design phase → injects a shorter
   context warning

**Pi reality:**
Pi has the `input` event which fires on every user prompt. However, the `input` event
can only `transform` (modify the input text), `handled` (block the agent), or `continue`.
It cannot inject hidden context — that's only available via `before_agent_start`.

Pi also has `before_agent_start` which can inject a message. Combined:

**Fix — two-event strategy:**

```typescript
export function registerPromptCheckHook(pi: ExtensionAPI) {
  let pendingInjection: string | null = null;

  // Step 1: input event — detect /tp invocation, set pending injection
  pi.on("input", async (event, ctx) => {
    const text = event.text || "";
    const isTpInvocation = /^\s*\/t(p|askplex)\b/i.test(text);

    if (isTpInvocation) {
      const task = findActiveTask(ctx.cwd);
      if (task && task.manifest.status === "in-progress") {
        // Active task exists — warn agent, offer resume/abandon choice
        pendingInjection = buildActiveTaskWarning(task);
      } else {
        // Fresh /tp — set the workflow reminder
        pendingInjection = buildWorkflowReminder();
      }
      return { action: "continue" }; // let the prompt through
    }

    // Non-/tp prompt: check if active task is in design phase and user seems to want code
    const task = findActiveTask(ctx.cwd);
    if (task && (task.manifest.phase === "init" || task.manifest.phase === "brief")) {
      const looksLikeCode = /\b(fix|implement|add|create|build|write|code|edit|change|update|refactor)\b/i.test(text);
      if (looksLikeCode) {
        pendingInjection = `[TaskPlex] Active task "${task.manifest.description}" is in ` +
          `${task.manifest.phase}/${task.manifest.designPhase} phase. ` +
          `Design interaction must complete before implementation. ` +
          `Read .claude-task/${task.folder}/manifest.json for state.`;
      }
    }
    return { action: "continue" };
  });

  // Step 2: before_agent_start — inject the pending context as a message
  pi.on("before_agent_start", async (event, ctx) => {
    if (!pendingInjection) return;
    const text = pendingInjection;
    pendingInjection = null;
    return {
      message: {
        customType: "taskplex-prompt-check",
        content: text,
        display: true,
      }
    };
  });
}
```

**Difference from Claude Code:** In Claude Code, `additionalContext` is injected as
system context (not visible in the chat bubble). In pi, the injected `message` IS
visible as a chat entry. The workflow reminder will appear as a visible message
before the agent's first response. This is acceptable — it's actually more transparent
to the user. Functionally equivalent.

---

### Gap 4 — `start-task-sentinel.mjs` Not Mapped (Minor)

**Claude Code behavior:**
`start-task-sentinel.mjs` fires on PostToolUse for Read/Bash/Grep/Glob/Agent/WebFetch.
It increments `manifest.toolCallCount` and `manifest.toolCallsByType` for non-edit/write
tools, and writes a compaction warning to progress.md when the threshold is hit.

**Pi reality:**
The design doc's `heartbeat.ts` only fires on `tool_result` for edit/write tools,
missing the tool call counting for read/bash/grep.

**Fix:**
Remove the tool type filter from the heartbeat hook, or add a second lightweight
handler that covers all tool types. The cleanest approach — extend heartbeat to cover all:

```typescript
// In heartbeat.ts — remove the early return filter:
pi.on("tool_result", async (event, ctx) => {
  // NO filter — runs for all tools

  const task = findActiveTask(ctx.cwd);
  if (!task) return;
  const { manifest, taskPath } = task;

  // Track file modified (only for edit/write)
  if (event.toolName === "edit" || event.toolName === "write") {
    const filePath: string = (event as any).input?.path || "";
    if (filePath) {
      if (!manifest.modifiedFiles) manifest.modifiedFiles = [];
      const normalized = filePath.replace(/\\/g, "/");
      if (!manifest.modifiedFiles.includes(normalized)) {
        manifest.modifiedFiles.push(normalized);
      }
    }
    // Phase auto-promotion (edit/write only)
    const derivedPhase = derivePhaseFromArtifacts(taskPath);
    if (derivedPhase && phaseOrder(derivedPhase) > phaseOrder(manifest.phase)) {
      manifest.phase = derivedPhase;
    }
    // Render progress.md (edit/write only)
    renderProgress(taskPath, manifest);
  }

  // Tool call counting — ALL tools
  manifest.toolCallCount = (manifest.toolCallCount || 0) + 1;
  if (!manifest.toolCallsByType) manifest.toolCallsByType = {};
  manifest.toolCallsByType[event.toolName] =
    (manifest.toolCallsByType[event.toolName] || 0) + 1;

  // Compaction warning check — ALL tools
  const estimatedTokens = weightedTokenEstimate(manifest);
  if (estimatedTokens > 130000) writeCompactionWarning(taskPath, manifest);

  writeManifest(taskPath, manifest);
});
```

**Impact if not fixed:** The token estimation and compaction warning will only account
for edit/write calls, underestimating context growth. Low severity — the compaction
fires regardless via pi's auto-compaction. The warning is advisory only.

---

## Items That Map Cleanly

### `tp-design-gate.mjs` → `tool_call` ✅

The `tool_call` event fires before execution and supports `return { block: true, reason }`.
The sub-phase gating logic, interaction evidence checks, and artifact gate table all work
identically. The only change needed is switching from `denyTool(reason)` (Claude Code)
to `return { block: true, reason }` (pi). Already correct in the design doc.

**One thing to verify:** Both the design-gate and pre-commit hooks register on `tool_call`.
Pi runs multiple handlers sequentially. If design-gate doesn't block, pre-commit runs.
If design-gate blocks, pre-commit never runs. This is correct behavior. ✅

### `tp-heartbeat.mjs` → `tool_result` ✅

`tool_result` has `event.toolName`, `event.toolCallId`, `event.input`, `event.content`,
`event.details`, `event.isError`. The `event.input` field carries the original tool
arguments (file path etc.) — confirmed in pi docs. All manifest update logic, progress.md
rendering, and phase auto-promotion work unchanged.

**Note on `event.input`:** The Claude Code heartbeat gets file path from
`hookInput.tool_input?.file_path`. In pi's `tool_result`, it's `event.input?.path`
or `event.input?.file_path` depending on tool. The built-in edit/write tools use
`path` for the path argument. Verify against pi source if needed.

### `tp-pre-compact.mjs` → `session_before_compact` ✅ (actually better)

Pi's `session_before_compact` allows returning a custom `compaction` object with
a summary string. Claude Code's version can only write a file and call
`continueWithSystemMessage()`. In pi:

- The checkpoint file is still written (same as Claude Code) ✅
- The summary is included IN the compaction itself via the return value ✅
- Post-compaction, the agent sees the task state in its summary — without needing
  to separately detect a `.compacted` marker file

This is a genuine improvement over the Claude Code version.

### `tp-pre-commit.mjs` → `tool_call` (bash intercept) ✅

Intercepting `bash` tool calls where `event.input.command` matches `git commit` works
identically. The `isToolCallEventType("bash", event)` narrowing gives typed access to
`event.input.command`. ✅

---

## Items That Don't Exist in Pi (and Don't Need To)

### `callRuntime()` API
TaskPlex-specific runtime API for session registration, task attachment, phase
transition approval, manifest validation. Pi has no equivalent and doesn't need one.
The local-only fallback path in the Claude Code hooks is exactly what the pi port uses.
Already correctly omitted.

### `sess-{pid}.json` session bridge
Claude Code-specific visualizer bridge. Pi uses its own session system.
Already correctly omitted.

### `findCurrentSession()` in sentinel
The sentinel used `findCurrentSession()` which reads from `~/.claude/sessions/`.
The pi port uses `findActiveTask(ctx.cwd)` instead — scanning `.claude-task/`
for in-progress manifests. Functionally equivalent.

---

## Workflow Gaps (Beyond Hooks)

### `AskUserQuestion` tool

Claude Code has a built-in `AskUserQuestion` tool that the agent calls to prompt
the user with structured options. The phase files reference this extensively.

**Pi reality:** No equivalent built-in tool. The agent would need to ask questions
in its response text and wait for the next user turn. This is normal pi conversation
flow and works fine — but the phase files need updating to replace:

```
AskUserQuestion: "How would you like to approach this? 1. Standard 2. Team 3. Blueprint"
```

with:

```
Ask the user: "How would you like to approach this? 1. Standard 2. Team 3. Blueprint"
Wait for their response before continuing.
```

**The design interaction counters still work** — the agent still updates
`manifest.designInteraction.intentQuestionsAsked` etc. via the bash tool writing
to manifest.json. The gate enforcement is unchanged. Only the question-asking
mechanism is different (response text vs tool call).

**A pi `ask_user` custom tool can be registered** to replicate this more cleanly:

```typescript
pi.registerTool({
  name: "ask_user",
  label: "Ask User",
  description: "Ask the user a clarifying question and wait for their response. " +
    "Use during the design phase. Updates manifest.designInteraction counters automatically.",
  parameters: Type.Object({
    question: Type.String({ description: "The question to ask" }),
    options: Type.Optional(Type.Array(Type.String(), { description: "Selectable options" })),
    counter: Type.Optional(Type.String({
      description: "Which manifest counter to increment: conventionQuestion | intentQuestion | sectionApproval"
    })),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    let answer: string;
    if (params.options?.length) {
      const items = params.options.map((o, i) => ({ value: String(i + 1), label: o }));
      const selected = await ctx.ui.select(params.question, items);
      answer = selected ?? "skipped";
    } else {
      answer = await ctx.ui.input(params.question, "") ?? "skipped";
    }

    // Auto-update manifest counter
    if (params.counter) {
      const task = findActiveTask(ctx.cwd);
      if (task) {
        const { manifest, taskPath } = task;
        if (!manifest.designInteraction) manifest.designInteraction = {};
        if (params.counter === "intentQuestion") {
          manifest.designInteraction.intentQuestionsAsked =
            (manifest.designInteraction.intentQuestionsAsked || 0) + 1;
          manifest.designInteraction.intentQuestionsAnswered =
            (manifest.designInteraction.intentQuestionsAnswered || 0) + 1;
        }
        writeManifest(taskPath, manifest);
      }
    }
    return { content: [{ type: "text", text: answer }], details: {} };
  },
});
```

This gives the agent a proper tool to call for user questions, automatically
updating the design interaction counters that the design gate checks.
This is actually better than the Claude Code version.

### Blueprint Route — Git Worktree Isolation

Claude Code's Blueprint route uses `isolation: 'worktree'` in the Agent tool call,
giving each worker agent its own git worktree with an isolated filesystem.

Pi's subprocess spawning (`pi --mode json -p --no-session`) does not provide automatic
worktree creation. The Blueprint route would need the orchestrator to manually:

```bash
git worktree add .worktrees/worker-{n} -b worker/{taskId}/{n}
```

before spawning each worker, and clean up afterward. This is achievable but requires
explicit worktree management logic in the Blueprint route's planning phase file.
The file changes from each worker remain isolated in the worktree until merged.

**Severity:** Medium — Blueprint route requires adaptation. Standard and Team routes
are unaffected (they don't use worktrees).

---

## Corrected Hook Architecture

The final correct structure after fixing all gaps:

```
extensions/taskplex/hooks/
├── session-start.ts     FIXED: session_start (detect) + before_agent_start (inject, once)
├── prompt-check.ts      NEW:   input (detect) + before_agent_start (inject, next turn)
├── design-gate.ts       OK:    tool_call intercept (edit/write)
├── heartbeat.ts         FIXED: tool_result, ALL tools (not just edit/write)
├── pre-compact.ts       OK:    session_before_compact → return compaction
├── pre-commit.ts        OK:    tool_call intercept (bash, git commit pattern)
└── stop.ts              DEGRADED: session_shutdown → notify only (cannot block)
```

And in `index.ts`, add registration of the new `ask_user` tool and `prompt-check` hook:

```typescript
import { registerPromptCheckHook } from "./hooks/prompt-check.js";
import { registerAskUserTool } from "./tools/ask-user.js";

export default function (pi: ExtensionAPI) {
  registerSessionStartHook(pi);   // Fixed: uses before_agent_start
  registerPromptCheckHook(pi);    // New: maps tp-prompt-check
  registerDesignGateHook(pi);
  registerHeartbeatHook(pi);      // Fixed: covers all tools
  registerPreCompactHook(pi);
  registerPreCommitHook(pi);
  registerStopHook(pi);           // Degraded: notify only
  registerAskUserTool(pi);        // New: replaces AskUserQuestion
  // ... commands
}
```

---

## Summary

| Hook | Status | Action |
|---|---|---|
| session-start | ⚠️ Bug in design doc | Fix: move injection to `before_agent_start`, one-shot flag |
| design-gate | ✅ Correct | No change needed |
| heartbeat | ⚠️ Incomplete | Fix: extend `tool_result` to all tools, not just edit/write |
| pre-compact | ✅ Better than original | No change needed |
| pre-commit | ✅ Correct | No change needed |
| stop | ❌ Functional loss | Accept: notify only, document behavioral difference |
| prompt-check | ⚠️ Not mapped | Add: new `hooks/prompt-check.ts` using `input` + `before_agent_start` |
| sentinel | ⚠️ Not mapped | Fix: absorbed into extended heartbeat |
| AskUserQuestion | ⚠️ No pi equivalent | Add: `ask_user` custom tool with auto counter updates |
| Blueprint worktrees | ⚠️ No auto-isolation | Adapt: manual worktree management in phase files |

**Short answer: 6 out of 8 hooks map cleanly or better. Two need real fixes (session-start
injection, heartbeat coverage). One is a genuine functional loss (blocking stop). One
needs a new hook (prompt-check). The `ask_user` tool addition actually improves on the
original Claude Code behavior.**

The workflow will run fully in pi with these fixes applied. The only behavioral
difference that can't be closed is the blocking stop during validation — which is
enforced by convention and warning rather than hard gate.
