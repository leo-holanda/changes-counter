import * as vscode from "vscode";
import { ChangesData } from "../changes/changes.interfaces";

export class NotificationService {
  private isUserNotified = false;
  private hasLoggedIgnoreFileFirstCheck = false;

  constructor() {}

  notifyIfAppropriate(changesData: ChangesData): void {
    this.updateNotificationLock(changesData);

    if (this.shouldNotify(changesData)) {
      vscode.window.showWarningMessage("You have exceeded the changes quantity threshold.");
      this.isUserNotified = true;
    }
  }

  shouldNotify(changesData: ChangesData) {
    if (!changesData.hasExceededThreshold) return false;

    const config = vscode.workspace.getConfiguration("changesCounter");
    const shouldDisableNotifications = config.get<boolean>("disableNotifications");
    if (shouldDisableNotifications !== undefined && shouldDisableNotifications) return false;

    if (this.isUserNotified) return false;

    return true;
  }

  /*
    The notification lock prevents the notification spam.
    If the user was already notified, he will only be notified again if
    he isn't above the threshold
  */
  private updateNotificationLock(changesData: ChangesData): void {
    if (!changesData.hasExceededThreshold && this.isUserNotified) this.isUserNotified = false;
  }
}
