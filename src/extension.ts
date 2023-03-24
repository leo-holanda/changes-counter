const { spawn } = require("child_process");
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('changed-lines-count.helloWorld', async () => {
		if(vscode.workspace.workspaceFolders) {
			const shortstat = spawn('git', ["diff", "HEAD", "HEAD~1", "--shortstat"], {cwd: vscode.workspace.workspaceFolders[0].uri.path});
			
			shortstat.stdout.on('data', (data: any) => {
				console.log(`stdout: ${data}`);
			});

			shortstat.stderr.on('data', (data: any) => {
				console.error(`stderr: ${data}`);
			});

			shortstat.on('close', (code: any) => {
				console.log(`child process exited with code ${code}`);
			});
		}

	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
