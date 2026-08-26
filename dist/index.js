import { getInput, info, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
//#region src/github.ts
function normalizeLabel(label) {
	return { name: typeof label === "string" ? label : label.name ?? "" };
}
async function getPullRequest(octokit, owner, repo, pullNumber) {
	const { data } = await octokit.rest.pulls.get({
		owner,
		pull_number: pullNumber,
		repo
	});
	return {
		body: data.body,
		labels: data.labels.map((label) => normalizeLabel(label)),
		number: data.number,
		user: {
			id: data.user.id,
			login: data.user.login,
			type: data.user.type
		}
	};
}
async function listPullRequestFiles(octokit, owner, repo, pullNumber) {
	const { data } = await octokit.rest.pulls.listFiles({
		owner,
		per_page: 100,
		pull_number: pullNumber,
		repo
	});
	return data.map((file) => ({
		filename: file.filename,
		status: file.status
	}));
}
async function getIssue(octokit, owner, repo, issueNumber) {
	const { data } = await octokit.rest.issues.get({
		issue_number: issueNumber,
		owner,
		repo
	});
	return {
		labels: data.labels.map((label) => normalizeLabel(label)),
		number: data.number
	};
}
//#endregion
//#region src/validate.ts
function parseLinkedIssues(body, keywords) {
	if (!body) return [];
	const pattern = new RegExp(String.raw`(?:${keywords.join("|")})\s+#(\d+)`, "gi");
	const issues = [];
	for (const match of body.matchAll(pattern)) {
		const issueId = match[1];
		if (issueId) issues.push(Number.parseInt(issueId, 10));
	}
	return issues;
}
function findChangesetFiles(files, changesetPath, changesetReadme) {
	const prefix = changesetPath.endsWith("/") ? changesetPath : `${changesetPath}/`;
	return files.filter((file) => file.status !== "removed" && file.filename.startsWith(prefix) && file.filename.endsWith(".md") && file.filename !== changesetReadme).map((file) => file.filename);
}
function validateTypeLabel(labels, validTypes) {
	const typeLabels = labels.filter((label) => label.startsWith("type:"));
	if (typeLabels.length === 0) return {
		message: `PR must have exactly one type:* label.\n\nValid labels:\n  ${validTypes.join(", ")}`,
		valid: false
	};
	if (typeLabels.length > 1) return {
		message: `PR has ${String(typeLabels.length)} type:* labels: ${typeLabels.join(", ")}\nA PR must have exactly ONE type:* label. Please remove the extra one(s).`,
		valid: false
	};
	const typeLabel = typeLabels[0];
	if (!typeLabel || !validTypes.includes(typeLabel)) return {
		message: `"${typeLabel ?? "unknown"}" is not a valid type:* label.\n\nValid labels:\n  ${validTypes.join(", ")}`,
		valid: false
	};
	return {
		typeLabel,
		valid: true
	};
}
async function validate(octokit, owner, repo, pullNumber, config) {
	const messages = [];
	const pr = await getPullRequest(octokit, owner, repo, pullNumber);
	const prLabels = pr.labels.map((label) => label.name);
	if (pr.user?.id === config.renovateUserId && pr.user.type === "Bot") return {
		messages: ["Renovate PR: validation skipped."],
		success: true
	};
	const skipValidationLabel = prLabels.find((label) => config.skipValidationLabels.includes(label));
	if (skipValidationLabel) {
		const changesetFiles = findChangesetFiles(await listPullRequestFiles(octokit, owner, repo, pullNumber), config.changesetPath, config.changesetReadme);
		if (changesetFiles.length > 0) return {
			messages: [`Exempt PR must not include changeset files.\nFound: ${changesetFiles.join(", ")}`],
			success: false
		};
		return {
			messages: [`Validation skipped by exempt label "${skipValidationLabel}".`],
			success: true
		};
	}
	const linkedIssues = parseLinkedIssues(pr.body, config.linkedIssueKeywords);
	if (linkedIssues.length === 0) messages.push(`Every PR must be linked to an approved issue.\nPR body must reference a linked issue using one of:\n${config.linkedIssueKeywords.map((keyword) => `  - ${keyword} #<number>`).join("\n")}`);
	else {
		const issueResults = await Promise.all(linkedIssues.map(async (issueNumber) => {
			try {
				return {
					issue: await getIssue(octokit, owner, repo, issueNumber),
					issueNumber
				};
			} catch (error) {
				return {
					error: error.message,
					issueNumber
				};
			}
		}));
		for (const result of issueResults) {
			if ("error" in result) {
				messages.push(`Could not fetch issue #${String(result.issueNumber)}: ${result.error}`);
				continue;
			}
			if (!result.issue.labels.map((label) => label.name).includes(config.approvedLabel)) messages.push(`Issue #${String(result.issueNumber)} does not have the "${config.approvedLabel}" label.\nIssues must be approved by a maintainer before work begins.
Please comment on the issue and wait for it to be labelled ${config.approvedLabel}.`);
		}
	}
	const typeResult = validateTypeLabel(prLabels, config.typeLabels);
	if (!typeResult.valid) messages.push(typeResult.message);
	else if (config.changesetRequiredFor.includes(typeResult.typeLabel)) {
		if (findChangesetFiles(await listPullRequestFiles(octokit, owner, repo, pullNumber), config.changesetPath, config.changesetReadme).length === 0) messages.push(`PR labelled ${typeResult.typeLabel} must include a changeset.\nThis PR changes user-facing behaviour and must include a changeset.
Run \`bun changeset\` to create one, or add a .md file under .changeset/.`);
	}
	if (messages.length > 0) return {
		messages,
		success: false
	};
	return {
		messages: [`PR #${String(pullNumber)} passed all validations.`],
		success: true
	};
}
//#endregion
//#region src/main.ts
function parseList(input) {
	return input.split(",").map((item) => item.trim()).filter(Boolean);
}
function getConfig() {
	return {
		approvedLabel: getInput("approved-label") || "status:approved",
		changesetPath: getInput("changeset-path") || ".changeset",
		changesetReadme: getInput("changeset-readme") || ".changeset/README.md",
		changesetRequiredFor: parseList(getInput("changeset-required-for")),
		linkedIssueKeywords: parseList(getInput("linked-issue-keywords")),
		renovateUserId: Number.parseInt(getInput("renovate-user-id") || "29139614", 10),
		skipValidationLabels: parseList(getInput("skip-validation-labels") || "release"),
		typeLabels: parseList(getInput("type-labels"))
	};
}
async function run() {
	try {
		const token = getInput("github-token", { required: true });
		const octokit = getOctokit(token);
		const context$1 = context;
		const pullRequest = context$1.payload.pull_request;
		if (!pullRequest) {
			setFailed("This action must be run on a pull_request event.");
			return;
		}
		const config = getConfig();
		const result = await validate(octokit, context$1.repo.owner, context$1.repo.repo, pullRequest.number, config);
		for (const message of result.messages) info(message);
		if (!result.success) setFailed(result.messages.join("\n\n"));
	} catch (error) {
		setFailed(error.message);
	}
}
await run();
//#endregion
export {};
