---
name: plan
description: Strategic thinking and architecture for any scope — from exploring a new idea to designing a full product. Handles research, product briefs, and architectural planning in one unified flow. Use this skill whenever the user wants to plan something before building it, think through an idea, investigate an approach, create a product brief, design architecture, or figure out what to build. Triggers on "plan", "what should I build", "let's think about", "investigate this", "research this", "how should we approach", "product brief", "I have an idea", "design the architecture", "what's the right approach", "explore this concept", "should we build", "strategy for", "figure out the approach". Also use when the user provides GitHub repos, articles, or references to investigate before building. If someone asks for a product brief, this is the right skill — briefs are built into the Full route.
---

# /plan — Think, Research, Design

Unified command for all pre-implementation thinking. Read the full command specification at `~/.claude/commands/plan.md` and follow it.

This skill is a trigger wrapper — the actual instructions live in the command file. When this skill triggers:

1. Read `~/.claude/commands/plan.md`
2. Follow its instructions exactly (Phase 0 through Phase 5)
3. The command references evaluate mode files at `~/.claude/skills/evaluate/` for Phase 2 (Product Context) — read those when Phase 2 runs

## Quick Reference

**Two routes** (always ask the user):
- **Full** — Research → Product Context (brief) → Architecture → Critic. For new products, major features, exploration.
- **Quick** — Architecture → Critic. For tactical changes where the problem and users are known.

**Key artifacts produced:**
- `product/brief.md` — who this is for, what they need (Full route only)
- `.claude-task/plans/PLAN-{id}.md` — approved architectural plan
- `.claude-task/plans/PLAN-{id}-progress.md` — checklist state

**At the end, user chooses:**
1. Execute now → `/tp --plan PLAN-{id}`
2. Save for later
3. Keep exploring
