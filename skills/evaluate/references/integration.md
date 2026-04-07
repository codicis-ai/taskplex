# Integration Reference

How `/evaluate` connects to the rest of the workflow.

## The Unified Flow

```
/evaluate audit    → "what exists today?" (optional entry point)
       ↓ (findings inform /plan)
/plan                 → Full route: research → brief → architect → approve
                        Quick route: architect → approve
       ↓ (PLAN-{id}.md)
/tp --plan PLAN-{id}  → design → implement → validate
       ↓ (completion)
auto-review           → /tp suggests review if product/brief.md exists
```

## /evaluate audit → /plan

An audit isn't required before /plan, but it provides grounding. If `product/audit.md` exists when `/plan` Phase 2 (Product Context) runs, the brief is grounded in what the product actually does today rather than what we imagine it does.

Run an audit when:
- Entering an unfamiliar codebase
- The product has been built but never evaluated
- You want a reality check before planning changes

## Brief Mode → Now in /plan

Brief mode has been absorbed into `/plan` Phase 2 (Product Context). The Full route includes:
- Alternatives landscape
- User/consumer profiles with before/after states
- Core journeys with experience quality assessment
- Jobs to be done
- Feature assessment (Kill/Fix/Keep/Build/Defer)
- Contract + scope (IN/OUT/LATER)

Output: `product/brief.md` — same format as before, just created within /plan's flow.

When `/tp` reads `product/brief.md` (created by /plan's Phase 2), it extracts:
- **Contract** → carried forward, scoped to this task
- **Relevant user profile** → the profile whose journey this task serves
- **Relevant journey** → the journey whose design implications become ACs
- **Kill/Defer verdicts** → become scope exclusions
- **JTBD "instead of" contrasts** → inform the user story benefit clauses

## Spec Mode → Retired

Spec mode has been retired. Taskplex's design phase (Sub-phase B: Intent/User Journey) covers the same ground — user flows, scope, acceptance criteria. Running both was redundant.

## /evaluate review → Post-implementation Validation

Review mode is triggered automatically at `/tp` completion (Step 11.7) when `product/brief.md` exists. It can also be run standalone.

Review validates:
- Did the implemented feature deliver the contract?
- Does the user journey work end-to-end?
- Are design implications from the brief honored?
- Were Kill/Defer exclusions respected?

## Output Directory Convention

All product dev artifacts live in `product/`:

```
product/
├── audit.md          # What exists today (from /evaluate audit)
├── brief.md          # What it should be (from /plan Phase 2)
└── review.md         # Did we deliver? (from /tp completion or standalone)
```

When inside a `.claude-task/` context, this becomes `.claude-task/{taskId}/product/`.
When standalone, it's `./product/` in the working directory.
