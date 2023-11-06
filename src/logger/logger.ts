import * as vscode from "vscode";
import { LogTypes } from "./logger.enums";

export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("Changes Counter");
    this.log("Logger has been constructed.", LogTypes.INFO);
  }

  static getInstance(): Logger {
    if (!Logger.instance) Logger.instance = new Logger();
    return Logger.instance;
  }

  log(message: string, type: LogTypes): void {
    const now = new Date().toISOString().split("T");
    const date = now[0];
    const time = now[1].slice(0, -1);
    this.outputChannel.appendLine(date + " " + time + " " + "[" + type + "] " + message);
  }
}
