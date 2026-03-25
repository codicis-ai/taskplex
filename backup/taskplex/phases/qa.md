# taskplex: QA Phase (Phase 4.5)
<!-- Loaded by orchestrator after implementation, before validation. Self-contained. -->
<!-- v1: Product-type-aware QA with brief-driven journey testing -->

**The QA phase runs after implementation and before validation.** It answers: "does this actually work when you use it?" — not "does the code pass checks?" (that's validation's job).

**CRITICAL — Phase transition**: Immediately update manifest.json:
```json
manifest.phase = "qa"
```
Write manifest to disk NOW.

---

## Step 4.5.1: Detect Product Type & QA Strategy

Read `manifest.json` for project type, modified files, and task description.

**Determine QA approach:**

| Product Type | QA Method | How to detect |
|-------------|-----------|---------------|
| UI App (web) | Browser walkthrough | Routes, components, CSS in modified files; URL available |
| UI App (desktop) | Local launch + browser | Tauri/Electron in deps; desktop entry point |
| CLI | Run commands | CLI entry point in modified files; console_scripts / bin in package |
| API / Service | Call endpoints | Route handlers, controllers in modified files |
| Library / Module | **Skip QA** | Only exports/types changed; no runnable surface |
| Infrastructure | Health check | Pipeline/job configs, workers in modified files |

**Skip conditions** (log to `manifest.degradations` if skipping):
- `--skip-qa` flag → skip, log degradation
- Library/module with no runnable surface → skip, not a degradation
- No user-facing changes detected (pure refactor) → skip, not a degradation
- Product type undetectable → ask user: "Does this have a runnable surface I should test?"

**If skipping**: Set `manifest.qa.status = "skipped"`, update checklist, proceed to validation.

**Brief check**: Look for `product/brief.md` or `.claude-task/{taskId}/product/brief.md`. If found, extract core user journeys — these become QA test cases in Step 4.5.3. Record `manifest.qa.briefUsed = true`.

Initialize manifest QA fields:
```json
"qa": {
  "status": "in-progress",
  "method": "browser" | "cli" | "api" | "health-check" | "skipped",
  "briefUsed": false,
  "journeysTested": 0,
  "journeysPassed": 0,
  "edgeCasesTested": 0,
  "bugsFound": 0,
  "bugsFixed": 0,
  "fixRoundsUsed": 0,
  "unresolvedIssues": []
}
```

Update checklist: mark 4.5.1 complete.

---

## Step 4.5.2: Smoke Test

Before walking journeys, verify the basic thing works at all. This catches "it doesn't even start" before wasting time on detailed testing.

### By product type:

**UI App (web):**
```bash
# Start the dev server if not running
# (use manifest.buildCommands or detected defaults)
agent-browser open {url}
agent-browser snapshot          # Does anything render?
agent-browser console           # Runtime errors?
```
- Pass: Main view renders, no critical console errors
- Fail: Blank screen, crash, or error page

**CLI:**
```bash
{command} --help                # Does it respond?
echo $?                         # Exit code 0?
{command} {simplest-valid-args} # Does the primary command work?
echo $?
```
- Pass: Help outputs, primary command produces expected output
- Fail: Crash, traceback, or no output

**API / Service:**
```bash
# Start the server if not running
curl -s {base-url}/health       # Health endpoint?
curl -s -o /dev/null -w "%{http_code}" {base-url}/{primary-endpoint}
```
- Pass: Health responds, primary endpoint returns valid response
- Fail: Connection refused, 500, or no response

**Infrastructure:**
```bash
# Check if the service/pipeline is running
# Check logs for errors
# Verify basic health metrics
```

### If smoke test fails:
Report immediately. This counts as bug fix round 1 if a fix is attempted. Do NOT proceed to journey walkthrough until the smoke test passes or the user decides to skip.

Update manifest: `manifest.qa.smokeTest = "pass" | "fail"`
Update checklist: mark 4.5.2 complete.

---

## Step 4.5.3: Journey Walkthrough

This is the core of QA — walk the user's actual experience end to end.

### If `product/brief.md` exists:

Extract the core user journeys from the brief. For each journey:

1. Read the journey's steps (DOES / SEES / FEELS or DOES / GETS / FRICTION)
2. Execute each step against the live product
3. At each step, verify:
   - **Functional**: Does the step work? Does the right thing happen?
   - **Feedback**: Is there appropriate feedback? (loading states, confirmations, error messages)
   - **Design implication**: Does it meet the constraint from the brief's design implication column?

### If no brief exists:

Infer core journeys from the task description and modified files:
- What was the user trying to build? That's the happy path journey.
- What's the most common variation? Test that too.
- Aim for 2-3 journeys max.

### Journey execution by product type:

**UI App:**
```bash
agent-browser open {url}
# For each step in the journey:
agent-browser snapshot                    # What's on screen?
agent-browser click @{element}            # Take the action
agent-browser snapshot                    # Did the right thing happen?
agent-browser console                     # Any errors triggered?
```

**CLI:**
```bash
# For each step in the journey:
{command} {args-for-this-step}            # Execute the step
# Check: stdout has expected content?
# Check: exit code correct?
# Check: side effects occurred? (files created, data changed)
```

**API:**
```bash
# For each step in the journey:
curl -X {METHOD} {endpoint} \
  -H "Content-Type: application/json" \
  -d '{request body}'
# Check: response status code correct?
# Check: response body has expected shape?
# Check: side effects occurred? (DB state, events fired)
```

### Record results per journey:

```markdown
### Journey: {name}
**Source**: brief | inferred
**Status**: Pass | Partial | Fail
**Steps completed**: {n}/{total}
**Broke at**: {step description, if failed}
**Findings**:
- {what happened vs what should have happened}
```

Update manifest: increment `journeysTested`, `journeysPassed`.
Update checklist: mark 4.5.3 complete.

---

## Step 4.5.4: Edge Case Probing

After core journeys, probe edges. Keep this focused — 5-10 minutes max. This is a spot-check, not exhaustive testing.

### What to probe:

| Category | What to try | Why it matters |
|----------|-------------|---------------|
| Empty states | No data, first-time user, blank inputs | Most common real-world state |
| Error states | Invalid input, missing data, permission denied | Users will hit these |
| Boundary values | Long strings, special chars, zero, negative | Common source of crashes |
| Interruption | Refresh mid-flow, cancel mid-operation, back button | Real users do this |

### By product type:

**UI App:** Submit empty forms, navigate to routes with no data, refresh during loading, hit back button mid-flow.

**CLI:** Run with no args, run with invalid args, pipe in empty stdin, use very long arguments, interrupt with Ctrl+C.

**API:** Send empty body, send invalid JSON, omit required fields, use wrong content type, send extremely long values.

### Record results:

```markdown
| Edge Case | Result | Notes |
|-----------|--------|-------|
| {scenario} | Pass/Fail | {what happened} |
```

Update manifest: increment `edgeCasesTested`, `bugsFound` for any failures.
Update checklist: mark 4.5.4 complete.

---

## Step 4.5.5: Bug Triage & Fix Loop

If bugs were found in steps 4.5.2-4.5.4, triage and fix them.

### Triage by severity:

| Severity | Description | Action |
|----------|-------------|--------|
| **Blocker** | Core journey doesn't work at all | Fix immediately |
| **Major** | Journey works but with significant UX issue (missing feedback, wrong output, broken error handling) | Fix if within round budget |
| **Minor** | Cosmetic, edge case polish, non-critical formatting | Log for later, do NOT fix in QA |

### Fix loop rules:

1. **Max 3 fix rounds.** After 3, stop and report remaining issues.
2. Each round:
   a. Pick the highest-severity unfixed bug
   b. Fix it (edit the relevant files)
   c. Re-test the affected journey to verify the fix
   d. Quick-check that the fix didn't break other journeys (regression)
3. If a fix fails (introduces new bugs or doesn't resolve the issue):
   a. Revert the fix
   b. Log as unresolved: `manifest.qa.unresolvedIssues.push({description})`
   c. This still counts as a round
4. Minor bugs go straight to `unresolvedIssues` without attempting a fix

### Why cap at 3?

If it can't be fixed in 3 rounds, the issue is likely architectural — it needs to go back to planning, not more patching in QA. The cap prevents QA from becoming an open-ended debugging session.

Update manifest after each round: increment `fixRoundsUsed`, `bugsFixed`.
Update checklist: mark 4.5.5 complete with round count.

---

## Step 4.5.6: QA Report

Write `.claude-task/{taskId}/qa-report.md`:

```markdown
# QA Report: {task description}

**Date**: {date}
**Product type**: {UI App | CLI | API | Infrastructure}
**QA method**: {browser walkthrough | command execution | endpoint testing | health check}
**Brief used**: {yes — path | no — journeys inferred}

## Smoke Test
**Status**: Pass | Fail
**Notes**: {any issues encountered}

## Journey Results

| Journey | Source | Status | Steps | Notes |
|---------|--------|--------|-------|-------|
| {name} | brief/inferred | Pass/Partial/Fail | {n}/{total} | {summary} |

## Edge Cases

| Case | Result | Notes |
|------|--------|-------|
| {scenario} | Pass/Fail | {what happened} |

## Bugs Found & Fixed

| # | Bug | Severity | Status | Fix |
|---|-----|----------|--------|-----|
| 1 | {description} | Blocker/Major/Minor | Fixed/Unresolved/Deferred | {what was done} |

## Fix Rounds: {n}/3

## Unresolved Issues
{Numbered list of bugs not fixed — these carry into validation as known issues.
The code review agent in validation should be aware of these.}

## QA Verdict
**{Pass | Partial | Fail}**
{One sentence: "All core journeys work" | "Core works, edges have issues" | "Core journey broken — {which one}"}
```

### Present in terminal:

Display the QA verdict and journey table. Don't dump the full report — keep it concise:

```
QA Complete: {Pass|Partial|Fail}
  Journeys: {passed}/{tested} passed
  Edge cases: {passed}/{tested} passed
  Bugs: {found} found, {fixed} fixed, {unresolved} unresolved
  Fix rounds: {used}/3
  {If unresolved: "Unresolved: {brief descriptions}"}
```

### Gate behavior:

QA is **not a hard gate** — validation runs regardless. But:

- **QA Pass**: Proceed to validation normally.
- **QA Partial**: Proceed with warning. Unresolved issues noted in manifest for code reviewer.
- **QA Fail**: Ask user before proceeding:
  > "QA found that a core journey doesn't work: {description}.
  > The code review will flag this. Want to fix the blocker first, or continue to validation?"
  - **Fix first** → goes back to implementation for targeted fix, then re-runs QA (does NOT count as a new fix round — this is a full re-entry)
  - **Continue** → proceed to validation with QA fail logged

### Final manifest update:

```json
"qa": {
  "status": "pass" | "partial" | "fail",
  "method": "browser" | "cli" | "api" | "health-check",
  "briefUsed": true | false,
  "smokeTest": "pass" | "fail",
  "journeysTested": 3,
  "journeysPassed": 2,
  "edgeCasesTested": 5,
  "bugsFound": 4,
  "bugsFixed": 3,
  "fixRoundsUsed": 2,
  "unresolvedIssues": ["description..."],
  "reportPath": ".claude-task/{taskId}/qa-report.md"
}
```

Update checklist: mark 4.5.6 complete.
Proceed to Phase 5: Validation.
