import { join, resolve, sep } from "path"
import * as core from "@actions/core";
import { getBaseBranch, getPullRequestId } from "./github.utils";

export class ActionConfig {
  public githubToken: string;
  public isPullRequest: boolean;
  public hasPassCoverageAction: boolean;
  public jestCommand: string;
  public jestOutputFilePath: string;
  public pullRequestId: number;
  public pullRequestBase: string;
  public tableDisplayMode: string;
  public tableStyleDisabled: boolean;
  public templateFilePath: string;
  public thresholdBetweenBranch: number;
  public workdir: string;

  public errors: string[] = [];

  constructor() {
    const customGithubToken = 
      core.getInput("github-token", {required: true});

    const customWorkdir = 
      core.getInput("workdir");

    const customJestCommand = 
      core.getInput("jest-command");

    const customJestConfigFilename = 
      core.getInput("jest-config-filename");

    const customJestFlags =
      core.getInput("jest-flags") ||  
      '--forceExit --testLocationInResults';

    const customJestOutputFileName = 
      core.getInput("jest-output-filename") || 
      'jest.output.coverage.json';

    const customTableStyleDisabled = 
      core.getInput("table-style-disabled") === 'true';

    const customTableDisplayMode = 
      core.getInput("table-display-mode") || 'ALL';

    const customThresholdBetweenBranch = 
      core.getInput("threshold-between-branch") ||
      '-100';

    
    this.workdir = customWorkdir ? 
      `${resolve(customWorkdir)}${sep}` : 
      `${process.cwd()}`;

    this.jestOutputFilePath = join(this.workdir, customJestOutputFileName);
    
    this.jestCommand = customJestCommand || 
      (`jest ${customJestFlags} --coverage --json --outputFile=${this.jestOutputFilePath}` + 
        (customJestConfigFilename ? 
          ` --config ${join(this.workdir, customJestConfigFilename)}` : 
          ''));

    this.tableDisplayMode = customTableDisplayMode.toUpperCase();

    this.githubToken = customGithubToken;
    this.tableStyleDisabled = customTableStyleDisabled;
    this.templateFilePath = '../template.md';
    this.thresholdBetweenBranch = Number(customThresholdBetweenBranch);

    this.pullRequestId = getPullRequestId();
    this.pullRequestBase = getBaseBranch();
    this.isPullRequest = !!this.pullRequestId;
    this.hasPassCoverageAction = false;
  }

  public addError(error: string) {
    this.hasPassCoverageAction = false;
    this.errors.push(error);
  }
}
