# Runtime Research — April 2026 Updates

Saved from research session. See multi-runtime-plan.md for the implementation plan.

## Key Changes Since March 2026

### Cursor 3.0 (April 2)
- Agent-first redesign — editor is now a surface for directing agents
- `/worktree` command — native isolated git worktrees
- `/best-of-n` — parallel model execution
- `Await` tool — monitor background commands
- **Marketplace Plugins** — 30+ plugins, bundles skills+MCP+subagents+rules+hooks
- **Automations** — event-driven cloud agents (Slack, Linear, GitHub triggers)
- Subagents are first-class: async, nested, tool-isolated, custom models

### Codex CLI v0.117-0.118 (March 26-31)
- **Plugins first-class** — marketplace, TUI browsing, install/uninstall
- **Multi-Agent v2** — path-based addresses, structured messaging
- **UserPromptSubmit hook** — block or augment prompts
- MCP startup more robust

### OpenCode v1.3.x (Late March)
- **Plugin SDK stabilized** — 25+ hook events, custom tools, in-process state
- TUI plugins support
- Async hook handling fixed
- MCP server resilience improved

### Gemini CLI v0.36.0
- **Extension package format** — bundles commands+hooks+skills+agents+policies+themes
- Multi-registry subagent discovery
- BeforeTool hook with `ask` decision
- Write-protected governance files
- Git worktree + sandbox support

### Windsurf
- **12 hook events** — most granular file-level hooks
- `post_cascade_response_with_transcript` — full audit trail
- SKILL.md loading from `.windsurf/skills/`
- No plugin packaging system

## Distribution Strategy by Runtime

| Runtime | Package Format | Best Approach |
|---------|---------------|---------------|
| Claude Code | Skills + hooks + commands | Already built |
| Cursor | Marketplace plugin | Bundle skills+MCP+subagents+hooks |
| Codex | Plugin + marketplace | Bundle skills+hooks+MCP |
| OpenCode | TypeScript plugin (npm) | Full stateful plugin via SDK |
| Gemini CLI | Extension package | Most architecturally aligned |
| Windsurf | Manual files + hooks.json | No packaging — install script |
