import { GitService } from "../git/git.service";
import * as vscode from "vscode";
import { Logger } from "../logger/logger";
import { LogTypes } from "../logger/logger.enums";

export class SettingsService {
  private gitService: GitService;
  private context: vscode.ExtensionContext;
  private logger: Logger;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.gitService = GitService.getInstance(context);
    this.logger = Logger.getInstance();
  }

  init(): void {
    if (!this.isComparisonBranchDefined()) this.setDefaultComparisonBranch();
    if (!this.isChangesThresholdDefined()) this.setDefaultChangesThreshold();
  }

  private isComparisonBranchDefined(): boolean {
    const comparisonBranch = this.context.workspaceState.get<string>("comparisonBranch");
    return comparisonBranch !== undefined;
  }

  private isChangesThresholdDefined(): boolean {
    const changesQuantityThreshold = this.context.workspaceState.get<string>(
      "changesQuantityThreshold"
    );
    return changesQuantityThreshold !== undefined;
  }

  private async setDefaultComparisonBranch(): Promise<void> {
    try {
      const currentBranch = await this.gitService.getCurrentBranch();
      this.context.workspaceState.update("comparisonBranch", currentBranch);
    } catch (error) {
      this.logger.log(
        "An error ocurred while trying to set your default comparison branch.",
        LogTypes.ERROR
      );
      this.logger.log("Error message: " + error, LogTypes.ERROR);
    }
  }

  private setDefaultChangesThreshold(): void {
    this.context.workspaceState.update("changesQuantityThreshold", "400");
  }
}
