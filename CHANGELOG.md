# @hexadrop/validate-pr-action

## 1.0.1

### Patch Changes

- c24c2ed: Reject pull requests that link to closed issues.

## 2.1.0

### Minor Changes

- aedc0c5: support wildcard patterns in skip-validation-labels

  The `skip-validation-labels` input now accepts wildcard patterns such as `internal:*` or `docs:*` to skip validation for any matching label.
