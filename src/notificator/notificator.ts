import * as vscode from "vscode";

export class Notificator {
  isUserNotified = false;
  hasLoggedIgnoreFileFirstCheck = false;

  constructor() {}

  notify(): void {
    vscode.window.showWarningMessage("You have passed the changes quantity threshold.");
    this.isUserNotified = true;
  }

  hasPassedThreshold(changesCount?: string, changesQuantityThreshold?: string): boolean {
    return (
      changesQuantityThreshold !== undefined &&
      changesCount !== undefined &&
      +changesCount > +changesQuantityThreshold
    );
  }

  shouldSendNotification(changesCount?: string, changesQuantityThreshold?: string) {
    const config = vscode.workspace.getConfiguration("changesCounter");
    const shouldDisableNotifications = config.get<boolean>("disableNotifications");

    if (shouldDisableNotifications !== undefined && shouldDisableNotifications) return false;
    if (!this.hasPassedThreshold(changesCount, changesQuantityThreshold)) return false;
    if (this.isUserNotified) return false;

    return true;
  }

  verifyNotificationLockValidity(changesCount?: string, changesQuantityThreshold?: string): void {
    if (!this.hasPassedThreshold(changesCount, changesQuantityThreshold))
      if (this.isUserNotified) this.isUserNotified = false;
  }
}
