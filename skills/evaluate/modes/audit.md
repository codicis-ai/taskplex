# Audit Mode

Investigate what exists from the user's perspective. Produce a frank assessment grounded in what a real user would experience, not what a developer would debug.

The output should read like a product review, not a bug report. Technical root causes are useful context but they belong in a "Technical Notes" appendix, not in the main assessment. Lead with what the user sees, feels, and fails to accomplish.

## Process

### 1. Gather Context

Choose the inspection approach that fits the product type:

**UI Apps (web, desktop, mobile) — if a URL or running app is available:**
```bash
agent-browser open {url}
agent-browser snapshot                    # Full accessibility tree
agent-browser console                     # Runtime warnings/errors
```

For each view/route/tab:
```bash
agent-browser click @{nav-ref}            # Navigate to view
agent-browser snapshot                    # Accessibility tree of this view
```

**UI Apps — if no URL available:**
- Read the main entry component and trace the view tree
- For each view, describe what a user would see based on the component rendering logic
- Note where data would be missing and what the empty/default state looks like

**CLIs:**
- Run `--help` and examine the output structure, flag naming, descriptions
- Try the core commands with typical inputs
- Try edge cases: no args, bad args, missing files, piped input
- Check stderr vs stdout separation, exit codes, color/formatting

**APIs / Services:**
- Read the route definitions and handler signatures
- Check error response format consistency
- Look at authentication flow, rate limiting, versioning
- Examine OpenAPI/Swagger docs if they exist
- Check SDK ergonomics if a client library exists

**Libraries / Modules:**
- Read the public API surface (exports, types)
- Check the README / docs against actual API
- Look at import ergonomics, naming conventions, type safety
- Scan for breaking-change risks in the API surface

**Data / Infrastructure:**
- Read pipeline definitions, job configs
- Check monitoring, alerting, failure handling
- Look at retry logic, idempotency, data validation

### 2. Product-Type-Adapted Questions

For each surface of the product, answer these questions as if you are a first-time user:

**Universal questions (all product types):**
- What is this for? (Does it communicate its purpose?)
- How do I get started? (Is the onboarding clear?)
- What happens when things go wrong? (Error experience)
- What's confusing? (Ambiguous names, missing context, unclear next steps)

**Additional questions by product type:**

| Product Type | Key Questions |
|-------------|---------------|
| UI App | What do I see? What can I click? Is the information hierarchy clear? Do empty/loading/error states guide me? |
| CLI | Are commands discoverable? Is output scannable? Do flags make sense? Is it scriptable (exit codes, parseable output)? |
| API | Are endpoints intuitive? Are errors helpful? Is auth straightforward? Are docs accurate? Is the SDK idiomatic? |
| Library | Is the API surface obvious? Are types helpful? Is the import path clean? Are defaults sensible? |
| Infrastructure | Can I tell if it's healthy? What happens on failure? Is it observable (logs, metrics)? |

### 3. User Journey Analysis

Before diving into individual surfaces, map the intended user journeys:
- What is the user trying to accomplish with this product?
- What's the ideal first-time experience?
- What's the ideal returning-user experience?

Then evaluate: does the current product deliver on any of these journeys? Where does it break down?

For non-UI products, "user journey" still applies — it's just different:
- **CLI**: install → discover commands → run first command → interpret output → build into workflow
- **API**: find docs → get auth token → make first call → handle response → handle error → integrate
- **Library**: install → import → call first function → understand return types → handle edge cases

### 4. Surface-by-Surface Assessment

For each surface (view, command, endpoint, export), evaluate from the user's perspective:

| Category | Question |
|----------|----------|
| Purpose clarity | Can a new user understand what this does within seconds? |
| Value delivery | Does this surface help the user accomplish something useful right now? |
| Empty/zero states | When there's no data or input, is the user guided? |
| Error states | When something goes wrong, does the user know what happened and what to do? |
| Feedback | Does the product respond to user actions? Loading, transitions, confirmations? |
| Discoverability | Can users find this? Is it named in a way they'd expect? |
| Information hierarchy | Is the most important information the most prominent? |
| Accessibility | Can this be used with assistive technology? Keyboard-navigable? Proper contrast? Semantic markup? Screen reader friendly? |

### 5. Accessibility Check

This applies to all product types, not just UIs:

**UI Apps:**
- Semantic HTML (headings, landmarks, labels)
- Keyboard navigation (tab order, focus indicators, no keyboard traps)
- Color contrast (WCAG AA minimum: 4.5:1 for text, 3:1 for large text)
- Screen reader compatibility (alt text, aria labels, live regions)
- Responsive behavior (does it work at different viewport sizes?)

**CLIs:**
- Screen reader compatible output (not relying solely on color)
- `--no-color` flag or `NO_COLOR` env support
- Parseable output mode (JSON, TSV) for automation/accessibility tools

**APIs:**
- Error messages that are descriptive (not just codes)
- Documentation accessible to screen readers

Note: this is a spot-check, not a full accessibility audit. Flag obvious issues and recommend a thorough audit if problems are found.

### 6. Code Analysis (supporting evidence only)

Read the code to understand WHY the user experience is what it is — but frame findings in terms of user impact, not implementation details.

Instead of: "The serde serialization uses snake_case but TypeScript expects camelCase"
Write: "The dashboard shows no data on launch because the backend data doesn't reach the frontend"

Instead of: "The CLI uses println! instead of eprintln! for errors"
Write: "Error messages get mixed into the normal output, breaking piped workflows"

Code-level details go in the Technical Notes appendix for developers who want to fix the issues.

### 7. Produce Report

Write `product/audit.md` with this structure:

```markdown
# Product Audit: {Subject}

**Date**: {date}
**Product type**: {UI App | CLI | API | Library | Infrastructure}
**Inspected at**: {URL, "ran locally", or "code review only"}
**Scope**: {component|feature|view|module|product}

## What This Product Should Do
{1-2 sentences describing the product's intended purpose, from the user's perspective}

## What a User Actually Experiences
{Walk through the first-time experience as a narrative. For a UI: open the app — what do you see? For a CLI: run --help — what do you learn? For an API: read the docs — can you make your first call? Where do you get confused, stuck, or give up? Tell it as a story.}

## Surface-by-Surface Assessment

### {Surface Name} (view / command / endpoint / export)
**Status**: Working | Empty | Broken | Partial
**What the user encounters**: {literal description}
**What the user needs**: {what this should help them accomplish}
**Gap**: {the distance between current reality and user need}
**Recommendations**:
- {User-facing improvement}

## Accessibility Findings
{Key accessibility issues found, or "No obvious issues — recommend thorough audit for production"}

## User Journey Gaps
{Where the product fails to deliver on its core purpose. Frame as user needs not met.}

## What's Working
{Genuine strengths — things to preserve and build on. Don't skip this.}

## Prioritized Recommendations
Ordered by user impact, not technical effort.

1. **{What the user should experience}** — {Why this matters to them}. {Brief note on what needs to change.}

## Verdict
{Is this ready for users? What would a user think if they tried this today? What needs to happen for the first user journey to work end-to-end?}

## Technical Notes (appendix)
{Implementation details, root causes, code references — for developers who will fix the issues above.}
```

### 8. Present in Terminal

Display the full report directly in the terminal conversation:
- Start with the verdict (don't bury the lede)
- "What a user actually experiences" story next
- Surface assessment with status and gap summary
- Accessibility findings
- Recommendations ordered by user impact
- Technical notes last, clearly separated

The report file at `product/audit.md` is for persistence — the terminal is the primary output. Do NOT generate a separate HTML visual summary.

## Scope Calibration

| Scope | Depth |
|-------|-------|
| Component | Check all user-facing states (default/hover/active/disabled/error/empty), 1 page |
| View | Full user walkthrough, data dependency trace for context, 2-3 pages |
| Product | All surfaces from user perspective, journey mapping, cross-cutting issues, accessibility spot-check, 5-10 pages |
