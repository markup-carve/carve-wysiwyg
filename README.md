# Carve WYSIWYG

A hosted, static WYSIWYG editor for the [Carve](https://markup-carve.github.io/carve/)
markup language. This fills awesome-djot's "Sandboxes > WYSIWYG" gap for Carve.

## [Open the live Carve WYSIWYG editor →](https://markup-carve.github.io/carve-wysiwyg/)

The live sandbox supports rich structured insertion, visual attribute editing,
Carve lint feedback, source-normalization diffs, and side-by-side source and
HTML previews. No installation or account is required.

It is built from the markup-carve org's own assets:

- **carve-js** (`@markup-carve/carve`, Carve 0.2) is the reference
  parser/renderer. It renders the document the editor loads, imports the
  editor's HTML back to Carve, and renders the preview pane.
- **carve-grammars** supplies the Carve, CSV and TSV highlighters and the diff
  styles. Its 0.1 Tiptap kit has no 0.2 counterpart yet
  ([carve-grammars#906](https://github.com/markup-carve/carve-grammars/issues/906)),
  so the editor uses Tiptap's own extensions; see [round-trip behavior](docs/round-trip.md)
  for what that keeps and what it does not.

## Layout

Three live panes:

1. **Editor** - a Tiptap editor seeded with the engine's HTML render, plus a toolbar
   (bold, italic, underline, strike, highlight, superscript, subscript,
   inserted and deleted text, inline code, code block, headings 1-6,
   bullet/ordered/task list, blockquote, horizontal rule, hard break, link)
   wired to Tiptap commands using Carve's visual semantics. Each button's
   tooltip shows its Carve syntax and keyboard shortcut. The toolbar's right
   side holds the **Comments** show/hide toggle, **Document metadata**,
   **Insert structure**, and **Inspector**.
2. **Carve source** - read-only, regenerated on every edit by importing the
   editor's HTML with carve-js `importDocument`; plus an import box
   and a "Load Carve" button (Carve -> editor round trip).
3. **HTML preview** - the rendered HTML of the current Carve source, via
   carve-js.

The editor also provides a structured-insert palette (`Alt+Shift+K`) for
tables, definition lists, references and inline footnotes, figures, containers
and admonitions, line blocks, comments, citations, metadata, attributed blocks
and spans, and task items with an extended state;
a collapsible **Document metadata** card for common frontmatter fields and raw
YAML/TOML; a selection-aware attribute inspector, which also sets a task item's state
(`[ ]`, `[x]`, `[-]`, `[_]`, `[>]`, `[?]`); searchable heading targets;
live lint findings with source-range navigation; and an explicit
source-normalization diff. These controls generate Carve through the same HTML
pivot as imported documents.
Single fenced code blocks are available directly from the **Code block** toolbar
button with language and source fields; related multi-language examples remain
available as **Code group** in the structure palette. Preview fences provide
syntax highlighting, a language label, and a hover/focus copy action; the bundled
Carve highlighter is registered alongside common programming languages, with
carve-grammars' CSV and TSV definitions so a delimited table body shows its
separators and quoted fields.
The **Diagrams** palette group includes Mermaid, Graphviz, D2, PlantUML,
WaveDrom, ABC music, Vega-Lite, and Chart.js source blocks. Mermaid renders
lazily in this demo; the other formats demonstrate Carve's hydration elements
for hosts to connect to their corresponding client or build-time renderer.
Inline and display TeX are available under **Math** and rendered with KaTeX in
the live preview.

The **Comments** toggle shows how many comments the document holds (`%%` and
`%%%` comments). The editor does not show comments; they stay in the Carve
source until the document is edited (carve-grammars#906).

Visual/Source tabs are real keyboard- and touch-activatable controls. In edit
mode, tables show cell boundaries and selection clearly. The target pickers for
inline footnotes, cross-references and citations, the definition cards and the
source-preserving fallback nodes came from the 0.1 Tiptap kit and return with a
0.2 kit (carve-grammars#906).
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

An unedited document is written back byte for byte. Once it is edited, the
body is written in canonical Carve 0.2 by the engine's HTML importer, and
constructs Tiptap's stock schema has no node for are dropped or flattened
until a 0.2 editor kit exists (carve-grammars#906). The source pane and
normalization diff make every rewrite explicit.

See [docs/round-trip.md](docs/round-trip.md) for what round-trips and what does
not.

## Development

Development, dependency-pin, testing, and deployment instructions live in
[docs/development.md](docs/development.md).
