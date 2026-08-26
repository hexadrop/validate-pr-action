interface Config {
	approvedLabel: string;
	changesetPath: string;
	changesetReadme: string;
	changesetRequiredFor: string[];
	linkedIssueKeywords: string[];
	renovateUserId: number;
	skipValidationLabels: string[];
	typeLabels: string[];
}

interface PullRequest {
	body: null | string;
	labels: { name: string }[];
	number: number;
	user?: { id: number; login?: string; type: string };
}

interface PullRequestFile {
	filename: string;
	status: string;
}

interface Issue {
	labels: { name: string }[];
	number: number;
}

interface ValidationResult {
	messages: string[];
	success: boolean;
}

export type { Config, Issue, PullRequest, PullRequestFile, ValidationResult };
