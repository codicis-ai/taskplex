---
name: drift
description: Read-only codebase drift scanner. Detects convention violations, architectural drift, dependency health issues, dead code, and hygiene problems. Produces a drift index score and prioritized recommendations. Use when the user asks to "scan for drift", "check codebase health", "audit conventions", "find dead code", "architectural audit", or "is the codebase healthy".
---

# /drift — Codebase Drift Scanner

**Command**: `/drift`

Scans the codebase for convention violations, architectural drift, dependency health, and hygiene issues. Read-only — reports findings but does not fix.

## Usage

```
/drift                    # Full scan
/drift --quick            # Convention + structure only (skip dependency audit)
```

## Process

1. **Spawn drift-scanner agent** (haiku, read-only):
   > Read `${CLAUDE_PLUGIN_ROOT}/agents/drift-scanner.md`
   > Spawn with project root as context
   > Returns: structured drift report with index score

2. **Write report** to `.claude-task/drift-report-{YYYY-MM-DD}.md`:
   ```markdown
   # Drift Report — {date}
   
   **Drift Index**: {score}/100
   **Status**: {clean (0-20) | attention needed (20-50) | significant drift (50+)}
   
   ## Convention Compliance
   {findings}
   
   ## Structural Integrity
   {findings}
   
   ## Import Hygiene
   {findings}
   
   ## Dependency Health
   {findings}
   
   ## Test Coverage
   {findings}
   
   ## Dead Code
   {findings}
   
   ## Recommendations
   {prioritized list of fixes}
   ```

3. **Present report inline** to the user (don't point to the file).

4. **Optionally generate tasks**: If high-severity findings exist:
   > "Found {N} high-severity issues. Want me to create TaskPlex tasks for them?
   > 1. **Yes** — create /tp tasks for each high-severity finding
   > 2. **No** — report only"

## Integration

- **Session start**: `tp-session-start.mjs` checks for drift reports. If last report is > 7 days old, shows advisory: "Consider running /drift — last scan was {N} days ago."
- **Task completion**: If `manifest.driftBaseline` exists, a lightweight re-scan compares the drift index before and after the task. If index increased, logged as a degradation.
- **/evaluate audit**: Includes drift findings if a recent report exists.
