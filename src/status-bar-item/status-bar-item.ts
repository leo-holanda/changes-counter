import * as vscode from "vscode";
import { ChangesService } from "../changes/changes.service";
import { ChangesData } from "../changes/changes.interfaces";

export class StatusBarItem {
  private changesData?: ChangesData;
  private context!: vscode.ExtensionContext;
  private changesService: ChangesService;

  private changesStatusBarItem!: vscode.StatusBarItem;
  private insertionsStatusBarItem!: vscode.StatusBarItem;
  private deletionsStatusBarItem!: vscode.StatusBarItem;

  private static instance: StatusBarItem;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.changesService = new ChangesService(context);
  }

  static getInstance(context: vscode.ExtensionContext): StatusBarItem {
    if (!StatusBarItem.instance) StatusBarItem.instance = new StatusBarItem(context);
    return StatusBarItem.instance;
  }

  async init(): Promise<void> {
    this.changesStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      10
    );

    this.insertionsStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      10
    );

    this.deletionsStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      9
    );

    this.context.subscriptions.push(this.changesStatusBarItem);
    this.context.subscriptions.push(this.insertionsStatusBarItem);
    this.context.subscriptions.push(this.deletionsStatusBarItem);

    this.changesStatusBarItem.show();

    await this.updateStatusBarItemData();
  }

  async updateStatusBarItemData(): Promise<void> {
    const config = vscode.workspace.getConfiguration("changesCounter");
    const shouldShowInsertionsOnStatusBar = config.get<boolean>("showInsertionsOnStatusBar");
    const shouldShowDeletionsOnStatusBar = config.get<boolean>("showDeletionsOnStatusBar");

    if (shouldShowInsertionsOnStatusBar) this.insertionsStatusBarItem.show();
    else this.insertionsStatusBarItem.hide();
    if (shouldShowDeletionsOnStatusBar) this.deletionsStatusBarItem.show();
    else this.deletionsStatusBarItem.hide();

    await this.updateChangesData();
    this.updateText();
    this.updateColor();
    this.updateTooltip();
  }

  private async updateChangesData(): Promise<void> {
    this.changesData = await this.changesService.getChangesData();
  }

  private updateText(): void {
    const isInsertionsHigherThanZero = +(this.changesData?.insertions || 0) > 0;
    const isDeletionsHigherThanZero = +(this.changesData?.deletions || 0) > 0;

    const changesText = `Changes: ${this.changesData?.total || "?"}`;
    const insertionsText = `Ins: ${isInsertionsHigherThanZero ? "+" : ""}${
      this.changesData?.insertions || "?"
    }`;
    const deletionsText = `Del: ${isDeletionsHigherThanZero ? "-" : ""}${
      this.changesData?.deletions || "?"
    }`;

    this.changesStatusBarItem.text = changesText;
    this.insertionsStatusBarItem.text = insertionsText;
    this.deletionsStatusBarItem.text = deletionsText;
  }

  private shouldChangeColor(): boolean {
    const config = vscode.workspace.getConfiguration("changesCounter");
    const shouldDisableColorChange = config.get<boolean>("disableStatusBarIconColorChange");
    return !shouldDisableColorChange && (this.changesData?.hasExceededThreshold || false);
  }

  private updateColor(): void {
    const isInsertionsHigherThanZero = +(this.changesData?.insertions || 0) > 0;
    const isDeletionsHigherThanZero = +(this.changesData?.deletions || 0) > 0;

    if (isInsertionsHigherThanZero) this.insertionsStatusBarItem.color = "#3fb950";
    else this.insertionsStatusBarItem.color = undefined;
    if (isDeletionsHigherThanZero) this.deletionsStatusBarItem.color = "#f85149";
    else this.deletionsStatusBarItem.color = undefined;

    if (this.shouldChangeColor()) {
      this.changesStatusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
    } else {
      this.changesStatusBarItem.backgroundColor = undefined;
    }
  }

  private updateTooltip(): void {
    this.changesStatusBarItem.tooltip = this.getTooltipString();
  }

  private getTooltipString(): vscode.MarkdownString {
    const markdownTooltip = new vscode.MarkdownString();

    this.appendChangesDataMarkdown(markdownTooltip);
    this.appendSettingsMarkdown(markdownTooltip);
    this.appendCommandsMarkdown(markdownTooltip);

    markdownTooltip.isTrusted = true;
    markdownTooltip.supportThemeIcons = true;
    markdownTooltip.supportHtml = true;

    return markdownTooltip;
  }

  private appendChangesDataMarkdown(markdownTooltip: vscode.MarkdownString): void {
    if (this.changesData) {
      markdownTooltip.appendMarkdown(
        `$(plus) <strong>Insertions: </strong> <span style="color:#3fb950;">${this.changesData.insertions}</span> <br>`
      );
      markdownTooltip.appendMarkdown(
        `$(remove) <strong>Deletions: </strong> <span style="color:#f85149;">${this.changesData.deletions}</span> <br>`
      );
      markdownTooltip.appendMarkdown(
        `$(chrome-maximize) <strong>Total Changes: </strong> ${this.changesData.total}<br>`
      );

      markdownTooltip.appendMarkdown("<hr>");
      markdownTooltip.appendMarkdown("<br>");
    }
  }

  private appendSettingsMarkdown(markdownTooltip: vscode.MarkdownString): void {
    const comparisonBranch = this.context.workspaceState.get<string>("comparisonBranch");
    const changesQuantityThreshold = this.context.workspaceState.get<string>(
      "changesQuantityThreshold"
    );

    if (comparisonBranch) {
      markdownTooltip.appendMarkdown(
        `$(git-branch) <strong>Current Comparison Branch</strong> <br> ${comparisonBranch}`
      );
    } else {
      markdownTooltip.appendMarkdown(
        `$(git-branch) <strong>Current Comparison Branch</strong> <br> Undefined`
      );
    }

    markdownTooltip.appendMarkdown("<br>");

    if (changesQuantityThreshold) {
      markdownTooltip.appendMarkdown(
        `$(arrow-both) <strong>Changes Quantity Threshold</strong> <br> ${changesQuantityThreshold} changes`
      );
    } else {
      markdownTooltip.appendMarkdown(
        `$(arrow-both) <strong>Changes Quantity Threshold</strong> <br> Undefined`
      );
    }

    markdownTooltip.appendMarkdown("<br>");

    if (!comparisonBranch) {
      markdownTooltip.appendMarkdown("<br>");
      markdownTooltip.appendMarkdown(`$(alert) Set the comparison branch.`);
    }

    if (!changesQuantityThreshold) {
      markdownTooltip.appendMarkdown("<br>");
      markdownTooltip.appendMarkdown(`$(alert) Set the changes quantity threshold.`);
    }
  }

  private appendCommandsMarkdown(markdownTooltip: vscode.MarkdownString): void {
    const comparisonBranch = this.context.workspaceState.get<string>("comparisonBranch");
    const changesQuantityThreshold = this.context.workspaceState.get<string>(
      "changesQuantityThreshold"
    );

    const setComparisonBranchCommandURI = vscode.Uri.parse(
      `command:changes-counter.setComparisonBranch`
    );
    const setChangesQuantityThresholdCommandURI = vscode.Uri.parse(
      `command:changes-counter.setChangesQuantityThreshold`
    );

    markdownTooltip.appendMarkdown(
      `<hr><br> $(edit) [${
        comparisonBranch ? "Change" : "Set"
      } Comparison Branch](${setComparisonBranchCommandURI}) <br>`
    );

    markdownTooltip.appendMarkdown(
      `$(edit) [${
        changesQuantityThreshold ? "Change" : "Set"
      } Changes Quantity Threshold](${setChangesQuantityThresholdCommandURI})`
    );
  }
}
