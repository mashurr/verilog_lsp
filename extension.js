const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

/**
 * Activate the extension
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
    console.log('Verilog LSP extension is activating...');

    // Get configuration
    const config = vscode.workspace.getConfiguration('verilogLsp');
    let pythonPath = config.get('pythonPath');

    if (!pythonPath) {
        // Default to the python interpreter in the extension's .venv
        pythonPath = context.asAbsolutePath(path.join('.venv', 'bin', 'python'));
    }
    
    // Check if the python interpreter exists
    if (!fs.existsSync(pythonPath)) {
        const message = `Python interpreter not found at: ${pythonPath}. Please check your '.venv' setup or the 'verilogLsp.pythonPath' setting.`;
        vscode.window.showErrorMessage(message);
        console.error(message);
        return;
    }

    let serverPath = config.get('serverPath');

    // If no custom server path, use the bundled one
    if (!serverPath) {
        serverPath = context.asAbsolutePath(path.join('server', 'server.py'));
    }

    console.log(`Using Python: ${pythonPath}`);
    console.log(`Using server: ${serverPath}`);

    // Server options
    const serverOptions = {
        command: pythonPath,
        args: [serverPath],
        transport: TransportKind.stdio,
        options: {
            // Set working directory to server directory for imports
            cwd: path.dirname(serverPath)
        }
    };

    // Client options
    const clientOptions = {
        documentSelector: [
            { scheme: 'file', pattern: '**/*.v' },
            { scheme: 'file', pattern: '**/*.sv' },
            { scheme: 'file', pattern: '**/*.vh' }
        ],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{v,sv,vh}')
        },
        outputChannel: vscode.window.createOutputChannel('Verilog LSP'),
        initializationOptions: {},
        middleware: {
            didChangeTextDocument: (params, next) => {
                const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === params.textDocument.uri);
                if (doc) {
                    // Force full text sync so the server always gets the full document
                    params.contentChanges = [{ text: doc.getText() }];
                }
                return next(params);
            }
        }
    };

    // Create the language client
    client = new LanguageClient(
        'verilogLsp',
        'Verilog Language Server',
        serverOptions,
        clientOptions
    );

    // Handle server state changes
    client.onDidChangeState((event) => {
        console.log(`LSP State changed: ${event.oldState} -> ${event.newState}`);
        if (event.newState === 3) { // Stopped
            vscode.window.showErrorMessage('Verilog LSP server stopped unexpectedly');
        }
    });

    // Start the client and server
    client.start().then(() => {
        console.log('Verilog LSP client started successfully');
        vscode.window.showInformationMessage('Verilog LSP activated (Syntax Error Detection)');
    }).catch((error) => {
        console.error('Failed to start Verilog LSP client:', error);
        vscode.window.showErrorMessage(`Failed to start Verilog LSP: ${error.message}`);
    });

    // Register restart command
    const restartCommand = vscode.commands.registerCommand('verilogLsp.restart', async () => {
        if (client) {
            await client.stop();
            await client.start();
            vscode.window.showInformationMessage('Verilog LSP restarted');
        }
    });

    context.subscriptions.push(restartCommand);
}

/**
 * Deactivate the extension
 * @returns {Thenable<void> | undefined}
 */
function deactivate() {
    console.log('Verilog LSP extension is deactivating...');
    if (!client) {
        return undefined;
    }
    return client.stop();
}

module.exports = {
    activate,
    deactivate
};
