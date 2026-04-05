# Brief Mode

Define what this product should be — not technically, but for the humans who will use it. Produce a product brief that makes the user's world so vivid that every implementation decision becomes obvious.

## Adaptive Framing

The depth and style of this brief adapts to the product type:

**User-facing products (UI apps, CLIs with human users):** Full emotional framing — user profiles with before/after emotional states, journeys with FEELS column, emotional contract. This is the default and works best when the product's success depends on how people feel using it.

**Developer-facing products (APIs, libraries, SDKs):** Pragmatic framing — consumer profiles with pain points and needs, integration journeys with FRICTION column, developer experience contract. Emotions still matter (frustration with bad docs, confidence from good types) but the language shifts from "feelings" to "friction and flow."

**Infrastructure (pipelines, services, workers):** Operational framing — operator profiles with concerns and constraints, failure/recovery journeys with RISK column, reliability contract. The "user" is often another system or an oncall engineer at 3am.

The templates below use the full emotional framing language. When working with developer-facing or infrastructure products, translate accordingly — "emotional contract" becomes "DX contract" or "reliability contract", "FEELS" becomes "FRICTION" or "RISK", etc. The structure is the same; the vocabulary adapts.

## How This Connects to /start-task

Start-task's brief phase now includes emotional framing natively for Standard/Architect routes — it builds user profiles with before/after states, maps journeys with FEELS columns, and derives acceptance criteria from design implications. It doesn't need this skill to produce emotionally-grounded briefs.

This skill is the **zoom out** companion. Use it when you want to think about the whole product or a broad feature area — multiple user types, multiple journeys, feature assessment across all views. The output (`product/brief.md`) becomes upstream context that start-task reads and scopes down to individual tasks.

**When to use this skill vs just running start-task:**
- **Start-task alone**: You know the task, you want to build it. The brief phase handles emotional framing for that specific task.
- **This skill first**: You're entering a new product area, starting something ambitious, or want to step back and ask "what should this actually be?" before scoping tasks. Multiple start-task runs can inherit from one product-dev brief.

When `product/brief.md` exists, start-task's brief agent reads it and extracts the relevant emotional contract, user profile, and journey — avoiding redundant inference and keeping task briefs consistent with the product vision.

## Process

### 1. Understand the Subject

**If an audit exists:** Read `product/audit.md` first. Ground the brief in reality — what does the product actually do today?

**If no audit:** Do a lightweight discovery:
- Read the project README, CLAUDE.md, or any existing documentation
- Scan the codebase structure (package.json, main entry points)
- If a URL is available, quick agent-browser snapshot to see current state
- If it's a CLI, run `--help`
- If it's an API, scan the route definitions

### 2. Understand the Landscape

Before defining what this product should be, understand what else exists:

**Alternatives analysis** (keep this brief — 1 paragraph per alternative, 3 max):
- What do users currently use instead? (the "current workaround")
- What existing tools or products serve a similar purpose?
- What's good about them? What's painful?
- Where is the opportunity — what do they all get wrong, or what gap do they leave?

This isn't a competitive report. It's context that prevents building something that already exists or repeating mistakes others made.

### 3. Build User Profiles

This is the foundation. Everything else flows from here.

For each user type (1-3 max), build a profile that goes beyond demographics:

**Who are they?**
- Not "a developer" — be specific: "A solo developer running 3 Claude Code sessions in different terminals, trying to keep track of what each agent is doing"
- What's their day like? When does this product enter their workflow?
- What level of expertise do they have with the domain?

**What are they experiencing BEFORE they use the product?**
- For user-facing: emotions (anxious, frustrated, overwhelmed, curious)
- For developer-facing: friction points (guessing at API shape, reading source to understand types, copy-pasting boilerplate)
- For infrastructure: operational concerns (unclear failure modes, manual intervention needed, no visibility)

**What should they experience AFTER using the product?**
- For user-facing: target emotions (confident, in control, informed, relieved)
- For developer-facing: flow states (obvious next step, clear errors, quick integration)
- For infrastructure: operational confidence (observable, self-healing, clear alerts)

The journey from BEFORE to AFTER is the product's job. Every feature exists to create this shift.

### 4. Map User Journeys

For each core journey, walk through it step by step. At each step, note what the user DOES, what they SEE/GET, and the experience quality.

```
Journey: "Check on my running agent"

Step 1: Open the app
  DOES: Clicks the app icon / opens browser tab
  SEES: [what should appear]
  FEELS: Anticipation — "let me see what's happening"
  DESIGN IMPLICATION: Content must load within 2 seconds. No blank screens.

Step 2: Scan for status
  DOES: Glances at the main view
  SEES: Agent status, progress, current phase
  FEELS: Relief — "ok, it's working" OR Concern — "it's stuck, let me dig in"
  DESIGN IMPLICATION: Status must be readable in under 3 seconds without clicking anything.
```

For **developer-facing products**, the column shifts:
```
Journey: "Integrate the payments API"

Step 1: Find the right endpoint
  DOES: Searches docs / reads SDK types
  GETS: Endpoint name, required params, auth requirements
  FRICTION: Low (obvious) | Medium (requires digging) | High (have to read source)
  DESIGN IMPLICATION: Every endpoint discoverable via autocomplete or a single doc page.
```

The DESIGN IMPLICATION at each step is what makes this actionable. It translates experience into constraint.

### 5. Define Jobs with Outcomes

**When** I'm running a complex multi-agent task,
**I want to** see all agents and their status at a glance,
**so I can** feel confident that everything is progressing
**instead of** feeling anxious about what's happening in terminals I can't see.

The "instead of" is crucial — it names the experience the product replaces.

Group into:
- **Core jobs** (must do — without these, the product has no reason to exist)
- **Supporting jobs** (should do — these make the core jobs easier/better)
- **Delight jobs** (could do — these create moments of "wow, this is great")

### 6. Assess Existing Features (if applicable)

If the product already exists, evaluate each feature/surface against the user profiles and journeys:

| Feature/Surface | Serves which job? | Current experience | Target experience | Verdict |
|----------------|------------------|-------------------|------------------|---------|
| Ops Console | "Check on my agent" | Confusion (empty) | Confidence | **Fix** |
| Swimlanes | Unclear | No purpose distinct from Ops Console | — | **Kill** |

The verdict options:
- **Kill** — No job. Remove it. Fewer excellent things > many mediocre things.
- **Fix** — Right job, wrong execution. Make it deliver.
- **Keep** — Working. Creates the right outcome. Don't touch.
- **Build** — Important job not yet served. Create it.
- **Defer** — Valid job but not critical. Build after core jobs work.

### 7. Define the Contract

This is the single most important output of the brief. It's a promise to the user:

**For user-facing products:**
"When you use [product], you will feel [emotions] because [what the product does for you]."

**For developer-facing products:**
"When you use [product], you will [be able to do X] within [timeframe/effort] because [what the product handles for you]."

**For infrastructure:**
"When [product] is running, you can trust that [guarantee] because [how it ensures this]."

Everything in the product must serve this contract. If a feature doesn't contribute, it doesn't belong.

### 8. Produce Brief

Write `product/brief.md` using the template at `../templates/brief-template.md`.

### 9. Present in Terminal

Display the full brief directly in the terminal conversation:
- Contract first (the core promise — 1-2 sentences)
- Alternatives landscape (what exists, where the opportunity is)
- User profiles with before/after states
- Core user journeys with design implications
- Jobs with outcomes
- Kill/Fix/Keep/Build/Defer table for existing features
- Scope boundaries (IN/OUT/LATER)

The report file at `product/brief.md` is for persistence — the terminal is the primary output. Do NOT generate a separate HTML visual summary.

## Scope Calibration

| Scope | Brief depth |
|-------|-------------|
| Component | Skip brief mode — components don't need product briefs. Suggest spec mode instead. |
| Feature | Lightweight — see feature-scope rules below. ~1 page max. |
| View | Brief for the view's purpose: what should the user accomplish here? ~1-2 pages. |
| Module | Consumer brief: who consumes this, what do they need? ~1-2 pages. |
| Product | Full brief with profiles, journeys, contract, feature assessment, alternatives. 3-5 pages. |
| Multi-product | Platform brief with cross-product coherence. 5-8 pages. |

### Feature-scope rules

A feature brief is a single page. It answers three questions: who has what problem, what should the feature do for them instead, and what's in/out. That's it.

**Include (keep each short):**
- Contract (1-2 sentences)
- One user profile with before/after states (one paragraph, not a full profile)
- One core journey (3-5 steps max)
- 1-2 core jobs with "instead of" contrast
- Scope: one-liner each for IN, OUT, LATER

**Skip entirely for feature scope:**
- Feature assessment table (there's only one feature — the one you're defining)
- Success metrics table
- Key decisions table
- Risks table
- Multiple user profiles
- Multiple journeys
- Delight jobs
- Alternatives analysis

The instinct to be thorough works against you at feature scope. A feature brief that reads like a product brief has failed at calibration. If you find yourself writing a second journey or a risks table, stop — you've left feature scope.
