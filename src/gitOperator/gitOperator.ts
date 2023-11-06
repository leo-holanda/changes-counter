import * as vscode from "vscode";
import { spawn } from "child_process";
import { ChangesData } from "./gitOperator.interfaces";

export class GitOperator {
  diffExclusionParameters: string[] = [];

  constructor() {}

  private hasFoldersInWorkspace(): boolean {
    return vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length > 0 : false;
  }

  async checkGitInitialization(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.hasFoldersInWorkspace()) {
        reject("The extension couldn't find a folder in your workspace.");
        return;
      }

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

  private parseDiffOutput(diffOutput: Buffer): ChangesData {
    const diffOutputData = { changesCount: "0", insertions: "0", deletions: "0" };

    const splittedDiffOutput = diffOutput.toString().split(", ").slice(1);

    splittedDiffOutput.forEach((changesData) => {
      const splittedChangesData = changesData.split(" ");
      if (splittedChangesData[1].includes("insertion"))
        diffOutputData.insertions = splittedChangesData[0];
      else if (splittedChangesData[1].includes("deletion"))
        diffOutputData.deletions = splittedChangesData[0];
    });

    diffOutputData.changesCount = (
      +diffOutputData.insertions + +diffOutputData.deletions
    ).toString();

    return diffOutputData;
  }

  async getChangesData(comparisonBranch?: string): Promise<ChangesData | undefined> {
    return new Promise((resolve, reject) => {
      if (comparisonBranch === undefined) {
        reject("A comparison branch wasn't defined. Please, define a comparison branch.");
        return;
      }

      let changesData: ChangesData = {
        insertions: "0",
        deletions: "0",
        changesCount: "0",
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
}
