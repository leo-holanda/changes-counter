const { spawn } = require("child_process");
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  if (!vscode.workspace.workspaceFolders) {
    return;
  }

  const changesQuantityBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    10
  );
  changesQuantityBarItem.text = "Loading...";
  changesQuantityBarItem.show();
  context.subscriptions.push(changesQuantityBarItem);

  const diffHEAD = spawn("git", ["diff", "HEAD", "--shortstat"], {
    cwd: vscode.workspace.workspaceFolders[0].uri.path,
  });

  diffHEAD.stdout.on("data", (data: Buffer) => {
    changesQuantityBarItem.text = "Changes: " + parseChangesQuantity(data);
  });

  diffHEAD.stderr.on("data", (data: any) => {
    console.error(`stderr: ${data}`);
  });

  diffHEAD.on("close", (code: any) => {
    console.log(`child process exited with code ${code}`);
  });
}

export function deactivate() {}

function parseChangesQuantity(diffOutput: Buffer): string {
  const splittedDiffOutput = diffOutput.toString().split(", ");
  const insertions = +splittedDiffOutput[1].split(" ")[0];
  const deletions = +splittedDiffOutput[2].split(" ")[0];
  const changesQuantity = insertions + deletions;

  return changesQuantity.toString();
}
