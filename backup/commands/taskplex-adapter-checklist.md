# TaskPlex Adapter Checklist

**Template for building a new TaskPlex adapter.** Copy this file, fill in platform-specific details, and check off each item as verified. Items marked (L1) are required for Level 1 (native) adapters; items marked (L2) are required for Level 2 (wrapper) adapters; items marked (All) are required for all adapters.

**Adapter**: _______________
**Platform**: _______________
**Target Level**: Level 1 / Level 2 / Level 3
**Author**: _______________
**Date**: _______________

---

## A. Command Entrypoint (All)

- [ ] `/start-task` (or equivalent) is registered as a discoverable command
- [ ] Command triggers the TaskPlex skill/workflow when invoked
- [ ] Arguments are passed through (`--plan`, `--prd`, task description)
- [ ] **Mechanism**: _______________

## B. Path Resolution (All)

- [ ] Core contract files are accessible at a known path
- [ ] Phase docs (adapter-translated) are loadable on demand
- [ ] Agent definitions are at platform-specific paths
- [ ] Hook scripts/plugins are at platform-specific paths
- [ ] Project-level config overrides global config
- [ ] **Path mapping documented** (Claude Code path → adapter path)

## C. Persistent Task State (All)

- [ ] `.claude-task/{taskId}/` directory can be created and persists across sessions
- [ ] `manifest.json` can be read and written atomically
- [ ] All artifact contract files can be created in the correct structure
- [ ] Artifacts survive session restarts, context resets, and agent crashes
- [ ] **Verified**: Restart agent mid-task, confirm `.claude-task/` intact

## D. File and Shell Operations (All)

- [ ] Agent can read files (any file in workspace)
- [ ] Agent can write/edit files
- [ ] Agent can search files (grep/glob equivalent)
- [ ] Agent can execute shell commands (build, test, git)
- [ ] Sandbox/permission model documented

## E. User Interaction (All)

- [ ] Agent can present questions to the user and receive responses
- [ ] Plan lifecycle validation gate (Step 7b) works — user can choose from options
- [ ] Convention conflict prompts work
- [ ] **If degraded**: Text-based confirmation documented as degradation

## F. Phase and State Sync (L1)

- [ ] Manifest.json `lastUpdated` is refreshed on every file edit
- [ ] `modifiedFiles` array is updated on every file edit
- [ ] `toolCallCount` / `toolCallsByType` are incremented
- [ ] Phase auto-promotion works (heartbeat detects phase-relevant actions)
- [ ] **Mechanism**: _______________ (hook event / plugin / explicit writes)
- [ ] **Enforcement**: hard / advisory

### F — Level 2 alternative
- [ ] Sidecar/controller owns manifest updates
- [ ] Agent reports file changes to controller
- [ ] Controller updates manifest on agent reports

## G. Subagent Delegation (L1)

- [ ] Custom agents/subagents can be defined for review roles
- [ ] Subagents have isolated context (don't pollute parent)
- [ ] Subagents can read/write files in `.claude-task/`
- [ ] Per-subagent model assignment works (or degradation documented)
- [ ] **Parallel**: yes / no / partial
- [ ] **Max nesting depth**: _______________

### G — Level 2 alternative
- [ ] Roles are serialized (orchestrator handles each review sequentially)
- [ ] Degradation documented: serialized roles, no parallel fan-out

## H. Hook System (L1)

- [ ] **Heartbeat**: Fires on file edits, updates manifest
  - Event: _______________
  - Enforcement: hard / advisory
  - Reliability: strong / moderate / weak

- [ ] **Pre-commit blocking**: Prevents `git commit` without `validation-gate.json`
  - Event: _______________
  - Enforcement: hard / advisory
  - Can block: yes / no

- [ ] **Session recovery**: Detects in-progress tasks on session start
  - Event: _______________
  - Can inject context: yes / no

- [ ] **Stop guard**: Warns or prevents premature task termination
  - Event: _______________
  - Can block: yes / no

- [ ] **Checkpoint**: Saves state before context compaction
  - Event: _______________
  - Fires before compaction: yes / after

### H — Level 2 alternative
- [ ] Heartbeat behavior embedded in skill/instruction (advisory)
- [ ] Pre-commit enforcement via instruction (advisory) or wrapper script (hard)
- [ ] Session recovery via platform resume + instruction check
- [ ] All advisory workarounds documented as degradations

## I. Model Tier Mapping (All)

- [ ] Tier 1 (reasoning): model = _______________
- [ ] Tier 2 (balanced): model = _______________
- [ ] Tier 3 (fast): model = _______________
- [ ] Per-role model assignment: supported / collapsed to single model
- [ ] **If collapsed**: Documented as degradation

## J. Recovery and Resume (All)

- [ ] Agent can detect incomplete tasks (manifest with `status: in-progress`)
- [ ] Agent can resume from the correct phase
- [ ] Session context survives context resets (manifest is source of truth, not memory)
- [ ] **Platform resume mechanism**: _______________
- [ ] **Verified**: Kill task at execution phase, restart, confirm resume works

## K. Visualization Bridge (Optional)

- [ ] MCP support available for viz tool integration
- [ ] Session/manifest state can be exposed to external consumers
- [ ] **Mechanism**: _______________ (MCP / plugin events / file watching)

---

## Conformance Verification

### Core tests (All adapters)
- [ ] **Manifest round-trip**: Init flow produces valid manifest per `~/.claude/taskplex/manifest-schema.json`
- [ ] **Artifact generation**: Express/lean task produces all required artifacts per `~/.claude/taskplex/artifact-contract.md`
- [ ] **Gate decision logging**: `gate-decisions.json` entries use correct gate names and verdict enums from `~/.claude/taskplex/gates.md`
- [ ] **Resume recovery**: Interrupted task resumes from correct phase/status

### Level 1 additional tests
- [ ] **Hook equivalence**: Manifest freshness updates occur on file edits. Pre-commit blocks without validation-gate.json.
- [ ] **Subagent isolation**: Review agents produce independent artifacts without cross-contamination
- [ ] **Model tier usage**: High-reasoning roles use Tier 1, utility roles use Tier 3 (or degradation documented)

### Level 2 additional tests
- [ ] **Sidecar handoff**: Controller correctly owns state while model runtime handles execution
- [ ] **Artifact persistence**: Artifacts survive model runtime restarts

---

## Degradation Log

| Feature | Reference (Claude Code) | This Adapter | Impact | Severity |
|---------|------------------------|-------------|--------|----------|
| | | | | |

---

## Sign-off

- [ ] All required checks passed
- [ ] All degradations documented
- [ ] Capability declaration JSON published (`taskplex-adapter-capabilities.schema.json`)
- [ ] Conformance fixtures validated

**Verified by**: _______________
**Date**: _______________
