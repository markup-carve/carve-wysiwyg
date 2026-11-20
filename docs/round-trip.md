# Round-trip behavior

The editor runs on the Carve 0.2 Tiptap kit from carve-grammars
(`@markup-carve/carve-grammars/tiptap`). The data path never goes through HTML:

1. Carve source → carve-js `parse` → the 0.2 tree → `carveToProseMirror` →
   the Tiptap document.
2. Tiptap document → `serializeToCarve` → the 0.2 tree → carve-js `write` →
   Carve source.

Every Tiptap node and mark keeps the tree fields the editor does not edit in its
`carve` attribute (attributes, list markers, task marks, keys), and a node the
kit has no editable form for is kept whole as an atom. The kit round-trips every
0.2 conformance example and clause case this way.

While a document is untouched, `editorToCarve` returns the loaded source byte
for byte. After an edit, the top-level blocks the edit left alone keep their
source; the edited blocks are written by the engine, with their original layout
where they still stand in the same place, so fences and markers keep their
spelling where the writer allows. A heading the author edits is written with
`=`, the writer's only heading marker.

HTML pasted or dropped from elsewhere is parsed by the Tiptap kit's node
rules. `htmlToCarve` runs carve-js
`importDocument(html, { from: 'html', rawHtml: false })` for a host that wants
the engine's importer instead; the editor does not call it on paste.

## Round-tripped through the editor

The automated suite covers:

- headings, paragraphs, bold, italic, underline, strike, highlight,
  superscript, subscript, inserted and deleted text, links and inline code;
- bullet, ordered and task lists, with every task state;
- blockquotes with captions, and thematic breaks;
- fenced code blocks with their language, class (`{.diff}`), title and caption;
- tables with a header row and cell alignment;
- divs and admonitions with titles and classes, figures and figure groups with
  captions, definition lists, line blocks, inline footnotes, spans with
  attributes and language spans;
- front matter, and every recipe of the structure palette.

The relevant coverage lives in `tests/roundtrip.test.ts`,
`tests/authoring-roundtrip.test.ts`, `tests/authoring-constructs.test.ts`,
`tests/composite-figure.test.ts`, `tests/blockquote-caption.test.ts`,
`tests/edit-keeps-spelling.test.ts`, `tests/language-attribute.test.ts`,
`tests/code-highlight.test.ts` and `tests/toolbar.test.ts`. The kit's own suite
in carve-grammars covers the conformance corpus.
