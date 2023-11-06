import { GitOperator } from "../gitOperator/gitOperator";
import { Logger } from "../logger/logger";

export class Extension {
  logger!: Logger;
  gitOperator!: GitOperator;

  constructor() {
    this.logger = new Logger();
    this.gitOperator = new GitOperator();
  }
}
