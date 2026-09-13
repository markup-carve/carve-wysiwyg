# Carve WYSIWYG

A hosted, static WYSIWYG editor for the [Carve](https://markup-carve.github.io/carve/)
markup language. This fills awesome-djot's "Sandboxes > WYSIWYG" gap for Carve.

## [Open the live Carve WYSIWYG editor →](https://markup-carve.github.io/carve-wysiwyg/)

The live sandbox supports rich structured insertion, visual attribute editing,
Carve lint feedback, source-normalization diffs, and side-by-side source and
HTML previews. No installation or account is required.

It is built from the markup-carve org's own assets:

- **carve-grammars** ships the Tiptap kit (`CarveKit`), the AST-based loader
  (`carveToProseMirror`) and the ProseMirror -> Carve serializer
  (`serializeToCarve`). The visual editing surface and both conversion
  directions are driven by this public package.
- **carve-js** (`@markup-carve/carve`) is the reference parser/renderer. It
  powers the parser behind the shared loader and the HTML preview pane.

## Layout

Three live panes:

1. **Editor** - a Tiptap editor initialized with `CarveKit`, plus a toolbar
   (bold, italic, underline, strike, inline code, H1/H2, bullet/ordered list,
   blockquote, link) wired to Tiptap commands using Carve's visual semantics.
2. **Carve source** - read-only, regenerated on every edit by running
   `serializeToCarve` on the editor's ProseMirror document; plus an import box
   and a "Load Carve" button (Carve -> editor round trip).
3. **HTML preview** - the rendered HTML of the current Carve source, via
   carve-js.

The editor also provides a structured-insert palette (`Alt+Shift+K`) for
tables, references, figures, containers, citations, metadata, and attributes;
a collapsible **Document metadata** card for common frontmatter fields and raw
YAML/TOML; a selection-aware attribute inspector; searchable heading targets;
live lint findings with source-range navigation; and an explicit
source-normalization diff. These controls generate Carve through the same AST
bridge as imported documents, so their output is immediately editable and
round-trip tested.
Single fenced code blocks are available directly from the **Code block** toolbar
button with language and source fields; related multi-language examples remain
available as **Code group** in the structure palette.

Visual/Source tabs are real keyboard- and touch-activatable controls. In edit
mode, tables show cell boundaries and selection clearly; inline footnotes,
cross-references, and citations open document-aware target pickers; definition
blocks use compact editable cards; and preserved fallback nodes expose their
exact Carve source instead of becoming dead ends.
The built-in starter document deliberately exercises frontmatter, an
admonition, a captioned table, tabs, a cross-reference, and a footnote so the
hosted sandbox demonstrates these capabilities without setup.

## Fidelity

Rich structures remain editable across Carve → visual editor → Carve round
trips. Syntax not yet represented visually is retained visibly instead of
being silently discarded. The source pane and normalization diff make any
canonical rewrite explicit.

See [docs/round-trip.md](docs/round-trip.md) for covered constructs and the
known delimiter limitation.

## Development

Development, dependency-pin, testing, and deployment instructions live in
[docs/development.md](docs/development.md).
