import type { GitHub } from '@actions/github/lib/utils';

import type { Issue, PullRequest, PullRequestFile } from './types';

type Octokit = InstanceType<typeof GitHub>;

function normalizeLabel(label: string | { name?: string }): { name: string } {
	return { name: typeof label === 'string' ? label : (label.name ?? '') };
}

async function getPullRequest(octokit: Octokit, owner: string, repo: string, pullNumber: number): Promise<PullRequest> {
	const { data } = await octokit.rest.pulls.get({
		owner,
		pull_number: pullNumber,
		repo,
	});

	return {
		body: data.body,
		labels: data.labels.map(label => normalizeLabel(label)),
		number: data.number,
		user: {
			id: data.user.id,
			login: data.user.login,
			type: data.user.type,
		},
	};
}

async function listPullRequestFiles(
	octokit: Octokit,
	owner: string,
	repo: string,
	pullNumber: number
): Promise<PullRequestFile[]> {
	const { data } = await octokit.rest.pulls.listFiles({
		owner,
		per_page: 100,
		pull_number: pullNumber,
		repo,
	});

	return data.map(file => ({
		filename: file.filename,
		status: file.status,
	}));
}

async function getIssue(octokit: Octokit, owner: string, repo: string, issueNumber: number): Promise<Issue> {
	const { data } = await octokit.rest.issues.get({
		issue_number: issueNumber,
		owner,
		repo,
	});

	return {
		labels: data.labels.map(label => normalizeLabel(label)),
		number: data.number,
	};
}

export { getIssue, getPullRequest, listPullRequestFiles };
