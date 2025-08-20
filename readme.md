# Verilog LSP - Syntax Errors Only

A simple Verilog language server extension that provides syntax error detection for Verilog and SystemVerilog files.

## Features

- Real-time syntax error detection for `.v`, `.sv`, and `.vh` files
- Powered by tree-sitter parser
- Lightweight and fast

## Requirements

- Python 3.7 or higher
- The extension includes a bundled Python environment

## Configuration

- `verilogLsp.pythonPath`: Path to Python interpreter (optional)
- `verilogLsp.serverPath`: Path to server.py (optional)

## Commands

- `Verilog LSP: Restart` - Restart the language server

## Release Notes

### 0.0.2
- Initial release with syntax error detection