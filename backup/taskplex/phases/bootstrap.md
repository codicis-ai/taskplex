# taskplex: Bootstrap Phases
<!-- Loaded by orchestrator for Phase -1 and Phase -0.5. Self-contained. -->
<!-- v2: Interactive-first bootstrap — no autonomous agent generation -->

---

## Phase -1: Project Intent Bootstrap (one-time per project)

**Trigger**: Only when no `INTENT.md` exists in project root. Skipped for all future tasks.

**Principle**: INTENT.md must be shaped by the user, not generated autonomously. The orchestrator gathers context, synthesizes, then asks — never writes first and asks second. No agent spawn. The orchestrator handles this inline.

### Step 0: Gather Existing Context (no user interaction, < 30 seconds)

Collect from three sources — do NOT ask the user anything the documentation already answers:

**Source A — Invocation context:**
- Task description from `/tp` invocation (if any)
- Referenced files (`--plan`, PRD, pasted content)
- Flags that signal intent (`--prd` = initiative-scale, `--blueprint` = complex)

**Source B — Project documentation:**
- `README.md` — project purpose, audience, usage
- `CLAUDE.md` — development context, conventions
- `package.json` / `pyproject.toml` / `Cargo.toml` — name, description, dependencies
- `product/brief.md` — product context (if exists)
- Any existing `INTENT.md` drafts in `.claude-task/`

**Source C — Structural scan:**
- Glob for project structure (src/, tests/, docs/, etc.) — 5-8 calls max
- Quick grep for domain signals (API routes, CLI commands, UI components)
- Detect project type (web app, CLI, API, library, infrastructure)

**Source D — Memplex knowledge** (if `manifest.memplexAvailable`):
- `search_knowledge` scoped to project name — prior context from other sessions about this project
- `query_knowledge_graph` — project architecture, entity relationships
- If memplex not available: skip, rely on sources A-C only

Record what was found and what's missing in `manifest.bootstrapContext`:
```json
{
  "sourcesRead": ["README.md", "package.json"],
  "sourcesMissing": ["CLAUDE.md", "product/brief.md"],
  "projectType": "web-app",
  "contextDensity": "high|medium|low"
}
```

**Context density heuristic:**
- **High**: README has purpose + audience + usage, OR product/brief.md exists, OR detailed task description provided
- **Medium**: README exists but is sparse, OR package.json has description but no README
- **Low**: No README, no description, bare project structure

### Step 1: Synthesize and Confirm (first user interaction)

Present what you understood from Step 0. The question adapts to context density:

**High context density:**
> "From {sources}, this looks like {summary}. The target users appear to be {users} and the core goal is {goal}. Is that right, or is there a bigger picture I'm missing?"

This is a confirmation — one question, expects a short answer or correction.

**Medium context density:**
> "Here's what I see from {sources}: {summary}. I have a rough sense of the purpose but I'm missing {specific gaps}. Can you fill in: who is this for, and what does success look like for them?"

This is a targeted gap-fill — names what's known and what isn't.

**Low context density:**
> "This is a {project type} project but I don't have much context yet. What's the purpose of this project — who uses it and what problem does it solve?"

This is an open question — necessary when there's nothing to synthesize.

**After user responds**: Set `manifest.designInteraction.contextConfirmed = true`.

### Step 2: Targeted Follow-ups (adaptive — 0 to 3 questions)

Based on what Step 1 resolved, ask ONLY about remaining gaps:

| Gap | Question |
|-----|----------|
| Users/audience unclear | "Who specifically uses this? (role, context, expertise level)" |
| Success criteria missing | "What does success look like — if this works perfectly, what changes?" |
| Boundaries unclear | "What is this NOT trying to be? What's explicitly out of scope?" |
| Quality priorities unclear | "What matters most: correctness, speed, UX, developer experience?" |

**Rules:**
- Ask one question at a time, wait for answer
- Skip questions that Step 1 already answered
- Stop as soon as ambiguity is resolved — do NOT force questions for ceremony
- If Step 1 answer was comprehensive, Step 2 may have zero questions

**After all gaps resolved**: Set `manifest.designInteraction.ambiguitiesResolved = true`.

### Step 3: Draft INTENT.md from Conversation

Write INTENT.md from the synthesis + user's answers. Structure:

```markdown
# Project Intent: {project name}

## Purpose
{What this project does and why it exists — from user's words, not inferred}

## Users
{Who uses this — specific roles/contexts, not generic "developers"}

## Success Criteria
{What success looks like — measurable where possible}

## Quality Priorities
{Ordered list: what matters most to least}

## Boundaries
{What this is NOT — explicit exclusions}

## Risks
{Known risks or open questions — only if surfaced in conversation}
```

Present the draft to the user:
> "Here's the INTENT.md based on our conversation. Review it — I'll apply any changes."

Options: **Looks good** / **Needs changes** (user describes what to fix)

If changes: apply edits, present again. Max 2 revision rounds.

Write final INTENT.md to project root. Continue to Phase -0.5 or Step 4 (detect project type).

---

## Phase -0.5: Convention Bootstrap (deferred — never blocks first task)

**Principle**: The first task on a new project should start immediately. Convention setup is deferred to after completion.

**Quick-skip**: If `conventions.json` exists (with or without `CONVENTIONS.md`), conventions are already set — skip this phase entirely.

**If conventions.json does NOT exist** (first task on project, or legacy project):

1. **Auto-discover silently** — spawn bootstrap in the background (no user interaction):
   > Spawn bootstrap --mode conventions (sonnet) from ~/.claude/agents/core/bootstrap.md
     Context: PROJECT ROOT, INTENT.md content, CLAUDE.md content
     run_in_background: true
     Writes: .claude-task/conventions-draft.md AND .claude-task/conventions-draft.json
     Returns: "Discovery complete. {N} conventions, {M} inconsistencies, {R} recommendations."

2. **Set flag**: `manifest.conventionBootstrapPending = true`

3. **Continue immediately** to Step 6 (detect project type with defaults). The task starts with detected defaults — no blocking prompts.

4. **After task completion** (in completion phase, after Git integration):
   - If `manifest.conventionBootstrapPending === true`:
     - Read `.claude-task/conventions-draft.md` and `.claude-task/conventions-draft.json` (should be ready by now)
     - Present draft to user with a single question:
     - `AskUserQuestion`: "Conventions discovered from your codebase. Review now or later?"
       - Options: **Review & save** / **Save as-is** / **Skip (run /onboard anytime)**
     - If Review & save: present draft, apply corrections, write both files to project root
     - If Save as-is: write both files to project root directly
     - If Skip: discard drafts, user can run `/onboard` later

**Legacy upgrade** (only `CONVENTIONS.md` exists, no `conventions.json`):
- Same deferred approach: auto-discover in background, offer after completion
- Convention-scout receives existing CONVENTIONS.md as input for generating the JSON companion

This ensures the user's first interaction is always the task itself, never setup.
