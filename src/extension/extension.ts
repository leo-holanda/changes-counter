import { GitOperator } from "../gitOperator/gitOperator";
import { Logger } from "../logger/logger";
import { Notificator } from "../notificator/notificator";

export class Extension {
  logger!: Logger;
  gitOperator!: GitOperator;
  notificator!: Notificator;

  constructor() {
    this.logger = new Logger();
    this.gitOperator = new GitOperator();
    this.notificator = new Notificator();
  }
}
