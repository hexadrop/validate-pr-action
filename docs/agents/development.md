# Development

Use this guide when changing the action's behavior, inputs, tests, or bundled output.

## Quick path

1. Make the change in `src/` and update `test/validate.test.ts`.
2. Run linting, type-checking, and tests before opening a pull request.
3. Regenerate `dist/index.js` and commit it alongside your changes.

```bash
bun run lint
bun run typecheck
bun test
bun run build
```

## Change a validation rule

1. Update `src/validate.ts` (or `src/github.ts` when new GitHub data is needed).
2. Extend `test/validate.test.ts` with cases covering the new behavior.
3. Document new inputs in `action.yml` and `README.md` when the change affects the public contract.
4. Run `bun run build` and commit `dist/index.js`.

## Add an input

1. Declare the input in `action.yml` with a description and default.
2. Parse it in `src/main.ts` and add it to `Config` in `src/types.ts`.
3. Use it inside `src/validate.ts` and cover it with tests.
4. Update the inputs table in `README.md`.

## Run tests

```bash
bun test
```

Run a single test file:

```bash
bun test ./test/validate.test.ts
```

## Linting

The project uses `@hexadrop/eslint-config`. Common commands:

```bash
bun run lint        # check with cache
bun run lint:ci     # content-based cache for CI
bun run lint:fix    # auto-fix
```
