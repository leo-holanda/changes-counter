import * as vscode from "vscode";
import { LogTypes } from "./logger.enums";

class Logger {
  outputChannel!: vscode.OutputChannel;

  constructor() {
    const outputChannel = vscode.window.createOutputChannel("Changes Counter");
  }

  log(message: string, type: LogTypes): void {
    const now = new Date().toISOString().split("T");
    const date = now[0];
    const time = now[1].slice(0, -1);
    this.outputChannel.appendLine(date + " " + time + " " + "[" + type + "] " + message);
  }
}
