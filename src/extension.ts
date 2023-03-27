const { spawn } = require("child_process");
import * as vscode from "vscode";

export async function activate(context: vscode.ExtensionContext) {
  if (!vscode.workspace.workspaceFolders) {
    return;
  }

  const isGitInitiated = await checkIfGitIsInitiated();

  if (!isGitInitiated) {
    return;
  }

  const changesQuantityBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    10
  );
  context.subscriptions.push(changesQuantityBarItem);

  const targetBranch = context.workspaceState.get<string>("targetBranch");
  if (targetBranch) {
    changesQuantityBarItem.text =
      "Changes: " + (await getChangesCount(targetBranch));
  } else {
    changesQuantityBarItem.text = "Changes: ?";
  }
  changesQuantityBarItem.show();
}

async function checkIfGitIsInitiated(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let isGitInitiated: boolean;

    const gitCheck = spawn("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: vscode.workspace.workspaceFolders![0].uri.path,
    });

    gitCheck.stdout.on("data", (data: Buffer) => {
      isGitInitiated = data.toString().includes("true");
    });

    gitCheck.stderr.on("data", (data: any) => {
      reject(false);
    });

    gitCheck.on("close", (code: any) => {
      resolve(isGitInitiated);
    });
  });
}

function parseChangesQuantity(diffOutput: Buffer): string {
  const splittedDiffOutput = diffOutput.toString().split(", ");
  const insertions = +splittedDiffOutput[1].split(" ")[0];
  const deletions = +splittedDiffOutput[2].split(" ")[0];
  const changesQuantity = insertions + deletions;

  return changesQuantity.toString();
}

async function getChangesCount(targetBranch: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let changesCount: string;

    const diffHEAD = spawn("git", ["diff", targetBranch, "--shortstat"], {
      cwd: vscode.workspace.workspaceFolders![0].uri.path,
    });

    diffHEAD.stdout.on("data", (data: Buffer) => {
      changesCount = parseChangesQuantity(data);
    });

    diffHEAD.stderr.on("data", (data: any) => {
      reject("?");
    });

    diffHEAD.on("close", (code: any) => {
      resolve(changesCount);
    });
  });
}

export function deactivate() {}
