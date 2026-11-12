# Changelog

## [Unreleased]

The editor now follows the current Carve grammar and engine for document import and preview.

### Fixes

- Table spans and wrapped attributes follow the current grammar and engine behavior in the editor (#48).
- Captioned `{.diff}` fences now render as diffs in the editor and the preview (#80).
- The table recipe and the starter document write cell alignment in braces (`|={<}`, `|={>}`), so they round-trip unchanged (#82).
- The starter table's span row fills every column (#81).
- Task checkboxes in the editor match the preview's checked state, and checks stay legible in the dark preview (#73, #76).

### Improvements

- The lint panel labels Hint findings and shows them muted instead of in the error color (#82).
- Table boundaries, headers, alignment, spans and continuation markers get separate colors in code blocks and the preview (#77).
- The starter document shows every task state and a table marker example, with a light theme option (#79).
- The editor builds with carve-js 0.1.17, carve-grammars 0.1.23 and carve-css 0.1.10 (#72, #75, #79, #82).

**Full Changelog**: https://github.com/markup-carve/carve-wysiwyg/compare/0.1.0...HEAD

## [0.1.0] - 2026-10-24

The first carve-wysiwyg release provides a hosted editor with live Carve source and HTML preview. It supports round trips through the Carve AST and common document structures.

### Improvements

- Edit Carve structures and inline marks with a palette, toolbar, attribute inspector, metadata controls, and source fallback (#11, #63, #64).
- Import Carve into the editor and regenerate source and preview as the document changes (#11).
- Preview code, math, diagrams, task lists, tables, and Carve syntax with the bundled grammar and styles (#65, #66, #67, #70).

**Full Changelog**: https://github.com/markup-carve/carve-wysiwyg/compare/112f593e323619a4833b733871e2a70d66809f39...0.1.0
