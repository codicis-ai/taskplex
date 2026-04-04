# Harness Engineering Gap Analysis & Implementation Plan

> **Context**: Review of [Rohit's "The Harness Is Everything"](https://x.com/rohit4verse/status/2033945654377283643) thesis, cross-referenced with [Anthropic's harness design blog](https://www.anthropic.com/engineering/harness-design-long-running-apps), [OpenAI's harness engineering](https://openai.com/index/harness-engineering/), and the broader harness engineering discipline emerging in 2026.
>
> **Date**: 2026-04-04

---

## Executive Summary

TaskPlex already implements strong harness engineering — design-gated phases, 12-step validation, manifest-driven state, and structured agent handoffs. Three gaps emerged when measured against current best practices:

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| 1 | No visual/browser verification loop | High | Medium |
| 2 | No entropy/drift detection between tasks | Medium | Medium |
| 3 | No narrative progress artifact for cold starts | Medium | Low |
| 4 | Handoff payload missing explicit verification commands | Low-Medium | Low |

---

## Gap 1: Visual/Browser Verification Loop

### Problem

The e2e-reviewer agent (`backup/agents/core/e2e-reviewer.md`) references `agent-browser` for visual verification, and the QA phase (`backup/taskplex/phases/qa.md`) includes browser-based smoke tests. However:

1. **No MCP server configured** — `backup/settings.json` only has `officecli` as an MCP server. No Playwright or Puppeteer MCP.
2. **`agent-browser` is assumed but never installed** — The e2e-reviewer gracefully skips (`SKIP: agent-browser not installed`) but this means visual verification effectively never runs.
3. **QA phase browser steps are aspirational** — Steps 4.5.2-4.5.3 describe `agent-browser open {url}` / `agent-browser snapshot` / `agent-browser console` but these only work if the tool is available.
4. **The `/evaluate` audit skill** also references `agent-browser` (`allowed-tools: Bash(agent-browser:*)`) — same gap.

### Why It Matters

Boris Cherny (Anthropic): *"Give agents access to Playwright MCP. Bugs invisible from code alone become obvious when the agent can see what users see."* This is the single highest-impact harness improvement for any project with a UI.

### Implementation Plan

#### Step 1.1: Add Playwright MCP Server to settings.json

**File**: `backup/settings.json` → `mcpServers` section

```json
"mcpServers": {
  "officecli": { ... },
  "playwright": {
    "command": "npx",
    "args": ["@anthropic-ai/mcp-playwright"],
    "env": {
      "PLAYWRIGHT_HEADLESS": "true"
    }
  }
}
```

**Rationale**: The `@anthropic-ai/mcp-playwright` package provides `browser_navigate`, `browser_screenshot`, `browser_click`, `browser_type`, `browser_console`, and `browser_snapshot` tools natively as MCP tools — no `agent-browser` CLI wrapper needed.

**Alternative**: If you prefer the `agent-browser` CLI approach, install it globally: `npm install -g agent-browser`. But the MCP approach is better because it gives the agent native tool access instead of wrapping Bash commands.

#### Step 1.2: Update e2e-reviewer agent to use MCP tools

**File**: `backup/agents/core/e2e-reviewer.md`

Changes:
- Replace `allowedTools: Bash(agent-browser:*)` with `allowedTools: mcp__playwright__*`
- Remove `Bash(npx agent-browser:*)` 
- Update process steps to use MCP tool names:
  - `agent-browser open {url}` → `mcp__playwright__browser_navigate`
  - `agent-browser snapshot` → `mcp__playwright__browser_snapshot`
  - `agent-browser console` → `mcp__playwright__browser_console`
- Update skip condition: `SKIP: playwright MCP not available`

#### Step 1.3: Update QA phase browser steps

**File**: `backup/taskplex/phases/qa.md`

Changes in Steps 4.5.2 (Smoke Test) and 4.5.3 (Journey Walkthrough):
- Replace `agent-browser` commands with MCP tool references
- Add detection logic: "If `mcp__playwright__*` tools are available, use browser verification. Otherwise fall back to code-based verification."
- Add screenshot capture at each journey step for evidence (stored in `.claude-task/{taskId}/screenshots/`)

#### Step 1.4: Update /evaluate audit skill

**File**: `backup/skills/evaluate/skill.md` and `backup/skills/evaluate/modes/audit.md`

Changes:
- Update `allowed-tools` in skill frontmatter to include `mcp__playwright__*`
- Replace `agent-browser` references in audit.md with MCP tool equivalents
- Same fallback pattern: use if available, skip if not

#### Step 1.5: Add screenshot evidence to validation

**File**: `backup/taskplex/phases/validation.md`

In the E2E reviewer conditional trigger (Step 5):
- Add: "If Playwright MCP is available, require at least 1 screenshot per affected page as evidence"
- Screenshots stored at `.claude-task/{taskId}/reviews/screenshots/`
- Referenced in the e2e review report as `[screenshot: /path]`

#### Verification

- [ ] Playwright MCP server starts successfully
- [ ] e2e-reviewer agent can navigate, snapshot, and verify a page
- [ ] QA phase smoke test uses browser when available
- [ ] /evaluate audit mode uses browser for UI apps
- [ ] Graceful fallback when Playwright is unavailable

---

## Gap 2: Entropy/Drift Detection Between Tasks

### Problem

All TaskPlex validation is **foreground and per-task**. Between tasks, nothing watches for:

1. **Convention drift** — New files added outside TaskPlex that don't follow naming/structure conventions
2. **Dependency rot** — Outdated packages, security vulnerabilities accumulating
3. **Architectural deviations** — Files in wrong directories, circular imports, pattern violations
4. **Test coverage erosion** — Coverage dropping as code grows

OpenAI's Codex harness runs **background agents that scan for deviations and open targeted refactoring PRs**. This prevents gradual degradation across many tasks.

### Why It Matters

The `/evaluate` audit skill exists but is manually triggered. Convention compliance (validation Step 1b) only runs during active tasks and only checks files modified in that task. There's no continuous hygiene loop.

### Implementation Plan

#### Step 2.1: Create a drift-scanner agent

**New file**: `backup/agents/utility/drift-scanner.md`

```markdown
---
name: drift-scanner
model: haiku
disallowedTools:
  - Edit
  - Write
  - NotebookEdit
requiredTools:
  - Read
  - Glob
  - Grep
  - Bash
---

# Drift Scanner

Read-only agent that scans for convention violations, architectural drift,
and hygiene issues across the codebase. Reports findings but does not fix.

## Scan Categories

1. **Convention compliance**: Check CONVENTIONS.md rules against all source files
2. **Structural integrity**: Files in expected directories, no orphans
3. **Import hygiene**: Circular dependencies, unused imports
4. **Dependency health**: Outdated packages, known vulnerabilities
5. **Test coverage**: Coverage delta since last scan
6. **Dead code**: Exports with no consumers

## Output

Write to `.claude-task/drift-report-{date}.md` with:
- Category, Finding, Severity (high/medium/low), File(s)
- Summary score: drift index (0-100, lower is better)
- Comparison to previous scan if available
```

#### Step 2.2: Create `/drift` command

**New file**: `backup/commands/drift.md`

A lightweight command that:
1. Spawns the `drift-scanner` agent
2. Reads the report
3. Presents findings to the user
4. Optionally: generates TaskPlex tasks for high-severity findings

#### Step 2.3: Wire into session-start as advisory

**File**: `backup/hooks/tp-session-start.mjs`

Add optional drift check at session start:
- If `drift-report-{date}.md` exists and is < 24 hours old: include summary in context
- If no report exists or is stale (> 7 days): emit advisory: "Consider running `/drift` — last scan was {N} days ago"
- **Never block** — purely advisory

#### Step 2.4: Add drift tracking to manifest schema

**File**: `backup/taskplex/manifest-schema.json`

Add optional field:

```json
"driftBaseline": {
  "type": ["object", "null"],
  "default": null,
  "description": "Drift index at task start, used to detect if task introduced drift",
  "properties": {
    "index": { "type": "number" },
    "scannedAt": { "type": "string", "format": "date-time" },
    "highFindings": { "type": "integer" }
  }
}
```

At task completion (validation Step 11): if drift baseline exists, re-scan and compare. If drift index increased, log as a degradation.

#### Step 2.5: Integrate with /evaluate

**File**: `backup/skills/evaluate/modes/audit.md`

Add a "Drift" section to audit output:
- If drift report exists: include drift index and top findings
- If not: run lightweight inline drift checks (convention + structure only, skip dependency scan)

#### Verification

- [ ] `/drift` command produces a readable report
- [ ] Session start shows drift advisory when report is stale
- [ ] Task completion compares drift baseline
- [ ] /evaluate audit includes drift findings

---

## Gap 3: Narrative Progress Artifact for Cold Starts

### Problem

Anthropic's harness blog highlights `claude-progress.txt` as the key artifact for cross-session continuity. When a fresh context window opens, the agent needs a **human/agent-readable narrative** of what's been done, what's in progress, and what's next — not just machine state.

TaskPlex has:
- `manifest.json` — machine state (phase, status, flags, validation verdicts)
- `manifest.progressNotes[]` — structured notes array
- `progress.md` — rendered by tp-heartbeat, but only contains progress note bullets and wave summaries
- `tp-session-start.mjs` — rebuilds a checklist from `phaseChecklist`, but it's phase-step status icons, not narrative

**What's missing**: A concise, narrative summary that a fresh agent can read in 30 seconds and understand:
- What the task is about (not just the ID)
- What's been decided (approach, key design choices)
- What's been built so far (not just file lists, but functional status)
- What's blocked or needs attention
- What comes next

### Why It Matters

Anthropic found that structured artifacts alone aren't sufficient — agents need narrative context to make good judgment calls after compaction or session breaks. The difference between "Phase: implementation, Status: in-progress, Files: 12" and "Auth module complete and tested. Payment integration 60% done — Stripe webhook handler written but not yet wired to the order service. Next: connect webhook to order creation flow, then run e2e tests." is the difference between an agent that resumes well and one that re-discovers context for 10 minutes.

### Implementation Plan

#### Step 3.1: Enhance progress.md generation in tp-heartbeat

**File**: `backup/hooks/tp-heartbeat.mjs` (progress.md rendering section, lines ~173-240)

Current rendering is bullet-based (`Completed`, `In Progress`, `Pending`, `Issues`). Enhance to add a **Narrative Summary** section at the top:

```markdown
## Task Narrative

**Task**: {manifest.description}
**Approach**: {extracted from brief.md if exists — the selected approach}
**Current focus**: {active progressNotes, synthesized into a sentence}
**Key decisions**: {from manifest.conventionContext.confirmed + overrides}
**Blockers**: {from issues in progressNotes + escalations}
**Next**: {from pending progressNotes, first 2-3 items}
```

The narrative section is assembled from existing manifest data — no new data collection needed.

#### Step 3.2: Write narrative on phase transitions

**File**: `backup/hooks/tp-heartbeat.mjs` (phase auto-promotion section, lines ~61-87)

When a phase transition is detected, append a transition narrative to progress.md:

```markdown
### Phase transition: implementation → qa
Implementation complete. 14 files modified across auth, payments, and order modules.
Build passing (typecheck + lint clean). Moving to QA phase for smoke testing and journey verification.
```

This is generated from:
- `manifest.modifiedFiles.length`
- `manifest.validation.typecheck` / `manifest.validation.lint` status
- `manifest.phaseChecklist` — count of completed vs pending steps

#### Step 3.3: Read progress.md first on session resume

**File**: `backup/hooks/tp-session-start.mjs`

Current behavior (line 227-235): Lists `progress.md` as a key artifact path but just tells the agent "To resume: Read manifest.json for full task state."

Change to:
1. If `progress.md` exists, read it and include the **Narrative Summary** section directly in the session-start context message (not just a path reference)
2. Move the narrative block ABOVE the phase checklist in the output
3. Keep the checklist for step-level granularity

```javascript
// After line 87 in current code
const progressPath = path.join(taskPath, 'progress.md');
if (fs.existsSync(progressPath)) {
  const progressContent = fs.readFileSync(progressPath, 'utf-8');
  const narrativeMatch = progressContent.match(/## Task Narrative\n([\s\S]*?)(?=\n## |\n---|\n$)/);
  if (narrativeMatch) {
    lines.push('');
    lines.push('═══ TASK NARRATIVE ═══');
    lines.push(narrativeMatch[1].trim());
    lines.push('═════════════════════');
  }
}
```

#### Step 3.4: Include narrative in pre-compact checkpoint

**File**: `backup/hooks/tp-pre-compact.mjs`

Add `narrativeSummary` to the checkpoint structure:
- Read the narrative section from `progress.md` and store it in the checkpoint
- On compaction recovery, the narrative is available without re-reading files

#### Verification

- [ ] progress.md includes narrative summary section
- [ ] Phase transitions generate narrative entries
- [ ] Session resume displays narrative before checklist
- [ ] Pre-compact checkpoint includes narrative

---

## Gap 4: Explicit Verification Commands in Agent Handoffs

### Problem

Best practice: *"Give Claude a feedback loop — include test commands, linter checks, or expected outputs in prompts. This alone gives 2-3x quality improvement."*

The handoff contract (`backup/taskplex/handoff-contract.md`) defines structured context with `currentState`, `relevantFiles`, `dependencies`, `constraints`, `deliverable`, and `acceptanceCriteria`. But it does NOT include the **exact commands** the agent should run to verify its own work.

The `manifest.buildCommands` object stores `typecheck`, `lint`, `test`, and `format` commands. But these aren't injected into the handoff payload — agents must discover them from the manifest or project config.

### Implementation Plan

#### Step 4.1: Add verificationCommands to handoff schema

**File**: `backup/taskplex/handoff-contract.md`

Add a `verification` block to the orchestrator→worker handoff:

```json
{
  "direction": "orchestrator→worker",
  "context": { ... },
  "deliverable": { ... },
  "verification": {
    "typecheck": "npx tsc --noEmit",
    "lint": "npx eslint src/ --max-warnings 0",
    "test": "npx vitest run --reporter=verbose",
    "custom": [
      { "name": "build", "command": "npm run build" }
    ],
    "instruction": "Run ALL verification commands after implementation. Fix any failures before reporting completion. Do not suppress warnings."
  }
}
```

#### Step 4.2: Add verificationCommands to manifest schema

**File**: `backup/taskplex/manifest-schema.json`

The `buildCommands` field already exists. No schema change needed — just ensure the orchestrator copies `manifest.buildCommands` into every handoff's `verification` block.

#### Step 4.3: Update handoff assembly in phase files

**File**: `backup/taskplex/phases/validation.md` (reviewer spawning sections)

For each reviewer spawn, include relevant verification commands:
- Security reviewer: include `lint` and `typecheck` commands
- Code reviewer: include all build commands
- Build-fixer: already receives build commands (confirm this is explicit, not assumed)

#### Step 4.4: Add verification instruction to implementation-agent

**File**: `backup/agents/core/implementation-agent.md`

Add to the agent's instructions:
```
## Self-Verification (MANDATORY)

Before reporting completion, run every command in the `verification` block of your handoff:
1. Run typecheck — fix all errors
2. Run lint — fix all warnings
3. Run tests — fix all failures
4. Run any custom commands

Do NOT report completion if any verification command fails.
```

#### Verification

- [ ] Handoff contract includes verification block
- [ ] Orchestrator populates verification from manifest.buildCommands
- [ ] Implementation agent runs verification before reporting done
- [ ] Build-fixer receives explicit commands (not just error context)

---

## Implementation Priority & Sequencing

### Phase 1: Quick Wins (1-2 tasks)
1. **Gap 3** — Narrative progress artifact (lowest effort, improves every session resume)
2. **Gap 4** — Verification commands in handoffs (small contract change, measurable quality impact)

### Phase 2: Core Enhancement (1 task)
3. **Gap 1** — Playwright MCP integration (requires package install + agent updates, but high impact for UI projects)

### Phase 3: Ecosystem Feature (1 task)
4. **Gap 2** — Drift detection (new agent + command + hook integration, broader scope)

---

## Files Changed Summary

| Gap | Files Modified | Files Created |
|-----|---------------|---------------|
| 1 | `settings.json`, `e2e-reviewer.md`, `qa.md`, `validation.md`, `evaluate/skill.md`, `evaluate/modes/audit.md` | — |
| 2 | `tp-session-start.mjs`, `manifest-schema.json`, `evaluate/modes/audit.md` | `agents/utility/drift-scanner.md`, `commands/drift.md` |
| 3 | `tp-heartbeat.mjs`, `tp-session-start.mjs`, `tp-pre-compact.mjs` | — |
| 4 | `handoff-contract.md`, `implementation-agent.md`, `validation.md` | — |

**Total**: 13 files modified, 2 files created
