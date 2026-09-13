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

Source envelopes preserve authored spelling while the document remains
untouched. Loads therefore go through `setCarveDocument`, and saves through
`editorToCarve`: Tiptap's `setContent` replaces document content without
carrying document-node attributes.

Composite figures use the `carveFigureGroup` schema node. A bare `::: figure`
opener creates a group; an opener with a title or label remains a generic
container because it is a different Carve production.

The relevant coverage lives in `tests/roundtrip.test.ts`,
`tests/language-attribute.test.ts`, `tests/composite-figure.test.ts`, and
`tests/authoring.test.ts`.

## Known normalization

CriticMarkup containing its own closing delimiter (`+}` or `-}` inside
`{+...+}` or `{-...-}`) cannot round-trip exactly because Carve has no escape
for that delimiter. This is an upstream serializer limitation in
`carve-grammars`.
