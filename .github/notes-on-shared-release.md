# Blocked: waiting on PR in hexadrop/github-workflows

The shared-release parameterization is implemented and pushed to
`hexadrop/github-workflows` branch `parameterize-release-workflows`, but the
org rejects PAT-driven PR creation (403/404) from this machine.

To unblock:
1. Open https://github.com/hexadrop/github-workflows/compare/main...parameterize-release-workflows?expand=1
   with the body from `/tmp/pr-body.md` (title: `feat(release): add tags publish strategy and version-command input`).
2. Merge it into `main`.
3. Run in that repo:
   - `git checkout main && git pull`
   - `git tag v1.8.0 && git push origin v1.8.0`
   - `git tag -f v1 v1.8.0 && git push -f origin v1`

Only then can this repo replace the inline `release-prepare.yml`, `release.yml`,
`release-beta.yml` with shared callers using `version-command` and
`publish-strategy: "tags"`.

Delete this file once the adoption is done.
