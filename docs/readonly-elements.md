# Read-only element authoring opportunities

This audit covers Carve nodes currently represented as atomic or otherwise
source-preserved in the shared Tiptap grammar. The document-metadata card is now
implemented and provides the interaction model for other block-level forms.

## Top three additions

1. **Unsupported block and inline source editor**

   Give `carveUnsupported` and `carveUnsupportedInline` an explicit raw-source
   control with validation. These nodes are the lossless fallback for syntax
   the visual schema does not understand, so making their payload editable
   closes the broadest remaining dead end without pretending to understand its
   structure.

2. **Reference picker popovers**

   Give footnotes, cross-references, and citations a compact click/keyboard
   popover for changing their target. Populate it from definitions and heading
   ids already present in the document, with a plain text fallback for unresolved
   or externally supplied targets. These are inline chips, so a collapsible
   block form would be too heavy.

3. **Definition cards**

   Use compact collapsible forms for abbreviation definitions and link-reference
   definitions. Expose the label plus expansion or destination/title fields,
   while retaining a raw field for uncommon attributes and preserving source
   order.

## Lower priority or already covered

- Embeds already have a dedicated edit action and node view.
- Tab sets and code groups already have switching, rename, add, remove, and
  reorder controls.
- Math, literal, raw-inline, substitutions, symbols, mentions, and empty marks
  are small inline atoms. A generic selection inspector or lightweight popover
  is preferable to permanent form chrome.
- Comments are intentionally visually quiet. Editing them belongs in a small
  source popover, but only after unsupported-source and reference workflows.
- Citation definitions carry richer metadata and could eventually reuse the
  definition-card pattern, after the common citation target picker exists.

## Interaction rules to reuse

- Keep the compact authored representation visible when collapsed.
- Route every edit through a ProseMirror transaction for undo/redo.
- Preserve unknown keys, attributes, ordering, and source payloads.
- Disable form controls and reject transactions in read-only editors.
- Validate delimiter-breaking raw input before committing it.
- Use native buttons, labels, `aria-expanded`, and `aria-controls`; keep inline
  editors keyboard reachable without making their chrome editable content.
