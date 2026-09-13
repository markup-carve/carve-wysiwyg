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

`@markup-carve/carve` and `@markup-carve/carve-grammars` are ordinary npm
dependencies. The grammar is pinned to a merged `carve-grammars/main` commit
because editor productions can reach `main` before a matching package is
published. For example, the language attribute (`{:TAG}`) landed after the
then-current grammar release. A branch commit must not be used: it can silently
omit work merged after that branch diverged.

`npm run check:pins` and `.github/workflows/engine-drift.yml` verify that the
dependency is a commit pin, the lockfile resolves that commit, and the pinned
commit belongs to the upstream default branch, and the grammar is not older
than the spec revision used by the installed engine.
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
- Open **Document metadata**, edit a common field and raw frontmatter, then
  confirm the source updates and the card collapses again.
- Inspect footnotes, hard breaks, containers, figures, and other node views.
- Confirm source, lint findings, normalization diff, and HTML preview refresh.
- Use the structure palette and inspector with keyboard and pointer input.
- Navigate from a lint finding to its affected source range.
