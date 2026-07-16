import { getInput, info, setFailed } from '@actions/core';
import { context as githubContext, getOctokit } from '@actions/github';

import type { Config } from './types';
import { validate } from './validate';

function parseList(input: string): string[] {
	return input
		.split(',')
		.map(item => item.trim())
		.filter(Boolean);
}

function getConfig(): Config {
	return {
		approvedLabel: getInput('approved-label') || 'status:approved',
		changesetPath: getInput('changeset-path') || '.changeset',
		changesetReadme: getInput('changeset-readme') || '.changeset/README.md',
		changesetRequiredFor: parseList(getInput('changeset-required-for')),
		linkedIssueKeywords: parseList(getInput('linked-issue-keywords')),
		releaseLabel: getInput('release-label') || 'release',
		renovateUserId: Number.parseInt(getInput('renovate-user-id') || '29139614', 10),
		typeLabels: parseList(getInput('type-labels')),
	};
}

async function run(): Promise<void> {
	try {
		const token = getInput('github-token', { required: true });
		const octokit = getOctokit(token);
		const context = githubContext;
		const pullRequest = context.payload.pull_request;

		if (!pullRequest) {
			setFailed('This action must be run on a pull_request event.');

			return;
		}

		const config = getConfig();
		const result = await validate(octokit, context.repo.owner, context.repo.repo, pullRequest.number, config);

		for (const message of result.messages) {
			info(message);
		}

		if (!result.success) {
			setFailed(result.messages.join('\n\n'));
		}
	} catch (error) {
		setFailed((error as Error).message);
	}
}

await run();
