# taskplex: Validation Pipeline (Phase 5)
<!-- Loaded by orchestrator after QA (Phase 4.5). Self-contained. -->
<!-- v2: Three-stage validation — Reviews → Hardening → Completion -->

**The validation pipeline runs after QA for EVERY execution mode.** It is the fan-in aggregation point — all parallel work converges here. The pipeline adapts based on quality profile and route.

## Validation Depth by Route

### Light Route
- Build checks (cargo check / npm run build / etc.)
- AC verification (do files exist that satisfy each acceptance criterion?)

### Standard Route
- Build checks
- AC verification
- **Tactical critic review** (mandatory — already ran in planning phase)
- **Journey verification** (trace ACs to code, detect orphaned endpoints)
- **Product smell test** (4 questions)

### Blueprint Route
- All of the above
- **Per-wave QA gate** (each wave validated before next begins)
- **Cross-wave integration check** (do waves work together?)
- **Strategic coherence check** (does final result match architect's spec?)

**QA context**: If `manifest.qa.status` exists and is not "skipped", read `.claude-task/{taskId}/qa-report.md` and pass unresolved issues to the code review agent so it has context about known QA findings.

**Policy reference**: `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/policy.json` for gate requirements and limits.

**Gate catalog**: `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/gates.md` — canonical gate names, verdict enums, execution order, manifest field mapping.

**Artifact contract**: `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/artifact-contract.md` — required artifacts by profile.

**Manifest schema**: `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/manifest-schema.json` — canonical field definitions.

**Gate decision logging**: Initialize `.claude-task/{taskId}/gate-decisions.json` at the start of validation. Append a decision entry after each gate completes.

**CRITICAL — Phase transition**: Immediately update manifest.json:
```json
manifest.phase = "validation"
```
Write manifest to disk NOW. Emit trace span for phase transition.

Also increment `manifest.iterationCounts.validationPipelineRuns` at the START of the pipeline.

---

## Manifest Writeback Protocol (MANDATORY)

**After EVERY check completes**, you MUST immediately update `manifest.validation.{field}` with the result and write manifest.json to disk.

Pattern for each step:
```
1. Run the check/spawn the agent
2. Get the result (PASS/FAIL/WARN/APPROVED/skipped)
3. Read manifest.json
4. Set manifest.validation.{field} = "{result}"
5. Write manifest.json
6. Append to gate-decisions.json
```

---

# Stage 1: Review Gates

## Step 0: Artifact Validation Gate (ALL — mandatory)

Before running any validation step, verify all required artifacts exist and are non-empty.

**Gate logic:**
1. Read manifest.json for executionMode and modifiedFiles
2. Check each required artifact exists and has size > 0
3. If any missing: set manifest status to `blocked:missing-artifacts`, list missing items, **STOP**
4. If all present: continue to Step 1

## Step 0.5: Traceability Gate (standard + enterprise profiles)

**Skip for lean profile.** Build or update `traceability.json` as the resolved evidence matrix from success contract → success map → worker evidence → verification → reviews.

**Validation action**:
1. Read `success-criteria.json` and `success-map.json`
2. Read `pipeline/*/worker-evidence.json` if present
3. Read `qa-report.md` and reviewer outputs
4. For each `SC-*`, resolve:
   - planned code targets
   - actual changed files
   - verification evidence
   - final status: `SATISFIED`, `PARTIAL`, `MISSING`, or `UNSCORABLE`
5. Write `.claude-task/{taskId}/traceability.json`

**Gate logic:**
- Any high-priority `MISSING` success criterion → validation FAIL
- `PARTIAL` allowed only with explicit degradation / override policy
- All high-priority items `SATISFIED` and no major unmapped files → PASS

Update manifest: `validation.traceability`.

## Step 0.75: Workflow Eval Gate (standard + enterprise profiles)

After reviewer passes, write `workflow-eval.json` to score the process itself:
- route fit
- architect necessity
- research necessity
- contract quality
- mapping quality
- review yield
- unnecessary escalation
- unmapped file risk

Update manifest: `validation.workflowEval`.

## Step 1: Build Validation (ALL)

Run **resolved** build commands from `manifest.buildCommands`:
```
# Use manifest.buildCommands.typecheck
# Use manifest.buildCommands.lint
# If manifest.buildCommands.format exists, also run it
# If manifest.buildCommands.custom[] has entries, run each
```

If build fails:
**Before spawning**: Run Memplex Context Assembly (see planning.md) for the failing files. Include error resolutions for the specific errors if memplex available.
> Spawn build-fixer (sonnet) from ${CLAUDE_PLUGIN_ROOT}/agents/build-fixer.md
  Context: error output, modified files, spec.md + Known Context block (if memplex available)
  Returns: "Fixed {N} issues. Build: PASS|FAIL"

Build-fix rounds capped by policy `limits.buildFixRounds`.

**On build-fix limit reached**: The build-fixer (or implementation agent) writes a structured escalation report. The orchestrator MUST:
1. Read the escalation file from `.claude-task/{taskId}/escalation-*.json`
2. Append to `manifest.escalations[]` with the full structured report
3. Set `manifest.status = "blocked"` with the escalation type
4. Log a degradation entry
5. Decide based on the `recommendation` field:
   - `accept-with-limitations` → continue validation with degradation logged
   - `revise-approach` → pause and present to user
   - `decompose` → suggest task decomposition to user
   - `reassign` / `defer` → present options to user

### Test Execution (ALL, after typecheck+lint pass)

- No test command or "no tests found" → `manifest.validation.tests = "skipped"`
- Tests pass → `manifest.validation.tests = "passed"`
- Tests fail → treat as build failure, spawn build-fixer

Update manifest: `validation.typecheck`, `validation.lint`.

## Step 1b: Convention Compliance Checks (ALL, after build)

If `conventions.json` exists, run structured convention compliance checks (orchestrator action):
- **Naming Check**: Grep modified files for naming violations
- **Structure Check**: Verify new files in correct directories
- **Pattern Check**: Spot-check modified files for pattern compliance

Budget: Max 10-15 Grep/Glob calls total.

Update manifest: `validation.conventionCompliance`.

## Review Quality Protocol (applies to Steps 2-5)

**After each reviewer writes its report**, the orchestrator runs a quick evidence quality check BEFORE accepting the review. This catches shallow "PASS — looks good" reports before they satisfy the artifact gate.

```
For each reviewer report:
  1. Read the review file
  2. Count file:line citations (Grep for patterns like [file.ts:42] or `file.ts` line N)
  3. Check minimum evidence thresholds:
     | Review Type | Min Citations for PASS | Min for APPROVED |
     |---|---|---|
     | security.md | 3+ | — |
     | closure.md | 1 per AC in brief | — |
     | code-quality.md | 5+ | 5+ |
     | database.md | 2+ | — |
     | e2e.md | 1 per journey tested | — |
  4. IF below threshold AND verdict is PASS/APPROVED:
     - Feed back: "Review lacks evidence. {N} citations found, {M} required.
       Re-run with specific file:line references for each finding."
     - Re-spawn the reviewer with the feedback. Max 1 re-run for quality.
  5. IF still below threshold after re-run:
     - Accept the review but flag as degradation:
       manifest.degradations.push({ type: "thin-review", reviewer: "{name}", citations: N })
  6. VERDICT-FINDINGS MISMATCH CHECK (most important):
     - Scan the review for "Must Fix", "P0", "CRITICAL", "unfixed", "remaining"
     - IF any unfixed must-fix items found AND verdict is PASS/APPROVED:
       → REJECT the review immediately. Do NOT accept it.
       → Feed back: "Review lists {N} unfixed Must Fix items but verdict is PASS.
         Fix ALL Must Fix items, then re-review. A PASS verdict with unfixed
         Must Fix items is a contradiction."
       → Re-spawn the reviewer with the feedback + instruction to fix items first
     - IF the reviewer returns PASS again with unfixed items:
       → The review stands as FAIL regardless of what the reviewer says
       → The orchestrator overrides: manifest.validation.{field} = "FAIL"

  7. NO-DEFERRAL CHECK:
     - Scan for "low risk", "defer", "polish", "cosmetic", "future improvement"
     - IF issues are being deferred that were found during THIS task:
       → Feed back: "All issues found must be fixed. Only pre-existing
         unrelated issues may be deferred. Fix or reclassify."
```

**Budget**: 1 Read + 2 Grep per review file. This is a 10-second check, not a re-review.

This does NOT replace the compliance agent's full cross-validation (Step 8). It catches the most obvious shortcuts and verdict-findings mismatches immediately.

---

## Step 2: Security Review (ALL — mandatory)

> Spawn security-reviewer (sonnet) from ${CLAUDE_PLUGIN_ROOT}/agents/security-reviewer.md
  Context: manifest.json (modified files list), OWASP focus areas
  Writes: .claude-task/{taskId}/reviews/security.md
  Returns: "PASS" | "WARN" | "FAIL"

**After return**: Run Review Quality Protocol. If thin, re-spawn once.

Track re-submissions in `manifest.iterationCounts.reviewRounds.security`.

Update manifest: `validation.security`.

## Step 3: Closure — Requirements + Intent Verification (ALL)

> Spawn closure-agent (haiku) from ${CLAUDE_PLUGIN_ROOT}/agents/closure-agent.md
  Context: manifest.json, brief.md, spec.md, worker status files
  Writes: .claude-task/{taskId}/reviews/closure.md
  Returns: "PASS" | "FAIL: {what's missing}"

**After return**: Run Review Quality Protocol. Closure needs 1 citation per AC.

Update manifest: `validation.closure`.

## Step 4: Code Review (Standard + Blueprint routes — skip for lean profile)

> Spawn code-reviewer (sonnet) from ${CLAUDE_PLUGIN_ROOT}/agents/code-reviewer.md
  Context: task intent, spec.md, changed files list, CONVENTIONS.md, CLAUDE.md
  Writes: .claude-task/{taskId}/reviews/code-quality.md
  Returns: "Verdict: APPROVED|NEEDS_REVISION. {N} issues, {M} convention violations."

**After return**: Run Review Quality Protocol. Code review needs 5+ citations.

Track re-submissions in `manifest.iterationCounts.reviewRounds.codeReview`.

Update manifest: `validation.codeReview`.

## Step 5: Conditional Reviewers (triggered by file patterns)

**Database Reviewer** — triggers when SQL, migration, or schema files modified:
> Spawn database-reviewer (sonnet) from ${CLAUDE_PLUGIN_ROOT}/agents/database-reviewer.md
  Context: manifest.json (modified files), database schema files
  Writes: .claude-task/{taskId}/reviews/database.md
  Returns: "PASS" | "WARN" | "FAIL"

**E2E Reviewer** — triggers when UI components/pages modified:
> Spawn e2e-reviewer (sonnet) from ${CLAUDE_PLUGIN_ROOT}/agents/e2e-reviewer.md
  Context: manifest.json (modified files), dev server URL
  Writes: .claude-task/{taskId}/reviews/e2e.md
  Returns: "PASS" | "WARN" | "FAIL" | "SKIP"

**User Workflow Reviewer** — triggers when navigation/routing files modified:
> Spawn user-workflow-reviewer (haiku) from ${CLAUDE_PLUGIN_ROOT}/agents/user-workflow-reviewer.md
  Context: manifest.json (modified files), routing/nav config
  Writes: .claude-task/{taskId}/reviews/user-workflow.md
  Returns: "PASS" | "WARN"

## Step 5.5: Enterprise Conditional Gates (enterprise profile only)

**Skip for lean and standard profiles.**

### E1: Dependency/License Compliance
**Trigger:** lockfile, package.json, Cargo.toml, or requirements.txt changed.
Run `npm audit`, `cargo audit`, or `pip-audit`. Check license denylist.
**Output:** `reviews/dependency-compliance.md`

### E2: Migration Safety
**Trigger:** SQL, migration, or schema files changed.
Extends database reviewer with rollback paths, destructive change flags, backfill plans.
**Output:** `reviews/migration-safety.md`

### E3: Observability Readiness
**Trigger:** New endpoint, background job, or critical workflow added.
Grep for error logging, metrics/telemetry in new paths.
**Output:** `reviews/operability.md`

## Step 5.7: Custom Gates (from conventions.json — ALL)

If `manifest.customGates` has entries, run each after standard gates, before compliance.

## Step 5.8: Extension Agents (from conventions.json — validation phase)

If `manifest.extensions.agents` has entries with `phase: "validation"`, spawn each.

## Step 6: Build-Fixer (if any reviewer found issues)

If any reviewer returned FAIL or NEEDS_REVISION:
> Spawn build-fixer (sonnet) from ${CLAUDE_PLUGIN_ROOT}/agents/build-fixer.md

After fixing: re-run the specific reviewer that failed.

**On review re-submission limit reached** (per policy `limits.reviewResubmissions`):
Write escalation report to `manifest.escalations[]`:
```json
{
  "type": "review-deadlock",
  "source": "reviewer:{focus}",
  "severity": "high",
  "attempts": [
    { "round": 1, "issuesFound": "...", "fixesApplied": "...", "result": "FAIL" },
    { "round": 2, "issuesFound": "...", "fixesApplied": "...", "result": "FAIL" }
  ],
  "rootCause": "Analysis of why the review keeps failing",
  "recommendation": "revise-approach|accept-with-limitations",
  "recommendationDetail": "Specific explanation",
  "blocking": ["compliance"],
  "timestamp": "ISO"
}
```
Log degradation. Present escalation to user with resolution options.

## Step 7: Readiness Verdict (enterprise profile only)

**Skip for lean and standard profiles.** Aggregates all validation results into production-readiness verdict.

Write `readiness.json` with verdict logic: All PASS → PASS, Any FAIL → FAIL, WARN with approval → PASS_WITH_ACCEPTED_RISK.

Update manifest: `validation.readiness`.

---

## Journey Verification (MANDATORY — runs after implementation, before validation sign-off)

### Step 1: Trace user journeys to code
For EACH user story or acceptance criterion in the brief:
1. Identify the API endpoint(s) involved
2. Verify the endpoint handler exists (grep for route path)
3. If `manifest.frontendParity.required`:
   - Verify a frontend file references the endpoint (grep frontend dirs for the API path)
   - If no frontend consumer found: **JOURNEY BROKEN** — log gap

### Step 2: Detect orphaned endpoints
1. Grep all new routes added during this task (diff against manifest.modifiedFiles)
2. For each new route: check if ANY frontend file references it
3. Orphaned endpoints (no consumer) are logged as gaps

### Step 3: Report
The orchestrator MUST output:
```
Journey Verification:
- Endpoints added: {N}
- Frontend consumers found: {M}
- Orphaned endpoints: {N-M}
- User journeys traced: {J_total}
- Journeys complete: {J_complete}
- Journeys with gaps: {J_gaps}
```

If `J_gaps > 0`: QA FAILS. Return to implementation with gap list.
If `J_gaps == 0`: QA PASSES. Proceed to validation.

### Step 4: Product Smell Test
Before declaring the task complete, the orchestrator asks:
1. "If I were a new user, could I use every feature I just built?"
2. "Does every API endpoint have at least one consumer?"
3. "Can I trace a user action to a visible result on every platform?"
4. "Would I ship this to a paying user today?"

If ANY answer is "no": task is NOT complete. Return to implementation.

---

# Stage 2: Hardening

**Previously a separate phase file (hardening.md). Now integrated as Stage 2 of validation.**

## Step 7.5: Hardening (standard + enterprise profiles)

**Policy**: `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/policy.json` for profile requirements.
**Check catalog**: `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/hardening-checks.md` for check registry, risk profiles, red-lines, scorecard.

### When Hardening Runs

| Profile | Behavior |
|---------|----------|
| **lean** | **Skip entirely.** Log skip to gate-decisions.json with `verdict: "SKIP"`. |
| **standard** | Automated failures produce warnings. Human checklist is advisory. Red-line violations block. |
| **enterprise** | Automated failures block completion. Required human checklist items must be acknowledged. |

**Skip conditions**: Profile is lean, OR task modified 0 source files.

### Hardening Process

1. **Resolve requirements**: Read profile, conventions.json hardening section, determine risk profile
2. **Discover tools**: Check for CLI tools (npm audit, pip-audit, trivy, gitleaks, semgrep, etc.), browser MCP, cloud MCPs
3. **Run automated checks (Level 1)**: Per check catalog, run each available tool. See `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/hardening-checks.md`
4. **Build human checklist (Level 2)**: Items that couldn't be automated
5. **Evaluate red lines**: Check against red-line rules per profile
6. **Compute readiness scorecard**: Weighted score from Level 1 results
7. **Write hardening report**: To `.claude-task/{taskId}/hardening/` (report.md, gate-decision.json, individual reports)
8. **Present results**: Profile-specific blocking behavior

> Spawn hardening-reviewer (sonnet) from ${CLAUDE_PLUGIN_ROOT}/agents/hardening-reviewer.md
  Context: manifest.json, conventions.json (hardening section), modified files, capability map
  Writes: .claude-task/{taskId}/hardening/ (report.md, gate-decision.json, individual reports)
  Returns: "HARDENING: {verdict}. SCORE: {N}/{threshold}. AUTOMATED: {passed}/{total}. HUMAN: {N} items."

After hardening completes:
```json
manifest.validation.hardening = "PASS" | "WARN" | "FAIL"
manifest.hardeningScore = { "total": N, "threshold": T }
```

---

# Stage 3: Completion

**Previously a separate phase file (completion.md). Now integrated as Stage 3 of validation.**

## Step 8: Compliance Agent — Final Gate (ALL — mandatory, runs LAST)

> Spawn compliance-agent (haiku) from ${CLAUDE_PLUGIN_ROOT}/agents/compliance-agent.md
  Context: all review files, manifest.json, CONVENTIONS.md, brief.md
  Writes: .claude-task/{taskId}/reviews/compliance.md
  Returns: "PASS" | "FAIL: {what's wrong}"

The compliance agent audits:
- **Process compliance**: Did all required workflow steps run?
- **Convention compliance**: Did the output follow CONVENTIONS.md?
- **Session integrity**: Are trace events valid? Phase transitions sequential?
- **Failure resolution**: Are all manifest.failures resolved?

Track in `manifest.iterationCounts.reviewRounds.compliance`. Cap per policy `limits.reviewResubmissions`.

**Nothing passes without compliance PASS.**

Update manifest: `validation.compliance`.

## Step 9: Update Validation Gate

After compliance passes, write `.claude-task/{taskId}/validation-gate.json`:
```json
{
  "allPassed": true,
  "qualityProfile": "lean|standard|enterprise",
  "completedAt": "ISO timestamp",
  "checks": {
    "typecheck": "passed",
    "lint": "passed",
    "tests": "passed|skipped",
    "conventionCompliance": "passed|partial|N/A",
    "security": "PASS",
    "closure": "PASS",
    "codeReview": "APPROVED|N/A",
    "customGates": "passed|N/A",
    "extensionAgents": "passed|N/A",
    "hardening": "PASS|WARN|N/A",
    "compliance": "PASS",
    "traceability": "PASS|N/A",
    "readiness": "PASS|PASS_WITH_ACCEPTED_RISK|N/A"
  },
  "degradationCount": 0,
  "git": {
    "branch": null,
    "baseBranch": null,
    "incrementalCommitsCount": 0
  }
}
```

- `degradationCount` from `manifest.degradations` array length

**Enterprise finalization**: Update `readiness.json` with compliance result.

## Step 10: Git Integration

**If `manifest.git.available === false`**: Skip G1-G6 entirely. Proceed to Post-Completion.

### G1: Resolve Git Config
Read `manifest.git.config` from init Step 4e.

### G2: Build Commit Message
Build based on `commitFormat` (conventional/simple/custom/fallback).

### G3: Final Commit
1. Stage `manifest.modifiedFiles` individually — **NEVER** `git add .`
2. Exclude `.claude-task/` artifacts
3. Pre-commit hook verifies `validation-gate.json`
4. `git commit -m "{message}"`
5. Record commit hash in `manifest.git.commits[]`

### G4: Push Confirmation (always ask)
`AskUserQuestion`: "Push changes to remote?"
- If createPR: **Push & create PR** / **Push only** / **Skip**
- Otherwise: **Push** / **Skip**

### G5: PR Creation (conditional)
**Skip if**: `createPR === false` OR push skipped OR no remote OR no `gh` CLI.

Build PR title and body (tiered by profile). Create via `gh pr create`. Store `manifest.git.prUrl` and `manifest.git.prNumber`.

## Step 11: Post-Completion

1. **Deferred convention bootstrap** (if `manifest.conventionBootstrapPending === true`):
   - Present convention drafts to user if available
2. Increment `tasks-since-refresh` counter in CONVENTIONS.md
3. **Project phase transition**: If PRD complete, set `project-phase: established`
4. **Memplex knowledge persistence** (if `manifest.memplexAvailable === true`):
   Save knowledge discovered during this task for future sessions:

   a. **File coupling**: For each set of files that were modified together (from `manifest.modifiedFiles`), write a coupling entry:
      `write_knowledge({ type: "file_coupling", files: [...], project: "{project}", reason: "Modified together in TASK-{id}" })`

   b. **Error resolutions**: For each error resolved during build-fix rounds (from `manifest.escalations` and build-fixer results), write a resolution:
      `write_knowledge({ type: "error_resolution", error: "{pattern}", resolution: "{fix}", file: "{file}", project: "{project}" })`

   c. **Patterns**: For significant architectural decisions from the design phase (from brief.md approach selection):
      `write_knowledge({ type: "pattern", description: "{decision}", rationale: "{why}", area: "{target area}", project: "{project}" })`

   d. **Decisions**: For user decisions that affect future tasks (from `manifest.designInteraction`):
      `write_knowledge({ type: "decision", description: "{what was decided}", context: "{why}", project: "{project}" })`

   Record counts in `manifest.knowledgeSaved`: `{ fileCouplings: N, errorResolutions: M, patterns: P, decisions: D }`

   **If memplex not available**: Skip. No error, no degradation.

5. **Skill evolution** (if signals detected — see `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/skill-evolution.md` for full spec):

   **Signal detection** (keyword-based, no LLM cost):
   - Check `manifest.iterationCounts.buildFixRounds >= 2`
   - Check `manifest.escalations.length > 0`
   - Check `manifest.qa.bugsFound > 2`
   - Check `manifest.iterationCounts.reviewRounds.{any} > 1`
   - Check for user correction patterns in design interaction history

   **If signals exceed threshold AND `manifest.workflow` identifies an active skill:**
   a. Determine skill name from `manifest.workflow` ("taskplex", "plan", "evaluate")
   b. Read `~/.claude/skills/{skill}/skill.md` (or `SKILL.md`)
   c. Read `${CLAUDE_PLUGIN_DATA}/evolutions/{skill}.json` (if exists)
   d. Generate evolution entry (LLM call — see skill-evolution.md for prompt template)
   e. Write/append to `${CLAUDE_PLUGIN_DATA}/evolutions/{skill}.json`
   f. If memplex available: `write_knowledge` with the evolution for cross-session search
   g. Record in manifest: `manifest.skillEvolution = { skill, evolutionId, type, signal }`
   h. Note in task summary: "Skill evolution: {type} — {title}"

   **If no signals exceed threshold**: Skip. Most tasks won't trigger evolution — this is by design.

6. Update session file: `status: "completed"`, `completedAt: ISO`, emit `task-complete` trace span
7. Update manifest: `status: "completed"`, `phase: "validation"` (phase stays validation — no separate completion phase)
8. **Product brief validation** (if `product/brief.md` exists):
   Check whether a product brief exists at `product/brief.md` or `.claude-task/{taskId}/product/brief.md`.
   If found, suggest review via `AskUserQuestion`:
   > "A product brief exists for this area. Want to validate the implementation against it?
   > This checks whether what we built delivers the contract defined in the brief."
   >
   > Options: **Yes, validate** / **Skip**

   If **Yes**: Read `~/.claude/skills/evaluate/modes/review.md` and execute review mode inline. Load the brief and validate the implementation against its contract, journeys, and scope. Write results to `product/review.md` and present in terminal.
   If **Skip**: Proceed to summary.

### Unified Task Summary (ALL profiles)

Present a single consolidated summary:

```
Task Complete: {task description}
Profile: {lean|standard|enterprise} | Route: {light|standard|blueprint}

Requirements: {covered}/{total} met ({partial} partial)
Build:        {PASS|FAIL} — typecheck {status}, lint {status}, tests {status}
Security:     {PASS|WARN} — {summary}
Conventions:  {PASS|WARN|N/A}
Files changed: {N} files

{IF hardening ran:}
Hardening:    {PASS|WARN|FAIL} — score {N}/{threshold}

{IF degradations > 0:}
Degradations: {N} events ({types})

{IF overrides:}
Overrides:    {N} user overrides logged

{IF human checklist items:}
Next steps:   {N} items need human verification

{IF skillEvolution:}
Skill evolution: {type} — {title} (run /solidify to review)

{IF git:}
Branch:  {branch} (from {baseBranch})
Pushed:  yes/no
PR:      {prUrl} (or "not created")

{IF memplexAvailable AND knowledgeSaved:}
Knowledge saved: {fileCouplings} file couplings, {errorResolutions} error resolutions, {patterns} patterns, {decisions} decisions

{IF NOT memplexAvailable AND (modifiedFiles > 3 OR buildFixRounds > 0):}
Patterns discovered: {N} file couplings, {M} error resolutions. Cross-session knowledge persistence requires memplex.
```

**Profile additions**: Standard: + code review verdict. Enterprise: + readiness verdict + enterprise gates.

### Metrics

Write `.claude-task/{taskId}/metrics.json` with task stats (agent spawns, validation rates, cycle time, etc.).

Update `.claude-task/metrics/aggregate.json` with running averages.

### Cleanup

1. **Delete stale plan files**: Remove `~/.claude/plans/*.md` files that were created for this task. Claude Code auto-injects any plan file in `~/.claude/plans/` into every future session's context — stale plans waste context tokens. Use `fs.readdirSync` + `fs.unlinkSync` to clean up. Log the count of files deleted.

2. Archive completed task artifacts for audit trail.
