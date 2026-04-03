# /tp -- TaskPlex (alias)

Alias for `/taskplex`. Supports all the same flags:

```
/tp                              # asks what to work on + route choice
/tp [description]                # asks route choice, then begins
/tp --light [description]        # minimal design, single agent, self-review
/tp [description]                # full design, multi-agent + critic (default)
/tp --blueprint [description]    # architect + critics + multi-agent + waves
```

Legacy flags: `--standard`, `--team` map to default route. `--prd` maps to blueprint. `--skip-design` removed (use --light or ask directly).

---

## MANDATORY EXECUTION PROTOCOL

**STOP. Do NOT proceed without following these steps.**

**Your IMMEDIATE next action MUST be to read the initialization phase file:**

```
Read: ~/.claude/taskplex/phases/init.md
```

**Read it IN FULL. Then follow every step in order.**

The taskplex hooks are globally active and WILL enforce the workflow:
- `tp-design-gate` blocks Edit/Write before design sub-phases are reached
- `tp-heartbeat` tracks all file modifications in the manifest
- `tp-pre-commit` blocks git commits without validation
- `tp-session-start` detects active tasks on resume
- `tp-pre-compact` saves state before compaction

**Do NOT write any source code until you have:**
1. Created the task manifest (Step 1 in init.md)
2. Created the session file (Step 2 in init.md)
3. Completed the design interaction with the user (Sub-phases A + B in init.md)
4. Written and gotten approval on brief.md (Step 7 in init.md)

**Phase files to read in sequence:**
1. `~/.claude/taskplex/phases/init.md` — ALWAYS read first
2. `~/.claude/taskplex/phases/planning.md` — after init completes
3. `~/.claude/taskplex/phases/validation.md` — after implementation completes

If `INTENT.md` does not exist in the project root, also read:
- `~/.claude/taskplex/phases/bootstrap.md` — one-time project setup

**NOW: Read `~/.claude/taskplex/phases/init.md` and begin Step 0.**
