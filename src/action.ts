import { exec } from "@actions/exec";
import { readFileSync } from "fs"
import { CoverageMap, CoverageMapData, createCoverageMap, FileCoverage, CoverageSummary, createCoverageSummary } from "istanbul-lib-coverage"
import { ActionConfig } from "./config"
import path from "path";

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
  public coverage: number;
  public fileSummary: CoverageSummary;
  public fileCoverage: CoverageMap;
  public fileCoverageJSON: JsonReport;
  public directorySummary: {
    [file: string]: {
      summary: CoverageSummary,
      printed: boolean
    }
  };
  public documentSummary: {
    [file: string]: CoverageSummary
  };

  constructor(config: ActionConfig) {
    this.fileCoverageJSON = JSON.parse(readFileSync(config.jestOutputFilePath, "utf-8"));
    this.fileCoverage = createCoverageMap((this.fileCoverageJSON.coverageMap as unknown) as CoverageMapData);
    this.fileSummary = createCoverageSummary();
    this.directorySummary = {};
    this.documentSummary = {};
    this.coverage = 0;
  }

  addCoverageSumary(absoluteFilePath: string, coverageSummary: CoverageSummary) {
    const filePath = absoluteFilePath.replace('/home/runner/work/test/', '');
    const fileDir = path.dirname(filePath);

    if (!this.directorySummary[fileDir])
      this.directorySummary[fileDir] = {
        summary: createCoverageSummary(),
        printed: false,
      };

    this.documentSummary[filePath] = coverageSummary;
    this.directorySummary[fileDir].summary.merge(coverageSummary);
    this.fileSummary.merge(coverageSummary);
  }
}

export async function run(config: ActionConfig): Promise<CovSum> {
  try {
    console.log(config.jestCommand);
    await exec(config.jestCommand, [], {silent: true, cwd: config.workdir});
  } catch (error) {
    // exit(1) when executing failed tests throws an exception 
  }

  const covSum: CovSum = new CovSum(config);

  covSum.fileCoverage.files().forEach(function (filename: any) {
    const fileCoverage: FileCoverage = covSum.fileCoverage.fileCoverageFor(filename);
    const coverageSummary: CoverageSummary = fileCoverage.toSummary();
    covSum.addCoverageSumary(filename, coverageSummary)
  });

  covSum.coverage = 100 * 
    covSum.fileSummary.statements.covered / 
    covSum.fileSummary.statements.total;

  return covSum;
}