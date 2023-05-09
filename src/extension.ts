const { spawn } = require("child_process");
import { EventEmitter } from "node:events";
import * as vscode from "vscode";

const eventEmitter = new EventEmitter();
let isUserNotified = false;
const outputChannel = vscode.window.createOutputChannel("Changes Counter");

interface ChangesData {
  insertions: string;
  deletions: string;
  changesCount: string;
}

export async function activate(context: vscode.ExtensionContext) {
  if (!(await isGitInitialized())) {
    vscode.commands.executeCommand(
      "setContext",
      "changesCounter.isGitInitialized",
      false
    );
    return;
  }

  outputChannel.appendLine("The extension started successfully.");

  vscode.commands.executeCommand(
    "setContext",
    "changesCounter.isGitInitialized",
    true
  );

  const changesQuantityBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    10
  );
  context.subscriptions.push(changesQuantityBarItem);
  await refreshStatusBarItem(context, changesQuantityBarItem);
  changesQuantityBarItem.show();

  context.subscriptions.push(createSetComparisonBranchCommand());
  context.subscriptions.push(createSetQuantityThresholdCommand());

  setUpEventListeners(context, changesQuantityBarItem);
}

function hasFoldersInWorkspace(): boolean {
  return vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders.length > 0
    : false;
}

async function isGitInitialized(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!hasFoldersInWorkspace()) {
      outputChannel.appendLine(
        "The extension couldn't find a folder in your workspace. Open a folder that has git initialized for the extension to work."
      );
      resolve(false);
      return;
    }

    let isGitInitialized: boolean;

    const gitCheck = spawn("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: vscode.workspace.workspaceFolders![0].uri.path,
    });

    gitCheck.stdout.on("data", (data: Buffer) => {
      isGitInitialized = data.toString().includes("true");
    });

    gitCheck.stderr.on("data", (data: Buffer) => {
      outputChannel.appendLine("Error when checking if git is initialized.");
      outputChannel.appendLine("Error message: " + data.toString());
      reject(false);
    });

    gitCheck.on("close", () => {
      if (!isGitInitialized) {
        outputChannel.appendLine(
          "The extension didn't find a git repository in the folder you opened. Open a folder that has git initialized for the extension to work."
        );
      }
      resolve(isGitInitialized);
    });
  });
}

function parseDiffOutput(diffOutput: Buffer): ChangesData {
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

async function getChangesData(
  comparisonBranch?: string
): Promise<ChangesData | undefined> {
  return new Promise((resolve, reject) => {
    if (comparisonBranch === undefined) {
      resolve(undefined);
      return;
    }

    let changesData: ChangesData = {
      insertions: "0",
      deletions: "0",
      changesCount: "0",
    };

    const diffHEAD = spawn("git", ["diff", comparisonBranch, "--shortstat"], {
      cwd: vscode.workspace.workspaceFolders![0].uri.path,
    });

    diffHEAD.stdout.on("data", (data: Buffer) => {
      changesData = parseDiffOutput(data);
    });

    diffHEAD.stderr.on("data", (data: Buffer) => {
      outputChannel.appendLine("Error when running git diff.");
      outputChannel.appendLine("Error message: " + data.toString());
      reject("Error");
    });

    diffHEAD.on("close", () => {
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

    getAllBranches.stderr.on("data", (data: Buffer) => {
      outputChannel.appendLine(
        "Error when getting avaliable branches to compare."
      );
      outputChannel.appendLine("Error message: " + data.toString());
      reject([]);
    });

    getAllBranches.on("close", () => {
      resolve(avaliableBranches);
    });
  });
}

function createSetComparisonBranchCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "changes-counter.setComparisonBranch",
    async () => {
      const comparisonBranchQuickPick = vscode.window.createQuickPick();
      comparisonBranchQuickPick.placeholder = "Choose a branch to be compared";
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

      comparisonBranchQuickPick.items = quickPickItems;

      comparisonBranchQuickPick.onDidChangeSelection((selection) => {
        eventEmitter.emit("updateComparisonBranch", selection[0].label);
        comparisonBranchQuickPick.dispose();
      });

      comparisonBranchQuickPick.show();
    }
  );
}

function getTooltipString(
  changesData?: ChangesData,
  comparisonBranch?: string,
  changesQuantityThreshold?: string
): vscode.MarkdownString {
  const setComparisonBranchCommandURI = vscode.Uri.parse(
    `command:changes-counter.setComparisonBranch`
  );
  const setChangesQuantityThresholdCommandURI = vscode.Uri.parse(
    `command:changes-counter.setChangesQuantityThreshold`
  );
  const markdownTooltip = new vscode.MarkdownString();

  if (changesData) {
    markdownTooltip.appendMarkdown(
      `$(plus) <strong>Insertions: </strong> <span style="color:#3fb950;">${changesData.insertions}</span> <br>`
    );
    markdownTooltip.appendMarkdown(
      `$(remove) <strong>Deletions: </strong> <span style="color:#f85149;">${changesData.deletions}</span> <br>`
    );
    markdownTooltip.appendMarkdown(
      `$(chrome-maximize) <strong>Total Changes: </strong> ${changesData.changesCount}<br>`
    );

    markdownTooltip.appendMarkdown("<hr>");
    markdownTooltip.appendMarkdown("<br>");
  }

  if (comparisonBranch) {
    markdownTooltip.appendMarkdown(
      `$(git-branch) <strong>Current Comparison Branch</strong> <br> ${comparisonBranch}`
    );
  } else {
    markdownTooltip.appendMarkdown(
      `$(git-branch) <strong>Current Comparison Branch</strong> <br> Undefined`
    );
  }

  markdownTooltip.appendMarkdown("<br>");

  if (changesQuantityThreshold) {
    markdownTooltip.appendMarkdown(
      `$(arrow-both) <strong>Changes Quantity Threshold</strong> <br> ${changesQuantityThreshold} changes`
    );
  } else {
    markdownTooltip.appendMarkdown(
      `$(arrow-both) <strong>Changes Quantity Threshold</strong> <br> Undefined`
    );
  }

  markdownTooltip.appendMarkdown("<br>");

  if (!comparisonBranch) {
    markdownTooltip.appendMarkdown("<br>");
    markdownTooltip.appendMarkdown(`$(alert) Set the comparison branch.`);
  }

  if (!changesQuantityThreshold) {
    markdownTooltip.appendMarkdown("<br>");
    markdownTooltip.appendMarkdown(
      `$(alert) Set the changes quantity threshold.`
    );
  }

  markdownTooltip.appendMarkdown(
    `<hr><br> $(edit) [${
      comparisonBranch ? "Change" : "Set"
    } Comparison Branch](${setComparisonBranchCommandURI}) <br>`
  );

  markdownTooltip.appendMarkdown(
    `$(edit) [${
      changesQuantityThreshold ? "Change" : "Set"
    } Changes Quantity Threshold](${setChangesQuantityThresholdCommandURI})`
  );

  markdownTooltip.isTrusted = true;
  markdownTooltip.supportThemeIcons = true;
  markdownTooltip.supportHtml = true;

  return markdownTooltip;
}

function createSetQuantityThresholdCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    "changes-counter.setChangesQuantityThreshold",
    async () => {
      const changesQuantityThreshold = await vscode.window.showInputBox({
        title: "Insert the changes quantity threshold",
        prompt: "Only positive numbers are allowed.",
        validateInput: (value) => {
          if (+value && +value > 0) return null;
          else return "Please, insert a positive number.";
        },
      });

      eventEmitter.emit(
        "updateChangesQuantityThreshold",
        changesQuantityThreshold
      );
    }
  );
}

async function refreshStatusBarItem(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): Promise<void> {
  const comparisonBranch =
    context.workspaceState.get<string>("comparisonBranch");
  const changesQuantityThreshold = context.workspaceState.get<string>(
    "changesQuantityThreshold"
  );

  const changesData = await getChangesData(comparisonBranch);

  verifyNotificationLockValidity(
    changesData?.changesCount,
    changesQuantityThreshold
  );
  if (
    shouldSendNotification(changesData?.changesCount, changesQuantityThreshold)
  ) {
    vscode.window.showWarningMessage(
      "You have passed the changes quantity threshold."
    );
    isUserNotified = true;
  }
  refreshStatusBarCounter(
    statusBarItem,
    changesData?.changesCount,
    changesQuantityThreshold
  );
  refreshStatusBarTooltip(
    statusBarItem,
    comparisonBranch,
    changesQuantityThreshold,
    changesData
  );
}

function refreshStatusBarCounter(
  statusBarItem: vscode.StatusBarItem,
  newChangesCount?: string,
  changesQuantityThreshold?: string
): void {
  statusBarItem.text = "Changes: " + (newChangesCount || "?");

  const config = vscode.workspace.getConfiguration("changesCounter");
  const shouldDisableColorChange = config.get<boolean>(
    "disableStatusBarIconColorChange"
  );

  if (
    !shouldDisableColorChange &&
    hasPassedThreshold(newChangesCount, changesQuantityThreshold)
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
  comparisonBranch?: string,
  changesQuantityThreshold?: string,
  changesData?: ChangesData
): void {
  const newTooltipString = getTooltipString(
    changesData,
    comparisonBranch,
    changesQuantityThreshold
  );
  statusBarItem.tooltip = newTooltipString;
}

function shouldSendNotification(
  changesCount?: string,
  changesQuantityThreshold?: string
) {
  const config = vscode.workspace.getConfiguration("changesCounter");
  const shouldDisableNotifications = config.get<boolean>(
    "disableNotifications"
  );

  if (shouldDisableNotifications !== undefined && shouldDisableNotifications)
    return false;
  if (!hasPassedThreshold(changesCount, changesQuantityThreshold)) return false;
  if (isUserNotified) return false;

  return true;
}

function hasPassedThreshold(
  changesCount?: string,
  changesQuantityThreshold?: string
): boolean {
  return (
    changesQuantityThreshold !== undefined &&
    changesCount !== undefined &&
    +changesCount > +changesQuantityThreshold
  );
}

function verifyNotificationLockValidity(
  changesCount?: string,
  changesQuantityThreshold?: string
): void {
  if (!hasPassedThreshold(changesCount, changesQuantityThreshold))
    if (isUserNotified) isUserNotified = false;
}

function setUpEventListeners(
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): void {
  eventEmitter.on("updateComparisonBranch", async (newComparisonBranch) => {
    context.workspaceState.update("comparisonBranch", newComparisonBranch);
    await refreshStatusBarItem(context, statusBarItem);
  });

  eventEmitter.on(
    "updateChangesQuantityThreshold",
    async (newQuantityThreshold) => {
      context.workspaceState.update(
        "changesQuantityThreshold",
        newQuantityThreshold
      );
      await refreshStatusBarItem(context, statusBarItem);
    }
  );

  vscode.workspace.onDidChangeConfiguration(async (config) => {
    if (config.affectsConfiguration("changesCounter"))
      await refreshStatusBarItem(context, statusBarItem);
  });

  vscode.workspace.onDidSaveTextDocument(async () => {
    await refreshStatusBarItem(context, statusBarItem);
  });
}

export function deactivate() {}

/*

Fugiat pariatur esse commodo incididunt dolore ad tempor Lorem aliquip. Cupidatat in officia tempor fugiat cupidatat enim mollit dolore nisi dolor dolor. Quis aliquip ad ut minim nostrud laborum officia quis ad ullamco deserunt aute. Nisi eiusmod ut esse consectetur excepteur anim fugiat eu duis aute pariatur.

Labore eu occaecat culpa sunt reprehenderit commodo do do elit tempor sit. Ullamco sit irure laborum sint fugiat amet culpa labore veniam labore aute nisi. Ut Lorem tempor incididunt eiusmod sit irure. Duis tempor fugiat ut non esse adipisicing exercitation quis. Fugiat amet qui dolore id adipisicing dolore culpa laboris aliquip nisi aliquip sunt et labore. Esse adipisicing id laborum do Lorem qui ad id.

Anim sint est elit velit id fugiat sit sit magna quis nulla deserunt. Ea do elit cupidatat qui nulla laboris amet id eiusmod elit eu quis tempor. Dolore ipsum eiusmod velit adipisicing laborum mollit anim dolore amet aliqua labore id. Consequat non magna velit ullamco cillum sint. Incididunt tempor adipisicing nisi et amet veniam do consequat aliquip id. Cupidatat do laboris cillum anim nostrud.

Nostrud ipsum adipisicing non sit enim duis nisi. Nostrud ad laborum nisi culpa est labore cillum laboris do. Minim nisi veniam reprehenderit adipisicing irure nostrud exercitation sunt velit laboris nisi duis. Occaecat occaecat proident qui in eiusmod deserunt labore officia sunt. Culpa nostrud occaecat aliqua aliqua id aute tempor ad et. Esse ut eiusmod anim esse. Ex cillum in veniam ea irure anim consectetur sunt quis esse.

Et laboris exercitation voluptate tempor sint eu tempor ad cupidatat ad ullamco anim id. Duis sit id eiusmod officia reprehenderit culpa nulla laborum fugiat nisi eiusmod. Laboris nostrud occaecat in aliqua ipsum esse velit nostrud. Eu in non culpa sint ex cupidatat nulla et consectetur elit veniam mollit est reprehenderit.

*/
