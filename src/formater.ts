
import { readFileSync } from "fs"
import table from "markdown-table"
import { CoverageSummaryData } from "istanbul-lib-coverage";
import path from "path";
import { CovSum, JsonReport, TestResult } from "./action";
import { ActionConfig } from "./config"

enum Color {
    NONE =      'default',
    BLUE =      '#1287A8',
    GREEN =     '#26a12b',
    GREY =      'grey',
    LIGHTGREEN = '#a6ba12',
    ORANGE =    '#FF6600',
    RED =       '#CC0000',
    YELLOW =    '#e0c307',
}

enum Icon {
    PTG = '\\\\%'
}


class Decorator {

    public static textColor(text: string, color: Color): string {
        return text ? `$\\small\\textcolor{${color}}{\\textbf{\\textsf{${text}}}}$ ` : '';
    }

    public static ptgFormat(value: number): string {
        const stringValue = (value || 0).toFixed(1);
        switch(true) {
            case value >= 90:
                return this.textColor(`${stringValue}${Icon.PTG}`, Color.GREEN);
            case value >= 75:
                return this.textColor(`${stringValue}${Icon.PTG}`, Color.LIGHTGREEN);
            case value >= 60:
                return this.textColor(`${stringValue}${Icon.PTG}`, Color.YELLOW);
            case value >= 50:
                return this.textColor(`${stringValue}${Icon.PTG}`, Color.ORANGE);
            default:
                return this.textColor(`${stringValue}${Icon.PTG}`, Color.RED);
        }
    }

    public static incFormat(value: number | undefined): string {
        if (value == undefined) return '';
        const stringValue = value.toFixed(1);
        switch(true) {
            case value > 0:
                return this.textColor(`(+${stringValue}${Icon.PTG})`, Color.GREEN);
            case value == 0:
                return this.textColor(`(${stringValue}${Icon.PTG})`, Color.GREY);
            default:
                return this.textColor(`(${stringValue}${Icon.PTG})`, Color.RED);
        }
    }
};

export class ActionTemplate {
    public template: string;

    constructor(config: ActionConfig) {
        this.template = config.templateFilePath ?
            readFileSync(path.resolve(__dirname, config.templateFilePath), "utf-8").toString() :
            '';
    }

    private _columns = {
        'file': (file: string) => file,
        [`Stmts (${Icon.PTG})`]: (file: string, newCov: CoverageSummaryData, oldCov?: CoverageSummaryData) =>
            this._tableCelFormat(
                100 * newCov.statements.covered / newCov.statements.total,
                oldCov ? 100 * oldCov.statements.covered / oldCov.statements.total : undefined),
        'Stmts': (file: string, newCov: CoverageSummaryData) =>
            Decorator.textColor(`${newCov.statements.covered}/${newCov.statements.total}`, Color.NONE),
        [`Branch (${Icon.PTG})`]: (file: string, newCov: CoverageSummaryData, oldCov?: CoverageSummaryData) =>
            this._tableCelFormat(
                100 * newCov.branches.covered / newCov.branches.total,
                oldCov ? 100 * oldCov.branches.covered / oldCov.branches.total : undefined),
        'Branch': (file: string, newCov: CoverageSummaryData) =>
            Decorator.textColor(`${newCov.branches.covered}/${newCov.branches.total}`, Color.NONE),
        [`Funcs (${Icon.PTG})`]: (file: string, newCov: CoverageSummaryData, oldCov?: CoverageSummaryData) =>
            this._tableCelFormat(
                100 * newCov.functions.covered / newCov.functions.total,
                oldCov ? 100 * oldCov.functions.covered / oldCov.functions.total : undefined),
        'Funcs': (file: string, newCov: CoverageSummaryData) =>
            Decorator.textColor(`${newCov.functions.covered}/${newCov.functions.total}`, Color.NONE),
        [`Lines (${Icon.PTG})`]: (file: string, newCov: CoverageSummaryData, oldCov?: CoverageSummaryData) =>
            this._tableCelFormat(
                100 * newCov.lines.covered / newCov.lines.total,
                oldCov ? 100 * oldCov.lines.covered / oldCov.lines.total : undefined),
        'Lines': (file: string, newCov: CoverageSummaryData) =>
            Decorator.textColor(`${newCov.lines.covered}/${newCov.lines.total}`, Color.NONE),
    }

    private _tableCelFormat(newValue: number, oldValue?: number): string {
        const value = Decorator.ptgFormat(newValue);
        const inc = Decorator.incFormat(oldValue ? newValue - oldValue  : undefined);
        return `<nobr>${value} ${inc}</nobr>`
    }

    private _addTables(newCovSum: CovSum, oldCovSum: CovSum | undefined) {
        const detailsTable: string[][] = [
            Object.keys(this._columns).map((name: string) => Decorator.textColor(name, Color.NONE)),
        ];

        const getOldCoverageData = oldCovSum ? 
            (filename: string) => oldCovSum.documentSummary[filename]?.toJSON() :
            () => undefined;

        const getFlag = oldCovSum ? 
            (file? : CoverageSummaryData) => file ? '' : Decorator.textColor(`NEW`, Color.RED) :
            () => '';

        Object.entries(newCovSum.documentSummary)
            .sort(([a], [b]) => 
                path.dirname(a) == path.dirname(b) ? 
                    path.extname(a) && path.extname(b) ? 
                        (a > b ? 1 : -1) : 
                        path.extname(a) ? 
                            (path.extname(b) ? (a > b ? 1 : -1) : -1) : 
                            (path.extname(b) ? 1 : (a > b ? 1 : -1)) :
                    (a > b ? 1 : -1) )
            .forEach(([filename, newCoverage]) => {
                const oldCoverageData: CoverageSummaryData | undefined = getOldCoverageData(filename);
                const fileTag: string = getFlag(oldCoverageData);
                detailsTable.push(
                    Object.values(this._columns).map((func) => {
                        const fileExt = path.extname(filename);
                        return func(
                            fileExt ? 
                                Decorator.textColor('↳ ', Color.GREY) + fileTag +
                                    Decorator.textColor(filename.replace(path.dirname(filename), ''), Color.GREY) :
                                fileTag + Decorator.textColor(filename, Color.NONE),
                            newCoverage.toJSON(), 
                            oldCoverageData);
                    })
                );
            });

        const summaryTable: string[][] = [
            Object.keys(this._columns).map((name: string) => Decorator.textColor(name, Color.NONE)),
            Object.values(this._columns).map((func) =>
                func(
                    Decorator.textColor('TOTAL', Color.NONE),
                    newCovSum.fileSummary.toJSON(),
                    oldCovSum && oldCovSum.fileSummary.toJSON()
                )
            ),
        ];

        this.template = this.template.replace('{{summary.table}}', 
            table(summaryTable, {align: ["l", "r", "r", "r", "r", "r", "r", "r", "r"]}));
        this.template = this.template.replace('{{details.table}}', 
            table(detailsTable, {align: ["l", "r", "r", "r", "r", "r", "r", "r", "r"]}));
    }

    private _addSummary(newCovSum: CovSum) {
        const data: JsonReport = newCovSum.fileCoverageJSON;

        this.template = this.template.replace('{{summary.suites}}', [
            Decorator.textColor(data.numPassedTestSuites ? `${data.numPassedTestSuites} passes` : '', Color.GREEN),
            Decorator.textColor(data.numPendingTestSuites ? `${data.numPendingTestSuites} pendings` : '', Color.YELLOW),
            Decorator.textColor(data.numFailedTestSuites ? `${data.numFailedTestSuites} fails` : '', Color.RED),
            Decorator.textColor(`${data.numTotalTestSuites} total`, Color.NONE),
            ,
        ].filter((el) => el).join(', '));

        this.template = this.template.replace('{{summary.tests}}', [
            Decorator.textColor(data.numPassedTests ? `${data.numPassedTests} passes` : '', Color.GREEN),
            Decorator.textColor(data.numPendingTests ? `${data.numPendingTests} pendings` : '', Color.YELLOW),
            Decorator.textColor(data.numFailedTests ? `${data.numFailedTests} fails` : '', Color.RED),
            Decorator.textColor(`${data.numTotalTests} total`, Color.NONE),
        ].filter((el) => el).join(', '));

        this.template = this.template.replace('{{summary.snapshots}}', [
            Decorator.textColor(`${data.snapshot.total} total`, Color.NONE),
        ].filter((el) => el).join(', '));

        this.template = this.template.replace('{{summary.time}}', [
            Decorator.textColor(
                ((data.testResults || [])
                        .map((el: TestResult) => el.endTime - el.startTime)
                        .reduce((a, b) => a + b) /
                    1000
                ).toFixed(3) + 's', 
                Color.NONE
            ),
        ].filter((el) => el).join(', '));
    }

    private _addTestSummary(newCovSum: CovSum) {
        const data: JsonReport = newCovSum.fileCoverageJSON;

        let testSummary = '';
        (data.testResults || []).forEach((test: TestResult) => {
            let status = '';
            if (test.status == 'passed')
                status = `${Decorator.textColor(`● PASS: `, Color.GREEN)} ${Decorator.textColor(test.name, Color.GREY)}`;
            else if (test.status == 'failed')
                status = Decorator.textColor(`⬤ FAIL: ${test.name}`, Color.RED);
            else 
                status = Decorator.textColor(`⬤ FAIL: ${test.status}:  ${test.name}`, Color.YELLOW);

            testSummary +=  `\n\n> ${status}`;
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
