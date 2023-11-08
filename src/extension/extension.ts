import { StatusBarItem } from "../status-bar-item/status-bar-item";
import { GitService } from "../git/git.service";
import { Logger } from "../logger/logger";
import { LogTypes } from "../logger/logger.enums";
import * as vscode from "vscode";
import { InitializationService } from "../initialization/initialization.service";
import { CommandService } from "../commands/command.service";
import { EventService } from "../event/event.service";
import { SettingsService } from "../settings/settings.service";

export class Extension {
  context: vscode.ExtensionContext;

  logger: Logger;
  statusBarItem: StatusBarItem;

  initializationService: InitializationService;
  gitService: GitService;
  commandService: CommandService;
  eventService: EventService;
  settingsService: SettingsService;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    this.logger = Logger.getInstance();
    this.statusBarItem = StatusBarItem.getInstance(context);

    this.initializationService = new InitializationService(context);
    this.gitService = GitService.getInstance(context);
    this.commandService = new CommandService(context);
    this.eventService = new EventService(context);
    this.settingsService = new SettingsService(context);
  }

  async bootstrap(): Promise<void> {
    const canStart = await this.initializationService.hasMetStartConditions();
    if (canStart) this.start();
  }

  private async start(): Promise<void> {
    this.logger.log("Extension start will proceed.", LogTypes.INFO);
    this.settingsService.init();
    this.commandService.setUpCommands();
    await this.gitService.updateDiffExclusionParameters();
    await this.statusBarItem.init();
    this.eventService.setUpEventListeners();
  }
}
