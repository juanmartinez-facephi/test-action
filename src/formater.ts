
import { readFileSync } from "fs"
import table from "markdown-table"
import { CoverageSummaryData } from "istanbul-lib-coverage";
import path from "path";
import { CovSum, JsonReport, TestResult } from "./action";
import { ActionConfig } from "./config"

export class ActionTemplate {
    public template: string;

    constructor(config: ActionConfig) {
        this.template = config.templateFilePath ?
            readFileSync(path.resolve(__dirname, config.templateFilePath), "utf-8").toString() :
            '';
    }

    private _columns = {
        'file': (file: string) => file,
        '% Stmts': (file: string, newCov: CoverageSummaryData, oldCov?: CoverageSummaryData) =>
            this._tableCelFormat(
                100 * newCov.statements.covered / newCov.statements.total,
                oldCov ? 100 * oldCov.statements.covered / oldCov.statements.total : undefined),
        '% Branch': (file: string, newCov: CoverageSummaryData, oldCov?: CoverageSummaryData) =>
            this._tableCelFormat(
                100 * newCov.branches.covered / newCov.branches.total,
                oldCov ? 100 * oldCov.branches.covered / oldCov.branches.total : undefined),
        '% Funcs': (file: string, newCov: CoverageSummaryData, oldCov?: CoverageSummaryData) =>
            this._tableCelFormat(
                100 * newCov.functions.covered / newCov.functions.total,
                oldCov ? 100 * oldCov.functions.covered / oldCov.functions.total : undefined),
        '% Lines': (file: string, newCov: CoverageSummaryData, oldCov?: CoverageSummaryData) =>
            this._tableCelFormat(
                100 * newCov.lines.covered / newCov.lines.total,
                oldCov ? 100 * oldCov.lines.covered / oldCov.lines.total : undefined),
    }

    private _tableCelFormat(newValue: number, oldValue?: number): string {
        const diff = oldValue ? ((newValue || 0) - (oldValue)) : 0;

        let diffString: string;
        if (diff > 0)
            diffString = `(<span class="green">+${diff.toFixed(1)}&#x25;</span>)`;
        else if (diff < 0)
            diffString = `(<span class="red">${diff.toFixed(1)}&#x25;</span>)`;
        else
            diffString = '';

        switch (true) {
            case newValue >= 80:
                return `<span class="green">${(newValue || 0).toFixed(1)}&#x25;</span> ${diffString}`;
            case newValue >= 50:
                return `<span class="yellow">${(newValue || 0).toFixed(1)}&#x25;</span> ${diffString}`;
            default:
                return `<span class="red">${(newValue || 0).toFixed(1)}&#x25;</span> ${diffString}`;
        }
    }

    private _addTables(newCovSum: CovSum, oldCovSum: CovSum | undefined) {
        const detailsTable: string[][] = [Object.keys(this._columns)];

        const getOldCoverageData = oldCovSum ? 
            (filename: string) => oldCovSum.documentSummary[filename]?.toJSON() :
            () => undefined;

        const getFlag = oldCovSum ? 
            (file? : CoverageSummaryData) => file ? '' : '<span class="red">NEW</span> ':
            () => '';

        Object.entries(newCovSum.documentSummary).forEach(([filename, newCoverage]) => {
                const oldCoverageData: CoverageSummaryData | undefined = getOldCoverageData(filename);
                const fileTag: string = getFlag(oldCoverageData);
                detailsTable.push(
                    Object.values(this._columns).map((func) =>
                        func(fileTag + filename, newCoverage.toJSON(), oldCoverageData)
                    )
                );
            });

        const summaryTable: string[][] = [
            Object.keys(this._columns),
            Object.values(this._columns).map((func) =>
                func('TOTAL', newCovSum.fileSummary.toJSON(), oldCovSum && oldCovSum.fileSummary.toJSON())
            ),
        ];

        this.template = this.template.replace('{{summary.table}}', table(summaryTable, {align: ["l", "r", "r", "r", "r"]}));
        this.template = this.template.replace('{{details.table}}', table(detailsTable, {align: ["l", "r", "r", "r", "r"]}));
    }

    private _addSummary(newCovSum: CovSum) {
        const data: JsonReport = newCovSum.fileCoverageJSON;

        this.template = this.template.replace('{{summary.suites.pass}}',
            data.numPassedTestSuites ? `${data.numPassedTestSuites} passes` : '');
        this.template = this.template.replace('{{summary.suites.pending}}',
            data.numPendingTestSuites ? `${data.numPendingTestSuites} pendings` : '');
        this.template = this.template.replace('{{summary.suites.fail}}',
            data.numFailedTestSuites ? `${data.numFailedTestSuites} fails` : '');
        this.template = this.template.replace('{{summary.suites.total}}',
            `${data.numTotalTestSuites}`);

        this.template = this.template.replace('{{summary.tests.pass}}',
            data.numPassedTests ? `${data.numPassedTests} passes` : '');
        this.template = this.template.replace('{{summary.tests.pending}}',
            data.numPendingTests ? `${data.numPendingTests} pendings` : '');
        this.template = this.template.replace('{{summary.tests.fail}}',
            data.numFailedTests ? `${data.numFailedTests} fails` : '');
        this.template = this.template.replace('{{summary.tests.total}}',
            `${data.numTotalTests}`);

        this.template = this.template.replace('{{summary.snapshots.total}}',
            `${data.snapshot.total}`);

        this.template = this.template.replace('{{summary.time.total}}',
            `${(
                (data.testResults || [])
                    .map((el: TestResult) => el.endTime - el.startTime)
                    .reduce((a, b) => a + b) /
                1000
            ).toFixed(3)}`);
    }

    private _addTestSummary(newCovSum: CovSum) {
        const data: JsonReport = newCovSum.fileCoverageJSON;

        this.template = this.template.replace('{{tests.status}}',
            data.success ?
                `<span class="green">PASS</span>` :
                `<span class="red">FAIL</span>`);

        let testSummary = '';
        (data.testResults || []).forEach((test: TestResult) => {
            let status = '';
            if (test.status == 'passed')
                status = '<span class="green">&#10003;</span>'
            else if (test.status == 'failed')
                status = '<span class="red">&#215;</span>'
            else 
                status = `<span class="yellow">${test.status}</span>`

            testSummary +=  `\n\n> ${status} ${test.name}`;
        });

        this.template = this.template.replace('{{tests.review}}', testSummary);
    }

    public populate(newCovSum: CovSum, oldCovSum: CovSum | undefined) {
    this._addTables(newCovSum, oldCovSum);
    this._addSummary(newCovSum);
    this._addTestSummary(newCovSum);
    return this.template;
}
}
