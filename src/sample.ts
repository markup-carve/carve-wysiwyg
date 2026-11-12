/** Starter document loaded into the hosted editor. */
export const SAMPLE = `---
title: Rich visual authoring
lang: en
---

# Carve WYSIWYG

Use *Insert structure* or press Alt+Shift+K to add Carve-native content without
memorizing its source syntax. Select a structure and open *Inspector* to edit
its identifiers, classes, labels, and metadata.

The standard toolbar still handles /italic/, _underline_, ~struck~, inline
\`code\`, [links](https://github.com/markup-carve), quotes, and lists:

This sentence has an editorial note{# Clarify this claim before publishing. #}.
The annotation controls remain visible while you write. %% Inline review note

%% Block comments now read as review cards and can be hidden from the toolbar.

Direct inline editing is also available for {% a delimited review note %},
!\`/kaet/\` literals, \`<kbd>\`{=html} raw content, {~draft~>final~}
substitutions, $\`x^2\` math, @ada mentions, #review tags, and :rocket: symbols.

\`\`\`javascript
const message = 'The language control follows this full-width code.';
\`\`\`

> Rich structure and familiar editing belong in the same surface.

- bullet item
. bare-dot ordered item

- [ ] Plan the next edit
- [x] Review the draft
- [/] Check the rendering
- [!] Resolve a blocker
- [_] Pause a follow-up
- [-] Drop an obsolete task

::: tip "Everything stays editable"
The source, lint findings, normalization diff, and semantic HTML preview update
alongside the visual document.
:::

{#structured-content}
## Structured content

\`\`\`mermaid
flowchart LR
  Source[Carve source] --> Editor[Visual editor]
  Editor --> Preview[Rendered preview]
\`\`\`

|={<} Feature |={>} Status |
| Tables and figures | Editable |
| References and citations | Searchable |
| Containers and metadata | Inspectable |
^ Authoring coverage

|={>} 2-col header|<|={>} header|
| Spanning table cells |<| Distinct markers |

:::: tabs
:::: tab [Visual]
Author rich structures with contextual controls.
::::
:::: tab [Source]
Inspect the exact Carve output at any time.
::::
::::

See </#structured-content> for the target-aware cross-reference in action, and
open this footnote[^fidelity]. The AST is expanded below and [the project][carve]
uses a reusable link definition. Evidence can be retargeted from [@carve2026].
Edit the document to see lint and normalization feedback update live.

*[AST]: Abstract Syntax Tree

[@carve2026]: Markup Carve contributors. (2026). Carve.

[carve]: https://github.com/markup-carve "Markup Carve"

[^fidelity]: Unsupported syntax is retained visibly instead of being silently discarded.
`;
