# SystemVerilog LSP - Syntax Errors Only

A lightweight language server for Verilog and SystemVerilog that provides fast and accurate syntax error detection.

This extension is designed to be simple and efficient, focusing on one thing: helping you find syntax errors in your code as you type.

## Features

- **Real-time Syntax Validation:** Instantly highlights syntax errors in Verilog (`.v`, `.vh`) and SystemVerilog (`.sv`) files.
- **Cross-Platform Support:** Works reliably on Windows, macOS (Intel & Apple Silicon), and Linux with no extra setup required.
- **Fast and Lightweight:** Powered by the native Tree-sitter parsing library for excellent performance without slowing down your editor.

## Requirements

There are no external requirements or dependencies. Simply install the extension and it will work immediately.

## Commands

- **`SystemVerilog LSP: Restart`**: Can be run from the Command Palette to restart the language server if needed.

## Release Notes

### 0.1.1

- **Major Rearchitecture:** The language server has been completely rewritten in TypeScript to run natively within the extension.
- **Cross-Platform by Default:** Now ships with pre-built parsers for all major platforms (Windows, macOS, Linux), removing the need for any local dependencies like Python.
- **Improved Performance and Stability:** The new architecture is faster and more reliable.