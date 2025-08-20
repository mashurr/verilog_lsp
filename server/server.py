import logging
from typing import List
from pygls.server import LanguageServer
from lsprotocol.types import (
    InitializeParams,
    InitializeResult,
    ServerCapabilities,
    TextDocumentSyncKind,
    TextDocumentSyncOptions,
    Position,
    Range,
    Diagnostic,
    DiagnosticSeverity,
    DidOpenTextDocumentParams,
    DidChangeTextDocumentParams,
    TextDocumentContentChangeEvent,
)

import tree_sitter_systemverilog as tssverilog
from tree_sitter import Language, Parser, Node

# Initialize SystemVerilog language
SYSTEMVERILOG_LANGUAGE = Language(tssverilog.language())

class SystemVerilogLanguageServer(LanguageServer):
    def __init__(self):
        super().__init__('systemverilog-lsp', 'v0.1.0')
        self.parser = Parser(SYSTEMVERILOG_LANGUAGE)
        self.documents = {}

    def _apply_incremental_changes(self, text: str, changes: List[TextDocumentContentChangeEvent]) -> str:
        """Apply incremental changes to the document text."""
        lines = text.split('\n')
        
        # Sort changes by position (reverse order to avoid position shifts)
        sorted_changes = sorted(changes, key=lambda c: (c.range.start.line, c.range.start.character), reverse=True)
        
        for change in sorted_changes:
            if change.range is None:
                # Full document replacement
                return change.text
            
            start_line = change.range.start.line
            start_char = change.range.start.character
            end_line = change.range.end.line
            end_char = change.range.end.character
            
            # Handle single line change
            if start_line == end_line:
                line = lines[start_line]
                lines[start_line] = line[:start_char] + change.text + line[end_char:]
            else:
                # Multi-line change
                # Keep the part before the start position
                before = lines[start_line][:start_char] if start_line < len(lines) else ""
                # Keep the part after the end position
                after = lines[end_line][end_char:] if end_line < len(lines) else ""
                
                # Replace the affected lines
                new_lines = (before + change.text + after).split('\n')
                lines[start_line:end_line + 1] = new_lines
        
        return '\n'.join(lines)

    def _parse(self, text: str):
        """Parse SystemVerilog code and return the syntax tree."""
        try:
            tree = self.parser.parse(bytes(text, "utf8"))
            return tree
        except Exception as e:
            logging.error(f"Parse error: {e}")
            return None

    def _node_to_range(self, node: 'Node') -> Range:
        """Convert tree-sitter node to LSP Range."""
        return Range(
            start=Position(line=node.start_point[0], character=node.start_point[1]),
            end=Position(line=node.end_point[0], character=node.end_point[1]),
        )

    def _get_diagnostics(self, tree, text: str) -> List[Diagnostic]:
        """Generate diagnostics for syntax errors only."""
        diagnostics = []
        
        if not tree:
            return [Diagnostic(
                range=Range(start=Position(line=0, character=0), 
                           end=Position(line=0, character=0)),
                severity=DiagnosticSeverity.Error,
                message="Failed to parse Verilog code - tree-sitter parser not available"
            )]
        
        root_node = tree.root_node
        
        # Only check for actual ERROR nodes, not just has_error flag
        # The has_error flag can be true even for recoverable syntax issues
        diagnostics.extend(self._find_syntax_errors(root_node, text))
        
        # If no specific errors found but tree has error flag, it might be a parser limitation
        if not diagnostics and root_node.has_error:
            logging.warning(f"Tree has error flag but no specific errors found. Root node type: {root_node.type}")
            # Don't report a generic error - let the specific error nodes be found
        
        return diagnostics

    def _find_syntax_errors(self, node: 'Node', text: str) -> List[Diagnostic]:
        """Find syntax errors in the parse tree."""
        diagnostics = []
        
        def traverse(n):
            # Only report actual ERROR nodes
            if n.type == "ERROR":
                error_text = text[n.start_byte:n.end_byte]
                diagnostics.append(Diagnostic(
                    range=self._node_to_range(n),
                    severity=DiagnosticSeverity.Error,
                    message=f"Syntax error: '{error_text}'"
                ))
                logging.info(f"Found ERROR node: '{error_text}' at {n.start_point}-{n.end_point}")
            elif n.is_missing:
                diagnostics.append(Diagnostic(
                    range=self._node_to_range(n),
                    severity=DiagnosticSeverity.Error,
                    message="Missing token"
                ))
                logging.info(f"Found missing node at {n.start_point}-{n.end_point}")
            
            for child in n.children:
                traverse(child)
        
        traverse(node)
        logging.info(f"Found {len(diagnostics)} syntax errors")
        return diagnostics

    def _analyze_document(self, text: str) -> List[Diagnostic]:
        """Analyze the document and return syntax error diagnostics."""
        tree = self._parse(text)
        if tree:
            logging.info(f"Successfully parsed document. Root node: {tree.root_node.type}, Has error: {tree.root_node.has_error}")
        else:
            logging.error("Failed to parse document")
        diagnostics = self._get_diagnostics(tree, text)
        logging.info(f"Generated {len(diagnostics)} diagnostics")
        return diagnostics

server = SystemVerilogLanguageServer()

@server.feature('textDocument/didOpen')
async def did_open(ls: SystemVerilogLanguageServer, params: DidOpenTextDocumentParams):
    """Handle document open event."""
    uri = params.text_document.uri
    text = params.text_document.text
    
    # Store document content
    ls.documents[uri] = text
    
    # Analyze and publish diagnostics
    diagnostics = ls._analyze_document(text)
    ls.publish_diagnostics(uri, diagnostics)
    
    logging.info(f"Opened document: {uri}")

@server.feature('textDocument/didChange') 
async def did_change(ls: SystemVerilogLanguageServer, params: DidChangeTextDocumentParams):
    """Handle document change event."""
    uri = params.text_document.uri
    logging.info(f"Document changed: {uri}, Changes: {len(params.content_changes)}")
    
    if not params.content_changes:
        logging.warning("Received didChange with no content changes")
        return
    
    current_text = ls.documents.get(uri, "")
    
    # Check if this is a full document update or incremental changes
    first_change = params.content_changes[0]
    
    if first_change.range is None:
        # Full document replacement
        new_text = first_change.text
        logging.info("Received full document update")
    else:
        # Incremental changes
        logging.info(f"Received {len(params.content_changes)} incremental changes")
        new_text = ls._apply_incremental_changes(current_text, params.content_changes)
    
    # Update stored document content
    ls.documents[uri] = new_text
    
    # Re-analyze and publish diagnostics
    diagnostics = ls._analyze_document(new_text)
    ls.publish_diagnostics(uri, diagnostics)

@server.feature('initialize')
async def initialize(ls: SystemVerilogLanguageServer, params: InitializeParams) -> InitializeResult:
    """Initialize the language server."""
    return InitializeResult(
        capabilities=ServerCapabilities(
            text_document_sync=TextDocumentSyncOptions(
                open_close=True,
                change=TextDocumentSyncKind.Full,  # Request full sync but handle incremental too
                save=False
            ),
            diagnostic_provider={"inter_file_dependencies": False, "workspace_diagnostics": False}
        )
    )

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.CRITICAL,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('verilog-lsp.log'),
            logging.StreamHandler()
        ]
    )
    server.start_io()