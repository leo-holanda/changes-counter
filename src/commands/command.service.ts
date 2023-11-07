import * as vscode from "vscode";
import { GitService } from "../git/git.service";
import { LogTypes } from "../logger/logger.enums";
import { Logger } from "../logger/logger";
import { StatusBarItem } from "../status-bar-item/status-bar-item";

export class CommandService {
  private context: vscode.ExtensionContext;
  private gitService: GitService;
  private logger: Logger;
  private statusBarItem: StatusBarItem;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.gitService = new GitService(context);
    this.logger = Logger.getInstance();
    this.statusBarItem = StatusBarItem.getInstance(context);
  }

  setUpCommands(): void {
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

      comparisonBranchQuickPick.onDidChangeSelection(async (selection) => {
        comparisonBranchQuickPick.dispose();
        this.context.workspaceState.update("comparisonBranch", selection[0].label);
        await this.statusBarItem.updateStatusBarItemData();
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
        await this.statusBarItem.updateStatusBarItemData();
      }
    );
  }
}
