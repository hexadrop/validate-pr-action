import { describe, expect, it, vi } from 'vitest';
import { findChangesetFiles, parseLinkedIssues, validate, validateTypeLabel } from '../validate';
import type { Issue, PullRequest } from '../types';

interface MockOverrides {
  pr?: Partial<PullRequest>;
  files?: { filename: string; status: string }[];
  issues?: Record<number, Partial<Issue>>;
}

function makeOctokit(overrides: MockOverrides = {}) {
  return {
    rest: {
      pulls: {
        get: vi.fn().mockResolvedValue({
          data: {
            number: 1,
            body: '',
            labels: [],
            user: { id: 123, type: 'User' },
            ...overrides.pr,
          },
        }),
        listFiles: vi.fn().mockResolvedValue({ data: overrides.files ?? [] }),
      },
      issues: {
        get: vi.fn().mockImplementation(({ issue_number }: { issue_number: number }) => {
          const issue = overrides.issues?.[issue_number];
          if (!issue) {
            throw new Error('Not found');
          }
          return {
            data: {
              number: issue_number,
              labels: [],
              ...issue,
            },
          };
        }),
      },
    },
  } as unknown as Parameters<typeof validate>[0];
}

const baseConfig = {
  approvedLabel: 'status:approved',
  typeLabels: [
    'type:bug',
    'type:feature',
    'type:refactor',
    'type:docs',
    'type:chore',
    'type:breaking-change',
  ],
  changesetRequiredFor: ['type:bug', 'type:feature', 'type:refactor'],
  releaseLabel: 'release',
  renovateUserId: 29139614,
  linkedIssueKeywords: ['closes', 'fixes', 'resolves'],
  changesetPath: '.changeset',
  changesetReadme: '.changeset/README.md',
};

describe('parseLinkedIssues', () => {
  it('finds multiple issue references', () => {
    const body = 'Closes #1 and fixes #2';
    expect(parseLinkedIssues(body, ['closes', 'fixes', 'resolves'])).toEqual([1, 2]);
  });

  it('returns empty when there are no references', () => {
    expect(parseLinkedIssues('No references here', ['closes'])).toEqual([]);
  });

  it('is case insensitive', () => {
    expect(parseLinkedIssues('FIXES #42', ['fixes'])).toEqual([42]);
  });

  it('ignores duplicate references', () => {
    const body = 'Closes #1, closes #1';
    expect(parseLinkedIssues(body, ['closes'])).toEqual([1, 1]);
  });
});

describe('validateTypeLabel', () => {
  it('accepts a single valid type label', () => {
    const result = validateTypeLabel(['type:bug'], baseConfig.typeLabels);
    expect(result).toEqual({ valid: true, typeLabel: 'type:bug' });
  });

  it('rejects missing type label', () => {
    const result = validateTypeLabel([], baseConfig.typeLabels);
    expect(result.valid).toBe(false);
  });

  it('rejects multiple type labels', () => {
    const result = validateTypeLabel(
      ['type:bug', 'type:feature'],
      baseConfig.typeLabels
    );
    expect(result.valid).toBe(false);
  });

  it('rejects invalid type label', () => {
    const result = validateTypeLabel(['type:unknown'], baseConfig.typeLabels);
    expect(result.valid).toBe(false);
  });
});

describe('findChangesetFiles', () => {
  it('returns changeset files excluding readme and removed files', () => {
    const files = [
      { filename: '.changeset/silent-cats-fly.md', status: 'added' },
      { filename: '.changeset/README.md', status: 'added' },
      { filename: '.changeset/old.md', status: 'removed' },
      { filename: 'src/index.ts', status: 'modified' },
    ];
    expect(findChangesetFiles(files, '.changeset', '.changeset/README.md')).toEqual([
      '.changeset/silent-cats-fly.md',
    ]);
  });
});

describe('validate', () => {
  it('passes for a valid PR', async () => {
    const octokit = makeOctokit({
      pr: {
        body: 'Closes #10',
        labels: [{ name: 'type:feature' }],
      },
      issues: {
        10: { labels: [{ name: 'status:approved' }] },
      },
      files: [{ filename: '.changeset/silent-cats-fly.md', status: 'added' }],
    });

    const result = await validate(octokit, 'owner', 'repo', 1, baseConfig);

    expect(result.success).toBe(true);
  });

  it('skips Renovate PRs', async () => {
    const octokit = makeOctokit({
      pr: {
        user: { id: 29139614, type: 'Bot' },
      },
    });

    const result = await validate(octokit, 'owner', 'repo', 1, baseConfig);

    expect(result.success).toBe(true);
    expect(result.messages[0]).toContain('Renovate');
  });

  it('validates release PRs have no changesets', async () => {
    const octokit = makeOctokit({
      pr: {
        labels: [{ name: 'release' }],
      },
      files: [{ filename: '.changeset/silent-cats-fly.md', status: 'added' }],
    });

    const result = await validate(octokit, 'owner', 'repo', 1, baseConfig);

    expect(result.success).toBe(false);
    expect(result.messages[0]).toContain('Release PR must not include changeset files');
  });

  it('fails when there is no linked issue', async () => {
    const octokit = makeOctokit({
      pr: {
        labels: [{ name: 'type:bug' }],
      },
    });

    const result = await validate(octokit, 'owner', 'repo', 1, baseConfig);

    expect(result.success).toBe(false);
    expect(result.messages[0]).toContain('must be linked to an approved issue');
  });

  it('fails when the linked issue is not approved', async () => {
    const octokit = makeOctokit({
      pr: {
        body: 'Fixes #5',
        labels: [{ name: 'type:bug' }],
      },
      issues: {
        5: { labels: [] },
      },
      files: [{ filename: '.changeset/silent-cats-fly.md', status: 'added' }],
    });

    const result = await validate(octokit, 'owner', 'repo', 1, baseConfig);

    expect(result.success).toBe(false);
    expect(result.messages[0]).toContain('does not have the "status:approved" label');
  });

  it('fails when a required changeset is missing', async () => {
    const octokit = makeOctokit({
      pr: {
        body: 'Fixes #5',
        labels: [{ name: 'type:bug' }],
      },
      issues: {
        5: { labels: [{ name: 'status:approved' }] },
      },
      files: [],
    });

    const result = await validate(octokit, 'owner', 'repo', 1, baseConfig);

    expect(result.success).toBe(false);
    expect(result.messages[0]).toContain('must include a changeset');
  });

  it('does not require a changeset for docs', async () => {
    const octokit = makeOctokit({
      pr: {
        body: 'Fixes #5',
        labels: [{ name: 'type:docs' }],
      },
      issues: {
        5: { labels: [{ name: 'status:approved' }] },
      },
      files: [],
    });

    const result = await validate(octokit, 'owner', 'repo', 1, baseConfig);

    expect(result.success).toBe(true);
  });
});
