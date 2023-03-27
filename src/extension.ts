const { spawn } = require("child_process");
import { EventEmitter } from "node:events";
import * as vscode from "vscode";

const eventEmitter = new EventEmitter();

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

  const storedTargetBranch = context.workspaceState.get<string>("targetBranch");
  if (storedTargetBranch) {
    const currentChangesCount = await getChangesCount(storedTargetBranch);
    setCounter(currentChangesCount, changesQuantityBarItem);
    changesQuantityBarItem.tooltip = getTooltipString(storedTargetBranch);
  } else {
    setCounter("?", changesQuantityBarItem);
    changesQuantityBarItem.tooltip = getTooltipString(undefined);
  }
  changesQuantityBarItem.show();

  context.subscriptions.push(createTargetBranchCommand());

  eventEmitter.on("updateTargetBranch", async (newTargetBranch) => {
    context.workspaceState.update("targetBranch", newTargetBranch);
    const currentChangesCount = await getChangesCount(newTargetBranch);
    changesQuantityBarItem.tooltip = getTooltipString(newTargetBranch);
    setCounter(currentChangesCount, changesQuantityBarItem);
  });
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

function setCounter(
  newCounterValue: string,
  counterBarItem: vscode.StatusBarItem
): void {
  counterBarItem.text = "Changes: " + newCounterValue;
}

async function getAvaliableBranches(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let avaliableBranches: string[];

    const getAllBranches = spawn("git", ["branch", "-a"], {
      cwd: vscode.workspace.workspaceFolders![0].uri.path,
    });

    getAllBranches.stdout.on("data", (data: Buffer) => {
      const branchesList = data.toString().split(/\r?\n/);
      let validBranches = branchesList.filter(
        (branch) => branch && branch[0] !== "*"
      );
      validBranches = branchesList.map((branch) => branch.trim());
      avaliableBranches = validBranches;
    });

    getAllBranches.stderr.on("data", (data: any) => {
      reject([]);
    });

    getAllBranches.on("close", (code: any) => {
      resolve(avaliableBranches);
    });
  });
}

function createTargetBranchCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "changed-lines-count.setTargetBranch",
    async () => {
      const targetBranchQuickPick = vscode.window.createQuickPick();
      targetBranchQuickPick.title = "Choose a target branch";

      const avaliableBranches = await getAvaliableBranches();
      targetBranchQuickPick.items = avaliableBranches.map((branch) => {
        return { label: branch };
      });

      targetBranchQuickPick.onDidChangeSelection((selection) => {
        eventEmitter.emit("updateTargetBranch", selection[0].label);
        targetBranchQuickPick.dispose();
      });

      targetBranchQuickPick.show();
    }
  );
}

function getTooltipString(targetBranch?: string): vscode.MarkdownString {
  const setBranchTargetCommandURI = vscode.Uri.parse(
    `command:changed-lines-count.setTargetBranch`
  );
  const markdownTooltip = new vscode.MarkdownString();

  if (targetBranch) {
    markdownTooltip.appendMarkdown(
      `$(git-branch) Current Target Branch: <strong>${targetBranch}</strong>`
    );
  } else {
    markdownTooltip.appendMarkdown(
      `$(error) Current Target Branch: <strong>Undefined</strong> <br> Please, select a target branch.`
    );
  }

  markdownTooltip.appendMarkdown(
    `<hr><br> $(refresh) [Change Target Branch](${setBranchTargetCommandURI})`
  );

  markdownTooltip.isTrusted = true;
  markdownTooltip.supportThemeIcons = true;
  markdownTooltip.supportHtml = true;

  return markdownTooltip;
}

export function deactivate() {}
