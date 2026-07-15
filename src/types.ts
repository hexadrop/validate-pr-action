export interface Config {
  approvedLabel: string;
  typeLabels: string[];
  changesetRequiredFor: string[];
  releaseLabel: string;
  renovateUserId: number;
  linkedIssueKeywords: string[];
  changesetPath: string;
  changesetReadme: string;
}

export interface PullRequest {
  number: number;
  body: string | null;
  labels: { name: string }[];
  user: { id: number; type: string; login?: string } | null;
}

export interface PullRequestFile {
  filename: string;
  status: string;
}

export interface Issue {
  number: number;
  labels: { name: string }[];
}

export interface ValidationResult {
  success: boolean;
  messages: string[];
}
