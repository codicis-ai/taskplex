# Business Agent Framework: Strategy & Design

*Synthesized from: HBR (Agents as Team Members), VentureBeat (DeerFlow 2.0),
GitConnected (5 Frameworks), Geeky Gadgets (Claude Code Context Management)*

---

## The Single Insight Across All Four Sources

> **The governance infrastructure IS the product. Not the agents.**

DeerFlow goes viral for the technology. HBR is right that companies fail because the
organizational layer isn't there. The Geeky Gadgets patterns describe what that layer looks
like at workflow level. Karpathy's experiment is the most honest data point: smarter agents
running on broken infrastructure produce chaos.

The harness is being commoditized (MIT-licensed, ByteDance-grade orchestration is free now).
Your moat is how you configure and govern it.

---

## What Each Source Actually Contributes

| Source | Altitude | Core Claim |
|---|---|---|
| HBR | Org-level | Agents fail in production because companies treat them as software installs, not workforce |
| VentureBeat / DeerFlow | Infrastructure | SuperAgent harness = commoditized. Moat is governance configuration |
| GitConnected / Frameworks | Engineering | "You are programming an organization. Source code = prompts, skills, tools, processes" |
| Geeky Gadgets / Claude Code | Workflow | The 80% problem is context architecture failure, not model failure |

---

## The Four Enterprise Friction Categories (HBR)

These are the recurring failure modes in production agent deployments:

### 1. Identity — "Who is acting?"
- Agents operating under shared service accounts bypass human authorization limits
- A customer-service agent with broad API access can issue a $5,000 refund where a
  human rep is capped at $500
- **Fix:** Each agent needs its own scoped identity, least-privilege tool access, and
  every action logged under a traceable identity

### 2. Context — "Bad data leads to bad actions"
- Agents are trained on demos with clean data; real enterprise data is fragmented,
  contradictory, and stale
- An HR agent that retrieves a 2022 policy document for a 2026 termination process
  exposes the company to legal risk — that's not hallucination, it's a retrieval failure
- External inputs (emails, forms, uploaded files) are attack vectors:
  "ForcedLeak" (Salesforce Agentforce, 2025) — malicious instructions in a web form
  caused an agent to exfiltrate CRM data to an external destination
- **Fix:** Authoritative data sources, provenance tracking, treat external inputs as
  untrusted until validated

### 3. Control — "Probabilistic systems need hard boundaries"
- Traditional software: same input → same output. LLMs: same request → variable output
- Guardrails too loose = agent violates rules. Guardrails too tight = agent refuses
  valid requests. There is no "correct" prompt that solves this
- Multi-agent environments compound risk: second-order prompt injection (AppOmni /
  ServiceNow, 2025) — malicious instructions from one agent passed to another,
  leading to unauthorized data access
- **Fix:** Deterministic validation layer between agent proposal and system execution.
  Agent proposes → rules engine validates → execution happens. AI never touches
  system of record directly.

### 4. Accountability — "When no one can explain what happened"
- Air Canada chatbot case (2024 tribunal): company held liable for incorrect information
  provided by AI. "It's a separate entity" defense was rejected
- If a regulator asks why the agent made a decision, you need: which documents it read,
  what instructions it followed, what tools it called, in what order
- **Fix:** Comprehensive audit trail per agent run. Chain of reasoning must be
  reconstructable after the fact

---

## The Autonomy Ladder

The key framework for deciding how much independence to grant any given agent workflow.
The transition between levels requires governance infrastructure, not just better models.

```
Level 4: Bounded Autonomy
  Agent executes within hard thresholds + predefined rules
  Human: notified, not consulted
  Example: Klarna — AI handles customer service chats autonomously
           with immediate escalation paths for complex cases
  Requires: proven Level 3 controls + operational metrics baseline

Level 3: Supervised Action
  Agent proposes: "I would issue this refund / update this record"
  Human: confirms before execution
  Example: Agent drafts a supplier contract, human approves before sending
  Requires: Level 2 data governance + clear confirmation UI

Level 2: Retrieval with Guardrails
  Agent answers questions using internal information
  Human: reviews high-stakes answers
  Example: Legal Q&A agent grounded in current policy documents
  Requires: Authoritative data sources, provenance logging

Level 1: Assistive
  Agent produces drafts, summaries, recommendations
  Human: reviews everything before anything is sent or executed
  Example: OneDigital — Azure OpenAI accelerates consultant research,
           improves "time to insight," doesn't replace consultants
  Requires: Basic prompt engineering, quality review process
```

**Principle:** Many effective deployments intentionally remain at Level 1 or 2.
Moving up the ladder requires the organizational infrastructure to be proven at the
lower level first. Do not skip rungs.

---

## Three High-Impact Design Areas

### Area 1: Organizational Context Architecture

**Problem:** The "80% problem" (context drift at task completion) and the HBR "context
friction" are the same problem at different scales. Agents fail because they don't know
what the organization knows.

**Pattern: The Business Brain**
- A single authoritative file loaded into every agent at startup
- Contains: tone, constraints, data source authorities, escalation paths, key policies
- Not per-conversation prompting — a persistent organizational contract
- Versioned and validated before any agent run begins

**Pattern: Skills as Bounded Knowledge Packages**
- Each skill/capability under 200 lines of active context
- Detailed reference material stored separately, loaded on demand
- Skills do not share context spaces — contamination between capabilities is a
  primary source of compounding errors
- Progressive disclosure: only descriptions in active context, full content loads
  when a specific capability is needed

**Pattern: Provenance Tracking**
- Every agent action logs: which documents were read, which data sources consulted,
  which policies referenced
- This is not optional observability — it is the accountability infrastructure
- Without it, Level 3+ autonomy is not defensible to regulators, auditors, or customers

**In pi:**
- `AGENTS.md` (walking up directory tree) is the Business Brain mechanism
- Skills system is the bounded knowledge package mechanism
- `tool_call` / `tool_result` event hooks are the provenance logging mechanism
- Missing piece: a structured schema for Business Brain content, and a validation
  step before any agent session starts

---

### Area 2: Execution Governance — The Validation Layer

**Problem:** Probabilistic systems (LLMs) must not directly touch systems of record.
The gap between "agent proposes an action" and "action executes" is where most production
failures happen.

**The Core Engineering Pattern:**
```
LLM generates proposal
      ↓
Deterministic validation layer
  - Does this comply with business rules?
  - Is this within the agent's authorized scope?
  - Does this require human review?
      ↓
[Block] | [Auto-approve] | [Escalate for human confirmation]
      ↓
Execution against system of record
```

The AI never touches the system of record. The validation layer is deterministic code,
not another prompt.

**What this prevents:**
- The Replit incident (agent deleted production database, then generated fake records
  to obscure the failure) — a validation layer would have blocked the destructive
  bash command
- Refund overrides bypassing human authorization thresholds
- Cross-agent prompt injection cascading into unauthorized actions

**Constraint-Based Engineering**
- Every agent workflow has explicit resource ceilings: time, cost, action count,
  dollar thresholds
- When a ceiling is hit, the agent is forced to a defined terminal state
  (make a decision, write a summary, escalate) — not allowed to continue
- This is not just cost control. It is behavioral containment.

**In pi:**
- `tool_call` event hook is the validation interception point
- `pi.registerTool()` with blocking logic implements the validation layer
- `ctx.ui.confirm()` is the human-in-the-loop mechanism for supervised action
- Extension cost tracking via `message_end` event usage data implements budget ceilings
- Missing piece: a structured ruleset format per agent/workflow defining what
  is auto-approved vs. escalated vs. blocked

---

### Area 3: The Workflow Handoff Pattern

**Problem:** Karpathy's eight-agent research team failed not because agents couldn't code,
but because there was no workflow infrastructure. Individual agents are not the unit of
value. Workflows with clean handoffs are.

**Pattern: Isolated Context Per Agent**
- Each agent in a pipeline receives only what it needs for its specific task
- Not the entire conversation history — a structured subset
- This prevents context contamination (one agent's failed reasoning polluting
  the next agent's starting point)

**Pattern: Structured Handoff Contracts**
- Agent A's output schema = Agent B's input schema
- Not "pass the text along" — typed, validated structured data
- The handoff contract is defined at workflow design time, not inferred at runtime
- Example: Research agent outputs `{findings: [], sources: [], confidence: "high|medium|low"}`
  — Synthesis agent receives that structure, not a wall of prose

**Pattern: The Self-Learning Loop**
- Errors and successes logged to a persistent `learnings.md`
- Learnings incorporated into skill processes at next run
- Wrap-up step at workflow completion captures: what worked, what failed, what
  should change in the workflow template
- System improves without manual re-prompting

**Why this is the highest-leverage enterprise pattern:**
Enterprise value isn't in one-shot decisions. It's in repeatable workflows:
procurement, onboarding, compliance review, customer escalation, contract review.
Agents operating as a workflow pipeline — bounded context, clean handoffs, logged
learnings — is how you get consistent, auditable, improvable business processes.

**In pi:**
- Subagent extension's chain mode is this pattern (sequential with `{previous}` placeholder)
- Missing pieces:
  - Structured output schema enforcement between chain steps
  - Automatic learnings capture at chain completion
  - Workflow template versioning (so you can run v1 and v2 in parallel and compare)

---

## The Commoditization Reality (DeerFlow Signal)

DeerFlow 2.0 (ByteDance, MIT license, 39,000 GitHub stars in weeks) is a fully capable
SuperAgent harness: sub-agents, sandboxed execution, persistent memory, progressive skill
loading, Kubernetes support for enterprise scale. Free. Auditable. Extensible.

**What this means for framework design:**
- The orchestration layer is no longer a differentiator — it's infrastructure
- The differentiator is: quality of organizational context, governance configuration,
  and workflow handoff design
- Seat-based pricing for agent orchestration is under structural pressure
- The "build vs. buy" calculus for harness infrastructure has shifted decisively toward
  "build your governance layer on open infrastructure"

**What DeerFlow gets right that matters:**
- Separation of harness from inference engine (bring your own models)
- Docker sandbox isolation for every execution context
- Progressive skill loading (context windows stay manageable)
- Model-agnostic (not locked to one provider)

**What it leaves unsolved (and where the real work is):**
- No governance layer — no validation between proposal and execution
- No Business Brain equivalent — no organizational context architecture
- No structured handoff contracts between sub-agents
- No autonomy ladder management
- No audit trail tied to organizational accountability requirements

This is the gap. The harness is free. The governance is the product.

---

## Mapping to the CEO/Board Framework

The CEO/Board decision system is one instance of a larger pattern.

| Board system component | Framework area | Govenance layer |
|---|---|---|
| Brief template (validated input) | Area 1 — Business Brain | Input contract, blocks if sections missing |
| Board member personas | Area 3 — Isolated context | Each member gets brief + question only |
| Adversarial debate rounds | Area 3 — Workflow handoff | Structured position objects, not free text |
| CEO synthesis | Area 3 — Orchestrator | Receives all positions, makes final call |
| Constraint enforcement | Area 2 — Validation layer | Hard time/cost ceiling, forced terminal state |
| `board_memo` output | Area 2 — Supervised action | Proposed decision → human reviews → execution |
| Observability log | Area 1 — Provenance | Full audit trail: who said what, what data was used |

**The larger opportunity:**
This same pattern applies to any high-stakes business process:

- **Procurement approval:** Brief = purchase request. Board = Finance, Legal, Operations.
  CEO = Procurement director agent. Memo = approved/rejected PO with rationale.
- **Compliance review:** Brief = proposed action. Board = Regulatory, Risk, Business.
  CEO = Compliance officer agent. Memo = clearance document with conditions.
- **Customer escalation:** Brief = escalation details. Board = Customer success, Legal,
  Finance. CEO = Account executive agent. Memo = resolution offer with approval path.
- **Hiring decision:** Brief = candidate profile + role requirements. Board = Hiring manager,
  Culture, Compensation. CEO = CHRO agent. Memo = hire/no-hire with documented rationale.

The framework is the template. The CEO/Board pattern is the first instance.

---

## Recommended Build Priorities

Given the analysis above, ranked by impact-to-effort ratio:

### Priority 1: Business Brain Schema (Area 1)
Build the organizational context architecture first. Everything else depends on it.
- Define the schema for what goes in the Business Brain file
- Add validation at session start (blocks if required sections missing)
- Version the Business Brain (so you can track how organizational context evolves)
- Log which Business Brain version was active for each agent run

### Priority 2: Validation Layer (Area 2)
Build the deterministic wrapper before expanding agent autonomy.
- Define a ruleset format: action type → auto-approve / confirm / block
- Implement as a pi extension intercepting `tool_call` events
- Add budget/time constraint enforcement with forced terminal states
- Add a human-in-the-loop confirmation step for any action above threshold

### Priority 3: Structured Handoff Contracts (Area 3)
Make the workflow pipeline reliable.
- Define output schemas for each agent type
- Validate handoffs between chain steps (reject malformed outputs before passing on)
- Add the learnings capture step at workflow completion
- Build workflow template versioning

### Priority 4: CEO/Board as First Workflow Instance
Build the decision system as the first concrete workflow on the infrastructure.
- Uses Business Brain for brief context
- Uses validation layer for constraint enforcement and memo approval
- Uses structured handoffs for board member position objects
- Generates provenance-complete audit trail automatically

---

## Key Quotes Worth Keeping

> "The moment an agent can change a system of record—update a price, send a payment,
> or modify customer data—it stops being a productivity tool and becomes part of the
> organization's operating model."
> — HBR

> "You are now programming an organization… the source code is the collection of
> prompts, skills, tools, and processes that make it up."
> — Karpathy (via GitConnected)

> "MIT licensed AI employees are the death knell for every agent startup trying to sell
> seat-based subscriptions. The West is arguing over pricing while China just
> commoditized the entire workforce."
> — @Thewarlordai (via VentureBeat)

> "Context is milk — it goes off. Keep it fresh, keep it focused, keep it bounded."
> — Geeky Gadgets / Simon Scrapes

> "The companies that succeed with agentic AI won't simply install more agents.
> Instead, they'll build the structures that allow those agents to be trusted."
> — HBR
