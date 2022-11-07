import { context } from "@actions/github"
import { Octokit } from "@octokit/rest"
import filter from "lodash/filter"
import flatMap from "lodash/flatMap";
import map from "lodash/map";
import strip from "strip-ansi";

import { CovSum } from "./action";

export const getPullRequestId = (): number => {
  return context.payload.pull_request?.number ?? 0;
}

export const getBaseBranch = (): string => {
  return context.payload.pull_request?.base?.ref || '';
}

export const getCommentPayload =
  (pullId: number, markdownTemplate: string):
    Octokit.IssuesCreateCommentParams => {
    return {
      ...context.repo,
      body: markdownTemplate,
      issue_number: pullId,
    };
  }

export const deletePreviousComments = async (octokit: Octokit) => {
  const { data } = await octokit.issues.listComments({
    ...context.repo,
    per_page: 100,
    issue_number: getPullRequestId(),
  });

  return Promise.all(
    data
      .filter((c: Octokit.IssuesListCommentsResponseItem) =>
          c.user.login === "github-actions[bot]",
      )
      .map((c: Octokit.IssuesListCommentsResponseItem) =>
          octokit.issues.deleteComment({...context.repo, comment_id: c.id})
      ),
  );
}

export const getCheckPayload =
  (coverageSummary: CovSum, cwd: string, markdownTemplate: string):
    Octokit.ChecksCreateParams => {
    const isCoveragePass = coverageSummary.fileCoverageJSON.success;

    const outputTest = isCoveragePass ?
      undefined :
      `\`\`\`\n${filter(map(coverageSummary.fileCoverageJSON.testResults,
        (r) => strip(r.message))).join("\n").trimRight()}\n\`\`\``;

    const annotations: Octokit.ChecksCreateParamsOutputAnnotations[] = 
      isCoveragePass ?
        [] :
        flatMap(coverageSummary.fileCoverageJSON.testResults, (result) => {
          return filter(result.assertionResults, ["status", "failed"])
            .map((assertion) => ({
              path: result.name.replace(cwd, ""),
              start_line: assertion.location?.line ?? 0,
              end_line: assertion.location?.line ?? 0,
              annotation_level: "failure",
              title: (assertion.ancestorTitles || [])
                .concat(assertion.title)
                .join(" > "),
              message: strip(assertion.failureMessages?.join("\n\n") ?? ""),
            })
          );
        });

    return {
      ...context.repo,
      head_sha: context.payload.pull_request?.head.sha ?? context.sha,
      status: "completed",
      name: 'Coverage Report',
      conclusion: 'success',
      output: {
        title: 'Coverage Report',
        text: outputTest,
        summary: markdownTemplate,
        annotations: annotations,
      },
    }
  }