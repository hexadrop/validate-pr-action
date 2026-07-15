import type { GitHub } from '@actions/github/lib/utils';
import type { Issue, PullRequest, PullRequestFile } from './types';

type Octokit = InstanceType<typeof GitHub>;

export async function getPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PullRequest> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return {
    number: data.number,
    body: data.body,
    labels: data.labels.map(label =>
      typeof label === 'string' ? { name: label } : { name: label.name ?? '' }
    ),
    user: data.user
      ? {
          id: data.user.id,
          type: data.user.type,
          login: data.user.login,
        }
      : null,
  };
}

export async function listPullRequestFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PullRequestFile[]> {
  const { data } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  return data.map(file => ({
    filename: file.filename,
    status: file.status,
  }));
}

export async function getIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<Issue> {
  const { data } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return {
    number: data.number,
    labels: data.labels.map(label =>
      typeof label === 'string' ? { name: label } : { name: label.name ?? '' }
    ),
  };
}
