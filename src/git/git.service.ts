import * as vscode from "vscode";
import { spawn } from "child_process";
import { DiffData } from "./git.service.interfaces";
import { Logger } from "../logger/logger";
import { LogTypes } from "../logger/logger.enums";

export class GitService {
  private context: vscode.ExtensionContext;
  private diffExclusionParameters: string[] = [];
  private logger: Logger;

  readonly IGNORE_FILE_NAME = ".ccignore";

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.logger = Logger.getInstance();
  }

  async updateDiffExclusionParameters(): Promise<void> {
    this.diffExclusionParameters = await this.getDiffExclusionParameters();
  }

  clearDiffExclusionParameters(): void {
    this.diffExclusionParameters = [];
  }

  async checkGitInitialization(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let isGitInitialized: boolean;

      const gitChildProcess = spawn("git", ["rev-parse", "--is-inside-work-tree"], {
        cwd: vscode.workspace.workspaceFolders![0].uri.fsPath,
      });

      gitChildProcess.on("error", (err) => reject(err));

      gitChildProcess.stdout.on("data", (data: Buffer) => {
        isGitInitialized = data.toString().includes("true");
      });

      gitChildProcess.stderr.on("data", (data: Buffer) => {
        reject(data.toString());
      });

      gitChildProcess.on("close", () => {
        resolve(isGitInitialized);
      });
    });
  }

  private parseDiffOutput(diffOutput: Buffer): DiffData {
    const diffOutputData: DiffData = { insertions: "0", deletions: "0" };

    const splittedDiffOutput = diffOutput.toString().split(", ").slice(1);

    splittedDiffOutput.forEach((changesData) => {
      const splittedChangesData = changesData.split(" ");
      if (splittedChangesData[1].includes("insertion"))
        diffOutputData.insertions = splittedChangesData[0];
      else if (splittedChangesData[1].includes("deletion"))
        diffOutputData.deletions = splittedChangesData[0];
    });

    return diffOutputData;
  }

  async getDiffData(): Promise<DiffData> {
    return new Promise((resolve, reject) => {
      const comparisonBranch = this.context.workspaceState.get<string>("comparisonBranch");
      if (comparisonBranch === undefined) {
        reject("A comparison branch wasn't defined. Please, define a comparison branch.");
        return;
      }

      let changesData: DiffData = {
        insertions: "0",
        deletions: "0",
      };

      const gitChildProcess = spawn(
        "git",
        ["diff", comparisonBranch, "--shortstat", ...this.diffExclusionParameters],
        {
          cwd: vscode.workspace.workspaceFolders![0].uri.fsPath,
          shell: true, // Diff exclusion parameters doesn't work without this
        }
      );

      gitChildProcess.on("error", (err) => reject(err));

      gitChildProcess.stdout.on("data", (data: Buffer) => {
        changesData = this.parseDiffOutput(data);
      });

      gitChildProcess.stderr.on("data", (data: Buffer) => {
        reject(data.toString());
      });

      gitChildProcess.on("close", () => {
        resolve(changesData);
      });
    });
  }

  async getAvailableBranches(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      let avaliableBranches: string[];

      const gitChildProcess = spawn("git", ["branch", "-a"], {
        cwd: vscode.workspace.workspaceFolders![0].uri.fsPath,
      });

      gitChildProcess.on("error", (err) => reject(err));

      gitChildProcess.stdout.on("data", (data: Buffer) => {
        const branchesList = data.toString().split(/\r?\n/);
        let validBranches = branchesList.filter((branch) => branch && branch[0] !== "*");

        const removeRemoteBranchArrow = new RegExp("( -> ).*");
        /*
          "remotes/origin/HEAD -> origin/main" becomes
          "remotes/origin/HEAD"
        */
        avaliableBranches = validBranches.map((branch) => {
          return branch.trim().replace(removeRemoteBranchArrow, "");
        });
      });

      gitChildProcess.stderr.on("data", (data: Buffer) => {
        reject(data.toString());
      });

      gitChildProcess.on("close", () => {
        resolve(avaliableBranches);
      });
    });
  }

  private async getFilesToIgnore(): Promise<string[]> {
    const matchedFiles = await vscode.workspace.findFiles(this.IGNORE_FILE_NAME);
    if (matchedFiles.length === 0) {
      this.logger.log("No ignore file was found.", LogTypes.INFO);
      Logger.hasLoggedIgnoreFileFirstCheck = true;
      return [];
    }

    if (!Logger.hasLoggedIgnoreFileFirstCheck) {
      this.logger.log(
        "An ignore file was found. Files and patterns defined in it will be ignored when counting changes.",
        LogTypes.INFO
      );
      Logger.hasLoggedIgnoreFileFirstCheck = true;
    }

    const cgIgnoreFileContent = await vscode.workspace.fs.readFile(matchedFiles[0]);
    return cgIgnoreFileContent.toString().split("\n");
  }

  private async getDiffExclusionParameters(): Promise<string[]> {
    const filesToIgnore = await this.getFilesToIgnore();
    if (filesToIgnore.length === 0 || filesToIgnore[0] === "") return [];

    let diffExclusionParameters: string[] = ["-- ."];
    diffExclusionParameters = diffExclusionParameters.concat(
      filesToIgnore.map((fileName) => {
        return process.platform === "win32"
          ? ":(exclude)" + fileName + ""
          : "':(exclude)" + fileName + "'";
      })
    );

    return diffExclusionParameters;
  }
}
