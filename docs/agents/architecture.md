# Architecture

`validate-pr-action` is a GitHub Action that validates pull requests against issue linkage, approval labels, type labels, and changesets. The same validation pipeline powers the `pr-validate.yml` workflow that protects every Hexadrop repository.

## Entry points

| Area                    | Responsibility                                                                                         |
|-------------------------|--------------------------------------------------------------------------------------------------------|
| `src/main.ts`           | Parses action inputs into a `Config` and runs the validation.                                          |
| `src/validate.ts`       | Runs the ordered validation pipeline and collects failure messages.                                    |
| `src/github.ts`         | Provides thin Octokit accessors for pull requests, issues, and files.                                  |
| `src/types.ts`          | Declares the shared `Config`, `PullRequest`, `Issue`, `PullRequestFile`, and `ValidationResult` types. |
| `test/validate.test.ts` | Bun test suite covering the validation rules.                                                          |
| `dist/index.js`         | Bundled output executed by the action runner.                                                          |

## Validation pipeline

The pipeline runs in this order:

1. **Linked issue** — the PR body must contain `Closes`, `Fixes`, or `Resolves` followed by `#N` (keywords configurable via `linked-issue-keywords`).
2. **Approved issue** — every linked issue must carry the `approved-label` (default `status:approved`).
3. **Type label** — the PR must carry exactly one of the configured `type:*` labels.
4. **Changeset requirement** — PRs whose type is listed in `changeset-required-for` (default `type:bug,type:feature,type:refactor`) must add a changeset file under `changeset-path`.
5. **Exempt labels** — PRs carrying any of `skip-validation-labels` (default `release`) skip the checks above but must not introduce changeset files.
6. **Renovate exemption** — PRs authored by the Renovate bot (default user id `29139614`) bypass issue, type, and changeset checks.

`validate()` returns a `ValidationResult`; `main.ts` fails the action when messages are present.

## Build output

`bun build src/main.ts --target=node --outfile=dist/index.js` produces the single-file bundle that `action.yml` executes (`runs.using: node24`). The `dist/index.js` artifact **must be committed** so the action can run without a build step.

## Release workflows

This repository is a GitHub Action and releases through git tags rather than npm:

| Workflow                     | Trigger                            | Responsibility                                                                                                                                                                                                                                   |
|------------------------------|------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `release-prepare.yml`        | Push to `develop`                  | Opens the draft `changeset-release/main` PR with rebuilt `dist` (reuses the shared workflow with `version-command`).                                                                                                                             |
| `release.yml`                | Push to `main` or `develop`        | Reuses the shared workflow with `publish-strategy: tags`. On `main`: rebuilds `dist`, tags `v<version>`, moves the major tag `v<major>`, creates the GitHub Release. On `develop`: tags `v<version>-beta.<timestamp>` and creates a pre-release. |
| `sync-to-develop.yml`        | PR merged into `main`              | Reuses the shared workflow to sync `main` back into `develop`.                                                                                                                                                                                   |
| `pr-renovate-changesets.yml` | Renovate PR labeled `dependencies` | Adds a changeset automatically.                                                                                                                                                                                                                  |
