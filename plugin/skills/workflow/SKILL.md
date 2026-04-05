---
name: workflow
description: TaskPlex workflow phase files and contracts. Not user-invocable — loaded by the tp skill orchestrator during task execution. Contains init, planning, QA, validation, bootstrap, and PRD phase instructions plus all contract files (policy, gates, schemas, handoffs).
---

# TaskPlex Workflow References

This skill contains the core workflow phase files and contract files used by the TaskPlex orchestrator. It is NOT directly invoked by users — the `/taskplex:tp` skill reads these files during task execution.

## Phase Files

Located in `references/phases/`:
- `init.md` — Initialization, design sub-phases (A-D), convention check, intent exploration
- `planning.md` — Spec writing, critic review, implementation dispatch, worktree management
- `qa.md` — Product-type-aware QA, journey walkthrough, adversarial verification, fix loop
- `validation.md` — 12-step validation pipeline
- `bootstrap.md` — Project bootstrap (INTENT.md, conventions)
- `prd.md` — Initiative mode (PRD decomposition, wave execution)

## Contract Files

Located in `references/contracts/`:
- `policy.json` — Quality profiles, limits, agent lists
- `gates.md` — Gate catalog
- `artifact-contract.md` — Required artifacts by profile
- `manifest-schema.json` — Manifest JSON schema
- `handoff-contract.md` — Agent-to-agent transitions
- `hardening-checks.md` — Hardening check registry
- `portability.md` — Cross-runtime portability spec
- `skill-evolution.md` — Skill evolution system spec
