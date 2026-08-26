# Copilot instructions for @hexadrop/validate-pr-action

This project provides a GitHub Action that validates pull requests against issue linkage, approval labels, type labels, and changesets.

- **Package manager:** Bun (`bun`)
- **Build:** `bun run build`
- **Type-check:** `bun run typecheck`
- **Lint:** `bun run lint:fix`
- **Test:** `bun test`

## Task guides

- [Architecture](docs/agents/architecture.md) — validation pipeline, entry points, and build output.
- [Conventions](docs/agents/conventions.md) — runtime, imports, and source-code conventions.
- [Development](docs/agents/development.md) — targeted validation, linting commands.
- [Release process](docs/agents/release-process.md) — changesets, beta snapshots, stable releases, and hotfixes.
- [Pull requests](docs/agents/pull-requests.md) — approved-issue, labeling, checklist, and merge requirements.
- [Branches and commits](docs/agents/branches-and-commits.md) — GitFlow branches, naming, conventions, and hooks.
