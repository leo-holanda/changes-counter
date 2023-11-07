import * as vscode from "vscode";
import { StatusBarItem } from "../status-bar-item/status-bar-item";
import { Logger } from "../logger/logger";
import { LogTypes } from "../logger/logger.enums";
import { GitService } from "../git/git.service";

export class EventService {
  private logger: Logger;
  private statusBarItem: StatusBarItem;
  private gitService: GitService;

  private readonly IGNORE_FILE_NAME = ".ccignore";

  constructor(context: vscode.ExtensionContext) {
    this.statusBarItem = StatusBarItem.getInstance(context);
    this.logger = Logger.getInstance();
    this.gitService = new GitService(context);
  }

  setUpEventListeners(): void {
    vscode.workspace.onDidChangeConfiguration(async (config) => {
      if (config.affectsConfiguration("changesCounter"))
        this.statusBarItem.updateStatusBarItemData();
    });

    vscode.workspace.onDidSaveTextDocument(async (document) => {
      /*
        onDidSaveTextDocument event is emitted before watcher's onDidChange.
        Thus, updating the status item with older values. This condition is
        necessary to update status item with values only after exclusion
        parameters are updated and to avoid recalling the refresh function.
      */
      if (document.fileName.includes(this.IGNORE_FILE_NAME)) return;
      await this.statusBarItem.updateStatusBarItemData();
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
      await this.statusBarItem.updateStatusBarItemData();
    });

    watcher.onDidChange(async () => {
      this.logger.log(
        "The ignore file was changed. Files and patterns to be ignore will be updated.",
        LogTypes.INFO
      );
      await this.gitService.updateDiffExclusionParameters();
      await this.statusBarItem.updateStatusBarItemData();
    });

    watcher.onDidDelete(async () => {
      this.logger.log(
        "The ignore file was deleted. There will be no files and patterns being ignored when counting changes.",
        LogTypes.INFO
      );
      await this.gitService.clearDiffExclusionParameters();
      await this.statusBarItem.updateStatusBarItemData();
    });
  }
}
