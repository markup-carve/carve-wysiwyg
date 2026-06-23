# Carve WYSIWYG

A hosted, static WYSIWYG editor for the [Carve](https://markup-carve.github.io/carve/)
markup language. This fills awesome-djot's "Sandboxes > WYSIWYG" gap for Carve.

It is built from the markup-carve org's own assets:

- **carve-grammars** ships the Tiptap kit (`CarveKit`) and the ProseMirror ->
  Carve serializer (`serializeToCarve`). The visual editing surface and the
  live Carve source pane are driven entirely by these.
- **carve-js** (`@markup-carve/carve`) is the reference parser/renderer. It
  powers the import direction (Carve source -> HTML -> editor) and the HTML
  preview pane.

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
npm install      # uses vendored deps (see "Dependencies")
npm run dev      # vite dev server
npm run build    # tsc --noEmit + vite build -> dist/
npm test         # vitest round-trip suite (happy-dom)
npm run typecheck
```

## Dependencies

The two org packages are vendored under `vendor/` and referenced with `file:`
deps for reproducible installs:

- `vendor/carve-js` - the prebuilt `dist/` of carve-js (its `prepare` build
  script is stripped from the vendored copy so a `file:` install needs no
  TypeScript toolchain).
- `vendor/carve-grammars` - the plain-ESM Tiptap kit + serializer.

To depend by git URL instead, swap the two `file:` entries in `package.json`
for `"@markup-carve/carve": "github:markup-carve/carve-js"` and
`"carve-grammars": "github:markup-carve/carve-grammars"`. Note carve-js's git
install runs a `prepare` (tsc) build, and carve-grammars' `CarveKit` imports
several Tiptap extensions beyond its declared peerDependencies (code-block,
highlight, sub/superscript, image, link, table family, task family) - those are
all listed as direct dependencies here so the kit resolves.

### Vendor patches

Two parse-priority tweaks were applied to the vendored `carve-grammars` so the
footnote round trip is lossless; both are marked with a
`[carve-wysiwyg vendor patch]` comment:

- `carve-footnote.js`: bump `sup.carve-footnote` / `span.carve-footnote-ref`
  parse priority above the Superscript mark (which also claims bare `<sup>`).
- `carve-footnote-definition.js`: bump `li[data-footnote-label]` parse priority
  above the default list item.

## Round trip: what is clean vs lossy

The round trip is Carve -> carve-js HTML -> (normalize) -> ProseMirror doc ->
`serializeToCarve` -> Carve. carve-js and the carve-php-tuned `CarveKit` agree
on most HTML shapes; `src/carve-import.ts` rewrites the few that differ.

**Round-trips cleanly** (asserted in `tests/roundtrip.test.ts`):

- Headings (`#`, `##`)
- Inline emphasis: bold `*`, italic `/`, underline `_`, strike `~`
- Bullet and ordered lists
- Links and inline code
- Blockquotes
- Admonition divs (`:::warning`): carve-js emits
  `<aside class="admonition warning">`, normalized to `div.carve-div.warning`.
- Footnotes (reference + definition).

**Lossy / normalized (documented, not hidden):**

- **Footnote labels are renumbered.** carve-js auto-numbers footnote markers in
  its HTML output (a named `[^foo]` is rendered as `<sup>1</sup>`), and the
  human label is not recoverable from that HTML. The round trip therefore
  preserves the *reference-to-definition pairing* but emits numeric labels
  (`[^1]`) rather than the original name. This is a limitation of importing via
  rendered HTML, not of the serializer.
- **Admonition class set normalizes to a single token.** A `:::warning` keeps
  its `warning` class; multi-class containers collapse to the space-joined
  class string.
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
