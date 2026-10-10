# Round-trip behavior

The data path is Carve → carve-js AST → ProseMirror document →
`serializeToCarve` → Carve. Import does not render and reparse HTML.

The loader uses `unsupported: 'preserve'`, so syntax without a rich Tiptap
representation remains in source-preserving nodes rather than disappearing.

## Cleanly round-tripped constructs

The automated suite covers:

- headings;
- bold, italic, underline, strike, links, and inline code;
- bullet and ordered lists;
- blockquotes and admonitions;
- footnote references and definitions, including authored labels;
- frontmatter and other source-preserved constructs;
- block attributes on partially modeled structures;
- language spans in shorthand, longhand, and pasted HTML forms;
- composite figures, their ordered panels, attributes, and captions.

The authoring suite separately verifies that every structure-palette recipe,
including tables, tabs, and code groups, produces an editable document. Full
round-trip assertions are added as each underlying Carve production stabilizes.

When the rich document would not write back identically, the loader attaches a
source envelope: the authored source plus its canonical projection
(`carveProjectedSource`). While the document is untouched, saving writes the
authored source verbatim. After an edit, the serializer diffs the edited
document's serialization against the projection and applies only that change to
the authored source, so unedited regions keep their exact spelling. Where the
edit and the authored spelling overlap, the canonical spelling wins.

Loads therefore go through `setCarveDocument`, and saves through
`editorToCarve`: Tiptap's `setContent` replaces document content without
carrying document-node attributes, so the app keeps the envelope itself and
re-attaches it on save. Loading a new document discards the previous envelope.

Composite figures use the `carveFigureGroup` schema node. A bare `::: figure`
opener creates a group; an opener with a title or label remains a generic
container because it is a different Carve production.

The relevant coverage lives in `tests/roundtrip.test.ts`,
`tests/language-attribute.test.ts`, `tests/composite-figure.test.ts`,
`tests/edit-keeps-spelling.test.ts`, and `tests/authoring.test.ts`.

## Known normalization

CriticMarkup containing its own closing delimiter (`+}` or `-}` inside
`{+...+}` or `{-...-}`) cannot round-trip exactly because Carve has no escape
for that delimiter. This is an upstream serializer limitation in
`carve-grammars`.
