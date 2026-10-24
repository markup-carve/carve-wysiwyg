# Changelog

## [Unreleased]

The editor now follows the current Carve grammar and engine for document import and preview.

### Fixes

- Table spans and wrapped attributes follow the current grammar and engine behavior in the editor (#48).

**Full Changelog**: https://github.com/markup-carve/carve-wysiwyg/compare/0.1.0...HEAD

## [0.1.0] - 2026-10-24

The first carve-wysiwyg release provides a hosted editor with live Carve source and HTML preview. It supports round trips through the Carve AST and common document structures.

### Improvements

- Edit Carve structures and inline marks with a palette, toolbar, attribute inspector, metadata controls, and source fallback (#11, #63, #64).
- Import Carve into the editor and regenerate source and preview as the document changes (#11).
- Preview code, math, diagrams, task lists, tables, and Carve syntax with the bundled grammar and styles (#65, #66, #67, #70).

**Full Changelog**: https://github.com/markup-carve/carve-wysiwyg/compare/112f593e323619a4833b733871e2a70d66809f39...0.1.0
