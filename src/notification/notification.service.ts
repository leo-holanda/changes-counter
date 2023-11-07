import * as vscode from "vscode";
import { ChangesData } from "../gitOperator/gitOperator.interfaces";

export class NotificationService {
  isUserNotified = false;
  hasLoggedIgnoreFileFirstCheck = false;
  context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  notify(): void {
    vscode.window.showWarningMessage("You have passed the changes quantity threshold.");
    this.isUserNotified = true;
  }

  shouldSendNotification(changesData: ChangesData) {
    const config = vscode.workspace.getConfiguration("changesCounter");
    const shouldDisableNotifications = config.get<boolean>("disableNotifications");
    const changesQuantityThreshold = this.context.workspaceState.get<string>(
      "changesQuantityThreshold"
    );

    if (shouldDisableNotifications !== undefined && shouldDisableNotifications) return false;
    if (!this.hasPassedThreshold(changesData.changesCount, changesQuantityThreshold)) return false;
    if (this.isUserNotified) return false;

    return true;
  }

  private hasPassedThreshold(changesCount?: string, changesQuantityThreshold?: string): boolean {
    return (
      changesQuantityThreshold !== undefined &&
      changesCount !== undefined &&
      +changesCount > +changesQuantityThreshold
    );
  }

  verifyNotificationLockValidity(changesCount?: string, changesQuantityThreshold?: string): void {
    if (!this.hasPassedThreshold(changesCount, changesQuantityThreshold))
      if (this.isUserNotified) this.isUserNotified = false;
  }
}
