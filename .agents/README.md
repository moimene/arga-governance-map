# Ruflo Agents

This directory contains the project-level Codex/Ruflo configuration.

`AGENTS.md` at the repository root remains the canonical project guide. Do not run `ruflo init --force` here unless you intentionally want to replace that file.

Useful commands:

```bash
bun run agents:doctor
bun run agents:validate
bun run agents:mcp:tools
bun run agents:route -- "final review of Secretaria golden path"
bun run agents:swarm:status
```

Use Ruflo for coordination, routing, memory, and MCP tools. Code changes for this repository still follow the local AGENTS.md rules: Bun package management, no MAPFRE strings in demo code, Garrigues token discipline, and focused verification with `bun run test`, `bun run lint`, and `bun run build`.
