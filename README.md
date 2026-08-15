# Carve WYSIWYG

A hosted, static WYSIWYG editor for the [Carve](https://markup-carve.github.io/carve/)
markup language. This fills awesome-djot's "Sandboxes > WYSIWYG" gap for Carve.

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

## Develop / build / test

```bash
npm install      # installs the published Carve engine and grammar packages
npm run dev      # vite dev server
npm run build    # tsc --noEmit + vite build -> dist/
npm test         # vitest round-trip suite (happy-dom)
npm run typecheck
```

## Dependencies

`@markup-carve/carve` and `@markup-carve/carve-grammars` are ordinary npm
dependencies. The grammar is pinned to a single carve-grammars commit on `main`
rather than to a published version, because the productions this editor needs
reach `main` before they reach npm - the language attribute (`{:TAG}`) landed
three days after 0.1.3 published, and 0.1.4 is not on the registry. The pin is
one reviewable line naming the build the editor runs against, and it moves
without waiting on a release, the same shape the spec repo uses for its
carve-js dependency.

Only a merged `main` commit belongs in that pin: a branch build silently
reverts everything that landed after it.

`npm run check:pins` (and `.github/workflows/engine-drift.yml`) enforces that,
plus three more things nothing watched before - the dependency has to be a
commit pin at all, the lockfile has to resolve to the commit `package.json`
names, and the pinned grammar may not be older than the spec revision the
installed engine was built against. Moving back to a published version range is
therefore a deliberate edit to `scripts/check-carve-pins.mjs`, not something a
one-line dependency change can do quietly: a published tarball records no spec
revision, so nothing about its freshness can be verified.

The old vendored grammar was removed after 0.1.3 published. Its two local
footnote parse-priority patches landed upstream in carve-grammars #199, so the
package now provides both the missing functionality and the fixes that
previously required a downstream fork.

carve-grammars' `CarveKit` imports several Tiptap extensions beyond its declared
peerDependencies (code-block, highlight, sub/superscript, image, link, table
family, task family) - those are all listed as direct dependencies here so the
kit resolves.

## Round trip: what is clean vs lossy

The round trip is Carve -> carve-js AST -> ProseMirror doc ->
`serializeToCarve` -> Carve. It no longer renders and reparses HTML on import.
The loader runs with `unsupported: 'preserve'`, so source that has no rich
Tiptap representation is retained in source-preserving nodes rather than
silently discarded.

**Round-trips cleanly** (asserted in `tests/roundtrip.test.ts`):

- Headings (`#`, `##`)
- Inline emphasis: bold `*`, italic `/`, underline `_`, strike `~`
- Bullet and ordered lists
- Links and inline code
- Blockquotes
- Admonition divs (`:::warning`) and their container class.
- Footnotes (reference + definition), including their authored labels.
- Unsupported constructs such as frontmatter through source preservation.
- Block attributes above a construct the editor models only partly - a
  `{#fig-x}` over a `:::` fence - through the document's source envelope. Loads
  go through `setCarveDocument` and saves through `editorToCarve` for that
  reason: Tiptap's `setContent` replaces the doc's content and leaves the doc
  node's attributes behind, so the envelope has to be re-attached. See
  `src/editor.ts`.
- The language attribute: an imported `{lang="fr"}` span keeps its value on the
  span mark and serializes back as the `{:fr}` sugar, the `{:fr}` shorthand
  typed straight into the source pane parses onto that mark, a `<span lang>` in
  pasted HTML parses onto the same mark, and a value that is not a language tag
  keeps the `{lang="..."}` spelling. Asserted in
  `tests/language-attribute.test.ts`.
- **Composite figures** (`::: figure` with no title and no label, Carve PART 9
  section 4c): the group is one editable `carveFigureGroup`, its direct figure
  and table children are the panels in source order, and the `^ ` caption below
  the closing fence is the group's. Everything else in the body stays where it
  was written. An opener carrying a quoted title or a `[label]` is a different
  production and remains the generic container it always was. The mapping is
  the CarveKit schema in `@markup-carve/carve-grammars`, not this app; both
  halves of it - an engine that parses the construct and a schema entry that
  models it - arrived with markup-carve/carve-grammars#225. Asserted in
  `tests/composite-figure.test.ts`.

**Lossy / normalized (documented, not hidden):**

- **CriticMarkup containing its own closing delimiter** (`+}` / `-}` inside
  `{+...+}` / `{-...-}`) cannot round-trip - Carve provides no escape for it.
  This is an upstream serializer limitation noted in carve-grammars.

## Deploy

`.github/workflows/deploy.yml` builds the site and publishes it to GitHub Pages
(`actions/checkout@v4`, `actions/configure-pages@v5`,
`actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`). The build sets
`CARVE_BASE=/<repo>/` so asset paths resolve under the Pages project subpath.
Enable Pages (Settings -> Pages -> Source: GitHub Actions) and push to `main`.

## Manual browser verification

The automated suite (build + happy-dom round trip) covers the data path:
import -> ProseMirror doc -> serialize. The following need a real browser and
should be checked on the deployed page:

- Live editing in the contenteditable surface (typing, selection, caret).
- Toolbar buttons toggling marks/blocks on a live selection.
- Node views (the footnote `[^label]` chip, hard-break indicator, div styling).
- That `onUpdate` refreshes the Carve source and HTML preview on each keystroke.
