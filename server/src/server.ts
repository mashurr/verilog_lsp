import {
    createConnection,
    ProposedFeatures,
    InitializeParams,
    InitializeResult,
    TextDocumentSyncKind,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    Range,
    Position,
    Connection,
} from 'vscode-languageserver/node';
import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import * as TreeSitter from 'tree-sitter';
const Parser = require('tree-sitter');
const SystemVerilog = require('tree-sitter-systemverilog');

class SystemVerilogLanguageServer {
    private connection: Connection;
    private documents: TextDocuments<TextDocument>;
    private parser: TreeSitter;

    constructor(connection: Connection, documents: TextDocuments<TextDocument>) {
        this.connection = connection;
        this.documents = documents;

        this.parser = new Parser();
        this.parser.setLanguage(SystemVerilog);
        
        // Register event handlers
        this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
        this.connection.onInitialize(this.onInitialize.bind(this));
    }

    public listen(): void {
        this.documents.listen(this.connection);
        this.connection.listen();
        this.connection.console.log('SystemVerilog LSP Server is now listening...');
    }

    private onInitialize(params: InitializeParams): InitializeResult {
        this.connection.console.log('Server received initialize request.');
        return {
            serverInfo: {
                name: 'systemverilog-lsp-ts',
                version: '0.1.0',
            },
            capabilities: {
                // Use Incremental sync; the TextDocuments manager handles the details.
                textDocumentSync: TextDocumentSyncKind.Incremental,
            }
        };
    }

    private onDidChangeContent(change: { document: TextDocument }): void {
        this.analyzeDocument(change.document);
    }
    
    public analyzeDocument(textDocument: TextDocument): void {
        const uri = textDocument.uri;
        const text = textDocument.getText();
        
        this.connection.console.log(`Analyzing document: ${uri}`);

        try {
            const tree = this.parse(text);
            const diagnostics = this.getDiagnostics(tree, text);
            
            this.connection.console.log(`Found ${diagnostics.length} diagnostics for ${uri}.`);
            this.connection.sendDiagnostics({ uri, diagnostics });
        } catch (e) {
            this.connection.console.error(`Error during analysis: ${(e as Error).message}`);
        }
    }
    
    private parse(text: string): TreeSitter.Tree {
        return this.parser.parse(text);
    }
    
    private getDiagnostics(tree: TreeSitter.Tree, text: string): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];

        if (!tree.rootNode) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: Range.create(0, 0, 0, 1),
                message: 'Failed to parse the document entirely.',
                source: 'systemverilog-lsp'
            });
            return diagnostics;
        }

        this.findSyntaxErrors(tree.rootNode, diagnostics, text);
        return diagnostics;
    }

    private findSyntaxErrors(node: TreeSitter.SyntaxNode, diagnostics: Diagnostic[], text: string): void {
        if (node.type === 'ERROR') {
            const errorText = text.substring(node.startIndex, node.endIndex);
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: this.nodeToRange(node),
                message: `Syntax error near: '${errorText}'`,
                source: 'systemverilog-lsp'
            });
        } else if (node.type === 'MISSING') {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: this.nodeToRange(node),
                message: `Syntax error: Missing expected token.`,
                source: 'systemverilog-lsp'
            });
        }

        for (const child of node.children) {
            this.findSyntaxErrors(child, diagnostics, text);
        }
    }

    private nodeToRange(node: TreeSitter.SyntaxNode): Range {
        return Range.create(
            Position.create(node.startPosition.row, node.startPosition.column),
            Position.create(node.endPosition.row, node.endPosition.column)
        );
    }
}

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const server = new SystemVerilogLanguageServer(connection, documents);
server.listen();