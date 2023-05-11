import { spawn } from "child_process";
import { EventEmitter } from "node:events";
import * as vscode from "vscode";

interface ChangesData {
  insertions: string;
  deletions: string;
  changesCount: string;
}

enum LogTypes {
  INFO = "info",
  ERROR = "error",
  FATAL = "fatal",
}

const eventEmitter = new EventEmitter();
let isUserNotified = false;
const outputChannel = vscode.window.createOutputChannel("Changes Counter");
let filesToIgnore: string[] = [];

export async function activate(context: vscode.ExtensionContext) {
  let hasExtensionStarted = await startExtension();
  if (!hasExtensionStarted) return;

  filesToIgnore.push(...(await getFilesToIgnore()));

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

async function startExtension(): Promise<boolean> {
  sendMessageToOutputChannel(
    "If you have encountered a bug, please report this log as an issue here: https://github.com/leo-holanda/changes-counter/issues.",
    LogTypes.INFO
  );
  sendMessageToOutputChannel("The extension is starting...", LogTypes.INFO);

  let isGitInitialized;
  try {
    isGitInitialized = await checkGitInitialization();
  } catch (error) {
    isGitInitialized = false;
    sendMessageToOutputChannel(
      "Error when checking if git is initialized.",
      LogTypes.FATAL
    );
    sendMessageToOutputChannel(
      ("Error message: " + error) as string,
      LogTypes.FATAL
    );
  }

  if (!isGitInitialized) {
    sendMessageToOutputChannel(
      "Open a folder that has git initialized for the extension to work.",
      LogTypes.INFO
    );
    vscode.commands.executeCommand(
      "setContext",
      "changesCounter.isGitInitialized",
      false
    );

    return false;
  }

  vscode.commands.executeCommand(
    "setContext",
    "changesCounter.isGitInitialized",
    true
  );

  return true;
}

function hasFoldersInWorkspace(): boolean {
  return vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders.length > 0
    : false;
}

async function checkGitInitialization(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!hasFoldersInWorkspace()) {
      reject("The extension couldn't find a folder in your workspace.");
      return;
    }

    let isGitInitialized: boolean;

    const gitChildProcess = spawn(
      "git",
      ["rev-parse", "--is-inside-work-tree"],
      {
        cwd: vscode.workspace.workspaceFolders![0].uri.fsPath,
      }
    );

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
      reject(
        "A comparison branch wasn't defined. Please, define a comparison branch."
      );
      return;
    }

    let changesData: ChangesData = {
      insertions: "0",
      deletions: "0",
      changesCount: "0",
    };

    const gitChildProcess = spawn(
      "git",
      ["diff", comparisonBranch, "--shortstat"],
      {
        cwd: vscode.workspace.workspaceFolders![0].uri.fsPath,
      }
    );

    gitChildProcess.on("error", (err) => reject(err));

    gitChildProcess.stdout.on("data", (data: Buffer) => {
      changesData = parseDiffOutput(data);
    });

    gitChildProcess.stderr.on("data", (data: Buffer) => {
      reject(data.toString());
    });

    gitChildProcess.on("close", () => {
      resolve(changesData);
    });
  });
}

async function getAvailableBranches(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let avaliableBranches: string[];

    const gitChildProcess = spawn("git", ["branch", "-a"], {
      cwd: vscode.workspace.workspaceFolders![0].uri.fsPath,
    });

    gitChildProcess.on("error", (err) => reject(err));

    gitChildProcess.stdout.on("data", (data: Buffer) => {
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

    gitChildProcess.stderr.on("data", (data: Buffer) => {
      reject(data.toString());
    });

    gitChildProcess.on("close", () => {
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

      let avaliableBranches: string[];
      try {
        avaliableBranches = await getAvailableBranches();
      } catch (error) {
        avaliableBranches = [];
        sendMessageToOutputChannel(
          "Error when getting the available branches for comparison.",
          LogTypes.ERROR
        );
        sendMessageToOutputChannel(
          ("Error message: " + error) as string,
          LogTypes.ERROR
        );
      }

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

  let changesData;
  try {
    changesData = await getChangesData(comparisonBranch);
  } catch (error) {
    sendMessageToOutputChannel(
      "Error when counting the changes between your working tree and the comparison branch.",
      LogTypes.ERROR
    );
    sendMessageToOutputChannel(
      ("Error message: " + error) as string,
      LogTypes.ERROR
    );
  }

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

function sendMessageToOutputChannel(message: string, type: LogTypes): void {
  const now = new Date().toISOString().split("T");
  const date = now[0];
  const time = now[1].slice(0, -1);
  outputChannel.appendLine(
    date + " " + time + " " + "[" + type + "] " + message
  );
}

async function getFilesToIgnore(): Promise<string[]> {
  const matchedFiles = await vscode.workspace.findFiles(".cgignore");
  if (matchedFiles.length > 0) {
    const cgIgnoreFileContent = await vscode.workspace.fs.readFile(
      matchedFiles[0]
    );

    return cgIgnoreFileContent.toString().split("\n");
  }

  return [];
}

export function deactivate() {}
