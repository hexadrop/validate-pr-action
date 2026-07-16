<h1 align="center">
  @hexadrop/validate-pr-action
</h1>

<p align="center">
  GitHub Action to validate pull requests against issue linkage, approval labels, type labels and changesets.
</p>

## Usage

```yaml
- uses: hexadrop/validate-pr-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `github-token` | `${{ github.token }}` | Token used to read PR, issue and file data. |
| `approved-label` | `status:approved` | Label that linked issues must have. |
| `type-labels` | `type:bug,type:feature,...` | Comma-separated valid `type:*` labels. |
| `changeset-required-for` | `type:bug,type:feature,type:refactor` | Types that require a changeset. |
| `release-label` | `release` | Label that skips most checks. |
| `renovate-user-id` | `29139614` | User id of the Renovate bot. |
| `linked-issue-keywords` | `closes,fixes,resolves` | Keywords accepted in the PR body. |
| `changeset-path` | `.changeset` | Directory that holds changeset files. |
| `changeset-readme` | `.changeset/README.md` | Readme file to ignore. |

## Development

```bash
bun install
bun test
bun run build
```

Remember to commit `dist/index.js`; it is the bundled file that the action executes.
