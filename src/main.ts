import { setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import { GitHub } from "@actions/github"

import { ActionConfig } from "./config";
import { CovSum, run } from "./action";
import { ActionTemplate, Color, Decorator } from "./formater";
import { 
  getCommentPayload,
  getCheckPayload,
  deletePreviousComments,
} from "./github.utils";

async function main() {
  try {
    console.log('get Action Config');
    const actionConfig: ActionConfig = new ActionConfig();

    console.group('CURRENT BRANCH');
    const currentBranchSummary: CovSum = await run(actionConfig);
    if (!currentBranchSummary.fileCoverageJSON.success)
      actionConfig.addError('Current Test Failed Status.');
    console.groupEnd()

    actionConfig.hasPassCoverageAction = 
      currentBranchSummary.fileCoverageJSON.success;

    let baseBranchSummary: CovSum | undefined;
    
    if (actionConfig.isPullRequest) {
      try {
        console.log(`Checkout [${actionConfig.pullRequestBase}]`);
        await exec(`git fetch --all --depth=1`);
        await exec(`git checkout -f ${actionConfig.pullRequestBase}`);
  
        console.group('BASE BRANCH');
        baseBranchSummary = await run(actionConfig);
        console.groupEnd();

        const coverageIncrement = currentBranchSummary.coverage - baseBranchSummary.coverage;
        if (coverageIncrement < actionConfig.thresholdBetweenBranch) {
          currentBranchSummary.fileCoverageJSON.success = false;
          actionConfig.addError(`Current Coverage has Decreased by [${
              coverageIncrement}\\\\%] When the Allowable Minimun Threshold is [${
              actionConfig.thresholdBetweenBranch}\\\\%].`);
        }
      } catch (error) {
        console.error(error);
      }
    }

    console.log('Crete report message');
    const actionTemplate = new ActionTemplate(actionConfig);
    const markdownTemplate = actionTemplate.populate(
      currentBranchSummary, 
      baseBranchSummary,
      actionConfig.errors);

    console.log('add Check with Coverage Report'); // for push action
    const octokit = new GitHub(actionConfig.githubToken);
    await octokit.checks.create(getCheckPayload(
      currentBranchSummary, 
      actionConfig.workdir, 
      markdownTemplate
    ));

    console.log('add Comment with Coverage Report');
    if (actionConfig.isPullRequest) {
      await deletePreviousComments(octokit);
      await octokit.issues.createComment(getCommentPayload(
        actionConfig.pullRequestId, 
        markdownTemplate
      ));
    }

    if (!actionConfig.hasPassCoverageAction) {
      setFailed("Some jest tests failed.");
    }

  } catch (error) {
    console.error(error)
    setFailed('FAIL TEST')
  }
}


main();