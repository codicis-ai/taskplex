# TaskPlex Hardening Check Catalog
<!-- Canonical reference for all hardening checks. Hardening.md references this for the check library. -->

## Check Registry

### Security Checks

| ID | Check | Tool Required | Fallback | Red-Line |
|----|-------|---------------|----------|----------|
| 3a | Dependency vulnerability scan | `npm audit` / `pip-audit` / `cargo audit` | None (skip) | critical > 0 → blocks standard + enterprise |
| 3b | Secrets scan | `gitleaks` | Grep for common patterns (API keys, AWS keys, tokens) | Any secret → blocks standard + enterprise |
| 3c | SAST verification | None (reads security review) | Verify `reviews/security.md` exists with PASS/WARN | — |

### Reliability Checks

| ID | Check | Tool Required | Fallback | Red-Line |
|----|-------|---------------|----------|----------|
| 3d | Type safety audit | None (reads tsconfig/mypy config) | Grep for `any`, `@ts-ignore`, `# type: ignore` | — |
| 3e | Error handling coverage | None (Grep-based) | Count unhandled promises, empty catches, missing error boundaries | — |
| 3f | Test coverage | `vitest --coverage` / `pytest --cov` | Count test files vs source files for ratio | — |
| 3g | Build reproducibility | None (reads validation results) | Verify `validation.typecheck === "passed"` and `validation.lint === "passed"` | — |

### Supply Chain Checks

| ID | Check | Tool Required | Fallback | Red-Line |
|----|-------|---------------|----------|----------|
| 3h | License compliance | `license-checker` | Parse lockfile for GPL/AGPL | — |
| 3i | Env validation | None (Grep-based) | Check for `.env.example`, validation schema, unvalidated `process.env` usage | — |

### Operability Checks

| ID | Check | Tool Required | Fallback | Red-Line |
|----|-------|---------------|----------|----------|
| 3j | Observability baseline | Playwright (optional) | Grep for logging config, metrics setup, `/health` endpoint | enterprise: missing → blocks |

---

## Required Checks by Risk Profile

| Check | internal-low | internal-standard | internet-facing | regulated |
|-------|:---:|:---:|:---:|:---:|
| 3a dependency-scan | Yes | Yes | Yes | Yes |
| 3b secrets-scan | Yes | Yes | Yes | Yes |
| 3i env-validation | Yes | Yes | Yes | Yes |
| 3j observability-baseline | Yes | Yes | Yes | Yes |
| 3c sast-verify | — | Yes | Yes | Yes |
| 3d type-safety | — | Yes | Yes | Yes |
| 3e error-handling | — | Yes | Yes | Yes |
| 3f test-coverage | — | Yes | Yes | Yes |
| 3h license-compliance | — | Yes | Yes | Yes |
| 3g build-reproducibility | — | Yes | Yes | Yes |
| rate-limit-review | — | — | Yes | Yes |
| auth-flow-review | — | — | Yes | Yes |
| cors-csp-check | — | — | Yes | Yes |
| pii-path-review | — | — | — | Yes |
| audit-log-review | — | — | — | Yes |
| backup-restore-drill | — | — | — | Yes |

---

## Default Risk Profile by Quality Profile

| Quality Profile | Default Risk Profile |
|----------------|---------------------|
| lean | internal-low |
| standard | internal-standard |
| enterprise | internet-facing |

Override via `conventions.json` → `hardening.riskProfile`.

---

## Red-Line Rules

Non-negotiable blockers regardless of score:

| Red Line | Blocks | Source Check |
|----------|--------|-------------|
| Critical vulnerabilities | standard + enterprise | 3a |
| Secrets detected | standard + enterprise | 3b |
| Rollback untested | enterprise only | Level 2 checklist |
| Ops baseline missing | enterprise only | 3j |
| Required evidence missing | enterprise only | Any required check not run |

Profile behavior on red-line violation:
- **lean**: Log warning, continue
- **standard**: Log warning, flag to user, continue (non-blocking)
- **enterprise**: BLOCK. User must fix or accept risk (logged to degradations.json)

---

## Readiness Scorecard

| Category | Weight | Scoring |
|----------|--------|---------|
| Security | 30 | 30 if no vulns + no secrets + SAST pass. -10 per high vuln, -30 per critical |
| Reliability | 25 | 25 if strict types + error handling clean + build reproducible. -5 per issue |
| Test Quality | 20 | 20 if coverage >= 80%. Linear scale: 60%=15, 40%=10, 20%=5, 0%=0 |
| Operability | 15 | 15 if logging + metrics + health endpoint. -5 per missing |
| Recovery/Governance | 10 | 10 if env validation + license clean. -5 per issue |

**Pass thresholds:** lean: 70, standard: 80, enterprise: 90

Red-line override: even with passing score, any red-line violation forces FAIL (enterprise) or WARN (standard).

---

## Level 2: Infrastructure Verification Checks (--infra flag)

Checks that verify and optionally provision cloud infrastructure. Each check detects → verifies → reports/provisions.

### Azure Checks

| ID | Check | CLI Required | What it does | Provisionable |
|----|-------|-------------|--------------|:---:|
| I-AZ-1 | Azure login | `az` | `az account show` — verify logged in | No (prompt user) |
| I-AZ-2 | Resource group | `az` | `az group show --name {rg}` | Yes |
| I-AZ-3 | Storage account | `az` | `az storage account show --name {sa}` | Yes |
| I-AZ-4 | Table Storage tables | `az` | `az storage table list` — check required tables exist | Yes |
| I-AZ-5 | Function App | `az` | `az functionapp show --name {fa}` | Yes |
| I-AZ-6 | Env vars set | `az` | `az functionapp config appsettings list` — compare against required | Prompt for values |
| I-AZ-7 | API deployed | `func` | `func azure functionapp list-functions` | Yes (build + deploy) |

### GitHub Checks

| ID | Check | CLI Required | What it does | Provisionable |
|----|-------|-------------|--------------|:---:|
| I-GH-1 | GitHub login | `gh` | `gh auth status` | No (prompt user) |
| I-GH-2 | Repo exists | `gh` | `gh repo view {org/repo}` | Yes |
| I-GH-3 | Repo secrets | `gh` | `gh secret list` — compare against required | Prompt for values |
| I-GH-4 | CI status | `gh` | `gh run list --limit 1` — show last run status | No (informational) |
| I-GH-5 | Release exists | `gh` | `gh release list --limit 1` — show latest version | No (informational) |

### Domain / DNS Checks

| ID | Check | CLI Required | What it does | Provisionable |
|----|-------|-------------|--------------|:---:|
| I-DNS-1 | DNS resolves | `dig`/`nslookup` | Check domain A/CNAME records | No |
| I-DNS-2 | SSL valid | `curl` | `curl -sI https://{domain}` — check for valid certificate | No |

## Level 3: Service Integration Checks (--infra or --services flag)

Checks that verify external SaaS service configuration via their APIs.

### LemonSqueezy Checks

| ID | Check | Auth Required | What it does | Provisionable |
|----|-------|-------------|--------------|:---:|
| S-LS-1 | API key valid | LS API key | `GET /v1/stores` — verify auth | No (prompt for key) |
| S-LS-2 | Store exists | LS API key | Check store name matches config | No (web UI only) |
| S-LS-3 | Products exist | LS API key | `GET /v1/products` — verify products match config | No (web UI only) |
| S-LS-4 | Webhook registered | LS API key | `GET /v1/webhooks` — check URL + events | Yes (`POST /v1/webhooks`) |
| S-LS-5 | Webhook secret set | LS API key + `az` | Verify `LEMONSQUEEZY_WEBHOOK_SECRET` in Azure | Prompt for value |

### Clerk Checks (future)

| ID | Check | Auth Required | What it does | Provisionable |
|----|-------|-------------|--------------|:---:|
| S-CK-1 | API key valid | Clerk secret key | `GET /v1/instance` | No (prompt) |
| S-CK-2 | JWT templates | Clerk secret key | Verify JWT template configured | No (web UI) |
| S-CK-3 | Webhooks | Clerk secret key | Check webhook endpoints registered | Yes (API) |
| S-CK-4 | Env vars | `az`/local | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Prompt |

### Supabase Checks (future)

| ID | Check | Auth Required | What it does | Provisionable |
|----|-------|-------------|--------------|:---:|
| S-SB-1 | Project exists | Supabase MCP | `mcp__supabase__get_project` | No |
| S-SB-2 | Tables exist | Supabase MCP | `mcp__supabase__list_tables` | No (run migrations) |
| S-SB-3 | Migrations applied | Supabase MCP | `mcp__supabase__list_migrations` | Yes (apply pending) |
| S-SB-4 | RLS policies | Supabase MCP | `mcp__supabase__execute_sql` — check RLS enabled | No (informational) |

### Composio Checks (future)

| ID | Check | Auth Required | What it does | Provisionable |
|----|-------|-------------|--------------|:---:|
| S-CO-1 | API key valid | Composio key | Verify connection | No (prompt) |
| S-CO-2 | Integrations | Composio key | Check required integrations connected | No (web UI) |
| S-CO-3 | Tools registered | Composio key | Verify tool registrations active | No (informational) |

## Level 4: Human Checklist Items

Items that cannot be automated (require human judgment or infrastructure access):

| Check | Status Type | How to Verify | Required (enterprise) |
|-------|------------|---------------|----------------------|
| Monitoring dashboards live | needs-infra | Navigate to monitoring UI, verify data | Yes |
| Alerts configured | needs-infra | Trigger test alert, verify notification | Yes |
| Rollback procedure tested | needs-infra | Execute rollback in staging | Yes |
| Load test run | needs-infra | Run load test, verify response times | No |
| Rate limiting verified | needs-infra | Send N+1 requests, verify 429 | No |
| Auth flow end-to-end | needs-review | Test login, refresh, logout, unauth | No |
| Runbook exists | needs-review | Check docs/runbook.md | No |
| On-call ownership assigned | needs-review | Confirm team owns alerts | No |
| Backup/restore tested | needs-infra | Run backup, restore, verify integrity | No |
| Gradual rollout plan | needs-review | Feature flag or canary configured | No |
| Real-world data test | needs-review | Run against production-like data, verify quality | No |
| Payment flow tested | needs-review | Complete test purchase, verify license delivery | No |

If Playwright/cloud MCPs are available, some checklist items can be promoted to automated checks.

---

## Hardening Output Artifacts

Written to `.claude-task/{taskId}/hardening/`:

| File | Format | Content |
|------|--------|---------|
| `report.md` | Markdown | Human-readable: Level 1 results table, Level 2 checklist, red-line status, scorecard |
| `gate-decision.json` | JSON | Machine-readable: status, profile, checks, redLines, scorecard, timestamp |
| `dependency-report.json` | JSON | Full audit output from dependency scan |
| `secrets-report.json` | JSON | Findings from secrets scan (or empty) |
| `coverage-report.json` | JSON | Test coverage data |
| `license-report.json` | JSON | License list and denylist matches |
