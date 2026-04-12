---
name: plan
description: Strategic thinking and architecture for any scope — from exploring a new idea to designing a full product. Unified pre-implementation flow covering research, product brief, architecture, and critic review. Produces an approved plan file for later execution via /tp. Use when the user wants to plan, design, or think something through before building — "plan this out", "design the architecture", "write a PRD", "research X before we build it", "what's the best approach to Y".
---

# /plan - Strategic Thinking & Architecture

**Command**: `/plan [idea, problem, or description]`

Unified command for all pre-implementation thinking — from initial research through to an approved architecture. Absorbs evaluate brief into a single flow with gates that skip phases when they're not needed.

**CRITICAL**: Subagents cannot access `~/.claude/` files. You (the orchestrator) must read each agent definition file yourself, then embed its full contents into the subagent's `prompt` parameter. The `[PASTE CONTENTS OF ... HERE]` placeholder means literally replace it with the file contents you read.

**CRITICAL**: The user must be involved at every stage. Do NOT run phases autonomously and present finished artifacts. The user shapes the direction; you and agents fill in the details.

---

## Checklist System

Maintain a progress checklist throughout the entire flow. Display it at the start of each phase transition and persist it to `.claude-task/plans/PLAN-{id}-progress.md` after every step completion.

The checklist uses these markers:
- `✅` — completed
- `➡️` — current step
- `⬜` — not started
- `⏭️` — skipped (by gate)

After compaction, read the progress file to know where you are. Resume from the step marked `➡️`.

---

## Phase 0: Triage

**Executor**: You (orchestrator)

**ALWAYS ask the user which route to take.** Do not auto-detect.

### Step 0.1: Present Route Options

Via `AskUserQuestion`:

> "How deep should we go?
>
> 1. **Full** — Research, product context, architecture, critic review. For new products, major features, or when you're not sure what to build yet.
> 2. **Quick** — Architecture and critic review only. For tactical changes where you already know the problem and the users.
>
> Pick a number."

Map:
- 1 → Full (all phases run)
- 2 → Quick (skip Phase 1 and 2, start at Phase 3)

### Step 0.2: Check for Existing Product Brief

Check for `product/brief.md` (or `.claude-task/{taskId}/product/brief.md`).

- **If exists AND route is Full**: Ask user: "Found an existing product brief. Use it as context (skip Phase 2), or create a fresh one?"
  - Use existing → Load brief, skip Phase 2, proceed to Phase 1 (research) then Phase 3
  - Fresh → Proceed normally through all phases
- **If exists AND route is Quick**: Load brief silently as context for the architect in Phase 3
- **If doesn't exist AND route is Quick**: Proceed without it
- **If doesn't exist AND route is Full**: Proceed through all phases including Phase 2

### Step 0.3: Create Plan Directory & Progress File

Create `.claude-task/plans/` if it doesn't exist. Generate plan ID: `PLAN-{YYYYMMDD}-{slug}`.

Write initial progress to `.claude-task/plans/PLAN-{id}-progress.md`:
```
═══ PLAN PROGRESS: {slug} ═══
Route: {Full|Quick}

✅ PHASE 0: TRIAGE
  ✅ 0.1 Route selection
  ✅ 0.2 Brief check
  ✅ 0.3 Create plan directory

{If Full route:}
⬜ PHASE 1: RESEARCH & DISCOVERY
  ⬜ 1.1 Read user-provided references
  ⬜ 1.2 Investigate problem space
  ⬜ 1.3 Scan local codebase
  ⬜ 1.4 Research summary → user review

⬜ PHASE 2: PRODUCT CONTEXT
  ⬜ 2.1 Alternatives landscape
  ⬜ 2.2 User/consumer profiles
  ⬜ 2.3 Core journeys
  ⬜ 2.4 Jobs to be done
  ⬜ 2.5 Feature assessment (Kill/Fix/Keep/Build/Defer)
  ⬜ 2.6 Contract + scope (IN/OUT/LATER)
  ⬜ 2.7 Write product/brief.md → user review

⬜ PHASE 3: STRATEGIC DESIGN
  ⬜ 3.1 Confirm intent
  ⬜ 3.2 Requirements interview
  ⬜ 3.3 Write intent file
  ⬜ 3.4 Architect designs approaches
  ⬜ 3.5 User reviews draft

⬜ PHASE 4: CRITIC & APPROVAL
  ⬜ 4.1 Strategic critic review
  ⬜ 4.2 Resolve concerns (if any)
  ⬜ 4.3 User confirms final plan

⬜ PHASE 5: OUTPUT
  ⬜ 5.1 Finalize PLAN-{id}.md
  ⬜ 5.2 User chooses next step
```

Update the progress file after EVERY step completion.

---

## Phase 1: Research & Discovery

**Executor**: You (orchestrator) — read and summarize, no agent spawn needed.

**Gate**: Only runs on Full route. Skipped on Quick.

This phase captures the exploratory research that typically happens in unstructured conversation. The user may provide GitHub repos, articles, reference implementations, or just describe an idea they want investigated.

### Step 1.1: Read User-Provided References

Ask via `AskUserQuestion`:

> "Do you have any references to investigate? GitHub repos, articles, existing implementations, or other material I should look at before we define the product?
>
> Paste links/paths, or say 'skip' to work from the codebase and your description."

For each reference provided:
- **GitHub repos**: Use WebFetch to read README, scan key files, understand the approach
- **Articles/URLs**: Use WebFetch to read and extract key insights
- **Local files/repos**: Read directly
- **Ideas/thoughts**: Capture verbatim

### Step 1.2: Investigate Problem Space

Based on the user's description and any references:
- What problem is being solved?
- What approaches exist in the ecosystem?
- What are the known tradeoffs?

Keep this focused — 10 minutes max. This is a survey, not a dissertation.

### Step 1.3: Scan Local Codebase

- Read `INTENT.md`, `README.md`, `CLAUDE.md` for project context
- Scan relevant files mentioned in the user's description (3-5 files max)
- If there's existing code related to the idea, read it
- Note: what already exists that could be reused or needs to change?

### Step 1.4: Research Summary → User Review

Present findings to the user:

> **Research Summary**
>
> **Problem space**: {what we're trying to solve}
> **What exists**: {relevant existing solutions, approaches, prior art}
> **Key insights from references**: {if any were provided}
> **Our codebase**: {relevant existing code, reuse opportunities}
> **Open questions**: {things we need to decide}
>
> Does this match your understanding? Anything to add or correct?

Wait for user confirmation before proceeding.

Update progress file.

---

## Phase 2: Product Context

**Executor**: You (orchestrator) — interactive with user.

**Gate**: Only runs on Full route AND no existing brief loaded. Skipped on Quick or when existing brief is used.

This phase produces `product/brief.md` — the product thinking document that defines who this is for, what they need, and what's in/out. It follows the evaluate brief methodology, adapted for the product type.

Read `${CLAUDE_PLUGIN_ROOT}/skills/evaluate/modes/brief.md` for detailed instructions on each step. Read `${CLAUDE_PLUGIN_ROOT}/skills/evaluate/references/scope-guide.md` for depth calibration.

**Product type detection** (determines framing):

| Signal | Type | Framing |
|--------|------|---------|
| Views, pages, components, UI | UI App | Emotional (FEELS column) |
| Commands, flags, terminal | CLI | DX (FRICTION column) |
| Endpoints, schemas, SDK | API/Service | DX (FRICTION column) |
| Package, exports, types | Library | DX (FRICTION column) |
| Pipeline, jobs, workers | Infrastructure | Operational (RISK column) |

### Step 2.1: Alternatives Landscape

Brief analysis of what else exists. 1 paragraph per alternative, 3 max.
- What do users currently use instead?
- What's good/bad about each?
- Where is the opportunity?

Present to user for confirmation.

### Step 2.2: User/Consumer Profiles

For each user type (1-3 max), build a profile:
- Who are they specifically? (not "a developer" — be precise)
- What are they experiencing BEFORE this product?
- What should they experience AFTER?

Present each profile to user for confirmation before moving on.

### Step 2.3: Core Journeys

For each core journey (2-4 max), map step by step:

| Step | User DOES | User SEES/GETS | Experience Quality | Design Implication |
|------|----------|---------------|-------------------|-------------------|
| 1 | {action} | {result} | {emotion/friction/risk} | {constraint} |

Present each journey to user for confirmation.

### Step 2.4: Jobs to Be Done

Define jobs in the format:
**When** {situation}, **I want to** {action}, **so I can** {outcome} **instead of** {current alternative}.

Group into Core / Supporting / Delight.

Present to user for confirmation.

### Step 2.5: Feature Assessment

If features/surfaces already exist, evaluate each:

| Feature | Serves which job? | Current state | Target state | Verdict |
|---------|------------------|---------------|-------------|---------|
| {name} | {job ref} | {now} | {goal} | Kill/Fix/Keep/Build/Defer |

Present to user for confirmation. Kill and Defer items become hard exclusions for the architect.

### Step 2.6: Contract + Scope

Define the contract:
- **User-facing**: "When you use [product], you will feel [emotions] because [what it does]."
- **Developer-facing**: "When you use [product], you will [achieve X] within [effort] because [what it handles]."
- **Infrastructure**: "When [product] runs, you can trust [guarantee] because [mechanism]."

Define scope: IN / OUT / LATER with rationale.

Present to user for confirmation.

### Step 2.7: Write product/brief.md → User Review

Write the full brief using the template at `${CLAUDE_PLUGIN_ROOT}/skills/evaluate/templates/brief-template.md`.

Save to `product/brief.md` (or `.claude-task/{taskId}/product/brief.md` if in task context).

Present the complete brief in the terminal. Ask user to confirm before proceeding to architecture.

Update progress file.

---

## Phase 3: Strategic Design

**Executor**: You (orchestrator) + architect agent.

**Gate**: Always runs (both Full and Quick routes).

### Step 3.1: Confirm Intent

Present the plan intent to the user via `AskUserQuestion`:

> "Before I start designing, let me confirm the intent:
> **Problem**: {from research + brief, or from user's description if Quick}
> **Goal**: {what success looks like}
> **Scope**: {in/out — from brief if available, or from user's description}
> **Constraints**: {known constraints — tech, time, compatibility}
> {If brief exists: **Product context**: {1-2 line summary of contract and Kill/Defer exclusions}}
> Is this right?"

Options: **Correct** / **Mostly, but...** / **Let me explain**

If user corrects, revise and confirm once more (max 1 follow-up).

### Step 3.2: Requirements Interview

Interview depth depends on the problem's complexity:

**Simple plans** (clear problem, obvious approach): 1 round, 2-3 questions
**Complex plans** (ambiguous, multiple viable approaches): 1-2 rounds, 3-5 questions

Focus areas:
- Preferred approaches or patterns
- Known constraints not mentioned
- Key decisions already made (become guardrails)
- Previous failed attempts or rejected approaches
- Integration points with other systems

Use `AskUserQuestion` with well-formed questions.

### Step 3.3: Write Intent File

Write to `.claude-task/plans/PLAN-{id}-intent.md`:

```markdown
# Plan Intent: {slug}

## Problem
{confirmed problem statement}

## Goal
{confirmed success criteria}

## Scope
- In: {what to design}
- Out: {what to exclude}

## Constraints & Preferences
- {constraint or preference from interview}

## User Decisions (guardrails for architect)
- {decisions already made — architect must follow these, not re-evaluate}

## Product Context
{If brief exists: summary of contract, user profiles, Kill/Defer exclusions}
{If no brief: "No product brief — plan based on user description and interview."}
```

### Step 3.4: Explorer Pre-Pass (MANDATORY)

Before using any expensive planning model, map the target area cheaply.

**Agent**: explore (haiku)

1. Read `${CLAUDE_PLUGIN_ROOT}/agents/explore.md` yourself
2. Spawn explorer with the file contents embedded in the prompt:

```
Task({
  subagent_type: 'general-purpose',
  model: 'haiku',
  prompt: `
    [PASTE CONTENTS OF explore.md HERE]

    TASK: Produce a planning reconnaissance summary for this plan.
    Read the plan intent file: .claude-task/plans/PLAN-{id}-intent.md
    {If product/brief.md exists: Read product/brief.md for product context}
    Identify the relevant local files, existing patterns, integration points,
    coupled/shared files, and whether external research is actually needed.
    Write .claude-task/plans/PLAN-{id}-exploration-summary.md
  `
});
```

Present the explorer's findings inline in 5-10 lines.

### Step 3.5: Conditional External Research

Only run research if the explorer or your own review surfaced one of:
- external API uncertainty
- new dependency choice
- version migration
- unfamiliar best-practice question
- explicit user request for research

If none apply, skip this step.

**Agent**: researcher (sonnet)

If triggered:
1. Read `${CLAUDE_PLUGIN_ROOT}/agents/researcher.md` yourself
2. Spawn researcher with the file contents embedded in the prompt:

```
Task({
  subagent_type: 'general-purpose',
  model: 'sonnet',
  prompt: `
    [PASTE CONTENTS OF researcher.md HERE]

    TASK: Research only the external questions needed for this plan.
    PLAN INTENT: .claude-task/plans/PLAN-{id}-intent.md
    EXPLORATION SUMMARY: .claude-task/plans/PLAN-{id}-exploration-summary.md
    {If product/brief.md exists: PRODUCT BRIEF: product/brief.md}
    Write research files under .claude-task/plans/PLAN-{id}-research/
  `
});
```

Summarize only the findings that affect design decisions.

### Step 3.6: Opus Gate

Use the architect only if one of these is true:
- The change spans multiple subsystems
- Multiple viable architectures remain after exploration/research
- Worker decomposition is non-obvious
- Wave decomposition is needed
- There are meaningful product/technical tradeoffs still unresolved

If none apply, skip architect and draft the plan from intent + exploration (+ research if any).

### Step 3.7: Architect Designs Within Guardrails (conditional)

**Agent**: architect (opus)

Only run this step if the Opus Gate above is met.

1. Read `${CLAUDE_PLUGIN_ROOT}/agents/architect.md` yourself
2. Spawn architect with the file contents embedded in the prompt:

```
Task({
  subagent_type: 'general-purpose',
  model: 'opus',
  prompt: `
    [PASTE CONTENTS OF architect.md HERE]

    MODE: Strategic Planning (not tactical breakdown)

    PROBLEM: {confirmed problem from Step 3.1}
    GOAL: {confirmed goal from Step 3.1}
    OUTPUT DIRECTORY: .claude-task/plans/

    ## User Intent & Guardrails
    Read the plan intent file: .claude-task/plans/PLAN-{id}-intent.md
    This contains confirmed problem, goal, scope, constraints, and user decisions.
    You MUST follow the user's decisions — they are guardrails, not suggestions.
    Do NOT propose alternatives to decisions the user already made.
    Focus your design work on the areas the user left open.

    ## Prepared Inputs
    Read .claude-task/plans/PLAN-{id}-exploration-summary.md first.
    {If research exists: Read .claude-task/plans/PLAN-{id}-research/*.md}

    {If product/brief.md exists:}
    ## Product Context
    Read product/brief.md for user profiles, journeys, contract, and feature assessment.
    The brief's Kill and Defer verdicts are HARD EXCLUSIONS — do not design around them.
    The brief's IN scope items are your design space.
    The brief's contract defines what success looks like for users.

    Your job:
    1. Resolve the open architecture decisions
    2. Design 1-3 strategic approaches with tradeoffs (within the user's guardrails)
    3. Recommend one approach
    4. Write your analysis to: .claude-task/plans/PLAN-{id}-draft.md

    Do NOT do broad repo exploration or broad external research unless a cited input is insufficient.

    Return ONLY: "DRAFT READY" + 3-line summary of recommended approach.
  `
});
```

### Step 3.8: User Reviews Draft

1. Read `.claude-task/plans/PLAN-{id}-draft.md`
2. Present the FULL draft — output every section. Do NOT summarize or truncate.
3. After presenting, use `AskUserQuestion`:

> "This is the architect's strategic design. Review the approach and key decisions."

Options:
- **Looks good, run critic** — proceed to Phase 4
- **Direction is wrong** — user provides corrections, architect re-runs with updated guardrails
- **I have specific changes** — orchestrator edits draft directly
- **Cancel** — stop planning

**If "Direction is wrong"**: Update the intent file. Re-run architect. Max 2 re-runs.
**If "I have specific changes"**: Edit draft directly, present for confirmation.
**If "Looks good"**: Proceed to Phase 4.

Update progress file.

---

## Phase 4: Critic & Approval

**Executor**: You (orchestrator) + critic agent.

**Gate**: Always runs.

### Step 4.1: Strategic Critic Review

**Agent**: strategic-critic (sonnet)

1. Read `${CLAUDE_PLUGIN_ROOT}/agents/strategic-critic.md` yourself
2. Embed into prompt:

```
Task({
  subagent_type: 'general-purpose',
  model: 'sonnet',
  prompt: `
    [PASTE CONTENTS OF strategic-critic.md HERE]

    PLAN DRAFT: .claude-task/plans/PLAN-{id}-draft.md
    PLAN INTENT: .claude-task/plans/PLAN-{id}-intent.md
    {If exists: PRODUCT BRIEF: product/brief.md}

    The user has already reviewed and approved the strategic direction of this plan.
    Do NOT challenge the fundamental approach or user decisions in the intent file.
    DO challenge: hidden assumptions, understated risks, missing technical considerations,
    feasibility gaps, and tradeoffs the architect may have glossed over.

    {If brief exists:}
    Check that the plan serves the product contract and user journeys defined in the brief.
    Flag if the plan would undermine the intended user experience.

    Write debate to: .claude-task/plans/PLAN-{id}-debate.md

    Return ONLY: "APPROVED" or "REVISE: {one-line reason}"
  `
});
```

### Step 4.2: Resolve Concerns

If REVISE → re-run architect with critic feedback (within user's guardrails), then re-run critic. Max 2 revision cycles.

If still REVISE after 2 cycles, present the unresolved concern to the user via `AskUserQuestion`:

> "The critic raised a concern that wasn't resolved after 2 rounds:
> **Concern**: {critic's feedback}
> **Architect's response**: {how the architect addressed it}
> How do you want to handle this?"

Options:
- **Override — proceed anyway** — user accepts the risk
- **Address it** — user provides direction
- **Cancel** — stop planning

### Step 4.3: User Confirms Final Plan

Present via `AskUserQuestion`:
- Brief summary of what changed during critic review (if anything)
- Any concerns raised and how they were resolved
- Final recommended approach (1-2 sentences)

Options: **Approve** / **Modify** / **Cancel**

If Modify → discuss with user, update draft, optionally re-run critic.

Update progress file.

---

## Phase 5: Output

**Executor**: You (orchestrator)

### Step 5.1: Finalize Plan

1. Rename draft to final: `PLAN-{id}.md`
2. Append approval metadata:
   ```markdown
   ---
   ## Metadata
   - Approved: {timestamp}
   - Route: {Full|Quick}
   - Phases run: {list of phases that ran}
   - Intent rounds: {N}
   - Critic rounds: {N}
   - User corrections: {N}
   - Product brief: {yes/no — path if yes}
   - Status: approved
   - processedByLifecycle: true
   - lifecycleSource: /plan
   - briefGenerated: {true|false}
   - conventionsRefreshed: true
   - architectReviewed: true
   - criticReviewed: true
   ```

### Step 5.2: User Chooses Next Step

Present via `AskUserQuestion`:

> "Plan approved and saved to `.claude-task/plans/PLAN-{id}.md`
>
> What would you like to do?
>
> 1. **Execute now** — launch `/tp --plan PLAN-{id}` to start implementation
> 2. **Save for later** — keep the plan for future reference
> 3. **Keep exploring** — stay in conversation to discuss further"

- If **Execute now**: Invoke `/tp --plan PLAN-{id} {task description}`
- If **Save for later**: Display path and end
- If **Keep exploring**: Stay in conversation, plan is saved

Update progress file to show completion.

---

## Plan Document Structure

### Intent File: `PLAN-{id}-intent.md`
```markdown
# Plan Intent: {slug}

## Problem
{confirmed problem statement}

## Goal
{confirmed success criteria}

## Scope
- In: {what to design}
- Out: {what to exclude}

## Constraints & Preferences
- {constraint or preference from interview}

## User Decisions (guardrails for architect)
- {decisions already made}

## Product Context
{Summary from brief, or "No product brief"}
```

### Draft/Final Plan: `PLAN-{id}.md`
```markdown
# PLAN-{YYYYMMDD}-{slug}

## Problem Statement
What problem are we solving and why it matters.

## Current State
What exists today. Key files, patterns, limitations.

## Approaches Considered

### Approach A: {name}
Description. Pros. Cons. Effort estimate.

### Approach B: {name}
Description. Pros. Cons. Effort estimate.

## Recommended Approach
Which approach and why. Key architectural decisions.

## High-Level Steps
1. Strategic step (not file-level detail)
2. Strategic step

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| ... | ... | ... |

## Open Questions
- Resolved during critic review or user approval

---
## Metadata
{approval metadata}
```

### Disk Artifacts
All plan files live in `.claude-task/plans/`:
- `PLAN-{id}-intent.md` — confirmed problem, goal, scope, user guardrails
- `PLAN-{id}-draft.md` — architect's working draft (renamed to `PLAN-{id}.md` on approval)
- `PLAN-{id}-debate.md` — critic challenge log
- `PLAN-{id}.md` — final approved plan
- `PLAN-{id}-progress.md` — checklist state (survives compaction)

---

## How Plans Feed Into /start-task

When `/start-task --plan PLAN-{id}` is invoked:

1. `/start-task` reads `PLAN-{id}.md` and checks for `processedByLifecycle: true` in metadata
2. **If flag present** (plan created by `/plan`):
   - The plan is **pre-validated strategic input** — brief, architect, and critics already ran
   - `/start-task` skips: strategic-critic (already approved), redundant brief generation
   - `/start-task` still runs: tactical breakdown (architect → spec.md), tactical-critic, implementation, validation
3. **If flag missing** (plan written manually or from external source):
   - The plan is **requirements input only** — full lifecycle runs
   - Nothing is skipped — the external plan provides context but doesn't replace process

This separation means:
- `/plan` = "should we build X using approach Y?" (lifecycle-validated)
- `/start-task --plan` = "execute this validated plan" (if flag) OR "plan AND execute this" (if no flag)
- External PRD = always "plan AND execute" — the PRD is input, not a substitute for the planning pipeline
