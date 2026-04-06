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

## Step 4.5.1b: Apply Migrations (MANDATORY if migration files exist)

Before any QA testing, database migrations must be applied. QA tests the running application — if migrations haven't been applied, every endpoint/query test fails.

**Check**: Scan `manifest.modifiedFiles` for migration patterns: `*.sql` in `migrations/` or `supabase/migrations/`, schema files, Prisma/Diesel migration files.

**If migration files found**:

1. **Detect migration tool** from project:
   - `supabase/` directory → `supabase db push` or `mcp__supabase__apply_migration`
   - `prisma/schema.prisma` → `npx prisma migrate dev`
   - `diesel.toml` → `diesel migration run`
   - Raw SQL → apply via `psql` or database CLI
   - If tool cannot be determined → ask user

2. **Apply the migration**:
   ```bash
   # Example for Supabase:
   supabase db push
   # Or via MCP if available:
   mcp__supabase__apply_migration
   ```

3. **Verify success**: Check exit code. If migration fails:
   - Log error to `manifest.progressNotes`
   - **BLOCK QA** — do not proceed to smoke test
   - Report to user: "Migration failed: {error}. QA cannot proceed until database is current."

4. **Write migration artifact** (MANDATORY — pre-commit hook checks for this):
   Write `.claude-task/{taskId}/migration-applied.json`:
   ```json
   {
     "applied": true,
     "tool": "supabase|prisma|diesel|psql",
     "files": ["supabase/migrations/027_event_engine.sql"],
     "timestamp": "ISO",
     "output": "migration output summary"
   }
   ```
   This file is checked by the pre-commit hook. Without it, commits are blocked when migration files are in modifiedFiles.

5. **Log**: Add to `manifest.progressNotes`: "Migration applied: {file(s)}. Tool: {tool}."

**If no migration files found**: Skip this step. No artifact needed.

Update checklist: mark 4.5.1b complete.

---

## Step 4.5.1c: Start Dev Server (if product type requires it)

**For UI App (web) and API/Service product types**: The dev server must be running before smoke test, journey walkthrough, and e2e review. Start it now.

1. **Detect start command** from project:
   - `package.json` scripts: `dev`, `start`, `serve` → `npm run dev`
   - `Cargo.toml` with `actix-web`/`axum`/`rocket` → `cargo run`
   - `manage.py` → `python manage.py runserver`
   - If command cannot be determined → ask user

2. **Start in background**: Run the dev server and wait for it to be ready (check health endpoint or port availability, max 30 seconds).

3. **Record URL**: Set `manifest.qa.devServerUrl` for use by smoke test, journey walkthrough, and e2e-reviewer.

4. If server fails to start: **BLOCK QA** — report to user.

**For CLI, Library, Infrastructure**: Skip this step.

---

## Step 4.5.2: Smoke Test

Before walking journeys, verify the basic thing works at all. This catches "it doesn't even start" before wasting time on detailed testing.

### By product type:

**UI App (web):**

Detect browser tool: prefer Playwright MCP (`mcp__playwright__*`), fallback to `agent-browser` CLI, skip if neither available.

```
# With Playwright MCP (preferred):
mcp__playwright__browser_navigate → {url}
mcp__playwright__browser_screenshot → .claude-task/{taskId}/screenshots/smoke-test.png
mcp__playwright__browser_console → check for errors

# With agent-browser (fallback):
agent-browser open {url}
agent-browser snapshot
agent-browser console
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

## Step 4.5.3: Journey Walkthrough (Functional E2E Testing)

This is the core of QA — walk the user's actual experience end to end **with real test data**. This is not a visual check — it's a functional test that fills forms, submits data, verifies database state, and chains multi-step workflows.

### Journey Source

**If `product/brief.md` exists**: Extract core user journeys from the brief (DOES / SEES / FEELS steps).
**If spec has User Journeys section**: Use the journey tables directly.
**If neither exists**: Infer 2-3 journeys from the task description and modified files.

### For Each Journey — Three Phases

#### Phase A: Setup (before journey starts)

1. **Generate test data** for this journey:
   - Test user credentials: `e2e-test-{timestamp}@test.local` / `TestPass123!`
   - Test records: any data the journey needs to exist (e.g., existing tasks, projects, settings)
   - API tokens: if auth is required, obtain a valid token

2. **Ensure clean state**:
   - Remove any leftover test data from previous runs
   - Verify the app is in the expected starting state
   - Confirm dev server is running (from Step 4.5.1c)

3. **Write test data to** `.claude-task/{taskId}/e2e-test-data.json`:
   ```json
   {
     "journey": "user-registration",
     "testUser": { "email": "e2e-test-1712345@test.local", "password": "TestPass123!" },
     "testData": { ... },
     "createdAt": "ISO"
   }
   ```

#### Phase B: Execute Journey (step by step, with verification)

For each step in the journey, execute the FULL action — not just navigate and screenshot.

**UI App — Playwright MCP:**
```
For each journey step:

1. NAVIGATE (if needed):
   mcp__playwright__browser_navigate → {url}
   mcp__playwright__browser_screenshot → capture before state

2. INTERACT (fill forms, click buttons, select options):
   mcp__playwright__browser_fill_form → [
     { selector: '#email', value: 'e2e-test@test.local' },
     { selector: '#password', value: 'TestPass123!' }
   ]
   mcp__playwright__browser_click → '#submit-btn'

3. WAIT for result:
   mcp__playwright__browser_wait_for → navigation, element, or network idle

4. VERIFY the outcome:
   mcp__playwright__browser_screenshot → capture after state
   mcp__playwright__browser_snapshot → check DOM for expected elements
   mcp__playwright__browser_console_messages → check for errors

5. VERIFY data (if the step creates/modifies data):
   - API call: curl the relevant endpoint to confirm data was created
   - Or: mcp__playwright__browser_navigate to a page that shows the data
   - Or: database query via Bash if direct DB access available

6. CHAIN to next step:
   - Use data from this step (e.g., session token, created ID) in the next step
   - Do NOT navigate away and back — continue the user's natural flow
```

**API / Service:**
```bash
For each journey step:

1. EXECUTE the API call:
   RESPONSE=$(curl -s -w '\n%{http_code}' -X {METHOD} {endpoint} \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {token}" \
     -d '{request body with test data}')

2. VERIFY response:
   - Status code matches expected (201, 200, etc.)
   - Response body has expected shape and values
   - Extract data needed for next step (IDs, tokens, etc.)

3. VERIFY side effects:
   - Query the database or another endpoint to confirm state changed
   - Check that events were emitted (if event system exists)
   - Verify related records were created/updated

4. CHAIN to next step:
   - Pass created IDs, tokens, etc. to the next API call
```

**CLI:**
```bash
For each journey step:

1. EXECUTE command with test data:
   OUTPUT=$({command} {args-with-test-data})
   EXIT_CODE=$?

2. VERIFY output:
   - Exit code correct
   - Stdout contains expected content
   - Side effects occurred (files created, data changed)

3. CHAIN to next step:
   - Use output from this step as input to the next
```

#### Phase C: Cleanup (after journey completes or fails)

1. **Remove test data**:
   - Delete test user accounts created during the journey
   - Remove test records from the database
   - Clean up any files created during testing

2. **Log cleanup** to `.claude-task/{taskId}/e2e-test-data.json`: set `cleanedUp: true`

3. If cleanup fails: log warning but do not fail the journey — cleanup failures are non-blocking

### Screenshot Requirements

For UI journeys, capture screenshots at every state transition:
- `screenshots/journey-{name}-step{N}-before.png` — before the action
- `screenshots/journey-{name}-step{N}-after.png` — after the action
- `screenshots/journey-{name}-error.png` — if a step fails

### Record results per journey:

```markdown
### Journey: {name}
**Source**: brief | inferred | spec
**Status**: Pass | Partial | Fail
**Steps completed**: {n}/{total}
**Test data**: e2e-test-data.json
**Broke at**: {step description, if failed}

| Step | Action | Expected | Actual | Data Verified | Screenshot | Status |
|------|--------|----------|--------|---------------|------------|--------|
| 1 | Navigate /register | Form loads | Form loaded | — | step1-before.png | PASS |
| 2 | Fill email + password | — | — | — | — | PASS |
| 3 | Click Submit | Redirect to /login | Redirected | User in DB: yes | step3-after.png | PASS |
| 4 | Login with credentials | Redirect to /dashboard | Redirected | Session valid | step4-after.png | PASS |

**Findings**:
- {what happened vs what should have happened}

**Cleanup**: {completed | failed: reason}
```

Update manifest: increment `journeysTested`, `journeysPassed`.
Update checklist: mark 4.5.3 complete.

---

## Step 4.5.4: Adversarial Verification (MANDATORY — spawns verification agent)

Spawn the verification agent to actively try to break the implementation. This is not inline spot-checking — it's a dedicated adversarial agent that runs commands, tests endpoints, and probes boundaries. It cannot edit files.

> Spawn verification-agent (sonnet) from $TASKPLEX_HOME/agents/core/verification-agent.md
  Context: spec.md, brief.md, manifest.modifiedFiles, manifest.buildCommands, QA method (UI/CLI/API)
  Writes: .claude-task/{taskId}/reviews/verification.md
  Returns: "PASS: N checks, P probes, 0 failures" or "FAIL: Q bugs found"

The verification agent:
- Runs happy path checks (must execute commands, not read code)
- Runs at least 3 adversarial probes (boundary, concurrency, idempotency, injection, etc.)
- Produces evidence in command+output format (code reading rejected)
- Has anti-rationalization prompts to prevent skip-and-pass behavior

**If PASS**: Proceed to Step 4.5.5 (bug triage — which may have 0 bugs).
**If FAIL**: Bugs feed into Step 4.5.5 bug triage loop. The verification agent's findings are treated as blocker/major severity.

Update manifest: `manifest.qa.adversarialProbes = N`, `manifest.qa.adversarialFailures = M`.
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

### Fix agent strategy:

**Goal**: Preserve context between fix iterations. Spawning a cold agent that re-reads the spec from scratch wastes tokens and loses implementation understanding.

**For Standard/Blueprint routes** (agent-based):
1. **Round 1 fix agent**: Spawn a focused fix agent with:
   - The verification report (`.claude-task/{taskId}/reviews/verification.md`)
   - The original spec and brief (same as implementation agent received)
   - The modified files list
   - Specific bug descriptions and severity from triage
   - Instruction: "Fix these bugs. Do NOT re-implement — make targeted fixes only."
2. **Round 2+ fix agent**: Use `SendMessage` to continue the same fix agent if the runtime supports it (preserves context from round 1). If the runtime doesn't support agent continuation, spawn a new agent but include the round 1 fix summary alongside the remaining bugs.

**For Light route** (orchestrator-inline):
- Fix bugs directly — the orchestrator already has full context.

### Fix loop rules:

1. **Max 3 fix rounds.** After 3, stop and report remaining issues.
2. **Memplex error check** (if `manifest.memplexAvailable`): Before each fix attempt, call `get_error_resolution` for the bug's error pattern. If a known resolution exists, apply it directly — this may resolve the bug without a full debugging cycle. Store results in `manifest.memplexContext.qa`.
3. Each round:
   a. Pick the highest-severity unfixed bug
   b. Check for known resolution (step 2) — if found, apply directly
   c. If no known resolution: send to fix agent (or fix inline for Light route)
   d. Re-run verification agent on the affected journey to confirm the fix
   e. Quick-check that the fix didn't break other journeys (regression)
4. If a fix fails (introduces new bugs or doesn't resolve the issue):
   a. Revert the fix
   b. Log as unresolved: `manifest.qa.unresolvedIssues.push({description})`
   c. This still counts as a round
5. Minor bugs go straight to `unresolvedIssues` without attempting a fix

### Re-verification after fixes:

After each fix round, the **verification agent** re-checks — not the fix agent self-assessing. This maintains the adversarial separation:
- Fix agent fixes bugs
- Verification agent confirms fixes actually work
- If new bugs found during re-verify, they enter the next fix round

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
