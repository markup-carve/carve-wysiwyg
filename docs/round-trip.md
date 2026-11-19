# Round-trip behavior

The editor runs on Carve 0.2. carve-grammars 0.2 has no Tiptap editor kit yet
([carve-grammars#906](https://github.com/markup-carve/carve-grammars/issues/906)),
so the data path goes through HTML:

1. Carve source → carve-js `render` → HTML, which Tiptap parses into its
   document.
2. Tiptap HTML → carve-js `importDocument(html, { from: 'html', rawHtml: false })`
   → Carve source.

Front matter has no HTML form. `carveToEditorDocument` splits it off where the
engine reads it, the editor keeps it beside the document, and `editorToCarve`
writes it back in front of the body unchanged. The **Document metadata** recipe
replaces it.

While a document is untouched, `editorToCarve` returns the loaded source byte
for byte. After the first edit, the whole body is written by the importer in
canonical 0.2 spelling: `=` headings, braced inline marks, a final line feed.

Before the importer runs, `normalizeEditorHtml` turns Tiptap's own markup into
what a Carve render writes: task items become `<li>` with a checkbox (their
`data-task-state` is kept), a table's first row of header cells becomes its
head, Tiptap's table sizing styles are dropped, and empty list items and the
trailing empty paragraph are removed.

## Round-tripped through the editor

The automated suite covers:

- headings, paragraphs, bold, italic, underline, strike, highlight,
  superscript, subscript, inserted and deleted text, links and inline code;
- bullet, ordered and task lists, with every task state;
- blockquotes and thematic breaks;
- fenced code blocks with their language, class (`{.diff}`) and title;
- tables with a header row and cell alignment;
- front matter.

## Kept only while unedited

Tiptap's stock schema has no node for these, so an edit anywhere in the
document drops or flattens them: divs and admonitions, tabs, code groups,
details and spoilers, figures and captions, definition lists, line blocks,
math, footnotes, comments, abbreviations, link definitions, spans with
attributes, language spans and block attribute lines. The tests that pinned the
0.1 kit's handling of them are named skips pointing at carve-grammars#906.

The relevant coverage lives in `tests/roundtrip.test.ts`,
`tests/authoring-roundtrip.test.ts`, `tests/authoring-constructs.test.ts`,
`tests/code-highlight.test.ts` and `tests/toolbar.test.ts`.
