import { BarItem } from "../BarItem/BarItem";
import { GitOperator } from "../gitOperator/gitOperator";
import { Logger } from "../logger/logger";
import { LogTypes } from "../logger/logger.enums";
import { Notificator } from "../notificator/notificator";
import * as vscode from "vscode";

export class Extension {
  gitOperator!: GitOperator;
  notificator!: Notificator;
  barItem!: BarItem;
  logger: Logger;

  constructor(context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance();
    this.gitOperator = new GitOperator();
    this.notificator = new Notificator();
    this.barItem = new BarItem(context);
    this.logger.log("Extension was constructed.", LogTypes.INFO);
  }
}
