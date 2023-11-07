import { GitService } from "../git/git.service";
import * as vscode from "vscode";
import { ChangesData } from "./changes.interfaces";
import { DiffData } from "../git/git.service.interfaces";
import { Logger } from "../logger/logger";
import { LogTypes } from "../logger/logger.enums";
import { NotificationService } from "../notification/notification.service";

export class ChangesService {
  private gitService: GitService;
  private context: vscode.ExtensionContext;
  private logger: Logger;
  private notificationService: NotificationService;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.gitService = new GitService(context);
    this.logger = Logger.getInstance();
    this.notificationService = new NotificationService();
  }

  async getChangesData(): Promise<ChangesData | undefined> {
    try {
      const diffData = await this.gitService.getDiffData();

      const changesData: ChangesData = {
        insertions: diffData.insertions,
        deletions: diffData.deletions,
        total: this.getTotalChanges(diffData),
        hasExceededThreshold: this.hasThresholdBeenExceeded(diffData),
      };

      this.notificationService.notifyIfAppropriate(changesData);

      return changesData;
    } catch (error) {
      this.logger.log(
        "An error was ocurred while the extension was getting your changes data.",
        LogTypes.ERROR
      );
      this.logger.log(("Error message: " + error) as string, LogTypes.ERROR);
      return undefined;
    }
  }

  private getTotalChanges(diffData: DiffData): string {
    return (+diffData.insertions + +diffData.deletions).toString();
  }

  private hasThresholdBeenExceeded(diffData: DiffData): boolean {
    const changesQuantityThreshold = this.context.workspaceState.get<string>(
      "changesQuantityThreshold"
    );
    if (changesQuantityThreshold === undefined) return false;

    const totalChanges = this.getTotalChanges(diffData);
    return +totalChanges >= +changesQuantityThreshold;
  }
}
