
import * as core from "@actions/core"
import { exec } from "@actions/exec";
import {context, GitHub} from "@actions/github"
import type {Octokit} from "@octokit/rest"

import { writeFileSync } from "fs";
import filter from "lodash/filter"
import flatMap from "lodash/flatMap"
import map from "lodash/map"
import path from "path";
import strip from "strip-ansi"

import { ActionConfig, ConfigParams, getConfig } from "./config";
import { CovSum, run } from "./action";
import { ActionTemplate } from "./formater";

const BASE_BRANCH = '';
const JEST_CURR_OUTPUT_FILENAME = 'jest.output.coverage.json';
const JEST_FLAG = '--forceExit --testLocationInResults';

const TEMPLATE_FILENAME = '../template.md';

function getCommentPayload(pullId: number, markdownTemplate: string): Octokit.IssuesCreateCommentParams {
  return {
    ...context.repo,
    body: markdownTemplate,
    issue_number: pullId,
  };
}

function getCheckPayload(coverageSummary: CovSum, cwd: string, markdownTemplate: string): Octokit.ChecksCreateParams {
  const isCoveragePass = coverageSummary.fileCoverageJSON.success;

  const outputTest = isCoveragePass ? 
    undefined : 
    `\`\`\`\n${filter(map(coverageSummary.fileCoverageJSON.testResults, 
      (r) => strip(r.message))).join("\n").trimRight()}\n\`\`\``;
  
  const annotations: Octokit.ChecksCreateParamsOutputAnnotations[] =  isCoveragePass ? 
    [] : 
    flatMap(coverageSummary.fileCoverageJSON.testResults, (result) => {
      return filter(result.assertionResults, ["status", "failed"]).map((assertion) => ({
        path: result.name.replace(cwd, ""),
        start_line: assertion.location?.line ?? 0,
        end_line: assertion.location?.line ?? 0,
        annotation_level: "failure",
        title: (assertion.ancestorTitles || []).concat(assertion.title).join(" > "),
        message: strip(assertion.failureMessages?.join("\n\n") ?? ""),
      }))
    })

  return {
    ...context.repo,
    head_sha: context.payload.pull_request?.head.sha ?? context.sha,
    status: "completed",
    name: isCoveragePass ? 'Jest Code Coverage' : 'Jest Test Error',
    conclusion: isCoveragePass ? 'success' : 'failure',
    output: {
      title: isCoveragePass ? 'Jest Test Success' : 'Jest Test Failure',
      text: outputTest,
      summary: markdownTemplate,
      annotations: annotations,
    },
  }
}

async function main() {
  try {
    const actionConfig: ConfigParams = {
      workdir: core.getInput("workdir", {required: false}),
      templateFilePath: TEMPLATE_FILENAME,
      jestOutputFilename: core.getInput("output-filename", {required: false}) || JEST_CURR_OUTPUT_FILENAME,
      jestFlags: core.getInput("jest-custom-flags", {required: false}) ||  JEST_FLAG,
    }

    const token = core.getInput("github-token", {required: true});
    if (token === undefined) {
      core.error("GITHUB_TOKEN not set.");
      core.setFailed("GITHUB_TOKEN not set.");
      return;
    }

    const currentActionConfig: ActionConfig | null = await getConfig(actionConfig);
    if (currentActionConfig == null) return;

    const currentBranchSummary: CovSum = await run(currentActionConfig);
    let baseBranchSummary: CovSum | undefined;

    const pullId: number = context.payload.pull_request?.number ?? 0;
    const isPullRequest: boolean = !!pullId;
    const isCoveragePass = currentBranchSummary.fileCoverageJSON.success;

    if (isPullRequest) {
      await exec(`git fetch --all --depth=1`);
      await exec(`git checkout -f ${BASE_BRANCH}`);

      const baseActionConfig: ActionConfig | null = await getConfig(actionConfig);

      if (baseActionConfig == null) return;

      baseBranchSummary = await run(baseActionConfig);
    }

    await exec(`git checkout -`);

    const actionTemplate = new ActionTemplate(currentActionConfig);
    const markdownTemplate = actionTemplate.populate(currentBranchSummary, baseBranchSummary);

    const octokit = new GitHub(token);

    await octokit.checks.create(getCheckPayload(currentBranchSummary, currentActionConfig.workdir, markdownTemplate));

    if (isPullRequest) {
      await octokit.issues.createComment(getCommentPayload(pullId, markdownTemplate))
    }

    if (!isCoveragePass)
      core.setFailed("Some jest tests failed.");

  } catch (error) {
    console.error(error)
    core.setFailed('FAIL TEST')
    if (error instanceof Error) core.setFailed(error.message);
  }
}


main();