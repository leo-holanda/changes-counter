import * as vscode from "vscode";
import { ChangesData } from "../gitOperator/gitOperator.interfaces";

export class BarItem {
  item!: vscode.StatusBarItem;
  context!: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  }

  updateItemData(changesData: ChangesData): void {
    this.updateCounter(changesData);
    this.updateTooltip(changesData);
  }

  private updateCounter(changesData: ChangesData): void {
    this.setCounterValue(changesData);
    this.updateItemColor(changesData);
  }

  private setCounterValue(changesData: ChangesData): void {
    this.item.text = "Changes: " + changesData.changesCount;
  }

  private shouldChangeItemColor(): boolean {
    const config = vscode.workspace.getConfiguration("changesCounter");
    const shouldDisableColorChange = config.get<boolean>("disableStatusBarIconColorChange");
    return !shouldDisableColorChange;
  }

  private updateItemColor(changesData: ChangesData): void {
    const changesQuantityThreshold = this.context.workspaceState.get<string>(
      "changesQuantityThreshold"
    );

    if (
      this.shouldChangeItemColor() &&
      this.hasPassedThreshold(changesData.changesCount, changesQuantityThreshold)
    )
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    else this.item.backgroundColor = undefined;
  }

  private updateTooltip(changesData?: ChangesData): void {
    const comparisonBranch = this.context.workspaceState.get<string>("comparisonBranch");
    const changesQuantityThreshold = this.context.workspaceState.get<string>(
      "changesQuantityThreshold"
    );
    const newTooltipString = this.getTooltipString(
      changesData,
      comparisonBranch,
      changesQuantityThreshold
    );
    this.item.tooltip = newTooltipString;
  }

  private getTooltipString(
    changesData?: ChangesData,
    comparisonBranch?: string,
    changesQuantityThreshold?: string
  ): vscode.MarkdownString {
    const setComparisonBranchCommandURI = vscode.Uri.parse(
      `command:changes-counter.setComparisonBranch`
    );
    const setChangesQuantityThresholdCommandURI = vscode.Uri.parse(
      `command:changes-counter.setChangesQuantityThreshold`
    );
    const markdownTooltip = new vscode.MarkdownString();

    if (changesData) {
      markdownTooltip.appendMarkdown(
        `$(plus) <strong>Insertions: </strong> <span style="color:#3fb950;">${changesData.insertions}</span> <br>`
      );
      markdownTooltip.appendMarkdown(
        `$(remove) <strong>Deletions: </strong> <span style="color:#f85149;">${changesData.deletions}</span> <br>`
      );
      markdownTooltip.appendMarkdown(
        `$(chrome-maximize) <strong>Total Changes: </strong> ${changesData.changesCount}<br>`
      );

      markdownTooltip.appendMarkdown("<hr>");
      markdownTooltip.appendMarkdown("<br>");
    }

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

    markdownTooltip.isTrusted = true;
    markdownTooltip.supportThemeIcons = true;
    markdownTooltip.supportHtml = true;

    return markdownTooltip;
  }

  private hasPassedThreshold(changesCount?: string, changesQuantityThreshold?: string): boolean {
    return (
      changesQuantityThreshold !== undefined &&
      changesCount !== undefined &&
      +changesCount > +changesQuantityThreshold
    );
  }
}
