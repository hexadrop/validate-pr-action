import type { GitHub } from '@actions/github/lib/utils';

import { getIssue, getPullRequest, listPullRequestFiles } from './github';
import type { Config, PullRequestFile, ValidationResult } from './types';

type Octokit = InstanceType<typeof GitHub>;

function parseLinkedIssues(body: null | string, keywords: string[]): number[] {
	if (!body) {
		return [];
	}

	const pattern = new RegExp(String.raw`(?:${keywords.join('|')})\s+#(\d+)`, 'gi');
	const issues: number[] = [];

	for (const match of body.matchAll(pattern)) {
		const issueId = match[1];
		if (issueId) {
			issues.push(Number.parseInt(issueId, 10));
		}
	}

	return issues;
}

function findChangesetFiles(files: PullRequestFile[], changesetPath: string, changesetReadme: string): string[] {
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

function validateTypeLabel(
	labels: string[],
	validTypes: string[]
): { message: string; valid: false } | { typeLabel: string; valid: true } {
	const typeLabels = labels.filter(label => label.startsWith('type:'));

	if (typeLabels.length === 0) {
		return {
			message: `PR must have exactly one type:* label.\n\nValid labels:\n  ${validTypes.join(', ')}`,
			valid: false,
		};
	}

	if (typeLabels.length > 1) {
		return {
			message:
				`PR has ${String(typeLabels.length)} type:* labels: ${typeLabels.join(', ')}\n` +
				'A PR must have exactly ONE type:* label. Please remove the extra one(s).',
			valid: false,
		};
	}

	const typeLabel = typeLabels[0];

	if (!typeLabel || !validTypes.includes(typeLabel)) {
		return {
			message: `"${typeLabel ?? 'unknown'}" is not a valid type:* label.\n\nValid labels:\n  ${validTypes.join(', ')}`,
			valid: false,
		};
	}

	return { typeLabel, valid: true };
}

async function validate(
	octokit: Octokit,
	owner: string,
	repo: string,
	pullNumber: number,
	config: Config
): Promise<ValidationResult> {
	const messages: string[] = [];
	const pr = await getPullRequest(octokit, owner, repo, pullNumber);
	const prLabels = pr.labels.map(label => label.name);

	if (pr.user?.id === config.renovateUserId && pr.user.type === 'Bot') {
		return { messages: ['Renovate PR: validation skipped.'], success: true };
	}

	if (prLabels.includes(config.releaseLabel)) {
		const files = await listPullRequestFiles(octokit, owner, repo, pullNumber);
		const changesetFiles = findChangesetFiles(files, config.changesetPath, config.changesetReadme);

		if (changesetFiles.length > 0) {
			return {
				messages: [`Release PR must not include changeset files.\nFound: ${changesetFiles.join(', ')}`],
				success: false,
			};
		}

		return { messages: ['Release PR: validation passed.'], success: true };
	}

	const linkedIssues = parseLinkedIssues(pr.body, config.linkedIssueKeywords);

	if (linkedIssues.length === 0) {
		messages.push(
			`Every PR must be linked to an approved issue.\n` +
				`PR body must reference a linked issue using one of:\n${config.linkedIssueKeywords
					.map(keyword => `  - ${keyword} #<number>`)
					.join('\n')}`
		);
	} else {
		const issueResults = await Promise.all(
			linkedIssues.map(async issueNumber => {
				try {
					const issue = await getIssue(octokit, owner, repo, issueNumber);

					return { issue, issueNumber };
				} catch (error) {
					return { error: (error as Error).message, issueNumber };
				}
			})
		);

		for (const result of issueResults) {
			if ('error' in result) {
				messages.push(`Could not fetch issue #${String(result.issueNumber)}: ${result.error}`);
				continue;
			}

			const labels = result.issue.labels.map(label => label.name);

			if (!labels.includes(config.approvedLabel)) {
				messages.push(
					`Issue #${String(result.issueNumber)} does not have the "${config.approvedLabel}" label.\n` +
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
		return { messages, success: false };
	}

	return { messages: [`PR #${String(pullNumber)} passed all validations.`], success: true };
}

export { findChangesetFiles, parseLinkedIssues, validate, validateTypeLabel };
