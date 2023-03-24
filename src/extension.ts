const { spawn } = require("child_process");
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  if (vscode.workspace.workspaceFolders) {
    const shortstat = spawn("git", ["diff", "HEAD", "HEAD~1", "--shortstat"], {
      cwd: vscode.workspace.workspaceFolders[0].uri.path,
    });

    shortstat.stdout.on("data", (data: any) => {
      console.log(`stdout: ${data}`);
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
