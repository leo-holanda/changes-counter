import { StatusBarItem } from "../status-bar-item/status-bar-item";
import { GitService } from "../git/git.service";
import { Logger } from "../logger/logger";
import { LogTypes } from "../logger/logger.enums";
import * as vscode from "vscode";

export class Extension {
  gitService: GitService;
  statusBarItem: StatusBarItem;
  logger: Logger;
  context: vscode.ExtensionContext;

  readonly IGNORE_FILE_NAME = ".ccignore";

  constructor(context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance();
    this.context = context;
    this.gitService = new GitService(context);
    this.statusBarItem = new StatusBarItem(context);
    this.logger.log("Extension was constructed.", LogTypes.INFO);
  }

  async bootstrap(): Promise<void> {
    this.logBootstrapMessages();
    const canStart = await this.canStart();
    if (canStart) this.start();
  }

  private logBootstrapMessages(): void {
    this.logger.log(
      "If you have encountered a bug, please report this log as an issue here: https://github.com/leo-holanda/changes-counter/issues.",
      LogTypes.INFO
    );
    this.logger.log("The extension is bootstrapping...", LogTypes.INFO);
  }

  private async canStart(): Promise<boolean> {
    const hasFolderInWorkspace = this.hasFolderInWorkspace();
    if (!hasFolderInWorkspace) {
      this.logger.log("There ain't no folder opened in your workspace.", LogTypes.ERROR);
      this.logger.log(
        "Open a folder that is a Git repository for the the extension to work.",
        LogTypes.ERROR
      );

      return false;
    }

    this.logger.log("There is a folder open in your workspace.", LogTypes.INFO);

    const isFolderInsideGitRepository = await this.isFolderInsideGitRepository();
    if (!isFolderInsideGitRepository) {
      this.logger.log("The folder you opened is not a Git repository.", LogTypes.ERROR);
      this.logger.log(
        "Open a folder that is a Git repository for the the extension to work.",
        LogTypes.ERROR
      );

      return false;
    }

    this.logger.log("The folder you opened is a Git repository.", LogTypes.INFO);

    return true;
  }

  private hasFolderInWorkspace(): boolean {
    return (
      vscode.workspace.workspaceFolders !== undefined &&
      vscode.workspace.workspaceFolders.length > 0
    );
  }

  private async isFolderInsideGitRepository(): Promise<boolean> {
    let isGitInitialized;
    try {
      isGitInitialized = await this.gitService.checkGitInitialization();
    } catch (error) {
      isGitInitialized = false;
      this.logger.log("Error when checking if git is initialized.", LogTypes.FATAL);
      this.logger.log(("Error message: " + error) as string, LogTypes.FATAL);
    }

    if (!isGitInitialized) {
      this.logger.log(
        "Open a folder that has git initialized for the extension to work.",
        LogTypes.INFO
      );
      vscode.commands.executeCommand("setContext", "changesCounter.isGitInitialized", false);
    }

    vscode.commands.executeCommand("setContext", "changesCounter.isGitInitialized", true);

    return isGitInitialized;
  }

  private async start(): Promise<void> {
    this.logger.log("Extension start will proceed.", LogTypes.INFO);
    this.addCommands();
    await this.statusBarItem.init();
    this.setUpEventListeners();
  }

  private addCommands(): void {
    this.context.subscriptions.push(this.createSetComparisonBranchCommand());
    this.context.subscriptions.push(this.createSetQuantityThresholdCommand());
  }

  private createSetComparisonBranchCommand(): vscode.Disposable {
    return vscode.commands.registerCommand("changes-counter.setComparisonBranch", async () => {
      const comparisonBranchQuickPick = vscode.window.createQuickPick();
      comparisonBranchQuickPick.placeholder = "Choose a branch to be compared";

      let avaliableBranches: string[];
      try {
        avaliableBranches = await this.gitService.getAvailableBranches();
      } catch (error) {
        avaliableBranches = [];
        this.logger.log(
          "Error when getting the available branches for comparison.",
          LogTypes.ERROR
        );
        this.logger.log(("Error message: " + error) as string, LogTypes.ERROR);
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
        quickPickItems.splice(firstRemoteBranchIndex, 0, remoteBranchesSeparator);
      }

      comparisonBranchQuickPick.items = quickPickItems;

      comparisonBranchQuickPick.onDidChangeSelection((selection) => {
        comparisonBranchQuickPick.dispose();
        this.context.workspaceState.update("comparisonBranch", selection[0].label);
        this.updateBarItem();
      });

      comparisonBranchQuickPick.show();
    });
  }

  private createSetQuantityThresholdCommand(): vscode.Disposable {
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

        this.context.workspaceState.update("changesQuantityThreshold", changesQuantityThreshold);
        this.updateBarItem();
      }
    );
  }

  private async updateBarItem(): Promise<void> {
    this.statusBarItem.updateStatusBarItemData();
  }

  private setUpEventListeners(): void {
    vscode.workspace.onDidChangeConfiguration(async (config) => {
      if (config.affectsConfiguration("changesCounter")) this.updateBarItem();
    });

    vscode.workspace.onDidSaveTextDocument(async (document) => {
      /*
        onDidSaveTextDocument event is emitted before watcher's onDidChange.
        Thus, updating the status item with older values. This condition is
        necessary to update status item with values only after exclusion
        parameters are updated and to avoid recalling the refresh function.
      */
      if (document.fileName.includes(this.IGNORE_FILE_NAME)) return;
      await this.updateBarItem();
    });

    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], this.IGNORE_FILE_NAME)
    );

    watcher.onDidCreate(async () => {
      this.logger.log(
        "An ignore file was created. Files and patterns defined in it will now be ignored when counting changes.",
        LogTypes.INFO
      );
      await this.gitService.updateDiffExclusionParameters();
      await this.updateBarItem();
    });

    watcher.onDidChange(async () => {
      console.log("onDidChange");
      this.logger.log(
        "The ignore file was changed. Files and patterns to be ignore will be updated.",
        LogTypes.INFO
      );
      await this.gitService.updateDiffExclusionParameters();
      await this.updateBarItem();
    });

    watcher.onDidDelete(async () => {
      this.logger.log(
        "The ignore file was deleted. There will be no files and patterns being ignored when counting changes.",
        LogTypes.INFO
      );
      await this.gitService.clearDiffExclusionParameters();
      await this.updateBarItem();
    });
  }
}
