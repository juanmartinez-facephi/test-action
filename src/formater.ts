
import { readFileSync } from "fs"
import table from "markdown-table"
import { CoverageSummaryData } from "istanbul-lib-coverage";
import path from "path";
import { CovSum, JsonReport, TestResult } from "./action";
import { ActionConfig } from "./config"

export enum Color {
  NONE = 'default',
  BLUE = '#0F96CF',
  GREEN = '#26A65B',
  GREY = 'grey',
  LIGHTGREEN = '#96c362',
  ORANGE = '#FBAB54',
  RED = '#F25D5A',
  YELLOW = '#dfc73f',
}

enum Icon {
  PtgFormatted = '\\\\%',
  PtgDefault = '%',
}

export enum SummaryTableMode {
  ALL = 'ALL',
  SIMPLE = 'SIMPLE',
  STATEMENTS = 'STATEMENT',
}

const HtmlShortcut = {
  collapse: (title: string, content:string) => 
    `\n\n<details><summary class="link">${title}</summary>\n\n### **${title}**\n\n${content}\n\n</details>`
}


export class Decorator {

  public static textColor(text: string, color: Color): string {
    return text ? `$\\textcolor{${color}}{\\textbf{\\textsf{${text}}}}$ ` : '';
  }

  public static ptgFormat(value: number, noFormat?: boolean): string {
    const stringValue = `${(value || 0).toFixed(1)}${
      noFormat ? Icon.PtgDefault : Icon.PtgFormatted}`;
    if (noFormat) return stringValue;

    switch (true) {
      case value >= 90:
        return this.textColor(stringValue, Color.GREEN);
      case value >= 75:
        return this.textColor(stringValue, Color.LIGHTGREEN);
      case value >= 60:
        return this.textColor(stringValue, Color.YELLOW);
      case value >= 50:
        return this.textColor(stringValue, Color.ORANGE);
      case isNaN(value):
        return this.textColor('-', Color.GREY);
      default:
        return this.textColor(stringValue, Color.RED);
    }
  }

  public static incFormat(value: number | undefined, noFormat?: boolean): string {
    if (value == undefined) return '';

    const stringValue = `(${value > 0 ? '+' : ''}${(value || 0).toFixed(1)}${
      noFormat ? Icon.PtgDefault : Icon.PtgFormatted})`;
    if (noFormat) return stringValue;

    switch (true) {
      case value > 10:
        return this.textColor(stringValue, Color.GREEN);
      case value > 0:
        return this.textColor(stringValue, Color.LIGHTGREEN);
      case value == 0:
        return this.textColor(stringValue, Color.GREY);
      case value > -10:
        return this.textColor(stringValue, Color.ORANGE);
      default:
        return this.textColor(stringValue, Color.RED);
    }
  }
};


export class ActionTemplate {
  private _comment: string = '';
  private _fullTest: string = '';
  private _fullCoverage: string = '';

  private readonly _tableColorDisabled: boolean;

  private readonly _columns: {
    [field: string]: (f:string, c1: CoverageSummaryData, c2?: CoverageSummaryData, b?: boolean) => string
  };

  constructor(config: ActionConfig) {
    this._comment = config.templateFilePath ?
      readFileSync(path.resolve(__dirname, config.templateFilePath), "utf-8").toString() :
      '';

    this._tableColorDisabled = config.tableColorDisabled;

    this._columns = {
      'File': (f, c1, c2) => f,
      '% Stmts': (f, c1, c2, b) =>
        this._tableCelFormat(
          100 * c1.statements.covered / c1.statements.total,
          c2 && (100 * c2.statements.covered / c2.statements.total),
          b),
      'Stmts': (f, c1, c2) => `${c1.statements.covered}/${c1.statements.total}`,
      '% Branch': (f, c1, c2, b) =>
        this._tableCelFormat(
          100 * c1.branches.covered / c1.branches.total,
          c2 && (100 * c2.branches.covered / c2.branches.total),
          false),
      'Branch': (f, c1, c2) => `${c1.branches.covered}/${c1.branches.total}`,
      '% Funcs': (f, c1, c2, b) =>
        this._tableCelFormat(
          100 * c1.functions.covered / c1.functions.total,
          c2 && (100 * c2.functions.covered / c2.functions.total),
          false),
      'Funcs': (f, c1, c2) => `${c1.functions.covered}/${c1.functions.total}`,
      '% Lines': (f, c1, c2, b) =>
        this._tableCelFormat(
          100 * c1.lines.covered / c1.lines.total,
          c2 && (100 * c2.lines.covered / c2.lines.total),
          false),
      'Lines': (f, c1, c2) => `${c1.lines.covered}/${c1.lines.total}`,
    };

    switch (config.tableDisplayMode) {
      case SummaryTableMode.STATEMENTS:
        delete this._columns['% Lines'];
        delete this._columns['% Funcs'];
        delete this._columns['% Branch'];
      case SummaryTableMode.SIMPLE:
        delete this._columns['Lines'];
        delete this._columns['Funcs'];
        delete this._columns['Branch'];
        delete this._columns['Stmts'];
      default:
    }
  }

  private _tableCelFormat(newValue: number, oldValue?: number, noFormat?: boolean): string {
    const value = Decorator.ptgFormat(newValue, noFormat);
    const inc = Decorator.incFormat(oldValue ? newValue - oldValue : undefined, noFormat);
    return `<nobr>${value} ${inc}</nobr>`
  }

  private _addTables(newCovSum: CovSum | undefined, oldCovSum: CovSum | undefined) {
    const detailsTable: string[][] = [];
    const summaryTable: string[][] = [];

    if (newCovSum) {
      detailsTable.push(
        Object.keys(this._columns),
      );

      const getOldFileCoverageData = oldCovSum ?
        (filename: string) => oldCovSum.documentSummary[filename]?.toJSON() :
        () => undefined;

      const getOldDirCoverageData = oldCovSum ?
        (filename: string) => oldCovSum.directorySummary[filename]?.summary.toJSON() :
        () => undefined;

      const getFlag = oldCovSum ?
        (file?: CoverageSummaryData) => file ? '' : Decorator.textColor(`NEW`, Color.RED) :
        () => '';

      Object.entries(newCovSum.documentSummary)
        .sort(([a], [b]) =>
          path.dirname(a) == path.dirname(b) ?
            a > b ? 1 : -1 :
            path.dirname(a) > path.dirname(b) ? 1 : -1)
        .forEach(([filename, newCoverage]) => {
          const oldFileCoverageData: CoverageSummaryData | undefined = 
            getOldFileCoverageData(filename);

          const fileDir = path.dirname(filename);
          const newDirSummary = newCovSum.directorySummary[fileDir];

          if (!newDirSummary.printed) {
            newDirSummary.printed = true;
            const oldDirSummaryData: CoverageSummaryData | undefined = 
              getOldDirCoverageData(fileDir);

            detailsTable.push(Object.values(this._columns)
              .map((func) =>  func(
                getFlag(oldDirSummaryData) + fileDir, 
                newDirSummary.summary.toJSON(), 
                oldDirSummaryData,
                this._tableColorDisabled)
              ));
          }

          detailsTable.push(Object.values(this._columns)
            .map((func) => {
              return func(
                  Decorator.textColor('↳ ', Color.GREY) + getFlag(oldFileCoverageData) +
                  Decorator.textColor(filename.replace(path.dirname(filename), ''), Color.GREY),
                newCoverage.toJSON(),
                oldFileCoverageData,
                this._tableColorDisabled);
            })
          );

          detailsTable.push(Object.values(this._columns)
            .map((func) => {
              return func(
                  Decorator.textColor('↳ ', Color.GREY) + getFlag(oldFileCoverageData) +
                  Decorator.textColor(filename.replace(path.dirname(filename), ''), Color.GREY),
                newCoverage.toJSON(),
                oldFileCoverageData,
                this._tableColorDisabled);
            })
          );
        });

      summaryTable.push(
        Object.keys(this._columns),
        Object.values(this._columns).map((func) =>
          func(
            'All Files',
            newCovSum.fileSummary.toJSON(),
            oldCovSum && oldCovSum.fileSummary.toJSON(),
          )
        ),
      );
    }

    this._comment = this._comment.replace('{{summary.table}}', summaryTable ?
      table(summaryTable, { align: ["l", "r", "r", "r", "r", "r", "r", "r", "r"] }) : '');
    this._fullCoverage = HtmlShortcut.collapse('Full File Report', detailsTable ?
      table(detailsTable, { align: ["l", "r", "r", "r", "r", "r", "r", "r", "r"] }) : '');
  }

  private _addSummary(newCovSum: CovSum, errors: string[]) {
    const data: JsonReport = newCovSum.fileCoverageJSON;
    
    this._comment = this._comment.replace('{{summary.status}}',
      newCovSum.fileCoverageJSON.success && errors.length == 0 ?
        Decorator.textColor('PASS', Color.GREEN) :
        Decorator.textColor('FAIL', Color.RED),
    );

    this._comment = this._comment.replace('{{summary.message}}',
      errors.length ? 
        errors.map((e) => Decorator.textColor(`ERROR: ${e}`, Color.ORANGE)).join(', ') : 
        'All Test Passed'
    );

    this._comment = this._comment.replace('{{summary.suites}}', [
      Decorator.textColor(data.numPassedTestSuites ? `${data.numPassedTestSuites} passes` : '', Color.GREEN),
      Decorator.textColor(data.numPendingTestSuites ? `${data.numPendingTestSuites} pendings` : '', Color.YELLOW),
      Decorator.textColor(data.numFailedTestSuites ? `${data.numFailedTestSuites} fails` : '', Color.RED),
      Decorator.textColor(`${data.numTotalTestSuites} total`, Color.NONE),
      ,
    ].filter((el) => el).join(', '));

    this._comment = this._comment.replace('{{summary.tests}}', [
      Decorator.textColor(data.numPassedTests ? `${data.numPassedTests} passes` : '', Color.GREEN),
      Decorator.textColor(data.numPendingTests ? `${data.numPendingTests} pendings` : '', Color.YELLOW),
      Decorator.textColor(data.numFailedTests ? `${data.numFailedTests} fails` : '', Color.RED),
      Decorator.textColor(`${data.numTotalTests} total`, Color.NONE),
    ].filter((el) => el).join(', '));

    this._comment = this._comment.replace('{{summary.snapshots}}', [
      Decorator.textColor(`${data.snapshot.total} total`, Color.NONE),
    ].filter((el) => el).join(', '));

    this._comment = this._comment.replace('{{summary.time}}', [
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
        status = `${Decorator.textColor(`● PASS: `, Color.GREEN)} ${test.name}`;
      else if (test.status == 'failed')
        status = `${Decorator.textColor(`● FAIL: `, Color.RED)} ${test.name}`;
      else
        status = `${Decorator.textColor(`● UNKOWN [${test.status}]:`, Color.YELLOW)} ${test.name}`;

      testSummary += `\n\n> ${status}`;
    });

    this._fullTest = HtmlShortcut.collapse('All Test Status',  testSummary);
  }

  public populate(newCovSum: CovSum, oldCovSum: CovSum | undefined, errors: string[] | undefined): {
    reportMessage: string,
    commentMessage: string
  } {
    this._addSummary(newCovSum, errors || []);
    this._addTestSummary(newCovSum);
    this._addTables(newCovSum, oldCovSum);


    let CommentWithTestLength = this._comment.length + this._fullTest.length;
    let reportMessage: string = this._comment + this._fullTest + this._fullCoverage;
    let commentMessage: string;

    if (CommentWithTestLength > 65535) 
      commentMessage = this._comment;
    else if (CommentWithTestLength + this._fullCoverage.length > 65535) 
      commentMessage = this._comment + this._fullTest
    else 
      commentMessage = reportMessage;

    return {
      reportMessage,
      commentMessage,
    };
  }
}
