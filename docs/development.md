# Development and deployment

## Local development

```bash
npm install      # install the Carve engine and grammar packages
npm run dev      # start the Vite development server
npm run build    # typecheck and build dist/
npm test         # run the Vitest round-trip suite
npm run typecheck
npm run check:pins
```

## Dependency pins

Both Carve packages are git commit pins in `package.json`, not npm version
ranges: `@markup-carve/carve` points at a `carve-js` commit and
`@markup-carve/carve-grammars` at a `carve-grammars` commit. Each pin is a
merged commit on that repository's `main`, because editor and engine
productions can reach `main` before a matching package is published. For
example, the language attribute (`{:TAG}`) landed after the then-current grammar
release. A branch commit must not be used: it can silently omit work merged
after that branch diverged.

The `overrides` entry in `package.json` makes carve-grammars use the same
carve-js build as the app, so the engine pin decides both the preview and the
parser behind the editor's loader.

`npm run check:pins` and `.github/workflows/pins.yml` (on pull requests that
touch a pin) verify that the lockfile resolves each pinned commit, the pinned
commit belongs to the upstream default branch, and the grammar is not older
than the spec revision used by the installed engine.
Upstream moving past the pin is only a warning there.
`.github/workflows/engine-drift.yml` runs `check:pins -- --drift` daily. With
`--drift` those warnings exit 3, which files or updates one tracking issue and
leaves the run green; a clean run closes the issue. Any other failure, such as
an error or an unreachable API, turns the run red.
Moving back to a published version range requires updating that policy because
published tarballs do not record a spec revision.

The old vendored grammar was removed after 0.1.3. Its local footnote
parse-priority patches landed upstream in `carve-grammars` #199.

`CarveKit` imports Tiptap extensions beyond its declared peer dependencies,
including code blocks, highlighting, subscript/superscript, images, links,
tables, and task lists. They remain direct dependencies of this app so the kit
can always resolve them.

## GitHub Pages deployment

`.github/workflows/deploy.yml` builds, tests, and publishes the site to GitHub
Pages on every push to `main`. The build sets
`CARVE_BASE=/${{ github.event.repository.name }}/` so assets resolve under the
Pages project subpath.

The live deployment is <https://markup-carve.github.io/carve-wysiwyg/>. The
repository's Pages source must remain **GitHub Actions**.

Pull requests run the same install, typecheck, test, and build gate without
publishing a Pages deployment.

## Manual browser verification

The automated suite covers the Carve → ProseMirror → Carve data path. Before a
release, also verify these interactions in a real browser:

- Type, select text, and move the caret in the editor.
- Toggle marks and blocks from the toolbar.
- Switch Visual/Source tabs with pointer and keyboard activation and confirm
  the selected panel remains open after focus and selection changes.
- Confirm table borders, headers, alternating rows, selected cells, and links
  remain clear in the dark editor theme.
- Exercise reference pickers, definition cards, and exact-source fallback
  controls when their corresponding nodes are present.
- Open **Document metadata**, edit a common field and raw frontmatter, then
  confirm the source updates and the card collapses again.
- Inspect footnotes, hard breaks, containers, figures, and other node views.
- Confirm source, lint findings, normalization diff, and HTML preview refresh.
- Use the structure palette and inspector with keyboard and pointer input.
- Navigate from a lint finding to its affected source range.
