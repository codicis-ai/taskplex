# CEO & Board Architecture in Pi

## Background

Based on the "CEO and Board" multi-agent decision system (IndyDevDan / Pi CEO Agents video).
Core concept: **Uncertainty in → Decisions out**, built as a pi extension.

---

## What Pi Provides That Makes This Natural

| Original Concept | Pi Primitive |
|---|---|
| The Brief (validated input) | Prompt template + `input` event validation |
| CEO Agent (Opus, orchestrates) | Main pi session + model set to Opus |
| Board Members (Sonnet personas) | Sub-agent processes (like the `subagent` extension example) |
| Adversarial debate rounds | CEO calls a `board_deliberate` custom tool in a loop |
| Constraint enforcement (time/budget) | Extension tracking cost via `message_end` events + wall clock |
| Observability / backroom logging | `tool_call`, `tool_result`, `agent_end` hooks writing to a log file |
| The Memo (output doc) | `board_memo` custom tool that writes a structured `.md` file |

---

## The Two Viable Build Approaches

### Option A: Pure Skill + Existing Subagent Extension

Install the existing `subagent` extension, define board members as `.pi/agents/*.md` files,
write a `SKILL.md` that tells the CEO (main Opus session) how to run deliberation rounds.
Light lift, works with existing infrastructure.

**Tradeoff:** No hard constraint enforcement. No budget ceiling. The CEO can just keep looping.
Observability is whatever pi already logs.

### Option B: Dedicated Extension (full fidelity to the original design)

A `.pi/extensions/board/index.ts` that owns the entire workflow. This is what gets you the
constraint termination, structured observability, and memo output.

**Structure:**
```
.pi/
├── extensions/
│   └── board/
│       ├── index.ts          ← main extension
│       └── agents/           ← board member system prompts
│           ├── revenue.md
│           ├── compounder.md
│           ├── contrarian.md
│           └── moonshot.md
├── prompts/
│   └── board-brief.md        ← validated brief template
└── agents/                   ← if also using subagent ext
```

---

## Option B — How It Actually Works

### 1. The `/board` Command
- Reads the brief from current session or a file arg
- Validates required sections (`## Situation`, `## Stakes`, `## Constraints`, `## Key Questions`) — blocks if missing
- Sets the session model to Opus (CEO)
- Injects CEO system prompt via `before_agent_start`
- Starts the constraint clock (wall time + token budget from brief)
- Hands control back to the CEO with: *"The brief is loaded. Begin the board meeting."*

### 2. The `board_deliberate` Tool
- CEO calls this with a question/frame to put to a specific board member (or all)
- Extension spawns a `pi --mode json -p --no-session` subprocess per board member
- Each subprocess gets: board member system prompt, the brief, the CEO's question
- Results stream back and are assembled into a structured debate transcript
- CEO sees all positions and can call `board_deliberate` again for follow-up rounds

### 3. Constraint Tracking
- Extension tracks cumulative cost in `message_end` events (every assistant message has `usage.cost`)
- Tracks wall time from command start
- When either limit hits: injects a steering message via `pi.sendMessage()` →
  `"TIME/BUDGET LIMIT REACHED. You must now make a final call and write the memo."`
- Blocks further `board_deliberate` calls after limit

### 4. The `board_memo` Tool
- CEO calls this when ready to conclude
- Parameters: `decision`, `rationale`, `resolved_tensions[]`, `unresolved_tensions[]`, `next_actions[]`
- Extension writes a structured `.md` file with timestamp + optional SVG strategy map
- Writes a separate `board-observability.jsonl` with full deliberation transcript

### 5. Observability
- `tool_call` hook logs every board tool call to `.board-session/log.jsonl`
- `tool_result` hook logs every board member response
- `agent_end` hook writes the full transcript summary
- Human can `/board:log` to see the backroom talk in-session

---

## Key Design Decisions

### Decision 1: CEO Model Switching
The extension can call `pi.setModel()` to switch the main session to Opus when `/board` runs,
and optionally restore it after. This is clean. Or you could mandate the user pre-selects Opus.

### Decision 2: Board Member Isolation
The subagent example uses `pi --mode json -p --no-session` subprocess spawning. This gives genuine
process isolation and each board member has a completely clean context. The alternative is using
the SDK's `createAgentSession()` in-process. Subprocess is simpler and already proven. The only
cost is spawn overhead per deliberation round (~1-2s).

### Decision 3: Debate Structure
The CEO could either:
- **(Sequential)** Call each board member one at a time, then synthesize
- **(Parallel then react)** Call all four board members in parallel first, then call targeted follow-ups

Parallel first is faster and generates richer tension because the CEO presents all positions
simultaneously. Sequential is more faithful to a real board meeting flow.

### Decision 4: Brief Validation
The `input` event fires before the agent processes anything. We can intercept `/board` or the
brief text there and block with `{ action: "handled" }` + `ctx.ui.notify()` if sections are
missing. Hard gate before any tokens are spent.

### Decision 5: Memo SVG
The original generates an SVG. In pi this would be the `board_memo` tool generating an SVG string
embedded in the output `.md`. Simple enough — a strategy-map SVG can be generated as a template
with the CEO's text injected. Or skip it and make the memo a clean Markdown doc with a structured
decision map section.

---

## Recommended Build Order

1. **Brief prompt template** — with section validation, zero-risk, immediately useful
2. **Board member agent `.md` files** — defines the four personas (Revenue, Compounder, Contrarian, Moonshot)
3. **Extension skeleton** — `/board` command, model switch, constraint clock
4. **`board_deliberate` tool** — the core debate loop
5. **`board_memo` tool + observability** — the structured outputs

---

## Board Member Personas

| Agent | Drive | Lens |
|---|---|---|
| **Revenue Agent** | Immediate cash | What makes money now? |
| **Compounder** | Long-term advantage | What builds durable value? |
| **Contrarian** | Expose flaws | What are we getting wrong? |
| **Moonshot** | Asymmetric upside | What's the 10x move? |

---

## Brief Template (Required Sections)

```markdown
## Situation
[What is happening and why a decision is needed]

## Stakes
[What is at risk — financial, strategic, reputational]

## Constraints
- Time limit: Xm
- Budget limit: $X
- [Other real-world constraints]

## Key Questions
1. [The specific decisions to be made]
```
