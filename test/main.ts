
import * as core from "@actions/core"
import {context} from "@actions/github"


import { ActionConfig, ConfigParams, getConfig } from "../src/config";
import { CovSum, run } from "../src/action";
import { ActionTemplate } from "../src/formater";
import { writeFileSync } from "fs";

const JEST_CURR_OUTPUT_FILENAME = 'jest.output.coverage.json';
const JEST_FLAG = '--forceExit --testLocationInResults';

const TEMPLATE_FILENAME = '../template.md';

async function main() {
  try {
    const actionConfig: ConfigParams = {
      workdir: core.getInput("workdir", {required: false}),
      templateFilePath: TEMPLATE_FILENAME,
      jestOutputFilename: core.getInput("output-filename", {required: false}) || JEST_CURR_OUTPUT_FILENAME,
      jestFlags: core.getInput("jest-custom-flags", {required: false}) ||  JEST_FLAG,
    }

    const currentActionConfig: ActionConfig | null = await getConfig(actionConfig);
    if (currentActionConfig == null) return;

    currentActionConfig.jestCMD = "echo hello world!";

    const currentBranchSummary: CovSum = await run(currentActionConfig);
    let baseBranchSummary: CovSum | undefined;

    const pullId: number = context.payload.pull_request?.number ?? 0;
    const isPullRequest: boolean = !!pullId;
    const isCoveragePass = currentBranchSummary.fileCoverageJSON.success;

    const baseActionConfig: ActionConfig | null = await getConfig({
      ...actionConfig,
      jestOutputFilename: 'jest.output.coverage.2.json',
    });
    if (baseActionConfig == null) return;

    baseActionConfig.jestCMD = "echo hello world!";

    baseBranchSummary = await run(baseActionConfig);

    const actionTemplate = new ActionTemplate(currentActionConfig);
    const markdownTemplate = actionTemplate.populate(currentBranchSummary, baseBranchSummary);

    writeFileSync('test.md', markdownTemplate)

  } catch (error) {
    console.error(error)
    core.setFailed('FAIL TEST')
    if (error instanceof Error) core.setFailed(error.message);
  }
}


main();