import { GitService } from "../git/git.service";
import { Logger } from "../logger/logger";
import { LogTypes } from "../logger/logger.enums";
import * as vscode from "vscode";

export class InitializationService {
  logger: Logger;
  gitService: GitService;

  constructor(context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance();
    this.gitService = GitService.getInstance(context);
  }

  async hasMetStartConditions(): Promise<boolean> {
    this.logBootstrapMessages();

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

  private logBootstrapMessages(): void {
    this.logger.log(
      "If you have encountered a bug, please report this log as an issue here: https://github.com/leo-holanda/changes-counter/issues.",
      LogTypes.INFO
    );
    this.logger.log("The extension is bootstrapping...", LogTypes.INFO);
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

    if (!isGitInitialized)
      vscode.commands.executeCommand("setContext", "changesCounter.isGitInitialized", false);

    vscode.commands.executeCommand("setContext", "changesCounter.isGitInitialized", true);

    return isGitInitialized;
  }
}
