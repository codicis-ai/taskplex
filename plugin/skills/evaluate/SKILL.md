---
name: evaluate
description: Evaluate existing products and validate implementations. Audit apps, CLIs, APIs, and libraries for quality, usability, and developer experience. Review implementations against product briefs. Use this skill when the user asks to evaluate something that already exists — "is this any good?", "audit this", "review the UX", "check the developer experience", "does this CLI work well?", "evaluate my API", "how's the quality?", "DX audit", "did we deliver what the brief promised?", "validate against the brief". Also triggers on "review implementation", "product review", "UX review", "is this ready?". If the user wants a product brief or wants to plan what to build, use /plan instead — briefs live there now.
allowed-tools: mcp__playwright__*, Bash(agent-browser:*), Bash(npx agent-browser:*)
---

# /evaluate — Evaluate What Exists

Product evaluation skill for auditing existing products and reviewing implementations against briefs. Works at any scope and for any product type.

**Note**: Brief mode has been absorbed into `/plan` (Full route, Phase 2). Spec mode has been retired (taskplex's design phase covers this). This skill now focuses on **audit** and **review** — the evaluation bookends of the build cycle.

## Mode Router

Parse the user's input to determine mode and scope.

**Modes** (explicit or inferred):
- `audit` — Investigate what exists. Default when user says "audit", "check", "what's wrong", "UX audit", "is this any good", "DX audit"
- `review` — Validate implementation against brief/criteria. Default when user says "validate", "does it match", "review against", "did we deliver"
- No mode specified — Run `audit`

**Redirects** (point users to the right command):
- If user asks for a **brief** ("what should this be", "product brief", "what should I build") → Tell them: "Briefs are now part of `/plan`. Run `/plan` with the Full route to get research + product context + architecture."
- If user asks for a **spec** ("spec this out", "design spec", "how should this work") → Tell them: "Specs are handled by `/tp`'s design phase, or run `/plan` first for the full thinking pipeline."

**Scope detection** (from the subject):
Read `./references/scope-guide.md` to calibrate depth.

| Signal | Scope |
|--------|-------|
| Component name, file path, CSS class | Component |
| Feature name, pipeline, "the auth flow" | Feature |
| View name, page, route, URL path | View |
| Package name, "the adapter", module | Module |
| App name, "the whole app", no qualifier | Product |
| Multiple products, "the ecosystem" | Multi-product |

**Product type detection** (determines which questions to ask and how to frame findings):

| Signal | Product Type |
|--------|-------------|
| Routes, views, pages, components, CSS, browser | **UI App** (web, desktop, mobile) |
| Commands, flags, args, terminal, stdout | **CLI** |
| Endpoints, schemas, requests, SDK | **API / Service** |
| Package, imports, types, exports, consumers | **Library / Module** |
| Pipeline, jobs, cron, queue, workers | **Data / Infrastructure** |

Product type matters because different products have different "users" and different ways of being good. A CLI's user experience is about flags and output formatting. An API's user experience is about discoverability and error messages. A library's user experience is about import ergonomics and documentation. Adapt your language and evaluation criteria to the product type — don't force screen/view terminology onto a CLI or API.

## Execution

1. **Detect mode, scope, and product type** from user input
2. **Read the mode file**: `./modes/{mode}.md` (audit.md or review.md)
3. **Read scope guide**: `./references/scope-guide.md` for depth calibration
4. **Execute the mode** following its instructions, adapting for product type
5. **Present results in the terminal**
6. **Write the report file** to `.claude-task/{taskId}/product/` or `./product/` if no task context

## Output Strategy

**Terminal-first.** All reports are presented directly in the terminal conversation.

**Browser only for visual comparison.** The browser is used only when review mode needs a before/after comparison with significant visual differences.

**Report files** are written to a `product/` directory for persistence:
- If inside a `.claude-task/` context: `.claude-task/{taskId}/product/`
- If standalone: `./product/` in the current working directory

## Key Principles

1. **Live inspection over imagination.** If there's a running app, use agent-browser. If it's a CLI, run it. If it's an API, call it. Don't guess what the experience is like — try it.
2. **Code-grounded.** Reference actual files, functions, types, stores. Not abstractions.
3. **Scope-calibrated depth.** A button audit is 1 page. A product audit is 10. Read the scope guide.
4. **Opinionated.** Make hard calls. "6 empty views" is a problem. An API with no error details is a problem.
5. **Actionable outputs.** Every output can be directly acted on.
6. **Adapt to product type.** Don't evaluate a CLI like a web app or an API like a dashboard.

## How This Fits the Workflow

```
/evaluate audit → "here's what exists and what's wrong"
       ↓ (feeds into)
/plan (Full route) → research → brief → architect → approve
       ↓
/tp --plan → implement
       ↓
/tp completion → auto-suggests review if brief exists
       ↓
/evaluate review → "did we deliver the contract?"
```

Audit and review are the evaluation bookends. Everything in between is `/plan` + `/tp`.
