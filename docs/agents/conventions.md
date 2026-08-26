# Conventions

Follow these conventions so modules, tests, and the bundled `dist/index.js` remain predictable.

## Module layout

Source lives in `src/` and tests in `test/`.

| File                    | Purpose                                                                   |
|-------------------------|---------------------------------------------------------------------------|
| `src/main.ts`           | Action entry point; parses inputs and calls the validator.                |
| `src/validate.ts`       | Pure validation pipeline; no I/O besides the Octokit client.              |
| `src/github.ts`         | Octokit accessors (`getPullRequest`, `getIssue`, `listPullRequestFiles`). |
| `src/types.ts`          | Shared interfaces for config, pull request, issue, and results.           |
| `test/validate.test.ts` | Bun tests for the validation rules.                                       |

Keep `src/main.ts` thin: input parsing and error handling belong there, while rule logic stays in `src/validate.ts`.

## Language and tooling

- **Runtime:** Bun (`bun`, `bun test`, `bun build`)
- **Language:** TypeScript with ESM modules (`"type": "module"`)
- **Linting:** `@hexadrop/eslint-config` via the flat `eslint.config.js`
- **Formatting:** tabs and single quotes enforced by the shared config

## Imports

Use explicit `type` imports for interfaces, keep imports sorted, and prefer named exports. Reserve default exports for cases where a plugin or Bun requires one.

## Build artifact

`dist/index.js` is generated from `src/main.ts` with `bun run build`. Never edit it manually; regenerate it with `bun run build` before opening a pull request.
