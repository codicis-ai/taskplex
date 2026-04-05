# Design: Merging /plan Phases into /tp

> **Status**: Design — ready for review
> **Priority**: High — addresses the richness gap between /plan and /tp
> **Scope**: Phase file restructuring (init.md, planning.md), no hook changes

## Problem

`/plan` produces significantly richer design artifacts than `/tp`:

| Capability | `/plan` | `/tp` |
|-----------|---------|------|
| Research & discovery | Phase 1: read references, investigate problem space, scan codebase, present summary | None |
| User profiles | Phase 2.2: who they are, before/after states | None |
| User journeys | Phase 2.3: DOES/SEES/FEELS journey tables | Step 3 in Sub-phase B: brief mention of "map user journey" but no structured table |
| Jobs to be done | Phase 2.4: When/I want to/So I can/Instead of | None |
| Feature assessment | Phase 2.5: Kill/Fix/Keep/Build/Defer per feature | None |
| Contract + scope | Phase 2.6: user-facing/developer-facing/infra contracts | Step 4: in/out/defer list (no contract) |
| Intent file | Phase 3.3: confirmed problem, goal, scope, user decisions as guardrails | None — architect gets brief but no guardrails file |
| Architect guardrails | Phase 3.4: architect MUST follow user decisions, design only open areas | None — architect makes all decisions |
| Full draft review | Phase 3.5: present FULL draft, user can redirect, modify, or cancel | Phase A.3: structured summary, not full draft |
| Critic with debate log | Phase 4: critic writes debate.md, concerns resolved with user | Phase A.2: spec critic returns verdict, no debate log |

When users run `/tp` directly (which is most of the time), they get a shallow design phase. The rich product thinking only happens if they remember to run `/plan` first.

## Design Principle

**One command should produce the full quality.** Running `/tp --blueprint` should produce the same depth as `/plan` + `/tp --plan`. Users shouldn't need to know about two commands to get the best result.

## Solution: Absorb /plan Phases into /tp Init

### New Sub-phase Structure

```
/tp --blueprint add event engine

Phase 0: Init (unchanged)
  Step 0-4: Parse, manifest, session, context, conventions

Sub-phase A: Convention Check (unchanged)

Sub-phase B: Research & Discovery (NEW — from /plan Phase 1)
  Gate: Blueprint + Standard-full only. Light skips.
  Conditional: only if references provided or problem space is unfamiliar.

Sub-phase C: Product Context (NEW — from /plan Phase 2)
  Gate: Blueprint only. Standard + Light skip.
  Conditional: only if no existing product/brief.md.
  Produces: product/brief.md with journeys, profiles, JTBD, feature assessment.

Sub-phase D: Intent Exploration (EXISTING Sub-phase B, enriched)
  Enriched with: journey tables flow into design, intent file written as guardrails.
  For Standard: journeys are lightweight (2-3 step table, not full DOES/SEES/FEELS).
  For Blueprint: full journey tables from Sub-phase C feed in.

Phase 1: Planning (existing, enriched)
  Architect receives intent file as guardrails.
  Critic receives product brief + journeys for validation.
  User reviews full draft (Blueprint) or structured summary (Standard).
```

### Sub-phase B: Research & Discovery

**When it runs**:
- Blueprint: Always (can be quick if codebase is familiar)
- Standard: Only if user provides references or task involves new technologies
- Light: Never

**What it does** (adapted from /plan Phase 1):

1. **Check for references**: Ask user "Do you have any references to investigate? GitHub repos, articles, existing implementations? Or say 'skip'."
   - If skip: Run abbreviated codebase scan (existing step from Sub-phase B context gathering), proceed
   - If references provided: Read each via WebFetch/Read, extract key insights

2. **Investigate problem space**: Based on task description + references:
   - What problem is being solved?
   - What approaches exist in the ecosystem?
   - What are the known tradeoffs?
   - 10 minutes max — survey, not dissertation

3. **Scan local codebase**: Existing context gathering (INTENT.md, README, target files) — already in Sub-phase B. Consolidate here.

4. **Research summary**: Present to user for confirmation:
   ```
   Research Summary:
   Problem: {what we're solving}
   Existing approaches: {what's out there}
   Our codebase: {relevant existing code}
   Open questions: {what we need to decide}
   
   Does this match your understanding?
   ```

**Artifact**: Research findings stored in `manifest.memplexContext.research` or written to `.claude-task/{taskId}/research-summary.md`.

**designPhase**: `research` (new, inserted between `convention-check` and `intent-exploration`)

### Sub-phase C: Product Context

**When it runs**:
- Blueprint: Always (unless `product/brief.md` already exists and user chooses to reuse it)
- Standard: Never (Standard gets lightweight journeys in Sub-phase D instead)
- Light: Never

**What it does** (adapted from /plan Phase 2):

1. **Check for existing brief**: If `product/brief.md` exists, ask: "Found existing product brief. Use it, or create fresh?"
   - If reuse: Load brief, skip Sub-phase C, proceed to D with brief context
   - If fresh: Continue

2. **User profiles** (Step 2.2): For each user type (1-3 max):
   - Who they are specifically
   - Before state / After state
   - Present each for user confirmation

3. **Core journeys** (Step 2.3): For each journey (2-4 max):
   ```
   | Step | User DOES | System Response | Experience | Design Implication |
   |------|----------|-----------------|------------|-------------------|
   ```
   Present each for user confirmation.

4. **Jobs to be done** (Step 2.4): When/I want to/So I can/Instead of format. Core/Supporting/Delight groups. Present for confirmation.

5. **Feature assessment** (Step 2.5, conditional): Only if features already exist. Kill/Fix/Keep/Build/Defer. Present for confirmation.

6. **Contract + scope** (Step 2.6): User-facing, developer-facing, or infrastructure contract. IN/OUT/LATER with rationale.

7. **Write product/brief.md**: Using evaluate brief template. Present full brief in terminal. User confirms.

**Artifact**: `product/brief.md` (project-level, persists across tasks)

**designPhase**: `product-context` (new, inserted between `research` and `intent-exploration`)

### Sub-phase D: Intent Exploration (enriched existing Sub-phase B)

**Changes from current Sub-phase B**:

1. **Journey integration**: 
   - Blueprint: Journey tables from Sub-phase C are available. Sub-phase D references them for scope, ACs, and verification targets. No need to re-map journeys.
   - Standard: Generate lightweight journey tables here (2-3 steps per journey, simplified DOES/GETS format). Not as rich as Blueprint's full DOES/SEES/FEELS but still structured.
   - Light: No journeys (unchanged).

2. **Intent file** (NEW — from /plan Phase 3.3):
   After Step 2 (targeted questions), write `.claude-task/{taskId}/intent.md`:
   ```markdown
   # Task Intent: {description}

   ## Problem
   {confirmed problem from research + user interaction}

   ## Goal
   {confirmed success criteria}

   ## Scope
   - In: {what to build}
   - Out: {what to exclude}
   - Later: {what to defer}

   ## User Decisions (guardrails for architect)
   - {decisions already made — architect must follow, not re-evaluate}

   ## Journey Summary
   {If Blueprint: reference product/brief.md journeys}
   {If Standard: inline lightweight journey table}

   ## Product Context
   {If product/brief.md exists: summary of contract, profiles, Kill/Defer exclusions}
   {If not: "No product brief — design from task description and user interaction."}
   ```

   **This is the key missing link.** The intent file becomes a guardrail for the architect — user decisions are binding, not suggestions.

3. **Brief.md enrichment**: The task brief (`.claude-task/{taskId}/brief.md`) now includes:
   - Journey references (pointing to product/brief.md for Blueprint, inline for Standard)
   - Intent file reference
   - User decisions as constraints

### Planning Phase Changes

**Architect prompt** (both Standard and Blueprint):
- Include intent file path: "Read `.claude-task/{taskId}/intent.md` for confirmed problem, goal, scope, and user decisions."
- Add guardrails instruction: "User decisions in the intent file are BINDING. Design only around areas the user left open."
- If product/brief.md exists: "Read `product/brief.md` for user profiles, journeys, contract. Kill/Defer verdicts are HARD EXCLUSIONS."

**Critic prompt**:
- Include product brief if exists: "Check that the plan serves the product contract and user journeys."
- Write debate log: `.claude-task/{taskId}/reviews/critic-debate.md` (from /plan Phase 4)

**User review** (Phase A.3):
- Blueprint: Present FULL architect draft (from /plan Phase 3.5), not just structured summary. Options: "Looks good" / "Direction wrong" / "Specific changes" / "Cancel"
- Standard: Structured summary (existing behavior) — full draft is overkill for Standard scope

### How /plan Feeds Into /tp (unchanged flow, but smarter)

When `/tp --plan PLAN-{id}` is invoked with `processedByLifecycle: true`:

1. **Skip Sub-phases B + C**: Research and product context already done
2. **Load artifacts**: Copy intent file and product brief into task directory
3. **Sub-phase D runs abbreviated**: Confirm intent (from plan), resolve any new gaps, write task brief
4. **Planning runs with guardrails**: Architect gets intent file + product brief from /plan
5. **Critic checks plan coherence**: Critic verifies plan still matches product contract

When invoked without the lifecycle flag (external PRD):
- Full Sub-phases B + C + D run — PRD is input, not a bypass

### /plan Remains as Standalone Command

`/plan` continues to exist for users who want to think without executing. It produces the same artifacts (intent file, product brief, architect draft, critic debate) that `/tp` now also produces inline.

The difference:
- `/plan` = "think about this, save for later or execute"
- `/tp` = "think about this AND execute" (design phases produce the same artifacts)
- `/tp --plan PLAN-{id}` = "I already thought about it via /plan, execute with those artifacts"

## Design Phase Progression (Updated)

### Blueprint
```
convention-scan → convention-check → research → product-context → intent-exploration → approach-review → design-approval → brief-writing → planning-active
```

### Standard
```
convention-scan → convention-check → intent-exploration → approach-review → design-approval → brief-writing → planning-active
```
(Standard skips research and product-context sub-phases. Gets lightweight journeys in intent-exploration.)

### Light
```
convention-scan → intent-exploration → brief-writing → planning-active
```
(Unchanged)

## New Artifacts

| Artifact | Location | Written By | Used By |
|----------|----------|-----------|---------|
| `research-summary.md` | `.claude-task/{taskId}/` | Sub-phase B (orchestrator) | Sub-phase D context, architect |
| `product/brief.md` | Project root | Sub-phase C (orchestrator) | Sub-phase D, architect, critic, QA, verification |
| `intent.md` | `.claude-task/{taskId}/` | Sub-phase D (orchestrator) | Architect (guardrails), critic, verification |
| `critic-debate.md` | `.claude-task/{taskId}/reviews/` | Critic agent | User review, audit trail |

## Journey Traceability (connects to earlier discussion)

With journeys now first-class in `/tp`:

```
User Journeys (from product/brief.md or lightweight inline tables)
  └─ Journey: New user registration
      ├─ Step 1: Opens /register
      ├─ Step 2: Fills form
      └─ Step 3: Gets confirmed

  → ACs mapped to journey steps (intent-traceability.md)
    → Spec sections implement journey steps
      → Verification agent test plan references journeys
        → QA phase walks actual journeys (already does this — now with structured input)
```

The verification agent and QA phase already walk journeys. The difference: they currently infer journeys from the brief or task description. With this change, journeys are explicit structured tables — verification tests exactly what was designed.

## Design Gate Updates

New sub-phases need to be added to `SUB_PHASE_ORDER` and `ARTIFACT_GATES` in `tp-design-gate.mjs`:

```javascript
const SUB_PHASE_ORDER = {
  'convention-scan':     0,
  'convention-check':    1,
  'research':            2,   // NEW
  'product-context':     3,   // NEW
  'intent-exploration':  4,   // was 2
  'approach-review':     5,   // was 3
  'design-approval':     6,   // was 4
  'brief-writing':       7,   // was 5
  'prd-bootstrap':       8,   // was 6
  'prd-critic':          9,   // was 7
  'prd-approval':        10,  // was 8
  'planning-active':     11,  // was 9
};

const ARTIFACT_GATES = {
  'conventions.md':         'convention-check',
  'research-summary.md':    'research',          // NEW
  'intent.md':              'intent-exploration', // NEW
  'intent-and-journeys.md': 'intent-exploration',
  'brief.md':               'brief-writing',
  'spec.md':                'brief-writing',
  // ... rest unchanged
};
```

## Task List Updates

For Blueprint (full design depth):
```
1. "Initialize task — parse flags, create manifest, load context"
2. "Convention check — scan codebase, confirm patterns"
3. "Research & discovery — investigate problem space, read references"        // NEW
4. "Product context — user profiles, journeys, JTBD, feature assessment"     // NEW
5. "Intent exploration — synthesize context, confirm approach, write intent"
6. "Write brief.md — approaches, section approval, approved design"
7. "Planning — write spec, critic review (with debate log), user reviews full draft"
8. "Implementation" (placeholder)
9. "QA — smoke test, journey walkthrough, edge cases, bug fixes"
10. "Validation — security, closure, code review, hardening, compliance"
11. "Completion — git commit, PR, task summary"
```

For Standard:
```
1. "Initialize task — parse flags, create manifest, load context"
2. "Convention check — scan codebase, confirm patterns"
3. "Intent exploration — synthesize context, lightweight journeys, write intent"
4. "Write brief.md — approaches, section approval, approved design"
5. "Planning — write spec, critic review, user acknowledges plan"
6. "Implementation" (placeholder)
7. "QA — smoke test, journey walkthrough, edge cases, bug fixes"
8. "Validation — security, closure, code review, hardening, compliance"
9. "Completion — git commit, PR, task summary"
```

Light unchanged.

## What Does NOT Change

- Hook infrastructure (9 hooks, same events)
- Agent definitions (23 agents, same roles)
- Implementation phase (same 3 routes)
- QA phase (same steps — but now gets structured journey input)
- Validation phase (same 12 steps)
- Completion phase (same)
- `/plan` command (still works standalone)
- `/evaluate` command (unchanged)
- `/solidify` command (unchanged)

## Implementation Plan

### Phase 1: Update init.md
- Add Sub-phase B (Research) between convention check and intent exploration
- Add Sub-phase C (Product Context) between research and intent exploration
- Update Sub-phase D (Intent Exploration) with journey integration + intent file
- Update design phase progression constants
- Add conditional logic (Blueprint gets all, Standard gets D-only enrichment, Light unchanged)

### Phase 2: Update planning.md
- Architect prompt includes intent file path + guardrails instruction
- Critic prompt includes product brief + debate log output
- Blueprint user review presents full draft (not just summary)

### Phase 3: Update tp-design-gate.mjs
- Add new sub-phases to `SUB_PHASE_ORDER`
- Add new artifacts to `ARTIFACT_GATES`

### Phase 4: Update documentation
- CLAUDE.md, taskplex-documentation.md, README.md
- Update design documents table

## Open Questions

1. **Should Standard route get Product Context (Sub-phase C)?** Current design says no — Standard gets lightweight journeys in Sub-phase D. But if the user wants richer design on a Standard task, they could upgrade to Blueprint. Alternative: make Sub-phase C available on Standard when `product/brief.md` doesn't exist and the task touches user-facing features.

2. **Should the intent file become a spec gate artifact?** Currently the spec gate checks for `spec.md`. Should it also require `intent.md`? This would prevent the "skip intent, go straight to spec" failure. But it adds friction for Light route and simple tasks.

3. **How much of /plan's Phase 2 is too much for /tp?** The full DOES/SEES/FEELS journey tables, JTBD, feature assessment — this is 15-20 minutes of user interaction. For Blueprint (which is already a heavy route), this is appropriate. But it could feel like overkill if the user expected a faster flow.

4. **Should product/brief.md be project-level or task-level?** Currently designed as project-level (persists across tasks, reusable). But different tasks may need different product contexts. Recommendation: project-level with task-level overrides in the task brief.
