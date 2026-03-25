# Review Mode

Validate implementation against criteria. Does it actually work?

## Process

### 1. Load References

Review mode validates against whatever criteria are available, in order of preference:

1. **`product/brief.md`** — the product brief (best: has jobs, emotional contract, scope)
2. **`product/spec.md`** — the design spec (has flows, states, component inventory)
3. **User-provided brief** via `--brief {path}`
4. **User-stated goals** — if the user says "review whether this search feature works well", that's enough to review against
5. **Inferred criteria** — if nothing above exists, derive review criteria from the codebase itself: README, code comments, test descriptions, and what the product appears to be trying to do

If using options 4 or 5, state your inferred criteria explicitly before reviewing so the user can correct them.

### 2. Extract Success Criteria

From the brief (if available), extract:
- Jobs-to-be-done (each becomes a test journey)
- Success metrics (each becomes a check)
- Scope boundaries (verify nothing out-of-scope crept in)
- Prioritized features (verify Kill/Fix/Keep/Build decisions were followed)

From the spec (if available):
- User flows (each becomes a walkthrough)
- State definitions (each state needs to be reachable)
- Component/surface inventory (each needs to exist and work)

From user-stated goals:
- Parse their request for implicit criteria
- Ask clarifying questions if the goals are too vague to review against

### 3. Live Walkthrough

Choose the right inspection method for the product type:

**UI Apps — if a URL is available:**
```bash
agent-browser open {url}
```

For each job-to-be-done:
1. Start at the entry point
2. Follow the expected flow step by step
3. At each step:
   - `agent-browser snapshot` — does the right content appear?
   - `agent-browser screenshot` — does it look right?
   - `agent-browser console` — any errors?
4. Reach the success state (or document where it fails)
5. Test edge cases: empty state, error state, refresh mid-flow

**CLIs:**
1. Run the command with expected inputs — does it produce the right output?
2. Run with edge cases — no args, bad args, missing files
3. Check exit codes — do they match conventions?
4. Check stderr vs stdout — is output correctly separated?
5. Test piping and scripting scenarios

**APIs:**
1. Call each endpoint with valid data — correct response shape?
2. Call with invalid data — helpful error messages?
3. Check auth flow — clear and functional?
4. Test edge cases — empty collections, not found, rate limits
5. Verify docs match actual behavior

**Libraries:**
1. Import and call the primary functions — do types work?
2. Check error cases — are errors typed and helpful?
3. Verify the README examples actually work
4. Check for breaking changes against the documented API

**Record results as:**
```markdown
### Journey: {Job name}
**Status**: Pass | Partial | Fail
**Steps completed**: {n}/{total}
**Broke at**: {step description, if failed}
**Evidence**: {screenshot ref, output, or response}
**Notes**: {qualitative observations}
```

### 4. State Coverage Check

For each surface in the spec, verify all defined states are reachable:

**UI:**

| View | Empty | Loading | Error | Partial | Full |
|------|-------|---------|-------|---------|------|
| {view} | pass/fail | pass/fail | pass/fail | pass/fail | pass/fail |

**CLI:**

| Command | Success | No results | User error | System error |
|---------|---------|-----------|------------|-------------|
| {cmd} | pass/fail | pass/fail | pass/fail | pass/fail |

**API:**

| Endpoint | 200 | 400 | 401 | 404 | 500 |
|----------|-----|-----|-----|-----|-----|
| {route} | pass/fail | pass/fail | pass/fail | pass/fail | pass/fail |

### 5. Scope Drift Check

Compare what was built against the brief's scope boundaries:

- **IN scope, built**: Expected
- **IN scope, not built**: Missing
- **OUT scope, built**: Scope creep
- **LATER scope, built**: Premature (check if it's actually working or just scaffolded)

### 6. Accessibility Spot Check

Quick accessibility review (not exhaustive):

**UI Apps:**
- Keyboard navigation works for core flows
- Focus indicators visible
- Color contrast passes for key text
- Screen reader can parse the main content areas

**CLIs:**
- Output doesn't rely solely on color
- `--no-color` or `NO_COLOR` supported

**APIs:**
- Error messages are descriptive text, not just codes

### 7. Regression Check

If a previous audit exists (`product/audit.md`), check:
- Were the P0 issues fixed?
- Were the P1 issues addressed?
- Did any new issues appear that weren't in the audit?

### 8. Produce Review Report

Write `product/review.md`:

```markdown
# Product Review: {Subject}

**Date**: {date}
**Product type**: {UI App | CLI | API | Library | Infrastructure}
**Reviewed against**: {brief.md / spec.md / user-stated goals / inferred criteria}
**Inspected at**: {URL / ran locally / code review}

## Scorecard

| Criterion | Status | Notes |
|-----------|--------|-------|
| {Job 1} | Pass/Partial/Fail | {note} |
| {Job 2} | Pass/Partial/Fail | {note} |

**Overall**: {Pass / Partial / Fail}

## Journey Walkthroughs
{Detailed results from step 3}

## State Coverage
{Table from step 4}

## Scope Compliance
{Results from step 5}

## Accessibility
{Results from step 6}

## Regressions
{Results from step 7, if applicable}

## Recommendations
{What to fix, in priority order}

## Verdict
{1 paragraph: Is this ready? What's blocking release?}
```

### 9. Present in Terminal

Display the full review directly in the terminal conversation:
- Scorecard table (criterion / status / notes)
- Journey walkthroughs with pass/fail per step
- State coverage table
- Scope compliance summary
- Accessibility findings
- Recommendations in priority order

The report file at `product/review.md` is for persistence — the terminal is the primary output. Do NOT generate a separate HTML visual summary.

**Browser only for before/after:** If comparing against a previous audit and the visual difference is significant, optionally generate a side-by-side HTML comparison using visual-explainer. But the detail stays in the terminal.

## Scope Calibration

| Scope | Review depth |
|-------|-------------|
| Component | Check all states render, interactions work, props are respected. Quick. |
| Feature | Walk the user journey, test edge cases, check data flow. 1-2 pages. |
| View | Full state coverage, content check, accessibility spot-check. 2-3 pages. |
| Product | All journeys walked, full state coverage, scope compliance, regression check, accessibility. 5-10 pages. |
