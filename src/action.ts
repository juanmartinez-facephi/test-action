import { readFileSync } from "fs"
import { CoverageMap, CoverageMapData, createCoverageMap, FileCoverage, CoverageSummary, createCoverageSummary } from "istanbul-lib-coverage"
import { ActionConfig } from "./config"

export type JsonReport = {
  numFailedTestSuites: number;
  numFailedTests: number;
  numPassedTestSuites: number;
  numPassedTests: number;
  numPendingTestSuites: number;
  numPendingTests: number;
  numRuntimeErrorTestSuites: number;
  numTodoTests: number;
  numTotalTestSuites: number;
  numTotalTests: number;
  openHandles?: unknown[];
  snapshot: Snapshot;
  startTime: number;
  success: boolean;
  testResults?: TestResult[];
  wasInterrupted: boolean;
  coverageMap: CoverageMap;
};

export type Snapshot = {
  added: number;
  didUpdate: boolean;
  failure: boolean;
  filesAdded: number;
  filesRemoved: number;
  filesRemovedList?: unknown[];
  filesUnmatched: number;
  filesUpdated: number;
  matched: number;
  total: number;
  unchecked: number;
  uncheckedKeysByFile?: unknown[];
  unmatched: number;
  updated: number;
};

export type TestResult = {
  assertionResults?: AssertionResult[];
  endTime: number;
  message: string;
  name: string;
  startTime: number;
  status: string;
  summary: string;
};

export type AssertionResult = {
  ancestorTitles?: string[];
  failureMessages?: string[];
  fullName: string;
  location: {
    column?: number;
    line: number;
  };
  status: string;
  title: string;
};

export class CovSum {
  public fileSummary: CoverageSummary;
  public fileCoverage: CoverageMap;
  public fileCoverageJSON: JsonReport;
  public documentSummary: {
    [file: string]: CoverageSummary
  };

  constructor(config: ActionConfig) {
    this.fileCoverageJSON = JSON.parse(readFileSync(config.jestOutputFilePath, "utf-8"));
    this.fileCoverage = createCoverageMap((this.fileCoverageJSON.coverageMap as unknown) as CoverageMapData);
    this.fileSummary = createCoverageSummary();
    this.documentSummary = {};
  }

  addCoverageSumary(coverageFile: string, coverageSummary: CoverageSummary) {
    this.fileSummary.merge(coverageSummary);
    if (this.documentSummary[coverageFile])
      this.documentSummary[coverageFile].merge(coverageSummary);
    else
      this.documentSummary[coverageFile] = coverageSummary;
  }
}

export async function run(config: ActionConfig): Promise<CovSum> {

  console.log(`exec ${config.jestCMD}`);
  //await exec(config.jestCMD, [], {silent: true, cwd: config.workdir});

  const covSum: CovSum = new CovSum(config);

  covSum.fileCoverage.files().forEach(function (filename: any) {
    const fileCoverage: FileCoverage = covSum.fileCoverage.fileCoverageFor(filename);
    const coverageSummary: CoverageSummary = fileCoverage.toSummary();
    covSum.addCoverageSumary(filename, coverageSummary)
  });

  return covSum;
}