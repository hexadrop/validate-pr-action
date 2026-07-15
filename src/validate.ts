import type { Config, Issue, PullRequestFile, ValidationResult } from './types';
import { getIssue, getPullRequest, listPullRequestFiles } from './github';
import type { GitHub } from '@actions/github/lib/utils';

type Octokit = InstanceType<typeof GitHub>;

export function parseLinkedIssues(body: string | null, keywords: string[]): number[] {
  if (!body) return [];

  const pattern = new RegExp(`(?:${keywords.join('|')})\\s+#(\\d+)`, 'gi');
  const matches = [...body.matchAll(pattern)];

  return matches.map(match => parseInt(match[1], 10));
}

export function findChangesetFiles(
  files: PullRequestFile[],
  changesetPath: string,
  changesetReadme: string
): string[] {
  const prefix = changesetPath.endsWith('/') ? changesetPath : `${changesetPath}/`;

  return files
    .filter(
      file =>
        file.status !== 'removed' &&
        file.filename.startsWith(prefix) &&
        file.filename.endsWith('.md') &&
        file.filename !== changesetReadme
    )
    .map(file => file.filename);
}

export function validateTypeLabel(
  labels: string[],
  validTypes: string[]
): { valid: true; typeLabel: string } | { valid: false; message: string } {
  const typeLabels = labels.filter(label => label.startsWith('type:'));

  if (typeLabels.length === 0) {
    return {
      valid: false,
      message:
        'PR must have exactly one type:* label.\n\n' +
        `Valid labels:\n  ${validTypes.join(', ')}`,
    };
  }

  if (typeLabels.length > 1) {
    return {
      valid: false,
      message:
        `PR has ${typeLabels.length} type:* labels: ${typeLabels.join(', ')}\n` +
        'A PR must have exactly ONE type:* label. Please remove the extra one(s).',
    };
  }

  const typeLabel = typeLabels[0];
  if (!validTypes.includes(typeLabel)) {
    return {
      valid: false,
      message:
        `"${typeLabel}" is not a valid type:* label.\n\n` +
        `Valid labels:\n  ${validTypes.join(', ')}`,
    };
  }

  return { valid: true, typeLabel };
}

export async function validate(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  config: Config
): Promise<ValidationResult> {
  const messages: string[] = [];
  const pr = await getPullRequest(octokit, owner, repo, pullNumber);
  const prLabels = pr.labels.map(label => label.name);

  if (pr.user && pr.user.id === config.renovateUserId && pr.user.type === 'Bot') {
    return { success: true, messages: ['Renovate PR: validation skipped.'] };
  }

  if (prLabels.includes(config.releaseLabel)) {
    const files = await listPullRequestFiles(octokit, owner, repo, pullNumber);
    const changesetFiles = findChangesetFiles(files, config.changesetPath, config.changesetReadme);

    if (changesetFiles.length > 0) {
      return {
        success: false,
        messages: [
          'Release PR must not include changeset files.\n' +
            `Found: ${changesetFiles.join(', ')}`,
        ],
      };
    }

    return { success: true, messages: ['Release PR: validation passed.'] };
  }

  const linkedIssues = parseLinkedIssues(pr.body, config.linkedIssueKeywords);

  if (linkedIssues.length === 0) {
    messages.push(
      'Every PR must be linked to an approved issue.\n' +
        'PR body must reference a linked issue using one of:\n' +
        config.linkedIssueKeywords.map(keyword => `  - ${keyword} #<number>`).join('\n')
    );
  } else {
    for (const issueNumber of linkedIssues) {
      let issue: Issue;
      try {
        issue = await getIssue(octokit, owner, repo, issueNumber);
      } catch (error) {
        messages.push(`Could not fetch issue #${issueNumber}: ${(error as Error).message}`);
        continue;
      }

      const labels = issue.labels.map(label => label.name);
      if (!labels.includes(config.approvedLabel)) {
        messages.push(
          `Issue #${issueNumber} does not have the "${config.approvedLabel}" label.\n` +
            'Issues must be approved by a maintainer before work begins.\n' +
            `Please comment on the issue and wait for it to be labelled ${config.approvedLabel}.`
        );
      }
    }
  }

  const typeResult = validateTypeLabel(prLabels, config.typeLabels);

  if (!typeResult.valid) {
    messages.push(typeResult.message);
  } else if (config.changesetRequiredFor.includes(typeResult.typeLabel)) {
    const files = await listPullRequestFiles(octokit, owner, repo, pullNumber);
    const changesetFiles = findChangesetFiles(files, config.changesetPath, config.changesetReadme);

    if (changesetFiles.length === 0) {
      messages.push(
        `PR labelled ${typeResult.typeLabel} must include a changeset.\n` +
          'This PR changes user-facing behaviour and must include a changeset.\n' +
          'Run `bun changeset` to create one, or add a .md file under .changeset/.'
      );
    }
  }

  if (messages.length > 0) {
    return { success: false, messages };
  }

  return { success: true, messages: [`PR #${pullNumber} passed all validations.`] };
}
