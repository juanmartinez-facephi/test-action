import { join, resolve, sep } from "path"
import { readFileSync } from "fs";


export class ConfigParams {
  public workdir?: string;
  public templateFilePath?: string;
  public jestOutputFilename!: string;
  public jestFlags!: string;
}

export class ActionConfig {
  public workdir!: string;
  public templateFilePath?: string;
  public jestOutputFilePath!: string;
  public jestCMD!: string;
}

export async function getConfig({ 
  workdir,
  templateFilePath,
  jestOutputFilename,
  jestFlags,
}: ConfigParams): Promise<ActionConfig | null> {

  const config = new ActionConfig();
  
  config.workdir = (workdir ? resolve(workdir) : process.cwd()) + sep;

  config.templateFilePath = templateFilePath;

  config.jestOutputFilePath = join(config.workdir, jestOutputFilename);
  config.jestCMD = `jest ${jestFlags} --coverage --json --outputFile=${jestOutputFilename}`;

  const TOKEN = process.env.GITHUB_TOKEN;
  // if (TOKEN === undefined) {
  //   core.error("GITHUB_TOKEN not set.");
  //   core.setFailed("GITHUB_TOKEN not set.");
  //   return null;
  // }

  return config;
}
