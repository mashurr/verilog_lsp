const vscode = require('vscode');
const path = require('path');
const { LanguageClient, LanguageClientOptions, serverOptions, TransportKind } = require('vscode-languageclient/node');

let client;

/**
 * Activate the extension
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
    console.log('systemVerilog LSP extension is activating...');

    // get the compiled js
   const serverModule = context.asAbsolutePath(path.join('server', 'dist', 'server.js'));

    // Server options
    const serverOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc,
            options: { execArgv: ['--nolazy', '--inspect=6009'] }
        }
    };

    // Client options
    const clientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'verilog' },
            { scheme: 'file', language: 'systemverilog' },
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
        'systemverilogLsp',
        'SystemVerilog Language Server',
        serverOptions,
        clientOptions
    );

    // Handle server state changes
    client.onDidChangeState((event) => {
        // State values: 1=Stopped, 2=Starting, 3=Running
        console.log(`LSP client state changed to: ${['Stopped', 'Starting', 'Running'][event.newState - 1]}`)
    });
    console.log('Starting the language client...');
    // Start the client and server
    client.start().then(() => {
        console.log('SystemVerilog LSP client started successfully');
        vscode.window.showInformationMessage('SystemVerilog LSP activated (Syntax Error Detection)');
    }).catch((error) => {
        console.error('Failed to start SystemVerilog LSP client:', error);
        vscode.window.showErrorMessage(`Failed to start SystemVerilog LSP: ${error.message}`);
    });

    // Register restart command
    const restartCommand = vscode.commands.registerCommand('systemverilogLsp.restart', async () => {
        if (!client) { return; }
        try {
            await client.stop();
            await client.start();
            vscode.window.showInformationMessage('SystemVerilog LSP restarted');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to restart SystemVerilog LSP: ${error.message}`);
        }
    });

    context.subscriptions.push(restartCommand);
}

/**
 * Deactivate the extension
 * @returns {Thenable<void> | undefined}
 */
function deactivate() {
    console.log('SystemVerilog LSP extension is deactivating...');
    if (!client) {
        return undefined;
    }
    return client.stop();
}

module.exports = {
    activate,
    deactivate
};
