const { spawn } = require("child_process");
import { EventEmitter } from "node:events";
import * as vscode from "vscode";

const eventEmitter = new EventEmitter();

export async function activate(context: vscode.ExtensionContext) {
  if (!(await isGitInitialized())) return;

  const changesQuantityBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    10
  );
  context.subscriptions.push(changesQuantityBarItem);
  await refreshStatusBarItem(context, changesQuantityBarItem);
  changesQuantityBarItem.show();

  context.subscriptions.push(createTargetBranchCommand());
  context.subscriptions.push(createQuantityThresholdSetterCommand());

  eventEmitter.on("updateTargetBranch", async (newTargetBranch) => {
    context.workspaceState.update("targetBranch", newTargetBranch);
    await refreshStatusBarItem(context, changesQuantityBarItem);
  });

  eventEmitter.on("updateQuantityThreshold", async (newQuantityThreshold) => {
    context.workspaceState.update("quantityThreshold", newQuantityThreshold);
    await refreshStatusBarItem(context, changesQuantityBarItem);
  });

  vscode.workspace.onDidChangeConfiguration(async (config) => {
    if (config.affectsConfiguration("changedLinesCount"))
      await refreshStatusBarItem(context, changesQuantityBarItem);
  });

  vscode.workspace.onDidSaveTextDocument(async () => {
    await refreshStatusBarItem(context, changesQuantityBarItem);
  });
}

function hasFoldersInWorkspace(): boolean {
  return vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders.length > 0
    : false;
}

async function isGitInitialized(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!hasFoldersInWorkspace()) resolve(false);

    let isGitInitialized: boolean;

    const gitCheck = spawn("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: vscode.workspace.workspaceFolders![0].uri.path,
    });

    gitCheck.stdout.on("data", (data: Buffer) => {
      isGitInitialized = data.toString().includes("true");
    });

    gitCheck.stderr.on("data", (data: any) => {
      reject(false);
    });

    gitCheck.on("close", (code: any) => {
      resolve(isGitInitialized);
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

async function getChangesCount(
  targetBranch?: string
): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    if (!targetBranch) resolve(undefined);

    let changesCount: string = "0";

    const diffHEAD = spawn("git", ["diff", targetBranch, "--shortstat"], {
      cwd: vscode.workspace.workspaceFolders![0].uri.path,
    });

    diffHEAD.stdout.on("data", (data: Buffer) => {
      changesCount = parseChangesQuantity(data);
    });

    diffHEAD.stderr.on("data", (data: any) => {
      console.error(data.toString());
      reject("Error");
    });

    diffHEAD.on("close", (code: any) => {
      resolve(changesCount);
    });
  });
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

function getTooltipString(
  targetBranch?: string,
  quantityThreshold?: string
): vscode.MarkdownString {
  const setBranchTargetCommandURI = vscode.Uri.parse(
    `command:changed-lines-count.setTargetBranch`
  );
  const getQuantityThresholdCommandURI = vscode.Uri.parse(
    `command:changed-lines-count.setQuantityThreshold`
  );
  const markdownTooltip = new vscode.MarkdownString();

  if (targetBranch) {
    markdownTooltip.appendMarkdown(
      `$(git-branch) <strong>Current Target Branch</strong> <br> ${targetBranch}`
    );
  } else {
    markdownTooltip.appendMarkdown(
      `$(git-branch) <strong>Current Target Branch</strong> <br> Undefined`
    );
  }

  markdownTooltip.appendMarkdown("<br>");

  if (quantityThreshold) {
    markdownTooltip.appendMarkdown(
      `$(arrow-both) <strong>Quantity Threshold</strong> <br> ${quantityThreshold} changes`
    );
  } else {
    markdownTooltip.appendMarkdown(
      `$(arrow-both) <strong>Quantity Threshold</strong> <br> Undefined`
    );
  }

  markdownTooltip.appendMarkdown("<br>");

  if (!targetBranch) {
    markdownTooltip.appendMarkdown("<br>");
    markdownTooltip.appendMarkdown(`$(alert) Set a target branch.`);
  }

  if (!quantityThreshold) {
    markdownTooltip.appendMarkdown("<br>");
    markdownTooltip.appendMarkdown(`$(alert) Set a quantity threshold.`);
  }

  markdownTooltip.appendMarkdown(
    `<hr><br> $(edit) [${
      targetBranch ? "Change" : "Set"
    } Target Branch](${setBranchTargetCommandURI}) <br>`
  );

  markdownTooltip.appendMarkdown(
    `$(edit) [${
      quantityThreshold ? "Change" : "Set"
    } Quantity Threshold](${getQuantityThresholdCommandURI})`
  );

  markdownTooltip.isTrusted = true;
  markdownTooltip.supportThemeIcons = true;
  markdownTooltip.supportHtml = true;

  return markdownTooltip;
}

function createQuantityThresholdSetterCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "changed-lines-count.setQuantityThreshold",
    async () => {
      const quantityThreshold = await vscode.window.showInputBox({
        title: "Insert the changes quantity alert threshold",
        value: "250",
        prompt: "Only positive numbers are allowed.",
        validateInput: (value) => {
          if (+value && +value > 0) return null;
          else return "Please, insert a positive number.";
        },
      });

      eventEmitter.emit("updateQuantityThreshold", quantityThreshold);
    }
  );
}

async function refreshStatusBarItem(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): Promise<void> {
  const targetBranch = context.workspaceState.get<string>("targetBranch");
  const quantityThreshold =
    context.workspaceState.get<string>("quantityThreshold");

  const changesCount = await getChangesCount(targetBranch);
  refreshStatusBarCounter(statusBarItem, changesCount, quantityThreshold);
  refreshStatusBarTooltip(statusBarItem, targetBranch, quantityThreshold);
}

function refreshStatusBarCounter(
  statusBarItem: vscode.StatusBarItem,
  newChangesCount?: string,
  changesThreshold?: string
): void {
  statusBarItem.text = "Changes: " + (newChangesCount || "?");

  const config = vscode.workspace.getConfiguration("changedLinesCount");
  const shouldDisableColorChange = config.get<boolean>(
    "disableStatusBarIconColorChange"
  );

  if (
    !!shouldDisableColorChange &&
    changesThreshold &&
    newChangesCount &&
    +newChangesCount > +changesThreshold
  ) {
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  } else {
    statusBarItem.backgroundColor = undefined;
  }
}

function refreshStatusBarTooltip(
  statusBarItem: vscode.StatusBarItem,
  targetBranch?: string,
  quantityThreshold?: string
): void {
  const newTooltipString = getTooltipString(targetBranch, quantityThreshold);
  statusBarItem.tooltip = newTooltipString;
}

export function deactivate() {}
