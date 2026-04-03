# TaskPlex Gate Catalog
<!-- Canonical reference for all validation gates. Phase docs reference this; do not restate gate definitions inline. -->

**Canonical ownership**: This file is the single source of truth for gate names, verdict enums, trigger patterns, blocking behavior, and execution order. No phase doc, agent definition, or hook may redefine these. Phase docs reference this catalog; they do not duplicate it.

## Design Phase Gates (Pre-Validation)

Design phase gates enforce staged user interaction during the init → brief flow. These are tracked by `manifest.designPhase` and enforced by the `tp-design-gate` hook (PreToolUse on Edit|Write).

| Sub-Phase | Artifacts Unlocked | User Interaction Required | designDepth |
|-----------|-------------------|--------------------------|-------------|
| `convention-scan` | manifest.json, progress.md | None (auto) | both |
| `convention-check` | CONVENTIONS.md | 2-4 targeted questions → answers | full only |
| `intent-exploration` | intent-and-journeys.md, research.md | Synthesize context → confirm with user → adaptive gap-filling questions | both |
| `approach-review` | (no new artifacts) | 2-3 approaches → user selects | full only |
| `design-approval` | (no new artifacts) | Section-by-section design → user approves each | full only |
| `brief-writing` | brief.md, spec.md, plan.md, architecture.md | Write from approved design | both |
| `prd-bootstrap` | prd.md, prd-state.json | None (agent auto) | PRD only |
| `prd-critic` | strategic-review.md, tactical-review.md | None (agent auto) | PRD only |
| `prd-approval` | (no new artifacts) | PRD presentation → user approves | PRD only |
| `planning-active` | All artifacts | None — past design | all |

**Light mode** skips: `convention-check`, `approach-review`, `design-approval`.
**`--skip-design`** has been removed. If passed, the user is informed and auto-routed to `--light`.

---

## Gate Registry

Every gate has a canonical name, verdict enum, validation step, and profile applicability. This is the single source of truth.

### Required Gates (run for all applicable profiles)

| Gate | Step | Verdict Values | Manifest Field | Profiles |
|------|------|----------------|----------------|----------|
| `build` (typecheck) | 1 | `passed` / `failed` | `validation.typecheck` | all |
| `build` (lint) | 1 | `passed` / `failed` | `validation.lint` | all |
| `build` (tests) | 1 | `passed` / `skipped` / `failed` | `validation.tests` | all |
| `conventionCompliance` | 1b | `passed` / `partial` / `failed` / `N/A` | `validation.conventionCompliance` | all (N/A if no conventions.json) |
| `security` | 2 | `PASS` / `WARN` / `FAIL` | `validation.security` | all |
| `closure` | 3 | `PASS` / `FAIL` | `validation.closure` | all |
| `codeReview` | 4 | `APPROVED` / `NEEDS_REVISION` / `N/A` | `validation.codeReview` | standard, blueprint, enterprise (N/A for lean/light) |
| `traceability` | 0.5 | `passed` / `partial` / `failed` / `N/A` | `validation.traceability` | standard, enterprise (N/A for lean) |
| `readiness` | 7 | `passed` / `failed` / `accepted_risk` / `N/A` | `validation.readiness` | enterprise only (N/A for lean, standard) |
| `hardening` | 7.5 | `PASS` / `WARN` / `FAIL` / `N/A` | `validation.hardening` | standard, enterprise (N/A for lean) |
| `compliance` | 8 | `PASS` / `FAIL` | `validation.compliance` | all (always last) |

### Conditional Gates (triggered by file patterns)

| Gate | Step | Trigger Pattern | Verdict Values | Profiles |
|------|------|-----------------|----------------|----------|
| `database` | 5 | `**/*.sql`, `migrations/**`, `schema/**` | `PASS` / `WARN` / `FAIL` | standard, enterprise |
| `e2e` | 5 | `**/*.tsx`, `**/*.jsx`, `pages/**`, `components/**` | `PASS` / `FAIL` | standard, enterprise |
| `userWorkflow` | 5 | `**/route*`, `**/nav*`, `**/router*` | `PASS` / `WARN` | standard, enterprise |

### Enterprise Conditional Gates (enterprise profile only)

| Gate | Step | Trigger Pattern | Verdict Values |
|------|------|-----------------|----------------|
| `dependencyCompliance` | 5.5/E1 | `package.json`, lockfiles, `Cargo.toml`, `requirements.txt` | `PASS` / `WARN` / `FAIL` |
| `migrationSafety` | 5.5/E2 | `migrations/**`, `**/*.sql`, `schema/**` | `PASS` / `FAIL` |
| `operability` | 5.5/E3 | `api/**`, `jobs/**`, `workers/**` | `PASS` / `FAIL` |

### Custom Gates (from conventions.json)

| Gate | Step | Trigger | Verdict Values | Profiles |
|------|------|---------|----------------|----------|
| `custom:{name}` | 5.7 | Always (if registered) | `PASS` / `WARN` / `FAIL` | all |

Custom gates: max 5, timeout <= 60s, sandboxed, additive only. Run after all standard gates, before compliance.

### Extension Agents (from conventions.json)

| Gate | Step | Trigger | Verdict Values | Profiles |
|------|------|---------|----------------|----------|
| `extension:{name}` | 5.8 | File pattern match from extension config | `PASS` / `WARN` / `FAIL` | all |

---

## Execution Order

Gates always execute in this order. No gate may run out of sequence.

1. **Step 0**: Artifact validation (blocking pre-check)
2. **Step 0.5**: Traceability (standard + enterprise)
3. **Step 1**: Build — typecheck, lint, tests
4. **Step 1b**: Convention compliance
5. **Step 2**: Security review
6. **Step 3**: Closure
7. **Step 4**: Code review (standard + enterprise)
8. **Step 5**: Conditional gates (database, e2e, userWorkflow)
9. **Step 5.5**: Enterprise conditional gates (E1, E2, E3)
10. **Step 5.7**: Custom gates
11. **Step 5.8**: Extension agents
12. **Step 6**: Build-fixer (if any failures)
13. **Step 7**: Readiness verdict (enterprise)
14. **Step 7.5**: Hardening (standard + enterprise)
15. **Step 8**: Compliance (always last)
16. **Step 9**: Write validation-gate.json

---

## Gate Decision Logging

Every gate logs to `.claude-task/{taskId}/gate-decisions.json`:

```json
{
  "gate": "{gate name}",
  "step": "{step number}",
  "triggered": true,
  "triggerReason": "required | conditional:{pattern} | skipped:{reason}",
  "verdict": "PASS | WARN | FAIL | SKIP | N/A",
  "blocking": true,
  "policyRef": "profiles.{profile}.requiredGates | conditionalGates.{gate}",
  "timestamp": "ISO"
}
```

**Rules:**
- Log AFTER the gate executes (verdict known)
- Skipped gates: `verdict: "SKIP"`, `triggered: false`
- N/A gates (profile doesn't require): `verdict: "N/A"`, `triggered: false`
- Compliance agent reads gate-decisions.json to verify all required gates ran

---

## Manifest Writeback Protocol

After EVERY gate completes, the orchestrator MUST:
1. Read manifest.json
2. Set `manifest.validation.{field}` to the verdict
3. Write manifest.json to disk
4. Append to gate-decisions.json

The heartbeat hook does NOT do this — it is the orchestrator's responsibility.

---

## Retry and Limit Enforcement

Before each retry of a gate:
1. Read `manifest.iterationCounts.reviewRounds.{gate}` (or `.buildFixRounds`)
2. If at limit → do NOT retry, mark `blocked:{reason}`
3. If under limit → increment counter, write manifest, proceed

Limits are defined in `~/.claude/taskplex/policy.json` per profile.

---

## Invariant Floor

These gates cannot be disabled, replaced, or skipped by conventions, extensions, or user overrides:

1. `security` — runs every task, all routes
2. `closure` — verifies brief requirements met
3. `compliance` — final gate, always last
4. `build` — typecheck + lint + test step (commands can be overridden, step cannot be skipped)

See `~/.claude/taskplex/policy.md` → "Invariant Floor" for the full list of non-overridable behaviors.
