import { BarItem } from "../BarItem/BarItem";
import { GitOperator } from "../gitOperator/gitOperator";
import { Logger } from "../logger/logger";
import { LogTypes } from "../logger/logger.enums";
import { Notificator } from "../notificator/notificator";
import * as vscode from "vscode";

export class Extension {
  gitOperator: GitOperator;
  notificator: Notificator;
  barItem: BarItem;
  logger: Logger;
  context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance();
    this.context = context;
    this.gitOperator = new GitOperator(context);
    this.notificator = new Notificator();
    this.barItem = new BarItem(context);
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
      isGitInitialized = await this.gitOperator.checkGitInitialization();
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

  private start(): void {
    this.logger.log("Extension start will proceed.", LogTypes.INFO);
    this.addCommands();
    this.startBarItem();
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
        avaliableBranches = await this.gitOperator.getAvailableBranches();
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
        //TODO Stop using event emitters
        comparisonBranchQuickPick.dispose();
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

        //TODO Stop using event emitters
      }
    );
  }

  private async startBarItem(): Promise<void> {
    this.barItem.start();

    try {
      const changesData = await this.gitOperator.getChangesData();
      this.barItem.updateItemData(changesData);
    } catch (error) {
      this.logger.log(
        "An error was ocurred while the extension was getting your changes data.",
        LogTypes.ERROR
      );
      this.logger.log(error as string, LogTypes.ERROR);
    }
  }
}
