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
   (bold, italic, underline, strike, inline code, code block, H1/H2,
   bullet/ordered/task list, blockquote, link) wired to Tiptap commands using
   Carve's visual semantics. The toolbar's right side holds the **Comments**
   show/hide toggle, **Document metadata**, **Insert structure**, and
   **Inspector**.
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
available as **Code group** in the structure palette. Preview fences provide
syntax highlighting, a language label, and a hover/focus copy action; the bundled
Carve highlighter is registered alongside common programming languages.
The **Diagrams** palette group includes Mermaid, Graphviz, D2, PlantUML,
WaveDrom, ABC music, Vega-Lite, and Chart.js source blocks. Mermaid renders
lazily in this demo; the other formats demonstrate Carve's hydration elements
for hosts to connect to their corresponding client or build-time renderer.
Inline and display TeX are available under **Math** and rendered with KaTeX in
the live preview.

The **Comments** toggle shows how many editorial comments the document holds
(`%%` and `%%%` comments plus inline review notes) and hides or shows them in
the editor. Hidden comments stay in the document and in the Carve source.

Visual/Source tabs are real keyboard- and touch-activatable controls. In edit
mode, tables show cell boundaries and selection clearly; inline footnotes,
cross-references, and citations open document-aware target pickers; definition
blocks use compact editable cards; and preserved fallback nodes expose their
exact Carve source instead of becoming dead ends.
The built-in starter document deliberately exercises frontmatter, an
admonition, a captioned table, tabs, a cross-reference, and a footnote so the
hosted sandbox demonstrates these capabilities without setup.

## Keyboard shortcuts

`Mod` is Ctrl on Windows and Linux and Cmd on macOS.

| Action | Shortcut |
|--------|----------|
| Bold, italic, underline | `Mod+B`, `Mod+I`, `Mod+U` |
| Strike | `Mod+Shift+S` or `Mod+Shift+X` |
| Inline code | `Mod+E` |
| Highlight | `Mod+Shift+H` |
| Superscript, subscript | `Mod+.`, `Mod+,` |
| Insert, delete marks | `Mod+Shift+I`, `Mod+Shift+D` |
| Link | `Mod+Shift+K` |
| Heading 1-6 | `Mod+1` to `Mod+6` |
| Paragraph | `Mod+Alt+0` |
| Code block | `Mod+Shift+E` or `Mod+Alt+C` |
| Blockquote | `Mod+Shift+B` or `Mod+Shift+.` |
| Bullet, ordered, task list | `Mod+Shift+8`, `Mod+Shift+7`, `Mod+Shift+9` |
| Hard break | `Shift+Enter` |
| Clear formatting | `Mod+\` |
| Insert structure | `Alt+Shift+K` |

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
