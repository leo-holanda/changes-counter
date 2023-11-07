import { DiffData } from "../git/git.service.interfaces";

export interface ChangesData extends DiffData {
  total: string;
  hasExceededThreshold: boolean;
}
