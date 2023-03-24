const { spawn } = require("child_process");
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const changesQuantityBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    10
  );
  changesQuantityBarItem.text = "Loading...";
  changesQuantityBarItem.show();
  context.subscriptions.push(changesQuantityBarItem);

  if (vscode.workspace.workspaceFolders) {
    const shortstat = spawn("git", ["diff", "HEAD", "HEAD~1", "--shortstat"], {
      cwd: vscode.workspace.workspaceFolders[0].uri.path,
    });

    shortstat.stdout.on("data", (data: any) => {
      const splittedDiffOutput = data.toString().split(", ");
      const insertions = +splittedDiffOutput[1][0];
      const deletions = +splittedDiffOutput[2][0];
      const changesQuantity = insertions + deletions;
      changesQuantityBarItem.text = "Changes: " + changesQuantity.toString();
    });

    shortstat.stderr.on("data", (data: any) => {
      console.error(`stderr: ${data}`);
    });

    shortstat.on("close", (code: any) => {
      console.log(`child process exited with code ${code}`);
    });
  }
}

export function deactivate() {}
