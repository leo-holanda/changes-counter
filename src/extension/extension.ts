import { Logger } from "../logger/logger";

export class Extension {
  logger!: Logger;

  constructor() {
    this.logger = new Logger();
  }
}
