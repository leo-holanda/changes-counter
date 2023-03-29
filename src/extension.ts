const { spawn } = require("child_process");
import { EventEmitter } from "node:events";
import * as vscode from "vscode";

const eventEmitter = new EventEmitter();
let isUserNotified = false;

interface ChangesData {
  insertions: string;
  deletions: string;
  changesSum: string;
}

export async function activate(context: vscode.ExtensionContext) {
  if (!(await isGitInitialized())) {
    vscode.commands.executeCommand(
      "setContext",
      "changedLinesCount.isGitInitialized",
      false
    );
    return;
  }

  vscode.commands.executeCommand(
    "setContext",
    "changedLinesCount.isGitInitialized",
    true
  );

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

function parseChangesQuantity(diffOutput: Buffer): ChangesData {
  const splittedDiffOutput = diffOutput.toString().split(", ");
  const insertions = splittedDiffOutput[1].split(" ")[0];
  const deletions = splittedDiffOutput[2].split(" ")[0];
  const changesSum = +insertions + +deletions;

  return { changesSum: changesSum.toString(), insertions, deletions };
}

async function getChangesData(
  targetBranch?: string
): Promise<ChangesData | undefined> {
  return new Promise((resolve, reject) => {
    if (!targetBranch) resolve(undefined);

    let changesData: ChangesData = {
      insertions: "0",
      deletions: "0",
      changesSum: "0",
    };

    const diffHEAD = spawn("git", ["diff", targetBranch, "--shortstat"], {
      cwd: vscode.workspace.workspaceFolders![0].uri.path,
    });

    diffHEAD.stdout.on("data", (data: Buffer) => {
      changesData = parseChangesQuantity(data);
    });

    diffHEAD.stderr.on("data", (data: any) => {
      console.error(data.toString());
      reject("Error");
    });

    diffHEAD.on("close", (code: any) => {
      resolve(changesData);
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

      const removeRemoteBranchArrow = new RegExp("( -> ).*");
      /*
        "remotes/origin/HEAD -> origin/main" becomes
        "remotes/origin/HEAD"
      */
      avaliableBranches = validBranches.map((branch) => {
        return branch.trim().replace(removeRemoteBranchArrow, "");
      });
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
      targetBranchQuickPick.placeholder =
        "Choose a target branch to be compared";
      const avaliableBranches = await getAvaliableBranches();
      const quickPickItems = avaliableBranches.map((branch) => {
        return { label: branch };
      });

      const firstRemoteBranchIndex = avaliableBranches.findIndex((branch) =>
        branch.includes("remotes")
      );
      if (firstRemoteBranchIndex) {
        const remoteBranchesSeparator: vscode.QuickPickItem = {
          label: "Remotes",
          kind: vscode.QuickPickItemKind.Separator,
        };
        quickPickItems.splice(
          firstRemoteBranchIndex,
          0,
          remoteBranchesSeparator
        );
      }

      targetBranchQuickPick.items = quickPickItems;

      targetBranchQuickPick.onDidChangeSelection((selection) => {
        eventEmitter.emit("updateTargetBranch", selection[0].label);
        targetBranchQuickPick.dispose();
      });

      targetBranchQuickPick.show();
    }
  );
}

function getTooltipString(
  changesData?: ChangesData,
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

  if (changesData) {
    markdownTooltip.appendMarkdown(
      `$(plus) <strong>Insertions: </strong> <span style="color:#3fb950;">${changesData.insertions} </span> <br>`
    );
    markdownTooltip.appendMarkdown(
      `$(remove) <strong>Deletions: </strong> <span style="color:#f85149;">${changesData.deletions}</span><br>`
    );
    markdownTooltip.appendMarkdown(
      `$(chrome-maximize) <strong>Total Changes: </strong> ${changesData.changesSum}<br>`
    );

    markdownTooltip.appendMarkdown("<hr>");
    markdownTooltip.appendMarkdown("<br>");
  }

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

  const changesData = await getChangesData(targetBranch);

  verifyNotificationLockValidity(changesData?.changesSum, quantityThreshold);
  if (shouldSendNotification(changesData?.changesSum, quantityThreshold)) {
    vscode.window.showWarningMessage(
      "You have passed the changes quantity threshold."
    );
    isUserNotified = true;
  }
  refreshStatusBarCounter(
    statusBarItem,
    changesData?.changesSum,
    quantityThreshold
  );
  refreshStatusBarTooltip(
    statusBarItem,
    targetBranch,
    quantityThreshold,
    changesData
  );
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
  quantityThreshold?: string,
  changesData?: ChangesData
): void {
  const newTooltipString = getTooltipString(
    changesData,
    targetBranch,
    quantityThreshold
  );
  statusBarItem.tooltip = newTooltipString;
}

function shouldSendNotification(
  changesCount?: string,
  changesThreshold?: string
) {
  const config = vscode.workspace.getConfiguration("changedLinesCount");
  const shouldDisableNotifications = config.get<boolean>(
    "disableNotifications"
  );

  if (shouldDisableNotifications !== undefined && shouldDisableNotifications)
    return false;
  if (!hasPassedThreshold(changesCount, changesThreshold)) return false;
  if (isUserNotified) return false;

  return true;
}

function hasPassedThreshold(
  changesCount?: string,
  changesThreshold?: string
): boolean {
  return (
    changesThreshold !== undefined &&
    changesCount !== undefined &&
    +changesCount > +changesThreshold
  );
}

function verifyNotificationLockValidity(
  changesCount?: string,
  changesThreshold?: string
): void {
  if (!hasPassedThreshold(changesCount, changesThreshold))
    if (isUserNotified) isUserNotified = false;
}

export function deactivate() {}
