import { BarItem } from "../BarItem/BarItem";
import { GitOperator } from "../gitOperator/gitOperator";
import { Logger } from "../logger/logger";
import { Notificator } from "../notificator/notificator";
import * as vscode from "vscode";

export class Extension {
  logger!: Logger;
  gitOperator!: GitOperator;
  notificator!: Notificator;
  barItem!: BarItem;

  constructor(context: vscode.ExtensionContext) {
    this.logger = new Logger();
    this.gitOperator = new GitOperator();
    this.notificator = new Notificator();
    this.barItem = new BarItem(context);
  }
}
