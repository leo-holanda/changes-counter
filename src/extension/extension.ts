import { StatusBarItem } from "../status-bar-item/status-bar-item";
import { GitService } from "../git/git.service";
import { Logger } from "../logger/logger";
import { LogTypes } from "../logger/logger.enums";
import * as vscode from "vscode";
import { InitializationService } from "../initialization/initialization.service";
import { CommandService } from "../commands/command.service";

export class Extension {
  gitService: GitService;
  statusBarItem: StatusBarItem;
  logger: Logger;
  context: vscode.ExtensionContext;
  initializationService: InitializationService;
  commandService: CommandService;

  readonly IGNORE_FILE_NAME = ".ccignore";

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    this.logger = Logger.getInstance();
    this.statusBarItem = StatusBarItem.getInstance(context);

    this.initializationService = new InitializationService(context);
    this.gitService = new GitService(context);
    this.commandService = new CommandService(context);
  }

  async bootstrap(): Promise<void> {
    const canStart = await this.initializationService.hasMetStartConditions();
    if (canStart) this.start();
  }

  private async start(): Promise<void> {
    this.logger.log("Extension start will proceed.", LogTypes.INFO);
    this.commandService.setUpCommands();
    await this.statusBarItem.init();
    this.setUpEventListeners();
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
