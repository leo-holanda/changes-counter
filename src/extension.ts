import * as vscode from "vscode";
import { Extension } from "./extension/extension";

export async function activate(context: vscode.ExtensionContext) {
  const extension = new Extension(context);
  extension.bootstrap();
}

export function deactivate() {}
