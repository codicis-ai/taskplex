# Spec Mode

Design how it should work. Produce an implementable design spec.

## Process

### 1. Load Prior Context

**Preferred inputs (use what's available):**
- A product brief (`product/brief.md`) — provides user profiles, journeys, and scope
- Current codebase understanding — read relevant source files
- Audit report (`product/audit.md`) — grounds the spec in current reality
- Existing specs, PRDs, or design docs in the project

**If no brief exists**, don't block. Instead:
- Ask the user what problem this solves and for whom (2-3 sentences is enough)
- Or infer from the codebase: README, existing code, and the user's request
- Note in the spec that it's based on inferred context, not a formal brief

A brief makes for a better spec, but requiring one creates unnecessary friction. The spec should still be useful even if the user just said "spec out the search feature."

### 2. Information Architecture

Map out what content and data exists at each level. Adapt to product type:

**For UI views/pages:**
- What data is displayed? Trace from store → component → render
- What actions can the user take?
- What states exist? (empty, loading, error, partial, full, overflow)
- What's the content hierarchy? (primary, secondary, tertiary)

**For CLI commands:**
- What's the command tree? (commands, subcommands, aliases)
- What flags/options does each command accept?
- What's the input format? (args, stdin, files, env vars)
- What's the output format? (human-readable, JSON, TSV, exit codes)
- How do commands compose? (piping, scripting)

**For API endpoints:**
- What's the resource hierarchy?
- What methods are available on each resource?
- What are the request/response shapes?
- What are the error codes and their meanings?
- How does pagination, filtering, and sorting work?

**For libraries/modules:**
- What's the public API surface?
- Who are the consumers? What do they need?
- What are the integration points?
- What types are exported?

**For data/infrastructure:**
- What's the data flow? Input → transform → output
- What are the failure modes and recovery paths?
- What are the observability hooks? (logs, metrics, traces)

### 3. User Flows

For each job-to-be-done (from the brief, or inferred from the user's request), map the user flow:

```
Trigger → Step 1 → Step 2 → ... → Success State
                ↓
            Error/Edge Case → Recovery Path
```

For each step:
- What does the user see / receive?
- What can they do?
- What happens next?
- What if something goes wrong?

If agent-browser is available and a URL exists, walk the flow live:
```bash
agent-browser open {url}
# Navigate through each step
# Screenshot at each state
# Note where the flow breaks or confuses
```

### 4. State Mapping

For each surface (view, command, endpoint), define all states:

**UI states:**

| State | Trigger | What's shown | User action |
|-------|---------|-------------|-------------|
| Empty | No data | Guidance message, CTA | Follow CTA or wait |
| Loading | Data fetching | Skeleton/spinner | Wait |
| Error | Fetch failed | Error message + retry | Retry or report |
| Partial | Some data | Available data + placeholders | Interact with what's there |
| Full | All data | Complete content | Full interaction |
| Overflow | Too much data | Paginated/virtualized | Navigate, filter, search |

**CLI states:**

| State | Trigger | Output | Exit code |
|-------|---------|--------|-----------|
| Success | Valid input, operation completes | Result to stdout | 0 |
| No results | Valid input, nothing found | Informative message to stderr | 0 |
| User error | Bad args/flags | Help-oriented message to stderr | 1 |
| System error | Network, permissions, etc. | Diagnostic message to stderr | 2+ |

**API states:**

| State | Trigger | Response | Status code |
|-------|---------|----------|-------------|
| Success | Valid request | Resource data | 200/201 |
| Empty | Valid request, no results | Empty collection with metadata | 200 |
| Validation error | Bad input | Field-level error details | 400 |
| Auth error | Missing/invalid credentials | Clear next step | 401/403 |
| Not found | Invalid resource ID | Helpful message | 404 |
| Server error | Internal failure | Request ID for support | 500 |

### 5. Content Strategy

Adapt to product type:

**For UI:**
- Headlines, labels, empty states, error messages, status indicators

**For CLI:**
- Help text, command descriptions, flag descriptions, progress output, error formatting
- Color usage (and --no-color fallback)
- Verbosity levels (default, --verbose, --quiet)

**For API:**
- Error message format and consistency
- Documentation structure (guides vs reference)
- SDK method naming conventions

### 6. Component / Surface Inventory

List what needs to be built or modified:

```markdown
## Components / Surfaces

### New
- {Name} — {purpose}, {where it's used / how it's accessed}

### Modified
- {Name} — {what changes}, {why}

### Removed
- {Name} — {why it's being removed}
```

For each, define:
- Inputs (props, args, request params)
- States
- Key interactions / behaviors
- Data dependencies

### 7. Produce Spec

Write `product/spec.md` using the template at `../templates/spec-template.md`.

The spec should be detailed enough that someone could implement it without further questions — but no more detailed than that.

### 8. Present in Terminal + Optional Mockup

Display the full spec directly in the terminal conversation:
- Information architecture as indented hierarchy
- User flows as step sequences
- State maps as tables
- Component/surface inventory with inputs and dependencies

The report file at `product/spec.md` is for persistence.

**Browser mockups (only when needed):** If the spec involves UI redesign or a new view, generate an HTML mockup using visual-explainer showing what the redesigned view would look like. Open it in the browser for user approval, but keep the spec discussion in the terminal. Save mockups to `~/.agent/diagrams/product-mockup-{subject}.html`.

## Scope Calibration

| Scope | Spec depth |
|-------|------------|
| Component | Props, states, interactions, visual spec. 1-2 pages. |
| Feature | User flow, state map, components affected, data dependencies. 2-3 pages. |
| View | Full IA for the view, all states, content strategy, component inventory. 3-5 pages. |
| Module | API spec, consumer contracts, integration points, migration plan. 3-5 pages. |
| Product | All surfaces specced, navigation/command IA, cross-cutting patterns, component library plan. 8-15 pages. |

## Integration with /start-task

The spec output is formatted so it can be used directly as a plan file:

```bash
/start-task --plan product/spec.md "Implement {feature} per design spec"
```

Include implementation notes in the spec:
- Files to create/modify
- Data model changes
- Migration steps (if any)
- Test plan
