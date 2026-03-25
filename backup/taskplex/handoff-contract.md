# TaskPlex Handoff Contract

Standardized format for agent-to-agent transitions. Every handoff produces a structured record in `manifest.workerHandoffs[]` and a corresponding file in `.claude-task/{taskId}/workers/`.

## Worker Status File Schema

Each worker writes its status to `.claude-task/{taskId}/workers/{workerId}.json`:

```json
{
  "workerId": "worker-auth-01",
  "section": "Section 3: Authentication",
  "status": "completed | blocked | failed",
  "assignedAt": "ISO timestamp",
  "completedAt": "ISO timestamp",

  "handoff": {
    "direction": "worker→orchestrator",
    "fromAgent": "implementation-agent",
    "toAgent": "orchestrator",

    "context": {
      "currentState": "Implemented JWT auth with refresh tokens. Login/logout/refresh endpoints working.",
      "relevantFiles": [
        { "path": "src/auth/jwt.ts", "role": "JWT token generation and validation" },
        { "path": "src/auth/middleware.ts", "role": "Express auth middleware" },
        { "path": "src/auth/routes.ts", "role": "Auth API endpoints" }
      ],
      "dependencies": "Requires database migrations from worker-db-01 to be applied first",
      "constraints": "Session store uses in-memory Map — needs Redis for production"
    },

    "deliverable": {
      "description": "JWT authentication with login, logout, and token refresh",
      "acceptanceCriteria": [
        "POST /auth/login returns JWT + refresh token",
        "POST /auth/refresh rotates tokens",
        "Auth middleware rejects expired tokens with 401",
        "Passwords hashed with bcrypt (cost 12)"
      ],
      "evidenceRequired": "Build passes, all 4 acceptance criteria demonstrable in code"
    },

    "verdict": {
      "status": "pass",
      "evidence": [
        { "type": "file-citation", "reference": "src/auth/jwt.ts:45", "detail": "JWT signing with RS256" },
        { "type": "build-output", "reference": "typecheck PASS", "detail": "0 errors" },
        { "type": "file-citation", "reference": "src/auth/routes.ts:12-28", "detail": "All 3 endpoints implemented" }
      ],
      "issuesFound": 0,
      "summary": "All acceptance criteria met. Build clean."
    }
  },

  "filesModified": ["src/auth/jwt.ts", "src/auth/middleware.ts", "src/auth/routes.ts"],
  "deferred": []
}
```

## Handoff Types

### 1. Orchestrator → Worker (assignment)

Written by the orchestrator when spawning a worker:

```json
{
  "direction": "orchestrator→worker",
  "fromAgent": "orchestrator",
  "toAgent": "implementation-agent:worker-auth-01",
  "context": {
    "currentState": "Planning complete, spec approved",
    "relevantFiles": [{ "path": "spec.md#section-3", "role": "Implementation spec" }],
    "dependencies": "None — this section is independent",
    "constraints": "Max 25 turns. Follow CONVENTIONS.md."
  },
  "deliverable": {
    "description": "Implement Section 3: Authentication",
    "acceptanceCriteria": ["AC-3.1: JWT login", "AC-3.2: Token refresh", "AC-3.3: Auth middleware"],
    "evidenceRequired": "Build passes, acceptance criteria met"
  }
}
```

### 2. Worker → Orchestrator (completion or escalation)

Written by the worker on completion — includes verdict with evidence.

### 3. Worker → Reviewer (handoff to review)

Written by the orchestrator when routing worker output to a reviewer:

```json
{
  "direction": "worker→reviewer",
  "fromAgent": "implementation-agent:worker-auth-01",
  "toAgent": "reviewer:security",
  "context": {
    "currentState": "Implementation complete, build passing",
    "relevantFiles": [
      { "path": "src/auth/jwt.ts", "role": "Primary review target — JWT implementation" },
      { "path": "src/auth/middleware.ts", "role": "Auth middleware — check for bypass vectors" }
    ]
  },
  "deliverable": {
    "description": "Security review of authentication implementation",
    "acceptanceCriteria": [
      "No injection vulnerabilities",
      "No credential exposure",
      "No auth bypass vectors",
      "Proper token validation"
    ],
    "evidenceRequired": "File:line citations for each check. PASS requires positive evidence."
  }
}
```

### 4. Reviewer → Orchestrator (review verdict)

Written by reviewer — includes structured evidence:

```json
{
  "direction": "reviewer→orchestrator",
  "fromAgent": "reviewer:security",
  "toAgent": "orchestrator",
  "verdict": {
    "status": "fail",
    "evidence": [
      { "type": "file-citation", "reference": "src/auth/jwt.ts:23", "detail": "JWT secret from env without fallback — fails silently if missing" },
      { "type": "grep-match", "reference": "src/auth/routes.ts:45", "detail": "Raw user input in SQL query — injection risk" }
    ],
    "issuesFound": 2,
    "summary": "2 security issues: missing env validation and SQL injection vector"
  }
}
```

## Escalation Handoff

When iteration limits are hit, the escalation report replaces the normal verdict:

```json
{
  "direction": "worker→orchestrator",
  "verdict": {
    "status": "escalated",
    "evidence": [],
    "issuesFound": -1,
    "summary": "Build-fix limit reached after 3 attempts"
  }
}
```

The detailed escalation report is in `manifest.escalations[]` and in `escalation-{workerId}.json`.

## Integration Points

- **Heartbeat hook**: Tracks `manifest.workerHandoffs[]` length for progress reporting
- **Compliance agent**: Audits handoff records for completeness and evidence density
- **Runtime**: `task.handoff` command returns structured handoff data for compaction recovery
- **Dashboard**: Visualizes handoff chain as a timeline
