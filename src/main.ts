import * as core from '@actions/core';
import * as github from '@actions/github';
import { validate } from './validate';
import type { Config } from './types';

function parseList(input: string): string[] {
  return input
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function getConfig(): Config {
  return {
    approvedLabel: core.getInput('approved-label') || 'status:approved',
    typeLabels: parseList(core.getInput('type-labels')),
    changesetRequiredFor: parseList(core.getInput('changeset-required-for')),
    releaseLabel: core.getInput('release-label') || 'release',
    renovateUserId: parseInt(core.getInput('renovate-user-id') || '29139614', 10),
    linkedIssueKeywords: parseList(core.getInput('linked-issue-keywords')),
    changesetPath: core.getInput('changeset-path') || '.changeset',
    changesetReadme: core.getInput('changeset-readme') || '.changeset/README.md',
  };
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const octokit = github.getOctokit(token);
    const context = github.context;
    const pullRequest = context.payload.pull_request;

    if (!pullRequest) {
      core.setFailed('This action must be run on a pull_request event.');
      return;
    }

    const config = getConfig();
    const result = await validate(
      octokit,
      context.repo.owner,
      context.repo.repo,
      pullRequest.number as number,
      config
    );

    for (const message of result.messages) {
      core.info(message);
    }

    if (!result.success) {
      core.setFailed(result.messages.join('\n\n'));
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
